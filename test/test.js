import jsdom from 'jsdom';
const {document} = (new jsdom.JSDOM(`...`)).window;

import {
  ExpressionAdd,
  ExpressionDitto,
  ExpressionUnit,
  ExpressionInteger,
  ExpressionReal,
  ExpressionBoolean,
  ExpressionVector,
  ExpressionXor,
  ExpressionAnd,
  ExpressionOr,
  ExpressionNot,
} from '../src/ast';
import {SourceLocation, LocatedException} from '../src/common';
import {StaticContext, DynamicContext, Frame} from '../src/frame';
import {Interpreter, InterpreterFrame} from '../src/interpreter';
import {Inflater} from '../src/inflater';
import {Messager} from '../src/messager';
import {lex} from '../src/lexer';
import {parse} from '../src/parser';

// --------------------------------------------------------------------------- 

function evaluateOutput(source, lines) {
  let root = document.createElement('div');
  
  // new Messager(root, document);
  // let tokens = lex(source);
  // let ast = parse(tokens);
  // let env = {stackFrame: InterpreterEnvironment.create(source, Messager.log)};
  // ast.evaluate(env);

  new Messager(root, document);
  const tokens = lex(source);
  const ast = parse(tokens);
  const frame = InterpreterFrame.create(source, Messager.log);
  const result = ast.evaluate({
    root: frame,
    frames: [frame],
    fromTime: null,
    toTime: null,
    prior: new ExpressionUnit(),
  });

  let html = lines.join('<br>') + '<br>';

  expect(root.innerHTML).toBe(html);
}

function evaluateExpression(source, expected) {
  let root = document.createElement('div');
  
  new Messager(root, document);
  const tokens = lex(source);
  const ast = parse(tokens);
  const frame = InterpreterFrame.create(source, Messager.log);
  const result = ast.evaluate({
    root: frame,
    frames: [frame],
    fromTime: null,
    toTime: null,
    prior: new ExpressionUnit(),
  });

  expect(Object.getPrototypeOf(result)).toBe(Object.getPrototypeOf(expected));
  expect(result.x).toBe(expected.x);
}

function assertSame(expected, actual) {
  expect(Object.getPrototypeOf(actual)).toBe(Object.getPrototypeOf(expected));
  expect(actual.x).toBe(expected.x);
}

// --------------------------------------------------------------------------- 

test('StaticContext: bind and get', () => {
  const context = StaticContext.create();

  context.bind('n', 11);
  expect(context.get('n')).toBe(11);

  context.bind('n', 13);
  expect(context.get('n')).toBe(13);
});

test('StaticContext: deflate', () => {
  const context = StaticContext.create();
  context.bind('x', new ExpressionInteger(5));
  context.bind('y', new ExpressionBoolean(false));
  context.bind('z', new ExpressionVector([
    new ExpressionReal(1.5),
    new ExpressionReal(-33),
  ]));

  const actual = context.deflate();
  const expected = {
    type: 'StaticContext',
    bindings: {
      x: {
        type: 'ExpressionInteger',
        where: undefined,
        isLocked: false,
        value: 5,
      },
      y: {
        type: 'ExpressionBoolean',
        where: undefined,
        isLocked: false,
        value: false,
      },
      z: {
        type: 'ExpressionVector',
        where: undefined,
        isLocked: false,
        value: [
          {
            type: 'ExpressionReal',
            where: undefined,
            isLocked: false,
            value: 1.5,
          },
          {
            type: 'ExpressionReal',
            where: undefined,
            isLocked: false,
            value: -33,
          },
        ],
      },
    }
  };
  expect(actual).toStrictEqual(expected);
});

test('StaticContext: inflate', () => {
  const object = {
    type: 'StaticContext',
    bindings: {
      x: {
        type: 'ExpressionInteger',
        where: undefined,
        isLocked: false,
        value: 5,
      },
      y: {
        type: 'ExpressionBoolean',
        where: undefined,
        isLocked: false,
        value: false,
      },
      z: {
        type: 'ExpressionVector',
        where: undefined,
        isLocked: false,
        value: [
          {
            type: 'ExpressionReal',
            where: undefined,
            isLocked: false,
            value: 1.5,
          },
          {
            type: 'ExpressionReal',
            where: undefined,
            isLocked: false,
            value: -33,
          },
        ],
      },
    }
  };

  const actual = StaticContext.inflate({}, object, Inflater);

  const expected = StaticContext.create();
  expected.bind('x', new ExpressionInteger(5));
  expected.bind('y', new ExpressionBoolean(false));
  expected.bind('z', new ExpressionVector([
    new ExpressionReal(1.5),
    new ExpressionReal(-33),
  ]));

  expect(actual).toStrictEqual(expected);
});

// --------------------------------------------------------------------------- 

test('Interpreter: interpret', () => {
  const result = Interpreter.interpret(`a = 7
b = 3
c = a + b
print(c)
print(7 * 2 + a)`, console.log);
  // console.log("result:", result);
});

// --------------------------------------------------------------------------- 
// BOOLEANS
// --------------------------------------------------------------------------- 

test('xor of bad types', () => {
  const caser = (a, b) => {
    expect(() => new ExpressionXor(a, b, new SourceLocation(0, 0, 0, 0)).evaluate()).toThrow(LocatedException);
  };
  caser(new ExpressionInteger(0), new ExpressionBoolean(false));
  caser(new ExpressionBoolean(true), new ExpressionInteger(1));
  caser(new ExpressionReal(0), new ExpressionInteger(0));
});

test('and of bad types', () => {
  const caser = (a, b) => {
    expect(() => new ExpressionAnd(a, b, new SourceLocation(0, 0, 0, 0)).evaluate()).toThrow(LocatedException);
  };
  caser(new ExpressionInteger(1), new ExpressionBoolean(false));
  caser(new ExpressionBoolean(true), new ExpressionInteger(1));
  caser(new ExpressionReal(0), new ExpressionInteger(0));
});

test('or of bad types', () => {
  const caser = (a, b) => {
    expect(() => new ExpressionOr(a, b, new SourceLocation(0, 0, 0, 0)).evaluate()).toThrow(LocatedException);
  };
  caser(new ExpressionInteger(0), new ExpressionBoolean(false));
  caser(new ExpressionBoolean(false), new ExpressionInteger(1));
  caser(new ExpressionReal(0), new ExpressionInteger(0));
});

test('integer to boolean', () => {
  const caser = (a, expected) => {
    let result = new ExpressionInteger(a).toBoolean();
    expect(result.value).toBe(expected);
  };
  caser(3, true);
  caser(2, true);
  caser(1, true);
  caser(0, false);
  caser(-1, true);
  caser(-2, true);
});

test('xor of integers', () => {
  const caser = (a, b, expected) => {
    let result = new ExpressionXor(new ExpressionInteger(a), new ExpressionInteger(b)).evaluate();
    expect(result.value).toBe(expected);
  };
  caser(1, 1, 0);
  caser(1, 0, 1);
  caser(0, 1, 1);
  caser(0, 0, 0);
  caser(1, 2, 3);
  caser(10, 11, 1);
});

test('and of integers', () => {
  const caser = (a, b, expected) => {
    let result = new ExpressionAnd(new ExpressionInteger(a), new ExpressionInteger(b)).evaluate();
    expect(result.value).toBe(expected);
  };
  caser(1, 1, 1);
  caser(1, 0, 0);
  caser(0, 1, 0);
  caser(0, 0, 0);
  caser(1, 2, 0);
  caser(5, 4, 4);
});

// --------------------------------------------------------------------------- 

test('boolean to integer', () => {
  const caser = (a, expected) => {
    let result = new ExpressionBoolean(a).toInteger();
    expect(result).toBe(expected);
  };
  caser(true, 1);
  caser(false, 0);
});

test('not', () => {
  const caser = (a, expected) => {
    let result = new ExpressionNot(new ExpressionBoolean(a)).evaluate();
    expect(result.value).toBe(expected);
  };
  caser(true, false);
  caser(false, true);
});

test('xor of booleans', () => {
  const caser = (a, b, expected) => {
    let result = new ExpressionXor(new ExpressionBoolean(a), new ExpressionBoolean(b)).evaluate();
    expect(result.value).toBe(expected);
  };
  caser(true, true, false);
  caser(true, false, true);
  caser(false, true, true);
  caser(false, false, false);
});

test('or', () => {
  const caser = (a, b, expected) => {
    let result = new ExpressionOr(new ExpressionBoolean(a), new ExpressionBoolean(b)).evaluate();
    expect(result.value).toBe(expected);
  };
  caser(true, true, true);
  caser(true, false, true);
  caser(false, true, true);
  caser(false, false, false);
});

test('and', () => {
  const caser = (a, b, expected) => {
    let result = new ExpressionAnd(new ExpressionBoolean(a), new ExpressionBoolean(b)).evaluate();
    expect(result.value).toBe(expected);
  };
  caser(true, true, true);
  caser(true, false, false);
  caser(false, true, false);
  caser(false, false, false);
});

test('gets true from boolean literal', () => {
  let a = new ExpressionBoolean(true);
  expect(a.value).toBe(true);
});

// --------------------------------------------------------------------------- 
// Loops
// --------------------------------------------------------------------------- 

test('for to marches from 0 to exclusive upper bound', () => {
  let src = `
for i to 5
  print(i)
`.substring(1);
  let lines = ['0', '1', '2', '3', '4'];
  evaluateOutput(src, lines);
});

test('for through marches from 0 to inclusive upper bound', () => {
  let src = `
for i through 5
  print(i)
`.substring(1);
  let lines = ['0', '1', '2', '3', '4', '5'];
  evaluateOutput(src, lines);
});

test('for in marches through inclusive range', () => {
  let src = `
for i in 0..5
  print(i)
`.substring(1);
  let lines = ['0', '1', '2', '3', '4', '5'];
  evaluateOutput(src, lines);
});

test('for to-by marches from 0 to exclusive upper bound', () => {
  let src = `
for i to 5 by 2
  print(i)
`.substring(1);
  let lines = ['0', '2', '4'];
  evaluateOutput(src, lines);
});

test('for through-by marches from 0 to inclusive upper bound', () => {
  let src = `
for i through 5 by 2
  print(i)
`.substring(1);
  let lines = ['0', '2', '4'];
  evaluateOutput(src, lines);
});

test('for in-by marches through inclusive range', () => {
  let src = `
for i in 0..5 by 2
  print(i)
`.substring(1);
  let lines = ['0', '2', '4'];
  evaluateOutput(src, lines);
});

test('for to-by marches from 0 to exclusive upper bound', () => {
  let src = `
for i to 6 by 2
  print(i)
`.substring(1);
  let lines = ['0', '2', '4'];
  evaluateOutput(src, lines);
});

test('for through-by marches from 0 to inclusive upper bound', () => {
  let src = `
for i through 6 by 2
  print(i)
`.substring(1);
  let lines = ['0', '2', '4', '6'];
  evaluateOutput(src, lines);
});

test('for in-by marches through inclusive range', () => {
  let src = `
for i in 0..6 by 2
  print(i)
`.substring(1);
  let lines = ['0', '2', '4', '6'];
  evaluateOutput(src, lines);
});

// --------------------------------------------------------------------------- 

test('functions don\'t violate parent\'s scope', () => {
  let src = `
to foo(a, b)
  print(a + b)
  a = 11

a = 9
foo(a, 7)
print(a)
`.substring(1);
  let lines = ['16', '9'];
  evaluateOutput(src, lines);
});

// --------------------------------------------------------------------------- 

test('if as expression', () => {
  let src = `
a = if 0 == 1
  "then"
else
  "else"
print(a)
`.substring(1);
  let lines = ['else'];
  evaluateOutput(src, lines);
});

// --------------------------------------------------------------------------- 

test('object local', () => {
  let src = `
r = with rectangle()
  a = 7
  color = :red
  corner = :zero2
  size = [50, 50]
print(r.a)
`.substring(1);
  let lines = ['7'];
  evaluateOutput(src, lines);
});


// --------------------------------------------------------------------------- 
// Operators
// ---------------------------------------------------------------------------

test('operator ^', () => {
  evaluateExpression('5 ^ 2', new ExpressionInteger(25));
  evaluateExpression('100 ^ 0.5', new ExpressionReal(10));
  evaluateExpression('2 ^ 0.5', new ExpressionReal(1.4142135623730951));
});

// --------------------------------------------------------------------------- 

test('unary operator -', () => {
  evaluateExpression('-(5)', new ExpressionInteger(-5));
});

// --------------------------------------------------------------------------- 

test('binary operator -', () => {
  evaluateExpression('5 - 3', new ExpressionInteger(2));
  evaluateExpression('3 - 5', new ExpressionInteger(-2));
  evaluateExpression('(5 - 3)', new ExpressionInteger(2));
  evaluateExpression('[5-3,-1,-3-7]', new ExpressionVector([
    new ExpressionInteger(2),
    new ExpressionInteger(-1),
    new ExpressionInteger(-10),
  ]));
});

// --------------------------------------------------------------------------- 
// Dittos
// --------------------------------------------------------------------------- 

test('top-level ditto', () => {
  const e = new ExpressionVector([
    new ExpressionAdd(new ExpressionInteger(6), new ExpressionInteger(3)),
    new ExpressionDitto(),
    new ExpressionDitto(),
  ]).evaluate(null, null, null, {prior: new ExpressionUnit()});

  assertSame(new ExpressionInteger(9), e.get(0));
  assertSame(new ExpressionInteger(9), e.get(1));
  assertSame(new ExpressionInteger(9), e.get(2));
});

// --------------------------------------------------------------------------- 

test('nested ditto', () => {
  const e = new ExpressionVector([
    new ExpressionAdd(new ExpressionInteger(6), new ExpressionInteger(3)),
    new ExpressionAdd(new ExpressionDitto(), new ExpressionInteger(10)),
    new ExpressionAdd(new ExpressionDitto(), new ExpressionInteger(15)),
  ]).evaluate(null, null, null, {prior: new ExpressionUnit()});

  assertSame(new ExpressionInteger(9), e.get(0));
  assertSame(new ExpressionInteger(19), e.get(1));
  assertSame(new ExpressionInteger(34), e.get(2));
});

// --------------------------------------------------------------------------- 
