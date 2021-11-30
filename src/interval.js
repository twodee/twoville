import {
  Expression,
  ExpressionInteger,
  ExpressionVector,
} from './ast.js';

import {
  Vector3Animator,
  Vector2Animator,
  NumberAnimator,
} from './animator.js';

import {
  typesToSeries,
  LocatedException,
  MessagedException,
} from "./common.js";

export class Interval {
  constructor(fromTime, fromValue, toTime, toValue, tween = 'interpolateLinear') {
    this.setFrom(fromTime, fromValue);
    this.setTo(toTime, toValue);
    this.setTween(tween);
  }

  deflate() {
    return {
      fromTime: this.fromTime?.deflate(),
      fromValue: this.fromValue?.deflate(),
      toTime: this.toTime?.deflate(),
      toValue: this.toValue?.deflate(),
      tween: this.tween,
    };
  }

  static inflate(env, object, inflater) {
    return new Interval(
      inflater.inflate(env, object.fromTime),
      inflater.inflate(env, object.fromValue),
      inflater.inflate(env, object.toTime),
      inflater.inflate(env, object.toValue),
      object.tween,
    );
  }

  setTween(tween) {
    this.tween = tween;
    // throw new MessagedException(`Don't know this ${tweenType}`);
  }

  toString() {
    return this.fromTime?.value + ':' + this.fromValue?.value + ' .. ' + this.toTime?.value + ':' + this.toValue?.value;
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

  assertScalar(env, types) {
    if (this.hasFrom()) {
      Expression.assertScalar(env, this.fromValue, types);
    }

    if (this.hasTo()) {
      Expression.assertScalar(env, this.toValue, types);
    }
  }

  assertList(env, length, types) {
    if (this.hasFrom()) {
      Expression.assertList(env, this.fromValue, length, types);
    }

    if (this.hasTo()) {
      Expression.assertList(env, this.toValue, length, types);
    }
  }

  toAnimator() {
    // check from and to values to determine number or vector2
    // use interpolator to determine tween
    if (this.fromValue instanceof ExpressionVector &&
        this.toValue instanceof ExpressionVector) {
      if (this.fromValue.length === 2) {
        return new Vector2Animator(this.fromTime.value, this.fromValue.toPrimitiveArray(), this.toTime.value, this.toValue.toPrimitiveArray(), this.tween);
      } else if (this.fromValue.length === 3) {
        return new Vector3Animator(this.fromTime.value, this.fromValue.toPrimitiveArray(), this.toTime.value, this.toValue.toPrimitiveArray(), this.tween);
      }
    } else {
      return new NumberAnimator(
        this.fromTime.value,
        this.fromValue.value,
        this.toTime.value,
        this.toValue.value,
        this.tween
      );
    }
  }

  // duration() {
    // return this.toTime.value - this.fromTime.value;
  // }

  // interpolate(env, t) {
    // if (!this.hasFrom()) {
      // return this.toValue.evaluate(env);
    // } else if (this.fromValue.isTimeSensitive(env)) {
      // env.bind('t', new ExpressionInteger(t));
      // return this.fromValue.evaluate(env);
    // } else if (!this.hasTo()) {
      // return this.fromValue.evaluate(env);
    // } else if (this.toValue.isTimeSensitive(env)) {
      // env.bind('t', new ExpressionInteger(t));
      // return this.toValue.evaluate(env);
    // } else {
      // let proportion = (t - this.fromTime.value) / this.duration();
      // return this.fromValue[this.interpolator].bind(this.fromValue)(this.toValue, proportion);
    // }
  // }
};
