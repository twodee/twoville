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
  AxisMark,
  BumpDegreesMark,
  BumpPositionMark,
  CircleMark,
  DistanceMark,
  LineMark,
  Marker,
  PathMark,
  RotationMark,
  VectorPanMark,
  WedgeDegreesMark,
} from './mark.js';

import {
  TimelinedEnvironment,
} from './environment.js';

import {
  Matrix,
} from './transform.js';

// --------------------------------------------------------------------------- 

export class Node extends TimelinedEnvironment {
  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    parentEnvironment.addNode(this);
    this.sourceSpans = [];
  }

  toPod() {
    const pod = super.toPod();
    pod.sourceSpans = this.sourceSpans;
    return pod;
  }

  embody(parentEnvironment, pod) {
    super.embody(parentEnvironment, pod);
    this.sourceSpans = pod.sourceSpans.map(subpod => SourceLocation.reify(subpod));
  }

  // start() {
    // this.marker = new Marker(this.parentEnvironment);
    // this.parentEnvironment.addMarker(this.marker);
  // }

  castCursor(column, row) {
    const isHit = this.sourceSpans.some(span => span.contains(column, row));
    if (isHit) {
      this.parentEnvironment.root.select(this.parentEnvironment);
      this.parentEnvironment.selectMarker(this.marker.id);
    }
    return isHit;
  }

  configure(previousTurtle, bounds) {
    this.previousTurtle = previousTurtle;
    this.turtle = new Turtle([0, 0], 0);
    this.configureState(bounds);
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

  static reify(parentEnvironment, pod) {
    const node = new VertexNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  get isDom() {
    return true;
  }

  configureState(bounds) {
    this.configureVectorProperty('position', this, this.parentEnvironment, this.updateTurtle.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>vertex</code> whose <code>position</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>vertex</code> with an illegal value for <code>position</code>. ${e.message}`);
      }
    });
  }

  updateTurtle(bounds) {
    this.turtle.position[0] = this.position[0];
    this.turtle.position[1] = this.position[1];
    this.turtle.heading = 0;
  }

  // validate() {
    // this.assertProperty('position');
  // }

  // start() {
    // super.start();
    // this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    // this.marker.addMarks([this.positionMark], []);
  // }

  // updateProperties(env, t, bounds, fromTurtle, matrix) {
    // const position = this.valueAt(env, 'position', t);
    // this.positionMark.setExpression(position);
    
    // if (position) {
      // this.positionMark.updateProperties(position, bounds, matrix);
      // return {
        // pathCommand: null,
        // turtle: new Turtle(position, fromTurtle.heading),
      // };
    // } else {
      // return null;
    // }
  // }
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

  static reify(parentEnvironment, pod) {
    const node = new TurtleNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  get isDom() {
    return true;
  }

  configureState(bounds) {
    this.configureVectorProperty('position', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>turtle</code> whose <code>position</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>turtle</code> with an illegal value for <code>position</code>. ${e.message}`);
      }
    });

    this.configureScalarProperty('heading', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>turtle</code> whose <code>heading</code> was not set.');
      }

      try {
        timeline.assertScalar(ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>turtle</code> with an illegal value for <code>heading</code>. ${e.message}`);
      }
    });

    const positionTimeline = this.timedProperties.position;
    const headingTimeline = this.timedProperties.heading;

    if (positionTimeline.isAnimated || headingTimeline.isAnimated) {
      this.parentEnvironment.updateDoms.push(this.updateTurtle.bind(this));
    }

    if (positionTimeline.hasDefault && headingTimeline.hasDefault) {
      this.updateTurtle(bounds);
    }
  }

  updateTurtle(bounds) {
    this.turtle.position[0] = this.position[0];
    this.turtle.position[1] = this.position[1];
    this.turtle.heading = this.heading;
  }

  // validate() {
    // this.assertProperty('position');
    // this.assertProperty('heading');
  // }

  // start() {
    // super.start();
    // this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    // this.headingMark = new RotationMark(this.parentEnvironment, this);
    // this.wedgeMark = new PathMark();
    // this.marker.addMarks([this.positionMark, this.headingMark], [this.wedgeMark]);
  // }

  // updateProperties(env, t, bounds, fromTurtle, matrix) {
    // const position = this.valueAt(env, 'position', t);
    // this.positionMark.setExpression(position);

    // const heading = this.valueAt(env, 'heading', t);
    // this.headingMark.setExpression(heading, new ExpressionReal(0), position);
    
    // if (position) {
      // const pivot = position;
      // const pivotToOrigin = Matrix.translate(-pivot.get(0).value, -pivot.get(1).value);
      // const rotater = Matrix.rotate(heading.value);
      // const originToPivot = Matrix.translate(pivot.get(0).value, pivot.get(1).value);
      // const composite = originToPivot.multiplyMatrix(rotater.multiplyMatrix(pivotToOrigin));
      // const applied = matrix.multiplyMatrix(composite);

      // this.positionMark.updateProperties(position, bounds, applied);

      // const offset = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]);
      // const towardVector = offset.rotate(heading.value);
      // const towardPosition = towardVector.add(position);
      // this.headingMark.updateProperties(towardPosition, bounds, matrix);

      // const extension = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]).add(pivot);

      // const {isLarge, isClockwise} = classifyArc(standardizeDegrees(heading.value));
      // const commands = [
        // `M${pivot.get(0).value},${bounds.span - pivot.get(1).value}`,
        // `L${extension.get(0).value},${bounds.span - extension.get(1).value}`,
        // `A 2,2 0 ${isLarge} ${isClockwise} ${towardPosition.get(0).value},${bounds.span - towardPosition.get(1).value}`,
      // ];

      // this.wedgeMark.updateProperties(commands.join(' '));

      // return {
        // pathCommand: `M${position.get(0).value},${bounds.span - position.get(1).value}`,
        // turtle: new Turtle(position, heading),
        // segment: new GapSegment(fromTurtle?.position, position),
      // };
    // } else {
      // return null;
    // }
  // }
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

  static reify(parentEnvironment, pod) {
    const node = new MoveNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  get isDom() {
    return true;
  }

  // validate() {
    // this.assertProperty('distance');
  // }

  // start() {
    // super.start();
    // this.distanceMark = new DistanceMark(this.parentEnvironment, this);
    // this.marker.addMarks([this.distanceMark], []);
  // }

  // updateProperties(env, t, bounds, fromTurtle, matrix) {
    // const distance = this.valueAt(env, 'distance', t);
    // this.distanceMark.setExpression(distance, fromTurtle.position, fromTurtle.heading);
    
    // if (distance) {
      // let delta = new ExpressionVector([distance, fromTurtle.heading]).toCartesian();
      // let position = fromTurtle.position.add(delta);

      // const pivot = position;
      // const pivotToOrigin = Matrix.translate(-pivot.get(0).value, -pivot.get(1).value);
      // const rotater = Matrix.rotate(fromTurtle.heading.value);
      // const originToPivot = Matrix.translate(pivot.get(0).value, pivot.get(1).value);
      // const composite = originToPivot.multiplyMatrix(rotater.multiplyMatrix(pivotToOrigin));
      // const applied = matrix.multiplyMatrix(composite);

      // this.distanceMark.updateProperties(position, bounds, applied);

      // return {
        // pathCommand: `L${position.get(0).value},${bounds.span - position.get(1).value}`,
        // turtle: new Turtle(position, fromTurtle.heading),
        // segment: new LineSegment(fromTurtle.position, position),
      // };
    // } else {
      // return null;
    // }
  // }

  configureState(bounds) {
    this.configureScalarProperty('distance', this, this.parentEnvironment, this.updateTurtle.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>move</code> node whose <code>distance</code> was not set.');
      }

      try {
        timeline.assertScalar(ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>move</code> node with an illegal value for <code>distance</code>. ${e.message}`);
      }
    });
  }

  updateTurtle(bounds) {
    this.turtle.position[0] = this.previousTurtle.position[0] + this.distance * Math.cos(this.previousTurtle.heading * Math.PI / 180);
    this.turtle.position[1] = this.previousTurtle.position[1] + this.distance * Math.sin(this.previousTurtle.heading * Math.PI / 180);
    this.turtle.heading = this.previousTurtle.heading;
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

  static reify(parentEnvironment, pod) {
    const node = new TurnNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  get isDom() {
    return false;
  }

  // validate() {
    // this.assertProperty('degrees');
  // }

  // start() {
    // super.start();
    // this.rotationMark = new RotationMark(this.parentEnvironment, this);
    // this.wedgeMark = new PathMark();
    // this.marker.addMarks([this.rotationMark], [this.wedgeMark]);
  // }

  // updateProperties(env, t, bounds, fromTurtle, matrix) {
    // const degrees = this.valueAt(env, 'degrees', t);
    // this.rotationMark.setExpression(degrees, fromTurtle.heading, fromTurtle.position);
    
    // if (degrees) {
      // let newHeading = standardizeDegrees(fromTurtle.heading.add(degrees).value);
      // let towardPosition = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]).rotate(newHeading).add(fromTurtle.position);
      // this.rotationMark.updateProperties(towardPosition, bounds, matrix);

      // const pivot = fromTurtle.position;
      // const extension = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]).rotate(fromTurtle.heading.value).add(pivot);

      // const {isLarge, isClockwise} = classifyArc(standardizeDegrees(degrees.value));
      // const commands = [
        // `M${pivot.get(0).value},${bounds.span - pivot.get(1).value}`,
        // `L${extension.get(0).value},${bounds.span - extension.get(1).value}`,
        // `A 2,2 0 ${isLarge} ${isClockwise} ${towardPosition.get(0).value},${bounds.span - towardPosition.get(1).value}`,
      // ];

      // this.wedgeMark.updateProperties(commands.join(' '));

      // return {
        // pathCommand: null,
        // turtle: new Turtle(fromTurtle.position, new ExpressionReal(newHeading)),
        // segment: undefined,
        // isVirtualMove: true,
      // };
    // } else {
      // return null;
    // }
  // }

  configureState(bounds) {
    this.configureScalarProperty('degrees', this, this.parentEnvironment, this.updateTurtle.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>turn</code> node whose <code>degrees</code> was not set.');
      }

      try {
        timeline.assertScalar(ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>turn</code> node with an illegal value for <code>degrees</code>. ${e.message}`);
      }
    });
  }

  updateTurtle(bounds) {
    this.turtle.position[0] = this.previousTurtle.position[0];
    this.turtle.position[1] = this.previousTurtle.position[1];
    this.turtle.heading = this.previousTurtle.heading + this.degrees;
  }
}

// --------------------------------------------------------------------------- 

export class JumpNode extends Node {
  static type = 'jump';
  static article = 'a';
  static timedIds = ['position'];

  static create(parentEnvironment, where) {
    const node = new JumpNode();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new JumpNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  get isDom() {
    return true;
  }

  // validate() {
    // this.assertProperty('position');
  // }

  // start() {
    // super.start();
    // this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    // this.marker.addMarks([this.positionMark], []);
  // }

  // updateProperties(env, t, bounds, fromTurtle, matrix) {
    // const position = this.valueAt(env, 'position', t);
    // this.positionMark.setExpression(position);

    // let absolutePosition;
    // let isDelta = this.owns('delta') && this.get('delta').value;
    // if (isDelta) {
      // absolutePosition = fromTurtle.position.add(position);
    // } else {
      // absolutePosition = position;
    // }
    
    // if (position) {
      // this.positionMark.updateProperties(absolutePosition, bounds, matrix);

      // let pathCommand;
      // if (isDelta) {
        // pathCommand = `m ${position.get(0).value},${-position.get(1).value}`;
      // } else {
        // pathCommand = `M ${position.get(0).value},${bounds.span - position.get(1).value}`;
      // }

      // return {
        // pathCommand,
        // turtle: new Turtle(absolutePosition, fromTurtle.heading),
        // segment: new GapSegment(fromTurtle?.position, absolutePosition),
      // };
    // } else {
      // return null;
    // }
  // }

  configureState(bounds) {
    this.configureVectorProperty('position', this, this.parentEnvironment, this.updateTurtle.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>jump</code> node whose <code>position</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>jump</code> node with an illegal value for <code>position</code>. ${e.message}`);
      }
    });
  }

  updateTurtle(bounds) {
    this.turtle.position[0] = this.position[0];
    this.turtle.position[1] = this.position[1];
    this.turtle.heading = 0;
    this.pathCommand = `M ${this.position[0]},${bounds.span - this.position[1]}`;
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

  static reify(parentEnvironment, pod) {
    const node = new LineNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  get isDom() {
    return true;
  }

  // validate() {
    // this.assertProperty('position');
  // }

  // start() {
    // super.start();
    // this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    // this.marker.addMarks([this.positionMark], []);
  // }

  // updateProperties(env, t, bounds, fromTurtle, matrix) {
    // const position = this.valueAt(env, 'position', t);
    // this.positionMark.setExpression(position);

    // let absolutePosition;
    // let isDelta = this.owns('delta') && this.get('delta').value;
    // if (isDelta) {
      // absolutePosition = fromTurtle.position.add(position);
    // } else {
      // absolutePosition = position;
    // }
    
    // if (position) {
      // this.positionMark.updateProperties(absolutePosition, bounds, matrix);

      // let pathCommand;
      // if (isDelta) {
        // pathCommand = `l ${position.get(0).value},${-position.get(1).value}`;
      // } else {
        // pathCommand = `L ${position.get(0).value},${bounds.span - position.get(1).value}`;
      // }

      // return {
        // pathCommand,
        // turtle: new Turtle(absolutePosition, fromTurtle.heading),
        // segment: new LineSegment(fromTurtle.position, absolutePosition),
      // };
    // } else {
      // return null;
    // }
  // }

  configureState(bounds) {
    this.configureVectorProperty('position', this, this.parentEnvironment, this.updateTurtle.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>line</code> node whose <code>position</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>line</code> node with an illegal value for <code>position</code>. ${e.message}`);
      }
    });
  }

  updateTurtle(bounds) {
    this.turtle.position[0] = this.position[0];
    this.turtle.position[1] = this.position[1];
    this.turtle.heading = this.previousTurtle.heading;
    this.pathCommand = `L ${this.position[0]},${bounds.span - this.position[1]}`;
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

  static reify(parentEnvironment, pod) {
    const node = new QuadraticNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  get isDom() {
    return true;
  }

  // validate() {
    // this.assertProperty('position');
  // }

  // start() {
    // super.start();
    // this.lineMarks = [
      // new LineMark(),
      // new LineMark(),
    // ];
    // this.positionMark = new VectorPanMark(this.parentEnvironment, this);

    // const foregroundMarks = [this.positionMark];
    // if (this.owns('control')) {
      // this.controlMark = new VectorPanMark(this.parentEnvironment, this);
      // foregroundMarks.push(this.controlMark);
    // }

    // this.marker.addMarks(foregroundMarks, this.lineMarks);
  // }

  // updateProperties(env, t, bounds, fromTurtle, matrix, fromSegment) {
    // const position = this.valueAt(env, 'position', t);
    // this.positionMark.setExpression(position);

    // let control;
    // if (this.owns('control')) {
      // control = this.valueAt(env, 'control', t);
      // this.controlMark.setExpression(control);
    // }

    // let isDelta = this.owns('delta') && this.get('delta').value;

    // let absolutePosition;
    // if (isDelta) {
      // absolutePosition = fromTurtle.position.add(position);
    // } else {
      // absolutePosition = position;
    // }

    // let absoluteControl;
    // if (control) {
      // if (isDelta) {
        // absoluteControl = fromTurtle.position.add(control);
      // } else {
        // absoluteControl = control;
      // }
    // }
    
    // if (position) {
      // this.positionMark.updateProperties(absolutePosition, bounds, matrix);

      // let pathCommand;
      // if (control) {
        // this.controlMark.updateProperties(absoluteControl, bounds, matrix);
        // this.lineMarks[0].updateProperties(fromTurtle.position, absoluteControl, bounds, matrix);
        // this.lineMarks[1].updateProperties(absoluteControl, absolutePosition, bounds, matrix);
        // if (isDelta) {
          // pathCommand = `q ${control.get(0).value},${-control.get(1).value} ${position.get(0).value},${-position.get(1).value}`;
        // } else {
          // pathCommand = `Q ${control.get(0).value},${bounds.span - control.get(1).value} ${position.get(0).value},${bounds.span - position.get(1).value}`;
        // }
      // } else {
        // if (isDelta) {
          // pathCommand = `t ${position.get(0).value},${-position.get(1).value}`;
        // } else {
          // pathCommand = `T ${position.get(0).value},${bounds.span - position.get(1).value}`;
        // }
      // }

      // return {
        // pathCommand,
        // turtle: new Turtle(position, fromTurtle.heading),
        // segment: (
          // control
            // ? new QuadraticSegment(fromTurtle.position, position, control, false)
            // : new QuadraticSegment(fromTurtle.position, position, fromTurtle.position.add(fromTurtle.position.subtract(fromSegment.control)), true)
        // ),
      // };
    // } else {
      // return null;
    // }
  // }

  configureState(bounds) {
    this.configureVectorProperty('position', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>quadratic</code> node whose <code>position</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>quadratic</code> node with an illegal value for <code>position</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('control', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (timeline) {
        try {
          timeline.assertList(2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found a <code>quadratic</code> node with an illegal value for <code>control</code>. ${e.message}`);
        }
      } else if (!this.previousTurtle) { // TODO only allow implicit after previous quadratic
        throw new LocatedException(this.where, 'I found a <code>quadratic</code> node whose <code>control</code> was not set. Omitting <code>control</code> is legal only when the previous node was also <code>quadratic</code>.');
      }
    });

    const positionTimeline = this.timedProperties.position;
    const controlTimeline = this.timedProperties.control;

    if (positionTimeline.isAnimated || controlTimeline?.isAnimated) {
      this.parentEnvironment.updateDoms.push(this.updateTurtle.bind(this));
    }

    if (positionTimeline.hasDefault && (!controlTimeline || controlTimeline.hasDefault)) {
      this.updateTurtle(bounds);
    }
  }

  updateTurtle(bounds) {
    this.turtle.position[0] = this.position[0];
    this.turtle.position[1] = this.position[1];
    this.turtle.heading = this.previousTurtle.heading;
    if (this.control) {
      this.pathCommand = `Q ${this.control[0]},${bounds.span - this.control[1]} ${this.position[0]},${bounds.span - this.position[1]}`;
    } else {
      this.pathCommand = `T ${this.position[0]},${bounds.span - this.position[1]}`;
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

  static reify(parentEnvironment, pod) {
    const node = new ArcNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  get isDom() {
    return true;
  }

  // validate() {
    // if (this.owns('position') && this.owns('center')) {
      // throw new LocatedException(this.where, 'I found an arc whose position and center properties are both set. Define only one of these.');
    // }

    // if (!this.owns('position') && !this.owns('center')) {
      // throw new LocatedException(this.where, 'I found an arc whose curvature I couldn\'t figure out. Please define its center or position.');
    // }

    // this.assertProperty('degrees');
  // }

  // start() {
    // super.start();

    // this.isWedge = this.owns('center');
    // if (this.isWedge) {
      // this.centerMark = new VectorPanMark(this.parentEnvironment, this);
      // this.positionMark = new WedgeDegreesMark(this.parentEnvironment, this);
    // } else {
      // this.centerMark = new BumpDegreesMark(this.parentEnvironment, this);
      // this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    // }

    // this.lineMarks = [
      // new LineMark(),
      // new LineMark(),
    // ];

    // this.marker.addMarks([this.centerMark, this.positionMark], this.lineMarks);
  // }

  // updateProperties(env, t, bounds, fromTurtle, matrix) {
    // let degrees = this.valueAt(env, 'degrees', t);
    // let radians = degrees.value * Math.PI / 180;

    // let absolutePosition;
    // let isDelta = this.owns('delta') && this.get('delta').value;

    // let center;
    // let absoluteCenter;
    // if (this.isWedge) {
      // center = this.valueAt(env, 'center', t);

      // if (isDelta) {
        // absoluteCenter = fromTurtle.position.add(center);
      // } else {
        // absoluteCenter = center;
      // }

      // this.centerMark.setExpression(center);
      // this.positionMark.setExpression(degrees, fromTurtle.position, absoluteCenter);
    // } else {
      // let position = this.valueAt(env, 'position', t);

      // let absolutePosition;
      // if (isDelta) {
        // absolutePosition = fromTurtle.position.add(position);
      // } else {
        // absolutePosition = position;
      // }

      // this.positionMark.setExpression(position);
      // this.positionMark.updateProperties(absolutePosition, bounds, matrix);

      // let diff = absolutePosition.subtract(fromTurtle.position);
      // let distance = (0.5 * diff.magnitude) / Math.tan(radians * 0.5);
      // let halfway = fromTurtle.position.add(absolutePosition).multiply(new ExpressionReal(0.5));
      // let normal = diff.rotate90().normalize();
      // absoluteCenter = halfway.add(normal.multiply(new ExpressionReal(-distance)));

      // const movementAngle = Math.atan2(normal.get(1).value, normal.get(0).value) * 180 / Math.PI;
      // const pivotToOrigin = Matrix.translate(-absoluteCenter.get(0).value, -absoluteCenter.get(1).value);
      // const rotater = Matrix.rotate(movementAngle);
      // const originToPivot = Matrix.translate(absoluteCenter.get(0).value, absoluteCenter.get(1).value);
      // const composite = originToPivot.multiplyMatrix(rotater.multiplyMatrix(pivotToOrigin));
      // const applied = matrix.multiplyMatrix(composite);

      // this.centerMark.updateProperties(absoluteCenter, bounds, applied);
    // }

    // let toFrom = fromTurtle.position.subtract(absoluteCenter);
    // let toTo = new ExpressionVector([
      // new ExpressionReal(toFrom.get(0).value * Math.cos(radians) - toFrom.get(1).value * Math.sin(radians)),
      // new ExpressionReal(toFrom.get(0).value * Math.sin(radians) + toFrom.get(1).value * Math.cos(radians)),
    // ]);
    // let to = absoluteCenter.add(toTo);

    // let radius = toFrom.magnitude;
    // let isLarge;
    // let isClockwise;

    // if (degrees.value >= 0) {
      // isLarge = degrees.value >= 180 ? 1 : 0;
      // isClockwise = 0;
    // } else {
      // isLarge = degrees.value <= -180 ? 1 : 0;
      // isClockwise = 1;
    // }

    // let pathCommand;
    // if (isDelta) {
      // pathCommand = `a ${radius},${radius} 0 ${isLarge} ${isClockwise} ${to.get(0).value - fromTurtle.position.get(0).value},${-(to.get(1).value - fromTurtle.position.get(1).value)}`;
    // } else {
      // pathCommand = `A ${radius},${radius} 0 ${isLarge} ${isClockwise} ${to.get(0).value},${bounds.span - to.get(1).value}`;
    // }

    // if (this.isWedge) {
      // this.centerMark.updateProperties(absoluteCenter, bounds, matrix);
      // this.positionMark.updateProperties(to, bounds, matrix);
    // } else {
      // this.centerMark.setExpression(degrees, fromTurtle.position, absoluteCenter, to);
    // }

    // this.lineMarks[0].updateProperties(absoluteCenter, fromTurtle.position, bounds, matrix);
    // this.lineMarks[1].updateProperties(absoluteCenter, to, bounds, matrix);

    // TODO is Turtle.position = to always the right thing here?
    // return {
      // pathCommand,
      // turtle: new Turtle(to, fromTurtle.heading),
      // segment: new ArcSegment(fromTurtle.position, to, radius, isLarge, isClockwise),
    // };
  // }

  configureState(bounds) {
    this.configureVectorProperty('degrees', this, this.parentEnvironment, this.updateTurtle.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found an <code>arc</code> node whose <code>degrees</code> was not set.');
      }

      try {
        timeline.assertScalar(ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an <code>arc</code> node with an illegal value for <code>degrees</code>. ${e.message}`);
      }
    });

    if (this.timedProperties.hasOwnProperty('position') && this.timedProperties.hasOwnProperty('center')) {
      throw new LocatedException(this.where, 'I found an <code>arc</code> node whose <code>position</code> and <code>center</code> were both set. Define only one of these.');
    } else if (this.timedProperties.hasOwnProperty('position')) {
      this.configureVectorProperty('position', this, this.parentEnvironment, this.updateTurtle.bind(this), bounds, [], timeline => {
        try {
          timeline.assertList(2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>position</code>. ${e.message}`);
        }
      });
    } else if (this.timedProperties.hasOwnProperty('center')) {
      this.configureVectorProperty('center', this, this.parentEnvironment, this.updateTurtle.bind(this), bounds, [], timeline => {
        try {
          timeline.assertList(2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>center</code>. ${e.message}`);
        }
      });
    } else {
      throw new LocatedException(this.where, "I found an <code>arc</code> node whose position I couldn't figure out. Define either its <code>position</code> or <code>center</code>.");
    }
  }

  updateTurtle(bounds) {
    this.turtle.position[0] = this.position[0];
    this.turtle.position[1] = this.position[1];
    this.turtle.heading = this.previousTurtle.heading;
    this.pathCommand = `A ${this.radius},${this.radius} 0 ${this.isLarge} ${this.isClockwise} ${this.position[0]},${bounds.span - this.position[1]}`;
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

  static reify(parentEnvironment, pod) {
    const node = new CubicNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  get isDom() {
    return true;
  }

  // validate() {
    // this.assertProperty('position');
    // this.assertProperty('control2');
  // }

  // start() {
    // super.start();

    // this.line2Mark = new LineMark();
    // this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    // this.control2Mark = new VectorPanMark(this.parentEnvironment, this);

    // const foregroundMarks = [this.positionMark, this.control2Mark];
    // const backgroundMarks = [this.line2Mark];

    // if (this.owns('control1')) {
      // this.line1Mark = new LineMark();
      // this.control1Mark = new VectorPanMark(this.parentEnvironment, this);
      // foregroundMarks.push(this.control1Mark);
      // backgroundMarks.push(this.line1Mark);
    // }

    // this.marker.addMarks(foregroundMarks, backgroundMarks);
  // }

  // updateProperties(env, t, bounds, fromTurtle, matrix, fromSegment) {
    // const position = this.valueAt(env, 'position', t);
    // this.positionMark.setExpression(position);

    // let isDelta = this.owns('delta') && this.get('delta').value;

    // let absolutePosition;
    // if (isDelta) {
      // absolutePosition = fromTurtle.position.add(position);
    // } else {
      // absolutePosition = position;
    // }

    // let control1;
    // let absoluteControl1;
    // if (this.owns('control1')) {
      // control1 = this.valueAt(env, 'control1', t);
      // this.control1Mark.setExpression(control1);
      // if (isDelta) {
        // absoluteControl1 = fromTurtle.position.add(control1);
      // } else {
        // absoluteControl1 = control1;
      // }
    // }

    // let control2 = this.valueAt(env, 'control2', t);
    // this.control2Mark.setExpression(control2);

    // let absoluteControl2;
    // if (isDelta) {
      // absoluteControl2 = fromTurtle.position.add(control2);
    // } else {
      // absoluteControl2 = control2;
    // }
    
    // if (position && control2) {
      // this.positionMark.updateProperties(absolutePosition, bounds, matrix);
      // this.control2Mark.updateProperties(absoluteControl2, bounds, matrix);
      // this.line2Mark.updateProperties(absoluteControl2, absolutePosition, bounds, matrix);

      // let pathCommand;
      // if (control1) {
        // this.control1Mark.updateProperties(absoluteControl1, bounds, matrix);
        // this.line1Mark.updateProperties(fromTurtle.position, absoluteControl1, bounds, matrix);
        // if (isDelta) {
          // pathCommand = `c ${control1.get(0).value},${-control1.get(1).value} ${control2.get(0).value},${-control2.get(1).value} ${position.get(0).value},${-position.get(1).value}`;
        // } else {
          // pathCommand = `C ${control1.get(0).value},${bounds.span - control1.get(1).value} ${control2.get(0).value},${bounds.span - control2.get(1).value} ${position.get(0).value},${bounds.span - position.get(1).value}`;
        // }
      // } else {
        // if (isDelta) {
          // pathCommand = `s ${control2.get(0).value},${-control2.get(1).value} ${position.get(0).value},${-position.get(1).value}`;
        // } else {
          // pathCommand = `S ${control2.get(0).value},${bounds.span - control2.get(1).value} ${position.get(0).value},${bounds.span - position.get(1).value}`;
        // }
      // }

      // return {
        // pathCommand,
        // turtle: new Turtle(position, fromTurtle.heading),
        // segment: (
          // control1
            // ? new CubicSegment(fromTurtle.position, position, control1, control2, false)
            // : new CubicSegment(fromTurtle.position, position, fromTurtle.position.add(fromTurtle.position.subtract(fromSegment.control2)), control2, true)
        // ),
      // };
    // } else {
      // return null;
    // }
  // }

  configureState(bounds) {
    this.configureVectorProperty('position', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>cubic</code> node whose <code>position</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>cubic</code> node with an illegal value for <code>position</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('control1', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (timeline) {
        try {
          timeline.assertList(2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found a <code>cubic</code> node with an illegal value for <code>control1</code>. ${e.message}`);
        }
      } else if (!this.previousTurtle) { // TODO only allow implicit after previous quadratic
        throw new LocatedException(this.where, 'I found a <code>cubic</code> node whose <code>control1</code> was not set. Omitting <code>control1</code> is legal only when the previous node was also <code>cubic</code>.');
      }
    });

    this.configureVectorProperty('control2', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>cubic</code> node whose <code>control2</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>cubic</code> node with an illegal value for <code>control2</code>. ${e.message}`);
      }
    });

    const positionTimeline = this.timedProperties.position;
    const control1Timeline = this.timedProperties.control1;
    const control2Timeline = this.timedProperties.control2;

    if (positionTimeline.isAnimated || control1Timeline?.isAnimated || control2Timeline.isAnimated) {
      this.parentEnvironment.updateDoms.push(this.updateTurtle.bind(this));
    }

    if (positionTimeline.hasDefault && (!control1Timeline || control1Timeline.hasDefault) && control2Timeline.hasDefault) {
      this.updateTurtle(bounds);
    }
  }

  updateTurtle(bounds) {
    this.turtle.position[0] = this.position[0];
    this.turtle.position[1] = this.position[1];
    this.turtle.heading = this.previousTurtle.heading;
    if (this.control1) {
      this.pathCommand = `C ${this.control1[0]},${bounds.span - this.control1[1]} ${this.control2[0]},${bounds.span - this.control2[1]} ${this.position[0]},${bounds.span - this.position[1]}`;
    } else {
      this.pathCommand = `S ${this.control2[0]},${bounds.span - this.control2[1]} ${this.position[0]},${bounds.span - this.position[1]}`;
    }
  }
}

// --------------------------------------------------------------------------- 

class GapSegment {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  mirror(position, axis) {
    return new GapSegment(this.to.mirror(position, axis), this.from.mirror(position, axis));
  }

  toCommandString(env, bounds) {
    return `M ${this.to.get(0).value},${bounds.span - this.to.get(1).value}`;
  }
}

// --------------------------------------------------------------------------- 

export class LineSegment {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  mirror(position, axis) {
    return new LineSegment(this.to.mirror(position, axis), this.from.mirror(position, axis));
  }

  mirrorBridge(position, axis) {
    return new LineSegment(this.to, this.to.mirror(position, axis));
  }

  toCommandString(env, bounds) {
    return `L ${this.to.get(0).value},${bounds.span - this.to.get(1).value}`;
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

  mirror(position, axis) {
    return new QuadraticSegment(this.to.mirror(position, axis), this.from.mirror(position, axis), this.control.mirror(position, axis));
  }

  mirrorBridge(position, axis) {
    const diff = this.control.subtract(this.to);
    const opposite = this.to.subtract(diff);
    return new CubicSegment(this.to, this.to.mirror(position, axis), opposite, opposite.mirror(position, axis), false);
  }

  toCommandString(env, bounds) {
    if (this.isImplicit) {
      return `T ${this.to.get(0).value},${bounds.span - this.to.get(1).value}`;
    } else {
      return `Q ${this.control.get(0).value},${bounds.span - this.control.get(1).value} ${this.to.get(0).value},${bounds.span - this.to.get(1).value}`;
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

  mirror(position, axis, allowImplicit = true) {
    return new CubicSegment(this.to.mirror(position, axis), this.from.mirror(position, axis), this.control2.mirror(position, axis), this.control1.mirror(position, axis), allowImplicit && this.isImplicit);
  }

  mirrorBridge(position, axis) {
    const diff = this.control2.subtract(this.to);
    const opposite = this.to.subtract(diff);
    return new CubicSegment(this.to, this.to.mirror(position, axis), opposite, opposite.mirror(position, axis), true);
  }

  toCommandString(env, bounds) {
    if (this.isImplicit) {
      return `S ${this.control2.get(0).value},${bounds.span - this.control2.get(1).value} ${this.to.get(0).value},${bounds.span - this.to.get(1).value}`;
    } else {
      return `C ${this.control1.get(0).value},${bounds.span - this.control1.get(1).value} ${this.control2.get(0).value},${bounds.span - this.control2.get(1).value} ${this.to.get(0).value},${bounds.span - this.to.get(1).value}`;
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

  mirror(position, axis) {
    return new ArcSegment(this.to.mirror(position, axis), this.from.mirror(position, axis), this.radius, this.isLarge, this.isClockwise);
  }

  mirrorBridge(position, axis) {
    return new LineSegment(this.to, this.to.mirror(position, axis));
  }

  toCommandString(env, bounds) {
    return `A${this.radius},${this.radius} 0 ${this.isLarge} ${this.isClockwise} ${this.to.get(0).value},${bounds.span - this.to.get(1).value}`;
  }
}

// --------------------------------------------------------------------------- 

export class Mirror extends TimelinedEnvironment {
  static type = 'mirror';
  static article = 'a';
  static timedIds = ['position', 'axis'];

  static create(parentEnvironment, where) {
    const mirror = new Mirror();
    mirror.initialize(parentEnvironment, where);
    return mirror;
  }

  static reify(parentEnvironment, pod) {
    const mirror = new Mirror();
    mirror.embody(parentEnvironment, pod);
    return mirror;
  }

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    parentEnvironment.addMirror(this);
    this.sourceSpans = [];
  }

  toPod() {
    const pod = super.toPod();
    pod.sourceSpans = this.sourceSpans;
    return pod;
  }

  embody(parentEnvironment, pod) {
    super.embody(parentEnvironment, pod);
    this.sourceSpans = pod.sourceSpans.map(subpod => SourceLocation.reify(subpod));
  }

  start() {
    this.marker = new Marker(this.parentEnvironment);
    this.parentEnvironment.addMarker(this.marker);

    this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    this.lineMark = new LineMark();
    this.axisMark = new AxisMark(this.parentEnvironment, this);
    this.marker.addMarks([this.positionMark, this.axisMark], [this.lineMark]);
  }

  validate() {
    this.assertProperty('position');
    this.assertProperty('axis');
  }

  updateProperties(env, t, bounds, matrix) {
    const position = this.valueAt(env, 'position', t);
    const axis = this.valueAt(env, 'axis', t);
    this.positionMark.setExpression(position);
    this.axisMark.setExpression(axis, position);
    this.positionMark.updateProperties(position, bounds, matrix);
    this.axisMark.updateProperties(position.add(axis), bounds, matrix);
    this.lineMark.updateProperties(position, position.add(axis), bounds, matrix);
    return {position, axis};
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

