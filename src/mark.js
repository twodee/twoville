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

export let Markable = {
  showMarks() {
    this.showBackgroundMarks();
    this.foregroundHandleGroup.setAttributeNS(null, 'visibility', 'visible');
  },

  hoverMarks() {
    this.backgroundHandleGroup.classList.add('hovered');
    this.foregroundHandleGroup.classList.add('hovered');
    this.showMarks();
  },

  unhoverMarks() {
    this.backgroundHandleGroup.classList.remove('hovered');
    this.foregroundHandleGroup.classList.remove('hovered');
    this.hideMarks();
  },

  showBackgroundMarks() {
    this.backgroundHandleGroup.setAttributeNS(null, 'visibility', 'visible');
  },

  hideMarks() {
    this.backgroundHandleGroup.setAttributeNS(null, 'visibility', 'hidden');
    this.foregroundHandleGroup.setAttributeNS(null, 'visibility', 'hidden');
  },

  addMarks(elementToSelect, foregroundMarks, backgroundMarks) {
    this.backgroundMarks = backgroundMarks;
    this.foregroundMarks = foregroundMarks;

    this.element.classList.add('cursor-selectable');
    this.element.classList.add(`tag-${this.id}`);
    this.elementToSelect = elementToSelect;
 
    this.backgroundHandleGroup = document.createElementNS(svgNamespace, 'g');
    this.backgroundHandleGroup.setAttributeNS(null, 'id', `element-${this.id}-background-handles`);
    this.backgroundHandleGroup.classList.add('handle-group');
    for (let handle of this.backgroundMarks) {
      handle.element.classList.add('handle');
      handle.element.classList.add(`tag-${this.id}`);
      this.backgroundHandleGroup.appendChild(handle.element);
    }

    this.foregroundHandleGroup = document.createElementNS(svgNamespace, 'g');
    this.foregroundHandleGroup.setAttributeNS(null, 'id', `element-${this.id}-foreground-handles`);
    this.foregroundHandleGroup.classList.add('handle-group');
    for (let handle of this.foregroundMarks) {
      handle.element.classList.add('handle');
      handle.element.classList.add(`tag-${this.id}`);
      this.foregroundHandleGroup.appendChild(handle.element);
    }

    this.root.backgroundHandleGroup.appendChild(this.backgroundHandleGroup);
    this.root.foregroundHandleGroup.appendChild(this.foregroundHandleGroup);

    this.hideMarks();
    this.registerListeners();
  },

  deselect() {
    this.isSelected = false;
    this.hideMarks();
  },

  select() {
    this.isSelected = true;
    this.backgroundHandleGroup.classList.remove('hovered');
    this.foregroundHandleGroup.classList.remove('hovered');
    this.showMarks();
  },

  registerListeners() {
    this.element.addEventListener('click', event => {
      // If the event bubbles up to the parent SVG, that means no shape was
      // clicked on, and everything will be deselected. We don't want that.
      event.stopPropagation();

      if (!this.root.isStale) {
        this.root.select(this);
      }
    });

    this.element.addEventListener('mouseenter', event => {
      event.stopPropagation();

      // Only show the handles if the source code is evaluated and fresh.
      if (!this.isSelected && !this.root.isStale) {
        this.hoverMarks();
      }

      if (event.buttons === 0) {
        this.root.contextualizeCursor(event.toElement);
      }
    });

    this.element.addEventListener('mouseleave', event => {
      event.stopPropagation();

      if (this.isUnhoverTransition(event)) {
        this.unhoverMarks();
      }

      if (event.buttons === 0) {
        this.root.contextualizeCursor(event.toElement);
      }
    });

    for (let handle of [...this.backgroundMarks, ...this.foregroundMarks]) {
      handle.element.addEventListener('mouseenter', event => {
        if (event.buttons === 0) {
          this.root.contextualizeCursor(event.toElement);
        }
      });

      handle.element.addEventListener('mouseleave', event => {
        if (this.isUnhoverTransition(event)) {
          this.unhoverMarks();
        }

        if (event.buttons === 0) {
          this.root.contextualizeCursor(event.toElement);
        }
      });
    }
  },

  isUnhoverTransition(event) {
    // Only turn off handles if shape wasn't explicitly click-selected and the
    // mouse is dragged onto to some other entity that isn't the shape or its
    // handles.
    return !this.isSelected && (!event.toElement || !event.toElement.classList.contains(`tag-${this.id}`));
  }
};

// --------------------------------------------------------------------------- 

export class RectangleMark {
  constructor() {
    this.element = document.createElementNS(svgNamespace, 'rect');
  }

  update(position, size, bounds, rounding) {
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

  update(center, radius, bounds) {
    this.element.setAttributeNS(null, 'cx', center.get(0).value);
    this.element.setAttributeNS(null, 'cy', bounds.span - center.get(1).value);
    this.element.setAttributeNS(null, 'r', radius.value);
  }
}

// --------------------------------------------------------------------------- 

export class TweakableMark {
  constructor(shape, element, cursor) {
    this.shape = shape;
    this.mouseDownAt = null;

    this.element = element;
    this.element.classList.add('handle');
    this.element.classList.add('filled-handle');
    this.element.classList.add(cursor);
    this.element.addEventListener('mousedown', this.onMouseDown);

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
    if (!this.shape.root.isStale) {
      this.untweakedExpression = this.expression.clone();
      this.mouseDownAt = this.transform(event);
      this.shape.root.select(this.shape);
      this.shape.root.startTweak(this.expression.unevaluated.where);
      event.stopPropagation();
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseUp);
    }
  };

  onMouseMove = event => {
    if (event.buttons === 1) {
      event.stopPropagation();

      let mouseAt = this.transform(event);
      let delta = [mouseAt.x - this.mouseDownAt.x, mouseAt.y - this.mouseDownAt.y];
      let replacement = this.getNewSource(delta, event.shiftKey, mouseAt);
      this.shape.root.tweak(replacement);
    }
  };

  onMouseUp = event => {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.shape.root.contextualizeCursor(event.toElement);
    this.shape.root.stopTweak();
  };
}

// --------------------------------------------------------------------------- 

export class PanMark extends TweakableMark {
  constructor(shape, cursor) {
    super(shape, document.createElementNS(svgNamespace, 'circle'), cursor);

    // Non-scaling-size is not supported. :( Looks like I'll have to do
    // this myself.
    // handle.setAttributeNS(null, 'vector-effect', 'non-scaling-size');
    this.element.classList.add('handle-circle');
  }

  update(position, bounds) {
    this.element.setAttributeNS(null, 'cx', position.get(0).value);
    this.element.setAttributeNS(null, 'cy', bounds.span - position.get(1).value);
    this.element.setAttributeNS(null, 'r', 0.3);
  }
}

// --------------------------------------------------------------------------- 

export class VectorPanMark extends PanMark {
  constructor(shape) {
    super(shape, 'cursor-pan');
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
  constructor(shape, isCentered) {
    super(shape, 'cursor-horizontal-pan');
    this.isCentered = isCentered;
  }

  getNewSource(delta, isShiftModified) {
    const oldValue = this.untweakedExpression.value;

    let newValue = parseFloat((oldValue + delta[0] * (this.isCentered ? 2 : 1)).toShortFloat());
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
  constructor(shape, isCentered) {
    super(shape, 'cursor-vertical-pan');
    this.isCentered = isCentered;
  }

  getNewSource(delta, isShiftModified) {
    const oldValue = this.untweakedExpression.value;

    let newValue = parseFloat((oldValue + delta[1] * (this.isCentered ? 2 : 1)).toShortFloat());
    if (isShiftModified) {
      newValue = Math.round(newValue);
    }
    const newExpression = new ExpressionReal(newValue);

    this.expression.value = newValue;
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

