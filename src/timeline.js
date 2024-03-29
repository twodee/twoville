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
    this.intervals = [];
  }

  deflate() {
    return {
      type: 'timeline',
      intervals: this.intervals.map(interval => interval.deflate()),
    };
  }

  static inflate(env, object, inflater) {
    const timeline = new Timeline();
    timeline.intervals = object.intervals.map(interval => Interval.inflate(env, interval, inflater));
    return timeline;
  }

  get isAnimated() {
    return this.intervals.length > 0;
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
    return '[intervals: ' + this.intervals.map(interval => interval.toString()).join(',') + ']';
  }

  intervalAt(t) {
    return this.intervals.find(interval => interval.spans(t));
  }

  intervalRange(fromTime, toTime) {
    // If fromTime = 50, these intervals match:
    //   0 -> t -> 100
    //   80 -> t -> 100
    //   t -> 100
    const fromIndex = this.intervals.findIndex(interval => interval.spans(fromTime) || interval.startsAfter(fromTime));
    let toIndex = fromIndex + 1;
    while (toIndex < this.intervals.length && (this.intervals[toIndex].spans(toTime) || this.intervals[toIndex].endsBefore(toTime))) {
      toIndex += 1;
    }
    return this.intervals.slice(fromIndex, toIndex - fromIndex);
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
    }
  }

  valueAt(env, t) {
    console.log("t:", t);
    let interval = this.intervalAt(t);
    if (interval) {
      return interval.interpolate(env, t);
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

  assertScalar(env, types) {
    for (let interval of this.intervals) {
      interval.assertScalar(env, types);
    }
  }

  assertList(env, length, types) {
    for (let interval of this.intervals) {
      interval.assertList(env, length, types);
    }
  }
}

// --------------------------------------------------------------------------- 

