import { Tokens } from './token.js';
import { log } from './main.js';

import {
  LocatedException,
  TwovilleEnvironment,
  TwovilleRectangle,
  TwovilleLine,
  TwovilleLabel,
  TwovilleCircle,
  TwovilleGroup,
  TwovilleMask,
  TwovilleCutout,
} from "./types.js";

// --------------------------------------------------------------------------- 
// PRIMITIVES
// --------------------------------------------------------------------------- 

export class Expression {
  constructor(where) {
    this.where = where;
  }

  isTimeSensitive(env) {
    return false;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionData extends Expression {
  constructor(where) {
    super(where);
  }

  bind(env, fromTime, toTime, id) {
    env.bind(id, fromTime, toTime, this);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionBoolean extends ExpressionData {
  constructor(where, x) {
    super(where);
    this.x = x;
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }
   
  toString() {
    return '' + this.x;
  }

  get value() {
    return this.x;
  }

  interpolate(other, proportion) {
    return new ExpressionBoolean(null, proportion <= 0.5 ? this.value : other.value);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionInteger extends ExpressionData {
  constructor(where, x) {
    super(where);
    this.x = x;
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }

  toString() {
    return '' + this.x;
  }

  get value() {
    return this.x;
  }

  add(other) {
    if (other instanceof ExpressionInteger) {
      return new ExpressionInteger(null, this.value + other.value);
    } else if (other instanceof ExpressionReal) {
      return new ExpressionReal(null, this.value + other.value);
    } else {
      throw new MessagedException('Add failed');
    }
  }

  subtract(other) {
    if (other instanceof ExpressionInteger) {
      return new ExpressionInteger(null, this.value - other.value);
    } else if (other instanceof ExpressionReal) {
      return new ExpressionReal(null, this.value - other.value);
    } else {
      throw new MessagedException('Subtract failed');
    }
  }

  multiply(other) {
    if (other instanceof ExpressionInteger) {
      return new ExpressionInteger(null, this.value * other.value);
    } else if (other instanceof ExpressionReal) {
      return new ExpressionReal(null, this.value * other.value);
    } else {
      throw 'bad ****';
    }
  }

  divide(other) {
    if (other instanceof ExpressionInteger) {
      return new ExpressionInteger(null, Math.trunc(this.value / other.value));
    } else if (other instanceof ExpressionReal) {
      return new ExpressionReal(null, this.value / other.value);
    } else {
      throw new MessagedException('Divide failed');
    }
  }

  remainder(other) {
    if (other instanceof ExpressionInteger) {
      return new ExpressionInteger(null, this.value % other.value);
    } else if (other instanceof ExpressionReal) {
      return new ExpressionReal(null, this.value % other.value);
    } else {
      throw new MessagedException('Remainder failed');
    }
  }

  interpolate(other, proportion) {
    return new ExpressionReal(null, this.value + proportion * (other.value - this.value));
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionString extends ExpressionData {
  constructor(where, x) {
    super(where);
    this.x = x;
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }

  toString() {
    return this.x;
  }

  get value() {
    return this.x;
  }

  interpolate(other, proportion) {
    return new ExpressionString(null, proportion <= 0.5 ? this.value : other.value);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionReal extends ExpressionData {
  constructor(where, x) {
    super(where);
    this.x = x;
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }

  toString() {
    return '' + this.x;
  }

  get value() {
    return this.x;
  }

  add(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionReal(null, this.value + other.value);
    } else {
      throw '...';
    }
  }

  subtract(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionReal(null, this.value - other.value);
    } else {
      throw '...';
    }
  }

  multiply(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionReal(null, this.value * other.value);
    } else {
      throw 'BAD *';
    }
  }

  divide(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionReal(null, this.value / other.value);
    } else {
      throw new MessagedException('I can only divide integers and reals.');
    }
  }

  remainder(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionReal(null, this.value % other.value);
    } else {
      throw new MessagedException('I can only compute the remainder for integers and reals.');
    }
  }

  interpolate(other, proportion) {
    return new ExpressionReal(null, this.value + proportion * (other.value - this.value));
  }
}

// --------------------------------------------------------------------------- 
// ARITHMETIC
// --------------------------------------------------------------------------- 

export class ExpressionAdd extends Expression {
  constructor(where, a, b) {
    super(where);
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
  constructor(where, a, b) {
    super(where);
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
  constructor(where, a, b) {
    super(where);
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
  constructor(where, a, b) {
    super(where);
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
  constructor(where, a, b) {
    super(where);
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
  constructor(where, name, formals, body) {
    super(where);
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
  constructor(where, token) {
    super(where);
    this.token = token;
  }

  evaluate(env, fromTime, toTime) {
    let value = env.get(this.token.source);
    if (value != null) {
      return value;
    } else {
      throw new LocatedException(this.token.where, `I'm sorry, but I've never heard of this "${this.token.source}" before.`);
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
  constructor(where, name, actuals) {
    super(where);
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

    let callEnvironment = new TwovilleEnvironment(env);
    this.actuals.forEach((actual, i) => {
      callEnvironment.bind(f.formals[i], null, null, actual.evaluate(env, fromTime, toTime));
    });

    let returnValue = f.body.evaluate(callEnvironment, fromTime, toTime, this);
    return returnValue;
  }

  isTimeSensitive(env) {
    if (!env.has(this.name)) {
      throw 'no such func ' + name;
    }
    let f = env.get(this.name);
    return this.actuals.some((actual, i) => actual.isTimeSensitive(env)) || f.body.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 
//
// ---------------------------------------------------------------------------

export class ExpressionBlock extends Expression {
  constructor(where, statements) {
    super(where);
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
  constructor(where, l, r) {
    super(where);
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
  constructor(where, i, start, stop, by, body) {
    super(where);
    this.i = i;
    this.start = start;
    this.stop = stop;
    this.by = by;
    this.body = body;
  }

  evaluate(env, fromTime, toTime) {
    let start = this.start.evaluate(env, fromTime, toTime).value;
    let stop = this.stop.evaluate(env, fromTime, toTime).value;
    let by = this.by.evaluate(env, fromTime, toTime).value;

    for (let i = start; i <= stop; i += by) {
      new ExpressionAssignment(null, this.i, new ExpressionInteger(null, i)).evaluate(env, fromTime, toTime);
      this.body.evaluate(env, fromTime, toTime);
    }
  }

  isTimeSensitive(env) {
    return this.start.isTimeSensitive(env) || this.stop.isTimeSensitive(env) || this.by.isTimeSensitive(env) || this.body.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionProperty extends Expression {
  constructor(where, base, property) {
    super(where);
    this.base = base;
    this.property = property;
  }

  evaluate(env, fromTime, toTime) {
    let object = this.base.evaluate(env, fromTime, toTime); 
    return this.property.evaluate(object);
  }

  assign(env, fromTime, toTime, rhs) {
    let object = this.base.evaluate(env, fromTime, toTime); 

    let value = null;
    if (object instanceof ExpressionVector) {
      object.forEach(element => {
        value = new ExpressionAssignment(null, this.property, rhs).evaluate(element, fromTime, toTime);
      });
    } else {
      value = new ExpressionAssignment(null, this.property, rhs).evaluate(object, fromTime, toTime);
    }

    return value;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVector extends ExpressionData {
  constructor(where, elements) {
    super(where);
    this.elements = elements;
  }

  evaluate(env, fromTime, toTime) {
    let values = this.elements.map(element => {
      return element.evaluate(env, fromTime, toTime);
    });
    return new ExpressionVector(null, values);
  }

  isTimeSensitive(env) {
    return this.elements.some(e => e.isTimeSensitive(env));
  }

  bind(id, fromTime, toTime, value) {
    this.elements.forEach(element => {
      element.bind(id, fromTime, toTime, value);
    });
  }

  forEach(each) {
    this.elements.forEach(each);
  }

  get(i) {
    return this.elements[i];
  }

  toRGB(env) {
    let r = Math.floor(this.elements[0].value * 255);
    let g = Math.floor(this.elements[1].value * 255);
    let b = Math.floor(this.elements[2].value * 255);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  }

  toString(env) {
    return '[' + this.elements.map(element => element.toString()).join(', ') + ']';
  }

  interpolate(other, proportion) {
    return new ExpressionVector(null, this.elements.map((element, i) => element.interpolate(other.get(i), proportion)));
  }
}

// --------------------------------------------------------------------------- 

export class StatementFrom extends Expression {
  constructor(where, fromTimeExpression, block) {
    super(where);
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
  constructor(where, toTimeExpression, block) {
    super(where);
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
  constructor(where, fromTimeExpression, toTimeExpression, block) {
    super(where);
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
  constructor(where, throughTimeExpression, block) {
    super(where);
    this.throughTimeExpression = throughTimeExpression;
    this.block = block;
  }

  evaluate(env, fromTime, toTime) {
    let throughTime = this.throughTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, null, throughTime);
    this.block.evaluate(env, throughTime, null);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRepeat extends Expression {
  constructor(where, count, body) {
    super(where);
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
  constructor(where, scope, body) {
    super(where);
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

  evaluate(env, fromTime, toTime, callExpression) {
    let r = new TwovilleRectangle(env, callExpression);
    env.shapes.push(r);
    return r;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLine extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let r = new TwovilleLine(env, callExpression);
    env.shapes.push(r);
    return r;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLabel extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let r = new TwovilleLabel(env, callExpression);
    env.shapes.push(r);
    return r;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCircle extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let c = new TwovilleCircle(env, callExpression);
    env.shapes.push(c);
    return c;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPrint extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let message = env.get('message').value;
    log(message.toString(fromTime, toTime));
    return null;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRandom extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let min = env.get('min').value;
    let max = env.get('max').value;
    let x = Math.random() * (max - min) + min;
    return new ExpressionReal(null, x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSine extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let degrees = env.get('degrees').value;
    let x = Math.sin(degrees * Math.PI / 180);
    return new ExpressionReal(null, x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCosine extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let degrees = env.get('degrees').value;
    let x = Math.cos(degrees * Math.PI / 180);
    return new ExpressionReal(null, x);
  }
}

// --------------------------------------------------------------------------- 

// The casting function.
export class ExpressionInt extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let f = env.get('x').value;
    let i = Math.trunc(f);
    return new ExpressionInteger(null, i);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionGroup extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let group = new TwovilleGroup(env, callExpression);
    env.shapes.push(group);
    return group;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMask extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let mask = new TwovilleMask(env, callExpression);
    env.shapes.push(mask);
    return mask;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCutout extends Expression {
  constructor() {
    super(null, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let cutout = new TwovilleCutout(env, callExpression);
    env.shapes.push(cutout);
    return cutout;
  }
}

// --------------------------------------------------------------------------- 
