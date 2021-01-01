import {
  SourceLocation,
  LocatedException,
  classifyArc,
  standardizeDegrees,
} from './common.js';

import {
  ExpressionInteger,
  ExpressionReal,
  ExpressionVector,
} from './ast.js';

import {
  HorizontalPanMark,
  LineMark,
  Marker,
  PathMark,
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
    parentEnvironment.transforms.unshift(this);
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

  configureMarks() {
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

  configure(bounds) {
    this.state = {};
    this.configureState(bounds);
  }
}

// --------------------------------------------------------------------------- 

export class Translate extends Transform {
  static type = 'translate';
  static article = 'a';
  static timedIds = ['offsets'];

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
    
  configureState(bounds) {
    this.configureVectorProperty('offsets', this, this.parentEnvironment, this.updateCommand.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>translate</code> node whose <code>offsets</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>translate</code> node with an illegal value for <code>offsets</code>. ${e.message}`);
      }
    });
  }

  configureMarks() {
    super.configureMarks();
    this.offsetMark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('offsets', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.state.offsets[0] = x;
      this.state.offsets[1] = y;
    });
    this.marker.addMarks([], [], [this.offsetMark]);
  }

  updateCommand(bounds) {
    this.command = `translate(${this.state.offsets[0]} ${-this.state.offsets[1]})`;
  }

  toMatrix() {
    return Matrix.translate(this.state.offsets[0], this.state.offsets[1]);
  }

  updateMarkerDom(bounds, factor, matrix) {
    this.offsetMark.updateDom(bounds, this.state.offsets, factor, matrix);
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
    
  configureState(bounds) {
    this.configureScalarProperty('degrees', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>rotate</code> node whose <code>degrees</code> was not set.');
      }

      try {
        timeline.assertScalar(ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>rotate</code> node with an illegal value for <code>degrees</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('pivot', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>scale</code> node whose <code>pivot</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>scale</code> node with an illegal value for <code>pivot</code>. ${e.message}`);
      }
    });

    const degreesTimeline = this.timedProperties.degrees;
    const pivotTimeline = this.timedProperties.pivot;

    if (degreesTimeline.isAnimated || pivotTimeline.isAnimated) {
      this.parentEnvironment.updateDoms.push(this.updateCommand.bind(this));
    }

    if (degreesTimeline.hasDefault && pivotTimeline.hasDefault) {
      this.updateCommand(bounds);
    }
  }

  updateCommand(bounds) {
    this.command = `rotate(${-this.state.degrees} ${this.state.pivot[0]} ${bounds.span - this.state.pivot[1]})`;
  }

  configureMarks() {
    super.configureMarks();

    this.degreesMark = new RotationMark(this.parentEnvironment, this, 'pivot', t => {
      return this.expressionAt('degrees', this.parentEnvironment.root.state.t);
    }, degrees => {
      this.state.degrees = degrees;
    });

    this.pivotMark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('pivot', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.state.pivot[0] = x;
      this.state.pivot[1] = y;
    });

    this.wedgeMark = new PathMark();

    this.state.heading = 0;
    this.marker.addMarks([this.pivotMark, this.degreesMark], [], [], [this.wedgeMark]);
  }

  toMatrix() {
    const pivotToOrigin = Matrix.translate(-this.state.pivot[0], -this.state.pivot[1]);
    const rotater = Matrix.rotate(this.state.degrees);
    const originToPivot = Matrix.translate(this.state.pivot[0], this.state.pivot[1]);
    return originToPivot.multiplyMatrix(rotater.multiplyMatrix(pivotToOrigin));
  }

  updateMarkerDom(bounds, factor, matrix) {
    this.pivotMark.updateDom(bounds, this.state.pivot, factor, matrix);

    const length = 10;
    const rotater = Matrix.rotate(this.state.degrees);
    const axis = [length, 0];
    const rotatedAxis = rotater.multiplyVector(axis);
    const degreesPosition = [
      this.state.pivot[0] + rotatedAxis[0],
      this.state.pivot[1] + rotatedAxis[1]
    ];
    this.degreesMark.updateDom(bounds, degreesPosition, factor, matrix);

    const {isLarge, isClockwise} = classifyArc(standardizeDegrees(this.state.degrees));
    const commands = 
      `M${this.state.pivot[0]},${bounds.span - this.state.pivot[1]} ` +
      `L${this.state.pivot[0] + axis[0]},${bounds.span - (this.state.pivot[1] + axis[1])} ` +
      `A ${length},${length} 0 ${isLarge} ${isClockwise} ${degreesPosition[0]},${bounds.span - degreesPosition[1]} ` +
      'z';
    this.wedgeMark.updateDom(bounds, commands);
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

  // validate() {
    // this.assertProperty('factors');
    // this.assertProperty('pivot');
  // }

  // start() {
    // super.start();
    // this.factorMarks = [
      // new HorizontalPanMark(this.parentEnvironment, this),
      // new VerticalPanMark(this.parentEnvironment, this),
    // ];
    // this.pivotMark = new VectorPanMark(this.parentEnvironment, this);
    // this.marker.addMarks(this.factorMarks, []);
  // }

  // updateProperties(env, t, bounds, matrix) {
    // const pivot = this.valueAt(env, 'pivot', t);
    // this.pivotMark.setExpression(pivot);

    // const factors = this.valueAt(env, 'factors', t);
    // this.factorMarks[0].setExpression(factors.get(0));
    // this.factorMarks[1].setExpression(factors.get(1));

    // this.factorMarks[0].updateProperties(pivot.add(new ExpressionVector([
      // new ExpressionReal(1),
      // new ExpressionReal(0),
    // ])), bounds, matrix);

    // this.factorMarks[1].updateProperties(pivot.add(new ExpressionVector([
      // new ExpressionReal(0),
      // new ExpressionReal(1),
    // ])), bounds, matrix);

    // let shearMatrix = `matrix(1 ${factors.get(1).value} ${factors.get(0).value} 1 0 0)`;
    // return [
      // `translate(${-pivot.get(0).value} ${(bounds.span - pivot.get(1).value)})`,
      // shearMatrix,
      // `translate(${pivot.get(0).value} ${-(bounds.span - pivot.get(1).value)})`,
    // ];
  // }

  configureState(bounds) {
    this.configureVectorProperty('factors', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>scale</code> node whose <code>factors</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>scale</code> node with an illegal value for <code>factors</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('pivot', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>scale</code> node whose <code>pivot</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>scale</code> node with an illegal value for <code>pivot</code>. ${e.message}`);
      }
    });

    const factorsTimeline = this.timedProperties.factors;
    const pivotTimeline = this.timedProperties.pivot;

    if (factorsTimeline.isAnimated || pivotTimeline.isAnimated) {
      this.parentEnvironment.updateDoms.push(this.updateCommand.bind(this));
    }

    if (factorsTimeline.hasDefault && pivotTimeline.hasDefault) {
      this.updateCommand(bounds);
    }
  }

  updateCommand(bounds) {
    this.command = `translate(${-this.pivot[0]} ${bounds.span - this.pivot[1]}) matrix(1 ${this.factors[1]} ${this.factors[0]} 1 0 0) translate(${this.pivot[0]} ${-(bounds.span - this.pivot[1])})`;
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

  // start() {
    // this.factorMarks = [
      // new HorizontalPanMark(this.parentEnvironment, this),
      // new VerticalPanMark(this.parentEnvironment, this),
    // ];

    // this.lineMarks = [
      // new LineMark(),
      // new LineMark(),
    // ];

    // this.pivotMark = new VectorPanMark(this.parentEnvironment, this);
    // this.marker.addMarks([...this.factorMarks, this.pivotMark], [], [], this.lineMarks);
  // }

  // updateProperties(env, t, bounds, matrix) {
    // let pivot = this.valueAt(env, 'pivot', t);
    // this.pivotMark.setExpression(pivot);

    // const factors = this.valueAt(env, 'factors', t);
    // this.factorMarks[0].setExpression(factors.get(0));
    // this.factorMarks[1].setExpression(factors.get(1));

    // const pivotToOrigin = Matrix.translate(-pivot.get(0).value, -pivot.get(1).value);
    // const scaler = Matrix.scale(factors.get(0).value, factors.get(1).value);
    // const originToPivot = Matrix.translate(pivot.get(0).value, pivot.get(1).value);

    // const composite = originToPivot.multiplyMatrix(scaler.multiplyMatrix(pivotToOrigin));
    // const applied = matrix.multiplyMatrix(composite);

    // const positionX = new ExpressionVector([
      // new ExpressionReal(1),
      // new ExpressionReal(0),
    // ]).add(pivot);

    // const positionY = new ExpressionVector([
      // new ExpressionReal(0),
      // new ExpressionReal(1),
    // ]).add(pivot);

    // this.factorMarks[0].updateProperties(positionX, bounds, applied);
    // this.factorMarks[1].updateProperties(positionY, bounds, applied);

    // const transformedPivot = applied.multiplyVector(pivot);
    // const transformedPositionX = applied.multiplyVector(positionX);
    // const transformedPositionY = applied.multiplyVector(positionY);

    // this.lineMarks[0].updateProperties(transformedPivot, transformedPositionX, bounds, matrix);
    // this.lineMarks[1].updateProperties(transformedPivot, transformedPositionY, bounds, matrix);

    // this.pivotMark.updateProperties(pivot, bounds, applied);

    // return {
      // matrix: applied,
      // commands: [
        // `translate(${pivot.get(0).value} ${(bounds.span - pivot.get(1).value)})`,
        // `scale(${factors.get(0).value} ${factors.get(1).value})`,
        // `translate(${-pivot.get(0).value} ${-(bounds.span - pivot.get(1).value)})`,
      // ],
    // };
  // }

  configureState(bounds) {
    this.configureVectorProperty('factors', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>scale</code> node whose <code>factors</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>scale</code> node with an illegal value for <code>factors</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('pivot', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>scale</code> node whose <code>pivot</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>scale</code> node with an illegal value for <code>pivot</code>. ${e.message}`);
      }
    });

    const factorsTimeline = this.timedProperties.factors;
    const pivotTimeline = this.timedProperties.pivot;

    if (factorsTimeline.isAnimated || pivotTimeline.isAnimated) {
      this.parentEnvironment.updateDoms.push(this.updateCommand.bind(this));
    }

    if (factorsTimeline.hasDefault && pivotTimeline.hasDefault) {
      this.updateCommand(bounds);
    }
  }

  configureMarks() {
    super.configureMarks();

    this.widthFactorMark = new HorizontalPanMark(this.parentEnvironment, null, 1, t => {
      return this.expressionAt('factors', this.parentEnvironment.root.state.t).get(0);
    }, factor => {
      this.state.factors[0] = factor;
    });

    this.heightFactorMark = new VerticalPanMark(this.parentEnvironment, null, 1, t => {
      const f = this.expressionAt('factors', this.parentEnvironment.root.state.t).get(1);
      console.log("f:", f);
      return f;
    }, factor => {
      this.state.factors[1] = factor;
    });

    this.pivotMark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('pivot', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.state.pivot[0] = x;
      this.state.pivot[1] = y;
    });

    this.marker.addMarks([this.widthFactorMark, this.heightFactorMark, this.pivotMark], [], [], []);

    // this.lineMarks = [
      // new LineMark(),
      // new LineMark(),
    // ];
  }

  updateCommand(bounds) {
    this.command = `translate(${this.state.pivot[0]} ${bounds.span - this.state.pivot[1]}) scale(${this.state.factors[0]} ${this.state.factors[1]}) translate(${-this.state.pivot[0]} ${-(bounds.span - this.state.pivot[1])})`;
  }

  toMatrix() {
    return Matrix.scale(this.state.factors[0], this.state.factors[1]);
  }

  updateMarkerDom(bounds, factor, matrix) {
    this.pivotMark.updateDom(bounds, this.state.pivot, factor, matrix);
    this.widthFactorMark.updateDom(bounds, [this.state.pivot[0] + this.state.factors[0] * 50, this.state.pivot[1]], factor, matrix);
    this.heightFactorMark.updateDom(bounds, [this.state.pivot[0], this.state.pivot[1] + this.state.factors[1] * 50], factor, matrix);
  }
}

