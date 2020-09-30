import {
  ExpressionInteger
} from './ast.js';

import {
  MessagedException,
} from "./common.js";

export class Interval {
  constructor(fromTime, fromValue, toTime, toValue, tween = 'interpolateLinear') {
    this.setFrom(fromTime, fromValue);
    this.setTo(toTime, toValue);
    this.setTween(tween);
  }

  toPod() {
    return {
      fromTime: this.fromTime?.toPod(),
      fromValue: this.fromValue?.toPod(),
      toTime: this.toTime?.toPod(),
      toValue: this.toValue?.toPod(),
      interpolator: this.interpolator,
    };
  }

  static reify(env, pod) {
    const interval = new Interval(
      env.root.omniReify(env, pod.fromTime),
      env.root.omniReify(env, pod.fromValue),
      env.root.omniReify(env, pod.toTime),
      env.root.omniReify(env, pod.toValue),
      pod.interpolator,
    );
    return interval;
  }

  setTween(tween) {
    this.interpolator = tween;
    // throw new MessagedException(`Don't know this ${tweenType}`);
  }

  toString() {
    return this.fromTime + ':' + this.fromValue + ' .. ' + this.toTime + ':' + this.toValue;
  }

  setFrom(fromTime, fromValue) {
    this.fromTime = fromTime;
    this.fromValue = fromValue;
  }

  setTo(toTime, toValue) {
    this.toTime = toTime;
    this.toValue = toValue;
  }

  hasFrom() {
    return this.fromTime != null;
  }

  hasTo() {
    return this.toTime != null;
  }

  endsBefore(t) {
    return this.hasTo() && this.toTime.value <= t;
  }

  startsAfter(t) {
    return this.hasFrom() && this.fromTime.value >= t;
  }

  spans(t) {
    return (this.hasFrom() && this.hasTo() && this.fromTime.value <= t && t <= this.toTime.value) ||
           (this.hasFrom() && !this.hasTo() && this.fromTime.value <= t) ||
           (!this.hasFrom() && this.hasTo() && t <= this.toTime.value);
  }

  duration() {
    return this.toTime.value - this.fromTime.value;
  }

  interpolate(env, t) {
    if (!this.hasFrom()) {
      return this.toValue.evaluate(env);
    } else if (this.fromValue.isTimeSensitive(env)) {
      env.bindings.t = new ExpressionInteger(t);
      return this.fromValue.evaluate(env);
    } else if (!this.hasTo()) {
      return this.fromValue.evaluate(env);
    } else if (this.toValue.isTimeSensitive(env)) {
      env.bindings.t = new ExpressionInteger(t);
      return this.toValue.evaluate(env);
    } else {
      let proportion = (t - this.fromTime.value) / this.duration();
      return this.fromValue[this.interpolator].bind(this.fromValue)(this.toValue, proportion);
    }
  }
};
