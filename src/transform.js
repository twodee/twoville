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

export class Matrix {
  constructor(elements) {
    this.elements = elements;
  }

  multiplyVector(v) {
    return [
      this.elements[0] * v[0] + this.elements[1] * v[1] + this.elements[2],
      this.elements[3] * v[0] + this.elements[4] * v[1] + this.elements[5],
    ];
  }

  multiplyMatrix(m) {
    return new Matrix([
      this.elements[0] * m.elements[0] + this.elements[1] * m.elements[3] + this.elements[2] * m.elements[6], // row 0, column 0
      this.elements[0] * m.elements[1] + this.elements[1] * m.elements[4] + this.elements[2] * m.elements[7], // row 0, column 1
      this.elements[0] * m.elements[2] + this.elements[1] * m.elements[5] + this.elements[2] * m.elements[8], // row 0, column 1

      this.elements[3] * m.elements[0] + this.elements[4] * m.elements[3] + this.elements[5] * m.elements[6], // row 1, column 0
      this.elements[3] * m.elements[1] + this.elements[4] * m.elements[4] + this.elements[5] * m.elements[7], // row 1, column 1
      this.elements[3] * m.elements[2] + this.elements[4] * m.elements[5] + this.elements[5] * m.elements[8], // row 1, column 1

      this.elements[6] * m.elements[0] + this.elements[7] * m.elements[3] + this.elements[8] * m.elements[6], // row 2, column 0
      this.elements[6] * m.elements[1] + this.elements[7] * m.elements[4] + this.elements[8] * m.elements[7], // row 2, column 1
      this.elements[6] * m.elements[2] + this.elements[7] * m.elements[5] + this.elements[8] * m.elements[8], // row 2, column 1
    ]);
  }

  static identity() {
    return new Matrix([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
  }

  static rotate(degrees) {
    const radians = degrees * Math.PI / 180;
    return new Matrix([
      Math.cos(radians), -Math.sin(radians), 0,
      Math.sin(radians), Math.cos(radians), 0,
      0, 0, 1,
    ]);
  }

  static scale(sx, sy) {
    return new Matrix([
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1,
    ]);
  }

  static translate(dx, dy) {
    return new Matrix([
      1, 0, dx,
      0, 1, dy,
      0, 0, 1,
    ]);
  }

  static skew(sx, sy) {
    return null;
    // TODO
  }
}

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

  update(env, t, bounds, matrix, centroid) {
    const offset = this.valueAt(env, 'offset', t);
    this.offsetMark.setExpression(offset);

    this.offsetMark.update(centroid, bounds, matrix);
    
    return {
      matrix: Matrix.translate(offset.get(0).value, -offset.get(1).value),
      commands: [`translate(${offset.get(0).value} ${-offset.get(1).value})`],
    };
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
    this.assertProperty('degrees');
  }

  start() {
    super.start();

    const foregroundMarks = [];
    if (this.owns('pivot')) {
      this.pivotMark = new VectorPanMark(this.parentEnvironment, this);
      foregroundMarks.push(this.pivotMark);
    }

    this.degreesMark = new RotationMark(this.parentEnvironment, this);
    foregroundMarks.push(this.degreesMark);

    this.marker.addMarks(foregroundMarks, []);
  }

  update(env, t, bounds, matrix, centroid) {
    let pivot;
    if (this.owns('pivot')) {
      pivot = this.valueAt(env, 'pivot', t);
      this.pivotMark.setExpression(pivot);
    } else {
      pivot = centroid;
    }

    const degrees = this.valueAt(env, 'degrees', t);
    this.degreesMark.setExpression(degrees, new ExpressionReal(0), pivot);

    const pivotToOrigin = Matrix.translate(-pivot.get(0).value, -(bounds.span - pivot.get(1).value));
    const rotater = Matrix.rotate(-degrees.value);
    const originToPivot = Matrix.translate(pivot.get(0).value, (bounds.span - pivot.get(1).value));

    const composite = originToPivot.multiplyMatrix(rotater.multiplyMatrix(pivotToOrigin));
    const applied = matrix.multiplyMatrix(composite);

    if (this.owns('pivot')) {
      this.pivotMark.update(pivot, bounds, applied);
    }
    const towardPosition = new ExpressionVector([new ExpressionReal(2), new ExpressionReal(0)]).add(pivot);
    this.degreesMark.update(towardPosition, bounds, applied);
    
    return {
      matrix: composite,
      commands: [`rotate(${-degrees.value} ${pivot.get(0).value} ${bounds.span - pivot.get(1).value})`],
    };
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

  update(env, t, bounds, matrix) {
    const pivot = this.valueAt(env, 'pivot', t);
    this.pivotMark.setExpression(pivot);

    const factors = this.valueAt(env, 'factors', t);
    this.factorMarks[0].setExpression(factors.get(0));
    this.factorMarks[1].setExpression(factors.get(1));

    this.factorMarks[0].update(pivot.add(new ExpressionVector([
      new ExpressionReal(1),
      new ExpressionReal(0),
    ])), bounds, matrix);

    this.factorMarks[1].update(pivot.add(new ExpressionVector([
      new ExpressionReal(0),
      new ExpressionReal(1),
    ])), bounds, matrix);

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
  }

  start() {
    super.start();

    this.factorMarks = [
      new HorizontalPanMark(this.parentEnvironment, this),
      new VerticalPanMark(this.parentEnvironment, this),
    ];

    const foregroundMarks = [...this.factorMarks];
    if (this.owns('pivot')) {
      this.pivotMark = new VectorPanMark(this.parentEnvironment, this);
      foregroundMarks.push(this.pivotMark);
    }

    this.marker.addMarks(foregroundMarks, []);
  }

  update(env, t, bounds, matrix, centroid) {
    let pivot;
    if (this.owns('pivot')) {
      pivot = this.valueAt(env, 'pivot', t);
      this.pivotMark.setExpression(pivot);
    } else {
      pivot = centroid;
    }

    const factors = this.valueAt(env, 'factors', t);
    this.factorMarks[0].setExpression(factors.get(0));
    this.factorMarks[1].setExpression(factors.get(1));

    const pivotToOrigin = Matrix.translate(-pivot.get(0).value, -(bounds.span - pivot.get(1).value));
    const scaler = Matrix.scale(factors.get(0).value, factors.get(1).value);
    const originToPivot = Matrix.translate(pivot.get(0).value, (bounds.span - pivot.get(1).value));

    const composite = originToPivot.multiplyMatrix(scaler.multiplyMatrix(pivotToOrigin));
    const applied = matrix.multiplyMatrix(composite);

    this.factorMarks[0].update(pivot.add(new ExpressionVector([
      new ExpressionReal(1),
      new ExpressionReal(0),
    ])), bounds, applied);
    this.factorMarks[1].update(pivot.add(new ExpressionVector([
      new ExpressionReal(0),
      new ExpressionReal(1),
    ])), bounds, applied);

    if (this.owns('pivot')) {
      this.pivotMark.update(pivot, bounds, applied);
    }

    return {
      matrix: composite,
      commands: [
        `translate(${-pivot.get(0).value} ${(bounds.span - pivot.get(1).value)})`,
        `scale(${factors.get(0).value} ${factors.get(1).value})`,
        `translate(${pivot.get(0).value} ${-(bounds.span - pivot.get(1).value)})`,
      ],
    };
  }
}

