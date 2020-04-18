import {
  SourceLocation,
} from './common.js';

import {
  ExpressionReal,
  ExpressionVector,
} from './ast.js';

import {
  HorizontalPanMark,
  Marker,
  RotationMark,
  VectorPanMark,
  VerticalPanMark,
} from './mark.js';

import {
  TimelinedEnvironment,
} from './environment.js';

// --------------------------------------------------------------------------- 

export class Transform extends TimelinedEnvironment {
  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    parentEnvironment.transforms.push(this);
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

export class Translate extends Transform {
  static type = 'translate';
  static article = 'a';
  static timedIds = ['offset'];

  static create(parentEnvironment, where) {
    const node = new Translate();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new Translate();
    node.embody(parentEnvironment, pod);
    return node;
  }

  validate() {
    this.assertProperty('offset');
  }

  start() {
    super.start();
    this.offsetMark = new VectorPanMark(this.parentEnvironment, this);
    this.marker.addMarks([this.offsetMark], []);
  }

  update(env, t, bounds, fromTurtle) {
    const offset = this.valueAt(env, 'offset', t);
    this.offsetMark.setExpression(offset);

    this.offsetMark.update(this.parentEnvironment.centroid, bounds);
    
    return [`translate(${offset.get(0).value} ${-offset.get(1).value})`];
  }
}

// --------------------------------------------------------------------------- 

export class Rotate extends Transform {
  static type = 'rotate';
  static article = 'a';
  static timedIds = ['degrees', 'pivot'];

  static create(parentEnvironment, where) {
    const node = new Rotate();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new Rotate();
    node.embody(parentEnvironment, pod);
    return node;
  }

  validate() {
    this.assertProperty('pivot');
    this.assertProperty('degrees');
  }

  start() {
    super.start();
    this.pivotMark = new VectorPanMark(this.parentEnvironment, this);
    this.degreesMark = new RotationMark(this.parentEnvironment, this);
    this.marker.addMarks([this.pivotMark, this.degreesMark], []);
  }

  update(env, t, bounds, fromTurtle) {
    const pivot = this.valueAt(env, 'pivot', t);
    this.pivotMark.setExpression(pivot);

    const degrees = this.valueAt(env, 'degrees', t);
    this.degreesMark.setExpression(degrees, new ExpressionReal(0), pivot);

    this.pivotMark.update(pivot, bounds);
    const towardPosition = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]).add(pivot);
    this.degreesMark.update(towardPosition, bounds);
    
    return [`rotate(${-degrees.value} ${pivot.get(0).value} ${bounds.span - pivot.get(1).value})`];
  }
}

// --------------------------------------------------------------------------- 

export class Shear extends Transform {
  static type = 'shear';
  static article = 'a';
  static timedIds = ['factors', 'pivot'];

  static create(parentEnvironment, where) {
    const node = new Shear();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new Shear();
    node.embody(parentEnvironment, pod);
    return node;
  }

  validate() {
    this.assertProperty('factors');
    this.assertProperty('pivot');
  }

  start() {
    super.start();
    this.factorMarks = [
      new HorizontalPanMark(this.parentEnvironment, this),
      new VerticalPanMark(this.parentEnvironment, this),
    ];
    this.pivotMark = new VectorPanMark(this.parentEnvironment, this);
    this.marker.addMarks(this.factorMarks, []);
  }

  update(env, t, bounds, fromTurtle) {
    const pivot = this.valueAt(env, 'pivot', t);
    this.pivotMark.setExpression(pivot);

    const factors = this.valueAt(env, 'factors', t);
    this.factorMarks[0].setExpression(factors.get(0));
    this.factorMarks[1].setExpression(factors.get(1));

    this.factorMarks[0].update(pivot.add(new ExpressionVector([
      new ExpressionReal(1),
      new ExpressionReal(0),
    ])), bounds);

    this.factorMarks[1].update(pivot.add(new ExpressionVector([
      new ExpressionReal(0),
      new ExpressionReal(1),
    ])), bounds);

    let shearMatrix = `matrix(1 ${factors.get(1).value} ${factors.get(0).value} 1 0 0)`;
    return [
      `translate(${-pivot.get(0).value} ${(bounds.span - pivot.get(1).value)})`,
      shearMatrix,
      `translate(${pivot.get(0).value} ${-(bounds.span - pivot.get(1).value)})`,
    ];
  }
}

// --------------------------------------------------------------------------- 

export class Scale extends Transform {
  static type = 'scale';
  static article = 'a';
  static timedIds = ['factors', 'pivot'];

  static create(parentEnvironment, where) {
    const node = new Scale();
    node.initialize(parentEnvironment, where);
    return node;
  }

  static reify(parentEnvironment, pod) {
    const node = new Scale();
    node.embody(parentEnvironment, pod);
    return node;
  }

  validate() {
    this.assertProperty('factors');
    this.assertProperty('pivot');
  }

  start() {
    super.start();
    this.factorMarks = [
      new HorizontalPanMark(this.parentEnvironment, this),
      new VerticalPanMark(this.parentEnvironment, this),
    ];
    this.pivotMark = new VectorPanMark(this.parentEnvironment, this);
    this.marker.addMarks(this.factorMarks, []);
  }

  update(env, t, bounds, fromTurtle) {
    const pivot = this.valueAt(env, 'pivot', t);
    this.pivotMark.setExpression(pivot);

    const factors = this.valueAt(env, 'factors', t);
    this.factorMarks[0].setExpression(factors.get(0));
    this.factorMarks[1].setExpression(factors.get(1));

    this.factorMarks[0].update(pivot.add(new ExpressionVector([
      new ExpressionReal(1),
      new ExpressionReal(0),
    ])), bounds);
    this.factorMarks[1].update(pivot.add(new ExpressionVector([
      new ExpressionReal(0),
      new ExpressionReal(1),
    ])), bounds);

    return [
      `translate(${-pivot.get(0).value} ${(bounds.span - pivot.get(1).value)})`,
      `scale(${factors.get(0).value} ${factors.get(1).value})`,
      `translate(${pivot.get(0).value} ${-(bounds.span - pivot.get(1).value)})`,
    ];
  }
}

