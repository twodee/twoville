// --------------------------------------------------------------------------- 

function TwovilleEnvironment(parent) {
  this.bindings = {};
  this.shapes = parent.shapes;
  this.svg = parent.svg;
  this.parent = parent;
}

TwovilleEnvironment.prototype.get = function(id) {
  var env = this;
  while (env != null) {
    if (env.bindings.hasOwnProperty(id)) {
      return env.bindings[id];
    }
    env = env.parent;
  }
  throw 'no such var --' + id + '--';
}

TwovilleEnvironment.prototype.has = function(id) {
  var env = this;
  while (env != null) {
    if (env.bindings.hasOwnProperty(id)) {
      return true;
    }
    env = env.parent;
  }
  return false;
}

TwovilleEnvironment.prototype.bindUntimelined = function(id, value) {
  this.bindings[id] = value;
}

TwovilleEnvironment.prototype.bindTimelined = function(id, fromTime, toTime, value) {
  if (!this.bindings.hasOwnProperty(id)) {
    this.bindings[id] = new Timeline();
  }

  if (fromTime != null && toTime != null) {
    this.bindings[id].setFromValue(fromTime, value);
    this.bindings[id].setToValue(toTime, value);
  } else if (fromTime != null) {
    this.bindings[id].setFromValue(fromTime, value);
  } else if (toTime != null) {
    this.bindings[id].setToValue(toTime, value);
  } else {
    this.bindings[id].setDefault(value);
  }
}

// Assumes property exists.
TwovilleEnvironment.prototype.valueAt = function(property, t) {
  return this.bindings[property].valueAt(t);
}

// --------------------------------------------------------------------------- 

function TwovilleShape(env) {
  TwovilleEnvironment.call(this, env);
  this.bindings.stroke = new TwovilleEnvironment(this);
  this.bindTimelined('opacity', null, null, new TwovilleReal(1));
}

TwovilleShape.prototype = Object.create(TwovilleEnvironment.prototype);

TwovilleShape.prototype.bind = function(env, fromTime, toTime, id) {
  env.bindUntimelined(id, this);
}

// --------------------------------------------------------------------------- 

function TwovilleRectangle(env) {
  TwovilleShape.call(this, env);
  this.svgElement = document.createElementNS(namespace, 'rect');
  this.svg.appendChild(this.svgElement);
}

TwovilleRectangle.prototype = Object.create(TwovilleShape.prototype);

TwovilleRectangle.prototype.draw = function(svg, t) {
  if (!this.has('position')) {
    throw 'no position';
  }
  
  if (!this.has('size')) {
    throw 'no size';
  }
  
  if (!this.has('rgb')) {
    throw 'no rgb';
  }
  
  var needsTransforming = false;

  if (this.has('rotation')) {
    if (this.has('pivot')) {
      needsTransforming = true;
    } else {
      throw 'rotation but not pivot';
    }
  }

  // If we have rotation, but no pivot, error.

  var position = this.valueAt('position', t);
  var size = this.valueAt('size', t);
  var rgb = this.valueAt('rgb', t);

  if (needsTransforming) {
    var pivot = this.valueAt('pivot', t);
    var rotation = this.valueAt('rotation', t);
  }

  if (position == null || size == null || rgb == null || (needsTransforming && (pivot == null || rotation == null))) {
    this.svgElement.setAttributeNS(null, 'opacity', 0);
  } else {
    if (needsTransforming) {
      this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.get() + ' ' + pivot.get(0).get() + ',' + pivot.get(1).get() + ')');
    }

    if (this.has('stroke')) {
      var stroke = this.get('stroke');
      var strokeSize = stroke.valueAt('size', t);
      var strokeRGB = stroke.valueAt('rgb', t);
      var strokeOpacity = stroke.valueAt('opacity', t);
      this.svgElement.setAttributeNS(null, 'stroke', strokeRGB.toRGB());
      this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.get());
      this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.get());
    }

    this.svgElement.setAttributeNS(null, 'opacity', this.valueAt('opacity', t).get());
    this.svgElement.setAttributeNS(null, 'x', position.get(0).get());
    this.svgElement.setAttributeNS(null, 'y', position.get(1).get());
    this.svgElement.setAttributeNS(null, 'width', size.get(0).get());
    this.svgElement.setAttributeNS(null, 'height', size.get(1).get());
    this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    console.log("this.svgElement:", this.svgElement);
  }
}

// --------------------------------------------------------------------------- 

function TwovilleCircle() {
  TwovilleShape.call(this);
}

TwovilleCircle.prototype = Object.create(TwovilleShape.prototype);

TwovilleCircle.prototype.draw = function(svg) {
  var circle = document.createElementNS(namespace, 'circle');
  circle.setAttributeNS(null, 'cx', this.bindings.x);
  circle.setAttributeNS(null, 'cy', this.bindings.y);
  circle.setAttributeNS(null, 'r', this.bindings.radius);
  circle.setAttributeNS(null, 'fill', this.bindings.rgb.toRGB());
  svg.appendChild(circle);
}

// --------------------------------------------------------------------------- 

function TwovilleData(elements) {
}

TwovilleData.prototype.bind = function(env, fromTime, toTime, id) {
  env.bindTimelined(id, fromTime, toTime, this);
}

TwovilleData.prototype.evaluate = function(env, fromTime, toTime) {
  return this;
}

// --------------------------------------------------------------------------- 

function TwovilleVector(elements) {
  TwovilleData.call(this);
  this.elements = elements;
}

TwovilleVector.prototype = Object.create(TwovilleData.prototype);

TwovilleVector.prototype.get = function(i) {
  return this.elements[i];
}

TwovilleVector.prototype.evaluate = function(env) {
  return this;
}

TwovilleVector.prototype.toRGB = function(env) {
  var r = Math.floor(this.elements[0].get() * 255);
  var g = Math.floor(this.elements[1].get() * 255);
  var b = Math.floor(this.elements[2].get() * 255);
  return 'rgb(' + r + ', ' + g + ', ' + b + ')';
}

TwovilleVector.prototype.toString = function(env) {
  return '[' + this.elements.map(element => element.toString()).join(', ') + ']';
}

TwovilleVector.prototype.interpolate = function(other, proportion) {
  return new TwovilleVector(this.elements.map((element, i) => element.interpolate(other.get(i), proportion)));
}

// --------------------------------------------------------------------------- 

function TwovilleInteger(x) {
  TwovilleData.call(this);
  this.x = x;
}

TwovilleInteger.prototype = Object.create(TwovilleData.prototype);

TwovilleInteger.prototype.toString = function() {
  return '' + this.x;
}

TwovilleInteger.prototype.get = function() {
  return this.x;
}

TwovilleInteger.prototype.add = function(other) {
  if (other instanceof TwovilleInteger) {
    return new TwovilleInteger(get() + other.get());
  } else if (other instanceof TwovilleReal) {
    return new TwovilleReal(get() + other.get());
  } else {
    throw '...';
  }
}

TwovilleInteger.prototype.subtract = function(other) {
  if (other instanceof TwovilleInteger) {
    return new TwovilleInteger(get() - other.get());
  } else if (other instanceof TwovilleReal) {
    return new TwovilleReal(get() - other.get());
  } else {
    throw '...';
  }
}

TwovilleInteger.prototype.multiply = function(other) {
  if (other instanceof TwovilleInteger) {
    return new TwovilleInteger(get() * other.get());
  } else if (other instanceof TwovilleReal) {
    return new TwovilleReal(get() * other.get());
  } else {
    throw '...';
  }
}

TwovilleInteger.prototype.divide = function(other) {
  if (other instanceof TwovilleInteger) {
    return new TwovilleInteger(Math.trunc(get() / other.get()));
  } else if (other instanceof TwovilleReal) {
    return new TwovilleReal(get() / other.get());
  } else {
    throw '...';
  }
}

TwovilleInteger.prototype.remainder = function(other) {
  if (other instanceof TwovilleInteger) {
    return new TwovilleInteger(get() % other.get());
  } else if (other instanceof TwovilleReal) {
    return new TwovilleReal(get() % other.get());
  } else {
    throw '...';
  }
}

TwovilleInteger.prototype.interpolate = function(other, proportion) {
  return new TwovilleReal(this.get() + proportion * (other.get() - this.get()));
}

// --------------------------------------------------------------------------- 

function TwovilleReal(x) {
  TwovilleData.call(this);
  this.x = x;
}

TwovilleReal.prototype = Object.create(TwovilleData.prototype);

TwovilleReal.prototype.toString = function() {
  return '' + this.x;
}

TwovilleReal.prototype.get = function() {
  return this.x;
}

TwovilleReal.prototype.add = function(other) {
  if (other instanceof TwovilleInteger || other instanceof TwovilleReal) {
    return new TwovilleReal(get() + other.get());
  } else {
    throw '...';
  }
}

TwovilleReal.prototype.subtract = function(other) {
  if (other instanceof TwovilleInteger || other instanceof TwovilleReal) {
    return new TwovilleReal(get() - other.get());
  } else {
    throw '...';
  }
}

TwovilleReal.prototype.multiply = function(other) {
  if (other instanceof TwovilleInteger || other instanceof TwovilleReal) {
    return new TwovilleReal(get() * other.get());
  } else {
    throw '...';
  }
}

TwovilleReal.prototype.divide = function(other) {
  if (other instanceof TwovilleInteger || other instanceof TwovilleReal) {
    return new TwovilleReal(get() / other.get());
  } else {
    throw '...';
  }
}

TwovilleReal.prototype.remainder = function(other) {
  if (other instanceof TwovilleInteger || other instanceof TwovilleReal) {
    return new TwovilleReal(get() % other.get());
  } else {
    throw '...';
  }
}

TwovilleReal.prototype.interpolate = function(other, proportion) {
  return new TwovilleReal(this.get() + proportion * (other.get() - this.get()));
}

// --------------------------------------------------------------------------- 

function ExpressionRectangle() {
  this.evaluate = function(env, fromTime, toTime) {
    var r = new TwovilleRectangle(env);
    env.shapes.push(r);
    return r;
  };
}

// --------------------------------------------------------------------------- 

function ExpressionCircle() {
  this.evaluate = function(env, fromTime, toTime) {
    var c = new TwovilleCircle();
    env.shapes.push(c);
    return c;
  };
}

// --------------------------------------------------------------------------- 

function ExpressionPrint() {
  this.evaluate = function(env, fromTime, toTime) {
    var message = env['message'];
    console.log(message.toString(fromTime, toTime));
    return null;
  };
}

// --------------------------------------------------------------------------- 

