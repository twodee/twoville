var namespace = "http://www.w3.org/2000/svg";

// --------------------------------------------------------------------------- 
// PRIMITIVES
// --------------------------------------------------------------------------- 

function ExpressionNumber(i) {
  this.real = function() {
    return i;
  }

  this.evaluate = function(env) {
    return this;
  };
}

// --------------------------------------------------------------------------- 

function ExpressionInteger(i) {
  ExpressionNumber.call(this, i);

  this.integer = function() {
    return i;
  }
}

ExpressionInteger.prototype = Object.create(ExpressionNumber.prototype);

// --------------------------------------------------------------------------- 

function ExpressionReal(i) {
  ExpressionNumber.call(this, i);

  this.integer = function() {
    return Math.trunc(i);
  }
}

ExpressionReal.prototype = Object.create(ExpressionNumber.prototype);

// --------------------------------------------------------------------------- 
// ARITHMETIC
// --------------------------------------------------------------------------- 

function ExpressionAdd(a, b) {
  this.evaluate = function(env) {
    var evalA = a.evaluate(env);
    var evalB = b.evaluate(env);

    if (evalA instanceof ExpressionInteger &&
        evalB instanceof ExpressionInteger) {
      return new ExpressionInteger(evalA.integer() + evalB.integer());
    } else if (evalA instanceof ExpressionNumber &&
               evalB instanceof ExpressionNumber) {
      return new ExpressionReal(evalA.real() + evalB.real());
    } else {
      throw 'ack!!!'
    }

  };
}

// --------------------------------------------------------------------------- 

function ExpressionSubtract(a, b) {
  this.evaluate = function(env) {
    var evalA = a.evaluate(env);
    var evalB = b.evaluate(env);

    if (evalA instanceof ExpressionInteger &&
        evalB instanceof ExpressionInteger) {
      return new ExpressionInteger(evalA.integer() - evalB.integer());
    } else if (evalA instanceof ExpressionNumber &&
               evalB instanceof ExpressionNumber) {
      return new ExpressionReal(evalA.real() - evalB.real());
    } else {
      throw 'ack!!!'
    }

  };
}

// --------------------------------------------------------------------------- 

function ExpressionMultiply(a, b) {
  this.evaluate = function(env) {
    var evalA = a.evaluate(env);
    var evalB = b.evaluate(env);

    if (evalA instanceof ExpressionInteger &&
        evalB instanceof ExpressionInteger) {
      return new ExpressionInteger(evalA.integer() * evalB.integer());
    } else if (evalA instanceof ExpressionNumber &&
               evalB instanceof ExpressionNumber) {
      return new ExpressionReal(evalA.real() * evalB.real());
    } else {
      throw 'ack!!!'
    }

  };
}

// --------------------------------------------------------------------------- 

function ExpressionDivide(a, b) {
  this.evaluate = function(env) {
    var evalA = a.evaluate(env);
    var evalB = b.evaluate(env);

    if (evalA instanceof ExpressionInteger &&
        evalB instanceof ExpressionInteger) {
      return new ExpressionInteger(evalA.integer() / evalB.integer());
    } else if (evalA instanceof ExpressionNumber &&
               evalB instanceof ExpressionNumber) {
      return new ExpressionReal(evalA.real() / evalB.real());
    } else {
      throw 'ack!!!'
    }

  };
}

// --------------------------------------------------------------------------- 

function ExpressionRemainder(a, b) {
  this.evaluate = function(env) {
    var evalA = a.evaluate(env);
    var evalB = b.evaluate(env);

    if (evalA instanceof ExpressionInteger &&
        evalB instanceof ExpressionInteger) {
      return new ExpressionInteger(evalA.integer() % evalB.integer());
    } else if (evalA instanceof ExpressionNumber &&
               evalB instanceof ExpressionNumber) {
      return new ExpressionReal(evalA.real() % evalB.real());
    } else {
      throw 'ack!!!'
    }

  };
}

// --------------------------------------------------------------------------- 
//
// ---------------------------------------------------------------------------

function ExpressionRectangle(left, bottom, width, height) {
  this.evaluate = function(env) {
    var valueLeft = left.evaluate(env).real();
    var valueBottom = bottom.evaluate(env).real();
    var valueWidth = width.evaluate(env).real();
    var valueHeight = height.evaluate(env).real();
    console.log("valueLeft:", valueLeft);
    console.log("valueBottom:", valueBottom);
    console.log("valueWidth:", valueWidth);
    console.log("valueHeight:", valueHeight);

    var rectangle = document.createElementNS(namespace, 'rect');
    rectangle.setAttributeNS(null, 'x', valueLeft);
    rectangle.setAttributeNS(null, 'y', valueBottom);
    rectangle.setAttributeNS(null, 'width', valueWidth);
    rectangle.setAttributeNS(null, 'height', valueHeight);
    rectangle.setAttributeNS(null, 'fill', '#FF00FF');
    env.svg.appendChild(rectangle);
  };
}

// --------------------------------------------------------------------------- 
//
// ---------------------------------------------------------------------------

function Block(statements) {
  this.evaluate = function(env) {
    var result = null;
    statements.forEach(statement => result = statement.evaluate(env));
    return result;
  }
}
