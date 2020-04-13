import {
  Turtle,
} from './common.js';

import {
  ExpressionBoolean,
  ExpressionReal,
  ExpressionVector,
} from './ast.js';

import {
  DistanceMark,
  LineMark,
  RotationMark,
  VectorPanMark,
} from './mark.js';

import {
  TimelinedEnvironment,
} from './environment.js';

// --------------------------------------------------------------------------- 

export class VertexNode extends TimelinedEnvironment {
  static type = 'vertex';
  static article = 'a';
  static timedIds = ['position'];

  static create(parentEnvironment, where) {
    const node = new VertexNode();
    node.initialize(parentEnvironment, where);
    parentEnvironment.nodes.push(node);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new VertexNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  getForegroundMarks() {
    return [this.positionMark];
  }

  getBackgroundMarks() {
    return [];
  }

  validate() {
    this.assertProperty('position');
  }

  start() {
    this.positionMark = new VectorPanMark(this.parentEnvironment, this);
  }

  update(env, t, bounds, fromTurtle) {
    const position = this.valueAt(env, 'position', t);
    this.positionMark.setExpression(position);
    
    if (position) {
      this.positionMark.update(position, bounds);
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

export class TurtleNode extends TimelinedEnvironment {
  static type = 'turtle';
  static article = 'a';
  static timedIds = ['position', 'heading'];

  static create(parentEnvironment, where) {
    const node = new TurtleNode();
    node.initialize(parentEnvironment, where);
    parentEnvironment.nodes.push(node);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new TurtleNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  getForegroundMarks() {
    return [this.positionMark, this.headingMark];
  }

  getBackgroundMarks() {
    return [];
  }

  validate() {
    this.assertProperty('position');
    this.assertProperty('heading');
  }

  start() {
    this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    this.headingMark = new RotationMark(this.parentEnvironment, this);
  }

  update(env, t, bounds, fromTurtle) {
    const position = this.valueAt(env, 'position', t);
    this.positionMark.setExpression(position);

    const heading = this.valueAt(env, 'heading', t);
    this.headingMark.setExpression(heading, position);
    
    if (position) {
      this.positionMark.update(position, bounds);
      const towardPosition = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]).rotate(heading.value).add(position);
      this.headingMark.update(towardPosition, bounds);
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

export class MoveNode extends TimelinedEnvironment {
  static type = 'move';
  static article = 'a';
  static timedIds = ['distance'];

  static create(parentEnvironment, where) {
    const node = new MoveNode();
    node.initialize(parentEnvironment, where);
    parentEnvironment.nodes.push(node);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new MoveNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  getForegroundMarks() {
    return [this.distanceMark];
  }

  getBackgroundMarks() {
    return [];
  }

  validate() {
    this.assertProperty('distance');
  }

  start() {
    this.distanceMark = new DistanceMark(this.parentEnvironment, this);
  }

  update(env, t, bounds, fromTurtle) {
    const distance = this.valueAt(env, 'distance', t);
    this.distanceMark.setExpression(distance, fromTurtle.position, fromTurtle.heading);
    
    if (distance) {
      let delta = new ExpressionVector([distance, fromTurtle.heading]).toCartesian();
      let position = fromTurtle.position.add(delta);

      this.distanceMark.update(position, bounds);

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

export class TurnNode extends TimelinedEnvironment {
  static type = 'turn';
  static article = 'a';
  static timedIds = ['degrees'];

  static create(parentEnvironment, where) {
    const node = new TurnNode();
    node.initialize(parentEnvironment, where);
    parentEnvironment.nodes.push(node);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new TurnNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  getForegroundMarks() {
    return [this.rotationMark];
  }

  getBackgroundMarks() {
    return [];
  }

  validate() {
    this.assertProperty('degrees');
  }

  start() {
    this.rotationMark = new RotationMark(this.parentEnvironment, this);
  }

  update(env, t, bounds, fromTurtle) {
    const degrees = this.valueAt(env, 'degrees', t);
    this.rotationMark.setExpression(degrees, fromTurtle.position);
    
    if (degrees) {
      let newHeading = fromTurtle.heading.add(degrees).value;
      while (newHeading > 360) {
        newHeading -= 360;
      }
      while (newHeading < 0) {
        newHeading += 360;
      }
      let towardPosition = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]).rotate(newHeading).add(fromTurtle.position);
      this.rotationMark.update(towardPosition, bounds);
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

export class JumpNode extends TimelinedEnvironment {
  static type = 'jump';
  static article = 'a';
  static timedIds = ['position'];

  static create(parentEnvironment, where) {
    const node = new JumpNode();
    node.initialize(parentEnvironment, where);
    parentEnvironment.nodes.push(node);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new JumpNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  getForegroundMarks() {
    return [this.positionMark];
  }

  getBackgroundMarks() {
    return [];
  }

  validate() {
    this.assertProperty('position');
  }

  start() {
    this.positionMark = new VectorPanMark(this.parentEnvironment, this);
  }

  update(env, t, bounds, fromTurtle) {
    const position = this.valueAt(env, 'position', t);
    this.positionMark.setExpression(position);
    
    if (position) {
      this.positionMark.update(position, bounds);
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

export class LineNode extends TimelinedEnvironment {
  static type = 'line';
  static article = 'a';
  static timedIds = ['position'];

  static create(parentEnvironment, where) {
    const node = new LineNode();
    node.initialize(parentEnvironment, where);
    node.untimedProperties.delta = new ExpressionBoolean(false);
    parentEnvironment.nodes.push(node);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new LineNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  getForegroundMarks() {
    return [this.positionMark];
  }

  getBackgroundMarks() {
    return [this.lineMark];
  }

  validate() {
    this.assertProperty('position');
  }

  start() {
    this.lineMark = new LineMark();
    this.positionMark = new VectorPanMark(this.parentEnvironment, this);
  }

  update(env, t, bounds, fromTurtle) {
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
      this.positionMark.update(absolutePosition, bounds);
      this.lineMark.update(fromTurtle.position, absolutePosition, bounds);

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

export class QuadraticNode extends TimelinedEnvironment {
  static type = 'quadratic';
  static article = 'a';
  static timedIds = ['position', 'control'];

  static create(parentEnvironment, where) {
    const node = new QuadraticNode();
    node.initialize(parentEnvironment, where);
    parentEnvironment.nodes.push(node);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new QuadraticNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  getForegroundMarks() {
    const marks = [this.positionMark];
    if (this.owns('control')) {
      marks.push(this.controlMark);
    }
    return marks;
  }

  getBackgroundMarks() {
    return this.lineMarks;
  }

  validate() {
    this.assertProperty('position');
  }

  start() {
    this.lineMarks = [
      new LineMark(),
      new LineMark(),
    ];
    this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    if (this.owns('control')) {
      this.controlMark = new VectorPanMark(this.parentEnvironment, this);
    }
  }

  update(env, t, bounds, fromTurtle) {
    const position = this.valueAt(env, 'position', t);
    this.positionMark.setExpression(position);

    let control;
    if (this.owns('control')) {
      control = this.valueAt(env, 'control', t);
      this.controlMark.setExpression(control);
    }
    
    if (position) {
      this.positionMark.update(position, bounds);

      let pathCommand;
      if (control) {
        this.controlMark.update(control, bounds);
        this.lineMarks[0].update(fromTurtle.position, control, bounds);
        this.lineMarks[1].update(control, position, bounds);
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

export class CubicNode extends TimelinedEnvironment {
  static type = 'cubic';
  static article = 'a';
  static timedIds = ['position', 'control1', 'control2'];

  static create(parentEnvironment, where) {
    const node = new CubicNode();
    node.initialize(parentEnvironment, where);
    parentEnvironment.nodes.push(node);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new CubicNode();
    node.embody(parentEnvironment, pod);
    return node;
  }

  getForegroundMarks() {
    const marks = [this.positionMark, this.control2Mark];
    if (this.owns('control1')) {
      marks.push(this.control1Mark);
    }
    console.log("marks:", marks);
    return marks;
  }

  getBackgroundMarks() {
    const marks = [this.line2Mark];
    if (this.owns('control1')) {
      marks.push(this.line1Mark);
    }
    console.log("marks:", marks);
    return marks;
  }

  validate() {
    console.log("validate!");
    this.assertProperty('position');
    this.assertProperty('control2');
  }

  start() {
    console.log("start");
    this.line2Mark = new LineMark();
    this.positionMark = new VectorPanMark(this.parentEnvironment, this);
    this.control2Mark = new VectorPanMark(this.parentEnvironment, this);
    if (this.owns('control1')) {
      this.line1Mark = new LineMark();
      this.control1Mark = new VectorPanMark(this.parentEnvironment, this);
    }
  }

  update(env, t, bounds, fromTurtle) {
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
      this.positionMark.update(position, bounds);
      this.control2Mark.update(control2, bounds);
      this.line2Mark.update(control2, position, bounds);

      let pathCommand;
      if (control1) {
        this.control1Mark.update(control1, bounds);
        this.line1Mark.update(fromTurtle.position, control1, bounds);
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

