import {
  LocatedException,
} from './common';

import {
  TimelinedEnvironment
} from './environment';

import {
  ExpressionInteger,
  ExpressionReal,
} from './ast';

// --------------------------------------------------------------------------- 

export class Stroke extends TimelinedEnvironment {
  static type = 'stroke';
  static article = 'a';
  static timedIds = ['size', 'color', 'opacity'];

  static create(parentEnvironment, where) {
    const stroke = new Stroke();
    stroke.initialize(parentEnvironment, where);
    return stroke;
  }

  static reify(parentEnvironment, pod) {
    const stroke = new Stroke();
    stroke.embody(parentEnvironment, pod);
    stroke.state = {};
    return stroke;
  }
}

// --------------------------------------------------------------------------- 

export function configureStroke(stateHost, domHost, bounds, isRequired) {
  // Stroke color.
  stateHost.configureVectorProperty('color', stateHost, domHost, domHost.updateStrokeColorDom.bind(domHost), bounds, [], timeline => {
    if (timeline) {
      try {
        timeline.assertList(3, ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>color</code>. ${e.message}`);
      }
    } else if (isRequired) {
      throw new LocatedException(stateHost.where, `I found ${domHost.article} ${domHost.type} whose stroke <code>color</code> isn't set.`);
    }
  });

  // Stroke opacity.
  stateHost.configureScalarProperty('opacity', stateHost, domHost, domHost.updateStrokeOpacityDom.bind(domHost), bounds, [], timeline => {
    if (timeline) {
      try {
        timeline.assertScalar(ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>opacity</code>. ${e.message}`);
      }
    }
    return isRequired;
  });

  // Stroke size.
  stateHost.configureScalarProperty('size', stateHost, domHost, domHost.updateStrokeSizeDom.bind(domHost), bounds, [], timeline => {
    if (timeline) {
      try {
        timeline.assertScalar(ExpressionInteger, ExpressionReal);
        return true;
      } catch (e) {
        throw new LocatedException(e.where, `I found an illegal value for <code>size</code>. ${e.message}`);
      }
    }
    return isRequired;
  });

  if (stateHost.untimedProperties.hasOwnProperty('dashes')) {
    domHost.updateStrokeDashDom(stateHost.untimedProperties.dashes.toSpacedString());
  }

  if (stateHost.untimedProperties.hasOwnProperty('join')) {
    domHost.updateStrokeJoinDom(stateHost.untimedProperties.join.value);
  }
}

// --------------------------------------------------------------------------- 

