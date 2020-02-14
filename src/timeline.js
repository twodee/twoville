import { ExpressionInteger } from './ast.js';
import { Interval } from './interval.js';

import {
  MessagedException,
} from "./types.js";

export class Timeline {
  constructor() {
    this.defaultValue = null;
    this.intervals = [];
  }

  bind(id, rhs, from, to) {
    if (id == 'tween') {
      if (from && to) {
        for (let interval of this.intervals) {
          if (interval.fromTime == from.value && interval.toTime == to.value) {
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
    return '[default: ' + this.defaultValue + ', intervals: ' + this.intervals.map(interval => interval.toString()).join(',') + ']';
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

  valueAt(env, t) {
    let interval = this.intervalAt(t);
    if (interval) {
      return interval.interpolate(env, t);
    } else if (this.defaultValue != null) {
      if ('isTimeSensitive' in this.defaultValue && this.defaultValue.isTimeSensitive(env)) {
        env.bindings.t = new ExpressionInteger(t);
        return this.defaultValue.evaluate(env);
      } else { 
        return this.defaultValue;
      }
    } else {
      return null;
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
        this.intervals[i].setTo(null, null);
        this.intervals.splice(i + 1, 0, new Interval(t, value, this.intervals[i].toTime, this.intervals[i].toValue));
      }
    }
  }

  setToValue(t, value) {
    if (this.intervals.length == 0) {
      this.intervals.push(new Interval(null, null, t, value));
    } else {
      let i = this.intervals.length - 1;
      while (i >= 0 && this.intervals[i].startsAfter(t.value)) {
        --i;
      }

      // This logic gets really confusing. I'm going to spell everything out.
      // i points to an interval that either ends before or spans t.

      // If all the intervals start after the new one, prepend a new open to interval.
      if (i < 0) {
        this.intervals.unshift(new Interval(null, null, t, value));
      }

      // If to is open, close it.
      if (!this.intervals[i].hasTo()) {
        this.intervals[i].setTo(t, value);
      }
      
      // If to is same, update existing.
      else if (this.intervals[i].toTime.value == t.value) {
        this.intervals[i].setTo(t, value);
      }
      
      // Otherwise, split the spanning interval. Open the from-end and splice in a new closed interval predecessor.
      else {
        this.intervals[i].setFrom(null, null);
        this.intervals.splice(i, 0, new Interval(this.intervals[i].fromTime, this.intervals[i].fromValue, t, value));
      }
    }
  }
};
