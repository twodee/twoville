var namespace = "http://www.w3.org/2000/svg";

// --------------------------------------------------------------------------- 
// PRIMITIVES
// --------------------------------------------------------------------------- 

var ExpressionInteger = {
  create: function(x) {
    var instance = Object.create(ExpressionInteger);
    return Object.assign(instance, {x: x});
  },
  evaluate: function(env, fromTime, toTime) {
    return TwovilleInteger.create(this.x);
  }
};

// --------------------------------------------------------------------------- 

var ExpressionReal = {
  create: function(x) {
    var instance = Object.create(ExpressionReal);
    return Object.assign(instance, {x: x});
  },
  evaluate: function(env, fromTime, toTime) {
    return TwovilleReal.create(this.x);
  }
};

// --------------------------------------------------------------------------- 
// ARITHMETIC
// --------------------------------------------------------------------------- 

var ExpressionAdd = {
  create: function(a, b) {
    var instance = Object.create(ExpressionAdd);
    return Object.assign(instance, {a: a, b: b});
  },
  evaluate: function(env, fromTime, toTime) {
    var evalA = this.a.evaluate(env, fromTime, toTime);
    var evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.add(evalB);
  }
};

// --------------------------------------------------------------------------- 

var ExpressionSubtract = {
  create: function(a, b) {
    var instance = Object.create(ExpressionSubtract);
    return Object.assign(instance, {a: a, b: b});
  },
  evaluate: function(env, fromTime, toTime) {
    var evalA = this.a.evaluate(env, fromTime, toTime);
    var evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.subtract(evalB);
  }
};

// --------------------------------------------------------------------------- 

var ExpressionMultiply = {
  create: function(a, b) {
    var instance = Object.create(ExpressionMultiply);
    return Object.assign(instance, {a: a, b: b});
  },
  evaluate: function(env, fromTime, toTime) {
    var evalA = this.a.evaluate(env, fromTime, toTime);
    var evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.multiply(evalB);
  }
};

// --------------------------------------------------------------------------- 

var ExpressionDivide = {
  create: function(a, b) {
    var instance = Object.create(ExpressionDivide);
    return Object.assign(instance, {a: a, b: b});
  },
  evaluate: function(env, fromTime, toTime) {
    var evalA = this.a.evaluate(env, fromTime, toTime);
    var evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.divide(evalB);
  }
};

// --------------------------------------------------------------------------- 

var ExpressionRemainder = {
  create: function(a, b) {
    var instance = Object.create(ExpressionRemainder);
    return Object.assign(instance, {a: a, b: b});
  },
  evaluate: function(env, fromTime, toTime) {
    var evalA = this.a.evaluate(env, fromTime, toTime);
    var evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.remainder(evalB);
  }
};

// --------------------------------------------------------------------------- 

var ExpressionFunctionDefinition = {
  create: function(name, formals, body) {
    var instance = Object.create(ExpressionFunctionDefinition);
    return Object.assign(instance, {name: name, formals: formals, body: body});
  },
  evaluate: function(env, fromTime, toTime) {
    env.bindings[name] = {
      name: this.name,
      formals: this.formals,
      body: this.body
    };
  }
};

// --------------------------------------------------------------------------- 

var ExpressionIdentifier = {
  create: function(token) {
    var instance = Object.create(ExpressionIdentifier);
    return Object.assign(instance, {token: token});
  },
  evaluate: function(env, fromTime, toTime) {
    var value = env.get(this.token.source);
    if (value) {
      return value;
    } else {
      throw this.token.where.debugPrefix() + "I'm sorry, but I don't know anything about " + this.token.source + ".";
    }
  },
  assign: function(env, fromTime, toTime, rhs) {
    var value = rhs.evaluate(env, fromTime, toTime);
    env.bind(this.token.source, fromTime, toTime, value);
    return value;
  }
};

// --------------------------------------------------------------------------- 

var ExpressionFunctionCall = {
  create: function(name, actuals) {
    var instance = Object.create(ExpressionFunctionCall);
    return Object.assign(instance, {
      name: name,
      actuals: actuals
    });
  },
  evaluate: function(env, fromTime, toTime) {
    if (!env.has(this.name)) {
      throw 'no such func ' + name;
    }

    var f = env.bindings[this.name];

    if (this.actuals.length != f.formals.length) {
      throw 'params mismatch!';
    }

    var callEnvironment = {svg: env.svg, bindings: {}, shapes: env.shapes};
    this.actuals.forEach((actual, i) => {
      callEnvironment[f.formals[i]] = actual.evaluate(env, fromTime, toTime);
    });

    var returnValue = f.body.evaluate(callEnvironment, fromTime, toTime);
    return returnValue;
  }
};

// --------------------------------------------------------------------------- 
//
// ---------------------------------------------------------------------------

var Block = {
  create: function(statements) {
    var instance = Object.create(Block);
    return Object.assign(instance, {statements: statements});
  },
  evaluate: function(env, fromTime, toTime) {
    var result = null;
    this.statements.forEach(statement => {
      result = statement.evaluate(env, fromTime, toTime)
    });
    return result;
  }
};

// --------------------------------------------------------------------------- 

var ExpressionAssignment = {
  create: function(l, r) {
    var instance = Object.create(ExpressionAssignment);
    return Object.assign(instance, {l: l, r: r});
  },
  evaluate: function(env, fromTime, toTime) {
    if ('assign' in this.l) {
      return this.l.assign(env, fromTime, toTime, this.r);
    } else {
      throw 'unassignable';
    }
  }
};

// --------------------------------------------------------------------------- 

var ExpressionProperty = {
  create: function(base, property) {
    var instance = Object.create(ExpressionProperty);
    return Object.assign(instance, {base: base, property: property});
  },
  evaluate: function(env, fromTime, toTime) {
    var object = this.base.evaluate(env, fromTime, toTime); 
    return this.property.evaluate(object);
  },
  assign: function(env, fromTime, toTime, rhs) {
    var value = rhs.evaluate(env, fromTime, toTime);
    var object = this.base.evaluate(env, fromTime, toTime); 
    ExpressionAssignment.create(this.property, value).evaluate(object, fromTime, toTime);
    return value;
  }
};

// --------------------------------------------------------------------------- 

var ExpressionVector = {
  create: function(elements) {
    var instance = Object.create(ExpressionVector);
    return Object.assign(instance, {elements: elements});
  },
  evaluate: function(env, fromTime, toTime) {
    var values = this.elements.map(element => {
      return element.evaluate(env, fromTime, toTime);
    });
    return TwovilleVector.create(values);
  }
};

// --------------------------------------------------------------------------- 

var StatementFrom = {
  create: function(fromTimeExpression, block) {
    var instance = Object.create(StatementFrom);
    return Object.assign(instance, {
      fromTimeExpression: fromTimeExpression,
      block: block
    });
  },
  evaluate: function(env, fromTime, toTime) {
    var fromTime = this.fromTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, fromTime, null);
  }
};

// --------------------------------------------------------------------------- 

var StatementTo = {
  create: function(toTimeExpression, block) {
    var instance = Object.create(StatementTo);
    return Object.assign(instance, {
      toTimeExpression: toTimeExpression,
      block: block
    });
  },
  evaluate: function(env, fromTime, toTime) {
    var toTime = this.toTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, null, toTime);
  }
};

// --------------------------------------------------------------------------- 

var StatementBetween = {
  create: function(fromTimeExpression, toTimeExpression, block) {
    var instance = Object.create(StatementBetween);
    return Object.assign(instance, {
      fromTimeExpression: fromTimeExpression,
      toTimeExpression: toTimeExpression,
      block: block
    });
  },
  evaluate: function(env, fromTime, toTime) {
    var fromTime = this.fromTimeExpression.evaluate(env, fromTime, toTime);
    var toTime = this.toTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, fromTime, toTime);
  }
};

// --------------------------------------------------------------------------- 

var StatementThrough = {
  create: function(throughTimeExpression, block) {
    var instance = Object.create(StatementThrough);
    return Object.assign(instance, {
      throughTimeExpression: throughTimeExpression,
      block: block
    });
  },
  evaluate: function(env, fromTime, toTime) {
    var throughTime = this.throughTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, null, throughTime);
    this.block.evaluate(env, throughTime, null);
  }
};

// --------------------------------------------------------------------------- 

var ExpressionRepeat = {
  create: function(count, body) {
    var instance = Object.create(ExpressionRepeat);
    return Object.assign(instance, {
      count: count,
      body: body
    });
  },
  evaluate: function(env, fromTime, toTime) {
    var count = this.count.evaluate(env, fromTime, toTime);
    var last = null;
    for (var i = 0; i < count; ++i) {
      last = this.body.evaluate(env, fromTime, toTime);
    }
    return last;
  }
};

// --------------------------------------------------------------------------- 

var StatementWith = {
  create: function(scope, body) {
    var instance = Object.create(StatementWith);
    return Object.assign(instance, {
      scope: scope,
      body: body
    });
  },
  evaluate: function(env, fromTime, toTime) {
    // var id = this.id.source;
    // if (env.has(id)) {
    var withEnv = this.scope.evaluate(env, fromTime, toTime);
    return this.body.evaluate(withEnv, fromTime, toTime);
    // } else {
      // throw 'no such env ' + id;
    // }
  }
};

// --------------------------------------------------------------------------- 
