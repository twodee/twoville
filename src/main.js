import {
  lex
} from './lexer.js';

import {
  parse,
  Symbols,
} from './parser.js';

import {
  Messager
} from './messager.js';

import ace from 'ace-builds/src-min-noconflict/ace';
import 'ace-builds/src-min-noconflict/theme-twilight';
import './mode-twoville.js';

import {
  GlobalEnvironment,
  LocatedException,
  MessagedException,
  TwovilleShape,
  clearSelection,
  initializeShapes,
  moveCursor,
  restoreSelection,
  svgNamespace,
} from './types.js';

import {
  ExpressionInteger,
  ExpressionReal,
  ExpressionVector,
} from './ast.js';

let editor;
let Range;
let left;
let messagerContainer;
let evaluateButton;
let recordButton;
let exportButton;
let playOnceButton;
let playLoopButton;
let saveButton;
let spinner;
let scrubber;
let timeSpinner;
let hasTweak;
let foregroundHandleGroup;

export let env;
export let isDirty = false;
let isSaved = true;
let animateTask = null;
let delay;
let previousBounds = null;
let previousFitBounds;

export let svg;
export let fitBounds;
export let mouseAtSvg;
export let isDraggingHandle = false;

export function startDragging() {
  isDraggingHandle = true;
}

export function stopDragging() {
  isDraggingHandle = false;
}

function setSvgBounds(bounds) {
  env.svg.setAttributeNS(null, 'viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
}

function fitSvg() {
  env.bounds.x = fitBounds.x;
  env.bounds.y = fitBounds.y;
  env.bounds.width = fitBounds.width;
  env.bounds.height = fitBounds.height;
  env.bounds.span = env.bounds.y + (env.bounds.y + env.bounds.height);
  setSvgBounds(fitBounds);
}

export let mouseAt = [0, 0];
export let isPanningCanvas = false;

function onMouseDown(e) {
  // Only pan if we've evaluated the program at least once.
  isPanningCanvas = !!env;

  mouseAt[0] = e.clientX;
  mouseAt[1] = e.clientY;
}

function onMouseMove(e) {
  if (isPanningCanvas) {
    let delta = [e.clientX - mouseAt[0], e.clientY - mouseAt[1]];
    let viewBoxAspect = env.bounds.width / env.bounds.height;
    let windowAspect = svg.clientWidth / svg.clientHeight;
    if (viewBoxAspect < windowAspect) {
      env.bounds.x -= (delta[0] / svg.clientHeight) * env.bounds.height;
      env.bounds.y -= (delta[1] / svg.clientHeight) * env.bounds.height;
    } else {
      env.bounds.x -= (delta[0] / svg.clientWidth) * env.bounds.width;
      env.bounds.y -= (delta[1] / svg.clientWidth) * env.bounds.width;
    }
    setSvgBounds(env.bounds);
  }
  mouseAt[0] = e.clientX;
  mouseAt[1] = e.clientY;
}

function onMouseUp(e) {
  isPanningCanvas = false;
  mouseAt[0] = e.clientX;
  mouseAt[1] = e.clientY;
}

export function highlight(lineStart, lineEnd, columnStart, columnEnd) {
  editor.getSelection().setSelectionRange(new Range(lineStart, columnStart, lineEnd, columnEnd + 1));
  editor.centerSelection();
}

export function beginTweaking(lineStart, lineEnd, columnStart, columnEnd) {
  highlight(lineStart, lineEnd, columnStart, columnEnd);
  hasTweak = false;
}

export function tweak(newText) {
  // Ace doesn't have a way to do atomic group of changes, which is what I want
  // for handler events. We work around this by undoing before each tweak.
  if (hasTweak) {
    editor.undo();
    hasTweak = false;
  }

  let range = editor.getSelectionRange();
  let doc = editor.getSession().getDocument();

  let oldText = doc.getTextRange(range);
  if (oldText != newText) {
    doc.replace(range, newText);
    hasTweak = true;
  }

  range.setEnd(range.end.row, range.start.column + newText.length);
  editor.getSelection().setSelectionRange(range);
}

export function endTweaking() {
  hasTweak = false;
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

function hideHandles() {
  document.querySelectorAll('.handle-group').forEach(element => {
    element.setAttributeNS(null, 'visibility', 'hidden');
  });
}

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

export function exportSvgWithHandles() {
  serializeThenDownload(svg);
}

export function exportSvgWithoutHandles() {
  let clone = svg.cloneNode(true);
  removeHandles(clone);
  serializeThenDownload(clone);
}

// Inkscape doesn't honor the visibility: hidden attribute. As a workaround,
// we forcibly remove them from the SVG.
// https://bugs.launchpad.net/inkscape/+bug/166181
function removeHandles(root) {
  if (root.classList.contains('handle-group')) {
    root.parentNode.removeChild(root);
  } else {
    for (let i = root.childNodes.length - 1; i >= 0; --i) {
      if (root.childNodes[i].nodeType == Node.ELEMENT_NODE) {
        removeHandles(root.childNodes[i]);
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
  return Math.round(tmin + proportion * (tmax - tmin));
}

function timeToTick(time) {
  return Math.round((time - tmin) / (tmax - tmin) * nTicks);
}

function scrubTo(tick) {
  let t = tickToTime(tick);
  timeSpinner.value = t;
  scrubber.value = tick;
  env.drawables.forEach(drawable => {
    drawable.draw(env, t, env.bounds);
  });
}

export function drawAfterHandling() {
  let t = tickToTime(parseInt(scrubber.value));
  env.drawables.forEach(drawable => {
    drawable.draw(env, t, env.bounds);
  });
  scaleCircleHandles();
}

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

function play(isLoop) {
  stopAnimation();
  animateFrame(0, isLoop);
}

export let ast;

export function interpret(isTweak = false) {
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
    if (env) {
      previousBounds = env.bounds;
    }
    env = new GlobalEnvironment(svg);

    ast.evaluate(env);

    let size = env.get('viewport').get('size');

    if (env.get('viewport').has('color')) {
      let color = env.get('viewport').get('color');
      env.svg.setAttributeNS(null, 'style', `background-color: ${color.toColor()}`);
    } else {
      env.svg.setAttributeNS(null, 'style', `initial`);
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

    previousFitBounds = fitBounds;
    fitBounds = {
      x: corner.get(0).value,
      y: corner.get(1).value,
      width: size.get(0).value,
      height: size.get(1).value,
    };
    fitBounds.span = fitBounds.y + (fitBounds.y + fitBounds.height);

    // Retain viewBox only if we've rendered previously and the viewport hasn't
    // changed. Otherwise we fit the viewBox to the viewport.
    if (previousBounds &&
        fitBounds.x == previousFitBounds.x &&
        fitBounds.y == previousFitBounds.y &&
        fitBounds.width == previousFitBounds.width &&
        fitBounds.height == previousFitBounds.height) {
      env.bounds.x = previousBounds.x;
      env.bounds.y = previousBounds.y;
      env.bounds.width = previousBounds.width;
      env.bounds.height = previousBounds.height;
      env.bounds.span = previousBounds.span;
      setSvgBounds(env.bounds);
    } else {
      fitSvg();
    }

    let pageOutline = document.createElementNS(svgNamespace, 'rect');
    pageOutline.setAttributeNS(null, 'id', 'x-outline');
    pageOutline.setAttributeNS(null, 'visibility', 'visible');
    pageOutline.setAttributeNS(null, 'x', fitBounds.x);
    pageOutline.setAttributeNS(null, 'y', fitBounds.y);
    pageOutline.setAttributeNS(null, 'width', fitBounds.width);
    pageOutline.setAttributeNS(null, 'height', fitBounds.height);
    pageOutline.setAttributeNS(null, 'fill', 'none');
    pageOutline.setAttributeNS(null, 'stroke', 'rgb(180, 180, 180)');
    pageOutline.setAttributeNS(null, 'vector-effect', 'non-scaling-stroke')
    pageOutline.setAttributeNS(null, 'stroke-width', '1px');
    pageOutline.setAttributeNS(null, 'stroke-opacity', 1);
    pageOutline.classList.add('handle');

    let mainGroup = document.createElementNS(svgNamespace, 'g');
    mainGroup.setAttributeNS(null, 'id', 'main-group');
    svg.appendChild(mainGroup);

    let backgroundHandleGroup = document.createElementNS(svgNamespace, 'g');
    backgroundHandleGroup.setAttributeNS(null, 'id', 'background-handle-group');
    svg.appendChild(backgroundHandleGroup);

    foregroundHandleGroup = document.createElementNS(svgNamespace, 'g');
    foregroundHandleGroup.setAttributeNS(null, 'id', 'foreground-handle-group');
    svg.appendChild(foregroundHandleGroup);

    let sceneHandles = document.createElementNS(svgNamespace, 'g');
    sceneHandles.setAttributeNS(null, 'id', 'scene-handles');
    sceneHandles.classList.add('handle-group');
    sceneHandles.appendChild(pageOutline);
    backgroundHandleGroup.appendChild(sceneHandles);

    env.shapes.forEach(shape => {
      shape.domify(defs, mainGroup, backgroundHandleGroup, foregroundHandleGroup);
    });

    delay = env.get('time').get('delay').value;

    tmin = env.get('time').get('start').value;
    tmax = env.get('time').get('stop').value;
    resolution = env.get('time').get('resolution').value;
    nTicks = (tmax - tmin) * resolution;

    scrubber.min = 0;
    scrubber.max = nTicks;
    timeSpinner.max = nTicks;

    let t = getT();
    if (t < tmin) {
      scrubTo(0);
    } else if (t > tmax) {
      scrubTo((tmax - tmin) * resolution);
    } else {
      scrubTo(parseInt(scrubber.value));
    }

    recordButton.disabled = false;
    isDirty = false;

    if (isTweak) {
      restoreSelection(env.drawables);
    }

    scaleCircleHandles();
  } catch (e) {
    if (e instanceof MessagedException) {
      Messager.log(e.userMessage);

      // The env must be wiped. Otherwise the bounds tracked between runs get
      // messed up.
      env = null;

      throw e;
    } else {
      console.trace(e);
      Messager.log(e.message);
      env = null;
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

function onSourceChanged() {
  isDirty = true;
  // clearSelection();
  isSaved = false;
  syncTitle();
}

function syncTitle() {
  document.title = 'Twoville' + (isSaved ? '' : '*');
}

// Keep scrolling from bubbling up to parent when embedded.
// Doesn't work with Ace editor.
// document.body.addEventListener('wheel', function (e) {
  // e.stopPropagation();
  // e.preventDefault();
// });

function scaleCircleHandles() {
  const matrix = svg.getScreenCTM();
  const circles = foregroundHandleGroup.querySelectorAll('.handle-circle');
  for (let circle of circles) {
    circle.r.baseVal.value = 10 / matrix.a;
  }
}

function initialize() {
  editor = ace.edit('editor');
  editor.setTheme('ace/theme/twilight');
  editor.setOptions({
    fontSize: source0 ? '10pt' : '14pt',
    tabSize: 2,
    useSoftTabs: true
  });

  Range = ace.require('ace/range').Range;

  left = document.getElementById('left');
  messagerContainer = document.getElementById('messagerContainer');
  evaluateButton = document.getElementById('evaluateButton');
  recordButton = document.getElementById('recordButton');
  exportButton = document.getElementById('exportButton');
  playOnceButton = document.getElementById('playOnceButton');
  playLoopButton = document.getElementById('playLoopButton');
  saveButton = document.getElementById('saveButton');
  spinner = document.getElementById('spinner');
  scrubber = document.getElementById('scrubber');
  timeSpinner = document.getElementById('timeSpinner');
  new Messager(document.getElementById('messager'), document, highlight);

  if (localStorage.getItem('src') !== null) {
    editor.setValue(localStorage.getItem('src'), 1);
  }
  editor.getSession().on('change', onSourceChanged);
  editor.getSession().setMode("ace/mode/twoville");
  editor.getSession().selection.on('changeCursor', () => {
    if (env && env.drawables) {
      const cursor = editor.getCursorPosition();
      moveCursor(cursor.column, cursor.row, env.drawables);
    }
  });

  recordButton.addEventListener('click', () => {
    startSpinning();
    let box = svg.getBoundingClientRect();

    hideHandles();

    let size = env.get('gif').get('size');
    let transparentColor = env.get('gif').get('transparency');
    let name = env.get('gif').get('name');
    let repeat = env.get('gif').get('repeat');
    let delay = env.get('gif').get('delay');
    let skip = env.get('gif').get('skip');

    // I don't know why I need to set the viewport explicitly. Setting the size
    // of the image isn't sufficient.
    svg.setAttribute('width', size.get(0).value);
    svg.setAttribute('height', size.get(1).value);

    let gif = new GIF({
      workers: 3,
      quality: 1,
      background: '#FFFFFF',
      transparent: null,
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
          env.drawables.forEach(drawable => drawable.draw(env, i, env.bounds));

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
            tick(i + skip.value);
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
    isSaved = true;
    syncTitle();
  });

  exportButton.addEventListener('click', exportSvgWithoutHandles);
  fitButton.addEventListener('click', fitSvg);

  scrubber.addEventListener('input', () => {
    stopAnimation();
    scrubTo(parseInt(scrubber.value));
  });

  timeSpinner.addEventListener('input', () => {
    stopAnimation();
    let tick = timeToTick(parseFloat(timeSpinner.value));
    scrubTo(tick);
  });

  playOnceButton.addEventListener('click', (e) => {
    play(false);
  });

  playLoopButton.addEventListener('click', e => {
    play(true);
  });

  evaluateButton.addEventListener('click', interpret);

  svg = document.getElementById('svg');
  svg.addEventListener('wheel', e => {
    if (env.bounds && !isDraggingHandle) {
      mouseAtSvg.x = e.clientX;
      mouseAtSvg.y = e.clientY;
      const matrix = svg.getScreenCTM();
      let center = mouseAtSvg.matrixTransform(matrix.inverse());

      let factor = 1 + e.deltaY / 100;
      env.bounds.x = (env.bounds.x - center.x) * factor + center.x;
      env.bounds.y = (env.bounds.y - center.y) * factor + center.y;
      env.bounds.width *= factor;
      env.bounds.height *= factor;
      setSvgBounds(env.bounds);

      scaleCircleHandles();
    }
  }, {
    passive: true
  });

  svg.addEventListener('mousedown', onMouseDown);
  svg.addEventListener('mousemove', onMouseMove);
  svg.addEventListener('mouseup', onMouseUp);

  mouseAtSvg = svg.createSVGPoint();

  if (source0) {
    left.style.width = '300px';
    messagerContainer.style.height = '50px';
    editor.resize();
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

  const generateHeightResizer = resizer => {
    const onMouseMove = e => {
      const parentPanel = resizer.parentNode;
      const bounds = resizer.parentNode.getBoundingClientRect();
      const relativeY = e.clientY - bounds.y;
      parentPanel.children[0].style['height'] = `${relativeY - 4}px`;
      parentPanel.children[2].style['height'] = `${bounds.height - (relativeY + 4)}px`;
      editor.resize();
      e.preventDefault();
    };

    const onMouseDown = e => {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', () => {
        document.removeEventListener('mousemove', onMouseMove);
      });
      e.preventDefault();
    };

    return onMouseDown;
  }

  const generateWidthResizer = resizer => {
    const onMouseMove = e => {
      const parentPanel = resizer.parentNode;
      const bounds = resizer.parentNode.getBoundingClientRect();
      const relativeX = e.clientX - bounds.x;
      parentPanel.children[0].style['width'] = `${relativeX - 4}px`;
      parentPanel.children[2].style['width'] = `${bounds.height - (relativeX + 4)}px`;
      editor.resize();
      e.preventDefault();
    };

    const onMouseDown = e => {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', () => {
        document.removeEventListener('mousemove', onMouseMove);
      });
      e.preventDefault();
    };

    return onMouseDown;
  }

  const editorMessagerResizer = document.getElementById('editor-messager-resizer');
  editorMessagerResizer.addEventListener('mousedown', generateHeightResizer(editorMessagerResizer)); 

  const leftRightResizer = document.getElementById('left-right-resizer');
  leftRightResizer.addEventListener('mousedown', generateWidthResizer(leftRightResizer)); 
}

window.addEventListener('load', initialize);
