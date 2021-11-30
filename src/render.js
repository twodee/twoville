import {
  BoundingBox,
  SourceLocation,
  Token,
  clearChildren,
  formatFloat,
  removeClassMembers,
  removeClassMembersExcept,
  svgNamespace,
} from './common.js';

import {
  Expression,
  ExpressionBoolean,
  ExpressionInteger,
  ExpressionReal,
  ExpressionString,
  ExpressionVector,
} from './ast.js';

import {
  Shape,
} from './shape.js';

import {
  Inflater,
} from './inflater.js';

import {clamp} from './math.js';
import {Frame} from './frame.js';

export class RenderEnvironment extends Frame {
  embody(object, inflater) {
    super.embody(null, object, inflater);
    this.shapes = object.shapes.map(shape => Shape.inflate(shape, Inflater));

    // this.resolveReferences();
    // for (let shape of this.shapes) {
      // shape.resolveReferences();
    // }

    this.bounds = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      startTime: 0,
      stopTime: 0,
      // nticks: 0
    };

    this.rasters = {};
  }

  addRaster(id, raster) {
    this.rasters[id] = raster;
  }

  static inflate(svg, mouseStatusLabel, pod, settings, inflater) {
    const scene = new RenderEnvironment();
    scene.svg = svg;
    scene.mouseStatusLabel = mouseStatusLabel;
    scene.root = scene;
    scene.isMouseDown = false;
    scene.settings = settings;
    scene.embody(pod, inflater);

    return scene;
  }

  clear() {
    clearChildren(this.svg);
  }

  initializeDom() {
    this.mouseAtSvg = this.svg.createSVGPoint();

    this.svg.addEventListener('wheel', this.onWheel);
    this.svg.addEventListener('mousedown', this.onMouseDown);
    this.svg.addEventListener('mousemove', this.onMouseMove);
    this.svg.addEventListener('mouseup', this.onMouseUp);

    this.defines = document.createElementNS(svgNamespace, 'defs');
    this.svg.appendChild(this.defines);

    const style = document.createElementNS(svgNamespace, 'style');
    this.svg.appendChild(style);

    style.textContent = `
      .grid-line {
        vector-effect: non-scaling-stroke;
      }

      text {
        font-family: sans-serif;
      }
    `;

    const viewProperties = this.getStatic('view');
    let size = viewProperties.get('size');

    let corner;
    if (viewProperties.has('corner')) {
      corner = viewProperties.get('corner');
    } else if (viewProperties.has('center')) {
      let center = viewProperties.get('center');
      corner = new ExpressionVector([
        new ExpressionReal(center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(center.get(1).value - size.get(1).value * 0.5),
      ]);
    } else {
      corner = new ExpressionVector([
        new ExpressionInteger(0),
        new ExpressionInteger(0),
      ]);
    }

    this.fitBounds = {
      x: corner.get(0).value,
      y: corner.get(1).value,
      width: size.get(0).value,
      height: size.get(1).value,
    };
    this.fitBounds.span = this.fitBounds.y + (this.fitBounds.y + this.fitBounds.height);
    this.fit();

    this.bounds.startTime = this.get('time').get('start').value;
    this.bounds.stopTime = this.get('time').get('stop').value;

    this.mainGroup = document.createElementNS(svgNamespace, 'g');
    this.mainGroup.setAttributeNS(null, 'id', 'main-group');
    this.svg.appendChild(this.mainGroup);

    this.backgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.backgroundMarkGroup.setAttributeNS(null, 'id', 'background-mark-group');
    this.backgroundMarkGroup.classList.add('mark-group');
    this.svg.appendChild(this.backgroundMarkGroup);

    this.midgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.midgroundMarkGroup.setAttributeNS(null, 'id', 'midground-mark-group');
    this.midgroundMarkGroup.classList.add('mark-group');
    this.svg.appendChild(this.midgroundMarkGroup);

    this.foregroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.foregroundMarkGroup.setAttributeNS(null, 'id', 'foreground-mark-group');
    this.foregroundMarkGroup.classList.add('mark-group');
    this.svg.appendChild(this.foregroundMarkGroup);

    this.centeredForegroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.centeredForegroundMarkGroup.setAttributeNS(null, 'id', 'centered-foreground-mark-group');
    this.centeredForegroundMarkGroup.classList.add('mark-group');
    this.svg.appendChild(this.centeredForegroundMarkGroup);

    this.sceneMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.sceneMarkGroup.setAttributeNS(null, 'id', 'scene-mark-group');
    this.sceneMarkGroup.classList.add('mark-group');
    this.backgroundMarkGroup.appendChild(this.sceneMarkGroup);

    const fromTime = this.getStatic('time').get('start').value;
    const toTime = this.getStatic('time').get('stop').value;
    for (let shape of this.shapes) {
      shape.validate(fromTime, toTime);
    }

    for (let shape of this.shapes) {
      shape.initializeState();
    }

    for (let shape of this.shapes) {
      shape.initializeMarkState();
    }

    for (let shape of this.shapes) {
      shape.initializeDom(this);
    }

    for (let shape of this.shapes) {
      shape.initializeMarkDom(this);
    }

    // const boundingBox = new BoundingBox();
    // for (let shape of this.shapes) {
      // shape.configure(this.bounds);
      // boundingBox.encloseBox(shape.boundingBox);
    // }

    // if (viewProperties.get('autofit').value) {
      // this.fitBounds = {
        // x: boundingBox.min[0],
        // y: boundingBox.min[1],
        // width: boundingBox.width,
        // height: boundingBox.height,
      // };
      // this.fitBounds.span = this.fitBounds.y + (this.fitBounds.y + this.fitBounds.height);
      // this.fit();

      // TODO: Is this the best way to ensure that the transform gets updated?
      // for (let shape of this.shapes) {
        // for (let transform of shape.transforms) {
          // transform.updateDomCommand(this.bounds);
        // }
      // }
    // }

    let pageOutline = document.createElementNS(svgNamespace, 'rect');
    pageOutline.setAttributeNS(null, 'id', 'x-outline');
    pageOutline.setAttributeNS(null, 'visibility', this.settings.showPageOutline ? 'visible' : 'hidden');
    pageOutline.setAttributeNS(null, 'x', this.fitBounds.x);
    pageOutline.setAttributeNS(null, 'y', this.fitBounds.y);
    pageOutline.setAttributeNS(null, 'width', this.fitBounds.width);
    pageOutline.setAttributeNS(null, 'height', this.fitBounds.height);
    pageOutline.classList.add('mark', 'view-outline');
    this.sceneMarkGroup.appendChild(pageOutline);

    this.state = {};
    this.drawables = this.shapes;// TODO.filter(shape => shape.isDrawable);
    this.isStarted = true;
  }

  stop() {
    this.svg.removeEventListener('wheel', this.onWheel);
    this.svg.removeEventListener('mousedown', this.onMouseDown);
    this.svg.removeEventListener('mousemove', this.onMouseMove);
    this.svg.removeEventListener('mouseup', this.onMouseUp);
  }

  include(box) {
    this.box.include(box.min);
    this.box.include(box.max);
  }

  synchronizeState(t) {
    for (let drawable of this.drawables) {
      drawable.synchronizeState(t);
    }
  }

  synchronizeDom(t) {
    for (let drawable of this.drawables) {
      drawable.synchronizeDom(t, this.bounds);
    }
  }

  synchronizeMarkExpressions(t) {
    for (let drawable of this.drawables) {
      drawable.synchronizeMarkExpressions(t);
    }
  }

  synchronizeMarkState(t) {
    for (let drawable of this.drawables) {
      drawable.synchronizeMarkState(t);
    }
  }

  synchronizeMarkDom(t) {
    for (let drawable of this.drawables) {
      drawable.synchronizeMarkDom(t, this.bounds);
    }
  }

  // flushManipulation() {
    // const matrix = this.svg.getScreenCTM();
    // const factor = matrix.a;
    // for (let shape of this.shapes) {
      // shape.flushManipulation(this.bounds, factor);
    // }
  // }

  // ageContent(t) {
    // this.state.t = t;
    // for (let drawable of this.drawables) {
      // if (drawable.activate(t)) {
        // drawable.ageDomWithoutMarks(this.bounds, t);
      // }
    // }
  // }

  // ageContentAndInteraction(t) {
    // const matrix = this.svg.getScreenCTM();
    // const factor = matrix.a;

    // this.state.t = t;
    // for (let drawable of this.drawables) {
      // if (drawable.activate(t)) {
        // drawable.ageDomWithMarks(this.bounds, t, factor);
      // }
    // }

    // this.rescale();
  // }

  hideMarks() {
    this.sceneMarkGroup.setAttributeNS(null, 'visibility', 'hidden');
    for (let shape of this.shapes) {
      shape.hideMarks();
    }
  }

  updateViewBox() {
    svg.setAttributeNS(null, 'viewBox', `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`);
    if (this.isStarted) {
      this.rescale();
    }
    this.currentTransform = this.svg.getScreenCTM().inverse();
  }

  rebound(oldBounds) {
    this.bounds = oldBounds;
    this.updateViewBox();
  }

  fit() {
    this.bounds.x = this.fitBounds.x;
    this.bounds.y = this.fitBounds.y;
    this.bounds.width = this.fitBounds.width;
    this.bounds.height = this.fitBounds.height;
    this.bounds.span = this.bounds.y + (this.bounds.y + this.bounds.height);
    this.updateViewBox();
  }

  cloneSvgWithoutMarks() {
    // Inkscape doesn't honor the visibility: hidden attribute. As a workaround,
    // we forcibly remove marks from the SVG.
    // https://bugs.launchpad.net/inkscape/+bug/166181
    let clone = this.svg.cloneNode(true);
    clone.removeAttribute('style');
    clone.setAttributeNS(null, 'viewBox', `${this.fitBounds.x} ${this.fitBounds.y} ${this.fitBounds.width} ${this.fitBounds.height}`);
    removeClassMembers(clone, 'mark-group');
    return clone;
  }

  rescale() {
    const matrix = this.svg.getScreenCTM();
    const factor = matrix.a;
    // TODO should this be all shapes?
    for (let shape of this.drawables) {
      if (shape.state.isEnabled) {
        shape.updateContentDom(this.bounds, factor);
        shape.updateInteractionDom(this.bounds, factor);
      }
    }
  }

  stale() {
    if (!this.isStale && !this.isTweaking) {
      const circles = this.foregroundMarkGroup.querySelectorAll('.filled-mark');
      for (let circle of circles) {
        circle.classList.add('disabled-mark');
      }
      const marks = this.foregroundMarkGroup.querySelectorAll('.mark');
      for (let mark of marks) {
        mark.classList.add('disabled-mark');
      }
      this.isStale = true;
    }
  }

  contextualizeCursor(element) {
    document.documentElement.classList.remove('grab', 'grabbing');
    
    // Only show the cursor when the source and canvas are synchronized.
    if (element && !this.isStale) {
      if (element.classList.contains('mark')) {
        document.documentElement.classList.add('grab');
      }
    }
  }

  select(shape) {
    // Only select the shape if it's not already selected.
    if (shape !== this.selectedShape) {
      this.selectNothing();
      this.selectedShape = shape;
      this.selectedShape.select();
    }
  }

  selectNothing() {
    if (this.selectedShape) {
      this.selectedShape.deselect();
      this.selectedShape = null;
    }
  }

  reselect(oldSelectedShape) {
    // Don't use drawables here, because the shape might be a child shape. And
    // child shapes aren't in drawables.
    const shape = this.shapes.find(shape => shape.id === oldSelectedShape.id);
    if (shape) {
      this.select(shape);
      if (oldSelectedShape.selectedMarker) {
        shape.selectMarker(oldSelectedShape.selectedMarker.id);
      }
    }
  }

  castCursor(column, row) {
    if (this.isTweaking) return;

    let selectedDrawable;
    for (let shape of this.shapes) {
      if (shape.castCursor(column, row)) {
        break;
      }
    }
  }

  onWheel = e => {
    if (this.isStarted && !this.isTweaking) {
      this.mouseAtSvg.x = e.clientX;
      this.mouseAtSvg.y = e.clientY;
      const matrix = this.svg.getScreenCTM().inverse();
      let center = this.mouseAtSvg.matrixTransform(matrix);

      const delta = wheelDistance(e);

      let factor = clamp(1 + delta, 0.9, 1.1);
      let zoomRatio = this.fitBounds.width / this.bounds.width;

      // factor > 1 means zooming out
      // factor < 1 means zooming in

      // TODO add settings to control the maximum and minimum zoom
      if ((zoomRatio < 20 || factor > 1) && (zoomRatio > 0.05 || factor < 1)) {
        this.bounds.x = (this.bounds.x - center.x) * factor + center.x;
        this.bounds.y = (this.bounds.y - center.y) * factor + center.y;
        this.bounds.width *= factor;
        this.bounds.height *= factor;
        this.updateViewBox();

        // this.rescale();
      }
    }
  };

  onMouseDown = e => {
    // Since mouse drags change the SVG's matrix, I need to cache the starting
    // matrix here so that all the mouse coordinates are in the same space.
    this.mouseAtSvg.x = e.clientX;
    this.mouseAtSvg.y = e.clientY;
    this.mouseDownTransform = this.svg.getScreenCTM().inverse();
    this.mouseAt = this.mouseAtSvg.matrixTransform(this.mouseDownTransform);
    this.isMouseDown = true;
  };

  onMouseMove = e => {
    this.mouseAtSvg.x = e.clientX;
    this.mouseAtSvg.y = e.clientY;

    if (this.isMouseDown) {
      const newMouseAt = this.mouseAtSvg.matrixTransform(this.mouseDownTransform);
      let delta = [newMouseAt.x - this.mouseAt.x, newMouseAt.y - this.mouseAt.y];
      this.bounds.x -= delta[0];
      this.bounds.y -= delta[1];
      this.updateViewBox();
      this.mouseAt = newMouseAt;
    }

    const mouseNowAt = this.mouseAtSvg.matrixTransform(this.currentTransform);
    this.mouseStatusLabel.innerText = `[${formatFloat(mouseNowAt.x, this.settings.mousePrecision)}, ${formatFloat(this.bounds.span - mouseNowAt.y, this.settings.mousePrecision)}]`;
  };

  onMouseUp = e => {
    if (this.isMouseDown) {
      this.selectNothing();
      this.isMouseDown = false;
    }
  };
}

// --------------------------------------------------------------------------- 

function wheelDistance(event) {
  // https://stackoverflow.com/questions/10744645/detect-touchpad-vs-mouse-in-javascript/54861787#54861787
  const isTouchPad = event.wheelDeltaY ? event.wheelDeltaY === -3 * event.deltaY : event.deltaMode === 0;

  let delta = event.deltaY;

  // Firefox ~89 reports the delta in lines, while every other browser seems to use pixels.
  // We scale up the lines. The font size defaults to 16, but that number is too small. I 
  // bumped this up arbitrarily.
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    delta *= 30;
  }

  return delta / 120 * (isTouchPad ? 1 : 0.1);
}

// --------------------------------------------------------------------------- 
