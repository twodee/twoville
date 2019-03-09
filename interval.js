import { TwovilleInteger } from './types.js';

export let Interval = {
  create: function(fromTime, fromValue, toTime, toValue) {
    let instance = Object.create(Interval);
    instance.setFrom(fromTime, fromValue);
    instance.setTo(toTime, toValue);
    return instance;
  },
  toString: function() {
    return this.fromTime + ':' + this.fromValue + ' .. ' + this.toTime + ':' + this.toValue;
  },
  setFrom: function(fromTime, fromValue) {
    this.fromTime = fromTime;
    this.fromValue = fromValue;
  },
  setTo: function(toTime, toValue) {
    this.toTime = toTime;
    this.toValue = toValue;
  },
  hasFrom: function() {
    return this.fromTime != null;
  },
  hasTo: function() {
    return this.toTime != null;
  },
  spans: function(t) {
    return (this.hasFrom() && this.hasTo() && this.fromTime.get() <= t && t <= this.toTime.get()) ||
           (this.hasFrom() && !this.hasTo() && this.fromTime.get() <= t) ||
           (!this.hasFrom() && this.hasTo() && t <= this.toTime.get());
  },
  duration: function() {
    return this.toTime.get() - this.fromTime.get();
  },
  interpolate: function(env, t) {
    // TODO I shouldn't have to check if isTimeSensitive is a property or not. Some expressions
    // yield primitives, which don't have this property. Do I add it to them, or do I keep
    // expressions from yielding primitives?
    if (!this.hasFrom()) {
      return this.toValue.evaluate(env);
    } else if ('isTimeSensitive' in this.fromValue && this.fromValue.isTimeSensitive(env)) {
      env.bindings.t = TwovilleInteger.create(t);
      return this.fromValue.evaluate(env);
    } else if (!this.hasTo()) {
      return this.fromValue.evaluate(env);
    } else if ('isTimeSensitive' in this.toValue && this.toValue.isTimeSensitive(env)) {
      env.bindings.t = TwovilleInteger.create(t);
      return this.toValue.evaluate(env);
    } else {
      let proportion = (t - this.fromTime.get()) / this.duration();
      return this.fromValue.interpolate(this.toValue, proportion);
    }
  }
};
