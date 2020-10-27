// https://github.com/danro/jquery-easing/blob/master/jquery.easing.js

import {
  Tokens,
  Token,
  FunctionDefinition,
  MessagedException,
  LocatedException,
  Precedence,
  SourceLocation,
} from './common.js';

import {
  Environment,
} from './environment.js';

import {
  Circle,
  Cutout,
  Group,
  Line,
  Mask,
  Path,
  Polygon,
  Polyline,
  Rectangle,
  Text,
  Tip,
  Ungon,
} from './shape.js';

import {
  Rotate,
  Scale,
  Shear,
  Translate,
} from './transform.js';

import {
  ArcNode,
  CubicNode,
  LineNode,
  JumpNode,
  Mirror,
  MoveNode,
  QuadraticNode,
  TurnNode,
  TurtleNode,
  VertexNode,
} from './node.js';

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
  constructor(where, unevaluated) {
    this.where = where;
    this.unevaluated = unevaluated ? unevaluated : this;
  }

  isTimeSensitive(env) {
    return false;
  }

  get precedence() {
    return this.constructor.precedence;
  }

  toPod() {
    const pod = {
      type: this.constructor.name,
      where: this.where,
    };

    if (this.unevaluated && this.unevaluated !== this) {
      pod.unevaluated = this.unevaluated.toPod();
    }

    if (this.prevalues) {
      pod.prevalues = this.prevalues.map(prevalue => prevalue.toPod());
    }

    return pod;
  }

  static reify(env, pod, omniReify) {
    let unevaluated;
    if (pod.unevaluated) {
      unevaluated = omniReify(env, pod.unevaluated);
    }

    let prevalues;
    if (pod.prevalues) {
      prevalues = pod.prevalues.map(prevalue => omniReify(env, prevalue));
    }

    if (pod.type === 'ExpressionReal') {
      return new ExpressionReal(pod.value, SourceLocation.reify(pod.where), unevaluated, prevalues);
    } else if (pod.type === 'ExpressionBoolean') {
      return new ExpressionBoolean(pod.value, SourceLocation.reify(pod.where), unevaluated, prevalues);
    } else if (pod.type === 'ExpressionInteger') {
      return new ExpressionInteger(pod.value, SourceLocation.reify(pod.where), unevaluated, prevalues);
    } else if (pod.type === 'ExpressionString') {
      return new ExpressionString(pod.value, SourceLocation.reify(pod.where), unevaluated, prevalues);
    } else if (pod.type === 'ExpressionVector') {
      return new ExpressionVector(pod.value.map(element => omniReify(env, element)), SourceLocation.reify(pod.where), unevaluated, prevalues);
    } else if (pod.type === 'ExpressionAdd') {
      return new ExpressionAdd(omniReify(env, pod.l), omniReify(env, pod.r), SourceLocation.reify(pod.where), unevaluated, prevalues);
    } else if (pod.type === 'ExpressionMultiply') {
      return new ExpressionMultiply(omniReify(env, pod.l), omniReify(env, pod.r), SourceLocation.reify(pod.where), unevaluated, prevalues);
    } else if (pod.type === 'ExpressionPower') {
      return new ExpressionPower(omniReify(env, pod.l), omniReify(env, pod.r), SourceLocation.reify(pod.where), unevaluated, prevalues);
    } else if (pod.type === 'ExpressionDivide') {
      return new ExpressionDivide(omniReify(env, pod.l), omniReify(env, pod.r), SourceLocation.reify(pod.where), unevaluated, prevalues);
    } else if (pod.type === 'ExpressionSubtract') {
      return new ExpressionSubtract(omniReify(env, pod.l), omniReify(env, pod.r), SourceLocation.reify(pod.where), unevaluated, prevalues);
    } else if (pod.type === 'ExpressionRemainder') {
      return new ExpressionRemainder(omniReify(env, pod.l), omniReify(env, pod.r), SourceLocation.reify(pod.where), unevaluated, prevalues);
    } else if (pod.type === 'ExpressionIdentifier') {
      return new ExpressionIdentifier(Token.reify(pod.nameToken), SourceLocation.reify(pod.where), unevaluated);
    } else if (pod.type === 'ExpressionMemberIdentifier') {
      return new ExpressionMemberIdentifier(omniReify(pod.base), Token.reify(pod.nameToken), SourceLocation.reify(pod.where), unevaluated);
    } else if (pod.type === 'ExpressionFunctionCall') {
      return new ExpressionFunctionCall(Token.reify(pod.nameToken), pod.actuals.map(actual => omniReify(env, actual)), SourceLocation.reify(pod.where), unevaluated);
    } else if (pod.type === 'ExpressionNegative') {
      return new ExpressionNegative(omniReify(env, pod.operand), SourceLocation.reify(pod.where), unevaluated, prevalues);
    } else if (pod.type === 'ExpressionUnit') {
      return new ExpressionUnit(SourceLocation.reify(pod.where));
    } else {
      throw new MessagedException(`I don't know ${pod.type}!`);
    }
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionData extends Expression {
  static precedence = Precedence.Atom;

  constructor(value, where, unevaluated, prevalues) {
    super(where, unevaluated);
    this.value = value;
    this.prevalues = prevalues;
  }

  bind(env, id, fromTime, toTime) {
    env.bind(id, this, fromTime, toTime);
  }

  get type() {
    return this.constructor.type;
  }

  get article() {
    return this.constructor.article;
  }

  toPod() {
    const pod = super.toPod();
    pod.value = this.value;
    return pod;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionBoolean extends ExpressionData {
  static type = 'boolean';
  static article = 'a';

  constructor(value, where, unevaluated, prevalues) {
    super(value, where, unevaluated, prevalues);
  }

  clone() {
    return new ExpressionBoolean(this.value, this.where ? this.where.clone() : undefined, this.unevaluated, this.prevalues);
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }
   
  toPretty() {
    return '' + this.value;
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
  static type = 'integer';
  static article = 'an';

  constructor(value, where, unevaluated, prevalues) {
    super(value, where, unevaluated, prevalues);
  }

  clone() {
    return new ExpressionInteger(this.value, this.where ? this.where.clone() : undefined, this.unevaluated, this.prevalues);
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }

  toPretty() {
    return '' + this.value;
  }

  get(i) {
    return new ExpressionInteger(this.value >> i & 1);
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
  static type = 'character';
  static article = 'a';

  constructor(value, where, unevaluated, prevalues) {
    super(value, where, unevaluated, prevalues);
  }

  clone() {
    return new ExpressionCharacter(this.value, this.where ? this.where.clone() : undefined, this.unevaluated, this.prevalues);
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }

  toPretty() {
    return this.value;
  }

  add(other) {
    return new ExpressionString(this.toPretty() + other.toPretty());
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionString extends ExpressionData {
  static type = 'string';
  static article = 'a';

  constructor(value, where, unevaluated, prevalues) {
    super(value, where, unevaluated, prevalues);

    this.functions = {
      size: new FunctionDefinition('size', [], new ExpressionStringSize(this)),
    };
  }

  hasFunction(id) {
    return this.functions.hasOwnProperty(id);
  }

  getFunction(id) {
    return this.functions[id];
  }

  clone() {
    return new ExpressionString(this.value, this.where ? this.where.clone() : undefined, this.unevaluated, this.prevalues);
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }

  toPretty() {
    return this.value;
  }

  set(i, value) {
    // assert value is character
    this.value = this.value.substr(0, i) + value + this.value.substr(i + 1);
  }

  get(i) {
    if (i < 0 || i >= this.value.length) {
      throw new MessagedException(`I can't get character ${i} of this string because ${i} is not a legal index in a string of length ${this.value.length}.`)
    } else {
      return new ExpressionCharacter(this.value.charAt(i));
    }
  }

  add(other) {
    return new ExpressionString(this.value + other.toPretty());
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
  static precedence = Precedence.Property;

  constructor(instance, unevaluated) {
    super(undefined, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new ExpressionInteger(this.instance.value.length);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionReal extends ExpressionData {
  static type = 'real';
  static article = 'a';

  constructor(value, where, unevaluated, prevalues) {
    super(value, where, unevaluated, prevalues);
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }

  clone() {
    return new ExpressionReal(this.value, this.where ? this.where.clone() : undefined, this.unevaluated, this.prevalues);
  }

  toPretty() {
    return '' + this.value;
  }

  add(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionReal(this.value + other.value);
    } else {
      throw 'bad real add';
    }
  }

  subtract(other) {
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      return new ExpressionReal(this.value - other.value);
    } else {
      throw 'bad real subtract';
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
// ARITHMETIC
// --------------------------------------------------------------------------- 

export class ExpressionBinaryOperator extends Expression {
  constructor(l, r, operator, where, unevaluated) {
    super(where, unevaluated);
    this.l = l;
    this.r = r;
    this.operator = operator;
  }

  toPretty() {
    const prettyA = this.l.precedence < this.precedence ? `(${this.l.toPretty()})` : `${this.l.toPretty()}`;
    const prettyB = this.r.precedence <= this.precedence ? `(${this.r.toPretty()})` : `${this.r.toPretty()}`;
    return `${prettyA} ${this.operator} ${prettyB}`;
  }

  isTimeSensitive(env) {
    return this.l.isTimeSensitive(env) || this.r.isTimeSensitive(env);
  }

  toPod() {
    const pod = super.toPod();
    pod.l = this.l.toPod();
    pod.r = this.r.toPod();
    return pod;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSame extends ExpressionBinaryOperator {
  static precedence = Precedence.Equality;

  constructor(l, r, where, unevaluated) {
    super(l, r, '==', where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.l.evaluate(env, fromTime, toTime);
    let evaluatedR = this.r.evaluate(env, fromTime, toTime);
    return evaluatedL.isSame(evaluatedR);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionNotSame extends ExpressionBinaryOperator {
  static precedence = Precedence.Equality;

  constructor(l, r, where, unevaluated) {
    super(l, r, '!=', where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.l.evaluate(env, fromTime, toTime);
    let evaluatedR = this.r.evaluate(env, fromTime, toTime);
    return !evaluatedL.isSame(evaluatedR);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLess extends ExpressionBinaryOperator {
  static precedence = Precedence.Relational;

  constructor(l, r, where, unevaluated) {
    super(l, r, '<', where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.l.evaluate(env, fromTime, toTime);
    let evaluatedR = this.r.evaluate(env, fromTime, toTime);
    return evaluatedL.isLess(evaluatedR);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLessEqual extends ExpressionBinaryOperator {
  static precedence = Precedence.Relational;

  constructor(l, r, where, unevaluated) {
    super(l, r, '<=', where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.l.evaluate(env, fromTime, toTime);
    let evaluatedR = this.r.evaluate(env, fromTime, toTime);
    return evaluatedL.isLess(evaluatedR) || evaluatedL.isSame(evaluatedR);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMore extends ExpressionBinaryOperator {
  static precedence = Precedence.Relational;

  constructor(l, r, where, unevaluated) {
    super(l, r, '>', where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.l.evaluate(env, fromTime, toTime);
    let evaluatedR = this.r.evaluate(env, fromTime, toTime);
    return evaluatedL.isMore(evaluatedR);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMoreEqual extends ExpressionBinaryOperator {
  static precedence = Precedence.Relational;

  constructor(l, r, where, unevaluated) {
    super(l, r, '>=', where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.l.evaluate(env, fromTime, toTime);
    let evaluatedR = this.r.evaluate(env, fromTime, toTime);
    return evaluatedL.isMore(evaluatedR) || evaluatedL.isSame(evaluatedR);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionAdd extends ExpressionBinaryOperator {
  static precedence = Precedence.Additive;

  constructor(l, r, where, unevaluated) {
    super(l, r, '+', where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.l.evaluate(env, fromTime, toTime);
    let evaluatedR = this.r.evaluate(env, fromTime, toTime);

    let sum = evaluatedL.add(evaluatedR);
    sum.unevaluated = this;

    return sum;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSubtract extends ExpressionBinaryOperator {
  static precedence = Precedence.Additive;

  constructor(l, r, where, unevaluated) {
    super(l, r, '-', where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.l.evaluate(env, fromTime, toTime);
    let evaluatedR = this.r.evaluate(env, fromTime, toTime);

    let difference = evaluatedL.subtract(evaluatedR);
    difference.unevaluated = this;

    return difference;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMultiply extends ExpressionBinaryOperator {
  static precedence = Precedence.Multiplicative;

  constructor(l, r, where, unevaluated) {
    super(l, r, '*', where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.l.evaluate(env, fromTime, toTime);
    let evaluatedR = this.r.evaluate(env, fromTime, toTime);

    let product = evaluatedL.multiply(evaluatedR);
    product.unevaluated = this;

    return product;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionDivide extends ExpressionBinaryOperator {
  static precedence = Precedence.Multiplicative;

  constructor(l, r, where, unevaluated) {
    super(l, r, '/', where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.l.evaluate(env, fromTime, toTime);
    let evaluatedR = this.r.evaluate(env, fromTime, toTime);

    let quotient = evaluatedL.divide(evaluatedR);
    quotient.prevalues = [evaluatedL, evaluatedR];
    quotient.unevaluated = this;

    return quotient;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRemainder extends ExpressionBinaryOperator {
  static precedence = Precedence.Multiplicative;

  constructor(l, r, where, unevaluated) {
    super(l, r, '%', where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.l.evaluate(env, fromTime, toTime);
    let evaluatedR = this.r.evaluate(env, fromTime, toTime);

    let remainder = evaluatedL.remainder(evaluatedR);
    remainder.prevalues = [evaluatedL, evaluatedR];
    remainder.unevaluated = this;

    return remainder;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPower extends ExpressionBinaryOperator {
  static precedence = Precedence.Power;

  constructor(l, r, where, unevaluated) {
    super(l, r, '^', where, unevaluated);
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.l.evaluate(env, fromTime, toTime);
    let evaluatedR = this.r.evaluate(env, fromTime, toTime);

    let power = evaluatedL.power(evaluatedR);
    power.prevalues = [evaluatedL, evaluatedR];
    power.unevaluated = this;

    return power;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionNegative extends Expression {
  static precedence = Precedence.Unary;

  constructor(operand, where, unevaluated) {
    super(where, unevaluated);
    this.operand = operand;
  }

  evaluate(env, fromTime, toTime) {
    let evaluatedL = this.operand.evaluate(env, fromTime, toTime);

    let negation = evaluatedL.negative();
    negation.prevalues = [evaluatedL];
    negation.unevaluated = this;

    return negation;
  }

  toPod() {
    const pod = super.toPod();
    pod.operand = this.operand.toPod();
    return pod;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionFunctionDefinition extends Expression {
  static precedence = Precedence.Atom;

  constructor(name, formals, body, where, unevaluated) {
    super(where, unevaluated);
    this.name = name;
    this.formals = formals;
    this.body = body;
  }

  evaluate(env, fromTime, toTime) {
    env.functions[this.name] = new FunctionDefinition(this.name, this.formals, this.body);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionIdentifier extends Expression {
  static precedence = Precedence.Atom;

  constructor(nameToken, where, unevaluated) {
    super(where, unevaluated);
    this.nameToken = nameToken;
  }

  evaluate(env, fromTime, toTime) {
    let value = env.get(this.nameToken.source);
    if (value) {
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

  toPod() {
    const pod = super.toPod();
    pod.nameToken = this.nameToken;
    return pod;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMemberIdentifier extends ExpressionIdentifier {
  static precedence = Precedence.Property;

  constructor(base, nameToken, where, unevaluated) {
    super(nameToken, where, unevaluated);
    this.base = base;
  }

  evaluate(env, fromTime, toTime) {
    let baseValue = this.base.evaluate(env, fromTime, toTime);
    let value = baseValue.get(this.nameToken.source);
    if (value) {
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

  toPod() {
    const pod = super.toPod();
    pod.base = this.base.toPod();
    return pod;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionDistributedIdentifier extends ExpressionIdentifier {
  static precedence = Precedence.Property;

  constructor(base, nameToken, where, unevaluated) {
    super(nameToken, where, unevaluated);
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
  static precedence = Precedence.Call;

  constructor(nameToken, actuals, where, unevaluated) {
    super(where, unevaluated);
    this.nameToken = nameToken;
    this.actuals = actuals;
  }

  lookup(env, fromTime, toTime) {
    let f = env.getFunction(this.nameToken.source);
    if (!f) {
      throw new LocatedException(this.where, `I've not heard of any function named "${this.nameToken.source}".`);
    }
    return f;
  }

  evaluate(env, fromTime, toTime) {
    let f = this.lookup(env, fromTime, toTime);

    if (this.actuals.length != f.formals.length) {
      throw new LocatedException(this.where, `I expected function ${this.nameToken.source} to be called with ${f.formals.length} parameter${f.formals.length == 1 ? '' : 's'}.`);
    }

    let callEnvironment = Environment.create(env);
    for (let [i, actual] of this.actuals.entries()) {
      let value = actual.evaluate(env, fromTime, toTime);
      callEnvironment.bind(f.formals[i], value);
    }

    let returnValue = f.body.evaluate(callEnvironment, fromTime, toTime, this);
    return returnValue;
  }

  isTimeSensitive(env) {
    let f = this.lookup(env);
    return this.actuals.some((actual, i) => actual.isTimeSensitive(env)) || f.body.isTimeSensitive(env);
  }

  toPod() {
    const pod = super.toPod();
    pod.nameToken = this.nameToken;
    pod.actuals = this.actuals.map(actual => actual.toPod());
    return pod;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMemberFunctionCall extends ExpressionFunctionCall {
  constructor(host, nameToken, actuals, where, unevaluated) {
    super(nameToken, actuals, where, unevaluated);
    this.host = host;
  }

  lookup(env, fromTime, toTime) {
    let hostValue = this.host.evaluate(env, fromTime, toTime);

    if (!hostValue.hasFunction(this.nameToken.source)) {
      throw new LocatedException(this.where, `I've not heard of any method named "${this.nameToken.source}".`);
    }

    return hostValue.getFunction(this.nameToken.source);
  }
}

// ---------------------------------------------------------------------------

export class ExpressionBlock extends Expression {
  static precedence = Precedence.Atom;

  constructor(statements, where, unevaluated) {
    super(where, unevaluated);
    this.statements = statements;
  }

  evaluate(env, a, toTime) {
    let result = null; // TODO Unit
    for (let statement of this.statements) {
      result = statement.evaluate(env, a, toTime);
    }
    return result;
  }

  isTimeSensitive(env) {
    return this.statements.some(s => s.isTimeSensitive(env));
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionAssignment extends Expression {
  static precedence = Precedence.Assignment;

  constructor(l, r, where, unevaluated) {
    super(where, unevaluated);
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
  static precedence = Precedence.Atom;

  constructor(conditions, thenBlocks, elseBlock, where, unevaluated) {
    super(where, unevaluated);
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
      return null; // TODO unit
    }
  }

  isTimeSensitive(env) {
    return this.conditions.some(e => e.isTimeSensitive(env)) || this.thenBlocks.some(e => e.isTimeSensitive(env)) || (this.elseBlock && this.elseBlock.isTimeSensitive(env));
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionFor extends Expression {
  static precedence = Precedence.Atom;

  constructor(i, start, stop, by, body, where, unevaluated) {
    super(where, unevaluated);
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

    // TODO return?
  }

  isTimeSensitive(env) {
    return this.start.isTimeSensitive(env) || this.stop.isTimeSensitive(env) || this.by.isTimeSensitive(env) || this.body.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSubscript extends Expression {
  static precedence = Precedence.Property;

  constructor(base, index, where, unevaluated) {
    super(where, unevaluated);
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
  static precedence = Precedence.Property;

  constructor(instance, unevaluated) {
    super(undefined, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let item = env.get('item');
    return this.instance.insert(item);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorSize extends Expression {
  static precedence = Precedence.Property;

  constructor(instance, unevaluated) {
    super(undefined, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new ExpressionInteger(this.instance.value.length);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorToCartesian extends Expression {
  static precedence = Precedence.Property;

  constructor(instance, unevaluated) {
    super(undefined, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return this.instance.toCartesian();
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorMagnitude extends Expression {
  static precedence = Precedence.Property;

  constructor(instance, unevaluated) {
    super(undefined, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new ExpressionReal(this.instance.magnitude);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorNormalize extends Expression {
  static precedence = Precedence.Property;

  constructor(instance, unevaluated) {
    super(undefined, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return this.instance.normalize();
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorRotate extends Expression {
  static precedence = Precedence.Property;

  constructor(instance, unevaluated) {
    super(undefined, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    let degrees = env.get('degrees');
    return this.instance.rotate(degrees);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorRotateAround extends Expression {
  static precedence = Precedence.Property;

  constructor(instance, unevaluated) {
    super(undefined, unevaluated);
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
  static precedence = Precedence.Property;

  constructor(instance, unevaluated) {
    super(undefined, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return this.instance.rotate90();
  }
}

// --------------------------------------------------------------------------- 

export class StatementFrom extends Expression {
  static precedence = Precedence.Atom;

  constructor(fromTimeExpression, block, where, unevaluated) {
    super(where, unevaluated);
    this.fromTimeExpression = fromTimeExpression;
    this.block = block;
  }

  evaluate(env, fromTime, toTime) {
    let realFromTime = this.fromTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, realFromTime, null);
    // TODO return?
  }
}

// --------------------------------------------------------------------------- 

export class StatementTo extends Expression {
  static precedence = Precedence.Atom;

  constructor(toTimeExpression, block, where, unevaluated) {
    super(where, unevaluated);
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
  static precedence = Precedence.Atom;

  constructor(fromTimeExpression, toTimeExpression, block, where, unevaluated) {
    super(where, unevaluated);
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
  static precedence = Precedence.Atom;

  constructor(throughTimeExpression, block, where, unevaluated) {
    super(where, unevaluated);
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
  static precedence = Precedence.Atom;

  constructor(startTimeExpression, endTimeExpression, block, where, unevaluated) {
    super(where, unevaluated);
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
  static precedence = Precedence.Atom;

  constructor(startTimeExpression, endTimeExpression, block, where, unevaluated) {
    super(where, unevaluated);
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

export class StatementThroughStasis extends Expression {
  static precedence = Precedence.Atom;

  constructor(startTimeExpression, endTimeExpression, block, where, unevaluated) {
    super(where, unevaluated);
    this.startTimeExpression = startTimeExpression;
    this.endTimeExpression = endTimeExpression;
    this.block = block;
  }

  evaluate(env, fromTime, toTime) {
    let startTime = this.startTimeExpression.evaluate(env, fromTime, toTime);
    let endTime = this.endTimeExpression.evaluate(env, fromTime, toTime);
    this.block.evaluate(env, null, startTime);
    this.block.evaluate(env, startTime, endTime);
    this.block.evaluate(env, endTime, null);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRepeat extends Expression {
  static precedence = Precedence.Atom;

  constructor(count, body, where, unevaluated) {
    super(where, unevaluated);
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
  static precedence = Precedence.Atom;

  constructor(count, body, around, where, unevaluated) {
    super(where, unevaluated);
    this.count = count;
    this.body = body;
    this.around = around;
  }

  evaluate(env, fromTime, toTime) {
    let count = this.count.evaluate(env, fromTime, toTime).value;
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
  static precedence = Precedence.Atom;

  constructor(scope, body, where, unevaluated) {
    super(where, unevaluated);
    this.scope = scope;
    this.body = body;
  }

  evaluate(env, fromTime, toTime) {
    let withEnv = this.scope.evaluate(env, fromTime, toTime);
    if (!(withEnv instanceof Environment)) {
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

export class ExpressionFunction extends Expression {
  static precedence = Precedence.Call;
}

// --------------------------------------------------------------------------- 

export class ExpressionCircle extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    return Circle.create(env, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRectangle extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    return Rectangle.create(env, callExpression.where);
  }
}
 
// --------------------------------------------------------------------------- 

export class ExpressionVertexNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return VertexNode.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTurtleNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return TurtleNode.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTurnNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return TurnNode.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMoveNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return MoveNode.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionArcNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new ArcNode.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionJumpNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new JumpNode.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLineNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new LineNode.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCubicNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new CubicNode.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionQuadraticNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new QuadraticNode.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTranslate extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return new Translate.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionScale extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return Scale.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRotate extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return Rotate.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionShear extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return Shear.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLine extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    return new Line.create(env, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPolygon extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    return Polygon.create(env, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionUngon extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    return Ungon.create(env, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPolyline extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    return new Polyline.create(env, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPath extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    return Path.create(env, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionText extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    return new Text.create(env, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPrint extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let message = env.get('message').toPretty();
    env.root.log(message);
    return null;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionDebug extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    const where = callExpression.actuals[0].where;

    const lines = env.root.source.split('\n');
    const pieces = [];
    for (let i = where.lineStart; i <= where.lineEnd; ++i) {
      const startIndex = i === where.lineStart ? where.columnStart : 0;
      const endIndex = i === where.lineEnd ? where.columnEnd + 1 : lines[i].length;
      pieces.push(lines[i].substring(startIndex, endIndex));
    }

    let message = `${pieces.join("\n")}: ${env.get('expression').toPretty()}`;
    env.root.log(message);

    return null;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSeed extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let seed = env.get('value').value;
    env.root.prng.seed(seed);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRandom extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let min = env.get('min').value;
    let max = env.get('max').value;

    let x;
    if (env.get('min') instanceof ExpressionInteger && env.get('max') instanceof ExpressionInteger) {
      let random = env.root.prng.random01();
      let x = Math.floor(random * (max - min) + min);
      return new ExpressionInteger(x);
    } else {
      let random = env.root.prng.random01();
      let x = random * (max - min) + min;
      return new ExpressionReal(x);
    }
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSine extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let degrees = env.get('degrees').value;
    let x = Math.sin(degrees * Math.PI / 180);
    return new ExpressionReal(x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCosine extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let degrees = env.get('degrees').value;
    let x = Math.cos(degrees * Math.PI / 180);
    return new ExpressionReal(x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTangent extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let degrees = env.get('degrees').value;
    let x = Math.tan(degrees * Math.PI / 180);
    return new ExpressionReal(x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionArcCosine extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let ratio = env.get('ratio').value;
    let angle = Math.acos(ratio) * 180 / Math.PI;
    return new ExpressionReal(angle);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionArcSine extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let ratio = env.get('ratio').value;
    let angle = Math.asin(ratio) * 180 / Math.PI;
    return new ExpressionReal(angle);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionHypotenuse extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let a = env.get('a').value;
    let b = env.get('b').value;
    let hypotenuse = Math.sqrt(a * a + b * b);
    return new ExpressionReal(hypotenuse);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionArcTangent extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let ratio = env.get('ratio').value;
    let angle = Math.atan(ratio) * 180 / Math.PI;
    return new ExpressionReal(angle);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionArcTangent2 extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let a = env.get('a').value;
    let b = env.get('b').value;
    let angle = Math.atan2(a, b) * 180 / Math.PI;
    return new ExpressionReal(angle);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSquareRoot extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let x = env.get('x').value;
    let root = Math.sqrt(x);
    return new ExpressionReal(root);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionAbsoluteValue extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let x = env.get('x').value;
    let positive = Math.abs(x);
    return new ExpressionInteger(positive);
    // TODO real vs. integer
  }
}

// --------------------------------------------------------------------------- 

// The casting function.
export class ExpressionInt extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    let f = env.get('x').value;
    let i = Math.trunc(f);
    return new ExpressionInteger(i);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionGroup extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    return Group.create(env, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTip extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    return Tip.create(env, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMask extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    return Mask.create(env, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCutout extends ExpressionFunction {
  evaluate(env, fromTime, toTime, callExpression) {
    return Cutout.create(env, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVector extends ExpressionData {
  constructor(elements, where, unevaluated, prevalues) {
    super(elements, where, unevaluated, prevalues);

    this.functions = {
      normalize: new FunctionDefinition('normalize', [], new ExpressionVectorNormalize(this)),
      size: new FunctionDefinition('size', [], new ExpressionVectorSize(this)),
      magnitude: new FunctionDefinition('magnitude', [], new ExpressionVectorMagnitude(this)),
      toCartesian: new FunctionDefinition('toCartesian', [], new ExpressionVectorToCartesian(this)),
      add: new FunctionDefinition('add', ['item'], new ExpressionVectorAdd(this)),
      rotateAround: new FunctionDefinition('rotateAround', ['pivot', 'degrees'], new ExpressionVectorRotateAround(this)),
      rotate: new FunctionDefinition('rotate', ['degrees'], new ExpressionVectorRotate(this)),
      rotate90: new FunctionDefinition('rotate90', [], new ExpressionVectorRotate90(this)),
    };
  }

  hasFunction(id) {
    return this.functions.hasOwnProperty(id);
  }

  assign(index, rhs) {
    if (index instanceof ExpressionIdentifier) {
      let id = index.token.source;
      if (id == 'x' || id == 'r') {
        this.value[0] = rhs;
      } else if (id == 'y' || id == 'g') {
        this.value[1] = rhs;
      } else if (id == 'z' || id == 'b') {
        this.value[2] = rhs;
      }
    } else if (index instanceof ExpressionInteger) {
      this.value[index.value] = rhs;
    }
    return rhs;
  }

  clone() {
    return new ExpressionVector(this.value.map(e => e.clone()), this.where == null ? null : this.where.clone(), this.unevaluated, this.prevalues);
  }

  evaluate(env, fromTime, toTime) {
    let values = this.value.map(element => {
      return element.evaluate(env, fromTime, toTime);
    });
    return new ExpressionVector(values, this.where.clone());
  }

  insert(item) {
    this.value.push(item);
  }

  map(transform) {
    return this.value.map(transform);
  }

  isTimeSensitive(env) {
    return this.value.some(e => e.isTimeSensitive(env));
  }

  bind(id, value) {
    if (id == 'x' || id == 'r') {
      this.value[0] = value;
    } else if (id == 'y' || id == 'g') {
      this.value[1] = value;
    } else if (id == 'z' || id == 'b') {
      this.value[2] = value;
    }
  }

  forEach(each) {
    this.value.forEach(each);
  }

  getFunction(id) {
    return this.functions[id];
  }

  set(i, value) {
    this.value[i] = value;
  }

  get(i) {
    if (i == 'x' || i == 'r') {
      return this.value[0];
    } else if (i == 'y' || i == 'g') {
      return this.value[1];
    } else if (i == 'z' || i == 'b') {
      return this.value[2];
    } else if (i instanceof ExpressionFunctionCall && this.functions.hasOwnProperty(i.name)) {
      return this.functions[i.name];
    } else if (typeof i == 'number') {
      if (i < 0 || i >= this.value.length) {
        throw new MessagedException(`I can't get element ${i} of this vector because ${i} is not a legal index in a vector of length ${this.value.length}.`)
      } else {
        return this.value[i];
      }
    } else if (i instanceof ExpressionInteger) {
      return this.value[i.value];
    } else {
      throw new MessagedException('uh oh');
      return super.get(i);
    }
  }

  toColor() {
    let r = Math.floor(this.value[0].value * 255);
    let g = Math.floor(this.value[1].value * 255);
    let b = Math.floor(this.value[2].value * 255);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  }

  toHexColor() {
    let r = Math.floor(this.value[0].value * 255).toString(16);
    let g = Math.floor(this.value[1].value * 255).toString(16);
    let b = Math.floor(this.value[2].value * 255).toString(16);
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
    return '[' + this.value.map(element => element.toPretty()).join(', ') + ']';
  }

  toSpacedString(env) {
    return this.value.map(element => element.toPretty()).join(' ');
  }

  interpolateLinear(other, proportion) {
    return new ExpressionVector(this.value.map((element, i) => element.interpolateLinear(other.get(i), proportion)));
  }

  interpolateNearest(other, proportion) {
    return new ExpressionVector(this.value.map((element, i) => element.interpolateNearest(other.get(i), proportion)));
  }

  interpolateSineInOut(other, proportion) {
    return new ExpressionVector(this.value.map((element, i) => element.interpolateSineInOut(other.get(i), proportion)));
  }

  interpolateBackInOut(other, proportion) {
    return new ExpressionVector(this.value.map((element, i) => element.interpolateBackInOut(other.get(i), proportion)));
  }

  interpolateQuadraticInOut(other, proportion) {
    return new ExpressionVector(this.value.map((element, i) => element.interpolateQuadraticInOut(other.get(i), proportion)));
  }

  interpolateCubicInOut(other, proportion) {
    return new ExpressionVector(this.value.map((element, i) => element.interpolateCubicInOut(other.get(i), proportion)));
  }

  interpolateQuarticInOut(other, proportion) {
    return new ExpressionVector(this.value.map((element, i) => element.interpolateQuarticInOut(other.get(i), proportion)));
  }

  interpolateQuinticInOut(other, proportion) {
    return new ExpressionVector(this.value.map((element, i) => element.interpolateQuinticInOut(other.get(i), proportion)));
  }

  get magnitude() {
    let sum = 0;
    for (let i = 0; i < this.value.length; ++i) {
      sum += this.get(i).value * this.get(i).value;
    }
    return Math.sqrt(sum);
  }

  normalize() {
    let magnitude = this.magnitude;
    let newElements = this.value.map(element => new ExpressionReal(element.value / magnitude));
    return new ExpressionVector(newElements);
  }

  lengthen(length) {
    return this.normalize().multiply(length);
  }

  distance(that) {
    return new ExpressionReal(that.subtract(this).magnitude);
  }

  midpoint(that) {
    let newElements = this.value.map((element, i) => new ExpressionReal((element.value + that.value[i].value) / 2));
    return new ExpressionVector(newElements);
  }

  rotate90() {
    let newElements = [this.value[1], this.value[0].negative()];
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
    let radians = degrees.value * Math.PI / 180;
    let diff = this.subtract(pivot);
    let newVector = new ExpressionVector([
      new ExpressionReal(diff.get(0).value * Math.cos(radians) - diff.get(1).value * Math.sin(radians)),
      new ExpressionReal(diff.get(0).value * Math.sin(radians) + diff.get(1).value * Math.cos(radians)),
    ]);
    return newVector.add(pivot);
  }

  toCartesian() {
    if (this.value.length != 2) {
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
      for (let i = 0; i < this.value.length; ++i) {
        result.push(this.get(i).multiply(other.get(i)));
      }
      return new ExpressionVector(result);
    } else if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      let result = [];
      for (let i = 0; i < this.value.length; ++i) {
        result.push(this.get(i).multiply(other));
      }
      return new ExpressionVector(result);
    } else {
      throw 'bad vector multiply';
    }
  }

  divide(other) {
    if (other instanceof ExpressionVector) {
      let result = [];
      for (let i = 0; i < this.value.length; ++i) {
        result.push(this.get(i).divide(other.get(i)));
      }
      return new ExpressionVector(result);
    } else if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      let result = [];
      for (let i = 0; i < this.value.length; ++i) {
        result.push(this.get(i).divide(other));
      }
      return new ExpressionVector(result);
    } else {
      throw 'bad vector divide';
    }
  }

  add(other) {
    if (other instanceof ExpressionVector) {
      let result = [];
      for (let i = 0; i < this.value.length; ++i) {
        result.push(this.get(i).add(other.get(i)));
      }
      return new ExpressionVector(result);
    } else if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      let result = [];
      for (let i = 0; i < this.value.length; ++i) {
        result.push(this.get(i).add(other));
      }
      return new ExpressionVector(result);
    } else {
      throw 'bad vector add';
    }
  }

  subtract(other) {
    if (other instanceof ExpressionVector) {
      let result = [];
      for (let i = 0; i < this.value.length; ++i) {
        result.push(this.get(i).subtract(other.get(i)));
      }
      return new ExpressionVector(result);
    } else if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      let result = [];
      for (let i = 0; i < this.value.length; ++i) {
        result.push(this.get(i).subtract(other));
      }
      return new ExpressionVector(result);
    } else {
      console.trace('asdf');
      throw 'bad vector subtract';
    }
  }

  negative() {
    let result = [];
    for (let i = 0; i < this.value.length; ++i) {
      result.push(this.get(i).negative());
    }
    return new ExpressionVector(result);
  }

  dot(that) {
    // TODO ensure same cardinality
    let sum = 0;
    for (let i = 0; i < this.value.length; ++i) {
      sum += this.get(i).multiply(that.get(i)).value;
    }
    return sum;
  }

  distanceToLine(point, axis) {
    let diff = this.subtract(point);
    const hypotenuse = diff.magnitude;
    diff = diff.normalize();
    let radians = Math.acos(axis.dot(diff));
    return hypotenuse * Math.sin(radians);
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

  toPod() {
    const pod = super.toPod();
    pod.value = this.value.map(element => element.toPod());
    return pod;
  }

  resolveReferences(shapes) {
    for (let i = 0; i < this.value.length; ++i) {
      const element = this.value[i];
      if (element.hasOwnProperty('type') && element.type === 'reference') {
        this.value[i] = shapes.find(shape => shape.id === element.id);
      } else if (element instanceof ExpressionVector) {
        element.resolveReferences(shapes);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMirror extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env, fromTime, toTime, callExpression) {
    return Mirror.create(this.instance, callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionUnit extends Expression {
  constructor(where) {
    super(where);
  }

  evaluate(env) {
    return this;
  }

  toPretty() {
    return ':none';
  }

  clone() {
    return this;
  }
}

// --------------------------------------------------------------------------- 

