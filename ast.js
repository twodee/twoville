function ExpressionInteger(i) {
  this.evaluate = function() {
    return this;
  };

  this.integer = function() {
    return i;
  }
}

function ExpressionAdd(a, b) {
  this.evaluate = function() {
    var valueA = a.evaluate().integer();
    var valueB = b.evaluate().integer();
    return new ExpressionInteger(valueA + valueB);
  };
}

function ExpressionSubtract(a, b) {
  this.evaluate = function() {
    var valueA = a.evaluate().integer;
    var valueB = b.evaluate().integer;
    return new ExpressionInteger(valueA - valueB);
  };
}

function Block(statements) {
  this.evaluate = function() {
    var result = null;
    statements.forEach(statement => result = statement.evaluate());
    return result;
  }
}
