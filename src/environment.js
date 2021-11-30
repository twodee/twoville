import { 
  FunctionDefinition,
  LocatedException,
  SourceLocation,
  objectMap,
} from './common.js';

import { 
  Timeline,
} from './timeline.js';

import { 
  ExpressionArcCosine,
  ExpressionArcSine,
  ExpressionArcTangent,
  ExpressionArcTangent2,
  ExpressionRaster,
  ExpressionCircle,
  ExpressionCosine,
  ExpressionCutout,
  ExpressionDebug,
  ExpressionGrid,
  ExpressionGroup,
  ExpressionHypotenuse,
  ExpressionInt,
  ExpressionInteger,
  ExpressionText,
  ExpressionLine,
  ExpressionMask,
  ExpressionMultiply,
  ExpressionPath,
  ExpressionPolar,
  ExpressionPolygon,
  ExpressionPolyline,
  ExpressionPrint,
  ExpressionRandom,
  ExpressionReal,
  ExpressionRectangle,
  ExpressionRotate,
  ExpressionScale,
  ExpressionShear,
  ExpressionSeed,
  ExpressionSine,
  ExpressionSquareRoot,
  ExpressionAbsoluteValue,
  ExpressionString,
  ExpressionSubtract,
  ExpressionTangent,
  ExpressionTip,
  ExpressionUngon,
  ExpressionUnpolar,
  ExpressionVector,
} from './ast.js';

// --------------------------------------------------------------------------- 

export class Environment {
  static type = 'environment';

  initialize(parentEnvironment, where) {
    this.untimedProperties = {};
    this.functions = {};
    this.parentEnvironment = parentEnvironment;
    if (where) {
      this.where = where;
    }
  }

  static create(parentEnvironment, where) {
    const env = new Environment();
    env.initialize(parentEnvironment, where);
    return env;
  }

  // embody(parentEnvironment, pod) {
    // this.parentEnvironment = parentEnvironment;
    // this.functions = {};
    // this.untimedProperties = objectMap(pod.untimedProperties, subpod => inflater.inflate(this, subpod));
    // if (pod.where) {
      // this.where = SourceLocation.inflate(pod.where);
    // }
  // }

  // static inflate(parentEnvironment, pod, inflater) {
    // const env = new Environment();
    // env.embody(parentEnvironment, pod, inflater);
    // return env;
  // }

  deflate() {
    return {
      type: this.type,
      untimedProperties: objectMap(this.untimedProperties, property => property.deflate()),
      where: this.where,
    };
  }

  bindStack(id, value) {
    this.untimedProperties[id] = value;
  }

  // Binding to a plain old Environment means the data isn't bound up with
  // time. The TimelinedEnvironment will override this for data that is bound
  // up with time.
  bind(id, value) {
    // if (this.instance) {
      // this.instance.bind(id, value);
    // } else {
      this.untimedProperties[id] = value;
    // }
  }

  bindFunction(id, method) {
    this.functions[id] = method;
  }

  hasFunction(id) {
    return this.functions.hasOwnProperty(id) || (this.parentEnvironment && this.parentEnvironment.hasFunction(id));
  }

  getFunction(id) {
    let f = this.functions[id];
    if (!f && this.parentEnvironment) {
      f = this.parentEnvironment.getFunction(id);
    }
    return f;
  }

  // Determine if this environment directly owns a property.
  owns(id) {
    return this.untimedProperties.hasOwnProperty(id);
  }

  // Determine if this environment owns or inherits a property.
  knows(id) {
    let env = this;
    while (env) {
      if (env.owns(id)) {
        return true;
      }
      env = env.parentEnvironment;
    }
    return false;
  }

  assertProperty(id) {
    if (!this.owns(id)) {
      throw new LocatedException(this.where, `I found ${this.article} ${this.type} whose ${id} property is not defined.`);
    }
  }

  get(id) {
    // 1. p should be pulled from env:
    // with rectangle()
    //   vertex().position = p
    //
    // 2. p should be pulled from shape:
    // with rectangle()
    //   p = 6
    //   vertex().position = p

    let env = this;
    while (env) {
      if (env.untimedProperties.hasOwnProperty(id)) {
        return env.untimedProperties[id];
      }

      env = env.parentEnvironment;
    }

    return undefined;
  }

  get type() {
    return this.constructor.type;
  }

  get article() {
    return this.constructor.article;
  }

  resolveReferences() {
    for (let [property, value] of Object.entries(this.untimedProperties)) {
      if (value.hasOwnProperty('type') && value.type === 'reference') {
        this.untimedProperties[property] = this.root.shapes.find(shape => shape.id === value.id);
      } else if (value instanceof ExpressionVector) {
        value.resolveReferences(this.root.shapes);
      }
    }
  }
}

// ---------------------------------------------------------------------------

export class TimelinedEnvironment extends Environment {
  static type = 'timelined environment';
  static article = 'a';
  static timedIds = [];

  static create(parentEnvironment, where) {
    const env = new TimelinedEnvironment();
    env.initialize(parentEnvironment, where);
    return env;
  }

  initialize(parentEnvironment, where) {
    super.initialize(parentEnvironment, where);
    this.timedProperties = {};
  }

  // embody(parentEnvironment, pod, inflater) {
    // super.embody(parentEnvironment, pod);
    // this.timedProperties = objectMap(pod.timedProperties, subpod => inflater.inflate(this, subpod));
  // }

  deflate() {
    const pod = super.deflate();
    pod.timedProperties = objectMap(this.timedProperties, value => value.deflate());
    return pod;
  }

  owns(id) {
    return super.owns(id) || this.timedProperties.hasOwnProperty(id);
  }

  bind(id, value, fromTime, toTime) {
    // if (this.instance) {
      // this.instance.bind(id, value, fromTime, toTime);
    // } else {
      if (!this.isTimed(id)) {
        super.bind(id, value);
      } else {
        if (!this.timedProperties.hasOwnProperty(id)) {
          this.timedProperties[id] = new Timeline();
        }
        const timeline = this.timedProperties[id];

        // We are assigning one timeline to another...
        if (value instanceof Timeline) {
          if (fromTime && toTime) {
            timeline.setFromValue(fromTime, value.intervalFrom(fromTime).fromValue);
            timeline.setToValue(toTime, value.intervalTo(toTime).toValue);
          } else if (fromTime) {
            timeline.setFromValue(fromTime, value.intervalFrom(fromTime).fromValue);
          } else if (toTime) {
            timeline.setToValue(toTime, value.intervalTo(toTime).toValue);
          } else {
            timeline.setDefault(value.getDefault());
          }
        } else if (fromTime && toTime) {
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
    // }
  }

  // Assumes property exists.
  valueAt(env, property, t) {
    return this.timedProperties[property].valueAt(env, t);
  }

  expressionAt(property, t) {
    if (this.timedProperties.hasOwnProperty(property)) {
      return this.timedProperties[property].expressionAt(t);
    } else if (this.untimedProperties.hasOwnProperty(property)) {
      return this.untimedProperties[property];
    } else {
      return null;
    }
  }

  get(id) {
    let env = this;
    while (env) {
      if (env.untimedProperties.hasOwnProperty(id)) {
        return env.untimedProperties[id];
      } else if (env.timedProperties && env.timedProperties.hasOwnProperty(id)) {
        return env.timedProperties[id];
      }
      env = env.parentEnvironment;
    }
    return undefined;
  }

  isTimed(id) {
    return this.constructor.timedIds.includes(id);
  }

  configureProperty(property, propertyHost, domHost, updateDom, resolveDefault, bounds, dependencies, checker) {
    const enabledTimeline = domHost.timedProperties.enabled;
    const timeline = propertyHost.timedProperties[property];
    if (!checker(timeline)) {
      return;
    }

    const defaultValue = timeline.defaultValue;
    let atemporal;

    if (defaultValue) {
      // If the default value is time sensitive, then it must be updated every frame.
      if (defaultValue.isTimeSensitive(domHost)) {
        const ager = (env, t) => {
          // TODO this one slipped through when I added object frames. Are there others? Did I do this right?
          const subenv = {stackFrame: Environment.create(env, null)};
          subenv.stackFrame.bind('t', new ExpressionInteger(t));
          const v = defaultValue.evaluate(subenv);
          propertyHost.state[property] = resolveDefault(v);
        };
        domHost.agers.push(ager);
        if (updateDom) {
          domHost.updateDoms.push(updateDom);
        }
      } else {
        atemporal = resolveDefault(defaultValue);
        propertyHost.state[property] = atemporal;
        if (updateDom && dependencies.every(dependency => this.timedProperties[dependency].defaultValue)) {
          updateDom(bounds);
        }
      }
    }

    if (timeline.intervals.length > 0) {

      // If there's no default value, we must assert that the property is
      // defined for all possible time values.
      if (!defaultValue) {
        let t = bounds.startTime;
        for (let interval of timeline.intervals) {
          let isEnabled = enabledTimeline ? (enabledTimeline.intervalAt(t)?.fromValue.value ?? enabledTimeline.defaultValue?.value) : true;
          if (isEnabled && !interval.spans(t)) {
            throw new LocatedException(this.where, `I found ${propertyHost.article} ${propertyHost.type} whose <code>${property}</code> property wasn't set at all possible times. In particular, it wasn't set at time ${t}.`); 
          } else if (!interval.hasTo()) {
            t = null;
            break;
          } else {
            t = interval.toTime.value + 1;
          }
        }
        if (t !== null && t < bounds.stopTime) {
          const isEnabled = enabledTimeline ? enabledTimeline.intervalAt(t)?.fromValue.value ?? enabledTimeline.defaultValue?.value : true;
          if (isEnabled) {
            throw new LocatedException(this.where, `I found ${propertyHost.article} ${propertyHost.type} whose <code>${property}</code> property wasn't set at all possible times. In particular, it wasn't set at time ${t}.`); 
          }
        }
      }

      const animators = timeline.intervals.map(interval => interval.toAnimator());
      const ager = (env, t) => {
        const animator = animators.find(animator => animator.fromTime <= t && t <= animator.toTime);
        if (animator) {
          propertyHost.state[property] = animator.age(t);
        } else {
          propertyHost.state[property] = atemporal;
        }
      };

      domHost.agers.push(ager);
      if (updateDom) {
        domHost.updateDoms.push(updateDom);
      }
    } else {
      // If any dependencies are animated, then this property is indirectly animated.
      if (dependencies.some(dependency => this.timedProperties[dependency].intervals.length > 0)) {
        if (updateDom) {
          domHost.updateDoms.push(updateDom);
        }
      }
    }
  }

  configureVectorProperty(property, propertyHost, domHost, updateDom, bounds, dependencies, checker) {
    this.configureProperty(property, propertyHost, domHost, updateDom, atemporal => atemporal.toPrimitiveArray(), bounds, dependencies, checker);
  }

  configureScalarProperty(property, propertyHost, domHost, updateDom, bounds, dependencies, checker) {
    this.configureProperty(property, propertyHost, domHost, updateDom, atemporal => atemporal.value, bounds, dependencies, checker);
  }

  get isAnimated() {
    return Object.values(this.timedProperties).some(property => property.isAnimated);
  }

  get hasAllDefaults() {
    return Object.values(this.timedProperties).every(property => property.hasDefault);
  }
}

// --------------------------------------------------------------------------- 

