import { 
  classifyArc,
  standardizeDegrees,
  svgNamespace,
} from './common.js';

import { 
  ExpressionAdd,
  ExpressionDivide,
  ExpressionIdentifier,
  ExpressionInteger,
  ExpressionMultiply,
  ExpressionNegative,
  ExpressionPower,
  ExpressionReal,
  ExpressionString,
  ExpressionSubtract,
  ExpressionVector,
} from './ast.js';

import {Matrix} from './matrix.js';

// --------------------------------------------------------------------------- 

export class Marker {
  static RADIAL_MAGNITUDE = 100;

  constructor(shape) {
    this.shape = shape;
    this.situatedForegroundMarks = [];
    this.centeredForegroundMarks = [];
    this.staticBackgroundMarks = [];
    this.dynamicBackgroundMarks = [];
  }

  show() {
    this.showBackgroundMarks();
    this.dynamicBackgroundGroup.setAttributeNS(null, 'visibility', 'visible');
    this.situatedForegroundGroup.setAttributeNS(null, 'visibility', 'visible');
    this.centeredForegroundGroup.setAttributeNS(null, 'visibility', 'visible');
  }

  hover() {
    this.staticBackgroundGroup.classList.add('hovered');
    this.dynamicBackgroundGroup.classList.add('hovered');
    this.situatedForegroundGroup.classList.add('hovered');
    this.centeredForegroundGroup.classList.add('hovered');
    this.show();
  }

  unhover() {
    this.staticBackgroundGroup.classList.remove('hovered');
    this.dynamicBackgroundGroup.classList.remove('hovered');
    this.situatedForegroundGroup.classList.remove('hovered');
    this.centeredForegroundGroup.classList.remove('hovered');
    this.hide();
  }

  showBackgroundMarks() {
    this.staticBackgroundGroup.setAttributeNS(null, 'visibility', 'visible');
    this.dynamicBackgroundGroup.setAttributeNS(null, 'visibility', 'visible');
  }

  hide() {
    this.staticBackgroundGroup.setAttributeNS(null, 'visibility', 'hidden');
    this.dynamicBackgroundGroup.setAttributeNS(null, 'visibility', 'hidden');
    this.situatedForegroundGroup.setAttributeNS(null, 'visibility', 'hidden');
    this.centeredForegroundGroup.setAttributeNS(null, 'visibility', 'hidden');
  }

  setMarks(...marks) {
    this.marks = marks;
  }

  initializeDom(root) {
    // Let marks create their elements first.
    this.marks.forEach(mark => mark.initializeDom(root, this));

    // Then add background marks' elements into the hierarchy.
    this.staticBackgroundGroup = document.createElementNS(svgNamespace, 'g');
    this.staticBackgroundGroup.classList.add('mark-group');
    this.shape.staticBackgroundMarkGroup.appendChild(this.staticBackgroundGroup);

    // Then add foreground marks' elements into the hierarchy.
    this.situatedForegroundGroup = document.createElementNS(svgNamespace, 'g');
    this.situatedForegroundGroup.classList.add('mark-group');
    this.shape.situatedForegroundMarkGroup.appendChild(this.situatedForegroundGroup);

    // Then add midground marks' elements into the hierarchy.
    this.dynamicBackgroundGroup = document.createElementNS(svgNamespace, 'g');
    this.dynamicBackgroundGroup.classList.add('mark-group');
    this.shape.dynamicBackgroundMarkGroup.appendChild(this.dynamicBackgroundGroup);

    // Then add centered foreground marks' elements into the hierarchy.
    this.centeredForegroundGroup = document.createElementNS(svgNamespace, 'g');
    this.centeredForegroundGroup.classList.add('mark-group');
    this.shape.centeredForegroundMarkGroup.appendChild(this.centeredForegroundGroup);

    for (let mark of this.marks) {
      for (let element of mark.staticBackgroundElements) {
        element.classList.add('mark');
        element.classList.add(`tag-${this.shape.id}`);
        this.staticBackgroundGroup.appendChild(element);
      }
      for (let element of mark.dynamicBackgroundElements) {
        element.classList.add('mark');
        element.classList.add(`tag-${this.shape.id}`);
        this.dynamicBackgroundGroup.appendChild(element);
      }
      for (let element of mark.situatedForegroundElements) {
        element.classList.add('mark');
        element.classList.add(`tag-${this.shape.id}`);
        this.situatedForegroundGroup.appendChild(element);
      }
      for (let element of mark.centeredForegroundElements) {
        element.classList.add('mark');
        element.classList.add(`tag-${this.shape.id}`);
        this.centeredForegroundGroup.appendChild(element);
      }
    }

    this.hide();
  }

  deselect() {
    this.hide();
  }

  select() {
    this.staticBackgroundGroup.classList.remove('hovered');
    this.dynamicBackgroundGroup.classList.remove('hovered');
    this.situatedForegroundGroup.classList.remove('hovered');
    this.centeredForegroundGroup.classList.remove('hovered');
    this.show();
  }
}

// --------------------------------------------------------------------------- 

export class Mark {
  constructor() {
    this.initializeState();
    this.staticBackgroundElements = [];
    this.dynamicBackgroundElements = [];
    this.situatedForegroundElements = [];
    this.centeredForegroundElements = [];
  }

  initializeState() {
    this.state = {};
  }
}

// --------------------------------------------------------------------------- 

export class RectangleMark extends Mark {
  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'rect');
    this.staticBackgroundElements.push(this.element);
  }

  synchronizeState(corner, size, rounding) {
    this.state.corner = corner;
    this.state.size = size;
    this.state.rounding = rounding;
  }

  synchronizeDom(bounds) {
    this.element.setAttributeNS(null, 'x', this.state.corner[0]);
    this.element.setAttributeNS(null, 'y', bounds.span - this.state.corner[1] - this.state.size[1]);
    this.element.setAttributeNS(null, 'width', this.state.size[0]);
    this.element.setAttributeNS(null, 'height', this.state.size[1]);
    if (this.state.rounding !== undefined) {
      this.element.setAttributeNS(null, 'rx', this.state.rounding);
      this.element.setAttributeNS(null, 'ry', this.state.rounding);
    }
    // this.element.setAttributeNS(null, 'transform', `matrix(${matrix.elements[0]} ${matrix.elements[3]} ${matrix.elements[1]} ${matrix.elements[4]} ${matrix.elements[2]} ${-matrix.elements[5]})`);
  }
}

// --------------------------------------------------------------------------- 

export class CircleMark extends Mark {
  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'circle');
    this.staticBackgroundElements.push(this.element);
  }

  synchronizeState(center, radius) {
    this.state.center = center;
    this.state.radius = radius;
  }

  synchronizeDom(bounds) {
    this.element.setAttributeNS(null, 'cx', this.state.center[0]);
    this.element.setAttributeNS(null, 'cy', bounds.span - this.state.center[1]);
    this.element.setAttributeNS(null, 'r', this.state.radius);
  }
}

// --------------------------------------------------------------------------- 

export class LineMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'line');
  }

  updateState(a, b) {
    this.a = a;
    this.b = b;
  }

  updateDom(bounds, factor) {
    this.element.setAttributeNS(null, 'x1', this.a[0]);
    this.element.setAttributeNS(null, 'y1', bounds.span - this.a[1]);
    this.element.setAttributeNS(null, 'x2', this.b[0]);
    this.element.setAttributeNS(null, 'y2', bounds.span - this.b[1]);
  }
}

// --------------------------------------------------------------------------- 

export class RayMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'line');
  }

  updateState(axis, pivot) {
    this.axis = axis;
    this.pivot = pivot;
  }

  updateDom(bounds, factor) {
    const length = Marker.RADIAL_MAGNITUDE / factor;

    this.endpoint = [
      this.pivot[0] + this.axis[0] * length,
      this.pivot[1] + this.axis[1] * length
    ];

    this.element.setAttributeNS(null, 'x1', this.pivot[0]);
    this.element.setAttributeNS(null, 'y1', bounds.span - this.pivot[1]);
    this.element.setAttributeNS(null, 'x2', this.endpoint[0]);
    this.element.setAttributeNS(null, 'y2', bounds.span - this.endpoint[1]);
  }
}

// --------------------------------------------------------------------------- 

export class PolygonMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'polygon');
  }

  updateState(coordinates) {
    this.coordinates = coordinates;
  }

  updateDom(bounds, factor) {
    this.element.setAttributeNS(null, 'points', this.coordinates.map(([x, y]) => `${x},${bounds.span - y}`).join(' '));
  }
}

// --------------------------------------------------------------------------- 

export class PathMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'path');
  }

  updateState(commands) {
    this.commands = commands;
  }

  updateDom(bounds, factor) {
    this.element.setAttributeNS(null, 'd', this.commands);
  }

  // setTransform(matrix, bounds) {
    // this.element.setAttributeNS(null, 'transform', `matrix(${matrix.elements[0]} ${matrix.elements[3]} ${matrix.elements[1]} ${matrix.elements[4]} ${matrix.elements[2]} ${-matrix.elements[5]})`);
  // }
}

// --------------------------------------------------------------------------- 

export class WedgeMark extends Mark {
  initializeDom(root, marker) {
    this.element = document.createElementNS(svgNamespace, 'path');
    this.dynamicBackgroundElements.push(this.element);
  }

  synchronizeState(pivot, degrees) {
    this.state.pivot = pivot;
    this.state.degrees = degrees;
  }

  synchronizeDom(bounds, radialLength) {
    const vector = [radialLength, 0];

    const transformedPivot = this.state.pivot; //this.matrix.multiplyPosition(this.pivot);

    const fromRotater = Matrix.rotate(0/*this.priorHeading*/);
    const fromVector = fromRotater.multiplyPosition(vector);
    const fromPosition = [
      transformedPivot[0] + fromVector[0],
      transformedPivot[1] + fromVector[1]
    ];

    // TODO priorHeading
    const toRotater = Matrix.rotate(/*this.priorHeading + */this.state.degrees);
    const toVector = toRotater.multiplyPosition(vector);
    const toPosition = [
      transformedPivot[0] + toVector[0],
      transformedPivot[1] + toVector[1]
    ];

    const {isLarge, isClockwise} = classifyArc(standardizeDegrees(this.state.degrees));
    const commands =
      `M${transformedPivot[0]},${bounds.span - transformedPivot[1]} ` +
      `L${fromPosition[0]},${bounds.span - fromPosition[1]} ` +
      `A ${radialLength},${radialLength} 0 ${isLarge} ${isClockwise} ${toPosition[0]},${bounds.span - toPosition[1]} ` +
      'z';
    this.element.setAttributeNS(null, 'd', commands);
  }
}

// --------------------------------------------------------------------------- 

export class PolylineMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'polyline');
  }

  updateState(coordinates) {
    this.coordinates = coordinates;
  }

  updateDom(bounds, factor) {
    this.element.setAttributeNS(null, 'points', this.coordinates.map(([x, y]) => `${x},${bounds.span - y}`).join(' '));
  }
}

// --------------------------------------------------------------------------- 

export class TweakableMark extends Mark {
  constructor(shape, host, tweakShapeState) {
    super();
    this.shape = shape;
    this.tweakShapeState = tweakShapeState;
    this.host = host ?? shape;
    this.mouseDownAt = null;
    this.isCentered = false;
  }

  center() {
    this.isCentered = true;
  }

  initializeDom(root, marker) {
    this.element = document.createElementNS(svgNamespace, 'g');
    if (this.isCentered) {
      this.centeredForegroundElements.push(this.element);
    } else {
      this.situatedForegroundElements.push(this.element);
    }

    this.circle = document.createElementNS(svgNamespace, 'circle');
    this.circle.classList.add('mark-piece');
    this.circle.classList.add('filled-mark-piece');
    this.circle.classList.add(`tag-${this.shape.id}`);
    this.circle.setAttributeNS(null, 'cx', 0);
    this.circle.setAttributeNS(null, 'cy', 0);
    this.circle.setAttributeNS(null, 'r', 1);
    this.element.appendChild(this.circle);

    this.mouseAtSvg = root.svg.createSVGPoint();

    this.registerListeners(root, marker);
  }

  registerListeners(root, marker) {
    let onMouseDown, onMouseMove, onMouseUp;

    onMouseDown = event => {
      event.stopPropagation();

      // The shape might not be hovered, which makes the marks appear, but not
      // selected. Clicking forces the shape's selection.
      root.select(this.shape, marker.id);

      // I need the expression associated with the mark.
      // I need to record where the mouse is at.
      // I need to figure out what subexpression, if any, will get updated.
      
      // Keep a copy of the original expression around. It's cleaner to build
      // off it it.
      this.untweakedExpression = this.expression.clone();

      // Transform SVG coordinates of mouse to local space.
      this.mouseDownAt = this.transform(root, event);

      this.manipulation = configureManipulation(this.expression);
      this.manipulation.formatReal = x => x.toShortFloat(root.settings.mousePrecision);
      this.manipulation.oldCode = root.startTweak(this.manipulation.where);
      this.manipulation.shape = this.shape;
      root.isTweaking = true;

      this.startManipulation();

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

      // if (this.expression && !this.shape.root.isStale) {
    };

    onMouseMove = event => {
      event.stopPropagation();

      if (event.buttons === 1) {
        let mouseAt = this.transform(root, event);
        let delta = [mouseAt.x - this.mouseDownAt.x, mouseAt.y - this.mouseDownAt.y];
        let replacement = this.manipulate(delta, event.shiftKey, mouseAt, this.manipulation);
        root.tweak(replacement, this.shape);
      }
    };

    onMouseUp = event => {
      event.stopPropagation();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      // this.shape.root.contextualizeCursor(event.toElement);
      root.stopTweak();
      this.stopManipulation();
    };

    this.element.addEventListener('mousedown', onMouseDown);
    
    this.element.addEventListener('mouseleave', event => {
      if (this.shape.isUnhoverTransition(event)) {
        marker.unhover();
      }
      // if (event.buttons === 0) {
        // this.shape.root.contextualizeCursor(event.toElement);
      // }
    });
  }

  transform(root, event) {
    this.mouseAtSvg.x = event.clientX;
    this.mouseAtSvg.y = event.clientY;
    let mouseAt = this.mouseAtSvg.matrixTransform(root.svg.getScreenCTM().inverse());
    mouseAt.y = root.bounds.span - mouseAt.y;
    return mouseAt;
  }

  updateManipulability() {
    this.expression = this.getExpression();
    this.element.classList.toggle('disabled-mark', !this.expression);
  }

  startManipulation() {
  }
  
  stopManipulation() {
  }
}

// --------------------------------------------------------------------------- 

export class PanMark extends TweakableMark {
  constructor(shape, host, tweakShapeState) {
    super(shape, host, tweakShapeState);
  }

  synchronizeState(position, matrix) {
    this.state.position = position;
    const [a, c, e, b, d, f] = matrix.elements;
		const factors = decompose_2d_matrix([a, b, c, d, e, f]);
		this.state.rotation = factors.rotation * 180 / Math.PI;
    this.state.matrix = matrix;
  }

  synchronizeDom(bounds, handleRadius) {
    const transformedPosition = this.state.matrix.multiplyPosition(this.state.position);
    let command = `translate(${transformedPosition[0]} ${bounds.span - transformedPosition[1]})`;
    command += ` rotate(${-this.state.rotation})`;
    this.element.setAttributeNS(null, "transform", `${command} scale(${handleRadius})`);
  }

  addHorizontal() {
    this.horizontal = document.createElementNS(svgNamespace, 'line');
    this.horizontal.setAttributeNS(null, 'x1', -0.6);
    this.horizontal.setAttributeNS(null, 'y1', 0);
    this.horizontal.setAttributeNS(null, 'x2', 0.6);
    this.horizontal.setAttributeNS(null, 'y2', 0);
    this.horizontal.classList.add('cue');
    this.horizontal.classList.add(`tag-${this.shape.id}`);
    this.element.appendChild(this.horizontal);
  }

  addVertical() {
    this.vertical = document.createElementNS(svgNamespace, 'line');
    this.vertical.setAttributeNS(null, 'y1', -0.6);
    this.vertical.setAttributeNS(null, 'x1', 0);
    this.vertical.setAttributeNS(null, 'y2', 0.6);
    this.vertical.setAttributeNS(null, 'x2', 0);
    this.vertical.classList.add('cue');
    this.vertical.classList.add(`tag-${this.shape.id}`);
    this.element.appendChild(this.vertical);
  }

  addArc() {
    this.arc = document.createElementNS(svgNamespace, 'path');
    const degrees = 60;
    const radians = degrees * Math.PI / 180;
    const radius = 0.5;
    const x = radius * Math.cos(radians);
    const y = radius * Math.sin(radians);
    this.arc.setAttributeNS(null, 'd', `M${x},${y} A${radius},${radius} 0 1 0 ${-x},${y}`);
    this.arc.classList.add('cue');
    this.arc.classList.add(`tag-${this.shape.id}`);
    this.element.appendChild(this.arc);
  }
}

// --------------------------------------------------------------------------- 

export class VectorPanMark extends PanMark {
  constructor(shape, host, tweakShapeState) {
    super(shape, host, tweakShapeState);
  }

  initializeDom(root, marker) {
    super.initializeDom(root, marker);
    this.addHorizontal();
    this.addVertical();
  }

  synchronizeExpressions(positionExpression) {
    this.expression = positionExpression;
  }

  manipulate(delta, isShiftModified, mouseAt, manipulation) {
    const inverse = this.state.matrix.invert();
    const untransformedOffset = inverse.multiplyVector(delta);

    let x = manipulation.formatReal(this.untweakedExpression.get(0).value + untransformedOffset[0]);
    let y = manipulation.formatReal(this.untweakedExpression.get(1).value + untransformedOffset[1]);

    if (isShiftModified) {
      x = Math.round(x);
      y = Math.round(y);
    }

    this.expression.set(0, new ExpressionReal(x));
    this.expression.set(1, new ExpressionReal(y));
    this.tweakShapeState([x, y]);

    return '[' + this.expression.get(0).value + ', ' + this.expression.get(1).value + ']';
  }
}

// --------------------------------------------------------------------------- 

export class HorizontalPanMark extends PanMark {
  constructor(shape, host, multiplier = 1, tweakShapeState) {
    super(shape, host, tweakShapeState);
    this.multiplier = multiplier;
  }

  initializeDom(root, marker) {
    super.initializeDom(root, marker);
    this.addHorizontal();
  }

  synchronizeExpressions(positionExpression) {
    this.expression = positionExpression;
  }

  manipulate(delta, isShiftModified, mouseAt, manipulation) {
    const oldValue = this.untweakedExpression.value;
    const inverse = this.state.matrix.invert();
    const untransformedOffset = inverse.multiplyVector(delta);
    const horizontalOffset = untransformedOffset[0];

    let newValue = manipulation.formatReal(oldValue + horizontalOffset * this.multiplier);
    if (isShiftModified) {
      newValue = Math.round(newValue);
    }

    this.expression.value = newValue;
    this.tweakShapeState(newValue);

    const newExpression = new ExpressionReal(newValue);
    return this.manipulation.newCode(newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class VerticalPanMark extends PanMark {
  constructor(shape, host, multiplier = 1, tweakShapeState) {
    super(shape, host, tweakShapeState);
    this.multiplier = multiplier;
  }

  initializeDom(root, marker) {
    super.initializeDom(root, marker);
    this.addVertical();
  }

  synchronizeExpressions(positionExpression) {
    this.expression = positionExpression;
  }

  manipulate(delta, isShiftModified, mouseAt, manipulation) {
    const oldValue = this.untweakedExpression.value;
    const inverse = this.state.matrix.invert();
    const untransformedOffset = inverse.multiplyVector(delta);
    const verticalOffset = untransformedOffset[1];

    let newValue = manipulation.formatReal(oldValue + verticalOffset * this.multiplier);
    if (isShiftModified) {
      newValue = Math.round(newValue);
    }

    this.expression.value = newValue;
    this.tweakShapeState(newValue);

    const newExpression = new ExpressionReal(newValue);
    return this.manipulation.newCode(newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ScaleMark extends PanMark {
  constructor(shape, host, tweakShapeState) {
    super(shape, host, tweakShapeState);
  }

  initializeDom(root, marker) {
    super.initializeDom(root, marker);

    this.pivotToHandleLine = document.createElementNS(svgNamespace, 'line');
    this.pivotToHandleLine.setAttributeNS(null, 'y1', 0);
    this.pivotToHandleLine.setAttributeNS(null, 'x1', 0);
    this.pivotToHandleLine.setAttributeNS(null, 'y2', 0);
    this.pivotToHandleLine.setAttributeNS(null, 'x2', 10);
    this.pivotToHandleLine.classList.add(`tag-${this.shape.id}`);

    this.dynamicBackgroundElements.push(this.pivotToHandleLine);
  }

  synchronizeState(pivot, factor, matrix) {
    super.synchronizeState(pivot, matrix);
    this.state.factor = factor;
    this.state.pivot = pivot;
  }

  synchronizeExpressions(positionExpression) {
    this.expression = positionExpression;
  }

  initializeState() {
    super.initializeState();
    this.state.delta = [0, 0];
  }

  startManipulation() {
    this.state.delta = [0, 0];
    this.state.initialSign = Math.sign(this.state.factor);
  }

  stopManipulation() {
    delete this.state.initialSign;
  }
}

// --------------------------------------------------------------------------- 

export class HorizontalScaleMark extends ScaleMark {
  constructor(shape, host, tweakShapeState) {
    super(shape, host, tweakShapeState);
  }

  initializeDom(root, marker) {
    super.initializeDom(root, marker);
    this.addHorizontal();
  }

  synchronizeDom(bounds, handleRadius, radialLength) {
    const sign = this.state.initialSign ? this.state.initialSign : Math.sign(this.state.factor);
    const transformedPivot = this.state.matrix.multiplyPosition(this.state.pivot);
    const transformedPosition = this.state.matrix.multiplyPosition([
      this.state.position[0] + radialLength * sign + this.state.delta[0],
      this.state.position[1],
    ]);
    let command = `translate(${transformedPosition[0]} ${bounds.span - transformedPosition[1]})`;
    command += ` rotate(${-this.state.rotation})`;
    this.element.setAttributeNS(null, "transform", `${command} scale(${handleRadius})`);

    this.pivotToHandleLine.setAttributeNS(null, 'x1', transformedPivot[0]);
    this.pivotToHandleLine.setAttributeNS(null, 'y1', bounds.span - transformedPivot[1]);
    this.pivotToHandleLine.setAttributeNS(null, 'x2', transformedPosition[0]);
    this.pivotToHandleLine.setAttributeNS(null, 'y2', bounds.span - transformedPosition[1]);
  }

  manipulate(delta, isShiftModified, mouseAt, manipulation) {
    // const oldValue = this.untweakedExpression.value;
    // const inverse = this.state.matrix.invert();
    // const untransformedOffset = inverse.multiplyVector(delta);
    // const horizontalOffset = untransformedOffset[0];

    const factor0 = this.untweakedExpression.value;
    const scale = (mouseAt.x - this.state.pivot[0]) / (this.mouseDownAt.x - this.state.pivot[0]) * factor0;
    this.state.delta = delta;

    let newValue = manipulation.formatReal(scale);
    if (isShiftModified) {
      newValue = Math.round(newValue * 10) / 10;
    }

    this.expression.value = newValue;
    this.tweakShapeState(newValue);

    const newExpression = new ExpressionReal(newValue);
    return this.manipulation.newCode(newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class VerticalScaleMark extends ScaleMark {
  constructor(shape, host, tweakShapeState) {
    super(shape, host, tweakShapeState);
  }

  initializeDom(root, marker) {
    super.initializeDom(root, marker);
    this.addVertical();
  }

  synchronizeDom(bounds, handleRadius, radialLength) {
    const sign = this.state.initialSign ? this.state.initialSign : Math.sign(this.state.factor);
    const transformedPivot = this.state.matrix.multiplyPosition(this.state.pivot);
    const transformedPosition = this.state.matrix.multiplyPosition([
      this.state.position[0],
      this.state.position[1] + radialLength * sign + this.state.delta[1],
    ]);
    let command = `translate(${transformedPosition[0]} ${bounds.span - transformedPosition[1]})`;
    command += ` rotate(${-this.state.rotation})`;
    this.element.setAttributeNS(null, "transform", `${command} scale(${handleRadius})`);

    this.pivotToHandleLine.setAttributeNS(null, 'x1', transformedPivot[0]);
    this.pivotToHandleLine.setAttributeNS(null, 'y1', bounds.span - transformedPivot[1]);
    this.pivotToHandleLine.setAttributeNS(null, 'x2', transformedPosition[0]);
    this.pivotToHandleLine.setAttributeNS(null, 'y2', bounds.span - transformedPosition[1]);
  }

  manipulate(delta, isShiftModified, mouseAt, manipulation) {
    // const oldValue = this.untweakedExpression.value;
    // const inverse = this.state.matrix.invert();
    // const untransformedOffset = inverse.multiplyVector(delta);
    // const horizontalOffset = untransformedOffset[0];

    const factor0 = this.untweakedExpression.value;
    const scale = (mouseAt.y - this.state.pivot[1]) / (this.mouseDownAt.y - this.state.pivot[1]) * factor0;
    this.state.delta = delta;

    let newValue = manipulation.formatReal(scale);
    if (isShiftModified) {
      newValue = Math.round(newValue * 10) / 10;
    }

    this.expression.value = newValue;
    this.tweakShapeState(newValue);

    const newExpression = new ExpressionReal(newValue);
    return this.manipulation.newCode(newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class RotationMark extends PanMark {
  constructor(shape, host, tweakShapeState) {
    super(shape, host, tweakShapeState);
  }

  initializeDom(root, marker) {
    super.initializeDom(root, marker);
    this.addArc();
  }

  synchronizeExpressions(degreesExpression) {
    this.expression = degreesExpression;
  }

  synchronizeState(pivot, degrees, matrix) {
    super.synchronizeState(null, matrix);
    this.state.degrees = degrees;
    this.state.pivot = pivot;
    this.state.matrix = matrix;
  }

  synchronizeDom(bounds, handleRadius, radialLength) {
    const transformedPosition = this.state.matrix.multiplyPosition([
      this.state.pivot[0] + 1 * radialLength,
      this.state.pivot[1] + 0 * radialLength,
    ]);
    let command = `translate(${transformedPosition[0]} ${bounds.span - transformedPosition[1]})`;
    // Don't rotate the arc as is done with other pan marks. The rotation glyph
    // looks more like a rotation cue with the hole at the bottom.
    this.element.setAttributeNS(null, "transform", `${command} scale(${handleRadius})`);
  }

  manipulate(delta, isShiftModified, mouseAt, manipulation) {
    const pivotToMouse = [
      mouseAt.x - this.state.pivot[0],
      mouseAt.y - this.state.pivot[1],
    ];

    const newRadians = Math.atan2(pivotToMouse[0], -pivotToMouse[1]);
    let newDegrees = newRadians * 180 / Math.PI - 90;// - this.priorHeading;

    if (this.untweakedExpression.value < 0) {
      // We were negative and we want to stay that way. 
      while (newDegrees > 0) {
        newDegrees -= 360;
      }
      while (newDegrees < -360) {
        newDegrees += 360;
      }
    } else {
      // We were positive and we want to stay that way.
      while (newDegrees < 0) {
        newDegrees += 360;
      }
      while (newDegrees >= 360) {
        newDegrees -= 360;
      }
    }

    newDegrees = manipulation.formatReal(newDegrees);
    if (isShiftModified) {
      newDegrees = Math.round(newDegrees);
    }

    this.expression.value = newDegrees;
    this.tweakShapeState(newDegrees);

    const newExpression = new ExpressionReal(newDegrees);
    return this.manipulation.newCode(newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class AxisMark extends PanMark {
  constructor(shape, host, tweakShapeState) {
    super(shape, host, tweakShapeState);
    this.addArc();
  }

  updateState(axis, pivot, matrix) {
    this.axis = axis;
    this.pivot = pivot;
    this.matrix = matrix;
    this.updateMatrixState();
  }

  updateDom(bounds, factor, matrix) {
    const length = Marker.RADIAL_MAGNITUDE / factor;

    this.axisPosition = [
      this.pivot[0] + this.axis[0] * length,
      this.pivot[1] + this.axis[1] * length
    ];

    super.updatePositionDom(bounds, factor, this.axisPosition);
  }

  manipulate(delta, isShiftModified, mouseAt, manipulation) {
    const diff = [
      mouseAt.x - this.pivot[0],
      mouseAt.y - this.pivot[1]
    ];

    const magnitude = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);
    diff[0] = (diff[0] / magnitude).toShortFloat(this.shape.root.settings.mousePrecision);
    diff[1] = (diff[1] / magnitude).toShortFloat(this.shape.root.settings.mousePrecision);

    this.expression.set(0, new ExpressionReal(diff[0]));
    this.expression.set(1, new ExpressionReal(diff[1]));
    this.tweakShapeState(diff);

    return '[' + this.expression.get(0).value + ', ' + this.expression.get(1).value + ']';
  }
}

// --------------------------------------------------------------------------- 

export class DistanceMark extends PanMark {
  constructor(shape, host, tweakShapeState) {
    super(shape, host, tweakShapeState);
    this.addHorizontal();
  }

  updateState(position, heading, matrix) {
    this.position = position;
    this.matrix = matrix;
    this.updateMatrixState();
    this.rotation -= heading;
  }

  manipulate(delta, isShiftModified, mouseAt, manipulation) {
    const headingVector = [
      Math.cos(this.host.heading * Math.PI / 180),
      Math.sin(this.host.heading * Math.PI / 180),
    ];

    const mouseVector = [
      mouseAt.x - this.host.position[0],
      mouseAt.y - this.host.position[1],
    ];

    const dot = headingVector[0] * mouseVector[0] + headingVector[1] * mouseVector[1];

    let newDistance = parseFloat(dot.toShortFloat(this.shape.root.settings.mousePrecision));
    if (isShiftModified) {
      newDistance = Math.round(newDistance);
    }

    this.expression.value = newDistance;
    this.tweakShapeState(newDistance);

    const newExpression = new ExpressionReal(newDistance);
    return this.manipulation.newCode(newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class WedgeDegreesMark extends PanMark {
  constructor(shape, host, tweakShapeState) {
    super(shape, host, tweakShapeState);
    this.addArc();
  }

  updateState(position, from, center, matrix) {
    super.updateState(position, matrix);
    this.from = from;
    this.center = center;
  }

  manipulate(delta, isShiftModified, mouseAt, manipulation) {
    // Find vector from center to root position.
    let centerToFrom = [
      this.from[0] - this.center[0],
      this.from[1] - this.center[1]
    ];
    let length = Math.sqrt(centerToFrom[0] * centerToFrom[0] + centerToFrom[1] * centerToFrom[1]);
    centerToFrom[0] /= length;
    centerToFrom[1] /= length;

    // Find vector from center to mouse.
    let centerToMouse = [
      mouseAt.x - this.center[0],
      mouseAt.y - this.center[1],
    ];
    length = Math.sqrt(centerToMouse[0] * centerToMouse[0] + centerToMouse[1] * centerToMouse[1]);
    centerToMouse[0] /= length;
    centerToMouse[1] /= length;

    // Find angle between the two vectors.
    const dot = centerToFrom[0] * centerToMouse[0] + centerToFrom[1] * centerToMouse[1];
    let degrees = Math.acos(dot) * 180 / Math.PI;

    // Because dot is ambiguous, find signed area and adjust angle to be > 180.
    let fromToCenter = [
      this.center[0] - this.from[0],
      this.center[1] - this.from[1]
    ];
    let fromToMouse = [
      mouseAt.x - this.from[0],
      mouseAt.y - this.from[1],
    ];
    const signedArea = fromToCenter[0] * fromToMouse[1] - fromToCenter[1] * fromToMouse[0];

    if (signedArea > 0) {
      degrees = 360 - degrees;
    }

    if (this.untweakedExpression.value < 0) {
      degrees -= 360;
    }

    degrees = parseFloat(degrees.toShortFloat(this.shape.root.settings.mousePrecision))

    if (isShiftModified) {
      degrees = Math.round(degrees);
    }

    this.expression.value = degrees;
    this.tweakShapeState(degrees);

    const newExpression = new ExpressionReal(degrees);
    return this.manipulation.newCode(newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class BumpDegreesMark extends PanMark {
  constructor(shape, host, tweakShapeState) {
    super(shape, host, tweakShapeState);
    this.addHorizontal();
  }

  updateState(to, from, center, degrees, matrix) {
    super.updateState(center, matrix);

    const fromVector = [
      from[0] - center[0],
      from[1] - center[1],
    ];
    const radians = Math.atan2(fromVector[0], -fromVector[1]);
    let fromDegrees = radians * 180 / Math.PI - 90;

    this.rotation = fromDegrees + degrees * 0.5;
    this.to = to;
    this.from = from;
    this.center = center;
  }

  manipulate(delta, isShiftModified, mouseAt, manipulation) {
    let centerToMouse = [
      mouseAt.x - this.center[0],
      mouseAt.y - this.center[1],
    ];

    // The new center will be on a line perpendicular to the vector from
    // the starting point to ending point.
    let fromToVector = [
      this.to[0] - this.from[0],
      this.to[1] - this.from[1],
    ]
    let length = Math.sqrt(fromToVector[0] * fromToVector[0] + fromToVector[1] * fromToVector[1]);
    fromToVector[0] /= length;
    fromToVector[1] /= length;

    let direction = [
      fromToVector[1],
      -fromToVector[0]
    ];

    // Project the mouse point onto the perpendicular.
    let dot = centerToMouse[0] * direction[0] + centerToMouse[1] * direction[1];
    let newCenter = [
      this.center[0] + dot * direction[0],
      this.center[1] + dot * direction[1]
    ];

    // We've figured out the new center. Now we need to figure out how many
    // degrees separate the two points. But we need to preserve the sign of
    // the original expression to make sure the arc travels the same winding.

    const centerFromVector = [
      this.from[0] - newCenter[0],
      this.from[1] - newCenter[1],
    ];
    length = Math.sqrt(centerFromVector[0] * centerFromVector[0] + centerFromVector[1] * centerFromVector[1]);
    centerFromVector[0] /= length;
    centerFromVector[1] /= length;

    const centerToVector = [
      this.to[0] - newCenter[0],
      this.to[1] - newCenter[1],
    ];
    length = Math.sqrt(centerToVector[0] * centerToVector[0] + centerToVector[1] * centerToVector[1]);
    centerToVector[0] /= length;
    centerToVector[1] /= length;

    dot = centerFromVector[0] * centerToVector[0] + centerFromVector[1] * centerToVector[1];
    let degrees = Math.acos(dot) * 180 / Math.PI;

    // Because dot is ambiguous, find signed area and adjust angle to be > 180.
    const fromCenterVector = [
      newCenter[0] - this.from[0],
      newCenter[1] - this.from[1],
    ];
    fromToVector = [
      this.to[0] - this.from[0],
      this.to[1] - this.from[1],
    ]
    const signedArea = fromCenterVector[0] * fromToVector[1] - fromCenterVector[1] * fromToVector[0];

    const signs = [
      Math.sign(signedArea),
      Math.sign(this.untweakedExpression.value),
    ];

    if (signs[0] < 0 && signs[1] < 0) {
      degrees = degrees - 360;
    } else if (signs[0] > 0 && signs[1] < 0) {
      degrees = -degrees;
    } else if (signs[0] > 0 && signs[1] > 0) {
      degrees = 360 - degrees;
    }

    degrees = parseFloat(degrees.toShortFloat(this.shape.root.settings.mousePrecision));

    if (isShiftModified) {
      degrees = Math.round(degrees);
    }

    this.expression.value = degrees;
    this.tweakShapeState(degrees);

    const newExpression = new ExpressionReal(degrees);
    return this.manipulation.newCode(newExpression);
  }
}

// --------------------------------------------------------------------------- 

function configureManipulation(oldEvaluated) {
  const oldValue = oldEvaluated.value;
  const oldUnevaluated = oldEvaluated.unevaluated;

  // Handle parenthesized expressions: (e) -> (e) + delta.
  if (oldEvaluated.unevaluated.isLocked) {
    return {
      where: oldUnevaluated.where,
      newCode: function(newExpression) {
        const newValue = newExpression.value;
        return `${this.oldCode} + ${new ExpressionReal(this.formatReal(newValue - oldValue)).toPretty()}`;
      },
    };
  }

  // Handle raw numbers: e -> f.
  else if (oldUnevaluated.isNumericLiteral()) {
    return {
      where: oldUnevaluated.where,
      newCode: function(newExpression) {
        return newExpression.toPretty();
      },
    };
  }

  // Handle negative numbers: -e -> f.
  else if (oldUnevaluated instanceof ExpressionNegative && oldUnevaluated.operand.isNumericLiteral()) {
    return {
      where: oldUnevaluated.where,
      newCode: function(newExpression) {
        const newValue = newExpression.value;
        if (newValue < 0) {
          return new ExpressionNegative(new ExpressionReal(this.formatReal(-newValue))).toPretty();
        } else {
          return new ExpressionReal(this.formatReal(newValue)).toPretty();
        }
      },
    };
  }

  // Handle additions: e + f -> e + g OR g + f.
  else if (oldUnevaluated instanceof ExpressionAdd) {
    const l = oldUnevaluated.l;
    const r = oldUnevaluated.r;
    if (!r.isLocked) {
      if (r.isNumericLiteral() ||
          (r instanceof ExpressionNegative && r.operand.isNumericLiteral()) ||
          (r instanceof ExpressionIdentifier && oldEvaluated.prevalues[1].unevaluated.isNumericLiteral())) {
        return {
          where: (r instanceof ExpressionIdentifier) ? oldEvaluated.prevalues[1].unevaluated.where : r.where,
          newCode: function(newExpression) {
            const newValue = newExpression.value;
            const rightValue = oldEvaluated.prevalues[1].value;
            const leftValue = oldValue - rightValue;
            const deltaValue = newValue - leftValue;
            return new ExpressionReal(this.formatReal(deltaValue)).toPretty();
          },
        };
      }
    } else if (!l.isLocked) {
      if (l.isNumericLiteral() ||
          (l instanceof ExpressionNegative && l.operand.isNumericLiteral()) ||
          (l instanceof ExpressionIdentifier && oldEvaluated.prevalues[0].unevaluated.isNumericLiteral())) {
        return {
          where: (l instanceof ExpressionIdentifier) ? oldEvaluated.prevalues[0].unevaluated.where : l.where,
          newCode: function(newExpression) {
            const newValue = newExpression.value;
            const leftValue = oldEvaluated.prevalues[0].value;
            const rightValue = oldValue - leftValue;
            const deltaValue = newValue - rightValue;
            return new ExpressionReal(this.formatReal(deltaValue)).toPretty();
          },
        };
      }
    }
  }

  // Handle subtractions: e - f -> e - g OR g - f.
  else if (oldUnevaluated instanceof ExpressionSubtract) {
    const l = oldUnevaluated.l;
    const r = oldUnevaluated.r;
    if (!r.isLocked) {
      if (r.isNumericLiteral() ||
          (r instanceof ExpressionNegative && r.operand.isNumericLiteral()) ||
          (r instanceof ExpressionIdentifier && oldEvaluated.prevalues[1].unevaluated.isNumericLiteral())) {
        return {
          where: (r instanceof ExpressionIdentifier) ? oldEvaluated.prevalues[1].unevaluated.where : r.where,
          newCode: function(newExpression) {
            const newValue = newExpression.value;
            const rightValue = oldEvaluated.prevalues[1].value;
            const leftValue = oldValue + rightValue;
            const deltaValue = leftValue - newValue;
            return new ExpressionReal(this.formatReal(deltaValue)).toPretty();
          },
        };
      }
    } else if (!l.isLocked) {
      if (l.isNumericLiteral() ||
          (l instanceof ExpressionNegative && l.operand.isNumericLiteral()) ||
          (l instanceof ExpressionIdentifier && oldEvaluated.prevalues[0].unevaluated.isNumericLiteral())) {
        return {
          where: (l instanceof ExpressionIdentifier) ? oldEvaluated.prevalues[0].unevaluated.where : l.where,
          newCode: function(newExpression) {
            const newValue = newExpression.value;
            const leftValue = oldEvaluated.prevalues[0].value;
            const rightValue = leftValue - oldValue;
            const deltaValue = newValue + rightValue;
            return new ExpressionReal(this.formatReal(deltaValue)).toPretty();
          },
        };
      }
    }
  }

  // Handle multiplications: e * f -> e * g OR g * f.
  else if (oldUnevaluated instanceof ExpressionMultiply) {
    const l = oldUnevaluated.l;
    const r = oldUnevaluated.r;
    if (!r.isLocked) {
      if (r.isNumericLiteral() ||
          (r instanceof ExpressionNegative && r.operand.isNumericLiteral()) ||
          (r instanceof ExpressionIdentifier && oldEvaluated.prevalues[1].unevaluated.isNumericLiteral())) {
        return {
          where: (r instanceof ExpressionIdentifier) ? oldEvaluated.prevalues[1].unevaluated.where : r.where,
          newCode: function(newExpression) {
            const newValue = newExpression.value;
            const rightValue = oldEvaluated.prevalues[1].value;
            const leftValue = oldValue / rightValue;
            const deltaValue = newValue / leftValue;
            return new ExpressionReal(this.formatReal(deltaValue)).toPretty();
          },
        };
      }
    } else if (!l.isLocked) {
      if (l.isNumericLiteral() ||
          (l instanceof ExpressionNegative && l.operand.isNumericLiteral()) ||
          (l instanceof ExpressionIdentifier && oldEvaluated.prevalues[0].unevaluated.isNumericLiteral())) {
        return {
          where: (l instanceof ExpressionIdentifier) ? oldEvaluated.prevalues[0].unevaluated.where : l.where,
          newCode: function(newExpression) {
            const newValue = newExpression.value;
            const leftValue = oldEvaluated.prevalues[0].value;
            const rightValue = oldValue / leftValue;
            const deltaValue = newValue / rightValue;
            return new ExpressionReal(this.formatReal(deltaValue)).toPretty();
          },
        };
      }
    }
  }

  // Handle divisions: e / f -> e / g OR g / f.
  else if (oldUnevaluated instanceof ExpressionDivide) {
    const l = oldUnevaluated.l;
    const r = oldUnevaluated.r;
    if (!r.isLocked) {
      if (r.isNumericLiteral() ||
          (r instanceof ExpressionNegative && r.operand.isNumericLiteral()) ||
          (r instanceof ExpressionIdentifier && oldEvaluated.prevalues[1].unevaluated.isNumericLiteral())) {
        return {
          where: (r instanceof ExpressionIdentifier) ? oldEvaluated.prevalues[1].unevaluated.where : r.where,
          newCode: function(newExpression) {
            const newValue = newExpression.value;
            const leftValue = oldEvaluated.prevalues[0].value;
            const primeValue = leftValue / newValue;
            return new ExpressionReal(this.formatReal(primeValue)).toPretty();
          },
        };
      }
    } else if (!l.isLocked) {
      if (l.isNumericLiteral() ||
          (l instanceof ExpressionNegative && l.operand.isNumericLiteral()) ||
          (l instanceof ExpressionIdentifier && oldEvaluated.prevalues[0].unevaluated.isNumericLiteral())) {
        return {
          where: (l instanceof ExpressionIdentifier) ? oldEvaluated.prevalues[0].unevaluated.where : l.where,
          newCode: function(newExpression) {
            const newValue = newExpression.value;
            const rightValue = oldEvaluated.prevalues[1].value;
            const primeValue = newValue * rightValue;
            return new ExpressionReal(this.formatReal(primeValue)).toPretty();
          },
        };
      }
    }
  }

  // Handle power: e ^ f -> e ^ g OR g ^ f.
  else if (oldUnevaluated instanceof ExpressionPower) {
    const l = oldUnevaluated.l;
    const r = oldUnevaluated.r;
    if (!r.isLocked) {
      // 1 can't be raised to any value but it's own self.
      if ((r.isNumericLiteral() ||
           (r instanceof ExpressionNegative && r.operand.isNumericLiteral()) ||
           (r instanceof ExpressionIdentifier && oldEvaluated.prevalues[1].unevaluated.isNumericLiteral())) &&
          Math.abs(oldEvaluated.prevalues[0].value - 1) > 0.001){
        return {
          where: (r instanceof ExpressionIdentifier) ? oldEvaluated.prevalues[1].unevaluated.where : r.where,
          newCode: function(newExpression) {
            const newValue = newExpression.value;
            const leftValue = oldEvaluated.prevalues[0].value;
            const primeValue = Math.log(newValue) / Math.log(leftValue);
            return new ExpressionReal(this.formatReal(primeValue)).toPretty();
          },
        };
      }
    } else if (!l.isLocked) {
      if (l.isNumericLiteral() ||
          (l instanceof ExpressionNegative && l.operand.isNumericLiteral()) ||
          (l instanceof ExpressionIdentifier && oldEvaluated.prevalues[0].unevaluated.isNumericLiteral())) {
        return {
          where: (l instanceof ExpressionIdentifier) ? oldEvaluated.prevalues[0].unevaluated.where : l.where,
          newCode: function(newExpression) {
            const newValue = newExpression.value;
            const rightValue = oldEvaluated.prevalues[1].value;
            const primeValue = Math.pow(newValue, 1 / rightValue);
            return new ExpressionReal(this.formatReal(primeValue)).toPretty();
          },
        };
      }
    }
  }

  return {
    where: oldUnevaluated.where,
    newCode: function(newExpression) {
      const newValue = newExpression.value;
      return `${this.oldCode} + ${new ExpressionReal(this.formatReal(newValue - oldValue)).toPretty()}`;
    },
  };
}

// --------------------------------------------------------------------------- 

function decompose_2d_matrix(mat) {
  // http://frederic-wang.fr/decomposition-of-2d-transform-matrices.html
  // https://math.stackexchange.com/questions/13150/extracting-rotation-scale-values-from-2d-transformation-matrix
  var a = mat[0];
  var b = mat[1];
  var c = mat[2];
  var d = mat[3];
  var e = mat[4];
  var f = mat[5];

  var delta = a * d - b * c;

  let result = {
    translation: [e, f],
    rotation: 0,
    scale: [0, 0],
    skew: [0, 0],
  };

  // Apply the QR-like decomposition.
  if (a != 0 || b != 0) {
    var r = Math.sqrt(a * a + b * b);
    result.rotation = b > 0 ? Math.acos(a / r) : -Math.acos(a / r);
    result.scale = [r, delta / r];
    result.skew = [Math.atan((a * c + b * d) / (r * r)), 0];
  } else if (c != 0 || d != 0) {
    var s = Math.sqrt(c * c + d * d);
    result.rotation =
      Math.PI / 2 - (d > 0 ? Math.acos(-c / s) : -Math.acos(c / s));
    result.scale = [delta / s, s];
    result.skew = [0, Math.atan((a * c + b * d) / (s * s))];
  } else {
    // a = b = c = d = 0
  }

  return result;
}
