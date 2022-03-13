import {
  LocatedException,
  SourceLocation,
  Turtle,
  classifyArc,
  standardizeDegrees,
} from './common.js';

import {
  ExpressionBoolean,
  ExpressionInteger,
  ExpressionReal,
  ExpressionVector,
} from './ast.js';

import {
  mirrorPointLine,
  unitVectorBetween,
  rotateVector,
} from './math.js';

import {
  AxisMark,
  BumpDegreesMark,
  BumpPositionMark,
  CircleMark,
  DistanceMark,
  HorizontalPanMark,
  LineMark,
  Marker,
  PathMark,
  RayMark,
  RectangleMark,
  RotationMark,
  VectorPanMark,
  VerticalPanMark,
  WedgeDegreesMark,
  WedgeMark,
} from './mark.js';

import {
  ObjectFrame,
} from './frame.js';

import {
  Matrix,
} from './matrix.js';

// --------------------------------------------------------------------------- 

export class Node extends ObjectFrame {
  initialize(shape, where) {
    super.initialize(shape, where);
    shape.addNode(this);
    this.sourceSpans = [];
  }

  deflate() {
    const object = super.deflate();
    object.sourceSpans = this.sourceSpans;
    return object;
  }

  embody(parentEnvironment, object, inflater) {
    super.embody(parentEnvironment, object, inflater);
    this.sourceSpans = object.sourceSpans.map(subobject => SourceLocation.inflate(subobject));
  }

  castCursor(column, row) {
    return this.sourceSpans.some(span => span.contains(column, row));
  }

  initializeMarkState() {
    this.marker = new Marker(this.parentFrame);
    this.parentFrame.addMarker(this.marker);
  }

  connect(firstNode, previousNode, nextNode) {
    this.firstNode = firstNode;
    this.previousNode = previousNode;
    this.nextNode = nextNode;
  }

  initializeState() {
    super.initializeState();
    this.state.turtle = new Turtle([0, 0], 0);
  }

  configureTurtleAndDependents() {
    this.configureTurtle();
    this.nextNode?.configureTurtleAndDependents();
  }
}

// --------------------------------------------------------------------------- 

export class TabNode extends Node {
  static type = 'tab';
  static article = 'a';
  static timedIds = [];

  static create(parentEnvironment, where) {
    const node = new TabNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new TabNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  get isDom() {
    return true;
  }

  getPositions() {
    const from = this.previousNode.state.turtle;
    const to = this.nextNode.state.turtle;

    const scale = this.state.size / Math.sin(this.state.degrees * Math.PI / 180);
    let v = unitVectorBetween(from.position, to.position);
    const sign = this.state.isCounterclockwise ? -1 : 1;
    const fore = rotateVector(v, sign * this.state.degrees);
    const aft = rotateVector([-v[0], -v[1]], -sign * this.state.degrees);

    const positions = [];
    
    let start;
    let stop;
    if (this.state.inset > 0) {
      start = [
        from.position[0] + v[0] * this.state.inset,
        from.position[1] + v[1] * this.state.inset,
      ];
      stop = [
        to.position[0] - v[0] * this.state.inset,
        to.position[1] - v[1] * this.state.inset,
      ];
      positions.push(start);
    } else {
      start = from.position;
      stop = to.position;
    }

    positions.push([
      start[0] + fore[0] * scale,
      start[1] + fore[1] * scale,
    ]);

    positions.push([
      stop[0] + aft[0] * scale,
      stop[1] + aft[1] * scale,
    ]);

    if (this.state.inset > 0) {
      positions.push(stop);
    }

    return positions;
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    // none

    // Assert types of extent properties.
    this.assertScalarType('inset', [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('degrees', [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('size', [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('inset', fromTime, toTime);
    this.assertCompleteTimeline('degrees', fromTime, toTime);
    this.assertCompleteTimeline('size', fromTime, toTime);

  }

  initializeState() {
    super.initializeState();

    if (!this.has('inset')) {
      this.state.inset = this.parentFrame.state.tabDefaults.inset;
    }

    if (!this.has('size')) {
      this.state.size = this.parentFrame.state.tabDefaults.size;
    }

    if (!this.has('degrees')) {
      this.state.degrees = this.parentFrame.state.tabDefaults.degrees;
    }

    if (!this.has('order')) {
      this.state.isCounterclockwise = this.parentFrame.state.tabDefaults.isCounterclockwise;
    }
  }

  initializeStaticState() {
    this.initializeStaticScalarProperty('inset');
    this.initializeStaticScalarProperty('degrees');
    this.initializeStaticScalarProperty('size');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('inset');
    this.initializeDynamicProperty('degrees');
    this.initializeDynamicProperty('size');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('inset', t);
    this.synchronizeStateProperty('degrees', t);
    this.synchronizeStateProperty('size', t);
    this.configureTurtle();

    if (this.has('inset')) {
      this.parentFrame.state.tabDefaults.inset = this.state.inset;
    }

    if (this.has('size')) {
      this.parentFrame.state.tabDefaults.size = this.state.size;
    }

    if (this.has('degrees')) {
      this.parentFrame.state.tabDefaults.degrees = this.state.degrees;
    }

    if (this.has('order')) {
      this.parentFrame.state.tabDefaults.isCounterclockwise = this.state.isCounterclockwise;
    }
  }

  configureTurtle() {
    // We keep the turtle where it was because the tab is a fake node. Its successor
    // will pick up from where the predecessor left off.
    this.state.turtle.position[0] = this.previousNode.state.turtle.position[0];
    this.state.turtle.position[1] = this.previousNode.state.turtle.position[1];
    this.state.turtle.heading = this.previousNode.state.turtle.heading;
  }

  pathCommand(bounds) {
    const positions = this.getPositions();
    return positions.map(position => `L${position[0]},${bounds.span - position[1]}`).join(' ');
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.marker.setMarks();
  }

  synchronizeMarkState(matrix, inverseMatrix) {
  }

  synchronizeMarkExpressions(t) {
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
  }
}

// --------------------------------------------------------------------------- 

export class VertexNode extends Node {
  static type = 'vertex';
  static article = 'a';
  static timedIds = ['position'];

  static create(parentEnvironment, where) {
    const node = new VertexNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new VertexNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  get isDom() {
    return true;
  }

  getPositions() {
    return [this.state.turtle.position];
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('position');

    // Assert types of extent properties.
    this.assertVectorType('position', 2, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('position', fromTime, toTime);
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('position');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('position');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('position', t);
    this.state.turtle.position[0] = this.state.position[0];
    this.state.turtle.position[1] = this.state.position[1];
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.positionMark = new VectorPanMark(this.parentFrame, this, value => {
      this.state.position = value;
      this.state.turtle.position[0] = this.state.position[0];
      this.state.turtle.position[1] = this.state.position[1];
    });
    this.marker.setMarks(this.positionMark);
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    this.positionMark.synchronizeState(this.state.position, matrix, inverseMatrix);
  }

  synchronizeMarkExpressions(t) {
    this.positionMark.synchronizeExpressions(this.expressionAt('position', t));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.positionMark.synchronizeDom(bounds, handleRadius);
  }
}

// --------------------------------------------------------------------------- 

export class TurtleNode extends Node {
  static type = 'turtle';
  static article = 'a';
  static timedIds = ['position', 'heading'];

  static create(parentEnvironment, where) {
    const node = new TurtleNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new TurtleNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  segment(previousSegment) {
    return new GapSegment(this.previousNode?.state.turtle.position, this.state.turtle.position);
  }

  get isDom() {
    return true;
  }

  getPositions() {
    return [this.state.turtle.position];
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('position');
    this.assertProperty('heading');

    // Assert types of extent properties.
    this.assertVectorType('position', 2, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('heading', [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('position', fromTime, toTime);
    this.assertCompleteTimeline('heading', fromTime, toTime);
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('position');
    this.initializeStaticScalarProperty('heading');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('position');
    this.initializeDynamicProperty('heading');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('position', t);
    this.synchronizeStateProperty('heading', t);
    this.state.turtle.position[0] = this.state.position[0];
    this.state.turtle.position[1] = this.state.position[1];
    this.state.turtle.heading = this.state.heading;
  }

  pathCommand(bounds) {
    return `M ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
  }

  configureTurtle() {
    this.state.turtle.position[0] = this.state.position[0];
    this.state.turtle.position[1] = this.state.position[1];
    this.state.turtle.heading = this.state.heading;
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.positionMark = new VectorPanMark(this.parentFrame, this, value => {
      this.state.position = value;
      this.configureTurtleAndDependents();
    });
    this.headingMark = new RotationMark(this.parentFrame, this, value => {
      this.state.heading = value;
      this.configureTurtleAndDependents();
    });
    this.wedgeMark = new WedgeMark();
    this.marker.setMarks(this.positionMark, this.headingMark, this.wedgeMark);
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    this.positionMark.synchronizeState(this.state.position, matrix, inverseMatrix);
    this.headingMark.synchronizeState(this.state.position, this.state.heading, 0 /* TODO*/, matrix, inverseMatrix);
    this.wedgeMark.synchronizeState(this.state.position, this.state.heading, 0, matrix);
  }

  synchronizeMarkExpressions(t) {
    this.positionMark.synchronizeExpressions(this.expressionAt('position', t));
    this.headingMark.synchronizeExpressions(this.expressionAt('heading', t));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.positionMark.synchronizeDom(bounds, handleRadius);
    this.headingMark.synchronizeDom(bounds, handleRadius, radialLength);
    this.wedgeMark.synchronizeDom(bounds, radialLength);
  }
}

// --------------------------------------------------------------------------- 

export class WalkNode extends Node {
  static type = 'walk';
  static article = 'a';
  static timedIds = ['distance'];

  static create(parentEnvironment, where) {
    const node = new WalkNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new WalkNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  get isDom() {
    return true;
  }

  getPositions() {
    return [this.state.turtle.position];
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('distance');

    // Assert types of extent properties.
    this.assertScalarType('distance', [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('distance', fromTime, toTime);
  }

  initializeStaticState() {
    this.initializeStaticScalarProperty('distance');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('distance');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('distance', t);
    this.configureTurtle();
  }

  configureTurtle() {
    this.state.turtle.position[0] = this.previousNode.state.turtle.position[0] + this.state.distance * Math.cos(this.previousNode.state.turtle.heading * Math.PI / 180);
    this.state.turtle.position[1] = this.previousNode.state.turtle.position[1] + this.state.distance * Math.sin(this.previousNode.state.turtle.heading * Math.PI / 180);
    this.state.turtle.heading = this.previousNode.state.turtle.heading;
  }

  pathCommand(bounds) {
    return `L ${this.state.turtle.position[0]},${bounds.span - this.state.turtle.position[1]}`;
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.distanceMark = new DistanceMark(this.parentFrame, null, value => {
      this.state.distance = value;
      this.configureTurtleAndDependents();
    });
    this.marker.setMarks(this.distanceMark);
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    this.distanceMark.synchronizeState(this.state.turtle.position, this.previousNode.state.turtle.position, this.previousNode.state.turtle.heading, matrix, inverseMatrix);
  }

  synchronizeMarkExpressions(t) {
    this.distanceMark.synchronizeExpressions(this.expressionAt('distance', t));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.distanceMark.synchronizeDom(bounds, handleRadius);
  }
}

// --------------------------------------------------------------------------- 

export class FlyNode extends Node {
  static type = 'fly';
  static article = 'a';
  static timedIds = ['distance'];

  static create(parentEnvironment, where) {
    const node = new FlyNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new FlyNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  get isDom() {
    return true;
  }

  getPositions() {
    return [this.state.turtle.position];
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('distance');

    // Assert types of extent properties.
    this.assertScalarType('distance', [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('distance', fromTime, toTime);
  }

  initializeStaticState() {
    this.initializeStaticScalarProperty('distance');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('distance');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('distance', t);
    this.configureTurtle();
  }

  configureTurtle() {
    this.state.turtle.position[0] = this.previousNode.state.turtle.position[0] + this.state.distance * Math.cos(this.previousNode.state.turtle.heading * Math.PI / 180);
    this.state.turtle.position[1] = this.previousNode.state.turtle.position[1] + this.state.distance * Math.sin(this.previousNode.state.turtle.heading * Math.PI / 180);
    this.state.turtle.heading = this.previousNode.state.turtle.heading;
  }

  pathCommand(bounds) {
    return `M ${this.state.turtle.position[0]},${bounds.span - this.state.turtle.position[1]}`;
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.distanceMark = new DistanceMark(this.parentFrame, null, value => {
      this.state.distance = value;
      this.configureTurtleAndDependents();
    });
    this.marker.setMarks(this.distanceMark);
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    this.distanceMark.synchronizeState(this.state.turtle.position, this.previousNode.state.turtle.position, this.previousNode.state.turtle.heading, matrix, inverseMatrix);
  }

  synchronizeMarkExpressions(t) {
    this.distanceMark.synchronizeExpressions(this.expressionAt('distance', t));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.distanceMark.synchronizeDom(bounds, handleRadius);
  }
}

// --------------------------------------------------------------------------- 

export class CircleNode extends Node {
  static type = 'circle';
  static article = 'a';
  static timedIds = ['center', 'radius'];

  static create(parentEnvironment, where) {
    const node = new CircleNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new CircleNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  get isDom() {
    return true;
  }

  // TODO what is getPositions used for?
  getPositions() {
    return [this.state.turtle.position];
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('center');
    this.assertProperty('radius');

    // Assert types of extent properties.
    this.assertVectorType('center', 2, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('radius', [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('center', fromTime, toTime);
    this.assertCompleteTimeline('radius', fromTime, toTime);
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('center');
    this.initializeStaticScalarProperty('radius');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('center');
    this.initializeDynamicProperty('radius');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('center', t);
    this.synchronizeStateProperty('radius', t);
    this.configureTurtle();
  }

  configureTurtle() {
    this.state.turtle.position[0] = this.state.center[0];
    this.state.turtle.position[1] = this.state.center[1];
    this.state.turtle.heading = this.previousNode.state.turtle.heading;
  }

  pathCommand(bounds) {
    return `M ${this.state.center[0] + this.state.radius},${bounds.span - this.state.center[1]} A ${this.state.radius},${this.state.radius} 0 1 0 ${this.state.center[0] - this.state.radius},${bounds.span - this.state.center[1]} A ${this.state.radius},${this.state.radius} 0 1 0 ${this.state.center[0] + this.state.radius},${bounds.span - this.state.center[1]}`;
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.centerMark = new VectorPanMark(this.parentFrame, null, value => {
      this.state.center = value;
      this.configureTurtleAndDependents();
    });
    this.radiusMark = new HorizontalPanMark(this.parentFrame, null, 1, value => {
      this.state.radius = value;
      this.configureTurtleAndDependents();
    });
    this.marker.setMarks(this.centerMark, this.radiusMark);
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    this.centerMark.synchronizeState(this.state.center, matrix, inverseMatrix);
    this.radiusMark.synchronizeState([
      this.state.center[0] + this.state.radius,
      this.state.center[1],
    ], matrix, inverseMatrix);
  }

  synchronizeMarkExpressions(t) {
    this.centerMark.synchronizeExpressions(this.expressionAt('center', t));
    this.radiusMark.synchronizeExpressions(this.expressionAt('radius', t));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.centerMark.synchronizeDom(bounds, handleRadius);
    this.radiusMark.synchronizeDom(bounds, handleRadius);
  }
}

// --------------------------------------------------------------------------- 

export class RectangleNode extends Node {
  static type = 'rectangle';
  static article = 'a';
  static timedIds = ['corner', 'center', 'size'];

  static create(parentEnvironment, where) {
    const node = new RectangleNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new RectangleNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  get isDom() {
    return true;
  }

  getPositions() {
    return [this.state.turtle.position];
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('size');

    if (this.has('corner') && this.has('center')) {
      throw new LocatedException(this.where, 'I found a rectangle node whose <code>corner</code> and <code>center</code> were both set. Define only one of these.');
    } else if (!this.has('corner') && !this.has('center')) {
      throw new LocatedException(this.where, "I found a rectangle node whose position I couldn't figure out. Define either its <code>corner</code> or <code>center</code>.");
    }

    // Assert types of extent properties.
    this.assertVectorType('center', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('corner', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('size', 2, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('center', fromTime, toTime);
    this.assertCompleteTimeline('corner', fromTime, toTime);
    this.assertCompleteTimeline('size', fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.hasCenter = this.has('center');
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('center');
    this.initializeStaticVectorProperty('corner');
    this.initializeStaticVectorProperty('size');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('center');
    this.initializeDynamicProperty('corner');
    this.initializeDynamicProperty('size');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('center', t);
    this.synchronizeStateProperty('corner', t);
    this.synchronizeStateProperty('size', t);
    this.configureTurtle();
  }

  configureTurtle() {
    this.state.turtle.position = this.previousNode.state.turtle.position;
    this.state.turtle.heading = this.previousNode.state.turtle.heading;
  }

  pathCommand(bounds) {
    let corner;
    if (this.state.center) {
      this.state.turtle.position[0] = this.state.center[0];
      this.state.turtle.position[1] = this.state.center[1];
      corner = [
        this.state.center[0] - this.state.size[0] * 0.5,
        this.state.center[1] - this.state.size[1] * 0.5
      ];
    } else {
      this.state.turtle.position[0] = this.state.corner[0];
      this.state.turtle.position[1] = this.state.corner[1];
      corner = this.state.corner;
    }

    return `
M ${corner[0]},${bounds.span - corner[1]}
L ${corner[0] + this.state.size[0]},${bounds.span - corner[1]}
L ${corner[0] + this.state.size[0]},${bounds.span - (corner[1] + this.state.size[1])}
L ${corner[0]},${bounds.span - (corner[1] + this.state.size[1])}
z
    `;
  }

  initializeMarkState() {
    super.initializeMarkState();

    if (this.hasCenter) {
      this.positionMark = new VectorPanMark(this.parentFrame, null, position => {
        this.state.center = position;
        this.state.corner[0] = position[0] - this.state.size[0] * 0.5;
        this.state.corner[1] = position[1] - this.state.size[1] * 0.5;
      });
      this.widthMark = new HorizontalPanMark(this.parentFrame, null, 2, value => {
        this.state.size[0] = value;
        this.state.corner[0] = this.state.center[0] - value * 0.5;
      });
      this.heightMark = new VerticalPanMark(this.parentFrame, null, 2, value => {
        this.state.size[1] = value;
        this.state.corner[1] = this.state.center[1] - value * 0.5;
      });
    } else {
      this.positionMark = new VectorPanMark(this.parentFrame, null, position => {
        this.state.corner = position;
      });
      this.widthMark = new HorizontalPanMark(this.parentFrame, null, 1, value => this.state.size[0] = value);
      this.heightMark = new VerticalPanMark(this.parentFrame, null, 1, value => this.state.size[1] = value);
    }
    this.marker.setMarks(this.positionMark, this.widthMark, this.heightMark);
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    if (this.hasCenter) {
      this.positionMark.synchronizeState(this.state.center, matrix, inverseMatrix);
      this.widthMark.synchronizeState([
        this.state.center[0] + 0.5 * this.state.size[0],
        this.state.center[1],
      ], matrix, inverseMatrix);
      this.heightMark.synchronizeState([
        this.state.center[0],
        this.state.center[1] + 0.5 * this.state.size[1],
      ], matrix, inverseMatrix); // TODO inverse matrix
    } else {
      this.positionMark.synchronizeState(this.state.corner, matrix, inverseMatrix);
      this.widthMark.synchronizeState([
        this.state.corner[0] + this.state.size[0],
        this.state.corner[1],
      ], matrix, inverseMatrix);
      this.heightMark.synchronizeState([
        this.state.corner[0],
        this.state.corner[1] + this.state.size[1],
      ], matrix, inverseMatrix);
    }
  }

  synchronizeMarkExpressions(t) {
    if (this.hasCenter) {
      this.positionMark.synchronizeExpressions(this.expressionAt('center', t));
    } else {
      this.positionMark.synchronizeExpressions(this.expressionAt('corner', t));
    }
    this.widthMark.synchronizeExpressions(this.expressionAt('size', t).get(0));
    this.heightMark.synchronizeExpressions(this.expressionAt('size', t).get(1));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.positionMark.synchronizeDom(bounds, handleRadius);
    this.widthMark.synchronizeDom(bounds, handleRadius);
    this.heightMark.synchronizeDom(bounds, handleRadius);
  }
}

// --------------------------------------------------------------------------- 

export class TurnNode extends Node {
  static type = 'turn';
  static article = 'a';
  static timedIds = ['degrees'];

  static create(parentEnvironment, where) {
    const node = new TurnNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new TurnNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  get isDom() {
    return false;
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('degrees');

    // Assert types of extent properties.
    this.assertScalarType('degrees', [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('degrees', fromTime, toTime);
  }

  initializeStaticState() {
    this.initializeStaticScalarProperty('degrees');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('degrees');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('degrees', t);
    this.configureTurtle();
  }

  configureTurtle() {
    this.state.turtle.position[0] = this.previousNode.state.turtle.position[0];
    this.state.turtle.position[1] = this.previousNode.state.turtle.position[1];
    this.state.turtle.heading = this.previousNode.state.turtle.heading + this.state.degrees;
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.degreesMark = new RotationMark(this.parentFrame, null, value => {
      this.state.degrees = value;
      this.configureTurtleAndDependents();
    });
    this.wedgeMark = new WedgeMark();
    this.marker.setMarks(this.degreesMark, this.wedgeMark);
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    this.degreesMark.synchronizeState(this.state.turtle.position, this.state.degrees, this.previousNode.state.turtle.heading, matrix, inverseMatrix);
    this.wedgeMark.synchronizeState(this.state.turtle.position, this.state.degrees, this.previousNode.state.turtle.heading, matrix);
  }

  synchronizeMarkExpressions(t) {
    this.degreesMark.synchronizeExpressions(this.expressionAt('degrees', t));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.degreesMark.synchronizeDom(bounds, handleRadius, radialLength);
    this.wedgeMark.synchronizeDom(bounds, radialLength);
  }
}

// --------------------------------------------------------------------------- 

export class BackNode extends Node {
  static type = 'back';
  static article = 'a';
  static timedIds = [];

  static create(parentEnvironment, where) {
    const node = new BackNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new BackNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  segment(previousSegment) {
    // TODO what's supposed to happen here?
    return new GapSegment(this.previousNode?.state.turtle.position, this.state.turtle.position);
  }

  get isDom() {
    return true;
  }

  validate(fromTime, toTime) {
  }

  initializeStaticState() {
  }

  initializeDynamicState() {
  }

  synchronizeState(t) {
  }

  configureTurtle() {
    this.state.turtle.position[0] = this.firstNode.state.turtle.position[0];
    this.state.turtle.position[1] = this.firstNode.state.turtle.position[1];
    this.state.turtle.heading = this.previousNode.state.turtle.heading;
  }

  pathCommand(bounds) {
    return `z`;
  }

  initializeMarkState() {
    super.initializeMarkState();
  }

  synchronizeMarkState(matrix, inverseMatrix) {
  }

  synchronizeMarkExpressions(t) {
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
  }

  getPositions() {
    return [this.state.turtle.position];
  }
}

// --------------------------------------------------------------------------- 

export class GoNode extends Node {
  static type = 'go';
  static article = 'a';
  static timedIds = ['position'];

  static create(parentEnvironment, where) {
    const node = new GoNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new GoNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  segment(previousSegment) {
    return new GapSegment(this.previousNode?.state.turtle.position, this.state.turtle.position);
  }

  get isDom() {
    return true;
  }

  getPositions() {
    return [this.state.turtle.position];
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('position');

    // Assert types of extent properties.
    this.assertVectorType('position', 2, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('position', fromTime, toTime);
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('position');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('position');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('position', t);
    this.state.turtle.position[0] = this.state.position[0];
    this.state.turtle.position[1] = this.state.position[1];
  }

  pathCommand(bounds) {
    return `M ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
  }

  configureTurtle() {
    this.state.turtle.position[0] = this.state.position[0];
    this.state.turtle.position[1] = this.state.position[1];
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.positionMark = new VectorPanMark(this.parentFrame, this, value => {
      this.state.position = value;
      this.configureTurtleAndDependents();
    });
    this.marker.setMarks(this.positionMark);
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    this.positionMark.synchronizeState(this.state.position, matrix, inverseMatrix);
  }

  synchronizeMarkExpressions(t) {
    this.positionMark.synchronizeExpressions(this.expressionAt('position', t));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.positionMark.synchronizeDom(bounds, handleRadius);
  }
}

// --------------------------------------------------------------------------- 

export class LineNode extends Node {
  static type = 'line';
  static article = 'a';
  static timedIds = ['position'];

  static create(parentEnvironment, where) {
    const node = new LineNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new LineNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  segment(previousSegment) {
    return new LineSegment(this.previousNode.state.turtle.position, this.state.turtle.position);
  }

  get isDom() {
    return true;
  }

  getPositions() {
    return [this.state.turtle.position];
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('position');

    // Assert types of extent properties.
    this.assertVectorType('position', 2, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('position', fromTime, toTime);
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('position');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('position');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('position', t);
    this.configureTurtle();
  }

  configureTurtle() {
    this.state.turtle.position[0] = this.state.position[0];
    this.state.turtle.position[1] = this.state.position[1];
    this.state.turtle.heading = this.previousNode.state.turtle.heading;
  }

  pathCommand(bounds) {
    return `L ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.positionMark = new VectorPanMark(this.parentFrame, this, value => {
      this.state.position = value;
      this.state.turtle.position[0] = this.state.position[0];
      this.state.turtle.position[1] = this.state.position[1];
    });
    this.marker.setMarks(this.positionMark);
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    this.positionMark.synchronizeState(this.state.position, matrix, inverseMatrix);
  }

  synchronizeMarkExpressions(t) {
    this.positionMark.synchronizeExpressions(this.expressionAt('position', t));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.positionMark.synchronizeDom(bounds, handleRadius);
  }

  getPathCommand(bounds, from, to) {
    return `L ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
  }
}

// --------------------------------------------------------------------------- 

export class QuadraticNode extends Node {
  static type = 'quadratic';
  static article = 'a';
  static timedIds = ['position', 'control'];

  static create(parentEnvironment, where) {
    const node = new QuadraticNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new QuadraticNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  segment(previousSegment) {
    if (this.state.control) {
      return new QuadraticSegment(this.previousNode.state.turtle.position, this.state.turtle.position, this.state.control, false);
    } else {
      return new QuadraticSegment(this.previousNode.state.turtle.position, this.state.turtle.position, [
        this.previousNode.state.turtle.position[0] + (this.previousNode.state.turtle.position[0] - previousSegment.control[0]),
        this.previousNode.state.turtle.position[1] + (this.previousNode.state.turtle.position[1] - previousSegment.control[1])
      ], true);
    }
  }

  get isDom() {
    return true;
  }

  getPositions() {
    return [this.state.turtle.position];
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('position');

    // Assert types of extent properties.
    this.assertVectorType('position', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('control', 2, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('position', fromTime, toTime);
    this.assertCompleteTimeline('control', fromTime, toTime);

    if (!this.has('control') && !(this.previousNode instanceof QuadraticNode)) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> node whose <code>control</code> was not set. Omitting <code>control</code> is legal only when the previous node was also <code>quadratic</code>.`);
    }
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('position');
    this.initializeStaticVectorProperty('control');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('position');
    this.initializeDynamicProperty('control');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('position', t);
    this.synchronizeStateProperty('control', t);
    this.configureTurtle();
  }

  configureTurtle() {
    this.state.turtle.position[0] = this.state.position[0];
    this.state.turtle.position[1] = this.state.position[1];
    this.state.turtle.heading = this.previousNode.state.turtle.heading;
  }

  pathCommand(bounds) {
    if (this.state.control) {
      return `Q ${this.state.control[0]},${bounds.span - this.state.control[1]} ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
    } else {
      return `T ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
    }
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.positionMark = new VectorPanMark(this.parentFrame, this, value => {
      this.state.position = value;
      this.state.turtle.position[0] = this.state.position[0];
      this.state.turtle.position[1] = this.state.position[1];
      this.state.turtle.heading = this.previousNode.state.turtle.heading;
    });

    if (this.has('control')) {
      this.controlMark = new VectorPanMark(this.parentFrame, this, value => {
        this.state.control = value;
      });
      this.lineMarks = [
        new LineMark(),
        new LineMark(),
      ];
      this.marker.setMarks(this.positionMark, this.controlMark, this.lineMarks[0], this.lineMarks[1]);
    } else {
      this.marker.setMarks(this.positionMark);
    }
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    this.positionMark.synchronizeState(this.state.position, matrix, inverseMatrix);
    if (this.has('control')) {
      this.controlMark.synchronizeState(this.state.control, matrix, inverseMatrix);
      this.lineMarks[0].synchronizeState(this.state.control, this.previousNode.state.position);
      this.lineMarks[1].synchronizeState(this.state.control, this.state.position);
    }
  }

  synchronizeMarkExpressions(t) {
    this.positionMark.synchronizeExpressions(this.expressionAt('position', t));
    if (this.has('control')) {
      this.controlMark.synchronizeExpressions(this.expressionAt('control', t));
    }
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.positionMark.synchronizeDom(bounds, handleRadius);
    if (this.has('control')) {
      this.controlMark.synchronizeDom(bounds, handleRadius);
      this.lineMarks[0].synchronizeDom(bounds, handleRadius);
      this.lineMarks[1].synchronizeDom(bounds, handleRadius);
    }
  }
}

// --------------------------------------------------------------------------- 

export class CubicNode extends Node {
  static type = 'cubic';
  static article = 'a';
  static timedIds = ['position', 'control1', 'control2'];

  static create(parentEnvironment, where) {
    const node = new CubicNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new CubicNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  segment(previousSegment) {
    if (this.state.control1) {
      return new CubicSegment(this.previousNode.state.turtle.position, this.state.turtle.position, this.state.control1, this.state.control2, false);
    } else {
      return new CubicSegment(this.previousNode.state.turtle.position, this.state.turtle.position, [
        this.previousNode.state.turtle.position[0] + (this.previousNode.state.turtle.position[0] - previousSegment.control2[0]),
        this.previousNode.state.turtle.position[1] + (this.previousNode.state.turtle.position[1] - previousSegment.control2[1])
      ], this.state.control2, true);
    }
  }

  get isDom() {
    return true;
  }

  getPositions() {
    return [this.state.turtle.position];
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('position');
    this.assertProperty('control2');

    // Assert types of extent properties.
    this.assertVectorType('position', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('control1', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('control2', 2, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('position', fromTime, toTime);
    this.assertCompleteTimeline('control1', fromTime, toTime);
    this.assertCompleteTimeline('control2', fromTime, toTime);

    if (!this.has('control1') && !(this.previousNode instanceof CubicNode)) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> node whose <code>control1</code> was not set. Omitting <code>control1</code> is legal only when the previous node was also <code>cubic</code>.`);
    }
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('position');
    this.initializeStaticVectorProperty('control1');
    this.initializeStaticVectorProperty('control2');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('position');
    this.initializeDynamicProperty('control1');
    this.initializeDynamicProperty('control2');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('position', t);
    this.synchronizeStateProperty('control1', t);
    this.synchronizeStateProperty('control2', t);
    this.configureTurtle();
  }

  configureTurtle() {
    this.state.turtle.position[0] = this.state.position[0];
    this.state.turtle.position[1] = this.state.position[1];
    this.state.turtle.heading = this.previousNode.state.turtle.heading;
  }

  pathCommand(bounds) {
    if (this.state.control1) {
      return `C ${this.state.control1[0]},${bounds.span - this.state.control1[1]} ${this.state.control2[0]},${bounds.span - this.state.control2[1]} ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
    } else {
      return `S ${this.state.control2[0]},${bounds.span - this.state.control2[1]} ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
    }
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.positionMark = new VectorPanMark(this.parentFrame, this, value => {
      this.state.position = value;
      this.state.turtle.position[0] = this.state.position[0];
      this.state.turtle.position[1] = this.state.position[1];
      this.state.turtle.heading = this.previousNode.state.turtle.heading;
    });

    this.control2Mark = new VectorPanMark(this.parentFrame, this, value => {
      this.state.control2 = value;
    });

    this.outLineMark = new LineMark();

    if (this.has('control1')) {
      this.control1Mark = new VectorPanMark(this.parentFrame, this, value => {
        this.state.control1 = value;
      });
      this.inLineMark = new LineMark();
      this.marker.setMarks(this.positionMark, this.control2Mark, this.control1Mark, this.outLineMark, this.inLineMark);
    } else {
      this.marker.setMarks(this.positionMark, this.control2Mark, this.outLineMark);
    }
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    this.positionMark.synchronizeState(this.state.position, matrix, inverseMatrix);
    this.control2Mark.synchronizeState(this.state.control2, matrix, inverseMatrix);
    this.outLineMark.synchronizeState(this.state.control2, this.state.position);
    if (this.has('control1')) {
      this.control1Mark.synchronizeState(this.state.control1, matrix, inverseMatrix);
      this.inLineMark.synchronizeState(this.state.control1, this.previousNode.state.position);
    }
  }

  synchronizeMarkExpressions(t) {
    this.positionMark.synchronizeExpressions(this.expressionAt('position', t));
    this.control2Mark.synchronizeExpressions(this.expressionAt('control2', t));
    if (this.has('control1')) {
      this.control1Mark.synchronizeExpressions(this.expressionAt('control1', t));
    }
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.positionMark.synchronizeDom(bounds, handleRadius);
    this.control2Mark.synchronizeDom(bounds, handleRadius);
    this.outLineMark.synchronizeDom(bounds, handleRadius);
    if (this.has('control1')) {
      this.control1Mark.synchronizeDom(bounds, handleRadius);
      this.inLineMark.synchronizeDom(bounds, handleRadius);
    }
  }
}

// --------------------------------------------------------------------------- 

export class ArcNode extends Node {
  static type = 'arc';
  static article = 'an';
  static timedIds = ['degrees', 'position', 'center'];

  static create(parentEnvironment, where) {
    const node = new ArcNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new ArcNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  segment(previousSegment) {
    return new ArcSegment(this.previousNode.state.turtle.position, this.state.turtle.position, this.state.radius, this.state.isLarge, this.state.isClockwise);
  }

  get isDom() {
    return true;
  }

  getPositions() {
    return [this.state.turtle.position];
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('degrees');

    // Assert types of extent properties.
    this.assertVectorType('position', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('center', 2, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('degrees', [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('position', fromTime, toTime);
    this.assertCompleteTimeline('center', fromTime, toTime);
    this.assertCompleteTimeline('degrees', fromTime, toTime);

    if (!this.has('position') && !this.has('center')) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> node whose position I couldn't figure out. Define either its <code>position</code> or <code>center</code>.`);
    } else if (this.has('position') && this.has('center')) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> node whose <code>position</code> and <code>center</code> were both set. Define only one of these.`);
    }
  }

  initializeState() {
    super.initializeState();
    this.state.isWedge = this.has('center');
  }

  initializeStaticState() {
    this.initializeStaticScalarProperty('degrees');
    this.initializeStaticVectorProperty('position');
    this.initializeStaticVectorProperty('center');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('degrees');
    this.initializeDynamicProperty('position');
    this.initializeDynamicProperty('center');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('degrees', t);
    this.synchronizeStateProperty('position', t);
    this.synchronizeStateProperty('center', t);
    this.configureTurtle();
  }

  configureTurtle() {
    if (this.state.degrees >= 0) {
      this.state.isLarge = this.state.degrees >= 180 ? 1 : 0;
      this.state.isClockwise = 0;
    } else {
      this.state.isLarge = this.state.degrees <= -180 ? 1 : 0;
      this.state.isClockwise = 1;
    }

    this.state.isCircle = this.state.degrees === 360;
    let radians = this.state.degrees * Math.PI / 180;

    let position;

    if (!this.state.isWedge) {
      position = this.state.position;

      let diff = [
        this.state.position[0] - this.previousNode.state.turtle.position[0],
        this.state.position[1] - this.previousNode.state.turtle.position[1],
      ];
      let magnitude = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);
      let distance = (0.5 * Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1])) / Math.tan(radians * 0.5);
      let halfway = [
        (this.previousNode.state.turtle.position[0] + this.state.position[0]) * 0.5,
        (this.previousNode.state.turtle.position[1] + this.state.position[1]) * 0.5
      ];
      let normal = [
        diff[1] / magnitude,
        -diff[0] / magnitude
      ];
      this.state.center = [
        halfway[0] + normal[0] * -distance,
        halfway[1] + normal[1] * -distance
      ];
    }

    let radial = [
      this.previousNode.state.turtle.position[0] - this.state.center[0],
      this.previousNode.state.turtle.position[1] - this.state.center[1],
    ];
    this.state.radius = Math.sqrt(radial[0] * radial[0] + radial[1] * radial[1]);

    if (this.state.isWedge) {
      const rotated = [
        radial[0] * Math.cos(radians) - radial[1] * Math.sin(radians),
        radial[0] * Math.sin(radians) + radial[1] * Math.cos(radians),
      ];

      position = [
        this.state.center[0] + radial[0] * Math.cos(radians) - radial[1] * Math.sin(radians),
        this.state.center[1] + radial[0] * Math.sin(radians) + radial[1] * Math.cos(radians),
      ];
    }

    if (this.state.isWedge) {
      this.state.position = position;
    }
    this.state.turtle.position[0] = position[0];
    this.state.turtle.position[1] = position[1];
    this.state.turtle.heading = this.previousNode.state.turtle.heading;
  }

  pathCommand(bounds) {
    if (this.state.isCircle) {
      const opposite = [
        this.state.center[0] + (this.state.center[0] - this.state.position[0]),
        this.state.center[1] + (this.state.center[1] - this.state.position[1]),
      ];
      return `A ${this.state.radius},${this.state.radius} 0 ${this.state.isLarge} ${this.state.isClockwise} ${opposite[0]},${bounds.span - opposite[1]} A ${this.state.radius},${this.state.radius} 0 ${this.state.isLarge} ${this.state.isClockwise} ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
    } else {
      return `A ${this.state.radius},${this.state.radius} 0 ${this.state.isLarge} ${this.state.isClockwise} ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
    }
  }

  initializeMarkState() {
    super.initializeMarkState();

    if (this.state.isWedge) {
      this.centerMark = new VectorPanMark(this.parentFrame, this, value => {
        this.state.center = value;
        this.configureTurtleAndDependents();
      });

      this.positionMark = new WedgeDegreesMark(this.parentFrame, this, value => {
        this.state.degrees = value;
        this.configureTurtleAndDependents();
      });
    } else {
      this.positionMark = new VectorPanMark(this.parentFrame, this, value => {
        this.state.position = value;
        this.configureTurtleAndDependents();
      });

      this.centerMark = new BumpDegreesMark(this.parentFrame, this, value => {
        this.state.degrees = value;
        this.configureTurtleAndDependents();
      });
    }

    this.lineMarks = [
      new LineMark(),
      new LineMark(),
    ];

    this.marker.setMarks(this.positionMark, this.centerMark, this.lineMarks[0], this.lineMarks[1]);
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    if (this.state.isWedge) {
      this.centerMark.synchronizeState(this.state.center, matrix, inverseMatrix);
      this.positionMark.synchronizeState(this.state.position, this.previousNode.state.turtle.position, this.state.center, matrix, inverseMatrix);
    } else {
      this.positionMark.synchronizeState(this.state.position, matrix, inverseMatrix);
      this.centerMark.synchronizeState(this.state.degrees, this.state.position, this.previousNode.state.turtle.position, this.state.center, matrix, inverseMatrix);
    }
    this.lineMarks[0].synchronizeState(this.state.center, this.previousNode.state.position);
    this.lineMarks[1].synchronizeState(this.state.center, this.state.position);
  }

  synchronizeMarkExpressions(t) {
    if (this.state.isWedge) {
      this.positionMark.synchronizeExpressions(this.expressionAt('degrees', t));
      this.centerMark.synchronizeExpressions(this.expressionAt('center', t));
    } else {
      this.positionMark.synchronizeExpressions(this.expressionAt('position', t));
      this.centerMark.synchronizeExpressions(this.expressionAt('degrees', t));
    }
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.positionMark.synchronizeDom(bounds, handleRadius);
    this.centerMark.synchronizeDom(bounds, handleRadius);
    this.lineMarks[0].synchronizeDom(bounds, handleRadius);
    this.lineMarks[1].synchronizeDom(bounds, handleRadius);
  }
}

// --------------------------------------------------------------------------- 

class GapSegment {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  mirror(line) {
    return new GapSegment(mirrorPointLine(this.to, line), mirrorPointLine(this.from, line));
  }

  toCommandString(bounds) {
    return `M ${this.to[0]},${bounds.span - this.to[1]}`;
  }
}

// --------------------------------------------------------------------------- 

export class LineSegment {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  mirror(line) {
    return new LineSegment(mirrorPointLine(this.to, line), mirrorPointLine(this.from, line));
  }

  mirrorBridge(line) {
    return new LineSegment(this.to, mirrorPointLine(this.to, line));
  }

  toCommandString(bounds) {
    return `L ${this.to[0]},${bounds.span - this.to[1]}`;
  }
}

// --------------------------------------------------------------------------- 

export class QuadraticSegment {
  constructor(from, to, control, isImplicit) {
    this.from = from;
    this.to = to;
    this.control = control;
    this.isImplicit;
  }

  mirror(line) {
    return new QuadraticSegment(mirrorPointLine(this.to, line), mirrorPointLine(this.from, line), mirrorPointLine(this.control, line));
  }

  mirrorBridge(line) {
    const diff = [
			this.control[0] - this.to[0],
			this.control[1] - this.to[1]
		];
    const opposite = [
			this.to[0] - diff[0],
			this.to[1] - diff[1]
		];
    return new CubicSegment(this.to, mirrorPointLine(this.to, line), opposite, mirrorPointLine(opposite, line), false);
  }

  toCommandString(bounds) {
    if (this.isImplicit) {
      return `T ${this.to[0]},${bounds.span - this.to[1]}`;
    } else {
      return `Q ${this.control[0]},${bounds.span - this.control[1]} ${this.to[0]},${bounds.span - this.to[1]}`;
    }
  }
}

// --------------------------------------------------------------------------- 

export class CubicSegment {
  constructor(from, to, control1, control2, isImplicit) {
    this.from = from;
    this.to = to;
    this.control1 = control1;
    this.control2 = control2;
    this.isImplicit = isImplicit;
  }

  mirror(line, allowImplicit = true) {
    return new CubicSegment(mirrorPointLine(this.to, line), mirrorPointLine(this.from, line), mirrorPointLine(this.control2, line), mirrorPointLine(this.control1, line), allowImplicit && this.isImplicit);
  }

  mirrorBridge(line) {
    const diff = [
			this.control2[0] - this.to[0],
			this.control2[1] - this.to[1],
		];
    const opposite = [
			this.to[0] - diff[0],
			this.to[1] - diff[1]
		];
    return new CubicSegment(this.to, mirrorPointLine(this.to, line), opposite, mirrorPointLine(opposite, line), true);
  }

  toCommandString(bounds) {
    if (this.isImplicit) {
      return `S ${this.control2[0]},${bounds.span - this.control2[1]} ${this.to[0]},${bounds.span - this.to[1]}`;
    } else {
      return `C ${this.control1[0]},${bounds.span - this.control1[1]} ${this.control2[0]},${bounds.span - this.control2[1]} ${this.to[0]},${bounds.span - this.to[1]}`;
    }
  }
}

// --------------------------------------------------------------------------- 

export class ArcSegment {
  constructor(from, to, radius, isLarge, isClockwise) {
    this.from = from;
    this.to = to;
    this.radius = radius;
    this.isLarge = isLarge;
    this.isClockwise = isClockwise;
  }

  mirror(line) {
    return new ArcSegment(mirrorPointLine(this.to, line), mirrorPointLine(this.from, line), this.radius, this.isLarge, this.isClockwise);
  }

  mirrorBridge(line) {
    return new LineSegment(this.to, mirrorPointLine(this.to, line));
  }

  toCommandString(bounds) {
    return `A${this.radius},${this.radius} 0 ${this.isLarge} ${this.isClockwise} ${this.to[0]},${bounds.span - this.to[1]}`;
  }
}

// --------------------------------------------------------------------------- 

export class Mirror extends ObjectFrame {
  static type = 'mirror';
  static article = 'a';
  static timedIds = ['pivot', 'axis'];

  static create(parentEnvironment, where) {
    const mirror = new Mirror();
    mirror.initialize(parentEnvironment, where);
    return mirror;
  }

  static inflate(parentEnvironment, object, inflater) {
    const mirror = new Mirror();
    mirror.embody(parentEnvironment, object, inflater);
    return mirror;
  }

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    parentEnvironment.addMirror(this);
    this.sourceSpans = [];
  }

  deflate() {
    const object = super.deflate();
    object.sourceSpans = this.sourceSpans;
    return object;
  }

  embody(parentEnvironment, object, inflater) {
    super.embody(parentEnvironment, object, inflater);
    this.sourceSpans = object.sourceSpans.map(subobject => SourceLocation.inflate(subobject));
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('pivot');
    this.assertProperty('axis');

    // Assert types of extent properties.
    this.assertVectorType('pivot', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('axis', 2, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('pivot', fromTime, toTime);
    this.assertCompleteTimeline('axis', fromTime, toTime);
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('pivot');
    this.initializeStaticVectorProperty('axis');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('pivot');
    this.initializeDynamicProperty('axis');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('pivot', t);
    this.synchronizeStateProperty('axis', t);
  }

  initializeMarkState() {
    this.marker = new Marker(this.parentFrame);
    this.parentFrame.addMarker(this.marker);

    this.pivotMark = new VectorPanMark(this.parentFrame, this, value => {
      this.state.pivot = value;
    });

    this.axisMark = new AxisMark(this.parentFrame, this, value => {
      this.state.axis = value;
    });

    this.lineMark = new RayMark();

    this.marker.setMarks(this.pivotMark, this.axisMark, this.lineMark);
  }

  synchronizeMarkState(matrix, inverseMatrix) {
    this.pivotMark.synchronizeState(this.state.pivot, matrix, inverseMatrix);
    this.axisMark.synchronizeState(this.state.axis, this.state.pivot, matrix, inverseMatrix);
    this.lineMark.synchronizeState(this.state.axis, this.state.pivot, matrix, inverseMatrix);
  }

  synchronizeMarkExpressions(t) {
    this.pivotMark.synchronizeExpressions(this.expressionAt('pivot', t));
    this.axisMark.synchronizeExpressions(this.expressionAt('axis', t));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.pivotMark.synchronizeDom(bounds, handleRadius);
    this.axisMark.synchronizeDom(bounds, handleRadius, radialLength);
    this.lineMark.synchronizeDom(bounds, handleRadius, radialLength);
  }

  castCursor(column, row) {
    return this.sourceSpans.some(span => span.contains(column, row));
  }
}

// --------------------------------------------------------------------------- 

