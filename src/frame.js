import {
  objectMap,
  LocatedException,
  SourceLocation
} from './common.js';
import {Timeline} from './timeline.js';
import {
  Expression,
  ExpressionInteger,
  ExpressionReal,
} from './ast.js';

/*
-------------------------------------------------------------------------------
StaticContext represents a collection of bindings that do not change over time.
This is in contrast to DynamicContext, whose bindings are stored as timelines.

This class doesn't have an explicit constructor. This design was chosen because
a context may be inflated from a serialized representation, in which case we
don't want to waste cycles on initialization that will be immediately
overwritten.
-------------------------------------------------------------------------------
*/

export class StaticContext {
  initialize() {
    this.bindings = {};
  }

  static create() {
    const context = new StaticContext();
    context.initialize();
    return context;
  }

  deflate() {
    return {
      type: 'StaticContext',
      bindings: objectMap(this.bindings, value => value.deflate()),
    };
  }

  embody(env, object, inflater) {
    this.bindings = objectMap(object.bindings, (subobject, key) => {
      return inflater.inflate(this, subobject, inflater);
    });
  }

  static inflate(env, object, inflater) {
    const context = new StaticContext();
    context.embody(env, object, inflater);
    return context;
  }

  bind(id, value) {
    this.bindings[id] = value;
  }

  has(id) {
    return this.bindings.hasOwnProperty(id);
  }

  get(id) {
    return this.bindings[id];
  }
}

/*
-------------------------------------------------------------------------------
DynamicContext represents a collection of bindings whose values change over
time.
-------------------------------------------------------------------------------
*/

export class DynamicContext {
  initialize() {
    this.bindings = {};
  }

  static create() {
    const context = new DynamicContext();
    context.initialize();
    return context;
  }

  deflate() {
    return {
      type: 'DynamicContext',
      bindings: objectMap(this.bindings, value => value.deflate()),
    };
  }

  embody(env, object, inflater) {
    this.bindings = objectMap(object.bindings, subobject => inflater.inflate(env, subobject));
  }

  static inflate(env, object, inflater) {
    const context = new DynamicContext();
    context.embody(env, object, inflater);
    return context;
  }

  bind(id, value, fromTime, toTime) {
    if (!this.has(id)) {
      this.bindings[id] = new Timeline();
    }
    const timeline = this.bindings[id];
    if (fromTime && toTime) {
      timeline.setFromValue(fromTime, value);
      timeline.setToValue(toTime, value);
    } else if (fromTime) {
      timeline.setFromValue(fromTime, value);
    } else if (toTime) {
      timeline.setToValue(toTime, value);
    } else {
      timeline.setDefault(value);
    }
  }

  has(id) {
    return this.bindings.hasOwnProperty(id);
  }

  get(id) {
    return this.bindings[id];
  }

  // valueAt(env, id, t) {
    // return this.bindings[id].valueAt(env, t);
  // }
}

/*
------------------------------------------------------------------------------ 
Frame is the marriage between a static context and a dynamic context. It might
represent a stack frame or an object frame.
------------------------------------------------------------------------------ 
*/

export class Frame {
  initialize(parentFrame) {
    this.parentFrame = parentFrame;
    this.staticContext = StaticContext.create();
    this.dynamicContext = DynamicContext.create();
  }

  static create(parentFrame) {
    const context = new Frame();
    context.initialize(parentFrame);   
    return context;
  }

  deflate() {
    return {
      type: 'frame',
      staticContext: this.staticContext.deflate(),
      dynamicContext: this.dynamicContext.deflate(),
    };
  }

  embody(parentFrame, object, inflater) {
    this.parentFrame = parentFrame;
    this.staticContext = StaticContext.inflate(this, object.staticContext, inflater);
    this.dynamicContext = DynamicContext.inflate(this, object.dynamicContext, inflater);
  }

  static inflate(parentFrame, object, inflater) {
    const frame = new Frame();
    frame.embody(parentFrame, object, inflater);
    return frame;
  }

  bindStatic(id, value) {
    this.staticContext.bind(id, value);
  }

  bindDynamic(id, value, fromTime, toTime) {
    this.dynamicContext.bind(id, value, fromTime, toTime);
  }

  bind(env, id, value) {
    if (env.fromTime || env.toTime || this.dynamicContext.has(id)) {
      this.bindDynamic(id, value, env.fromTime, env.toTime);
    } else {
      this.bindStatic(id, value);
    }
  }

  getStatic(id) {
    return this.staticContext.get(id);
  }

  getDynamic(id) {
    return this.dynamicContext.get(id);
  }

  hasStatic(id) {
    return this.staticContext.has(id);
  }

  hasDynamic(id) {
    return this.dynamicContext.has(id);
  }

  has(id) {
    return this.hasStatic(id) || this.hasDynamic(id);
  }

  get(id) {
    return this.staticContext.get(id) ?? this.dynamicContext.get(id);
  }

  static resolveStaticRvalue(id, frames) {
    for (let frame of frames) {
      if (frame.staticContext.has(id)) {
        return frame.staticContext.get(id);
      }
    }
    return null;
  }
}

// --------------------------------------------------------------------------- 

export class ObjectFrame extends Frame {
  initialize(parentFrame, where) {
    super.initialize(parentFrame);
    this.where = where;
  }

  static create(parentFrame, where) {
    const frame = new ObjectFrame();
    frame.initialize(parentFrame, where);
    return frame;
  }

  embody(env, object, inflater) {
    super.embody(env, object, inflater);
    this.where = SourceLocation.inflate(object.where);
  }

  get type() {
    return this.constructor.type;
  }

  get article() {
    return this.constructor.article;
  }

  deflate() {
    const object = super.deflate();
    object.type = this.type;
    object.where = this.where.deflate();
    return object;
  }

  initializeState() {
    this.state = {};
    this.initializeStaticState();
    this.initializeDynamicState();
  }

  synchronizeStateProperty(id, t) {
    const animation = this.state.animation[id];
    if (animation) {
      let animator = animation.animators.find(animator => animator.fromTime <= t && t <= animator.toTime);
      if (animator) {
        this.state[id] = animator.age(t);
      } else {
        this.state[id] = animation.defaultValue;
      }
    }
  }

  initializeStaticScalarProperty(id) {
    if (this.hasStatic(id)) {
      this.state[id] = this.getStatic(id).value;
    }
  }

  initializeStaticVectorProperty(id) {
    if (this.hasStatic(id)) {
      this.state[id] = this.getStatic(id).toPrimitiveArray();
    }
  }

  initializeDynamicProperty(id) {
    if (this.hasDynamic(id)) {
      const timeline = this.getDynamic(id);
      this.state.animation[id] = {
        animators: timeline.intervals.map(interval => interval.toAnimator()),
        defaultValue: this.state[id],
      };
    }
  }

  expressionAt(id, t) {
    let expression = this.getDynamic(id)?.expressionAt(t);
    if (!expression) {
      expression = this.getStatic(id);
    }
    return expression;
  }
  
  assertCompleteTimeline(id, fromTime, toTime) {
    // If this property has a static value, then we don't need to check that
    // the timeline is complete.
    if (this.hasStatic(id) || !this.hasDynamic(id)) {
      return;
    }

    const timeline = this.getDynamic(id);

    // Check all the time boundaries and make sure there's a definition for the
    // property. One of three things can happen on each iteration of the loop.
    // 1) The current time t is not in the current interval, which is invalid.
    // 2) The current interval contains t and is a closed interval, in which
    // case we skip ahead to the next time just after the current interval and
    // continue checking. 3) The interval contains t and is an open interval,
    // which means there will be a definition for all possible times.

    let t = fromTime;
    for (let interval of timeline.intervals) {
      if (!interval.spans(t)) {
        throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose <code>${id}</code> property isn't set at all possible times. For example, it isn't set at time ${t}.`); 
      } else if (interval.hasTo()) {
        t = interval.toTime.value + 1;
      } else {
        return;
      }
    }

    // If we made it through all the intervals but not through the full time
    // span, then we have an incomplete timeline.
    if (t <= toTime) {
      throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose <code>${id}</code> property wasn't set at all possible times. For example, it wasn't set at time ${t}.`); 
    }
  }

  assertProperty(id) {
    if (!this.has(id)) {
      throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose <code>${id}</code> property is not defined.`);
    }
  }

  assertScalarType(id, types) {
    try {
      if (this.hasStatic(id)) {
        Expression.assertScalar(this, this.getStatic(id), types);
      }

      if (this.hasDynamic(id)) {
        this.getDynamic(id).assertScalar(this, types);
      }
    } catch (e) {
      throw new LocatedException(e.where, `I found an illegal value for <code>${id}</code>. ${e.message}`);
    }
  }

  assertVectorType(id, length, types) {
    try {
      if (this.hasStatic(id)) {
        Expression.assertList(this, this.getStatic(id), length, types);
      }

      if (this.hasDynamic(id)) {
        this.getDynamic(id).assertList(this, length, types);
      }
    } catch (e) {
      throw new LocatedException(e.where, `I found an illegal value for <code>${id}</code>. ${e.message}`);
    }
  }
}

// --------------------------------------------------------------------------- 

export class StrokeFrame extends ObjectFrame {
  static type = 'stroke';
  static article = 'a';
  static timedIds = ['color', 'opacity', 'width'];

  static create(parentFrame, where) {
    const frame = new StrokeFrame();
    frame.initialize(parentFrame, where);
    parentFrame.stroke = frame;
    return frame;
  }

  static inflate(parentFrame, object, inflater) {
    const frame = new StrokeFrame();
    frame.embody(parentFrame, object, inflater);
    return frame;
  }

  validate(fromTime, toTime) {
    // Assert required properties.
    this.assertProperty('color');
    this.assertProperty('width');

    this.assertVectorType('color', 3, [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('opacity', [ExpressionInteger, ExpressionReal]);
    this.assertScalarType('width', [ExpressionInteger, ExpressionReal]);

    this.assertCompleteTimeline('color', fromTime, toTime);
    this.assertCompleteTimeline('opacity', fromTime, toTime);
    this.assertCompleteTimeline('width', fromTime, toTime);
  }

  initializeStaticState() {
    if (this.hasStatic('color')) {
      this.state.color = this.getStatic('color').toPrimitiveArray();
    }

    if (this.hasStatic('opacity')) {
      this.state.opacity = this.getStatic('opacity').value;
    }

    if (this.hasStatic('width')) {
      this.state.width = this.getStatic('width').value;
    }
  }

  initializeDynamicState() {
    this.state.animation = {};

    if (this.hasDynamic('color')) {
      const timeline = this.getDynamic('color');
      this.state.animation.color = {
        animators: timeline.intervals.map(interval => interval.toAnimator()),
        defaultValue: this.state.color,
      };
    }

    if (this.hasDynamic('opacity')) {
      const timeline = this.getDynamic('opacity');
      this.state.animation.opacity = {
        animators: timeline.intervals.map(interval => interval.toAnimator()),
        defaultValue: this.state.opacity,
      };
    }

    if (this.hasDynamic('width')) {
      const timeline = this.getDynamic('width');
      this.state.animation.width = {
        animators: timeline.intervals.map(interval => interval.toAnimator()),
        defaultValue: this.state.width,
      };
    }
  }

  synchronizeState(t) {
    this.synchronizeStateProperty('color', t);
    this.synchronizeStateProperty('opacity', t);
    this.synchronizeStateProperty('width', t);

    this.state.colorBytes = [
      Math.floor(this.state.color[0] * 255),
      Math.floor(this.state.color[1] * 255),
      Math.floor(this.state.color[2] * 255),
    ];
  }

  synchronizeDom(t, element) {
    const rgb = `rgb(${this.state.colorBytes[0]}, ${this.state.colorBytes[1]}, ${this.state.colorBytes[2]})`;
    element.setAttributeNS(null, 'stroke', rgb);
    element.setAttributeNS(null, 'stroke-width', this.state.width);
    element.setAttributeNS(null, 'stroke-opacity', this.state.opacity);
  }
}

// --------------------------------------------------------------------------- 

