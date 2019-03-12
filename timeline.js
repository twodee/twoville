import { TwovilleInteger } from './types.js';
import { Interval } from './interval.js';

export class Timeline {
  constructor() {
    this.defaultValue = null;
    this.intervals = [];
  }

  toString() {
    return '[default: ' + this.defaultValue + ', intervals: ' + this.intervals.map(interval => interval.toString()).join(',') + ']';
  }

  getDefault(env, t) {
    return this.defaultValue;
  }

  setDefault(value) {
    this.defaultValue = value;
  }

  intervalAt(t) {
    return this.intervals.find(interval => interval.spans(t));
  }

  valueAt(env, t) {
    let interval = this.intervalAt(t);
    if (interval) {
      return interval.interpolate(env, t);
    } else if (this.defaultValue != null) {
      if ('isTimeSensitive' in this.defaultValue && this.defaultValue.isTimeSensitive(env)) {
        env.bindings.t = new TwovilleInteger(t);
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
      while (i < this.intervals.length &&
             this.intervals[i].hasFrom() &&
             this.intervals[i].fromTime.get() <= t.get()) {
        ++i;
      }

      if (i == 0) {
        this.intervals.unshift(new Interval(t, value));
      } else if (i < this.intervals.length && !this.intervals[i].hasFrom()) {
        this.intervals[i].setFrom(t, value);
      } else {
        --i;
        if (this.intervals[i].fromTime.get() == t.get()) {
          this.intervals[i].setFrom(t, value);
        } else if (!this.intervals[i].hasTo() || this.intervals[i].toTime.get() <= t.get()) {
          this.intervals.splice(i + 1, 0, new Interval(t, value));
        } else {
          this.intervals.splice(i + 1, 0, new Interval(t, value, this.intervals[i].toTime, this.intervals[i].toValue));
          this.intervals[i].setTo(null, null);
        }
      }
    }
  }

  setToValue(t, value) {
    if (this.intervals.length == 0) {
      this.intervals.push(new Interval(null, null, t, value));
    } else {
      let i = 0;
      while (i < this.intervals.length &&
             this.intervals[i].hasFrom() &&
             this.intervals[i].fromTime.get() <= t.get()) {
        ++i;
      }

      // i points to interval that starts after 

      if (i == 0) {
        this.intervals.unshift(new Interval(null, null, t, value));
      // } else if (i < this.intervals.length && !this.intervals[i].hasTo()) {
        // this.intervals[i].setTo(t, value);
      } else {
        --i;
        if (!this.intervals[i].hasTo()) {
          this.intervals[i].setTo(t, value);
        } else if (this.intervals[i].toTime.get() == t.get()) {
          this.intervals[i].setTo(t, value);
        } else if (!this.intervals[i].hasTo() || this.intervals[i].toTime.get() <= t.get()) {
          this.intervals.splice(i + 1, 0, new Interval(null, null, t, value));
        } else {
          this.intervals.splice(i + 1, 0, new Interval(t, value, this.intervals[i].toTime, this.intervals[i].toValue));
          this.intervals[i].setTo(null, null);
        }
      }
    }
  }
};
