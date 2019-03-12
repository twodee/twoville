import { Tokens } from './token.js';
import { log } from './main.js';

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

export class Expression {
  constructor(sourceStart, sourceEnd) {
    this.sourceStart = sourceStart;
    this.sourceEnd = sourceEnd;
  }

  isTimeSensitive(env) {
    return false;
  }
}

export class ExpressionBoolean extends Expression {
  constructor(sourceStart, sourceEnd, x) {
    super(sourceStart, sourceEnd);
    this.x = x;
  }

  evaluate(env, fromTime, toTime) {
    return new TwovilleBoolean(this.x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionInteger extends Expression {
  constructor(sourceStart, sourceEnd, x) {
    super(sourceStart, sourceEnd);
    this.x = x;
  }

  evaluate(env, fromTime, toTime) {
    return new TwovilleInteger(this.x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionString extends Expression {
  constructor(sourceStart, sourceEnd, x) {
    super(sourceStart, sourceEnd);
    this.x = x;
  }

  evaluate(env, fromTime, toTime) {
    return new TwovilleString(this.x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionReal extends Expression {
  constructor(sourceStart, sourceEnd, x) {
    super(sourceStart, sourceEnd);
    this.x = x;
  }

  evaluate(env, fromTime, toTime) {
    return new TwovilleReal(this.x);
  }
}

// --------------------------------------------------------------------------- 
// ARITHMETIC
// --------------------------------------------------------------------------- 

export class ExpressionAdd extends Expression {
  constructor(sourceStart, sourceEnd, a, b) {
    super(sourceStart, sourceEnd);
    this.a = a;
    this.b = b;
  }

  evaluate(env, fromTime, toTime) {
    let evalA = this.a.evaluate(env, fromTime, toTime);
    let evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.add(evalB);
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSubtract extends Expression {
  constructor(sourceStart, sourceEnd, a, b) {
    super(sourceStart, sourceEnd);
    this.a = a;
    this.b = b;
  }

  evaluate(env, fromTime, toTime) {
    let evalA = this.a.evaluate(env, fromTime, toTime);
    let evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.subtract(evalB);
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMultiply extends Expression {
  constructor(sourceStart, sourceEnd, a, b) {
    super(sourceStart, sourceEnd);
    this.a = a;
    this.b = b;
  }

  evaluate(env, fromTime, toTime) {
    let evalA = this.a.evaluate(env, fromTime, toTime);
    let evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.multiply(evalB);
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionDivide extends Expression {
  constructor(sourceStart, sourceEnd, a, b) {
    super(sourceStart, sourceEnd);
    this.a = a;
    this.b = b;
  }

  evaluate(env, fromTime, toTime) {
    let evalA = this.a.evaluate(env, fromTime, toTime);
    let evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.divide(evalB);
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRemainder extends Expression {
  constructor(sourceStart, sourceEnd, a, b) {
    super(sourceStart, sourceEnd);
    this.a = a;
    this.b = b;
  }

  evaluate(env, fromTime, toTime) {
    let evalA = this.a.evaluate(env, fromTime, toTime);
    let evalB = this.b.evaluate(env, fromTime, toTime);
    return evalA.remainder(evalB);
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionFunctionDefinition extends Expression {
  constructor(sourceStart, sourceEnd, name, formals, body) {
    super(sourceStart, sourceEnd);
    this.name = name;
    this.formals = formals;
    this.body = body;
  }

  evaluate(env, fromTime, toTime) {
    env.bindings[name] = {
      name: this.name,
      formals: this.formals,
      body: this.body
    };
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionIdentifier extends Expression {
  constructor(sourceStart, sourceEnd, token) {
    super(sourceStart, sourceEnd);
    this.token = token;
  }

  evaluate(env, fromTime, toTime) {
    let value = env.get(this.token.source);
    if (value != null) {
      return value;
    } else {
      throw this.token.where.debugPrefix() + "I'm sorry, but I don't know anything about " + this.token.source + ".";
    }
  }

  assign(env, fromTime, toTime, rhs) {
    let value;
    if (rhs.isTimeSensitive(env)) {
      value = rhs;
    } else {
      value = rhs.evaluate(env, fromTime, toTime);
    }
    env.bind(this.token.source, fromTime, toTime, value);
    return value;
  }

  isTimeSensitive(env) {
    return this.token.type == Tokens.T;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionFunctionCall extends Expression {
  constructor(sourceStart, sourceEnd, name, actuals) {
    super(sourceStart, sourceEnd);
    this.name = name;
    this.actuals = actuals;
  }

  evaluate(env, fromTime, toTime) {
    if (!env.has(this.name)) {
      throw 'no such func ' + name;
    }

    let f = env.get(this.name);

    if (this.actuals.length != f.formals.length) {
      throw 'params mismatch!';
    }

    let callEnvironment = {svg: env.svg, bindings: {}, parent: env, shapes: env.shapes};
    this.actuals.forEach((actual, i) => {
      callEnvironment[f.formals[i]] = actual.evaluate(env, fromTime, toTime);
    });

    let returnValue = f.body.evaluate(callEnvironment, fromTime, toTime);
    return returnValue;
  }

  isTimeSensitive(env) {
    if (!env.has(this.name)) {
      throw 'no such func ' + name;
    }
    let f = env.get(this.name);
    return f.body.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 
//
// ---------------------------------------------------------------------------

export class ExpressionBlock extends Expression {
  constructor(sourceStart, sourceEnd, statements) {
    super(sourceStart, sourceEnd);
    this.statements = statements;
  }

  evaluate(env, a, toTime) {
    let result = null;
    this.statements.forEach(function(statement) {
      result = statement.evaluate(env, a, toTime);
    });
    return result;
  }

  isTimeSensitive(env) {
    return this.statements.some(s => s.isTimeSensitive(env));
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionAssignment extends Expression {
  constructor(sourceStart, sourceEnd, l, r) {
    super(sourceStart, sourceEnd);
    this.l = l;
    this.r = r;
  }

  evaluate(env, fromTime, toTime) {
    if ('assign' in this.l) {
      return this.l.assign(env, fromTime, toTime, this.r);
    } else {
      throw 'unassignable';
    }
  }

  isTimeSensitive(env) {
    return this.l.isTimeSensitive(env) || this.r.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionFor extends Expression {
  constructor(sourceStart, sourceEnd, i, start, stop, by, body) {
    super(sourceStart, sourceEnd);
    this.i = i;
    this.start = start;
    this.stop = stop;
    this.by = by;
    this.body = body;
  }

  evaluate(env, fromTime, toTime) {
    let start = this.start.evaluate(env, fromTime, toTime).get();
    let stop = this.stop.evaluate(env, fromTime, toTime).get();
    let by = this.by.evaluate(env, fromTime, toTime).get();

    for (let i = start; i <= stop; i += by) {
      new ExpressionAssignment(null, null, this.i, new TwovilleInteger(i)).evaluate(env, fromTime, toTime);
      this.body.evaluate(env, fromTime, toTime);
    }
  }

  isTimeSensitive(env) {
    return this.start.isTimeSensitive(env) || this.stop.isTimeSensitive(env) || this.by.isTimeSensitive(env) || this.body.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionProperty extends Expression {
  constructor(sourceStart, sourceEnd, base, property) {
    super(sourceStart, sourceEnd);
    this.base = base;
    this.property = property;
  }

  evaluate(env, fromTime, toTime) {
    let object = this.base.evaluate(env, fromTime, toTime); 
    return this.property.evaluate(object);
  }

  assign(env, fromTime, toTime, rhs) {
    let object = this.base.evaluate(env, fromTime, toTime); 
    let value = new ExpressionAssignment(null, null, this.property, rhs).evaluate(object, fromTime, toTime);
    return value;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVector extends Expression {
  constructor(sourceStart, sourceEnd, elements) {
    super(sourceStart, sourceEnd);
    this.elements = elements;
  }

  evaluate(env, fromTime, toTime) {
    let values = this.elements.map(element => {
      return element.evaluate(env, fromTime, toTime);
    });
    return new TwovilleVector(values);
  }

  isTimeSensitive(env) {
    return this.elements.some(e => e.isTimeSensitive(env));
  }
}

// --------------------------------------------------------------------------- 

export class StatementFrom extends Expression {
  constructor(sourceStart, sourceEnd, fromTimeExpression, block) {
    super(sourceStart, sourceEnd);
    this.fromTimeExpression = fromTimeExpression;
    this.block = block;
  }

  evaluate(env, fromTime, toTime) {
    let realFromTime = this.fromTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, realFromTime, null);
  }
}

// --------------------------------------------------------------------------- 

export class StatementTo extends Expression {
  constructor(sourceStart, sourceEnd, toTimeExpression, block) {
    super(sourceStart, sourceEnd);
    this.toTimeExpression = toTimeExpression;
    this.block = block;
  }

  evaluate(env, fromTime, toTime) {
    let realToTime = this.toTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, null, realToTime);
  }
}

// --------------------------------------------------------------------------- 

export class StatementBetween extends Expression {
  constructor(sourceStart, sourceEnd, fromTimeExpression, toTimeExpression, block) {
    super(sourceStart, sourceEnd);
    this.fromTimeExpression = fromTimeExpression;
    this.toTimeExpression = toTimeExpression;
    this.block = block;
  }

  evaluate(env, fromTime, toTime) {
    let realFromTime = this.fromTimeExpression.evaluate(env, fromTime, toTime);
    let realToTime = this.toTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, realFromTime, realToTime);
  }
}

// --------------------------------------------------------------------------- 

export class StatementThrough extends Expression {
  constructor(sourceStart, sourceEnd, throughTimeExpression, block) {
    super(sourceStart, sourceEnd);
    this.throughTimeExpression = throughTimeExpression;
  }

  evaluate(env, fromTime, toTime) {
    let throughTime = this.throughTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, null, throughTime);
    this.block.evaluate(env, throughTime, null);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRepeat extends Expression {
  constructor(sourceStart, sourceEnd, count, body) {
    super(sourceStart, sourceEnd);
    this.count = count;
    this.body = body;
  }

  evaluate(env, fromTime, toTime) {
    let count = this.count.evaluate(env, fromTime, toTime);
    let last = null;
    for (let i = 0; i < count; ++i) {
      last = this.body.evaluate(env, fromTime, toTime);
    }
    return last;
  }

  isTimeSensitive(env) {
    return this.count.isTimeSensitive(env) || this.body.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionWith extends Expression {
  constructor(sourceStart, sourceEnd, scope, body) {
    super(sourceStart, sourceEnd);
    this.scope = scope;
    this.body = body;
  }

  evaluate(env, fromTime, toTime) {
    let withEnv = this.scope.evaluate(env, fromTime, toTime);
    withEnv.parent = env;
    this.body.evaluate(withEnv, fromTime, toTime);
    return withEnv;
  }

  isTimeSensitive(env) {
    return this.scope.isTimeSensitive(env) || this.body.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRectangle extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime) {
    let r = new TwovilleRectangle(env);
    env.shapes.push(r);
    return r;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLine extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime) {
    let r = new TwovilleLine(env);
    env.shapes.push(r);
    return r;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionText extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime) {
    let r = new TwovilleText(env);
    env.shapes.push(r);
    return r;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCircle extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime) {
    let c = new TwovilleCircle(env);
    env.shapes.push(c);
    return c;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPrint extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime) {
    let message = env['message'].get();
    log(message.toString(fromTime, toTime));
    return null;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRandom extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime) {
    let min = env['min'].get();
    let max = env['max'].get();
    let x = Math.random() * (max - min) + min;
    return new TwovilleReal(x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSine extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime) {
    let degrees = env['degrees'].get();
    let x = Math.sin(degrees * Math.PI / 180);
    return new TwovilleReal(x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCosine extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime) {
    let degrees = env['degrees'].get();
    let x = Math.cos(degrees * Math.PI / 180);
    return new TwovilleReal(x);
  }
}

// --------------------------------------------------------------------------- 

// The casting function.
export class ExpressionInt extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime) {
    let f = env['x'].get();
    let i = Math.trunc(f);
    return new TwovilleInteger(i);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionGroup extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime) {
    let group = new TwovilleGroup(env);
    env.shapes.push(group);
    return group;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMask extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime) {
    let mask = new TwovilleMask(env);
    env.shapes.push(mask);
    return mask;
  }
}

// --------------------------------------------------------------------------- 
