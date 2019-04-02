import {
  ExpressionInteger
} from './ast.js';

export class Interval {
  constructor(fromTime, fromValue, toTime, toValue) {
    this.setFrom(fromTime, fromValue);
    this.setTo(toTime, toValue);
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
      return this.fromValue.interpolate(this.toValue, proportion);
    }
  }
};
