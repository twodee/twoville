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

function ExpressionIdentifier(id) {
  this.evaluate = function(env) {
    if (!env.variables.hasOwnProperty(id)) {
      throw 'no such var ' + id;
    }

    var variable = env.variables[id];
    return variable;
  };
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

    var callEnvironment = {svg: env.svg, variables: {}, functions: {}};
    actuals.forEach((actual, i) => {
      callEnvironment[f.formals[i]] = actual.evaluate(env);
    });

    f.body.evaluate(callEnvironment);
  };
}

// --------------------------------------------------------------------------- 
//
// ---------------------------------------------------------------------------

function Block(statements) {
  this.evaluate = function(env) {
    var result = null;
    statements.forEach(statement => {
      console.log("statement:", statement);
      result = statement.evaluate(env)
    });
    return result;
  }
}

// --------------------------------------------------------------------------- 

function ExpressionAssignment(l, r) {
  this.evaluate = function(env) {
    console.log("l:", l);
    console.log("r:", r);
  }
}

// --------------------------------------------------------------------------- 

function ExpressionProperty(base, property) {
  this.evaluate = function(env) {
    console.log("base:", base);
    console.log("property:", property);
  }
}

// --------------------------------------------------------------------------- 

function ExpressionVector(elements) {
  this.evaluate = function(env) {
    return 0;
  }
}

