// https://github.com/danro/jquery-easing/blob/master/jquery.easing.js

import { Tokens } from './token.js';
import { Messager } from './messager.js';

import {
  TwovilleEnvironment,
  TwovilleTimelinedEnvironment,
  MessagedException,
  LocatedException,
  TwovilleCircle,
  TwovilleCutout,
  TwovilleGroup,
  TwovilleLabel,
  TwovilleLine,
  TwovilleMarker,
  TwovilleMask,
  TwovillePath,
  TwovillePathArc,
  TwovillePathJump,
  TwovillePathLine,
  TwovillePathCubic,
  TwovillePathQuadratic,
  TwovilleUngon,
  TwovillePolygon,
  TwovillePolyline,
  TwovilleRectangle,
  TwovilleRotate,
  TwovilleScale,
  TwovilleShear,
  TwovilleTranslate,
  TwovilleTurtle,
  TwovilleTurtleMove,
  TwovilleTurtleTurn,
  TwovilleVertex,
} from "./types.js";

export class FunctionDefinition {
  constructor(name, formals, body) {
    this.name = name;
    this.formals = formals;
    this.body = body;
  }
}

// --------------------------------------------------------------------------- 

export const Precedence = Object.freeze({
  Atom: 100,
  Property: 99,
  Power: 95,
  Not: 90,
  Multiplicative: 80,
  Additive: 70,
  Shift: 65,
  And: 60,
  Or: 59,
  Relational: 50,
  Equality: 45,
  Assignment: 15,
});

// --------------------------------------------------------------------------- 
// INTERPOLANTS
// --------------------------------------------------------------------------- 

function interpolateQuadraticInOut(a, b, proportion) {
  let t = proportion * 2;
  if (t < 1) {
    return a + (b - a) / 2 * t * t;
  } else {
    t -= 1;
    return a - (b - a) / 2 * (t * (t - 2) - 1);
  }
}

function interpolateCubicInOut(a, b, proportion) {
  let t = proportion * 2;
  if (t < 1) {
    return a + (b - a) / 2 * t * t * t;
  } else {
    t -= 2;
    return a + (b - a) / 2 * (t * t * t + 2);
  }
}

function interpolateQuarticInOut(a, b, proportion) {
  let t = proportion * 2;
  if (t < 1) {
    return a + (b - a) / 2 * t * t * t * t;
  } else {
    t -= 2;
    return a - (b - a) / 2 * (t * t * t * t - 2);
  }
}

function interpolateQuinticInOut(a, b, proportion) {
  let t = proportion * 2;
  if (t < 1) {
    return a + (b - a) / 2 * t * t * t * t * t;
  } else {
    t -= 2;
    return a + (b - a) / 2 * (t * t * t * t * t + 2);
  }
}

function interpolateBackInOut(a, b, proportion) {
  let t = proportion * 2;
  let s = 1.70158;
  let u = s * 1.525;
  if (t < 1) {
    return a + (b - a) * 0.5 * t * t * ((u + 1) * t - u);
  } else {
    t -= 2;
    return a + (b - a) * 0.5 * (t * t * ((u + 1) * t + u) + 2);
  }
}

// --------------------------------------------------------------------------- 
// PRIMITIVES
// --------------------------------------------------------------------------- 

export class Expression {
  constructor(precedence, where = null, unevaluated = null) {
    this.precedence = precedence;
    this.where = where;
    this.unevaluated = unevaluated ? unevaluated : this;
  }

  isTimeSensitive(env) {
    return false;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionData extends Expression {
  constructor(type, article, where = null, unevaluated = null, prevalues = null) {
    super(Precedence.Atom, where, unevaluated);
    this.prevalues = prevalues;
    this.type = type;
    this.article = article;
  }

  bind(env, id, fromTime, toTime) {
    env.bind(id, this, fromTime, toTime);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionBoolean extends ExpressionData {
  constructor(x, where = null, unevaluated = null, prevalues = null) {
    super('boolean', 'a', where, unevaluated, prevalues);
    this.x = x;
  }

  clone() {
    return new ExpressionBoolean(this.x, this.where == null ? null : this.where.clone(), this.unevaluated, this.prevalues);
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }
   
  toPretty() {
    return '' + this.x;
  }

  get value() {
    return this.x;
  }

  interpolateLinear(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }

  interpolateNearest(other, proportion) {
    return new ExpressionBoolean(proportion <= 0.5 ? this.value : other.value);
  }

  interpolateSineInOut(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }

  interpolateBackInOut(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }

  interpolateQuadraticInOut(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }

  interpolateCubicInOut(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }

  interpolateQuarticInOut(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }

  interpolateQuinticInOut(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionInteger extends ExpressionData {
  constructor(x, where = null, unevaluated = null, prevalues = null) {
    super('integer', 'an', where, unevaluated, prevalues);
    this.x = x;
  }

  clone() {
    return new ExpressionInteger(this.x, this.where == null ? null : this.where.clone(), this.unevaluated, this.prevalues);
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }

  toPretty() {
    return '' + this.x;
  }

  get value() {
    return this.x;
  }

  get(i) {
    return new ExpressionInteger(this.x >> i & 1);
  }

  add(other) {
    if (other instanceof ExpressionInteger) {
      return new ExpressionInteger(this.value + other.value);
    } else if (other instanceof ExpressionReal) {
      return new ExpressionReal(this.value + other.value);
    } else {
      throw new MessagedException('Add failed');
    }
  }

  subtract(other) {
    if (other instanceof ExpressionInteger) {
      return new ExpressionInteger(this.value - other.value);
    } else if (other instanceof ExpressionReal) {
      return new ExpressionReal(this.value - other.value);
    } else {
      throw new MessagedException('Subtract failed');
    }
  }

  multiply(other) {
    if (other instanceof ExpressionInteger) {
      return new ExpressionInteger(this.value * other.value);
    } else if (other instanceof ExpressionReal) {
      return new ExpressionReal(this.value * other.value);
    } else {
      throw 'bad ****';
    }
  }

  divide(other) {
    if (other instanceof ExpressionInteger) {
      return new ExpressionInteger(Math.trunc(this.value / other.value));
    } else if (other instanceof ExpressionReal) {
      return new ExpressionReal(this.value / other.value);
    } else {
      throw new MessagedException('Divide failed');
    }
  }

  remainder(other) {
    if (other instanceof ExpressionInteger) {
      return new ExpressionInteger(this.value % other.value);
    } else if (other instanceof ExpressionReal) {
      return new ExpressionReal(this.value % other.value);
    } else {
      throw new MessagedException('Remainder failed');
    }
  }

  negative() {
    return new ExpressionInteger(-this.value);
  }

  power(other) {
    if (other instanceof ExpressionInteger) {
      return new ExpressionInteger(Math.pow(this.value, other.value));
    } else if (other instanceof ExpressionReal) {
      return new ExpressionReal(Math.pow(this.value, other.value));
    } else {
      throw new MessagedException('I can only compute powers for integers and reals.');
    }
  }

  isLess(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionBoolean(this.value < other.value);
    } else {
      throw new MessagedException('I can only compare integers to other numbers.');
    }
  }

  isMore(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionBoolean(this.value > other.value);
    } else {
      throw new MessagedException('I can only compare integers to other numbers.');
    }
  }

  isSame(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionBoolean(this.value == other.value);
    } else {
      throw new MessagedException('I can only compare integers to other numbers.');
    }
  }

  interpolateLinear(other, proportion) {
    return new ExpressionReal(this.value + proportion * (other.value - this.value));
  }

  interpolateNearest(other, proportion) {
    return new ExpressionReal(proportion <= 0.5 ? this.value : other.value);
  }

  interpolateSineInOut(other, proportion) {
    let diff = other.value - this.value;
    return new ExpressionReal(this.value + diff * 0.5 * (1 - Math.cos(Math.PI * proportion)));
  }

  interpolateBackInOut(other, proportion) {
    return new ExpressionReal(interpolateBackInOut(this.value, other.value, proportion));
  }

  interpolateQuadraticInOut(other, proportion) {
    return new ExpressionReal(interpolateQuadraticInOut(this.value, other.value, proportion));
  }

  interpolateCubicInOut(other, proportion) {
    return new ExpressionReal(interpolateCubicInOut(this.value, other.value, proportion));
  }

  interpolateQuarticInOut(other, proportion) {
    return new ExpressionReal(interpolateQuarticInOut(this.value, other.value, proportion));
  }

  interpolateQuinticInOut(other, proportion) {
    return new ExpressionReal(interpolateQuinticInOut(this.value, other.value, proportion));
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCharacter extends ExpressionData {
  constructor(x, where = null, unevaluated = null, prevalues = null) {
    super('character', 'a', where, unevaluated, prevalues);
    this.x = x;
  }

  clone() {
    return new ExpressionCharacter(this.x, this.where == null ? null : this.where.clone(), this.unevaluated, this.prevalues);
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }

  toPretty() {
    return this.x;
  }

  add(other) {
    return new ExpressionString(this.toPretty() + other.toPretty());
  }

  get value() {
    return this.x;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionString extends ExpressionData {
  constructor(x, where = null, unevaluated = null, prevalues = null) {
    super('string', 'a', where, unevaluated, prevalues);
    this.x = x;

    this.bindings = [];

    this.bindings['size'] = new FunctionDefinition('size', [], new ExpressionStringSize(this));
  }

  has(id) {
    return this.bindings.hasOwnProperty(id);
  }

  getFunction(id) {
    return this.bindings[id];
  }

  clone() {
    return new ExpressionString(this.x, this.where == null ? null : this.where.clone(), this.unevaluated, this.prevalues);
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }

  toPretty() {
    return this.x;
  }

  get value() {
    return this.x;
  }

  set(i, value) {
    // assert value is character
    this.x = this.x.substr(0, i) + value + this.x.substr(i + 1);
  }

  get(i) {
    if (i < 0 || i >= this.x.length) {
      throw new MessagedException(`I can't get character ${i} of this string because ${i} is not a legal index in a string of length ${this.x.length}.`)
    } else {
      return new ExpressionCharacter(this.x.charAt(i));
    }
  }

  add(other) {
    return new ExpressionString(this.x + other.toPretty());
  }

  interpolateLinear(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }

  interpolateNearest(other, proportion) {
    return new ExpressionString(proportion <= 0.5 ? this.value : other.value);
  }

  interpolateSineInOut(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }

  interpolateBackInOut(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }

  interpolateQuadraticInOut(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }

  interpolateCubicInOut(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }

  interpolateQuarticInOut(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }

  interpolateQuinticInOut(other, proportion) {
    return this.interpolateNearest(other, proportion);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionStringSize extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Property, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new ExpressionInteger(this.instance.x.length);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionReal extends ExpressionData {
  constructor(x, where = null, unevaluated = null, prevalues = null) {
    super('real', 'a', where, unevaluated, prevalues);
    this.x = x;
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }

  clone() {
    return new ExpressionReal(this.x, this.where == null ? null : this.where.clone(), this.unevaluated, this.prevalues);
  }

  toPretty() {
    return '' + this.x;
  }

  get value() {
    return this.x;
  }

  add(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionReal(this.value + other.value);
    } else {
      throw '...';
    }
  }

  subtract(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionReal(this.value - other.value);
    } else {
      throw '...';
    }
  }

  multiply(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionReal(this.value * other.value);
    } else {
      throw 'BAD *';
    }
  }

  divide(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionReal(this.value / other.value);
    } else {
      throw new MessagedException('I can only divide integers and reals.');
    }
  }

  negative() {
    return new ExpressionReal(-this.value);
  }

  isLess(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionBoolean(this.value < other.value);
    } else {
      throw new MessagedException('I can only compare integers to other numbers.');
    }
  }

  isMore(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionBoolean(this.value > other.value);
    } else {
      throw new MessagedException('I can only compare reals to other numbers.');
    }
  }

  isSame(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionBoolean(this.value == other.value);
    } else {
      throw new MessagedException('I can only compare reals to other numbers.');
    }
  }

  power(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionReal(Math.pow(this.value, other.value));
    } else {
      throw new MessagedException('I can only compute reals for integers and reals.');
    }
  }

  interpolateLinear(other, proportion) {
    return new ExpressionReal(this.value + proportion * (other.value - this.value));
  }

  interpolateNearest(other, proportion) {
    return new ExpressionReal(proportion <= 0.5 ? this.value : other.value);
  }

  interpolateSineInOut(other, proportion) {
    let diff = other.value - this.value;
    return new ExpressionReal(this.value + diff * 0.5 * (1 - Math.cos(Math.PI * proportion)));
  }

  interpolateBackInOut(other, proportion) {
    return new ExpressionReal(interpolateBackInOut(this.value, other.value, proportion));
  }

  interpolateQuadraticInOut(other, proportion) {
    return new ExpressionReal(interpolateQuadraticInOut(this.value, other.value, proportion));
  }

  interpolateCubicInOut(other, proportion) {
    return new ExpressionReal(interpolateCubicInOut(this.value, other.value, proportion));
  }

  interpolateQuarticInOut(other, proportion) {
    return new ExpressionReal(interpolateQuarticInOut(this.value, other.value, proportion));
  }

  interpolateQuinticInOut(other, proportion) {
    return new ExpressionReal(interpolateQuinticInOut(this.value, other.value, proportion));
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSame extends Expression {
  constructor(a, b, where = null, unevaluated = null) {
    super(Precedence.Equality, where, unevaluated);
    this.a = a;
    this.b = b;
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    let evaluatedB = this.b.evaluate(env, fromTime, toTime);
    return evaluatedA.isSame(evaluatedB);
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionNotSame extends Expression {
  constructor(a, b, where = null, unevaluated = null) {
    super(Precedence.Equality, where, unevaluated);
    this.a = a;
    this.b = b;
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    let evaluatedB = this.b.evaluate(env, fromTime, toTime);
    return !evaluatedA.isSame(evaluatedB);
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLess extends Expression {
  constructor(a, b, where = null, unevaluated = null) {
    super(Precedence.Relational, where, unevaluated);
    this.a = a;
    this.b = b;
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    let evaluatedB = this.b.evaluate(env, fromTime, toTime);
    return evaluatedA.isLess(evaluatedB);
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLessEqual extends Expression {
  constructor(a, b, where = null, unevaluated = null) {
    super(Precedence.Relational, where, unevaluated);
    this.a = a;
    this.b = b;
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    let evaluatedB = this.b.evaluate(env, fromTime, toTime);
    return evaluatedA.isLess(evaluatedB) || evaluatedA.isSame(evaluatedB);
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMore extends Expression {
  constructor(a, b, where = null, unevaluated = null) {
    super(Precedence.Relational, where, unevaluated);
    this.a = a;
    this.b = b;
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    let evaluatedB = this.b.evaluate(env, fromTime, toTime);
    return evaluatedA.isMore(evaluatedB);
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMoreEqual extends Expression {
  constructor(a, b, where = null, unevaluated = null) {
    super(Precedence.Relational, where, unevaluated);
    this.a = a;
    this.b = b;
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    let evaluatedB = this.b.evaluate(env, fromTime, toTime);
    return evaluatedA.isMore(evaluatedB) || evaluatedA.isSame(evaluatedB);
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 
// ARITHMETIC
// --------------------------------------------------------------------------- 

export class ExpressionBinaryOperator extends Expression {
  constructor(a, b, operator, precedence, where = null, unevaluated = null) {
    super(precedence, where, unevaluated);
    this.a = a;
    this.b = b;
    this.operator = operator;
  }

  toPretty() {
    const prettyA = this.a.precedence < this.precedence ? `(${this.a.toPretty()})` : `${this.a.toPretty()}`;
    const prettyB = this.b.precedence <= this.precedence ? `(${this.b.toPretty()})` : `${this.b.toPretty()}`;
    return `${prettyA} ${this.operator} ${prettyB}`;
  }
}

export class ExpressionAdd extends ExpressionBinaryOperator {
  constructor(a, b, where = null, unevaluated = null) {
    super(a, b, '+', Precedence.Additive, where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    let evaluatedB = this.b.evaluate(env, fromTime, toTime);

    let sum = evaluatedA.add(evaluatedB);
    sum.unevaluated = this;

    return sum;
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSubtract extends ExpressionBinaryOperator {
  constructor(a, b, where = null, unevaluated = null) {
    super(a, b, '-', Precedence.Additive, where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    let evaluatedB = this.b.evaluate(env, fromTime, toTime);

    let difference = evaluatedA.subtract(evaluatedB);
    difference.unevaluated = this;

    return difference;
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMultiply extends ExpressionBinaryOperator {
  constructor(a, b, where = null, unevaluated = null) {
    super(a, b, '*', Precedence.Multiplicative, where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    let evaluatedB = this.b.evaluate(env, fromTime, toTime);
    let product = evaluatedA.multiply(evaluatedB);
    product.unevaluated = this;
    return product;
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionDivide extends ExpressionBinaryOperator {
  constructor(a, b, where = null, unevaluated = null) {
    super(a, b, '/', Precedence.Multiplicative, where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    let evaluatedB = this.b.evaluate(env, fromTime, toTime);

    let quotient = evaluatedA.divide(evaluatedB);
    quotient.prevalues = [evaluatedA, evaluatedB];
    quotient.unevaluated = this;

    return quotient;
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRemainder extends ExpressionBinaryOperator {
  constructor(a, b, where = null, unevaluated = null) {
    super(a, b, '%', Precedence.Multiplicative, where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    let evaluatedB = this.b.evaluate(env, fromTime, toTime);
    return evaluatedA.remainder(evaluatedB);
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPower extends ExpressionBinaryOperator {
  constructor(a, b, where = null, unevaluated = null) {
    super(a, b, '^', Precedence.Power, where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    let evaluatedB = this.b.evaluate(env, fromTime, toTime);

    let power = evaluatedA.power(evaluatedB);
    power.prevalues = [evaluatedA, evaluatedB];
    power.unevaluated = this;

    return power;
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env) || this.b.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionNegative extends Expression {
  constructor(a, where = null, unevaluated = null) {
    super(Precedence.Unary, where, unevaluated);
    this.a = a;
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedA = this.a.evaluate(env, fromTime, toTime);
    return evaluatedA.negative();
  }

  isTimeSensitive(env) {
    return this.a.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionFunctionDefinition extends Expression {
  constructor(name, formals, body, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
    this.name = name;
    this.formals = formals;
    this.body = body;
  }

  evaluate(env, fromTime, toTime) {
    env.bindings[this.name] = new FunctionDefinition(this.name, this.formals, this.body);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionIdentifier extends Expression {
  constructor(nameToken, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
    this.nameToken = nameToken;
  }

  evaluate(env, fromTime, toTime) {
    let value = env.get(this.nameToken.source);
    if (value != null) {
      return value;
    } else {
      throw new LocatedException(this.nameToken.where, `I'm sorry, but I've never heard of this "${this.nameToken.source}" before.`);
    }
  }

  assign(env, fromTime, toTime, rhs, whereAssigned) {
    let value;
    if (rhs.isTimeSensitive(env)) {
      value = rhs;
    } else {
      value = rhs.evaluate(env, fromTime, toTime);
    }

    // Favor mapping this chunk of the source code to the value rather
    // than the environment.
    if (value.hasOwnProperty('sourceSpans')) {
      value.sourceSpans.push(whereAssigned);
    } else if (env.hasOwnProperty('sourceSpans')) {
      env.sourceSpans.push(whereAssigned);
    }

    env.bind(this.nameToken.source, value, fromTime, toTime, rhs);

    return value;
  }

  isTimeSensitive(env) {
    return this.nameToken.type == Tokens.T;
  }

  toPretty() {
    return this.nameToken.source;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMemberIdentifier extends ExpressionIdentifier {
  constructor(base, nameToken, where = null, unevaluated = null) {
    super(Precedence.Property, where, unevaluated);
    this.base = base;
    this.nameToken = nameToken;
  }

  evaluate(env, fromTime, toTime) {
    let baseValue = this.base.evaluate(env, fromTime, toTime);
    let value = baseValue.get(this.nameToken.source);
    if (value != null) {
      return value;
    } else {
      throw new LocatedException(this.nameToken.where, `I'm sorry, but I've never heard of this "${this.nameToken.source}" before.`);
    }
  }

  assign(env, fromTime, toTime, rhs, whereAssigned) {
    let baseValue = this.base.evaluate(env, fromTime, toTime); 

    let rhsValue;
    if (rhs.isTimeSensitive(env)) {
      rhsValue = rhs;
    } else {
      rhsValue = rhs.evaluate(env, fromTime, toTime);
    }

    if (baseValue.hasOwnProperty('sourceSpans')) {
      baseValue.sourceSpans.push(whereAssigned);
    }

    baseValue.bind(this.nameToken.source, rhsValue, fromTime, toTime, rhs);

    return rhsValue;
  }

  isTimeSensitive(env) {
    return false;
  }

  toPretty() {
    return `.${this.nameToken.source}`;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionDistributedIdentifier extends ExpressionIdentifier {
  constructor(base, nameToken, where = null, unevaluated = null) {
    super(Precedence.Property, nameToken, where, unevaluated);
    this.base = base;
  }

  evaluate(env, fromTime, toTime) {
    let baseValue = this.base.evaluate(env, fromTime, toTime); 
    // assert vector

    let elements = baseValue.map(element => element.get(this.nameToken.source));

    return new ExpressionVector(elements);
  }

  assign(env, fromTime, toTime, rhs) {
    let baseValue = this.base.evaluate(env, fromTime, toTime); 
    // assert vector

    let rhsValue = rhs.evaluate(env, fromTime, toTime);

    baseValue.forEach(element => {
      element.bind(this.nameToken.source, rhsValue, fromTime, toTime, rhs);
    });

    return rhsValue;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionFunctionCall extends Expression {
  constructor(nameToken, actuals, where = null, unevaluated = null) {
    super(Precedence.Call, where, unevaluated);
    this.nameToken = nameToken;
    this.actuals = actuals;
  }

  lookup(env, fromTime, toTime) {
    let f = env.get(this.nameToken.source);
    if (!f) {
      throw new LocatedException(this.where, `I've not heard of any function named "${this.nameToken.source}".`);
    } else if (!(f instanceof FunctionDefinition)) {
      throw new LocatedException(this.where, `I can only call functions. ${this.nameToken.source} is not a function.`);
    }
    return f;
  }

  evaluate(env, fromTime, toTime) {
    let f = this.lookup(env, fromTime, toTime);

    if (this.actuals.length != f.formals.length) {
      throw new LocatedException(this.where, `I expected function ${this.nameToken.source} to be called with ${f.formals.length} parameter${f.formals.length == 1 ? '' : 's'}.`);
    }

    let callEnvironment = new TwovilleEnvironment(env);
    this.actuals.forEach((actual, i) => {
      let value = actual.evaluate(env, fromTime, toTime);
      callEnvironment.bind(f.formals[i], value);
    });

    let returnValue = f.body.evaluate(callEnvironment, fromTime, toTime, this);
    return returnValue;
  }

  isTimeSensitive(env) {
    let f = this.lookup(env);
    return this.actuals.some((actual, i) => actual.isTimeSensitive(env)) || f.body.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMemberFunctionCall extends ExpressionFunctionCall {
  constructor(host, nameToken, actuals, where = null, unevaluated = null) {
    super(Precedence.Call, nameToken, actuals, where, unevaluated);
    this.host = host;
  }

  lookup(env, fromTime, toTime) {
    let hostValue = this.host.evaluate(env, fromTime, toTime);

    if (!hostValue.has(this.nameToken.source)) {
      throw new LocatedException(this.where, `I've not heard of any function named "${this.nameToken.source}".`);
    }

    return hostValue.getFunction(this.nameToken.source);
  }
}

// ---------------------------------------------------------------------------

export class ExpressionBlock extends Expression {
  constructor(statements, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
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
  constructor(l, r, where = null, unevaluated = null) {
    super(Precedence.Assignment, where, unevaluated);
    this.l = l;
    this.r = r;
  }

  evaluate(env, fromTime, toTime) {
    if ('assign' in this.l) {
      return this.l.assign(env, fromTime, toTime, this.r, this.where);
    } else {
      throw 'unassignable';
    }
  }

  isTimeSensitive(env) {
    return this.l.isTimeSensitive(env) || this.r.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionIf extends Expression {
  constructor(conditions, thenBlocks, elseBlock, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
    this.conditions = conditions;
    this.thenBlocks = thenBlocks;
    this.elseBlock = elseBlock;
  }

  evaluate(env, fromTime, toTime) {
    for (let [i, condition] of this.conditions.entries()) {
      let conditionValue = condition.evaluate(env, fromTime, toTime).value;
      // TODO assert boolean
      if (conditionValue) {
        return this.thenBlocks[i].evaluate(env, fromTime, toTime);
      }
    }

    if (this.elseBlock) {
      return this.elseBlock.evaluate(env, fromTime, toTime);
    } else {
      return null;
    }
  }

  isTimeSensitive(env) {
    return this.conditions.some(e => e.isTimeSensitive(env)) || this.thenBlocks.some(e => e.isTimeSensitive(env)) || (this.elseBlock != null && this.elseBlock.isTimeSensitive(env));
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionFor extends Expression {
  constructor(i, start, stop, by, body, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
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

    for (let i = start; i < stop; i += by) {
      new ExpressionAssignment(this.i, new ExpressionInteger(i), true).evaluate(env, fromTime, toTime);
      this.body.evaluate(env, fromTime, toTime);
    }
  }

  isTimeSensitive(env) {
    return this.start.isTimeSensitive(env) || this.stop.isTimeSensitive(env) || this.by.isTimeSensitive(env) || this.body.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSubscript extends Expression {
  constructor(base, index, where = null, unevaluated = null) {
    super(Precedence.Property, where, unevaluated);
    this.base = base;
    this.index = index;
  }

  evaluate(env, fromTime, toTime) {
    let baseValue = this.base.evaluate(env, fromTime, toTime); 
    if (!(baseValue instanceof ExpressionVector) && !(baseValue instanceof ExpressionString) && !(baseValue instanceof ExpressionInteger)) {
      throw new LocatedException(this.base.where, `I'm sorry, but I can only apply [] to vectors, strings, and integers. This expression has type ${baseValue.type}.`);
    }

    let indexValue = this.index.evaluate(env, fromTime, toTime); 
    if (!(indexValue instanceof ExpressionInteger)) {
      throw new LocatedException(this.index.where, `I'm sorry, but the index must be an integer.`);
    }

    try {
      let element = baseValue.get(indexValue.value);
      return element;
    } catch (e) {
      throw new LocatedException(this.index.where, e.message);
    }
  }

  assign(env, fromTime, toTime, rhs) {
    let baseValue = this.base.evaluate(env, fromTime, toTime); 
    if (!(baseValue instanceof ExpressionVector) && !(baseValue instanceof ExpressionString)) {
      throw new LocatedException(this.base.where, `I'm sorry, but I can only apply [] to vectors and strings. This expression has type ${baseValue.type}.`);
    }

    let indexValue = this.index.evaluate(env, fromTime, toTime); 
    if (!(indexValue instanceof ExpressionInteger)) {
      throw new LocatedException(this.index.where, `I'm sorry, but the index must be an integer.`);
    }

    let rhsValue = rhs.evaluate(env, fromTime, toTime); 
    baseValue.set(indexValue.value, rhsValue);
    return rhsValue;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorAdd extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Property, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let item = env.get('item');
    return this.instance.insert(item);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorSize extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Property, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new ExpressionInteger(this.instance.elements.length);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorToCartesian extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Property, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return this.instance.toCartesian();
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorMagnitude extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Property, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new ExpressionReal(this.instance.magnitude);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorNormalize extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Property, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return this.instance.normalize();
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorRotate extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Property, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let degrees = env.get('degrees');
    return this.instance.rotate(degrees);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorRotateAround extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Property, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let pivot = env.get('pivot');
    let degrees = env.get('degrees');
    return this.instance.rotateAround(pivot, degrees);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorRotate90 extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Property, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return this.instance.rotate90();
  }
}

// --------------------------------------------------------------------------- 

export class StatementFrom extends Expression {
  constructor(fromTimeExpression, block, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
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
  constructor(toTimeExpression, block, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
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
  constructor(fromTimeExpression, toTimeExpression, block, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
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
  constructor(throughTimeExpression, block, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
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

export class StatementToStasis extends Expression {
  constructor(startTimeExpression, endTimeExpression, block, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
    this.startTimeExpression = startTimeExpression;
    this.endTimeExpression = endTimeExpression;
    this.block = block;
  }

  evaluate(env, fromTime, toTime) {
    let startTime = this.startTimeExpression.evaluate(env, fromTime, toTime);
    let endTime = this.endTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, null, startTime);
    this.block.evaluate(env, startTime, endTime);
  }
}

// --------------------------------------------------------------------------- 

export class StatementFromStasis extends Expression {
  constructor(startTimeExpression, endTimeExpression, block, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
    this.startTimeExpression = startTimeExpression;
    this.endTimeExpression = endTimeExpression;
    this.block = block;
  }

  evaluate(env, fromTime, toTime) {
    let startTime = this.startTimeExpression.evaluate(env, fromTime, toTime);
    let endTime = this.endTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, startTime, endTime);
    this.block.evaluate(env, endTime, null);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRepeat extends Expression {
  constructor(count, body, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
    this.count = count;
    this.body = body;
  }

  evaluate(env, fromTime, toTime) {
    let count = this.count.evaluate(env, fromTime, toTime).value;
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

// TODO: better names
export class ExpressionRepeatAround extends Expression {
  constructor(count, body, around, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
    this.count = count;
    this.body = body;
    this.around = around;
  }

  evaluate(env, fromTime, toTime) {
    let count = this.count.evaluate(env, fromTime, toTime);
    let last = null;
    for (let i = 0; i < count; ++i) {
      last = this.body.evaluate(env, fromTime, toTime);
      if (i < count - 1) {
        this.around.evaluate(env, fromTime, toTime);
      }
    }
    return last;
  }

  isTimeSensitive(env) {
    return this.count.isTimeSensitive(env) || this.body.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionWith extends Expression {
  constructor(scope, body, where = null, unevaluated = null) {
    super(Precedence.Atom, where, unevaluated);
    this.scope = scope;
    this.body = body;
  }

  evaluate(env, fromTime, toTime) {
    let withEnv = this.scope.evaluate(env, fromTime, toTime);
    if (!(withEnv instanceof TwovilleEnvironment)) {
      throw new LocatedException(this.scope.where, `I encountered a with expression whose subject isn't an environment.`);
    }
    if (withEnv.hasOwnProperty('sourceSpans')) {
      withEnv.sourceSpans.push(this.where);
    }
    withEnv.parent = env;
    this.body.evaluate(withEnv, fromTime, toTime);
    return withEnv;
  }

  isTimeSensitive(env) {
    return false;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRectangle extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let r = new TwovilleRectangle(env, callExpression);
    env.shapes.push(r);
    return r;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVertex extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new TwovilleVertex(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTurtle extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new TwovilleTurtle(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTurtleTurn extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new TwovilleTurtleTurn(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTurtleMove extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new TwovilleTurtleMove(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPathArc extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    // Call has false env for local parameters. Execute inside parent.
    return new TwovillePathArc(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPathJump extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new TwovillePathJump(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPathLine extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new TwovillePathLine(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPathCubic extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new TwovillePathCubic(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPathQuadratic extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new TwovillePathQuadratic(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTranslate extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new TwovilleTranslate(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionScale extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new TwovilleScale(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRotate extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new TwovilleRotate(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionShear extends Expression {
  constructor(instance, unevaluated = null) {
    super(Precedence.Call, null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new TwovilleShear(this.instance, callExpression);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLine extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let r = new TwovilleLine(env, callExpression);
    env.shapes.push(r);
    return r;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPolygon extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let r = new TwovillePolygon(env, callExpression);
    env.shapes.push(r);
    return r;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionUngon extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let r = new TwovilleUngon(env, callExpression);
    env.shapes.push(r);
    return r;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPolyline extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let r = new TwovillePolyline(env, callExpression);
    env.shapes.push(r);
    return r;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPath extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let r = new TwovillePath(env, callExpression);
    env.shapes.push(r);
    return r;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLabel extends Expression {
  constructor() {
    super(Precedence.Call, null);
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
    super(Precedence.Call, null);
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
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let message = env.get('message').toPretty();
    Messager.log(message);
    return null;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSeed extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let seed = env.get('value').value;
    env.prng.seed(seed);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRandom extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let min = env.get('min').value;
    let max = env.get('max').value;

    let x;
    if (env.get('min') instanceof ExpressionInteger && env.get('max') instanceof ExpressionInteger) {
      let random = env.prng.random01();
      let x = Math.floor(random * (max - min) + min);
      return new ExpressionInteger(x);
    } else {
      let random = env.prng.random01();
      let x = random * (max - min) + min;
      return new ExpressionReal(x);
    }
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSine extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let degrees = env.get('degrees').value;
    let x = Math.sin(degrees * Math.PI / 180);
    return new ExpressionReal(x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCosine extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let degrees = env.get('degrees').value;
    let x = Math.cos(degrees * Math.PI / 180);
    return new ExpressionReal(x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTangent extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let degrees = env.get('degrees').value;
    let x = Math.tan(degrees * Math.PI / 180);
    return new ExpressionReal(x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionArcSine extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let ratio = env.get('ratio').value;
    let angle = Math.asin(ratio) * 180 / Math.PI;
    return new ExpressionReal(angle);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSquareRoot extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let x = env.get('x').value;
    let root = Math.sqrt(x);
    return new ExpressionReal(root);
  }
}

// --------------------------------------------------------------------------- 

// The casting function.
export class ExpressionInt extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let f = env.get('x').value;
    let i = Math.trunc(f);
    return new ExpressionInteger(i);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionGroup extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let group = new TwovilleGroup(env, callExpression);
    env.shapes.push(group);
    return group;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMarker extends Expression {
  constructor() {
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let marker = new TwovilleMarker(env, callExpression);
    env.shapes.push(marker);
    return marker;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMask extends Expression {
  constructor() {
    super(Precedence.Call, null);
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
    super(Precedence.Call, null);
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let cutout = new TwovilleCutout(env, callExpression);
    env.shapes.push(cutout);
    return cutout;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVector extends ExpressionData {
  constructor(elements, where = null, unevaluated = null, prevalues = null) {
    super('vector', 'a', where, unevaluated, prevalues);
    this.elements = elements;
    this.bindings = [];

    this.bindings['normalize'] = new FunctionDefinition('normalize', [], new ExpressionVectorNormalize(this));
    this.bindings['size'] = new FunctionDefinition('size', [], new ExpressionVectorSize(this));
    this.bindings['magnitude'] = new FunctionDefinition('magnitude', [], new ExpressionVectorMagnitude(this));
    this.bindings['toCartesian'] = new FunctionDefinition('toCartesian', [], new ExpressionVectorToCartesian(this));
    this.bindings['add'] = new FunctionDefinition('add', ['item'], new ExpressionVectorAdd(this));
    this.bindings['rotateAround'] = new FunctionDefinition('rotateAround', ['pivot', 'degrees'], new ExpressionVectorRotateAround(this));
    this.bindings['rotate'] = new FunctionDefinition('rotate', ['degrees'], new ExpressionVectorRotate(this));
    this.bindings['rotate90'] = new FunctionDefinition('rotate90', [], new ExpressionVectorRotate90(this));
  }

  has(id) {
    return this.bindings.hasOwnProperty(id);
  }

  assign(index, rhs) {
    if (index instanceof ExpressionIdentifier) {
      let id = index.token.source;
      if (id == 'x' || id == 'r') {
        this.elements[0] = rhs;
      } else if (id == 'y' || id == 'g') {
        this.elements[1] = rhs;
      } else if (id == 'z' || id == 'b') {
        this.elements[2] = rhs;
      }
    } else if (index instanceof ExpressionInteger) {
      this.elements[index.value] = rhs;
    }
    return rhs;
  }

  clone() {
    return new ExpressionVector(this.elements.map(e => e.clone()), this.where == null ? null : this.where.clone(), this.unevaluated, this.prevalues);
  }

  evaluate(env, fromTime, toTime) {
    let values = this.elements.map(element => {
      return element.evaluate(env, fromTime, toTime);
    });
    return new ExpressionVector(values, this.where.clone());
  }

  insert(item) {
    this.elements.push(item);
  }

  map(transform) {
    return this.elements.map(transform);
  }

  isTimeSensitive(env) {
    return this.elements.some(e => e.isTimeSensitive(env));
  }

  bind(id, value) {
    if (id == 'x' || id == 'r') {
      this.elements[0] = value;
    } else if (id == 'y' || id == 'g') {
      this.elements[1] = value;
    } else if (id == 'z' || id == 'b') {
      this.elements[2] = value;
    }
  }

  forEach(each) {
    this.elements.forEach(each);
  }

  getFunction(id) {
    return this.bindings[id];
  }

  set(i, value) {
    this.elements[i] = value;
  }

  get(i) {
    if (i == 'x' || i == 'r') {
      return this.elements[0];
    } else if (i == 'y' || i == 'g') {
      return this.elements[1];
    } else if (i == 'z' || i == 'b') {
      return this.elements[2];
    } else if (i instanceof ExpressionFunctionCall && this.bindings.hasOwnProperty(i.name)) {
      return this.bindings[i.name];
    } else if (typeof i == 'number') {
      if (i < 0 || i >= this.elements.length) {
        throw new MessagedException(`I can't get element ${i} of this vector because ${i} is not a legal index in a vector of length ${this.elements.length}.`)
      } else {
        return this.elements[i];
      }
    } else if (i instanceof ExpressionInteger) {
      return this.elements[i.value];
    } else {
      throw new MessagedException('uh oh');
      return super.get(i);
    }
  }

  toColor(env) {
    let r = Math.floor(this.elements[0].value * 255);
    let g = Math.floor(this.elements[1].value * 255);
    let b = Math.floor(this.elements[2].value * 255);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  }

  toHexColor(env) {
    let r = Math.floor(this.elements[0].value * 255).toString(16);
    let g = Math.floor(this.elements[1].value * 255).toString(16);
    let b = Math.floor(this.elements[2].value * 255).toString(16);
    if (r.length == 1) {
      r = '0' + r;
    }
    if (g.length == 1) {
      g = '0' + g;
    }
    if (b.length == 1) {
      b = '0' + b;
    }
    return `#${r}${g}${b}`;
  }

  toPretty(env) {
    return '[' + this.elements.map(element => element.toPretty()).join(', ') + ']';
  }

  toSpacedString(env) {
    return this.elements.map(element => element.toPretty()).join(' ');
  }

  interpolateLinear(other, proportion) {
    return new ExpressionVector(this.elements.map((element, i) => element.interpolateLinear(other.get(i), proportion)));
  }

  interpolateNearest(other, proportion) {
    return new ExpressionVector(this.elements.map((element, i) => element.interpolateNearest(other.get(i), proportion)));
  }

  interpolateSineInOut(other, proportion) {
    return new ExpressionVector(this.elements.map((element, i) => element.interpolateSineInOut(other.get(i), proportion)));
  }

  interpolateBackInOut(other, proportion) {
    return new ExpressionVector(this.elements.map((element, i) => element.interpolateBackInOut(other.get(i), proportion)));
  }

  interpolateQuadraticInOut(other, proportion) {
    return new ExpressionVector(this.elements.map((element, i) => element.interpolateQuadraticInOut(other.get(i), proportion)));
  }

  interpolateCubicInOut(other, proportion) {
    return new ExpressionVector(this.elements.map((element, i) => element.interpolateCubicInOut(other.get(i), proportion)));
  }

  interpolateQuarticInOut(other, proportion) {
    return new ExpressionVector(this.elements.map((element, i) => element.interpolateQuarticInOut(other.get(i), proportion)));
  }

  interpolateQuinticInOut(other, proportion) {
    return new ExpressionVector(this.elements.map((element, i) => element.interpolateQuinticInOut(other.get(i), proportion)));
  }

  get magnitude() {
    let sum = 0;
    for (let i = 0; i < this.elements.length; ++i) {
      sum += this.get(i).value * this.get(i).value;
    }
    return Math.sqrt(sum);
  }

  normalize() {
    let magnitude = this.magnitude;
    let newElements = this.elements.map(element => new ExpressionReal(element.value / magnitude));
    return new ExpressionVector(newElements);
  }

  lengthen(length) {
    return this.normalize().multiply(length);
  }

  distance(that) {
    return new ExpressionReal(that.subtract(this).magnitude);
  }

  midpoint(that) {
    let newElements = this.elements.map((element, i) => new ExpressionReal((element.value + that.elements[i].value) / 2));
    return new ExpressionVector(newElements);
  }

  rotate90() {
    let newElements = [this.elements[1], this.elements[0].negative()];
    return new ExpressionVector(newElements);
  }

  rotate(degrees) {
    let radians = degrees * Math.PI / 180;
    let newVector = new ExpressionVector([
      new ExpressionReal(this.get(0).value * Math.cos(radians) - this.get(1).value * Math.sin(radians)),
      new ExpressionReal(this.get(0).value * Math.sin(radians) + this.get(1).value * Math.cos(radians)),
    ]);
    return newVector;
  }

  rotateAround(pivot, degrees) {
    let radians = degrees * Math.PI / 180;
    let diff = this.subtract(pivot);
    let newVector = new ExpressionVector([
      new ExpressionReal(diff.get(0).value * Math.cos(radians) - diff.get(1).value * Math.sin(radians)),
      new ExpressionReal(diff.get(0).value * Math.sin(radians) + diff.get(1).value * Math.cos(radians)),
    ]);
    return newVector.add(pivot);
  }

  toCartesian() {
    if (this.elements.length != 2) {
      throw new MessagedException("only toCartesian() for 2D");
    }

    let radius = this.get(0).value;
    let degrees = this.get(1).value;
    let radians = degrees * Math.PI / 180;
    let xy = [
      new ExpressionReal(radius * Math.cos(radians)),
      new ExpressionReal(radius * Math.sin(radians))
    ];

    return new ExpressionVector(xy);
  }

  multiply(other) {
    if (other instanceof ExpressionVector) {
      let result = [];
      for (let i = 0; i < this.elements.length; ++i) {
        result.push(this.get(i).multiply(other.get(i)));
      }
      return new ExpressionVector(result);
    } else if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      let result = [];
      for (let i = 0; i < this.elements.length; ++i) {
        result.push(this.get(i).multiply(other));
      }
      return new ExpressionVector(result);
    } else {
      throw '...';
    }
  }

  divide(other) {
    if (other instanceof ExpressionVector) {
      let result = [];
      for (let i = 0; i < this.elements.length; ++i) {
        result.push(this.get(i).divide(other.get(i)));
      }
      return new ExpressionVector(result);
    } else if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      let result = [];
      for (let i = 0; i < this.elements.length; ++i) {
        result.push(this.get(i).divide(other));
      }
      return new ExpressionVector(result);
    } else {
      throw '...';
    }
  }

  add(other) {
    if (other instanceof ExpressionVector) {
      let result = [];
      for (let i = 0; i < this.elements.length; ++i) {
        result.push(this.get(i).add(other.get(i)));
      }
      return new ExpressionVector(result);
    } else if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      let result = [];
      for (let i = 0; i < this.elements.length; ++i) {
        result.push(this.get(i).add(other));
      }
      return new ExpressionVector(result);
    } else {
      throw '...';
    }
  }

  subtract(other) {
    if (other instanceof ExpressionVector) {
      let result = [];
      for (let i = 0; i < this.elements.length; ++i) {
        result.push(this.get(i).subtract(other.get(i)));
      }
      return new ExpressionVector(result);
    } else if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      let result = [];
      for (let i = 0; i < this.elements.length; ++i) {
        result.push(this.get(i).subtract(other));
      }
      return new ExpressionVector(result);
    } else {
      throw '...';
    }
  }

  negative() {
    let result = [];
    for (let i = 0; i < this.elements.length; ++i) {
      result.push(this.get(i).negative());
    }
    return new ExpressionVector(result);
  }

  dot(that) {
    // TODO ensure same cardinality
    let sum = 0;
    for (let i = 0; i < this.elements.length; ++i) {
      sum += this.get(i).multiply(that.get(i)).value;
    }
    return sum;
  }

  mirror(point, axis) {
    let normal = axis.normalize();
    let diff = point.subtract(this); // ORDER?
    let length = diff.dot(normal);
    normal = normal.multiply(new ExpressionReal(length * 2));
    normal = normal.subtract(diff);
    let reflection = point.subtract(normal);
    return reflection;
  }
}

// --------------------------------------------------------------------------- 
