import { 
  svgNamespace,
} from './common.js';

import { 
  ExpressionInteger,
  ExpressionReal,
  ExpressionString,
  ExpressionVector,
} from './ast.js';

// --------------------------------------------------------------------------- 

export class Marker {
  constructor(shape) {
    this.shape = shape;
  }

  showMarks() {
    this.showBackgroundMarks();
    this.foregroundMarkGroup.setAttributeNS(null, 'visibility', 'visible');
  }

  hoverMarks() {
    this.backgroundMarkGroup.classList.add('hovered');
    this.foregroundMarkGroup.classList.add('hovered');
    this.showMarks();
  }

  unhoverMarks() {
    this.backgroundMarkGroup.classList.remove('hovered');
    this.foregroundMarkGroup.classList.remove('hovered');
    this.hideMarks();
  }

  showBackgroundMarks() {
    this.backgroundMarkGroup.setAttributeNS(null, 'visibility', 'visible');
  }

  hideMarks() {
    this.backgroundMarkGroup.setAttributeNS(null, 'visibility', 'hidden');
    this.foregroundMarkGroup.setAttributeNS(null, 'visibility', 'hidden');
  }

  addMarks(foregroundMarks, backgroundMarks) {
    this.backgroundMarks = backgroundMarks;
    this.foregroundMarks = foregroundMarks;

    this.backgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.backgroundMarkGroup.classList.add('mark-group');
    for (let mark of this.backgroundMarks) {
      mark.element.classList.add('mark');
      mark.element.classList.add(`tag-${this.shape.id}`);
      this.backgroundMarkGroup.appendChild(mark.element);
    }

    this.foregroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.foregroundMarkGroup.classList.add('mark-group');
    for (let mark of this.foregroundMarks) {
      mark.element.classList.add('mark');
      mark.element.classList.add(`tag-${this.shape.id}`);
      this.foregroundMarkGroup.appendChild(mark.element);
    }

    this.hideMarks();
    this.registerListeners();
  }

  deselect() {
    this.hideMarks();
  }

  select() {
    this.backgroundMarkGroup.classList.remove('hovered');
    this.foregroundMarkGroup.classList.remove('hovered');
    this.showMarks();
  }

  unscale(factor) {
    for (let mark of this.foregroundMarks) {
      mark.unscale(factor);
    }
  }

  updateForegroundTransforms(matrix) {
    for (let mark of this.foregroundMarks) {
      mark.updateTransform(matrix);
    }
  }

  registerListeners() {
    for (let mark of [...this.backgroundMarks, ...this.foregroundMarks]) {
      mark.element.addEventListener('mouseenter', event => {
        if (event.buttons === 0) {
          this.shape.root.contextualizeCursor(event.toElement);
        }
      });

      mark.element.addEventListener('mouseleave', event => {
        if (this.isUnhoverTransition(event)) {
          this.unhoverMarks();
        }

        if (event.buttons === 0) {
          this.shape.root.contextualizeCursor(event.toElement);
        }
      });
    }
  }

  isUnhoverTransition(event) {
    // Only turn off marks if shape wasn't explicitly click-selected and the
    // mouse is dragged onto to some other entity that isn't the shape or its
    // marks.
    return !this.shape.isSelected && (!event.toElement || !event.toElement.classList.contains(`tag-${this.shape.id}`));
  }
}

// --------------------------------------------------------------------------- 

export class RectangleMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'rect');
  }

  update(position, size, bounds, rounding, matrix) {
    this.element.setAttributeNS(null, 'x', position.get(0).value);
    this.element.setAttributeNS(null, 'y', bounds.span - position.get(1).value - size.get(1).value);
    this.element.setAttributeNS(null, 'width', size.get(0).value);
    this.element.setAttributeNS(null, 'height', size.get(1).value);
    if (rounding) {
      this.element.setAttributeNS(null, 'rx', rounding.value);
      this.element.setAttributeNS(null, 'ry', rounding.value);
    }
  }
}

// --------------------------------------------------------------------------- 

export class CircleMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'circle');
  }

  update(center, radius, bounds, matrix) {
    this.element.setAttributeNS(null, 'cx', center.get(0).value);
    this.element.setAttributeNS(null, 'cy', bounds.span - center.get(1).value);
    this.element.setAttributeNS(null, 'r', radius.value);
  }
}

// --------------------------------------------------------------------------- 

export class LineMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'line');
  }

  update(a, b, bounds, matrix) {
    this.element.setAttributeNS(null, 'x1', a.get(0).value);
    this.element.setAttributeNS(null, 'y1', bounds.span - a.get(1).value);
    this.element.setAttributeNS(null, 'x2', b.get(0).value);
    this.element.setAttributeNS(null, 'y2', bounds.span - b.get(1).value);
  }
}

// --------------------------------------------------------------------------- 

export class PolygonMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'polygon');
  }

  update(coordinates, matrix) {
    this.element.setAttributeNS(null, 'points', coordinates);
  }
}

// --------------------------------------------------------------------------- 

export class PathMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'path');
  }

  update(commands, matrix) {
    this.element.setAttributeNS(null, 'd', commands);
  }
}

// --------------------------------------------------------------------------- 

export class PolylineMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'polyline');
  }

  update(coordinates, matrix) {
    this.element.setAttributeNS(null, 'points', coordinates);
  }
}

// --------------------------------------------------------------------------- 

export class TweakableMark {
  constructor(shape, component, cursor) {
    this.shape = shape;
    this.component = component ?? shape;
    this.mouseDownAt = null;

    this.element = document.createElementNS(svgNamespace, 'g');
    this.element.classList.add(cursor);
    this.element.addEventListener('mousedown', this.onMouseDown);

    this.circle = document.createElementNS(svgNamespace, 'circle');
    this.circle.classList.add('mark');
    this.circle.classList.add('filled-mark');
    this.circle.setAttributeNS(null, 'cx', 0);
    this.circle.setAttributeNS(null, 'cy', 0);
    this.circle.setAttributeNS(null, 'r', 1);
    this.element.appendChild(this.circle);

    this.mouseAtSvg = this.shape.root.svg.createSVGPoint();
  }

  transform(event) {
    this.mouseAtSvg.x = event.clientX;
    this.mouseAtSvg.y = event.clientY;
    let mouseAt = this.mouseAtSvg.matrixTransform(this.shape.root.svg.getScreenCTM().inverse());
    mouseAt.y = this.shape.root.bounds.span - mouseAt.y;
    return mouseAt;
  }

  setExpression(expression) {
    this.expression = expression;
  }

  onMouseDown = event => {
    event.stopPropagation();

    if (!this.shape.root.isStale) {
      this.untweakedExpression = this.expression.clone();
      this.mouseDownAt = this.transform(event);
      this.shape.root.select(this.shape);
      this.shape.root.startTweak(this.expression.unevaluated.where);
      this.shape.root.isTweaking = true;
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseUp);
    }
  };

  onMouseMove = event => {
    event.stopPropagation();

    if (event.buttons === 1) {
      let mouseAt = this.transform(event);
      let delta = [mouseAt.x - this.mouseDownAt.x, mouseAt.y - this.mouseDownAt.y];
      let replacement = this.getNewSource(delta, event.shiftKey, mouseAt);
      this.shape.root.tweak(replacement);
    }
  };

  onMouseUp = event => {
    event.stopPropagation();
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.shape.root.contextualizeCursor(event.toElement);
    this.shape.root.stopTweak();
  };
}

// --------------------------------------------------------------------------- 

export class PanMark extends TweakableMark {
  constructor(shape, component, cursor) {
    super(shape, component, cursor);
  }

  update(position, bounds, matrix) {
    this.cx = position.get(0).value;
    this.cy = bounds.span - position.get(1).value;
  }

  updateTransform(matrix) {
    this.transformedPosition = matrix.multiplyVector([this.cx, this.cy]);
    this.element.setAttributeNS(null, "transform", `translate(${this.transformedPosition[0]} ${this.transformedPosition[1]})`);
  }

  unscale(factor) {
    this.element.setAttributeNS(null, "transform", `scale(${6 / factor}) translate(${this.transformedPosition[0]} ${this.transformedPosition[1]})`);
    this.element.setAttributeNS(null, "transform", `translate(${this.transformedPosition[0]} ${this.transformedPosition[1]}) scale(${6 / factor})`);
  }
}

// --------------------------------------------------------------------------- 

export class VectorPanMark extends PanMark {
  constructor(shape, component) {
    super(shape, component, 'cursor-pan');

    this.horizontal = document.createElementNS(svgNamespace, 'line');
    this.horizontal.setAttributeNS(null, 'x1', -0.6);
    this.horizontal.setAttributeNS(null, 'y1', 0);
    this.horizontal.setAttributeNS(null, 'x2', 0.6);
    this.horizontal.setAttributeNS(null, 'y2', 0);
    this.horizontal.classList.add('cue');
    this.element.appendChild(this.horizontal);

    this.vertical = document.createElementNS(svgNamespace, 'line');
    this.vertical.setAttributeNS(null, 'y1', -0.6);
    this.vertical.setAttributeNS(null, 'x1', 0);
    this.vertical.setAttributeNS(null, 'y2', 0.6);
    this.vertical.setAttributeNS(null, 'x2', 0);
    this.vertical.classList.add('cue');
    this.element.appendChild(this.vertical);
  }

  getNewSource(delta, isShiftModified) {
    let x = parseFloat((this.untweakedExpression.get(0).value + delta[0]).toShortFloat());
    let y = parseFloat((this.untweakedExpression.get(1).value + delta[1]).toShortFloat());

    if (isShiftModified) {
      x = Math.round(x);
      y = Math.round(y);
    }

    this.expression.set(0, new ExpressionReal(x));
    this.expression.set(1, new ExpressionReal(y));

    return '[' + this.expression.get(0).value + ', ' + this.expression.get(1).value + ']';
  }
}

// --------------------------------------------------------------------------- 

export class HorizontalPanMark extends PanMark {
  constructor(shape, component, multiplier = 1) {
    super(shape, component, 'cursor-horizontal-pan');
    this.multiplier = multiplier;

    this.horizontal = document.createElementNS(svgNamespace, 'line');
    this.horizontal.setAttributeNS(null, 'x1', -0.6);
    this.horizontal.setAttributeNS(null, 'y1', 0);
    this.horizontal.setAttributeNS(null, 'x2', 0.6);
    this.horizontal.setAttributeNS(null, 'y2', 0);
    this.horizontal.classList.add('cue');
    this.element.appendChild(this.horizontal);
  }

  getNewSource(delta, isShiftModified) {
    const oldValue = this.untweakedExpression.value;

    let newValue = parseFloat((oldValue + delta[0] * this.multiplier).toShortFloat());
    if (isShiftModified) {
      newValue = Math.round(newValue);
    }
    const newExpression = new ExpressionReal(newValue);

    this.expression.value = newValue;
    return manipulateSource(this.untweakedExpression, newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class VerticalPanMark extends PanMark {
  constructor(shape, component, multiplier = 1) {
    super(shape, component, 'cursor-vertical-pan');
    this.multiplier = multiplier;

    this.vertical = document.createElementNS(svgNamespace, 'line');
    this.vertical.setAttributeNS(null, 'y1', -0.6);
    this.vertical.setAttributeNS(null, 'x1', 0);
    this.vertical.setAttributeNS(null, 'y2', 0.6);
    this.vertical.setAttributeNS(null, 'x2', 0);
    this.vertical.classList.add('cue');
    this.element.appendChild(this.vertical);
  }

  getNewSource(delta, isShiftModified) {
    const oldValue = this.untweakedExpression.value;

    let newValue = parseFloat((oldValue + delta[1] * this.multiplier).toShortFloat());
    if (isShiftModified) {
      newValue = Math.round(newValue);
    }
    const newExpression = new ExpressionReal(newValue);

    this.expression.value = newValue;
    return manipulateSource(this.untweakedExpression, newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class RotationMark extends PanMark {
  constructor(shape, component) {
    super(shape, component, 'cursor-rotate');
  }

  setExpression(degreesExpression, headingExpression, pivotExpression) {
    super.setExpression(degreesExpression);
    this.headingExpression = headingExpression;
    this.pivotExpression = pivotExpression;
  }

  getNewSource(delta, isShiftModified, mouseAt) {
    const pivotToMouse = new ExpressionVector([
      new ExpressionReal(mouseAt.x),
      new ExpressionReal(mouseAt.y),
    ]).subtract(this.pivotExpression);

    const newRadians = Math.atan2(pivotToMouse.get(0).value, -pivotToMouse.get(1).value);
    let newDegrees = newRadians * 180 / Math.PI - 90 - this.headingExpression.value;
    if (newDegrees < 0) {
      newDegrees = 360 + newDegrees;
    }
    newDegrees = parseFloat(newDegrees.toShortFloat());

    if (isShiftModified) {
      newDegrees = Math.round(newDegrees);
    }

    const newExpression = new ExpressionReal(newDegrees);

    this.expression.value = newDegrees;
    return manipulateSource(this.untweakedExpression, newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class DistanceMark extends PanMark {
  constructor(shape, component) {
    super(shape, component, 'cursor-pan');
  }

  setExpression(distanceExpression, fromExpression, headingExpression) {
    super.setExpression(distanceExpression);
    this.fromExpression = fromExpression;
    this.headingExpression = headingExpression;
  }

  getNewSource(delta, isShiftModified, mouseAt) {
    const positionToHeading = new ExpressionVector([
      new ExpressionReal(1),
      this.headingExpression
    ]).toCartesian();

    const mouse = new ExpressionVector([
      new ExpressionReal(mouseAt.x),
      new ExpressionReal(mouseAt.y),
    ]);

    const positionToMouse = mouse.subtract(this.fromExpression);
    const dot = new ExpressionReal(positionToMouse.dot(positionToHeading));

    let newDistance = parseFloat(dot.value.toShortFloat());

    if (isShiftModified) {
      newDistance = Math.round(newDistance);
    }

    this.expression.value = newDistance;

    const newExpression = new ExpressionReal(newDistance);
    return manipulateSource(this.untweakedExpression, newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class WedgeDegreesMark extends PanMark {
  constructor(shape, component) {
    super(shape, component, 'cursor-rotate');
  }

  setExpression(degrees, fromPosition, centerPosition) {
    super.setExpression(degrees);
    this.fromPosition = fromPosition;
    this.centerPosition = centerPosition;
  }

  getNewSource(delta, isShiftModified, mouseAt) {
    // Find vector from center to root position.
    let centerToRoot = this.fromPosition.subtract(this.centerPosition).normalize();

    // Find vector from center to mouse.
    let centerToProjectedMouse = new ExpressionVector([
      new ExpressionReal(mouseAt.x),
      new ExpressionReal(mouseAt.y),
    ]).subtract(this.centerPosition).normalize();

    // Find angle between the two vectors.
    let degrees = Math.acos(centerToRoot.dot(centerToProjectedMouse)) * 180 / Math.PI;

    // Because dot is ambiguous, find signed area and adjust angle to be > 180.
    let rootToCenter = this.centerPosition.subtract(this.fromPosition);
    let rootToMouse = new ExpressionVector([
      new ExpressionReal(mouseAt.x),
      new ExpressionReal(mouseAt.y),
    ]).subtract(this.fromPosition);
    let signedArea = rootToCenter.get(0).value * rootToMouse.get(1).value - rootToCenter.get(1).value * rootToMouse.get(0).value;
    if (signedArea > 0) {
      degrees = 360 - degrees;
    }

    if (this.untweakedExpression.value < 0) {
      degrees -= 360;
    }

    degrees = parseFloat(degrees.toShortFloat())

    if (isShiftModified) {
      degrees = Math.round(degrees);
    }

    this.expression.value = degrees;
    const newExpression = new ExpressionReal(degrees);
    return manipulateSource(this.untweakedExpression, newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class BumpDegreesMark extends PanMark {
  constructor(shape, component) {
    super(shape, component, 'cursor-pan');
  }

  setExpression(degrees, fromPosition, centerPosition, toPosition) {
    super.setExpression(degrees);
    this.fromPosition = fromPosition;
    this.centerPosition = centerPosition;
    this.toPosition = toPosition;
  }

  getNewSource(delta, isShiftModified, mouseAt) {
    let centerToMouse = new ExpressionVector([
      new ExpressionReal(mouseAt.x),
      new ExpressionReal(mouseAt.y),
    ]).subtract(this.centerPosition);

    // The new center will be on a line perpendicular to the vector from
    // the starting point to ending point.
    let fromToVector = this.toPosition.subtract(this.fromPosition).normalize();
    let direction = fromToVector.rotate90(); 

    // Project the mouse point onto the perpendicular.
    let dot = new ExpressionReal(centerToMouse.dot(direction));
    let newCenterPosition = this.centerPosition.add(direction.multiply(dot));

    // We've figured out the new center. Now we need to figure out how many
    // degrees separate the two points. But we need to preserve the sign of
    // the original expression to make sure the arc travels the same winding.

    let newCenterFromVector = this.fromPosition.subtract(newCenterPosition).normalize();
    let newCenterToVector = this.toPosition.subtract(newCenterPosition).normalize();
    dot = newCenterFromVector.dot(newCenterToVector);
    let degrees = Math.acos(dot) * 180 / Math.PI;

    // Because dot is ambiguous, find signed area and adjust angle to be > 180.
    let fromNewCenterVector = newCenterPosition.subtract(this.fromPosition);
    fromToVector = this.toPosition.subtract(this.fromPosition);
    let signedArea = fromNewCenterVector.get(0).value * fromToVector.get(1).value - fromNewCenterVector.get(1).value * fromToVector.get(0).value;
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

    degrees = parseFloat(degrees.toShortFloat());

    if (isShiftModified) {
      degrees = Math.round(degrees);
    }

    const newExpression = new ExpressionReal(degrees);
    this.expression.value = degrees;
    return manipulateSource(this.untweakedExpression, newExpression);
  }
}

// --------------------------------------------------------------------------- 

function manipulateSource(oldExpression, newExpression) {
  const unevaluated = oldExpression.unevaluated;
  const oldValue = oldExpression.value;
  const newValue = newExpression.value;

  if (unevaluated instanceof ExpressionReal || unevaluated instanceof ExpressionInteger) {
    return newExpression.toPretty();
  } else if (unevaluated instanceof ExpressionAdd &&
             (unevaluated.b instanceof ExpressionReal || unevaluated.b instanceof ExpressionInteger)) {
    const right = unevaluated.b.value;
    const left = oldValue - right;
    return new ExpressionAdd(unevaluated.a, new ExpressionReal((newValue - left).toShortFloat())).toPretty();
  } else if (unevaluated instanceof ExpressionAdd &&
             (unevaluated.a instanceof ExpressionReal || unevaluated.a instanceof ExpressionInteger)) {
    const left = unevaluated.a.value;
    const right = oldValue - left;
    return new ExpressionAdd(new ExpressionReal((newValue - right).toShortFloat()), unevaluated.b).toPretty();
  } else if (unevaluated instanceof ExpressionSubtract &&
             (unevaluated.b instanceof ExpressionReal || unevaluated.b instanceof ExpressionInteger)) {
    const right = unevaluated.b.value;
    const left = oldValue + right;
    return new ExpressionSubtract(unevaluated.a, new ExpressionReal((left - newValue).toShortFloat())).toPretty();
  } else if (unevaluated instanceof ExpressionSubtract &&
             (unevaluated.a instanceof ExpressionReal || unevaluated.a instanceof ExpressionInteger)) {
    const left = unevaluated.a.value;
    const right = left - oldValue;
    return new ExpressionSubtract(new ExpressionReal((newValue + right).toShortFloat()), unevaluated.b).toPretty();
  } else if (unevaluated instanceof ExpressionMultiply &&
             (unevaluated.b instanceof ExpressionReal || unevaluated.b instanceof ExpressionInteger)) {
    const right = unevaluated.b.value;
    const left = oldValue / right;
    return new ExpressionMultiply(unevaluated.a, new ExpressionReal((newValue / left).toShortFloat())).toPretty();
  } else if (unevaluated instanceof ExpressionMultiply &&
             (unevaluated.a instanceof ExpressionReal || unevaluated.a instanceof ExpressionInteger)) {
    const left = unevaluated.a.value;
    const right = oldValue / left;
    return new ExpressionMultiply(new ExpressionReal((newValue / right).toShortFloat()), unevaluated.b).toPretty();
  } else if (unevaluated instanceof ExpressionDivide &&
             (unevaluated.b instanceof ExpressionReal || unevaluated.b instanceof ExpressionInteger)) {
    const right = unevaluated.b.value;
    const left = oldExpression.prevalues[0].value;
    return new ExpressionDivide(unevaluated.a, new ExpressionReal((left / newValue).toShortFloat())).toPretty();
  } else if (unevaluated instanceof ExpressionDivide &&
             (unevaluated.a instanceof ExpressionReal || unevaluated.a instanceof ExpressionInteger)) {
    const left = unevaluated.a.value;
    const right = left / oldValue;
    return new ExpressionDivide(new ExpressionReal((newValue * right).toShortFloat()), unevaluated.b).toPretty();
  } else if (unevaluated instanceof ExpressionPower &&
             (unevaluated.b instanceof ExpressionReal || unevaluated.b instanceof ExpressionInteger)) {
    const right = unevaluated.b.value;
    const left = oldExpression.prevalues[0];
    // const left = Math.pow(oldValue, 1 / right);

    // If the left operand is 1, there's no hope of raising it to any value.
    if ((left instanceof ExpressionInteger && left.value === 1) ||
        (left instanceof ExpressionReal && Math.abs(left.value - 1) < 0.001)) {
      return new ExpressionAdd(unevaluated, new ExpressionReal((newValue - oldValue).toShortFloat())).toPretty();
    } else {
      return new ExpressionPower(unevaluated.a, new ExpressionReal((Math.log(newValue) / Math.log(left.value)).toShortFloat())).toPretty();
    }
  } else if (unevaluated instanceof ExpressionPower &&
             (unevaluated.a instanceof ExpressionReal || unevaluated.a instanceof ExpressionInteger)) {
    const left = unevaluated.a.value;
    const right = Math.log(oldValue) / Math.log(left);
    return new ExpressionPower(new ExpressionReal(Math.pow(newValue, 1 / right).toShortFloat()), unevaluated.b).toPretty();
  } else {
    return new ExpressionAdd(unevaluated, new ExpressionReal((newValue - oldValue).toShortFloat())).toPretty();
  }
}

// --------------------------------------------------------------------------- 

