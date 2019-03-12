import { Timeline } from './timeline.js';

export let svgNamespace = "http://www.w3.org/2000/svg";

// --------------------------------------------------------------------------- 

export class MessagedException extends Error {
  constructor(message) {
    super(message);
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
    this.shapes = parent.shapes;
    this.svg = parent.svg;
    this.parent = parent;
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

let serial = 0;

export class TwovilleShape extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression);
    this.callExpression = callExpression;
    this.parentElement = null;
    this.bindings.stroke = new TwovilleTimelinedEnvironment(this);
    this.bind('opacity', null, null, new TwovilleReal(1));
    this.id = serial;
    ++serial;
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
    } else if (this.owns('template') && this.get('template').getDefault().get()) {
      this.parentElement = svg.firstChild;
    } else {
      this.parentElement = this.svg;
    }
    this.parentElement.appendChild(this.svgElement);
  }

}

// --------------------------------------------------------------------------- 

export class TwovilleGroup extends TwovilleShape {
  constructor(env) {
    super(env);
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
    super(env, callExpression);
    this.children = [];
    this.svgElement = document.createElementNS(svgNamespace, 'mask');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.bind('template', null, null, new TwovilleBoolean(true));
  }

  draw(env, t) {
    this.children.forEach(child => child.draw(env, t));
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleLabel extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression);
    this.svgElement = document.createElementNS(svgNamespace, 'text');
    this.svgElement.setAttributeNS(null, 'font-size', 8);
    this.svgElement.setAttributeNS(null, 'text-anchor', 'middle');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.svgElement.appendChild(document.createTextNode('foo'));
  }

  draw(env, t) {
    if (!this.has('position')) {
      throw new LocatedException(this.callExpression.where, 'I found a label whose position property has not been defined.');
    }
    
    if (!this.has('rgb')) {
      throw new LocatedException(this.callExpression.where, 'I found a label whose rgb property has not been defined.');
    }
    
    if (!this.has('text')) {
      throw new LocatedException(this.callExpression.where, 'I found a label whose text property has not been defined.');
    }
    
    let needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw 'rotation but not pivot';
      }
    }

    // If we have rotation, but no pivot, error.

    let position = this.valueAt(env, 'position', t);
    let rgb = this.valueAt(env, 'rgb', t);
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
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.get() + ' ' + pivot.get(0).get() + ',' + pivot.get(1).get() + ')');
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
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.get());
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.get());
        }
      }

      this.svgElement.childNodes[0].nodeValue = text.get();
      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).get());
      this.svgElement.setAttributeNS(null, 'x', position.get(0).get());
      this.svgElement.setAttributeNS(null, 'y', position.get(1).get());
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleLine extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression);
    this.svgElement = document.createElementNS(svgNamespace, 'line');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  draw(env, t) {
    if (!this.has('a')) {
      throw 'no a';
    }
    
    if (!this.has('b')) {
      throw 'no b';
    }
    
    if (!this.has('rgb')) {
      throw 'no rgb';
    }
    
    let needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw 'rotation but not pivot';
      }
    }

    // If we have rotation, but no pivot, error.

    let a = this.valueAt(env, 'a', t);
    let b = this.valueAt(env, 'b', t);
    let rgb = this.valueAt(env, 'rgb', t);

    if (needsTransforming) {
      let pivot = this.valueAt(env, 'pivot', t);
      let rotation = this.valueAt(env, 'rotation', t);
    }

    if (a == null || b == null || rgb == null || (needsTransforming && (pivot == null || rotation == null))) {
      this.svgElement.setAttributeNS(null, 'opacity', 0);
    } else {
      this.svgElement.setAttributeNS(null, 'opacity', 1);

      if (needsTransforming) {
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.get() + ' ' + pivot.get(0).get() + ',' + pivot.get(1).get() + ')');
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
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.get());
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.get());
        }
      }

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).get());
      this.svgElement.setAttributeNS(null, 'x1', a.get(0).get());
      this.svgElement.setAttributeNS(null, 'y1', a.get(1).get());
      this.svgElement.setAttributeNS(null, 'x2', b.get(0).get());
      this.svgElement.setAttributeNS(null, 'y2', b.get(1).get());
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleRectangle extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression);
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
      throw new LocatedException(this.callExpression.where, 'I found a rectangle whose size property has not been defined.');
    }
    
    if (!this.has('rgb')) {
      throw new LocatedException(this.callExpression.where, 'I found a rectangle whose rgb property has not been defined.');
    }
    
    let needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw 'rotation but not pivot';
      }
    }

    let size = this.valueAt(env, 'size', t);

    let corner;
    if (this.has('corner')) {
      corner = this.valueAt(env, 'corner', t);
    } else {
      let center = this.valueAt(env, 'center', t);
      corner = new TwovilleVector([
        new TwovilleReal(center.get(0).get() - size.get(0).get() * 0.5),
        new TwovilleReal(center.get(1).get() - size.get(1).get() * 0.5),
      ]);
    }

    let rgb = this.valueAt(env, 'rgb', t);
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
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.get() + ' ' + pivot.get(0).get() + ',' + pivot.get(1).get() + ')');
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
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.get());
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.get());
        }
      }

      if (this.has('rounding')) {
        let rounding = this.valueAt(env, 'rounding', t);
        this.svgElement.setAttributeNS(null, 'rx', rounding.get());
        this.svgElement.setAttributeNS(null, 'ry', rounding.get());
      }

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).get());
      this.svgElement.setAttributeNS(null, 'x', corner.get(0).get());
      this.svgElement.setAttributeNS(null, 'y', corner.get(1).get());
      this.svgElement.setAttributeNS(null, 'width', size.get(0).get());
      this.svgElement.setAttributeNS(null, 'height', size.get(1).get());
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleCircle extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression);
    this.svgElement = document.createElementNS(svgNamespace, 'circle');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  draw(env, t) {
    if (!this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found a circle whose center property has not been defined.');
    }
    
    if (!this.has('radius')) {
      throw new LocatedException(this.callExpression.where, 'I found a circle whose radius property has not been defined.');
    }
    
    if (!this.has('rgb')) {
      throw new LocatedException(this.callExpression.where, 'I found a circle whose rgb property has not been defined.');
    }
    
    let needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw 'rotation but not pivot';
      }
    }

    let center = this.valueAt(env, 'center', t);
    let radius = this.valueAt(env, 'radius', t);
    let rgb = this.valueAt(env, 'rgb', t);
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
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.get() + ' ' + pivot.get(0).get() + ',' + pivot.get(1).get() + ')');
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
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.get());
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.get());
        }
      }

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).get());
      this.svgElement.setAttributeNS(null, 'cx', center.get(0).get());
      this.svgElement.setAttributeNS(null, 'cy', center.get(1).get());
      this.svgElement.setAttributeNS(null, 'r', radius.get());
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleData {
  constructor() {
  }

  bind(env, fromTime, toTime, id) {
    env.bind(id, fromTime, toTime, this);
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }

  isTimeSensitive(env) {
    return false;
  } // TODO remove
}

// --------------------------------------------------------------------------- 

export class TwovilleVector extends TwovilleData {
  constructor(elements) {
    super();
    this.elements = elements;
  }

  bind(id, fromTime, toTime, value) {
    this.elements.forEach(element => {
      element.bind(id, fromTime, toTime, value);
    });
  }

  forEach(each) {
    this.elements.forEach(each);
  }

  get(i) {
    return this.elements[i];
  }

  evaluate(env) {
    return this;
  }

  toRGB(env) {
    let r = Math.floor(this.elements[0].get() * 255);
    let g = Math.floor(this.elements[1].get() * 255);
    let b = Math.floor(this.elements[2].get() * 255);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  }

  toString(env) {
    return '[' + this.elements.map(element => element.toString()).join(', ') + ']';
  }

  interpolate(other, proportion) {
    return new TwovilleVector(this.elements.map((element, i) => element.interpolate(other.get(i), proportion)));
  }

}

// --------------------------------------------------------------------------- 

export class TwovilleString extends TwovilleData {
  constructor(x) {
    super();
    this.x = x;
  }

  toString() {
    return '' + this.x;
  }

  get() {
    return this.x;
  }

  interpolate(other, proportion) {
    return new TwovilleString(proportion <= 0.5 ? this.get() : other.get());
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleInteger extends TwovilleData {
  constructor(x) {
    super();
    this.x = x;
  }

  toString() {
    return '' + this.x;
  }

  get() {
    return this.x;
  }

  add(other) {
    if (other instanceof TwovilleInteger) {
      return new TwovilleInteger(this.get() + other.get());
    } else if (other instanceof TwovilleReal) {
      return new TwovilleReal(this.get() + other.get());
    } else {
      throw new MessagedException('Add failed');
    }
  }

  subtract(other) {
    if (other instanceof TwovilleInteger) {
      return new TwovilleInteger(this.get() - other.get());
    } else if (other instanceof TwovilleReal) {
      return new TwovilleReal(this.get() - other.get());
    } else {
      throw new MessagedException('Subtract failed');
    }
  }

  multiply(other) {
    if (other instanceof TwovilleInteger) {
      return new TwovilleInteger(this.get() * other.get());
    } else if (other instanceof TwovilleReal) {
      return new TwovilleReal(this.get() * other.get());
    } else {
      throw 'bad ****';
    }
  }

  divide(other) {
    if (other instanceof TwovilleInteger) {
      return new TwovilleInteger(Math.trunc(this.get() / other.get()));
    } else if (other instanceof TwovilleReal) {
      return new TwovilleReal(this.get() / other.get());
    } else {
      throw new MessagedException('Divide failed');
    }
  }

  remainder(other) {
    if (other instanceof TwovilleInteger) {
      return new TwovilleInteger(this.get() % other.get());
    } else if (other instanceof TwovilleReal) {
      return new TwovilleReal(this.get() % other.get());
    } else {
      throw new MessagedException('Remainder failed');
    }
  }

  interpolate(other, proportion) {
    return new TwovilleReal(this.get() + proportion * (other.get() - this.get()));
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleReal extends TwovilleData {
  constructor(x) {
    super();
    this.x = x;
  }

  toString() {
    return '' + this.x;
  }

  get() {
    return this.x;
  }

  add(other) {
    if (other instanceof TwovilleInteger || other instanceof TwovilleReal) {
      return new TwovilleReal(this.get() + other.get());
    } else {
      throw '...';
    }
  }

  subtract(other) {
    if (other instanceof TwovilleInteger || other instanceof TwovilleReal) {
      return new TwovilleReal(this.get() - other.get());
    } else {
      throw '...';
    }
  }

  multiply(other) {
    if (other instanceof TwovilleInteger || other instanceof TwovilleReal) {
      return new TwovilleReal(this.get() * other.get());
    } else {
      throw 'BAD *';
    }
  }

  divide(other) {
    if (other instanceof TwovilleInteger || other instanceof TwovilleReal) {
      return new TwovilleReal(this.get() / other.get());
    } else {
      throw '...';
    }
  }

  remainder(other) {
    if (other instanceof TwovilleInteger || other instanceof TwovilleReal) {
      return new TwovilleReal(this.get() % other.get());
    } else {
      throw '...';
    }
  }

  interpolate(other, proportion) {
    return new TwovilleReal(this.get() + proportion * (other.get() - this.get()));
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleBoolean extends TwovilleData {
  constructor(x) {
    super();
    this.x = x;
  }
   
  toString() {
    return '' + this.x;
  }

  get() {
    return this.x;
  }

  interpolate(other, proportion) {
    return new TwovilleBoolean(proportion <= 0.5 ? this.get() : other.get());
  }
}

// --------------------------------------------------------------------------- 
