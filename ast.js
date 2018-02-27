var namespace = "http://www.w3.org/2000/svg";

// --------------------------------------------------------------------------- 
// PRIMITIVES
// --------------------------------------------------------------------------- 

function ExpressionInteger(x) {
  this.evaluate = function(env, fromTime, toTime) {
    return new TwovilleInteger(x);
  }
}

// --------------------------------------------------------------------------- 

function ExpressionReal(x) {
  this.evaluate = function(env, fromTime, toTime) {
    return new TwovilleReal(x);
  }
}

// --------------------------------------------------------------------------- 
// ARITHMETIC
// --------------------------------------------------------------------------- 

function ExpressionAdd(a, b) {
  this.evaluate = function(env, fromTime, toTime) {
    var evalA = a.evaluate(env, fromTime, toTime);
    var evalB = b.evaluate(env, fromTime, toTime);
    return evalA.add(evalB);
  };
}

// --------------------------------------------------------------------------- 

function ExpressionSubtract(a, b) {
  this.evaluate = function(env, fromTime, toTime) {
    var evalA = a.evaluate(env, fromTime, toTime);
    var evalB = b.evaluate(env, fromTime, toTime);
    return evalA.subtract(evalB);
  };
}

// --------------------------------------------------------------------------- 

function ExpressionMultiply(a, b) {
  this.evaluate = function(env, fromTime, toTime) {
    var evalA = a.evaluate(env, fromTime, toTime);
    var evalB = b.evaluate(env, fromTime, toTime);
    return evalA.multiply(evalB);
  };
}

// --------------------------------------------------------------------------- 

function ExpressionDivide(a, b) {
  this.evaluate = function(env, fromTime, toTime) {
    var evalA = a.evaluate(env, fromTime, toTime);
    var evalB = b.evaluate(env, fromTime, toTime);
    return evalA.divide(evalB);
  };
}

// --------------------------------------------------------------------------- 

function ExpressionRemainder(a, b) {
  this.evaluate = function(env, fromTime, toTime) {
    var evalA = a.evaluate(env, fromTime, toTime);
    var evalB = b.evaluate(env, fromTime, toTime);
    return evalA.remainder(evalB);
  };
}

// --------------------------------------------------------------------------- 

function ExpressionFunctionDefinition(name, formals, body) {
  this.evaluate = function(env, fromTime, toTime) {
    env.bindings[name] = {
      name: name,
      formals: formals,
      body: body
    };
  };
}

// --------------------------------------------------------------------------- 

function ExpressionIdentifier(token) {
  this.token = token;

  this.evaluate = function(env, fromTime, toTime) {
    return env.get(token.source);
  };

  this.assign = function(env, fromTime, toTime, rhs) {
    var value = rhs.evaluate(env, fromTime, toTime);
    value.bind(env, fromTime, toTime, token.source);
    return value;
  }
}

// --------------------------------------------------------------------------- 

function ExpressionFunctionCall(name, actuals) {
  this.evaluate = function(env, fromTime, toTime) {
    if (!env.has(name)) {
      throw 'no such func ' + name;
    }

    console.log("FROMtIME:", fromTime);
    console.log("TOtIME:", toTime);
    var f = env.bindings[name];

    if (actuals.length != f.formals.length) {
      throw 'params mismatch!';
    }

    var callEnvironment = {svg: env.svg, bindings: {}, shapes: env.shapes};
    actuals.forEach((actual, i) => {
      callEnvironment[f.formals[i]] = actual.evaluate(env, fromTime, toTime);
    });

    return f.body.evaluate(callEnvironment, fromTime, toTime);
  };
}

// --------------------------------------------------------------------------- 
//
// ---------------------------------------------------------------------------

function Block(statements) {
  this.statements = statements;

  this.evaluate = function(env, fromTime, toTime) {
    var result = null;
    statements.forEach(statement => {
      // console.log("statement:", statement);
      result = statement.evaluate(env, fromTime, toTime)
    });
    return result;
  }
}

// --------------------------------------------------------------------------- 

function ExpressionAssignment(l, r) {
  this.l = l;
  this.r = r;
  this.evaluate = function(env, fromTime, toTime) {
    if (l instanceof ExpressionIdentifier || l instanceof ExpressionProperty) {
      return l.assign(env, fromTime, toTime, r);
    } else {
      throw 'unassignable';
    }
  }
}

// --------------------------------------------------------------------------- 

function ExpressionProperty(base, property) {
  this.evaluate = function(env, fromTime, toTime) {
    var object = base.evaluate(env, fromTime, toTime); 
    return property.evaluate(object);
  }

  this.assign = function(env, fromTime, toTime, rhs) {
    var value = rhs.evaluate(env, fromTime, toTime);
    var object = base.evaluate(env, fromTime, toTime); 
    new ExpressionAssignment(property, value).evaluate(object, fromTime, toTime);
    return value;
  }
}

// --------------------------------------------------------------------------- 

function ExpressionVector(elements) {
  this.evaluate = function(env, fromTime, toTime) {
    var values = elements.map(element => element.evaluate(env, fromTime, toTime));
    return new TwovilleVector(values);
  }
}

// --------------------------------------------------------------------------- 

function StatementFrom(fromTimeExpression, block) {
  this.fromTimeExpression = fromTimeExpression;
  this.block = block;
  this.evaluate = function(env, fromTime, toTime) {
    var fromTime = fromTimeExpression.evaluate(env, fromTime, toTime);
    block.evaluate(env, fromTime, null);
  }
}

// --------------------------------------------------------------------------- 

function StatementTo(toTimeExpression, block) {
  this.evaluate = function(env, fromTime, toTime) {
    var toTime = toTimeExpression.evaluate(env, fromTime, toTime);
    block.evaluate(env, null, toTime);
  }
}

// --------------------------------------------------------------------------- 

function StatementBetween(fromTimeExpression, toTimeExpression, block) {
  this.block = block;
  this.evaluate = function(env, fromTime, toTime) {
    var fromTime = fromTimeExpression.evaluate(env, fromTime, toTime);
    var toTime = toTimeExpression.evaluate(env, fromTime, toTime);
    block.evaluate(env, fromTime, toTime);
  }
}

// --------------------------------------------------------------------------- 

function StatementThrough(throughTimeExpression, block) {
  this.block = block;
  this.evaluate = function(env, fromTime, toTime) {
    var throughTime = throughTimeExpression.evaluate(env, fromTime, toTime);
    block.evaluate(env, null, throughTime);
    block.evaluate(env, throughTime, null);
  }
}

// --------------------------------------------------------------------------- 
