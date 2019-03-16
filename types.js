import { Timeline } from './timeline.js';

import { 
  ExpressionReal,
  ExpressionInteger,
  ExpressionBoolean,
  ExpressionVector,
  ExpressionString,
} from './ast.js';

export let svgNamespace = "http://www.w3.org/2000/svg";

// --------------------------------------------------------------------------- 

export class MessagedException extends Error {
  constructor(message) {
    super(message);
  }

  get userMessage() {
    return this.message;
  }
}

// --------------------------------------------------------------------------- 

export class LocatedException extends MessagedException {
  constructor(where, message) {
    super(message);
    this.where = where;
  }

  get userMessage() {
    return `${this.where.debugPrefix()}${this.message}`;
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleEnvironment {
  constructor(parent) {
    this.bindings = {};
    this.parent = parent;
    if (parent) {
      this.shapes = parent.shapes;
      this.svg = parent.svg;
    }
  }

  get(id) {
    let env = this;
    while (env != null) {
      if (env.bindings.hasOwnProperty(id)) {
        return env.bindings[id];
      }
      env = env.parent;
    }
    return null;
  }

  owns(id) {
    return this.bindings.hasOwnProperty(id);
  }

  has(id) {
    let env = this;
    while (env != null) {
      if (env.bindings.hasOwnProperty(id)) {
        return true;
      }
      env = env.parent;
    }
    return false;
  }

  bind(id, fromTime, toTime, value) {
    this.bindings[id] = value;
  }

  valueAt(env, property, t) {
    // Assumes property exists.
    return this.bindings[property].valueAt(env, t);
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }
}

// ---------------------------------------------------------------------------

export class TwovilleTimelinedEnvironment extends TwovilleEnvironment {
  constructor(env) {
    super(env);
  }

  bind(id, fromTime, toTime, value) {
    if (!this.bindings.hasOwnProperty(id)) {
      this.bindings[id] = new Timeline();
    }

    if (fromTime != null && toTime != null) {
      this.bindings[id].setFromValue(fromTime, value);
      this.bindings[id].setToValue(toTime, value);
    } else if (fromTime != null) {
      this.bindings[id].setFromValue(fromTime, value);
    } else if (toTime != null) {
      this.bindings[id].setToValue(toTime, value);
    } else {
      this.bindings[id].setDefault(value);
    }
  }

}

// --------------------------------------------------------------------------- 

export let serial = 0;

export function initializeShapes() {
  serial = 0;
}

export class TwovilleShape extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression, type) {
    super(env, callExpression);
    this.type = type;
    this.callExpression = callExpression;
    this.parentElement = null;
    this.bindings.stroke = new TwovilleTimelinedEnvironment(this);
    this.bind('opacity', null, null, new ExpressionReal(null, 1));
    this.id = serial;
    ++serial;
  }

  getRGB(env, t) {
    let isCutout = this.owns('parent') && this.get('parent').defaultValue instanceof TwovilleCutout;

    if (!this.has('rgb') && !isCutout) {
      throw new LocatedException(this.callExpression.where, `I found a ${this.type} whose rgb property is not defined.`);
    }
    
    let rgb;
    if (isCutout) {
      rgb = new ExpressionVector(null, [
        new ExpressionInteger(null, 0),
        new ExpressionInteger(null, 0),
        new ExpressionInteger(null, 0),
      ]);
    } else {
      rgb = this.valueAt(env, 'rgb', t);
    }

    return rgb;
  }

  domify(svg) {
    if (this.has('clippers')) {
      let clipPath = document.createElementNS(svgNamespace, 'clipPath');
      clipPath.setAttributeNS(null, 'id', 'clip-' + this.id);
      let clippers = this.get('clippers').getDefault();
      clippers.forEach(clipper => {
        let use = document.createElementNS(svgNamespace, 'use');
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#element-' + clipper.id);
        clipPath.appendChild(use);
      });
      svg.firstChild.appendChild(clipPath);
      this.svgElement.setAttributeNS(null, 'clip-path', 'url(#clip-' + this.id + ')');
    }

    if (this.owns('mask')) {
      let mask = this.get('mask').getDefault();
      this.svgElement.setAttributeNS(null, 'mask', 'url(#element-' + mask.id + ')');
    }

    if (this.owns('parent')) {
      this.parentElement = this.get('parent').getDefault().svgElement;
    } else if (this.owns('template') && this.get('template').getDefault().value) {
      this.parentElement = svg.firstChild;
    } else {
      this.parentElement = this.svg;
    }
    this.parentElement.appendChild(this.svgElement);
  }

}

// --------------------------------------------------------------------------- 

export class TwovilleGroup extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'group');
    this.children = [];
    this.svgElement = document.createElementNS(svgNamespace, 'group');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  draw(env, t) {
    this.children.forEach(child => child.draw(env, t));
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleMask extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'mask');
    this.children = [];
    this.svgElement = document.createElementNS(svgNamespace, 'mask');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.bind('template', null, null, new ExpressionBoolean(null, true));
  }

  draw(env, t) {
    this.children.forEach(child => child.draw(env, t));
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleCutout extends TwovilleMask {
  constructor(env, callExpression) {
    super(env, callExpression);

    let size = env.get('viewport').get('size');

    let corner;
    if (env.get('viewport').has('corner')) {
      corner = env.get('viewport').get('corner');
    } else if (env.get('viewport').has('center')) {
      let center = env.get('viewport').get('center');
      corner = new ExpressionVector(null, [
        new ExpressionReal(null, center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(null, center.get(1).value - size.get(1).value * 0.5),
      ]);
    } else {
      corner = new ExpressionVector(null, [
        new ExpressionInteger(null, 0),
        new ExpressionInteger(null, 0),
      ]);
    }

    let rectangle = document.createElementNS(svgNamespace, 'rect');
    rectangle.setAttributeNS(null, 'x', corner.get(0).value);
    rectangle.setAttributeNS(null, 'y', corner.get(1).value);
    rectangle.setAttributeNS(null, 'width', '100%');
    rectangle.setAttributeNS(null, 'height', '100%');
    rectangle.setAttributeNS(null, 'fill', 'white');

    this.svgElement.appendChild(rectangle);
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleLabel extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'label');
    this.svgElement = document.createElementNS(svgNamespace, 'text');
    this.svgElement.setAttributeNS(null, 'font-size', 8);
    this.svgElement.setAttributeNS(null, 'text-anchor', 'middle');
    this.svgElement.setAttributeNS(null, 'alignment-baseline', 'middle');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.svgElement.appendChild(document.createTextNode('foo'));
  }

  draw(env, t) {
    if (!this.has('position')) {
      throw new LocatedException(this.callExpression.where, 'I found a label whose position property is not defined.');
    }
    
    if (!this.has('text')) {
      throw new LocatedException(this.callExpression.where, 'I found a label whose text property is not defined.');
    }
    
    let needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw new LocatedException(this.callExpression.where, 'I found a label that is rotated, but it\'s pivot property is not defined.');
      }
    }

    // If we have rotation, but no pivot, error.

    let position = this.valueAt(env, 'position', t);
    let rgb = this.getRGB(env, t);
    let text = this.valueAt(env, 'text', t);
    let pivot = null;
    let rotation = null;

    if (needsTransforming) {
      pivot = this.valueAt(env, 'pivot', t);
      rotation = this.valueAt(env, 'rotation', t);
    }

    if (position == null || rgb == null || (needsTransforming && (pivot == null || rotation == null))) {
      this.svgElement.setAttributeNS(null, 'opacity', 0);
    } else {
      this.svgElement.setAttributeNS(null, 'opacity', 1);

      if (needsTransforming) {
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.value + ' ' + pivot.get(0).value + ',' + pivot.get(1).value + ')');
      }

      if (this.has('stroke')) {
        let stroke = this.get('stroke');
        if (stroke.owns('size') &&
            stroke.owns('rgb') &&
            stroke.owns('opacity')) {
          let strokeSize = stroke.valueAt(env, 'size', t);
          let strokeRGB = stroke.valueAt(env, 'rgb', t);
          let strokeOpacity = stroke.valueAt(env, 'opacity', t);
          this.svgElement.setAttributeNS(null, 'stroke', strokeRGB.toRGB());
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.value);
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.value);
        }
      }

      this.svgElement.childNodes[0].nodeValue = text.value;
      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'x', position.get(0).value);
      this.svgElement.setAttributeNS(null, 'y', position.get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleLine extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'line');
    this.svgElement = document.createElementNS(svgNamespace, 'line');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  draw(env, t) {
    if (!this.has('a')) {
      throw new LocatedException(this.callExpression.where, 'I found a line whose a property has not been defined.');
    }
    
    if (!this.has('b')) {
      throw new LocatedException(this.callExpression.where, 'I found a line whose b property has not been defined.');
    }
    
    let needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw new LocatedException(this.callExpression.where, 'I found a line that is rotated, but it\'s pivot property is not defined.');
      }
    }

    // If we have rotation, but no pivot, error.

    let a = this.valueAt(env, 'a', t);
    let b = this.valueAt(env, 'b', t);
    let rgb = this.getRGB(env, t);

    if (needsTransforming) {
      let pivot = this.valueAt(env, 'pivot', t);
      let rotation = this.valueAt(env, 'rotation', t);
    }

    if (a == null || b == null || rgb == null || (needsTransforming && (pivot == null || rotation == null))) {
      this.svgElement.setAttributeNS(null, 'opacity', 0);
    } else {
      this.svgElement.setAttributeNS(null, 'opacity', 1);

      if (needsTransforming) {
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.value + ' ' + pivot.get(0).value + ',' + pivot.get(1).value + ')');
      }

      if (this.has('stroke')) {
        let stroke = this.get('stroke');
        if (stroke.owns('size') &&
            stroke.owns('rgb') &&
            stroke.owns('opacity')) {
          let strokeSize = stroke.valueAt(env, 'size', t);
          let strokeRGB = stroke.valueAt(env, 'rgb', t);
          let strokeOpacity = stroke.valueAt(env, 'opacity', t);
          this.svgElement.setAttributeNS(null, 'stroke', strokeRGB.toRGB());
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.value);
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.value);
        }
      }

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'x1', a.get(0).value);
      this.svgElement.setAttributeNS(null, 'y1', a.get(1).value);
      this.svgElement.setAttributeNS(null, 'x2', b.get(0).value);
      this.svgElement.setAttributeNS(null, 'y2', b.get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleRectangle extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'rectangle');
    this.svgElement = document.createElementNS(svgNamespace, 'rect');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  draw(env, t) {
    if (this.has('corner') && this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found a rectangle whose corner and center properties were both set. Define only one of these.');
    }

    if (!this.has('corner') && !this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found a rectangle whose location I couldn\'t figure out. Please define its corner or center.');
    }
    
    if (!this.has('size')) {
      throw new LocatedException(this.callExpression.where, 'I found a rectangle whose size property is not defined.');
    }
    
    let needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw new LocatedException(this.callExpression.where, 'I found a rectangle that is rotated, but it\'s pivot property is not defined.');
      }
    }

    let size = this.valueAt(env, 'size', t);

    let corner;
    if (this.has('corner')) {
      corner = this.valueAt(env, 'corner', t);
    } else {
      let center = this.valueAt(env, 'center', t);
      corner = new ExpressionVector(null, [
        new ExpressionReal(null, center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(null, center.get(1).value - size.get(1).value * 0.5),
      ]);
    }

    let rgb = this.getRGB(env, t);
    let pivot = null;
    let rotation = null;

    if (needsTransforming) {
      pivot = this.valueAt(env, 'pivot', t);
      rotation = this.valueAt(env, 'rotation', t);
    }

    if (corner == null || size == null || rgb == null || (needsTransforming && (pivot == null || rotation == null))) {
      this.svgElement.setAttributeNS(null, 'opacity', 0);
    } else {
      this.svgElement.setAttributeNS(null, 'opacity', 1);

      if (needsTransforming) {
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.value + ' ' + pivot.get(0).value + ',' + pivot.get(1).value + ')');
      }

      if (this.has('stroke')) {
        let stroke = this.get('stroke');
        if (stroke.owns('size') &&
            stroke.owns('rgb') &&
            stroke.owns('opacity')) {
          let strokeSize = stroke.valueAt(env, 'size', t);
          let strokeRGB = stroke.valueAt(env, 'rgb', t);
          let strokeOpacity = stroke.valueAt(env, 'opacity', t);
          this.svgElement.setAttributeNS(null, 'stroke', strokeRGB.toRGB());
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.value);
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.value);
        }
      }

      if (this.has('rounding')) {
        let rounding = this.valueAt(env, 'rounding', t);
        this.svgElement.setAttributeNS(null, 'rx', rounding.value);
        this.svgElement.setAttributeNS(null, 'ry', rounding.value);
      }

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'x', corner.get(0).value);
      this.svgElement.setAttributeNS(null, 'y', corner.get(1).value);
      this.svgElement.setAttributeNS(null, 'width', size.get(0).value);
      this.svgElement.setAttributeNS(null, 'height', size.get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleCircle extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'circle');
    this.svgElement = document.createElementNS(svgNamespace, 'circle');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  draw(env, t) {
    if (!this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found a circle whose center property is not defined.');
    }
    
    if (!this.has('radius')) {
      throw new LocatedException(this.callExpression.where, 'I found a circle whose radius property is not defined.');
    }
    
    let needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw new LocatedException(this.callExpression.where, 'I found a circle that is rotated, but it\'s pivot property is not defined.');
      }
    }

    let center = this.valueAt(env, 'center', t);
    let radius = this.valueAt(env, 'radius', t);
    let rgb = this.getRGB(env, t);
    let pivot = null;
    let rotation = null;

    if (needsTransforming) {
      pivot = this.valueAt(env, 'pivot', t);
      rotation = this.valueAt(env, 'rotation', t);
    }

    if (center == null || radius == null || rgb == null || (needsTransforming && (pivot == null || rotation == null))) {
      this.svgElement.setAttributeNS(null, 'opacity', 0);
    } else {
      this.svgElement.setAttributeNS(null, 'opacity', 1);

      if (needsTransforming) {
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.value + ' ' + pivot.get(0).value + ',' + pivot.get(1).value + ')');
      }

      if (this.has('stroke')) {
        let stroke = this.get('stroke');
        if (stroke.owns('size') &&
            stroke.owns('rgb') &&
            stroke.owns('opacity')) {
          let strokeSize = stroke.valueAt(env, 'size', t);
          let strokeRGB = stroke.valueAt(env, 'rgb', t);
          let strokeOpacity = stroke.valueAt(env, 'opacity', t);
          this.svgElement.setAttributeNS(null, 'stroke', strokeRGB.toRGB());
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.value);
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.value);
        }
      }

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'cx', center.get(0).value);
      this.svgElement.setAttributeNS(null, 'cy', center.get(1).value);
      this.svgElement.setAttributeNS(null, 'r', radius.value);
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
}

// --------------------------------------------------------------------------- 
