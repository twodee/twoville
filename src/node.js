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
} from './math.js';

import {
  AxisMark,
  BumpDegreesMark,
  BumpPositionMark,
  CircleMark,
  DistanceMark,
  LineMark,
  Marker,
  PathMark,
  RayMark,
  RotationMark,
  VectorPanMark,
  WedgeDegreesMark,
  WedgeMark,
} from './mark.js';

import {
  TimelinedEnvironment,
} from './environment.js';

import {
  Matrix,
} from './matrix.js';

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

  updateInteractionState(matrix) {
    this.state.matrix = matrix;
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

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);
    this.positionMark.updateState(this.state.position, this.state.matrix);
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

  segment(previousSegment) {
    return new GapSegment(this.previousTurtle?.position, this.turtle.position);
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

    this.headingMark = new RotationMark(this.parentEnvironment, this, t => {
      return this.expressionAt('heading', this.parentEnvironment.root.state.t);
    }, heading => {
      this.state.heading = heading;
    });

    this.wedgeMark = new WedgeMark();

    this.marker.addMarks([this.positionMark, this.headingMark], [this.wedgeMark], []);
  }

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);
    this.positionMark.updateState(this.state.position, this.state.matrix);
    this.headingMark.updateState(this.state.position, this.state.heading, 0, this.state.matrix);
    this.wedgeMark.updateState(this.state.position, this.state.heading, 0, this.state.matrix);
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

    this.degreesMark = new RotationMark(this.parentEnvironment, this, t => {
      return this.expressionAt('degrees', this.parentEnvironment.root.state.t);
    }, degrees => {
      this.state.degrees = degrees;
      this.turtle.heading = this.previousTurtle.heading + this.degrees;
    });

    this.wedgeMark = new WedgeMark();

    this.marker.addMarks([this.degreesMark], [this.wedgeMark], []);
  }

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);
    this.degreesMark.updateState(this.previousTurtle.position, this.state.degrees, this.previousTurtle.heading, this.state.matrix);
    this.wedgeMark.updateState(this.previousTurtle.position, this.state.degrees, this.previousTurtle.heading, this.state.matrix);
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

  segment(previousSegment) {
    return new GapSegment(this.previousTurtle?.position, this.turtle.position);
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

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);
    this.positionMark.updateState(this.state.position, this.state.matrix);
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

  segment(previousSegment) {
    return new LineSegment(this.previousTurtle.position, this.turtle.position);
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

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);
    this.positionMark.updateState(this.state.position, this.state.matrix);
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
    } else {
      this.lineMarks = [];
    }

    this.marker.addMarks(foregroundMarks, this.lineMarks, []);
  }

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);
    this.positionMark.updateState(this.state.position, this.state.matrix);
    if (this.state.control) {
      this.controlMark.updateState(this.state.control, this.state.matrix);
      this.lineMarks[0].updateState(this.previousTurtle.position, this.state.control);
      this.lineMarks[1].updateState(this.state.position, this.state.control);
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

  segment(previousSegment) {
    return new ArcSegment(this.previousTurtle.position, this.turtle.position, this.state.radius, this.state.isLarge, this.state.isClockwise);
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
      this.state.isLarge = this.state.degrees >= 180 ? 1 : 0;
      this.state.isClockwise = 0;
    } else {
      this.state.isLarge = this.state.degrees <= -180 ? 1 : 0;
      this.state.isClockwise = 1;
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
    this.state.radius = Math.sqrt(radial[0] * radial[0] + radial[1] * radial[1]);

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
      this.pathCommand = `A ${this.state.radius},${this.state.radius} 0 ${this.state.isLarge} ${this.state.isClockwise} ${opposite[0]},${bounds.span - opposite[1]} A ${this.state.radius},${this.state.radius} 0 ${this.state.isLarge} ${this.state.isClockwise} ${position[0]},${bounds.span - position[1]}`;
    } else {
      this.pathCommand = `A ${this.state.radius},${this.state.radius} 0 ${this.state.isLarge} ${this.state.isClockwise} ${position[0]},${bounds.span - position[1]}`;
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

      this.positionMark = new WedgeDegreesMark(this.parentEnvironment, this, t => {
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

      this.centerMark = new BumpDegreesMark(this.parentEnvironment, this, t => {
        return this.expressionAt('degrees', this.parentEnvironment.root.state.t);
      }, degrees => {
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

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);

    if (this.isWedge) {
      this.centerMark.updateState(this.state.center, this.state.matrix);
      this.positionMark.updateState(this.turtle.position, this.previousTurtle.position, this.state.center, this.state.matrix);
    } else {
      this.positionMark.updateState(this.turtle.position, this.state.matrix);
      this.centerMark.updateState(this.turtle.position, this.previousTurtle.position, this.state.center, this.state.degrees, this.state.matrix);
    }

    this.lineMarks[0].updateState(this.state.center, this.turtle.position, this.state.matrix);
    this.lineMarks[1].updateState(this.state.center, this.previousTurtle.position, this.state.matrix);
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

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);

    this.positionMark.updateState(this.state.position, this.state.matrix);
    this.control2Mark.updateState(this.state.control2, this.state.matrix);
    this.lineMarks[0].updateState(this.state.position, this.state.control2);

    if (this.state.control1) {
      this.control1Mark.updateState(this.state.control1, this.state.matrix);
      this.lineMarks[1].updateState(this.previousTurtle.position, this.state.control1);
    }
  }
}

// --------------------------------------------------------------------------- 

class GapSegment {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  mirror(line) {
    console.log("line:", line);
    console.log("this:", this);
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

export class Mirror extends TimelinedEnvironment {
  static type = 'mirror';
  static article = 'a';
  static timedIds = ['pivot', 'axis'];

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

  configureState(bounds) {
    this.state = {};

    this.configureVectorProperty('pivot', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>mirror</code> whose <code>pivot</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>mirror</code> with an illegal value for <code>pivot</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('axis', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>mirror</code> whose <code>axis</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>mirror</code> with an illegal value for <code>axis</code>. ${e.message}`);
      }
    });
  }

  configureMarks() {
    this.marker = new Marker(this.parentEnvironment);
    this.parentEnvironment.addMarker(this.marker);

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

