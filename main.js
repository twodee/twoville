import {
  lex
} from './lexer.js';

import {
  parse
} from './parser.js';

import {
  TwovilleEnvironment,
  TwovilleShape,
  MessagedException,
  LocatedException,
  svgNamespace,
  initializeShapes,
} from './types.js';

import {
  ExpressionInteger,
  ExpressionReal,
  ExpressionVector,
  ExpressionRectangle,
  ExpressionLine,
  ExpressionLabel,
  ExpressionGroup,
  ExpressionMask,
  ExpressionCutout,
  ExpressionCircle,
  ExpressionPrint,
  ExpressionRandom,
  ExpressionSine,
  ExpressionCosine,
  ExpressionInt,
} from './ast.js';

let editor = ace.edit('editor');
editor.setTheme('ace/theme/twilight');
editor.setOptions({
  fontSize: '14pt',
  tabSize: 2,
  useSoftTabs: true
});
if (localStorage.getItem('src') !== null) {
  editor.setValue(localStorage.getItem('src'), 1);
}
editor.getSession().on('change', onSourceChanged);
let Range = ace.require('ace/range').Range;

let left = document.getElementById('left');
let messager = document.getElementById('messager');
let messagerContainer = document.getElementById('messagerContainer');
let evalButton = document.getElementById('eval');
let recordButton = document.getElementById('record');
let spinner = document.getElementById('spinner');
let saveButton = document.getElementById('save');
let exportButton = document.getElementById('export');
export let svg = document.getElementById('svg');
let scrubber = document.getElementById('scrubber');
let timeSpinner = document.getElementById('timeSpinner');
let playOnceButton = document.getElementById('playOnceButton');
let playLoopButton = document.getElementById('playLoopButton');
let env;
let isDirty = false;

export function highlight(lineStart, lineEnd, columnStart, columnEnd) {
  editor.getSelection().setSelectionRange(new Range(lineStart, columnStart, lineEnd, columnEnd + 1));
  editor.centerSelection();
}

function clearConsole() {
  while (messager.lastChild) {
    messager.removeChild(messager.lastChild);
  }
}

export function log(text) {
  let matches = text.match(/^(-?\d+):(-?\d+):(-?\d+):(-?\d+):(.*)/);
  if (matches) {
    let lineStart = parseInt(matches[1]);
    let lineEnd = parseInt(matches[2]);
    let columnStart = parseInt(matches[3]);
    let columnEnd = parseInt(matches[4]);
    let message = matches[5];

    let linkNode = document.createElement('a');
    linkNode.setAttribute('href', '#');
    linkNode.addEventListener('click', () => highlight(lineStart, lineEnd, columnStart, columnEnd));

    let label = document.createTextNode('Line ' + (parseInt(lineEnd) + 1));
    linkNode.appendChild(label);

    messager.appendChild(linkNode);

    let textNode = document.createTextNode(': ' + message);
    messager.appendChild(textNode);
  } else {
    let textNode = document.createTextNode(text);
    messager.appendChild(textNode);
  }
  messager.appendChild(document.createElement('br'));
}

// --------------------------------------------------------------------------- 

function registerResizeListener(bounds, gap, resize) {
  let unlistener = (event) => {
    document.removeEventListener('mousemove', moveListener);
    document.removeEventListener('mouseup', unlistener);
    document.removeEventListener('mousedown', unlistener);
  };
  let moveListener = (event) => {
    event.preventDefault();
    if (event.buttons !== 1) {
      unlistener();
    } else {
      resize(event, bounds, gap);
      editor.resize();
    }
  }
  document.addEventListener('mousemove', moveListener, false);
  document.addEventListener('mouseup', unlistener, false);
  document.addEventListener('mousedown', unlistener, false);
}

function buildResizer(side, element) {
  let measureGap;
  let resize;

  if (side === 'right') {
    measureGap = (event, bounds) => event.clientX - bounds.right;
    resize = (event, bounds, gap) => {
      let width = event.clientX - bounds.x - gap;
      element.style.width = width + 'px';
    };
  } else if (side === 'left') {
    measureGap = (event, bounds) => event.clientX - bounds.left;
    resize = (event, bounds, gap) => {
      let width = bounds.right - event.clientX - gap;
      element.style.width = width + 'px';
    };
  } else if (side === 'top') {
    measureGap = (event, bounds) => event.clientY - bounds.top;
    resize = (event, bounds, gap) => {
      let height = bounds.bottom - event.clientY;
      messagerContainer.style.height = height + 'px';
    };
  } else if (side === 'bottom') {
    measureGap = (event, bounds) => event.clientY - bounds.bottom;
    resize = (event, bounds, gap) => {
      let height = bounds.bottom - event.clientY;
      messagerContainer.style.height = height + 'px';
    };
  } else {
    throw 'Resizing ' + side + ' not supported yet.';
  }

  return (event) => {
    if (event.buttons === 1) {
      event.stopPropagation();
      event.preventDefault();
      let bounds = element.getBoundingClientRect();
      let gap = measureGap(event, bounds);
      registerResizeListener(bounds, gap, resize);
    }
  }
}

let directions = {
  horizontal: ['right', 'left'],
  vertical: ['top', 'bottom']
};
for (let direction in directions) {
  let sides = directions[direction];
  sides.forEach(side => {
    let resizables = document.querySelectorAll('.resizable-' + side);
    resizables.forEach(resizable => {
      let div = document.createElement('div');
      div.classList.add('resizer', 'resizer-' + direction, 'resizer-' + side);
      resizable.appendChild(div);
      div.addEventListener('mousedown', buildResizer(side, resizable));
    });
  });
}

// --------------------------------------------------------------------------- 

function startSpinning() {
  recordButton.disabled = true;
  spinner.style.display = 'block';
}

function stopSpinning() {
  recordButton.disabled = false;
  spinner.style.display = 'none';
}

recordButton.addEventListener('clock', () => {
  startSpinning();
  let box = svg.getBoundingClientRect();

  // I don't know why I need to set the viewport explicitly. Setting the size
  // of the image isn't sufficient.
  svg.setAttribute('width', box.width);
  svg.setAttribute('height', box.height);

  let gif = new GIF({
    workers: 3,
    quality: 1,
    // transparent: '#000000',
    // background: '#FFFFFF'
    repeat: 0
  });

  gif.on('finished', (blob) => {
    downloadBlob('download.gif', blob);
    stopSpinning();
  });

	function tick(i) {
    try {
      // TODO if looping, go >=, otherwise >
      if (i >= scrubber.max) {
        gif.render();
      } else {
        env.shapes.forEach(shape => shape.draw(env.svg, i));

        let data = new XMLSerializer().serializeToString(svg);
        let svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
        let url = URL.createObjectURL(svgBlob);

        let img = new Image();
        img.onload = () => {
          gif.addFrame(img, {
            delay: 10,
            copy: true
          });
          URL.revokeObjectURL(url);
          tick(i + 1);
        };

        img.src = url;
      }
    } catch (e) {
      stopSpinning();
      throw e;
    }
	}

	tick(parseInt(scrubber.min));
});

saveButton.addEventListener('click', () => {
  localStorage.setItem('src', editor.getValue());
  isDirty = false;
  syncTitle();
});

function downloadBlob(name, blob) {
  let link = document.createElement('a');
  link.download = name;
  link.href = URL.createObjectURL(blob);
  // Firefox needs the element to be live for some reason.
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    document.body.removeChild(link);
  });
}

exportButton.addEventListener('click', () => {
  let clone = svg.cloneNode(true);

  // Remove outline.
  let outline = clone.getElementById('x-outline');
  outline.parentNode.removeChild(outline);

  let data = new XMLSerializer().serializeToString(clone);
  let svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
  downloadBlob('download.svg', svgBlob);
});

function scrubTo(t) {
  timeSpinner.value = t;
  scrubber.value = t;
  env.shapes.forEach(shape => {
    shape.draw(env, t);
  });
}

scrubber.addEventListener('input', () => {
  stopAnimation();
  scrubTo(parseInt(scrubber.value));
});

timeSpinner.addEventListener('input', () => {
  stopAnimation();
  scrubTo(parseInt(timeSpinner.value));
});

let animateTask = null;
let delay = 16;

function animateFrame(i, isLoop = false) {
  scrubTo(i);
  if (i < parseInt(scrubber.max)) {
    animateTask = setTimeout(() => animateFrame(i + 1, isLoop), delay);
  } else if (isLoop) {
    animateTask = setTimeout(() => animateFrame(parseInt(scrubber.min), isLoop), 100);
  } else {
    animateTask = null;
  }
}

function stopAnimation() {
  if (animateTask) {
    clearTimeout(animateTask);
    animateTask = null;
  }
}

playOnceButton.addEventListener('click', (e) => {
  stopAnimation();
  animateFrame(parseInt(scrubber.min), false);
});

playLoopButton.addEventListener('click', e => {
  stopAnimation();
  animateFrame(parseInt(scrubber.min), true);
});

export let ast;

evalButton.addEventListener('click', () => {
  clearConsole();

  while (svg.lastChild) {
    svg.removeChild(svg.lastChild);
  }
  let defs = document.createElementNS(svgNamespace, 'defs');
  svg.appendChild(defs);

  try {
    initializeShapes();

    let tokens = lex(editor.getValue());
    ast = parse(tokens);

    // tokens.forEach(token => {
      // log(token.where.lineStart + ':' + token.where.lineEnd + ':' + token.where.columnStart + ':' + token.where.columnEnd + '|' + token.source + '<br>');
    // });

    env = new TwovilleEnvironment(null);
    env.svg = svg;
    env.shapes = [];
    TwovilleShape.serial = 0;

    env.bindings.time = new TwovilleEnvironment(env);
    env.bindings.time.bind('start', null, null, new ExpressionInteger(null, 0));
    env.bindings.time.bind('stop', null, null, new ExpressionInteger(null, 100));

    env.bindings.viewport = new TwovilleEnvironment(env);
    env.bindings.viewport.bind('size', null, null, new ExpressionVector(null, [
      new ExpressionInteger(null, 100),
      new ExpressionInteger(null, 100)
    ]));

    env.bindings['rectangle'] = {
      name: 'rectangle',
      formals: [],
      body: new ExpressionRectangle()
    };

    env.bindings['line'] = {
      name: 'line',
      formals: [],
      body: new ExpressionLine()
    };

    env.bindings['label'] = {
      name: 'label',
      formals: [],
      body: new ExpressionLabel()
    };

    env.bindings['group'] = {
      name: 'group',
      formals: [],
      body: new ExpressionGroup()
    };

    env.bindings['mask'] = {
      name: 'mask',
      formals: [],
      body: new ExpressionMask()
    };

    env.bindings['cutout'] = {
      name: 'cutout',
      formals: [],
      body: new ExpressionCutout()
    };

    env.bindings['circle'] = {
      name: 'circle',
      formals: [],
      body: new ExpressionCircle()
    };

    env.bindings['print'] = {
      name: 'print',
      formals: ['message'],
      body: new ExpressionPrint()
    };

    env.bindings['random'] = {
      name: 'random',
      formals: ['min', 'max'],
      body: new ExpressionRandom()
    };

    env.bindings['sin'] = {
      name: 'sin',
      formals: ['degrees'],
      body: new ExpressionSine()
    };

    env.bindings['cos'] = {
      name: 'cos',
      formals: ['degrees'],
      body: new ExpressionCosine()
    };

    env.bindings['int'] = {
      name: 'int',
      formals: ['x'],
      body: new ExpressionInt()
    };

    ast.evaluate(env);

    let size = env.get('viewport').get('size');

    let corner;
    if (env.get('viewport').has('corner')) {
      corner = env.get('viewport').get('corner');
    } else if (env.get('viewport').has('center')) {
      let center = env.get('viewport').get('center');
      corner = new ExpressionVector(null, [
        new ExpressionReal(null, center.get(0).value - size.get(0).value * 0.5),
        new ExpressionReal(null, center.get(1).value - size.get(1).value * 0.5),
      ]);
    } else {
      corner = new ExpressionVector(null, [
        new ExpressionInteger(null, 0),
        new ExpressionInteger(null, 0),
      ]);
    }

    env.svg.setAttributeNS(null, 'width', size.get(0).value);
    env.svg.setAttributeNS(null, 'height', size.get(1).value);
    env.svg.setAttributeNS(null, 'viewBox',
      corner.get(0).value + ' ' +
      corner.get(1).value + ' ' + 
      size.get(0).value + ' ' +
      size.get(1).value
    );

    let pageOutline = document.createElementNS(svgNamespace, 'rect');
    pageOutline.setAttributeNS(null, 'id', 'x-outline');
    pageOutline.setAttributeNS(null, 'x', corner.get(0).value);
    pageOutline.setAttributeNS(null, 'y', corner.get(1).value);
    pageOutline.setAttributeNS(null, 'width', size.get(0).value);
    pageOutline.setAttributeNS(null, 'height', size.get(1).value);
    pageOutline.setAttributeNS(null, 'fill', 'none');
    pageOutline.setAttributeNS(null, 'stroke', 'rgb(0, 0, 0)');
    pageOutline.setAttributeNS(null, 'vector-effect', 'non-scaling-stroke')
    pageOutline.setAttributeNS(null, 'stroke-width', '1px');
    pageOutline.setAttributeNS(null, 'stroke-opacity', 1);
    env.svg.appendChild(pageOutline);

    env.shapes.forEach(shape => {
      shape.domify(env.svg)
    });

    let tmin = env.get('time').get('start').value;
    let tmax = env.get('time').get('stop').value;
    scrubber.min = tmin;
    scrubber.max = tmax;

    let t = parseFloat(scrubber.value);
    if (t < tmin) {
      scrubTo(tmin);
    } else if (t > tmax) {
      scrubTo(tmax);
    } else {
      scrubTo(t);
    }

    recordButton.disabled = false;
  } catch (e) {
    if (e instanceof MessagedException) {
      log(e.userMessage);
      throw e;
    } else {
      console.trace(e);
      log(e.message);
    }
  }
});

function onSourceChanged() {
  isDirty = true;
  syncTitle();
}

function syncTitle() {
  document.title = 'Twoville' + (isDirty ? '*' : '');
}
