import { Timeline } from './timeline.js';

export let svgNamespace = "http://www.w3.org/2000/svg";

// --------------------------------------------------------------------------- 

class RuntimeException extends Error {
  constructor(start, stop, message) {
    super(message);
    this.start = start;
    this.stop = stop;
  }
}

// --------------------------------------------------------------------------- 

export let TwovilleEnvironment = {
  create: function(parent) {
    let instance = Object.create(TwovilleEnvironment);
    return Object.assign(instance, {
      bindings: {},
      shapes: parent.shapes,
      svg: parent.svg,
      parent: parent
    });
  },
  get: function(id) {
    let env = this;
    while (env != null) {
      if (env.bindings.hasOwnProperty(id)) {
        return env.bindings[id];
      }
      env = env.parent;
    }
    return null;
  },
  owns: function(id) {
    return this.bindings.hasOwnProperty(id);
  },
  has: function(id) {
    let env = this;
    while (env != null) {
      if (env.bindings.hasOwnProperty(id)) {
        return true;
      }
      env = env.parent;
    }
    return false;
  },
  bind: function(id, fromTime, toTime, value) {
    this.bindings[id] = value;
  },
  valueAt: function(env, property, t) {
    // Assumes property exists.
    return this.bindings[property].valueAt(env, t);
  },
  evaluate: function(env, fromTime, toTime) {
    return this;
  }
}

// ---------------------------------------------------------------------------

export let TwovilleTimelinedEnvironment = Object.create(TwovilleEnvironment);
Object.assign(TwovilleTimelinedEnvironment, {
  create: function(env) {
    let instance = TwovilleEnvironment.create(env);
    Object.setPrototypeOf(instance, TwovilleTimelinedEnvironment);
    return instance;
  },
  bind: function(id, fromTime, toTime, value) {
    if (!this.bindings.hasOwnProperty(id)) {
      this.bindings[id] = Timeline.create();
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
  },
});

// --------------------------------------------------------------------------- 

export let TwovilleShape = Object.create(TwovilleTimelinedEnvironment);
Object.assign(TwovilleShape, {
  serial: 0,
  create: function(env) {
    let instance = TwovilleTimelinedEnvironment.create(env);
    Object.setPrototypeOf(instance, TwovilleShape);
    instance = Object.assign(instance, {
      id: TwovilleShape.serial,
      parentElement: null
    });
    instance.bindings.stroke = TwovilleTimelinedEnvironment.create(instance);
    instance.bind('opacity', null, null, TwovilleReal.create(1));
    ++TwovilleShape.serial;
    return instance;
  },
  domify: function(svg) {
    if (this.has('clippers')) {
      let clipPath = document.createElementNS(svgNamespace, 'clipPath')
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

    if (this.owns('mask')) {
      let mask = this.get('mask').getDefault();
      this.svgElement.setAttributeNS(null, 'mask', 'url(#element-' + mask.id + ')');
    }

    if (this.owns('parent')) {
      this.parentElement = this.get('parent').getDefault().svgElement;
    } else if (this.owns('template') && this.get('template').getDefault().get()) {
      this.parentElement = svg.firstChild;
    } else {
      this.parentElement = this.svg;
    }
    this.parentElement.appendChild(this.svgElement);
  },
});

// --------------------------------------------------------------------------- 

export let TwovilleGroup = Object.create(TwovilleShape);
Object.assign(TwovilleGroup, {
  create: function(env) {
    let instance = TwovilleShape.create(env);
    Object.setPrototypeOf(instance, TwovilleGroup);
    instance = Object.assign(instance, {
      svgElement: document.createElementNS(svgNamespace, 'group'),
      children: []
    });

    instance.svgElement.setAttributeNS(null, 'id', 'element-' + instance.id);
    return instance;
  },
  draw: function(env, t) {
    this.children.forEach(child => child.draw(env, t));
  }
});

// --------------------------------------------------------------------------- 

export let TwovilleMask = Object.create(TwovilleShape);
Object.assign(TwovilleMask, {
  create: function(env) {
    let instance = TwovilleShape.create(env);
    Object.setPrototypeOf(instance, TwovilleMask);
    instance = Object.assign(instance, {
      svgElement: document.createElementNS(svgNamespace, 'mask'),
      children: []
    });
    instance.bind('template', null, null, TwovilleBoolean.create(true));
    instance.svgElement.setAttributeNS(null, 'id', 'element-' + instance.id);
    return instance;
  },
  draw: function(env, t) {
    this.children.forEach(child => child.draw(env, t));
  }
});

// --------------------------------------------------------------------------- 

export let TwovilleText = Object.create(TwovilleShape);
Object.assign(TwovilleText, {
  create: function(env) {
    let instance = TwovilleShape.create(env);
    Object.setPrototypeOf(instance, TwovilleText);
    instance = Object.assign(instance, {
      svgElement: document.createElementNS(svgNamespace, 'text')
    });
    instance.svgElement.setAttributeNS(null, 'font-size', 8);
    instance.svgElement.setAttributeNS(null, 'text-anchor', 'middle');
    instance.svgElement.setAttributeNS(null, 'id', 'element-' + instance.id);
    instance.svgElement.appendChild(document.createTextNode('foo'));
    return instance;
  },
  draw: function(env, t) {
    if (!this.has('position')) {
      throw new RuntimeException(null, null, 'This circle\'s position property has not been set.')
    }
    
    if (!this.has('rgb')) {
      throw new RuntimeException(null, null, 'This circle\'s rgb property has not been set.')
    }
    
    if (!this.has('text')) {
      throw new RuntimeException(null, null, 'This circle\'s text property has not been set.')
    }
    
    let needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw 'rotation but not pivot';
      }
    }

    // If we have rotation, but no pivot, error.

    let position = this.valueAt(env, 'position', t);
    let rgb = this.valueAt(env, 'rgb', t);
    let text = this.valueAt(env, 'text', t);
    let pivot = null;
    let rotation = null;

    if (needsTransforming) {
      pivot = this.valueAt(env, 'pivot', t);
      rotation = this.valueAt(env, 'rotation', t);
    }

    if (position == null || rgb == null || (needsTransforming && (pivot == null || rotation == null))) {
      this.svgElement.setAttributeNS(null, 'opacity', 0);
    } else {
      this.svgElement.setAttributeNS(null, 'opacity', 1);

      if (needsTransforming) {
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.get() + ' ' + pivot.get(0).get() + ',' + pivot.get(1).get() + ')');
      }

      if (this.has('stroke')) {
        let stroke = this.get('stroke');
        if (stroke.owns('size') &&
            stroke.owns('rgb') &&
            stroke.owns('opacity')) {
          let strokeSize = stroke.valueAt(env, 'size', t);
          let strokeRGB = stroke.valueAt(env, 'rgb', t);
          let strokeOpacity = stroke.valueAt(env, 'opacity', t);
          this.svgElement.setAttributeNS(null, 'stroke', strokeRGB.toRGB());
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.get());
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.get());
        }
      }

      this.svgElement.childNodes[0].nodeValue = text.get();
      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).get());
      this.svgElement.setAttributeNS(null, 'x', position.get(0).get());
      this.svgElement.setAttributeNS(null, 'y', position.get(1).get());
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
});

// --------------------------------------------------------------------------- 

export let TwovilleLine = Object.create(TwovilleShape);
Object.assign(TwovilleLine, {
  create: function(env) {
    let instance = TwovilleShape.create(env);
    Object.setPrototypeOf(instance, TwovilleLine);
    instance = Object.assign(instance, {
      svgElement: document.createElementNS(svgNamespace, 'line')
    });
    instance.svgElement.setAttributeNS(null, 'id', 'element-' + instance.id);
    return instance;
  },
  draw: function(env, t) {
    if (!this.has('a')) {
      throw 'no a';
    }
    
    if (!this.has('b')) {
      throw 'no b';
    }
    
    if (!this.has('rgb')) {
      throw 'no rgb';
    }
    
    let needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw 'rotation but not pivot';
      }
    }

    // If we have rotation, but no pivot, error.

    let a = this.valueAt(env, 'a', t);
    let b = this.valueAt(env, 'b', t);
    let rgb = this.valueAt(env, 'rgb', t);

    if (needsTransforming) {
      let pivot = this.valueAt(env, 'pivot', t);
      let rotation = this.valueAt(env, 'rotation', t);
    }

    if (a == null || b == null || rgb == null || (needsTransforming && (pivot == null || rotation == null))) {
      this.svgElement.setAttributeNS(null, 'opacity', 0);
    } else {
      this.svgElement.setAttributeNS(null, 'opacity', 1);

      if (needsTransforming) {
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.get() + ' ' + pivot.get(0).get() + ',' + pivot.get(1).get() + ')');
      }

      if (this.has('stroke')) {
        let stroke = this.get('stroke');
        if (stroke.owns('size') &&
            stroke.owns('rgb') &&
            stroke.owns('opacity')) {
          let strokeSize = stroke.valueAt(env, 'size', t);
          let strokeRGB = stroke.valueAt(env, 'rgb', t);
          let strokeOpacity = stroke.valueAt(env, 'opacity', t);
          this.svgElement.setAttributeNS(null, 'stroke', strokeRGB.toRGB());
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.get());
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.get());
        }
      }

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).get());
      this.svgElement.setAttributeNS(null, 'x1', a.get(0).get());
      this.svgElement.setAttributeNS(null, 'y1', a.get(1).get());
      this.svgElement.setAttributeNS(null, 'x2', b.get(0).get());
      this.svgElement.setAttributeNS(null, 'y2', b.get(1).get());
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
});

// --------------------------------------------------------------------------- 

export let TwovilleRectangle = Object.create(TwovilleShape);
Object.assign(TwovilleRectangle, {
  create: function(env) {
    let instance = TwovilleShape.create(env);
    Object.setPrototypeOf(instance, TwovilleRectangle);
    instance = Object.assign(instance, {
      svgElement: document.createElementNS(svgNamespace, 'rect')
    });
    instance.svgElement.setAttributeNS(null, 'id', 'element-' + instance.id);
    return instance;
  },
  draw: function(env, t) {
    if (!this.has('position')) {
      throw new RuntimeException(null, null, 'This circle\'s rectangle property has not been set.')
    }
    
    if (!this.has('size')) {
      throw new RuntimeException(null, null, 'This circle\'s size property has not been set.')
    }
    
    if (!this.has('rgb')) {
      throw new RuntimeException(null, null, 'This circle\'s rgb property has not been set.')
    }
    
    let needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw 'rotation but not pivot';
      }
    }

    // If we have rotation, but no pivot, error.

    let position = this.valueAt(env, 'position', t);
    let size = this.valueAt(env, 'size', t);
    let rgb = this.valueAt(env, 'rgb', t);
    let pivot = null;
    let rotation = null;

    if (needsTransforming) {
      pivot = this.valueAt(env, 'pivot', t);
      rotation = this.valueAt(env, 'rotation', t);
    }

    if (position == null || size == null || rgb == null || (needsTransforming && (pivot == null || rotation == null))) {
      this.svgElement.setAttributeNS(null, 'opacity', 0);
    } else {
      this.svgElement.setAttributeNS(null, 'opacity', 1);

      if (needsTransforming) {
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.get() + ' ' + pivot.get(0).get() + ',' + pivot.get(1).get() + ')');
      }

      if (this.has('stroke')) {
        let stroke = this.get('stroke');
        if (stroke.owns('size') &&
            stroke.owns('rgb') &&
            stroke.owns('opacity')) {
          let strokeSize = stroke.valueAt(env, 'size', t);
          let strokeRGB = stroke.valueAt(env, 'rgb', t);
          let strokeOpacity = stroke.valueAt(env, 'opacity', t);
          this.svgElement.setAttributeNS(null, 'stroke', strokeRGB.toRGB());
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.get());
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.get());
        }
      }

      if (this.has('rounding')) {
        let rounding = this.valueAt(env, 'rounding', t);
        this.svgElement.setAttributeNS(null, 'rx', rounding.get());
        this.svgElement.setAttributeNS(null, 'ry', rounding.get());
      }

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).get());
      this.svgElement.setAttributeNS(null, 'x', position.get(0).get());
      this.svgElement.setAttributeNS(null, 'y', position.get(1).get());
      this.svgElement.setAttributeNS(null, 'width', size.get(0).get());
      this.svgElement.setAttributeNS(null, 'height', size.get(1).get());
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
});

// --------------------------------------------------------------------------- 

export let TwovilleCircle = Object.create(TwovilleShape);
Object.assign(TwovilleCircle, {
  create: function(env) {
    let instance = TwovilleShape.create(env);
    Object.setPrototypeOf(instance, TwovilleCircle);
    instance = Object.assign(instance, {
      svgElement: document.createElementNS(svgNamespace, 'circle')
    });
    instance.svgElement.setAttributeNS(null, 'id', 'element-' + instance.id);
    // instance.parentElement.appendChild(instance.svgElement);
    return instance;
  },

  draw: function(env, t) {
    if (!this.has('position')) {
      throw new RuntimeException(null, null, 'This circle\'s position property has not been set.')
    }
    
    if (!this.has('radius')) {
      throw new RuntimeException(null, null, 'This circle\'s radius property has not been set.')
    }
    
    if (!this.has('rgb')) {
      throw new RuntimeException(null, null, 'This circle\'s rgb property has not been set.')
    }
    
    let needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw 'rotation but not pivot';
      }
    }

    // If we have rotation, but no pivot, error.

    let position = this.valueAt(env, 'position', t);
    let radius = this.valueAt(env, 'radius', t);
    let rgb = this.valueAt(env, 'rgb', t);
    let pivot = null;
    let rotation = null;

    if (needsTransforming) {
      pivot = this.valueAt(env, 'pivot', t);
      rotation = this.valueAt(env, 'rotation', t);
    }

    if (position == null || radius == null || rgb == null || (needsTransforming && (pivot == null || rotation == null))) {
      this.svgElement.setAttributeNS(null, 'opacity', 0);
    } else {
      this.svgElement.setAttributeNS(null, 'opacity', 1);

      if (needsTransforming) {
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.get() + ' ' + pivot.get(0).get() + ',' + pivot.get(1).get() + ')');
      }

      if (this.has('stroke')) {
        let stroke = this.get('stroke');
        if (stroke.owns('size') &&
            stroke.owns('rgb') &&
            stroke.owns('opacity')) {
          let strokeSize = stroke.valueAt(env, 'size', t);
          let strokeRGB = stroke.valueAt(env, 'rgb', t);
          let strokeOpacity = stroke.valueAt(env, 'opacity', t);
          this.svgElement.setAttributeNS(null, 'stroke', strokeRGB.toRGB());
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.get());
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.get());
        }
      }

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt(env, 'opacity', t).get());
      this.svgElement.setAttributeNS(null, 'cx', position.get(0).get());
      this.svgElement.setAttributeNS(null, 'cy', position.get(1).get());
      this.svgElement.setAttributeNS(null, 'r', radius.get());
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
});

// --------------------------------------------------------------------------- 

export let TwovilleData = {
  create: function() {
    return {};
  },
  bind: function(env, fromTime, toTime, id) {
    env.bind(id, fromTime, toTime, this);
  },
  evaluate: function(env, fromTime, toTime) {
    return this;
  }
}

// --------------------------------------------------------------------------- 

export let TwovilleVector = Object.create(TwovilleData);
Object.assign(TwovilleVector, {
  create: function(elements) {
    let instance = TwovilleData.create();
    Object.setPrototypeOf(instance, TwovilleVector);
    instance = Object.assign(instance, {
      elements: elements
    });
    return instance;
  },
  bind: function(id, fromTime, toTime, value) {
    this.elements.forEach(element => {
      element.bind(id, fromTime, toTime, value);
    });
  },
  forEach: function(each) {
    this.elements.forEach(each);
  },
  get: function(i) {
    return this.elements[i];
  },
  evaluate: function(env) {
    return this;
    // return TwovilleVector.create(this.elements.map(element => element.evaluate(env)));
  },
  toRGB: function(env) {
    let r = Math.floor(this.elements[0].get() * 255);
    let g = Math.floor(this.elements[1].get() * 255);
    let b = Math.floor(this.elements[2].get() * 255);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  },
  toString: function(env) {
    return '[' + this.elements.map(element => element.toString()).join(', ') + ']';
  },
  interpolate: function(other, proportion) {
    return TwovilleVector.create(this.elements.map((element, i) => element.interpolate(other.get(i), proportion)));
  },
});

// --------------------------------------------------------------------------- 

export let TwovilleString = Object.create(TwovilleData);
Object.assign(TwovilleString, {
  create: function(x) {
    let instance = TwovilleData.create();
    Object.setPrototypeOf(instance, TwovilleString);
    instance = Object.assign(instance, {
      x: x
    });
    return instance;
  },
  toString: function() {
    return '' + this.x;
  },
  get: function() {
    return this.x;
  },
  interpolate: function(other, proportion) {
    return TwovilleString.create(proportion <= 0.5 ? this.get() : other.get());
  }
});

// --------------------------------------------------------------------------- 

export let TwovilleInteger = Object.create(TwovilleData);
Object.assign(TwovilleInteger, {
  create: function(x) {
    let instance = TwovilleData.create();
    Object.setPrototypeOf(instance, TwovilleInteger);
    instance = Object.assign(instance, {
      x: x
    });
    return instance;
  },
  toString: function() {
    return '' + this.x;
  },
  get: function() {
    return this.x;
  },
  add: function(other) {
    if (Object.getPrototypeOf(other) === TwovilleInteger) {
      return TwovilleInteger.create(this.get() + other.get());
    } else if (Object.getPrototypeOf(other) === TwovilleReal) {
      return TwovilleReal.create(this.get() + other.get());
    } else {
      throw RuntimeError('Add failed');
    }
  },
  subtract: function(other) {
    if (Object.getPrototypeOf(other) === TwovilleInteger) {
      return TwovilleInteger.create(this.get() - other.get());
    } else if (Object.getPrototypeOf(other) === TwovilleReal) {
      return TwovilleReal.create(this.get() - other.get());
    } else {
      throw RuntimeError('Subtract failed');
    }
  },
  multiply: function(other) {
    if (Object.getPrototypeOf(other) === TwovilleInteger) {
      return TwovilleInteger.create(this.get() * other.get());
    } else if (Object.getPrototypeOf(other) === TwovilleReal) {
      return TwovilleReal.create(this.get() * other.get());
    } else {
      throw 'bad ****';
    }
  },
  divide: function(other) {
    if (Object.getPrototypeOf(other) === TwovilleInteger) {
      return TwovilleInteger.create(Math.trunc(this.get() / other.get()));
    } else if (Object.getPrototypeOf(other) === TwovilleReal) {
      return TwovilleReal.create(this.get() / other.get());
    } else {
      console.log("this:", this);
      console.log("other:", other);
      throw RuntimeError('Divide failed');
    }
  },
  remainder: function(other) {
    if (Object.getPrototypeOf(other) === TwovilleInteger) {
      return TwovilleInteger.create(this.get() % other.get());
    } else if (other === TwovilleReal) {
      return TwovilleReal.create(this.get() % other.get());
    } else {
      throw RuntimeError('Remainder failed');
    }
  },
  interpolate: function(other, proportion) {
    return TwovilleReal.create(this.get() + proportion * (other.get() - this.get()));
  }
});

// --------------------------------------------------------------------------- 

export let TwovilleReal = Object.create(TwovilleData);
Object.assign(TwovilleReal, {
  create: function(x) {
    let instance = TwovilleData.create();
    Object.setPrototypeOf(instance, TwovilleReal);
    instance = Object.assign(instance, {
      x: x
    });
    return instance;
  },
  toString: function() {
    return '' + this.x;
  },
  get: function() {
    return this.x;
  },
  add: function(other) {
    if (Object.getPrototypeOf(other) === TwovilleInteger ||
        Object.getPrototypeOf(other) === TwovilleReal) {
      return TwovilleReal.create(this.get() + other.get());
    } else {
      throw '...';
    }
  },
  subtract: function(other) {
    if (Object.getPrototypeOf(other) === TwovilleInteger ||
        Object.getPrototypeOf(other) === TwovilleReal) {
      return TwovilleReal.create(this.get() - other.get());
    } else {
      throw '...';
    }
  },
  multiply: function(other) {
    if (Object.getPrototypeOf(other) === TwovilleInteger ||
        Object.getPrototypeOf(other) === TwovilleReal) {
      return TwovilleReal.create(this.get() * other.get());
    } else {
      throw 'BAD *';
    }
  },
  divide: function(other) {
    if (Object.getPrototypeOf(other) === TwovilleInteger ||
        Object.getPrototypeOf(other) === TwovilleReal) {
      return TwovilleReal.create(this.get() / other.get());
    } else {
      throw '...';
    }
  },
  remainder: function(other) {
    if (Object.getPrototypeOf(other) === TwovilleInteger ||
        Object.getPrototypeOf(other) === TwovilleReal) {
      return TwovilleReal.create(this.get() % other.get());
    } else {
      throw '...';
    }
  },
  interpolate: function(other, proportion) {
    return TwovilleReal.create(this.get() + proportion * (other.get() - this.get()));
  }
});

// --------------------------------------------------------------------------- 

export let TwovilleBoolean = Object.create(TwovilleData);
Object.assign(TwovilleBoolean, {
  create: function(x) {
    let instance = TwovilleData.create();
    Object.setPrototypeOf(instance, TwovilleBoolean);
    instance = Object.assign(instance, {
      x: x
    });
    return instance;
  },
  toString: function() {
    return '' + this.x;
  },
  get: function() {
    return this.x;
  },
  interpolate: function(other, proportion) {
    return TwovilleBoolean.create(proportion <= 0.5 ? this.get() : other.get());
  }
});

// --------------------------------------------------------------------------- 
