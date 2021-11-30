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
  WedgeMark,
} from './mark.js';

import {
  TimelinedEnvironment,
} from './environment.js';

import {
  Matrix
} from './matrix.js';

// --------------------------------------------------------------------------- 

export class Transform extends TimelinedEnvironment {
  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    parentEnvironment.transforms.unshift(this);
    this.sourceSpans = [];
  }

  deflate() {
    const pod = super.deflate();
    pod.sourceSpans = this.sourceSpans;
    return pod;
  }

  embody(parentEnvironment, pod) {
    super.embody(parentEnvironment, pod);
    this.sourceSpans = pod.sourceSpans.map(subpod => SourceLocation.inflate(subpod));
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

  updateInteractionState(matrix) {
    this.state.matrix = matrix;
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

  static inflate(parentEnvironment, pod, inflater) {
    const node = new Translate();
    node.embody(parentEnvironment, pod, inflater);
    return node;
  }
    
  configureState(bounds) {
    this.configureVectorProperty('offset', this, this.parentEnvironment, this.updateDomCommand.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>translate</code> node whose <code>offset</code> was not set.');
      }

      try {
        timeline.assertList(this.parentEnvironment, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>translate</code> node with an illegal value for <code>offset</code>. ${e.message}`);
      }
    });
  }

  configureMarks() {
    super.configureMarks();

    this.offsetMark = new VectorPanMark(this.parentEnvironment, null, t => {
      return this.expressionAt('offset', this.parentEnvironment.root.state.t);
    }, ([x, y]) => {
      this.state.offset[0] = x;
      this.state.offset[1] = y;
    });

    this.marker.addMarks([], [], [this.offsetMark]);
  }

  updateDomCommand(bounds) {
    this.command = `translate(${this.state.offset[0]} ${-this.state.offset[1]})`;
  }

  toMatrix() {
    return Matrix.translate(this.state.offset[0], this.state.offset[1]);
  }

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);
    this.offsetMark.updateState(this.state.offset, this.state.matrix);
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

  static inflate(parentEnvironment, pod, inflater) {
    const node = new Rotate();
    node.embody(parentEnvironment, pod, inflater);
    return node;
  }
    
  configureState(bounds) {
    this.configureScalarProperty('degrees', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>rotate</code> node whose <code>degrees</code> was not set.');
      }

      try {
        timeline.assertScalar(this, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>rotate</code> node with an illegal value for <code>degrees</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('pivot', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, `I found a <code>${this.type}</code> node whose <code>pivot</code> was not set.`);
      }

      try {
        timeline.assertList(this.parentEnvironment, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>scale</code> node with an illegal value for <code>pivot</code>. ${e.message}`);
      }
    });

    const degreesTimeline = this.timedProperties.degrees;
    const pivotTimeline = this.timedProperties.pivot;

    if (degreesTimeline.isAnimated || pivotTimeline.isAnimated) {
      this.parentEnvironment.updateDoms.push(this.updateDomCommand.bind(this));
    }

    if (degreesTimeline.hasDefault && pivotTimeline.hasDefault) {
      this.updateDomCommand(bounds);
    }
  }

  updateDomCommand(bounds) {
    this.command = `rotate(${-this.state.degrees} ${this.state.pivot[0]} ${bounds.span - this.state.pivot[1]})`;
  }

  configureMarks() {
    super.configureMarks();

    this.degreesMark = new RotationMark(this.parentEnvironment, this, t => {
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

    this.wedgeMark = new WedgeMark();

    this.marker.addMarks([this.pivotMark, this.degreesMark], [], [], [this.wedgeMark]);
  }

  toMatrix() {
    const pivotToOrigin = Matrix.translate(-this.state.pivot[0], -this.state.pivot[1]);
    const rotater = Matrix.rotate(this.state.degrees);
    const originToPivot = Matrix.translate(this.state.pivot[0], this.state.pivot[1]);
    return originToPivot.multiplyMatrix(rotater.multiplyMatrix(pivotToOrigin));
  }

  updateInteractionState(matrix) {
    super.updateInteractionState(matrix);
    this.pivotMark.updateState(this.state.pivot, this.state.matrix);
    this.degreesMark.updateState(this.state.pivot, this.state.degrees, 0, this.state.matrix);
    this.wedgeMark.updateState(this.state.pivot, this.state.degrees, 0, this.state.matrix);
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

  static inflater(parentEnvironment, pod, inflater) {
    const node = new Shear();
    node.embody(parentEnvironment, pod, inflater);
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
        timeline.assertList(this.parentEnvironment, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>scale</code> node with an illegal value for <code>factors</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('pivot', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, `I found a <code>${this.type}</code> node whose <code>pivot</code> was not set.`);
      }

      try {
        timeline.assertList(this.parentEnvironment, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>scale</code> node with an illegal value for <code>pivot</code>. ${e.message}`);
      }
    });

    const factorsTimeline = this.timedProperties.factors;
    const pivotTimeline = this.timedProperties.pivot;

    if (factorsTimeline.isAnimated || pivotTimeline.isAnimated) {
      this.parentEnvironment.updateDoms.push(this.updateDomCommand.bind(this));
    }

    if (factorsTimeline.hasDefault && pivotTimeline.hasDefault) {
      this.updateDomCommand(bounds);
    }
  }

  updateDomCommand(bounds) {
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

  static inflate(parentEnvironment, pod, inflater) {
    const node = new Scale();
    node.embody(parentEnvironment, pod, inflater);
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
        timeline.assertList(this.parentEnvironment, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>scale</code> node with an illegal value for <code>factors</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('pivot', this, this.parentEnvironment, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, `I found a <code>${this.type}</code> node whose <code>pivot</code> was not set.`);
      }

      try {
        timeline.assertList(this.parentEnvironment, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>scale</code> node with an illegal value for <code>pivot</code>. ${e.message}`);
      }
    });

    const factorsTimeline = this.timedProperties.factors;
    const pivotTimeline = this.timedProperties.pivot;

    if (factorsTimeline.isAnimated || pivotTimeline.isAnimated) {
      this.parentEnvironment.updateDoms.push(this.updateDomCommand.bind(this));
    }

    if (factorsTimeline.hasDefault && pivotTimeline.hasDefault) {
      this.updateDomCommand(bounds);
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

    // this.marker.addMarks([this.widthFactorMark, this.heightFactorMark, this.pivotMark], [], [], []);
    this.marker.addMarks([], [], [], []);

    // this.lineMarks = [
      // new LineMark(),
      // new LineMark(),
    // ];
  }

  updateDomCommand(bounds) {
    this.command = `translate(${this.state.pivot[0]} ${bounds.span - this.state.pivot[1]}) scale(${this.state.factors[0]} ${this.state.factors[1]}) translate(${-this.state.pivot[0]} ${-(bounds.span - this.state.pivot[1])})`;
  }

  toMatrix() {
    return Matrix.scale(this.state.factors[0], this.state.factors[1]);
  }

  // updateMarkerDom(bounds, factor, matrix) {
    // this.pivotMark.updateDom(bounds, this.state.pivot, factor, matrix);
    // this.widthFactorMark.updateDom(bounds, [this.state.pivot[0] + this.state.factors[0] * 50, this.state.pivot[1]], factor, matrix);
    // this.heightFactorMark.updateDom(bounds, [this.state.pivot[0], this.state.pivot[1] + this.state.factors[1] * 50], factor, matrix);
  // }
}

