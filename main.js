import {
  lex
} from './lexer.js';

import {
  parse
} from './parser.js';

import {
  Messager
} from './messager.js';

import {
  GlobalEnvironment,
  LocatedException,
  MessagedException,
  TwovilleShape,
  initializeShapes,
  svgNamespace,
} from './types.js';

import {
  ExpressionInteger,
  ExpressionReal,
  ExpressionVector,
} from './ast.js';

let editor = ace.edit('editor');
editor.setTheme('ace/theme/twilight');
editor.setOptions({
  fontSize: source0 ? '10pt' : '14pt',
  tabSize: 2,
  useSoftTabs: true
});

if (localStorage.getItem('src') !== null) {
  editor.setValue(localStorage.getItem('src'), 1);
}
editor.getSession().on('change', onSourceChanged);
editor.getSession().setMode("ace/mode/twoville");
let Range = ace.require('ace/range').Range;

let left = document.getElementById('left');
let messagerContainer = document.getElementById('messagerContainer');
let evaluateButton = document.getElementById('evaluateButton');
let recordButton = document.getElementById('recordButton');
let exportButton = document.getElementById('exportButton');
let playOnceButton = document.getElementById('playOnceButton');
let playLoopButton = document.getElementById('playLoopButton');
let saveButton = document.getElementById('saveButton');
let spinner = document.getElementById('spinner');
let scrubber = document.getElementById('scrubber');
let timeSpinner = document.getElementById('timeSpinner');
new Messager(document.getElementById('messager'), document, highlight);

export let env;
let isDirty = false;
let animateTask = null;
let delay;

if (source0) {
  left.style.width = '300px';
  messagerContainer.style.height = '50px';
  editor.resize();
}

export let svg = document.getElementById('svg');

export function highlight(lineStart, lineEnd, columnStart, columnEnd) {
  editor.getSelection().setSelectionRange(new Range(lineStart, columnStart, lineEnd, columnEnd + 1));
  editor.centerSelection();
}

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

function hideAnnotations() {
  document.querySelectorAll('.annotation-group').forEach(element => {
    element.setAttributeNS(null, 'visibility', 'hidden');
  });
}

recordButton.addEventListener('click', () => {
  startSpinning();
  let box = svg.getBoundingClientRect();

  hideAnnotations();

  let size = env.get('gif').get('size');
  let transparentColor = env.get('gif').get('transparency');
  let name = env.get('gif').get('name');
  let repeat = env.get('gif').get('repeat');
  let delay = env.get('gif').get('delay');

  // I don't know why I need to set the viewport explicitly. Setting the size
  // of the image isn't sufficient.
  svg.setAttribute('width', size.get(0).value);
  svg.setAttribute('height', size.get(1).value);

  let gif = new GIF({
    workers: 3,
    quality: 1,
    background: '#FFFFFF',
    transparent: transparentColor.toHexColor(),
    repeat: repeat.value,
    width: size.get(0).value,
    height: size.get(1).value,
  });

  gif.on('finished', (blob) => {
    downloadBlob(name.value, blob);
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
            delay: delay.value,
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

exportButton.addEventListener('click', exportSvgWithoutAnnotations);

export function exportSvgWithAnnotations() {
  serializeThenDownload(svg);
}

export function exportSvgWithoutAnnotations() {
  let clone = svg.cloneNode(true);
  removeAnnotations(clone);
  serializeThenDownload(clone);
}

// Inkscape doesn't honor the visibility: hidden attribute. As a workaround,
// we forcibly remove them from the SVG.
// https://bugs.launchpad.net/inkscape/+bug/166181
function removeAnnotations(root) {
  if (root.classList.contains('annotation-group')) {
    root.parentNode.removeChild(root);
  } else {
    for (let i = root.childNodes.length - 1; i >= 0; --i) {
      if (root.childNodes[i].nodeType == Node.ELEMENT_NODE) {
        removeAnnotations(root.childNodes[i]);
      }
    }
  }
}

function serializeThenDownload(root) {
  let data = new XMLSerializer().serializeToString(root);
  let svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
  downloadBlob('download.svg', svgBlob);
}

function tickToTime(tick) {
  let proportion = tick / nTicks;
  return tmin + proportion * (tmax - tmin);
}

function timeToTick(time) {
  return Math.round((time - tmin) / (tmax - tmin) * nTicks);
}

function scrubTo(tick) {
  let t = tickToTime(tick);
  timeSpinner.value = t;
  scrubber.value = tick;
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
  let tick = timeToTick(parseFloat(timeSpinner.value));
  scrubTo(tick);
});

function animateFrame(i, isLoop = false) {
  scrubTo(i);
  if (i < parseInt(scrubber.max)) {
    animateTask = setTimeout(() => animateFrame(i + 1, isLoop), delay);
  } else if (isLoop) {
    animateTask = setTimeout(() => animateFrame(parseInt(scrubber.min), isLoop), delay);
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
  play(false);
});

playLoopButton.addEventListener('click', e => {
  play(true);
});

function play(isLoop) {
  stopAnimation();
  animateFrame(0, isLoop);
}

export let ast;

function interpret() {
  Messager.clear();

  while (svg.lastChild) {
    svg.removeChild(svg.lastChild);
  }
  let defs = document.createElementNS(svgNamespace, 'defs');
  svg.appendChild(defs);

  try {
    initializeShapes();

    let tokens = lex(editor.getValue());

    // console.log("tokens:", tokens);
    // tokens.forEach(token => {
      // Messager.log(token.where.lineStart + ':' + token.where.lineEnd + ':' + token.where.columnStart + ':' + token.where.columnEnd + '|' + token.source + '<br>');
    // });

    ast = parse(tokens);

    TwovilleShape.serial = 0;
    env = new GlobalEnvironment(svg);

    ast.evaluate(env);

    let size = env.get('viewport').get('size');

    if (env.get('viewport').has('color')) {
      let color = env.get('viewport').get('color');
      env.svg.setAttributeNS(null, 'style', `background: ${color.toColor()}`);
    }

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

    let svgBounds = {
      x: corner.get(0).value,
      y: corner.get(1).value,
      width: size.get(0).value,
      height: size.get(1).value,
    };

    env.svg.setAttributeNS(null, 'width', size.get(0).value);
    env.svg.setAttributeNS(null, 'height', size.get(1).value);
    env.svg.setAttributeNS(null, 'viewBox', `${svgBounds.x} ${svgBounds.y} ${svgBounds.width} ${svgBounds.height}`)

    let pageOutline = document.createElementNS(svgNamespace, 'rect');
    pageOutline.setAttributeNS(null, 'id', 'x-outline');
    pageOutline.setAttributeNS(null, 'visibility', 'visible');
    pageOutline.setAttributeNS(null, 'x', svgBounds.x);
    pageOutline.setAttributeNS(null, 'y', svgBounds.y);
    pageOutline.setAttributeNS(null, 'width', svgBounds.width);
    pageOutline.setAttributeNS(null, 'height', svgBounds.height);
    pageOutline.setAttributeNS(null, 'fill', 'none');
    pageOutline.setAttributeNS(null, 'stroke', 'rgb(180, 180, 180)');
    pageOutline.setAttributeNS(null, 'vector-effect', 'non-scaling-stroke')
    pageOutline.setAttributeNS(null, 'stroke-width', '1px');
    pageOutline.setAttributeNS(null, 'stroke-opacity', 1);
    pageOutline.classList.add('annotation');

    let sceneAnnotations = document.createElementNS(svgNamespace, 'g');
    sceneAnnotations.setAttributeNS(null, 'id', 'scene-annotations');
    sceneAnnotations.classList.add('annotation-group');

    sceneAnnotations.appendChild(pageOutline);
    env.svg.appendChild(sceneAnnotations);

    env.shapes.forEach(shape => {
      // console.log("shape:", shape);
      shape.domify(env.svg)
    });

    delay = env.get('time').get('delay').value;

    tmin = env.get('time').get('start').value;
    tmax = env.get('time').get('stop').value;
    resolution = env.get('time').get('resolution').value;
    nTicks = (tmax - tmin) * resolution;

    scrubber.min = 0;
    scrubber.max = nTicks;

    let t = getT();
    if (t < tmin) {
      scrubTo(0);
    } else if (t > tmax) {
      scrubTo((tmax - tmin) * resolution);
    } else {
      scrubTo(parseInt(scrubber.value));
    }

    recordButton.disabled = false;
  } catch (e) {
    if (e instanceof MessagedException) {
      Messager.log(e.userMessage);
      throw e;
    } else {
      console.trace(e);
      Messager.log(e.message);
    }
  }
}

function getT() {
  let tick = parseInt(scrubber.value);
  return tmin + tick / resolution;
}

let tmin;
let tmax;
let resolution;
let nTicks;

evaluateButton.addEventListener('click', interpret);

function onSourceChanged() {
  isDirty = true;
  syncTitle();
}

function syncTitle() {
  document.title = 'Twoville' + (isDirty ? '*' : '');
}

if (source0) {
  editor.setValue(source0, 1);
  if (runZeroMode) {
    interpret();
    if (runZeroMode == 'loop') {
      play(true);
    }
  }
}
