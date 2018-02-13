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

TwovilleRectangle.prototype.draw = function() {
  var rectangle = document.createElementNS(namespace, 'rect');
  rectangle.setAttributeNS(null, 'x', this.variables.x);
  rectangle.setAttributeNS(null, 'y', this.variables.y);
  rectangle.setAttributeNS(null, 'width', this.variables.width);
  rectangle.setAttributeNS(null, 'height', this.variables.height);
  rectangle.setAttributeNS(null, 'fill', '#FF00FF');
  env.svg.appendChild(rectangle);
}

function ExpressionRectangle() {
  this.evaluate = function(env) {
    var r = new TwovilleRectangle();
    console.log("env:", env);
    env.shapes.push(r);
    return r;
  };
}

function ExpressionPrint() {
  this.evaluate = function(env) {
    var message = env['message'];
    console.log("message:", message);
    console.log(message.toString());
    return null;
  };
}
