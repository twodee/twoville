import { Timeline } from './timeline.js';

import { 
  ExpressionBoolean,
  ExpressionCircle,
  ExpressionCosine,
  ExpressionCutout,
  ExpressionGroup,
  ExpressionInt,
  ExpressionInteger,
  ExpressionLabel,
  ExpressionLine,
  ExpressionMarker,
  ExpressionMask,
  ExpressionPath,
  ExpressionPathArc,
  ExpressionPathBezier,
  ExpressionPathJump,
  ExpressionPathLine,
  ExpressionPathQuadratic,
  ExpressionPolygon,
  ExpressionPolyline,
  ExpressionPrint,
  ExpressionRandom,
  ExpressionReal,
  ExpressionRectangle,
  ExpressionSine,
  ExpressionString,
  ExpressionVector,
  ExpressionVertex,
} from './ast.js';

export let svgNamespace = "http://www.w3.org/2000/svg";

// --------------------------------------------------------------------------- 

export class MessagedException extends Error {
  constructor(message) {
    super(message);
  }

  get userMessage() {
    return this.message;
  }
}

// --------------------------------------------------------------------------- 

export class LocatedException extends MessagedException {
  constructor(where, message) {
    super(message);
    this.where = where;
  }

  get userMessage() {
    return `${this.where.debugPrefix()}${this.message}`;
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleEnvironment {
  constructor(parent) {
    this.bindings = {};
    this.parent = parent;
    if (parent) {
      this.shapes = parent.shapes;
      this.svg = parent.svg;
    }
  }

  get(id) {
    let env = this;
    while (env != null) {
      if (env.bindings.hasOwnProperty(id)) {
        return env.bindings[id];
      }
      env = env.parent;
    }
    return null;
  }

  owns(id) {
    return this.bindings.hasOwnProperty(id);
  }

  has(id) {
    let env = this;
    while (env != null) {
      if (env.bindings.hasOwnProperty(id)) {
        return true;
      }
      env = env.parent;
    }
    return false;
  }

  bind(id, fromTime, toTime, value) {
    this.bindings[id] = value;
  }

  valueAt(env, property, t) {
    // Assumes property exists.
    return this.bindings[property].valueAt(env, t);
  }

  evaluate(env, fromTime, toTime) {
    return this;
  }
}

// ---------------------------------------------------------------------------

export class TwovilleTimelinedEnvironment extends TwovilleEnvironment {
  constructor(env) {
    super(env);
  }

  bind(id, fromTime, toTime, value) {
    if (!this.bindings.hasOwnProperty(id)) {
      this.bindings[id] = new Timeline();
    }

    if (fromTime != null && toTime != null) {
      this.bindings[id].setFromValue(fromTime, value);
      this.bindings[id].setToValue(toTime, value);
    } else if (fromTime != null) {
      this.bindings[id].setFromValue(fromTime, value);
    } else if (toTime != null) {
      this.bindings[id].setToValue(toTime, value);
    } else {
      this.bindings[id].setDefault(value);
    }
  }

}

// --------------------------------------------------------------------------- 

export let serial = 0;

export function initializeShapes() {
  serial = 0;
}

export class TwovilleShape extends TwovilleTimelinedEnvironment {
  constructor(env, callExpression, type) {
    super(env, callExpression);
    this.type = type;
    this.callExpression = callExpression;
    this.parentElement = null;
    this.bindings.stroke = new TwovilleTimelinedEnvironment(this);
    this.bindings.stroke.bind('opacity', null, null, new ExpressionReal(1));
    this.bind('opacity', null, null, new ExpressionReal(1));
    this.id = serial;
    ++serial;
  }

  getColor(env, t) {
    let isCutout = this.owns('parent') && this.get('parent').defaultValue instanceof TwovilleCutout;

    if (!this.has('color') && !isCutout) {
      throw new LocatedException(this.callExpression.where, `I found a ${this.type} whose color property is not defined.`);
    }
    
    let color;
    if (isCutout) {
      color = new ExpressionVector([
        new ExpressionInteger(0),
        new ExpressionInteger(0),
        new ExpressionInteger(0),
      ]);
    } else {
      color = this.valueAt(env, 'color', t);
    }

    return color;
  }

  domify(svg) {
    if (this.has('clippers')) {
      let clipPath = document.createElementNS(svgNamespace, 'clipPath');
      clipPath.setAttributeNS(null, 'id', 'clip-' + this.id);
      let clippers = this.get('clippers').getDefault();
      clippers.forEach(clipper => {
        let use = document.createElementNS(svgNamespace, 'use');
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#element-' + clipper.id);
        clipPath.appendChild(use);
      });
      svg.firstChild.appendChild(clipPath);
      this.svgElement.setAttributeNS(null, 'clip-path', 'url(#clip-' + this.id + ')');
    }

    if (this.owns('parent')) {
      this.parentElement = this.get('parent').getDefault().svgElement;
    } else if (this.owns('template') && this.get('template').getDefault().value) {
      this.parentElement = svg.firstChild;
    } else {
      this.parentElement = this.svg;
    }

    if (this.owns('mask')) {
      let mask = this.get('mask').getDefault();

      let maskParent = document.createElementNS(svgNamespace, 'g');
      maskParent.setAttributeNS(null, 'mask', 'url(#element-' + mask.id + ')');

      maskParent.appendChild(this.svgElement);
      this.parentElement.appendChild(maskParent);
    } else {
      this.parentElement.appendChild(this.svgElement);
    }
  }

  isTimeSensitive(env) {
    return false;
  }

  assertProperty(id) {
    if (!this.has(id)) {
      throw new LocatedException(this.callExpression.where, `I found a ${this.type} whose ${id} property is not defined.`);
    }
  }

  show() {
    this.svgElement.setAttributeNS(null, 'visibility', 'visible');
  }

  hide() {
    this.svgElement.setAttributeNS(null, 'visibility', 'hidden');
  }

  setStrokelessStroke(env, t) {
    if (this.owns('size') &&
        this.owns('color') &&
        this.owns('opacity')) {
      let strokeSize = this.valueAt(env, 'size', t);
      let strokeColor = this.valueAt(env, 'color', t);
      let strokeOpacity = this.valueAt(env, 'opacity', t);
      this.svgElement.setAttributeNS(null, 'stroke', strokeColor.toColor());
      this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.value);
      this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.value);
      if (this.owns('dashes')) {
        let dashes = this.valueAt(env, 'dashes', t).toSpacedString();
        this.svgElement.setAttributeNS(null, 'stroke-dasharray', dashes);
      }
    }
  }
 
  setStroke(env, t) {
    if (this.has('stroke')) {
      let stroke = this.get('stroke');
      if (stroke.owns('size') &&
          stroke.owns('color') &&
          stroke.owns('opacity')) {
        let strokeSize = stroke.valueAt(env, 'size', t);
        let strokeColor = stroke.valueAt(env, 'color', t);
        let strokeOpacity = stroke.valueAt(env, 'opacity', t);
        this.svgElement.setAttributeNS(null, 'stroke', strokeColor.toColor());
        this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.value);
        this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.value);
        if (stroke.owns('dashes')) {
          let dashes = stroke.valueAt(env, 'dashes', t).toSpacedString();
          this.svgElement.setAttributeNS(null, 'stroke-dasharray', dashes);
        }
      }
    }
  }

  setTransform(env, t) {
    if (this.has('rotation')) {
      if (this.has('pivot')) {
        let pivot = this.valueAt(env, 'pivot', t);
        let rotation = this.valueAt(env, 'rotation', t);
        if (pivot && rotation) {
          this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.value + ' ' + pivot.get(0).value + ',' + pivot.get(1).value + ')');
        }
      } else {
        throw new LocatedException(this.callExpression.where, `I found a ${this.type} that is rotated, but it\'s pivot property is not defined.`);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleGroup extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'group');
    this.children = [];
    this.svgElement = document.createElementNS(svgNamespace, 'g');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  draw(env, t) {
    this.setTransform(env, t);
    this.children.forEach(child => child.draw(env, t));
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleMarker extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'marker');
    this.children = [];
    this.svgElement = document.createElementNS(svgNamespace, 'marker');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.svgElement.setAttributeNS(null, 'orient', 'auto');
    this.svgElement.setAttributeNS(null, 'markerUnits', 'strokeWidth');
    this.bind('template', null, null, new ExpressionBoolean(true));
  }

  draw(env, t) {
    this.assertProperty('size');
    this.assertProperty('anchor');

    if (this.has('corner') && this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found a marker whose corner and center properties were both set. Define only one of these.');
    }

    if (!this.has('corner') && !this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found a marker whose location I couldn\'t figure out. Please define its corner or center.');
    }
    
    let anchor = this.valueAt(env, 'anchor', t);
    let size = this.valueAt(env, 'size', t);

    let corner;
    if (this.has('corner')) {
      corner = this.valueAt(env, 'corner', t);
    } else {
      let center = this.valueAt(env, 'center', t);
      corner = new ExpressionVector([
        new ExpressionReal(center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(center.get(1).value - size.get(1).value * 0.5),
      ]);
    }

    let bounds = {
      x: corner.get(0).value,
      y: corner.get(1).value,
      width: size.get(0).value,
      height: size.get(1).value,
    };

    this.svgElement.setAttributeNS(null, 'viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`)

    this.svgElement.setAttributeNS(null, 'markerWidth', size.get(0).value);
    this.svgElement.setAttributeNS(null, 'markerHeight', size.get(1).value);
    this.svgElement.setAttributeNS(null, 'refX', anchor.get(0).value);
    this.svgElement.setAttributeNS(null, 'refY', anchor.get(1).value);

    this.children.forEach(child => child.draw(env, t));
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleMask extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'mask');
    this.children = [];
    this.svgElement = document.createElementNS(svgNamespace, 'mask');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.bind('template', null, null, new ExpressionBoolean(true));
  }

  draw(env, t) {
    this.children.forEach(child => child.draw(env, t));
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleCutout extends TwovilleMask {
  constructor(env, callExpression) {
    super(env, callExpression);

    let size = env.get('viewport').get('size');

    let corner;
    if (env.get('viewport').has('corner')) {
      corner = env.get('viewport').get('corner');
    } else if (env.get('viewport').has('center')) {
      let center = env.get('viewport').get('center');
      corner = new ExpressionVector([
        new ExpressionReal(center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(center.get(1).value - size.get(1).value * 0.5),
      ]);
    } else {
      corner = new ExpressionVector([
        new ExpressionInteger(0),
        new ExpressionInteger(0),
      ]);
    }

    let rectangle = document.createElementNS(svgNamespace, 'rect');
    rectangle.setAttributeNS(null, 'x', corner.get(0).value);
    rectangle.setAttributeNS(null, 'y', corner.get(1).value);
    rectangle.setAttributeNS(null, 'width', '100%');
    rectangle.setAttributeNS(null, 'height', '100%');
    rectangle.setAttributeNS(null, 'fill', 'white');

    this.svgElement.appendChild(rectangle);
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleLabel extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'label');
    this.svgElement = document.createElementNS(svgNamespace, 'text');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.svgElement.appendChild(document.createTextNode('foo'));
  }

  draw(env, t) {
    this.assertProperty('position');
    this.assertProperty('text');
    
    let position = this.valueAt(env, 'position', t);
    let color = this.getColor(env, t);
    let text = this.valueAt(env, 'text', t);

    let fontSize;
    if (this.has('size')) {
      fontSize = this.valueAt(env, 'size', t);
    } else {
      fontSize = new ExpressionInteger(8);
    }

    let anchor;
    if (this.has('anchor')) {
      anchor = this.valueAt(env, 'anchor', t);
    } else {
      anchor = new ExpressionString('middle');
    }

    let baseline;
    if (this.has('baseline')) {
      baseline = this.valueAt(env, 'baseline', t);
    } else {
      baseline = new ExpressionString('middle');
    }

    if (position == null || color == null) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);
      this.svgElement.childNodes[0].nodeValue = text.value;
      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'x', position.get(0).value);
      this.svgElement.setAttributeNS(null, 'y', position.get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', color.toColor());
      this.svgElement.setAttributeNS(null, 'font-size', fontSize.value);
      this.svgElement.setAttributeNS(null, 'text-anchor', anchor.value);
      this.svgElement.setAttributeNS(null, 'alignment-baseline', baseline.value);
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleVertex extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'vertex');
    env.nodes.push(this);
  }

  evaluate(env, t) {
    this.assertProperty('position');
    return this.valueAt(env, 'position', t);
  }

  evolve(env, t) {
    this.assertProperty('position');
    let position = this.valueAt(env, 'position', t);
    
    if (position) {
      return `${position.get(0).value},${position.get(1).value}`;
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathJump extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'jump');
    env.nodes.push(this);
  }

  evolve(env, t) {
    this.assertProperty('position');
    
    let position = this.valueAt(env, 'position', t);

    if (position) {
      return `M${position.get(0).value},${position.get(1).value}`;
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathLine extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'line');
    env.nodes.push(this);
  }

  evolve(env, t) {
    this.assertProperty('position');
    
    let position = this.valueAt(env, 'position', t);

    let isDelta = false;
    if (this.has('delta')) {
      isDelta = this.valueAt(env, 'delta', t).value;
    }
    let letter = isDelta ? 'l' : 'L';

    if (position) {
      return `${letter}${position.get(0).value},${position.get(1).value}`;
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathBezier extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'bezier');
    env.nodes.push(this);
  }

  evolve(env, t) {
    this.assertProperty('position');
    this.assertProperty('control2');
    
    let position = this.valueAt(env, 'position', t);
    let control1;
    if (this.has('control1')) {
      control1 = this.valueAt(env, 'control1', t);
    }
    let control2 = this.valueAt(env, 'control2', t);
    console.log("control1:", control1);
    console.log("control2:", control2);

    let isDelta = false;
    if (this.has('delta')) {
      isDelta = this.valueAt(env, 'delta', t).value;
    }

    if (position) {
      if (control1) {
        let letter = isDelta ? 'c' : 'C';
        return `${letter} ${control1.get(0).value},${control1.get(1).value} ${control2.get(0).value},${control2.get(1).value} ${position.get(0).value},${position.get(1).value}`;
      } else {
        let letter = isDelta ? 's' : 'S';
        return `${letter} ${control2.get(0).value},${control2.get(1).value} ${position.get(0).value},${position.get(1).value}`;
      }
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathQuadratic extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'quadratic');
    env.nodes.push(this);
  }

  evolve(env, t) {
    this.assertProperty('position');
    
    let position = this.valueAt(env, 'position', t);
    let control;
    if (this.has('control')) {
      control = this.valueAt(env, 'control', t);
    }

    let isDelta = false;
    if (this.has('delta')) {
      isDelta = this.valueAt(env, 'delta', t).value;
    }

    if (position) {
      if (control) {
        let letter = isDelta ? 'q' : 'Q';
        return `${letter} ${control.get(0).value},${control.get(1).value} ${position.get(0).value},${position.get(1).value}`;
      } else {
        let letter = isDelta ? 't' : 'T';
        return `${letter}${position.get(0).value},${position.get(1).value}`;
      }
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePathArc extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'arc');
    env.nodes.push(this);
  }

  evolve(env, t, from) {
    this.assertProperty('position');
    this.assertProperty('direction');
    this.assertProperty('center');
    
    let position = this.valueAt(env, 'position', t);
    let direction = this.valueAt(env, 'direction', t);
    let center = this.valueAt(env, 'center', t);

    if (position) {
      let diff2 = position.subtract(center);
      let diff1 = from.subtract(center);
      let radius = diff1.magnitude;
      let area = 0.5 * (diff1.get(0).value * diff2.get(1).value - diff2.get(0).value * diff1.get(1).value);

      let large;
      let sweep;

      if (direction.value == 0) {
        if (area < 0) {
          large = 1;
          sweep = 1;
        } else {
          large = 0;
          sweep = 1;
        }
      } else {
        if (area > 0) {
          large = 1;
          sweep = 0;
        } else {
          large = 0;
          sweep = 0;
        }
      }

      let isDelta = false;
      if (this.has('delta')) {
        isDelta = this.valueAt(env, 'delta', t).value;
      }
      let letter = isDelta ? 'a' : 'A';

      return `${letter}${radius},${radius} 0 ${large} ${sweep} ${position.get(0).value},${position.get(1).value}`;
    } else {
      return null;
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleMarkerable extends TwovilleShape {
  constructor(env, callExpression, name) {
    super(env, callExpression, name);
  }

  draw(env, t) {
    // Difference between owns and has? TODO

    if (this.owns('node')) {
      let node = this.get('node').getDefault();
      this.svgElement.setAttributeNS(null, 'marker-mid', 'url(#element-' + node.id + ')');
      this.svgElement.setAttributeNS(null, 'marker-start', 'url(#element-' + node.id + ')');
      this.svgElement.setAttributeNS(null, 'marker-end', 'url(#element-' + node.id + ')');
    }

    if (this.owns('head')) {
      let head = this.get('head').getDefault();
      this.svgElement.setAttributeNS(null, 'marker-end', 'url(#element-' + head.id + ')');
    }

    if (this.owns('tail')) {
      let tail = this.get('tail').getDefault();
      this.svgElement.setAttributeNS(null, 'marker-start', 'url(#element-' + tail.id + ')');
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleLine extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'line');
    this.svgElement = document.createElementNS(svgNamespace, 'line');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.nodes = [];

    this.bindings['vertex'] = {
      name: 'vertex',
      formals: [],
      body: new ExpressionVertex()
    };
  }

  draw(env, t) {
    super.draw(env, t);

    if (this.nodes.length != 2) {
      throw new LocatedException(this.callExpression.where, `I tried to draw a line that had ${this.nodes.length} ${this.nodes.size == 1 ? 'vertex' : 'vertices'}. Lines must only have two vertices.`);
    }
    
    let vertices = this.nodes.map(vertex => vertex.evaluate(env, t));
    let color = this.getColor(env, t);

    if (vertices.some(v => v == null) || color == null) {
      this.hide();
    } else {
      this.show();
      this.setStrokelessStroke(env, t);
      this.setTransform(env, t);

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'x1', vertices[0].get(0).value);
      this.svgElement.setAttributeNS(null, 'y1', vertices[0].get(1).value);
      this.svgElement.setAttributeNS(null, 'x2', vertices[1].get(0).value);
      this.svgElement.setAttributeNS(null, 'y2', vertices[1].get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', color.toColor());
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePath extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'path');
    this.svgElement = document.createElementNS(svgNamespace, 'path');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.nodes = [];

    this.bindings['arc'] = {
      name: 'arc',
      formals: [],
      body: new ExpressionPathArc()
    };

    this.bindings['bezier'] = {
      name: 'bezier',
      formals: [],
      body: new ExpressionPathBezier()
    };

    this.bindings['jump'] = {
      name: 'jump',
      formals: [],
      body: new ExpressionPathJump()
    };

    this.bindings['line'] = {
      name: 'line',
      formals: [],
      body: new ExpressionPathLine()
    };

    this.bindings['quadratic'] = {
      name: 'quadratic',
      formals: [],
      body: new ExpressionPathQuadratic()
    };
  }

  draw(env, t) {
    super.draw(env, t);

    let isClosed = true;
    if (this.has('closed')) {
      isClosed = this.valueAt(env, 'closed', t).value;
    }

    let vertices = this.nodes.map((vertex, i) => {
      let from = i == 0 ? null : this.nodes[i - 1].valueAt(env, 'position', t);
      return vertex.evolve(env, t, from);
    });

    let opacity = this.valueAt(env, 'opacity', t).value;
    let isVisible = opacity > 0.0001;
    let color = null;
    if (isVisible) {
      color = this.getColor(env, t);
    }

    if (vertices.some(v => v == null) || (color == null && isVisible)) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);
      
      let commands = vertices.join(' ');
      if (isClosed) {
        commands += ' Z';
      }

      this.svgElement.setAttributeNS(null, 'd', commands);
      this.svgElement.setAttributeNS(null, 'fill', isVisible ? color.toColor() : 'none');
      this.svgElement.setAttributeNS(null, 'fill-opacity', opacity);
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePolygon extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'polygon');
    this.svgElement = document.createElementNS(svgNamespace, 'polygon');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.nodes = [];

    this.bindings['vertex'] = {
      name: 'vertex',
      formals: [],
      body: new ExpressionVertex()
    };
  }

  draw(env, t) {
    super.draw(env, t);

    let color = this.getColor(env, t);
    let vertices = this.nodes.map(vertex => vertex.evolve(env, t));

    if (vertices.some(v => v == null) || color == null) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);

      let commands = vertices.join(' ');

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).value);
      this.svgElement.setAttributeNS(null, 'points', commands);
      this.svgElement.setAttributeNS(null, 'fill', color.toColor());
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovillePolyline extends TwovilleMarkerable {
  constructor(env, callExpression) {
    super(env, callExpression, 'polyline');
    this.svgElement = document.createElementNS(svgNamespace, 'polyline');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
    this.nodes = [];

    this.bindings['vertex'] = {
      name: 'vertex',
      formals: [],
      body: new ExpressionVertex()
    };
  }

  draw(env, t) {
    super.draw(env, t);

    this.assertProperty('size');

    let size = this.valueAt(env, 'size', t);
    let color = this.getColor(env, t);
    let vertices = this.nodes.map(vertex => vertex.evolve(env, t));

    if (vertices.some(v => v == null) || color == null) {
      this.hide();
    } else {
      this.show();
      this.setStrokelessStroke(env, t);
      this.setTransform(env, t);

      let commands = vertices.join(' ');

      this.svgElement.setAttributeNS(null, 'points', commands);
      this.svgElement.setAttributeNS(null, 'fill', 'none');
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleRectangle extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'rectangle');
    this.svgElement = document.createElementNS(svgNamespace, 'rect');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  draw(env, t) {
    if (this.has('corner') && this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found a rectangle whose corner and center properties were both set. Define only one of these.');
    }

    if (!this.has('corner') && !this.has('center')) {
      throw new LocatedException(this.callExpression.where, 'I found a rectangle whose location I couldn\'t figure out. Please define its corner or center.');
    }
    
    this.assertProperty('size');

    let size = this.valueAt(env, 'size', t);

    let corner;
    if (this.has('corner')) {
      corner = this.valueAt(env, 'corner', t);
    } else {
      let center = this.valueAt(env, 'center', t);
      corner = new ExpressionVector([
        new ExpressionReal(center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(center.get(1).value - size.get(1).value * 0.5),
      ]);
    }

    let opacity = this.valueAt(env, 'opacity', t).value;
    let isVisible = opacity > 0.0001;
    let color = null;
    if (isVisible) {
      color = this.getColor(env, t);
    }

    if (corner == null || size == null || (color == null && isVisible)) {
      this.hide();
    } else {
      this.show();
      this.setStroke(env, t);
      this.setTransform(env, t);

      if (this.has('rounding')) {
        let rounding = this.valueAt(env, 'rounding', t);
        this.svgElement.setAttributeNS(null, 'rx', rounding.value);
        this.svgElement.setAttributeNS(null, 'ry', rounding.value);
      }

      this.svgElement.setAttributeNS(null, 'x', corner.get(0).value);
      this.svgElement.setAttributeNS(null, 'y', corner.get(1).value);
      this.svgElement.setAttributeNS(null, 'width', size.get(0).value);
      this.svgElement.setAttributeNS(null, 'height', size.get(1).value);
      this.svgElement.setAttributeNS(null, 'fill', isVisible ? color.toColor() : 'none');
      this.svgElement.setAttributeNS(null, 'fill-opacity', opacity);
    }
  }
}

// --------------------------------------------------------------------------- 

export class TwovilleCircle extends TwovilleShape {
  constructor(env, callExpression) {
    super(env, callExpression, 'circle');
    this.svgElement = document.createElementNS(svgNamespace, 'circle');
    this.svgElement.setAttributeNS(null, 'id', 'element-' + this.id);
  }

  draw(env, t) {
    this.assertProperty('center');
    this.assertProperty('radius');
    
    let opacity = this.valueAt(env, 'opacity', t).value;
    let center = this.valueAt(env, 'center', t);
    let radius = this.valueAt(env, 'radius', t);

    let isVisible = opacity > 0.0001;
    let color = null;
    if (isVisible) {
      color = this.getColor(env, t);
    }

    if (center == null || radius == null || (color == null && isVisible)) {
      this.hide();
    } else {
      this.show();
      this.setTransform(env, t);
      this.setStroke(env, t);
      this.svgElement.setAttributeNS(null, 'cx', center.get(0).value);
      this.svgElement.setAttributeNS(null, 'cy', center.get(1).value);
      this.svgElement.setAttributeNS(null, 'r', radius.value);
      this.svgElement.setAttributeNS(null, 'fill', isVisible ? color.toColor() : 'none');
      this.svgElement.setAttributeNS(null, 'fill-opacity', opacity);
    }
  }
}

// --------------------------------------------------------------------------- 

export class GlobalEnvironment extends TwovilleEnvironment {
  constructor(svg) {
    super(null);
    this.svg = svg;
    this.shapes = [];

    this.bindings.time = new TwovilleEnvironment(this);
    this.bindings.time.bind('start', null, null, new ExpressionInteger(0));
    this.bindings.time.bind('stop', null, null, new ExpressionInteger(100));
    this.bindings.time.bind('delay', null, null, new ExpressionInteger(16));
    this.bindings.time.bind('resolution', null, null, new ExpressionInteger(1));

    this.bindings.gif = new TwovilleEnvironment(this);
    this.bindings.gif.bind('size', null, null, new ExpressionVector([
      new ExpressionInteger(100),
      new ExpressionInteger(100)
    ]));
    this.bindings.gif.bind('name', null, null, new ExpressionString('twoville.gif'));
    this.bindings.gif.bind('transparency', null, null, new ExpressionVector([
      new ExpressionReal(0),
      new ExpressionReal(0),
      new ExpressionReal(0),
    ]));
    this.bindings.gif.bind('repeat', null, null, new ExpressionInteger(0));
    this.bindings.gif.bind('delay', null, null, new ExpressionInteger(10));

    this.bindings.viewport = new TwovilleEnvironment(this);
    this.bindings.viewport.bind('size', null, null, new ExpressionVector([
      new ExpressionInteger(100),
      new ExpressionInteger(100)
    ]));

    this.bindings['rectangle'] = {
      name: 'rectangle',
      formals: [],
      body: new ExpressionRectangle()
    };

    this.bindings['line'] = {
      name: 'line',
      formals: [],
      body: new ExpressionLine()
    };

    this.bindings['path'] = {
      name: 'path',
      formals: [],
      body: new ExpressionPath()
    };

    this.bindings['polygon'] = {
      name: 'polygon',
      formals: [],
      body: new ExpressionPolygon()
    };

    this.bindings['polyline'] = {
      name: 'polyline',
      formals: [],
      body: new ExpressionPolyline()
    };

    this.bindings['label'] = {
      name: 'label',
      formals: [],
      body: new ExpressionLabel()
    };

    this.bindings['group'] = {
      name: 'group',
      formals: [],
      body: new ExpressionGroup()
    };

    this.bindings['marker'] = {
      name: 'marker',
      formals: [],
      body: new ExpressionMarker()
    };

    this.bindings['mask'] = {
      name: 'mask',
      formals: [],
      body: new ExpressionMask()
    };

    this.bindings['cutout'] = {
      name: 'cutout',
      formals: [],
      body: new ExpressionCutout()
    };

    this.bindings['circle'] = {
      name: 'circle',
      formals: [],
      body: new ExpressionCircle()
    };

    this.bindings['print'] = {
      name: 'print',
      formals: ['message'],
      body: new ExpressionPrint()
    };

    this.bindings['random'] = {
      name: 'random',
      formals: ['min', 'max'],
      body: new ExpressionRandom()
    };

    this.bindings['sin'] = {
      name: 'sin',
      formals: ['degrees'],
      body: new ExpressionSine()
    };

    this.bindings['cos'] = {
      name: 'cos',
      formals: ['degrees'],
      body: new ExpressionCosine()
    };

    this.bindings['int'] = {
      name: 'int',
      formals: ['x'],
      body: new ExpressionInt()
    };
  }
}

// --------------------------------------------------------------------------- 

