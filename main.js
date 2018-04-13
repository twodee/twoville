var editor = ace.edit('editor');
editor.setTheme('ace/theme/twilight');
editor.setOptions({
  fontSize: '14pt',
  tabSize: 2,
  useSoftTabs: true
});
if (localStorage.getItem('src') !== null) {
  editor.setValue(localStorage.getItem('src'), 1);
}
var Range = ace.require('ace/range').Range;

var left = document.getElementById('left');
var messager = document.getElementById('messager');
var messagerContainer = document.getElementById('messagerContainer');
var evalButton = document.getElementById('eval');
var recordButton = document.getElementById('record');
var spinner = document.getElementById('spinner');
var saveButton = document.getElementById('save');
var exportButton = document.getElementById('export');
var svg = document.getElementById('svg');
var scrubber = document.getElementById('scrubber');
var timeSpinner = document.getElementById('timeSpinner');
var env;

function highlight(lineStart, lineEnd, columnStart, columnEnd) {
  editor.getSelection().setSelectionRange(new Range(lineStart, columnStart, lineEnd, columnEnd + 1));
  editor.centerSelection();
}

function log(text) {
  console.log("text:", text);
  text = text.replace(/^(-?\d+):(-?\d+):(-?\d+):(-?\d+):/, function(__, lineStart, lineEnd, columnStart, columnEnd) {
    return '<a href="javascript:highlight(' + lineStart + ', ' + lineEnd + ', ' + columnStart + ', ' + columnEnd + ')">Line ' + (parseInt(lineEnd) + 1) + '</a>: '
  });
  messager.innerHTML += text + '<br>';
}

// --------------------------------------------------------------------------- 

function registerResizeListener(bounds, gap, resize) {
  var unlistener = function(event) {
    document.removeEventListener('mousemove', moveListener);
    document.removeEventListener('mouseup', unlistener);
    document.removeEventListener('mousedown', unlistener);
  };
  var moveListener = function(event) {
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
    var measureGap = (event, bounds) => event.clientX - bounds.right;
    var resize = (event, bounds, gap) => {
      var bounds = element.getBoundingClientRect();
      var width = event.clientX - bounds.x - gap;
      element.style.width = width + 'px';
    };
  } else if (side === 'left') {
    var measureGap = (event, bounds) => event.clientX - bounds.left;
    var resize = (event, bounds, gap) => {
      var bounds = element.getBoundingClientRect();
      var width = bounds.right - event.clientX - gap;
      element.style.width = width + 'px';
    };
  } else if (side === 'top') {
    var measureGap = (event, bounds) => event.clientY - bounds.top;
    var resize = (event, bounds, gap) => {
      var bounds = messagerContainer.getBoundingClientRect();
      var height = bounds.bottom - event.clientY;
      messagerContainer.style.height = height + 'px';
    };
  } else if (side === 'bottom') {
    var measureGap = (event, bounds) => event.clientY - bounds.bottom;
    var resize = (event, bounds, gap) => {
      var bounds = messagerContainer.getBoundingClientRect();
      var height = bounds.bottom - event.clientY;
      messagerContainer.style.height = height + 'px';
    };
  } else {
    throw 'Resizing ' + side + ' not supported yet.';
  }

  return function(event) {
    if (event.buttons === 1) {
      event.stopPropagation();
      var bounds = element.getBoundingClientRect();
      var gap = measureGap(event, bounds);
      registerResizeListener(bounds, gap, resize);
    }
  }
}

var directions = {
  horizontal: ['right', 'left'],
  vertical: ['top', 'bottom']
};
for (direction in directions) {
  sides = directions[direction];
  sides.forEach(side => {
    var resizables = document.querySelectorAll('.resizable-' + side);
    resizables.forEach(resizable => {
      var div = document.createElement('div');
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

recordButton.onclick = function() {
  startSpinning();
  var box = svg.getBoundingClientRect();

  // I don't know why I need to set the viewport explicitly. Setting the size
  // of the image isn't sufficient.
  svg.setAttribute('width', box.width);
  svg.setAttribute('height', box.height);

  var gif = new GIF({
    workers: 3,
    quality: 1,
    // transparent: '#000000',
    // background: '#FFFFFF'
    repeat: 0
  });

  gif.on('finished', function(blob) {
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

        var data = new XMLSerializer().serializeToString(svg);
        var svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
        var url = URL.createObjectURL(svgBlob);

        var img = new Image();
        img.onload = function () {
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
} 

saveButton.onclick = function() {
  localStorage.setItem('src', editor.getValue());
}

function downloadBlob(name, blob) {
  var link = document.createElement('a');
  link.download = name;
  link.href = URL.createObjectURL(blob);
  // Firefox needs the element to be live for some reason.
  document.body.appendChild(link);
  link.click();
  setTimeout(function() {
    URL.revokeObjectURL(link.href);
    document.body.removeChild(link);
  });
}

exportButton.onclick = function() {
  var data = new XMLSerializer().serializeToString(svg);
  var svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
  downloadBlob('download.svg', svgBlob);
}

function scrubTo(t) {
  timeSpinner.value = t;
  scrubber.value = t;
  env.shapes.forEach(shape => shape.draw(env.svg, t));
}

scrubber.oninput = function() {
  scrubTo(scrubber.value);
}

timeSpinner.oninput = function() {
  scrubTo(timeSpinner.value);
}

evalButton.onclick = function() {
  messager.innerHTML = '';

  while (svg.lastChild) {
    svg.removeChild(svg.lastChild);
  }

  tokens = lex(editor.getValue());
  ast = parse(tokens);

  // tokens.forEach(token => {
    // log(token.where.lineStart + ':' + token.where.lineEnd + ':' + token.where.columnStart + ':' + token.where.columnEnd + '|' + token.source + '<br>');
  // });

  env = TwovilleEnvironment.create({svg: svg, shapes: [], bindings: [], parent: null});

  env.bindings.t = TwovilleEnvironment.create(env);
  env.bindings.t.bind('start', null, null, TwovilleInteger.create(0));
  env.bindings.t.bind('stop', null, null, TwovilleInteger.create(100));

  env.bindings['rectangle'] = {
    name: 'rectangle',
    formals: [],
    body: ExpressionRectangle.create()
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

  env.bindings['int'] = {
    name: 'int',
    formals: ['x'],
    body: ExpressionInt.create()
  };

  console.log("ast:", ast);
  try {
    ast.evaluate(env);
    console.log("env:", env);
    var tmin = env.get('t').get('start').get();
    var tmax = env.get('t').get('stop').get();
    scrubber.min = tmin;
    scrubber.max = tmax;

    var t = parseFloat(scrubber.value);
    if (t < tmin) {
      scrubTo(tmin);
    } else if (t > tmax) {
      scrubTo(tmax);
    } else {
      scrubTo(t);
    }

    recordButton.disabled = false;
  } catch (e) {
    log(e);
  }
}
