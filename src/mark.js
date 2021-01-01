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

const handleSize = 8;

export class Marker {
  constructor(shape) {
    this.shape = shape;
    // this.foregroundMarks = [];
    // this.centeredForegroundMarks = [];
    // this.midgroundMarks = [];
    // this.backgroundMarks = [];
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

  updateScale(factor) {
    for (let mark of this.foregroundMarks) {
      mark.updateScale(factor);
    }
    for (let mark of this.centeredForegroundMarks) {
      mark.updateScale(factor);
    }
  }

  updateManipulability() {
    for (let mark of this.foregroundMarks) {
      mark.updateManipulability();
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

  updateDom(bounds, corner, size, rounding) {
    this.element.setAttributeNS(null, 'x', corner[0]);
    this.element.setAttributeNS(null, 'y', bounds.span - corner[1] - size[1]);
    this.element.setAttributeNS(null, 'width', size[0]);
    this.element.setAttributeNS(null, 'height', size[1]);
    if (rounding !== undefined) {
      this.element.setAttributeNS(null, 'rx', rounding);
      this.element.setAttributeNS(null, 'ry', rounding);
    }
  }
}

// --------------------------------------------------------------------------- 

export class CircleMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'circle');
  }

  // updateProperties(center, radius, bounds) {
    // this.element.setAttributeNS(null, 'cx', center.get(0).value);
    // this.element.setAttributeNS(null, 'cy', bounds.span - center.get(1).value);
    // this.element.setAttributeNS(null, 'r', radius.value);
  // }

  updateDom(bounds, center, radius) {
    this.element.setAttributeNS(null, 'cx', center[0]);
    this.element.setAttributeNS(null, 'cy', bounds.span - center[1]);
    this.element.setAttributeNS(null, 'r', radius);
  }
}

// --------------------------------------------------------------------------- 

export class LineMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'line');
  }

  updateDom(bounds, a, b) {
    this.element.setAttributeNS(null, 'x1', a[0]);
    this.element.setAttributeNS(null, 'y1', bounds.span - a[1]);
    this.element.setAttributeNS(null, 'x2', b[0]);
    this.element.setAttributeNS(null, 'y2', bounds.span - b[1]);
  }
}

// --------------------------------------------------------------------------- 

export class PolygonMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'polygon');
  }

  updateDom(bounds, coordinates) {
    this.element.setAttributeNS(null, 'points', coordinates.map(([x, y]) => `${x},${bounds.span - y}`).join(' '));
  }
}

// --------------------------------------------------------------------------- 

export class PathMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'path');
  }

  updateDom(bounds, commands) {
    this.element.setAttributeNS(null, 'd', commands);
  }

  // setTransform(matrix, bounds) {
    // this.element.setAttributeNS(null, 'transform', `matrix(${matrix.elements[0]} ${matrix.elements[3]} ${matrix.elements[1]} ${matrix.elements[4]} ${matrix.elements[2]} ${-matrix.elements[5]})`);
  // }
}

// --------------------------------------------------------------------------- 

export class PolylineMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'polyline');
  }

  updateDom(bounds, coordinates) {
    this.element.setAttributeNS(null, 'points', coordinates.map(([x, y]) => `${x},${bounds.span - y}`).join(' '));
  }
}

// --------------------------------------------------------------------------- 

export class TweakableMark {
  constructor(shape, host, getExpression, updateState) {
    this.shape = shape;
    this.getExpression = getExpression;
    this.updateState = updateState;
    this.host = host ?? shape;
    this.mouseDownAt = null;

    this.element = document.createElementNS(svgNamespace, 'g');
    this.element.addEventListener('mousedown', this.onMouseDown);

    this.circle = document.createElementNS(svgNamespace, 'circle');
    this.circle.classList.add('mark-piece');
    this.circle.classList.add('filled-mark-piece');
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

  updateManipulability() {
    this.expression = this.getExpression();
    this.element.classList.toggle('disabled-mark', !this.expression);
  }

  onMouseDown = event => {
    event.stopPropagation();
    this.expression = this.getExpression();

    if (this.expression && !this.shape.root.isStale) {
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
  constructor(shape, host, isRotated, getExpression, updateState) {
    super(shape, host, getExpression, updateState);
    this.isRotated = isRotated;
  }

  updateDom(bounds, position, factor, matrix) {
    const transformedPosition = matrix.multiplyVector(position);
		const factors = decompose_2d_matrix([matrix.elements[0], matrix.elements[3], matrix.elements[1], matrix.elements[4], matrix.elements[2], matrix.elements[5]]);
		const rotation = factors.rotation * 180 / Math.PI;
    this.commandString = `translate(${transformedPosition[0]} ${bounds.span - transformedPosition[1]})`;
    if (this.isRotated) {
      this.commandString += ` rotate(${-rotation})`;
    }
    this.updateScale(factor);
  }

  updateScale(factor) {
    this.element.setAttributeNS(null, "transform", `${this.commandString} scale(${handleSize / factor})`);
  }

  // updateProperties(position, bounds, matrix) {
    // const transformedPosition = matrix.multiplyVector(position);
		// const factors = decompose_2d_matrix([matrix.elements[0], matrix.elements[3], matrix.elements[1], matrix.elements[4], matrix.elements[2], matrix.elements[5]]);
		// const rotation = factors.rotation * 180 / Math.PI;

    // this.commandString = `translate(${transformedPosition.get(0).value} ${bounds.span - transformedPosition.get(1).value})`;
    // if (this.isRotated) {
      // this.commandString += ` rotate(${-rotation})`;
    // }
  // }

  // unscale(factor) {
    // if (this.commandString) {
      // this.element.setAttributeNS(null, "transform", `${this.commandString} scale(${6 / factor})`);
    // }
  // }

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
  constructor(shape, host, getExpression, updateState) {
    super(shape, host, false, getExpression, updateState);
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
    this.updateState([x, y]);

    return '[' + this.expression.get(0).value + ', ' + this.expression.get(1).value + ']';
  }
}

// --------------------------------------------------------------------------- 

export class HorizontalPanMark extends PanMark {
  constructor(shape, host, multiplier = 1, getExpression, updateState) {
    super(shape, host, false, getExpression, updateState);
    this.multiplier = multiplier;
    this.addHorizontal();
  }

  getNewSource(delta, isShiftModified) {
    const oldValue = this.untweakedExpression.value;

    let newValue = parseFloat((oldValue + delta[0] * this.multiplier).toShortFloat());
    if (isShiftModified) {
      newValue = Math.round(newValue);
    }

    this.expression.value = newValue;
    this.updateState(newValue);

    const newExpression = new ExpressionReal(newValue);
    return manipulateSource(this.untweakedExpression, newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class VerticalPanMark extends PanMark {
  constructor(shape, host, multiplier = 1, getExpression, updateState) {
    super(shape, host, false, getExpression, updateState);
    this.multiplier = multiplier;
    this.addVertical();
  }

  getNewSource(delta, isShiftModified) {
    const oldValue = this.untweakedExpression.value;

    let newValue = parseFloat((oldValue + delta[1] * this.multiplier).toShortFloat());
    if (isShiftModified) {
      newValue = Math.round(newValue);
    }

    this.expression.value = newValue;
    this.updateState(newValue);

    const newExpression = new ExpressionReal(newValue);
    return manipulateSource(this.untweakedExpression, newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class RotationMark extends PanMark {
  constructor(shape, host, pivot, getExpression, updateState) {
    super(shape, host, false, getExpression, updateState);
    this.pivot = pivot;
    this.addArc();
  }

  getNewSource(delta, isShiftModified, mouseAt) {
    const pivotToMouse = [
      mouseAt.x - this.pivot[0],
      mouseAt.y - this.pivot[1],
    ];

    const newRadians = Math.atan2(pivotToMouse[0], -pivotToMouse[1]);
    let newDegrees = newRadians * 180 / Math.PI - 90;// TODO - this.host.state.heading;

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

    newDegrees = parseFloat(newDegrees.toShortFloat());

    if (isShiftModified) {
      newDegrees = Math.round(newDegrees);
    }

    this.expression.value = newDegrees;
    this.updateState(newDegrees);

    const newExpression = new ExpressionReal(newDegrees);
    return manipulateSource(this.untweakedExpression, newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class AxisMark extends PanMark {
  constructor(shape, host) {
    super(shape, host, false);
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
  constructor(shape, host, getExpression, updateState) {
    super(shape, host, false, getExpression, updateState);
    this.addHorizontal();
  }

  getNewSource(delta, isShiftModified, mouseAt) {
    const headingVector = [
      Math.cos(this.host.heading * Math.PI / 180),
      Math.sin(this.host.heading * Math.PI / 180),
    ];

    const mouseVector = [
      mouseAt.x - this.host.position[0],
      mouseAt.y - this.host.position[1],
    ];

    const dot = headingVector[0] * mouseVector[0] + headingVector[1] * mouseVector[1];

    let newDistance = parseFloat(dot.toShortFloat());
    if (isShiftModified) {
      newDistance = Math.round(newDistance);
    }

    this.expression.value = newDistance;
    this.updateState(newDistance);

    const newExpression = new ExpressionReal(newDistance);
    return manipulateSource(this.untweakedExpression, newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class WedgeDegreesMark extends PanMark {
  constructor(shape, host, root, center, getExpression, updateState) {
    super(shape, host, false, getExpression, updateState);
    this.root = root;
    this.center = center;
    this.addArc();
  }

  getNewSource(delta, isShiftModified, mouseAt) {
    console.log("this.center:", this.center);
    console.log("this.root:", this.root);

    // Find vector from center to root position.
    let centerToRoot = [
      this.root[0] - this.center[0],
      this.root[1] - this.center[1]
    ];
    let length = Math.sqrt(centerToRoot[0] * centerToRoot[0] + centerToRoot[1] * centerToRoot[1]);
    centerToRoot[0] /= length;
    centerToRoot[1] /= length;
    console.log("centerToRoot:", centerToRoot);

    // Find vector from center to mouse.
    let centerToMouse = [
      mouseAt.x - this.center[0],
      mouseAt.y - this.center[1],
    ];
    length = Math.sqrt(centerToMouse[0] * centerToMouse[0] + centerToMouse[1] * centerToMouse[1]);
    centerToMouse[0] /= length;
    centerToMouse[1] /= length;
    console.log("centerToMouse:", centerToMouse);

    // Find angle between the two vectors.
    const dot = centerToRoot[0] * centerToMouse[0] + centerToRoot[1] * centerToMouse[1];
    let degrees = Math.acos(dot) * 180 / Math.PI;

    // Because dot is ambiguous, find signed area and adjust angle to be > 180.
    let rootToCenter = [
      this.center[0] - this.root[0],
      this.center[1] - this.root[1]
    ];
    let rootToMouse = [
      mouseAt.x - this.root[0],
      mouseAt.y - this.root[1],
    ];
    const signedArea = rootToCenter[0] * rootToMouse[1] - rootToCenter[1] * rootToMouse[0];

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
    console.log("degrees:", degrees);

    this.expression.value = degrees;
    this.updateState(degrees);

    const newExpression = new ExpressionReal(degrees);
    return manipulateSource(this.untweakedExpression, newExpression);
  }
}

// --------------------------------------------------------------------------- 

export class BumpDegreesMark extends PanMark {
  constructor(shape, host, from, to, center, getExpression, updateState) {
    super(shape, host, false, getExpression, updateState);
    this.addHorizontal();
    this.from = from;
    this.to = to;
    this.center = center;
  }

  getNewSource(delta, isShiftModified, mouseAt) {
    console.log("this.center:", this.center);
    console.log("mouseAt:", mouseAt);
    let centerToMouse = [
      mouseAt.x - this.center[0],
      mouseAt.y - this.center[1],
    ];
    console.log("centerToMouse:", centerToMouse);

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

    degrees = parseFloat(degrees.toShortFloat());

    if (isShiftModified) {
      degrees = Math.round(degrees);
    }

    this.expression.value = degrees;
    this.updateState(degrees);

    const newExpression = new ExpressionReal(degrees);
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
