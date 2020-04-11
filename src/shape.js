import { 
  FunctionDefinition,
  LocatedException,
  Turtle,
  mop,
  svgNamespace,
} from './common.js';

import {
  TimelinedEnvironment,
} from './environment.js';

import {
  CircleMark,
  DistanceMark,
  HorizontalPanMark,
  Markable,
  PolygonMark,
  PolylineMark,
  RectangleMark,
  RotationMark,
  VectorPanMark,
  VerticalPanMark,
} from './mark.js';

import {
  VertexNode,
} from './node.js';

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
    } else if (pod.type === 'polyline') {
      return Polyline.reify(parentEnvironment, pod);
    } else if (pod.type === 'ungon') {
      return Ungon.reify(parentEnvironment, pod);
    } else if (pod.type === 'line') {
      return Line.reify(parentEnvironment, pod);
    } else if (pod.type === 'text') {
      return Text.reify(parentEnvironment, pod);
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

  start() {
  }

  validate() {
    if (!this.owns('color')) {
      throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose color property is not defined.`);
    }
  }

  update() {
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
}

Object.assign(Shape.prototype, Markable);

// --------------------------------------------------------------------------- 

export class Stroke extends TimelinedEnvironment {
  static type = 'stroke';
  static article = 'a';
  static timedIds = ['size', 'color', 'opacity', 'dashes'];

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

export class Text extends Shape {
  static type = 'text';
  static article = 'a';
  static timedIds = ['position', 'message', 'size', 'color', 'opacity', 'anchor', 'baseline'];

  static create(parentEnvironment, where) {
    const shape = new Text();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Text();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  start() {
    this.element = document.createElementNS(svgNamespace, 'text');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.element.appendChild(document.createTextNode('...'));

    this.connect();

    this.outlineMark = new RectangleMark();
    this.positionMark = new VectorPanMark(this);

    this.addMarks(this, [this.positionMark], [this.outlineMark]);
  }

  validate() {
    super.validate();
    this.assertProperty('position');
    this.assertProperty('message');
    this.assertProperty('color');
    // TODO others?
  }

  update(env, t, bounds) {
    let position = this.valueAt(env, 'position', t);
    this.positionMark.setExpression(position);

    let message = this.valueAt(env, 'message', t);
    let color = this.valueAt(env, 'color', t);

    let fontSize;
    if (this.owns('size')) {
      fontSize = this.valueAt(env, 'size', t);
    } else {
      fontSize = new ExpressionInteger(8);
    }

    let anchor;
    if (this.owns('anchor')) {
      anchor = this.valueAt(env, 'anchor', t);
    } else {
      anchor = new ExpressionString('middle');
    }

    let baseline;
    if (this.owns('baseline')) {
      baseline = this.valueAt(env, 'baseline', t);
    } else {
      baseline = new ExpressionString('center');
    }

    if (!position || !color) {
      this.hide();
    } else {
      this.show();
      this.element.childNodes[0].nodeValue = message.value;
      this.element.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.element.setAttributeNS(null, 'x', position.get(0).value);
      this.element.setAttributeNS(null, 'y', bounds.span - position.get(1).value);
      this.element.setAttributeNS(null, 'fill', color.toColor());
      this.element.setAttributeNS(null, 'font-size', fontSize.value);
      this.element.setAttributeNS(null, 'text-anchor', anchor.value);
      this.element.setAttributeNS(null, 'dominant-baseline', baseline.value);

      // I have to query the SVG element to determine the bounding box of the
      // text.
      const box = this.element.getBBox();
      this.outlineMark.update(new ExpressionVector([
        new ExpressionReal(box.x),
        new ExpressionReal(bounds.span - box.y - box.height),
      ]), new ExpressionVector([
        new ExpressionReal(box.width),
        new ExpressionReal(box.height),
      ]), bounds);

      this.positionMark.update(position, bounds);
    }
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
      color = this.valueAt(env, 'color', t);
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
      color = this.valueAt(env, 'color', t);
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

export class NodedShape extends Shape {
  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    this.nodes = [];
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

  validate() {
    super.validate();
    for (let node of this.nodes) {
      node.validate();
    }
  }

  start() {
    super.start();
    for (let node of this.nodes) {
      node.start();
    }
  }

  generateTurtles(env, t, bounds) {
    let currentTurtle = new Turtle(null, null);
    const turtles = [];
    for (let node of this.nodes) {
      const result = node.update(env, t, bounds, currentTurtle);
      currentTurtle = result.turtle;
      if (currentTurtle) {
        turtles.push(currentTurtle);
      }
    }
    return turtles;
  }
}

// --------------------------------------------------------------------------- 

export class Polygon extends NodedShape {
  static type = 'polygon';
  static article = 'a';
  static timedIds = ['color', 'opacity'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);

    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertex(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtle(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurn(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMove(this)));
  }

  static create(parentEnvironment, where) {
    const shape = new Polygon();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Polygon();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  start() {
    this.element = document.createElementNS(svgNamespace, 'polygon');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.connect();
    super.start();

    this.outlineMark = new PolygonMark();
    this.addMarks(this, [...this.nodes.flatMap(node => node.getMarks())], [this.outlineMark]);
  }

  update(env, t, bounds) {
    const turtles = this.generateTurtles(env, t, bounds);
    const positions = turtles.map(turtle => turtle.position);

    const opacity = this.valueAt(env, 'opacity', t).value;
    const isVisible = opacity > 0.000001;
    let color;
    if (isVisible) {
      color = this.valueAt(env, 'color', t);
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

export class Polyline extends NodedShape {
  static type = 'polyline';
  static article = 'a';
  static timedIds = ['size', 'color', 'opacity', 'dashes'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);

    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertex(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtle(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurn(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMove(this)));
  }

  static create(parentEnvironment, where) {
    const shape = new Polyline();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Polyline();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  validate() {
    super.validate();
    this.assertProperty('size');
    this.assertProperty('color');
  }

  start() {
    this.element = document.createElementNS(svgNamespace, 'polyline');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.element.setAttributeNS(null, 'fill', 'none');

    this.connect();
    super.start();

    this.outlineMark = new PolylineMark();
    this.addMarks(this, [...this.nodes.flatMap(node => node.getMarks())], [this.outlineMark]);
  }

  update(env, t, bounds) {
    const turtles = this.generateTurtles(env, t, bounds);
    const positions = turtles.map(turtle => turtle.position);

    if (positions.some(position => !position)) {
      this.hide();
    } else {
      this.show();
      this.applyStroke(env, t, this.element);
      const coordinates = positions.map(p => `${p.get(0).value},${bounds.span - p.get(1).value}`).join(' ');
      this.element.setAttributeNS(null, 'points', coordinates);
      this.outlineMark.update(coordinates);
    }
  }
}

// --------------------------------------------------------------------------- 

export class Line extends NodedShape {
  static type = 'line';
  static article = 'a';
  static timedIds = ['size', 'color', 'opacity', 'dashes'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);

    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertex(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtle(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurn(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMove(this)));
  }

  static create(parentEnvironment, where) {
    const shape = new Line();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Line();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  validate() {
    super.validate();
    this.assertProperty('size');
    this.assertProperty('color');
    this.assertProperty('opacity');
  }

  start() {
    this.element = document.createElementNS(svgNamespace, 'line');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.connect();
    super.start();

    this.addMarks(this, [...this.nodes.flatMap(node => node.getMarks())], []);
  }

  update(env, t, bounds) {
    const turtles = this.generateTurtles(env, t, bounds);
    const positions = turtles.map(turtle => turtle.position);

    if (positions.length != 2) {
      throw new LocatedException(this.where, `I tried to draw a line that had ${positions.length} ${positions.length == 1 ? 'vertex' : 'vertices'}. Lines must have exactly 2 vertices.`);
    }

    if (positions.some(position => !position)) {
      this.hide();
    } else {
      this.show();
      this.applyStroke(env, t, this.element);

      const coordinates = positions.map(p => `${p.get(0).value},${bounds.span - p.get(1).value}`).join(' ');

      this.element.setAttributeNS(null, 'x1', positions[0].get(0).value);
      this.element.setAttributeNS(null, 'y1', bounds.span - positions[0].get(1).value);
      this.element.setAttributeNS(null, 'x2', positions[1].get(0).value);
      this.element.setAttributeNS(null, 'y2', bounds.span - positions[1].get(1).value);
    }
  }
}

// --------------------------------------------------------------------------- 

export class Ungon extends NodedShape {
  static type = 'ungon';
  static article = 'an';
  static timedIds = ['rounding', 'color', 'opacity'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);

    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertex(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtle(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurn(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMove(this)));
  }

  static create(parentEnvironment, where) {
    const shape = new Ungon();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Ungon();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  validate() {
    super.validate();
    this.assertProperty('color');
    this.assertProperty('rounding');
  }

  start() {
    this.element = document.createElementNS(svgNamespace, 'path');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.connect();
    super.start();

    this.outlineMark = new PolygonMark();
    this.addMarks(this, [...this.nodes.flatMap(node => node.getMarks())], [this.outlineMark]);
  }

  update(env, t, bounds) {
    const turtles = this.generateTurtles(env, t, bounds);
    const positions = turtles.map(turtle => turtle.position);

    if (positions[0].distance(positions[positions.length - 1]) < 1e-3) {
      positions.pop();
    }

    let rounding = this.valueAt(env, 'rounding', t).value;

    const opacity = this.valueAt(env, 'opacity', t).value;
    const isVisible = opacity > 0.000001;
    let color;
    if (isVisible) {
      color = this.valueAt(env, 'color', t);
    }

    if (positions.some(position => !position) || !color) {
      this.hide();
    } else {
      this.show();

      if (this.owns('stroke')) {
        this.untimedProperties.stroke.applyStroke(env, t, this.element);
      }

      const coordinates = positions.map(p => `${p.get(0).value},${bounds.span - p.get(1).value}`).join(' ');
      this.outlineMark.update(coordinates);

      rounding = 1 - rounding;
      let pathCommands = [];
      let start = positions[0].midpoint(positions[1]);
      pathCommands.push(`M ${start.get(0).value},${bounds.span - start.get(1).value}`);
      let previous = start;
      for (let i = 1; i < positions.length; ++i) {
        let mid = positions[i].midpoint(positions[(i + 1) % positions.length]);

        if (rounding) {
          let control1 = previous.interpolateLinear(positions[i], rounding);
          let control2 = mid.interpolateLinear(positions[i], rounding);
          pathCommands.push(`C ${control1.get(0).value},${bounds.span - control1.get(1).value} ${control2.get(0).value},${bounds.span - control2.get(1).value} ${mid.get(0).value},${bounds.span - mid.get(1).value}`);
        } else {
          pathCommands.push(`Q ${positions[i].get(0).value},${bounds.span - positions[i].get(1).value} ${mid.get(0).value},${bounds.span - mid.get(1).value}`);
        }
        previous = mid;
      }

      if (rounding) {
        let control1 = previous.interpolateLinear(positions[0], rounding);
        let control2 = start.interpolateLinear(positions[0], rounding);
        pathCommands.push(`C ${control1.get(0).value},${bounds.span - control1.get(1).value} ${control2.get(0).value},${bounds.span - control2.get(1).value} ${start.get(0).value},${bounds.span - start.get(1).value}`);
      } else {
        pathCommands.push(`Q${positions[0].get(0).value},${bounds.span - positions[0].get(1).value} ${start.get(0).value},${bounds.span - start.get(1).value}`);
      }
      // pathCommands.push('z');

      this.element.setAttributeNS(null, 'd', pathCommands.join(' '));

      this.element.setAttributeNS(null, 'fill-opacity', opacity);
      this.element.setAttributeNS(null, 'points', coordinates);
      this.element.setAttributeNS(null, 'fill', color.toColor());
    }
  }
}

// --------------------------------------------------------------------------- 

