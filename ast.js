// --------------------------------------------------------------------------- 
// PRIMITIVES
// --------------------------------------------------------------------------- 

function ExpressionNumber(i) {
  this.real = function() {
    return i;
  }

  this.evaluate = function() {
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
  this.evaluate = function() {
    var evalA = a.evaluate();
    var evalB = b.evaluate();

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
  this.evaluate = function() {
    var evalA = a.evaluate();
    var evalB = b.evaluate();

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
  this.evaluate = function() {
    var evalA = a.evaluate();
    var evalB = b.evaluate();

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
  this.evaluate = function() {
    var evalA = a.evaluate();
    var evalB = b.evaluate();

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
  this.evaluate = function() {
    var evalA = a.evaluate();
    var evalB = b.evaluate();

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

function Block(statements) {
  this.evaluate = function() {
    var result = null;
    statements.forEach(statement => result = statement.evaluate());
    return result;
  }
}
