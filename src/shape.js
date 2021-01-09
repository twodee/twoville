import { 
  BoundingBox,
  FunctionDefinition,
  LocatedException,
  SourceLocation,
  Turtle,
  sentenceCase,
  svgNamespace,
} from './common.js';

import {
  TimelinedEnvironment,
} from './environment.js';

import {
  Stroke,
  configureStroke,
} from './stroke.js';

import {
  mirrorPointLine,
  distancePointPoint,
  distancePointLine,
} from './math.js';

import {
  CircleMark,
  HorizontalPanMark,
  LineMark,
  Marker,
  PathMark,
  PolygonMark,
  PolylineMark,
  RectangleMark,
  VectorPanMark,
  VerticalPanMark,
} from './mark.js';

import {
  Matrix,
} from './matrix.js';

import {
  JumpNode,
  Mirror,
  TurtleNode,
  VertexNode,
} from './node.js';

import {
  ExpressionBoolean,
  ExpressionInteger,
  ExpressionJumpNode,
  ExpressionLineNode,
  ExpressionMoveNode,
  ExpressionArcNode,
  ExpressionCubicNode,
  ExpressionMirror,
  ExpressionQuadraticNode,
  ExpressionReal,
  ExpressionString,
  ExpressionTranslate,
  ExpressionRotate,
  ExpressionScale,
  ExpressionShear,
  ExpressionTurnNode,
  ExpressionTurtleNode,
  ExpressionVector,
  ExpressionVertexNode,
} from './ast.js';

// --------------------------------------------------------------------------- 

export class Shape extends TimelinedEnvironment {
  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);

    this.id = this.root.serial;
    this.sourceSpans = [];
    this.transforms = [];

    this.bind('opacity', new ExpressionReal(1));
    this.bind('enabled', new ExpressionBoolean(true));
    this.bindFunction('translate', new FunctionDefinition('translate', [], new ExpressionTranslate(this)));
    this.bindFunction('scale', new FunctionDefinition('scale', [], new ExpressionScale(this)));
    this.bindFunction('rotate', new FunctionDefinition('rotate', [], new ExpressionRotate(this)));
    this.bindFunction('shear', new FunctionDefinition('shear', [], new ExpressionShear(this)));

    this.root.serial += 1;
    this.root.shapes.push(this);
  }

  toExpandedPod() {
    // This version contains full data, unlike toPod, which is just a reference.
    const pod = super.toPod();
    pod.id = this.id;
    pod.sourceSpans = this.sourceSpans;
    pod.transforms = this.transforms.map(transform => transform.toPod());
    return pod;
  }

  toPod() {
    return {type: 'reference', id: this.id};
  }

  embody(parentEnvironment, pod) {
    super.embody(parentEnvironment, pod);
    this.id = pod.id;
    this.sourceSpans = pod.sourceSpans.map(subpod => SourceLocation.reify(subpod));
    this.transforms = pod.transforms.map(subpod => this.root.omniReify(this, subpod));
  }

  static reify(parentEnvironment, pod) {
    if (pod.type === 'rectangle') {
      return Rectangle.reify(parentEnvironment, pod);
    } else if (pod.type === 'circle') {
      return Circle.reify(parentEnvironment, pod);
    } else if (pod.type === 'polygon') {
      return Polygon.reify(parentEnvironment, pod);
    } else if (pod.type === 'polyline') {
      return Polyline.reify(parentEnvironment, pod);
    } else if (pod.type === 'ungon') {
      return Ungon.reify(parentEnvironment, pod);
    } else if (pod.type === 'line') {
      return Line.reify(parentEnvironment, pod);
    } else if (pod.type === 'text') {
      return Text.reify(parentEnvironment, pod);
    } else if (pod.type === 'path') {
      return Path.reify(parentEnvironment, pod);
    } else if (pod.type === 'group') {
      return Group.reify(parentEnvironment, pod);
    } else if (pod.type === 'mask') {
      return Mask.reify(parentEnvironment, pod);
    } else if (pod.type === 'cutout') {
      return Cutout.reify(parentEnvironment, pod);
    } else if (pod.type === 'tip') {
      return Tip.reify(parentEnvironment, pod);
    } else {
      throw new Error(`unimplemented shape: ${pod.type}`);
    }
  }

  show() {
    this.element.setAttributeNS(null, 'visibility', 'visible');
  }

  hide() {
    this.element.setAttributeNS(null, 'visibility', 'hidden');
    for (let marker of this.markers) {
      marker.hideMarks();
    }
  }

  addMarker(marker) {
    marker.id = this.markers.length;
    this.markers.push(marker);
  }
  
  connectToParent() {
    if (this.owns('parent')) {
      this.get('parent').children.push(this);
      this.isDrawable = false;
    } else {
      this.isDrawable = true;
    }

    let elementToConnect;
    if (this.owns('mask')) {
      const mask = this.get('mask');
      const groupElement = document.createElementNS(svgNamespace, 'g');
      groupElement.setAttributeNS(null, 'mask', 'url(#element-' + mask.id + ')');
      groupElement.appendChild(this.element);
      elementToConnect = groupElement;
    } else {
      elementToConnect = this.element;
    }

    if (this.owns('parent')) {
      this.get('parent').element.appendChild(elementToConnect);
    } else {
      this.root.mainGroup.appendChild(elementToConnect);
    }
  }

  connect() {
    this.connectToParent();

    if (this.isCutoutChild) {
      this.bind('color', new ExpressionVector([new ExpressionReal(0), new ExpressionReal(0), new ExpressionReal(0)]));
    }

    if (this.owns('clippers')) {
      let clipPath = document.createElementNS(svgNamespace, 'clipPath');
      clipPath.setAttributeNS(null, 'id', 'clip-' + this.id);
      let clippers = this.get('clippers');
      clippers.forEach(clipper => {
        let use = document.createElementNS(svgNamespace, 'use');
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#element-' + clipper.id);
        clipPath.appendChild(use);
      });
      this.root.defines.appendChild(clipPath);
      this.element.setAttributeNS(null, 'clip-path', 'url(#clip-' + this.id + ')');
    }

    this.initializeMarks();
  }

  get isCutoutChild() {
    return this.owns('parent') && (this.get('parent') instanceof Cutout || this.get('parent').isCutoutChild);
  }

  select() {
    this.isSelected = true;
    this.markers[0].select();
  }

  deselect() {
    this.isSelected = false;
    if (this.selectedMarker) {
      this.selectedMarker.deselect();
    }
    this.selectedMarker = undefined;
    this.markers[0].deselect();
  }

  initializeMarkDom() {
    this.backgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.backgroundMarkGroup.setAttributeNS(null, 'id', `element-${this.id}-background-marks`);

    this.midgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.midgroundMarkGroup.setAttributeNS(null, 'id', `element-${this.id}-midground-marks`);

    this.foregroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.foregroundMarkGroup.setAttributeNS(null, 'id', `element-${this.id}-foreground-marks`);

    this.centeredForegroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.centeredForegroundMarkGroup.setAttributeNS(null, 'id', `element-${this.id}-centered-foreground-marks`);

    this.element.classList.add('cursor-selectable');
    this.element.classList.add(`tag-${this.id}`);
  }

  initializeMarks() {
    if (!this.markers) return;

    if (this.owns('parent')) {
      this.get('parent').backgroundMarkGroup.appendChild(this.backgroundMarkGroup);
      this.get('parent').midgroundMarkGroup.appendChild(this.midgroundMarkGroup);
      this.get('parent').foregroundMarkGroup.appendChild(this.foregroundMarkGroup);
      this.get('parent').centeredForegroundMarkGroup.appendChild(this.centeredForegroundMarkGroup);
    } else {
      this.root.backgroundMarkGroup.appendChild(this.backgroundMarkGroup);
      this.root.midgroundMarkGroup.appendChild(this.midgroundMarkGroup);
      this.root.foregroundMarkGroup.appendChild(this.foregroundMarkGroup);
      this.root.centeredForegroundMarkGroup.appendChild(this.centeredForegroundMarkGroup);
    }

    this.element.addEventListener('click', event => {
      // If the event bubbles up to the parent SVG, that means no shape was
      // clicked on, and everything will be deselected. We don't want that.
      event.stopPropagation();

      if (!this.root.isStale) {
        this.root.select(this);
      }
    });

    this.element.addEventListener('mouseenter', event => {
      if (this.root.isTweaking) return;

      event.stopPropagation();

      // Only show the marks if the source code is evaluated and fresh.
      if (!this.isSelected && !this.root.isStale) {
        this.markers[0].hoverMarks();
      }

      if (event.buttons === 0) {
        this.root.contextualizeCursor(event.toElement);
      }
    });

    this.element.addEventListener('mouseleave', event => {
      event.stopPropagation();

      if (this.markers[0].isUnhoverTransition(event)) {
        this.markers[0].unhoverMarks();
      }

      if (event.buttons === 0) {
        this.root.contextualizeCursor(event.toElement);
      }
    });

    for (let marker of this.markers) {
      this.backgroundMarkGroup.appendChild(marker.backgroundMarkGroup);
      this.midgroundMarkGroup.appendChild(marker.midgroundMarkGroup);
      this.foregroundMarkGroup.appendChild(marker.foregroundMarkGroup);
      this.centeredForegroundMarkGroup.appendChild(marker.centeredForegroundMarkGroup);
    }
  }

  selectMarker(id) {
    if (id >= this.markers.length) return;

    for (let marker of this.markers) {
      marker.hideMarks();
    }

    this.selectedMarker = this.markers[id];
    this.markers[0].showBackgroundMarks();
    this.markers[id].select();
  }

  castCursor(column, row) {
    let isHit = this.castCursorIntoComponents(column, row); 
    if (!isHit) {
      isHit = this.sourceSpans.some(span => span.contains(column, row));
      if (isHit) {
        if (this.isSelected) {
          this.selectMarker(0);
        } else {
          this.root.select(this);
        }
      }
    }
    return isHit;
  }

  castCursorIntoComponents(column, row) {
    for (let transform of this.transforms) {
      if (transform.castCursor(column, row)) {
        return true;
      }
    }

    return false;
  }

  configure(bounds) {
    this.state = {};
    this.updateDoms = [];
    this.agers = [];
    this.configureState(bounds);
    this.initializeMarkDom();
    this.configureTransforms(bounds);
    this.configureMarks();
    this.connect();
  }

  configureMarks() {
    this.markers = [];
    this.addMarker(new Marker(this));
    for (let transform of this.transforms) {
      transform.configureMarks();
    }
  }

  configureTransforms(bounds) {
    for (let transform of this.transforms) {
      transform.configure(bounds);
    }

    if (this.transforms.some(transform => transform.isAnimated)) {
      // this.updateDoms.push(this.updateTransformDom.bind(this));
    }

    if (this.transforms.every(transform => transform.hasAllDefaults)) {
      // this.updateTransformDom(bounds);
    }
  }

  ageDomWithoutMarks(bounds, t) {
    for (let ager of this.agers) {
      ager(t);
    }

    for (let updateDom of this.updateDoms) {
      updateDom(bounds);
    }
  }

  ageDomWithMarks(bounds, t, factor) {
    this.ageDomWithoutMarks(bounds, t);
    this.updateInteractionState(bounds);
    this.updateInteractionDom(bounds, factor);
    for (let marker of this.markers) {
      marker.updateManipulability();
    }
  }

  updateContentState(bounds) {
    for (let transform of this.transforms) {
      transform.updateDomCommand(bounds);
    }
  }

  updateContentDom(bounds, factor) {
    const commands = this.transforms.map(transform => transform.command).join(' ');
    this.element.setAttributeNS(null, 'transform', commands);
  }

  updateInteractionState(bounds) {
    for (let marker of this.markers) {
      marker.updateState(this.state.centroid);
    }

    // The transforms need their prior transform for proper interaction.
    let matrix = Matrix.identity();
    for (let i = this.transforms.length - 1; i >= 0; i -= 1) {
      const transform = this.transforms[i];
      transform.updateInteractionState(matrix);
      matrix = transform.toMatrix().multiplyMatrix(matrix);
    }
    this.state.matrix = matrix;
  }

  updateInteractionDom(bounds, factor) {
    const commands = this.transforms.map(transform => transform.command).join(' ');
    this.backgroundMarkGroup.setAttributeNS(null, 'transform', commands);

    for (let marker of this.markers) {
      marker.updateDom(bounds, factor);
    }
  }

  flushManipulation(bounds, factor) {
    this.updateContentState(bounds);
    this.updateContentDom(bounds, factor);

    this.updateInteractionState(bounds);
    this.updateInteractionDom(bounds, factor);

    // for (let transform of this.transforms) {
      // transform.updateContentDom();
    // }

    // First get all the model state in order.
    // for (let transform of this.transforms) {
      // transform.updateDomCommand(bounds);
    // }
    // this.updateMarkerState();

    // Now update DOM.
    // this.updateShapeDom(bounds);
    // this.updateMarkerDom(bounds, factor);
  }

  configureStroke(stateHost, bounds, isRequired) {
    this.strokeStateHost = stateHost;
    configureStroke(stateHost, this, bounds, isRequired);
  }

  updateStrokeColorDom(bounds) {
    const r = Math.floor(this.strokeStateHost.state.color[0] * 255);
    const g = Math.floor(this.strokeStateHost.state.color[1] * 255);
    const b = Math.floor(this.strokeStateHost.state.color[2] * 255);
    const rgb = `rgb(${r}, ${g}, ${b})`;
    this.element.setAttributeNS(null, 'stroke', rgb);
  }

  updateStrokeSizeDom(bounds) {
    this.element.setAttributeNS(null, 'stroke-width', this.strokeStateHost.state.size);
  }

  updateStrokeOpacityDom(bounds) {
    this.element.setAttributeNS(null, 'stroke-opacity', this.strokeStateHost.state.opacity);
  }
  
  updateStrokeDashDom(sequence) {
    this.element.setAttributeNS(null, 'stroke-dasharray', sequence);
  }
  
  updateStrokeJoinDom(type) {
    this.element.setAttributeNS(null, 'stroke-linejoin', type);
  }
}

// --------------------------------------------------------------------------- 

export class Text extends Shape {
  static type = 'text';
  static article = 'a';
  static timedIds = ['position', 'message', 'size', 'color', 'opacity', 'enabled'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    this.initializeFill();
  }

  static create(parentEnvironment, where) {
    const shape = new Text();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Text();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  configureState(bounds) {
    this.element = document.createElementNS(svgNamespace, 'text');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.element.appendChild(document.createTextNode('...'));

    this.configureFill(bounds);

    this.state.fontSize = 8;
    this.updateSize(bounds);

    this.configureScalarProperty('size', this, this, this.updateSize.bind(this), bounds, [], timeline => {
      if (!timeline) {
        return false;
      }

      try {
        timeline.assertScalar(ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>size</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('position', this, this, this.updatePosition.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>text</code> whose <code>position</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>position</code>. ${e.message}`);
      }
    });

    this.element.childNodes[0].nodeValue = this.timedProperties.message.defaultValue.value;

    let anchor;
    if (this.untimedProperties.hasOwnProperty('anchor')) {
      anchor = this.untimedProperties.anchor.value;
    } else {
      anchor = 'middle';
    }
    this.element.setAttributeNS(null, 'text-anchor', anchor);

    let baseline;
    if (this.untimedProperties.hasOwnProperty('baseline')) {
      baseline = this.untimedProperties.baseline.value;
    } else {
      baseline = 'center';
    }
    this.element.setAttributeNS(null, 'dominant-baseline', baseline);
  }

  updatePosition(bounds) {
    this.element.setAttributeNS(null, 'x', this.state.position[0]);
    this.element.setAttributeNS(null, 'y', bounds.span - this.state.position[1]);
    this.updateCentroid(bounds);
  }

  updateSize(bounds) {
    this.element.setAttributeNS(null, 'font-size', this.state.size);
    this.updateCentroid(bounds);
  }

  updateCentroid(bounds) {
    const box = this.element.getBBox();
    this.state.centroid = [
      box.x + box.width * 0.5,
      box.y + box.height * 0.5,
    ];
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);
    this.updatePosition(bounds);
    this.updateSize(bounds);
  }

  configureMarks() {
    super.configureMarks();
    this.outlineMark = new RectangleMark();

    this.positionMark = new VectorPanMark(this, null, t => {
      return this.expressionAt('position', this.root.state.t);
    }, ([x, y]) => {
      this.state.position[0] = x;
      this.state.position[1] = y;
    });

    this.markers[0].addMarks([this.positionMark], [this.outlineMark]);
  }
 
  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);

    // I have to query the SVG element to determine the bounding box of the
    // text.
    const box = this.element.getBBox();
    this.outlineMark.updateState([box.x, bounds.span - box.y - box.height], [box.width, box.height], 0, this.state.matrix);
    this.positionMark.updateState(this.state.position, this.state.matrix);
  }
}

// --------------------------------------------------------------------------- 

export class Rectangle extends Shape {
  static type = 'rectangle';
  static article = 'a';
  static timedIds = ['corner', 'center', 'size', 'color', 'opacity', 'rounding', 'enabled'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    this.initializeFill();
  }

  static create(parentEnvironment, where) {
    const shape = new Rectangle();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Rectangle();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  configureState(bounds) {
    this.element = document.createElementNS(svgNamespace, 'rect');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.configureFill(bounds);

    this.configureScalarProperty('rounding', this, this, this.updateRounding.bind(this), bounds, [], timeline => {
      if (!timeline) {
        return false;
      }

      try {
        timeline.assertScalar(ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>rounding</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('size', this, this, this.updateSize.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a rectangle whose <code>size</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>size</code>. ${e.message}`);
      }
    });

    if (this.timedProperties.hasOwnProperty('corner') && this.timedProperties.hasOwnProperty('center')) {
      throw new LocatedException(this.where, 'I found a rectangle whose <code>corner</code> and <code>center</code> were both set. Define only one of these.');
    } else if (this.timedProperties.hasOwnProperty('corner')) {
      this.configureVectorProperty('corner', this, this, this.updateCorner.bind(this), bounds, ['size'], timeline => {
        try {
          timeline.assertList(2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>corner</code>. ${e.message}`);
        }
      });
    } else if (this.timedProperties.hasOwnProperty('center')) {
      this.configureVectorProperty('center', this, this, this.updateCenter.bind(this), bounds, ['size'], timeline => {
        try {
          timeline.assertList(2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>center</code>. ${e.message}`);
        }
      });
    } else {
      throw new LocatedException(this.where, "I found a rectangle whose position I couldn't figure out. Define either its <code>corner</code> or <code>center</code>.");
    }
  }

  updateRounding(bounds) {
    this.element.setAttributeNS(null, 'rx', this.state.rounding);
    this.element.setAttributeNS(null, 'ry', this.state.rounding);
  }

  updateSize(bounds) {
    this.element.setAttributeNS(null, 'width', this.state.size[0]);
    this.element.setAttributeNS(null, 'height', this.state.size[1]);
  }

  updateCenter(bounds) {
    this.state.centroid = this.state.center;
    this.element.setAttributeNS(null, 'x', this.state.center[0] - this.state.size[0] * 0.5);
    this.element.setAttributeNS(null, 'y', bounds.span - this.state.center[1] - this.state.size[1] * 0.5);
  }

  updateCorner(bounds) {
    this.state.centroid = [this.state.corner[0] + 0.5 * this.state.size[0], this.state.corner[1] + 0.5 * this.state.size[1]];
    this.element.setAttributeNS(null, 'x', this.state.corner[0]);
    this.element.setAttributeNS(null, 'y', bounds.span - this.state.size[1] - this.state.corner[1]);
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);
    if (this.timedProperties.hasOwnProperty('rounding')) {
      this.updateRounding(bounds);
    }
    this.updateSize(bounds);
    if (this.timedProperties.hasOwnProperty('center')) {
      this.updateCenter(bounds);
    } else {
      this.updateCorner(bounds);
    }
  }

  configureMarks() {
    super.configureMarks();
    this.outlineMark = new RectangleMark();

    let multiplier;
    let getPositionExpression;
    let updatePositionState;

    if (this.timedProperties.hasOwnProperty('center')) {
      getPositionExpression = t => this.expressionAt('center', this.root.state.t);
      updatePositionState = ([x, y]) => {
        this.state.center[0] = x;
        this.state.center[1] = y;
      };
      multiplier = 2;
    } else {
      getPositionExpression = t => this.expressionAt('corner', this.root.state.t);
      updatePositionState = ([x, y]) => {
        this.state.corner[0] = x;
        this.state.corner[1] = y;
      };
      multiplier = 1;
    }

    this.positionMark = new VectorPanMark(this, null, getPositionExpression, updatePositionState);

    this.widthMark = new HorizontalPanMark(this, this, multiplier, t => {
      return this.expressionAt('size', this.root.state.t).get(0);
    }, newValue => {
      this.state.size[0] = newValue;
    });

    this.heightMark = new VerticalPanMark(this, this, multiplier, t => {
      return this.expressionAt('size', this.root.state.t).get(1);
    }, newValue => {
      this.state.size[1] = newValue;
    });

    this.markers[0].addMarks([this.positionMark, this.widthMark, this.heightMark], [this.outlineMark]);
  }
 
  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);
    if (this.state.center) {
      const corner = [this.state.center[0] - this.state.size[0] * 0.5, this.state.center[1] - this.state.size[1] * 0.5];
      this.outlineMark.updateState(corner, this.state.size, this.state.rounding);
      this.positionMark.updateState(this.state.center, this.state.matrix);
      this.widthMark.updateState([this.state.center[0] + this.state.size[0] * 0.5, this.state.center[1]], this.state.matrix);
      this.heightMark.updateState([this.state.center[0], this.state.center[1] + this.state.size[1] * 0.5], this.state.matrix);
    } else {
      this.outlineMark.updateState(this.state.corner, this.state.size, this.state.rounding);
      this.positionMark.updateState(this.state.corner, this.state.matrix);
      this.widthMark.updateState([this.state.corner[0] + this.state.size[0], this.state.corner[1]], this.state.matrix);
      this.heightMark.updateState([this.state.corner[0], this.state.corner[1] + this.state.size[1]], this.state.matrix);
    }
  }
}

// --------------------------------------------------------------------------- 

export class Circle extends Shape {
  static type = 'circle';
  static article = 'a';
  static timedIds = ['center', 'radius', 'color', 'opacity', 'enabled'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    this.initializeFill();
  }

  static create(parentEnvironment, where) {
    const shape = new Circle();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Circle();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  configureState(bounds) {
    this.element = document.createElementNS(svgNamespace, 'circle');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.configureFill(bounds);

    this.configureScalarProperty('radius', this, this, this.updateRadius.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>circle</code> whose <code>radius</code> was not set.');
      }

      try {
        timeline.assertScalar(ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>radius</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('center', this, this, this.updateCenter.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a <code>circle</code> whose <code>center</code> was not set.');
      }

      try {
        timeline.assertList(2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>center</code>. ${e.message}`);
      }
    });
  }

  updateRadius(bounds) {
    this.element.setAttributeNS(null, 'r', this.state.radius);
  }

  updateCenter(bounds) {
    this.state.centroid = this.state.center;
    this.element.setAttributeNS(null, 'cx', this.state.center[0]);
    this.element.setAttributeNS(null, 'cy', bounds.span - this.state.center[1]);
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);
    this.updateCenter(bounds);
    this.updateRadius(bounds);
  }

  configureMarks() {
    super.configureMarks();
    this.outlineMark = new CircleMark();

    this.centerMark = new VectorPanMark(this, null, t => {
      return this.expressionAt('center', this.root.state.t);
    }, ([x, y]) => {
      this.state.center[0] = x;
      this.state.center[1] = y;
    });

    this.radiusMark = new HorizontalPanMark(this, null, 1, t => {
      return this.expressionAt('radius', this.root.state.t);
    }, newValue => {
      this.state.radius = newValue;
    });

    this.markers[0].addMarks([this.centerMark, this.radiusMark], [this.outlineMark]);
  }

  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);
    this.outlineMark.updateState(this.state.center, this.state.radius);
    this.centerMark.updateState(this.state.center, this.state.matrix);
    this.radiusMark.updateState([this.state.center[0] + this.state.radius, this.state.center[1]], this.state.matrix);
  }
}

// --------------------------------------------------------------------------- 

export class NodeShape extends Shape {
  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    this.nodes = [];
    this.mirrors = [];
  }

  toExpandedPod() {
    const pod = super.toExpandedPod();
    pod.nodes = this.nodes.map(node => node.toPod());
    pod.mirrors = this.mirrors.map(mirror => mirror.toPod());
    return pod;
  }

  embody(parentEnvironment, pod) {
    super.embody(parentEnvironment, pod);
    this.nodes = pod.nodes.map(subpod => this.root.omniReify(this, subpod));
    this.mirrors = pod.mirrors.map(subpod => this.root.omniReify(this, subpod));
  }

  configureNodes(bounds) {
    for (let [i, node] of this.nodes.entries()) {
      node.configure(i > 0 ? this.nodes[i - 1].turtle : null, bounds);
    }

    for (let mirror of this.mirrors) {
      mirror.configureState(bounds);
    }

    if (this.nodes.some(node => node.isAnimated) || this.mirrors.some(mirror => mirror.isAnimated)) {
      this.updateDoms.push(this.updateContentDom.bind(this));
    }

    if (this.nodes.every(node => node.hasAllDefaults) && this.mirrors.every(mirror => mirror.hasAllDefaults)) {
      this.updateContentDom(bounds);
    }
  }

  configureMarks() {
    super.configureMarks();

    for (let node of this.nodes) {
      node.configureMarks();
    }

    for (let mirror of this.mirrors) {
      mirror.configureMarks();
    }
  }

  castCursorIntoComponents(column, row) {
    for (let node of this.nodes) {
      if (node.castCursor(column, row)) {
        return true;
      }
    }

    for (let mirror of this.mirrors) {
      if (mirror.castCursor(column, row)) {
        return true;
      }
    }

    return super.castCursorIntoComponents(column, row);
  }

  connect() {
    super.connect();

    if (this.owns('elbow')) {
      let elbow = this.get('elbow');
      this.element.setAttributeNS(null, 'marker-mid', 'url(#element-' + elbow.id + ')');
      this.element.setAttributeNS(null, 'marker-start', 'url(#element-' + elbow.id + ')');
      this.element.setAttributeNS(null, 'marker-end', 'url(#element-' + elbow.id + ')');
    }

    if (this.owns('head')) {
      let head = this.get('head');
      this.element.setAttributeNS(null, 'marker-end', 'url(#element-' + head.id + ')');
    }

    if (this.owns('tail')) {
      let tail = this.get('tail');
      this.element.setAttributeNS(null, 'marker-start', 'url(#element-' + tail.id + ')');
    }
  }

  addMirror(mirror) {
    this.mirrors.push(mirror);
  }

  ageDomWithoutMark(env, bounds, t) {
    for (let ager of this.agers) {
      ager(t);
    }

    for (let updateDom of this.updateDoms) {
      updateDom(bounds);
    }
  }

  updateContentState(bounds) {
    for (let node of this.nodes) {
      node.updateTurtle(bounds);
    }

    // TODO: anything with mirrors?

    super.updateContentState(bounds);
  }

  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);

    for (let node of this.nodes) {
      node.updateInteractionState(this.state.matrix);
    }

    for (let mirror of this.mirrors) {
      mirror.updateInteractionState(this.state.matrix);
    }
  }
}

// --------------------------------------------------------------------------- 

export class VertexShape extends NodeShape {
  addNode(node) {
    if (this.nodes.length === 0 && !(node instanceof VertexNode || node instanceof TurtleNode)) {
      throw new LocatedException(node.where, `I saw ${this.article} ${this.type} whose first step is ${node.type}. ${sentenceCase(this.article)} ${this.type} must begin with vertex or turtle.`);
    } else {
      this.nodes.push(node);
    }
  }

  mirrorPositions(positions) {
    for (let mirror of this.mirrors) {
      const line = {point: mirror.state.pivot, axis: mirror.state.axis};
      const npositions = positions.length;
      for (let i = npositions - 1; i >= 0; --i) {
        const d = distancePointLine(positions[i], line);
        if ((i > 0 && i < npositions - 1) || distancePointLine(positions[i], line) > 1e-6) {
          positions.push(mirrorPointLine(positions[i], line));
        }
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class Polygon extends VertexShape {
  static type = 'polygon';
  static article = 'a';
  static timedIds = ['color', 'opacity', 'enabled'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    this.initializeFill();

    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMoveNode(this)));
    this.bindFunction('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
  }

  static create(parentEnvironment, where) {
    const shape = new Polygon();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Polygon();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  configureState(bounds) {
    this.element = document.createElementNS(svgNamespace, 'polygon');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.domNodes = this.nodes.filter(node => node.isDom);
    if (this.domNodes.length < 3) {
      throw new LocatedException(this.where, `I found a <code>polygon</code> with ${this.domNodes.length} ${this.domNodes.length == 1 ? 'vertex' : 'vertices'}. Polygons must have at least 3 vertices.`);
    }

    this.configureNodes(bounds);
    this.configureFill(bounds);
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);
    const positions = this.domNodes.map(node => node.turtle.position);
    this.mirrorPositions(positions);
    const coordinates = positions.map(position => `${position[0]},${bounds.span - position[1]}`).join(' ');
    this.element.setAttributeNS(null, 'points', coordinates);
    const sum = this.domNodes.reduce((acc, node) => [acc[0] + node.turtle.position[0], acc[1] + node.turtle.position[1]], [0, 0]);
    this.state.centroid = sum.map(value => value / this.domNodes.length);
  }

  configureMarks() {
    super.configureMarks();
    this.outlineMark = new PolygonMark();
    this.markers[0].addMarks([], [this.outlineMark]);
  }

  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);
    this.outlineMark.updateState(this.domNodes.map(node => node.turtle.position));
  }
}

// --------------------------------------------------------------------------- 

export class Polyline extends VertexShape {
  static type = 'polyline';
  static article = 'a';
  static timedIds = ['size', 'color', 'opacity', 'dashes', 'join', 'enabled'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);

    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMoveNode(this)));
    this.bindFunction('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
  }

  static create(parentEnvironment, where) {
    const shape = new Polyline();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Polyline();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  configureState(bounds) {
    this.element = document.createElementNS(svgNamespace, 'polyline');
    this.element.setAttributeNS(null, 'fill', 'none');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.domNodes = this.nodes.filter(node => node.isDom);
    this.configureNodes(bounds);
    this.configureStroke(this, bounds, true);
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);
    const sum = this.domNodes.reduce((acc, node) => [acc[0] + node.state.position[0], acc[1] + node.state.position[1]], [0, 0]);
    this.state.centroid = sum.map(value => value / this.domNodes.length);
    const coordinates = this.domNodes.map(node => `${node.state.position[0]},${bounds.span - node.state.position[1]}`).join(' ');
    this.element.setAttributeNS(null, 'points', coordinates);
  }

  configureMarks() {
    super.configureMarks();
    this.outlineMark = new PolylineMark();
    this.markers[0].addMarks([], [this.outlineMark]);
  }

  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);
    this.outlineMark.updateState(this.domNodes.map(node => node.state.position));
  }
}

// --------------------------------------------------------------------------- 

export class Line extends VertexShape {
  static type = 'line';
  static article = 'a';
  static timedIds = ['size', 'color', 'opacity', 'dashes', 'enabled'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);

    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMoveNode(this)));
  }

  static create(parentEnvironment, where) {
    const shape = new Line();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Line();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  configureState(bounds) {
    this.element = document.createElementNS(svgNamespace, 'line');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.domNodes = this.nodes.filter(node => node.isDom);
    if (this.domNodes.length != 2) {
      throw new LocatedException(this.where, `I found a line with ${this.domNodes.length} ${this.domNodes.length == 1 ? 'vertex' : 'vertices'}. Lines must have exactly 2 vertices.`);
    }

    this.configureNodes(bounds);
    this.configureStroke(this, bounds, true);
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);

    this.element.setAttributeNS(null, 'x1', this.domNodes[0].turtle.position[0]);
    this.element.setAttributeNS(null, 'y1', bounds.span - this.domNodes[0].turtle.position[1]);
    this.element.setAttributeNS(null, 'x2', this.domNodes[1].turtle.position[0]);
    this.element.setAttributeNS(null, 'y2', bounds.span - this.domNodes[1].turtle.position[1]);
    this.state.centroid = [
      (this.domNodes[0].state.position[0] + this.domNodes[1].state.position[0]) * 0.5,
      (this.domNodes[0].state.position[1] + this.domNodes[1].state.position[1]) * 0.5
    ];
  }

  configureMarks() {
    super.configureMarks();
    this.outlineMark = new LineMark();
    this.markers[0].addMarks([], [this.outlineMark]);
  }

  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);
    this.outlineMark.updateState(this.domNodes[0].state.position, this.domNodes[1].state.position, this.state.matrix);
  }
}

// --------------------------------------------------------------------------- 

export class Ungon extends VertexShape {
  static type = 'ungon';
  static article = 'an';
  static timedIds = ['rounding', 'color', 'opacity', 'enabled'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    this.initializeFill();

    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMoveNode(this)));
    this.bindFunction('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
  }

  static create(parentEnvironment, where) {
    const shape = new Ungon();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Ungon();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  configureState(bounds) {
    this.element = document.createElementNS(svgNamespace, 'path');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.domNodes = this.nodes.filter(node => node.isDom);
    if (this.domNodes.length < 3) {
      throw new LocatedException(this.where, `I found an <code>ungon</code> with ${this.domNodes.length} ${this.domNodes.length == 1 ? 'vertex' : 'vertices'}. Polygons must have at least 3 vertices.`);
    }

    this.configureNodes(bounds);
    this.configureFill(bounds);

    this.configureScalarProperty('rounding', this, this, this.updateContentDom.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, `I found an <code>ungon</code> whose <code>rounding</code> was not set.`);
      }

      try {
        timeline.assertScalar(ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>rounding</code>. ${e.message}`);
      }
    });
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);

    let rounding = 1 - this.state.rounding;
    let pathCommands = [];

    let start = [
      (this.domNodes[0].turtle.position[0] + this.domNodes[1].turtle.position[0]) * 0.5,
      (this.domNodes[0].turtle.position[1] + this.domNodes[1].turtle.position[1]) * 0.5
    ];
    pathCommands.push(`M ${start[0]},${bounds.span - start[1]}`);

    let previous = start;
    const gap = distancePointPoint(this.domNodes[0].turtle.position, this.domNodes[this.domNodes.length - 1].turtle.position);
    const hasReturn = gap < 1e-6;
    let nnodes = hasReturn ? this.domNodes.length - 1 : this.domNodes.length;
    for (let i = 1; i < nnodes; ++i) {
      const a = this.domNodes[i].turtle.position;
      const b = this.domNodes[(i + 1) % this.domNodes.length].turtle.position;

      let mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];

      if (rounding) {
        let control1 = [
          previous[0] + rounding * (a[0] - previous[0]),
          previous[1] + rounding * (a[1] - previous[1]),
        ];
        let control2 = [
          mid[0] + rounding * (a[0] - mid[0]),
          mid[1] + rounding * (a[1] - mid[1]),
        ];
        pathCommands.push(`C ${control1[0]},${bounds.span - control1[1]} ${control2[0]},${bounds.span - control2[1]} ${mid[0]},${bounds.span - mid[1]}`);
      } else {
        pathCommands.push(`Q ${a[0]},${bounds.span - a[1]} ${mid[0]},${bounds.span - mid[1]}`);
      }
      previous = mid;
    }

    const first = this.domNodes[0].state.position;
    if (rounding) {
      let control1 = [
        previous[0] + rounding * (first[0] - previous[0]),
        previous[1] + rounding * (first[1] - previous[1]),
      ];
      let control2 = [
        start[0] + rounding * (first[0] - start[0]),
        start[1] + rounding * (first[1] - start[1]),
      ];
      pathCommands.push(`C ${control1[0]},${bounds.span - control1[1]} ${control2[0]},${bounds.span - control2[1]} ${start[0]},${bounds.span - start[1]}`);
    } else {
      pathCommands.push(`Q${first[0]},${bounds.span - first[1]} ${start[0]},${bounds.span - start[1]}`);
    }

    pathCommands.push('z');
    this.element.setAttributeNS(null, 'd', pathCommands.join(' '));

    const sum = this.domNodes.reduce((acc, node) => [acc[0] + node.turtle.position[0], acc[1] + node.turtle.position[1]], [0, 0]);
    this.state.centroid = sum.map(value => value / this.domNodes.length);
  }

  configureMarks() {
    super.configureMarks();
    this.outlineMark = new PolygonMark();
    this.markers[0].addMarks([], [this.outlineMark]);
  }

  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);
    this.outlineMark.updateState(this.domNodes.map(node => node.turtle.position));
  }
}

// --------------------------------------------------------------------------- 

export class Path extends NodeShape {
  static type = 'path';
  static article = 'a';
  static timedIds = ['color', 'opacity', 'enabled'];

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    this.initializeFill();

    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMoveNode(this)));
    this.bindFunction('jump', new FunctionDefinition('jump', [], new ExpressionJumpNode(this)));
    this.bindFunction('line', new FunctionDefinition('line', [], new ExpressionLineNode(this)));
    this.bindFunction('quadratic', new FunctionDefinition('line', [], new ExpressionQuadraticNode(this)));
    this.bindFunction('cubic', new FunctionDefinition('line', [], new ExpressionCubicNode(this)));
    this.bindFunction('arc', new FunctionDefinition('arc', [], new ExpressionArcNode(this)));
    this.bindFunction('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
  }

  static create(parentEnvironment, where) {
    const shape = new Path();
    shape.initialize(parentEnvironment, where);
    shape.untimedProperties.closed = new ExpressionBoolean(false);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Path();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  addNode(node) {
    if (this.nodes.length === 0 && !(node instanceof JumpNode || node instanceof TurtleNode)) {
      throw new LocatedException(node.where, `I saw a path whose first step is ${node.type}. A path must begin with jump or turtle.`);
    } else {
      this.nodes.push(node);
    }
  }

  configureState(bounds) {
    this.element = document.createElementNS(svgNamespace, 'path');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.domNodes = this.nodes.filter(node => node.isDom);
    this.configureNodes(bounds);
    this.configureFill(bounds);
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);

    const pathCommands = this.domNodes.map(node => node.pathCommand);

	  if (this.mirrors.length > 0) {
      let segments = [];
      let previousSegment = null;
      for (let i = 0; i < this.nodes.length; i += 1) {
        previousSegment = this.nodes[i].segment(previousSegment);
        if (i > 0 && previousSegment) {
          segments.push(previousSegment);
        }
      }

			for (let mirror of this.mirrors) {
				let {pivot, axis} = mirror.state;
				let line = {point: pivot, axis};

				const mirroredSegments = segments.slice().reverse();

				if (distancePointLine(mirroredSegments[0].to, line) > 1e-6) {
					mirroredSegments.unshift(mirroredSegments[0].mirrorBridge(line));
				}

				mirroredSegments = mirroredSegments.map((segment, i) => segment.mirror(line, i > 0));

				for (let segment of mirroredSegments) {
					pathCommands.push(segment.toCommandString(bounds));
				}

				segments.push(...mirroredSegments);
			}
		}

    if (this.untimedProperties.hasOwnProperty('closed') && this.untimedProperties.closed.value) {
      pathCommands.push('z');
    }
   
    this.element.setAttributeNS(null, 'd', pathCommands.join(' '));

    const sum = this.domNodes.reduce((acc, node) => [acc[0] + node.turtle.position[0], acc[1] + node.turtle.position[1]], [0, 0]);
    this.state.centroid = sum.map(value => value / this.domNodes.length);
  }

  configureMarks() {
    super.configureMarks();
    this.outlineMark = new PathMark();
    this.markers[0].addMarks([], [this.outlineMark]);
  }

  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);
    this.outlineMark.updateState(this.domNodes.map(node => node.pathCommand).join(' '));
  }
}

// --------------------------------------------------------------------------- 

export class Group extends Shape {
  static type = 'group';
  static article = 'a';
  static timedIds = ['enabled']; // TODO does enabled work on group

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    this.children = [];
  }

  toExpandedPod() {
    const pod = super.toExpandedPod();
    pod.children = this.children.map(child => child.toExpandedPod());
    return pod;
  }

  embody(parentEnvironment, pod) {
    super.embody(parentEnvironment, pod);
    this.children = pod.children.map(subpod => Shape.reify(this, subpod));
  }

  static create(parentEnvironment, where) {
    const shape = new Group();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Group();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  start() {
    super.start();
    this.createHierarchy();
    this.markers[0].addMarks([], []);
    this.connect();
  }

  createHierarchy() {
    this.element = document.createElementNS(svgNamespace, 'g');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  configureState(bounds) {
    this.createHierarchy();
    this.state.centroid = [0, 0];
    for (let child of this.children) {
      child.configureState(bounds);
    }
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);
    for (let child of this.children) {
      child.updateContentDom(bounds);
    }
  }

  configureMarks() {
    super.configureMarks();
    this.markers[0].addMarks([], []);
  }

  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);
    for (let child of this.children) {
      child.updateInteractionState(bounds);
    }
  }

  // updateProperties(env, t, bounds, matrix) {
    // matrix = this.transform(env, t, bounds, matrix);
    // TODO how do I handle disabled children
    // const childCentroids = this.children.map(child => child.updateProperties(env, t, bounds, matrix)).filter(centroid => !!centroid);
    // const total = childCentroids.reduce((acc, centroid) => acc.add(centroid), new ExpressionVector([new ExpressionReal(0), new ExpressionReal(0)]));
    // const centroid = this.children.length == 0 ? total : total.divide(new ExpressionReal(this.children.length));
    // this.updateCentroid(matrix, centroid, bounds);
    // return centroid;
  // }
}

// --------------------------------------------------------------------------- 

export class Mask extends Group {
  static type = 'mask';
  static article = 'a';
  static timedIds = [];

  static create(parentEnvironment, where) {
    const shape = new Mask();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Mask();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  createHierarchy() {
    this.element = document.createElementNS(svgNamespace, 'g');

    this.maskElement = document.createElementNS(svgNamespace, 'mask');
    this.maskElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.maskElement.appendChild(this.element);
  }

  connectToParent() {
    this.isDrawable = true;
    this.root.defines.appendChild(this.maskElement);
  }
}

// --------------------------------------------------------------------------- 

export class Cutout extends Mask {
  static type = 'cutout';
  static article = 'a';
  static timedIds = [];

  static create(parentEnvironment, where) {
    const shape = new Cutout();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Cutout();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  configureState(bounds) {
    super.configureState(bounds);
    this.rectangle = document.createElementNS(svgNamespace, 'rect');
    this.rectangle.setAttributeNS(null, 'fill', 'white');
    this.element.appendChild(this.rectangle);
    this.updateContentState(bounds);
  }

  updateContentState(bounds) {
    super.updateContentState(bounds);
    this.rectangle.setAttributeNS(null, 'x', bounds.x);
    this.rectangle.setAttributeNS(null, 'y', bounds.y);
    this.rectangle.setAttributeNS(null, 'width', bounds.width);
    this.rectangle.setAttributeNS(null, 'height', bounds.height);
  }
}

// --------------------------------------------------------------------------- 

export class Tip extends Group {
  static type = 'tip';
  static article = 'a';
  static timedIds = ['size', 'anchor', 'corner', 'center', 'enabled'];

  static create(parentEnvironment, where) {
    const shape = new Tip();
    shape.initialize(parentEnvironment, where);
    return shape;
  }

  static reify(parentEnvironment, pod) {
    const shape = new Tip();
    shape.embody(parentEnvironment, pod);
    return shape;
  }

  createHierarchy() {
    this.element = document.createElementNS(svgNamespace, 'marker');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.element.setAttributeNS(null, 'orient', 'auto');
    this.element.setAttributeNS(null, 'markerUnits', 'strokeWidth');

    // Without this, the marker gets clipped.
    this.element.setAttributeNS(null, 'overflow', 'visible');
  }

  connectToParent() {
    this.isDrawable = true;
    this.root.defines.appendChild(this.element);
  }

  validate() {
    this.assertProperty('size');
    this.assertProperty('anchor');

    if (this.owns('corner') && this.owns('center')) {
      throw new LocatedException(this.where, 'I found a tip whose corner and center properties were both set. Define only one of these.');
    }

    if (!this.owns('corner') && !this.owns('center')) {
      throw new LocatedException(this.where, 'I found a tip whose location I couldn\'t figure out. Please define its corner or center.');
    }
  }

  updateProperties(env, t, bounds, matrix) {
    const anchor = this.valueAt(env, 'anchor', t);
    const size = this.valueAt(env, 'size', t);

    let corner;
    if (this.owns('corner')) {
      corner = this.valueAt(env, 'corner', t);
    } else {
      let center = this.valueAt(env, 'center', t);
      corner = new ExpressionVector([
        new ExpressionReal(center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(center.get(1).value - size.get(1).value * 0.5),
      ]);
    }

    const markerBounds = {
      x: corner.get(0).value,
      y: corner.get(1).value,
      width: size.get(0).value,
      height: size.get(1).value,
    };
    markerBounds.span = markerBounds.y + (markerBounds.y + markerBounds.height);

    this.element.setAttributeNS(null, 'viewBox', `${markerBounds.x} ${markerBounds.y} ${markerBounds.width} ${markerBounds.height}`);

    this.element.setAttributeNS(null, 'markerWidth', size.get(0).value);
    this.element.setAttributeNS(null, 'markerHeight', size.get(1).value);
    this.element.setAttributeNS(null, 'refX', anchor.get(0).value);
    this.element.setAttributeNS(null, 'refY', anchor.get(1).value);

    matrix = this.transform(env, t, bounds, matrix);
    const childCentroids = this.children.map(child => child.updateProperties(env, t, markerBounds, matrix));
    const total = childCentroids.reduce((acc, centroid) => acc.add(centroid), new ExpressionVector([new ExpressionReal(0), new ExpressionReal(0)]));
    const centroid = this.children.length == 0 ? total : total.divide(new ExpressionReal(this.children.length));
    this.updateCentroid(matrix, centroid, bounds);

    return centroid;
  }
}

// --------------------------------------------------------------------------- 

const FillMixin = {
  initializeFill: function() {
    this.untimedProperties.stroke = Stroke.create(this);
    this.untimedProperties.stroke.bind('opacity', new ExpressionReal(1));
  },

  configureFill: function(bounds) {
    this.configureColor(bounds);
    this.configureStroke(this.untimedProperties.stroke, bounds, false);
  },

  configureColor: function(bounds) {
    this.configureScalarProperty('opacity', this, this, this.updateOpacityDom.bind(this), bounds, [], timeline => {
      if (timeline) {
        try {
          timeline.assertScalar(ExpressionInteger, ExpressionReal);
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>opacity</code>. ${e.message}`);
        }
      }
      return true;
    });

    this.configureVectorProperty('color', this, this, this.updateColorDom.bind(this), bounds, [], timeline => {
      if (timeline) {
        try {
          timeline.assertList(3, ExpressionInteger, ExpressionReal);
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>color</code>. ${e.message}`);
        }
      }

      // If the opacity is non-zero anywhen, then color is a required property.
      const opacityTimeline = this.timedProperties.opacity;
      const needsColor =
        !this.isCutoutChild &&
        ((opacityTimeline.defaultValue && opacityTimeline.defaultValue.value > 0) ||
         opacityTimeline.intervals.some(interval => (interval.hasFrom() && interval.fromValue.value > 0 || interval.hasTo() && interval.toValue.value > 0)));

      if (!needsColor) {
        return false;
      } else if (!timeline) {
        throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose <code>color</code> isn't set.`);
      } else {
        return true;
      }
    });
  },

  updateOpacityDom: function(bounds) {
    this.element.setAttributeNS(null, 'fill-opacity', this.state.opacity);
  },

  updateColorDom: function(bounds) {
    const r = Math.floor(this.state.color[0] * 255);
    const g = Math.floor(this.state.color[1] * 255);
    const b = Math.floor(this.state.color[2] * 255);
    const rgb = `rgb(${r}, ${g}, ${b})`;
    this.element.setAttributeNS(null, 'fill', rgb);
  },
};

Object.assign(Rectangle.prototype, FillMixin);
Object.assign(Circle.prototype, FillMixin);
Object.assign(Ungon.prototype, FillMixin);
Object.assign(Polygon.prototype, FillMixin);
Object.assign(Path.prototype, FillMixin);
Object.assign(Text.prototype, FillMixin);

// --------------------------------------------------------------------------- 

