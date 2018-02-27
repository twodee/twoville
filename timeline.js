function Timeline() {
  this.defaultValue = null;
  this.intervals = [];
}

Timeline.prototype.toString = function(fromTime, toTime) {
  if (fromTime == null && toTime == null) {
    return this.defaultValue.toString();
  } else if (fromTime != null) {
    return this.valueAt(fromTime).toString();
  } else {
    return this.valueAt(toTime).toString();
  }
}

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
  if (this.intervals.length == 0) {
    this.intervals.push(new Interval(t, value));
  } else {
    var i = 0;
    while (i < this.intervals.length &&
           this.intervals[i].hasFrom() &&
           this.intervals[i].fromTime <= t) {
      ++i;
    }

    if (i == 0) {
      this.intervals.unshift(new Interval(t, value));
    } else if (i < this.intervals.length && !this.intervals[i].hasFrom()) {
      this.intervals[i].setFrom(t, value);
    } else {
      --i;
      if (this.intervals[i].fromTime == t) {
        this.intervals[i].setFrom(t, value);
      } else if (!this.intervals[i].hasTo() || this.intervals[i].toTime <= t) {
        this.intervals.splice(i + 1, 0, new Interval(t, value));
      } else {
        this.intervals.splice(i + 1, 0, new Interval(t, value, this.intervals[i].toTime, this.intervals[i].toValue));
        this.intervals[i].setTo(null, null);
      }
    }
  }
}

Timeline.prototype.setToValue = function(t, value) {
  if (this.intervals.length == 0) {
    this.intervals.push(new Interval(null, null, t, value));
  } else {
    var i = 0;
    while (i < this.intervals.length &&
           this.intervals[i].hasFrom() &&
           this.intervals[i].fromTime <= t) {
      ++i;
    }

    // i points to interval that starts after 

    if (i == 0) {
      this.intervals.unshift(new Interval(null, null, t, value));
    // } else if (i < this.intervals.length && !this.intervals[i].hasTo()) {
      // this.intervals[i].setTo(t, value);
    } else {
      --i;
      if (this.intervals[i].toTime == t) {
        this.intervals[i].setTo(t, value);
      } else if (!this.intervals[i].hasTo()) {
        this.intervals[i].setTo(t, value);
      } else if (!this.intervals[i].hasTo() || this.intervals[i].toTime <= t) {
        this.intervals.splice(i + 1, 0, new Interval(null, null, t, value));
      } else {
        this.intervals.splice(i + 1, 0, new Interval(t, value, this.intervals[i].toTime, this.intervals[i].toValue));
        this.intervals[i].setTo(null, null);
      }
    }
  }
}
