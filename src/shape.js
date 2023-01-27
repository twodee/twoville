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

import {
  ObjectFrame,
  StrokeFrame,
} from './frame.js';

import {
  halfwayVector,
  isLeftPolygon,
  isLeftTurn,
  mirrorPointLine,
  distancePointPoint,
  distancePointLine,
  unitVectorBetween,
} from './math.js';

import {
  CircleMark,
  HorizontalPanMark,
  LineMark,
  Marker,
  NumberedDotsMark,
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
  PushNode,
  PopNode,
  LineNode,
  TurtleNode,
  VertexNode,
} from './node.js';

import {
  Expression,
  ExpressionOrbitNode,
  ExpressionBumpNode,
  ExpressionCurlNode,
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
  ExpressionPopNode,
  ExpressionPushNode,
  ExpressionQuadraticNode,
  ExpressionReal,
  ExpressionRectangleNode,
  ExpressionString,
  ExpressionTile,
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
 * In the source code, the first transform added to the shape is the first one to
 * be applied. The last transform is the last to be applied. These are stored in
 * the transforms property of a shape from last-applied to first-applied. This
 * order matches the order expected in the SVG transform attribute.
 * 
 * For example, consider this rectangle:
 * 
 *   rectangle
 *     // ...
 *     translate
 *       offset = [5, 6]
 *     rotate
 *       degrees = 45
 *       pivot = :zero
 * 
 * The transforms property will look like this:
 * 
 *   [rotate(45, :zero), translate(5, 6)]
 * 
*/

/*
 * Lifecycle.
 *
 * synchronizeCustomState: implemented by all concrete shapes to update
 * shape-specific properties and compute an untransformed bounding box and
 * centroid.
 */

export class Shape extends ObjectFrame {
  initialize(where) {
    super.initialize(null, where);

    this.sourceSpans = [];
    this.transforms = [];

    this.bindStatic('display', new ExpressionBoolean(true));
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

  initializeStaticState() {
    this.initializeStaticScalarProperty('display');
  }

  initializeDynamicState() {
    this.state.animation = {};
    this.initializeDynamicProperty('display');
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('display', t);
    if (this.state.display) {
      this.synchronizeCustomState(t);

      // Walk the matrix gauntlet and apply the transforms to the bounding box.
      // Go from right to left since last transform is applied first.
      let forward = Matrix.identity();
      for (let i = this.transforms.length - 1; i >= 0; --i) {
        let transform = this.transforms[i];
        transform.synchronizeState(t);
        let matrix = transform.toMatrix();

        // Update centroid and bounding box.
        this.state.centroid = matrix.multiplyPosition(this.state.centroid);
        this.boundingBox.transform(matrix);

        // Accumulate matrix onto its rightward predecessors.
        forward = matrix.multiplyMatrix(forward);
      }

      let backward = Matrix.identity();
      let after = Matrix.identity();
      this.afterMatrices = [after];
      for (let i = 0; i < this.transforms.length - 1; ++i) {
        let transform = this.transforms[i];

        let inverseMatrix = transform.toInverseMatrix();
        backward = backward.multiplyMatrix(inverseMatrix);
   
        let matrix = transform.toMatrix();
        after = after.multiplyMatrix(matrix);
        this.afterMatrices.push(after);
      }

      this.state.matrix = forward;
      this.state.inverseMatrix = backward;
    }

    /*
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
    */
  }

  synchronizeDom(t, bounds) {
    if (this.state.display) {
      this.element.setAttributeNS(null, 'visibility', 'visible');

      for (let transform of this.transforms) {
        transform.synchronizeDom(t, bounds);
      }

      const commands = this.transforms.map(transform => transform.state.command).join(' ');
      this.element.setAttributeNS(null, 'transform', commands);
      this.synchronizeCustomDom(t, bounds);
    } else {
      this.element.setAttributeNS(null, 'visibility', 'hidden');
    }
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
      marker.hide();
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

      // This is not conditional. After a tweak, we need to reestablish that
      // this is the hovered shape with the root.
      root.mouseEnter(this);

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

      if (this.isMouseExit(event)) {
        root.mouseExit();
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

      if (this.isMouseExit(event)) {
        root.mouseExit();
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
    const element = event.toElement;
    const isStillShape = element &&
      (element.classList.contains(`tag-${this.id}`) ||
       element.classList.contains('canvas-context-menu-item'));
    return !this.isSelected && !isStillShape;
  }

  isMouseExit(event) {
    const element = event.toElement;
    const isStillShape = element &&
      (element.classList.contains(`tag-${this.id}`) ||
       element.classList.contains('canvas-context-menu-item'));
    return !isStillShape;
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

  synchronizeMarkState(t) {
    for (let i = 0; i < this.transforms.length; i += 1) {
      const ii = this.transforms.length - 1 - i;
      const m = this.afterMatrices[ii];
      this.transforms[ii].synchronizeMarkState(t, m, m.inverse());
    }
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

  validateFillProperties(fromTime, toTime) {
    this.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);

    // If the opacity of the shape is a constant 0, then color is optional.
    // this.hasFill = (this.hasDynamic('opacity') || !this.hasStatic('opacity') || this.getStatic('opacity').value !== 0) && !this.strokeFrame;
    this.hasFill = !this.strokeFrame || this.has('color'); 
    if (!this.strokeFrame) {
      this.assertProperty('color');
    }

    this.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);
    this.assertCompleteTimeline('color', fromTime, toTime);
    this.assertCompleteTimeline('opacity', fromTime, toTime);
  }

  validateStrokeProperties(fromTime, toTime) {
    this.assertProperty('color');

    this.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);

    this.assertCompleteTimeline('color', fromTime, toTime);
    this.assertCompleteTimeline('opacity', fromTime, toTime);

    // size?
  }

  initializeStaticColorState() {
    this.initializeStaticVectorProperty('color');
    this.initializeStaticScalarProperty('opacity');
  }

  initializeDynamicColorState() {
    this.initializeDynamicProperty('color');
    this.initializeDynamicProperty('opacity');
  }

  synchronizeColorState(t) {
    this.synchronizeStateProperty('color', t);
    this.synchronizeStateProperty('opacity', t);

    if (this.has('color')) {
      this.state.colorBytes = [
        Math.floor(this.state.color[0] * 255),
        Math.floor(this.state.color[1] * 255),
        Math.floor(this.state.color[2] * 255),
      ];
    }
  }

  synchronizeFillDom(t, bounds) {
    if (this.hasFill) {
      const rgb = `rgb(${this.state.colorBytes[0]}, ${this.state.colorBytes[1]}, ${this.state.colorBytes[2]})`;
      this.element.setAttributeNS(null, 'fill', rgb);
    } else {
      this.element.setAttributeNS(null, 'fill', 'none');
    }

    if (this.has('opacity')) {
      this.element.setAttributeNS(null, 'fill-opacity', this.state.opacity);
    }
  }

  validateStrokeProperties(fromTime, toTime) {
    if (!this.strokeFrame) return;

    // Assert required properties.
    this.strokeFrame.assertProperty('color');
    this.strokeFrame.assertProperty('weight');

    this.strokeFrame.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);
    this.strokeFrame.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);
    this.strokeFrame.assertScalarType('weight', [ExpressionInteger, ExpressionReal]);
    // TODO: assert join is round, miter, or bevel

    this.strokeFrame.assertCompleteTimeline('color', fromTime, toTime);
    this.strokeFrame.assertCompleteTimeline('opacity', fromTime, toTime);
    this.strokeFrame.assertCompleteTimeline('weight', fromTime, toTime);
  }

  initializeStaticStrokeState() {
    if (!this.strokeFrame) return;

    if (!this.strokeFrame.hasOwnProperty('state')) {
      this.strokeFrame.state = {};
    }

    if (this.strokeFrame.hasStatic('color')) {
      this.strokeFrame.state.color = this.strokeFrame.getStatic('color').toPrimitiveArray();
    }

    if (this.strokeFrame.hasStatic('opacity')) {
      this.strokeFrame.state.opacity = this.strokeFrame.getStatic('opacity').value;
    }

    if (this.strokeFrame.hasStatic('weight')) {
      this.strokeFrame.state.weight = this.strokeFrame.getStatic('weight').value;
    }

    if (this.strokeFrame.hasStatic('join')) {
      this.strokeFrame.state.join = this.strokeFrame.getStatic('join').value;
    } else {
      this.strokeFrame.state.join = 'miter';
    }

    if (this.strokeFrame.hasStatic('cap')) {
      this.strokeFrame.state.cap = this.strokeFrame.getStatic('cap').value;
    } else {
      this.strokeFrame.state.cap = 'butt';
    }

    if (this.strokeFrame.hasStatic('dashes')) {
      this.strokeFrame.state.dashes = this.strokeFrame.getStatic('dashes').toSpacedString();
    } else {
      this.strokeFrame.state.dashes = 'none';
    }
  }

  initializeDynamicStrokeState() {
    if (!this.strokeFrame) return;

    if (!this.strokeFrame.state.hasOwnProperty('animation')) {
      this.strokeFrame.state.animation = {};
    }

    if (this.strokeFrame.hasDynamic('color')) {
      const timeline = this.strokeFrame.getDynamic('color');
      this.strokeFrame.state.animation.color = {
        animators: timeline.intervals.map(interval => interval.toAnimator()),
        defaultValue: this.strokeFrame.state.color,
      };
    }

    if (this.strokeFrame.hasDynamic('opacity')) {
      const timeline = this.strokeFrame.getDynamic('opacity');
      this.strokeFrame.state.animation.opacity = {
        animators: timeline.intervals.map(interval => interval.toAnimator()),
        defaultValue: this.state.opacity,
      };
    }

    if (this.strokeFrame.hasDynamic('weight')) {
      const timeline = this.strokeFrame.getDynamic('weight');
      this.strokeFrame.state.animation.weight = {
        animators: timeline.intervals.map(interval => interval.toAnimator()),
        defaultValue: this.state.weight,
      };
    }
  }

  synchronizeStrokeState(t) {
    if (!this.strokeFrame) return;

    this.strokeFrame.synchronizeStateProperty('color', t);
    this.strokeFrame.synchronizeStateProperty('opacity', t);
    this.strokeFrame.synchronizeStateProperty('weight', t);
    this.strokeFrame.synchronizeStateProperty('join', t);
    this.strokeFrame.synchronizeStateProperty('cap', t);

    this.strokeFrame.state.colorBytes = [
      Math.floor(this.strokeFrame.state.color[0] * 255),
      Math.floor(this.strokeFrame.state.color[1] * 255),
      Math.floor(this.strokeFrame.state.color[2] * 255),
    ];
  }

  synchronizeStrokeDom(t, bounds, element) {
    if (!this.strokeFrame) return;

    const rgb = `rgb(${this.strokeFrame.state.colorBytes[0]}, ${this.strokeFrame.state.colorBytes[1]}, ${this.strokeFrame.state.colorBytes[2]})`;
    element.setAttributeNS(null, 'stroke', rgb);
    element.setAttributeNS(null, 'stroke-width', this.strokeFrame.state.weight);
    element.setAttributeNS(null, 'stroke-opacity', this.strokeFrame.state.opacity);
    element.setAttributeNS(null, 'stroke-linejoin', this.strokeFrame.state.join);
    element.setAttributeNS(null, 'stroke-linecap', this.strokeFrame.state.cap);
    element.setAttributeNS(null, 'stroke-dasharray', this.strokeFrame.state.dashes);
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
    } else if (object.type === 'mosaic') {
      return Mosaic.inflate(object, inflater);
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
    this.strokeFrame = this.stroke;

    // Assert required properties.
    this.assertProperty('size');
    this.assertProperty('position');

    // Assert types of extent properties.
    this.assertScalarType('size', [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('position', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('anchor', 2, [ExpressionString]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('size', fromTime, toTime);
    this.assertCompleteTimeline('position', fromTime, toTime);

    this.validateFillProperties(fromTime, toTime);
    this.validateStrokeProperties(fromTime, toTime);
  }

  initializeStaticState() {
    super.initializeStaticState();
    this.initializeStaticScalarProperty('size');
    this.initializeStaticVectorProperty('position');
    this.initializeStaticColorState();
    this.initializeStaticStrokeState();
  }

  initializeDynamicState() {
    super.initializeDynamicState();
    this.initializeDynamicProperty('size');
    this.initializeDynamicProperty('position');
    this.initializeDynamicColorState();
    this.initializeDynamicStrokeState();
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

  synchronizeCustomState(t) {
    this.synchronizeStateProperty('size', t);
    this.synchronizeStateProperty('position', t);
    this.synchronizeColorState(t);
    this.synchronizeStrokeState(t);
  }

  synchronizeCustomDom(t, bounds) {
    this.element.setAttributeNS(null, 'x', this.state.position[0]);
    this.element.setAttributeNS(null, 'y', -this.state.position[1]);
    this.element.setAttributeNS(null, 'font-size', this.state.size);
    this.synchronizeFillDom(t, bounds);
    this.synchronizeStrokeDom(t, bounds);
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
      -box.y - box.height + box.height * 0.5,
    ]);

    this.boundingBox = BoundingBox.fromCornerSize([box.x, -box.y], [box.width, box.height]);
    this.outlineMark.synchronizeState([box.x, -box.y - box.height], [box.width, box.height], 0);
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
    this.strokeFrame = this.stroke;

    // Assert required properties.
    this.assertProperty('size');

    if (this.has('corner') && this.has('center')) {
      throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose <code>corner</code> and <code>center</code> were both set. Define only one of these.`);
    } else if (!this.has('corner') && !this.has('center')) {
      throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose position I couldn't figure out. Define either its <code>corner</code> or <code>center</code>.`);
    }

    // Assert types of extent properties.
    this.assertScalarType('rounding', [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('size', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('corner', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('center', 2, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('size', fromTime, toTime);
    this.assertCompleteTimeline('center', fromTime, toTime);
    this.assertCompleteTimeline('corner', fromTime, toTime);
    this.assertCompleteTimeline('rounding', fromTime, toTime);

    this.validateFillProperties(fromTime, toTime);
    this.validateStrokeProperties(fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.hasCenter = this.has('center');
  }

  initializeStaticState() {
    super.initializeStaticState();
    this.initializeStaticVectorProperty('center');
    this.initializeStaticVectorProperty('corner');
    this.initializeStaticScalarProperty('rounding');
    this.initializeStaticVectorProperty('size');
    this.initializeStaticColorState();
    this.initializeStaticStrokeState();
  }

  initializeDynamicState() {
    super.initializeDynamicState();
    this.initializeDynamicProperty('center');
    this.initializeDynamicProperty('corner');
    this.initializeDynamicProperty('rounding');
    this.initializeDynamicProperty('size');
    this.initializeDynamicColorState();
    this.initializeDynamicStrokeState();
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'rect');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.connectToParent(root);
  }

  synchronizeCustomState(t) {
    this.synchronizeStateProperty('rounding', t);
    this.synchronizeStateProperty('size', t);
    this.synchronizeStateProperty('center', t);
    this.synchronizeStateProperty('corner', t);

    if (this.hasCenter) {
      this.state.corner = [
        this.state.center[0] - 0.5 * this.state.size[0],
        this.state.center[1] - 0.5 * this.state.size[1],
      ];
    }

    this.synchronizeColorState(t);
    this.synchronizeStrokeState(t);

    console.log("calculate centroid");
    this.state.centroid = [
      this.state.corner[0] + this.state.size[0] * 0.5,
      this.state.corner[1] + this.state.size[1] * 0.5,
    ];
    // this.state.centroid = this.state.matrix.multiplyPosition(this.state.centroid);
    this.boundingBox = BoundingBox.fromCornerSize(this.state.corner, this.state.size);
    if (this.strokeFrame) {
      this.boundingBox.dilate(this.strokeFrame.state.weight * 0.5);
    }
  }

  synchronizeCustomDom(t, bounds) {
    if (this.state.rounding) {
      this.element.setAttributeNS(null, 'rx', this.state.rounding);
      this.element.setAttributeNS(null, 'ry', this.state.rounding);
    }

    this.element.setAttributeNS(null, 'width', this.state.size[0]);
    this.element.setAttributeNS(null, 'height', this.state.size[1]);

    this.element.setAttributeNS(null, 'x', this.state.corner[0]);
    this.element.setAttributeNS(null, 'y', -this.state.corner[1] - this.state.size[1]);

    this.synchronizeFillDom(t, bounds);
    this.synchronizeStrokeDom(t, bounds, this.element);
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
  }
 
  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    this.outlineMark.synchronizeDom(bounds);
    this.positionMark.synchronizeDom(bounds, handleRadius);
    this.widthMark.synchronizeDom(bounds, handleRadius);
    this.heightMark.synchronizeDom(bounds, handleRadius);
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
    this.strokeFrame = this.stroke;

    // Assert required properties.
    this.assertProperty('radius');
    this.assertProperty('center');

    // Assert types of extent properties.
    this.assertScalarType('radius', [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('center', 2, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('radius', fromTime, toTime);
    this.assertCompleteTimeline('center', fromTime, toTime);

    this.validateFillProperties(fromTime, toTime);
    this.validateStrokeProperties(fromTime, toTime);
  }

  initializeStaticState() {
    super.initializeStaticState();
    this.initializeStaticScalarProperty('radius');
    this.initializeStaticVectorProperty('center');
    this.initializeStaticColorState();
    this.initializeStaticStrokeState();
  }

  initializeDynamicState() {
    super.initializeDynamicState();
    this.initializeDynamicProperty('radius');
    this.initializeDynamicProperty('center');
    this.initializeDynamicColorState();
    this.initializeDynamicStrokeState();
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

  synchronizeCustomState(t) {
    this.synchronizeStateProperty('radius', t);
    this.synchronizeStateProperty('center', t);
    this.synchronizeColorState(t);
    this.synchronizeStrokeState(t);
 
    this.state.centroid = this.state.center;
    this.boundingBox = BoundingBox.fromCenterRadius(this.state.center, this.state.radius);
    if (this.strokeFrame) {
      this.boundingBox.dilate(this.strokeFrame.state.weight * 0.5);
    }
  }

  synchronizeCustomDom(t, bounds) {
    this.element.setAttributeNS(null, 'r', this.state.radius);
    this.element.setAttributeNS(null, 'cx', this.state.center[0]);
    this.element.setAttributeNS(null, 'cy', -this.state.center[1]);
    this.synchronizeFillDom(t, bounds);
    this.synchronizeStrokeDom(t, bounds, this.element);
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
  }
 
  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    this.outlineMark.synchronizeDom(bounds);
    this.centerMark.synchronizeDom(bounds, handleRadius);
    this.radiusMark.synchronizeDom(bounds, handleRadius);
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

  validateProperties(fromTime, toTime) {
    this.assertProperty('id');

    if (this.has('corner') && this.has('center')) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> whose <code>corner</code> and <code>center</code> were both set. Define only one of these.`);
    } else if (!this.has('corner') && !this.has('center')) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> whose position I couldn't figure out. Define either its <code>corner</code> or <code>center</code>.`);
    }

    if (!this.has('width') && !this.has('height')) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> that had neither its <code>width</code> nor <code>height</code> set. At least one of these must be defined.`);
    }

    this.assertVectorType('corner', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('center', 2, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('id', [ExpressionString]);
    this.assertScalarType('width', [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('height', [ExpressionInteger, ExpressionReal]);
  }

  initializeState() {
    this.hasCenter = this.has('center');
    super.initializeState();
  }

  initializeStaticState() {
    super.initializeStaticState();
    this.initializeStaticScalarProperty('id');
    this.initializeStaticVectorProperty('corner');
    this.initializeStaticVectorProperty('center');
    this.initializeStaticScalarProperty('width');
    this.initializeStaticScalarProperty('height');
    this.state.size = [this.state.width, this.state.height];
    this.synchronizeDimensions();
  }

  // initializeDynamicState() {
    // super.initializeDynamicState();
  // }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'image');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.connectToParent(root);
    // this.element.setAttributeNS(null, 'width', this.state.width);
    // this.element.setAttributeNS(null, 'height', this.state.height);

    if (this.hasStatic('width') && this.hasStatic('height')) {
      this.element.setAttributeNS(null, 'preserveAspectRatio', 'none');
    }

    root.addRaster(this.state.id, this);
  }

  setRaster(aspectRatio, url) {
    this.element.setAttributeNS(null, 'href', url);
    this.state.aspectRatio = aspectRatio;
    this.synchronizeDimensions();
  }

  synchronizeDimensions() {
    if (this.hasStatic('width') && !this.hasStatic('height')) {
      this.state.size[1] = this.state.size[0] / this.state.aspectRatio;
    } else if (this.hasStatic('height') && !this.hasStatic('width')) {
      this.state.size[0] = this.state.size[1] * this.state.aspectRatio;
    }

    if (this.hasCenter) {
      this.state.corner = [
        this.state.center[0] - 0.5 * this.state.size[0],
        this.state.center[1] - 0.5 * this.state.size[1],
      ];
    }
  }

  synchronizeCustomState(t) {
  }

  synchronizeCustomDom(t, bounds) {
    this.element.setAttributeNS(null, 'width', this.state.size[0]);
    this.element.setAttributeNS(null, 'height', this.state.size[1]);

    let x;
    let y;
    if (this.hasCenter) {
      x = this.state.center[0] - 0.5 * this.state.size[0];
      y = this.state.center[1] - 0.5 * this.state.size[1];
    } else {
      x = this.state.corner[0];
      y = this.state.corner[1];
    }

    this.element.setAttributeNS(null, 'x', x);
    this.element.setAttributeNS(null, 'y', -y);
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
    } else {
      this.positionMark = new VectorPanMark(this, null, position => {
        this.state.corner = position;
      });
    }

    let marks = [this.positionMark, this.outlineMark];

    if (this.hasStatic('width')) {
      if (this.hasCenter) {
        this.widthMark = new HorizontalPanMark(this, null, 2, value => {
          this.state.size[0] = value;
          this.state.corner[0] = this.state.center[0] - value * 0.5;
        });
      } else {
        this.widthMark = new HorizontalPanMark(this, null, 1, value => this.state.size[0] = value);
      }
      marks.push(this.widthMark);
    }

    if (this.hasStatic('height')) {
      if (this.hasCenter) {
        this.heightMark = new VerticalPanMark(this, null, 2, value => {
          this.state.size[1] = value;
          this.state.corner[1] = this.state.center[1] - value * 0.5;
        });
      } else {
        this.heightMark = new VerticalPanMark(this, null, 1, value => this.state.size[1] = value);
      }
      marks.push(this.heightMark);
    }

    this.markers[0].setMarks(...marks);
  }

  synchronizeMarkExpressions(t) {
    super.synchronizeMarkExpressions(t);
    if (this.hasCenter) {
      this.positionMark.synchronizeExpressions(this.expressionAt('center', t));
    } else {
      this.positionMark.synchronizeExpressions(this.expressionAt('corner', t));
    }
    if (this.hasStatic('width')) {
      this.widthMark.synchronizeExpressions(this.expressionAt('width', t));
    }
    if (this.hasStatic('height')) {
      this.heightMark.synchronizeExpressions(this.expressionAt('height', t));
    }
  }

  synchronizeMarkState(t) {
    super.synchronizeMarkState(t);

    this.outlineMark.synchronizeState(this.state.corner, this.state.size, 0);
    if (this.hasCenter) {
      this.positionMark.synchronizeState(this.state.center, this.state.matrix, this.state.inverseMatrix);
      if (this.hasStatic('width')) {
        this.widthMark.synchronizeState([
          this.state.center[0] + 0.5 * this.state.size[0],
          this.state.center[1],
        ], this.state.matrix);
      }
      if (this.hasStatic('height')) {
        this.heightMark.synchronizeState([
          this.state.center[0],
          this.state.center[1] + 0.5 * this.state.size[1],
        ], this.state.matrix);
      }
    } else {
      this.positionMark.synchronizeState(this.state.corner, this.state.matrix, this.state.inverseMatrix);
      if (this.hasStatic('width')) {
        this.widthMark.synchronizeState([
          this.state.corner[0] + this.state.size[0],
          this.state.corner[1],
        ], this.state.matrix, this.state.inverseMatrix);
      }
      if (this.hasStatic('height')) {
        this.heightMark.synchronizeState([
          this.state.corner[0],
          this.state.corner[1] + this.state.size[1],
        ], this.state.matrix, this.state.inverseMatrix);
      }
    }

    // console.log("this.state.center:", this.state.center);
    // console.log("this.state.corner:", this.state.corner);
    // console.log("this.state.size:", this.state.size);
    // this.state.centroid = [
      // this.state.corner[0] + this.state.size[0] * 0.5,
      // this.state.corner[1] + this.state.size[1] * 0.5,
    // ];
    // this.state.centroid = this.state.matrix.multiplyPosition(this.state.centroid);
    // this.boundingBox = BoundingBox.fromCornerSize(this.state.corner, this.state.size);
    this.state.centroid = [0, 0];
    this.boundingBox = BoundingBox.fromCornerSize([0, 0], [0, 0]);
  }
 
  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    this.outlineMark.synchronizeDom(bounds);
    this.positionMark.synchronizeDom(bounds, handleRadius);
    if (this.hasStatic('width')) {
      this.widthMark.synchronizeDom(bounds, handleRadius);
    }
    if (this.hasStatic('height')) {
      this.heightMark.synchronizeDom(bounds, handleRadius);
    }
  }
}

// --------------------------------------------------------------------------- 

export class Grid extends Shape {
  static type = 'grid';
  static article = 'a';
  static timedIds = ['ticks', 'corner', 'center', 'size', 'enabled'];

  initialize(where) {
    super.initialize(where);
    this.bindStatic('color', new ExpressionVector([
      new ExpressionReal(0.75),
      new ExpressionReal(0.75),
      new ExpressionReal(0.75)
    ]));
    this.bindStatic('weight', new ExpressionReal(1));
    this.bindStatic('opacity', new ExpressionReal(1));
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
    this.strokeFrame = this;

    // TODO not size and then assert size?
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

    this.validateStrokeProperties(fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.hasCenter = this.has('center');
  }

  initializeStaticState() {
    super.initializeStaticState();
    this.initializeStaticVectorProperty('center');
    this.initializeStaticVectorProperty('corner');
    this.initializeStaticVectorProperty('ticks');
    this.initializeStaticVectorProperty('size');
    this.initializeStaticStrokeState();
  }

  initializeDynamicState() {
    super.initializeDynamicState();
    this.initializeDynamicProperty('center');
    this.initializeDynamicProperty('corner');
    this.initializeDynamicProperty('ticks');
    this.initializeDynamicProperty('size');
    this.initializeDynamicStrokeState();
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'g');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.element.setAttributeNS(null, 'fill', 'none');
    this.connectToParent(root);
  }

  synchronizeCustomState(t) {
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

    this.synchronizeStrokeState(t);
  }

  synchronizeCustomDom(t, bounds) {
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
        line.setAttributeNS(null, 'y1', -corner[1]);
        line.setAttributeNS(null, 'y2', -(corner[1] + size[1]));
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
        line.setAttributeNS(null, 'y1', -tick);
        line.setAttributeNS(null, 'y2', -tick);
        line.setAttributeNS(null, 'x1', corner[0]);
        line.setAttributeNS(null, 'x2', corner[0] + size[0]);
        line.classList.add('grid-line');
        this.element.appendChild(line);
      }
    }

    this.synchronizeStrokeDom(t, bounds, this.element);
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

    let previousNode = null;
    for (let [i, node] of this.nodes.entries()) {
      node.connect(this.nodes[0], previousNode, i + 1 < this.nodes.length ? this.nodes[i + 1] : null);
      previousNode = node;
    }
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
    if (this.hasStatic('elbow')) {
      let elbow = this.get('elbow');
      this.element.setAttributeNS(null, 'marker-mid', 'url(#element-' + elbow.id + ')');
      this.element.setAttributeNS(null, 'marker-start', 'url(#element-' + elbow.id + ')');
      this.element.setAttributeNS(null, 'marker-end', 'url(#element-' + elbow.id + ')');
    }

    if (this.hasStatic('head')) {
      let head = this.get('head');
      this.element.setAttributeNS(null, 'marker-end', 'url(#element-' + head.id + ')');
    }

    if (this.hasStatic('tail')) {
      let tail = this.get('tail');
      this.element.setAttributeNS(null, 'marker-start', 'url(#element-' + tail.id + ')');
    }
  }

  initializeState() {
    super.initializeState();

    this.state.tabDefaults = {size: 1, degrees: 45, inset: 0, isCounterClockwise: true};
    this.state.turtle0 = null;
    this.state.stack = [];

    for (let node of this.nodes) {
      node.initializeState();
    }

    for (let mirror of this.mirrors) {
      mirror.initializeState();
    }
  }

  synchronizeCustomState(t) {
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

  synchronizeCustomState(t) {
    super.synchronizeCustomState(t);
    for (let node of this.domNodes) {
      this.boundingBox.enclosePoint(node.state.turtle.position);
    }
    // this.state.centroid = this.state.matrix.multiplyPosition(this.boundingBox.centroid());
    this.state.centroid = this.boundingBox.centroid();
  }

  synchronizeMarkState(t) {
    super.synchronizeMarkState(t);
  }
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
    this.bindStatic('push', new FunctionDefinition('push', [], new ExpressionPushNode(this)));
    this.bindStatic('pop', new FunctionDefinition('pop', [], new ExpressionPopNode(this)));
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
    this.strokeFrame = this.stroke;
    this.validateFillProperties(fromTime, toTime);
    this.validateStrokeProperties(fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.domNodes = this.nodes.filter(node => node.isDom); // TODO make domNodes part of state?
    if (this.domNodes.length > 0) {
      this.state.turtle0 = this.domNodes[0].turtle;
    }
  }

  initializeStaticState() {
    super.initializeStaticState();
    this.initializeStaticColorState();
    this.initializeStaticStrokeState();
  }

  initializeDynamicState() {
    super.initializeDynamicState();
    this.initializeDynamicColorState();
    this.initializeDynamicStrokeState();
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'polygon');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.connectToParent(root);
    this.connectJoins();
  }

  synchronizeCustomState(t) {
    super.synchronizeCustomState(t);
    this.synchronizeColorState(t);
    this.synchronizeStrokeState(t);
  }

  synchronizeCustomDom(t, bounds) {
    this.synchronizeFillDom(t, bounds);
    this.synchronizeStrokeDom(t, bounds, this.element);

    const positions = this.domNodes.flatMap((node, index) => {
      return node.getPositions(this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
    });
    this.mirrorPositions(positions);

    if (positions.length < 3) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> with ${positions.length} ${positions.length == 1 ? 'vertex' : 'vertices'}. Polygons must have at least 3 vertices.`);
    }

    const coordinates = positions.map(position => `${position[0]},${-position[1]}`).join(' ');
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

export class Mosaic extends VertexShape {
  static type = 'mosaic';
  static article = 'a';
  static timedIds = ['color', 'opacity', 'enabled'];

  select(markerId = 0) {
    super.select(markerId);
    this.nodeMarker.show();
  }

  deselect() {
    super.deselect();
    this.nodeMarker.hide();
  }

  initialize(where) {
    super.initialize(where);
    this.bindStatic('vertex', new FunctionDefinition('vertex', [], new ExpressionVertexNode(this)));
    this.bindStatic('turtle', new FunctionDefinition('turtle', [], new ExpressionTurtleNode(this)));
    this.bindStatic('turn', new FunctionDefinition('turn', [], new ExpressionTurnNode(this)));
    this.bindStatic('fly', new FunctionDefinition('fly', [], new ExpressionFlyNode(this)));
    this.bindStatic('stroke', new FunctionDefinition('stroke', [], new ExpressionStroke(this)));
    this.bindStatic('push', new FunctionDefinition('push', [], new ExpressionPushNode(this)));
    this.bindStatic('pop', new FunctionDefinition('pop', [], new ExpressionPopNode(this)));
    this.bindStatic('tile', new FunctionDefinition('tile', [], new ExpressionTile(this)));
    this.tiles = [];
  }

  addTile(tile) {
    this.tiles.push(tile);
  }

  deflateReferent() {
    const object = super.deflateReferent();
    object.tiles = this.tiles.map(tile => tile.deflate());
    return object;
  }

  static create(where) {
    const shape = new Mosaic();
    shape.initialize(where);
    return shape;
  }

  static inflate(object, inflater) {
    const shape = new Mosaic();
    shape.embody(object, inflater);
    return shape;
  }

  embody(object, inflater) {
    super.embody(object, inflater);
    this.tiles = object.tiles.map(subobject => inflater.inflate(this, subobject));
  }

  validateProperties(fromTime, toTime) {
    this.assertProperty('gap');
    this.assertScalarType('gap', [ExpressionInteger, ExpressionReal]);
    this.assertCompleteTimeline('gap', fromTime, toTime);

    this.strokeFrame = this.stroke;
    this.validateFillProperties(fromTime, toTime);
    this.validateStrokeProperties(fromTime, toTime);
    for (let tile of this.tiles) {
      tile.validate(fromTime, toTime);
    }
  }

  initializeState() {
    super.initializeState();
    this.domNodes = this.nodes.filter(node => node.isDom);
    if (this.domNodes.length > 0) {
      this.state.turtle0 = this.domNodes[0].turtle;
    }

    this.state.tileNodes = this.tiles.map(tile => tile.getStatic('nodes').toPrimitiveArray());

    for (let [tileIndex, nodes] of this.state.tileNodes.entries()) { 
      for (let [nodeIndex, node] of nodes.entries()) {
        const tile = this.tiles[tileIndex];
        if (node < 0 || node >= this.domNodes.length) {
          const expr = tile.getStatic('nodes').get(nodeIndex).unevaluated;
          throw new LocatedException(expr.where, `I found a tile with node ${node}, which doesn't exist.`);
        }
      }
    }
  }

  initializeStaticState() {
    super.initializeStaticState();
    this.initializeStaticScalarProperty('gap');
    this.initializeStaticColorState();
    this.initializeStaticStrokeState();
  }

  initializeDynamicState() {
    super.initializeDynamicState();
    this.initializeDynamicProperty('gap');
    this.initializeDynamicColorState();
    this.initializeDynamicStrokeState();
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'g');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.connectToParent(root);
    this.connectJoins();
  }

  synchronizeCustomState(t) {
    super.synchronizeCustomState(t);
    this.synchronizeColorState(t);
    this.synchronizeStrokeState(t);

    const positions = this.domNodes.flatMap((node, index) => {
      return node.getPositions(this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
    });

    this.state.polygonTiles = [];

    for (let i = 0; i < this.tiles.length; ++i) {
      const tile = this.tiles[i];
      const polygon = this.state.tileNodes[i];
      const vertices = polygon.map(i => [positions[i][0], positions[i][1]]);
      const isLeftTile = !isLeftPolygon(vertices);

      const polygonTile = {};
      polygonTile.positions = vertices.map((vertex, i) => {
        const previousVertex = vertices[(i - 1 + vertices.length) % vertices.length];
        const nextVertex = vertices[(i + 1) % vertices.length];
        const isConcavity = isLeftTurn(previousVertex, vertex, nextVertex) === isLeftTile;

        const backward = unitVectorBetween(vertex, previousVertex);
        const forward = unitVectorBetween(vertex, nextVertex);

        const halfway = halfwayVector(backward, forward);
        const dot = backward[0] * forward[0] + backward[1] * forward[1];
        const radians = Math.acos(dot) * 0.5;
        const factor = this.state.gap / Math.sin(radians) * (isConcavity ? 1 : -1);
        return [vertex[0] + halfway[0] * factor, vertex[1] + halfway[1] * factor];
      });

      if (tile.hasStatic('color')) {
        polygonTile.color = tile.getStatic('color').toPrimitiveArray();
      }

      this.state.polygonTiles.push(polygonTile);
    }

    this.boundingBox = null;
    if (positions.length > 0) {
      let min = [Number.MAX_VALUE, Number.MAX_VALUE];
      let max = [-Number.MAX_VALUE, -Number.MAX_VALUE];
      for (let position of positions) {
        if (position[0] < min[0]) {
          min[0] = position[0];
        } else if (position[0] > max[0]) {
          max[0] = position[0];
        }
        if (position[1] < min[1]) {
          min[1] = position[1];
        } else if (position[1] > max[1]) {
          max[1] = position[1];
        }
      }
      this.boundingBox = BoundingBox.fromCorners(min, max);
      if (this.strokeFrame) {
        this.boundingBox.dilate(this.strokeFrame.state.weight * 0.5);
      }
    }
  }

  synchronizeCustomDom(t, bounds) {
    this.synchronizeFillDom(t, bounds);
    this.synchronizeStrokeDom(t, bounds, this.element);

    // Purge old polygons.
    clearChildren(this.element);

    for (let polygonTile of this.state.polygonTiles) {
      // Use a path so we can subtract away from it.
      const polygonElement = document.createElementNS(svgNamespace, 'path');

      let vertex = polygonTile.positions[0];
      let commands = `M${vertex[0]},${-vertex[1]}`;
      for (let i = 1; i < polygonTile.positions.length; ++i) {
        vertex = polygonTile.positions[i];
        commands += ` L${vertex[0]},${-vertex[1]}`;
      }

      // const coordinates = polygonTile.positions.map(vertex => `${vertex[0]},${-vertex[1]}`).join(' ');
      polygonElement.setAttributeNS(null, 'd', commands);
      this.element.appendChild(polygonElement);

      if (polygonTile.hasOwnProperty('color')) {
        const colorBytes = [
          Math.floor(polygonTile.color[0] * 255),
          Math.floor(polygonTile.color[1] * 255),
          Math.floor(polygonTile.color[2] * 255),
        ];
        const rgb = `rgb(${colorBytes[0]}, ${colorBytes[1]}, ${colorBytes[2]})`;
        polygonElement.setAttributeNS(null, 'fill', rgb);
      }
    }
  }

  initializeMarkState() {
    super.initializeMarkState();

    this.nodeMarker = new Marker(this);
    this.addMarker(this.nodeMarker);

    for (let tile of this.tiles) {
      tile.initializeMarkState();
    }

    this.outlineMark = new RectangleMark();
    this.markers[0].setMarks(this.outlineMark);

    this.dotsMark = new NumberedDotsMark();
    this.nodeMarker.setMarks(this.dotsMark);
  }

  synchronizeMarkState(t) {
    super.synchronizeMarkState(t);
    for (let tile of this.tiles) {
      tile.synchronizeMarkState();
    }
    let min = [Number.MAX_VALUE, Number.MAX_VALUE];
    let max = [-Number.MAX_VALUE, -Number.MAX_VALUE];
    const positions = this.domNodes.flatMap((node, index) => {
      return node.getPositions(this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
    });
    for (let position of positions) {
      if (position[0] < min[0]) {
        min[0] = position[0];
      } else if (position[0] > max[0]) {
        max[0] = position[0];
      }
      if (position[1] < min[1]) {
        min[1] = position[1];
      } else if (position[1] > max[1]) {
        max[1] = position[1];
      }
    }
    this.outlineMark.synchronizeState(min, [max[0] - min[0], max[1] - min[1]], 0);
    // this.outlineMark.synchronizeState(this.state.polygonTiles.map(polygonTile => {
      // let command = '';
      // if (polygonTile.positions.length > 0) {
        // command += `M${polygonTile.positions[0][0]},${-polygonTile.positions[0][1]}`;
        // for (let i = 1; i < polygonTile.positions.length; ++i) {
          // command += ` L${polygonTile.positions[i][0]},${-polygonTile.positions[i][1]}`;
        // }
        // command += ' z';
      // }
      // return command;
    // }).join(' '));

    // const positions = this.domNodes.flatMap((node, index) => {
      // return node.getPositions(this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
    // });
    this.dotsMark.synchronizeState(positions);
  }

  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
    for (let tile of this.tiles) {
      tile.synchronizeMarkDom(bounds, handleRadius, radialLength);
    }
    this.outlineMark.synchronizeDom(bounds);
    this.dotsMark.synchronizeDom(bounds, handleRadius, radialLength);
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
    this.bindStatic('push', new FunctionDefinition('push', [], new ExpressionPushNode(this)));
    this.bindStatic('pop', new FunctionDefinition('pop', [], new ExpressionPopNode(this)));
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
    this.strokeFrame = this.stroke;
    this.validateFillProperties(fromTime, toTime);
    this.validateStrokeProperties(fromTime, toTime);

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
    this.domNodes = this.nodes.filter(node => node.isDom); // TODO make domNodes part of state?
    this.state.turtle0 = this.domNodes[0].turtle;

    if (!this.has('formula')) {
      this.state.formula = UngonFormula.Symmetric;
    }
  }

  initializeStaticState() {
    super.initializeStaticState();
    this.initializeStaticScalarProperty('formula');
    this.initializeStaticScalarProperty('rounding');
    this.initializeStaticColorState();
    this.initializeStaticStrokeState();
  }

  initializeDynamicState() {
    super.initializeDynamicState();
    this.initializeDynamicProperty('rounding');
    this.initializeDynamicColorState();
    this.initializeDynamicStrokeState();
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'path');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.connectToParent(root);
    this.connectJoins();
  }

  synchronizeCustomState(t) {
    super.synchronizeCustomState(t);
    this.synchronizeColorState(t);
    this.synchronizeStateProperty('rounding', t);
    this.synchronizeStrokeState(t);
  }

  synchronizeCustomDom(t, bounds) {
    this.synchronizeFillDom(t, bounds);
    this.synchronizeStrokeDom(t, bounds, this.element);

    const gap = distancePointPoint(this.domNodes[0].state.turtle.position, this.domNodes[this.domNodes.length - 1].state.turtle.position);
    const hasReturn = gap < 1e-6;
    let nnodes = hasReturn ? this.domNodes.length - 1 : this.domNodes.length;
    let pathCommands = [];

    if (this.state.formula === UngonFormula.Symmetric) {
      let start = [
        (this.domNodes[0].state.turtle.position[0] + this.domNodes[1].state.turtle.position[0]) * 0.5,
        (this.domNodes[0].state.turtle.position[1] + this.domNodes[1].state.turtle.position[1]) * 0.5
      ];
      pathCommands.push(`M ${start[0]},${-start[1]}`);

      let previous = start;
      for (let i = 1; i < nnodes; ++i) {
        const a = this.domNodes[i].state.turtle.position;
        const b = this.domNodes[(i + 1) % this.domNodes.length].state.turtle.position;
        let mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
        pathCommands.push(`Q ${a[0]},${-a[1]} ${mid[0]},${-mid[1]}`);
        previous = mid;
      }

      const first = this.domNodes[0].state.position;
      pathCommands.push(`Q ${first[0]},${-first[1]} ${start[0]},${-start[1]}`);
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
      pathCommands.push(`M ${insetA[0]},${-insetA[1]}`);

      for (let i = 0; i < nnodes; ++i) {
        const position = this.domNodes[(i + 1) % nnodes].state.turtle.position;
        const vector = vectors[(i + 1) % nnodes];

        let insetB = [
          position[0] - rounding * vectors[i][0],
          position[1] - rounding * vectors[i][1],
        ];
        pathCommands.push(`L ${insetB[0]},${-insetB[1]}`);

        let insetA = [
          position[0] + rounding * vector[0],
          position[1] + rounding * vector[1],
        ];
        pathCommands.push(`Q ${position[0]},${-position[1]} ${insetA[0]},${-insetA[1]}`);
      }
    } else {
      let start = [
        (this.domNodes[0].state.turtle.position[0] + this.domNodes[1].state.turtle.position[0]) * 0.5,
        (this.domNodes[0].state.turtle.position[1] + this.domNodes[1].state.turtle.position[1]) * 0.5
      ];
      pathCommands.push(`M ${start[0]},${-start[1]}`);

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

        pathCommands.push(`C ${control1[0]},${-control1[1]} ${control2[0]},${-control2[1]} ${mid[0]},${-mid[1]}`);
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

      pathCommands.push(`C ${control1[0]},${-control1[1]} ${control2[0]},${-control2[1]} ${start[0]},${-start[1]}`);
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
    this.strokeFrame = this;
    this.strokeFrame.bindStatic('opacity', new ExpressionReal(1));
    this.validateStrokeProperties(fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.domNodes = this.nodes.filter(node => node.isDom); // TODO make domNodes part of state?
    if (this.domNodes.length > 0) {
      this.state.turtle0 = this.domNodes[0].turtle;
    }
  }

  initializeStaticState() {
    super.initializeStaticState();
    this.initializeStaticStrokeState();
  }

  initializeDynamicState() {
    super.initializeDynamicState();
    this.initializeDynamicStrokeState();
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'polyline');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);

    // SVG polylines for some reason are filled black by default. We want true
    // polylines, which have no fill.
    this.element.setAttributeNS(null, 'fill', 'none');

    this.connectToParent(root);
    this.connectJoins();
  }

  synchronizeCustomState(t) {
    super.synchronizeCustomState(t);
    this.synchronizeStrokeState(t);
  }

  synchronizeCustomDom(t, bounds) {
    this.synchronizeStrokeDom(t, bounds, this.element);

    const positions = this.domNodes.flatMap((node, index) => {
      return node.getPositions(this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
    });
    this.mirrorPositions(positions);

    if (positions.length < 2) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> with ${positions.length} ${positions.length == 1 ? 'vertex' : 'vertices'}. Polylines must have at least 2 vertices.`);
    }

    const coordinates = positions.map(position => `${position[0]},${-position[1]}`).join(' ');
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
    this.strokeFrame = this;
    this.strokeFrame.bindStatic('opacity', new ExpressionReal(1));
    this.validateStrokeProperties(fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.domNodes = this.nodes.filter(node => node.isDom);
    if (this.domNodes.length > 0) {
      this.state.turtle0 = this.domNodes[0].turtle;
    }
  }

  initializeStaticState() {
    super.initializeStaticState();
    this.initializeStaticStrokeState();
  }

  initializeDynamicState() {
    super.initializeDynamicState();
    this.initializeDynamicColorState();
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'line');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.element.setAttributeNS(null, 'fill', 'none');
    this.connectToParent(root);
    this.connectJoins();
  }

  synchronizeCustomState(t) {
    super.synchronizeCustomState(t);
    this.synchronizeStrokeState(t);
  }

  synchronizeCustomDom(t, bounds) {
    this.synchronizeStrokeDom(t, bounds, this.element);

    const positions = this.domNodes.flatMap((node, index) => {
      return node.getPositions(this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
    });
    this.mirrorPositions(positions);

    if (positions.length !== 2) {
      throw new LocatedException(this.where, `I found ${this.article} <code>${this.type}</code> with ${positions.length} ${positions.length == 1 ? 'vertex' : 'vertices'}. Lines must have exactly 2 vertices.`);
    }

    const coordinates = positions.map(position => `${position[0]},${-position[1]}`).join(' ');
    this.element.setAttributeNS(null, 'x1', positions[0][0]);
    this.element.setAttributeNS(null, 'y1', -positions[0][1]);
    this.element.setAttributeNS(null, 'x2', positions[1][0]);
    this.element.setAttributeNS(null, 'y2', -positions[1][1]);
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
    this.bindStatic('orbit', new FunctionDefinition('orbit', [], new ExpressionOrbitNode(this)));
    this.bindStatic('curl', new FunctionDefinition('curl', [], new ExpressionCurlNode(this)));
    this.bindStatic('bump', new FunctionDefinition('bump', [], new ExpressionBumpNode(this)));
    this.bindStatic('mirror', new FunctionDefinition('mirror', [], new ExpressionMirror(this)));
    this.bindStatic('stroke', new FunctionDefinition('stroke', [], new ExpressionStroke(this)));
    this.bindStatic('push', new FunctionDefinition('push', [], new ExpressionPushNode(this)));
    this.bindStatic('pop', new FunctionDefinition('pop', [], new ExpressionPopNode(this)));
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
    this.strokeFrame = this.stroke;
    if (this.strokeFrame) {
      this.strokeFrame.bindStatic('opacity', new ExpressionReal(1));
    }
    this.validateFillProperties(fromTime, toTime);
    this.validateStrokeProperties(fromTime, toTime);

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
    this.domNodes = this.nodes.filter(node => node.isDom);
    if (this.domNodes.length > 0) {
      this.state.turtle0 = this.domNodes[0].turtle;
    }
  }

  initializeStaticState() {
    super.initializeStaticState();
    this.initializeStaticColorState();
    this.initializeStaticStrokeState();
  }

  initializeDynamicState() {
    super.initializeDynamicState();
    this.initializeDynamicColorState();
    this.initializeDynamicStrokeState();
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'path');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.element.setAttributeNS(null, 'fill-rule', 'evenodd');
    this.connectToParent(root);
    this.connectJoins();
  }

  synchronizeCustomState(t) {
    super.synchronizeCustomState(t);
    this.synchronizeColorState(t);
    this.synchronizeStrokeState(t);
  }

  synchronizeCustomDom(t, bounds) {
    this.synchronizeFillDom(t, bounds);
    this.synchronizeStrokeDom(t, bounds, this.element);

    const pathCommands = this.domNodes.map((node, index) => {
      return node.pathCommand(bounds, this.domNodes[index - 1]?.turtle, this.domNodes[index + 1]?.turtle);
    });

	  if (this.mirrors.length > 0) {
      let segments = [];
      let previousSegment = null;
      for (let i = 0; i < this.domNodes.length; i += 1) {
        previousSegment = this.nodes[i].segment(previousSegment);
        if (i > 0 && previousSegment) {
          segments.push(previousSegment);
        }
      }

			for (let mirror of this.mirrors) {
				let {pivot, axis} = mirror.state;
				let line = {point: pivot, axis};

				let mirroredSegments = segments.slice().reverse();

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

  // initializeStaticState() {
    // super.initializeStaticState();
  // }

  // initializeDynamicState() {
    // super.initializeDynamicState();
  // }

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

  synchronizeCustomDom(t, bounds) {
    for (let child of this.children) {
      child.synchronizeCustomDom(t, bounds);
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
    // this.outlineMark.synchronizeDom(bounds); TODO
    for (let child of this.children) {
      child.synchronizeMarkDom(bounds, handleRadius, radialLength);
    }
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

  validateProperties(fromTime, toTime) {
    this.assertProperty('size');

    // Assert required properties.
    if (this.has('corner') && this.has('center')) {
      throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose <code>corner</code> and <code>center</code> were both set. Define only one of these.`);
    } else if (!this.has('corner') && !this.has('center')) {
      throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose position I couldn't figure out. Define either its <code>corner</code> or <code>center</code>.`);
    }

    // Assert types of extent properties.
    this.assertVectorType('size', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('corner', 2, [ExpressionInteger, ExpressionReal]);
    this.assertVectorType('center', 2, [ExpressionInteger, ExpressionReal]);

    // Assert completeness of timelines.
    this.assertCompleteTimeline('size', fromTime, toTime);
    this.assertCompleteTimeline('center', fromTime, toTime);
    this.assertCompleteTimeline('corner', fromTime, toTime);
  }

  initializeState() {
    super.initializeState();
    this.hasCenter = this.has('center');
  }

  initializeStaticState() {
    super.initializeStaticState();
    this.initializeStaticVectorProperty('size');
    this.initializeStaticVectorProperty('center');
    this.initializeStaticVectorProperty('corner');
  }

  initializeDynamicState() {
    super.initializeDynamicState();
    this.initializeDynamicProperty('size');
    this.initializeDynamicProperty('center');
    this.initializeDynamicProperty('corner');
  }

  synchronizeCustomState(t) {
    this.synchronizeStateProperty('size', t);
    this.synchronizeStateProperty('center', t);
    this.synchronizeStateProperty('corner', t);

    if (this.hasCenter) {
      this.state.corner = [
        this.state.center[0] - 0.5 * this.state.size[0],
        this.state.center[1] - 0.5 * this.state.size[1],
      ];
    }
  }

  synchronizeCustomDom(t, bounds) {
    super.synchronizeCustomDom(t, {
      x: this.state.corner[0],
      y: this.state.corner[1],
      width: this.state.size[0],
      height: this.state.corner[1] + this.state.corner[1] + this.state.size[1],
    });
    this.element.setAttributeNS(null, 'markerWidth', this.state.size[0]);
    this.element.setAttributeNS(null, 'markerHeight', this.state.size[1]);
    this.element.setAttributeNS(null, 'viewBox', `${this.state.corner[0]} ${this.state.corner[1]} ${this.state.size[0]} ${this.state.size[1]}`);
  }

  initializeDom(root) {
    this.element = document.createElementNS(svgNamespace, 'marker');
    this.element.setAttributeNS(null, 'id', 'element-' + this.id);
    this.element.setAttributeNS(null, 'orient', 'auto-start-reverse');
    this.element.setAttributeNS(null, 'markerUnits', 'strokeWidth');
    this.element.setAttributeNS(null, 'refX', 0);
    this.element.setAttributeNS(null, 'refY', 0);
    this.connectToParent(root);

    for (let child of this.children) {
      child.initializeDom(root);
    }
  }

  connectToParent(root) {
    root.defines.appendChild(this.element);
  }

  initializeMarkState() {
    super.initializeMarkState();
  }

  synchronizeMarkExpressions(t) {
    super.synchronizeMarkExpressions(t);
  }

  synchronizeMarkState(t) {
    super.synchronizeMarkState(t);
  }
 
  synchronizeMarkDom(bounds, handleRadius, radialLength) {
    super.synchronizeMarkDom(bounds, handleRadius, radialLength);
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

