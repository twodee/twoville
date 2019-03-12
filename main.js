import { lex } from './lexer.js';
import { parse } from './parser.js';
import {
  TwovilleEnvironment,
  TwovilleShape,
  TwovilleInteger,
  TwovilleReal,
  TwovilleVector,
  svgNamespace,
} from './types.js';
import {
  ExpressionRectangle,
  ExpressionLine,
  ExpressionText,
  ExpressionGroup,
  ExpressionMask,
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
let svg = document.getElementById('svg');
let scrubber = document.getElementById('scrubber');
let timeSpinner = document.getElementById('timeSpinner');
let playOnceButton = document.getElementById('playOnceButton');
let playLoopButton = document.getElementById('playLoopButton');
let env;
let isDirty = false;

function highlight(lineStart, lineEnd, columnStart, columnEnd) {
  editor.getSelection().setSelectionRange(new Range(lineStart, columnStart, lineEnd, columnEnd + 1));
  editor.centerSelection();
}

function log(text) {
  text = text.replace(/^(-?\d+):(-?\d+):(-?\d+):(-?\d+):/, (__, lineStart, lineEnd, columnStart, columnEnd) => {
    return '<a href="javascript:highlight(' + lineStart + ', ' + lineEnd + ', ' + columnStart + ', ' + columnEnd + ')">Line ' + (parseInt(lineEnd) + 1) + '</a>: '
  });
  messager.innerHTML += text + '<br>';
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
  if (side === 'right') {
    let measureGap = (event, bounds) => event.clientX - bounds.right;
    let resize = (event, bounds, gap) => {
      let width = event.clientX - bounds.x - gap;
      element.style.width = width + 'px';
    };
  } else if (side === 'left') {
    let measureGap = (event, bounds) => event.clientX - bounds.left;
    let resize = (event, bounds, gap) => {
      let width = bounds.right - event.clientX - gap;
      element.style.width = width + 'px';
    };
  } else if (side === 'top') {
    let measureGap = (event, bounds) => event.clientY - bounds.top;
    let resize = (event, bounds, gap) => {
      let height = bounds.bottom - event.clientY;
      messagerContainer.style.height = height + 'px';
    };
  } else if (side === 'bottom') {
    let measureGap = (event, bounds) => event.clientY - bounds.bottom;
    let resize = (event, bounds, gap) => {
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
  let data = new XMLSerializer().serializeToString(svg);
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

function animateFrame(i, isLoop = false) {
  scrubTo(i);
  if (i < parseInt(scrubber.max)) {
    animateTask = setTimeout(() => animateFrame(i + 1, isLoop), 100);
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

evalButton.addEventListener('click', () => {
  messager.innerHTML = '';

  while (svg.lastChild) {
    svg.removeChild(svg.lastChild);
  }
  let defs = document.createElementNS(svgNamespace, 'defs');
  svg.appendChild(defs);

  let tokens = lex(editor.getValue());
  let ast = parse(tokens);

  // tokens.forEach(token => {
    // log(token.where.lineStart + ':' + token.where.lineEnd + ':' + token.where.columnStart + ':' + token.where.columnEnd + '|' + token.source + '<br>');
  // });

  env = TwovilleEnvironment.create({svg: svg, shapes: [], bindings: [], parent: null});
  TwovilleShape.serial = 0;

  env.bindings.time = TwovilleEnvironment.create(env);
  env.bindings.time.bind('start', null, null, TwovilleInteger.create(0));
  env.bindings.time.bind('stop', null, null, TwovilleInteger.create(100));

  env.bindings.viewport = TwovilleEnvironment.create(env);
  env.bindings.viewport.bind('size', null, null, TwovilleVector.create([
    TwovilleInteger.create(100),
    TwovilleInteger.create(100)
  ]));

  env.bindings['rectangle'] = {
    name: 'rectangle',
    formals: [],
    body: ExpressionRectangle.create()
  };

  env.bindings['line'] = {
    name: 'line',
    formals: [],
    body: ExpressionLine.create()
  };

  env.bindings['text'] = {
    name: 'text',
    formals: [],
    body: ExpressionText.create()
  };

  env.bindings['group'] = {
    name: 'group',
    formals: [],
    body: ExpressionGroup.create()
  };

  env.bindings['mask'] = {
    name: 'mask',
    formals: [],
    body: ExpressionMask.create()
  };

  env.bindings['circle'] = {
    name: 'circle',
    formals: [],
    body: ExpressionCircle.create()
  };

  env.bindings['print'] = {
    name: 'print',
    formals: ['message'],
    body: ExpressionPrint.create()
  };

  env.bindings['random'] = {
    name: 'random',
    formals: ['min', 'max'],
    body: ExpressionRandom.create()
  };

  env.bindings['sin'] = {
    name: 'sin',
    formals: ['degrees'],
    body: ExpressionSine.create()
  };

  env.bindings['cos'] = {
    name: 'cos',
    formals: ['degrees'],
    body: ExpressionCosine.create()
  };

  env.bindings['int'] = {
    name: 'int',
    formals: ['x'],
    body: ExpressionInt.create()
  };

  try {
    ast.evaluate(env);

    let size = env.get('viewport').get('size');

    let corner;
    if (env.get('viewport').has('corner')) {
      corner = env.get('viewport').get('corner');
    } else if (env.get('viewport').has('center')) {
      let center = env.get('viewport').get('center');
      corner = TwovilleVector.create([
        TwovilleReal.create(center.get(0).get() - size.get(0).get() * 0.5),
        TwovilleReal.create(center.get(1).get() - size.get(1).get() * 0.5),
      ]);
    } else {
      corner = TwovilleVector.create([
        TwovilleInteger.create(0),
        TwovilleInteger.create(0),
      ]);
    }

    env.svg.setAttributeNS(null, 'width', size.get(0).get());
    env.svg.setAttributeNS(null, 'height', size.get(1).get());
    env.svg.setAttributeNS(null, 'viewBox',
      corner.get(0).get() + ' ' +
      corner.get(1).get() + ' ' + 
      size.get(0).get() + ' ' +
      size.get(1).get()
    );

    let pageOutline = document.createElementNS(svgNamespace, 'rect');
    pageOutline.setAttributeNS(null, 'id', 'x-outline');
    pageOutline.setAttributeNS(null, 'x', corner.get(0).get());
    pageOutline.setAttributeNS(null, 'y', corner.get(1).get());
    pageOutline.setAttributeNS(null, 'width', size.get(0).get());
    pageOutline.setAttributeNS(null, 'height', size.get(1).get());
    pageOutline.setAttributeNS(null, 'fill', 'none');
    pageOutline.setAttributeNS(null, 'stroke', 'rgb(0, 0, 0)');
    pageOutline.setAttributeNS(null, 'vector-effect', 'non-scaling-stroke')
    pageOutline.setAttributeNS(null, 'stroke-width', '1px');
    pageOutline.setAttributeNS(null, 'stroke-opacity', 1);
    env.svg.appendChild(pageOutline);

    env.shapes.forEach(shape => {
      shape.domify(env.svg)
    });

    let tmin = env.get('time').get('start').get();
    let tmax = env.get('time').get('stop').get();
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
    if (e instanceof Error) {
      log(e.message);
      throw e;
    } else {
      console.trace(e);
      log(e);
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
