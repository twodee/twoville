import { 
  Timeline
} from './timeline.js';

const seedrandom = require('seedrandom');

import { 
  beginTweaking,
  endTweaking,
  tweak,
  interpret,
  isDirty,
  mouseAtSvg,
  drawAfterHandling,
} from './main.js';

import { 
  FunctionDefinition,
  ExpressionAdd,
  ExpressionArcSine,
  ExpressionBoolean,
  ExpressionCircle,
  ExpressionCosine,
  ExpressionCutout,
  ExpressionDivide,
  ExpressionGroup,
  ExpressionIdentifier,
  ExpressionInt,
  ExpressionInteger,
  ExpressionLabel,
  ExpressionLine,
  ExpressionMarker,
  ExpressionMask,
  ExpressionMultiply,
  ExpressionPath,
  ExpressionPathArc,
  ExpressionPathCubic,
  ExpressionPathJump,
  ExpressionPathLine,
  ExpressionPathQuadratic,
  ExpressionPower,
  ExpressionPolygon,
  ExpressionPolyline,
  ExpressionPrint,
  ExpressionRandom,
  ExpressionReal,
  ExpressionRectangle,
  ExpressionRotate,
  ExpressionScale,
  ExpressionShear,
  ExpressionSeed,
  ExpressionSine,
  ExpressionSquareRoot,
  ExpressionString,
  ExpressionSubtract,
  ExpressionTangent,
  ExpressionTranslate,
  ExpressionTurtle,
  ExpressionTurtleMove,
  ExpressionTurtleTurn,
  ExpressionUngon,
  ExpressionVector,
  ExpressionVectorAdd,
  ExpressionVectorToCartesian,
  ExpressionVectorMagnitude,
  ExpressionVectorNormalize,
  ExpressionVectorSize,
  ExpressionVertex,
} from './ast.js';

// --------------------------------------------------------------------------- 

export let svgNamespace = "http://www.w3.org/2000/svg";
let selectedShape = null;
let selectedHandlers = [];
let isHandling = false;
export let serial = 0;

// --------------------------------------------------------------------------- 

export function initializeShapes() {
  serial = 0;
}

export function clearSelection() {
  if (selectedShape) {
    selectedShape.hideHandles();
  }
  selectedShape = null;
}

export function restoreSelection(shapes) {
  if (selectedShape) {
    selectedShape = shapes.find(shape => shape.id == selectedShape.id);

    if (selectedHandlers.length > 0) {
      selectedHandlers = selectedHandlers.map(handler => selectedShape.subhandlers.find(subhandler => subhandler.id == handler.id));
    }
    
    if (selectedHandlers.length > 0) {
      for (let handler of selectedHandlers) {
        handler.showHandles();
      }
      selectedShape.showBackgroundHandles();
    } else {
      selectedShape.showHandles();
    }
  }
}

export function moveCursor(column, row, shapes) {
  if (isHandling) return;

  if (selectedShape) {
    selectedHandlers.forEach(handler => handler.hideHandles());
    selectedHandlers = [];

    for (let subhandler of selectedShape.subhandlers) {
      if (subhandler.sourceSpans.some(span => span.contains(column, row))) {
        subhandler.showHandles();
        selectedHandlers.push(subhandler);
        // break;
      }
    }

    if (selectedHandlers.length > 0) {
      selectedShape.hideHandles();
      selectedShape.showBackgroundHandles();
    } else {
      selectedShape.showHandles();
    }
  } else {
    for (let shape of shapes) {
      for (let subhandler of shape.subhandlers) {
        if (subhandler.sourceSpans.some(span => span.contains(column, row))) {
          subhandler.showHandles();
          selectedHandlers.push(subhandler);
          // break;
        }
      }

      if (selectedHandlers.length > 0) {
        selectedShape = shape;
        selectedShape.showBackgroundHandles();
        return;
      } else if (shape.sourceSpans.some(span => span.contains(column, row))) {
        shape.showHandles();
        selectedShape = shape;
      }
    }
  }
}

// --------------------------------------------------------------------------- 

const cursors = [
  'cursor-selectable',
  'cursor-pan',
  'cursor-horizontal-pan',
  'cursor-vertical-pan',
  'cursor-rotate',
];

function situateCursor(element) {
  document.documentElement.classList.remove(...cursors);
  if (element) {
    for (let cursor of cursors) {
      if (element.classList.contains(cursor)) {
        console.log("cursor:", cursor);
        document.documentElement.classList.add(cursor);
        break;
      }
    }
  }
}

// --------------------------------------------------------------------------- 

Number.prototype.toShortFloat = function() {
  return parseFloat(this.toLocaleString('fullwide', {useGrouping: false, maximumFractionDigits: 3}));
}

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
      this.bounds = parent.bounds;
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

  bind(id, value, fromTime, toTime, rhs) {
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
  constructor(env, callExpression, type, animatedIds) {
    super(env);
    this.callExpression = callExpression;
    this.type = type;
    this.animatedIds = animatedIds;
  }

  bind(id, value, fromTime = null, toTime = null, rhs = null) {
    // Non-animated properties get a standard key-value binding.
    if (!this.animatedIds.includes(id)) {
      this.bindings[id] = value;
    }

    // But animated properties get dropped onto a timeline. This gets a little
    // involved...
    else {
      if (!this.bindings.hasOwnProperty(id)) {
        this.bindings[id] = new Timeline();
      }

      value.tree = rhs;

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
  }

  assertProperty(id) {
    if (!this.hasOwn(id)) {
      throw new LocatedException(this.callExpression.where, `I found a ${this.type} whose ${id} property is not defined.`);
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleShape extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression, type, animatedIds) {
    super(env, callExpression, type, animatedIds);
    this.parentElement = null;
    this.bindings.stroke = new TwovilleTimelinedEnvironment(this, null, 'stroke', ['size', 'color', 'opacity']);
    this.bindings.stroke.bind('opacity', new ExpressionReal(1));
    this.bind('opacity', new ExpressionReal(1));
    this.id = serial;
    ++serial;

    this.subhandlers = [];
    this.initializeTransforms();
    this.initializeHandles(this);
  }

  registerSubhandler(subhandler) {
    subhandler.id = this.subhandlers.length;
    this.subhandlers.push(subhandler);
  }

  getParentingElement() {
    return this.svgElement;
  }

  getColor(env, t) {
    let isCutout = this.owns('parent') && this.get('parent') instanceof TwovilleCutout;

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

  domify(defs, mainGroup, backgroundHandleGroup, foregroundHandleGroup) {
    if (this.has('clippers')) {
      let clipPath = document.createElementNS(svgNamespace, 'clipPath');
      clipPath.setAttributeNS(null, 'id', 'clip-' + this.id);
      let clippers = this.get('clippers');
      clippers.forEach(clipper => {
        let use = document.createElementNS(svgNamespace, 'use');
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#element-' + clipper.id);
        clipPath.appendChild(use);
      });
      defs.appendChild(clipPath);
      this.svgElement.setAttributeNS(null, 'clip-path', 'url(#clip-' + this.id + ')');
    }

    if (this.owns('parent')) {
      this.parentElement = this.get('parent').getParentingElement();
    } else if (this.owns('template') && this.get('template').value) {
      this.parentElement = defs;
    } else {
      this.parentElement = mainGroup;
    }

    if (this.owns('mask')) {
      let mask = this.get('mask');

      let maskParent = document.createElementNS(svgNamespace, 'g');
      maskParent.setAttributeNS(null, 'mask', 'url(#element-' + mask.id + ')');

      maskParent.appendChild(this.svgElement);
      this.parentElement.appendChild(maskParent);
    } else {
      this.parentElement.appendChild(this.svgElement);
    }

    this.domifyHandles(backgroundHandleGroup, foregroundHandleGroup);
    for (let subhandler of this.subhandlers) {
      subhandler.domifyHandles(backgroundHandleGroup, foregroundHandleGroup);
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

    this.bindings['translate'] = new FunctionDefinition('translate', [], new ExpressionTranslate(this));
    this.bindings['scale'] = new FunctionDefinition('scale', [], new ExpressionScale(this));
    this.bindings['rotate'] = new FunctionDefinition('rotate', [], new ExpressionRotate(this));
    this.bindings['shear'] = new FunctionDefinition('shear', [], new ExpressionShear(this));
  },

  setTransform(env, t) {
    let attributeValue = this.transforms.slice().reverse().flatMap(xform => xform.evolve(env, t)).join(' ');
    this.svgElement.setAttributeNS(null, 'transform', attributeValue);
    // this.backgroundHandleParentElement.setAttributeNS(null, 'transform', attributeValue);
    // this.foregroundHandleParentElement.setAttributeNS(null, 'transform', attributeValue);
  }
}

Object.assign(TwovilleShape.prototype, transformMixin);

// --------------------------------------------------------------------------- 
// ENVIRONMENTS
// --------------------------------------------------------------------------- 

export class TwovilleGroup extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'group', []);
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
    super(env, callExpression, 'marker', ['size', 'anchor', 'corner', 'center']);
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

    // TODO need to handle y flip?
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
    super(env, callExpression, 'mask', []);
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
    super(env, callExpression, 'cutout', []);

    this.rectangle = document.createElementNS(svgNamespace, 'rect');
    this.rectangle.setAttributeNS(null, 'width', '100%');
    this.rectangle.setAttributeNS(null, 'height', '100%');
    this.rectangle.setAttributeNS(null, 'fill', 'white');

    this.getParentingElement().appendChild(this.rectangle);
  }

  draw(env, t) {
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

    this.rectangle.setAttributeNS(null, 'x', corner.get(0).value);
    this.rectangle.setAttributeNS(null, 'y', corner.get(1).value);
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleLabel extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'label', ['position', 'text', 'size', 'color', 'opacity']);
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
      anchor = this.bindings['anchor'];
    } else {
      anchor = new ExpressionString('middle');
    }

    let baseline;
    if (this.has('baseline')) {
      baseline = this.bindings['baseline'];
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
      this.svgElement.setAttributeNS(null, 'y', env.bounds.span - position.get(1).value);
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
    super(env, callExpression, 'vertex', ['position']);
    env.nodes.push(this);
    this.positionHandle = new VectorPanHandle(this, env, env);
  }

  evaluate(env, t) {
    this.assertProperty('position');
    let position = this.valueAt(env, 'position', t);
    this.positionHandle.update(env, position);
    return position;
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('position');
    let position = this.valueAt(env, 'position', t);
    this.positionHandle.attach(position);
    
    if (position) {
      this.positionHandle.update(env, position);
      return [`${position.get(0).value},${env.bounds.span - position.get(1).value}`, new Turtle(position, fromTurtle.heading)];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleTurtle extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'turtle', ['position', 'heading']);
    env.registerSubhandler(this);
    this.initializeHandles(env);
    env.nodes.push(this);

    this.positionHandle = new VectorPanHandle(this, this, env);

    this.degreesHandle = document.createElementNS(svgNamespace, 'circle');
    this.addForegroundHandle(this.degreesHandle, 'cursor-rotate');

    let degreesListener = new HandleListener(this, env, this.degreesHandle, () => {
      this.originalDegreesExpression = this.degreesExpression.clone();
      return this.degreesExpression.where;
    }, (delta, isShiftModified, mouseAt) => {
      let diff = new ExpressionVector([
        new ExpressionReal(mouseAt.x),
        new ExpressionReal(mouseAt.y),
      ]).subtract(this.positionHandle.expression);
      let newRadians = Math.atan2(diff.get(0).value, -diff.get(1).value);
      let newDegrees = newRadians * 180 / Math.PI - 90;
      if (newDegrees < 0) {
        newDegrees = 360 + newDegrees;
      }
      newDegrees = parseFloat(newDegrees.toShortFloat());
      if (isShiftModified) {
        newDegrees = Math.round(newDegrees);
      }
      this.degreesExpression.x = newDegrees;
      let replacement = '' + newDegrees;
      return replacement;
    });
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('position');
    this.assertProperty('heading');

    let position = this.valueAt(env, 'position', t);
    let heading = this.valueAt(env, 'heading', t);

    this.positionHandle.attach(position);
    this.degreesExpression = heading;
    
    if (position) {
      this.positionHandle.update(env, position);
      let rotationTo = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]).rotate(heading.value).add(position);
      setVertexHandleAttributes(this.degreesHandle, rotationTo, env.bounds);
      return [`M${position.get(0).value},${env.bounds.span - position.get(1).value}`, new Turtle(position, heading)];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleTurtleMove extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'move', ['distance']);
    this.initializeHandles(env);
    env.registerSubhandler(this);
    env.nodes.push(this);

    this.distanceExpression = null;
    this.distanceHandle = document.createElementNS(svgNamespace, 'circle');
    this.addForegroundHandle(this.distanceHandle, 'cursor-pan');

    let listener = new HandleListener(this, env, this.distanceHandle, () => {
      this.originalDistanceExpression = this.distanceExpression.clone();
      return this.distanceExpression.where;
    }, (delta, isShiftModified, mouseAt) => {
      let positionToHeading = new ExpressionVector([
        new ExpressionReal(1),
        this.headingExpression
      ]).toCartesian();

      let mouse = new ExpressionVector([
        new ExpressionReal(mouseAt.x),
        new ExpressionReal(mouseAt.y),
      ]);

      let positionToMouse = mouse.subtract(this.positionExpression);
      let dot = new ExpressionReal(positionToMouse.dot(positionToHeading));

      let distance = parseFloat(dot.value.toShortFloat());

      if (isShiftModified) {
        distance = Math.round(distance);
      }

      this.distanceExpression.x = distance;
      return this.distanceExpression.toPretty();
    });
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('distance');

    let distance = this.valueAt(env, 'distance', t);

    this.distanceExpression = distance;
    this.positionExpression = fromTurtle.position;
    this.headingExpression = fromTurtle.heading;
    
    if (distance) {
      let delta = new ExpressionVector([distance, fromTurtle.heading]).toCartesian();
      let position = fromTurtle.position.add(delta);
      setVertexHandleAttributes(this.distanceHandle, position, env.bounds);
      return [`L${position.get(0).value},${env.bounds.span - position.get(1).value}`, new Turtle(position, fromTurtle.heading)];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleTurtleTurn extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'turn', ['degrees']);
    env.registerSubhandler(this);
    this.initializeHandles(env);
    env.nodes.push(this);

    this.degreesHandle = document.createElementNS(svgNamespace, 'circle');
    this.addForegroundHandle(this.degreesHandle, 'cursor-rotate');

    let degreesListener = new HandleListener(this, env, this.degreesHandle, () => {
      this.originalDegreesExpression = this.degreesExpression.clone();
      return this.degreesExpression.where;
    }, (delta, isShiftModified, mouseAt) => {
      let diff = new ExpressionVector([
        new ExpressionReal(mouseAt.x),
        new ExpressionReal(mouseAt.y),
      ]).subtract(this.positionExpression);
      let newRadians = Math.atan2(diff.get(0).value, -diff.get(1).value);
      let newDegrees = newRadians * 180 / Math.PI - 90 - this.headingExpression.value;
      if (newDegrees < 0) {
        newDegrees = 360 + newDegrees;
      }
      newDegrees = parseFloat(newDegrees.toLocaleString('fullwide', {useGrouping: false, maximumFractionDigits: 3}));
      if (isShiftModified) {
        newDegrees = Math.round(newDegrees);
      }
      this.degreesExpression.x = newDegrees;
      let replacement = '' + newDegrees;
      return replacement;
    });
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('degrees');
    let degrees = this.valueAt(env, 'degrees', t);

    this.positionExpression = fromTurtle.position;
    this.headingExpression = fromTurtle.heading;
    this.degreesExpression = degrees;
    
    if (degrees) {
      let newHeading = fromTurtle.heading.add(degrees).value;
      while (newHeading > 360) {
        newHeading -= 360;
      }
      while (newHeading < 0) {
        newHeading += 360;
      }
      let rotationTo = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]).rotate(newHeading).add(fromTurtle.position);
      setVertexHandleAttributes(this.degreesHandle, rotationTo, env.bounds);
      return [null, new Turtle(fromTurtle.position, new ExpressionReal(newHeading))];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathJump extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'jump', ['position']);
    this.initializeHandles(env);
    env.registerSubhandler(this);
    env.nodes.push(this);
    this.positionHandle = new VectorPanHandle(this, this, env);
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('position');
    
    let position = this.valueAt(env, 'position', t);
    this.positionHandle.attach(position);

    if (position) {
      this.positionHandle.update(env, position);
      return [`M${position.get(0).value},${env.bounds.span - position.get(1).value}`, new Turtle(position, fromTurtle.heading), null];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathLine extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'line', ['position']);
    this.initializeHandles(env);
    env.registerSubhandler(this);
    env.nodes.push(this);

    this.lineElement = document.createElementNS(svgNamespace, 'line');
    this.addBackgroundHandle(this.lineElement);

    this.positionHandle = new VectorPanHandle(this, this, env);
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('position');
    
    let toPosition = this.valueAt(env, 'position', t);
    this.positionHandle.attach(toPosition);

    let isDelta = false;
    if (this.has('delta')) {
      isDelta = this.bindings['delta'].value;
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
      this.positionHandle.update(env, absoluteToPosition);
      setLineHandleAttributes(this.lineElement, fromTurtle.position, absoluteToPosition, env.bounds);
      
      let segment = new LineSegment(fromTurtle.position, absoluteToPosition);

      if (isDelta) {
        return [`${letter}${toPosition.get(0).value},${-toPosition.get(1).value}`, new Turtle(absoluteToPosition, fromTurtle.heading), segment];
      } else {
        return [`${letter}${toPosition.get(0).value},${env.bounds.span - toPosition.get(1).value}`, new Turtle(absoluteToPosition, fromTurtle.heading), segment];
      }
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathCubic extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'cubic', ['position', 'control1', 'control2']);
    this.initializeHandles(env);
    env.registerSubhandler(this);
    env.nodes.push(this);

    this.positionHandle = new VectorPanHandle(this, this, env);
    this.controlHandles = [
      new VectorPanHandle(this, this, env),
      new VectorPanHandle(this, this, env),
    ];

    this.line1Element = document.createElementNS(svgNamespace, 'line');
    this.line2Element = document.createElementNS(svgNamespace, 'line');

    this.addBackgroundHandle(this.line1Element);
    this.addBackgroundHandle(this.line2Element);
  }

  evolve(env, t, fromTurtle, previousSegment) {
    this.assertProperty('position');
    this.assertProperty('control2');
    
    let toPosition = this.valueAt(env, 'position', t);
    this.positionHandle.attach(toPosition);

    let control1;
    if (this.has('control1')) {
      control1 = this.valueAt(env, 'control1', t);
      this.controlHandles[0].attach(control1);
    }

    let control2 = this.valueAt(env, 'control2', t);
    this.controlHandles[1].attach(control2);

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

      this.positionHandle.update(env, absoluteToPosition);
      this.controlHandles[1].update(env, control2);

      setLineHandleAttributes(this.line2Element, control2, absoluteToPosition, env.bounds);

      if (control1) {
        let segment = new CubicSegment(fromTurtle.position, toPosition, control1, false, control2);

        this.controlHandles[0].update(env, control1);
        setLineHandleAttributes(this.line1Element, control1, fromTurtle.position, env.bounds);
 
        let letter = isDelta ? 'c' : 'C';
        return [`${letter} ${control1.get(0).value},${env.bounds.span - control1.get(1).value} ${control2.get(0).value},${env.bounds.span - control2.get(1).value} ${toPosition.get(0).value},${env.bounds.span - toPosition.get(1).value}`, toTurtle, segment];
      } else {
        let implicitControl1 = fromTurtle.position.add(fromTurtle.position.subtract(previousSegment.control2)); // from - previous' control2 + from
        let segment = new CubicSegment(fromTurtle.position, toPosition, implicitControl1, true, control2);

        let letter = isDelta ? 's' : 'S';
        return [`${letter} ${control2.get(0).value},${env.bounds.span - control2.get(1).value} ${toPosition.get(0).value},${env.bounds.span - toPosition.get(1).value}`, toTurtle, segment];
      }
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

class QuadraticSegment {
  constructor(from, to, control, isControlImplicit) {
    this.from = from;
    this.to = to;
    this.control = control;
    this.isControlImplicit = isControlImplicit;
  }

  mirror(point, axis, predecessor, successor) {
  }
}

class CubicSegment {
  constructor(from, to, control1, isControl1Implicit, control2) {
    this.from = from;
    this.to = to;
    this.control1 = control1;
    this.isControl1Implicit = isControl1Implicit;
    this.control2 = control2;
  }

  mirror(point, axis) {
    return new CubicSegment(
      this.to.mirror(point, axis),
      this.from.mirror(point, axis),
      this.control2.mirror(point, axis),
      false,
      this.control1.mirror(point, axis)
    );
  }

  toCommandString(env) {
    if (this.isControl1Implicit) {
      return `S ${this.control2.get(0).value},${env.bounds.span - this.control2.get(1).value} ${this.to.get(0).value},${env.bounds.span - this.to.get(1).value}`;
    } else {
      return `C ${this.control1.get(0).value},${env.bounds.span - this.control1.get(1).value} ${this.control2.get(0).value},${env.bounds.span - this.control2.get(1).value} ${this.to.get(0).value},${env.bounds.span - this.to.get(1).value}`;
    }
  }
}

class LineSegment {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  mirror(point, axis, predecessor, successor) {
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathQuadratic extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'quadratic', ['position', 'control']);
    this.initializeHandles(env);
    env.registerSubhandler(this);
    env.nodes.push(this);

    this.positionHandle = new VectorPanHandle(this, this, env);
    this.controlHandle = new VectorPanHandle(this, this, env);

    this.lineElements = [
      document.createElementNS(svgNamespace, 'line'),
      document.createElementNS(svgNamespace, 'line')
    ];

    this.addBackgroundHandle(this.lineElements[0]);
    this.addBackgroundHandle(this.lineElements[1]);
  }

  evolve(env, t, fromTurtle) {
    this.assertProperty('position');
    
    let toPosition = this.valueAt(env, 'position', t);
    this.positionHandle.attach(toPosition);

    let control;
    if (this.has('control')) {
      control = this.valueAt(env, 'control', t);
      this.controlHandle.attach(control);
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
      this.positionHandle.update(env, absoluteToPosition);

      if (control) {
        this.controlHandle.update(env, control);
        setLineHandleAttributes(this.lineElements[0], control, absoluteToPosition, env.bounds);
        setLineHandleAttributes(this.lineElements[1], control, fromTurtle.position, env.bounds);

        let letter = isDelta ? 'q' : 'Q';
        return [`${letter} ${control.get(0).value},${env.bounds.span - control.get(1).value} ${toPosition.get(0).value},${env.bounds.span - toPosition.get(1).value}`, toTurtle];
      } else {
        let letter = isDelta ? 't' : 'T';
        return [`${letter}${toPosition.get(0).value},${env.bounds.span - toPosition.get(1).value}`, toTurtle];
      }
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathArc extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'arc', ['position', 'center', 'degrees']);
    this.initializeHandles(env);
    env.registerSubhandler(this);
    env.nodes.push(this);

    this.circleElement = document.createElementNS(svgNamespace, 'circle');
    this.positionHandle = document.createElementNS(svgNamespace, 'circle');
    this.centerHandle = document.createElementNS(svgNamespace, 'circle');

    this.addBackgroundHandle(this.circleElement);
    this.addForegroundHandle(this.positionHandle, 'cursor-pan');
    this.addForegroundHandle(this.centerHandle, 'cursor-pan');

    new HandleListener(this, env, this.centerHandle, () => {
      if (this.positionExpression) {
        this.originalDegreesExpression = this.degreesExpression.clone();
        return this.degreesExpression.where;
      } else {
        this.originalCenterExpression = this.centerExpression.clone();
        return this.centerExpression.where;
      }
    }, (delta, isShiftModified, mouseAt) => {
      if (this.positionExpression) {
        let centerToMouse = new ExpressionVector([
          new ExpressionReal(mouseAt.x),
          new ExpressionReal(mouseAt.y),
        ]).subtract(this.centerExpression);

        // The new center will be on a line perpendicular to the vector from
        // the starting point to ending point.
        let rootToPosition = this.positionExpression.subtract(this.rootPosition).normalize();
        let direction = rootToPosition.rotate90(); 

        // Project the mouse point onto the perpendicular.
        let dot = new ExpressionReal(centerToMouse.dot(direction));
        let newCenterPosition = this.centerExpression.add(direction.multiply(dot));

        // We've figured out the new center. Now we need to figure out how many
        // degrees separate the two points. But we need to preserve the sign of
        // the original expression to make sure the arc travels the same winding.

        let newCenterToRoot = this.rootPosition.subtract(newCenterPosition).normalize();
        let newCenterToPosition = this.positionExpression.subtract(newCenterPosition).normalize();
        dot = newCenterToRoot.dot(newCenterToPosition);
        let degrees = Math.acos(dot) * 180 / Math.PI;

        // Because dot is ambiguous, find signed area and adjust angle to be > 180.
        let rootToNewCenter = newCenterPosition.subtract(this.rootPosition);
        rootToPosition = this.positionExpression.subtract(this.rootPosition);
        let signedArea = rootToNewCenter.get(0).value * rootToPosition.get(1).value - rootToNewCenter.get(1).value * rootToPosition.get(0).value;
        const signs = [
          Math.sign(signedArea),
          Math.sign(this.originalDegreesExpression.value),
        ];

        if (signs[0] < 0 && signs[1] < 0) {
          degrees = degrees - 360;
        } else if (signs[0] > 0 && signs[1] < 0) {
          degrees = -degrees;
        } else if (signs[0] > 0 && signs[1] > 0) {
          degrees = 360 - degrees;
        }

        degrees = parseFloat(degrees.toShortFloat());

        if (isShiftModified) {
          degrees = Math.round(degrees);
        }

        this.degreesExpression.x = degrees;
        return this.degreesExpression.toPretty();
      } else {
        let x = parseFloat((this.originalCenterExpression.get(0).value + delta[0]).toShortFloat());
        let y = parseFloat((this.originalCenterExpression.get(1).value + delta[1]).toShortFloat());

        if (isShiftModified) {
          x = Math.round(x);
          y = Math.round(y);
        }

        this.centerExpression.set(0, new ExpressionReal(x));
        this.centerExpression.set(1, new ExpressionReal(y));

        return '[' + this.centerExpression.get(0).value + ', ' + this.centerExpression.get(1).value + ']';
      }
    });

    new HandleListener(this, env, this.positionHandle, () => {
      if (this.positionExpression) {
        this.originalPositionExpression = this.positionExpression.clone();
        return this.positionExpression.where;
      } else {
        this.originalDegreesExpression = this.degreesExpression.clone();
        return this.degreesExpression.where;
      }
    }, (delta, isShiftModified, mouseAt) => {
      if (this.positionExpression) {
        let x = parseFloat((this.originalPositionExpression.get(0).value + delta[0]).toShortFloat());
        let y = parseFloat((this.originalPositionExpression.get(1).value + delta[1]).toShortFloat());

        if (isShiftModified) {
          x = Math.round(x);
          y = Math.round(y);
        }

        this.positionExpression.set(0, new ExpressionReal(x));
        this.positionExpression.set(1, new ExpressionReal(y));

        return '[' + this.positionExpression.get(0).value + ', ' + this.positionExpression.get(1).value + ']';
      } else {
        // Find vector from center to root position.
        let centerToRoot = this.rootPosition.subtract(this.centerExpression).normalize();

        // Find vector from center to mouse.
        let centerToProjectedMouse = new ExpressionVector([
          new ExpressionReal(mouseAt.x),
          new ExpressionReal(mouseAt.y),
        ]).subtract(this.centerExpression).normalize();

        // Find angle between the two vectors.
        let degrees = Math.acos(centerToRoot.dot(centerToProjectedMouse)) * 180 / Math.PI;

        // Because dot is ambiguous, find signed area and adjust angle to be > 180.
        let rootToCenter = this.centerExpression.subtract(this.rootPosition);
        let rootToMouse = new ExpressionVector([
          new ExpressionReal(mouseAt.x),
          new ExpressionReal(mouseAt.y),
        ]).subtract(this.rootPosition);
        let signedArea = rootToCenter.get(0).value * rootToMouse.get(1).value - rootToCenter.get(1).value * rootToMouse.get(0).value;
        if (signedArea > 0) {
          degrees = 360 - degrees;
        }

        degrees = parseFloat(degrees.toShortFloat())

        if (isShiftModified) {
          degrees = Math.round(degrees);
        }

        this.degreesExpression.x = degrees;

        return this.degreesExpression.toPretty();
      }
    });
  }

  evolve(env, t, fromTurtle) {
    if (this.has('position') && this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found an arc whose position and center properties were both set. Define only one of these.');
    }

    if (!this.has('position') && !this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found an arc whose curvature I couldn\'t figure out. Please define its center or position.');
    }

    this.rootPosition = fromTurtle.position;

    this.assertProperty('degrees');
    let degrees = this.valueAt(env, 'degrees', t);
    this.degreesExpression = degrees;
    let radians = degrees.value * Math.PI / 180;

    let isDelta = false;
    if (this.has('delta')) {
      isDelta = this.bindings['delta'].value;
    }

    let center;
    if (this.has('center')) {
      center = this.valueAt(env, 'center', t);
      this.positionExpression = null;

      this.positionHandle.classList.remove('cursor-pan');
      this.positionHandle.classList.add('cursor-rotate');

      if (isDelta) {
        center = center.add(fromTurtle.position);
      }
    } else {
      let toPosition = this.valueAt(env, 'position', t);
      this.positionExpression = toPosition;
      this.centerExpression = null;

      this.positionHandle.classList.remove('cursor-rotate');
      this.positionHandle.classList.add('cursor-pan');

      if (isDelta) {
        toPosition = fromTurtle.position.add(toPosition);
      }

      let diff = toPosition.subtract(fromTurtle.position);
      let distance = (0.5 * diff.magnitude) / Math.tan(radians * 0.5);
      let halfway = fromTurtle.position.add(toPosition).multiply(new ExpressionReal(0.5));
      let normal = diff.rotate90().normalize();
      center = halfway.add(normal.multiply(new ExpressionReal(-distance)));
    }

    this.centerExpression = center;

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
      sweep = 0;
    } else {
      large = degrees.value <= -180 ? 1 : 0;
      sweep = 1;
    }

    this.circleElement.setAttributeNS(null, 'cx', center.get(0).value);
    this.circleElement.setAttributeNS(null, 'cy', env.bounds.span - center.get(1).value);
    this.circleElement.setAttributeNS(null, 'r', radius);
    this.circleElement.setAttributeNS(null, 'vector-effect', 'non-scaling-stroke');
    this.circleElement.setAttributeNS(null, 'fill', 'none');
    this.circleElement.setAttributeNS(null, 'stroke', 'gray');
    this.circleElement.setAttributeNS(null, 'stroke-opacity', 1);
    this.circleElement.setAttributeNS(null, 'stroke-width', 1);
    this.circleElement.setAttributeNS(null, 'stroke-dasharray', '2 2');
    this.circleElement.classList.add('handle');


    setVertexHandleAttributes(this.centerHandle, center, env.bounds);
    setVertexHandleAttributes(this.positionHandle, to, env.bounds);

    return [`A${radius},${radius} 0 ${large} ${sweep} ${to.get(0).value},${env.bounds.span - to.get(1).value}`, new Turtle(to, fromTurtle.heading)];
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleTranslate extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'translate', ['offset']);
    this.initializeHandles(env);
    env.registerSubhandler(this);
    env.transforms.push(this);
    this.offsetHandle = new VectorPanHandle(this, this, env);
  }

  evolve(env, t) {
    this.assertProperty('offset');
    let offset = this.valueAt(env, 'offset', t);
    this.offsetHandle.attach(offset);

    if (offset) {
      this.offsetHandle.update(env, offset);
      return [`translate(${offset.get(0).value} ${env.bounds.span - offset.get(1).value})`];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleRotate extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'rotate', ['degrees', 'pivot']);
    this.initializeHandles(env);
    env.registerSubhandler(this);
    env.transforms.push(this);

    this.pivotHandle = new VectorPanHandle(this, this, env);

    this.degreesHandle = document.createElementNS(svgNamespace, 'circle');
    this.addForegroundHandle(this.degreesHandle, 'cursor-rotate');

    let degreesListener = new HandleListener(this, env, this.degreesHandle, () => {
      this.originalDegreesExpression = this.degreesExpression.clone();
      return this.degreesExpression.where;
    }, (delta, isShiftModified, mouseAt) => {
      let diff = new ExpressionVector([
        new ExpressionReal(mouseAt.x),
        new ExpressionReal(mouseAt.y),
      ]).subtract(this.pivotHandle.expression);
      let newRadians = Math.atan2(diff.get(0).value, -diff.get(1).value);
      let newDegrees = newRadians * 180 / Math.PI - 90;
      if (newDegrees < 0) {
        newDegrees = 360 + newDegrees;
      }
      newDegrees = parseFloat(newDegrees.toShortFloat());
      if (isShiftModified) {
        newDegrees = Math.round(newDegrees);
      }
      this.degreesExpression.x = newDegrees;
      let replacement = '' + newDegrees;
      return replacement;
    });
  }

  evolve(env, t) {
    this.assertProperty('degrees');
    this.assertProperty('pivot');

    let pivot = this.valueAt(env, 'pivot', t);
    let degrees = this.valueAt(env, 'degrees', t);

    this.pivotHandle.attach(pivot);
    this.degreesExpression = degrees;

    if (pivot && degrees) {
      this.pivotHandle.update(env, pivot);
      let rotationTo = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]).rotate(degrees.value).add(pivot);
      setVertexHandleAttributes(this.degreesHandle, rotationTo, env.bounds);
      return [`rotate(${-degrees.value} ${pivot.get(0).value} ${env.bounds.span - pivot.get(1).value})`];
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleShear extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'shear', ['factors', 'pivot']);
    this.initializeHandles(env);
    env.registerSubhandler(this);
    env.transforms.push(this);
  }

  evolve(env, t) {
    this.assertProperty('factors');
    this.assertProperty('pivot');

    let pivot = this.valueAt(env, 'pivot', t);
    let factors = this.valueAt(env, 'factors', t);

    if (factors) {
      let shearMatrix = `matrix(1 ${factors.get(1).value} ${factors.get(0).value} 1 0 0)`;
      if (pivot) {
        return [
          `translate(${-pivot.get(0).value} ${-(env.bounds.span - pivot.get(1).value)})`,
          shearMatrix,
          `translate(${pivot.get(0).value} ${env.bounds.span - pivot.get(1).value})`,
        ];
      } else {
        return [shearMatrix];
      }
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleScale extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression) {
    super(env, callExpression, 'scale', ['pivot', 'factors']);
    this.initializeHandles(env);
    env.registerSubhandler(this);
    env.transforms.push(this);

    this.pivotHandle = new VectorPanHandle(this, this, env);
    this.scaleHandles = [
      document.createElementNS(svgNamespace, 'circle'),
      document.createElementNS(svgNamespace, 'circle'),
    ];

    this.addForegroundHandle(this.scaleHandles[0], 'cursor-horizontal-pan');
    this.addForegroundHandle(this.scaleHandles[1], 'cursor-vertical-pan');

    new HandleListener(this, env, this.scaleHandles[0], () => {
      this.originalFactorsExpression = this.factorsExpression.clone();
      return this.factorsExpression.get(0).where;
    }, (delta, isShiftModified, mouseAt) => {
      let factor = parseFloat((delta[0] + this.originalFactorsExpression.get(0).value).toShortFloat());

      if (isShiftModified) {
        factor = Math.round(factor);
      }

      this.factorsExpression.set(0, new ExpressionReal(factor));
      return this.factorsExpression.get(0).toPretty();
    });

    new HandleListener(this, env, this.scaleHandles[1], () => {
      this.originalFactorsExpression = this.factorsExpression.clone();
      return this.factorsExpression.get(1).where;
    }, (delta, isShiftModified, mouseAt) => {
      let factor = parseFloat((delta[1] + this.originalFactorsExpression.get(1).value).toShortFloat());

      if (isShiftModified) {
        factor = Math.round(factor);
      }

      this.factorsExpression.set(1, new ExpressionReal(factor));
      return this.factorsExpression.get(1).toPretty();
    });
  }

  evolve(env, t) {
    this.assertProperty('factors');
    let factors = this.valueAt(env, 'factors', t);
    this.factorsExpression = factors;

    let pivot;
    if (this.has('pivot')) {
      pivot = this.valueAt(env, 'pivot', t);
      this.pivotHandle.attach(pivot);
    }

    if (factors) {
      if (pivot) {
        this.pivotHandle.update(env, pivot);
        setVertexHandleAttributes(this.scaleHandles[0], pivot.add(new ExpressionVector([
          new ExpressionReal(1),
          new ExpressionReal(0),
        ])), env.bounds);
        setVertexHandleAttributes(this.scaleHandles[1], pivot.add(new ExpressionVector([
          new ExpressionReal(0),
          new ExpressionReal(1),
        ])), env.bounds);
        return [
          `translate(${-pivot.get(0).value} ${-(env.bounds.span - pivot.get(1).value)})`,
          `scale(${factors.get(0).value} ${-factors.get(1).value})`,
          `translate(${pivot.get(0).value} ${env.bounds.span - pivot.get(1).value})`,
        ];
      } else {
        setVertexHandleAttributes(this.scaleHandles[0], new ExpressionVector([
          new ExpressionReal(1),
          new ExpressionReal(0),
        ]), env.bounds);
        setVertexHandleAttributes(this.scaleHandles[1], new ExpressionVector([
          new ExpressionReal(0),
          new ExpressionReal(1),
        ]), env.bounds);
        return [`scale(${factors.get(0).value} ${factors.get(1).value})`];
      }
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleMarkerable extends TwovilleShape {
  constructor(env, callExpression, name, animatedIds = []) {
    super(env, callExpression, name, animatedIds);
  }

  draw(env, t) {
    // Difference between owns and has? TODO

    if (this.owns('node')) {
      let node = this.get('node');
      this.svgElement.setAttributeNS(null, 'marker-mid', 'url(#element-' + node.id + ')');
      this.svgElement.setAttributeNS(null, 'marker-start', 'url(#element-' + node.id + ')');
      this.svgElement.setAttributeNS(null, 'marker-end', 'url(#element-' + node.id + ')');
    }

    if (this.owns('head')) {
      let head = this.get('head');
      this.svgElement.setAttributeNS(null, 'marker-end', 'url(#element-' + head.id + ')');
    }

    if (this.owns('tail')) {
      let tail = this.get('tail');
      this.svgElement.setAttributeNS(null, 'marker-start', 'url(#element-' + tail.id + ')');
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleLine extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'line', ['color', 'opacity', 'size']);
    this.svgElement = document.createElementNS(svgNamespace, 'line');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();
    this.nodes = [];

    this.bindings['vertex'] = new FunctionDefinition('vertex', [], new ExpressionVertex(this));
    this.bindings['turtle'] = new FunctionDefinition('turtle', [], new ExpressionTurtle(this));
    this.bindings['turn'] = new FunctionDefinition('turn', [], new ExpressionTurtleTurn(this));
    this.bindings['move'] = new FunctionDefinition('move', [], new ExpressionTurtleMove(this));

    this.lineElement = document.createElementNS(svgNamespace, 'line')
    this.addBackgroundHandle(this.lineElement);
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
      this.svgElement.setAttributeNS(null, 'y1', env.bounds.span - vertices[0].get(1).value);
      this.svgElement.setAttributeNS(null, 'x2', vertices[1].get(0).value);
      this.svgElement.setAttributeNS(null, 'y2', env.bounds.span - vertices[1].get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', color.toColor());

      setLineHandleAttributes(this.lineElement, vertices[0], vertices[1], env.bounds);
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePath extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'path', ['opacity', 'color']);
    this.svgElement = document.createElementNS(svgNamespace, 'path');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();
    this.nodes = [];

    this.bindings.mirror = new TwovilleTimelinedEnvironment(this, null, 'mirror', ['point', 'axis']);
    this.bindings['arc'] = new FunctionDefinition('arc', [], new ExpressionPathArc(this));
    this.bindings['cubic'] = new FunctionDefinition('cubic', [], new ExpressionPathCubic(this));
    this.bindings['jump'] = new FunctionDefinition('jump', [], new ExpressionPathJump(this));
    this.bindings['line'] = new FunctionDefinition('line', [], new ExpressionPathLine(this));
    this.bindings['quadratic'] = new FunctionDefinition('quadratic', [], new ExpressionPathQuadratic(this));
    this.bindings['turtle'] = new FunctionDefinition('turtle', [], new ExpressionTurtle(this));
    this.bindings['turn'] = new FunctionDefinition('turn', [], new ExpressionTurtleTurn(this));
    this.bindings['move'] = new FunctionDefinition('move', [], new ExpressionTurtleMove(this));
  }

  draw(env, t) {
    super.draw(env, t);

    let isClosed = true;
    if (this.has('closed')) {
      isClosed = this.bindings['closed'].value;
    }

    let last = new Turtle(null, null);
    let lastSegment = null;
    let vertices = [];
    let segments = [];
    this.nodes.forEach(node => {
      let result = node.evolve(env, t, last, lastSegment);

      last = result[1];
      if (result[0] != null) {
        vertices.push(result[0]);
      }

      lastSegment = result[2];
      if (lastSegment != null) {
        segments.push(lastSegment);
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

      if (this.has('mirror')) {
        let mirror = this.get('mirror');
        if (mirror.owns('point') && mirror.owns('axis')) {
          let point = mirror.valueAt(env, 'point', t);
          let axis = mirror.valueAt(env, 'axis', t);
          for (let i = segments.length - 1; i >= 0; --i) {
            let command = segments[i].mirror(point, axis).toCommandString(env);
            vertices.push(command);
          }
        }
      }
        
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

export class TwovilleUngon extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'ungon', ['rounding', 'color', 'opacity']);
    this.svgElement = document.createElementNS(svgNamespace, 'path');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();
    this.nodes = [];

    this.bindings['vertex'] = new FunctionDefinition('vertex', [], new ExpressionVertex(this));
    this.bindings['turtle'] = new FunctionDefinition('turtle', [], new ExpressionTurtle(this));
    this.bindings['turn'] = new FunctionDefinition('turn', [], new ExpressionTurtleTurn(this));
    this.bindings['move'] = new FunctionDefinition('move', [], new ExpressionTurtleMove(this));

    this.handles = {
      polygon: document.createElementNS(svgNamespace, 'polygon'),
      vertexGroup: document.createElementNS(svgNamespace, 'g'),
      vertices: [],
    };
    this.addBackgroundHandle(this.handles.polygon);
    this.addHandle(this.handles.vertexGroup);
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

    if (vertices[0].distance(vertices[vertices.length - 1]) < 1e-3) {
      vertices.pop();
    }

    let rounding;
    if (this.has('rounding')) {
      rounding = this.valueAt(env, 'rounding', t).value;
    }

    if (vertices.some(v => v == null) || color == null) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);

      let vertexPositions = vertices.map(p => `${p.get(0).value},${env.bounds.span - p.get(1).value}`).join(' ');

      rounding = 1 - rounding;
      let commands = [];
      let start = vertices[0].midpoint(vertices[1]);
      commands.push(`M ${start.get(0).value},${env.bounds.span - start.get(1).value}`);
      let previous = start;
      for (let i = 1; i < vertices.length; ++i) {
        let mid = vertices[i].midpoint(vertices[(i + 1) % vertices.length]);

        if (rounding) {
          let control1 = previous.interpolateLinear(vertices[i], rounding);
          let control2 = mid.interpolateLinear(vertices[i], rounding);
          commands.push(`C ${control1.get(0).value},${env.bounds.span - control1.get(1).value} ${control2.get(0).value},${env.bounds.span - control2.get(1).value} ${mid.get(0).value},${env.bounds.span - mid.get(1).value}`);
        } else {
          commands.push(`Q ${vertices[i].get(0).value},${env.bounds.span - vertices[i].get(1).value} ${mid.get(0).value},${env.bounds.span - mid.get(1).value}`);
        }
        previous = mid;
      }

      if (rounding) {
        let control1 = previous.interpolateLinear(vertices[0], rounding);
        let control2 = start.interpolateLinear(vertices[0], rounding);
        commands.push(`C ${control1.get(0).value},${env.bounds.span - control1.get(1).value} ${control2.get(0).value},${env.bounds.span - control2.get(1).value} ${start.get(0).value},${env.bounds.span - start.get(1).value}`);
      } else {
        commands.push(`Q${vertices[0].get(0).value},${env.bounds.span - vertices[0].get(1).value} ${start.get(0).value},${env.bounds.span - start.get(1).value}`);
      }
      // commands.push('z');

      this.svgElement.setAttributeNS(null, 'd', commands.join(' '));
      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'fill', color.toColor());

      this.handles.polygon.setAttributeNS(null, 'points', vertexPositions);
      setCommonHandleProperties(this.handles.polygon);

      // Remove old vertices.
      for (let vertexHandle of this.handles.vertices) {
        vertexHandle.parentNode.removeChild(vertexHandle);
      }

      this.handles.vertices = [];
      for (let vertex of vertices) {
        let vertexHandle = document.createElementNS(svgNamespace, 'circle');
        setVertexHandleAttributes(vertexHandle, vertex, env.bounds);
        this.handles.vertexGroup.appendChild(vertexHandle);
        this.handles.vertices.push(vertexHandle);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePolygon extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'polygon', ['color', 'opacity']);
    this.svgElement = document.createElementNS(svgNamespace, 'polygon');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();
    this.nodes = [];

    this.bindings['vertex'] = new FunctionDefinition('vertex', [], new ExpressionVertex(this));
    this.bindings['turtle'] = new FunctionDefinition('turtle', [], new ExpressionTurtle(this));
    this.bindings['turn'] = new FunctionDefinition('turn', [], new ExpressionTurtleTurn(this));
    this.bindings['move'] = new FunctionDefinition('move', [], new ExpressionTurtleMove(this));

    this.handles = {
      polygon: document.createElementNS(svgNamespace, 'polygon'),
      vertexGroup: document.createElementNS(svgNamespace, 'g'),
      vertices: [],
    };
    this.addBackgroundHandle(this.handles.polygon);
    this.addHandle(this.handles.vertexGroup);
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

      let commands = vertices.map(p => `${p.get(0).value},${env.bounds.span - p.get(1).value}`).join(' ');

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'points', commands);
      this.svgElement.setAttributeNS(null, 'fill', color.toColor());

      this.handles.polygon.setAttributeNS(null, 'points', commands);
      setCommonHandleProperties(this.handles.polygon);

      // Remove old vertices.
      // for (let vertexHandle of this.handles.vertices) {
        // vertexHandle.parentNode.removeChild(vertexHandle);
      // }

      // this.handles.vertices = [];
      // for (let vertex of vertices) {
        // let vertexHandle = document.createElementNS(svgNamespace, 'circle');
        // setVertexHandleAttributes(vertexHandle, vertex, env.bounds);
        // this.handles.vertexGroup.appendChild(vertexHandle);
        // this.handles.vertices.push(vertexHandle);
      // }
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePolyline extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'polyline', ['size', 'color', 'opacity']);
    this.svgElement = document.createElementNS(svgNamespace, 'polyline');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();
    this.nodes = [];

    this.bindings['vertex'] = new FunctionDefinition('vertex', [], new ExpressionVertex(this));
    this.bindings['turtle'] = new FunctionDefinition('turtle', [], new ExpressionTurtle(this));
    this.bindings['turn'] = new FunctionDefinition('turn', [], new ExpressionTurtleTurn(this));
    this.bindings['move'] = new FunctionDefinition('move', [], new ExpressionTurtleMove(this));

    this.handles = {
      polyline: document.createElementNS(svgNamespace, 'polyline'),
      vertexGroup: document.createElementNS(svgNamespace, 'g'),
      vertices: [],
    };
    this.addBackgroundHandle(this.handles.polyline);
    this.addHandle(this.handles.vertexGroup);
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

      let commands = vertices.map(p => `${p.get(0).value},${env.bounds.span - p.get(1).value}`).join(' ');

      this.svgElement.setAttributeNS(null, 'points', commands);
      this.svgElement.setAttributeNS(null, 'fill', 'none');

      this.handles.polyline.setAttributeNS(null, 'points', commands);
      setCommonHandleProperties(this.handles.polyline);

      // Remove old vertices.
      for (let vertexHandle of this.handles.vertices) {
        vertexHandle.parentNode.removeChild(vertexHandle);
      }

      this.handles.vertices = [];
      for (let vertex of vertices) {
        let vertexHandle = document.createElementNS(svgNamespace, 'circle');
        setVertexHandleAttributes(vertexHandle, vertex, env.bounds);
        this.handles.vertexGroup.appendChild(vertexHandle);
        this.handles.vertices.push(vertexHandle);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

class HandleListener {
  constructor(env, selectElement, element, range, change) {
    this.element = element;
    this.env = env;
    this.mouseDownAt = null;

    this.mouseDown = e => {
      isHandling = true;
      this.mouseDownAt = this.transform(e);
      let where = range();
      beginTweaking(where.lineStart, where.lineEnd, where.columnStart, where.columnEnd);
      e.stopPropagation();
      window.addEventListener('mousemove', this.mouseMove);
      window.addEventListener('mouseup', this.mouseUp);
      selectedShape = selectElement;
    }

    this.mouseUp = e => {
      window.removeEventListener('mousemove', this.mouseMove);
      window.removeEventListener('mouseup', this.mouseUp);
      interpret(true);
      isHandling = false;
      endTweaking();
      situateCursor(e.toElement);
    }

    this.mouseMove = e => {
      if (event.buttons === 1) {
        let mouseAt = this.transform(e);
        let delta = [mouseAt.x - this.mouseDownAt.x, mouseAt.y - this.mouseDownAt.y];

        let replacement = change(delta, e.shiftKey, mouseAt);
        tweak(replacement);
        e.stopPropagation();

        drawAfterHandling();
      }
    }

    this.element.addEventListener('mousedown', this.mouseDown);
  }

  transform(e) {
    mouseAtSvg.x = e.clientX;
    mouseAtSvg.y = e.clientY;
    let mouseAt = mouseAtSvg.matrixTransform(svg.getScreenCTM().inverse());
    mouseAt.y = this.env.bounds.span - mouseAt.y;
    return mouseAt;
  }
}

export class TwovilleRectangle extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'rectangle', ['corner', 'center', 'size', 'color', 'opacity', 'rounding']);
    this.svgElement = document.createElementNS(svgNamespace, 'rect');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();

    this.rectangleElement = document.createElementNS(svgNamespace, 'rect');
    this.addBackgroundHandle(this.rectangleElement);

    this.positionHandle = new VectorPanHandle(this, this, this);
    this.widthHandle = new VectorComponentPanHandle(this, this, this, 0);
    this.heightHandle = new VectorComponentPanHandle(this, this, this, 1);

    this.hasCenter = false;

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
    this.widthHandle.attach(size);
    this.heightHandle.attach(size);

    let corner;
    let center;
    if (this.has('corner')) {
      corner = this.valueAt(env, 'corner', t);
      this.positionHandle.attach(corner);
      this.hasCenter = false;
    } else {
      center = this.valueAt(env, 'center', t);
      this.positionHandle.attach(center);
      corner = new ExpressionVector([
        new ExpressionReal(center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(center.get(1).value - size.get(1).value * 0.5),
      ]);
      this.hasCenter = true;
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
      this.svgElement.setAttributeNS(null, 'y', env.bounds.span - size.get(1).value - corner.get(1).value);
      this.svgElement.setAttributeNS(null, 'width', size.get(0).value);
      this.svgElement.setAttributeNS(null, 'height', size.get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', isVisible ? color.toColor() : 'none');
      this.svgElement.setAttributeNS(null, 'fill-opacity', opacity);

      setRectangleHandleAttributes(this.rectangleElement, corner, size, env.bounds);

      if (center) {
        this.positionHandle.update(env, center);
        this.widthHandle.update(env, new ExpressionVector([
          new ExpressionReal(center.get(0).value + size.get(0).value * 0.5),
          center.get(1)
        ]));
        this.heightHandle.update(env, new ExpressionVector([
          center.get(0),
          new ExpressionReal(center.get(1).value + size.get(1).value * 0.5)
        ]));
      } else {
        this.positionHandle.update(env, corner);
        this.widthHandle.update(env, new ExpressionVector([
          new ExpressionReal(corner.get(0).value + size.get(0).value),
          corner.get(1)
        ]));
        this.heightHandle.update(env, new ExpressionVector([
          corner.get(0),
          new ExpressionReal(corner.get(1).value + size.get(1).value)
        ]));
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleCircle extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'circle', ['center', 'radius', 'color', 'opacity']);
    this.svgElement = document.createElementNS(svgNamespace, 'circle');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.registerClickHandler();

    this.circleElement = document.createElementNS(svgNamespace, 'circle');
    this.addBackgroundHandle(this.circleElement);

    this.positionHandle = new VectorPanHandle(this, this, this);
    this.radiusHandle = new HorizontalPanHandle(this, this, this);
  }

  draw(env, t) {
    this.assertProperty('center');
    this.assertProperty('radius');
    
    let opacity = this.valueAt(env, 'opacity', t).value;
    let center = this.valueAt(env, 'center', t);
    let radius = this.valueAt(env, 'radius', t);

    this.positionHandle.attach(center);
    this.radiusHandle.attach(radius);

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
      this.svgElement.setAttributeNS(null, 'cy', env.bounds.span - center.get(1).value);
      this.svgElement.setAttributeNS(null, 'r', radius.value);
      this.svgElement.setAttributeNS(null, 'fill', isVisible ? color.toColor() : 'none');
      this.svgElement.setAttributeNS(null, 'fill-opacity', opacity);

      this.positionHandle.update(env, center);
      this.radiusHandle.update(env, new ExpressionVector([
        new ExpressionReal(center.get(0).value + radius.value),
        center.get(1)
      ]));
      setCircleHandleAttributes(this.circleElement, center, radius, env.bounds);
    }
  }
}

// --------------------------------------------------------------------------- 

export class Random {
  constructor() {
    this.engine = seedrandom();
  }

  seed(value) {
    this.engine = seedrandom(value);
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
    this.bounds = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };

    this.prng = new Random();

    if (this.svg) {
      this.svg.addEventListener('click', () => {
        if (selectedShape) {
          selectedShape.hideHandles();
          selectedShape = null;
        }
      }, false);
    }

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
    this.bindings.gif.bind('skip', new ExpressionInteger(1));

    this.bindings.viewport = new TwovilleEnvironment(this);
    this.bindings.viewport.bind('size', new ExpressionVector([
      new ExpressionInteger(100),
      new ExpressionInteger(100)
    ]));

    this.bindings['rectangle'] = new FunctionDefinition('rectangle', [], new ExpressionRectangle());
    this.bindings['line'] = new FunctionDefinition('line', [], new ExpressionLine());
    this.bindings['path'] = new FunctionDefinition('path', [], new ExpressionPath());
    this.bindings['ungon'] = new FunctionDefinition('ungon', [], new ExpressionUngon());
    this.bindings['polygon'] = new FunctionDefinition('polygon', [], new ExpressionPolygon());
    this.bindings['polyline'] = new FunctionDefinition('polyline', [], new ExpressionPolyline());
    this.bindings['label'] = new FunctionDefinition('label', [], new ExpressionLabel());
    this.bindings['group'] = new FunctionDefinition('group', [], new ExpressionGroup());
    this.bindings['marker'] = new FunctionDefinition('marker', [], new ExpressionMarker());
    this.bindings['mask'] = new FunctionDefinition('mask', [], new ExpressionMask());
    this.bindings['cutout'] = new FunctionDefinition('cutout', [], new ExpressionCutout());
    this.bindings['circle'] = new FunctionDefinition('circle', [], new ExpressionCircle());
    this.bindings['print'] = new FunctionDefinition('print', ['message'], new ExpressionPrint());
    this.bindings['random'] = new FunctionDefinition('random', ['min', 'max'], new ExpressionRandom());
    this.bindings['seed'] = new FunctionDefinition('seed', ['value'], new ExpressionSeed());
    this.bindings['sin'] = new FunctionDefinition('sin', ['degrees'], new ExpressionSine());
    this.bindings['cos'] = new FunctionDefinition('cos', ['degrees'], new ExpressionCosine());
    this.bindings['tan'] = new FunctionDefinition('tan', ['degrees'], new ExpressionTangent());
    this.bindings['asin'] = new FunctionDefinition('asin', ['ratio'], new ExpressionArcSine());
    this.bindings['sqrt'] = new FunctionDefinition('sqrt', ['x'], new ExpressionSquareRoot());
    this.bindings['int'] = new FunctionDefinition('int', ['x'], new ExpressionInt());
  }
}

// --------------------------------------------------------------------------- 
// ANNOTATIONS
// ----------------------------------------------------------------------------

let handleMixin = {
  initializeHandles(elementToSelect) {
    this.elementToSelect = elementToSelect;
    this.backgroundHandleParentElement = null;
    this.foregroundHandleParentElement = null;
    this.backgroundHandleElements = [];
    this.foregroundHandleElements = [];
    this.sourceSpans = [];
  },

  addHandle(element, isForeground = false, cursor = null) {
    element.classList.add(`element-${this.id}-group`);
    if (cursor) {
      element.classList.add(cursor);
    }

    // Only update cursor if no mouse button is down.
    element.addEventListener('mouseenter', event => {
      if (event.buttons === 0) {
        situateCursor(event.toElement);
      }
    });

    element.addEventListener('mouseleave', event => {
      event.stopPropagation();

      if ((this.backgroundHandleParentElement || this.foregroundHandleParentElement) && selectedShape != this.elementToSelect && (!event.toElement || !event.toElement.classList.contains(`element-${this.id}-group`))) {
        this.hideHandles();
      }

      if (event.buttons === 0) {
        situateCursor(event.toElement);
      }
    });

    if (isForeground) {
      this.foregroundHandleElements.push(element);
    } else {
      this.backgroundHandleElements.push(element);
    }
  },

  addForegroundHandle(element, cursor) {
    this.addHandle(element, true, cursor);
  },

  addBackgroundHandle(element) {
    this.addHandle(element, false, 'cursor-selectable');
  },

  showHandles() {
    this.showBackgroundHandles();
    this.foregroundHandleParentElement.setAttributeNS(null, 'visibility', 'visible');
  },

  showBackgroundHandles() {
    this.backgroundHandleParentElement.setAttributeNS(null, 'visibility', 'visible');
  },

  hideHandles() {
    this.backgroundHandleParentElement.setAttributeNS(null, 'visibility', 'hidden');
    this.foregroundHandleParentElement.setAttributeNS(null, 'visibility', 'hidden');
  },

  domifyHandles(backgroundHandleGroup, foregroundHandleGroup) {
    this.backgroundHandleParentElement = document.createElementNS(svgNamespace, 'g');
    this.backgroundHandleParentElement.setAttributeNS(null, 'id', `element-${this.id}-background-handles`);
    this.backgroundHandleParentElement.classList.add('handle-group');
    backgroundHandleGroup.appendChild(this.backgroundHandleParentElement);
    for (let element of this.backgroundHandleElements) {
      this.backgroundHandleParentElement.appendChild(element);
    }

    this.foregroundHandleParentElement = document.createElementNS(svgNamespace, 'g');
    this.foregroundHandleParentElement.setAttributeNS(null, 'id', `element-${this.id}-foreground-handles`);
    this.foregroundHandleParentElement.classList.add('handle-group');
    foregroundHandleGroup.appendChild(this.foregroundHandleParentElement);
    for (let element of this.foregroundHandleElements) {
      this.foregroundHandleParentElement.appendChild(element);
    }

    this.hideHandles();
  },

  registerClickHandler() {
    this.svgElement.classList.add(`element-${this.id}-group`);
    this.svgElement.classList.add('cursor-selectable');

    this.svgElement.addEventListener('click', event => {
      // The parent SVG also listens for clicks and deselects. We don't want the
      // parent involved when a child is clicked on.
      event.stopPropagation();

      if (!isDirty && (this.backgroundHandleParentElement || this.foregroundHandleParentElement)) {
        clearSelection();
        if (selectedShape != this) {
          this.showHandles();
          selectedShape = this;
        }
      }
    });

    this.svgElement.addEventListener('mouseenter', event => {
      event.stopPropagation();
      // Only show the handles if the source code has been evaluated
      if (this != selectedShape && !isDirty && (this.backgroundHandleParentElement || this.foregroundHandleParentElement)) {
        this.showHandles();
      }

      if (event.buttons === 0) {
        situateCursor(event.toElement);
      }
    });

    this.svgElement.addEventListener('mouseleave', event => {
      event.stopPropagation();
      // Only turn off handles if shape wasn't explicitly click-selected
      // and the mouse is dragged onto to some other entity that isn't a
      // handle. Mousing over the shape's handles should not cause the
      // handles to disappear.
      //
      // this element has handles AND
      // this element hasn't been click-selected (i.e., this was only a hover-select) AND
      // (we are rolling off to nothing OR
      //  we are rolling to something that's not a handle)
      if ((this.backgroundHandleParentElement || this.foregroundHandleParentElement) && selectedShape != this && (!event.toElement || !event.toElement.classList.contains(`element-${this.id}-group`))) {
        this.hideHandles();
      }

      if (event.buttons === 0) {
        situateCursor(event.toElement);
      }
    });
  },
};

Object.assign(TwovilleShape.prototype, handleMixin);
Object.assign(TwovillePathJump.prototype, handleMixin);
Object.assign(TwovillePathLine.prototype, handleMixin);
Object.assign(TwovillePathCubic.prototype, handleMixin);
Object.assign(TwovillePathQuadratic.prototype, handleMixin);
Object.assign(TwovillePathArc.prototype, handleMixin);
Object.assign(TwovilleTurtle.prototype, handleMixin);
Object.assign(TwovilleTurtleMove.prototype, handleMixin);
Object.assign(TwovilleTurtleTurn.prototype, handleMixin);
Object.assign(TwovilleVertex.prototype, handleMixin);

Object.assign(TwovilleRotate.prototype, handleMixin);
Object.assign(TwovilleScale.prototype, handleMixin);
Object.assign(TwovilleTranslate.prototype, handleMixin);
Object.assign(TwovilleShear.prototype, handleMixin);

function setVertexHandleAttributes(handle, position, bounds) {
  handle.setAttributeNS(null, 'cx', position.get(0).value);
  handle.setAttributeNS(null, 'cy', bounds.span - position.get(1).value);
  handle.setAttributeNS(null, 'r', 0.3);
  setCommonHandleProperties(handle);

  // Non-scaling-size is not supported. :( Looks like I'll have to do
  // this myself.
  // handle.setAttributeNS(null, 'vector-effect', 'non-scaling-size');
  handle.classList.add('handle-circle');

  handle.setAttributeNS(null, 'fill', 'black');
}

function setLineHandleAttributes(handle, from, to, bounds) {
  handle.setAttributeNS(null, 'x1', from.get(0).value);
  handle.setAttributeNS(null, 'y1', bounds.span - from.get(1).value);
  handle.setAttributeNS(null, 'x2', to.get(0).value);
  handle.setAttributeNS(null, 'y2', bounds.span - to.get(1).value);
  setCommonHandleProperties(handle);
}

function setRectangleHandleAttributes(handle, position, size, bounds) {
  handle.setAttributeNS(null, 'x', position.get(0).value);
  handle.setAttributeNS(null, 'y', bounds.span - position.get(1).value - size.get(1).value);
  handle.setAttributeNS(null, 'width', size.get(0).value);
  handle.setAttributeNS(null, 'height', size.get(1).value);
  setCommonHandleProperties(handle);
}

function setCircleHandleAttributes(handle, center, radius, bounds) {
  handle.setAttributeNS(null, 'cx', center.get(0).value);
  handle.setAttributeNS(null, 'cy', bounds.span - center.get(1).value);
  handle.setAttributeNS(null, 'r', radius.value);
  setCommonHandleProperties(handle);
}

function setCommonHandleProperties(handle) {
  handle.setAttributeNS(null, 'stroke-width', 3);
  handle.setAttributeNS(null, 'stroke-opacity', 1);
  handle.setAttributeNS(null, 'stroke', 'gray');
  handle.setAttributeNS(null, 'vector-effect', 'non-scaling-stroke');
  handle.setAttributeNS(null, 'fill', 'none');
  handle.setAttributeNS(null, 'stroke-dasharray', '2 2');
  handle.classList.add('handle');
}

// --------------------------------------------------------------------------- 

class PanHandle {
  constructor(owner, handleOwner, selectElement, cursor) {
    this.owner = owner;
    this.expression = null;

    this.element = document.createElementNS(svgNamespace, 'circle');
    handleOwner.addForegroundHandle(this.element, cursor);

    let listener = new HandleListener(handleOwner, selectElement, this.element, () => {
      this.originalExpression = this.expression.clone();
      return this.locate();
    }, (delta, isShiftModified) => {
      let replacement = this.updateProgram(delta, isShiftModified);
      return replacement;
    }, handleOwner);
  }

  locate() {
    return this.expression.unevaluated.where;
  }

  // Modify this handle's SVG element attributes.
  update(env, expression) {
    setVertexHandleAttributes(this.element, expression, env.bounds);
  }

  // Attach this handle to the given expression node in the AST.
  attach(expression) {
    this.expression = expression;
  }
}

class VectorPanHandle extends PanHandle {
  constructor(owner, handleOwner, selectElement) {
    super(owner, handleOwner, selectElement, 'cursor-pan');
  }

  updateProgram(delta, isShiftModified) {
    let x = parseFloat((this.originalExpression.get(0).value + delta[0]).toShortFloat());
    let y = parseFloat((this.originalExpression.get(1).value + delta[1]).toShortFloat());

    if (isShiftModified) {
      x = Math.round(x);
      y = Math.round(y);
    }

    this.expression.set(0, new ExpressionReal(x));
    this.expression.set(1, new ExpressionReal(y));

    return '[' + this.expression.get(0).value + ', ' + this.expression.get(1).value + ']';
  }
}

class VectorComponentPanHandle extends PanHandle {
  constructor(owner, handleOwner, selectElement, dimension) {
    super(owner, handleOwner, selectElement, dimension == 0 ? 'cursor-horizontal-pan' : 'cursor-vertical-pan');
    this.dimension = dimension;
  }

  locate() {
    return this.expression.get(this.dimension).unevaluated.where;
  }

  updateProgram(delta, isShiftModified) {
    const unevaluated = this.originalExpression.get(this.dimension).unevaluated;
    const oldValue = this.originalExpression.get(this.dimension).value;

    let newValue = parseFloat((oldValue + delta[this.dimension] * (this.owner.hasCenter ? 2 : 1)).toShortFloat());

    if (isShiftModified) {
      newValue = Math.round(newValue);
    }

    this.expression.set(this.dimension, new ExpressionReal(newValue));

    if (unevaluated instanceof ExpressionReal || unevaluated instanceof ExpressionInteger) {
      return this.expression.get(this.dimension).toPretty();
    } else if (unevaluated instanceof ExpressionAdd &&
               (unevaluated.b instanceof ExpressionReal || unevaluated.b instanceof ExpressionInteger)) {
      const right = unevaluated.b.value;
      const left = oldValue - right;
      return new ExpressionAdd(unevaluated.a, new ExpressionReal((newValue - left).toShortFloat())).toPretty();
    } else if (unevaluated instanceof ExpressionAdd &&
               (unevaluated.a instanceof ExpressionReal || unevaluated.a instanceof ExpressionInteger)) {
      const left = unevaluated.a.value;
      const right = oldValue - left;
      return new ExpressionAdd(new ExpressionReal((newValue - right).toShortFloat()), unevaluated.b).toPretty();
    } else if (unevaluated instanceof ExpressionSubtract &&
               (unevaluated.b instanceof ExpressionReal || unevaluated.b instanceof ExpressionInteger)) {
      const right = unevaluated.b.value;
      const left = oldValue + right;
      return new ExpressionSubtract(unevaluated.a, new ExpressionReal((left - newValue).toShortFloat())).toPretty();
    } else if (unevaluated instanceof ExpressionSubtract &&
               (unevaluated.a instanceof ExpressionReal || unevaluated.a instanceof ExpressionInteger)) {
      const left = unevaluated.a.value;
      const right = left - oldValue;
      return new ExpressionSubtract(new ExpressionReal((newValue + right).toShortFloat()), unevaluated.b).toPretty();
    } else if (unevaluated instanceof ExpressionMultiply &&
               (unevaluated.b instanceof ExpressionReal || unevaluated.b instanceof ExpressionInteger)) {
      const right = unevaluated.b.value;
      const left = oldValue / right;
      return new ExpressionMultiply(unevaluated.a, new ExpressionReal((newValue / left).toShortFloat())).toPretty();
    } else if (unevaluated instanceof ExpressionMultiply &&
               (unevaluated.a instanceof ExpressionReal || unevaluated.a instanceof ExpressionInteger)) {
      const left = unevaluated.a.value;
      const right = oldValue / left;
      return new ExpressionMultiply(new ExpressionReal((newValue / right).toShortFloat()), unevaluated.b).toPretty();
    } else if (unevaluated instanceof ExpressionDivide &&
               (unevaluated.b instanceof ExpressionReal || unevaluated.b instanceof ExpressionInteger)) {
      const right = unevaluated.b.value;
      const left = this.originalExpression.get(this.dimension).prevalues[0].value;
      return new ExpressionDivide(unevaluated.a, new ExpressionReal((left / newValue).toShortFloat())).toPretty();
    } else if (unevaluated instanceof ExpressionDivide &&
               (unevaluated.a instanceof ExpressionReal || unevaluated.a instanceof ExpressionInteger)) {
      const left = unevaluated.a.value;
      const right = left / oldValue;
      return new ExpressionDivide(new ExpressionReal((newValue * right).toShortFloat()), unevaluated.b).toPretty();
    } else if (unevaluated instanceof ExpressionPower &&
               (unevaluated.b instanceof ExpressionReal || unevaluated.b instanceof ExpressionInteger)) {
      const right = unevaluated.b.value;
      const left = Math.pow(oldValue, 1 / right);
      return new ExpressionPower(unevaluated.a, new ExpressionReal((Math.log(newValue) / Math.log(left)).toShortFloat())).toPretty();
    } else if (unevaluated instanceof ExpressionPower &&
               (unevaluated.a instanceof ExpressionReal || unevaluated.a instanceof ExpressionInteger)) {
      const left = unevaluated.a.value;
      const right = Math.log(oldValue) / Math.log(left);
      return new ExpressionPower(new ExpressionReal(Math.pow(newValue, 1 / right).toShortFloat()), unevaluated.b).toPretty();
    } else {
      return new ExpressionAdd(unevaluated, new ExpressionReal((newValue - oldValue).toShortFloat())).toPretty();
    }
  }
}

class HorizontalPanHandle extends PanHandle {
  constructor(owner, handleOwner, selectElement) {
    super(owner, handleOwner, selectElement, 'horizontal-pan');
  }

  updateProgram(delta, isShiftModified) {
    let x = parseFloat((this.originalExpression.value + delta[0]).toShortFloat());

    if (isShiftModified) {
      x = Math.round(x);
    }

    this.expression.x = x;

    return this.expression.toPretty();
  }
}
