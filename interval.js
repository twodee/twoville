export let Interval = {
  create: function(fromTime, fromValue, toTime, toValue) {
    let instance = Object.create(Interval);
    instance.setFrom(fromTime, fromValue);
    instance.setTo(toTime, toValue);
    return instance;
  },
  toString: function() {
    return this.fromTime + ':' + this.fromValue + ' .. ' + this.toTime + ':' + this.toValue;
  },
  setFrom: function(fromTime, fromValue) {
    this.fromTime = fromTime;
    this.fromValue = fromValue;
  },
  setTo: function(toTime, toValue) {
    this.toTime = toTime;
    this.toValue = toValue;
  },
  hasFrom: function() {
    return this.fromTime != null;
  },
  hasTo: function() {
    return this.toTime != null;
  },
  spans: function(t) {
    return (this.hasFrom() && this.hasTo() && this.fromTime.get() <= t && t <= this.toTime.get()) ||
           (this.hasFrom() && !this.hasTo() && this.fromTime.get() <= t) ||
           (!this.hasFrom() && this.hasTo() && t <= this.toTime.get());
  },
  duration: function() {
    return this.toTime.get() - this.fromTime.get();
  },
  interpolate: function(t) {
    if (!this.hasFrom()) {
      return this.toValue;
    } else if (!this.hasTo()) {
      return this.fromValue;
    } else {
      let proportion = (t - this.fromTime.get()) / this.duration();
      return this.fromValue.interpolate(this.toValue, proportion);
    }
  }
};
