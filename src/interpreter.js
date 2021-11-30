import {lex} from './lexer.js';
import {parse} from './parser.js';
import {MessagedException, SourceLocation, FunctionDefinition, objectMap} from './common.js';
import {Frame, StaticContext} from './frame.js';
import {Random} from './random.js';
import {
  ExpressionAbsoluteValue,
  ExpressionArcCosine,
  ExpressionArcSine,
  ExpressionArcTangent,
  ExpressionArcTangent2,
  ExpressionBoolean,
  ExpressionCircle,
  ExpressionCosine,
  ExpressionCutout,
  ExpressionDebug,
  ExpressionGrid,
  ExpressionGroup,
  ExpressionHypotenuse,
  ExpressionInt,
  ExpressionInteger,
  ExpressionLine,
  ExpressionMask,
  ExpressionPath,
  ExpressionPolar,
  ExpressionPolygon,
  ExpressionPolyline,
  ExpressionPrint,
  ExpressionRandom,
  ExpressionRaster,
  ExpressionReal,
  ExpressionRectangle,
  ExpressionSeed,
  ExpressionSine,
  ExpressionSquareRoot,
  ExpressionString,
  ExpressionTangent,
  ExpressionText,
  ExpressionTip,
  ExpressionUngon,
  ExpressionUnit,
  ExpressionUnpolar,
  ExpressionVector,
} from './ast.js';

/*
------------------------------------------------------------------------------ 
An InterpreterFrame is the base frame that is active while the program is
being evaluated. It holds onto globals that will be needed while shapes are
being made. These globals include the following:

- a list of shapes
- a serial counter to uniquely identify the shapes
- a random number generator
- a log function
- a standard library of values and functions

The frame may be created in the context of a web worker. If it has to cross
the web worker boundary, it will need to be serialized with deflate.
------------------------------------------------------------------------------ 
*/

export class InterpreterFrame extends Frame {
  initialize(log) {
    super.initialize(null);

    this.shapes = [];
    this.prng = new Random();
    this.serial = 0;
    this.log = log;
 
    this.bindGlobalProperties();
    this.bindGlobalFunctions();
  }

  static create(source, log) {
    const env = new InterpreterFrame();
    env.initialize(log);
    env.source = source;
    return env;
  }

  deflate() {
    return {
      shapes: this.shapes.map(shape => shape.deflateReferent()),
      staticContext: this.staticContext.deflate(),
      dynamicContext: this.dynamicContext.deflate(),
    };
  }

  bindGlobalProperties() {
    // Time properties
    const timeProperties = StaticContext.create();
    timeProperties.bind('start', new ExpressionInteger(0));
    timeProperties.bind('stop', new ExpressionInteger(100));
    timeProperties.bind('delay', new ExpressionReal(0.02));
    this.bindStatic('time', timeProperties);

    // Viewport properties
    const viewProperties = StaticContext.create();
    viewProperties.bind('autofit', new ExpressionBoolean(false));
    viewProperties.bind('size', new ExpressionVector([
      new ExpressionInteger(100),
      new ExpressionInteger(100)
    ]));
    this.bindStatic('view', viewProperties);

    // Export properties
    const exportProperties = StaticContext.create();
    exportProperties.bind('name', new ExpressionString('twoville'));
    exportProperties.bind('loop', new ExpressionInteger(0));
    exportProperties.bind('delay', new ExpressionInteger(10));
    exportProperties.bind('size', new ExpressionVector([
      new ExpressionInteger(100),
      new ExpressionInteger(100)
    ]));
    exportProperties.bind('transparency', new ExpressionVector([
      new ExpressionReal(0),
      new ExpressionReal(0),
      new ExpressionReal(0),
    ]));
    exportProperties.bind('background', new ExpressionVector([
      new ExpressionReal(1),
      new ExpressionReal(1),
      new ExpressionReal(1),
    ]));
    this.bindStatic('export', exportProperties);
  }

  bindGlobalFunctions() {
    Object.assign(this.staticContext.bindings, {
      abs: new FunctionDefinition('abs', ['x'], new ExpressionAbsoluteValue()),
      acos: new FunctionDefinition('acos', ['ratio'], new ExpressionArcCosine()),
      asin: new FunctionDefinition('asin', ['ratio'], new ExpressionArcSine()),
      atan2: new FunctionDefinition('atan2', ['a', 'b'], new ExpressionArcTangent2()),
      atan: new FunctionDefinition('atan', ['ratio'], new ExpressionArcTangent()),
      circle: new FunctionDefinition('circle', [], new ExpressionCircle()),
      cos: new FunctionDefinition('cos', ['degrees'], new ExpressionCosine()),
      cutout: new FunctionDefinition('cutout', [], new ExpressionCutout()),
      debug: new FunctionDefinition('debug', ['expression'], new ExpressionDebug()),
      grid: new FunctionDefinition('grid', [], new ExpressionGrid()),
      group: new FunctionDefinition('group', [], new ExpressionGroup()),
      hypotenuse: new FunctionDefinition('hypotenuse', ['a', 'b'], new ExpressionHypotenuse()),
      int: new FunctionDefinition('int', ['x'], new ExpressionInt()),
      line: new FunctionDefinition('line', [], new ExpressionLine()),
      mask: new FunctionDefinition('mask', [], new ExpressionMask()),
      path: new FunctionDefinition('path', [], new ExpressionPath()),
      polar: new FunctionDefinition('polar', ['x', 'y'], new ExpressionPolar()),
      polygon: new FunctionDefinition('polygon', [], new ExpressionPolygon()),
      polyline: new FunctionDefinition('polyline', [], new ExpressionPolyline()),
      print: new FunctionDefinition('print', ['message'], new ExpressionPrint()),
      random: new FunctionDefinition('random', ['min', 'max'], new ExpressionRandom()),
      raster: new FunctionDefinition('raster', [], new ExpressionRaster()),
      rectangle: new FunctionDefinition('rectangle', [], new ExpressionRectangle()),
      seed: new FunctionDefinition('seed', ['value'], new ExpressionSeed()),
      sin: new FunctionDefinition('sin', ['degrees'], new ExpressionSine()),
      sqrt: new FunctionDefinition('sqrt', ['x'], new ExpressionSquareRoot()),
      tan: new FunctionDefinition('tan', ['degrees'], new ExpressionTangent()),
      text: new FunctionDefinition('text', [], new ExpressionText()),
      tip: new FunctionDefinition('tip', [], new ExpressionTip()),
      ungon: new FunctionDefinition('ungon', [], new ExpressionUngon()),
      unpolar: new FunctionDefinition('unpolar', ['radius', 'degrees'], new ExpressionUnpolar()),
    });
  }
}

// --------------------------------------------------------------------------- 

export class Interpreter {
  static interpret(source, log) {
    try {
      let tokens = lex(source);
      let ast = parse(tokens, source);
      const frame = InterpreterFrame.create(source, log);
      ast.evaluate({
        root: frame,
        frames: [frame],
        fromTime: null,
        toTime: null,
        prior: new ExpressionUnit(),
      });
      return frame;
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
}

// --------------------------------------------------------------------------- 

