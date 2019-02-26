import {
  TwovilleBoolean,
  TwovilleInteger,
  TwovilleString,
  TwovilleVector,
  TwovilleRectangle,
  TwovilleLine,
  TwovilleText,
  TwovilleCircle,
  TwovilleGroup,
  TwovilleMask,
  TwovilleReal,
} from "./types.js";

// --------------------------------------------------------------------------- 
// PRIMITIVES
// --------------------------------------------------------------------------- 

export let ExpressionBoolean = {
  create: function(x) {
    let instance = Object.create(ExpressionBoolean);
    return Object.assign(instance, {x: x});
  },
  evaluate: function(env, fromTime, toTime) {
    return TwovilleBoolean.create(this.x);
  }
}

// --------------------------------------------------------------------------- 

export let ExpressionInteger = {
  create: function(x) {
    let instance = Object.create(ExpressionInteger);
    return Object.assign(instance, {x: x});
  },
  evaluate: function(env, fromTime, toTime) {
    return TwovilleInteger.create(this.x);
  }
};

// --------------------------------------------------------------------------- 

export let ExpressionString = {
  create: function(x) {
    let instance = Object.create(ExpressionString);
    return Object.assign(instance, {x: x});
  },
  evaluate: function(env, fromTime, toTime) {
    return TwovilleString.create(this.x);
  }
};

// --------------------------------------------------------------------------- 

export let ExpressionReal = {
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

export let ExpressionAdd = {
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

export let ExpressionSubtract = {
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

export let ExpressionMultiply = {
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

export let ExpressionDivide = {
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

export let ExpressionRemainder = {
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

export let ExpressionFunctionDefinition = {
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

export let ExpressionIdentifier = {
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

export let ExpressionFunctionCall = {
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

export let ExpressionBlock = {
  create: function(statements) {
    let instance = Object.create(ExpressionBlock);
    return Object.assign(instance, {statements: statements});
  },
  evaluate: function(env, a, toTime) {
    let result = null;
    this.statements.forEach(function(statement) {
      console.log("statement:", statement);
      result = statement.evaluate(env, a, toTime);
    });
    return result;
  }
};

// --------------------------------------------------------------------------- 

export let ExpressionAssignment = {
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

export let ExpressionFor = {
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

export let ExpressionProperty = {
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

export let ExpressionVector = {
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

export let StatementFrom = {
  create: function(fromTimeExpression, block) {
    let instance = Object.create(StatementFrom);
    return Object.assign(instance, {
      fromTimeExpression: fromTimeExpression,
      block: block,
    });
  },
  evaluate: function(env, fromTime, toTime) {
    let realFromTime = this.fromTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, realFromTime, null);
  }
};

// --------------------------------------------------------------------------- 

export let StatementTo = {
  create: function(toTimeExpression, block) {
    let instance = Object.create(StatementTo);
    return Object.assign(instance, {
      toTimeExpression: toTimeExpression,
      block: block
    });
  },
  evaluate: function(env, fromTime, toTime) {
    let realToTime = this.toTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, null, realToTime);
  }
};

// --------------------------------------------------------------------------- 

export let StatementBetween = {
  create: function(fromTimeExpression, toTimeExpression, block) {
    let instance = Object.create(StatementBetween);
    return Object.assign(instance, {
      fromTimeExpression: fromTimeExpression,
      toTimeExpression: toTimeExpression,
      block: block
    });
  },
  evaluate: function(env, fromTime, toTime) {
    let realFromTime = this.fromTimeExpression.evaluate(env, fromTime, toTime);
    let realToTime = this.toTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, realFromTime, realToTime);
  }
};

// --------------------------------------------------------------------------- 

export let StatementThrough = {
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

export let ExpressionRepeat = {
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

export let ExpressionWith = {
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

export let ExpressionRectangle = {
  create: function(parent) {
    return Object.create(ExpressionRectangle);
  },
  evaluate: function(env, fromTime, toTime) {
    let r = TwovilleRectangle.create(env);
    env.shapes.push(r);
    return r;
  }
};

// --------------------------------------------------------------------------- 

export let ExpressionLine = {
  create: function(parent) {
    return Object.create(ExpressionLine);
  },
  evaluate: function(env, fromTime, toTime) {
    let r = TwovilleLine.create(env);
    env.shapes.push(r);
    return r;
  }
};

// --------------------------------------------------------------------------- 

export let ExpressionText = {
  create: function(parent) {
    return Object.create(ExpressionText);
  },
  evaluate: function(env, fromTime, toTime) {
    let r = TwovilleText.create(env);
    env.shapes.push(r);
    return r;
  }
};

// --------------------------------------------------------------------------- 

export let ExpressionCircle = {
  create: function(parent) {
    return Object.create(ExpressionCircle);
  },
  evaluate: function(env, fromTime, toTime) {
    let c = TwovilleCircle.create(env);
    env.shapes.push(c);
    return c;
  }
};

// --------------------------------------------------------------------------- 

export let ExpressionPrint = {
  create: function(parent) {
    return Object.create(ExpressionPrint);
  },
  evaluate: function(env, fromTime, toTime) {
    let message = env['message'].get();
    console.log("message:", message);
    log(message.toString(fromTime, toTime));
    return null;
  }
}

// --------------------------------------------------------------------------- 

export let ExpressionRandom = {
  create: function(parent) {
    return Object.create(ExpressionRandom);
  },
  evaluate: function(env, fromTime, toTime) {
    let min = env['min'].get();
    let max = env['max'].get();
    let x = Math.random() * (max - min) + min;
    return TwovilleReal.create(x);
  }
}

// --------------------------------------------------------------------------- 

export let ExpressionSine = {
  create: function(parent) {
    return Object.create(ExpressionSine);
  },
  evaluate: function(env, fromTime, toTime) {
    let degrees = env['degrees'].get();
    let x = Math.sin(degrees * Math.PI / 180);
    return TwovilleReal.create(x);
  }
}

// --------------------------------------------------------------------------- 

export let ExpressionCosine = {
  create: function(parent) {
    return Object.create(ExpressionCosine);
  },
  evaluate: function(env, fromTime, toTime) {
    let degrees = env['degrees'].get();
    let x = Math.cos(degrees * Math.PI / 180);
    return TwovilleReal.create(x);
  }
}

// --------------------------------------------------------------------------- 

// The casting function.
export let ExpressionInt = {
  create: function(parent) {
    return Object.create(ExpressionInt);
  },
  evaluate: function(env, fromTime, toTime) {
    let f = env['x'].get();
    let i = Math.trunc(f);
    return TwovilleInteger.create(i);
  }
}

// --------------------------------------------------------------------------- 

export let ExpressionGroup = {
  create: function(parent) {
    return Object.create(ExpressionGroup);
  },
  evaluate: function(env, fromTime, toTime) {
    let group = TwovilleGroup.create(env);
    env.shapes.push(group);
    return group;
  }
};

// --------------------------------------------------------------------------- 

export let ExpressionMask = {
  create: function(parent) {
    return Object.create(ExpressionMask);
  },
  evaluate: function(env, fromTime, toTime) {
    let mask = TwovilleMask.create(env);
    env.shapes.push(mask);
    return mask;
  }
};

// --------------------------------------------------------------------------- 
