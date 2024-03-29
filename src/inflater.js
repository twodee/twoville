import {Timeline} from './timeline.js';
import {FunctionDefinition} from './common.js';
import {StaticContext, DynamicContext, Frame} from './frame.js';
import {Group} from './shape.js';

import {
  Expression,
  // ExpressionBoolean,
  // ExpressionInteger,
  // ExpressionReal,
  // ExpressionString,
  // ExpressionVector,
} from './ast.js';

import {
  BumpNode,
  CurlNode,
  OrbitNode,
  BackNode,
  CubicNode,
  CircleNode,
  GoNode,
  FlyNode,
  LineNode,
  Mirror,
  PopNode,
  PushNode,
  WalkNode,
  QuadraticNode,
  RectangleNode,
  TabNode,
  Tile,
  TurtleNode,
  TurnNode,
  VertexNode,
} from './node.js';

import {
  Rotate,
  Scale,
  Shear,
  Translate,
} from './transform.js';

// --------------------------------------------------------------------------- 

export class Inflater {
  static inflate(env, object) {
    if (!object) {
      return undefined;
    // } else if (object.type === 'environment') {
      // return Environment.inflate(env, object);
    } else if (object.type === 'StaticContext') {
      return StaticContext.inflate(env, object, Inflater);
    } else if (object.type === 'frame') {
      return Frame.inflate(env, object, Inflater);
    } else if (object.type === 'function-signature') {
      return FunctionDefinition.inflate(object, Inflater);
    } else if (object.type === 'reference') {
      return object;
      // return env.root.shapes.find(shape => shape.id === object.id);
    // } else if (object.type === 'stroke') {
      // return Stroke.inflate(env, object, Inflater);
    } else if (object.type === 'mirror') {
      return Mirror.inflate(env, object, Inflater);
    } else if (object.type === 'timeline') {
      return Timeline.inflate(env, object, Inflater);
    } else if (object.type === 'vertex') {
      return VertexNode.inflate(env, object, Inflater);
    } else if (object.type === 'tab') {
      return TabNode.inflate(env, object, Inflater);
    } else if (object.type === 'turtle') {
      return TurtleNode.inflate(env, object, Inflater);
    } else if (object.type === 'walk') {
      return WalkNode.inflate(env, object, Inflater);
    } else if (object.type === 'turn') {
      return TurnNode.inflate(env, object, Inflater);
    } else if (object.type === 'back') {
      return BackNode.inflate(env, object, Inflater);
    } else if (object.type === 'push') {
      return PushNode.inflate(env, object, Inflater);
    } else if (object.type === 'pop') {
      return PopNode.inflate(env, object, Inflater);
    } else if (object.type === 'go') {
      return GoNode.inflate(env, object, Inflater);
    } else if (object.type === 'fly') {
      return FlyNode.inflate(env, object, Inflater);
    } else if (object.type === 'tile') {
      return Tile.inflate(env, object, Inflater);
    } else if (object.type === 'circle') {
      return CircleNode.inflate(env, object, Inflater);
    } else if (object.type === 'rectangle') {
      return RectangleNode.inflate(env, object, Inflater);
    } else if (object.type === 'line') {
      return LineNode.inflate(env, object, Inflater);
    } else if (object.type === 'quadratic') {
      return QuadraticNode.inflate(env, object, Inflater);
    } else if (object.type === 'cubic') {
      return CubicNode.inflate(env, object, Inflater);
    } else if (object.type === 'bump') {
      return BumpNode.inflate(env, object, Inflater);
    } else if (object.type === 'orbit') {
      return OrbitNode.inflate(env, object, Inflater);
    } else if (object.type === 'curl') {
      return CurlNode.inflate(env, object, Inflater);
    } else if (object.type === 'translate') {
      return Translate.inflate(env, object, Inflater);
    } else if (object.type === 'scale') {
      return Scale.inflate(env, object, Inflater);
    } else if (object.type === 'rotate') {
      return Rotate.inflate(env, object, Inflater);
    } else if (object.type === 'group') {
      return Group.inflate(env, object, Inflater);
    } else if (object.type === 'shear') {
      return Shear.inflate(env, object, Inflater);
    } else if (!object.type) {
    } else if (object.type.startsWith('Expression')) {
      const e = Expression.inflate(env, object, Inflater);
      return e;
    } else {
      console.error(object);
      throw Error('can\'t inflate');
    }
  }
}

// --------------------------------------------------------------------------- 

