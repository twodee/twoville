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

  isTimeSensitive(env) {
    return false;
  }

  assertProperty(id) {
    if (!this.has(id)) {
      throw new LocatedException(this.callExpression.where, `I found a ${this.type} whose ${id} property is not defined.`);
    }
  }

  show() {
    this.svgElement.setAttributeNS(null, 'visibility', 'visible');
  }

  hide() {
    this.svgElement.setAttributeNS(null, 'visibility', 'hidden');
  }
 
  setStroke(env, t) {
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
  }

  setTransform(env, t) {
    if (this.has('rotation')) {
      if (this.has('pivot')) {
        let pivot = this.valueAt(env, 'pivot', t);
        let rotation = this.valueAt(env, 'rotation', t);
        if (pivot && rotation) {
          this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.value + ' ' + pivot.get(0).value + ',' + pivot.get(1).value + ')');
        }
      } else {
        throw new LocatedException(this.callExpression.where, `I found a ${this.type} that is rotated, but it\'s pivot property is not defined.`);
      }
    }
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
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.svgElement.appendChild(document.createTextNode('foo'));
  }

  draw(env, t) {
    this.assertProperty('position');
    this.assertProperty('text');
    
    let position = this.valueAt(env, 'position', t);
    let rgb = this.getRGB(env, t);
    let text = this.valueAt(env, 'text', t);

    let fontSize;
    if (this.has('size')) {
      fontSize = this.valueAt(env, 'size', t);
    } else {
      fontSize = new ExpressionInteger(null, 8);
    }

    let anchor;
    if (this.has('anchor')) {
      anchor = this.valueAt(env, 'anchor', t);
    } else {
      anchor = new ExpressionString(null, 'middle');
    }

    let baseline;
    if (this.has('baseline')) {
      baseline = this.valueAt(env, 'baseline', t);
    } else {
      baseline = new ExpressionString(null, 'middle');
    }

    if (position == null || rgb == null) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);
      this.svgElement.childNodes[0].nodeValue = text.value;
      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'x', position.get(0).value);
      this.svgElement.setAttributeNS(null, 'y', position.get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
      this.svgElement.setAttributeNS(null, 'font-size', fontSize.value);
      this.svgElement.setAttributeNS(null, 'text-anchor', anchor.value);
      this.svgElement.setAttributeNS(null, 'alignment-baseline', baseline.value);
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePoint extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'point');
  }

  evolve(env, t) {
    this.assertProperty('position');
    let position = this.valueAt(env, 'position', t);
    return position;
  }

  evolveToPathVertex(env, t) {
    this.assertProperty('position');
    let position = this.valueAt(env, 'position', t);
    
    // TODO
    // if is jump, use M
    // if is local, use lowercase

    if (position) {
      return `L${position.get(0).value},${position.get(1).value}`;
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleArcTo extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'arcTo');
  }

  evolveToPathVertex(env, t) {
    this.assertProperty('radii');
    this.assertProperty('position');
    
    let position = this.valueAt(env, 'position', t);
    let radii = this.valueAt(env, 'radii', t);

    // TODO helper to assert property
    
    // TODO
    // if is jump, use M
    // if is local, use lowercase
    
    // TODO specify center
    // eliminates radii, still need to specify direction: clockwise or counterclockwise

    if (position) {
      return `A${radii.get(0).value},${radii.get(1).value} 0 1 0 ${position.get(0).value},${position.get(1).value}`;
    } else {
      return null;
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
    this.assertProperty('a');
    this.assertProperty('b');
    
    let a = this.valueAt(env, 'a', t);
    let b = this.valueAt(env, 'b', t);
    let rgb = this.getRGB(env, t);

    if (a == null || b == null || rgb == null) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);

      let aa = a.evolve(env, t);
      let bb = b.evolve(env, t);

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'x1', aa.get(0).value);
      this.svgElement.setAttributeNS(null, 'y1', aa.get(1).value);
      this.svgElement.setAttributeNS(null, 'x2', bb.get(0).value);
      this.svgElement.setAttributeNS(null, 'y2', bb.get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePath extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'path');
    this.svgElement = document.createElementNS(svgNamespace, 'path');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  draw(env, t) {
    this.assertProperty('vertices');
    
    let isClosed = true;
    if (this.has('closed')) {
      isClosed = this.valueAt(env, 'closed', t).value;
    }

    let rgb = this.getRGB(env, t);
    let vertices = this.valueAt(env, 'vertices', t);
    vertices = vertices.map(vertex => vertex.evolveToPathVertex(env, t));
    vertices[0] = vertices[0].replace(/^[Ll]/, 'M');

    if (vertices.some(v => v == null) || rgb == null) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);
      
      let commands = vertices.join(' ');
      if (isClosed) {
        commands += ' Z';
      }

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'd', commands);
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePolygon extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'polygon');
    this.svgElement = document.createElementNS(svgNamespace, 'polygon');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  draw(env, t) {
    this.assertProperty('vertices');
    
    let vertices = this.valueAt(env, 'vertices', t);
    vertices = vertices.map(vertex => vertex.evolve(env, t));
    let rgb = this.getRGB(env, t);

    if (vertices.some(v => v == null) || rgb == null) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);

      let pairs = vertices.map(v => `${v.get(0).value},${v.get(1).value}`).join(' ');

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'points', pairs);
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
    
    this.assertProperty('size');

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

    if (corner == null || size == null || rgb == null) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);

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
    this.assertProperty('center');
    this.assertProperty('radius');
    
    let center = this.valueAt(env, 'center', t);
    let radius = this.valueAt(env, 'radius', t);
    let rgb = this.getRGB(env, t);

    if (center == null || radius == null || rgb == null) {
      this.hide();
    } else {
      this.show();
      this.setTransform(env, t);
      this.setStroke(env, t);
      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'cx', center.get(0).value);
      this.svgElement.setAttributeNS(null, 'cy', center.get(1).value);
      this.svgElement.setAttributeNS(null, 'r', radius.value);
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
}

// --------------------------------------------------------------------------- 
