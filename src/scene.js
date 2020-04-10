import { 
  Timeline
} from './timeline.js';

import { 
  FunctionDefinition,
  LocatedException,
  SourceLocation,
  Turtle,
  mop,
  svgNamespace,
} from './common.js';

import { 
  ExpressionInteger,
  ExpressionMove,
  ExpressionReal,
  ExpressionString,
  ExpressionTurn,
  ExpressionTurtle,
  ExpressionVector,
  ExpressionVertex,
} from './ast.js';

import { 
  CircleMark,
  DistanceMark,
  HorizontalPanMark,
  Markable,
  PolygonMark,
  RectangleMark,
  RotationMark,
  VectorPanMark,
  VerticalPanMark,
} from './mark.js';

// --------------------------------------------------------------------------- 

export class Environment {
  static type = 'environment';

  initialize(parentEnvironment, where) {
    this.untimedProperties = {};
    this.functions = {};
    this.parentEnvironment = parentEnvironment;
    if (where) {
      this.where = where;
    }

    // Let's make the root easy to access.
    if (parentEnvironment) {
      this.root = parentEnvironment.root;
    }
  }

  static create(parentEnvironment, where) {
    const env = new Environment();
    env.initialize(parentEnvironment, where);
    return env;
  }

  embody(parentEnvironment, pod) {
    this.parentEnvironment = parentEnvironment;
    if (parentEnvironment) {
      this.root = parentEnvironment.root;
    }

    this.untimedProperties = mop(pod.untimedProperties, subpod => this.root.omniReify(this, subpod));
    if (pod.where) {
      this.where = SourceLocation.reify(pod.where);
    }
  }

  static reify(parentEnvironment, pod) {
    const env = new Environment();
    env.embody(parentEnvironment, pod);
    return env;
  }

  toPod() {
    return {
      type: this.type,
      untimedProperties: mop(this.untimedProperties, value => {
        return value.toPod();
      }),
      where: this.where,
    };
  }

  // Binding to a plain old Environment means the data isn't bound up with
  // time. The TimelinedEnvironment will override this for data that is bound
  // up with time.
  bind(id, value) {
    this.untimedProperties[id] = value;
  }

  bindFunction(id, method) {
    this.functions[id] = method;
  }

  hasFunction(id) {
    return this.functions.hasOwnProperty(id);
  }

  getFunction(id) {
    return this.functions[id];
  }

  // Determine if this environment directly owns a property.
  owns(id) {
    return this.untimedProperties.hasOwnProperty(id);
  }

  // Determine if this environment owns or inherits a property.
  knows(id) {
    let env = this;
    while (env) {
      if (env.owns(id)) {
        return true;
      }
      env = env.parent;
    }
    return false;
  }

  assertProperty(id) {
    if (!this.owns(id)) {
      throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose ${id} property is not defined.`);
    }
  }

  get(id) {
    let env = this;
    while (env) {
      if (env.untimedProperties.hasOwnProperty(id)) {
        return env.untimedProperties[id];
      }
      env = env.parent;
    }
    return undefined;
  }

  get type() {
    return this.constructor.type;
  }

  // evaluate(env, fromTime, toTime) {
    // return this;
  // }
}

// ---------------------------------------------------------------------------

export class TimelinedEnvironment extends Environment {
  static type = 'timelined environment';
  static article = 'a';
  static timedIds = [];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    this.timedProperties = {};
  }

  embody(parentEnvironment, pod) {
    super.embody(parentEnvironment, pod);
    this.timedProperties = mop(pod.timedProperties, subpod => this.root.omniReify(this, subpod));
  }

  toPod() {
    const pod = super.toPod();
    pod.timedProperties = mop(this.timedProperties, value => value.toPod());
    return pod;
  }

  owns(id) {
    return super.owns(id) || this.timedProperties.hasOwnProperty(id);
  }

  bind(id, value, fromTime, toTime) {
    if (!this.isTimed(id)) {
      super.bind(id, value);
    } else {
      if (!this.timedProperties.hasOwnProperty(id)) {
        this.timedProperties[id] = new Timeline();
      }
      const timeline = this.timedProperties[id];

      // We are assigning one timeline to another...
      if (value instanceof Timeline) {
        if (fromTime && toTime) {
          timeline.setFromValue(fromTime, value.intervalFrom(fromTime).fromValue);
          timeline.setToValue(toTime, value.intervalTo(toTime).toValue);
        } else if (fromTime) {
          timeline.setFromValue(fromTime, value.intervalFrom(fromTime).fromValue);
        } else if (toTime) {
          timeline.setToValue(toTime, value.intervalTo(toTime).toValue);
        } else {
          timeline.setDefault(value.getDefault());
        }
      } else if (fromTime && toTime) {
        timeline.setFromValue(fromTime, value);
        timeline.setToValue(toTime, value);
      } else if (fromTime) {
        timeline.setFromValue(fromTime, value);
      } else if (toTime) {
        timeline.setToValue(toTime, value);
      } else {
        timeline.setDefault(value);
      }
    }
  }

  // Assumes property exists.
  valueAt(env, property, t) {
    return this.timedProperties[property].valueAt(env, t);
  }

  get(id) {
    let env = this;
    while (env) {
      if (env.untimedProperties.hasOwnProperty(id)) {
        return env.untimedProperties[id];
      } else if (env.timedProperties && env.timedProperties.hasOwnProperty(id)) {
        return env.timedProperties[id];
      }
      env = env.parent;
    }
    return undefined;
  }

  isTimed(id) {
    return this.constructor.timedIds.includes(id);
  }

  applyStroke(env, t, element) {
    if (this.owns('size') && this.owns('color') && this.owns('opacity')) {
      const size = this.valueAt(env, 'size', t);
      const color = this.valueAt(env, 'color', t);
      const opacity = this.valueAt(env, 'opacity', t);
      element.setAttributeNS(null, 'stroke', color.toColor());
      element.setAttributeNS(null, 'stroke-width', size.value);
      element.setAttributeNS(null, 'stroke-opacity', opacity.value);
      if (this.owns('dashes')) {
        const dashes = this.valueAt(env, 'dashes', t).toSpacedString();
        element.setAttributeNS(null, 'stroke-dasharray', dashes);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class Shape extends TimelinedEnvironment {
  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);

    this.id = this.root.serial;
    this.untimedProperties.stroke = Stroke.create(this);
    this.untimedProperties.stroke.bind('opacity', new ExpressionReal(1));
    this.bind('opacity', new ExpressionReal(1));

    this.root.serial += 1;
    this.root.shapes.push(this);
  }

  toPod() {
    const pod = super.toPod();
    pod.id = this.id;
    return pod;
  }

  embody(parentEnvironment, pod) {
    super.embody(parentEnvironment, pod);
    this.id = pod.id;
  }

  static reify(parentEnvironment, pod) {
    if (pod.type === 'rectangle') {
      return Rectangle.reify(parentEnvironment, pod);
    } else if (pod.type === 'circle') {
      return Circle.reify(parentEnvironment, pod);
    } else if (pod.type === 'polygon') {
      return Polygon.reify(parentEnvironment, pod);
    } else {
      throw new Error('unimplemented shape:', pod.type);
    }
  }

  show() {
    this.element.setAttributeNS(null, 'visibility', 'visible');
  }

  hide() {
    this.element.setAttributeNS(null, 'visibility', 'hidden');
  }

  validate() {
    if (!this.owns('color')) {
      throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose color property is not defined.`);
    }
  }

  connect() {
    if (this.owns('parent')) {
      this.parentElement = this.get('parent').getParentingElement();
      this.get('parent').children.push(this);
      this.isDrawable = false;
    } else if (this.owns('template') && this.get('template').value) {
      this.parentElement = this.root.defines;
      this.isDrawable = false;
    } else {
      this.parentElement = this.root.mainGroup;
      this.isDrawable = true;
    }

    if (this.owns('mask')) {
      const mask = this.get('mask');
      const maskParent = document.createElementNS(svgNamespace, 'g');
      maskParent.setAttributeNS(null, 'mask', 'url(#element-' + mask.id + ')');
      maskParent.appendChild(this.element);
      this.parentElement.appendChild(maskParent);
    } else {
      this.parentElement.appendChild(this.element);
    }
  }

  getColor(env, t) {
    const color = this.valueAt(env, 'color', t);
    return color;
  }
}

Object.assign(Shape.prototype, Markable);

// --------------------------------------------------------------------------- 

export class Stroke extends TimelinedEnvironment {
  static type = 'stroke';
  static article = 'a';
  static timedIds = ['size', 'color', 'opacity'];

  static create(parentEnvironment, where) {
    const stroke = new Stroke();
    stroke.initialize(parentEnvironment, where);
    return stroke;
  }

  static reify(parentEnvironment, pod) {
    const stroke = new Stroke();
    stroke.embody(parentEnvironment, pod);
    return stroke;
  }
}

// --------------------------------------------------------------------------- 

export class Rectangle extends Shape {
  static type = 'rectangle';
  static article = 'a';
  static timedIds = ['corner', 'center', 'size', 'color', 'opacity', 'rounding'];

  static create(parentEnvironment, where) {
    const shape = new Rectangle();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Rectangle();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  start() {
    this.element = document.createElementNS(svgNamespace, 'rect');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.connect();

    this.outlineMark = new RectangleMark();
    this.positionMark = new VectorPanMark(this);
    this.widthMark = new HorizontalPanMark(this, this, this.owns('center') ? 2 : 1);
    this.heightMark = new VerticalPanMark(this, this, this.owns('center') ? 2 : 1);

    this.addMarks(this, [this.positionMark, this.widthMark, this.heightMark], [this.outlineMark]);
  }

  validate() {
    super.validate();

    if (this.owns('corner') && this.owns('center')) {
      throw new LocatedException(this.where, 'I found a rectangle whose corner and center properties were both set. Define only one of these.');
    }

    if (!this.owns('corner') && !this.owns('center')) {
      throw new LocatedException(this.where, 'I found a rectangle whose location I couldn\'t figure out. Please define its corner or center.');
    }
    
    this.assertProperty('size');
  }

  update(env, t, bounds) {
    const size = this.valueAt(env, 'size', t);
    this.widthMark.setExpression(size.get(0));
    this.heightMark.setExpression(size.get(1));

    let corner;
    let center;
    if (this.owns('corner')) {
      corner = this.valueAt(env, 'corner', t);
      this.positionMark.setExpression(corner);
    } else {
      center = this.valueAt(env, 'center', t);
      this.positionMark.setExpression(center);
      corner = new ExpressionVector([
        new ExpressionReal(center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(center.get(1).value - size.get(1).value * 0.5),
      ]);
    }

    const opacity = this.valueAt(env, 'opacity', t).value;
    const isVisible = opacity > 0.000001;
    let color;
    if (isVisible) {
      color = this.getColor(env, t);
    }

    if (!corner || !size || (!color && isVisible)) {
      this.hide();
    } else {
      this.show();

      let rounding;
      if (this.owns('rounding')) {
        rounding = this.valueAt(env, 'rounding', t);
        this.element.setAttributeNS(null, 'rx', rounding.value);
        this.element.setAttributeNS(null, 'ry', rounding.value);
      }

      if (this.owns('stroke')) {
        this.untimedProperties.stroke.applyStroke(env, t, this.element);
      }

      this.element.setAttributeNS(null, 'x', corner.get(0).value);
      this.element.setAttributeNS(null, 'y', bounds.span - size.get(1).value - corner.get(1).value);
      this.element.setAttributeNS(null, 'width', size.get(0).value);
      this.element.setAttributeNS(null, 'height', size.get(1).value);
      this.element.setAttributeNS(null, 'fill', isVisible ? color.toColor() : 'none');
      this.element.setAttributeNS(null, 'fill-opacity', opacity);

      this.outlineMark.update(corner, size, bounds, rounding);
      if (center) {
        this.positionMark.update(center, bounds);
        this.widthMark.update(new ExpressionVector([
          new ExpressionReal(center.get(0).value + size.get(0).value * 0.5),
          center.get(1)
        ]), bounds);
        this.heightMark.update(new ExpressionVector([
          center.get(0),
          new ExpressionReal(center.get(1).value + size.get(1).value * 0.5)
        ]), bounds);
      } else {
        this.positionMark.update(corner, bounds);
        this.widthMark.update(new ExpressionVector([
          new ExpressionReal(corner.get(0).value + size.get(0).value),
          corner.get(1)
        ]), bounds);
        this.heightMark.update(new ExpressionVector([
          corner.get(0),
          new ExpressionReal(corner.get(1).value + size.get(1).value)
        ]), bounds);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class Circle extends Shape {
  static type = 'circle';
  static article = 'a';
  static timedIds = ['center', 'radius', 'color', 'opacity'];

  static create(parentEnvironment, where) {
    const shape = new Circle();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Circle();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  start() {
    this.element = document.createElementNS(svgNamespace, 'circle');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.connect();

    this.outlineMark = new CircleMark();
    this.centerMark = new VectorPanMark(this);
    this.radiusMark = new HorizontalPanMark(this);

    this.addMarks(this, [this.centerMark, this.radiusMark], [this.outlineMark]);
  }

  validate() {
    super.validate();
    this.assertProperty('center');
    this.assertProperty('radius');
  }

  update(env, t, bounds) {
    const radius = this.valueAt(env, 'radius', t);
    this.radiusMark.setExpression(radius);

    const center = this.valueAt(env, 'center', t);
    this.centerMark.setExpression(center);

    const opacity = this.valueAt(env, 'opacity', t).value;
    const isVisible = opacity > 0.000001;
    let color;
    if (isVisible) {
      color = this.getColor(env, t);
    }

    if (!center || !radius || (!color && isVisible)) {
      this.hide();
    } else {
      this.show();

      if (this.owns('stroke')) {
        this.untimedProperties.stroke.applyStroke(env, t, this.element);
      }

      this.element.setAttributeNS(null, 'cx', center.get(0).value);
      this.element.setAttributeNS(null, 'cy', bounds.span - center.get(1).value);
      this.element.setAttributeNS(null, 'r', radius.value);
      this.element.setAttributeNS(null, 'fill', isVisible ? color.toColor() : 'none');
      this.element.setAttributeNS(null, 'fill-opacity', opacity);

      this.outlineMark.update(center, radius, bounds);
      this.centerMark.update(center, bounds);
      this.radiusMark.update(new ExpressionVector([
        new ExpressionReal(center.get(0).value + radius.value),
        center.get(1)
      ]), bounds);
    }
  }
}

// --------------------------------------------------------------------------- 

export class Polygon extends Shape {
  static type = 'polygon';
  static article = 'a';
  static timedIds = ['color', 'opacity'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);

    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertex(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtle(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurn(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMove(this)));

    this.nodes = [];
  }

  static create(parentEnvironment, where) {
    const shape = new Polygon();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  toPod() {
    const pod = super.toPod();
    pod.nodes = this.nodes.map(node => node.toPod());
    return pod;
  }

  embody(parentEnvironment, pod) {
    super.embody(parentEnvironment, pod);
    this.nodes = pod.nodes.map(subpod => this.root.omniReify(this, subpod));
  }

  static reify(parentEnvironment, pod) {
    const shape = new Polygon();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  validate() {
    super.validate();
    for (let node of this.nodes) {
      node.validate();
    }
  }

  start() {
    this.element = document.createElementNS(svgNamespace, 'polygon');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.connect();

    for (let node of this.nodes) {
      node.start();
    }

    this.outlineMark = new PolygonMark();
    this.addMarks(this, [...this.nodes.flatMap(node => node.getMarks())], [this.outlineMark]);
  }

  update(env, t, bounds) {
    let currentTurtle = new Turtle(null, null);
    const positions = [];
    for (let node of this.nodes) {
      const result = node.update(env, t, bounds, currentTurtle);
      currentTurtle = result.turtle;
      if (currentTurtle) {
        positions.push(currentTurtle.position);
      }
    }

    const opacity = this.valueAt(env, 'opacity', t).value;
    const isVisible = opacity > 0.000001;
    let color;
    if (isVisible) {
      color = this.getColor(env, t);
    }

    if (positions.some(position => !position) || !color) {
      this.hide();
    } else {
      this.show();

      if (this.owns('stroke')) {
        this.untimedProperties.stroke.applyStroke(env, t, this.element);
      }

      const coordinates = positions.map(p => `${p.get(0).value},${bounds.span - p.get(1).value}`).join(' ');

      // TODO ensure opacity? color?
      this.element.setAttributeNS(null, 'fill-opacity', opacity);
      this.element.setAttributeNS(null, 'points', coordinates);
      this.element.setAttributeNS(null, 'fill', color.toColor());

      this.outlineMark.update(coordinates);
    }
  }
}

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
