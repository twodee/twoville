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

  initializeState(previousNode, firstNode) {
    super.initializeState();
    this.previousNode = previousNode;
    this.firstNode = firstNode;
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

  configureState(bounds) {
    // TODO check types

    if (this.owns('size')) {
      this.state.size = this.untimedProperties.size.value;
      this.parentEnvironment.state.tabSize = this.state.size;
    } else {
      this.state.size = this.parentEnvironment.state.tabSize;
    }

    if (this.owns('degrees')) {
      this.state.degrees = this.untimedProperties.degrees.value;
      this.parentEnvironment.state.tabDegrees = this.state.degrees;
    } else {
      this.state.degrees = this.parentEnvironment.state.tabDegrees;
    }

    if (this.owns('inset')) {
      this.state.inset = this.untimedProperties.inset.value;
      this.parentEnvironment.state.tabInset = this.state.inset;
    } else {
      this.state.inset = this.parentEnvironment.state.tabInset;
    }

    if (this.owns('winding')) {
      this.state.isCounterclockwise = this.untimedProperties.winding.value === 1;
      this.parentEnvironment.state.tabIsCounterclockwise = this.state.isCounterclockwise;
    } else {
      this.state.isCounterclockwise = this.parentEnvironment.state.tabIsCounterclockwise;
    }

    this.updateTurtle(bounds);
  }

  getPathCommand(bounds, from, to) {
    const positions = this.getPositions(from, to);
    return positions.map(position => `L${position[0]},${bounds.span - position[1]}`).join(' ');
  }

  getPositions(from, to) {
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

  updateTurtle(bounds) {
    this.state.turtle.position[0] = this.previousTurtle.position[0];
    this.state.turtle.position[1] = this.previousTurtle.position[1];
    this.state.turtle.heading = this.previousTurtle.heading;
  }

  configureMarks() {
    super.configureMarks();
    this.marker.addMarks([], [], []);
  }

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);
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
    return new GapSegment(this.previousTurtle?.position, this.turtle.position);
  }

  get isDom() {
    return true;
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

export class MoveNode extends Node {
  static type = 'move';
  static article = 'a';
  static timedIds = ['distance'];

  static create(parentEnvironment, where) {
    const node = new MoveNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new MoveNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  get isDom() {
    return true;
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('distance');

    // Assert types of extent properties.
    this.assertScalarType('distance', [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('distance', fromTime, toTime);
  }

  initializeState(previousNode, firstNode) {
    super.initializeState(previousNode, firstNode);
    this.previousNode.nextNode = this;
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

export class JumpNode extends Node {
  static type = 'jump';
  static article = 'a';
  static timedIds = ['distance'];

  static create(parentEnvironment, where) {
    const node = new JumpNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static inflate(parentEnvironment, object, inflater) {
    const node = new JumpNode();
    node.embody(parentEnvironment, object, inflater);
    return node;
  }

  get isDom() {
    return true;
  }

  configureState(bounds) {
    this.configureScalarProperty('distance', this, this.parentEnvironment, this.updateTurtle.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>jump</code> node whose <code>distance</code> was not set.');
      }

      try {
        timeline.assertScalar(this.parentEnvironment, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>jump</code> node with an illegal value for <code>distance</code>. ${e.message}`);
      }
    });
  }

  updateTurtle(bounds) {
    this.turtle.position[0] = this.previousTurtle.position[0] + this.state.distance * Math.cos(this.previousTurtle.heading * Math.PI / 180);
    this.turtle.position[1] = this.previousTurtle.position[1] + this.state.distance * Math.sin(this.previousTurtle.heading * Math.PI / 180);
    this.turtle.heading = this.previousTurtle.heading;
    this.parentEnvironment.state.turtle0 = this.turtle;
    this.pathCommand = `M ${this.turtle.position[0]},${bounds.span - this.turtle.position[1]}`;
  }

  getPathCommand(bounds, from, to) {
    return this.pathCommand;
  }

  configureMarks() {
    super.configureMarks();

    this.distanceMark = new DistanceMark(this.parentEnvironment, this.previousTurtle, t => {
      return this.expressionAt('distance', this.parentEnvironment.root.state.t);
    }, distance => {
      this.state.distance = distance;
    });

    this.marker.addMarks([this.distanceMark], [], []);
  }

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);
    const to = [
      this.previousTurtle.position[0] + this.state.distance * Math.cos(this.turtle.heading * Math.PI / 180),
      this.previousTurtle.position[1] + this.state.distance * Math.sin(this.turtle.heading * Math.PI / 180)
    ];
    this.distanceMark.updateState(to, -this.turtle.heading, this.state.matrix);
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

  configureState(bounds) {
    this.configureScalarProperty('radius', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>circle</code> node whose <code>radius</code> was not set.');
      }

      try {
        timeline.assertScalar(this.parentEnvironment, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>radius</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('center', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>circle</code> node whose <code>center</code> was not set.');
      }

      try {
        timeline.assertList(this.parentEnvironment, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>center</code>. ${e.message}`);
      }
    });

    const centerTimeline = this.timedProperties.center;
    const radiusTimeline = this.timedProperties.radius;

    if (centerTimeline.isAnimated || radiusTimeline.isAnimated) {
      this.parentEnvironment.updateDoms.push(this.updateTurtle.bind(this));
    }

    if (centerTimeline.hasDefault && radiusTimeline.hasDefault) {
      this.updateTurtle(bounds);
    }
  }

  updateTurtle(bounds) {
    this.turtle.position[0] = this.state.center[0];
    this.turtle.position[1] = this.state.center[1];
    this.turtle.heading = this.previousTurtle?.heading ?? 0;
    this.parentEnvironment.state.turtle0 = this.turtle;
    this.pathCommand = `M ${this.state.center[0] + this.state.radius},${bounds.span - this.state.center[1]} A ${this.state.radius},${this.state.radius} 0 1 0 ${this.state.center[0] - this.state.radius},${bounds.span - this.state.center[1]} A ${this.state.radius},${this.state.radius} 0 1 0 ${this.state.center[0] + this.state.radius},${bounds.span - this.state.center[1]}`;
  }

  getPathCommand(bounds, from, to) {
    return this.pathCommand;
  }

  configureMarks() {
    super.configureMarks();

    this.centerMark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('center', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.state.center[0] = x;
      this.state.center[1] = y;
    });

    this.radiusMark = new HorizontalPanMark(this.parentEnvironment, null, 1, t => {
      return this.expressionAt('radius', this.parentEnvironment.root.state.t);
    }, newValue => {
      this.state.radius = newValue;
    });

    this.marker.addMarks([this.centerMark, this.radiusMark], []);
  }

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);
    this.centerMark.updateState(this.state.center, this.state.matrix);
    this.radiusMark.updateState([this.state.center[0] + this.state.radius, this.state.center[1]], this.state.matrix);
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

  configureState(bounds) {
    this.configureVectorProperty('size', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>rectangle</code> node whose <code>size</code> was not set.');
      }

      try {
        timeline.assertList(this.parentEnvironment, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>size</code>. ${e.message}`);
      }
    });

    if (this.timedProperties.hasOwnProperty('corner') && this.timedProperties.hasOwnProperty('center')) {
      throw new LocatedException(this.where, 'I found a <code>rectangle</code> node whose <code>corner</code> and <code>center</code> were both set. Define only one of these.');
    } else if (this.timedProperties.hasOwnProperty('corner')) {
      this.configureVectorProperty('corner', this, this.parentEnvironment, null, bounds, [], timeline => {
        try {
          timeline.assertList(this.parentEnvironment, 2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>corner</code>. ${e.message}`);
        }
      });
    } else if (this.timedProperties.hasOwnProperty('center')) {
      this.configureVectorProperty('center', this, this.parentEnvironment, null, bounds, [], timeline => {
        try {
          timeline.assertList(this.parentEnvironment, 2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>center</code>. ${e.message}`);
        }
      });
    } else {
      throw new LocatedException(this.where, "I found a <code>rectangle</code> node whose position I couldn't figure out. Define either its <code>corner</code> or <code>center</code>.");
    }

    const sizeTimeline = this.timedProperties.size;
    const positionTimeline = this.timedProperties.corner ?? this.timedProperties.center;

    if (sizeTimeline.isAnimated || positionTimeline.isAnimated) {
      this.parentEnvironment.updateDoms.push(this.updateTurtle.bind(this));
    }

    if (sizeTimeline.hasDefault && positionTimeline.hasDefault) {
      this.updateTurtle(bounds);
    }
  }

  updateTurtle(bounds) {
    let corner;
    if (this.state.center) {
      this.turtle.position[0] = this.state.center[0];
      this.turtle.position[1] = this.state.center[1];
      corner = [
        this.state.center[0] - this.state.size[0] * 0.5,
        this.state.center[1] - this.state.size[1] * 0.5
      ];
    } else {
      this.turtle.position[0] = this.state.corner[0];
      this.turtle.position[1] = this.state.corner[1];
      corner = this.state.corner;
    }
    this.turtle.heading = this.previousTurtle?.heading ?? 0;
    this.pathCommand = `
M ${corner[0]},${bounds.span - corner[1]}
L ${corner[0] + this.state.size[0]},${bounds.span - corner[1]}
L ${corner[0] + this.state.size[0]},${bounds.span - (corner[1] + this.state.size[1])}
L ${corner[0]},${bounds.span - (corner[1] + this.state.size[1])}
z
    `;
    this.parentEnvironment.state.turtle0 = this.turtle;
  }

  getPathCommand(bounds, from, to) {
    return this.pathCommand;
  }

  configureMarks() {
    super.configureMarks();

    let multiplier;
    let getPositionExpression;
    let updatePositionState;

    if (this.timedProperties.hasOwnProperty('center')) {
      getPositionExpression = t => this.expressionAt('center', this.root.state.t);
      updatePositionState = ([x, y]) => {
        this.state.center[0] = x;
        this.state.center[1] = y;
      };
      multiplier = 2;
    } else {
      getPositionExpression = t => this.expressionAt('corner', this.root.state.t);
      updatePositionState = ([x, y]) => {
        this.state.corner[0] = x;
        this.state.corner[1] = y;
      };
      multiplier = 1;
    }

    this.positionMark = new VectorPanMark(this.parentEnvironment, null, getPositionExpression, updatePositionState);

    this.widthMark = new HorizontalPanMark(this.parentEnvironment, this, multiplier, t => {
      return this.expressionAt('size', this.root.state.t).get(0);
    }, newValue => {
      this.state.size[0] = newValue;
    });

    this.heightMark = new VerticalPanMark(this.parentEnvironment, this, multiplier, t => {
      return this.expressionAt('size', this.root.state.t).get(1);
    }, newValue => {
      this.state.size[1] = newValue;
    });

    this.marker.addMarks([this.positionMark, this.widthMark, this.heightMark], []);
  }

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);
    if (this.state.center) {
      const corner = [this.state.center[0] - this.state.size[0] * 0.5, this.state.center[1] - this.state.size[1] * 0.5];
      this.positionMark.updateState(this.state.center, this.state.matrix);
      this.widthMark.updateState([this.state.center[0] + this.state.size[0] * 0.5, this.state.center[1]], this.state.matrix);
      this.heightMark.updateState([this.state.center[0], this.state.center[1] + this.state.size[1] * 0.5], this.state.matrix);
    } else {
      this.positionMark.updateState(this.state.corner, this.state.matrix);
      this.widthMark.updateState([this.state.corner[0] + this.state.size[0], this.state.corner[1]], this.state.matrix);
      this.heightMark.updateState([this.state.corner[0], this.state.corner[1] + this.state.size[1]], this.state.matrix);
    }
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

  initializeState(previousNode, firstNode) {
    super.initializeState(previousNode, firstNode);
    this.previousNode.nextNode = this;
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
    return new GapSegment(this.previousTurtle?.position, this.turtle.position);
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
    this.state.turtle.position[0] = this.firstNode.state.turtle.position[0];
    this.state.turtle.position[1] = this.firstNode.state.turtle.position[1];
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
    return [this.state.position];
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
    return new GapSegment(this.previousTurtle?.position, this.turtle.position);
  }

  get isDom() {
    return true;
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
    return new LineSegment(this.previousTurtle.position, this.turtle.position);
  }

  get isDom() {
    return true;
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
      return new QuadraticSegment(this.previousTurtle.position, this.turtle.position, this.state.control, false);
    } else {
      return new QuadraticSegment(this.previousTurtle.position, this.turtle.position, [
        this.previousTurtle.position[0] + (this.previousTurtle.position[0] - previousSegment.control[0]),
        this.previousTurtle.position[1] + (this.previousTurtle.position[1] - previousSegment.control[1])
      ], true);
    }
  }

  get isDom() {
    return true;
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
    this.state.turtle.position[0] = this.state.position[0];
    this.state.turtle.position[1] = this.state.position[1];
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
      return new CubicSegment(this.previousTurtle.position, this.turtle.position, this.state.control1, this.state.control2, false);
    } else {
      return new CubicSegment(this.previousTurtle.position, this.turtle.position, [
        this.previousTurtle.position[0] + (this.previousTurtle.position[0] - previousSegment.control2[0]),
        this.previousTurtle.position[1] + (this.previousTurtle.position[1] - previousSegment.control2[1])
      ], this.state.control2, true);
    }
  }

  get isDom() {
    return true;
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
    this.state.turtle.position[0] = this.state.position[0];
    this.state.turtle.position[1] = this.state.position[1];
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
    return new ArcSegment(this.previousTurtle.position, this.turtle.position, this.state.radius, this.state.isLarge, this.state.isClockwise);
  }

  get isDom() {
    return true;
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

  initializeState(previousNode, firstNode) {
    super.initializeState(previousNode, firstNode);
    this.state.isWedge = this.has('center');
    if (this.state.isWedge) {
      this.previousNode.nextNode = this;
    }
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

  embody(parentEnvironment, object) {
    super.embody(parentEnvironment, object);
    this.sourceSpans = object.sourceSpans.map(subobject => SourceLocation.inflate(subobject));
  }

  initializeMarkState() {
    this.marker = new Marker(this.parentFrame);
    this.parentFrame.addMarker(this.marker);
  }

  configureMarks() {
    this.pivotMark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('pivot', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.state.pivot[0] = x;
      this.state.pivot[1] = y;
    });

    this.axisMark = new AxisMark(this.parentEnvironment, null, t => {
      return this.expressionAt('axis', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.state.axis[0] = x;
      this.state.axis[1] = y;
    });

    this.lineMark = new RayMark();

    this.marker.addMarks([this.pivotMark, this.axisMark], [this.lineMark]);
  }

  updateInteractionState(matrix) {
    this.state.matrix = matrix;
    this.pivotMark.updateState(this.state.pivot, matrix);
    this.axisMark.updateState(this.state.axis, this.state.pivot, matrix);
    this.lineMark.updateState(this.state.axis, this.state.pivot, matrix);
  }

  castCursor(column, row) {
    const isHit = this.sourceSpans.some(span => span.contains(column, row));
    if (isHit) {
      this.parentEnvironment.root.select(this.parentEnvironment);
      this.parentEnvironment.selectMarker(this.marker.id);
    }
    return isHit;
  }
}

// --------------------------------------------------------------------------- 

