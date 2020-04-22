import {
  SourceLocation,
  clearChildren,
  removeClassMembers,
  svgNamespace,
} from './common.js';

import {
  ExpressionBoolean,
  ExpressionInteger,
  ExpressionReal,
  ExpressionString,
  ExpressionVector,
} from './ast.js';

import {
  Environment,
  Mirror,
  Stroke,
} from './environment.js';

import {
  Shape,
  Group,
} from './shape.js';

import {
  ArcNode,
  CubicNode,
  JumpNode,
  LineNode,
  MoveNode,
  QuadraticNode,
  VertexNode,
  TurtleNode,
  TurnNode,
} from './node.js';

import {
  Rotate,
  Scale,
  Shear,
  Translate,
} from './transform.js';

import {
  Timeline,
} from './timeline.js';

export class RenderEnvironment extends Environment {
  embody(env, pod) {
    super.embody(env, pod);
    this.shapes = [];
    for (let shape of pod.shapes) {
      this.shapes.push(Shape.reify(this, shape));
    }
    this.bounds = {x: 0, y: 0, width: 0, height: 0};
  }

  static reify(svg, pod) {
    const scene = new RenderEnvironment();
    scene.svg = svg;
    scene.omniReify = RenderEnvironment.omniReify;
    scene.root = scene;
    scene.embody(undefined, pod);
    return scene;
  }

  static omniReify(env, pod) {
    if (!pod) {
      return undefined;
    } else if (pod.type === 'environment') {
      return Environment.reify(env, pod);
    } else if (pod.type === 'reference') {
      return env.root.shapes.find(shape => shape.id === pod.id);
    } else if (pod.type === 'stroke') {
      return Stroke.reify(env, pod);
    } else if (pod.type === 'mirror') {
      return Mirror.reify(env, pod);
    } else if (pod.type === 'timeline') {
      return Timeline.reify(env, pod);
    } else if (pod.type === 'vertex') {
      return VertexNode.reify(env, pod);
    } else if (pod.type === 'turtle') {
      return TurtleNode.reify(env, pod);
    } else if (pod.type === 'move') {
      return MoveNode.reify(env, pod);
    } else if (pod.type === 'turn') {
      return TurnNode.reify(env, pod);
    } else if (pod.type === 'jump') {
      return JumpNode.reify(env, pod);
    } else if (pod.type === 'line') {
      return LineNode.reify(env, pod);
    } else if (pod.type === 'quadratic') {
      return QuadraticNode.reify(env, pod);
    } else if (pod.type === 'cubic') {
      return CubicNode.reify(env, pod);
    } else if (pod.type === 'arc') {
      return ArcNode.reify(env, pod);
    } else if (pod.type === 'translate') {
      return Translate.reify(env, pod);
    } else if (pod.type === 'scale') {
      return Scale.reify(env, pod);
    } else if (pod.type === 'rotate') {
      return Rotate.reify(env, pod);
    } else if (pod.type === 'group') {
      return Group.reify(env, pod);
    } else if (pod.type === 'shear') {
      return Shear.reify(env, pod);
    } else if (pod.type === 'ExpressionReal') {
      return new ExpressionReal(pod.value, SourceLocation.reify(pod.where));
    } else if (pod.type === 'ExpressionBoolean') {
      return new ExpressionBoolean(pod.value, SourceLocation.reify(pod.where));
    } else if (pod.type === 'ExpressionInteger') {
      return new ExpressionInteger(pod.value, SourceLocation.reify(pod.where));
    } else if (pod.type === 'ExpressionString') {
      return new ExpressionString(pod.value, SourceLocation.reify(pod.where));
    } else if (pod.type === 'ExpressionVector') {
      return new ExpressionVector(pod.value.map(element => RenderEnvironment.omniReify(env, element)), SourceLocation.reify(pod.where));
    } else {
      console.log(pod);
      throw Error('can\'t reify');
    }
  }

  clear() {
    clearChildren(this.svg);
  }

  start() {
    this.mouseAtSvg = this.svg.createSVGPoint();

    this.svg.addEventListener('wheel', this.onWheel, {passive: true});
    this.svg.addEventListener('mousedown', this.onMouseDown);

    this.defines = document.createElementNS(svgNamespace, 'defs');
    this.svg.appendChild(this.defines);

    let size = this.get('viewport').get('size');

    if (this.get('viewport').owns('color')) {
      let color = this.get('viewport').get('color');
      svg.setAttributeNS(null, 'style', `background-color: ${color.toColor()}`);
    } else {
      svg.setAttributeNS(null, 'style', `initial`);
    }

    let corner;
    if (this.get('viewport').owns('corner')) {
      corner = this.get('viewport').get('corner');
    } else if (this.get('viewport').owns('center')) {
      let center = this.get('viewport').get('center');
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

    // previousFitBounds = fitBounds;
    this.fitBounds = {
      x: corner.get(0).value,
      y: corner.get(1).value,
      width: size.get(0).value,
      height: size.get(1).value,
    };
    this.fitBounds.span = this.fitBounds.y + (this.fitBounds.y + this.fitBounds.height);

    // for (let filler of this.viewportFillers) {
      // filler.setAttributeNS(null, 'x', this.fitBounds.x);
      // filler.setAttributeNS(null, 'y', this.fitBounds.y);
      // filler.setAttributeNS(null, 'width', this.fitBounds.width);
      // filler.setAttributeNS(null, 'height', this.fitBounds.height);
    // }

    // Retain viewBox only if we've rendered previously and the viewport hasn't
    // changed. Otherwise we fit the viewBox to the viewport.
    if (this.previousBounds &&
        this.fitBounds.x == previousFitBounds.x &&
        this.fitBounds.y == previousFitBounds.y &&
        this.fitBounds.width == previousFitBounds.width &&
        this.fitBounds.height == previousFitBounds.height) {
      this.bounds.x = this.previousBounds.x;
      this.bounds.y = this.previousBounds.y;
      this.bounds.width = this.previousBounds.width;
      this.bounds.height = this.previousBounds.height;
      this.bounds.span = this.previousBounds.span;
      this.updateViewBox();
    } else {
      this.fit();
    }

    let pageOutline = document.createElementNS(svgNamespace, 'rect');
    pageOutline.setAttributeNS(null, 'id', 'x-outline');
    pageOutline.setAttributeNS(null, 'visibility', 'visible');
    pageOutline.setAttributeNS(null, 'x', this.fitBounds.x);
    pageOutline.setAttributeNS(null, 'y', this.fitBounds.y);
    pageOutline.setAttributeNS(null, 'width', this.fitBounds.width);
    pageOutline.setAttributeNS(null, 'height', this.fitBounds.height);
    pageOutline.classList.add('mark', 'outline-mark');

    this.delay = this.get('time').get('delay').value;
    this.tmin = this.get('time').get('start').value;
    this.tmax = this.get('time').get('stop').value;
    this.resolution = this.get('time').get('resolution').value;
    this.nTicks = (this.tmax - this.tmin) * this.resolution;

    this.mainGroup = document.createElementNS(svgNamespace, 'g');
    this.mainGroup.setAttributeNS(null, 'id', 'main-group');
    this.svg.appendChild(this.mainGroup);

    this.backgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.backgroundMarkGroup.setAttributeNS(null, 'id', 'background-mark-group');
    this.svg.appendChild(this.backgroundMarkGroup);

    this.midgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.midgroundMarkGroup.setAttributeNS(null, 'id', 'midground-mark-group');
    this.svg.appendChild(this.midgroundMarkGroup);

    this.foregroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.foregroundMarkGroup.setAttributeNS(null, 'id', 'foreground-mark-group');
    this.svg.appendChild(this.foregroundMarkGroup);

    this.centeredForegroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.centeredForegroundMarkGroup.setAttributeNS(null, 'id', 'centered-foreground-mark-group');
    this.svg.appendChild(this.centeredForegroundMarkGroup);

    this.markGroup = document.createElementNS(svgNamespace, 'g');
    this.markGroup.setAttributeNS(null, 'id', 'mark-group');
    this.markGroup.appendChild(pageOutline);
    this.backgroundMarkGroup.appendChild(this.markGroup);

    for (let shape of this.shapes) {
      shape.validate();
      shape.start();
    }

    this.drawables = this.shapes.filter(shape => shape.isDrawable);

    this.isStarted = true;
  }

  stop() {
    this.svg.removeEventListener('wheel', this.onWheel);
    this.svg.removeEventListener('mousedown', this.onMouseDown);
    this.svg.removeEventListener('mousemove', this.onMouseMove);
    this.svg.removeEventListener('mouseup', this.onMouseUp);
  }

  scrub(t) {
    // Don't target shapes. Non-drawable shapes should get scrubbed by their parents.
    for (let drawable of this.drawables) {
      drawable.scrub(this, t, this.bounds);
    }
    this.unscaleMarks();
  }

  hideMarks() {
    this.markGroup.setAttributeNS(null, 'visibility', 'hidden');
  }

  updateViewBox() {
    svg.setAttributeNS(null, 'viewBox', `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`);
    if (this.isStarted) {
      this.unscaleMarks();
    }
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
    // we forcibly remove them from the SVG.
    // https://bugs.launchpad.net/inkscape/+bug/166181
    let clone = this.svg.cloneNode(true);
    clone.setAttributeNS(null, 'viewBox', `${this.fitBounds.x} ${this.fitBounds.y} ${this.fitBounds.width} ${this.fitBounds.height}`);
    removeClassMembers(clone);
    return clone;
  }

  unscaleMarks() {
    const matrix = this.svg.getScreenCTM();
    const factor = matrix.a;
    for (let shape of this.shapes) {
      shape.unscaleMarks(factor);
    }
  }

  stale() {
    if (!this.isStale && !this.isTweaking) {
      const circles = this.foregroundMarkGroup.querySelectorAll('.filled-mark');
      for (let circle of circles) {
        circle.classList.add('stale-mark');
      }
      this.isStale = true;
    }
  }

  getTime(tick) {
    return this.tmin + tick / this.resolution;
  }

  tickToTime(tick) {
    let proportion = tick / this.nTicks;
    return Math.round(this.tmin + proportion * (this.tmax - this.tmin));
  }

  timeToTick(time) {
    return Math.round((this.time - this.tmin) / (this.tmax - this.tmin) * this.nTicks);
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
      this.deselect();
      this.selectedShape = shape;
      this.selectedShape.select();
    }
  }

  deselect() {
    if (this.selectedShape) {
      this.selectedShape.deselect();
      this.selectedShape = undefined;
    }
  }

  reselect(oldSelectedShape) {
    const shape = this.drawables.find(shape => shape.id == oldSelectedShape.id);
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

      let factor = 1 + e.deltaY / 100;
      this.bounds.x = (this.bounds.x - center.x) * factor + center.x;
      this.bounds.y = (this.bounds.y - center.y) * factor + center.y;
      this.bounds.width *= factor;
      this.bounds.height *= factor;
      this.updateViewBox();

      this.unscaleMarks();
    }
  };

  onMouseDown = e => {
    // Since mouse drags change the SVG's matrix, I need to cache the starting
    // matrix here so that all the mouse coordinates are in the same space.
    this.mouseAtSvg.x = e.clientX;
    this.mouseAtSvg.y = e.clientY;
    this.mouseTransform = this.svg.getScreenCTM().inverse();
    this.mouseAt = this.mouseAtSvg.matrixTransform(this.mouseTransform);

    this.svg.addEventListener('mousemove', this.onMouseMove);
    this.svg.addEventListener('mouseup', this.onMouseUp);
  };

  onMouseMove = e => {
    this.mouseAtSvg.x = e.clientX;
    this.mouseAtSvg.y = e.clientY;
    const newMouseAt = this.mouseAtSvg.matrixTransform(this.mouseTransform);

    let delta = [newMouseAt.x - this.mouseAt.x, newMouseAt.y - this.mouseAt.y];
    this.bounds.x -= delta[0];
    this.bounds.y -= delta[1];
    this.updateViewBox();
    this.mouseAt = newMouseAt;
  };

  onMouseUp = e => {
    this.deselect();
    this.svg.removeEventListener('mousemove', this.onMouseMove);
    this.svg.removeEventListener('mouseup', this.onMouseUp);
  };
}

// --------------------------------------------------------------------------- 

