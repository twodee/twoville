import {
  Turtle,
} from './common.js';

import {
  DistanceMark,
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

  getMarks() {
    return [this.positionMark];
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

  getMarks() {
    return [this.positionMark, this.headingMark];
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

  getMarks() {
    return [this.distanceMark];
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

  getMarks() {
    return [this.rotationMark];
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
