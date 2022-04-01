import ace from 'ace-builds/src-min-noconflict/ace';
import 'ace-builds/src-min-noconflict/theme-twilight';
import 'ace-builds/src-min-noconflict/theme-katzenmilch';
import './mode-twoville.js';
import JSZip from 'jszip';
import GIF from 'gif.js';

import {
  clearChildren,
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

const hasWorker = false;

let editor;
let docEditors = [];
let Range;
let left;
let right;
let messagerContainer;
let evaluateButton;
let recordGifButton;
let recordFramesButton;
let exportSvgButton;
let exportPngButton;
let sendToChrisButton;
let fitButton;
let stopButton;
let settingsRoot;
let playOnceButton;
let playLoopButton;
let saveDirtyButton;
let saveCleanButton;
let recordSpinner;
let spinner;
let scrubber;
let timeSpinner;
let interpreterWorker;
let currentName;
let rasterRows;
let rastersList;

let frameIndex = 0;
let delay;
let isLoop;

let defaultSettings = {
  showCopyLinks: true,
  showPageOutline: true,
  backgroundColor: '#E6E6E6',
  warnOnExit: true,
  showTimeScrubber: false,
  mousePrecision: 2,
  theme: 'light',
};
const settings = {...defaultSettings};

let scene;
let isSaved = true;
let animateTask = null;

function highlight(lineStart, lineEnd, columnStart, columnEnd) {
  editor.getSelection().setSelectionRange(new Range(lineStart, columnStart, lineEnd, columnEnd + 1));
  editor.centerSelection();
}

// --------------------------------------------------------------------------- 

function startSpinning() {
  spinner.style.display = 'block';
}

function stopSpinning() {
  spinner.style.display = 'none';
}

function ymd() {
  const now = new Date();
  return `${now.getFullYear()}_${(now.getMonth() + 1 + '').padStart(2, '0')}_${('' + now.getDate()).padStart(2, '0')}`;
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

function downloadDataUrl(name, url) {
  let link = document.createElement('a');
  link.download = name;
  link.href = url;
  // Firefox needs the element to be live for some reason.
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    document.body.removeChild(link);
  });
}

export function exportSvgWithMarks() {
  if (scene) {
    downloadSvg(scene.svg);
  }
}

export function exportSvgWithoutMarks() {
  if (scene) {
    const clone = scene.cloneSvgWithoutMarks();
    downloadSvg(clone);
  }
}

export function exportPngWithoutMarks() {
  if (scene) {
    const clone = scene.cloneSvgWithoutMarks();
    downloadPng(clone);
  }
}

function downloadPng(root) {
  const data = new XMLSerializer().serializeToString(root);
  const svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(svgBlob);
  const name = scene.get('export').get('name').value;
  const size = scene.get('export').get('size');

  const img = new Image(size.get(0).value, size.get(1).value);
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = size.get(0).value;
    canvas.height = size.get(1).value;
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0);
    canvas.toBlob(blob => {
      downloadBlob(`${name}.png`, blob);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  img.src = url;
}

function downloadSvg(root) {
  let data = new XMLSerializer().serializeToString(root);
  let svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
  let name = scene.get('export').get('name').value;
  downloadBlob(`${name}.svg`, svgBlob);
}

function animateTo(t) {
  timeSpinner.value = t;
  scrubber.value = t;
  scene.ageContent(t);
}

function scrubTo(t) {
  if (t < scene.bounds.startTime) {
    t = scene.bounds.startTime;
  } else if (t > scene.bounds.stopTime) {
    t = scene.bounds.stopTime;
  }

  frameIndex = t;
  timeSpinner.value = t;
  scrubber.value = t;
  scene.ageContentAndInteraction(t);
}

function animateFrame() {
  const beforeMillis = new Date().getTime();
  animateTo(frameIndex);
  const afterMillis = new Date().getTime();

  const elapsedMillis = afterMillis - beforeMillis;
  const leftMillis = Math.max(0, delay - elapsedMillis);

  if (frameIndex < parseInt(scrubber.max)) {
    frameIndex += 1;
    animateTask = setTimeout(animateFrame, leftMillis);
  } else if (isLoop) {
    frameIndex = 0;
    animateTask = setTimeout(animateFrame, leftMillis);
  } else {
    animateTask = null;
  }
}

function stopAnimation() {
  if (animateTask) {
    clearTimeout(animateTask);
    animateTask = null;
    scene.isStale = false;
    scrubTo(parseInt(scrubber.value));
  }
}

function play() {
  stopAnimation();
  const time = scene.get('time');
  delay = time.get('delay').value * 1000;
  if (parseInt(scrubber.max) === frameIndex) {
    frameIndex = 0;
  }

  // Disable markers.
  scene.stale();
  scene.hideMarks();

  animateFrame();
}

function stopInterpreting() {
  if (interpreterWorker) {
    interpreterWorker.terminate();
    interpreterWorker = undefined;
  }
  stopButton.classList.add('hidden');
  evaluateButton.classList.remove('hidden');
  stopSpinning();
  editor.focus();
}

function postInterpret(pod, successCallback) {
  const oldScene = scene;
  if (oldScene) {
    oldScene.stop();
  }
  scene = RenderEnvironment.reify(document.getElementById('svg'), document.getElementById('mouse-status-label'), pod, settings);

  let hasTweak;

  scene.startTweak = where => {
    highlight(where.lineStart, where.lineEnd, where.columnStart, where.columnEnd);
    hasTweak = false;
    document.documentElement.classList.remove('grab');
    document.documentElement.classList.add('grabbing');

    let range = editor.getSelectionRange();
    let doc = editor.getSession().getDocument();
    let oldText = doc.getTextRange(range);
    return oldText;
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

    scene.flushManipulation();
  };

  scene.stopTweak = () => {
    hasTweak = false;
    startInterpreting();
    document.documentElement.classList.remove('grabbing');
  };

  try {
    scene.clear();
    scene.start();

    // Go through rasters. Add DOM for any that aren't 
    // Perhaps existing rasters should be provided to scene to prevent
    // invalid elements.
    for (const [id, rasterElement] of Object.entries(scene.rasters)) {
      if (!rasterRows.hasOwnProperty(id)) {
        const rasterLabel = document.createElement('span');
        rasterLabel.appendChild(document.createTextNode(id));
        rasterLabel.setAttribute('class', 'raster-id');

        const previewImage = document.createElement('img');
        previewImage.setAttribute('class', 'raster-preview');

        const fileInput = document.createElement('input');
        fileInput.setAttribute('type', 'file');
        fileInput.setAttribute('accept', 'image/*');
        fileInput.addEventListener('change', onUploadRaster);
        fileInput.style.display = 'none';

        const uploadButton = document.createElement('button');
        uploadButton.setAttribute('class', 'raster-action');
        uploadButton.appendChild(document.createTextNode('upload'));
        uploadButton.addEventListener('click', () => fileInput.click());

        const removeButton = document.createElement('button');
        removeButton.setAttribute('class', 'raster-action');
        removeButton.appendChild(document.createTextNode('remove'));
        removeButton.addEventListener('click', onRemoveRaster);

        const row = document.createElement('div');
        row.setAttribute('class', 'raster-row');
        row.setAttribute('data-id', `${id}`);

        const listItem = document.createElement('li');
        listItem.setAttribute('data-id', `${id}`);

        const actions = document.createElement('div');
        actions.classList.add('raster-actions');
        actions.appendChild(uploadButton);
        actions.appendChild(removeButton);
        
        row.appendChild(fileInput);
        row.appendChild(previewImage);
        row.appendChild(rasterLabel);
        row.appendChild(actions);

        listItem.appendChild(row);
        
        rastersList.appendChild(listItem);

        document.getElementById('no-rasters-item').style.display = 'none';

        rasterRows[id] = row;
      } else {
        // Input already exists for this name. Attach any uploaded
        // image to the image element in the SVG.
        const input = rasterRows[id].children[0];
        if (input.files.length > 0) {
          attachRaster(id);
        }
      }

      if (rasterRows[id].children[0].files.length === 0) {
        Messager.log(`I see a new raster named <code>${id}</code>. Upload its image in the Rasters panel.`);
      }
    }

    timeSpinner.min = scrubber.min = scene.bounds.startTime;
    timeSpinner.max = scrubber.max = scene.bounds.stopTime;

    let t = parseInt(scrubber.value);
    scrubTo(t);

    if (oldScene) {
      if (oldScene.selectedShape) {
        scene.reselect(oldScene.selectedShape);
      }
      scene.rebound(oldScene.bounds);
    }

    recordGifButton.disabled = false;
    recordFramesButton.disabled = false;
    if (successCallback) {
      successCallback();
    }
  } catch (e) {
    if (e instanceof MessagedException) {
      Messager.log(e.userMessage);

      // The scene must be wiped. Otherwise the bounds tracked between runs get
      // messed up.
      scene.stop();
      scene = null;

      throw e;
    } else {
      console.trace(e);
      Messager.log(e.message);
      scene.stop();
      scene = null;
    }
  }
}

function onRemoveRaster(event) {
  const row = event.target.parentNode.parentNode;
  const id = row.dataset.id;
  rastersList.removeChild(row.parentNode);
  if (rastersList.children.length === 1) {
    document.getElementById('no-rasters-item').style.display = 'list-item';
  }
  delete rasterRows[id];
}

function attachRaster(id) {
  readImage(rasterRows[id].children[0].files[0])
    .then(({image, dataUrl}) => {
      if (scene && scene.rasters.hasOwnProperty(id)) {
        rasterRows[id].children[1].src = dataUrl;
        scene.rasters[id].setRaster(image.width / image.height, dataUrl);
        // TODO width/height are dependent on raster. Setting the image 
        // update one or the other, which forces a DOM change. How is this
        // best maintained?
        // scene.rasters[id].updateContentDom(scene.bounds);
        // scene.rasters[id].updateInteractionState(scene.bounds);
        // scene.rasters[id].updateInteractionDom(scene.bounds, 1);
        scrubTo(parseInt(scrubber.value));
      }
    });
}

function readImage(file) {
  return readFile(file).then(dataUrl => {
    return new Promise((resolve, reject) => {
      const image = document.createElement('img');
      image.addEventListener('load', () => {
        resolve({image, dataUrl});
      });
      image.src = dataUrl;
    });
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve(reader.result);
    });
    reader.readAsDataURL(file);
  });
}

function imageToDataUrl(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

function onUploadRaster(event) {
  const row = event.target.parentNode;
  const id = row.dataset.id;
  attachRaster(id);
}

function startInterpreting(successCallback) {
  stopInterpreting();

  startSpinning();
  stopButton.classList.remove('hidden');
  evaluateButton.classList.add('hidden');

  Messager.clear();

  if (hasWorker) {
    interpreterWorker = new Interpreter();
    interpreterWorker.addEventListener('message', event => {
      if (event.data.type === 'output') {
        Messager.log(event.data.payload);
      } else if (event.data.type === 'environment') {
        stopInterpreting();
        postInterpret(event.data.payload, successCallback);
      } else if (event.data.type === 'error') {
        stopInterpreting();
      }
    });

    interpreterWorker.postMessage({
      command: 'interpret',
      source: editor.getValue(),
    });
  } else {
    const scene = interpret(editor.getValue(), Messager.log);
    stopInterpreting();
    if (scene) {
      postInterpret(scene.toPod(), successCallback);
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
  let title = 'Twoville';
  if (currentName) {
    title += ` - ${currentName}`;
  }
  if (!isSaved) {
    title += '*';
  }
  document.title = title;
  saveDirtyButton.style.display = isSaved ? 'none' : 'block';
  saveCleanButton.style.display = isSaved ? 'block' : 'none';
}

// Keep scrolling from bubbling up to parent when embedded.
document.getElementById('middle').addEventListener('wheel', e => {
  e.preventDefault();
}, {passive: false});

window.addEventListener('beforeunload', event => {
  if (settings.warnOnExit && !isSaved) {
    event.preventDefault();
    event.returnValue = '';
  }
});

function storeTwos(meld) {
  let twos = JSON.parse(localStorage.getItem('twos')) ?? {}; 
  twos = meld(twos);
  localStorage.setItem('twos', JSON.stringify(twos));
}

function save() {
  if (isEmbedded) return;

  const now = new Date().getTime();
  storeTwos(twos => ({
    ...twos,
    [currentName]: {
      createdAt: now,
      ...twos[currentName],
      modifiedAt: now,
      source: editor.getValue(),
    },
  }));

  isSaved = true;
  syncTitle();
}

function initialize() {
  editor = ace.edit('editor');
  editor.setOptions({
    fontFamily: 'Roboto Mono',
    fontSize: source0 ? 14 : 18,
    tabSize: 2,
    useSoftTabs: true
  });

  editor.commands.addCommand({
    name: "increaseFontSize",
    bindKey: {win: "Ctrl-=", mac: "Command-="},
    exec: function(editor) {
      editor.setFontSize(editor.getFontSize() + 1);
    }
  });

  editor.commands.addCommand({
    name: "decreaseFontSize",
    bindKey: {win: "Ctrl--", mac: "Command--"},
    exec: function(editor) {
      if (editor.getFontSize() > 4) {
        editor.setFontSize(editor.getFontSize() - 1);
      }
    }
  });

  editor.commands.addCommand({
    name: "Run",
    bindKey: {win: "Ctrl-Return", mac: "Command-Return"},
    exec: function(editor) {
      startInterpreting();
    }
  });

  Range = ace.require('ace/range').Range;

  left = document.getElementById('left');
  right = document.getElementById('right');
  messagerContainer = document.getElementById('messager-container');
  evaluateButton = document.getElementById('evaluate-button');
  recordGifButton = document.getElementById('record-gif-button');
  recordFramesButton = document.getElementById('record-frames-button');
  exportSvgButton = document.getElementById('export-svg-button');
  exportPngButton = document.getElementById('export-png-button');
  sendToChrisButton = document.getElementById('send-to-chris-button');
  fitButton = document.getElementById('fit-button');
  stopButton = document.getElementById('stop-button');
  playOnceButton = document.getElementById('play-once-button');
  playLoopButton = document.getElementById('play-loop-button');
  saveDirtyButton = document.getElementById('save-dirty-button');
  saveCleanButton = document.getElementById('save-clean-button');
  spinner = document.getElementById('spinner');
  scrubber = document.getElementById('scrubber');
  timeSpinner = document.getElementById('time-spinner');
  const svg = document.getElementById('svg');
  new Messager(document.getElementById('messager'), document, highlight);

  let savedSettings = {};

  if (!isEmbedded) {
    const json = localStorage.getItem('twoville-settings');
    if (json) {
      savedSettings = JSON.parse(json);
      Object.assign(settings, savedSettings);
    }
  }

  const saveSettings = () => {
    if (!isEmbedded) {
      localStorage.setItem('twoville-settings', JSON.stringify(savedSettings));
    }
  };

  const showTimeScrubberToggle = document.getElementById('show-time-scrubber-toggle');
  const warnOnExitToggle = document.getElementById('warn-on-exit-toggle');
  const showCopyLinksToggle = document.getElementById('show-copy-links-toggle');
  const showPageOutlineToggle = document.getElementById('show-page-outline-toggle');
  const backgroundColorPicker = document.getElementById('background-color-picker');
  const backgroundColorPreview = document.getElementById('background-color-preview');
  const mousePrecisionSpinner = document.getElementById('mouse-precision-spinner');
  const themePicker = document.getElementById('theme-picker');

  const uiSynchronizers = {
    backgroundColor: () => {
      backgroundColorPreview.style['background-color'] = settings.backgroundColor;
      svg.style.backgroundColor = settings.backgroundColor; 
    },
    showCopyLinks: () => {
      // showCopyLinksToggle.checked = settings.showCopyLinks;
    },
    showPageOutline: () => {
      // showPageOutlineToggle.checked = settings.showPageOutline;
    },
    theme: () => {
      // themePicker.value = settings.theme;
      let theme;
      if (settings.theme === 'dark') {
        theme = 'twilight';
        document.body.classList.remove('light');
        document.body.classList.add('dark');
      } else if (settings.theme === 'light') {
        theme = 'katzenmilch';
        document.body.classList.remove('dark');
        document.body.classList.add('light');
      }
      editor.setTheme(`ace/theme/${theme}`);
      for (let docEditor of docEditors) {
        docEditor.setTheme(`ace/theme/${theme}`);
      }
    },
    warnOnExit: () => {
      warnOnExitToggle.checked = settings.warnOnExit;
    },
    showTimeScrubber: () => {
      document.getElementById('time-toolbar').style.display = settings.showTimeScrubber ? 'block' : 'none';
      showTimeScrubberToggle.checked = settings.showTimeScrubber;
    },
    mousePrecision: () => {
      mousePrecisionSpinner.value = settings.mousePrecision;
    },
  };

  // Set theme.
  themePicker.value = settings.theme;
  uiSynchronizers.theme();
  themePicker.addEventListener('change', () => {
    settings.theme = savedSettings.theme = themePicker.value;
    uiSynchronizers.theme();
    saveSettings();
  });

  // Handle show copy links toggling.
  showPageOutlineToggle.checked = settings.showPageOutline;
  showPageOutlineToggle.addEventListener('click', () => {
    settings.showPageOutline = savedSettings.showPageOutline = showPageOutlineToggle.checked;
    saveSettings();
    const outline = document.getElementById('x-outline');
    if (outline) {
      outline.setAttribute('visibility', settings.showPageOutline ? 'visible' : 'hidden');
    }
  });

  // Handle show copy links toggling.
  showCopyLinksToggle.checked = settings.showCopyLinks;
  showCopyLinksToggle.addEventListener('click', () => {
    settings.showCopyLinks = savedSettings.showCopyLinks = showCopyLinksToggle.checked;
    saveSettings();
    for (let copyContainer of document.querySelectorAll('.copy-container')) {
      copyContainer.classList.toggle('hidden', !settings.showCopyLinks);
    }
  });

  mousePrecisionSpinner.value = settings.mousePrecision;
  mousePrecisionSpinner.addEventListener('input', () => {
    if (mousePrecisionSpinner.value.match(/^\d+$/)) {
      mousePrecisionSpinner.classList.toggle('bad-input', false);
      settings.mousePrecision = savedSettings.mousePrecision = parseInt(mousePrecisionSpinner.value);
      saveSettings();
    } else {
      mousePrecisionSpinner.classList.toggle('bad-input', true);
    }
  });

  warnOnExitToggle.checked = settings.warnOnExit;
  warnOnExitToggle.addEventListener('click', () => {
    settings.warnOnExit = savedSettings.warnOnExit = warnOnExitToggle.checked;
    saveSettings();
  });

  showTimeScrubberToggle.checked = settings.warnOnExit;
  uiSynchronizers.showTimeScrubber();
  showTimeScrubberToggle.addEventListener('click', () => {
    settings.showTimeScrubber = savedSettings.showTimeScrubber = showTimeScrubberToggle.checked;
    uiSynchronizers.showTimeScrubber();
    saveSettings();
  });

  // Handle background color picking.
  backgroundColorPicker.value = settings.backgroundColor;
  svg.style.backgroundColor = settings.backgroundColor; 
  backgroundColorPreview.style['background-color'] = settings.backgroundColor;
  backgroundColorPicker.addEventListener('input', () => {
    settings.backgroundColor = savedSettings.backgroundColor = backgroundColorPicker.value;
    uiSynchronizers.backgroundColor();
    saveSettings();
  });

  const resetSettings = () => {
    savedSettings = {};
    for (let key of Object.keys(settings)) {
      delete settings[key];
    }
    Object.assign(settings, defaultSettings);
    saveSettings();

    for (let uiSynchronizer of Object.values(uiSynchronizers)) {
      uiSynchronizer();
    }
  };

  const resetSettingsButton = document.getElementById('reset-settings-button');
  resetSettingsButton.addEventListener('click', () => {
    resetSettings();
  });

  const dialogOverlay = document.getElementById('dialog-overlay');

  // Handle open dialog.
  const manageFilesButton = document.getElementById('manage-files-button');
  const manageFilesCancelButton = document.getElementById('manage-files-cancel-button');
  const manageFilesDeleteButton = document.getElementById('manage-files-delete-button');
  const manageFilesDialog = document.getElementById('manage-files-dialog');
  const manageFilesList = document.getElementById('manage-files-list');
  const manageFilesOpenButton = document.getElementById('manage-files-open-button');

  function closeOpenDialog() {
    dialogOverlay.style.display = 'none';
    manageFilesDialog.style.display = 'none';
    document.removeEventListener('keydown', openEscapeListener);
  }

  function openEscapeListener(event) {
    if (event.key === 'Escape') {
      closeOpenDialog();
    }
  }

  function loadFile(name) {
    // Save most recent file so that it can be automatically reopened when the
    // page is reloaded.
    localStorage.setItem('most-recent-two', name);

    // Invalidate previous scene so we don't carry over bounds or selection.
    if (scene) {
      clearChildren(scene.svg);
      scene.stop();
      scene = null;
    }

    const twos = JSON.parse(localStorage.getItem('twos')); 

    if (twos.hasOwnProperty(name)) {
      currentName = name;
      const file = twos[name];
      editor.setValue(file.source, 1);
      closeOpenDialog();
      isSaved = true;
      syncTitle();
    }
  }

  // Alert --------------------------------------------------------------------
  const alertDialog = document.getElementById('alert-dialog');
  const alertDialogHeadingField = document.getElementById('alert-dialog-heading-field');
  const alertDialogMessageField = document.getElementById('alert-dialog-message-field');
  const alertDialogOkayButton = document.getElementById('alert-dialog-okay-button');

  function alertEscapeListener(event) {
    if (event.key === 'Escape') {
      closeAlertDialog();
    }
  }

  function showAlertDialog(heading, message) {
    alertDialog.style.display = 'flex';
    dialogOverlay.style.display = 'flex';
    alertDialogHeadingField.innerText = heading;
    alertDialogMessageField.innerText = message;
    document.addEventListener('keydown', alertEscapeListener);
  }

  function closeAlertDialog() {
    alertDialog.style.display = 'none';
    dialogOverlay.style.display = 'none';
    document.removeEventListener('keydown', alertEscapeListener);
  }

  alertDialogOkayButton.addEventListener('click', closeAlertDialog);

  // Confirm ------------------------------------------------------------------
  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmDialogHeadingField = document.getElementById('confirm-dialog-heading-field');
  const confirmDialogMessageField = document.getElementById('confirm-dialog-message-field');
  const confirmDialogOkayButton = document.getElementById('confirm-dialog-okay-button');
  const confirmDialogCancelButton = document.getElementById('confirm-dialog-cancel-button');

  function showConfirmDialog(heading, message, okayLabel, cancelLabel, okayListener, cancelListener) {
    confirmDialog.style.display = 'flex';
    dialogOverlay.style.display = 'flex';
    confirmDialogHeadingField.innerText = heading;
    confirmDialogMessageField.innerText = message;
    confirmDialogOkayButton.innerText = okayLabel;
    confirmDialogCancelButton.innerText = cancelLabel;

    function confirmEscapeListener(event) {
      if (event.key === 'Escape') {
        closeConfirmDialog();
      }
    }

    function okayCallback() {
      closeConfirmDialog();
      okayListener();
    }

    function cancelCallback() {
      closeConfirmDialog();
      cancelListener();
    }

    function closeConfirmDialog() {
      confirmDialog.style.display = 'none';
      dialogOverlay.style.display = 'none';

      document.removeEventListener('keydown', confirmEscapeListener);
      confirmDialogOkayButton.removeEventListener('click', okayCallback);
      confirmDialogCancelButton.removeEventListener('click', cancelCallback);
    }

    document.addEventListener('keydown', confirmEscapeListener);
    confirmDialogOkayButton.addEventListener('click', okayCallback);
    confirmDialogCancelButton.addEventListener('click', cancelCallback);
  }

  // Open ---------------------------------------------------------------------
  function refreshOpen() {
    clearChildren(manageFilesList);
    const twos = JSON.parse(localStorage.getItem('twos')) ?? {}; 
    const names = Object.keys(twos);

    if (names.length === 0) {
      closeOpenDialog();
      showAlertDialog('No Files', 'There are no files available to open.');
    } else {
      dialogOverlay.style.display = 'flex';
      manageFilesDialog.style.display = 'flex';
      clearChildren(manageFilesList);

      for (let name of Object.keys(twos).sort()) {
        const option = document.createElement('option');
        option.value = name;
        option.appendChild(document.createTextNode(name));
        manageFilesList.appendChild(option);
      }

      document.addEventListener('keydown', openEscapeListener);
    }
  }

  manageFilesList.addEventListener('dblclick', () => {
    closeOpenDialog();
    if (isSaved) {
      loadFile(manageFilesList.value);
    } else {
      showConfirmDialog('Unsaved Changes', 'You have unsaved changes in your current program. These changes will be lost if you open this file.', 'Open Anyway', 'Cancel', () => {
        loadFile(manageFilesList.value);
      }, () => {});
    }
  });

  manageFilesButton.addEventListener('click', () => {
    refreshOpen();
  });
  manageFilesOpenButton.addEventListener('click', () => {
    closeOpenDialog();
    if (isSaved) {
      loadFile(manageFilesList.value);
    } else {
      showConfirmDialog('Unsaved Changes', 'You have unsaved changes in your current program. These changes will be lost if you open this file.', 'Open Anyway', 'Cancel', () => {
        loadFile(manageFilesList.value);
      }, () => {});
    }
  });
  manageFilesCancelButton.addEventListener('click', closeOpenDialog);
  manageFilesDeleteButton.addEventListener('click', deleteProgram);

  function deleteProgram() {
    const name = manageFilesList.value;
    if (name && confirm(`Delete ${name}?`)) {
      const twos = JSON.parse(localStorage.getItem('twos')) ?? {}; 
      delete twos[name];
      localStorage.setItem('twos', JSON.stringify(twos));
      refreshOpen();
    }
  }

  // Handle save as dialog.
  const saveAsButton = document.getElementById('save-as-button');
  const saveAsCancelButton = document.getElementById('save-as-cancel-button');
  const saveAsOkayButton = document.getElementById('save-as-okay-button');
  const saveAsDialog = document.getElementById('save-as-dialog');
  const saveAsFileNameInput = document.getElementById('save-as-file-name-input');
  const saveAsErrorBox = document.getElementById('save-as-error-box');
  const renamePrompt = document.getElementById('rename-prompt');
  const saveAsPrompt = document.getElementById('save-as-prompt');
  const oldNameBox = document.getElementById('old-name-box');
  const removeOldCheckbox = document.getElementById('remove-old-checkbox');

  function closeSaveAsDialog() {
    dialogOverlay.style.display = 'none';
    saveAsDialog.style.display = 'none';
    document.removeEventListener('keydown', saveAsEscapeListener);
  }

  function saveAsEscapeListener(event) {
    if (event.key === 'Escape') {
      closeSaveAsDialog();
    }
  }

  function showSaveAsDialog() {
    saveAsErrorBox.style.display = 'none';
    dialogOverlay.style.display = 'flex';
    saveAsDialog.style.display = 'flex';
    saveAsFileNameInput.focus();
    removeOldCheckbox.checked = false;
    if (currentName) {
      renamePrompt.style.display = 'block';
      oldNameBox.innerText = currentName;
      saveAsPrompt.innerHTML = `The file's old name is <code>${currentName}</code>. What is the new name?`;
    } else {
      saveAsPrompt.innerHTML = `What is the name of the file?`;
      renamePrompt.style.display = 'none';
    }
    document.addEventListener('keydown', saveAsEscapeListener);
  }

  saveAsButton.addEventListener('click', () => {
    saveAsFileNameInput.value = ''; // TODO use existing
    showSaveAsDialog();
  });
  saveAsCancelButton.addEventListener('click', closeSaveAsDialog);

  function reallySaveAs() {
    const oldName = currentName;
    currentName = saveAsFileNameInput.value;
    localStorage.setItem('most-recent-two', currentName);

    save();

    if (removeOldCheckbox.checked && oldName !== currentName) {
      let twos = JSON.parse(localStorage.getItem('twos')) ?? {}; 
      delete twos[oldName];
      localStorage.setItem('twos', JSON.stringify(twos));
    }
  }

  function trySaveAs() {
    const name = saveAsFileNameInput.value;
    if (name.match(/^\s*$/)) {
      saveAsErrorBox.innerText = `The name "${name}" is not valid. Try something different.`;
      saveAsErrorBox.style.display = 'block';
    } else {
      const twos = JSON.parse(localStorage.getItem('twos')) ?? {}; 
      closeSaveAsDialog();
      // if user want to rename, delete old file after saving new version
      if (twos.hasOwnProperty(name)) {
        showOverwriteDialog(name);
      } else {
        reallySaveAs();
      }
    }
  }

  saveAsOkayButton.addEventListener('click', trySaveAs);
  saveAsFileNameInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      trySaveAs();
    }
  });

  // Handle overwrite dialog.
  const overwriteDialog = document.getElementById('overwrite-dialog');
  const overwriteNameField = document.getElementById('overwrite-name-field');
  const overwriteCancelButton = document.getElementById('overwrite-cancel-button');
  const overwriteOkayButton = document.getElementById('overwrite-okay-button');

  function showOverwriteDialog(name) {
    dialogOverlay.style.display = 'flex';
    overwriteDialog.style.display = 'flex';
    overwriteNameField.innerText = name;
    document.addEventListener('keydown', overwriteEscapeListener);
  }

  function closeOverwriteDialog() {
    overwriteDialog.style.display = 'none';
    document.removeEventListener('keydown', overwriteEscapeListener);
    showSaveAsDialog(); 
  }

  function overwriteEscapeListener(event) {
    if (event.key === 'Escape') {
      closeOverwriteDialog();
    }
  }

  overwriteCancelButton.addEventListener('click', closeOverwriteDialog);
  overwriteOkayButton.addEventListener('click', () => {
    reallySaveAs();
    overwriteDialog.style.display = 'none';
    dialogOverlay.style.display = 'none';
  });

  const exportLibraryButton = document.getElementById('export-library-button');
  exportLibraryButton.addEventListener('click', () => {
    const twos = JSON.parse(localStorage.getItem('twos'));
    if (twos) {
      downloadBlob(`twos_${ymd()}.json`, new Blob([JSON.stringify(twos, null, 2)], {type: 'application/json'}));
    }
  });

  // Handle import library dialog.
  const importLibraryButton = document.getElementById('import-library-button');
  const importLibraryPicker = document.getElementById('import-library-picker');
  importLibraryButton.addEventListener('click', () => {
    importLibraryPicker.click();
  });

  function readLibrary(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        resolve(JSON.parse(reader.result));
      });
      reader.addEventListener('error', () => {
        resolve(reader.error);
      });
      reader.readAsText(file);
    });
  }

  importLibraryPicker.addEventListener('change', () => {
    const readPromises = [...importLibraryPicker.files].map(file => readLibrary(file));
    Promise.all(readPromises)
      .then(libraries => libraries.reduce((mass, library) => ({...mass, ...library}), {}))
      .then(mass => storeTwos(twos => ({...twos, ...mass})))
      .catch(error => console.error(error));
  });

  if (source0) {
    editor.setValue(source0, 1);
  } else if (!isEmbedded) {
    const mostRecentTwo = localStorage.getItem('most-recent-two');
    if (mostRecentTwo) {
      loadFile(mostRecentTwo);
      // editor.setValue(localStorage.getItem('src'), 1);
    }
  }

  function loadNewFile() {
    if (scene) {
      scene.clear();
    }
    editor.setValue('', 1);
    currentName = null;
    localStorage.removeItem('most-recent-two');
    isSaved = true;
    syncTitle();
  }

  const newButton = document.getElementById('new-button');
  newButton.addEventListener('click', () => {
    if (isSaved) {
      loadNewFile();
    } else {
      showConfirmDialog('Unsaved Changes', 'You have unsaved changes in your current program.', 'New File Anyway', 'Cancel', () => {
        loadNewFile();
      }, () => {});
    }
  });

  editor.getSession().on('change', onSourceChanged);
  editor.getSession().setMode("ace/mode/twoville");
  editor.getSession().selection.on('changeCursor', () => {
    if (scene) {
      const cursor = editor.getCursorPosition();
      scene.castCursor(cursor.column, cursor.row);
    }
  });

  recordGifButton.addEventListener('click', () => {
    startSpinning();
    let box = scene.svg.getBoundingClientRect();

    scene.hideMarks();

    let size = scene.get('export').get('size');
    let transparentColor = scene.get('export').get('transparency');
    let name = scene.get('export').get('name');
    let loop = scene.get('export').get('loop');
    let backgroundColor = scene.get('export').get('background').toHexColor();

    const time = scene.get('time');
    let delay = time.get('delay').value * 1000;
    delay = Math.max(20, delay);

    // I don't know why I need to set the viewport explicitly. Setting the size
    // of the image isn't sufficient.
    scene.svg.setAttribute('width', size.get(0).value);
    scene.svg.setAttribute('height', size.get(1).value);

    let gif = new GIF({
      workers: 3,
      quality: 1,
      background: backgroundColor,
      transparent: null,
      repeat: loop.value,
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
          scene.scrub(i);

          let data = new XMLSerializer().serializeToString(scene.cloneSvgWithoutMarks());
          let svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
          let url = URL.createObjectURL(svgBlob);

          let img = new Image(size.get(0).value, size.get(1).value);
          img.onload = () => {
            gif.addFrame(img, {
              delay: delay,
              copy: true,
            });

            URL.revokeObjectURL(url);
            tick(i + 1);
          };

          img.src = url;

          // settingsRoot.appendChild(img);
        }
      } catch (e) {
        stopSpinning();
        throw e;
      }
    }

    tick(parseInt(scrubber.min));
  });

  recordFramesButton.addEventListener('click', () => {
    startSpinning();
    let box = scene.svg.getBoundingClientRect();

    scene.hideMarks();

    let size = scene.get('export').get('size');
    let name = scene.get('export').get('name');

    const time = scene.get('time');
    let delay = time.get('delay').value * 1000;
    delay = Math.max(20, delay);

    // I don't know why I need to set the viewport explicitly. Setting the size
    // of the image isn't sufficient.
    scene.svg.setAttribute('width', size.get(0).value);
    scene.svg.setAttribute('height', size.get(1).value);

    // gif.on('finished', (blob) => {
      // downloadBlob(name.value, blob);
      // stopSpinning();
    // });

    const pngUrls = [];
    const zip = new JSZip();

    function tick(i) {
      try {
        if (i >= scrubber.max) {
          zip.generateAsync({type: 'blob'})
            .then(blob => downloadBlob(`${name.value}.zip`, blob));
        } else {
          scene.scrub(i);

          let data = new XMLSerializer().serializeToString(scene.cloneSvgWithoutMarks());
          let svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
          let url = URL.createObjectURL(svgBlob);

          let img = new Image(size.get(0).value, size.get(1).value);
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = size.get(0).value;
            canvas.height = size.get(1).value;
            const context = canvas.getContext('2d');
            context.drawImage(img, 0, 0);
            canvas.toBlob(blob => {
              zip.file(`${name.value}-${('' + i).padStart(3, '0')}.png`, blob);
              URL.revokeObjectURL(url);
              tick(i + 1);
            }, 'image/png');
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

  function saveSomehow() {
    if (currentName) {
      save();
    } else {
      showSaveAsDialog();
    }
  }

  saveDirtyButton.addEventListener('click', saveSomehow);
  saveCleanButton.addEventListener('click', saveSomehow);

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      saveSomehow();
      event.preventDefault();
      return false;
    } else {
      return true;
    }
  });

  exportSvgButton.addEventListener('click', exportSvgWithoutMarks);
  exportPngButton.addEventListener('click', exportPngWithoutMarks);

  sendToChrisButton.addEventListener('click', sendToChris);

  fitButton.addEventListener('click', () => {
    if (scene) scene.fit();
  });

  scrubber.addEventListener('input', () => {
    stopAnimation();
    scrubTo(parseInt(scrubber.value));
  });

  timeSpinner.addEventListener('input', () => {
    stopAnimation();
    if (timeSpinner.value) {
      scrubTo(parseInt(timeSpinner.value));
    }
  });

  playOnceButton.addEventListener('click', (e) => {
    if (animateTask) {
      stopAnimation();
    } else {
      isLoop = false;
      play();
    }
  });

  playLoopButton.addEventListener('click', e => {
    if (animateTask) {
      stopAnimation();
    } else {
      isLoop = true;
      play();
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

    if (runZeroMode) {
      startInterpreting(() => {
        if (runZeroMode == 'loop') {
          isLoop = true;
          play();
        }
      });
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

  // const generateWidthResizer = resizer => {
    // const onMouseMove = e => {
      // const parentPanel = resizer.parentNode;
      // const bounds = resizer.parentNode.getBoundingClientRect();
      // const relativeX = e.clientX - bounds.x;
      // parentPanel.children[0].style['width'] = `${relativeX - 4}px`;
      // parentPanel.children[2].style['width'] = `${bounds.height - (relativeX + 4)}px`;
      // editor.resize();

      // if (!isEmbedded) {
        // localStorage.setItem('left-width', parentPanel.children[0].style.width);
      // }

      // e.preventDefault();
    // };

    // const onMouseDown = e => {
      // document.addEventListener('mousemove', onMouseMove);
      // document.addEventListener('mouseup', () => {
        // document.removeEventListener('mousemove', onMouseMove);
      // });
      // e.preventDefault();
    // };

    // return onMouseDown;
  // }

  const generateLeftResizer = (resizer, i) => {
    const onMouseMove = e => {
      const parentPanel = resizer.parentNode;
      const bounds = parentPanel.children[i - 1].getBoundingClientRect();
      const newWidth = e.clientX - 4 - bounds.x;

      parentPanel.children[i - 1].style['width'] = `${newWidth}px`;

      editor.resize();
      if (!isEmbedded) {
        localStorage.setItem('left-width', parentPanel.children[i - 1].style.width);
      }
      // resizeWindow();
      editor.resize();

      e.preventDefault();
    };

    const onMouseDown = e => {
      const parentPanel = resizer.parentNode;
      const style = window.getComputedStyle(parentPanel.children[4]);
      const originalMinWidth = style['min-width'];
      parentPanel.children[4].style['min-width'] = style['width'];

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', () => {
        parentPanel.children[4].style['min-width'] = originalMinWidth;
        document.removeEventListener('mousemove', onMouseMove);
      });
      e.preventDefault();
    };

    return onMouseDown;
  };

  const generateRightResizer = (resizer, i) => {
    const onMouseMove = e => {
      const parentPanel = resizer.parentNode;
      const bounds = parentPanel.children[i + 1].getBoundingClientRect();

      if (!isEmbedded) {
        localStorage.setItem('right-width', parentPanel.children[i + 1].style.width);
      }
      // resizeWindow();
      editor.resize();
      for (let docEditor of docEditors) {
        docEditor.resize();
      }
  
      const newWidth = bounds.right - e.clientX + 4;
      parentPanel.children[i + 1].style['width'] = `${newWidth}px`;

      // resizeWindow();
      e.preventDefault();
    };

    const onMouseDown = e => {
      const parentPanel = resizer.parentNode;
      const style = window.getComputedStyle(parentPanel.children[0]);
      const originalMinWidth = style['min-width'];
      parentPanel.children[0].style['min-width'] = style['width'];

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', () => {
        parentPanel.children[0].style['min-width'] = originalMinWidth;
        document.removeEventListener('mousemove', onMouseMove);
      });
      e.preventDefault();
    };

    return onMouseDown;
  };

  const editorMessagerResizer = document.getElementById('editor-messager-resizer');
  editorMessagerResizer.addEventListener('mousedown', generateHeightResizer(editorMessagerResizer)); 

  const settingsDocsResizer = document.getElementById('settings-docs-resizer');
  settingsDocsResizer.addEventListener('mousedown', generateHeightResizer(settingsDocsResizer)); 

  const leftMiddleResizer = document.getElementById('left-middle-resizer');
  leftMiddleResizer.addEventListener('mousedown', generateLeftResizer(leftMiddleResizer, 1)); 

  const middleRightResizer = document.getElementById('middle-right-resizer');
  middleRightResizer.addEventListener('mousedown', generateRightResizer(middleRightResizer, 3));

  const openPanelButton = document.getElementById('open-panel-button');
  const closePanelButton = document.getElementById('close-panel-button');
  const panel = document.getElementById('right');

  settingsRoot = document.getElementById('settings-root');

  const targetMillis = 300;

  // Restore editor width from last time, unless we're embedded.
  if (!isEmbedded) {
    const leftWidth0 = localStorage.getItem('left-width');
    if (leftWidth0) {
      left.style['width'] = leftWidth0;
    }

    const isPanelOpen = localStorage.getItem('is-panel-open') === 'true';
    if (isPanelOpen) {
      right.style.display = 'flex';
      middleRightResizer.style.display = 'block';
      closePanelButton.style.display = 'block';
      openPanelButton.style.display = 'none';
    }

    const rightWidth0 = localStorage.getItem('right-width');
    if (rightWidth0) {
      right.style['width'] = rightWidth0;
    }

    // Without this, cursor changes cause jarring scrolling.
    editor.resize();
  }

  openPanelButton.addEventListener('click', () => {
    if (!isEmbedded) {
      localStorage.setItem('is-panel-open', true);
    }
    openPanelButton.style.display = 'none';

    panel.style.display = 'flex';
    const bounds = panel.getBoundingClientRect(); 

    const startValue = bounds.right;
    const endValue = bounds.x;
    const startMillis = new Date().getTime();

    panel.style.position = 'absolute';
    panel.style.top = '0';
    panel.style.bottom = '0';

    const animation = () => {
      const currentMillis = new Date().getTime();
      const elapsedMillis = currentMillis - startMillis;

      if (elapsedMillis <= targetMillis) {
        const proportion = elapsedMillis / targetMillis;
        const value = startValue + (endValue - startValue) * proportion;
        panel.style.left = `${value}px`;
        requestAnimationFrame(animation);
      } else {
        panel.style.left = `${endValue}px`;
        panel.style.position = 'static';
        middleRightResizer.style.display = 'block';
        closePanelButton.style.display = 'block';
      }

      // resizeWindow();
    };

    animation();
  });

  closePanelButton.addEventListener('click', () => {
    if (!isEmbedded) {
      localStorage.setItem('is-panel-open', false);
    }
    closePanelButton.style.display = 'none';
    middleRightResizer.style.display = 'none';

    const bounds = panel.getBoundingClientRect(); 

    const startValue = bounds.left;
    const endValue = bounds.right;
    const startMillis = new Date().getTime();

    panel.style.position = 'absolute';
    panel.style.top = '0';
    panel.style.bottom = '0';

    const animation = () => {
      const currentMillis = new Date().getTime();
      const elapsedMillis = currentMillis - startMillis;

      if (elapsedMillis <= targetMillis) {
        const proportion = elapsedMillis / targetMillis;
        const value = startValue + (endValue - startValue) * proportion;
        panel.style.left = `${value}px`;
        requestAnimationFrame(animation);
      } else {
        panel.style.position = 'static';
        panel.style.display = 'none';
        openPanelButton.style.display = 'block';
      }

      // resizeWindow();
    };

    animation();
  });

  initializeDocs();
  rasterRows = {};
  rastersList = document.getElementById('rasters-list');
}

function sendToChris() {
  const name = prompt("What's your name?");
  const payload = {
    name,
    source: editor.getValue(),
  };
  fetch('save.php', {
    headers: {'Content-Type': 'application/json'},
    method: 'POST',
    body: JSON.stringify(payload),
  }).then(response => {
    if (!response.ok) {
      throw Error(response.statusText);
    }
    return response;
  }).then(response => {
    console.log("response.body:", response.body);
  });
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(e => console.error(e)); 
  }
}

function initializeDocs() {
  const root = document.getElementById('docs-root');
  const contentPanel = document.getElementById('docs-content-panel');
  const toolbar = document.getElementById('docs-toolbar');
  const backButton = document.getElementById('docs-back-button');

  const history = [];

  const docify = html => {
    contentPanel.innerHTML = html;
    root.scrollTop = 0;
    docEditors.splice(0, docEditors.length);

    const links = contentPanel.querySelectorAll('.docs-link');
    for (let link of links) {
      link.addEventListener('click', e => {
        load(link.hash);

        // If I don't prevent default, then the anchor clicking sets the hash
        // to #. I want to customize the hash.
        e.preventDefault();
      });
    }

    const sources = contentPanel.querySelectorAll('.docs-source');
    for (let source of sources) {

      // Chrome on Windows was showing the Ace editor as collapsed and without
      // the text content. I don't know what the issue was. But wrapping the
      // Ace element inside another div fixes the problem.
      const wrapper = document.createElement('div');
      source.parentNode.replaceChild(wrapper, source);
      wrapper.appendChild(source);

      const docEditor = ace.edit(source);
      const theme = settings.theme === 'dark' ? 'twilight' : 'katzenmilch';
      docEditor.setTheme(`ace/theme/${theme}`);
      docEditor.getSession().setMode('ace/mode/twoville');
      docEditor.setOptions({
        autoScrollEditorIntoView: true,
        fontFamily: 'Roboto Mono',
        fontSize: '14pt',
        tabSize: 2,
        useSoftTabs: true,
        maxLines: 100,
        readOnly: true,
      });

      const copyAnchor = document.createElement('a');
      copyAnchor.href = '#';
      copyAnchor.innerText = 'copy';
      copyAnchor.classList.add('copy-button');
      copyAnchor.addEventListener('click', e => {
        copyToClipboard(docEditor.getValue());
        e.preventDefault();
      });

      const copyContainer = document.createElement('div');
      copyContainer.classList.add('copy-container');
      copyContainer.appendChild(copyAnchor);
      copyContainer.classList.toggle('hidden', !settings.showCopyLinks);

      wrapper.appendChild(copyContainer);

      docEditors.push(docEditor);
    }
  };

  function checkForErrors(response) {
    if (!response.ok) {
      throw Error(response.error);
    } else {
      return response;
    }
  }

  const load = tag => {
    window.history.replaceState(undefined, undefined, tag);
    history.push(tag);
    fetch(`/docs/${tag.substring(1)}.html`)
      .then(checkForErrors)
      .then(response => response.text())
      .then(html => {
        toolbar.style.display = tag === '#index' ? 'none' : 'block';
        docify(html);
      })
      .catch(e => {
        toolbar.style.display = 'block';
      });
  };

  backButton.addEventListener('click', () => {
    if (history.length <= 1) return;
    history.pop();
    load(history.pop());
  });

  if (window.location.hash) {
    history.push('#index');
    load(window.location.hash);
  } else {
    load('#index');
  }
}

initialize();
