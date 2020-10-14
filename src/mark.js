import { 
  svgNamespace,
} from './common.js';

import { 
  ExpressionAdd,
  ExpressionDivide,
  ExpressionInteger,
  ExpressionMultiply,
  ExpressionPower,
  ExpressionReal,
  ExpressionString,
  ExpressionSubtract,
  ExpressionVector,
} from './ast.js';

// --------------------------------------------------------------------------- 

export class Marker {
  constructor(shape) {
    this.shape = shape;
  }

  showMarks() {
    this.showBackgroundMarks();
    this.midgroundMarkGroup.setAttributeNS(null, 'visibility', 'visible');
    this.foregroundMarkGroup.setAttributeNS(null, 'visibility', 'visible');
    this.centeredForegroundMarkGroup.setAttributeNS(null, 'visibility', 'visible');
  }

  hoverMarks() {
    this.backgroundMarkGroup.classList.add('hovered');
    this.midgroundMarkGroup.classList.add('hovered');
    this.foregroundMarkGroup.classList.add('hovered');
    this.centeredForegroundMarkGroup.classList.add('hovered');
    this.showMarks();
  }

  unhoverMarks() {
    this.backgroundMarkGroup.classList.remove('hovered');
    this.midgroundMarkGroup.classList.remove('hovered');
    this.foregroundMarkGroup.classList.remove('hovered');
    this.centeredForegroundMarkGroup.classList.remove('hovered');
    this.hideMarks();
  }

  showBackgroundMarks() {
    this.backgroundMarkGroup.setAttributeNS(null, 'visibility', 'visible');
  }

  hideMarks() {
    this.backgroundMarkGroup.setAttributeNS(null, 'visibility', 'hidden');
    this.midgroundMarkGroup.setAttributeNS(null, 'visibility', 'hidden');
    this.foregroundMarkGroup.setAttributeNS(null, 'visibility', 'hidden');
    this.centeredForegroundMarkGroup.setAttributeNS(null, 'visibility', 'hidden');
  }

  addMarks(foregroundMarks, backgroundMarks, centeredForegroundMarks = [], midgroundMarks = []) {
    this.backgroundMarks = backgroundMarks;
    this.midgroundMarks = midgroundMarks;
    this.foregroundMarks = foregroundMarks;
    this.centeredForegroundMarks = centeredForegroundMarks;

    this.backgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.backgroundMarkGroup.classList.add('mark-group');
    for (let mark of this.backgroundMarks) {
      mark.element.classList.add('mark');
      mark.element.classList.add(`tag-${this.shape.id}`);
      this.backgroundMarkGroup.appendChild(mark.element);
    }

    this.midgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.midgroundMarkGroup.classList.add('mark-group');
    for (let mark of this.midgroundMarks) {
      mark.element.classList.add('mark');
      mark.element.classList.add(`tag-${this.shape.id}`);
      this.midgroundMarkGroup.appendChild(mark.element);
    }

    this.foregroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.foregroundMarkGroup.classList.add('mark-group');
    for (let mark of this.foregroundMarks) {
      mark.element.classList.add('mark');
      mark.element.classList.add(`tag-${this.shape.id}`);
      this.foregroundMarkGroup.appendChild(mark.element);
    }

    this.centeredForegroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.centeredForegroundMarkGroup.classList.add('mark-group');
    for (let mark of this.centeredForegroundMarks) {
      mark.element.classList.add('mark');
      mark.element.classList.add(`tag-${this.shape.id}`);
      this.centeredForegroundMarkGroup.appendChild(mark.element);
    }

    this.hideMarks();
    this.registerListeners();
  }

  deselect() {
    this.hideMarks();
  }

  select() {
    this.backgroundMarkGroup.classList.remove('hovered');
    this.midgroundMarkGroup.classList.remove('hovered');
    this.foregroundMarkGroup.classList.remove('hovered');
    this.centeredForegroundMarkGroup.classList.remove('hovered');
    this.showMarks();
  }

  unscale(factor) {
    for (let mark of this.foregroundMarks) {
      mark.unscale(factor);
    }
    for (let mark of this.centeredForegroundMarks) {
      mark.unscale(factor);
    }
  }

  registerListeners() {
    for (let mark of [...this.backgroundMarks, ...this.foregroundMarks, ...this.centeredForegroundMarks, ...this.midgroundMarks]) {
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
    const element = event.toElement;
    return !this.shape.isSelected && (!element || (!element.classList.contains(`tag-${this.shape.id}`) && !element.classList.contains('grid-line')));
  }
}

// --------------------------------------------------------------------------- 

export class RectangleMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'rect');
  }

  updateProperties(position, size, bounds, rounding) {
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

  updateProperties(center, radius, bounds) {
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

  updateProperties(a, b, bounds) {
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

  updateProperties(coordinates) {
    this.element.setAttributeNS(null, 'points', coordinates);
  }
}

// --------------------------------------------------------------------------- 

export class PathMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'path');
  }

  updateProperties(commands) {
    this.element.setAttributeNS(null, 'd', commands);
  }

  setTransform(matrix, bounds) {
    this.element.setAttributeNS(null, 'transform', `matrix(${matrix.elements[0]} ${matrix.elements[3]} ${matrix.elements[1]} ${matrix.elements[4]} ${matrix.elements[2]} ${-matrix.elements[5]})`);
  }
}

// --------------------------------------------------------------------------- 

export class PolylineMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'polyline');
  }

  updateProperties(coordinates) {
    this.element.setAttributeNS(null, 'points', coordinates);
  }
}

// --------------------------------------------------------------------------- 

export class TweakableMark {
  constructor(shape, component) {
    this.shape = shape;
    this.component = component ?? shape;
    this.mouseDownAt = null;

    this.element = document.createElementNS(svgNamespace, 'g');
    this.element.addEventListener('mousedown', this.onMouseDown);

    this.circle = document.createElementNS(svgNamespace, 'circle');
    this.circle.classList.add('mark');
    this.circle.classList.add('filled-mark');
    this.circle.classList.add(`tag-${this.shape.id}`);
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
  constructor(shape, component, isRotated = true) {
    super(shape, component);
    this.isRotated = isRotated;
  }

  updateProperties(position, bounds, matrix) {
    const transformedPosition = matrix.multiplyVector(position);
		const factors = decompose_2d_matrix([matrix.elements[0], matrix.elements[3], matrix.elements[1], matrix.elements[4], matrix.elements[2], matrix.elements[5]]);
		const rotation = factors.rotation * 180 / Math.PI;

    this.commandString = `translate(${transformedPosition.get(0).value} ${bounds.span - transformedPosition.get(1).value})`;
    if (this.isRotated) {
      this.commandString += ` rotate(${-rotation})`;
    }
  }

  unscale(factor) {
    if (this.commandString) {
      this.element.setAttributeNS(null, "transform", `${this.commandString} scale(${6 / factor})`);
    }
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
  constructor(shape, component) {
    super(shape, component);
    this.addHorizontal();
    this.addVertical();
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
    super(shape, component);
    this.multiplier = multiplier;
    this.addHorizontal();
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
    super(shape, component);
    this.multiplier = multiplier;
    this.addVertical();
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
    super(shape, component, false);
    this.addArc();
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

    // We were negative and we want to stay that way. 
    if (this.untweakedExpression.value < 0) {
      while (newDegrees > 0) {
        newDegrees -= 360;
      }
      while (newDegrees < -360) {
        newDegrees += 360;
      }
    }

    // We were positive and we want to stay that way.
    else {
      while (newDegrees < 0) {
        newDegrees += 360;
      }
      while (newDegrees >= 360) {
        newDegrees -= 360;
      }
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

export class AxisMark extends PanMark {
  constructor(shape, component) {
    super(shape, component, false);
    this.addArc();
  }

  setExpression(axisExpression, positionExpression) {
    super.setExpression(axisExpression);
    this.positionExpression = positionExpression;
  }

  getNewSource(delta, isShiftModified, mouseAt) {
    let x = parseFloat((this.untweakedExpression.get(0).value + delta[0]).toShortFloat());
    let y = parseFloat((this.untweakedExpression.get(1).value + delta[1]).toShortFloat());

    if (isShiftModified) {
      x = Math.round(x);
      y = Math.round(y);
    }

    const newAxis = new ExpressionVector([
      new ExpressionReal(x),
      new ExpressionReal(y)
    ]).normalize();

    this.expression.set(0, new ExpressionReal(newAxis.get(0).value.toShortFloat()));
    this.expression.set(1, new ExpressionReal(newAxis.get(1).value.toShortFloat()));

    return '[' + this.expression.get(0).value + ', ' + this.expression.get(1).value + ']';
  }
}

// --------------------------------------------------------------------------- 

export class DistanceMark extends PanMark {
  constructor(shape, component) {
    super(shape, component);
    this.addHorizontal();
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
    super(shape, component);
    this.addArc();
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
    super(shape, component);
    this.addHorizontal();
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
             (unevaluated.r instanceof ExpressionReal || unevaluated.r instanceof ExpressionInteger)) {
    const right = unevaluated.r.value;
    const left = oldValue - right;
    return new ExpressionAdd(unevaluated.l, new ExpressionReal((newValue - left).toShortFloat())).toPretty();
  } else if (unevaluated instanceof ExpressionAdd &&
             (unevaluated.l instanceof ExpressionReal || unevaluated.l instanceof ExpressionInteger)) {
    const left = unevaluated.l.value;
    const right = oldValue - left;
    return new ExpressionAdd(new ExpressionReal((newValue - right).toShortFloat()), unevaluated.r).toPretty();
  } else if (unevaluated instanceof ExpressionSubtract &&
             (unevaluated.r instanceof ExpressionReal || unevaluated.r instanceof ExpressionInteger)) {
    const right = unevaluated.r.value;
    const left = oldValue + right;
    return new ExpressionSubtract(unevaluated.l, new ExpressionReal((left - newValue).toShortFloat())).toPretty();
  } else if (unevaluated instanceof ExpressionSubtract &&
             (unevaluated.l instanceof ExpressionReal || unevaluated.l instanceof ExpressionInteger)) {
    const left = unevaluated.l.value;
    const right = left - oldValue;
    return new ExpressionSubtract(new ExpressionReal((newValue + right).toShortFloat()), unevaluated.r).toPretty();
  } else if (unevaluated instanceof ExpressionMultiply &&
             (unevaluated.r instanceof ExpressionReal || unevaluated.r instanceof ExpressionInteger)) {
    const right = unevaluated.r.value;
    const left = oldValue / right;
    return new ExpressionMultiply(unevaluated.l, new ExpressionReal((newValue / left).toShortFloat())).toPretty();
  } else if (unevaluated instanceof ExpressionMultiply &&
             (unevaluated.l instanceof ExpressionReal || unevaluated.l instanceof ExpressionInteger)) {
    const left = unevaluated.l.value;
    const right = oldValue / left;
    return new ExpressionMultiply(new ExpressionReal((newValue / right).toShortFloat()), unevaluated.r).toPretty();
  } else if (unevaluated instanceof ExpressionDivide &&
             (unevaluated.r instanceof ExpressionReal || unevaluated.r instanceof ExpressionInteger)) {
    const right = unevaluated.r.value;
    const left = oldExpression.prevalues[0].value;
    return new ExpressionDivide(unevaluated.l, new ExpressionReal((left / newValue).toShortFloat())).toPretty();
  } else if (unevaluated instanceof ExpressionDivide &&
             (unevaluated.l instanceof ExpressionReal || unevaluated.l instanceof ExpressionInteger)) {
    const left = unevaluated.l.value;
    const right = left / oldValue;
    return new ExpressionDivide(new ExpressionReal((newValue * right).toShortFloat()), unevaluated.r).toPretty();
  } else if (unevaluated instanceof ExpressionPower &&
             (unevaluated.r instanceof ExpressionReal || unevaluated.r instanceof ExpressionInteger)) {
    const right = unevaluated.r.value;
    const left = oldExpression.prevalues[0];
    // const left = Math.pow(oldValue, 1 / right);

    // If the left operand is 1, there's no hope of raising it to any value.
    if ((left instanceof ExpressionInteger && left.value === 1) ||
        (left instanceof ExpressionReal && Math.abs(left.value - 1) < 0.001)) {
      return new ExpressionAdd(unevaluated, new ExpressionReal((newValue - oldValue).toShortFloat())).toPretty();
    } else {
      return new ExpressionPower(unevaluated.l, new ExpressionReal((Math.log(newValue) / Math.log(left.value)).toShortFloat())).toPretty();
    }
  } else if (unevaluated instanceof ExpressionPower &&
             (unevaluated.l instanceof ExpressionReal || unevaluated.l instanceof ExpressionInteger)) {
    const left = unevaluated.l.value;
    const right = Math.log(oldValue) / Math.log(left);
    return new ExpressionPower(new ExpressionReal(Math.pow(newValue, 1 / right).toShortFloat()), unevaluated.r).toPretty();
  } else {
    return new ExpressionAdd(unevaluated, new ExpressionReal((newValue - oldValue).toShortFloat())).toPretty();
  }
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
