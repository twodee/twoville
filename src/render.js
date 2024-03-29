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

    // After inflating, shapes may contain symbolic references to other shapes.
    // We resolve those symbolic references into real references.
    for (let shape of this.shapes) {
      shape.resolveReferences(this.shapes);
    }
    // this.resolveReferences(); TODO is this needed?

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

  static inflate(svg, mouseStatusLabel, contextMenu, showInCodeButton, pod, settings, inflater) {
    const scene = new RenderEnvironment();
    scene.svg = svg;
    scene.mouseStatusLabel = mouseStatusLabel;
    scene.root = scene;
    scene.isMouseDown = false;
    scene.settings = settings;
    scene.embody(pod, inflater);
    scene.contextMenu = contextMenu;
    scene.showInCodeButton = showInCodeButton;
    return scene;
  }

  clear() {
    clearChildren(this.svg);
  }

  initializeDom() {
    this.mouseAtPixels = this.svg.createSVGPoint();
    this.lastMouseAtPixels = this.svg.createSVGPoint();

    this.svg.addEventListener('wheel', this.onWheel);
    this.svg.addEventListener('mouseleave', this.onMouseLeave);
    this.svg.addEventListener('mousedown', this.onMouseDown);
    this.svg.addEventListener('mousemove', this.onMouseMove);
    this.svg.addEventListener('mouseup', this.onMouseUp);
    this.svg.addEventListener('contextmenu', this.onContextMenu);

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

    const view = this.getStatic('view');
    let size = view.get('size');

    let corner;
    if (view.has('corner')) {
      corner = view.get('corner');
    } else if (view.has('center')) {
      let center = view.get('center');
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

    if (view.hasStatic('units')) {
      this.units = view.getStatic('units').value;
    }

    this.fitBounds = BoundingBox.fromCornerSize(corner.toPrimitiveArray(), size.toPrimitiveArray());
    if (view.hasStatic('padding')) {
      this.fitBounds.dilate(view.getStatic('padding').value);
    }
    this.fit();

    this.bounds.startTime = this.get('time').get('start').value;
    this.bounds.stopTime = this.get('time').get('stop').value;

    this.mainGroup = document.createElementNS(svgNamespace, 'g');
    this.mainGroup.setAttributeNS(null, 'id', 'main-group');
    this.svg.appendChild(this.mainGroup);

    this.staticBackgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.staticBackgroundMarkGroup.setAttributeNS(null, 'id', 'static-background-mark-group');
    this.staticBackgroundMarkGroup.classList.add('mark-group');
    this.svg.appendChild(this.staticBackgroundMarkGroup);

    this.dynamicBackgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.dynamicBackgroundMarkGroup.setAttributeNS(null, 'id', 'dynamic-background-mark-group');
    this.dynamicBackgroundMarkGroup.classList.add('mark-group');
    this.svg.appendChild(this.dynamicBackgroundMarkGroup);

    this.situatedForegroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.situatedForegroundMarkGroup.setAttributeNS(null, 'id', 'situated-foreground-mark-group');
    this.situatedForegroundMarkGroup.classList.add('mark-group');
    this.svg.appendChild(this.situatedForegroundMarkGroup);

    this.centeredForegroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.centeredForegroundMarkGroup.setAttributeNS(null, 'id', 'centered-foreground-mark-group');
    this.centeredForegroundMarkGroup.classList.add('mark-group');
    this.svg.appendChild(this.centeredForegroundMarkGroup);

    this.sceneMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.sceneMarkGroup.setAttributeNS(null, 'id', 'scene-mark-group');
    this.sceneMarkGroup.classList.add('mark-group');
    this.staticBackgroundMarkGroup.appendChild(this.sceneMarkGroup);

    this.drawables = this.shapes.filter(shape => !shape.isChild);
    const fromTime = this.getStatic('time').get('start').value;
    const toTime = this.getStatic('time').get('stop').value;
    for (let shape of this.drawables) {
      shape.validate(fromTime, toTime);
    }

    for (let shape of this.drawables) {
      shape.initializeState();
    }

    for (let shape of this.drawables) {
      shape.initializeMarkState();
    }

    for (let shape of this.drawables) {
      shape.initializeDom(this);
    }

    for (let shape of this.drawables) {
      shape.initializeMarkDom(this);
    }

    this.isAutofit = view.get('autofit').value;

    this.pageOutline = document.createElementNS(svgNamespace, 'rect');
    this.pageOutline.setAttributeNS(null, 'id', 'x-outline');
    this.pageOutline.setAttributeNS(null, 'visibility', this.settings.showPageOutline ? 'visible' : 'hidden');
    this.synchronizeOutline();
    this.pageOutline.classList.add('mark', 'view-outline');
    this.sceneMarkGroup.appendChild(this.pageOutline);

    this.state = {};
    this.isStarted = true;
  }

  synchronizeOutline() {
    this.pageOutline.setAttributeNS(null, 'x', this.fitBounds.x);
    this.pageOutline.setAttributeNS(null, 'y', -this.fitBounds.y - this.fitBounds.height);
    this.pageOutline.setAttributeNS(null, 'width', this.fitBounds.width);
    this.pageOutline.setAttributeNS(null, 'height', this.fitBounds.height);
  }

  stop() {
    this.svg.removeEventListener('wheel', this.onWheel);
    this.svg.removeEventListener('mousedown', this.onMouseDown);
    this.svg.removeEventListener('mouseleave', this.onMouseLeave);
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

  synchronizeWithView() {
    if (this.isAutofit) {
      this.fitBounds = new BoundingBox();
      for (let shape of this.shapes) {
        this.fitBounds.encloseBox(shape.boundingBox);
      }

      const view = this.getStatic('view');
      if (view.hasStatic('padding')) {
        this.fitBounds.dilate(view.getStatic('padding').value);
      }

      this.fit();
      this.synchronizeOutline();
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
      drawable.synchronizeMarkState(t, this.bounds);
    }
  }

  get handleRadius() {
    return this.settings.handleSize / this.svg.getScreenCTM().a;
  }

  get radialLength() {
    return 100 / this.svg.getScreenCTM().a;
  }

  synchronizeMarkDom() {
    const handleRadius = this.handleRadius;
    const radialLength = this.radialLength;
    for (let drawable of this.drawables) {
      drawable.synchronizeMarkDom(this.bounds, handleRadius, radialLength);
    }
  }

  hideMarks() {
    this.sceneMarkGroup.setAttributeNS(null, 'visibility', 'hidden');
    for (let shape of this.shapes) {
      shape.hideMarks();
    }
  }

  updateViewBox() {
    svg.setAttributeNS(null, 'viewBox', `${this.bounds.x} ${-this.bounds.y - this.bounds.height} ${this.bounds.width} ${this.bounds.height}`);
    // This was commented out, but I don't know why. It is needed to
    // rescale the marks.
    if (this.isStarted) {
      this.synchronizeMarkDom();
    }
    this.synchronizeToSize();
    // this.currentTransform = this.svg.getScreenCTM().inverse();
  }

  synchronizeToSize() {
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
    this.updateViewBox();
  }

  cloneSvgWithoutMarks() {
    // Inkscape doesn't honor the visibility: hidden attribute. As a workaround,
    // we forcibly remove marks from the SVG.
    // https://bugs.launchpad.net/inkscape/+bug/166181
    let clone = this.svg.cloneNode(true);
    clone.removeAttribute('style');
    clone.setAttributeNS(null, 'viewBox', `${this.fitBounds.x} ${-this.fitBounds.y - this.fitBounds.height} ${this.fitBounds.width} ${this.fitBounds.height}`);
    if (this.units) {
      clone.setAttributeNS(null, 'width', `${this.fitBounds.width}${this.units}`);
      clone.setAttributeNS(null, 'height', `${this.fitBounds.height}${this.units}`);
    }
    removeClassMembers(clone, 'mark-group');
    return clone;
  }

  stale() {
    if (!this.isStale && !this.isTweaking) {
      const circles = this.situatedForegroundMarkGroup.querySelectorAll('.filled-mark');
      for (let circle of circles) {
        circle.classList.add('disabled-mark');
      }
      const marks = this.situatedForegroundMarkGroup.querySelectorAll('.mark');
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

  select(shape, markerId = 0) {
    // If the shape is not displaying, it might not have all its properties in
    // order, so we shouldn't allow it to be selected.
    if (!shape.state.display) {
      return;
    }

    // Only select the shape if it's not already selected. Otherwise the
    // deselection might lose the selected component.
    if (this.selectedShape !== shape) {
      this.selectNothing();
      this.selectedShape = shape;
      this.selectedShape.select(markerId);
    } else {
      this.selectedShape.selectMarker(markerId);
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
      if (oldSelectedShape.selectedMarkerId) {
        this.select(shape, oldSelectedShape.selectedMarkerId);
      } else {
        this.select(shape, 0);
      }
    }
  }

  castCursor(column, row) {
    if (this.isTweaking) return;

    for (let shape of this.shapes) {
      if (shape.castCursor(this, column, row)) {
        return;
      }
    }
  }

  onWheel = e => {
    if (this.isStarted && !this.isTweaking) {
      this.mouseAtPixels.x = e.clientX;
      this.mouseAtPixels.y = e.clientY;
      const matrix = this.svg.getScreenCTM().inverse();
      let center = this.mouseAtPixels.matrixTransform(matrix);
      center.y = -center.y;

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
      }
    }
  };

  onContextMenu = e => {
    if (e.shiftKey) {
      return;
    }

    // Context menu events are preceded by down events. But there's no
    // corresponding up event. We want to manually cancel the drag.
    this.isMouseDown = false;

    this.contextMenu.style.display = 'flex';
    this.contextMenu.style.top = (e.pageY - 5) + 'px';
    this.contextMenu.style.left = (e.pageX - 5) + 'px';

    if (this.mouseShape) {
      this.showInCodeButton.style.display = 'block';
    } else {
      this.showInCodeButton.style.display = 'none';
    }
    
    e.preventDefault();
    return false;
  }

  onMouseLeave = e => {
    this.mouseStatusLabel.innerText = '';
  };

  onMouseDown = e => {
    this.contextMenu.style.display = 'none';

    // Since mouse drags change the SVG's matrix, I need to cache the starting
    // matrix here so that all the mouse coordinates are in the same space.
    this.mouseAtPixels.x = e.clientX;
    this.mouseAtPixels.y = e.clientY;
    this.mouseDownTransform = this.svg.getScreenCTM().inverse();
    this.mouseAt = this.mouseAtPixels.matrixTransform(this.mouseDownTransform);
    this.mouseAt.y = -this.mouseAt.y;
    this.isMouseDown = true;

    // Clicks on the SVG canvas can mean different things. A click could be the
    // user panning the entire canvas or it could be a click to deselect the
    // current shape. I distinguish between these two by tracking the absolute
    // drift.
    this.mouseDrift = 0;
  };

  onMouseMove = e => {
    const tmp = this.lastMouseAtPixels;
    this.lastMouseAtPixels = this.mouseAtPixels;
    this.mouseAtPixels = tmp;

    this.mouseAtPixels.x = e.clientX;
    this.mouseAtPixels.y = e.clientY;

    if (this.isMouseDown) {
      const newMouseAt = this.mouseAtPixels.matrixTransform(this.mouseDownTransform);
      newMouseAt.y = -newMouseAt.y;
      let delta = [newMouseAt.x - this.mouseAt.x, newMouseAt.y - this.mouseAt.y];
      this.bounds.x -= delta[0];
      this.bounds.y -= delta[1];
      this.updateViewBox();
      this.mouseAt = newMouseAt;
      this.mouseDrift += Math.abs(this.mouseAtPixels.x - this.lastMouseAtPixels.x) + Math.abs(this.mouseAtPixels.y - this.lastMouseAtPixels.y);
    }

    const mouseNowAt = this.mouseAtPixels.matrixTransform(this.currentTransform);
    this.mouseStatusLabel.innerText = `[${formatFloat(mouseNowAt.x, this.settings.mousePrecision)}, ${formatFloat(-mouseNowAt.y, this.settings.mousePrecision)}]`;
  };

  onMouseUp = e => {
    if (this.isMouseDown) {
      // If the drift is big, the action must have been a pan. We don't
      // deselect the shape on a pan.
      if (this.mouseDrift < 3) {
        this.selectNothing();
      }
      this.isMouseDown = false;
    }
  };

  mouseLiteral() {
    return `[${formatFloat(this.mouseAt.x, this.settings.mousePrecision)}, ${formatFloat(this.mouseAt.y, this.settings.mousePrecision)}]`;
  }

  mouseEnter(shape) {
    this.mouseShape = shape;
  }

  mouseExit() {
    this.mouseShape = null;
  }
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
