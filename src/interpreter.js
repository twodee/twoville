import {
  lex
} from './lexer.js';

import { 
  parse,
} from './parser.js';

import {
  MessagedException,
  SourceLocation,
  FunctionDefinition,
  mop,
} from './common.js';

import {
  Environment,
} from './environment.js';

const seedrandom = require('seedrandom');

import { 
  ExpressionArcCosine,
  ExpressionArcSine,
  ExpressionArcTangent,
  ExpressionArcTangent2,
  ExpressionCircle,
  ExpressionCosine,
  ExpressionCutout,
  ExpressionDebug,
  ExpressionGroup,
  ExpressionHypotenuse,
  ExpressionInt,
  ExpressionInteger,
  ExpressionText,
  ExpressionLine,
  ExpressionMask,
  ExpressionMultiply,
  ExpressionPath,
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
  ExpressionTip,
  ExpressionUngon,
  ExpressionVector,
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

    this.bindGlobalFunctions();
    // Object.assign(this.functions, {
      // rectangle: new FunctionDefinition('rectangle', [], new ExpressionRectangle()),
      // line: new FunctionDefinition('line', [], new ExpressionLine()),
      // path: new FunctionDefinition('path', [], new ExpressionPath()),
      // ungon: new FunctionDefinition('ungon', [], new ExpressionUngon()),
      // polygon: new FunctionDefinition('polygon', [], new ExpressionPolygon()),
      // polyline: new FunctionDefinition('polyline', [], new ExpressionPolyline()),
      // text: new FunctionDefinition('text', [], new ExpressionText()),
      // group: new FunctionDefinition('group', [], new ExpressionGroup()),
      // tip: new FunctionDefinition('tip', [], new ExpressionTip()),
      // mask: new FunctionDefinition('mask', [], new ExpressionMask()),
      // cutout: new FunctionDefinition('cutout', [], new ExpressionCutout()),
      // circle: new FunctionDefinition('circle', [], new ExpressionCircle()),
      // print: new FunctionDefinition('print', ['message'], new ExpressionPrint()),
      // debug: new FunctionDefinition('debug', ['expression'], new ExpressionDebug()),
      // random: new FunctionDefinition('random', ['min', 'max'], new ExpressionRandom()),
      // seed: new FunctionDefinition('seed', ['value'], new ExpressionSeed()),
      // sin: new FunctionDefinition('sin', ['degrees'], new ExpressionSine()),
      // cos: new FunctionDefinition('cos', ['degrees'], new ExpressionCosine()),
      // tan: new FunctionDefinition('tan', ['degrees'], new ExpressionTangent()),
      // asin: new FunctionDefinition('asin', ['ratio'], new ExpressionArcSine()),
      // hypotenuse: new FunctionDefinition('hypotenuse', ['a', 'b'], new ExpressionHypotenuse()),
      // acos: new FunctionDefinition('acos', ['ratio'], new ExpressionArcCosine()),
      // atan: new FunctionDefinition('atan', ['ratio'], new ExpressionArcTangent()),
      // atan2: new FunctionDefinition('atan2', ['a', 'b'], new ExpressionArcTangent2()),
      // sqrt: new FunctionDefinition('sqrt', ['x'], new ExpressionSquareRoot()),
      // int: new FunctionDefinition('int', ['x'], new ExpressionInt()),
    // });
  }

  static create(source, log) {
    const env = new InterpreterEnvironment();
    env.initialize(log);
    env.source = source;
    return env;
  }

  toPod() {
    return {
      shapes: this.shapes.map(shape => shape.toExpandedPod()),
      untimedProperties: mop(this.untimedProperties, value => value.toPod()),
    };
  }
}

export function interpret(source, log) {
  try {
    let tokens = lex(source);
    let ast = parse(tokens);
    const env = InterpreterEnvironment.create(source, log);
    ast.evaluate(env);
    return env;
  } catch (e) {
    if (e instanceof MessagedException) {
      log(e.userMessage);
    } else {
      console.error(e);
      log(e);
    }
    return null;
  }
}
