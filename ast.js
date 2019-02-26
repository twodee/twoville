let namespace = "http://www.w3.org/2000/svg";

// --------------------------------------------------------------------------- 
// PRIMITIVES
// --------------------------------------------------------------------------- 

let ExpressionBoolean = {
  create: function(x) {
    let instance = Object.create(ExpressionBoolean);
    return Object.assign(instance, {x: x});
  },
  evaluate: function(env, fromTime, toTime) {
    return TwovilleBoolean.create(this.x);
  }
}

// --------------------------------------------------------------------------- 

let ExpressionInteger = {
  create: function(x) {
    let instance = Object.create(ExpressionInteger);
    return Object.assign(instance, {x: x});
  },
  evaluate: function(env, fromTime, toTime) {
    return TwovilleInteger.create(this.x);
  }
};

// --------------------------------------------------------------------------- 

let ExpressionString = {
  create: function(x) {
    let instance = Object.create(ExpressionString);
    return Object.assign(instance, {x: x});
  },
  evaluate: function(env, fromTime, toTime) {
    return TwovilleString.create(this.x);
  }
};

// --------------------------------------------------------------------------- 

let ExpressionReal = {
  create: function(x) {
    let instance = Object.create(ExpressionReal);
    return Object.assign(instance, {x: x});
  },
  evaluate: function(env, fromTime, toTime) {
    return TwovilleReal.create(this.x);
  }
};

// --------------------------------------------------------------------------- 
// ARITHMETIC
// --------------------------------------------------------------------------- 

let ExpressionAdd = {
  create: function(a, b) {
    let instance = Object.create(ExpressionAdd);
    return Object.assign(instance, {a: a, b: b});
  },
  evaluate: function(env, fromTime, toTime) {
    let evalA = this.a.evaluate(env, fromTime, toTime);
    let evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.add(evalB);
  }
};

// --------------------------------------------------------------------------- 

let ExpressionSubtract = {
  create: function(a, b) {
    let instance = Object.create(ExpressionSubtract);
    return Object.assign(instance, {a: a, b: b});
  },
  evaluate: function(env, fromTime, toTime) {
    let evalA = this.a.evaluate(env, fromTime, toTime);
    let evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.subtract(evalB);
  }
};

// --------------------------------------------------------------------------- 

let ExpressionMultiply = {
  create: function(a, b) {
    let instance = Object.create(ExpressionMultiply);
    return Object.assign(instance, {a: a, b: b});
  },
  evaluate: function(env, fromTime, toTime) {
    let evalA = this.a.evaluate(env, fromTime, toTime);
    let evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.multiply(evalB);
  }
};

// --------------------------------------------------------------------------- 

let ExpressionDivide = {
  create: function(a, b) {
    let instance = Object.create(ExpressionDivide);
    return Object.assign(instance, {a: a, b: b});
  },
  evaluate: function(env, fromTime, toTime) {
    let evalA = this.a.evaluate(env, fromTime, toTime);
    let evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.divide(evalB);
  }
};

// --------------------------------------------------------------------------- 

let ExpressionRemainder = {
  create: function(a, b) {
    let instance = Object.create(ExpressionRemainder);
    return Object.assign(instance, {a: a, b: b});
  },
  evaluate: function(env, fromTime, toTime) {
    let evalA = this.a.evaluate(env, fromTime, toTime);
    let evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.remainder(evalB);
  }
};

// --------------------------------------------------------------------------- 

let ExpressionFunctionDefinition = {
  create: function(name, formals, body) {
    let instance = Object.create(ExpressionFunctionDefinition);
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

let ExpressionIdentifier = {
  create: function(token) {
    let instance = Object.create(ExpressionIdentifier);
    return Object.assign(instance, {token: token});
  },
  evaluate: function(env, fromTime, toTime) {
    let value = env.get(this.token.source);
    if (value) {
      return value;
    } else {
      throw this.token.where.debugPrefix() + "I'm sorry, but I don't know anything about " + this.token.source + ".";
    }
  },
  assign: function(env, fromTime, toTime, rhs) {
    console.log("rhs:", rhs);
    console.log("this:", this);
    let value = rhs.evaluate(env, fromTime, toTime);
    env.bind(this.token.source, fromTime, toTime, value);
    return value;
  }
};

// --------------------------------------------------------------------------- 

let ExpressionFunctionCall = {
  create: function(name, actuals) {
    let instance = Object.create(ExpressionFunctionCall);
    return Object.assign(instance, {
      name: name,
      actuals: actuals
    });
  },
  evaluate: function(env, fromTime, toTime) {
    if (!env.has(this.name)) {
      throw 'no such func ' + name;
    }

    let f = env.bindings[this.name];

    if (this.actuals.length != f.formals.length) {
      throw 'params mismatch!';
    }

    let callEnvironment = {svg: env.svg, bindings: {}, shapes: env.shapes};
    this.actuals.forEach((actual, i) => {
      callEnvironment[f.formals[i]] = actual.evaluate(env, fromTime, toTime);
    });

    let returnValue = f.body.evaluate(callEnvironment, fromTime, toTime);
    return returnValue;
  }
};

// --------------------------------------------------------------------------- 
//
// ---------------------------------------------------------------------------

let Block = {
  create: function(statements) {
    let instance = Object.create(Block);
    return Object.assign(instance, {statements: statements});
  },
  evaluate: function(env, fromTime, toTime) {
    let result = null;
    this.statements.forEach(function(statement) {
      result = statement.evaluate(env, fromTime, toTime);
    });
    return result;
  }
};

// --------------------------------------------------------------------------- 

let ExpressionAssignment = {
  create: function(l, r) {
    let instance = Object.create(ExpressionAssignment);
    return Object.assign(instance, {l: l, r: r});
  },
  evaluate: function(env, fromTime, toTime) {
    if ('assign' in this.l) {
      console.log("this.l:", this.l);
      console.log("env:", env);
      return this.l.assign(env, fromTime, toTime, this.r);
    } else {
      throw 'unassignable';
    }
  }
};

// --------------------------------------------------------------------------- 

let ExpressionFor = {
  create: function(i, start, stop, by, body) {
    let instance = Object.create(ExpressionFor);
    return Object.assign(instance, {
      i: i,
      start: start,
      stop: stop,
      by: by,
      body: body
    });
  },
  evaluate: function(env, fromTime, toTime) {
    start = this.start.evaluate(env, fromTime, toTime).get();
    stop = this.stop.evaluate(env, fromTime, toTime).get();
    by = this.by.evaluate(env, fromTime, toTime).get();
    // iterator = this.by.evaluate(env, fromTime, toTime);

    console.log("start:", start);
    console.log("stop:", stop);
    console.log("by:", by);
    console.log("this.i:", this.i);

    for (let i = start; i <= stop; i += by) {
      ExpressionAssignment.create(this.i, TwovilleInteger.create(i)).evaluate(env, fromTime, toTime);
      this.body.evaluate(env, fromTime, toTime);
    }
  }
};

// --------------------------------------------------------------------------- 

let ExpressionProperty = {
  create: function(base, property) {
    let instance = Object.create(ExpressionProperty);
    return Object.assign(instance, {base: base, property: property});
  },
  evaluate: function(env, fromTime, toTime) {
    let object = this.base.evaluate(env, fromTime, toTime); 
    return this.property.evaluate(object);
  },
  assign: function(env, fromTime, toTime, rhs) {
    let value = rhs.evaluate(env, fromTime, toTime);
    let object = this.base.evaluate(env, fromTime, toTime); 
    ExpressionAssignment.create(this.property, value).evaluate(object, fromTime, toTime);
    return value;
  }
};

// --------------------------------------------------------------------------- 

let ExpressionVector = {
  create: function(elements) {
    let instance = Object.create(ExpressionVector);
    return Object.assign(instance, {elements: elements});
  },
  evaluate: function(env, fromTime, toTime) {
    let values = this.elements.map(element => {
      return element.evaluate(env, fromTime, toTime);
    });
    return TwovilleVector.create(values);
  }
};

// --------------------------------------------------------------------------- 

let StatementFrom = {
  create: function(fromTimeExpression, block) {
    let instance = Object.create(StatementFrom);
    return Object.assign(instance, {
      fromTimeExpression: fromTimeExpression,
      block: block
    });
  },
  evaluate: function(env, fromTime, toTime) {
    let fromTime = this.fromTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, fromTime, null);
  }
};

// --------------------------------------------------------------------------- 

let StatementTo = {
  create: function(toTimeExpression, block) {
    let instance = Object.create(StatementTo);
    return Object.assign(instance, {
      toTimeExpression: toTimeExpression,
      block: block
    });
  },
  evaluate: function(env, fromTime, toTime) {
    let toTime = this.toTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, null, toTime);
  }
};

// --------------------------------------------------------------------------- 

let StatementBetween = {
  create: function(fromTimeExpression, toTimeExpression, block) {
    let instance = Object.create(StatementBetween);
    return Object.assign(instance, {
      fromTimeExpression: fromTimeExpression,
      toTimeExpression: toTimeExpression,
      block: block
    });
  },
  evaluate: function(env, fromTime, toTime) {
    let fromTime = this.fromTimeExpression.evaluate(env, fromTime, toTime);
    let toTime = this.toTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, fromTime, toTime);
  }
};

// --------------------------------------------------------------------------- 

let StatementThrough = {
  create: function(throughTimeExpression, block) {
    let instance = Object.create(StatementThrough);
    return Object.assign(instance, {
      throughTimeExpression: throughTimeExpression,
      block: block
    });
  },
  evaluate: function(env, fromTime, toTime) {
    let throughTime = this.throughTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, null, throughTime);
    this.block.evaluate(env, throughTime, null);
  }
};

// --------------------------------------------------------------------------- 

let ExpressionRepeat = {
  create: function(count, body) {
    let instance = Object.create(ExpressionRepeat);
    return Object.assign(instance, {
      count: count,
      body: body
    });
  },
  evaluate: function(env, fromTime, toTime) {
    let count = this.count.evaluate(env, fromTime, toTime);
    let last = null;
    for (let i = 0; i < count; ++i) {
      last = this.body.evaluate(env, fromTime, toTime);
    }
    return last;
  }
};

// --------------------------------------------------------------------------- 

let ExpressionWith = {
  create: function(scope, body) {
    let instance = Object.create(ExpressionWith);
    return Object.assign(instance, {
      scope: scope,
      body: body
    });
  },
  evaluate: function(env, fromTime, toTime) {
    let withEnv = this.scope.evaluate(env, fromTime, toTime);
    withEnv.parent = env;
    this.body.evaluate(withEnv, fromTime, toTime);
    return withEnv;
  }
};

// --------------------------------------------------------------------------- 
