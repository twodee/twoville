import {
  lex
} from './lexer.js';

import { 
  parse,
} from './parser.js';

import {
  SourceLocation,
  FunctionDefinition,
} from './common.js';

import {
  Environment,
} from './scene.js';

const seedrandom = require('seedrandom');

import { 
  ExpressionAdd,
  ExpressionArcCosine,
  ExpressionArcSine,
  ExpressionArcTangent,
  ExpressionArcTangent2,
  ExpressionBoolean,
  ExpressionCircle,
  ExpressionCosine,
  ExpressionCutout,
  ExpressionDivide,
  ExpressionGroup,
  ExpressionHypotenuse,
  ExpressionIdentifier,
  ExpressionInt,
  ExpressionInteger,
  ExpressionLabel,
  ExpressionLine,
  ExpressionMarker,
  ExpressionMask,
  ExpressionMultiply,
  ExpressionPath,
  ExpressionPathArc,
  ExpressionPathCubic,
  ExpressionPathJump,
  ExpressionPathLine,
  ExpressionPathQuadratic,
  ExpressionPower,
  ExpressionPolygon,
  ExpressionPolyline,
  ExpressionPrint,
  ExpressionRandom,
  ExpressionReal,
  ExpressionRectangle,
  ExpressionRotate,
  ExpressionScale,
  ExpressionShear,
  ExpressionSeed,
  ExpressionSine,
  ExpressionSquareRoot,
  ExpressionString,
  ExpressionSubtract,
  ExpressionTangent,
  ExpressionTranslate,
  ExpressionTurtle,
  ExpressionTurtleMove,
  ExpressionTurtleTurn,
  ExpressionUngon,
  ExpressionVector,
  ExpressionVectorAdd,
  ExpressionVectorToCartesian,
  ExpressionVectorMagnitude,
  ExpressionVectorNormalize,
  ExpressionVectorSize,
  ExpressionVertex,
} from './ast.js';

// --------------------------------------------------------------------------- 

export class Random {
  constructor() {
    this.engine = seedrandom();
  }

  seed(value) {
    this.engine = seedrandom(value);
  }

  random01() {
    return this.engine.quick();
  }
}

// --------------------------------------------------------------------------- 

export class InterpreterEnvironment extends Environment {
  initialize(log) {
    super.initialize(null);

    this.shapes = [];
    this.prng = new Random();
    this.viewportFillers = []; // TODO needed?
    this.serial = 0;
    this.log = log;
    this.root = this;
 
    this.untimedProperties.time = Environment.create(this);
    this.untimedProperties.time.bind('start', new ExpressionInteger(0));
    this.untimedProperties.time.bind('stop', new ExpressionInteger(100));
    this.untimedProperties.time.bind('delay', new ExpressionInteger(16));
    this.untimedProperties.time.bind('resolution', new ExpressionInteger(1));

    this.untimedProperties.gif = Environment.create(this);
    this.untimedProperties.gif.bind('size', new ExpressionVector([
      new ExpressionInteger(100),
      new ExpressionInteger(100)
    ]));
    this.untimedProperties.gif.bind('name', new ExpressionString('twoville.gif'));
    this.untimedProperties.gif.bind('transparency', new ExpressionVector([
      new ExpressionReal(0),
      new ExpressionReal(0),
      new ExpressionReal(0),
    ]));
    this.untimedProperties.gif.bind('repeat', new ExpressionInteger(0));
    this.untimedProperties.gif.bind('delay', new ExpressionInteger(10));
    this.untimedProperties.gif.bind('skip', new ExpressionInteger(1));

    this.untimedProperties.viewport = Environment.create(this);
    this.untimedProperties.viewport.bind('size', new ExpressionVector([
      new ExpressionInteger(100),
      new ExpressionInteger(100)
    ]));

    Object.assign(this.untimedProperties, {
      rectangle: new FunctionDefinition('rectangle', [], new ExpressionRectangle()),
      line: new FunctionDefinition('line', [], new ExpressionLine()),
      path: new FunctionDefinition('path', [], new ExpressionPath()),
      ungon: new FunctionDefinition('ungon', [], new ExpressionUngon()),
      polygon: new FunctionDefinition('polygon', [], new ExpressionPolygon()),
      polyline: new FunctionDefinition('polyline', [], new ExpressionPolyline()),
      label: new FunctionDefinition('label', [], new ExpressionLabel()),
      group: new FunctionDefinition('group', [], new ExpressionGroup()),
      marker: new FunctionDefinition('marker', [], new ExpressionMarker()),
      mask: new FunctionDefinition('mask', [], new ExpressionMask()),
      cutout: new FunctionDefinition('cutout', [], new ExpressionCutout()),
      circle: new FunctionDefinition('circle', [], new ExpressionCircle()),
      print: new FunctionDefinition('print', ['message'], new ExpressionPrint()),
      random: new FunctionDefinition('random', ['min', 'max'], new ExpressionRandom()),
      seed: new FunctionDefinition('seed', ['value'], new ExpressionSeed()),
      sin: new FunctionDefinition('sin', ['degrees'], new ExpressionSine()),
      cos: new FunctionDefinition('cos', ['degrees'], new ExpressionCosine()),
      tan: new FunctionDefinition('tan', ['degrees'], new ExpressionTangent()),
      asin: new FunctionDefinition('asin', ['ratio'], new ExpressionArcSine()),
      hypotenuse: new FunctionDefinition('hypotenuse', ['a', 'b'], new ExpressionHypotenuse()),
      acos: new FunctionDefinition('acos', ['ratio'], new ExpressionArcCosine()),
      atan: new FunctionDefinition('atan', ['ratio'], new ExpressionArcTangent()),
      atan2: new FunctionDefinition('atan2', ['a', 'b'], new ExpressionArcTangent2()),
      sqrt: new FunctionDefinition('sqrt', ['x'], new ExpressionSquareRoot()),
      int: new FunctionDefinition('int', ['x'], new ExpressionInt()),
    });
  }

  static create(log) {
    const env = new InterpreterEnvironment();
    env.initialize(log);
    return env;
  }

  toPod() {
    return {
      untimedProperties: {
        time: this.untimedProperties.time.toPod(),
        gif: this.untimedProperties.gif.toPod(),
        viewport: this.untimedProperties.viewport.toPod(),
      },
      shapes: this.shapes.map(shape => shape.toPod()),
    };
  }
}

export function interpret(source, log) {

  // for (let i = 0; i < 10000000; ++i) {
    // console.log(i);
  // }

  let tokens = lex(source);
  let ast = parse(tokens);
  const env = InterpreterEnvironment.create(log);
  ast.evaluate(env);
  return env;
}