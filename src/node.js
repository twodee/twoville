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
    this.state = {};
    this.configureState(bounds);
  }

  configureMarks() {
    this.marker = new Marker(this.parentEnvironment);
    this.parentEnvironment.addMarker(this.marker);
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
    this.turtle.position[0] = this.state.position[0];
    this.turtle.position[1] = this.state.position[1];
    this.turtle.heading = 0;
  }

  configureMarks() {
    super.configureMarks();
    this.positionMark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('position', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.turtle.position[0] = this.state.position[0] = x;
      this.turtle.position[1] = this.state.position[1] = y;
    });
    this.marker.addMarks([this.positionMark], [], []);
  }

  updateMarkerDom(bounds, factor, matrix) {
    this.positionMark.updateDom(bounds, this.state.position, factor, matrix);
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
    this.turtle.position[0] = this.state.position[0];
    this.turtle.position[1] = this.state.position[1];
    this.turtle.heading = this.state.heading;
    this.pathCommand = `M ${this.turtle.position[0]},${bounds.span - this.turtle.position[1]}`;
  }

  configureMarks() {
    super.configureMarks();

    this.positionMark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('position', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.turtle.position[0] = this.state.position[0] = x;
      this.turtle.position[1] = this.state.position[1] = y;
    });

    this.headingMark = new RotationMark(this.parentEnvironment, this, this.state.position, t => {
      return this.expressionAt('heading', this.parentEnvironment.root.state.t);
    }, heading => {
      this.state.heading = heading;
    });

    this.wedgeMark = new PathMark();

    this.marker.addMarks([this.positionMark, this.headingMark], [this.wedgeMark], []);
  }

  updateMarkerDom(bounds, factor, matrix) {
    this.positionMark.updateDom(bounds, this.state.position, factor, matrix);

    const length = 10;
    const rotater = Matrix.rotate(this.state.heading);
    const axis = [length, 0];
    const rotatedAxis = rotater.multiplyVector(axis);
    const degreesPosition = [
      this.state.position[0] + rotatedAxis[0],
      this.state.position[1] + rotatedAxis[1]
    ];
    this.headingMark.updateDom(bounds, degreesPosition, factor, matrix);

    const {isLarge, isClockwise} = classifyArc(standardizeDegrees(this.state.heading));
    const commands = 
      `M${this.state.position[0]},${bounds.span - this.state.position[1]} ` +
      `L${this.state.position[0] + axis[0]},${bounds.span - (this.state.position[1] + axis[1])} ` +
      `A ${length},${length} 0 ${isLarge} ${isClockwise} ${degreesPosition[0]},${bounds.span - degreesPosition[1]} ` +
      'z';
    this.wedgeMark.updateDom(bounds, commands);
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

  static reify(parentEnvironment, pod) {
    const node = new MoveNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  get isDom() {
    return true;
  }

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
    this.turtle.position[0] = this.previousTurtle.position[0] + this.state.distance * Math.cos(this.previousTurtle.heading * Math.PI / 180);
    this.turtle.position[1] = this.previousTurtle.position[1] + this.state.distance * Math.sin(this.previousTurtle.heading * Math.PI / 180);
    this.turtle.heading = this.previousTurtle.heading;
    this.pathCommand = `L ${this.turtle.position[0]},${bounds.span - this.turtle.position[1]}`;
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

  updateMarkerDom(bounds, factor, matrix) {
    const to = [
      this.previousTurtle.position[0] + this.state.distance * Math.cos(this.turtle.heading * Math.PI / 180),
      this.previousTurtle.position[1] + this.state.distance * Math.sin(this.turtle.heading * Math.PI / 180)
    ];
    this.distanceMark.updateDom(bounds, to, factor, matrix);
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
    this.turtle.heading = this.previousTurtle.heading + this.state.degrees;
  }

  configureMarks() {
    super.configureMarks();

    this.degreesMark = new RotationMark(this.parentEnvironment, this, this.previousTurtle.position, t => {
      return this.expressionAt('degrees', this.parentEnvironment.root.state.t);
    }, degrees => {
      this.state.degrees = degrees;
      this.turtle.heading = this.previousTurtle.heading + this.degrees;
    });

    this.wedgeMark = new PathMark();

    this.marker.addMarks([this.degreesMark], [this.wedgeMark], []);
  }

  updateMarkerDom(bounds, factor, matrix) {
    const length = 10;
    const rotater = Matrix.rotate(this.state.degrees);
    const axis = [length, 0];
    const rotatedAxis = rotater.multiplyVector(axis);
    const degreesPosition = [
      this.previousTurtle.position[0] + rotatedAxis[0],
      this.previousTurtle.position[1] + rotatedAxis[1]
    ];
    this.degreesMark.updateDom(bounds, degreesPosition, factor, matrix);

    const {isLarge, isClockwise} = classifyArc(standardizeDegrees(this.state.degrees));
    const commands = 
      `M${this.previousTurtle.position[0]},${bounds.span - this.previousTurtle.position[1]} ` +
      `L${this.previousTurtle.position[0] + axis[0]},${bounds.span - (this.previousTurtle.position[1] + axis[1])} ` +
      `A ${length},${length} 0 ${isLarge} ${isClockwise} ${degreesPosition[0]},${bounds.span - degreesPosition[1]} ` +
      'z';
    this.wedgeMark.updateDom(bounds, commands);
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
    this.turtle.position[0] = this.state.position[0];
    this.turtle.position[1] = this.state.position[1];
    this.turtle.heading = 0;
    this.pathCommand = `M ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
  }

  configureMarks() {
    super.configureMarks();
    this.positionMark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('position', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.turtle.position[0] = this.state.position[0] = x;
      this.turtle.position[1] = this.state.position[1] = y;
    });
    this.marker.addMarks([this.positionMark], [], []);
  }

  updateMarkerDom(bounds, factor, matrix) {
    this.positionMark.updateDom(bounds, this.state.position, factor, matrix);
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
    this.turtle.position[0] = this.state.position[0];
    this.turtle.position[1] = this.state.position[1];
    this.turtle.heading = this.previousTurtle.heading;
    this.pathCommand = `L ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
  }

  configureMarks() {
    super.configureMarks();
    this.positionMark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('position', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.turtle.position[0] = this.state.position[0] = x;
      this.turtle.position[1] = this.state.position[1] = y;
    });
    this.marker.addMarks([this.positionMark], [], []);
  }

  updateMarkerDom(bounds, factor, matrix) {
    this.positionMark.updateDom(bounds, this.state.position, factor, matrix);
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
    this.turtle.position[0] = this.state.position[0];
    this.turtle.position[1] = this.state.position[1];
    this.turtle.heading = this.previousTurtle.heading;
    if (this.state.control) {
      this.pathCommand = `Q ${this.state.control[0]},${bounds.span - this.state.control[1]} ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
    } else {
      this.pathCommand = `T ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
    }
  }

  configureMarks() {
    super.configureMarks();

    // TODO do I need to update turtle here since updateTurtle does that?
    this.positionMark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('position', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.turtle.position[0] = this.state.position[0] = x;
      this.turtle.position[1] = this.state.position[1] = y;
    });

    const foregroundMarks = [this.positionMark];

    if (this.state.control) {
      this.controlMark = new VectorPanMark(this.parentEnvironment, null, t => {
        return this.expressionAt('control', this.parentEnvironment.root.state.t);
      }, ([x, y]) => {
        this.state.control[0] = x;
        this.state.control[1] = y;
      });
      foregroundMarks.push(this.controlMark);

      this.lineMarks = [
        new LineMark(),
        new LineMark(),
      ]
    }

    this.marker.addMarks(foregroundMarks, this.lineMarks, []);
  }

  updateMarkerDom(bounds, factor, matrix) {
    this.positionMark.updateDom(bounds, this.state.position, factor, matrix);
    if (this.state.control) {
      this.controlMark.updateDom(bounds, this.state.control, factor, matrix);
      this.lineMarks[0].updateDom(bounds, this.previousTurtle.position, this.state.control);
      this.lineMarks[1].updateDom(bounds, this.state.position, this.state.control);
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

  configureState(bounds) {
    this.configureScalarProperty('degrees', this, this.parentEnvironment, this.updateDegrees.bind(this), bounds, [], timeline => {
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

    let locationTimeline;
    if (this.timedProperties.hasOwnProperty('position') && this.timedProperties.hasOwnProperty('center')) {
      throw new LocatedException(this.where, 'I found an <code>arc</code> node whose <code>position</code> and <code>center</code> were both set. Define only one of these.');
    } else if (this.timedProperties.hasOwnProperty('position')) {
      locationTimeline = this.timedProperties.position;
      this.isWedge = false;
      this.configureVectorProperty('position', this, this.parentEnvironment, null, bounds, [], timeline => {
        try {
          timeline.assertList(2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>position</code>. ${e.message}`);
        }
      });
    } else if (this.timedProperties.hasOwnProperty('center')) {
      this.isWedge = true;
      locationTimeline = this.timedProperties.center;
      this.configureVectorProperty('center', this, this.parentEnvironment, null, bounds, [], timeline => {
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

    const degreesTimeline = this.timedProperties.degrees;

    if (degreesTimeline.isAnimated || locationTimeline.isAnimated) {
      this.parentEnvironment.updateDoms.push(this.updateTurtle.bind(this));
    }

    if (degreesTimeline.hasDefault && locationTimeline.hasDefault) {
      this.updateTurtle(bounds);
    }
  }

  updateDegrees(bounds) {
    if (this.state.degrees >= 0) {
      this.isLarge = this.state.degrees >= 180 ? 1 : 0;
      this.isClockwise = 0;
    } else {
      this.isLarge = this.state.degrees <= -180 ? 1 : 0;
      this.isClockwise = 1;
    }
  }

  updateTurtle(bounds) {
    let isCircle = this.state.degrees === 360;
    let radians = this.state.degrees * Math.PI / 180;

    let position;

    if (!this.isWedge) {
      position = this.state.position;

      let diff = [
        this.state.position[0] - this.previousTurtle.position[0],
        this.state.position[1] - this.previousTurtle.position[1],
      ];
      let magnitude = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);
      let distance = (0.5 * Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1])) / Math.tan(radians * 0.5);
      let halfway = [
        (this.previousTurtle.position[0] + this.state.position[0]) * 0.5,
        (this.previousTurtle.position[1] + this.state.position[1]) * 0.5
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
      this.previousTurtle.position[0] - this.state.center[0],
      this.previousTurtle.position[1] - this.state.center[1],
    ];
    let radius = Math.sqrt(radial[0] * radial[0] + radial[1] * radial[1]);

    if (this.isWedge) {
      const rotated = [
        radial[0] * Math.cos(radians) - radial[1] * Math.sin(radians),
        radial[0] * Math.sin(radians) + radial[1] * Math.cos(radians),
      ];

      position = [
        this.state.center[0] + radial[0] * Math.cos(radians) - radial[1] * Math.sin(radians),
        this.state.center[1] + radial[0] * Math.sin(radians) + radial[1] * Math.cos(radians),
      ];
    }

    this.turtle.position[0] = position[0];
    this.turtle.position[1] = position[1];
    this.turtle.heading = this.previousTurtle.heading;

    if (isCircle) {
      const opposite = [
        this.state.center[0] + (this.state.center[0] - position[0]),
        this.state.center[1] + (this.state.center[1] - position[1]),
      ];
      this.pathCommand = `A ${radius},${radius} 0 ${this.isLarge} ${this.isClockwise} ${opposite[0]},${bounds.span - opposite[1]} A ${radius},${radius} 0 ${this.isLarge} ${this.isClockwise} ${position[0]},${bounds.span - position[1]}`;
    } else {
      this.pathCommand = `A ${radius},${radius} 0 ${this.isLarge} ${this.isClockwise} ${position[0]},${bounds.span - position[1]}`;
    }
  }

  configureMarks() {
    super.configureMarks();

    if (this.isWedge) {
      this.centerMark = new VectorPanMark(this.parentEnvironment, null, t => {
        return this.expressionAt('center', this.parentEnvironment.root.state.t);
      }, ([x, y]) => {
        this.state.center[0] = x;
        this.state.center[1] = y;
      });

      this.positionMark = new WedgeDegreesMark(this.parentEnvironment, this, this.previousTurtle.position, this.state.center, t => {
        return this.expressionAt('degrees', this.parentEnvironment.root.state.t);
      }, degrees => {
        this.state.degrees = degrees;
        this.updateDegrees(/* TODO */);
      });
    } else {
      this.positionMark = new VectorPanMark(this.parentEnvironment, null, t => {
        return this.expressionAt('position', this.parentEnvironment.root.state.t);
      }, ([x, y]) => {
        this.turtle.position[0] = this.state.position[0] = x;
        this.turtle.position[1] = this.state.position[1] = y;
      });

      this.centerMark = new BumpDegreesMark(this.parentEnvironment, this, this.previousTurtle.position, this.state.position, this.state.center, t => {
        return this.expressionAt('degrees', this.parentEnvironment.root.state.t);
      }, degrees => {
        console.log("degrees:", degrees);
        this.state.degrees = degrees;
        this.updateDegrees(/* TODO */);
      });
    }

    this.lineMarks = [
      new LineMark(),
      new LineMark(),
    ];

    this.marker.addMarks([this.centerMark, this.positionMark], this.lineMarks, []);
  }

  updateMarkerDom(bounds, factor, matrix) {
    if (this.isWedge) {
      this.positionMark.updateDom(bounds, this.turtle.position, factor, matrix);
      this.centerMark.updateDom(bounds, this.state.center, factor, matrix);
    } else {
      this.positionMark.updateDom(bounds, this.turtle.position, factor, matrix);
      this.centerMark.updateDom(bounds, this.state.center, factor, matrix);
    }

    this.lineMarks[0].updateDom(bounds, this.state.center, this.turtle.position, factor, matrix);
    this.lineMarks[1].updateDom(bounds, this.state.center, this.previousTurtle.position, factor, matrix);
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
    this.turtle.position[0] = this.state.position[0];
    this.turtle.position[1] = this.state.position[1];
    this.turtle.heading = this.previousTurtle.heading;
    if (this.state.control1) {
      this.pathCommand = `C ${this.state.control1[0]},${bounds.span - this.state.control1[1]} ${this.state.control2[0]},${bounds.span - this.state.control2[1]} ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
    } else {
      this.pathCommand = `S ${this.state.control2[0]},${bounds.span - this.state.control2[1]} ${this.state.position[0]},${bounds.span - this.state.position[1]}`;
    }
  }

  configureMarks() {
    super.configureMarks();

    this.positionMark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('position', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.turtle.position[0] = this.state.position[0] = x;
      this.turtle.position[1] = this.state.position[1] = y;
    });

    this.control2Mark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('control2', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.state.control2[0] = x;
      this.state.control2[1] = y;
    });

    this.lineMarks = [
      new LineMark(),
    ]

    const foregroundMarks = [this.positionMark, this.control2Mark];

    if (this.state.control1) {
      this.control1Mark = new VectorPanMark(this.parentEnvironment, null, t => {
        return this.expressionAt('control1', this.parentEnvironment.root.state.t);
      }, ([x, y]) => {
        this.state.control1[0] = x;
        this.state.control1[1] = y;
      });

      foregroundMarks.push(this.control1Mark);
      this.lineMarks.push(new LineMark());
    }

    this.marker.addMarks(foregroundMarks, this.lineMarks, []);
  }

  updateMarkerDom(bounds, factor, matrix) {
    this.positionMark.updateDom(bounds, this.state.position, factor, matrix);
    this.control2Mark.updateDom(bounds, this.state.control2, factor, matrix);
    this.lineMarks[0].updateDom(bounds, this.state.position, this.state.control2);

    if (this.state.control1) {
      this.control1Mark.updateDom(bounds, this.state.control1, factor, matrix);
      this.lineMarks[1].updateDom(bounds, this.previousTurtle.position, this.state.control1);
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

