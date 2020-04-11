import { 
  LocatedException,
  SourceLocation,
  mop,
} from './common.js';

import { 
  Timeline,
} from './timeline.js';

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
      untimedProperties: mop(this.untimedProperties, value => {
        return value.toPod();
      }),
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
    return this.functions.hasOwnProperty(id);
  }

  getFunction(id) {
    return this.functions[id];
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
      env = env.parent;
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
      env = env.parent;
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
}

// ---------------------------------------------------------------------------

export class TimelinedEnvironment extends Environment {
  static type = 'timelined environment';
  static article = 'a';
  static timedIds = [];

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
      env = env.parent;
    }
    return undefined;
  }

  isTimed(id) {
    return this.constructor.timedIds.includes(id);
  }

  applyStroke(env, t, element) {
    if (this.owns('size') && this.owns('color') && this.owns('opacity')) {
      const size = this.valueAt(env, 'size', t);
      const color = this.valueAt(env, 'color', t);
      const opacity = this.valueAt(env, 'opacity', t);
      element.setAttributeNS(null, 'stroke', color.toColor());
      element.setAttributeNS(null, 'stroke-width', size.value);
      element.setAttributeNS(null, 'stroke-opacity', opacity.value);
      if (this.owns('dashes')) {
        const dashes = this.valueAt(env, 'dashes', t).toSpacedString();
        element.setAttributeNS(null, 'stroke-dasharray', dashes);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

