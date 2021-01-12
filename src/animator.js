export class Animator {
  constructor(fromTime, fromValue, toTime, toValue, interpolate) {
    this.fromTime = fromTime;
    this.fromValue = fromValue;
    this.toTime = toTime;
    this.toValue = toValue;
    this.duration = toTime - fromTime;
    this.interpolate = interpolate;
  }
}

export class NumberAnimator extends Animator {
  constructor(fromTime, fromValue, toTime, toValue, tween) {
    super(fromTime, fromValue, toTime, toValue, interpolaters[tween]);
  }

  age(t) {
    const proportion = (t - this.fromTime) / this.duration;
    return this.interpolate(this.fromValue, this.toValue, proportion);
  }
}

export class Vector2Animator extends Animator {
  constructor(fromTime, fromValue, toTime, toValue, tween) {
    super(fromTime, fromValue, toTime, toValue, interpolaters[tween]);
    this.currentValue = [null, null];
  }

  age(t, dst) {
    const proportion = (t - this.fromTime) / this.duration;
    this.currentValue[0] = this.interpolate(this.fromValue[0], this.toValue[0], proportion);
    this.currentValue[1] = this.interpolate(this.fromValue[1], this.toValue[1], proportion);
    return this.currentValue;
  }
}

export class Vector3Animator extends Animator {
  constructor(fromTime, fromValue, toTime, toValue, tween) {
    super(fromTime, fromValue, toTime, toValue, interpolateLinear);
    this.currentValue = [null, null, null];
  }

  age(t, dst) {
    const proportion = (t - this.fromTime) / this.duration;
    this.currentValue[0] = this.interpolate(this.fromValue[0], this.toValue[0], proportion);
    this.currentValue[1] = this.interpolate(this.fromValue[1], this.toValue[1], proportion);
    this.currentValue[2] = this.interpolate(this.fromValue[2], this.toValue[2], proportion);
    return this.currentValue;
  }
}

export function interpolateNearest(a, b, proportion) {
  return proportion <= 0.5 ? a : b;
}

export function interpolateLinear(a, b, proportion) {
  return a + proportion * (b - a);
}

export function interpolateQuadraticInOut(a, b, proportion) {
  let t = proportion * 2;
  if (t < 1) {
    return a + (b - a) / 2 * t * t;
  } else {
    t -= 1;
    return a - (b - a) / 2 * (t * (t - 2) - 1);
  }
}

export function interpolateCubicInOut(a, b, proportion) {
  let t = proportion * 2;
  if (t < 1) {
    return a + (b - a) / 2 * t * t * t;
  } else {
    t -= 2;
    return a + (b - a) / 2 * (t * t * t + 2);
  }
}

export function interpolateQuarticInOut(a, b, proportion) {
  let t = proportion * 2;
  if (t < 1) {
    return a + (b - a) / 2 * t * t * t * t;
  } else {
    t -= 2;
    return a - (b - a) / 2 * (t * t * t * t - 2);
  }
}

export function interpolateQuinticInOut(a, b, proportion) {
  let t = proportion * 2;
  if (t < 1) {
    return a + (b - a) / 2 * t * t * t * t * t;
  } else {
    t -= 2;
    return a + (b - a) / 2 * (t * t * t * t * t + 2);
  }
}

export function interpolateBackInOut(a, b, proportion) {
  let t = proportion * 2;
  let s = 1.70158;
  let u = s * 1.525;
  if (t < 1) {
    return a + (b - a) * 0.5 * t * t * ((u + 1) * t - u);
  } else {
    t -= 2;
    return a + (b - a) * 0.5 * (t * t * ((u + 1) * t + u) + 2);
  }
}

export function interpolateSineInOut(a, b, proportion) {
  return a + (b - a) * 0.5 * (1 - Math.cos(Math.PI * proportion));
}

const interpolaters = Object.freeze({
  interpolateNearest,
  interpolateLinear,
  interpolateQuadraticInOut,
  interpolateCubicInOut,
  interpolateQuarticInOut,
  interpolateQuinticInOut,
  interpolateBackInOut,
  interpolateSineInOut,
});
