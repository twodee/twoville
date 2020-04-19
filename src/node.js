import {
  SourceLocation,
  Turtle,
} from './common.js';

import {
  ExpressionBoolean,
  ExpressionReal,
  ExpressionVector,
} from './ast.js';

import {
  BumpDegreesMark,
  BumpPositionMark,
  CircleMark,
  DistanceMark,
  LineMark,
  Marker,
  RotationMark,
  VectorPanMark,
  WedgeDegreesMark,
} from './mark.js';

import {
  TimelinedEnvironment,
} from './environment.js';

// --------------------------------------------------------------------------- 

export class Node extends TimelinedEnvironment {
  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    parentEnvironment.nodes.push(this);
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

  validate() {
    this.assertProperty('position');
  }

  start() {
    super.start();
    this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    this.marker.addMarks([this.positionMark], []);
  }

  update(env, t, bounds, fromTurtle, matrix) {
    const position = this.valueAt(env, 'position', t);
    this.positionMark.setExpression(position);
    
    if (position) {
      this.positionMark.update(position, bounds, matrix);
      return {
        pathCommand: null,
        turtle: new Turtle(position, fromTurtle.heading),
      };
    } else {
      return null;
    }
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

  validate() {
    this.assertProperty('position');
    this.assertProperty('heading');
  }

  start() {
    super.start();
    this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    this.headingMark = new RotationMark(this.parentEnvironment, this);
    this.marker.addMarks([this.positionMark, this.headingMark], []);
  }

  update(env, t, bounds, fromTurtle, matrix) {
    const position = this.valueAt(env, 'position', t);
    this.positionMark.setExpression(position);

    const heading = this.valueAt(env, 'heading', t);
    this.headingMark.setExpression(heading, new ExpressionReal(0), position);
    
    if (position) {
      this.positionMark.update(position, bounds, matrix);
      const towardPosition = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]).rotate(heading.value).add(position);
      this.headingMark.update(towardPosition, bounds, matrix);
      return {
        pathCommand: `M${position.get(0).value},${bounds.span - position.get(1).value}`,
        turtle: new Turtle(position, heading),
      };
    } else {
      return null;
    }
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

  validate() {
    this.assertProperty('distance');
  }

  start() {
    super.start();
    this.distanceMark = new DistanceMark(this.parentEnvironment, this);
    this.marker.addMarks([this.distanceMark], []);
  }

  update(env, t, bounds, fromTurtle, matrix) {
    const distance = this.valueAt(env, 'distance', t);
    this.distanceMark.setExpression(distance, fromTurtle.position, fromTurtle.heading);
    
    if (distance) {
      let delta = new ExpressionVector([distance, fromTurtle.heading]).toCartesian();
      let position = fromTurtle.position.add(delta);

      this.distanceMark.update(position, bounds, matrix);

      return {
        pathCommand: `L${position.get(0).value},${bounds.span - position.get(1).value}`,
        turtle: new Turtle(position, fromTurtle.heading),
      };
    } else {
      return null;
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

  static reify(parentEnvironment, pod) {
    const node = new TurnNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  validate() {
    this.assertProperty('degrees');
  }

  start() {
    super.start();
    this.rotationMark = new RotationMark(this.parentEnvironment, this);
    this.marker.addMarks([this.rotationMark], []);
  }

  update(env, t, bounds, fromTurtle, matrix) {
    const degrees = this.valueAt(env, 'degrees', t);
    this.rotationMark.setExpression(degrees, fromTurtle.heading, fromTurtle.position);
    
    if (degrees) {
      let newHeading = fromTurtle.heading.add(degrees).value;
      while (newHeading > 360) {
        newHeading -= 360;
      }
      while (newHeading < 0) {
        newHeading += 360;
      }
      let towardPosition = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]).rotate(newHeading).add(fromTurtle.position);
      this.rotationMark.update(towardPosition, bounds, matrix);
      return {
        pathCommand: null,
        turtle: new Turtle(fromTurtle.position, new ExpressionReal(newHeading)),
      };
    } else {
      return null;
    }
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

  validate() {
    this.assertProperty('position');
  }

  start() {
    super.start();
    this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    this.marker.addMarks([this.positionMark], []);
  }

  update(env, t, bounds, fromTurtle, matrix) {
    const position = this.valueAt(env, 'position', t);
    this.positionMark.setExpression(position);
    
    if (position) {
      this.positionMark.update(position, bounds, matrix);
      return {
        pathCommand: `M${position.get(0).value},${bounds.span - position.get(1).value}`,
        turtle: new Turtle(position, fromTurtle.heading),
      };
    } else {
      return null;
    }
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
    node.untimedProperties.delta = new ExpressionBoolean(false);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new LineNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  validate() {
    this.assertProperty('position');
  }

  start() {
    super.start();
    this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    this.marker.addMarks([this.positionMark], []);
  }

  update(env, t, bounds, fromTurtle, matrix) {
    const position = this.valueAt(env, 'position', t);
    this.positionMark.setExpression(position);

    let isDelta = this.untimedProperties.delta.value;

    let absolutePosition;
    let letter;
    if (isDelta) {
      absolutePosition = fromTurtle.position.add(position);
      letter = 'l';
    } else {
      absolutePosition = position;
      letter = 'L';
    }
    
    if (position) {
      this.positionMark.update(absolutePosition, bounds, matrix);

      let pathCommand;
      if (isDelta) {
        pathCommand = `${letter}${position.get(0).value},${-position.get(1).value}`;
      } else {
        pathCommand = `${letter}${position.get(0).value},${bounds.span - position.get(1).value}`;
      }

      return {
        pathCommand,
        turtle: new Turtle(absolutePosition, fromTurtle.heading),
        segment: null,
      };
    } else {
      return null;
    }
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

  validate() {
    this.assertProperty('position');
  }

  start() {
    super.start();
    this.lineMarks = [
      new LineMark(),
      new LineMark(),
    ];
    this.positionMark = new VectorPanMark(this.parentEnvironment, this);

    const foregroundMarks = [this.positionMark];
    if (this.owns('control')) {
      this.controlMark = new VectorPanMark(this.parentEnvironment, this);
      foregroundMarks.push(this.controlMark);
    }

    this.marker.addMarks(foregroundMarks, this.lineMarks);
  }

  update(env, t, bounds, fromTurtle, matrix) {
    const position = this.valueAt(env, 'position', t);
    this.positionMark.setExpression(position);

    let control;
    if (this.owns('control')) {
      control = this.valueAt(env, 'control', t);
      this.controlMark.setExpression(control);
    }
    
    if (position) {
      this.positionMark.update(position, bounds, matrix);

      let pathCommand;
      if (control) {
        this.controlMark.update(control, bounds, matrix);
        this.lineMarks[0].update(fromTurtle.position, control, bounds, matrix);
        this.lineMarks[1].update(control, position, bounds, matrix);
        pathCommand = `Q${control.get(0).value},${bounds.span - control.get(1).value} ${position.get(0).value},${bounds.span - position.get(1).value}`;
      } else {
        pathCommand = `T${position.get(0).value},${bounds.span - position.get(1).value}`;
      }

      return {
        pathCommand,
        turtle: new Turtle(position, fromTurtle.heading),
        segment: null,
      };
    } else {
      return null;
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

  validate() {
    if (this.owns('position') && this.owns('center')) {
      throw new LocatedException(this.where, 'I found an arc whose position and center properties are both set. Define only one of these.');
    }

    if (!this.owns('position') && !this.owns('center')) {
      throw new LocatedException(this.where, 'I found an arc whose curvature I couldn\'t figure out. Please define its center or position.');
    }

    this.assertProperty('degrees');
  }

  start() {
    super.start();

    this.isWedge = this.owns('center');
    if (this.isWedge) {
      this.centerMark = new VectorPanMark(this.parentEnvironment, this);
      this.positionMark = new WedgeDegreesMark(this.parentEnvironment, this);
    } else {
      this.centerMark = new BumpDegreesMark(this.parentEnvironment, this);
      this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    }

    this.marker.addMarks([this.centerMark, this.positionMark], []);
  }

  update(env, t, bounds, fromTurtle, matrix) {
    let degrees = this.valueAt(env, 'degrees', t);
    let radians = degrees.value * Math.PI / 180;

    let center;
    if (this.isWedge) {
      center = this.valueAt(env, 'center', t);
      this.centerMark.setExpression(center);
      this.positionMark.setExpression(degrees, fromTurtle.position, center);
    } else {
      let position = this.valueAt(env, 'position', t);
      this.positionMark.setExpression(position);
      this.positionMark.update(position, bounds, matrix);

      let diff = position.subtract(fromTurtle.position);
      let distance = (0.5 * diff.magnitude) / Math.tan(radians * 0.5);
      let halfway = fromTurtle.position.add(position).multiply(new ExpressionReal(0.5));
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
      sweep = 0;
    } else {
      large = degrees.value <= -180 ? 1 : 0;
      sweep = 1;
    }

    const pathCommand = `A${radius},${radius} 0 ${large} ${sweep} ${to.get(0).value},${bounds.span - to.get(1).value}`;

    if (this.isWedge) {
      this.centerMark.update(center, bounds, matrix);
      this.positionMark.update(to, bounds, matrix);
    } else {
      this.centerMark.setExpression(degrees, fromTurtle.position, center, to);
      this.centerMark.update(center, bounds, matrix);
    }

    return {
      pathCommand,
      turtle: new Turtle(to, fromTurtle.heading),
      segment: null,
    };
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

  validate() {
    this.assertProperty('position');
    this.assertProperty('control2');
  }

  start() {
    super.start();

    this.line2Mark = new LineMark();
    this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    this.control2Mark = new VectorPanMark(this.parentEnvironment, this);

    const foregroundMarks = [this.positionMark, this.control2Mark];
    const backgroundMarks = [this.line2Mark];

    if (this.owns('control1')) {
      this.line1Mark = new LineMark();
      this.control1Mark = new VectorPanMark(this.parentEnvironment, this);
      foregroundMarks.push(this.control1Mark);
      backgroundMarks.push(this.line1Mark);
    }

    this.addMarks(this.foregroundMarks, this.backgroundMarks);
  }

  update(env, t, bounds, fromTurtle, matrix) {
    const position = this.valueAt(env, 'position', t);
    this.positionMark.setExpression(position);

    let control1;
    if (this.owns('control1')) {
      control1 = this.valueAt(env, 'control1', t);
      this.control1Mark.setExpression(control1);
    }

    let control2 = this.valueAt(env, 'control2', t);
    this.control2Mark.setExpression(control2);
    
    if (position && control2) {
      this.positionMark.update(position, bounds, matrix);
      this.control2Mark.update(control2, bounds, matrix);
      this.line2Mark.update(control2, position, bounds, matrix);

      let pathCommand;
      if (control1) {
        this.control1Mark.update(control1, bounds, matrix);
        this.line1Mark.update(fromTurtle.position, control1, bounds, matrix);
        pathCommand = `C${control1.get(0).value},${bounds.span - control1.get(1).value} ${control2.get(0).value},${bounds.span - control2.get(1).value} ${position.get(0).value},${bounds.span - position.get(1).value}`;
      } else {
        pathCommand = `T${control2.get(0).value},${bounds.span - control2.get(1).value} ${position.get(0).value},${bounds.span - position.get(1).value}`;
      }

      return {
        pathCommand,
        turtle: new Turtle(position, fromTurtle.heading),
        segment: null,
      };
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

