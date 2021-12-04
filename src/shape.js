import { 
  BoundingBox,
  FunctionDefinition,
  LocatedException,
  SourceLocation,
  Turtle,
  clearChildren,
  sentenceCase,
  svgNamespace,
} from './common.js';

import {TimelinedEnvironment} from './environment.js';

import {
  ObjectFrame,
  StrokeFrame,
} from './frame.js';

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
  BackNode,
  CircleNode,
  GoNode,
  JumpNode,
  Mirror,
  RectangleNode,
  TabNode,
  MoveNode,
  LineNode,
  TurtleNode,
  VertexNode,
} from './node.js';

import {
  Expression,
  ExpressionArcNode,
  ExpressionBoolean,
  ExpressionBackNode,
  ExpressionCircleNode,
  ExpressionCubicNode,
  ExpressionGoNode,
  ExpressionLineNode,
  ExpressionMoveNode,
  ExpressionInteger,
  ExpressionJumpNode,
  ExpressionMirror,
  ExpressionQuadraticNode,
  ExpressionReal,
  ExpressionRectangleNode,
  ExpressionString,
  ExpressionTranslate,
  ExpressionRotate,
  ExpressionScale,
  ExpressionShear,
  ExpressionStroke,
  ExpressionTabNode,
  ExpressionTurnNode,
  ExpressionTurtleNode,
  ExpressionVector,
  ExpressionVertexNode,
} from './ast.js';

// --------------------------------------------------------------------------- 

export class Shape extends ObjectFrame {
  initialize(where) {
    super.initialize(null, where);

    this.sourceSpans = [];
    this.transforms = [];

    this.bindStatic('enabled', new ExpressionBoolean(true));
    this.bindStatic('translate', new FunctionDefinition('translate', [], new ExpressionTranslate(this)));
    this.bindStatic('scale', new FunctionDefinition('scale', [], new ExpressionScale(this)));
    this.bindStatic('rotate', new FunctionDefinition('rotate', [], new ExpressionRotate(this)));
    this.bindStatic('shear', new FunctionDefinition('shear', [], new ExpressionShear(this)));
  }

  // This version contains full data, unlike deflate, which is just a
  // reference.
  deflateReferent() {
    const object = super.deflate();
    object.id = this.id;
    object.sourceSpans = this.sourceSpans;
    object.transforms = this.transforms.map(transform => transform.deflate());
    if (this.stroke) {
      object.stroke = this.stroke.deflate();
    }
    return object;
  }

  deflate() {
    return {type: 'reference', id: this.id};
  }

  embody(object, inflater) {
    super.embody(null, object, inflater);
    this.id = object.id;
    this.sourceSpans = object.sourceSpans.map(subobject => SourceLocation.inflate(subobject));
    this.transforms = object.transforms.map(subobject => inflater.inflate(this, subobject));
    this.boundingBox = new BoundingBox();
    if (object.stroke) {
      this.stroke = StrokeFrame.inflate(this, object.stroke, inflater);
    }
  }

  validate(fromTime, toTime) {
    this.validateProperties(fromTime, toTime);
    for (let transform of this.transforms) {
      transform.validate(fromTime, toTime);
    }
  }

  initializeState() {
    super.initializeState();
    for (let transform of this.transforms) {
      transform.initializeState();
    }
  }

  synchronizeState(t) {
    for (let transform of this.transforms) {
      transform.synchronizeState(t);
    }
  }

  synchronizeDom(t, bounds) {
    for (let transform of this.transforms) {
      transform.synchronizeDom(t, bounds);
    }

    const commands = this.transforms.map(transform => transform.state.command).join(' ');
    this.element.setAttributeNS(null, 'transform', commands);
  }

  show() {
    this.element.setAttributeNS(null, 'visibility', 'visible');
  }

  hide() {
    this.element.setAttributeNS(null, 'visibility', 'hidden');
    this.hideMarks();
  }

  hideMarks() {
    for (let marker of this.markers) {
      marker.hideMarks();
    }
  }

  addMarker(marker) {
    marker.id = this.markers.length;
    this.markers.push(marker);
  }
  
  connectToParent() {
    // if (this.owns('parent')) {
      // this.get('parent').children.push(this);
      // this.isDrawable = false;
    // } else {
      // this.isDrawable = true;
    // }

    // let elementToConnect;
    // if (this.owns('mask')) {
      // const mask = this.get('mask');
      // const groupElement = document.createElementNS(svgNamespace, 'g');
      // groupElement.setAttributeNS(null, 'mask', 'url(#element-' + mask.id + ')');
      // groupElement.appendChild(this.element);
      // elementToConnect = groupElement;
    // } else {
      // elementToConnect = this.element;
    // }

    // if (this.owns('parent')) {
      // this.get('parent').element.appendChild(elementToConnect);
    // } else {
      // this.root.mainGroup.appendChild(elementToConnect);
    // }
  }

  connect() {
    // this.connectToParent();

    // if (this.isCutoutChild) {
      // this.bind('color', new ExpressionVector([new ExpressionReal(0), new ExpressionReal(0), new ExpressionReal(0)]));
    // }

    // if (this.owns('clippers')) {
      // let clipPath = document.createElementNS(svgNamespace, 'clipPath');
      // clipPath.setAttributeNS(null, 'id', 'clip-' + this.id);
      // let clippers = this.get('clippers');
      // clippers.forEach(clipper => {
        // let use = document.createElementNS(svgNamespace, 'use');
        // use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#element-' + clipper.id);
        // clipPath.appendChild(use);
      // });
      // this.root.defines.appendChild(clipPath);
      // this.element.setAttributeNS(null, 'clip-path', 'url(#clip-' + this.id + ')');
    // }

    // this.initializeMarks();
  }

  get isCutoutChild() {
    // return this.owns('parent') && (this.get('parent') instanceof Cutout || this.get('parent').isCutoutChild);
    return false;
  }

  initializeMarkDom(root) {
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

    // TODO
    // if (this.has('parent')) {
      // this.getStatic('parent').backgroundMarkGroup.appendChild(this.backgroundMarkGroup);
      // this.getStatic('parent').midgroundMarkGroup.appendChild(this.midgroundMarkGroup);
      // this.getStatic('parent').foregroundMarkGroup.appendChild(this.foregroundMarkGroup);
      // this.getStatic('parent').centeredForegroundMarkGroup.appendChild(this.centeredForegroundMarkGroup);
    // } else {
      root.backgroundMarkGroup.appendChild(this.backgroundMarkGroup);
      root.midgroundMarkGroup.appendChild(this.midgroundMarkGroup);
      root.foregroundMarkGroup.appendChild(this.foregroundMarkGroup);
      root.centeredForegroundMarkGroup.appendChild(this.centeredForegroundMarkGroup);
    // }

    for (let marker of this.markers) {
      marker.initializeDom(root);
    }

    this.registerListeners(root);
  }

  registerListeners(root) {
    this.element.addEventListener('mouseenter', event => {
      event.stopPropagation();
      if (!this.isSelected) {
        this.markers[0].hover();
      }

      // if (this.root.isTweaking) return;
      // Only show the marks if the source code is evaluated and fresh.
      // if (!this.isSelected && !this.root.isStale) {
      // }
      // if (event.buttons === 0) {
        // this.root.contextualizeCursor(event.toElement);
      // }
    });

    this.element.addEventListener('mouseleave', event => {
      event.stopPropagation();

      // The cursor is leaving the shape, but it might just be running across a mark. The marks
      // are all tagged with class tag-SHAPE-ID. Don't unhover if we're on the shape or one of
      // its marks.
      // const isStillShape = event.toElement && event.toElement.classList.contains(`tag-${this.id}`);
      // if (!isStillShape && !this.isSelected) {
      if (this.isUnhoverTransition(event)) {
        this.markers[0].unhover();
      }

      // if (event.buttons === 0) {
        // this.root.contextualizeCursor(event.toElement);
      // }
    });

    this.element.addEventListener('click', event => {
      // If the event bubbles up to the parent SVG, that means no shape was
      // clicked on, and everything will be deselected. We don't want that.
      event.stopPropagation();
      root.select(this);
      
      // if (!this.root.isStale) {
      // }
    });
  }

  isUnhoverTransition(event) {
    const isStillShape = event.toElement && event.toElement.classList.contains(`tag-${this.id}`);
    return !this.isSelected && !isStillShape;
  }

  select(markerId = 0) {
    this.isSelected = true;
    this.selectMarker(markerId);
  }

  deselect() {
    this.isSelected = false;
    this.markers[0].deselect();
    if (this.selectedMarkerId) {
      this.markers[this.selectedMarkerId].deselect();
    }
    this.selectedMarkerId = null;
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
    if (id !== this.selectedMarkerId) {
      // Deselect any currently selected marker.
      if (this.selectedMarkerId !== null) {
        this.markers[this.selectedMarkerId].deselect();
      }

      this.selectedMarkerId = id;
      this.markers[id].show();

      // Show shape's background marks no matter what. This will show the outline
      // or skeleton of the shape.
      this.markers[0].showBackgroundMarks();
    }
  }

  castCursorIntoComponents(column, row) {
    for (let transform of this.transforms) {
      if (transform.castCursor(column, row)) {
        return transform;
      }
    }
    return null;
  }

  castCursor(root, column, row) {
    let hitComponent = this.castCursorIntoComponents(column, row);
    if (hitComponent) {
      root.select(this, hitComponent.marker.id);
      return true;
    } else if (this.sourceSpans.some(span => span.contains(column, row))) {
      root.select(this, 0);
      return true;
    } else {
      return false;
    }
  }

  initializeMarkState() {
    this.markers = [];
    this.addMarker(new Marker(this));
    for (let transform of this.transforms) {
      transform.initializeMarkState();
    }

    this.isSelected = false;
    this.selectedMarkerId = null;
  }

  activate(t) {
    const enabledTimeline = this.timedProperties.enabled;
    if (enabledTimeline) {
      this.state.isEnabled = enabledTimeline.intervalAt(t)?.fromValue.value ?? enabledTimeline.defaultValue?.value;
      this.element.setAttributeNS(null, 'visibility', this.state.isEnabled ? 'visible' : 'hidden');
      return this.state.isEnabled;
    } else {
      return true;
    }
  }

  ageDomWithoutMarks(bounds, t) {
    for (let ager of this.agers) {
      ager(this, t);
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

  updateTransformDom(bounds) {
    // for (let transform of this.transforms) {
      // transform.updateDomCommand(bounds);
    // }
    const commands = this.transforms.map(transform => transform.command).join(' ');
    this.element.setAttributeNS(null, 'transform', commands);
    this.updateMatrix();
  }

  updateContentState(bounds) {
    // this.updateTransformDom();
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
  }

  updateMatrix() {
    // The transforms need their prior transform for proper interaction.
    let matrix = Matrix.identity();
    for (let i = this.transforms.length - 1; i >= 0; i -= 1) {
      const transform = this.transforms[i];
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
    // A drag on a transform marker will have changed the state.
    for (let transform of this.transforms) {
      transform.updateDomCommand(bounds);
    }
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

  synchronizeMarkState(t) {
    let matrix = Matrix.identity();
    for (let i = this.transforms.length - 1; i >= 0; i -= 1) {
      matrix = this.transforms[i].toMatrix().multiplyMatrix(matrix);
    }
    for (let transform of this.transforms) {
      transform.synchronizeMarkState(t, Matrix.identity());
    }
    this.state.matrix = matrix;
    // Subclasses should compute centroid.
  }

  synchronizeMarkExpressions(t) {
    for (let transform of this.transforms) {
      transform.synchronizeMarkExpressions(t);
    }
  }

  synchronizeMarkDom(bounds, zoomFactor) {
    // The background marks need to be transformed by any transformations that
    // have been applied. Only the background marks can be transformed in this
    // way, as they are just scale-invariant stroke lines. The foreground marks
    // are circular handles that shouldn't scale.
    const commands = this.transforms.map(transform => transform.state.command).join(' ');
    this.backgroundMarkGroup.setAttributeNS(null, 'transform', commands);

    this.centeredForegroundMarkGroup.setAttributeNS(null, 'transform', `translate(${this.state.centroid[0]}, ${-this.state.centroid[1]})`);

    for (let transform of this.transforms) {
      transform.synchronizeMarkDom(bounds, zoomFactor);
    }
  }

  static inflate(object, inflater) {
    if (object.type === 'rectangle') {
      return Rectangle.inflate(object, inflater);
    } else if (object.type === 'raster') {
      return Raster.inflate(object, inflater);
    } else if (object.type === 'grid') {
      return Grid.inflate(object, inflater);
    } else if (object.type === 'circle') {
      return Circle.inflate(object, inflater);
    } else if (object.type === 'polygon') {
      return Polygon.inflate(object, inflater);
    } else if (object.type === 'polyline') {
      return Polyline.inflate(object, inflater);
    } else if (object.type === 'ungon') {
      return Ungon.inflate(object, inflater);
    } else if (object.type === 'line') {
      return Line.inflate(object, inflater);
    } else if (object.type === 'text') {
      return Text.inflate(object, inflater);
    } else if (object.type === 'path') {
      return Path.inflate(object, inflater);
    } else if (object.type === 'group') {
      return Group.inflate(object, inflater);
    } else if (object.type === 'mask') {
      return Mask.inflate(object, inflater);
    } else if (object.type === 'cutout') {
      return Cutout.inflate(object, inflater);
    } else if (object.type === 'tip') {
      return Tip.inflate(object, inflater);
    } else {
      console.error("object:", object);
      throw new Error(`unimplemented shape: ${object.type}`);
    }
  }
}

// --------------------------------------------------------------------------- 

export class Text extends Shape {
  static type = 'text';
  static article = 'a';
  static timedIds = ['position', 'message', 'size', 'color', 'opacity', 'enabled'];

  initialize(where) {
    super.initialize(where);
    this.initializeFill();
  }

  static create(where) {
    const shape = new Text();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Text();
    shape.embody(object, inflater);
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
        timeline.assertScalar(this, ExpressionInteger, ExpressionReal);
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
        timeline.assertList({objectFrame: this}, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>position</code>. ${e.message}`);
      }
    });

    this.element.childNodes[0].nodeValue = this.timedProperties.message.defaultValue.value;

    let anchor = ['middle', 'center'];
    if (this.untimedProperties.hasOwnProperty('anchor')) {
      anchor[0] = this.untimedProperties.anchor.get(0).value;
      if (anchor[0] === 'west') {
        anchor[0] = 'start';
      } else if (anchor[0] === 'center') {
        anchor[0] = 'middle';
      } else if (anchor[0] === 'east') {
        anchor[0] = 'end';
      }

      anchor[1] = this.untimedProperties.anchor.get(1).value;
      if (anchor[1] === 'north') {
        anchor[1] = 'hanging';
      } else if (anchor[1] === 'south') {
        anchor[1] = 'baseline';
      } else if (anchor[1] === 'center') {
        anchor[1] = 'central';
      }
    }

    this.element.setAttributeNS(null, 'text-anchor', anchor[0]);
    this.element.setAttributeNS(null, 'dominant-baseline', anchor[1]);
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

  initialize(where) {
    super.initialize(where);
    this.bindStatic('stroke', new FunctionDefinition('stroke', [], new ExpressionStroke(this)));
  }

  static create(where) {
    const shape = new Rectangle();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Rectangle();
    shape.embody(object, inflater);
    return shape;
  }

  validateProperties(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('size');
    this.assertProperty('color');

    if (this.has('corner') && this.has('center')) {
      throw new LocatedException(this.where, 'I found a rectangle whose <code>corner</code> and <code>center</code> were both set. Define only one of these.');
    } else if (!this.has('corner') && !this.has('center')) {
      throw new LocatedException(this.where, "I found a rectangle whose position I couldn't figure out. Define either its <code>corner</code> or <code>center</code>.");
    }

    // Assert types of extent properties.
    this.assertScalarType('rounding', [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('size', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('corner', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('center', 2, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('size', fromTime, toTime);
    this.assertCompleteTimeline('center', fromTime, toTime);
    this.assertCompleteTimeline('corner', fromTime, toTime);
    this.assertCompleteTimeline('rounding', fromTime, toTime);
    this.assertCompleteTimeline('opacity', fromTime, toTime);
    this.assertCompleteTimeline('color', fromTime, toTime);

    this.stroke?.validate(fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.stroke?.initializeState();
    this.hasCenter = this.has('center');
  }

  initializeStaticState() {
    this.initializeStaticScalarProperty('radius');
    this.initializeStaticVectorProperty('center');
    this.initializeStaticVectorProperty('corner');
    this.initializeStaticVectorProperty('size');
    this.initializeStaticVectorProperty('color');
    this.initializeStaticScalarProperty('opacity');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('rounding');
    this.initializeDynamicProperty('size');
    this.initializeDynamicProperty('center');
    this.initializeDynamicProperty('corner');
    this.initializeDynamicProperty('color');
    this.initializeDynamicProperty('opacity');
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'rect');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    root.mainGroup.appendChild(this.element);
  }

  initializeMarkState() {
    super.initializeMarkState();

    this.outlineMark = new RectangleMark();
    this.markers[0].setBackgroundMarks(this.outlineMark);

    let tweakPosition;
    let multiplier;
    if (this.hasCenter) {
      multiplier = 2;
      tweakPosition = position => this.state.center = position;
    } else {
      multiplier = 1;
      tweakPosition = position => this.state.corner = position;
    }

    this.positionMark = new VectorPanMark(this, null, tweakPosition);
    this.widthMark = new HorizontalPanMark(this, null, multiplier, value => this.state.size[0] = value);
    this.heightMark = new VerticalPanMark(this, null, multiplier, value => this.state.size[1] = value);
    this.markers[0].setForegroundMarks(this.positionMark, this.widthMark, this.heightMark);
  }

  synchronizeMarkExpressions(t) {
    super.synchronizeMarkExpressions(t);
    if (this.hasCenter) {
      this.positionMark.synchronizeExpressions(this.expressionAt('center', t));
    } else {
      this.positionMark.synchronizeExpressions(this.expressionAt('corner', t));
    }
    this.widthMark.synchronizeExpressions(this.expressionAt('size', t).get(0));
    this.heightMark.synchronizeExpressions(this.expressionAt('size', t).get(1));
  }

  synchronizeMarkState(t) {
    super.synchronizeMarkState(t);

    this.outlineMark.synchronizeState(this.state.corner, this.state.size, this.state.rounding);
    if (this.hasCenter) {
      this.positionMark.synchronizeState(this.state.center);
      this.widthMark.synchronizeState([
        this.state.center[0] + 0.5 * this.state.size[0],
        this.state.center[1],
      ]);
      this.heightMark.synchronizeState([
        this.state.center[0],
        this.state.center[1] + 0.5 * this.state.size[1],
      ]);
    } else {
      this.positionMark.synchronizeState(this.state.corner);
      this.widthMark.synchronizeState([
        this.state.corner[0] + this.state.size[0],
        this.state.corner[1],
      ]);
      this.heightMark.synchronizeState([
        this.state.corner[0],
        this.state.corner[1] + this.state.size[1],
      ]);
    }

    this.state.centroid = [
      this.state.corner[0] + this.state.size[0] * 0.5,
      this.state.corner[1] + this.state.size[1] * 0.5,
    ];
    this.state.boundingBox = BoundingBox.fromCornerSize(this.state.corner, this.state.size);
  }
 
  synchronizeMarkDom(bounds, zoomFactor) {
    super.synchronizeMarkDom(bounds, zoomFactor);
    this.outlineMark.synchronizeDom(bounds);
    this.positionMark.synchronizeDom(bounds, this.state.matrix, zoomFactor);
    this.widthMark.synchronizeDom(bounds, this.state.matrix, zoomFactor);
    this.heightMark.synchronizeDom(bounds, this.state.matrix, zoomFactor);
  }

  synchronizeState(t) {
    super.synchronizeState(t);

    this.synchronizeStateProperty('rounding', t);
    this.synchronizeStateProperty('size', t);
    this.synchronizeStateProperty('center', t);
    this.synchronizeStateProperty('corner', t);
    this.synchronizeStateProperty('color', t);
    this.synchronizeStateProperty('opacity', t);

    this.state.colorBytes = [
      Math.floor(this.state.color[0] * 255),
      Math.floor(this.state.color[1] * 255),
      Math.floor(this.state.color[2] * 255),
    ];

    if (this.hasCenter) {
      this.state.corner = [
        this.state.center[0] - 0.5 * this.state.size[0],
        this.state.center[1] - 0.5 * this.state.size[1],
      ];
    }

    this.stroke?.synchronizeState(t);
  }

  synchronizeDom(t, bounds) {
    super.synchronizeDom(t, bounds);

    if (this.state.rounding) {
      this.element.setAttributeNS(null, 'rx', this.state.rounding);
      this.element.setAttributeNS(null, 'ry', this.state.rounding);
    }

    this.element.setAttributeNS(null, 'width', this.state.size[0]);
    this.element.setAttributeNS(null, 'height', this.state.size[1]);

    this.element.setAttributeNS(null, 'x', this.state.corner[0]);
    this.element.setAttributeNS(null, 'y', bounds.span - this.state.size[1] - this.state.corner[1]);

    const rgb = `rgb(${this.state.colorBytes[0]}, ${this.state.colorBytes[1]}, ${this.state.colorBytes[2]})`;
    this.element.setAttributeNS(null, 'fill', rgb);

    this.stroke?.synchronizeDom(t, this.element);
  }

  computeBoundingBox() {
    let positions;

    if (this.state.size) {
      if (this.state.center) {
        positions = [
          [
            this.state.center[0] - this.state.size[0] * 0.5,
            this.state.center[1] - this.state.size[1] * 0.5,
          ],
          [
            this.state.center[0] + this.state.size[0] * 0.5,
            this.state.center[1] - this.state.size[1] * 0.5,
          ],
          [
            this.state.center[0] - this.state.size[0] * 0.5,
            this.state.center[1] + this.state.size[1] * 0.5,
          ],
          [
            this.state.center[0] + this.state.size[0] * 0.5,
            this.state.center[1] + this.state.size[1] * 0.5,
          ],
        ];
      } else if (this.state.corner) {
        positions = [
          [
            this.state.corner[0],
            this.state.corner[1],
          ],
          [
            this.state.corner[0] + this.state.size[0],
            this.state.corner[1],
          ],
          [
            this.state.corner[0],
            this.state.corner[1] + this.state.size[1],
          ],
          [
            this.state.corner[0] + this.state.size[0],
            this.state.corner[1] + this.state.size[1],
          ],
        ];
      }

      if (this.untimedProperties.stroke.state.size) {
        const thickness = this.untimedProperties.stroke.state.size * 0.5;
        positions[0][0] -= thickness;
        positions[1][0] += thickness;
        positions[2][0] -= thickness;
        positions[3][0] += thickness;

        positions[0][1] -= thickness;
        positions[1][1] -= thickness;
        positions[2][1] += thickness;
        positions[3][1] += thickness;
      }
    }

    // if (positions) {
      // for (let position of positions) {
        // let transformedPosition = this.state.matrix.multiplyVector(position);
        // this.boundingBox.enclosePoint(transformedPosition);
      // }
    // }

    // console.log("this.boundingBox:", this.boundingBox.toString());

    // TODO: add intervals
    // TODO: handle transforms
  }
}

// --------------------------------------------------------------------------- 

export class Raster extends Shape {
  static type = 'raster';
  static article = 'a';
  static timedIds = ['corner', 'center', 'width', 'height', 'enabled'];

  initialize(where) {
    super.initialize(where);
  }

  static create(where) {
    const shape = new Raster();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Raster();
    shape.embody(object, inflater);
    return shape;
  }

  configureState(bounds) {
    this.element = document.createElementNS(svgNamespace, 'image');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    // TODO assert id
    this.root.addRaster(this.untimedProperties.id.value, this);

    // TODO allow no centroid
    this.state.centroid = [0, 0];

    if (!this.timedProperties.hasOwnProperty('width') && !this.timedProperties.hasOwnProperty('height')) {
      throw new LocatedException(this.where, 'I found a <code>raster</code> that had neither its <code>width</code> nor <code>height</code> set. At least one of these must be defined.');
    }

    if (this.timedProperties.hasOwnProperty('width')) {
      this.configureScalarProperty('width', this, this, this.updateWidth.bind(this), bounds, [], timeline => {
        try {
          timeline.assertScalar(this, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>width</code>. ${e.message}`);
        }
      });
    }

    if (this.timedProperties.hasOwnProperty('height')) {
      this.configureScalarProperty('height', this, this, this.updateHeight.bind(this), bounds, [], timeline => {
        try {
          timeline.assertScalar(this, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>height</code>. ${e.message}`);
        }
      });
    }

    if (this.timedProperties.hasOwnProperty('width') && this.timedProperties.hasOwnProperty('height')) {
      this.element.setAttributeNS(null, 'preserveAspectRatio', 'none');
    }

    if (this.timedProperties.hasOwnProperty('corner') && this.timedProperties.hasOwnProperty('center')) {
      throw new LocatedException(this.where, 'I found a <code>raster</code> whose <code>corner</code> and <code>center</code> were both set. Define only one of these.');
    } else if (this.timedProperties.hasOwnProperty('corner')) {
      this.configureVectorProperty('corner', this, this, this.updateCorner.bind(this), bounds, [], timeline => {
        try {
          timeline.assertList({objectFrame: this}, 2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>corner</code>. ${e.message}`);
        }
      });
    } else if (this.timedProperties.hasOwnProperty('center')) {
      this.configureVectorProperty('center', this, this, this.updateCenter.bind(this), bounds, [], timeline => {
        try {
          timeline.assertList({objectFrame: this}, 2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>center</code>. ${e.message}`);
        }
      });
    } else {
      throw new LocatedException(this.where, "I found a <code>raster</code> whose position I couldn't figure out. Define either its <code>corner</code> or <code>center</code>.");
    }
  }

  updateWidth(bounds) {
    this.element.setAttributeNS(null, 'width', this.state.width);
  }

  updateHeight(bounds) {
    this.element.setAttributeNS(null, 'height', this.state.height);
  }

  updateCenter(bounds) {
    // this.state.centroid = this.state.center;
    // this.element.setAttributeNS(null, 'x', this.state.center[0] - this.state.size[0] * 0.5);
    // this.element.setAttributeNS(null, 'y', bounds.span - this.state.center[1] - this.state.size[1] * 0.5);
  }

  updateCorner(bounds) {
    // this.state.centroid = [this.state.corner[0] + 0.5 * this.state.size[0], this.state.corner[1] + 0.5 * this.state.size[1]];
  }

  setRaster(aspectRatio, url) {
    this.element.setAttributeNS(null, 'href', url);
    this.state.aspectRatio = aspectRatio;
    this.synchronizeDimensions();
  }

  synchronizeDimensions() {
    if (this.timedProperties.hasOwnProperty('width') && !this.timedProperties.hasOwnProperty('height')) {
      this.state.height = this.state.width / this.state.aspectRatio;
    } else if (this.timedProperties.hasOwnProperty('height') && !this.timedProperties.hasOwnProperty('width')) {
      this.state.width = this.state.height * this.state.aspectRatio;
    }
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);

    this.element.setAttributeNS(null, 'height', this.state.height);
    this.element.setAttributeNS(null, 'width', this.state.width);

    let x;
    let y;
    if (this.state.corner) {
      x = this.state.corner[0];
      y = this.state.corner[1];
    } else if (this.state.center) {
      x = this.state.center[0] - 0.5 * this.state.width;
      y = this.state.center[1] - 0.5 * this.state.height;
    }

    this.element.setAttributeNS(null, 'x', x);
    this.element.setAttributeNS(null, 'y', bounds.span - y - this.state.height);
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

    let resizeMarks = [];
    if (this.timedProperties.hasOwnProperty('width')) {
      this.widthMark = new HorizontalPanMark(this, this, multiplier, t => {
        return this.expressionAt('width', this.root.state.t);
      }, newValue => {
        this.state.width = newValue;
        this.synchronizeDimensions();
      });
      resizeMarks.push(this.widthMark);
    }

    if (this.timedProperties.hasOwnProperty('height')) {
      this.heightMark = new VerticalPanMark(this, this, multiplier, t => {
        return this.expressionAt('height', this.root.state.t);
      }, newValue => {
        this.state.height = newValue;
        this.synchronizeDimensions();
      });
      resizeMarks.push(this.heightMark);
    }

    this.markers[0].addMarks([this.positionMark, ...resizeMarks], [this.outlineMark]);
  }
 
  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);
    if (this.state.center) {
      const corner = [this.state.center[0] - this.state.width * 0.5, this.state.center[1] - this.state.height * 0.5];
      this.outlineMark.updateState(corner, [this.state.width, this.state.height], 0);
      this.positionMark.updateState(this.state.center, this.state.matrix);
      if (this.widthMark) {
        this.widthMark.updateState([this.state.center[0] + this.state.width * 0.5, this.state.center[1]], this.state.matrix);
      }
      if (this.heightMark) {
        this.heightMark.updateState([this.state.center[0], this.state.center[1] + this.state.height * 0.5], this.state.matrix);
      }
    } else {
      this.outlineMark.updateState(this.state.corner, [this.state.width, this.state.height], 0);
      this.positionMark.updateState(this.state.corner, this.state.matrix);
      if (this.widthMark) {
        this.widthMark.updateState([this.state.corner[0] + this.state.width, this.state.corner[1]], this.state.matrix);
      }
      if (this.heightMark) {
        this.heightMark.updateState([this.state.corner[0], this.state.corner[1] + this.state.height], this.state.matrix);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class Circle extends Shape {
  static type = 'circle';
  static article = 'a';
  static timedIds = ['center', 'radius', 'color', 'opacity', 'enabled'];

  initialize(where) {
    super.initialize(where);
    this.bindStatic('stroke', new FunctionDefinition('stroke', [], new ExpressionStroke(this)));
  }

  static create(where) {
    const shape = new Circle();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Circle();
    shape.embody(object, inflater);
    return shape;
  }

  validateProperties(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('radius');
    this.assertProperty('center');
    this.assertProperty('color');

    // Assert types of extent properties.
    this.assertScalarType('radius', [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('center', 2, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('radius', fromTime, toTime);
    this.assertCompleteTimeline('center', fromTime, toTime);
    this.assertCompleteTimeline('opacity', fromTime, toTime);
    this.assertCompleteTimeline('color', fromTime, toTime);

    this.stroke?.validate(fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.stroke?.initializeState();
  }

  initializeStaticState() {
    this.initializeStaticScalarProperty('radius');
    this.initializeStaticVectorProperty('center');
    this.initializeStaticVectorProperty('color');
    this.initializeStaticScalarProperty('opacity');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('radius');
    this.initializeDynamicProperty('center');
    this.initializeDynamicProperty('color');
    this.initializeDynamicProperty('opacity');
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'circle');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    root.mainGroup.appendChild(this.element);
  }

  initializeMarkState() {
    super.initializeMarkState();

    this.outlineMark = new CircleMark();
    this.markers[0].setBackgroundMarks(this.outlineMark);

    this.centerMark = new VectorPanMark(this, null, value => this.state.center = value);
    this.radiusMark = new HorizontalPanMark(this, null, 1, value => this.state.radius = value);
    this.markers[0].setForegroundMarks(this.centerMark, this.radiusMark);
  }

  synchronizeMarkExpressions(t) {
    super.synchronizeMarkExpressions(t);
    this.centerMark.synchronizeExpressions(this.expressionAt('center', t));
    this.radiusMark.synchronizeExpressions(this.expressionAt('radius', t));
  }

  synchronizeMarkState(t) {
    super.synchronizeMarkState(t);
    this.outlineMark.synchronizeState(this.state.center, this.state.radius);
    this.centerMark.synchronizeState(this.state.center);
    this.radiusMark.synchronizeState([
      this.state.center[0] + this.state.radius,
      this.state.center[1],
    ]);

    this.state.centroid = this.state.matrix.multiplyVector(this.state.center);
    this.state.boundingBox = BoundingBox.fromCenterRadius(this.state.center, this.state.radius);
  }
 
  synchronizeMarkDom(bounds, zoomFactor) {
    super.synchronizeMarkDom(bounds, zoomFactor);
    this.outlineMark.synchronizeDom(bounds);
    this.centerMark.synchronizeDom(bounds, this.state.matrix, zoomFactor);
    this.radiusMark.synchronizeDom(bounds, this.state.matrix, zoomFactor);
  }

  synchronizeState(t) {
    super.synchronizeState(t);

    this.synchronizeStateProperty('radius', t);
    this.synchronizeStateProperty('center', t);
    this.synchronizeStateProperty('color', t);
    this.synchronizeStateProperty('opacity', t);

    this.state.colorBytes = [
      Math.floor(this.state.color[0] * 255),
      Math.floor(this.state.color[1] * 255),
      Math.floor(this.state.color[2] * 255),
    ];

    this.stroke?.synchronizeState(t);
  }

  synchronizeDom(t, bounds) {
    super.synchronizeDom(t, bounds);

    this.element.setAttributeNS(null, 'r', this.state.radius);

    this.element.setAttributeNS(null, 'cx', this.state.center[0]);
    this.element.setAttributeNS(null, 'cy', bounds.span - this.state.center[1]);

    const rgb = `rgb(${this.state.colorBytes[0]}, ${this.state.colorBytes[1]}, ${this.state.colorBytes[2]})`;
    this.element.setAttributeNS(null, 'fill', rgb);

    this.stroke?.synchronizeDom(t, this.element);
  }

  computeBoundingBox() {
    if (this.state.center && this.state.radius) {
      this.boundingBox.enclosePoint([
        this.state.center[0] - this.state.radius,
        this.state.center[1] - this.state.radius,
      ]);
      this.boundingBox.enclosePoint([
        this.state.center[0] + this.state.radius,
        this.state.center[1] + this.state.radius,
      ]);
    }

    // add intervals
  }
}

// --------------------------------------------------------------------------- 

export class Grid extends Shape {
  static type = 'grid';
  static article = 'a';
  static timedIds = ['ticks', 'corner', 'center', 'size', 'enabled'];

  initialize(where) {
    super.initialize(where);
    this.untimedProperties.stroke = Stroke.create(this);
    this.untimedProperties.stroke.bind('opacity', new ExpressionReal(1));
    this.untimedProperties.stroke.bind('color', new ExpressionVector([
      new ExpressionReal(180 / 255),
      new ExpressionReal(180 / 255),
      new ExpressionReal(180 / 255)
    ]));
    this.untimedProperties.stroke.bind('size', new ExpressionReal(1));
  }

  static create(where) {
    const shape = new Grid();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Grid();
    shape.embody(object, inflater);
    return shape;
  }

  configureState(bounds) {
    this.element = document.createElementNS(svgNamespace, 'g');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.state.ticks = [1, 1];
    this.state.size = [bounds.width, bounds.height];
    this.state.corner = [bounds.x, bounds.y];
    this.updateCorner(bounds);

    this.configureVectorProperty('ticks', this, this, this.updateTicks.bind(this), bounds, [], timeline => {
      if (!timeline) {
        return false;
      }

      try {
        timeline.assertList({objectFrame: this}, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>ticks</code>. ${e.message}`);
      }
    });

    this.configureVectorProperty('size', this, this, this.updateSize.bind(this), bounds, [], timeline => {
      if (!timeline) {
        return false;
      }

      try {
        timeline.assertList({objectFrame: this}, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>size</code>. ${e.message}`);
      }
    });

    if (this.timedProperties.hasOwnProperty('corner') && this.timedProperties.hasOwnProperty('center')) {
      throw new LocatedException(this.where, 'I found a grid whose <code>corner</code> and <code>center</code> were both set. Define only one of these.');
    } else if (this.timedProperties.hasOwnProperty('corner')) {
      this.configureVectorProperty('corner', this, this, this.updateCorner.bind(this), bounds, ['size'], timeline => {
        try {
          timeline.assertList({objectFrame: this}, 2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>corner</code>. ${e.message}`);
        }
      });
    } else if (this.timedProperties.hasOwnProperty('center')) {
      this.configureVectorProperty('center', this, this, this.updateCenter.bind(this), bounds, ['size'], timeline => {
        try {
          timeline.assertList({objectFrame: this}, 2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>center</code>. ${e.message}`);
        }
      });
    // } else {
      // throw new LocatedException(this.where, "I found a grid whose position I couldn't figure out. Define either its <code>corner</code> or <code>center</code>.");
    }

    this.configureStroke(this.untimedProperties.stroke, bounds, false);
  }

  updateTicks(bounds) {
  }

  updateSize(bounds) {
    // this.element.setAttributeNS(null, 'width', this.state.size[0]);
    // this.element.setAttributeNS(null, 'height', this.state.size[1]);
  }

  updateCenter(bounds) {
    this.state.centroid = this.state.center;
    // this.element.setAttributeNS(null, 'x', this.state.center[0] - this.state.size[0] * 0.5);
    // this.element.setAttributeNS(null, 'y', bounds.span - this.state.center[1] - this.state.size[1] * 0.5);
  }

  updateCorner(bounds) {
    this.state.centroid = [this.state.corner[0] + 0.5 * this.state.size[0], this.state.corner[1] + 0.5 * this.state.size[1]];
    // this.element.setAttributeNS(null, 'x', this.state.corner[0]);
    // this.element.setAttributeNS(null, 'y', bounds.span - this.state.size[1] - this.state.corner[1]);
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);

    this.updateSize(bounds);
    if (this.timedProperties.hasOwnProperty('center')) {
      this.updateCenter(bounds);
    } else {
      this.updateCorner(bounds);
    }

    clearChildren(this.element);

    if (this.state.ticks[0] > 0) {
      const gap = this.state.ticks[0];
      const first = Math.ceil(this.state.corner[0] / gap) * gap;
      const last = this.state.corner[0] + this.state.size[0];
      for (let tick = first; tick <= last; tick += gap) {
        const line = document.createElementNS(svgNamespace, 'line');
        line.setAttributeNS(null, 'visibility', 'visible');
        line.setAttributeNS(null, 'x1', tick);
        line.setAttributeNS(null, 'x2', tick);
        line.setAttributeNS(null, 'y1', bounds.span - this.state.corner[1]);
        line.setAttributeNS(null, 'y2', bounds.span - (this.state.corner[1] + this.state.size[1]));
        line.classList.add('grid-line');
        this.element.appendChild(line);
      }
    }

    if (this.state.ticks[1] > 0) {
      const gap = this.state.ticks[1];
      const first = Math.ceil(this.state.corner[1] / gap) * gap;
      const last = this.state.corner[1] + this.state.size[1];
      for (let tick = first; tick <= last; tick += gap) {
        const line = document.createElementNS(svgNamespace, 'line');
        line.setAttributeNS(null, 'visibility', 'visible');
        line.setAttributeNS(null, 'y1', bounds.span - tick);
        line.setAttributeNS(null, 'y2', bounds.span - tick);
        line.setAttributeNS(null, 'x1', this.state.corner[0]);
        line.setAttributeNS(null, 'x2', this.state.corner[0] + this.state.size[0]);
        line.classList.add('grid-line');
        this.element.appendChild(line);
      }
    }
  }

  configureMarks() {
    super.configureMarks();
    this.outlineMark = new RectangleMark();

    let multiplier;
    const interactiveMarks = [];

    if (this.timedProperties.hasOwnProperty('center') || this.timedProperties.hasOwnProperty('center')) {
      let getPositionExpression;
      let updatePositionState;
      if (this.timedProperties.hasOwnProperty('center')) {
        getPositionExpression = t => this.expressionAt('center', this.root.state.t);
        updatePositionState = ([x, y]) => {
          this.state.center[0] = x;
          this.state.center[1] = y;
        };
        multiplier = 2;
      } else if (this.timedProperties.hasOwnProperty('corner')) {
        getPositionExpression = t => this.expressionAt('corner', this.root.state.t);
        updatePositionState = ([x, y]) => {
          this.state.corner[0] = x;
          this.state.corner[1] = y;
        };
        multiplier = 1;
      }

      this.positionMark = new VectorPanMark(this, null, getPositionExpression, updatePositionState);
      interactiveMarks.push(this.positionMark);
    }

    if (this.timedProperties.hasOwnProperty('size')) {
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

      interactiveMarks.push(this.widthMark, this.heightMark);
    }

    this.markers[0].addMarks(interactiveMarks, [this.outlineMark]);
  }
 
  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);
    if (this.state.center) {
      const corner = [this.state.center[0] - this.state.size[0] * 0.5, this.state.center[1] - this.state.size[1] * 0.5];
      this.outlineMark.updateState(corner, this.state.size, this.state.rounding);
      if (this.positionMark) {
        this.positionMark.updateState(this.state.center, this.state.matrix);
      }
      if (this.widthMark) {
        this.widthMark.updateState([this.state.center[0] + this.state.size[0] * 0.5, this.state.center[1]], this.state.matrix);
        this.heightMark.updateState([this.state.center[0], this.state.center[1] + this.state.size[1] * 0.5], this.state.matrix);
      }
    } else {
      this.outlineMark.updateState(this.state.corner, this.state.size, this.state.rounding);
      if (this.positionMark) {
        this.positionMark.updateState(this.state.corner, this.state.matrix);
      }
      if (this.widthMark) {
        this.widthMark.updateState([this.state.corner[0] + this.state.size[0], this.state.corner[1]], this.state.matrix);
        this.heightMark.updateState([this.state.corner[0], this.state.corner[1] + this.state.size[1]], this.state.matrix);
      }
    }
  }

  computeBoundingBox() {
    let positions;

    if (this.state.size) {
      if (this.state.center) {
        positions = [
          [
            this.state.center[0] - this.state.size[0] * 0.5,
            this.state.center[1] - this.state.size[1] * 0.5,
          ],
          [
            this.state.center[0] + this.state.size[0] * 0.5,
            this.state.center[1] - this.state.size[1] * 0.5,
          ],
          [
            this.state.center[0] - this.state.size[0] * 0.5,
            this.state.center[1] + this.state.size[1] * 0.5,
          ],
          [
            this.state.center[0] + this.state.size[0] * 0.5,
            this.state.center[1] + this.state.size[1] * 0.5,
          ],
        ];
      } else if (this.state.corner) {
        positions = [
          [
            this.state.corner[0],
            this.state.corner[1],
          ],
          [
            this.state.corner[0] + this.state.size[0],
            this.state.corner[1],
          ],
          [
            this.state.corner[0],
            this.state.corner[1] + this.state.size[1],
          ],
          [
            this.state.corner[0] + this.state.size[0],
            this.state.corner[1] + this.state.size[1],
          ],
        ];
      }
    }

    if (positions) {
      for (let position of positions) {
        let transformedPosition = this.state.matrix.multiplyVector(position);
        this.boundingBox.enclosePoint(transformedPosition);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class NodeShape extends Shape {
  initialize(where) {
    super.initialize(where);
    this.nodes = [];
    this.mirrors = [];
  }

  deflateReferent() {
    const object = super.deflateReferent();
    object.nodes = this.nodes.map(node => node.deflate());
    object.mirrors = this.mirrors.map(mirror => mirror.deflate());
    return object;
  }

  embody(object, inflater) {
    super.embody(object, inflater);
    this.nodes = object.nodes.map(subobject => inflater.inflate(this, subobject));
    this.mirrors = object.mirrors.map(subobject => inflater.inflate(this, subobject));
  }

  configureNodes(bounds) {
    for (let [i, node] of this.nodes.entries()) {

      // If we have a tab node, it must be followed by node that produces a
      // straight line.
      if (node instanceof TabNode) {
        if (i === this.nodes.length - 1) {
          throw new LocatedException(node.where, `I found ${node.article} ${node.type} node at the end of a sequence. It must be followed by a node that produces a straight line.`);
        } else {
          const nextNode = this.nodes[i + 1];
          if (!(nextNode instanceof VertexNode ||
                nextNode instanceof MoveNode ||
                nextNode instanceof BackNode ||
                nextNode instanceof LineNode)) {
            throw new LocatedException(node.where, `I found ${node.article} ${node.type} node that was followed by ${nextNode.article} ${nextNode.type} node. It must be followed by a node that produces a straight line.`);
          }
        }
      }

      node.configure(i > 0 ? this.nodes[i - 1].turtle : null, bounds);
    }

    for (let mirror of this.mirrors) {
      mirror.configureState(bounds);
    }
  }

  get isAnimated() {
    return this.nodes.some(node => node.isAnimated) || this.mirrors.some(mirror => mirror.isAnimated);
  }

  get hasAllDefaults() {
    return this.nodes.every(node => node.hasAllDefaults) && this.mirrors.every(mirror => mirror.hasAllDefaults);
  }

  configureState(bounds) {
    this.state.tabSize = 1;
    this.state.tabDegrees = 45;
    this.state.tabInset = 0;
    this.state.tabIsCounterclockwise = true;
    this.state.turtle0 = null;

    this.configureNodes(bounds);
    this.configureOtherProperties(bounds);

    if (this.isAnimated) {
      this.updateDoms.push(this.updateContentDom.bind(this));
    }

    if (this.hasAllDefaults) {
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
      ager(this, t);
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

  computeBoundingBox() {
    for (let node of this.domNodes) {
      const position = node.turtle.position;
      // let transformedPosition = this.state.matrix.multiplyVector(position);
      // this.boundingBox.enclosePoint(transformedPosition);
    }

    if (this.untimedProperties.hasOwnProperty('stroke')) {
      if (this.untimedProperties.stroke.state.hasOwnProperty('size')) {
        const halfStrokeSize = this.untimedProperties.stroke.state.size * 0.5;
        this.boundingBox.thicken(halfStrokeSize);
      }
    } else if (this.timedProperties.hasOwnProperty('stroke')) {
      this.boundingBox.thicken(this.state.size * 0.5);
    }

    // TODO handle stroke
  }
}

// --------------------------------------------------------------------------- 

export class Polygon extends VertexShape {
  static type = 'polygon';
  static article = 'a';
  static timedIds = ['color', 'opacity', 'enabled'];

  initialize(where) {
    super.initialize(where);
    this.initializeFill();

    this.bindFunction('tab', new FunctionDefinition('tab', [], new ExpressionTabNode(this)));
    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMoveNode(this)));
    this.bindFunction('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
    this.bindFunction('back', new FunctionDefinition('back', [], new ExpressionBackNode(this)));
  }

  static create(where) {
    const shape = new Polygon();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Polygon();
    shape.embody(object, inflater);
    return shape;
  }

  configureOtherProperties(bounds) {
    this.element = document.createElementNS(svgNamespace, 'polygon');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.domNodes = this.nodes.filter(node => node.isDom);
    if (this.domNodes.length < 3) {
      throw new LocatedException(this.where, `I found a <code>polygon</code> with ${this.domNodes.length} ${this.domNodes.length == 1 ? 'vertex' : 'vertices'}. Polygons must have at least 3 vertices.`);
    }

    this.state.turtle0 = this.domNodes[0].turtle;

    this.configureFill(bounds);
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);
    const positions = this.domNodes.flatMap((node, index) => {
      return node.getPositions(this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
    });
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
  static timedIds = ['size', 'color', 'opacity', 'join', 'enabled'];

  initialize(where) {
    super.initialize(where);

    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMoveNode(this)));
    this.bindFunction('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
  }

  static create(where) {
    const shape = new Polyline();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Polyline();
    shape.embody(object, inflater);
    return shape;
  }

  configureOtherProperties(bounds) {
    this.element = document.createElementNS(svgNamespace, 'polyline');
    this.element.setAttributeNS(null, 'fill', 'none');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.domNodes = this.nodes.filter(node => node.isDom);
    this.configureStroke(this, bounds, true);
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);
    const sum = this.domNodes.reduce((acc, node) => [acc[0] + node.turtle.position[0], acc[1] + node.turtle.position[1]], [0, 0]);
    this.state.centroid = sum.map(value => value / this.domNodes.length);
    const coordinates = this.domNodes.map(node => `${node.turtle.position[0]},${bounds.span - node.turtle.position[1]}`).join(' ');
    this.element.setAttributeNS(null, 'points', coordinates);
  }

  configureMarks() {
    super.configureMarks();
    this.outlineMark = new PolylineMark();
    this.markers[0].addMarks([], [this.outlineMark]);
  }

  updateInteractionState(bounds) {
    super.updateInteractionState(bounds);
    this.outlineMark.updateState(this.domNodes.map(node => node.turtle.position));
  }
}

// --------------------------------------------------------------------------- 

export class Line extends VertexShape {
  static type = 'line';
  static article = 'a';
  static timedIds = ['size', 'color', 'opacity', 'enabled'];

  initialize(where) {
    super.initialize(where);

    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMoveNode(this)));
  }

  static create(where) {
    const shape = new Line();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Line();
    shape.embody(object, inflater);
    return shape;
  }

  configureOtherProperties(bounds) {
    this.element = document.createElementNS(svgNamespace, 'line');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    this.domNodes = this.nodes.filter(node => node.isDom);
    if (this.domNodes.length != 2) {
      throw new LocatedException(this.where, `I found a line with ${this.domNodes.length} ${this.domNodes.length == 1 ? 'vertex' : 'vertices'}. Lines must have exactly 2 vertices.`);
    }

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

const UngonFormula = Object.freeze({
  Absolute: 0,
  Relative: 1,
  Symmetric: 2,
});

// --------------------------------------------------------------------------- 

export class Ungon extends VertexShape {
  static type = 'ungon';
  static article = 'an';
  static timedIds = ['rounding', 'color', 'opacity', 'enabled'];

  initialize(where) {
    super.initialize(where);
    this.initializeFill();

    this.bindFunction('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMoveNode(this)));
    this.bindFunction('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
    this.bindFunction('back', new FunctionDefinition('back', [], new ExpressionBackNode(this)));
  }

  static create(where) {
    const shape = new Ungon();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Ungon();
    shape.embody(object, inflater);
    return shape;
  }

  configureOtherProperties(bounds) {
    this.element = document.createElementNS(svgNamespace, 'path');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    if (this.untimedProperties.hasOwnProperty('formula')) {
      if (this.untimedProperties.formula.value === 0) {
        this.state.formula = UngonFormula.Absolute;
      } else if (this.untimedProperties.formula.value === 1) {
        this.state.formula = UngonFormula.Relative;
      } else if (this.untimedProperties.formula.value === 2) {
        this.state.formula = UngonFormula.Symmetric;
      } else {
        // TODO locate it better.
        throw new LocatedException(this.where, `I found an <code>ungon</code> with a bad formula.`);
      }
    } else {
      this.state.formula = UngonFormula.Symmetric;
    }

    this.domNodes = this.nodes.filter(node => node.isDom);
    if (this.domNodes.length < 3) {
      throw new LocatedException(this.where, `I found an <code>ungon</code> with ${this.domNodes.length} ${this.domNodes.length == 1 ? 'vertex' : 'vertices'}. Polygons must have at least 3 vertices.`);
    }

    if (this.state.formula !== UngonFormula.Symmetric) {
      this.configureScalarProperty('rounding', this, this, null, bounds, [], timeline => {
        if (!timeline) {
          throw new LocatedException(this.where, `I found an <code>ungon</code> whose <code>rounding</code> was not set.`);
        }

        try {
          timeline.assertScalar(this, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>rounding</code>. ${e.message}`);
        }
      });
    }

    this.configureFill(bounds);
  }

  get isAnimated() {
    return super.isAnimated || (this.state.formula !== UngonFormula.Symmetric && this.timedProperties.rounding.isAnimated);
  }

  get hasAllDefaults() {
    return super.hasAllDefaults && (this.state.formula === UngonFormula.Symmetric || this.timedProperties.rounding.hasDefault);
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);

    const gap = distancePointPoint(this.domNodes[0].turtle.position, this.domNodes[this.domNodes.length - 1].turtle.position);
    const hasReturn = gap < 1e-6;
    let nnodes = hasReturn ? this.domNodes.length - 1 : this.domNodes.length;
    let pathCommands = [];

    if (this.state.formula === UngonFormula.Symmetric) {
      let start = [
        (this.domNodes[0].turtle.position[0] + this.domNodes[1].turtle.position[0]) * 0.5,
        (this.domNodes[0].turtle.position[1] + this.domNodes[1].turtle.position[1]) * 0.5
      ];
      pathCommands.push(`M ${start[0]},${bounds.span - start[1]}`);

      let previous = start;
      for (let i = 1; i < nnodes; ++i) {
        const a = this.domNodes[i].turtle.position;
        const b = this.domNodes[(i + 1) % this.domNodes.length].turtle.position;
        let mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
        pathCommands.push(`Q ${a[0]},${bounds.span - a[1]} ${mid[0]},${bounds.span - mid[1]}`);
        previous = mid;
      }

      const first = this.domNodes[0].state.position;
      pathCommands.push(`Q ${first[0]},${bounds.span - first[1]} ${start[0]},${bounds.span - start[1]}`);
    } else if (this.state.formula === UngonFormula.Absolute) {
      let rounding = this.state.rounding;

      let vectors = this.domNodes.map((node, i) => {
        const a = node.turtle.position;
        const b = this.domNodes[(i + 1) % nnodes].turtle.position;

        let vector = [b[0] - a[0], b[1] - a[1]];
        let magnitude = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
        vector[0] /= magnitude;
        vector[1] /= magnitude;

        return vector;
      });

      let insetA = [
        this.domNodes[0].turtle.position[0] + rounding * vectors[0][0],
        this.domNodes[0].turtle.position[1] + rounding * vectors[0][1],
      ];
      pathCommands.push(`M ${insetA[0]},${bounds.span - insetA[1]}`);

      for (let i = 0; i < nnodes; ++i) {
        const position = this.domNodes[(i + 1) % nnodes].turtle.position;
        const vector = vectors[(i + 1) % nnodes];

        let insetB = [
          position[0] - rounding * vectors[i][0],
          position[1] - rounding * vectors[i][1],
        ];
        pathCommands.push(`L ${insetB[0]},${bounds.span - insetB[1]}`);

        let insetA = [
          position[0] + rounding * vector[0],
          position[1] + rounding * vector[1],
        ];
        pathCommands.push(`Q ${position[0]},${bounds.span - position[1]} ${insetA[0]},${bounds.span - insetA[1]}`);
      }
    } else {
      let start = [
        (this.domNodes[0].turtle.position[0] + this.domNodes[1].turtle.position[0]) * 0.5,
        (this.domNodes[0].turtle.position[1] + this.domNodes[1].turtle.position[1]) * 0.5
      ];
      pathCommands.push(`M ${start[0]},${bounds.span - start[1]}`);

      let rounding = 1 - this.state.rounding;

      let previous = start;
      for (let i = 1; i < nnodes; ++i) {
        const a = this.domNodes[i].turtle.position;
        const b = this.domNodes[(i + 1) % this.domNodes.length].turtle.position;

        let mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];

        let control1 = [
          previous[0] + rounding * (a[0] - previous[0]),
          previous[1] + rounding * (a[1] - previous[1]),
        ];

        let control2 = [
          mid[0] + rounding * (a[0] - mid[0]),
          mid[1] + rounding * (a[1] - mid[1]),
        ];

        pathCommands.push(`C ${control1[0]},${bounds.span - control1[1]} ${control2[0]},${bounds.span - control2[1]} ${mid[0]},${bounds.span - mid[1]}`);
        previous = mid;
      }

      const first = this.domNodes[0].state.position;
      let control1 = [
        previous[0] + rounding * (first[0] - previous[0]),
        previous[1] + rounding * (first[1] - previous[1]),
      ];
      let control2 = [
        start[0] + rounding * (first[0] - start[0]),
        start[1] + rounding * (first[1] - start[1]),
      ];

      pathCommands.push(`C ${control1[0]},${bounds.span - control1[1]} ${control2[0]},${bounds.span - control2[1]} ${start[0]},${bounds.span - start[1]}`);
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

  initialize(where) {
    super.initialize(where);
    this.initializeFill();

    this.bindFunction('tab', new FunctionDefinition('tab', [], new ExpressionTabNode(this)));
    this.bindFunction('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindFunction('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindFunction('move', new FunctionDefinition('move', [], new ExpressionMoveNode(this)));
    this.bindFunction('jump', new FunctionDefinition('jump', [], new ExpressionJumpNode(this)));
    this.bindFunction('circle', new FunctionDefinition('circle', [], new ExpressionCircleNode(this)));
    this.bindFunction('rectangle', new FunctionDefinition('rectangle', [], new ExpressionRectangleNode(this)));
    this.bindFunction('go', new FunctionDefinition('go', [], new ExpressionGoNode(this)));
    this.bindFunction('back', new FunctionDefinition('back', [], new ExpressionBackNode(this)));
    this.bindFunction('line', new FunctionDefinition('line', [], new ExpressionLineNode(this)));
    this.bindFunction('quadratic', new FunctionDefinition('quadratic', [], new ExpressionQuadraticNode(this)));
    this.bindFunction('cubic', new FunctionDefinition('cubic', [], new ExpressionCubicNode(this)));
    this.bindFunction('arc', new FunctionDefinition('arc', [], new ExpressionArcNode(this)));
    this.bindFunction('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
  }

  static create(where) {
    const shape = new Path();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Path();
    shape.embody(object, inflater);
    return shape;
  }

  addNode(node) {
    if (this.nodes.length === 0 && !(node instanceof GoNode || node instanceof TurtleNode || node instanceof CircleNode || node instanceof RectangleNode)) {
      throw new LocatedException(node.where, `I saw a path whose first step is ${node.type}. A path must begin with <code>go</code>, <code>turtle</code>, or <code>circle</code>.`);
    } else {
      this.nodes.push(node);
    }
  }

  configureOtherProperties(bounds) {
    this.element = document.createElementNS(svgNamespace, 'path');
    this.element.setAttributeNS(null, 'stroke-linecap', 'round');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.element.setAttributeNS(null, 'fill-rule', 'evenodd');
    this.domNodes = this.nodes.filter(node => node.isDom);
    this.configureFill(bounds);
  }

  updateContentDom(bounds) {
    super.updateContentDom(bounds);

    const pathCommands = this.domNodes.map((node, index) => {
      return node.getPathCommand(bounds, this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
    });

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

      if (distancePointPoint(segments[0].from, segments[segments.length - 1].to) < 1e-6) {
        pathCommands.push('z');
      }
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
    const commands = this.domNodes.map(node => node.pathCommand);
    this.outlineMark.updateState(commands.join(' '));
  }
}

// --------------------------------------------------------------------------- 

export class Group extends Shape {
  static type = 'group';
  static article = 'a';
  static timedIds = ['enabled']; // TODO does enabled work on group

  initialize(where) {
    super.initialize(where);
    this.children = [];
  }

  deflateReferent() {
    const object = super.deflateReferent();
    object.children = this.children.map(child => child.deflateReferent());
    return object;
  }

  embody(object, inflater) {
    super.embody(object, inflater);
    this.children = object.children.map(subobject => Shape.inflate(this, subobject));
  }

  static create(where) {
    const shape = new Group();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Group();
    shape.embody(object, inflater);
    return shape;
  }

  // start() {
    // super.start();
    // this.createHierarchy();
    // this.markers[0].addMarks([], []);
    // this.connect();
  // }

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

  configureTransforms(bounds) {
    super.configureTransforms(bounds);
    for (let child of this.children) {
      child.configureTransforms(bounds);
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

  ageDomWithoutMarks(bounds, t) {
    super.ageDomWithoutMarks(bounds, t);
    for (let child of this.children) {
      if (child.activate(t)) {
        child.ageDomWithoutMarks(bounds, t);
      }
    }
  }

  ageDomWithMarks(bounds, t, factor) {
    super.ageDomWithMarks(bounds, t, factor);
    for (let child of this.children) {
      if (child.activate(t)) {
        child.ageDomWithMarks(bounds, t, factor);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class Mask extends Group {
  static type = 'mask';
  static article = 'a';
  static timedIds = [];

  static create(where) {
    const shape = new Mask();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Mask();
    shape.embody(object, inflater);
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

  static create(where) {
    const shape = new Cutout();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Cutout();
    shape.embody(object, inflater);
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

  static create(where) {
    const shape = new Tip();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Tip();
    shape.embody(object, inflater);
    return shape;
  }

  connectToParent() {
    this.isDrawable = true;
    this.root.defines.appendChild(this.element);
  }

  configureMarks() {
    super.configureMarks();
    this.markers[0].addMarks([], [], [], []);
  }

  configureState(bounds) {
    this.state.centroid = [0, 0];

    this.element = document.createElementNS(svgNamespace, 'marker');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.element.setAttributeNS(null, 'orient', 'auto-start-reverse');
    this.element.setAttributeNS(null, 'markerUnits', 'strokeWidth');

    // Without this, the marker gets clipped.
    this.element.setAttributeNS(null, 'overflow', 'visible');

    this.configureVectorProperty('size', this, this, this.updateSize.bind(this), bounds, [], timeline => {
      if (!timeline) {
        throw new LocatedException(this.where, 'I found a tip whose <code>size</code> was not set.');
      }

      try {
        timeline.assertList({objectFrame: this}, 2, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>size</code>. ${e.message}`);
      }
    });

    if (this.timedProperties.hasOwnProperty('corner') && this.timedProperties.hasOwnProperty('center')) {
      throw new LocatedException(this.where, 'I found a tip whose <code>corner</code> and <code>center</code> were both set. Define only one of these.');
    } else if (this.timedProperties.hasOwnProperty('corner')) {
      this.configureVectorProperty('corner', this, this, this.updateCorner.bind(this), bounds, ['size'], timeline => {
        try {
          timeline.assertList({objectFrame: this}, 2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>corner</code>. ${e.message}`);
        }
      });
    } else if (this.timedProperties.hasOwnProperty('center')) {
      this.configureVectorProperty('center', this, this, this.updateCenter.bind(this), bounds, ['size'], timeline => {
        try {
          timeline.assertList({objectFrame: this}, 2, ExpressionInteger, ExpressionReal);
          return true;
        } catch (e) {
          throw new LocatedException(e.where, `I found an illegal value for <code>center</code>. ${e.message}`);
        }
      });
    } else {
      throw new LocatedException(this.where, "I found a tip whose position I couldn't figure out. Define either its <code>corner</code> or <code>center</code>.");
    }
  }

  updateSize(bounds) {
    // this.element.setAttributeNS(null, 'width', this.state.size[0]);
    // this.element.setAttributeNS(null, 'height', this.state.size[1]);
    // this.state.corner = [
      // this.state.center[0] - this.state.size[0] * 0.5,
      // this.state.center[1] - this.state.size[1] * 0.5,
    // ];
  }

  updateCenter(bounds) {
    this.state.centroid = this.state.center;
    this.state.corner = [
      this.state.center[0] - this.state.size[0] * 0.5,
      this.state.center[1] - this.state.size[1] * 0.5,
    ];
    // this.element.setAttributeNS(null, 'x', this.state.center[0] - this.state.size[0] * 0.5);
    // this.element.setAttributeNS(null, 'y', bounds.span - this.state.center[1] - this.state.size[1] * 0.5);
  }

  updateCorner(bounds) {
    this.state.centroid = [this.state.corner[0] + 0.5 * this.state.size[0], this.state.corner[1] + 0.5 * this.state.size[1]];
    // this.element.setAttributeNS(null, 'x', this.state.corner[0]);
    // this.element.setAttributeNS(null, 'y', bounds.span - this.state.size[1] - this.state.corner[1]);
  }

  // updateProperties(env, t, bounds, matrix) {
    // console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    // const anchor = this.valueAt(env, 'anchor', t);
    // const size = this.valueAt(env, 'size', t);

    // let corner;
    // if (this.owns('corner')) {
      // corner = this.valueAt(env, 'corner', t);
    // } else {
      // let center = this.valueAt(env, 'center', t);
      // corner = new ExpressionVector([
        // new ExpressionReal(center.get(0).value - size.get(0).value * 0.5),
        // new ExpressionReal(center.get(1).value - size.get(1).value * 0.5),
      // ]);
    // }

    // const markerBounds = {
      // x: corner.get(0).value,
      // y: corner.get(1).value,
      // width: size.get(0).value,
      // height: size.get(1).value,
    // };
    // markerBounds.span = markerBounds.y + (markerBounds.y + markerBounds.height);

    // this.element.setAttributeNS(null, 'viewBox', `${markerBounds.x} ${markerBounds.y} ${markerBounds.width} ${markerBounds.height}`);

    // console.log("anchor:", anchor.toString());

    // matrix = this.transform(env, t, bounds, matrix);
    // const childCentroids = this.children.map(child => child.updateProperties(env, t, markerBounds, matrix));
    // const total = childCentroids.reduce((acc, centroid) => acc.add(centroid), new ExpressionVector([new ExpressionReal(0), new ExpressionReal(0)]));
    // const centroid = this.children.length == 0 ? total : total.divide(new ExpressionReal(this.children.length));
    // this.updateCentroid(matrix, centroid, bounds);

    // return centroid;
  // }

  updateContentDom(bounds) {
    this.element.setAttributeNS(null, 'markerWidth', this.state.size[0]);
    this.element.setAttributeNS(null, 'markerHeight', this.state.size[1]);
    this.element.setAttributeNS(null, 'refX', 0);
    this.element.setAttributeNS(null, 'refY', 0);
    this.element.setAttributeNS(null, 'viewBox', `${this.state.corner[0]} ${this.state.corner[1]} ${this.state.size[0]} ${this.state.size[1]}`);

    const markerBounds = {
      x: this.state.corner[0],
      y: this.state.corner[1],
      width: this.state.size[0],
      height: this.state.size[1],
    };
    markerBounds.span = markerBounds.y + (markerBounds.y + markerBounds.height);
    for (let child of this.children) {
      child.updateContentDom(markerBounds);
    }
  }

  // updateInteractionState(bounds) {
    // super.updateInteractionState(bounds);
  // }

}

// --------------------------------------------------------------------------- 

export class LinearGradient {
  static type = 'mask';
  static article = 'a';
  static timedIds = [];

  static create(where) {
    const shape = new Mask();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Mask();
    shape.embody(object, inflater);
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

// const FillMixin = {
  // initializeFill: function() {
    // this.untimedProperties.stroke = Stroke.create(this);
    // this.untimedProperties.stroke.bind('opacity', new ExpressionReal(1));
  // },

  // configureFill: function(bounds) {
    // this.element.setAttributeNS(null, 'fill', 'none');
    // this.configureColor(bounds);
    // this.configureStroke(this.untimedProperties.stroke, bounds, false);
  // },

  // configureColor: function(bounds) {
    // this.configureScalarProperty('opacity', this, this, this.updateOpacityDom.bind(this), bounds, [], timeline => {
      // if (timeline) {
        // try {
          // timeline.assertScalar(this, ExpressionInteger, ExpressionReal);
        // } catch (e) {
          // throw new LocatedException(e.where, `I found an illegal value for <code>opacity</code>. ${e.message}`);
        // }
      // }
      // return true;
    // });

    // this.configureVectorProperty('color', this, this, this.updateColorDom.bind(this), bounds, [], timeline => {
      // if (timeline) {
        // try {
          // timeline.assertList({objectFrame: this}, 3, ExpressionInteger, ExpressionReal);
        // } catch (e) {
          // throw new LocatedException(e.where, `I found an illegal value for <code>color</code>. ${e.message}`);
        // }
      // }

      // If the opacity is non-zero anywhen, then color is a required property.
      // const opacityTimeline = this.timedProperties.opacity;
      // const needsColor =
        // !this.isCutoutChild && // Color will get assigned to black in connect.
        // ((opacityTimeline.defaultValue && opacityTimeline.defaultValue.value > 0) ||
         // opacityTimeline.intervals.some(interval => (interval.hasFrom() && interval.fromValue.value > 0 || interval.hasTo() && interval.toValue.value > 0)));

      // if (!needsColor) {
        // return false;
      // } else if (!timeline) {
        // throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose <code>color</code> isn't set.`);
      // } else {
        // return true;
      // }
    // });
  // },

  // updateOpacityDom: function(bounds) {
    // this.element.setAttributeNS(null, 'fill-opacity', this.state.opacity);
  // },

  // updateColorDom: function(bounds) {
    // const r = Math.floor(this.state.color[0] * 255);
    // const g = Math.floor(this.state.color[1] * 255);
    // const b = Math.floor(this.state.color[2] * 255);
    // const rgb = `rgb(${r}, ${g}, ${b})`;
    // this.element.setAttributeNS(null, 'fill', rgb);
  // },
// };

// Object.assign(Rectangle.prototype, FillMixin);
// Object.assign(Circle.prototype, FillMixin);
// Object.assign(Ungon.prototype, FillMixin);
// Object.assign(Polygon.prototype, FillMixin);
// Object.assign(Path.prototype, FillMixin);
// Object.assign(Text.prototype, FillMixin);

// --------------------------------------------------------------------------- 

