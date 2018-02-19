function TwovilleEnvironment() {
  this.variables = {};
}

function TwovilleRectangle() {
  TwovilleEnvironment.call(this);
  this.variables.x = 0;
  this.variables.y = 0;
  this.variables.width = 200;
  this.variables.height = 100;
}

TwovilleRectangle.prototype = Object.create(TwovilleEnvironment.prototype);

TwovilleRectangle.prototype.draw = function(svg) {
  var rectangle = document.createElementNS(namespace, 'rect');
  rectangle.setAttributeNS(null, 'x', this.variables.x);
  rectangle.setAttributeNS(null, 'y', this.variables.y);
  rectangle.setAttributeNS(null, 'width', this.variables.width);
  rectangle.setAttributeNS(null, 'height', this.variables.height);
  rectangle.setAttributeNS(null, 'fill', this.variables.rgb.toRGB());
  svg.appendChild(rectangle);
}

// --------------------------------------------------------------------------- 

function TwovilleCircle() {
  TwovilleEnvironment.call(this);
  this.variables.x = 0;
  this.variables.y = 0;
  this.variables.radius = 200;
}

TwovilleCircle.prototype = Object.create(TwovilleEnvironment.prototype);

TwovilleCircle.prototype.draw = function(svg) {
  var circle = document.createElementNS(namespace, 'circle');
  circle.setAttributeNS(null, 'cx', this.variables.x);
  circle.setAttributeNS(null, 'cy', this.variables.y);
  circle.setAttributeNS(null, 'r', this.variables.radius);
  circle.setAttributeNS(null, 'fill', this.variables.rgb.toRGB());
  svg.appendChild(circle);
}

// --------------------------------------------------------------------------- 

function TwovilleVector(elements) {
  this.elements = elements;
}

TwovilleVector.prototype.get = function(i) {
  return this.elements[i];
}

TwovilleVector.prototype.evaluate = function(env) {
  return this;
}

TwovilleVector.prototype.toRGB = function(env) {
  var r = Math.floor(this.elements[0] * 255);
  var g = Math.floor(this.elements[1] * 255);
  var b = Math.floor(this.elements[2] * 255);
  return 'rgb(' + r + ', ' + g + ', ' + b + ')';
}

// --------------------------------------------------------------------------- 

function ExpressionRectangle() {
  this.evaluate = function(env) {
    var r = new TwovilleRectangle();
    env.shapes.push(r);
    return r;
  };
}

// --------------------------------------------------------------------------- 

function ExpressionCircle() {
  this.evaluate = function(env) {
    var c = new TwovilleCircle();
    env.shapes.push(c);
    return c;
  };
}

// --------------------------------------------------------------------------- 

function ExpressionPrint() {
  this.evaluate = function(env) {
    var message = env['message'];
    console.log(message.toString());
    return null;
  };
}

// --------------------------------------------------------------------------- 

