function Interval(fromTime, fromValue, toTime, toValue) {
  this.setFrom(fromTime, fromValue);
  this.setTo(toTime, toValue);
}

Interval.prototype.setFrom = function(fromTime, fromValue) {
  this.fromTime = fromTime;
  this.fromValue = fromValue;
}

Interval.prototype.setTo = function(toTime, toValue) {
  this.toTime = toTime;
  this.toValue = toValue;
}

Interval.prototype.hasFrom = function() {
  return this.fromTime != null;
}

Interval.prototype.hasTo = function() {
  return this.toTime != null;
}

Interval.prototype.spans = function(t) {
  return (this.hasFrom() && this.hasTo() && this.fromTime.get() <= t && t <= this.toTime.get()) ||
         (this.hasFrom() && !this.hasTo() && this.fromTime.get() <= t) ||
         (!this.hasFrom() && this.hasTo() && t <= this.toTime.get());
}

Interval.prototype.duration = function() {
  return this.toTime.get() - this.fromTime.get();
}

Interval.prototype.interpolate = function(t) {
  if (!this.hasFrom()) {
    return this.toValue;
  } else if (!this.hasTo()) {
    return this.fromValue;
  } else {
    var proportion = (t - this.fromTime.get()) / this.duration();
    return this.fromValue.interpolate(this.toValue, proportion);
  }
}
