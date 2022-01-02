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
  HorizontalScaleMark,
  LineMark,
  Marker,
  PathMark,
  RotationMark,
  VectorPanMark,
  VerticalPanMark,
  VerticalScaleMark,
  WedgeMark,
} from './mark.js';

import {
  TimelinedEnvironment,
} from './environment.js';

import {
  ObjectFrame,
} from './frame.js';

import {
  Matrix
} from './matrix.js';

// --------------------------------------------------------------------------- 

export class Transform extends ObjectFrame {
  initialize(shape, where) {
    super.initialize(shape, where);
    shape.addTransform(this);
    this.sourceSpans = [];
  }

  deflate() {
    const object = super.deflate();
    object.sourceSpans = this.sourceSpans;
    return object;
  }

  embody(shape, object, inflater) {
    super.embody(shape, object, inflater);
    this.sourceSpans = object.sourceSpans.map(subobject => SourceLocation.inflate(subobject));
  }

  initializeMarkState() {
    // Shape.addMarker stamps marker with an id that can be used to identify this marker
    // later.
    this.marker = new Marker(this.parentFrame);
    this.parentFrame.addMarker(this.marker);
  }

  castCursor(column, row) {
    return this.sourceSpans.some(span => span.contains(column, row));
  }

  // Get a matrix representation of this transform. This matrix will be used by
  // the marker system to position marks that appear in the transformation
  // chain. The SVG transform commands can't be used to place the marks,
  // because they will possibly distort the shapes of the marks.
  toMatrix() {
    throw Error('unsupported transformation');
  }

  toInverseMatrix() {
    throw Error('unsupported transformation');
  }
}

// --------------------------------------------------------------------------- 

export class Translate extends Transform {
  static type = 'translate';
  static article = 'a';
  static timedIds = ['offset'];

  static create(parentFrame, where) {
    const node = new Translate();
    node.initialize(parentFrame, where);
    return node;
  }

  static inflate(parentFrame, object, inflater) {
    const node = new Translate();
    node.embody(parentFrame, object, inflater);
    return node;
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('offset');

    // Assert types of extent properties.
    this.assertVectorType('offset', 2, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('offset', fromTime, toTime);
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('offset');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('offset');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('offset', t);
  }

  synchronizeDom(t, bounds) {
    this.state.command = `translate(${this.state.offset[0]} ${-this.state.offset[1]})`;
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.offsetMark = new VectorPanMark(this.parentFrame, this, value => this.state.offset = value);
    this.offsetMark.center();
    this.marker.setMarks(this.offsetMark);
  }

  synchronizeMarkExpressions(t) {
    this.offsetMark.synchronizeExpressions(this.expressionAt('offset', t));
  }

  synchronizeMarkState(t, preMatrix, postMatrix, afterMatrix, inverseMatrix) {
    // The mark never moves from the origin. It belongs to a group that is
    // positioned relative to the shape's centroid.
    this.offsetMark.synchronizeState([0, 0], Matrix.identity(), inverseMatrix);
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.offsetMark.synchronizeDom(bounds, handleRadius);
  }

  toMatrix() {
    return Matrix.translate(this.state.offset[0], this.state.offset[1]);
  }

  toInverseMatrix() {
    return Matrix.untranslate(this.state.offset[0], this.state.offset[1]);
  }
}

// --------------------------------------------------------------------------- 

export class Rotate extends Transform {
  static type = 'rotate';
  static article = 'a';
  static timedIds = ['degrees', 'pivot'];

  static create(parentFrame, where) {
    const node = new Rotate();
    node.initialize(parentFrame, where);
    return node;
  }

  static inflate(parentFrame, object, inflater) {
    const node = new Rotate();
    node.embody(parentFrame, object, inflater);
    return node;
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('pivot');
    this.assertProperty('degrees');

    // Assert types of extent properties.
    this.assertVectorType('pivot', 2, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('degrees', [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('pivot', fromTime, toTime);
    this.assertCompleteTimeline('degrees', fromTime, toTime);
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('pivot');
    this.initializeStaticScalarProperty('degrees');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('pivot');
    this.initializeDynamicProperty('degrees');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('pivot', t);
    this.synchronizeStateProperty('degrees', t);
  }

  synchronizeDom(t, bounds) {
    this.state.command = `rotate(${-this.state.degrees} ${this.state.pivot[0]} ${bounds.span - this.state.pivot[1]})`;
  }

  initializeMarkState() {
    super.initializeMarkState();

    this.degreesMark = new RotationMark(this.parentFrame, this, value => this.state.degrees = value);
    this.pivotMark = new VectorPanMark(this.parentFrame, this, value => this.state.pivot = value);
    this.wedgeMark = new WedgeMark();
    this.marker.setMarks(this.degreesMark, this.pivotMark, this.wedgeMark);
  }

  synchronizeMarkExpressions(t) {
    this.degreesMark.synchronizeExpressions(this.expressionAt('degrees', t));
    this.pivotMark.synchronizeExpressions(this.expressionAt('pivot', t));
  }

  synchronizeMarkState(t, preMatrix, postMatrix, afterMatrix, inverseMatrix) {
    this.pivotMark.synchronizeState(this.state.pivot, afterMatrix, inverseMatrix);
    this.degreesMark.synchronizeState(this.state.pivot, this.state.degrees, afterMatrix, inverseMatrix);
    this.wedgeMark.synchronizeState(this.state.pivot, this.state.degrees, afterMatrix);
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.pivotMark.synchronizeDom(bounds, handleRadius);
    this.degreesMark.synchronizeDom(bounds, handleRadius, radialLength);
    this.wedgeMark.synchronizeDom(bounds, radialLength);
  }

  toMatrix() {
    return Matrix.rotateAround(this.state.degrees, this.state.pivot[0], this.state.pivot[1]);
  }

  toInverseMatrix() {
    return Matrix.unrotateAround(this.state.degrees, this.state.pivot[0], this.state.pivot[1]);
  }
}

// --------------------------------------------------------------------------- 

export class Shear extends Transform {
  static type = 'shear';
  static article = 'a';
  static timedIds = ['factors', 'pivot'];

  static create(parentFrame, where) {
    const node = new Shear();
    node.initialize(parentFrame, where);
    return node;
  }

  static inflater(parentFrame, object, inflater) {
    const node = new Shear();
    node.embody(parentFrame, object, inflater);
    return node;
  }

  // validate() {
    // this.assertProperty('factors');
    // this.assertProperty('pivot');
  // }

  // start() {
    // super.start();
    // this.factorMarks = [
      // new HorizontalPanMark(this.parentFrame, this),
      // new VerticalPanMark(this.parentFrame, this),
    // ];
    // this.pivotMark = new VectorPanMark(this.parentFrame, this);
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
    this.configureVectorProperty('factors', this, this.parentFrame, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>scale</code> node whose <code>factors</code> was not set.');
      }

      try {
        timeline.assertList(this.parentFrame, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>scale</code> node with an illegal value for <code>factors</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('pivot', this, this.parentFrame, null, bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, `I found a <code>${this.type}</code> node whose <code>pivot</code> was not set.`);
      }

      try {
        timeline.assertList(this.parentFrame, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found a <code>scale</code> node with an illegal value for <code>pivot</code>. ${e.message}`);
      }
    });

    const factorsTimeline = this.timedProperties.factors;
    const pivotTimeline = this.timedProperties.pivot;

    if (factorsTimeline.isAnimated || pivotTimeline.isAnimated) {
      this.parentFrame.updateDoms.push(this.updateDomCommand.bind(this));
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

  static create(parentFrame, where) {
    const node = new Scale();
    node.initialize(parentFrame, where);
    return node;
  }

  static inflate(parentFrame, object, inflater) {
    const node = new Scale();
    node.embody(parentFrame, object, inflater);
    return node;
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('factors');
    this.assertProperty('pivot');

    // Assert types of extent properties.
    this.assertVectorType('factors', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('pivot', 2, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('factors', fromTime, toTime);
    this.assertCompleteTimeline('pivot', fromTime, toTime);
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('factors');
    this.initializeStaticVectorProperty('pivot');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('factors');
    this.initializeDynamicProperty('pivot');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('factors', t);
    this.synchronizeStateProperty('pivot', t);
  }

  synchronizeDom(t, bounds) {
    this.state.command = `translate(${this.state.pivot[0]} ${bounds.span - this.state.pivot[1]}) scale(${this.state.factors[0]} ${this.state.factors[1]}) translate(${-this.state.pivot[0]} ${-(bounds.span - this.state.pivot[1])})`;
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.widthFactorMark = new HorizontalScaleMark(this.parentFrame, null, value => this.state.factors[0] = value);
    this.heightFactorMark = new VerticalScaleMark(this.parentFrame, null, value => this.state.factors[1] = value);
    this.pivotMark = new VectorPanMark(this.parentFrame, null, position => {
      this.state.pivot[0] = position[0];
      this.state.pivot[1] = position[1];
    });
    this.marker.setMarks(this.widthFactorMark, this.heightFactorMark, this.pivotMark);
  }

  synchronizeMarkExpressions(t) {
    this.pivotMark.synchronizeExpressions(this.expressionAt('pivot', t));
    this.widthFactorMark.synchronizeExpressions(this.expressionAt('factors', t).get(0));
    this.heightFactorMark.synchronizeExpressions(this.expressionAt('factors', t).get(1));
  }

  synchronizeMarkState(t, preMatrix, postMatrix, afterMatrix) {
    this.pivotMark.synchronizeState(this.state.pivot, preMatrix);
    this.widthFactorMark.synchronizeState(this.state.pivot, this.state.factors[0], preMatrix);
    this.heightFactorMark.synchronizeState(this.state.pivot, this.state.factors[1], preMatrix);
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    this.pivotMark.synchronizeDom(bounds, handleRadius);
    this.widthFactorMark.synchronizeDom(bounds, handleRadius, radialLength);
    this.heightFactorMark.synchronizeDom(bounds, handleRadius, radialLength);
  }

  toMatrix() {
    return Matrix.scaleAround(this.state.factors[0], this.state.factors[1], this.state.pivot[0], this.state.pivot[1]);
  }

  toInverseMatrix() {
    return Matrix.unscaleAround(this.state.factors[0], this.state.factors[1], this.state.pivot[0], this.state.pivot[1]);
  }

  // updateProperties(env, t, bounds, matrix) {
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

    // const transformedPivot = applied.multiplyPosition(pivot);
    // const transformedPositionX = applied.multiplyPosition(positionX);
    // const transformedPositionY = applied.multiplyPosition(positionY);

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
}

