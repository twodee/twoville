import {
  ExpressionBoolean,
  ExpressionInteger,
  ExpressionReal,
  ExpressionString,
  ExpressionVector,
  ExpressionUnit,
} from './ast.js';

export const Symbol = Object.freeze({
  ':clockwise': new ExpressionInteger(0),
  ':counterclockwise': new ExpressionInteger(1),

  // for alignment-baseline on text elements
  // See https://vanseodesign.com/web-design/svg-text-baseline-alignment for semantics.
  ':top': new ExpressionString('hanging'),
  ':center': new ExpressionString('center'),
  ':central': new ExpressionString('central'),
  ':bottom': new ExpressionString('baseline'),

  // Text anchors.
  ':start': new ExpressionString('start'),
  ':middle': new ExpressionString('middle'),
  ':end': new ExpressionString('end'),

  ':short': new ExpressionInteger(0),
  ':long': new ExpressionInteger(1),

  ':round': new ExpressionString('round'),
  ':miter': new ExpressionString('miter'),
  ':bevel': new ExpressionString('bevel'),

  ':forever': new ExpressionInteger(0),

  // Vectors
  ':zero2': new ExpressionVector([new ExpressionReal(0), new ExpressionReal(0)]),
  ':zero3': new ExpressionVector([new ExpressionReal(0), new ExpressionReal(0), new ExpressionReal(0)]),
  ':up': new ExpressionVector([new ExpressionReal(0), new ExpressionReal(1)]),
  ':right': new ExpressionVector([new ExpressionReal(1), new ExpressionReal(0)]),

  // Interpolants
  ':linear': new ExpressionString('interpolateLinear'),
  ':nearest': new ExpressionString('interpolateNearest'),
  // ':ease': new ExpressionString('ease'),
  ':sineInOut': new ExpressionString('interpolateSineInOut'),
  ':backInOut': new ExpressionString('interpolateBackInOut'),
  ':quadraticInOut': new ExpressionString('interpolateQuadraticInOut'),
  ':cubicInOut': new ExpressionString('interpolateCubicInOut'),
  ':quarticInOut': new ExpressionString('interpolateQuarticInOut'),
  ':quinticInOut': new ExpressionString('interpolateQuinticInOut'),

  // Colors
  ':soggy': new ExpressionVector([new ExpressionReal(0.663), new ExpressionReal(0.663), new ExpressionReal(0.663)]),
  ':silver': new ExpressionVector([new ExpressionReal(0.753), new ExpressionReal(0.753), new ExpressionReal(0.753)]),
  ':gray': new ExpressionVector([new ExpressionReal(0.5), new ExpressionReal(0.5), new ExpressionReal(0.5)]),
  ':black': new ExpressionVector([new ExpressionReal(0), new ExpressionReal(0), new ExpressionReal(0)]),
  ':red': new ExpressionVector([new ExpressionReal(1), new ExpressionReal(0), new ExpressionReal(0)]),
  ':purple': new ExpressionVector([new ExpressionReal(0.5), new ExpressionReal(0), new ExpressionReal(0.5)]),
  ':indigo': new ExpressionVector([new ExpressionReal(0.294), new ExpressionReal(0), new ExpressionReal(0.51)]),
  ':pink': new ExpressionVector([new ExpressionReal(1), new ExpressionReal(0.5), new ExpressionReal(1)]),
  ':lime': new ExpressionVector([new ExpressionReal(0), new ExpressionReal(1), new ExpressionReal(0)]),
  ':green': new ExpressionVector([new ExpressionReal(0), new ExpressionReal(0.5), new ExpressionReal(0)]),
  ':chartreuse': new ExpressionVector([new ExpressionReal(0.5), new ExpressionReal(1), new ExpressionReal(0)]),
  ':blue': new ExpressionVector([new ExpressionReal(0), new ExpressionReal(0), new ExpressionReal(1)]),
  ':white': new ExpressionVector([new ExpressionReal(1), new ExpressionReal(1), new ExpressionReal(1)]),
  ':yellow': new ExpressionVector([new ExpressionReal(1), new ExpressionReal(1), new ExpressionReal(0)]),
  ':orange': new ExpressionVector([new ExpressionReal(1), new ExpressionReal(0.5), new ExpressionReal(0)]),
  ':cyan': new ExpressionVector([new ExpressionReal(0), new ExpressionReal(1), new ExpressionReal(1)]),
  ':magenta': new ExpressionVector([new ExpressionReal(1), new ExpressionReal(0), new ExpressionReal(1)]),
  ':cornflower': new ExpressionVector([new ExpressionReal(0.392), new ExpressionReal(0.584), new ExpressionReal(0.929)]),
  ':crimson': new ExpressionVector([new ExpressionReal(0.863), new ExpressionReal(0.078), new ExpressionReal(0.235)]),

  ':absolute': new ExpressionInteger(0),
  ':relative': new ExpressionInteger(1),
  ':symmetric': new ExpressionInteger(2),

  // Polygon
  ':open': new ExpressionInteger(0),
  ':closed': new ExpressionInteger(1),

  ':none': new ExpressionUnit(),
});
