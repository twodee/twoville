import { Tokens } from './token.js';

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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
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
  },
  isTimeSensitive: function(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
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
  },
  isTimeSensitive: function(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
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
  },
  isTimeSensitive: function(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
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
  },
  isTimeSensitive: function(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
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
  },
  isTimeSensitive: function(env) {
    return false;
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
    if (value != null) {
      return value;
    } else {
      throw this.token.where.debugPrefix() + "I'm sorry, but I don't know anything about " + this.token.source + ".";
    }
  },
  assign: function(env, fromTime, toTime, rhs) {
    let value;
    if (rhs.isTimeSensitive(env)) {
      value = rhs;
    } else {
      value = rhs.evaluate(env, fromTime, toTime);
    }
    env.bind(this.token.source, fromTime, toTime, value);
    return value;
  },
  isTimeSensitive: function(env) {
    return this.token.type == Tokens.T;
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
  },
  isTimeSensitive: function(env) {
    if (!env.has(this.name)) {
      throw 'no such func ' + name;
    }
    let f = env.bindings[this.name];
    return f.body.isTimeSensitive(env);
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
      result = statement.evaluate(env, a, toTime);
    });
    return result;
  },
  isTimeSensitive: function(env) {
    return this.statements.some(s => s.isTimeSensitive(env));
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
      return this.l.assign(env, fromTime, toTime, this.r);
    } else {
      throw 'unassignable';
    }
  },
  isTimeSensitive: function(env) {
    return this.r.isTimeSensitive(env);
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
    let start = this.start.evaluate(env, fromTime, toTime).get();
    let stop = this.stop.evaluate(env, fromTime, toTime).get();
    let by = this.by.evaluate(env, fromTime, toTime).get();

    for (let i = start; i <= stop; i += by) {
      ExpressionAssignment.create(this.i, TwovilleInteger.create(i)).evaluate(env, fromTime, toTime);
      this.body.evaluate(env, fromTime, toTime);
    }
  },
  isTimeSensitive: function(env) {
    return this.start.isTimeSensitive(env) || this.stop.isTimeSensitive(env) || this.by.isTimeSensitive(env) || this.body.isTimeSensitive(env);
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
    let object = this.base.evaluate(env, fromTime, toTime); 
    let value = ExpressionAssignment.create(this.property, rhs).evaluate(object, fromTime, toTime);
    return value;
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return this.elements.some(e => e.isTimeSensitive(env));
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return this.count.isTimeSensitive(env) || this.body.isTimeSensitive(env);
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
  },
  isTimeSensitive: function(env) {
    return this.scope.isTimeSensitive(env) || this.body.isTimeSensitive(env);
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
  }
};

// --------------------------------------------------------------------------- 

export let ExpressionPrint = {
  create: function(parent) {
    return Object.create(ExpressionPrint);
  },
  evaluate: function(env, fromTime, toTime) {
    let message = env['message'].get();
    log(message.toString(fromTime, toTime));
    return null;
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
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
  },
  isTimeSensitive: function(env) {
    return false;
  }
};

// --------------------------------------------------------------------------- 
