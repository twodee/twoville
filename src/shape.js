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
  FlyNode,
  Mirror,
  RectangleNode,
  TabNode,
  WalkNode,
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
  ExpressionWalkNode,
  ExpressionInteger,
  ExpressionFlyNode,
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

/*
In the source code, the first transform added to the shape is the first one to
be be applied. The last transform is the last to be applied. These are stored
in the transforms property of a shape from last-applied to first-applied. This
order matches the order expected in the SVG transform attribute.

For example, consider this rectangle:

  with rectangle()
    // ...
    with translate()
      offset = [5, 6]
    with rotate()
      degrees = 45
      pivot = :zero2

The transforms property will look like this:

  [rotate(45, :zero2), translate(5, 6)]

*/

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

  resolveReferences(root) {
    super.resolveReferences(root);
    if (this.hasStatic('parent')) {
      // TODO assert that parent is a group
      this.getStatic('parent').children.push(this);
      this.isChild = true;
    } else {
      this.isChild = false;
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

  addTransform(transform) {
    this.transforms.unshift(transform);
  }

  connectToParent(root) {
    // If shape has a parent shape, nest under its element. Otherwise, nest
    // under the main group.
    if (this.isChild) {
      this.getStatic('parent').element.appendChild(this.element);
    } else {
      root.mainGroup.appendChild(this.element);
    }
  }
  
  // connectToParent() {
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
  // }

  // connect() {
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
  // }

  // get isCutoutChild() {
    // return this.owns('parent') && (this.get('parent') instanceof Cutout || this.get('parent').isCutoutChild);
    // return false;
  // }

  initializeMarkDom(root) {
    this.staticBackgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.staticBackgroundMarkGroup.setAttributeNS(null, 'id', `element-${this.id}-static-background-marks`);

    this.dynamicBackgroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.dynamicBackgroundMarkGroup.setAttributeNS(null, 'id', `element-${this.id}-dynamic-background-marks`);

    this.situatedForegroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.situatedForegroundMarkGroup.setAttributeNS(null, 'id', `element-${this.id}-situated-foreground-marks`);

    this.centeredForegroundMarkGroup = document.createElementNS(svgNamespace, 'g');
    this.centeredForegroundMarkGroup.setAttributeNS(null, 'id', `element-${this.id}-centered-foreground-marks`);

    this.element.classList.add('cursor-selectable');
    this.element.classList.add(`tag-${this.id}`);

    if (this.isChild) {
      this.getStatic('parent').staticBackgroundMarkGroup.appendChild(this.staticBackgroundMarkGroup);
      this.getStatic('parent').dynamicBackgroundMarkGroup.appendChild(this.dynamicBackgroundMarkGroup);
      this.getStatic('parent').situatedForegroundMarkGroup.appendChild(this.situatedForegroundMarkGroup);
      this.getStatic('parent').centeredForegroundMarkGroup.appendChild(this.centeredForegroundMarkGroup);
    } else {
      root.staticBackgroundMarkGroup.appendChild(this.staticBackgroundMarkGroup);
      root.dynamicBackgroundMarkGroup.appendChild(this.dynamicBackgroundMarkGroup);
      root.situatedForegroundMarkGroup.appendChild(this.situatedForegroundMarkGroup);
      root.centeredForegroundMarkGroup.appendChild(this.centeredForegroundMarkGroup);
    }

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

      if (this.isUnhoverTransition(event)) {
        this.markers[0].unhover();
      }

      // if (event.buttons === 0) {
        // this.root.contextualizeCursor(event.toElement);
      // }
    });

    // If the mouse exits through the outline mark, then the shape's leave
    // listener won't fire. The marker itself needs a leave listener.
    this.staticBackgroundMarkGroup.addEventListener('mouseleave', event => {
      if (this.isUnhoverTransition(event)) {
        this.markers[0].unhover();
      }
    });

    this.element.addEventListener('click', event => {
      // If the event bubbles up to the parent SVG, that means no shape was
      // clicked on, and everything will be deselected. We don't want that.
      event.stopPropagation();
      root.select(this);
    });

    // this.element.addEventListener('click', event => {
      // If the event bubbles up to the parent SVG, that means no shape was
      // clicked on, and everything will be deselected. We don't want that.
      // event.stopPropagation();

      // if (!this.root.isStale) {
        // this.root.select(this);
      // }
    // });

    // this.element.addEventListener('mouseenter', event => {
      // if (this.root.isTweaking) return;

      // event.stopPropagation();

      // Only show the marks if the source code is evaluated and fresh.
      // if (!this.isSelected && !this.root.isStale) {
        // this.markers[0].hoverMarks();
      // }

      // if (event.buttons === 0) {
        // this.root.contextualizeCursor(event.toElement);
      // }
    // });

    // this.element.addEventListener('mouseleave', event => {
      // event.stopPropagation();

      // if (this.markers[0].isUnhoverTransition(event)) {
        // this.markers[0].unhoverMarks();
      // }

      // if (event.buttons === 0) {
        // this.root.contextualizeCursor(event.toElement);
      // }
    // });
  }

  isUnhoverTransition(event) {
    // The cursor is leaving the shape, but it might just be running across a mark. The marks
    // are all tagged with class tag-SHAPE-ID. Don't unhover if we're on the shape or one of
    // its marks.
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

  selectMarker(id) {
    if (id !== this.selectedMarkerId && id < this.markers.length) {
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

  // flushManipulation(bounds, factor) {
    // this.updateContentState(bounds);
    // this.updateContentDom(bounds, factor);

    // this.updateInteractionState(bounds);
    // this.updateInteractionDom(bounds, factor);

    // First get all the model state in order.
    // A drag on a transform marker will have changed the state.
    // for (let transform of this.transforms) {
      // transform.updateDomCommand(bounds);
    // }
  // }

  synchronizeMarkState(t) {
    // let preMatrix = Matrix.identity();
    // let inverse = Matrix.identity();

    let matrices = this.transforms.map(transform => transform.toMatrix());
    let inverseMatrices = this.transforms.map(transform => transform.toInverseMatrix());

    let f = this.isChild ? this.getStatic('parent').state.matrix : Matrix.identity();
    let b = Matrix.identity();
    let forwardMatrices = [f];
    let backwardMatrices = [b];
    let afterMatrices = [Matrix.identity()];
    for (let i = 0; i < this.transforms.length; ++i) {
      let ii = this.transforms.length - 1 - i;
      f = matrices[ii].multiplyMatrix(f);
      b = b.multiplyMatrix(inverseMatrices[i]);
      forwardMatrices.push(f);
      backwardMatrices.push(b);
      afterMatrices.push(afterMatrices[afterMatrices.length - 1].multiplyMatrix(matrices[i]));
    }
    this.state.matrix = forwardMatrices[forwardMatrices.length - 1];
    this.state.inverseMatrix = backwardMatrices[backwardMatrices.length - 1];

    // R T
    // forwardMatrices: [I T R*T]
    // backwardMatrices: [I R^-1 R^-1*T^-1]

    for (let i = 0; i < this.transforms.length; i += 1) {
      const ii = this.transforms.length - 1 - i;
      const m = afterMatrices[ii];
      this.transforms[ii].synchronizeMarkState(t, m, m.inverse());
    }

    // Subclasses should compute centroid.
  }

  synchronizeMarkExpressions(t) {
    for (let transform of this.transforms) {
      transform.synchronizeMarkExpressions(t);
    }
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    // The background marks need to be transformed by any transformations that
    // have been applied. Only the background marks can be transformed in this
    // way, as they are just scale-invariant stroke lines. The foreground marks
    // are circular handles that shouldn't scale.
    const commands = this.transforms.map(transform => transform.state.command).join(' ');
    this.staticBackgroundMarkGroup.setAttributeNS(null, 'transform', commands);

    this.centeredForegroundMarkGroup.setAttributeNS(null, 'transform', `translate(${this.state.centroid[0]}, ${-this.state.centroid[1]})`);

    for (let transform of this.transforms) {
      transform.synchronizeMarkDom(bounds, handleRadius, radialLength);
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

  validateProperties(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('size');
    this.assertProperty('position');
    this.assertProperty('color');

    // Assert types of extent properties.
    this.assertScalarType('size', [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('position', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('anchor', 2, [ExpressionString]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('size', fromTime, toTime);
    this.assertCompleteTimeline('position', fromTime, toTime);
    this.assertCompleteTimeline('color', fromTime, toTime);
    this.assertCompleteTimeline('opacity', fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
  }

  initializeStaticState() {
    this.initializeStaticScalarProperty('size');
    this.initializeStaticVectorProperty('position');
    this.initializeStaticVectorProperty('color');
    this.initializeStaticScalarProperty('opacity');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('size');
    this.initializeDynamicProperty('position');
    this.initializeDynamicProperty('color');
    this.initializeDynamicProperty('opacity');
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'text');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.connectToParent(root);

    this.element.appendChild(document.createTextNode('...'));
    this.element.childNodes[0].nodeValue = this.getStatic('message').value;

    let anchor = ['middle', 'center'];
    if (this.hasStatic('anchor')) {
      anchor[0] = this.getStatic('anchor').get(0).value;
      if (anchor[0] === 'west') {
        anchor[0] = 'start';
      } else if (anchor[0] === 'center') {
        anchor[0] = 'middle';
      } else if (anchor[0] === 'east') {
        anchor[0] = 'end';
      }

      anchor[1] = this.getStatic('anchor').get(1).value;
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

  synchronizeState(t) {
    super.synchronizeState(t);
    this.synchronizeStateProperty('size', t);
    this.synchronizeStateProperty('position', t);
    this.synchronizeStateProperty('color', t);
    this.synchronizeStateProperty('opacity', t);

    this.state.colorBytes = [
      Math.floor(this.state.color[0] * 255),
      Math.floor(this.state.color[1] * 255),
      Math.floor(this.state.color[2] * 255),
    ];
  }

  synchronizeDom(t, bounds) {
    super.synchronizeDom(t, bounds);
    this.element.setAttributeNS(null, 'x', this.state.position[0]);
    this.element.setAttributeNS(null, 'y', bounds.span - this.state.position[1]);

    this.element.setAttributeNS(null, 'font-size', this.state.size);

    const rgb = `rgb(${this.state.colorBytes[0]}, ${this.state.colorBytes[1]}, ${this.state.colorBytes[2]})`;
    this.element.setAttributeNS(null, 'fill', rgb);

    if (this.has('opacity')) {
      this.element.setAttributeNS(null, 'fill-opacity', this.state.opacity);
    }
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.outlineMark = new RectangleMark();
    this.positionMark = new VectorPanMark(this, null, value => {
      this.state.position = value;
    });
    this.markers[0].setMarks(this.positionMark, this.outlineMark);
  }

  synchronizeMarkExpressions(t) {
    super.synchronizeMarkExpressions(t);
    this.positionMark.synchronizeExpressions(this.expressionAt('position', t));
  }

  synchronizeMarkState(t, bounds) {
    super.synchronizeMarkState(t);
    this.positionMark.synchronizeState(this.state.position, this.state.matrix, this.state.inverseMatrix);

    const box = this.element.getBBox();
    this.state.centroid = this.state.matrix.multiplyPosition([
      box.x + box.width * 0.5,
      bounds.span - box.y - box.height + box.height * 0.5,
    ]);

    this.boundingBox = BoundingBox.fromCornerSize([box.x, bounds.span - box.y], [box.width, box.height]);
    this.outlineMark.synchronizeState([box.x, bounds.span - box.y - box.height], [box.width, box.height], 0);
  }
 
  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    this.outlineMark.synchronizeDom(bounds);
    this.positionMark.synchronizeDom(bounds, handleRadius);
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
    this.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('size', fromTime, toTime);
    this.assertCompleteTimeline('center', fromTime, toTime);
    this.assertCompleteTimeline('corner', fromTime, toTime);
    this.assertCompleteTimeline('rounding', fromTime, toTime);
    this.assertCompleteTimeline('color', fromTime, toTime);
    this.assertCompleteTimeline('opacity', fromTime, toTime);

    this.stroke?.validate(fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.stroke?.initializeState();
    this.hasCenter = this.has('center');
  }

  initializeStaticState() {
    this.initializeStaticScalarProperty('rounding');
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
    this.connectToParent(root);
  }

  initializeMarkState() {
    super.initializeMarkState();

    this.outlineMark = new RectangleMark();

    // If the rectangle is positioned by its center rather than its corner,
    // then the marks behave a bit differently. The computed corner must be
    // updated. The size must be halved when treated like a radius.
    if (this.hasCenter) {
      this.positionMark = new VectorPanMark(this, null, position => {
        this.state.center = position;
        this.state.corner[0] = position[0] - this.state.size[0] * 0.5;
        this.state.corner[1] = position[1] - this.state.size[1] * 0.5;
      });
      this.widthMark = new HorizontalPanMark(this, null, 2, value => {
        this.state.size[0] = value;
        this.state.corner[0] = this.state.center[0] - value * 0.5;
      });
      this.heightMark = new VerticalPanMark(this, null, 2, value => {
        this.state.size[1] = value;
        this.state.corner[1] = this.state.center[1] - value * 0.5;
      });
    } else {
      this.positionMark = new VectorPanMark(this, null, position => {
        this.state.corner = position;
      });
      this.widthMark = new HorizontalPanMark(this, null, 1, value => this.state.size[0] = value);
      this.heightMark = new VerticalPanMark(this, null, 1, value => this.state.size[1] = value);
    }

    this.markers[0].setMarks(this.positionMark, this.widthMark, this.heightMark, this.outlineMark);
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
      this.positionMark.synchronizeState(this.state.center, this.state.matrix, this.state.inverseMatrix);
      this.widthMark.synchronizeState([
        this.state.center[0] + 0.5 * this.state.size[0],
        this.state.center[1],
      ], this.state.matrix);
      this.heightMark.synchronizeState([
        this.state.center[0],
        this.state.center[1] + 0.5 * this.state.size[1],
      ], this.state.matrix);
    } else {
      this.positionMark.synchronizeState(this.state.corner, this.state.matrix, this.state.inverseMatrix);
      this.widthMark.synchronizeState([
        this.state.corner[0] + this.state.size[0],
        this.state.corner[1],
      ], this.state.matrix, this.state.inverseMatrix);
      this.heightMark.synchronizeState([
        this.state.corner[0],
        this.state.corner[1] + this.state.size[1],
      ], this.state.matrix, this.state.inverseMatrix);
    }

    this.state.centroid = [
      this.state.corner[0] + this.state.size[0] * 0.5,
      this.state.corner[1] + this.state.size[1] * 0.5,
    ];
    this.state.centroid = this.state.matrix.multiplyPosition(this.state.centroid);
    this.boundingBox = BoundingBox.fromCornerSize(this.state.corner, this.state.size);
  }
 
  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    this.outlineMark.synchronizeDom(bounds);
    this.positionMark.synchronizeDom(bounds, handleRadius);
    this.widthMark.synchronizeDom(bounds, handleRadius);
    this.heightMark.synchronizeDom(bounds, handleRadius);
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

    if (this.has('opacity')) {
      this.element.setAttributeNS(null, 'fill-opacity', this.state.opacity);
    }

    this.stroke?.synchronizeDom(t, this.element);
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
    this.connectToParent(root);
  }

  initializeMarkState() {
    super.initializeMarkState();

    this.outlineMark = new CircleMark();
    this.centerMark = new VectorPanMark(this, null, value => this.state.center = value);
    this.radiusMark = new HorizontalPanMark(this, null, 1, value => this.state.radius = value);
    this.markers[0].setMarks(this.centerMark, this.radiusMark, this.outlineMark);
  }

  synchronizeMarkExpressions(t) {
    super.synchronizeMarkExpressions(t);
    this.centerMark.synchronizeExpressions(this.expressionAt('center', t));
    this.radiusMark.synchronizeExpressions(this.expressionAt('radius', t));
  }

  synchronizeMarkState(t) {
    super.synchronizeMarkState(t);
    this.outlineMark.synchronizeState(this.state.center, this.state.radius);
    this.centerMark.synchronizeState(this.state.center, this.state.matrix, this.state.inverseMatrix);
    this.radiusMark.synchronizeState([
      this.state.center[0] + this.state.radius,
      this.state.center[1],
    ], this.state.matrix, this.state.inverseMatrix);

    this.state.centroid = this.state.matrix.multiplyPosition(this.state.center);
    this.boundingBox = BoundingBox.fromCenterRadius(this.state.center, this.state.radius);
  }
 
  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    this.outlineMark.synchronizeDom(bounds);
    this.centerMark.synchronizeDom(bounds, handleRadius);
    this.radiusMark.synchronizeDom(bounds, handleRadius);
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

    if (this.has('opacity')) {
      this.element.setAttributeNS(null, 'fill-opacity', this.state.opacity);
    }

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
    this.bindStatic('stroke', new FunctionDefinition('stroke', [], new ExpressionStroke(this)));
    const stroke = new StrokeFrame.create(this, null);
    this.stroke.bindStatic('color', new ExpressionVector([
      new ExpressionReal(0.75),
      new ExpressionReal(0.75),
      new ExpressionReal(0.75)
    ]));
    this.stroke.bindStatic('size', new ExpressionReal(1));
    this.stroke.bindStatic('opacity', new ExpressionReal(1));
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

  validateProperties(fromTime, toTime) {
    if ((this.has('corner') || this.has('center')) && !this.has('size')) {
      this.assertProperty('size');
    } else if (!(this.has('corner') || this.has('center')) && this.has('size')) {
      throw new LocatedException(this.where, "I found a grid whose position I couldn't figure out. Define either its <code>corner</code> or <code>center</code>.");
    }

    this.assertVectorType('corner', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('center', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('ticks', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('size', 2, [ExpressionInteger, ExpressionReal]);

    this.assertCompleteTimeline('center', fromTime, toTime);
    this.assertCompleteTimeline('corner', fromTime, toTime);
    this.assertCompleteTimeline('ticks', fromTime, toTime);
    this.assertCompleteTimeline('size', fromTime, toTime);

    this.stroke?.validate(fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.stroke.initializeState();
    this.hasCenter = this.has('center');
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('center');
    this.initializeStaticVectorProperty('corner');
    this.initializeStaticVectorProperty('ticks');
    this.initializeStaticVectorProperty('size');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('center');
    this.initializeDynamicProperty('corner');
    this.initializeDynamicProperty('ticks');
    this.initializeDynamicProperty('size');
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'g');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.element.setAttributeNS(null, 'fill', 'none');
    this.connectToParent(root);
  }

  initializeMarkState() {
    super.initializeMarkState();

    this.outlineMark = new RectangleMark();

    if (this.hasCenter) {
      this.positionMark = new VectorPanMark(this, null, position => {
        this.state.center = position;
        this.state.corner[0] = position[0] - this.state.size[0] * 0.5;
        this.state.corner[1] = position[1] - this.state.size[1] * 0.5;
      });
      this.widthMark = new HorizontalPanMark(this, null, 2, value => {
        this.state.size[0] = value;
        this.state.corner[0] = this.state.center[0] - value * 0.5;
      });
      this.heightMark = new VerticalPanMark(this, null, 2, value => {
        this.state.size[1] = value;
        this.state.corner[1] = this.state.center[1] - value * 0.5;
      });
      this.markers[0].setMarks(this.positionMark, this.widthMark, this.heightMark, this.outlineMark);
    } else if (this.has('corner')) {
      this.positionMark = new VectorPanMark(this, null, position => {
        this.state.corner = position;
      });
      this.widthMark = new HorizontalPanMark(this, null, 1, value => this.state.size[0] = value);
      this.heightMark = new VerticalPanMark(this, null, 1, value => this.state.size[1] = value);
      this.markers[0].setMarks(this.positionMark, this.widthMark, this.heightMark, this.outlineMark);
    } else {
      this.markers[0].setMarks(this.outlineMark);
    }
  }

  synchronizeMarkExpressions(t) {
    super.synchronizeMarkExpressions(t);
    if (this.has('center')) {
      this.positionMark.synchronizeExpressions(this.expressionAt('center', t));
    } else if (this.has('corner')) {
      this.positionMark.synchronizeExpressions(this.expressionAt('corner', t));
    }
    if (this.has('center') || this.has('corner')) {
      this.widthMark.synchronizeExpressions(this.expressionAt('size', t).get(0));
      this.heightMark.synchronizeExpressions(this.expressionAt('size', t).get(1));
    }
  }

  synchronizeMarkState(t, bounds) {
    super.synchronizeMarkState(t);

    if (this.has('center')) {
      this.positionMark.synchronizeState(this.state.center, this.state.matrix, this.state.inverseMatrix);
      this.widthMark.synchronizeState([
        this.state.center[0] + 0.5 * this.state.size[0],
        this.state.center[1],
      ], this.state.matrix);
      this.heightMark.synchronizeState([
        this.state.center[0],
        this.state.center[1] + 0.5 * this.state.size[1],
      ], this.state.matrix);
    } else if (this.has('corner')) {
      this.positionMark.synchronizeState(this.state.corner, this.state.matrix, this.state.inverseMatrix);
      this.widthMark.synchronizeState([
        this.state.corner[0] + this.state.size[0],
        this.state.corner[1],
      ], this.state.matrix, this.state.inverseMatrix);
      this.heightMark.synchronizeState([
        this.state.corner[0],
        this.state.corner[1] + this.state.size[1],
      ], this.state.matrix, this.state.inverseMatrix);
    }

    if (this.has('center') || this.has('corner')) {
      this.outlineMark.synchronizeState(this.state.corner, this.state.size, 0);
      this.state.centroid = [
        this.state.corner[0] + this.state.size[0] * 0.5,
        this.state.corner[1] + this.state.size[1] * 0.5,
      ];
      this.state.centroid = this.state.matrix.multiplyPosition(this.state.centroid);
      this.boundingBox = BoundingBox.fromCornerSize(this.state.corner, this.state.size);
    } else {
      this.outlineMark.synchronizeState([bounds.x, bounds.y], [bounds.width, bounds.height], 0);
      this.state.centroid = [
        bounds.x + 0.5 * bounds.width,
        bounds.y + 0.5 * bounds.height
      ];
      this.boundingBox = BoundingBox.fromCornerSize([bounds.x, bounds.y], [bounds.width, bounds.height]);
    }
  }
 
  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    this.outlineMark.synchronizeDom(bounds);
    if (this.has('center') || this.has('corner')) {
      this.positionMark.synchronizeDom(bounds, handleRadius);
      this.widthMark.synchronizeDom(bounds, handleRadius);
      this.heightMark.synchronizeDom(bounds, handleRadius);
    }
  }

  synchronizeState(t) {
    super.synchronizeState(t);

    this.synchronizeStateProperty('size', t);
    this.synchronizeStateProperty('ticks', t);
    this.synchronizeStateProperty('center', t);
    this.synchronizeStateProperty('corner', t);

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
    this.stroke?.synchronizeDom(t, this.element);

    const ticks = this.state.ticks ?? [1, 1];
    const size = this.state.size ?? [bounds.width, bounds.height];
    const corner = this.state.corner ?? [bounds.x, bounds.y];

    clearChildren(this.element);

    if (ticks[0] > 0) {
      const gap = ticks[0];
      const first = Math.ceil(corner[0] / gap) * gap;
      const last = corner[0] + size[0];
      for (let tick = first; tick <= last; tick += gap) {
        const line = document.createElementNS(svgNamespace, 'line');
        line.setAttributeNS(null, 'visibility', 'visible');
        line.setAttributeNS(null, 'x1', tick);
        line.setAttributeNS(null, 'x2', tick);
        line.setAttributeNS(null, 'y1', bounds.span - corner[1]);
        line.setAttributeNS(null, 'y2', bounds.span - (corner[1] + size[1]));
        line.classList.add('grid-line');
        this.element.appendChild(line);
      }
    }

    if (ticks[1] > 0) {
      const gap = ticks[1];
      const first = Math.ceil(corner[1] / gap) * gap;
      const last = corner[1] + size[1];
      for (let tick = first; tick <= last; tick += gap) {
        const line = document.createElementNS(svgNamespace, 'line');
        line.setAttributeNS(null, 'visibility', 'visible');
        line.setAttributeNS(null, 'y1', bounds.span - tick);
        line.setAttributeNS(null, 'y2', bounds.span - tick);
        line.setAttributeNS(null, 'x1', corner[0]);
        line.setAttributeNS(null, 'x2', corner[0] + size[0]);
        line.classList.add('grid-line');
        this.element.appendChild(line);
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

  castCursorIntoComponents(column, row) {
    for (let node of this.nodes) {
      if (node.castCursor(column, row)) {
        return node;
      }
    }

    for (let mirror of this.mirrors) {
      if (mirror.castCursor(column, row)) {
        return mirror;
      }
    }

    return super.castCursorIntoComponents(column, row);
  }

  addMirror(mirror) {
    this.mirrors.push(mirror);
  }

  validate(fromTime, toTime) {
    super.validate(fromTime, toTime);
    for (let node of this.nodes) {
      node.validate(fromTime, toTime);
    }
    for (let mirror of this.mirrors) {
      mirror.validate(fromTime, toTime);
    }

    // If we have a tab node, it must be followed by node that produces a
    // straight line.
    for (let [i, node] of this.nodes.entries()) {
      if (node instanceof TabNode) {
        if (i === this.nodes.length - 1) {
          throw new LocatedException(node.where, `I found ${node.article} <code>${node.type}</code> node at the end of a sequence. It must be followed by a node that produces a straight line.`);
        } else {
          const nextNode = this.nodes[i + 1];
          if (!(nextNode instanceof VertexNode ||
                nextNode instanceof WalkNode ||
                nextNode instanceof BackNode ||
                nextNode instanceof LineNode)) {
            throw new LocatedException(node.where, `I found ${node.article} <code>${node.type}</code> node that was followed by ${nextNode.article} <code>${nextNode.type}</code> node. It must be followed by a node that produces a straight line, like <code>vertex</code>, <code>walk</code>, <code>line</code>, or <code>back</code>.`);
          }
        }
      }
    }
  }

  connectJoins() {
    // if (this.owns('elbow')) {
      // let elbow = this.get('elbow');
      // this.element.setAttributeNS(null, 'marker-mid', 'url(#element-' + elbow.id + ')');
      // this.element.setAttributeNS(null, 'marker-start', 'url(#element-' + elbow.id + ')');
      // this.element.setAttributeNS(null, 'marker-end', 'url(#element-' + elbow.id + ')');
    // }

    // if (this.owns('head')) {
      // let head = this.get('head');
      // this.element.setAttributeNS(null, 'marker-end', 'url(#element-' + head.id + ')');
    // }

    // if (this.owns('tail')) {
      // let tail = this.get('tail');
      // this.element.setAttributeNS(null, 'marker-start', 'url(#element-' + tail.id + ')');
    // }
  }

  initializeState() {
    super.initializeState();

    this.state.tabDefaults = {size: 1, degrees: 45, inset: 0, isCounterclockwise: true};
    this.state.turtle0 = null;

    let previousNode = null;
    for (let [i, node] of this.nodes.entries()) {
      node.initializeState(this.nodes[0], previousNode, i + 1 < this.nodes.length ? this.nodes[i + 1] : null);
      previousNode = node;
    }

    for (let mirror of this.mirrors) {
      mirror.initializeState();
    }
  }

  synchronizeState(t) {
    super.synchronizeState(t);
    for (let node of this.nodes) {
      node.synchronizeState(t);
    }
    for (let mirror of this.mirrors) {
      mirror.synchronizeState(t);
    }
  }

  initializeMarkState() {
    super.initializeMarkState();
    for (let node of this.nodes) {
      node.initializeMarkState();
    }
    for (let mirror of this.mirrors) {
      mirror.initializeMarkState();
    }
  }

  synchronizeMarkState(t) {
    super.synchronizeMarkState(t);
    for (let node of this.nodes) {
      node.synchronizeMarkState(this.state.matrix, this.state.inverseMatrix);
    }
    for (let mirror of this.mirrors) {
      mirror.synchronizeMarkState(this.state.matrix, this.state.inverseMatrix);
    }
  }

  synchronizeMarkExpressions(t) {
    super.synchronizeMarkExpressions(t);
    for (let node of this.nodes) {
      node.synchronizeMarkExpressions(t);
    }
    for (let mirror of this.mirrors) {
      mirror.synchronizeMarkExpressions(t);
    }
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    for (let node of this.nodes) {
      node.synchronizeMarkDom(bounds, handleRadius, radialLength);
    }
    for (let mirror of this.mirrors) {
      mirror.synchronizeMarkDom(bounds, handleRadius, radialLength);
    }
  }
}

// --------------------------------------------------------------------------- 

export class VertexShape extends NodeShape {
  addNode(node) {
    this.nodes.push(node);
  }

  validate(fromTime, toTime) {
    if (this.nodes.length > 0) {
      const node = this.nodes[0];
      if (!(node instanceof VertexNode || node instanceof TurtleNode)) {
        throw new LocatedException(node.where, `I saw ${this.article} ${this.type} whose first step is <code>${node.type}</code>. ${sentenceCase(this.article)} ${this.type} must begin with <code>vertex</code> or <code>turtle</code>.`);
      }
    }
    super.validate(fromTime, toTime);
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

  synchronizeMarkState(t) {
    super.synchronizeMarkState(t);

    for (let node of this.domNodes) {
      this.boundingBox.enclosePoint(node.state.turtle.position);
    }
    this.state.centroid = this.state.matrix.multiplyPosition(this.boundingBox.centroid());
  }

  // computeBoundingBox() {
    // for (let node of this.domNodes) {
      // const position = node.turtle.position;
      // let transformedPosition = this.state.matrix.multiplyPosition(position);
      // this.boundingBox.enclosePoint(transformedPosition);
    // }

    // if (this.untimedProperties.hasOwnProperty('stroke')) {
      // if (this.untimedProperties.stroke.state.hasOwnProperty('size')) {
        // const halfStrokeSize = this.untimedProperties.stroke.state.size * 0.5;
        // this.boundingBox.thicken(halfStrokeSize);
      // }
    // } else if (this.timedProperties.hasOwnProperty('stroke')) {
      // this.boundingBox.thicken(this.state.size * 0.5);
    // }

    // TODO handle stroke
  // }
}

// --------------------------------------------------------------------------- 

export class Polygon extends VertexShape {
  static type = 'polygon';
  static article = 'a';
  static timedIds = ['color', 'opacity', 'enabled'];

  initialize(where) {
    super.initialize(where);
    this.bindStatic('tab', new FunctionDefinition('tab', [], new ExpressionTabNode(this)));
    this.bindStatic('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindStatic('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindStatic('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindStatic('walk', new FunctionDefinition('walk', [], new ExpressionWalkNode(this)));
    this.bindStatic('fly', new FunctionDefinition('fly', [], new ExpressionFlyNode(this)));
    this.bindStatic('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
    this.bindStatic('back', new FunctionDefinition('back', [], new ExpressionBackNode(this)));
    this.bindStatic('stroke', new FunctionDefinition('stroke', [], new ExpressionStroke(this)));
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

  validateProperties(fromTime, toTime) {
    this.assertProperty('color');

    this.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);

    this.assertCompleteTimeline('color', fromTime, toTime);
    this.assertCompleteTimeline('opacity', fromTime, toTime);

    this.stroke?.validate(fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.stroke?.initializeState();
    this.domNodes = this.nodes.filter(node => node.isDom); // TODO make domNodes part of state?
    if (this.domNodes.length > 0) {
      this.state.turtle0 = this.domNodes[0].turtle;
    }
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('color');
    this.initializeStaticScalarProperty('opacity');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('color');
    this.initializeDynamicProperty('opacity');
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'polygon');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.connectToParent(root);
  }

  synchronizeState(t) {
    super.synchronizeState(t);

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

    const rgb = `rgb(${this.state.colorBytes[0]}, ${this.state.colorBytes[1]}, ${this.state.colorBytes[2]})`;
    this.element.setAttributeNS(null, 'fill', rgb);

    if (this.has('opacity')) {
      this.element.setAttributeNS(null, 'fill-opacity', this.state.opacity);
    }

    this.stroke?.synchronizeDom(t, this.element);

    const positions = this.domNodes.flatMap((node, index) => {
      return node.getPositions(this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
    });
    this.mirrorPositions(positions);

    if (positions.length < 3) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> with ${positions.length} ${positions.length == 1 ? 'vertex' : 'vertices'}. Polygons must have at least 3 vertices.`);
    }

    const coordinates = positions.map(position => `${position[0]},${bounds.span - position[1]}`).join(' ');
    this.element.setAttributeNS(null, 'points', coordinates);
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.outlineMark = new PolygonMark();
    this.markers[0].setMarks(this.outlineMark);
  }

  synchronizeMarkState() {
    super.synchronizeMarkState();
    this.outlineMark.synchronizeState(this.domNodes.map(node => node.state.turtle.position));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    this.outlineMark.synchronizeDom(bounds);
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
    this.bindStatic('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindStatic('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindStatic('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindStatic('walk', new FunctionDefinition('walk', [], new ExpressionWalkNode(this)));
    // this.bindStatic('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
    // TODO no mirror support yet?
    this.bindStatic('back', new FunctionDefinition('back', [], new ExpressionBackNode(this)));
    this.bindStatic('stroke', new FunctionDefinition('stroke', [], new ExpressionStroke(this)));
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

  validateProperties(fromTime, toTime) {
    this.assertProperty('color');

    this.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);

    this.assertCompleteTimeline('color', fromTime, toTime);
    this.assertCompleteTimeline('opacity', fromTime, toTime);

    this.stroke?.validate(fromTime, toTime);

    const domNodes = this.nodes.filter(node => node.isDom);
    if (domNodes.length < 3) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> with ${domNodes.length} ${domNodes.length == 1 ? 'vertex' : 'vertices'}. Ungons must have at least 3 vertices.`);
    }

    if (this.has('formula')) {
      const formula = this.getStatic('formula').value;

      if (!(formula === UngonFormula.Absolute || formula === UngonFormula.Relative || formula === UngonFormula.Symmetric)) {
        throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> with a bad formula.`);
      }

      if (formula === UngonFormula.Symmetric) {
        this.assertScalarType('rounding', [ExpressionInteger, ExpressionReal]);
        this.assertCompleteTimeline('rounding', fromTime, toTime);
      }
    }
  }

  initializeState() {
    super.initializeState();
    this.stroke?.initializeState();
    this.domNodes = this.nodes.filter(node => node.isDom); // TODO make domNodes part of state?
    this.state.turtle0 = this.domNodes[0].turtle;

    if (!this.has('formula')) {
      this.state.formula = UngonFormula.Symmetric;
    }
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('color');
    this.initializeStaticScalarProperty('opacity');
    this.initializeStaticScalarProperty('formula');
    this.initializeStaticScalarProperty('rounding');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('color');
    this.initializeDynamicProperty('opacity');
    this.initializeDynamicProperty('rounding');
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'path');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.connectToParent(root);
  }

  synchronizeState(t) {
    super.synchronizeState(t);

    this.synchronizeStateProperty('color', t);
    this.synchronizeStateProperty('opacity', t);
    this.synchronizeStateProperty('rounding', t);

    this.state.colorBytes = [
      Math.floor(this.state.color[0] * 255),
      Math.floor(this.state.color[1] * 255),
      Math.floor(this.state.color[2] * 255),
    ];

    this.stroke?.synchronizeState(t);
  }

  synchronizeDom(t, bounds) {
    super.synchronizeDom(t, bounds);

    const rgb = `rgb(${this.state.colorBytes[0]}, ${this.state.colorBytes[1]}, ${this.state.colorBytes[2]})`;
    this.element.setAttributeNS(null, 'fill', rgb);

    if (this.has('opacity')) {
      this.element.setAttributeNS(null, 'fill-opacity', this.state.opacity);
    }

    this.stroke?.synchronizeDom(t, this.element);

    const gap = distancePointPoint(this.domNodes[0].state.turtle.position, this.domNodes[this.domNodes.length - 1].state.turtle.position);
    const hasReturn = gap < 1e-6;
    let nnodes = hasReturn ? this.domNodes.length - 1 : this.domNodes.length;
    let pathCommands = [];

    if (this.state.formula === UngonFormula.Symmetric) {
      let start = [
        (this.domNodes[0].state.turtle.position[0] + this.domNodes[1].state.turtle.position[0]) * 0.5,
        (this.domNodes[0].state.turtle.position[1] + this.domNodes[1].state.turtle.position[1]) * 0.5
      ];
      pathCommands.push(`M ${start[0]},${bounds.span - start[1]}`);

      let previous = start;
      for (let i = 1; i < nnodes; ++i) {
        const a = this.domNodes[i].state.turtle.position;
        const b = this.domNodes[(i + 1) % this.domNodes.length].state.turtle.position;
        let mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
        pathCommands.push(`Q ${a[0]},${bounds.span - a[1]} ${mid[0]},${bounds.span - mid[1]}`);
        previous = mid;
      }

      const first = this.domNodes[0].state.position;
      pathCommands.push(`Q ${first[0]},${bounds.span - first[1]} ${start[0]},${bounds.span - start[1]}`);
    } else if (this.state.formula === UngonFormula.Absolute) {
      let rounding = this.state.rounding;

      let vectors = this.domNodes.map((node, i) => {
        const a = node.state.turtle.position;
        const b = this.domNodes[(i + 1) % nnodes].state.turtle.position;

        let vector = [b[0] - a[0], b[1] - a[1]];
        let magnitude = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
        vector[0] /= magnitude;
        vector[1] /= magnitude;

        return vector;
      });

      let insetA = [
        this.domNodes[0].state.turtle.position[0] + rounding * vectors[0][0],
        this.domNodes[0].state.turtle.position[1] + rounding * vectors[0][1],
      ];
      pathCommands.push(`M ${insetA[0]},${bounds.span - insetA[1]}`);

      for (let i = 0; i < nnodes; ++i) {
        const position = this.domNodes[(i + 1) % nnodes].state.turtle.position;
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
        (this.domNodes[0].state.turtle.position[0] + this.domNodes[1].state.turtle.position[0]) * 0.5,
        (this.domNodes[0].state.turtle.position[1] + this.domNodes[1].state.turtle.position[1]) * 0.5
      ];
      pathCommands.push(`M ${start[0]},${bounds.span - start[1]}`);

      let rounding = 1 - this.state.rounding;

      let previous = start;
      for (let i = 1; i < nnodes; ++i) {
        const a = this.domNodes[i].state.turtle.position;
        const b = this.domNodes[(i + 1) % this.domNodes.length].state.turtle.position;

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
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.outlineMark = new PolygonMark();
    this.markers[0].setMarks(this.outlineMark);
  }

  synchronizeMarkState() {
    super.synchronizeMarkState();
    this.outlineMark.synchronizeState(this.domNodes.map(node => node.state.turtle.position));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    this.outlineMark.synchronizeDom(bounds);
  }
}

// --------------------------------------------------------------------------- 

export class Polyline extends VertexShape {
  static type = 'polyline';
  static article = 'a';
  static timedIds = ['size', 'color', 'opacity', 'join', 'enabled'];

  initialize(where) {
    super.initialize(where);
    this.bindStatic('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindStatic('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindStatic('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindStatic('walk', new FunctionDefinition('walk', [], new ExpressionWalkNode(this)));
    this.bindStatic('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
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

  validateProperties(fromTime, toTime) {
    this.assertProperty('color');

    this.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);

    this.assertCompleteTimeline('color', fromTime, toTime);
    this.assertCompleteTimeline('opacity', fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.domNodes = this.nodes.filter(node => node.isDom); // TODO make domNodes part of state?
    if (this.domNodes.length > 0) {
      this.state.turtle0 = this.domNodes[0].turtle;
    }
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('color');
    this.initializeStaticScalarProperty('opacity');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('color');
    this.initializeDynamicProperty('opacity');
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'polyline');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    // SVG polylines for some reason are filled black by default. We want true
    // polylines, which have no fill.
    this.element.setAttributeNS(null, 'fill', 'none');

    this.connectToParent(root);
  }

  synchronizeState(t) {
    super.synchronizeState(t);

    this.synchronizeStateProperty('color', t);
    this.synchronizeStateProperty('opacity', t);

    this.state.colorBytes = [
      Math.floor(this.state.color[0] * 255),
      Math.floor(this.state.color[1] * 255),
      Math.floor(this.state.color[2] * 255),
    ];
  }

  synchronizeDom(t, bounds) {
    super.synchronizeDom(t, bounds);

    const rgb = `rgb(${this.state.colorBytes[0]}, ${this.state.colorBytes[1]}, ${this.state.colorBytes[2]})`;
    this.element.setAttributeNS(null, 'stroke', rgb);

    const positions = this.domNodes.flatMap((node, index) => {
      return node.getPositions(this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
    });
    this.mirrorPositions(positions);

    if (positions.length < 2) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> with ${positions.length} ${positions.length == 1 ? 'vertex' : 'vertices'}. Polylines must have at least 2 vertices.`);
    }

    const coordinates = positions.map(position => `${position[0]},${bounds.span - position[1]}`).join(' ');
    this.element.setAttributeNS(null, 'points', coordinates);
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.outlineMark = new PolylineMark();
    this.markers[0].setMarks(this.outlineMark);
  }

  synchronizeMarkState() {
    super.synchronizeMarkState();
    this.outlineMark.synchronizeState(this.domNodes.map(node => node.state.turtle.position));
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    this.outlineMark.synchronizeDom(bounds);
  }
}

// --------------------------------------------------------------------------- 

export class Line extends VertexShape {
  static type = 'line';
  static article = 'a';
  static timedIds = ['size', 'color', 'opacity', 'enabled'];

  initialize(where) {
    super.initialize(where);
    this.bindStatic('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindStatic('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindStatic('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindStatic('walk', new FunctionDefinition('walk', [], new ExpressionWalkNode(this)));
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

  validateProperties(fromTime, toTime) {
    this.assertProperty('color');
    this.assertProperty('size');

    this.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('size', [ExpressionInteger, ExpressionReal]);

    this.assertCompleteTimeline('color', fromTime, toTime);
    this.assertCompleteTimeline('opacity', fromTime, toTime);
    this.assertCompleteTimeline('size', fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.domNodes = this.nodes.filter(node => node.isDom);
    if (this.domNodes.length > 0) {
      this.state.turtle0 = this.domNodes[0].turtle;
    }
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('color');
    this.initializeStaticScalarProperty('opacity');
    this.initializeStaticScalarProperty('size');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('color');
    this.initializeDynamicProperty('opacity');
    this.initializeDynamicProperty('size');
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'line');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.element.setAttributeNS(null, 'fill', 'none');
    this.connectToParent(root);
  }

  synchronizeState(t) {
    super.synchronizeState(t);

    this.synchronizeStateProperty('color', t);
    this.synchronizeStateProperty('opacity', t);
    this.synchronizeStateProperty('size', t);

    this.state.colorBytes = [
      Math.floor(this.state.color[0] * 255),
      Math.floor(this.state.color[1] * 255),
      Math.floor(this.state.color[2] * 255),
    ];
  }

  synchronizeDom(t, bounds) {
    super.synchronizeDom(t, bounds);

    const rgb = `rgb(${this.state.colorBytes[0]}, ${this.state.colorBytes[1]}, ${this.state.colorBytes[2]})`;
    this.element.setAttributeNS(null, 'stroke', rgb);
    this.element.setAttributeNS(null, 'stroke-width', this.state.size);

    const positions = this.domNodes.flatMap((node, index) => {
      return node.getPositions(this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
    });
    this.mirrorPositions(positions);

    if (positions.length !== 2) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> with ${positions.length} ${positions.length == 1 ? 'vertex' : 'vertices'}. Lines must have exactly 2 vertices.`);
    }

    const coordinates = positions.map(position => `${position[0]},${bounds.span - position[1]}`).join(' ');
    this.element.setAttributeNS(null, 'x1', positions[0][0]);
    this.element.setAttributeNS(null, 'y1', bounds.span - positions[0][1]);
    this.element.setAttributeNS(null, 'x2', positions[1][0]);
    this.element.setAttributeNS(null, 'y2', bounds.span - positions[1][1]);
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.outlineMark = new LineMark();
    this.markers[0].setMarks(this.outlineMark);
  }

  synchronizeMarkState() {
    super.synchronizeMarkState();
    this.outlineMark.synchronizeState(this.domNodes[0].state.turtle.position, this.domNodes[1].state.turtle.position);
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    this.outlineMark.synchronizeDom(bounds);
  }
}

// --------------------------------------------------------------------------- 

export class Path extends NodeShape {
  static type = 'path';
  static article = 'a';
  static timedIds = ['color', 'opacity', 'enabled'];

  initialize(where) {
    super.initialize(where);
    this.bindStatic('tab', new FunctionDefinition('tab', [], new ExpressionTabNode(this)));
    this.bindStatic('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindStatic('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindStatic('walk', new FunctionDefinition('walk', [], new ExpressionWalkNode(this)));
    this.bindStatic('fly', new FunctionDefinition('fly', [], new ExpressionFlyNode(this)));
    this.bindStatic('circle', new FunctionDefinition('circle', [], new ExpressionCircleNode(this)));
    this.bindStatic('rectangle', new FunctionDefinition('rectangle', [], new ExpressionRectangleNode(this)));
    this.bindStatic('go', new FunctionDefinition('go', [], new ExpressionGoNode(this)));
    this.bindStatic('back', new FunctionDefinition('back', [], new ExpressionBackNode(this)));
    this.bindStatic('line', new FunctionDefinition('line', [], new ExpressionLineNode(this)));
    this.bindStatic('quadratic', new FunctionDefinition('quadratic', [], new ExpressionQuadraticNode(this)));
    this.bindStatic('cubic', new FunctionDefinition('cubic', [], new ExpressionCubicNode(this)));
    this.bindStatic('arc', new FunctionDefinition('arc', [], new ExpressionArcNode(this)));
    this.bindStatic('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
    this.bindStatic('stroke', new FunctionDefinition('stroke', [], new ExpressionStroke(this)));
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
    this.nodes.push(node);
  }

  validateProperties(fromTime, toTime) {
    this.assertProperty('color');

    this.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);

    this.assertCompleteTimeline('color', fromTime, toTime);
    this.assertCompleteTimeline('opacity', fromTime, toTime);

    this.stroke?.validate(fromTime, toTime);

    const domNodes = this.nodes.filter(node => node.isDom);
    if (this.nodes.length > 0) {
      const node = this.nodes[0];
      if (!(node instanceof GoNode || node instanceof TurtleNode || node instanceof CircleNode || node instanceof RectangleNode)) {
        throw new LocatedException(node.where, `I saw ${this.article} ${this.type} whose first step is <code>${node.type}</code>. A path must begin with <code>go</code>, <code>turtle</code>, <code>rectangle</code>, or <code>circle</code>.`);
      }
    }
  }

  initializeState() {
    super.initializeState();
    this.stroke?.initializeState();
    this.domNodes = this.nodes.filter(node => node.isDom);
    if (this.domNodes.length > 0) {
      this.state.turtle0 = this.domNodes[0].turtle;
    }
  }

  initializeStaticState() {
    this.initializeStaticVectorProperty('color');
    this.initializeStaticScalarProperty('opacity');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('color');
    this.initializeDynamicProperty('opacity');
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'path');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    // this.element.setAttributeNS(null, 'stroke-linecap', 'round');
    this.element.setAttributeNS(null, 'fill-rule', 'evenodd');
    this.connectToParent(root);
  }

  synchronizeState(t) {
    super.synchronizeState(t);

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

    const rgb = `rgb(${this.state.colorBytes[0]}, ${this.state.colorBytes[1]}, ${this.state.colorBytes[2]})`;
    this.element.setAttributeNS(null, 'fill', rgb);

    if (this.has('opacity')) {
      this.element.setAttributeNS(null, 'fill-opacity', this.state.opacity);
    }

    this.stroke?.synchronizeDom(t, this.element);

    const pathCommands = this.domNodes.map((node, index) => {
      return node.pathCommand(bounds, this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
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
  }

  initializeMarkState() {
    super.initializeMarkState();
    this.outlineMark = new PathMark();
    this.markers[0].setMarks(this.outlineMark);
  }

  synchronizeMarkState() {
    super.synchronizeMarkState();
    // const commands = this.domNodes.map(node => node.pathCommand);
    // this.outlineMark.synchronizeState(commands.join(' '));

    const sum = this.domNodes.reduce((acc, node) => [acc[0] + node.state.turtle.position[0], acc[1] + node.state.turtle.position[1]], [0, 0]);
    this.state.centroid = sum.map(value => value / this.domNodes.length);
    // TODO
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    this.outlineMark.synchronizeDom(bounds);
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

  deflateReferent() {
    const object = super.deflateReferent();
    object.children = this.children.map(child => child.deflateReferent());
    return object;
  }

  embody(object, inflater) {
    super.embody(object, inflater);
    this.children = [];
    object.children.map(subobject => Shape.inflate(this, subobject));
  }

  // TODO cast cursor into children?
  validate(fromTime, toTime) {
    super.validate(fromTime, toTime);
    for (let child of this.children) {
      child.validate(fromTime, toTime);
    }
  }

  validateProperties(fromTime, toTime) {
    for (let child of this.children) {
      child.validateProperties(fromTime, toTime);
    }
  }

  initializeState() {
    super.initializeState();
    for (let child of this.children) {
      child.initializeState();
    }
  }

  initializeStaticState() {
  }

  initializeDynamicState() {
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'g');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.connectToParent(root);

    for (let child of this.children) {
      child.initializeDom(root);
    }
  }

  synchronizeState(t) {
    super.synchronizeState(t);
    for (let child of this.children) {
      child.synchronizeState(t);
    }
  }

  synchronizeDom(t, bounds) {
    super.synchronizeDom(t);
    for (let child of this.children) {
      child.synchronizeDom(t, bounds);
    }
  }

  initializeMarkState() {
    super.initializeMarkState();
    // this.outlineMark = new RectangleMark();
    this.markers[0].setMarks();

    for (let child of this.children) {
      child.initializeMarkState();
    }
  }

  initializeMarkDom(root) {
    super.initializeMarkDom(root);
    for (let child of this.children) {
      child.initializeMarkDom(root);
    }
  }

  synchronizeMarkState(t) {
    super.synchronizeMarkState(t);

    for (let child of this.children) {
      child.synchronizeMarkState(t);
    }

    for (let child of this.children) {
      this.boundingBox.encloseBox(child.boundingBox);
    }

    this.state.centroid = this.state.matrix.multiplyPosition(this.boundingBox.centroid());
  }

  synchronizeMarkExpressions(t) {
    super.synchronizeMarkExpressions(t);
    for (let child of this.children) {
      child.synchronizeMarkExpressions(t);
    }
  }
 
  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    // this.outlineMark.synchronizeDom(bounds);
    for (let child of this.children) {
      child.synchronizeMarkDom(bounds, handleRadius, radialLength);
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

