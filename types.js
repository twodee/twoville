import { 
  Timeline
} from './timeline.js';

import { 
  ExpressionBoolean,
  ExpressionCircle,
  ExpressionCosine,
  ExpressionCutout,
  ExpressionGroup,
  ExpressionIdentifier,
  ExpressionInt,
  ExpressionInteger,
  ExpressionLabel,
  ExpressionLine,
  ExpressionMarker,
  ExpressionMask,
  ExpressionPath,
  ExpressionPathArc,
  ExpressionPathBezier,
  ExpressionPathJump,
  ExpressionPathLine,
  ExpressionPathQuadratic,
  ExpressionPolygon,
  ExpressionPolyline,
  ExpressionPrint,
  ExpressionRandom,
  ExpressionReal,
  ExpressionRectangle,
  ExpressionRotate,
  ExpressionScale,
  ExpressionSeed,
  ExpressionSine,
  ExpressionString,
  ExpressionTranslate,
  ExpressionTurtle,
  ExpressionTurtleMove,
  ExpressionTurtleTurn,
  ExpressionVector,
  ExpressionVectorAdd,
  ExpressionVectorToCartesian,
  ExpressionVectorMagnitude,
  ExpressionVectorNormalize,
  ExpressionVectorSize,
  ExpressionVertex,
} from './ast.js';

export let svgNamespace = "http://www.w3.org/2000/svg";
let selection = null;

// --------------------------------------------------------------------------- 

class Turtle {
  constructor(position, heading) {
    this.position = position;
    this.heading = heading;
  }
}

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

    // Let's make the globals easy to access.
    if (parent) {
      this.shapes = parent.shapes;
      this.svg = parent.svg;
      this.prng = parent.prng;
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

  hasOwn(id) {
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

  bind(id, value) {
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
  constructor(env, callExpression, type) {
    super(env);
    this.callExpression = callExpression;
    this.type = type;
  }

  bind(id, value, fromTime = null, toTime = null) {
    if (!this.bindings.hasOwnProperty(id)) {
      this.bindings[id] = new Timeline();
    }

    // We are assigning one timeline to another...
    if (value instanceof Timeline) {
      let timeline = value;
      if (fromTime != null && toTime != null) {
        this.bindings[id].setFromValue(fromTime, timeline.intervalFrom(fromTime).fromValue);
        this.bindings[id].setToValue(toTime, timeline.intervalTo(toTime).toValue);
      }  if (fromTime != null) {
        this.bindings[id].setFromValue(fromTime, timeline.intervalFrom(fromTime).fromValue);
      } else if (toTime != null) {
        this.bindings[id].setToValue(toTime, timeline.intervalTo(toTime).toValue);
      } else {
        this.bindings[id].setDefault(timeline.getDefault());
      }
    }
    
    else if (fromTime != null && toTime != null) {
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

  assertProperty(id) {
    if (!this.hasOwn(id)) {
      throw new LocatedException(this.callExpression.where, `I found a ${this.type} whose ${id} property is not defined.`);
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
    super(env, callExpression, type);
    this.parentElement = null;
    this.bindings.stroke = new TwovilleTimelinedEnvironment(this, null, 'stroke');
    this.bindings.stroke.bind('opacity', new ExpressionReal(1));
    this.bind('opacity', new ExpressionReal(1));
    this.id = serial;
    ++serial;

    this.initializeTransforms();
    this.initializeAnnotations();
  }

  getParentingElement() {
    return this.svgElement;
  }

  getColor(env, t) {
    let isCutout = this.owns('parent') && this.get('parent').defaultValue instanceof TwovilleCutout;

    if (!this.has('color') && !isCutout) {
      throw new LocatedException(this.callExpression.where, `I found a ${this.type} whose color property is not defined.`);
    }
    
    let color;
    if (isCutout) {
      color = new ExpressionVector([
        new ExpressionInteger(0),
        new ExpressionInteger(0),
        new ExpressionInteger(0),
      ]);
    } else {
      color = this.valueAt(env, 'color', t);
    }

    return color;
  }

  getFunction(id) {
    return this.bindings[id];
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

    if (this.owns('parent')) {
      this.parentElement = this.get('parent').getDefault().getParentingElement();
    } else if (this.owns('template') && this.get('template').getDefault().value) {
      this.parentElement = svg.firstChild;
    } else {
      this.parentElement = this.svg;
    }

    if (this.owns('mask')) {
      let mask = this.get('mask').getDefault();

      let maskParent = document.createElementNS(svgNamespace, 'g');
      maskParent.setAttributeNS(null, 'mask', 'url(#element-' + mask.id + ')');

      maskParent.appendChild(this.svgElement);
      this.parentElement.appendChild(maskParent);
    } else {
      this.parentElement.appendChild(this.svgElement);
    }

    if (this.annotationElements.length > 0) {
      this.annotationParentElement = document.createElementNS(svgNamespace, 'g');
      this.annotationParentElement.setAttributeNS(null, 'id', `element-${this.id}-annotations`);
      this.annotationParentElement.setAttributeNS(null, 'visibility', 'hidden');
      this.annotationParentElement.classList.add('annotation-group');
      this.parentElement.appendChild(this.annotationParentElement);
      for (let element of this.annotationElements) {
        this.annotationParentElement.appendChild(element);
      }
    }
  }

  isTimeSensitive(env) {
    return false;
  }

  show() {
    this.svgElement.setAttributeNS(null, 'visibility', 'visible');
  }

  hide() {
    this.svgElement.setAttributeNS(null, 'visibility', 'hidden');
  }

  setStrokelessStroke(env, t) {
    if (this.owns('size') &&
        this.owns('color') &&
        this.owns('opacity')) {
      let strokeSize = this.valueAt(env, 'size', t);
      let strokeColor = this.valueAt(env, 'color', t);
      let strokeOpacity = this.valueAt(env, 'opacity', t);
      this.svgElement.setAttributeNS(null, 'stroke', strokeColor.toColor());
      this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.value);
      this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.value);
      if (this.owns('dashes')) {
        let dashes = this.valueAt(env, 'dashes', t).toSpacedString();
        this.svgElement.setAttributeNS(null, 'stroke-dasharray', dashes);
      }
    }
  }
 
  setStroke(env, t) {
    if (this.has('stroke')) {
      let stroke = this.get('stroke');
      if (stroke.owns('size') &&
          stroke.owns('color') &&
          stroke.owns('opacity')) {
        let strokeSize = stroke.valueAt(env, 'size', t);
        let strokeColor = stroke.valueAt(env, 'color', t);
        let strokeOpacity = stroke.valueAt(env, 'opacity', t);
        this.svgElement.setAttributeNS(null, 'stroke', strokeColor.toColor());
        this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.value);
        this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.value);
        if (stroke.owns('dashes')) {
          let dashes = stroke.valueAt(env, 'dashes', t).toSpacedString();
          this.svgElement.setAttributeNS(null, 'stroke-dasharray', dashes);
        }
      }
    }
  }
}

// --------------------------------------------------------------------------- 
// TRANSFORMS
// --------------------------------------------------------------------------- 

let transformMixin = {
  initializeTransforms() {
    this.transforms = [];

    this.bindings['translate'] = {
      name: 'translate',
      formals: [],
      body: new ExpressionTranslate(this)
    };

    this.bindings['scale'] = {
      name: 'scale',
      formals: [],
      body: new ExpressionScale(this)
    };

    this.bindings['rotate'] = {
      name: 'rotate',
      formals: [],
      body: new ExpressionRotate(this)
    };
  },

  setTransform(env, t) {
    let attributeValue = this.transforms.slice().reverse().flatMap(xform => xform.evolve(env, t)).join(' ');
    this.svgElement.setAttributeNS(null, 'transform', attributeValue);
  }
}

Object.assign(TwovilleShape.prototype, transformMixin);

// --------------------------------------------------------------------------- 

export class TwovilleGroup extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'group');
    this.children = [];
    this.svgElement = document.createElementNS(svgNamespace, 'g');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  draw(env, t) {
    this.setTransform(env, t);
    this.children.forEach(child => child.draw(env, t));
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleMarker extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'marker');
    this.children = [];
    this.svgElement = document.createElementNS(svgNamespace, 'marker');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.svgElement.setAttributeNS(null, 'orient', 'auto');
    this.svgElement.setAttributeNS(null, 'markerUnits', 'strokeWidth');
    this.bind('template', new ExpressionBoolean(true));
  }

  draw(env, t) {
    this.assertProperty('size');
    this.assertProperty('anchor');

    if (this.has('corner') && this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found a marker whose corner and center properties were both set. Define only one of these.');
    }

    if (!this.has('corner') && !this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found a marker whose location I couldn\'t figure out. Please define its corner or center.');
    }
    
    let anchor = this.valueAt(env, 'anchor', t);
    let size = this.valueAt(env, 'size', t);

    let corner;
    if (this.has('corner')) {
      corner = this.valueAt(env, 'corner', t);
    } else {
      let center = this.valueAt(env, 'center', t);
      corner = new ExpressionVector([
        new ExpressionReal(center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(center.get(1).value - size.get(1).value * 0.5),
      ]);
    }

    let bounds = {
      x: corner.get(0).value,
      y: corner.get(1).value,
      width: size.get(0).value,
      height: size.get(1).value,
    };

    this.svgElement.setAttributeNS(null, 'viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`)

    this.svgElement.setAttributeNS(null, 'markerWidth', size.get(0).value);
    this.svgElement.setAttributeNS(null, 'markerHeight', size.get(1).value);
    this.svgElement.setAttributeNS(null, 'refX', anchor.get(0).value);
    this.svgElement.setAttributeNS(null, 'refY', anchor.get(1).value);

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
    this.bind('template', new ExpressionBoolean(true));

    this.maskGroup = document.createElementNS(svgNamespace, 'g');
    this.svgElement.appendChild(this.maskGroup);
  }

  getParentingElement() {
    return this.maskGroup;
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
      corner = new ExpressionVector([
        new ExpressionReal(center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(center.get(1).value - size.get(1).value * 0.5),
      ]);
    } else {
      corner = new ExpressionVector([
        new ExpressionInteger(0),
        new ExpressionInteger(0),
      ]);
    }

    let rectangle = document.createElementNS(svgNamespace, 'rect');
    rectangle.setAttributeNS(null, 'x', corner.get(0).value);
    rectangle.setAttributeNS(null, 'y', corner.get(1).value);
    rectangle.setAttributeNS(null, 'width', '100%');
    rectangle.setAttributeNS(null, 'height', '100%');
    rectangle.setAttributeNS(null, 'fill', 'white');

    this.getParentingElement().appendChild(rectangle);
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleLabel extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'label');
    this.svgElement = document.createElementNS(svgNamespace, 'text');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.svgElement.appendChild(document.createTextNode('foo'));
    this.registerClickHandler();
  }

  draw(env, t) {
    this.assertProperty('position');
    this.assertProperty('text');
    
    let position = this.valueAt(env, 'position', t);
    let color = this.getColor(env, t);
    let text = this.valueAt(env, 'text', t);

    let fontSize;
    if (this.has('size')) {
      fontSize = this.valueAt(env, 'size', t);
    } else {
      fontSize = new ExpressionInteger(8);
    }

    let anchor;
    if (this.has('anchor')) {
      anchor = this.valueAt(env, 'anchor', t);
    } else {
      anchor = new ExpressionString('middle');
    }

    let baseline;
    if (this.has('baseline')) {
      baseline = this.valueAt(env, 'baseline', t);
    } else {
      baseline = new ExpressionString('center');
    }

    if (position == null || color == null) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);
      this.svgElement.childNodes[0].nodeValue = text.value;
      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'x', position.get(0).value);
      this.svgElement.setAttributeNS(null, 'y', position.get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', color.toColor());
      this.svgElement.setAttributeNS(null, 'font-size', fontSize.value);
      this.svgElement.setAttributeNS(null, 'text-anchor', anchor.value);
      this.svgElement.setAttributeNS(null, 'dominant-baseline', baseline.value);
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleVertex extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'vertex');
    env.nodes.push(this);
  }

  evaluate(env, t) {
    this.assertProperty('position');
    return this.valueAt(env, 'position', t);
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('position');
    let position = this.valueAt(env, 'position', t);
    
    if (position) {
      return [`${position.get(0).value},${position.get(1).value}`, new Turtle(position, fromTurtle.heading)];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleTurtle extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'turtle');
    env.nodes.push(this);
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('position');
    this.assertProperty('heading');

    let position = this.valueAt(env, 'position', t);
    let heading = this.valueAt(env, 'heading', t);
    
    if (position) {
      return [`M${position.get(0).value},${position.get(1).value}`, new Turtle(position, heading)];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleTurtleMove extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'move');
    env.nodes.push(this);
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('distance');

    let distance = this.valueAt(env, 'distance', t);
    
    if (distance) {
      let delta = new ExpressionVector([distance, fromTurtle.heading]).toCartesian();
      let position = fromTurtle.position.add(delta);
      return [`L${position.get(0).value},${position.get(1).value}`, new Turtle(position, fromTurtle.heading)];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleTurtleTurn extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'turn');
    env.nodes.push(this);
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('degrees');
    let degrees = this.valueAt(env, 'degrees', t);
    
    if (degrees) {
      return [null, new Turtle(fromTurtle.position, fromTurtle.heading.add(degrees))];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathJump extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'jump');
    env.nodes.push(this);

    this.positionElement = document.createElementNS(svgNamespace, 'circle');
    this.positionElement.setAttributeNS(null, 'id', `element-${this.id}-position`);

    env.addAnnotation(this.positionElement);
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('position');
    
    let position = this.valueAt(env, 'position', t);

    if (position) {
      this.setVertexAnnotationAttributes(this.positionElement, position);
      return [`M${position.get(0).value},${position.get(1).value}`, new Turtle(position, fromTurtle.heading)];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathLine extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'line');
    env.nodes.push(this);

    this.positionElement = document.createElementNS(svgNamespace, 'circle');
    this.positionElement.setAttributeNS(null, 'id', `element-${this.id}-position`);

    this.lineElement = document.createElementNS(svgNamespace, 'line');

    env.addAnnotation(this.positionElement);
    env.addAnnotation(this.lineElement);
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('position');
    
    let toPosition = this.valueAt(env, 'position', t);

    let isDelta = false;
    if (this.has('delta')) {
      isDelta = this.valueAt(env, 'delta', t).value;
    }

    let absoluteToPosition;
    let letter;
    if (isDelta) {
      absoluteToPosition = fromTurtle.position.add(toPosition);
      letter = 'l';
    } else {
      absoluteToPosition = toPosition;
      letter = 'L';
    }

    if (toPosition) {
      this.setVertexAnnotationAttributes(this.positionElement, absoluteToPosition);
      this.setLineAnnotationAttributes(this.lineElement, fromTurtle.position, absoluteToPosition);

      return [`${letter}${toPosition.get(0).value},${toPosition.get(1).value}`, new Turtle(absoluteToPosition, fromTurtle.heading)];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathBezier extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'cubic');
    env.nodes.push(this);

    this.positionElement = document.createElementNS(svgNamespace, 'circle');
    this.positionElement.setAttributeNS(null, 'id', `element-${this.id}-position`);

    this.control1Element = document.createElementNS(svgNamespace, 'circle');
    this.control1Element.setAttributeNS(null, 'id', `element-${this.id}-control1`);

    this.control2Element = document.createElementNS(svgNamespace, 'circle');
    this.control2Element.setAttributeNS(null, 'id', `element-${this.id}-control2`);

    this.line1Element = document.createElementNS(svgNamespace, 'line');
    this.line2Element = document.createElementNS(svgNamespace, 'line');

    env.addAnnotation(this.positionElement);
    env.addAnnotation(this.control1Element);
    env.addAnnotation(this.control2Element);
    env.addAnnotation(this.line1Element);
    env.addAnnotation(this.line2Element);
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('position');
    this.assertProperty('control2');
    
    let toPosition = this.valueAt(env, 'position', t);
    let control1;
    if (this.has('control1')) {
      control1 = this.valueAt(env, 'control1', t);
    }
    let control2 = this.valueAt(env, 'control2', t);

    let isDelta = false;
    if (this.has('delta')) {
      isDelta = this.valueAt(env, 'delta', t).value;
    }

    if (toPosition) {
      let absoluteToPosition;
      if (isDelta) {
        absoluteToPosition = fromTurtle.position.add(toPosition);
      } else {
        absoluteToPosition = toPosition;
      }

      let toTurtle = new Turtle(absoluteToPosition, fromTurtle.heading);

      this.setVertexAnnotationAttributes(this.positionElement, absoluteToPosition);
      this.setVertexAnnotationAttributes(this.control2Element, control2);

      this.setLineAnnotationAttributes(this.line2Element, control2, absoluteToPosition);

      if (control1) {
        this.setVertexAnnotationAttributes(this.control1Element, control1);
        this.setLineAnnotationAttributes(this.line1Element, control1, fromTurtle.position);
 
        let letter = isDelta ? 'c' : 'C';
        return [`${letter} ${control1.get(0).value},${control1.get(1).value} ${control2.get(0).value},${control2.get(1).value} ${toPosition.get(0).value},${toPosition.get(1).value}`, toTurtle];
      } else {
        let letter = isDelta ? 's' : 'S';
        return [`${letter} ${control2.get(0).value},${control2.get(1).value} ${toPosition.get(0).value},${toPosition.get(1).value}`, toTurtle];
      }
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathQuadratic extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'quadratic');
    env.nodes.push(this);

    this.positionElement = document.createElementNS(svgNamespace, 'circle');
    this.positionElement.setAttributeNS(null, 'id', `element-${this.id}-position`);

    this.controlElement = document.createElementNS(svgNamespace, 'circle');
    this.controlElement.setAttributeNS(null, 'id', `element-${this.id}-control`);

    this.lineElement = document.createElementNS(svgNamespace, 'line');

    env.addAnnotation(this.positionElement);
    env.addAnnotation(this.controlElement);
    env.addAnnotation(this.lineElement);
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('position');
    
    let toPosition = this.valueAt(env, 'position', t);
    let control;
    if (this.has('control')) {
      control = this.valueAt(env, 'control', t);
    }

    let isDelta = false;
    if (this.has('delta')) {
      isDelta = this.valueAt(env, 'delta', t).value;
    }

    if (toPosition) {
      let absoluteToPosition;
      if (isDelta) {
        absoluteToPosition = fromTurtle.position.add(toPosition);
      } else {
        absoluteToPosition = toPosition;
      }

      let toTurtle = new Turtle(absoluteToPosition, fromTurtle.heading);
      this.setVertexAnnotationAttributes(this.positionElement, absoluteToPosition);

      if (control) {
        this.setVertexAnnotationAttributes(this.controlElement, control);
        this.setLineAnnotationAttributes(this.lineElement, control, absoluteToPosition);

        let letter = isDelta ? 'q' : 'Q';
        return [`${letter} ${control.get(0).value},${control.get(1).value} ${toPosition.get(0).value},${toPosition.get(1).value}`, toTurtle];
      } else {
        let letter = isDelta ? 't' : 'T';
        return [`${letter}${toPosition.get(0).value},${toPosition.get(1).value}`, toTurtle];
      }
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathArc extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'arc');
    env.nodes.push(this);

    this.centerElement = document.createElementNS(svgNamespace, 'circle');
    this.centerElement.setAttributeNS(null, 'id', `element-${this.id}-center`);

    this.circleElement = document.createElementNS(svgNamespace, 'circle');
    this.circleElement.setAttributeNS(null, 'id', `element-${this.id}-circle`);

    this.positionElement = document.createElementNS(svgNamespace, 'circle');
    this.positionElement.setAttributeNS(null, 'id', `element-${this.id}-position`);

    env.addAnnotation(this.centerElement);
    env.addAnnotation(this.circleElement);
    env.addAnnotation(this.positionElement);
  }

  evolve(env, t, fromTurtle) {
    if (this.has('position') && this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found an arc whose position and center properties were both set. Define only one of these.');
    }

    if (!this.has('position') && !this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found an arc whose curvature I couldn\'t figure out. Please define its center or position.');
    }

    this.assertProperty('degrees');
    let degrees = this.valueAt(env, 'degrees', t);
    let radians = degrees * Math.PI / 180;

    let isDelta = false;
    if (this.has('delta')) {
      isDelta = this.valueAt(env, 'delta', t).value;
    }

    let center;
    if (this.has('center')) {
      center = this.valueAt(env, 'center', t);
      if (isDelta) {
        center = center.add(fromTurtle.position);
      }
    } else {
      let toPosition = this.valueAt(env, 'position', t);
      if (isDelta) {
        toPosition = fromTurtle.position.add(toPosition);
      }

      let diff = toPosition.subtract(fromTurtle.position);
      let distance = (0.5 * diff.magnitude) / Math.tan(radians * 0.5);
      let halfway = fromTurtle.position.add(toPosition).multiply(new ExpressionReal(0.5));
      let normal = diff.rotate90().normalize();
      center = halfway.add(normal.multiply(new ExpressionReal(-distance)));
    }

    let toFrom = fromTurtle.position.subtract(center);
    let toTo = new ExpressionVector([
      new ExpressionReal(toFrom.get(0).value * Math.cos(radians) - toFrom.get(1).value * Math.sin(radians)),
      new ExpressionReal(toFrom.get(0).value * Math.sin(radians) + toFrom.get(1).value * Math.cos(radians)),
    ]);
    let to = center.add(toTo);

    let radius = toFrom.magnitude;
    let large;
    let sweep;

    if (degrees.value >= 0) {
      large = degrees.value >= 180 ? 1 : 0;
      sweep = 1;
    } else {
      large = degrees.value <= -180 ? 1 : 0;
      sweep = 0;
    }

    this.circleElement.setAttributeNS(null, 'cx', center.get(0).value);
    this.circleElement.setAttributeNS(null, 'cy', center.get(1).value);
    this.circleElement.setAttributeNS(null, 'r', radius);
    this.circleElement.setAttributeNS(null, 'vector-effect', 'non-scaling-stroke');
    this.circleElement.setAttributeNS(null, 'fill', 'none');
    this.circleElement.setAttributeNS(null, 'stroke', 'gray');
    this.circleElement.setAttributeNS(null, 'stroke-opacity', 1);
    this.circleElement.setAttributeNS(null, 'stroke-width', 1);
    this.circleElement.setAttributeNS(null, 'stroke-dasharray', '2 2');
    this.circleElement.classList.add('annotation');

    this.setVertexAnnotationAttributes(this.centerElement, center);
    this.setVertexAnnotationAttributes(this.positionElement, to);

    return [`A${radius},${radius} 0 ${large} ${sweep} ${to.get(0).value},${to.get(1).value}`, new Turtle(to, fromTurtle.heading)];
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleTranslate extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'translate');
    env.transforms.push(this);
  }

  evolve(env, t) {
    this.assertProperty('offset');
    let offset = this.valueAt(env, 'offset', t);

    if (offset) {
      return [`translate(${offset.get(0).value} ${offset.get(1).value})`];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleRotate extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'rotate');
    env.transforms.push(this);
  }

  evolve(env, t) {
    this.assertProperty('degrees');
    this.assertProperty('pivot');

    let pivot = this.valueAt(env, 'pivot', t);
    let degrees = this.valueAt(env, 'degrees', t);

    if (pivot && degrees) {
      return [`rotate(${degrees.value} ${pivot.get(0).value} ${pivot.get(1).value})`];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleScale extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'scale');
    env.transforms.push(this);
  }

  evolve(env, t) {
    this.assertProperty('factors');
    let factors = this.valueAt(env, 'factors', t);

    let pivot;
    if (this.has('pivot')) {
      pivot = this.valueAt(env, 'pivot', t);
    }

    if (factors) {
      if (pivot) {
        return [
          `translate(${-pivot.get(0).value} ${-pivot.get(1).value})`,
          `scale(${factors.get(0).value} ${factors.get(1).value})`,
          `translate(${pivot.get(0).value} ${pivot.get(1).value})`,
        ];
      } else {
        return [`scale(${factors.get(0).value} ${factors.get(1).value})`];
      }
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleMarkerable extends TwovilleShape {
  constructor(env, callExpression, name) {
    super(env, callExpression, name);
  }

  draw(env, t) {
    // Difference between owns and has? TODO

    if (this.owns('node')) {
      let node = this.get('node').getDefault();
      this.svgElement.setAttributeNS(null, 'marker-mid', 'url(#element-' + node.id + ')');
      this.svgElement.setAttributeNS(null, 'marker-start', 'url(#element-' + node.id + ')');
      this.svgElement.setAttributeNS(null, 'marker-end', 'url(#element-' + node.id + ')');
    }

    if (this.owns('head')) {
      let head = this.get('head').getDefault();
      this.svgElement.setAttributeNS(null, 'marker-end', 'url(#element-' + head.id + ')');
    }

    if (this.owns('tail')) {
      let tail = this.get('tail').getDefault();
      this.svgElement.setAttributeNS(null, 'marker-start', 'url(#element-' + tail.id + ')');
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleLine extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'line');
    this.svgElement = document.createElementNS(svgNamespace, 'line');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();
    this.nodes = [];

    this.bindings['vertex'] = {
      name: 'vertex',
      formals: [],
      body: new ExpressionVertex(this)
    };

    this.bindings['turtle'] = {
      name: 'turtle',
      formals: [],
      body: new ExpressionTurtle(this)
    };

    this.bindings['turn'] = {
      name: 'turn',
      formals: [],
      body: new ExpressionTurtleTurn(this)
    };

    this.bindings['move'] = {
      name: 'move',
      formals: [],
      body: new ExpressionTurtleMove(this)
    };

    this.positionElements = [
      document.createElementNS(svgNamespace, 'circle'),
      document.createElementNS(svgNamespace, 'circle')
    ];
    this.lineElement = document.createElementNS(svgNamespace, 'line')
    this.addAnnotation(this.positionElements[0]);
    this.addAnnotation(this.positionElements[1]);
    this.addAnnotation(this.lineElement);
  }

  draw(env, t) {
    super.draw(env, t);

    let vertices = [];
    let last = new Turtle(null, null);
    this.nodes.forEach(node => {
      let result = node.evolve(env, t, last);
      last = result[1];
      if (result[0] != null) {
        vertices.push(result[1].position);
      }
    });
    let color = this.getColor(env, t);

    if (vertices.length != 2) {
      throw new LocatedException(this.callExpression.where, `I tried to draw a line that had ${vertices.length} ${vertices.length == 1 ? 'vertex' : 'vertices'}. Lines must have exactly two vertices.`);
    }
    
    if (vertices.some(v => v == null) || color == null) {
      this.hide();
    } else {
      this.show();
      this.setStrokelessStroke(env, t);
      this.setTransform(env, t);

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'x1', vertices[0].get(0).value);
      this.svgElement.setAttributeNS(null, 'y1', vertices[0].get(1).value);
      this.svgElement.setAttributeNS(null, 'x2', vertices[1].get(0).value);
      this.svgElement.setAttributeNS(null, 'y2', vertices[1].get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', color.toColor());

      this.setVertexAnnotationAttributes(this.positionElements[0], vertices[0]);
      this.setVertexAnnotationAttributes(this.positionElements[1], vertices[1]);
      this.setLineAnnotationAttributes(this.lineElement, vertices[0], vertices[1]);
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePath extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'path');
    this.svgElement = document.createElementNS(svgNamespace, 'path');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();
    this.nodes = [];

    this.bindings['arc'] = {
      name: 'arc',
      formals: [],
      body: new ExpressionPathArc(this)
    };

    this.bindings['cubic'] = {
      name: 'cubic',
      formals: [],
      body: new ExpressionPathBezier(this)
    };

    this.bindings['jump'] = {
      name: 'jump',
      formals: [],
      body: new ExpressionPathJump(this)
    };

    this.bindings['line'] = {
      name: 'line',
      formals: [],
      body: new ExpressionPathLine(this)
    };

    this.bindings['quadratic'] = {
      name: 'quadratic',
      formals: [],
      body: new ExpressionPathQuadratic(this)
    };

    this.bindings['turtle'] = {
      name: 'turtle',
      formals: [],
      body: new ExpressionTurtle(this)
    };

    this.bindings['turn'] = {
      name: 'turn',
      formals: [],
      body: new ExpressionTurtleTurn(this)
    };

    this.bindings['move'] = {
      name: 'move',
      formals: [],
      body: new ExpressionTurtleMove(this)
    };
  }

  draw(env, t) {
    super.draw(env, t);

    let isClosed = true;
    if (this.has('closed')) {
      isClosed = this.valueAt(env, 'closed', t).value;
    }

    let last = new Turtle(null, null);
    let vertices = [];
    this.nodes.forEach(node => {
      let result = node.evolve(env, t, last);
      last = result[1];
      if (result[0] != null) {
        vertices.push(result[0]);
      }
    });

    let opacity = this.valueAt(env, 'opacity', t).value;
    let isVisible = opacity > 0.0001;
    let color = null;
    if (isVisible) {
      color = this.getColor(env, t);
    }

    if (vertices.some(v => v == null) || (color == null && isVisible)) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);
      
      let commands = vertices.join(' ');
      if (isClosed) {
        commands += ' Z';
      }

      this.svgElement.setAttributeNS(null, 'd', commands);
      this.svgElement.setAttributeNS(null, 'fill', isVisible ? color.toColor() : 'none');
      this.svgElement.setAttributeNS(null, 'fill-opacity', opacity);
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePolygon extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'polygon');
    this.svgElement = document.createElementNS(svgNamespace, 'polygon');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();
    this.nodes = [];

    this.bindings['vertex'] = {
      name: 'vertex',
      formals: [],
      body: new ExpressionVertex(this)
    };

    this.bindings['turtle'] = {
      name: 'turtle',
      formals: [],
      body: new ExpressionTurtle(this)
    };

    this.bindings['turn'] = {
      name: 'turn',
      formals: [],
      body: new ExpressionTurtleTurn(this)
    };

    this.bindings['move'] = {
      name: 'move',
      formals: [],
      body: new ExpressionTurtleMove(this)
    };

    this.annotations = {
      polygon: document.createElementNS(svgNamespace, 'polygon'),
      vertexGroup: document.createElementNS(svgNamespace, 'g'),
      vertices: [],
    };
    this.addAnnotation(this.annotations.polygon);
    this.addAnnotation(this.annotations.vertexGroup);
  }

  draw(env, t) {
    super.draw(env, t);

    let color = this.getColor(env, t);

    let last = new Turtle(null, null);
    let vertices = [];
    this.nodes.forEach(node => {
      let result = node.evolve(env, t, last);
      last = result[1];
      if (result[0] != null) {
        vertices.push(result[1].position);
      }
    });

    if (vertices.some(v => v == null) || color == null) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);

      let commands = vertices.map(p => `${p.get(0).value},${p.get(1).value}`).join(' ');

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'points', commands);
      this.svgElement.setAttributeNS(null, 'fill', color.toColor());

      this.annotations.polygon.setAttributeNS(null, 'points', commands);
      setCommonAnnotationProperties(this.annotations.polygon);

      // Remove old vertices.
      for (let vertexAnnotation of this.annotations.vertices) {
        vertexAnnotation.parentNode.removeChild(vertexAnnotation);
      }

      this.annotations.vertices = [];
      for (let vertex of vertices) {
        let vertexAnnotation = document.createElementNS(svgNamespace, 'circle');
        this.setVertexAnnotationAttributes(vertexAnnotation, vertex);
        this.annotations.vertexGroup.appendChild(vertexAnnotation);
        this.annotations.vertices.push(vertexAnnotation);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePolyline extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'polyline');
    this.svgElement = document.createElementNS(svgNamespace, 'polyline');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();
    this.nodes = [];

    this.bindings['vertex'] = {
      name: 'vertex',
      formals: [],
      body: new ExpressionVertex(this)
    };

    this.bindings['turtle'] = {
      name: 'turtle',
      formals: [],
      body: new ExpressionTurtle(this)
    };

    this.bindings['turn'] = {
      name: 'turn',
      formals: [],
      body: new ExpressionTurtleTurn(this)
    };

    this.bindings['move'] = {
      name: 'move',
      formals: [],
      body: new ExpressionTurtleMove(this)
    };

    this.annotations = {
      polyline: document.createElementNS(svgNamespace, 'polyline'),
      vertexGroup: document.createElementNS(svgNamespace, 'g'),
      vertices: [],
    };
    this.addAnnotation(this.annotations.polyline);
    this.addAnnotation(this.annotations.vertexGroup);
  }

  draw(env, t) {
    super.draw(env, t);

    this.assertProperty('size');

    let size = this.valueAt(env, 'size', t);
    let color = this.getColor(env, t);

    let last = new Turtle(null, null);
    let vertices = [];
    this.nodes.forEach(node => {
      let result = node.evolve(env, t, last);
      last = result[1];
      if (result[0] != null) {
        vertices.push(result[1].position);
      }
    });

    if (vertices.some(v => v == null) || color == null) {
      this.hide();
    } else {
      this.show();
      this.setStrokelessStroke(env, t);
      this.setTransform(env, t);

      let commands = vertices.map(p => `${p.get(0).value},${p.get(1).value}`).join(' ');

      this.svgElement.setAttributeNS(null, 'points', commands);
      this.svgElement.setAttributeNS(null, 'fill', 'none');

      this.annotations.polyline.setAttributeNS(null, 'points', commands);
      setCommonAnnotationProperties(this.annotations.polyline);

      // Remove old vertices.
      for (let vertexAnnotation of this.annotations.vertices) {
        vertexAnnotation.parentNode.removeChild(vertexAnnotation);
      }

      this.annotations.vertices = [];
      for (let vertex of vertices) {
        let vertexAnnotation = document.createElementNS(svgNamespace, 'circle');
        this.setVertexAnnotationAttributes(vertexAnnotation, vertex);
        this.annotations.vertexGroup.appendChild(vertexAnnotation);
        this.annotations.vertices.push(vertexAnnotation);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleRectangle extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'rectangle');
    this.svgElement = document.createElementNS(svgNamespace, 'rect');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();

    this.rectangleElement = document.createElementNS(svgNamespace, 'rect');
    this.positionElement = document.createElementNS(svgNamespace, 'circle');
    this.addAnnotation(this.rectangleElement);
    this.addAnnotation(this.positionElement);
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
    let center;
    if (this.has('corner')) {
      corner = this.valueAt(env, 'corner', t);
    } else {
      center = this.valueAt(env, 'center', t);
      corner = new ExpressionVector([
        new ExpressionReal(center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(center.get(1).value - size.get(1).value * 0.5),
      ]);
    }

    let opacity = this.valueAt(env, 'opacity', t).value;
    let isVisible = opacity > 0.0001;
    let color = null;
    if (isVisible) {
      color = this.getColor(env, t);
    }

    if (corner == null || size == null || (color == null && isVisible)) {
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

      this.svgElement.setAttributeNS(null, 'x', corner.get(0).value);
      this.svgElement.setAttributeNS(null, 'y', corner.get(1).value);
      this.svgElement.setAttributeNS(null, 'width', size.get(0).value);
      this.svgElement.setAttributeNS(null, 'height', size.get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', isVisible ? color.toColor() : 'none');
      this.svgElement.setAttributeNS(null, 'fill-opacity', opacity);

      this.setRectangleAnnotationAttributes(this.rectangleElement, corner, size);

      if (center) {
        this.setVertexAnnotationAttributes(this.positionElement, center);
      } else {
        this.setVertexAnnotationAttributes(this.positionElement, corner);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleCircle extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'circle');
    this.svgElement = document.createElementNS(svgNamespace, 'circle');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();

    this.circleElement = document.createElementNS(svgNamespace, 'circle');
    this.positionElement = document.createElementNS(svgNamespace, 'circle');
    this.addAnnotation(this.circleElement);
    this.addAnnotation(this.positionElement);
  }

  draw(env, t) {
    this.assertProperty('center');
    this.assertProperty('radius');
    
    let opacity = this.valueAt(env, 'opacity', t).value;
    let center = this.valueAt(env, 'center', t);
    let radius = this.valueAt(env, 'radius', t);

    let isVisible = opacity > 0.0001;
    let color = null;
    if (isVisible) {
      color = this.getColor(env, t);
    }

    if (center == null || radius == null || (color == null && isVisible)) {
      this.hide();
    } else {
      this.show();
      this.setTransform(env, t);
      this.setStroke(env, t);
      this.svgElement.setAttributeNS(null, 'cx', center.get(0).value);
      this.svgElement.setAttributeNS(null, 'cy', center.get(1).value);
      this.svgElement.setAttributeNS(null, 'r', radius.value);
      this.svgElement.setAttributeNS(null, 'fill', isVisible ? color.toColor() : 'none');
      this.svgElement.setAttributeNS(null, 'fill-opacity', opacity);

      this.setCircleAnnotationAttributes(this.circleElement, center, radius);
      this.setVertexAnnotationAttributes(this.positionElement, center);
    }
  }
}

// --------------------------------------------------------------------------- 

export class Random {
  constructor() {
    this.engine = new Math.seedrandom();
  }

  seed(value) {
    this.engine = new Math.seedrandom(value);
  }

  random01() {
    return this.engine.quick();
  }
}

// --------------------------------------------------------------------------- 

export class GlobalEnvironment extends TwovilleEnvironment {
  constructor(svg) {
    super(null);
    this.svg = svg;
    this.shapes = [];

    this.prng = new Random();

    this.svg.addEventListener('click', () => {
      if (selection) {
        selection.annotationParentElement.setAttributeNS(null, 'visibility', 'hidden');
        selection = null;
      }
    }, false);

    this.bindings.time = new TwovilleEnvironment(this);
    this.bindings.time.bind('start', new ExpressionInteger(0));
    this.bindings.time.bind('stop', new ExpressionInteger(100));
    this.bindings.time.bind('delay', new ExpressionInteger(16));
    this.bindings.time.bind('resolution', new ExpressionInteger(1));

    this.bindings.gif = new TwovilleEnvironment(this);
    this.bindings.gif.bind('size', new ExpressionVector([
      new ExpressionInteger(100),
      new ExpressionInteger(100)
    ]));
    this.bindings.gif.bind('name', new ExpressionString('twoville.gif'));
    this.bindings.gif.bind('transparency', new ExpressionVector([
      new ExpressionReal(0),
      new ExpressionReal(0),
      new ExpressionReal(0),
    ]));
    this.bindings.gif.bind('repeat', new ExpressionInteger(0));
    this.bindings.gif.bind('delay', new ExpressionInteger(10));

    this.bindings.viewport = new TwovilleEnvironment(this);
    this.bindings.viewport.bind('size', new ExpressionVector([
      new ExpressionInteger(100),
      new ExpressionInteger(100)
    ]));

    this.bindings['rectangle'] = {
      name: 'rectangle',
      formals: [],
      body: new ExpressionRectangle()
    };

    this.bindings['line'] = {
      name: 'line',
      formals: [],
      body: new ExpressionLine()
    };

    this.bindings['path'] = {
      name: 'path',
      formals: [],
      body: new ExpressionPath()
    };

    this.bindings['polygon'] = {
      name: 'polygon',
      formals: [],
      body: new ExpressionPolygon()
    };

    this.bindings['polyline'] = {
      name: 'polyline',
      formals: [],
      body: new ExpressionPolyline()
    };

    this.bindings['label'] = {
      name: 'label',
      formals: [],
      body: new ExpressionLabel()
    };

    this.bindings['group'] = {
      name: 'group',
      formals: [],
      body: new ExpressionGroup()
    };

    this.bindings['marker'] = {
      name: 'marker',
      formals: [],
      body: new ExpressionMarker()
    };

    this.bindings['mask'] = {
      name: 'mask',
      formals: [],
      body: new ExpressionMask()
    };

    this.bindings['cutout'] = {
      name: 'cutout',
      formals: [],
      body: new ExpressionCutout()
    };

    this.bindings['circle'] = {
      name: 'circle',
      formals: [],
      body: new ExpressionCircle()
    };

    this.bindings['print'] = {
      name: 'print',
      formals: ['message'],
      body: new ExpressionPrint()
    };

    this.bindings['random'] = {
      name: 'random',
      formals: ['min', 'max'],
      body: new ExpressionRandom()
    };

    this.bindings['seed'] = {
      name: 'seed',
      formals: ['value'],
      body: new ExpressionSeed()
    };

    this.bindings['sin'] = {
      name: 'sin',
      formals: ['degrees'],
      body: new ExpressionSine()
    };

    this.bindings['cos'] = {
      name: 'cos',
      formals: ['degrees'],
      body: new ExpressionCosine()
    };

    this.bindings['int'] = {
      name: 'int',
      formals: ['x'],
      body: new ExpressionInt()
    };
  }
}

// --------------------------------------------------------------------------- 
// ANNOTATIONS
// ----------------------------------------------------------------------------

let annotationMixin = {
  initializeAnnotations() {
    this.annotationParentElement = null;
    this.annotationElements = [];
  },

  addAnnotation(element) {
    this.annotationElements.push(element);
  },

  registerClickHandler() {
    this.svgElement.classList.add('selectable');

    this.svgElement.addEventListener('click', event => {
      // The parent SVG also listens for clicks and deselects. We don't want the
      // parent involved when a child is clicked on.
      event.stopPropagation();

      if (this.annotationParentElement) {
        if (selection == this) {
          this.annotationParentElement.setAttributeNS(null, 'visibility', 'hidden');
          selection = null;
        } else {
          if (selection) {
            selection.annotationParentElement.setAttributeNS(null, 'visibility', 'hidden');
          }
          this.annotationParentElement.setAttributeNS(null, 'visibility', 'visible');
          selection = this;
        }
      }
    });

    this.svgElement.addEventListener('mouseenter', event => {
      event.stopPropagation();
      if (this.annotationParentElement) {
        this.annotationParentElement.setAttributeNS(null, 'visibility', 'visible');
      }
    });

    this.svgElement.addEventListener('mouseleave', event => {
      event.stopPropagation();
      if (this.annotationParentElement && selection != this) {
        this.annotationParentElement.setAttributeNS(null, 'visibility', 'hidden');
      }
    });
  },

  setVertexAnnotationAttributes(annotation, position) {
    annotation.setAttributeNS(null, 'cx', position.get(0).value);
    annotation.setAttributeNS(null, 'cy', position.get(1).value);
    annotation.setAttributeNS(null, 'r', 0.1);
    this.setCommonAnnotationProperties(annotation);
  },

  setLineAnnotationAttributes(annotation, from, to) {
    annotation.setAttributeNS(null, 'x1', from.get(0).value);
    annotation.setAttributeNS(null, 'y1', from.get(1).value);
    annotation.setAttributeNS(null, 'x2', to.get(0).value);
    annotation.setAttributeNS(null, 'y2', to.get(1).value);
    this.setCommonAnnotationProperties(annotation);
  },

  setRectangleAnnotationAttributes(annotation, position, size) {
    annotation.setAttributeNS(null, 'x', position.get(0).value);
    annotation.setAttributeNS(null, 'y', position.get(1).value);
    annotation.setAttributeNS(null, 'width', size.get(0).value);
    annotation.setAttributeNS(null, 'height', size.get(1).value);
    this.setCommonAnnotationProperties(annotation);
  },

  setCircleAnnotationAttributes(annotation, center, radius) {
    annotation.setAttributeNS(null, 'cx', center.get(0).value);
    annotation.setAttributeNS(null, 'cy', center.get(1).value);
    annotation.setAttributeNS(null, 'r', radius.value);
    this.setCommonAnnotationProperties(annotation);
  },

  setCommonAnnotationProperties(annotation) {
    annotation.setAttributeNS(null, 'stroke-width', 1);
    annotation.setAttributeNS(null, 'stroke-opacity', 1);
    annotation.setAttributeNS(null, 'stroke', 'gray');
    annotation.setAttributeNS(null, 'vector-effect', 'non-scaling-stroke');
    annotation.setAttributeNS(null, 'fill', 'none');
    annotation.setAttributeNS(null, 'stroke-dasharray', '2 2');
    annotation.classList.add('annotation');
  },
};

Object.assign(TwovilleShape.prototype, annotationMixin);
Object.assign(TwovillePathJump.prototype, annotationMixin);
Object.assign(TwovillePathLine.prototype, annotationMixin);
Object.assign(TwovillePathBezier.prototype, annotationMixin);
Object.assign(TwovillePathQuadratic.prototype, annotationMixin);
Object.assign(TwovillePathArc.prototype, annotationMixin);
Object.assign(TwovilleTurtleMove.prototype, annotationMixin);
Object.assign(TwovilleTurtleTurn.prototype, annotationMixin);

// --------------------------------------------------------------------------- 

