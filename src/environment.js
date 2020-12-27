import { 
  FunctionDefinition,
  LocatedException,
  SourceLocation,
  mop,
} from './common.js';

import { 
  Timeline,
} from './timeline.js';

import { 
  ExpressionArcCosine,
  ExpressionArcSine,
  ExpressionArcTangent,
  ExpressionArcTangent2,
  ExpressionCircle,
  ExpressionCosine,
  ExpressionCutout,
  ExpressionDebug,
  ExpressionGroup,
  ExpressionHypotenuse,
  ExpressionInt,
  ExpressionInteger,
  ExpressionText,
  ExpressionLine,
  ExpressionMask,
  ExpressionMultiply,
  ExpressionPath,
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
  ExpressionVector,
} from './ast.js';

// import { 
  // Shape,
// } from './shape.js';

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

    // Let's make the root easy to access.
    if (parentEnvironment) {
      this.root = parentEnvironment.root;
    }
  }

  static create(parentEnvironment, where) {
    const env = new Environment();
    env.initialize(parentEnvironment, where);
    return env;
  }

  embody(parentEnvironment, pod) {
    this.parentEnvironment = parentEnvironment;
    if (parentEnvironment) {
      this.root = parentEnvironment.root;
    }

    this.untimedProperties = mop(pod.untimedProperties, subpod => this.root.omniReify(this, subpod));
    if (pod.where) {
      this.where = SourceLocation.reify(pod.where);
    }
  }

  static reify(parentEnvironment, pod) {
    const env = new Environment();
    env.embody(parentEnvironment, pod);
    return env;
  }

  toPod() {
    return {
      type: this.type,
      untimedProperties: mop(this.untimedProperties, property => property.toPod()),
      where: this.where,
    };
  }

  // Binding to a plain old Environment means the data isn't bound up with
  // time. The TimelinedEnvironment will override this for data that is bound
  // up with time.
  bind(id, value) {
    this.untimedProperties[id] = value;
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

  // evaluate(env, fromTime, toTime) {
    // return this;
  // }

  bindGlobalFunctions() {
    Object.assign(this.functions, {
      rectangle: new FunctionDefinition('rectangle', [], new ExpressionRectangle()),
      line: new FunctionDefinition('line', [], new ExpressionLine()),
      path: new FunctionDefinition('path', [], new ExpressionPath()),
      ungon: new FunctionDefinition('ungon', [], new ExpressionUngon()),
      polygon: new FunctionDefinition('polygon', [], new ExpressionPolygon()),
      polyline: new FunctionDefinition('polyline', [], new ExpressionPolyline()),
      text: new FunctionDefinition('text', [], new ExpressionText()),
      group: new FunctionDefinition('group', [], new ExpressionGroup()),
      tip: new FunctionDefinition('tip', [], new ExpressionTip()),
      mask: new FunctionDefinition('mask', [], new ExpressionMask()),
      cutout: new FunctionDefinition('cutout', [], new ExpressionCutout()),
      circle: new FunctionDefinition('circle', [], new ExpressionCircle()),
      print: new FunctionDefinition('print', ['message'], new ExpressionPrint()),
      debug: new FunctionDefinition('debug', ['expression'], new ExpressionDebug()),
      random: new FunctionDefinition('random', ['min', 'max'], new ExpressionRandom()),
      seed: new FunctionDefinition('seed', ['value'], new ExpressionSeed()),
      sin: new FunctionDefinition('sin', ['degrees'], new ExpressionSine()),
      cos: new FunctionDefinition('cos', ['degrees'], new ExpressionCosine()),
      tan: new FunctionDefinition('tan', ['degrees'], new ExpressionTangent()),
      asin: new FunctionDefinition('asin', ['ratio'], new ExpressionArcSine()),
      hypotenuse: new FunctionDefinition('hypotenuse', ['a', 'b'], new ExpressionHypotenuse()),
      acos: new FunctionDefinition('acos', ['ratio'], new ExpressionArcCosine()),
      atan: new FunctionDefinition('atan', ['ratio'], new ExpressionArcTangent()),
      atan2: new FunctionDefinition('atan2', ['a', 'b'], new ExpressionArcTangent2()),
      sqrt: new FunctionDefinition('sqrt', ['x'], new ExpressionSquareRoot()),
      abs: new FunctionDefinition('abs', ['x'], new ExpressionAbsoluteValue()),
      int: new FunctionDefinition('int', ['x'], new ExpressionInt()),
    });
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

  embody(parentEnvironment, pod) {
    super.embody(parentEnvironment, pod);
    this.timedProperties = mop(pod.timedProperties, subpod => this.root.omniReify(this, subpod));
  }

  toPod() {
    const pod = super.toPod();
    pod.timedProperties = mop(this.timedProperties, value => value.toPod());
    return pod;
  }

  owns(id) {
    return super.owns(id) || this.timedProperties.hasOwnProperty(id);
  }

  bind(id, value, fromTime, toTime) {
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
  }

  // Assumes property exists.
  valueAt(env, property, t) {
    return this.timedProperties[property].valueAt(env, t);
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

  // applyStroke(env, t, element) {
    // if (this.owns('size') && this.owns('color') && this.owns('opacity')) {
      // const size = this.valueAt(env, 'size', t);
      // const color = this.valueAt(env, 'color', t);
      // const opacity = this.valueAt(env, 'opacity', t);

      // element.setAttributeNS(null, 'stroke', color.toColor());
      // element.setAttributeNS(null, 'stroke-width', size.value);
      // element.setAttributeNS(null, 'stroke-opacity', opacity.value);

      // if (this.owns('dashes')) {
        // const dashes = this.valueAt(env, 'dashes', t).toSpacedString();
        // element.setAttributeNS(null, 'stroke-dasharray', dashes);
      // }

      // if (this.owns('join')) {
        // const type = this.valueAt(env, 'join', t).value;
        // element.setAttributeNS(null, 'stroke-linejoin', type);
      // }

      // return size.value;
    // } else {
      // return 0;
    // }
  // }

  configureProperty(property, propertyHost, domHost, updateDom, resolveDefault, bounds, dependencies, checker) {
    const timeline = propertyHost.timedProperties[property];
    if (!checker(timeline)) {
      return;
    }

    const defaultValue = timeline.defaultValue;
    let atemporal;

    if (defaultValue) {
      atemporal = resolveDefault(defaultValue);
      propertyHost[property] = atemporal;
      if (updateDom && dependencies.every(dependency => this.timedProperties[dependency].defaultValue)) {
        updateDom(bounds);
      }
    }

    if (timeline.intervals.length > 0) {

      // If there's no default value, we must assert that the property is
      // defined for all possible time values.
      if (!defaultValue) {
        let t = bounds.startTime;
        for (let interval of timeline.intervals) {
          if (!interval.spans(t)) {
            throw new LocatedException(this.where, `I found ${propertyHost.article} ${propertyHost.type} whose <code>${property}</code> property wasn't set at all possible times. In particular, it wasn't set at time ${t}.`); 
          } else if (!interval.hasTo()) {
            t = null;
            break;
          } else {
            t = interval.toTime.value + 1;
          }
        }
        if (t !== null && t < bounds.stopTime) {
          throw new LocatedException(this.where, `I found ${propertyHost.article} ${propertyHost.type} whose <code>${property}</code> property wasn't set at all possible times. In particular, it wasn't set at time ${t}.`); 
        }
      }

      const animators = timeline.intervals.map(interval => interval.toAnimator());
      const ager = (t) => {
        const animator = animators.find(animator => animator.fromTime <= t && t <= animator.toTime);
        if (animator) {
          propertyHost[property] = animator.age(t);
        } else {
          propertyHost[property] = atemporal;
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

