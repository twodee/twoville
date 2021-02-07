import {
  Expression,
  ExpressionData,
  ExpressionInteger,
} from './ast.js';

import {
  Interval
} from './interval.js';

import { 
  typesToSeries,
  MessagedException,
  LocatedException,
} from './common.js';

// --------------------------------------------------------------------------- 

export class Timeline {
  constructor() {
    this.defaultValue = undefined;
    this.intervals = [];
  }

  toPod() {
    return {
      type: 'timeline',
      defaultValue: this.defaultValue ? this.defaultValue.toPod() : undefined,
      intervals: this.intervals.map(interval => interval.toPod()),
    };
  }

  static reify(env, pod) {
    const timeline = new Timeline();
    timeline.defaultValue = env.root.omniReify(env, pod.defaultValue);
    timeline.intervals = pod.intervals.map(interval => Interval.reify(env, interval));
    return timeline;
  }

  get hasDefault() {
    return !!this.defaultValue && this.defaultValue.isPrimitive;
  }

  get isAnimated() {
    return !this.defaultValue?.isPrimitive || this.intervals.length > 0;
  }

  bind(id, rhs, from, to) {
    if (id == 'tween') {
      if (from && to) {
        for (let interval of this.intervals) {
          if (interval.fromTime.value == from.value && interval.toTime.value == to.value) {
            interval.setTween(rhs.value); 
          }
        }
      } else {
        throw new MessagedException('need both from and to');
      }
    } else {
      throw new MessagedException(`I don't know the property ${id}.`);
    }
  }

  toString() {
    return '[default: ' + this.defaultValue?.value + ', intervals: ' + this.intervals.map(interval => interval.toString()).join(',') + ']';
  }

  getDefault() {
    return this.defaultValue;
  }

  setDefault(exvalue) {
    this.defaultValue = exvalue;
  }

  intervalAt(t) {
    return this.intervals.find(interval => interval.spans(t));
  }

  intervalFrom(t) {
    return this.intervals.find(interval => interval.fromTime == t);
  }

  intervalTo(t) {
    return this.intervals.find(interval => interval.toTime == t);
  }

  expressionAt(t) {
    let interval = this.intervalAt(t);
    if (interval) {
      if (interval.hasFrom() && t === interval.fromTime.value) {
        return interval.fromValue;
      } else if (interval.hasTo() && t === interval.toTime.value) {
        return interval.toValue;
      } else {
        return null;
      }
    } else {
      return this.defaultValue;
    }
  }

  valueAt(env, t) {
    let interval = this.intervalAt(t);
    if (interval) {
      return interval.interpolate(env, t);
    } else if (this.defaultValue) {
      if ('isTimeSensitive' in this.defaultValue && this.defaultValue.isTimeSensitive(env)) {
        env.untimedProperties.t = new ExpressionInteger(t);
        return this.defaultValue.evaluate(env);
      } else { 
        return this.defaultValue;
      }
    } else {
      return undefined;
    }
  }

  setFromValue(t, value) {
    if (this.intervals.length == 0) {
      this.intervals.push(new Interval(t, value));
    } else {
      let i = 0;
      while (i < this.intervals.length && this.intervals[i].endsBefore(t.value)) {
        ++i;
      }

      // This logic gets really confusing. I'm going to spell everything out.
      // i points to an interval that either starts after or spans t.

      // If all the intervals end before the new one, append a new open from interval.
      if (i >= this.intervals.length) {
        this.intervals.push(new Interval(t, value));
      }

      // If from is open, close it.
      if (!this.intervals[i].hasFrom()) {
        this.intervals[i].setFrom(t, value);
      }
      
      // If from is same, update existing.
      else if (this.intervals[i].fromTime.value == t.value) {
        this.intervals[i].setFrom(t, value);
      }
      
      // Otherwise, split the spanning interval. Open the to-end and splice in a new closed interval.
      else {
        this.intervals[i].setTo();
        this.intervals.splice(i + 1, 0, new Interval(t, value, this.intervals[i].toTime, this.intervals[i].toValue));
      }
    }
  }

  setToValue(t, value) {
    if (this.intervals.length == 0) {
      this.intervals.push(new Interval(undefined, undefined, t, value));
    } else {
      let i = this.intervals.length - 1;
      while (i >= 0 && this.intervals[i].startsAfter(t.value)) {
        --i;
      }

      // This logic gets really confusing. I'm going to spell everything out.
      // i points to an interval that either ends before or spans t.

      // If all the intervals start after the new one, prepend a new open to interval.
      if (i < 0) {
        this.intervals.unshift(new Interval(undefined, undefined, t, value));
      }

      // If to is open, close it.
      else if (!this.intervals[i].hasTo()) {
        this.intervals[i].setTo(t, value);
      }
      
      // If to is same, update existing.
      else if (this.intervals[i].toTime.value == t.value) {
        this.intervals[i].setTo(t, value);
      }
      
      // Otherwise, split the spanning interval. Open the from-end and splice in a new closed interval predecessor.
      else {
        this.intervals.splice(i, 0, new Interval(this.intervals[i].fromTime, this.intervals[i].fromValue, t, value));
        this.intervals[i + 1].setFrom(t, value);
      }
    }
  }

  assertScalar(env, ...types) {
    if (this.defaultValue) {
      Expression.assertScalar(env, this.defaultValue, types);
    }

    for (let interval of this.intervals) {
      interval.assertScalar(env, types);
    }
  }

  assertList(env, length, ...types) {
    if (this.defaultValue) {
      Expression.assertList(env, this.defaultValue, length, types);
    }

    for (let interval of this.intervals) {
      interval.assertList(env, length, types);
    }
  }
}

// --------------------------------------------------------------------------- 

