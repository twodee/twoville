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

  this.toString = function() {
    return '' + i;
  }
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

function ExpressionFunctionDefinition(name, formals, body) {
  this.evaluate = function(env) {
    env.functions[name] = {
      name: name,
      formals: formals,
      body: body
    };
  };
}

// --------------------------------------------------------------------------- 

function ExpressionIdentifier(token) {
  this.token = token;

  this.evaluate = function(env) {
    if (!env.variables.hasOwnProperty(token.source)) {
      throw 'no such var [' + token.source + ']';
    }

    var variable = env.variables[token.source];
    return variable;
  };

  this.assign = function(env, rhs) {
    var value = rhs.evaluate(env);
    env.variables[token.source] = value;
    return value;
  }
}

// --------------------------------------------------------------------------- 

function ExpressionFunctionCall(name, actuals) {
  this.evaluate = function(env) {
    if (!env.functions.hasOwnProperty(name)) {
      throw 'no such func ' + name;
    }

    var f = env.functions[name];

    if (actuals.length != f.formals.length) {
      throw 'params mismatch!';
    }

    var callEnvironment = {svg: env.svg, variables: {}, functions: {}, shapes: env.shapes};
    actuals.forEach((actual, i) => {
      callEnvironment[f.formals[i]] = actual.evaluate(env);
    });

    return f.body.evaluate(callEnvironment);
  };
}

// --------------------------------------------------------------------------- 
//
// ---------------------------------------------------------------------------

function Block(statements) {
  this.evaluate = function(env) {
    var result = null;
    statements.forEach(statement => {
      result = statement.evaluate(env)
    });
    return result;
  }
}

// --------------------------------------------------------------------------- 

function ExpressionAssignment(l, r) {
  this.evaluate = function(env) {
    if (l instanceof ExpressionIdentifier || l instanceof ExpressionProperty) {
      return l.assign(env, r);
    } else {
      throw 'unassignable';
    }
  }
}

// --------------------------------------------------------------------------- 

function ExpressionProperty(base, property) {
  this.evaluate = function(env) {
    var object = base.evaluate(env); 
    return property.evaluate(object);
  }

  this.assign = function(env, rhs) {
    var value = rhs.evaluate(env);
    var object = base.evaluate(env); 
    new ExpressionAssignment(property, value).evaluate(object);
    return value;
  }
}

// --------------------------------------------------------------------------- 

function ExpressionVector(elements) {
  this.evaluate = function(env) {
    var values = elements.map(element => element.evaluate(env));
    return new TwovilleVector(values);
  }
}

