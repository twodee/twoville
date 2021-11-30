const jsdom = require("jsdom");
const {document} = (new jsdom.JSDOM(`...`)).window;

const {Reifier} = require('../src/reifier');

const {
  StaticContext,
  DynamicContext,
  Frame,
} = require('../src/frame');

const {
  ExpressionInteger,
  ExpressionReal,
  ExpressionBoolean,
  ExpressionVector,
} = require('../src/ast');

const {
  Interpreter
} = require('../src/interpreter');

// --------------------------------------------------------------------------- 

test('StaticContext: bind and get', () => {
  const context = StaticContext.create();

  context.bind('n', 11);
  expect(context.get('n')).toBe(11);

  context.bind('n', 13);
  expect(context.get('n')).toBe(13);
});

test('StaticContext: toPlainObject', () => {
  const context = StaticContext.create();
  context.bind('x', new ExpressionInteger(5));
  context.bind('y', new ExpressionBoolean(false));
  context.bind('z', new ExpressionVector([
    new ExpressionReal(1.5),
    new ExpressionReal(-33),
  ]));

  const actual = context.toPlainObject();
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

test('StaticContext: fromPlainObject', () => {
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

  const actual = StaticContext.fromPlainObject(object, Reifier.reify);

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

