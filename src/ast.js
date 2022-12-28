// https://github.com/danro/jquery-easing/blob/master/jquery.easing.js

import {
  Tokens,
  Token,
  FunctionDefinition,
  MessagedException,
  LocatedException,
  Precedence,
  SourceLocation,
  typesToSeries,
} from './common.js';

import {
  Frame,
  ObjectFrame,
  StrokeFrame,
} from './frame.js';

import {
  Shape,
  Raster,
  Circle,
  Cutout,
  Grid,
  Group,
  Line,
  Mask,
  Mosaic,
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
  BumpNode,
  CurlNode,
  OrbitNode,
  BackNode,
  CubicNode,
  LineNode,
  FlyNode,
  CircleNode,
  RectangleNode,
  GoNode,
  PushNode,
  PopNode,
  Mirror,
  WalkNode,
  QuadraticNode,
  TabNode,
  Tile,
  TurnNode,
  TurtleNode,
  VertexNode,
} from './node.js';

// --------------------------------------------------------------------------- 
// PRIMITIVES
// --------------------------------------------------------------------------- 

export class Expression {
  constructor(where, unevaluated, prevalues) {
    this.where = where;
    this.unevaluated = unevaluated ? unevaluated : this;
    this.prevalues = prevalues;
    this.isLocked = false;
  }

  isTimeSensitive(env) {
    return false;
  }

  isNumericLiteral() {
    return false;
  }

  get isPrimitive() {
    return false;
  }

  get precedence() {
    return this.constructor.precedence;
  }

  deflate() {
    const object = {
      type: this.constructor.name,
      where: this.where,
      isLocked: this.isLocked,
    };

    if (this.unevaluated && this.unevaluated !== this) {
      object.unevaluated = this.unevaluated.deflate();
    }

    if (this.prevalues) {
      object.prevalues = this.prevalues.map(prevalue => prevalue.deflate());
    }

    return object;
  }

  static inflate(env, object, inflater) {
    let unevaluated;
    if (object.unevaluated) {
      unevaluated = inflater.inflate(env, object.unevaluated);
    }

    let prevalues;
    if (object.prevalues) {
      prevalues = object.prevalues.map(prevalue => inflater.inflate(env, prevalue));
    }

    let where;
    if (object.where) {
      where = SourceLocation.inflate(object.where);
    }

    let e;
    if (object.type === 'ExpressionReal') {
      e = new ExpressionReal(object.value, where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionBoolean') {
      e = new ExpressionBoolean(object.value, where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionInteger') {
      e = new ExpressionInteger(object.value, where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionString') {
      e = new ExpressionString(object.value, where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionVector') {
      e = new ExpressionVector(object.value.map(element => inflater.inflate(env, element)), where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionDitto') {
      e = new ExpressionDitto(where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionAdd') {
      e = new ExpressionAdd(inflater.inflate(env, object.l), inflater.inflate(env, object.r), where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionMultiply') {
      e = new ExpressionMultiply(inflater.inflate(env, object.l), inflater.inflate(env, object.r), where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionPower') {
      e = new ExpressionPower(inflater.inflate(env, object.l), inflater.inflate(env, object.r), where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionDivide') {
      e = new ExpressionDivide(inflater.inflate(env, object.l), inflater.inflate(env, object.r), where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionSubtract') {
      e = new ExpressionSubtract(inflater.inflate(env, object.l), inflater.inflate(env, object.r), where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionRemainder') {
      e = new ExpressionRemainder(inflater.inflate(env, object.l), inflater.inflate(env, object.r), where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionIdentifier') {
      e = new ExpressionIdentifier(Token.inflate(object.nameToken), where, unevaluated);
    } else if (object.type === 'ExpressionMemberIdentifier') {
      e = new ExpressionMemberIdentifier(inflater.inflate(object.base), Token.inflate(object.nameToken), where, unevaluated);
    } else if (object.type === 'ExpressionFunctionCall') {
      e = new ExpressionFunctionCall(Token.inflate(object.nameToken), object.actuals.map(actual => inflater.inflate(env, actual)), where, unevaluated);
    } else if (object.type === 'ExpressionMemberFunctionCall') {
      e = new ExpressionMemberFunctionCall(inflater.inflate(env, object.host), Token.inflate(object.nameToken), object.actuals.map(actual => inflater.inflate(env, actual)), where, unevaluated);
    } else if (object.type === 'ExpressionSubscript') {
      e = new ExpressionSubscript(inflater.inflate(env, object.base), inflater.inflate(env, object.index), where, unevaluated);
    } else if (object.type === 'ExpressionNegative') {
      e = new ExpressionNegative(inflater.inflate(env, object.operand), where, unevaluated, prevalues);
    } else if (object.type === 'ExpressionUnit') {
      e = new ExpressionUnit(where);
    } else {
      throw new MessagedException(`I don't know ${object.type}!`);
    }

    e.isLocked = object.isLocked;
    return e;
  }

  static assertScalar(env, e, types) {
    if (!e.isTimeSensitive(env) && !types.some(type => e instanceof type)) {
      throw new LocatedException(e.where, `It must be ${typesToSeries(types)}.`);
    }
  }

  static assertList(env, e, length, types) {
    // TODO need environment
    if (e.isTimeSensitive(env)) {
      return true;
    }

    if (!(e instanceof ExpressionVector)) {
      throw new LocatedException(e.where, `It must be a list.`);
    }

    if (length >= 0 && e.length !== length) {
      throw new LocatedException(e.where, `It must be a list with ${length} element${length === 1 ? '' : 's'}.`);
    }

    e.forEach(element => {
      if (!types.some(type => element instanceof type)) {
        throw new LocatedException(e.where, `Each element in the list must be ${typesToSeries(types)}.`);
      }
    });
  }

  cloneCommons(source) {
    this.isLocked = source.isLocked;
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

  get isPrimitive() {
    return true;
  }

  bind(env, id) {
    env.frames[0].bind(id, this);
  }

  get type() {
    return this.constructor.type;
  }

  get article() {
    return this.constructor.article;
  }

  deflate() {
    const object = super.deflate();
    object.value = this.value;
    return object;
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
    let e = new ExpressionBoolean(this.value, this.where?.clone(), this.unevaluated, this.prevalues);
    e.cloneCommons(this);
    return e;
  }

  evaluate(env) {
    return this;
  }

  negate() {
    return new ExpressionBoolean(this.value ? 0 : 1);
  }

  toInteger() {
    return this.value ? 1 : 0;
  }
   
  toPretty() {
    return '' + this.value;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionInteger extends ExpressionData {
  static type = 'integer';
  static article = 'an';

  constructor(value, where, unevaluated, prevalues) {
    super(value, where, unevaluated, prevalues);
  }

  isNumericLiteral() {
    return true;
  }

  clone() {
    let e = new ExpressionInteger(this.value, this.where?.clone(), this.unevaluated, this.prevalues);
    e.cloneCommons(this);
    return e;
  }

  evaluate(env) {
    return this;
  }

  toBoolean() {
    return new ExpressionBoolean(this.value !== 0);
  }

  toInteger() {
    return this.value;
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
    console.log("isLess");
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
    console.log("isSame");
    if (other instanceof ExpressionInteger || other instanceof ExpressionReal) {
      console.log("this.value:", this.value);
      console.log("other.value:", other.value);
      return new ExpressionBoolean(this.value === other.value);
    } else {
      throw new MessagedException('I can only compare integers to other numbers.');
    }
  }

  // interpolateSineInOut(other, proportion) {
    // let diff = other.value - this.value;
    // return new ExpressionReal(this.value + diff * 0.5 * (1 - Math.cos(Math.PI * proportion)));
  // }
}

// --------------------------------------------------------------------------- 

export class ExpressionCharacter extends ExpressionData {
  static type = 'character';
  static article = 'a';

  constructor(value, where, unevaluated, prevalues) {
    super(value, where, unevaluated, prevalues);
  }

  clone() {
    let e = new ExpressionCharacter(this.value, this.where?.clone(), this.unevaluated, this.prevalues);
    e.cloneCommons(this);
    return e;
  }

  evaluate(env) {
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
    let e = new ExpressionString(this.value, this.where?.clone(), this.unevaluated, this.prevalues);
    e.cloneCommons(this);
    return e;
  }

  evaluate(env) {
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
}

// --------------------------------------------------------------------------- 

export class ExpressionStringSize extends Expression {
  static precedence = Precedence.Property;

  constructor(instance, unevaluated) {
    super(undefined, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
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

  isNumericLiteral() {
    return true;
  }

  evaluate(env) {
    return this;
  }

  clone() {
    let e = new ExpressionReal(this.value, this.where?.clone(), this.unevaluated, this.prevalues);
    e.cloneCommons(this);
    return e;
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
      return new ExpressionBoolean(this.value === other.value);
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

  // interpolateSineInOut(other, proportion) {
    // let diff = other.value - this.value;
    // return new ExpressionReal(this.value + diff * 0.5 * (1 - Math.cos(Math.PI * proportion)));
  // }
}

// --------------------------------------------------------------------------- 
// ARITHMETIC
// --------------------------------------------------------------------------- 

export class ExpressionBinaryOperator extends Expression {
  constructor(l, r, operator, where, unevaluated, prevalues) {
    super(where, unevaluated, prevalues);
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

  deflate() {
    const object = super.deflate();
    object.l = this.l.deflate();
    object.r = this.r.deflate();
    return object;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionAnd extends ExpressionBinaryOperator {
  static precedence = Precedence.And;

  constructor(l, r, where, unevaluated) {
    super(l, r, 'and', where, unevaluated);
  }

  evaluate(env) {
    const evaluatedL = this.l.evaluate(env);
    if (evaluatedL instanceof ExpressionInteger) {
      const evaluatedR = this.r.evaluate(env);
      if (evaluatedR instanceof ExpressionInteger) {
        return new ExpressionInteger(evaluatedL.value & evaluatedR.value);
      } else {
        throw new LocatedException(this.where, `I found an and operation, but its operands didn't have the right types. Both operands must be integers, or both must be booleans.`);
      }
    } else if (evaluatedL instanceof ExpressionBoolean) {
      if (!evaluatedL.value) {
        return new ExpressionBoolean(false);
      } else {
        const evaluatedR = this.r.evaluate(env);
        if (evaluatedR instanceof ExpressionBoolean) {
          return evaluatedR;
        } else {
          throw new LocatedException(this.where, `I found an and operation, but its operands didn't have the right types. Both operands must be integers, or both must be booleans.`);
        }
      }
    } else {
      throw new LocatedException(this.where, `I found an and operation, but its operands didn't have the right types. Both operands must be integers, or both must be booleans.`);
    }
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionOr extends ExpressionBinaryOperator {
  static precedence = Precedence.Or;

  constructor(l, r, where, unevaluated) {
    super(l, r, 'or', where, unevaluated);
  }

  evaluate(env) {
    const evaluatedL = this.l.evaluate(env);
    if (evaluatedL instanceof ExpressionInteger) {
      const evaluatedR = this.r.evaluate(env);
      if (evaluatedR instanceof ExpressionInteger) {
        return new ExpressionInteger(evaluatedL.value | evaluatedR.value);
      } else {
        throw new LocatedException(this.where, `I found an or operation, but its operands didn't have the right types. Both operands must be integers, or both must be booleans.`);
      }
    } else if (evaluatedL instanceof ExpressionBoolean) {
      if (evaluatedL.value) {
        return new ExpressionBoolean(true);
      } else {
        const evaluatedR = this.r.evaluate(env);
        if (evaluatedR instanceof ExpressionBoolean) {
          return evaluatedR;
        } else {
          throw new LocatedException(this.where, `I found an or operation, but its operands didn't have the right types. Both operands must be integers, or both must be booleans.`);
        }
      }
    } else {
      throw new LocatedException(this.where, `I found an or operation, but its operands didn't have the right types. Both operands must be integers, or both must be booleans.`);
    }
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionXor extends ExpressionBinaryOperator {
  static precedence = Precedence.Xor;

  constructor(l, r, where, unevaluated) {
    super(l, r, 'xor', where, unevaluated);
  }

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);

    if (evaluatedL instanceof ExpressionInteger && evaluatedR instanceof ExpressionInteger) {
      return new ExpressionInteger(evaluatedL.value ^ evaluatedR.value);
    } else if (evaluatedL instanceof ExpressionBoolean && evaluatedR instanceof ExpressionBoolean) {
      return new ExpressionBoolean(evaluatedL.value !== evaluatedR.value);
    } else {
      throw new LocatedException(this.where, `I found an xor operation, but its operands didn't have the right types. Both operands must be integers, or both must be booleans.`);
    }
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSame extends ExpressionBinaryOperator {
  static precedence = Precedence.Equality;

  constructor(l, r, where, unevaluated) {
    super(l, r, '==', where, unevaluated);
  }

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);
    return evaluatedL.isSame(evaluatedR);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionNotSame extends ExpressionBinaryOperator {
  static precedence = Precedence.Equality;

  constructor(l, r, where, unevaluated) {
    super(l, r, '!=', where, unevaluated);
  }

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);
    return evaluatedL.isSame(evaluatedR).negate();
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLess extends ExpressionBinaryOperator {
  static precedence = Precedence.Relational;

  constructor(l, r, where, unevaluated) {
    super(l, r, '<', where, unevaluated);
  }

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);
    return evaluatedL.isLess(evaluatedR);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLessEqual extends ExpressionBinaryOperator {
  static precedence = Precedence.Relational;

  constructor(l, r, where, unevaluated) {
    super(l, r, '<=', where, unevaluated);
  }

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);
    return new ExpressionBoolean(evaluatedL.isLess(evaluatedR).value || evaluatedL.isSame(evaluatedR).value);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMore extends ExpressionBinaryOperator {
  static precedence = Precedence.Relational;

  constructor(l, r, where, unevaluated) {
    super(l, r, '>', where, unevaluated);
  }

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);
    return evaluatedL.isMore(evaluatedR);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMoreEqual extends ExpressionBinaryOperator {
  static precedence = Precedence.Relational;

  constructor(l, r, where, unevaluated) {
    super(l, r, '>=', where, unevaluated);
  }

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);
    return new ExpressionBoolean(evaluatedL.isMore(evaluatedR).value || evaluatedL.isSame(evaluatedR).value);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionAdd extends ExpressionBinaryOperator {
  static precedence = Precedence.Additive;

  constructor(l, r, where, unevaluated, prevalues) {
    super(l, r, '+', where, unevaluated, prevalues);
  }

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);

    let sum = evaluatedL.add(evaluatedR);
    sum.prevalues = [evaluatedL, evaluatedR];
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

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);

    let difference = evaluatedL.subtract(evaluatedR);
    difference.prevalues = [evaluatedL, evaluatedR];
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

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);

    let product = evaluatedL.multiply(evaluatedR);
    product.prevalues = [evaluatedL, evaluatedR];
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

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);

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

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);

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

  evaluate(env) {
    let evaluatedL = this.l.evaluate(env);
    let evaluatedR = this.r.evaluate(env);

    let power = evaluatedL.power(evaluatedR);
    power.prevalues = [evaluatedL, evaluatedR];
    power.unevaluated = this;

    return power;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionNegative extends Expression {
  static precedence = Precedence.Unary;
  // TODO no unary precedence

  constructor(operand, where, unevaluated) {
    super(where, unevaluated);
    this.operand = operand;
  }

  isNumericLiteral() {
    return this.operand.isNumericLiteral();
  }

  toPretty() {
    const pretty = this.operand.precedence < this.precedence ? `(${this.operand.toPretty()})` : `${this.operand.toPretty()}`;
    return `-${pretty}`;
  }

  evaluate(env) {
    let evaluatedL = this.operand.evaluate(env);

    let negation = evaluatedL.negative();
    negation.prevalues = [evaluatedL];
    negation.unevaluated = this;

    return negation;
  }

  deflate() {
    const object = super.deflate();
    object.operand = this.operand.deflate();
    return object;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionNot extends Expression {
  static precedence = Precedence.Not;

  constructor(operand, where, unevaluated) {
    super(where, unevaluated);
    this.operand = operand;
  }

  evaluate(env) {
    let evaluatedL = this.operand.evaluate(env);

    let negation = new ExpressionBoolean(!evaluatedL.value);
    negation.prevalues = [evaluatedL];
    negation.unevaluated = this;

    return negation;
  }

  deflate() {
    const object = super.deflate();
    object.operand = this.operand.deflate();
    return object;
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

  evaluate(env) {
    // TODO which end of the frames is this being added to?
    env.frames[env.frames.length - 1].bindStatic(this.name, new FunctionDefinition(this.name, this.formals, this.body, env.frames));
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionIdentifier extends Expression {
  static precedence = Precedence.Atom;

  constructor(nameToken, where, unevaluated) {
    super(where, unevaluated);
    this.nameToken = nameToken;
  }

  evaluate(env) {
    let value = Frame.resolveStaticRvalue(this.nameToken.source, env.frames);
    if (value instanceof FunctionDefinition) {
      if (value.formals.length !== 0) {
        throw new LocatedException(this.where, `I expected function ${this.nameToken.source} to be called with ${f.formals.length} parameter${f.formals.length == 1 ? '' : 's'}.`);
      }

      let callFrame = Frame.create();
      let returnValue = value.body.evaluate({
        ...env,
        frames: [callFrame, ...value.scopeFrames],
        callExpression: this,
      });

      return returnValue;
    } else if (value) {
      return value;
    } else {
      throw new LocatedException(this.nameToken.where, `I'm sorry, but I've never heard of <code>${this.nameToken.source}</code> before.`);
    }
  }

  assign(env) {
    let value;
    if (env.rhs.isTimeSensitive(env)) {
      value = env.rhs;
    } else {
      value = env.rhs.evaluate(env);
    }

    // Favor mapping this chunk of the source code to the value rather
    // than the environment.
    // TODO
    // if (value.hasOwnProperty('sourceSpans')) {
      // value.sourceSpans.push(env.whereAssigned);
    // } else if (env.stackFrame.hasOwnProperty('sourceSpans')) {
      // env.stackFrame.sourceSpans.push(env.whereAssigned);
    // }

    // If the immediate frame is an objective, we force the assignment to be to
    // a local variable. If the immediate frame is a function, we look up the
    // lexical hierarchy to find a frame a with an existing binding. If none is
    // found, we make a local.
    let frame = env.frames[0];
    if (!(frame instanceof ObjectFrame)) {
      frame = Frame.resolveStaticLvalue(this.nameToken.source, env.frames);
    }
    frame.bind(env, this.nameToken.source, value);

    return value;
  }

  isTimeSensitive(env) {
    return this.nameToken.type == Tokens.T;
  }

  toPretty() {
    return this.nameToken.source;
  }

  deflate() {
    const object = super.deflate();
    object.nameToken = this.nameToken;
    return object;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMemberIdentifier extends ExpressionIdentifier {
  static precedence = Precedence.Property;

  constructor(base, nameToken, where, unevaluated) {
    super(nameToken, where, unevaluated);
    this.base = base;
  }

  evaluate(env) {
    let baseValue = this.base.evaluate(env);
    let value = baseValue.get(this.nameToken.source);
    if (value) {
      return value;
    } else {
      throw new LocatedException(this.nameToken.where, `I'm sorry, but I've never heard of this <code>${this.nameToken.source}</code> before.`);
    }
  }

  assign(env) {
    let baseValue = this.base.evaluate(env); 

    let rhsValue;
    if (env.rhs.isTimeSensitive(env)) {
      rhsValue = env.rhs;
    } else {
      rhsValue = env.rhs.evaluate(env);
    }

    if (baseValue.hasOwnProperty('sourceSpans')) {
      baseValue.sourceSpans.push(env.whereAssigned);
    }

    baseValue.bind(env, this.nameToken.source, rhsValue);

    return rhsValue;
  }

  isTimeSensitive(env) {
    return false;
  }

  toPretty() {
    return `.${this.nameToken.source}`;
  }

  deflate() {
    const object = super.deflate();
    object.base = this.base.deflate();
    return object;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionDistributedIdentifier extends ExpressionIdentifier {
  static precedence = Precedence.Property;

  constructor(base, nameToken, where, unevaluated) {
    super(nameToken, where, unevaluated);
    this.base = base;
  }

  evaluate(env) {
    let baseValue = this.base.evaluate(env); 
    // assert vector

    let elements = baseValue.map(element => element.get(this.nameToken.source));

    return new ExpressionVector(elements);
  }

  assign(env) {
    let baseValue = this.base.evaluate(env); 
    // assert vector

    let rhsValue = env.rhs.evaluate(env);

    baseValue.forEach(element => {
      element.bind(this.nameToken.source, rhsValue, env.fromTime, env.toTime, env.rhs);
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

  lookup(env) {
    let func = Frame.resolveStaticRvalue(this.nameToken.source, env.frames);
    if (func) {
      return func;
    } else {
      throw new LocatedException(this.where, `I've not heard of any function named <code>${this.nameToken.source}</code>.`);
    }
  }

  evaluate(env) {
    let f = this.lookup(env);

    if (this.actuals.length != f.formals.length) {
      throw new LocatedException(this.where, `I expected function ${this.nameToken.source} to be called with ${f.formals.length} parameter${f.formals.length == 1 ? '' : 's'}.`);
    }

    let callFrame = Frame.create();
    for (let [i, actual] of this.actuals.entries()) {
      let value = actual.evaluate(env);
      callFrame.bindStatic(f.formals[i], value);
    }

    let returnValue = f.body.evaluate({
      ...env,
      frames: [callFrame, ...f.scopeFrames],
      callExpression: this,
    });

    return returnValue;
  }

  isTimeSensitive(env) {
    // TODO checking the body requires runtime lookup, but function might not be around when check happens...
    // let f = this.lookup(env);
    return this.actuals.some((actual, i) => actual.isTimeSensitive(env));// || f.body.isTimeSensitive(env);
  }

  deflate() {
    const object = super.deflate();
    object.nameToken = this.nameToken;
    object.actuals = this.actuals.map(actual => actual.deflate());
    return object;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMemberFunctionCall extends ExpressionFunctionCall {
  constructor(host, nameToken, actuals, where, unevaluated) {
    super(nameToken, actuals, where, unevaluated);
    this.host = host;
  }

  // TODO
  lookup(env) {
    let hostValue = this.host.evaluate(env);

    if (!hostValue.hasFunction(this.nameToken.source)) {
      throw new LocatedException(this.where, `I've not heard of any method named "${this.nameToken.source}".`);
    }

    return hostValue.getFunction(this.nameToken.source);
  }

  deflate() {
    const object = super.deflate();
    object.host = this.host.deflate();
    return object;
  }
}

// ---------------------------------------------------------------------------

export class ExpressionBlock extends Expression {
  static precedence = Precedence.Atom;

  constructor(statements, where, unevaluated) {
    super(where, unevaluated);
    this.statements = statements;
  }

  evaluate(env) {
    let result = null; // TODO Unit
    for (let statement of this.statements) {
      result = statement.evaluate(env);
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

  evaluate(env) {
    if ('assign' in this.l) {
      return this.l.assign({...env, rhs: this.r, whereAssigned: this.where});
    } else {
      throw new LocatedException(this.l.where, "I found an illegal assignment statement. The left-hand side is not something to which I can assign a value.");
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

  evaluate(env) {
    for (let [i, condition] of this.conditions.entries()) {
      let conditionValue = condition.evaluate(env).value;
      // TODO assert boolean
      if (conditionValue) {
        return this.thenBlocks[i].evaluate(env);
      }
    }

    if (this.elseBlock) {
      return this.elseBlock.evaluate(env);
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

  evaluate(env) {
    // assert all (integers or units) or (arrays or units)
    // TODO
    let start = this.start.evaluate(env);
    let stop = this.stop.evaluate(env);
    if ((start instanceof ExpressionInteger || start instanceof ExpressionUnit) && stop instanceof ExpressionInteger) {
      start = start?.value || 0;
      stop = stop.value;
      let by = this.by.evaluate(env)?.value || 1;

      for (let i = start; i < stop; i += by) {
        console.log("i:", i);
        new ExpressionAssignment(this.i, new ExpressionInteger(i), true).evaluate(env);
        this.body.evaluate(env);
      }
    } else {
      start = this.start.evaluate(env);
      stop = this.stop.evaluate(env).toPrimitiveArray();
      let by = this.by.evaluate(env);

      if (start instanceof ExpressionUnit) {
        start = stop.map(_ => 0);
      } else {
        start = start.value;
      }

      if (by instanceof ExpressionUnit) {
        by = stop.map(_ => 1);
      } else {
        by = by.value;
      }

      for (let r = start[1]; r < stop[1]; r += by[1]) {
        for (let c = start[0]; c < stop[0]; c += by[0]) {
          new ExpressionAssignment(this.i, new ExpressionVector([
            new ExpressionInteger(c),
            new ExpressionInteger(r),
          ]), true).evaluate(env);
          this.body.evaluate(env);
        } 
      }
    }

    // TODO return?
  }

  isTimeSensitive(env) {
    return this.start.isTimeSensitive(env) || this.stop.isTimeSensitive(env) || this.by.isTimeSensitive(env) || this.body.isTimeSensitive(env);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionForArray extends Expression {
  static precedence = Precedence.Atom;

  constructor(i, array, body, where, unevaluated) {
    super(where, unevaluated);
    this.i = i;
    this.array = array;
    this.body = body;
  }

  evaluate(env) {
    let arrayValues = this.array.evaluate(env).value;

    for (let i = 0; i < arrayValues.length; i += 1) {
      new ExpressionAssignment(this.i, arrayValues[i], true).evaluate(env);
      this.body.evaluate(env);
    }

    // TODO return?
  }

  isTimeSensitive(env) {
    return this.array.isTimeSensitive(env) || this.body.isTimeSensitive(env);
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

  evaluate(env) {
    let baseValue = this.base.evaluate(env); 
    if (!(baseValue instanceof ExpressionVector) && !(baseValue instanceof ExpressionString) && !(baseValue instanceof ExpressionInteger)) {
      throw new LocatedException(this.base.where, `I'm sorry, but I can only apply [] to vectors, strings, and integers. This expression has type ${baseValue.type}.`);
    }

    let indexValue = this.index.evaluate(env); 
    if (!indexValue.toInteger) {
      throw new LocatedException(this.index.where, `I'm sorry, but the index must be an integer.`);
    }

    try {
      let element = baseValue.get(indexValue.toInteger());
      return element;
    } catch (e) {
      throw new LocatedException(this.index.where, e.message);
    }
  }

  assign(env) {
    let baseValue = this.base.evaluate(env); 
    if (!(baseValue instanceof ExpressionVector) && !(baseValue instanceof ExpressionString)) {
      throw new LocatedException(this.base.where, `I'm sorry, but I can only apply [] to vectors and strings. This expression has type ${baseValue.type}.`);
    }

    let indexValue = this.index.evaluate(env); 
    if (!(indexValue instanceof ExpressionInteger)) {
      throw new LocatedException(this.index.where, `I'm sorry, but the index must be an integer.`);
    }

    let rhsValue = env.rhs.evaluate(env); 
    baseValue.set(indexValue.value, rhsValue);
    return rhsValue;
  }

  deflate() {
    const object = super.deflate();
    object.base = this.base.deflate();
    object.index = this.index.deflate();
    return object;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVectorAdd extends Expression {
  static precedence = Precedence.Property;

  constructor(instance, unevaluated) {
    super(undefined, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    let item = Frame.resolveStaticRvalue('item', env.frames);
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

  evaluate(env) {
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

  evaluate(env) {
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

  evaluate(env) {
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

  evaluate(env) {
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

  evaluate(env) {
    let degrees = Frame.resolveStaticRvalue('degrees', env.frames); // TODO value?
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

  evaluate(env) {
    let pivot = Frame.resolveStaticRvalue('pivot', env.frames);
    let degrees = Frame.resolveStaticRvalue('degrees', env.frames);
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

  evaluate(env) {
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

  evaluate(env) {
    let realFromTime = this.fromTimeExpression.evaluate(env);
    this.block.evaluate({...env, fromTime: realFromTime, toTime: null});
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

  evaluate(env) {
    let realToTime = this.toTimeExpression.evaluate(env);
    this.block.evaluate({...env, fromTime: null, toTime: realToTime});
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

  evaluate(env) {
    let realFromTime = this.fromTimeExpression.evaluate(env);
    let realToTime = this.toTimeExpression.evaluate(env);
    this.block.evaluate({...env, fromTime: realFromTime, toTime: realToTime});
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

  evaluate(env) {
    let throughTime = this.throughTimeExpression.evaluate(env);
    this.block.evaluate({...env, fromTime: null, toTime: throughTime});
    this.block.evaluate({...env, fromTime: throughTime, toTime: null});
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

  evaluate(env) {
    let startTime = this.startTimeExpression.evaluate(env);
    let endTime = this.endTimeExpression.evaluate(env);
    this.block.evaluate({...env, fromTime: null, toTime: startTime});
    this.block.evaluate({...env, fromTime: startTime, toTime: endTime});
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

  evaluate(env) {
    let startTime = this.startTimeExpression.evaluate(env);
    let endTime = this.endTimeExpression.evaluate(env);
    this.block.evaluate({...env, fromTime: startTime, toTime: endTime});
    this.block.evaluate({...env, fromTime: endTime, toTime: null});
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

  evaluate(env) {
    let startTime = this.startTimeExpression.evaluate(env);
    let endTime = this.endTimeExpression.evaluate(env);
    this.block.evaluate({...env, fromTime: null, toTime: startTime});
    this.block.evaluate({...env, fromTime: startTime, toTime: endTime});
    this.block.evaluate({...env, fromTime: endTime, toTime: null});
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

  evaluate(env) {
    let count = this.count.evaluate(env).value;
    let last = null;
    for (let i = 0; i < count; ++i) {
      last = this.body.evaluate(env);
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

  evaluate(env) {
    let count = this.count.evaluate(env).value;
    let last = null;
    for (let i = 0; i < count; ++i) {
      last = this.body.evaluate(env);
      if (i < count - 1) {
        this.around.evaluate(env);
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

  evaluate(env) {
    let instance = this.scope.evaluate(env);

    // TODO is it ObjectFrame or Frame that I want to ensure? I think Frame. view isn't an object frame, for example.
    if (!(instance instanceof Frame || instance instanceof ExpressionVector)) {
      throw new LocatedException(this.scope.where, `I encountered a block on something that isn't an object. This can happen if you have some code indented more than it should be. Or maybe the object isn't the object you think it is.`);
    }

    if (instance.hasOwnProperty('sourceSpans')) {
      instance.sourceSpans.push(this.where);
    }

    if (instance instanceof Frame) {
      this.body.evaluate({...env, frames: [instance, ...env.frames]});
    } else {
      instance.forEach(element => {
        if (element instanceof Frame) {
          this.body.evaluate({...env, frames: [element, ...env.frames]});
        } else {
          throw new LocatedException(element.where, `I encountered a block on something that isn't an object. This can happen if you have some code indented more than it should be. Or maybe the object isn't the object you think it is.`);
        }
      });
    }

    return instance;
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

export class ExpressionShapeFunction extends ExpressionFunction {
  evaluate(env) {
    const shape = this.createShape(env);
    shape.id = env.root.serial;
    env.root.serial += 1;
    env.root.shapes.push(shape);
    return shape;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionGrid extends ExpressionShapeFunction {
  createShape(env) {
    return Grid.create(env.callExpression.where);
  }
}
 
// --------------------------------------------------------------------------- 

export class ExpressionRectangle extends ExpressionShapeFunction {
  createShape(env) {
    return Rectangle.create(env.callExpression.where);
  }
}
 
// --------------------------------------------------------------------------- 

export class ExpressionCircle extends ExpressionShapeFunction {
  createShape(env) {
    return Circle.create(env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRaster extends ExpressionShapeFunction {
  createShape(env) {
    return Raster.create(env.callExpression.where);
  }
}
 
// --------------------------------------------------------------------------- 

export class ExpressionTabNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return TabNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionVertexNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return VertexNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTurtleNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return TurtleNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTurnNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return TurnNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionWalkNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return WalkNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionOrbitNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return OrbitNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCurlNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return CurlNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionBumpNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return BumpNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionFlyNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return FlyNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionBackNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return BackNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPushNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return PushNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPopNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return PopNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTile extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return Tile.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionGoNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return GoNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLineNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return LineNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCircleNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return CircleNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRectangleNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return RectangleNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCubicNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return CubicNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionQuadraticNode extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return QuadraticNode.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionStroke extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return StrokeFrame.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTranslate extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return Translate.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionScale extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return Scale.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRotate extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return Rotate.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionShear extends ExpressionFunction {
  constructor(instance, unevaluated) {
    super(null, unevaluated);
    this.instance = instance;
  }

  evaluate(env) {
    return Shear.create(this.instance, env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionLine extends ExpressionShapeFunction {
  createShape(env) {
    return Line.create(env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPolygon extends ExpressionShapeFunction {
  createShape(env) {
    return Polygon.create(env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMosaic extends ExpressionShapeFunction {
  createShape(env) {
    return Mosaic.create(env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionUngon extends ExpressionShapeFunction {
  createShape(env) {
    return Ungon.create(env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPolyline extends ExpressionShapeFunction {
  createShape(env) {
    return Polyline.create(env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPath extends ExpressionShapeFunction {
  createShape(env) {
    return Path.create(env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionText extends ExpressionShapeFunction {
  createShape(env) {
    return Text.create(env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPrint extends ExpressionFunction {
  evaluate(env) {
    let message = Frame.resolveStaticRvalue('message', env.frames).toPretty();
    env.root.log(message);
    return null;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionDebug extends ExpressionFunction {
  evaluate(env) {
    const where = env.callExpression.actuals[0].where;

    const lines = env.root.source.split('\n');
    const pieces = [];
    for (let i = where.lineStart; i <= where.lineEnd; ++i) {
      const startIndex = i === where.lineStart ? where.columnStart : 0;
      const endIndex = i === where.lineEnd ? where.columnEnd + 1 : lines[i].length;
      pieces.push(lines[i].substring(startIndex, endIndex));
    }

    let message = `${pieces.join("\n")}: ${Frame.resolveStaticRvalue('expression', env.frames).toPretty()}`;
    env.root.log(message);

    return null;
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSeed extends ExpressionFunction {
  evaluate(env) {
    let seed = Frame.resolveStaticRvalue('value', env.frames).value;
    env.root.prng.seed(seed);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionRandom extends ExpressionFunction {
  evaluate(env) {
    let min = Frame.resolveStaticRvalue('min', env.frames).value;
    let max = Frame.resolveStaticRvalue('max', env.frames).value;

    let x;
    if (Frame.resolveStaticRvalue('min', env.frames) instanceof ExpressionInteger && Frame.resolveStaticRvalue('max', env.frames) instanceof ExpressionInteger) {
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
  evaluate(env) {
    let degrees = Frame.resolveStaticRvalue('degrees', env.frames).value;
    let x = Math.sin(degrees * Math.PI / 180);
    return new ExpressionReal(x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionPolar extends ExpressionFunction {
  evaluate(env) {
    let x = Frame.resolveStaticRvalue('x', env.frames).value;
    let y = Frame.resolveStaticRvalue('y', env.frames).value;
    let radius = Math.sqrt(x * x + y * y);
    let degrees = Math.atan2(y, x);
    return new ExpressionVector([
      new ExpressionReal(radius),
      new ExpressionReal(degrees),
    ]);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionUnpolar extends ExpressionFunction {
  evaluate(env) {
    let degrees = Frame.resolveStaticRvalue('degrees', env.frames).value;
    let radius = Frame.resolveStaticRvalue('radius', env.frames).value;
    return new ExpressionVector([
      new ExpressionReal(Math.cos(degrees * Math.PI / 180) * radius),
      new ExpressionReal(Math.sin(degrees * Math.PI / 180) * radius),
    ]);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCosine extends ExpressionFunction {
  evaluate(env) {
    let degrees = Frame.resolveStaticRvalue('degrees', env.frames).value;
    let x = Math.cos(degrees * Math.PI / 180);
    return new ExpressionReal(x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTangent extends ExpressionFunction {
  evaluate(env) {
    let degrees = Frame.resolveStaticRvalue('degrees', env.frames).value;
    let x = Math.tan(degrees * Math.PI / 180);
    return new ExpressionReal(x);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionArcCosine extends ExpressionFunction {
  evaluate(env) {
    let ratio = Frame.resolveStaticRvalue('ratio', env.frames).value;
    let angle = Math.acos(ratio) * 180 / Math.PI;
    return new ExpressionReal(angle);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionArcSine extends ExpressionFunction {
  evaluate(env) {
    let ratio = Frame.resolveStaticRvalue('ratio', env.frames).value;
    let angle = Math.asin(ratio) * 180 / Math.PI;
    return new ExpressionReal(angle);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionHypotenuse extends ExpressionFunction {
  evaluate(env) {
    let a = Frame.resolveStaticRvalue('a', env.frames).value;
    let b = Frame.resolveStaticRvalue('b', env.frames).value;
    let hypotenuse = Math.sqrt(a * a + b * b);
    return new ExpressionReal(hypotenuse);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionArcTangent extends ExpressionFunction {
  evaluate(env) {
    let ratio = Frame.resolveStaticRvalue('ratio', env.frames).value;
    let angle = Math.atan(ratio) * 180 / Math.PI;
    return new ExpressionReal(angle);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionArcTangent2 extends ExpressionFunction {
  evaluate(env) {
    let a = Frame.resolveStaticRvalue('a', env.frames).value;
    let b = Frame.resolveStaticRvalue('b', env.frames).value;
    let angle = Math.atan2(a, b) * 180 / Math.PI;
    return new ExpressionReal(angle);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionSquareRoot extends ExpressionFunction {
  evaluate(env) {
    let x = Frame.resolveStaticRvalue('x', env.frames).value;
    let root = Math.sqrt(x);
    return new ExpressionReal(root);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionAbsoluteValue extends ExpressionFunction {
  evaluate(env) {
    let x = Frame.resolveStaticRvalue('x', env.frames).value;
    let positive = Math.abs(x);
    return new ExpressionInteger(positive);
    // TODO real vs. integer
  }
}

// --------------------------------------------------------------------------- 

// The casting function.
export class ExpressionInt extends ExpressionFunction {
  evaluate(env) {
    let f = Frame.resolveStaticRvalue('x', env.frames).value;
    let i = Math.trunc(f);
    return new ExpressionInteger(i);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionGroup extends ExpressionShapeFunction {
  createShape(env) {
    return Group.create(env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionTip extends ExpressionShapeFunction {
  createShape(env) {
    return Tip.create(env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionMask extends ExpressionFunction {
  evaluate(env) {
    return Mask.create(env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionCutout extends ExpressionFunction {
  evaluate(env) {
    return Cutout.create(env.callExpression.where);
  }
}

// --------------------------------------------------------------------------- 

export class ExpressionDitto extends Expression {
  constructor(where) {
    super(where);
  }

  evaluate(env) {
    return env.prior;
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

  get isPrimitive() {
    return this.value.every(element => element.isPrimitive);
  }

  get length() {
    return this.value.length;
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
    let e = new ExpressionVector(this.value.map(e => e.clone()), this.where?.clone(), this.unevaluated, this.prevalues);
    e.cloneCommons(this);
    return e;
  }

  evaluate(env) {
    let prior = new ExpressionUnit();
    let values = new Array(this.value.length);
    for (let i = 0; i < values.length; ++i) {
      values[i] = this.value[i].evaluate({...env, prior});
      prior = values[i];
    }
    return new ExpressionVector(values, this.where?.clone());
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

  toPrimitiveArray() {
    return this.value.map(element => element.value);
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
      console.trace("other:", other);
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

  deflate() {
    const object = super.deflate();
    object.value = this.value.map(element => element.deflate());
    return object;
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

  evaluate(env) {
    return Mirror.create(this.instance, env.callExpression.where);
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

