import ace from 'ace-builds/src-min-noconflict/ace';
import 'ace-builds/src-min-noconflict/theme-twilight';
import './mode-twoville.js';

import {
  MessagedException,
} from './common.js';

import {
  RenderEnvironment,
} from './render.js';

import {
  interpret,
} from './interpreter.js';

import {
  Messager
} from './messager.js';

import Interpreter from './interpreter.worker.js';

let editor;
let Range;
let left;
let messagerContainer;
let evaluateButton;
let recordButton;
let exportButton;
let fitButton;
let stopButton;
let playOnceButton;
let playLoopButton;
let saveButton;
let recordSpinner;
let evaluateSpinner;
let scrubber;
let timeSpinner;
let interpreterWorker;

let scene;
let isSaved = true;
let animateTask = null;
let delay;

function highlight(lineStart, lineEnd, columnStart, columnEnd) {
  editor.getSelection().setSelectionRange(new Range(lineStart, columnStart, lineEnd, columnEnd + 1));
  editor.centerSelection();
}

// --------------------------------------------------------------------------- 

function startSpinning(spinner, button) {
  button.disabled = true;
  spinner.style.display = 'block';
}

function stopSpinning(spinner, button) {
  button.disabled = false;
  spinner.style.display = 'none';
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

export function exportSvgWithMarks() {
  serializeThenDownload(scene.svg);
}

export function exportSvgWithoutMarks() {
  const clone = scene.cloneSvgWithoutMarks();
  serializeThenDownload(clone);
}

function serializeThenDownload(root) {
  let data = new XMLSerializer().serializeToString(root);
  let svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
  downloadBlob('download.svg', svgBlob);
}

function scrubTo(tick) {
  let t = scene.tickToTime(tick);
  timeSpinner.value = t;
  scrubber.value = tick;
  scene.scrub(t);
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

function stopInterpreting() {
  if (interpreterWorker) {
    interpreterWorker.terminate();
    interpreterWorker = undefined;
  }
  stopButton.classList.add('hidden');
  stopSpinning(evaluateSpinner, evaluateButton);
}

function postInterpret(pod) {
  const oldScene = scene;
  if (oldScene) {
    oldScene.stop();
  }
  scene = RenderEnvironment.reify(document.getElementById('svg'), pod);

  let hasTweak;

  scene.startTweak = where => {
    highlight(where.lineStart, where.lineEnd, where.columnStart, where.columnEnd);
    hasTweak = false;
    document.documentElement.classList.remove('grab');
    document.documentElement.classList.add('grabbing');
  };

  scene.tweak = newText => {
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

    let t = scene.tickToTime(parseInt(scrubber.value));
    scene.scrub(t);
  };

  scene.stopTweak = () => {
    hasTweak = false;
    startInterpreting();
    document.documentElement.classList.remove('grabbing');
  };

  try {
    scene.clear();
    scene.start();

    scrubber.min = 0;
    scrubber.max = scene.nTicks;
    timeSpinner.max = scene.nTicks;

    let t = scene.getTime(parseInt(scrubber.value));
    if (t < scene.tmin) {
      scrubTo(0);
    } else if (t > scene.tmax) {
      scrubTo((scene.tmax - scene.tmin) * scene.resolution);
    } else {
      scrubTo(parseInt(scrubber.value));
    }

    if (oldScene) {
      if (oldScene.selectedShape) {
        scene.reselect(oldScene.selectedShape);
      }
      scene.rebound(oldScene.bounds);
    }

    recordButton.disabled = false;
  } catch (e) {
    if (e instanceof MessagedException) {
      Messager.log(e.userMessage);

      // The scene must be wiped. Otherwise the bounds tracked between runs get
      // messed up.
      scene = null;

      throw e;
    } else {
      console.trace(e);
      Messager.log(e.message);
      scene = null;
    }
  }
}

function startInterpreting() {
  stopInterpreting();

  startSpinning(evaluateSpinner, evaluateButton);
  stopButton.classList.remove('hidden');

  Messager.clear();

  interpreterWorker = new Interpreter();
  interpreterWorker.addEventListener('message', event => {
    if (event.data.type === 'output') {
      Messager.log(event.data.payload);
    } else if (event.data.type === 'environment') {
      stopInterpreting();
      postInterpret(event.data.payload);
    } else if (event.data.type === 'error') {
      stopInterpreting();
    }
  });

  const hasWorker = true;
  if (hasWorker) {
    interpreterWorker.postMessage({
      command: 'interpret',
      source: editor.getValue(),
    });
  } else {
    const scene = interpret(editor.getValue(), Messager.log);
    stopInterpreting();
    if (scene) {
      postInterpret(scene.toPod());
    }
  }
}

function onSourceChanged() {
  // If the source was changed through the text editor, but not through the
  // canvas, the marks are no longer valid.
  if (scene) {
    scene.stale();
  }
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

function save() {
  localStorage.setItem('src', editor.getValue());
  isSaved = true;
  syncTitle();
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
  messagerContainer = document.getElementById('messager-container');
  evaluateButton = document.getElementById('evaluate-button');
  recordButton = document.getElementById('record-button');
  exportButton = document.getElementById('export-button');
  fitButton = document.getElementById('fit-button');
  stopButton = document.getElementById('stop-button');
  playOnceButton = document.getElementById('play-once-button');
  playLoopButton = document.getElementById('play-loop-button');
  saveButton = document.getElementById('save-button');
  recordSpinner = document.getElementById('record-spinner');
  evaluateSpinner = document.getElementById('evaluate-spinner');
  scrubber = document.getElementById('scrubber');
  timeSpinner = document.getElementById('time-spinner');
  new Messager(document.getElementById('messager'), document, highlight);

  if (localStorage.getItem('src') !== null) {
    editor.setValue(localStorage.getItem('src'), 1);
  }
  editor.getSession().on('change', onSourceChanged);
  editor.getSession().setMode("ace/mode/twoville");
  editor.getSession().selection.on('changeCursor', () => {
    if (scene) {
      const cursor = editor.getCursorPosition();
      scene.castCursor(cursor.column, cursor.row);
    }
  });

  recordButton.addEventListener('click', () => {
    startSpinning(recordSpinner, recordButton);
    let box = scene.svg.getBoundingClientRect();

    scene.hideMarks();

    let size = scene.get('gif').get('size');
    let transparentColor = scene.get('gif').get('transparency');
    let name = scene.get('gif').get('name');
    let repeat = scene.get('gif').get('repeat');
    let delay = scene.get('gif').get('delay');
    let skip = scene.get('gif').get('skip');

    // I don't know why I need to set the viewport explicitly. Setting the size
    // of the image isn't sufficient.
    scene.svg.setAttribute('width', size.get(0).value);
    scene.svg.setAttribute('height', size.get(1).value);

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
      stopSpinning(recordSpinner, recordButton);
    });

    function tick(i) {
      try {
        // TODO if looping, go >=, otherwise >
        if (i >= scrubber.max) {
          gif.render();
        } else {
          scene.drawables.forEach(drawable => drawable.draw(scene, i, scene.bounds));

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
        stopSpinning(recordSpinner, recordButton);
        throw e;
      }
    }

    tick(parseInt(scrubber.min));
  });

  saveButton.addEventListener('click', save);

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      save();
      event.preventDefault();
      return false;
    } else {
      return true;
    }
  });

  exportButton.addEventListener('click', exportSvgWithoutMarks);
  fitButton.addEventListener('click', () => {
    if (scene) scene.fit();
  });

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
    if (animateTask) {
      stopAnimation();
    } else {
      play(true);
    }
  });

  stopButton.addEventListener('click', e => {
    stopInterpreting();
  });

  evaluateButton.addEventListener('click', () => {
    startInterpreting();
  });

  if (source0) {
    left.style.width = '300px';
    messagerContainer.style.height = '50px';
    editor.resize();
  }

  if (source0) {
    editor.setValue(source0, 1);
    if (runZeroMode) {
      startInterpreting();
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

      localStorage.setItem('left-width', parentPanel.children[0].style.width);

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

  // Restore editor width from last time, unless we're embedded.
  const leftWidth0 = localStorage.getItem('left-width');
  if (leftWidth0 && !isEmbedded) {
    left.style['width'] = leftWidth0;
  }
}

window.addEventListener('DOMContentLoaded', initialize);
