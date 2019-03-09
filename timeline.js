import { TwovilleInteger } from './types.js';
import { Interval } from './interval.js';

export let Timeline = {
  create: function() {
    let instance = Object.create(Timeline);
    return Object.assign(instance, {
      defaultValue: null,
      intervals: []
    });
  },
  toString: function() {
    return '[default: ' + this.defaultValue + ', intervals: ' + this.intervals.map(interval => interval.toString()).join(',') + ']';
  },
    // function(fromTime, toTime) {
    // if (fromTime == null && toTime == null) {
      // return this.defaultValue.toString();
    // } else if (fromTime != null) {
      // return this.valueAt(fromTime).toString();
    // } else {
      // return this.valueAt(toTime).toString();
    // }
  // }

  getDefault: function(env, t) {
    return this.defaultValue;
  },
  setDefault: function(value) {
    this.defaultValue = value;
  },
  intervalAt: function(t) {
    return this.intervals.find(interval => interval.spans(t));
  },
  valueAt: function(env, t) {
    let interval = this.intervalAt(t);
    if (interval) {
      return interval.interpolate(env, t);
    } else if (this.defaultValue != null) {
      if ('isTimeSensitive' in this.defaultValue && this.defaultValue.isTimeSensitive(env)) {
        env.bindings.t = TwovilleInteger.create(t);
        return this.defaultValue.evaluate(env);
      } else { 
        return this.defaultValue;
      }
    } else {
      return null;
    }
  },
  setFromValue: function(t, value) {
    if (this.intervals.length == 0) {
      this.intervals.push(Interval.create(t, value));
    } else {
      let i = 0;
      while (i < this.intervals.length &&
             this.intervals[i].hasFrom() &&
             this.intervals[i].fromTime.get() <= t.get()) {
        ++i;
      }

      if (i == 0) {
        this.intervals.unshift(Interval.create(t, value));
      } else if (i < this.intervals.length && !this.intervals[i].hasFrom()) {
        this.intervals[i].setFrom(t, value);
      } else {
        --i;
        if (this.intervals[i].fromTime.get() == t.get()) {
          this.intervals[i].setFrom(t, value);
        } else if (!this.intervals[i].hasTo() || this.intervals[i].toTime.get() <= t.get()) {
          this.intervals.splice(i + 1, 0, Interval.create(t, value));
        } else {
          this.intervals.splice(i + 1, 0, Interval.create(t, value, this.intervals[i].toTime, this.intervals[i].toValue));
          this.intervals[i].setTo(null, null);
        }
      }
    }
  },
  setToValue: function(t, value) {
    if (this.intervals.length == 0) {
      this.intervals.push(Interval.create(null, null, t, value));
    } else {
      let i = 0;
      while (i < this.intervals.length &&
             this.intervals[i].hasFrom() &&
             this.intervals[i].fromTime.get() <= t.get()) {
        ++i;
      }

      // i points to interval that starts after 

      if (i == 0) {
        this.intervals.unshift(Interval.create(null, null, t, value));
      // } else if (i < this.intervals.length && !this.intervals[i].hasTo()) {
        // this.intervals[i].setTo(t, value);
      } else {
        --i;
        if (!this.intervals[i].hasTo()) {
          this.intervals[i].setTo(t, value);
        } else if (this.intervals[i].toTime.get() == t.get()) {
          this.intervals[i].setTo(t, value);
        } else if (!this.intervals[i].hasTo() || this.intervals[i].toTime.get() <= t.get()) {
          this.intervals.splice(i + 1, 0, Interval.create(null, null, t, value));
        } else {
          this.intervals.splice(i + 1, 0, Interval.create(t, value, this.intervals[i].toTime, this.intervals[i].toValue));
          this.intervals[i].setTo(null, null);
        }
      }
    }
  }
};
