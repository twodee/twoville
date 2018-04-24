// --------------------------------------------------------------------------- 

var TwovilleEnvironment = {
  create: function(parent) {
    var instance = Object.create(TwovilleEnvironment);
    return Object.assign(instance, {
      bindings: {},
      shapes: parent.shapes,
      svg: parent.svg,
      parent: parent
    });
  },
  get: function(id) {
    var env = this;
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
    var env = this;
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
  valueAt: function(property, t) {
    // Assumes property exists.
    return this.bindings[property].valueAt(t);
  },
  evaluate: function(env, fromTime, toTime) {
    return this;
  }
}

// ---------------------------------------------------------------------------

var TwovilleTimelinedEnvironment = Object.create(TwovilleEnvironment);
Object.assign(TwovilleTimelinedEnvironment, {
  create: function(env) {
    var instance = TwovilleEnvironment.create(env);
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

var TwovilleShape = Object.create(TwovilleTimelinedEnvironment);
Object.assign(TwovilleShape, {
  serial: 0,
  create: function(env) {
    var instance = TwovilleTimelinedEnvironment.create(env);
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
      var clipPath = document.createElementNS(namespace, 'clipPath')
      clipPath.setAttributeNS(null, 'id', 'clip-' + this.id);
      var clippers = this.get('clippers').getDefault();
      clippers.forEach(clipper => {
        var use = document.createElementNS(namespace, 'use');
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#element-' + clipper.id);
        clipPath.appendChild(use);
      });
      console.log("svg:", svg);
      svg.firstChild.appendChild(clipPath);
      this.svgElement.setAttributeNS(null, 'clip-path', 'url(#clip-' + this.id + ')');
    }

    if (this.has('parent')) {
      this.parentElement = this.get('parent').getDefault().svgElement;
    } else if (this.has('template') && this.get('template').getDefault().get()) {
      this.parentElement = svg.firstChild;
    } else {
      this.parentElement = this.svg;
    }
    this.parentElement.appendChild(this.svgElement);
  },
});

// --------------------------------------------------------------------------- 

var TwovilleGroup = Object.create(TwovilleShape);
Object.assign(TwovilleGroup, {
  create: function(env) {
    var instance = TwovilleShape.create(env);
    Object.setPrototypeOf(instance, TwovilleGroup);
    instance = Object.assign(instance, {
      svgElement: document.createElementNS(namespace, 'g'),
      children: []
    });
    instance.svgElement.setAttributeNS(null, 'id', 'element-' + instance.id);
    // instance.parentElement.appendChild(instance.svgElement);
    return instance;
  },
  draw: function(svg, t) {
    this.children.forEach(child => child.draw(svg, t));
  }
});

// --------------------------------------------------------------------------- 

var TwovilleRectangle = Object.create(TwovilleShape);
Object.assign(TwovilleRectangle, {
  create: function(env) {
    var instance = TwovilleShape.create(env);
    Object.setPrototypeOf(instance, TwovilleRectangle);
    instance = Object.assign(instance, {
      svgElement: document.createElementNS(namespace, 'rect')
    });
    instance.svgElement.setAttributeNS(null, 'id', 'element-' + instance.id);
    // instance.parentElement.appendChild(instance.svgElement);
    return instance;
  },
  draw: function(svg, t) {
    if (!this.has('position')) {
      throw 'no position';
    }
    
    if (!this.has('size')) {
      throw 'no size';
    }
    
    if (!this.has('rgb')) {
      throw 'no rgb';
    }
    
    var needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw 'rotation but not pivot';
      }
    }

    // If we have rotation, but no pivot, error.

    var position = this.valueAt('position', t);
    var size = this.valueAt('size', t);
    var rgb = this.valueAt('rgb', t);

    if (needsTransforming) {
      var pivot = this.valueAt('pivot', t);
      var rotation = this.valueAt('rotation', t);
    }

    if (position == null || size == null || rgb == null || (needsTransforming && (pivot == null || rotation == null))) {
      this.svgElement.setAttributeNS(null, 'opacity', 0);
    } else {
      if (needsTransforming) {
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.get() + ' ' + pivot.get(0).get() + ',' + pivot.get(1).get() + ')');
      }

      if (this.has('stroke')) {
        var stroke = this.get('stroke');
        if (stroke.owns('size') &&
            stroke.owns('rgb') &&
            stroke.owns('opacity')) {
          var strokeSize = stroke.valueAt('size', t);
          var strokeRGB = stroke.valueAt('rgb', t);
          var strokeOpacity = stroke.valueAt('opacity', t);
          this.svgElement.setAttributeNS(null, 'stroke', strokeRGB.toRGB());
          this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.get());
          this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.get());
        }
      }

      if (this.has('rounding')) {
        var rounding = this.valueAt('rounding', t);
        this.svgElement.setAttributeNS(null, 'rx', rounding.get());
        this.svgElement.setAttributeNS(null, 'ry', rounding.get());
      }

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt('opacity', t).get());
      this.svgElement.setAttributeNS(null, 'x', position.get(0).get());
      this.svgElement.setAttributeNS(null, 'y', position.get(1).get());
      this.svgElement.setAttributeNS(null, 'width', size.get(0).get());
      this.svgElement.setAttributeNS(null, 'height', size.get(1).get());
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
});

// --------------------------------------------------------------------------- 

var TwovilleCircle = Object.create(TwovilleShape);
Object.assign(TwovilleCircle, {
  create: function(env) {
    var instance = TwovilleShape.create(env);
    Object.setPrototypeOf(instance, TwovilleCircle);
    instance = Object.assign(instance, {
      svgElement: document.createElementNS(namespace, 'circle')
    });
    instance.svgElement.setAttributeNS(null, 'id', 'element-' + instance.id);
    // instance.parentElement.appendChild(instance.svgElement);
    return instance;
  },

  draw: function(svg, t) {
    if (!this.has('position')) {
      throw 'no position';
    }
    
    if (!this.has('radius')) {
      throw 'no radius';
    }
    
    if (!this.has('rgb')) {
      throw 'no rgb';
    }
    
    var needsTransforming = false;

    if (this.has('rotation')) {
      if (this.has('pivot')) {
        needsTransforming = true;
      } else {
        throw 'rotation but not pivot';
      }
    }

    // If we have rotation, but no pivot, error.

    var position = this.valueAt('position', t);
    var radius = this.valueAt('radius', t);
    var rgb = this.valueAt('rgb', t);

    if (needsTransforming) {
      var pivot = this.valueAt('pivot', t);
      var rotation = this.valueAt('rotation', t);
    }

    if (position == null || radius == null || rgb == null || (needsTransforming && (pivot == null || rotation == null))) {
      this.svgElement.setAttributeNS(null, 'opacity', 0);
    } else {
      if (needsTransforming) {
        this.svgElement.setAttributeNS(null, 'transform', 'rotate(' + rotation.get() + ' ' + pivot.get(0).get() + ',' + pivot.get(1).get() + ')');
      }

      if (this.has('stroke') && this.bi) {
        var stroke = this.get('stroke');
        var strokeSize = stroke.valueAt('size', t);
        var strokeRGB = stroke.valueAt('rgb', t);
        var strokeOpacity = stroke.valueAt('opacity', t);
        this.svgElement.setAttributeNS(null, 'stroke', strokeRGB.toRGB());
        this.svgElement.setAttributeNS(null, 'stroke-width', strokeSize.get());
        this.svgElement.setAttributeNS(null, 'stroke-opacity', strokeOpacity.get());
      }

      this.svgElement.setAttributeNS(null, 'fill-opacity', this.valueAt('opacity', t).get());
      this.svgElement.setAttributeNS(null, 'cx', position.get(0).get());
      this.svgElement.setAttributeNS(null, 'cy', position.get(1).get());
      this.svgElement.setAttributeNS(null, 'r', radius.get());
      this.svgElement.setAttributeNS(null, 'fill', rgb.toRGB());
    }
  }
});

// --------------------------------------------------------------------------- 

var TwovilleData = {
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

var TwovilleVector = Object.create(TwovilleData);
Object.assign(TwovilleVector, {
  create: function(elements) {
    var instance = TwovilleData.create();
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
    var r = Math.floor(this.elements[0].get() * 255);
    var g = Math.floor(this.elements[1].get() * 255);
    var b = Math.floor(this.elements[2].get() * 255);
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

var TwovilleInteger = Object.create(TwovilleData);
Object.assign(TwovilleInteger, {
  create: function(x) {
    var instance = TwovilleData.create();
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
      throw '...';
    }
  },
  subtract: function(other) {
    if (Object.getPrototypeOf(other) === TwovilleInteger) {
      return TwovilleInteger.create(this.get() - other.get());
    } else if (Object.getPrototypeOf(other) === TwovilleReal) {
      return TwovilleReal.create(this.get() - other.get());
    } else {
      throw '...';
    }
  },
  multiply: function(other) {
    if (Object.getPrototypeOf(other) === TwovilleInteger) {
      return TwovilleInteger.create(this.get() * other.get());
    } else if (other === TwovilleReal) {
      return TwovilleReal.create(this.get() * other.get());
    } else {
      throw '...';
    }
  },
  divide: function(other) {
    if (other === TwovilleInteger) {
      return TwovilleInteger.create(Math.trunc(this.get() / other.get()));
    } else if (other === TwovilleReal) {
      return TwovilleReal.create(this.get() / other.get());
    } else {
      throw '...';
    }
  },
  remainder: function(other) {
    if (other === TwovilleInteger) {
      return TwovilleInteger.create(this.get() % other.get());
    } else if (other === TwovilleReal) {
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

var TwovilleReal = Object.create(TwovilleData);
Object.assign(TwovilleReal, {
  create: function(x) {
    var instance = TwovilleData.create();
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
      throw '...';
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

var TwovilleBoolean = Object.create(TwovilleData);
Object.assign(TwovilleBoolean, {
  create: function(x) {
    var instance = TwovilleData.create();
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

var ExpressionRectangle = {
  create: function(parent) {
    return Object.create(ExpressionRectangle);
  },
  evaluate: function(env, fromTime, toTime) {
    var r = TwovilleRectangle.create(env);
    env.shapes.push(r);
    return r;
  }
};

// --------------------------------------------------------------------------- 

var ExpressionCircle = {
  create: function(parent) {
    return Object.create(ExpressionCircle);
  },
  evaluate: function(env, fromTime, toTime) {
    var c = TwovilleCircle.create(env);
    env.shapes.push(c);
    return c;
  }
};

// --------------------------------------------------------------------------- 

var ExpressionPrint = {
  create: function(parent) {
    return Object.create(ExpressionPrint);
  },
  evaluate: function(env, fromTime, toTime) {
    var message = env['message'].get();
    console.log("message:", message);
    log(message.toString(fromTime, toTime));
    return null;
  }
}

// --------------------------------------------------------------------------- 

var ExpressionRandom = {
  create: function(parent) {
    return Object.create(ExpressionRandom);
  },
  evaluate: function(env, fromTime, toTime) {
    var min = env['min'].get();
    var max = env['max'].get();
    var x = Math.random() * (max - min) + min;
    return TwovilleReal.create(x);
  }
}

// --------------------------------------------------------------------------- 

// The casting function.
var ExpressionInt = {
  create: function(parent) {
    return Object.create(ExpressionInt);
  },
  evaluate: function(env, fromTime, toTime) {
    var f = env['x'].get();
    var i = Math.trunc(f);
    return TwovilleInteger.create(i);
  }
}

// --------------------------------------------------------------------------- 

var ExpressionGroup = {
  create: function(parent) {
    return Object.create(ExpressionGroup);
  },
  evaluate: function(env, fromTime, toTime) {
    var group = TwovilleGroup.create(env);
    env.shapes.push(group);
    return group;
  }
};

// --------------------------------------------------------------------------- 

