function Timeline() {
  this.defaultValue = null;
  this.intervals = [];
}

Timeline.prototype.toString = function() {
  return '[default: ' + this.defaultValue + ', intervals: ' + this.intervals.map(interval => interval.toString()).join(',') + ']';
}
  
  // function(fromTime, toTime) {
  // if (fromTime == null && toTime == null) {
    // return this.defaultValue.toString();
  // } else if (fromTime != null) {
    // return this.valueAt(fromTime).toString();
  // } else {
    // return this.valueAt(toTime).toString();
  // }
// }

// Timeline.prototype.get = function() {
  // return this.defaultValue;
// }

Timeline.prototype.setDefault = function(value) {
  this.defaultValue = value;
}

Timeline.prototype.intervalAt = function(t) {
  return this.intervals.find(interval => interval.spans(t));
}

Timeline.prototype.valueAt = function(t) {
  var interval = this.intervalAt(t);
  if (interval) {
    return interval.interpolate(t);
  } else if (this.defaultValue != null) {
    return this.defaultValue;
  } else {
    return null;
  }
}

Timeline.prototype.setFromValue = function(t, value) {
  console.log("from");
  if (this.intervals.length == 0) {
    console.log("brand new ", t, value);
    this.intervals.push(new Interval(t, value));
    console.log("timelineA:", this.toString());
  } else {
    console.log("t:", t);
    console.log("value:", value);
    console.log("timelineB:", this.toString());
    var i = 0;
    while (i < this.intervals.length &&
           this.intervals[i].hasFrom() &&
           this.intervals[i].fromTime.get() <= t.get()) {
      ++i;
    }

    if (i == 0) {
      console.log("unshift");
      this.intervals.unshift(new Interval(t, value));
    } else if (i < this.intervals.length && !this.intervals[i].hasFrom()) {
      console.log("set from");
      this.intervals[i].setFrom(t, value);
    } else {
      console.log("splice");
      --i;
      if (this.intervals[i].fromTime.get() == t.get()) {
        this.intervals[i].setFrom(t, value);
      } else if (!this.intervals[i].hasTo() || this.intervals[i].toTime.get() <= t.get()) {
        this.intervals.splice(i + 1, 0, new Interval(t, value));
      } else {
        this.intervals.splice(i + 1, 0, new Interval(t, value, this.intervals[i].toTime, this.intervals[i].toValue));
        this.intervals[i].setTo(null, null);
      }
      console.log("timelineC:", this.toString());
    }
  }
}

Timeline.prototype.setToValue = function(t, value) {
  console.log("to");
  if (this.intervals.length == 0) {
    console.log("brand new to");
    this.intervals.push(new Interval(null, null, t, value));
  } else {
    console.log("t:", t);
    console.log("t:", typeof t);
    console.log("value:", value);
    console.log("timeline1:", this.toString());
    var i = 0;
    while (i < this.intervals.length &&
           this.intervals[i].hasFrom() &&
           this.intervals[i].fromTime.get() <= t.get()) {
      console.log("i:", i);
      ++i;
    }
    console.log("i:", i);

    // i points to interval that starts after 

    if (i == 0) {
      console.log("unshift");
      this.intervals.unshift(new Interval(null, null, t, value));
    // } else if (i < this.intervals.length && !this.intervals[i].hasTo()) {
      // this.intervals[i].setTo(t, value);
    } else {
      console.log("splice");
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
      console.log("timeline3:", this.toString());
    }
  }
}
