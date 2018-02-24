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

// var i = new Interval(0, new TwovilleNumber(5), 10, new TwovilleNumber(25));
// console.log("i.hasFrom():", i.hasFrom());
// console.log("i.hasTo():", i.hasTo());
// console.log("i.spans(3):", i.spans(3));
// console.log("i.spans(-3):", i.spans(-3));
// console.log("i.spans(0):", i.spans(0));
// console.log("i.interpolate(3):", i.interpolate(3));
// console.log("i.interpolate(15):", i.interpolate(15));
// console.log("i.interpolate(5):", i.interpolate(5));
