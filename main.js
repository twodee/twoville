var editor = ace.edit('editor');
editor.setTheme('ace/theme/twilight');
editor.setOptions({
  fontSize: '14pt'
});
if (localStorage.getItem('src') !== null) {
  editor.setValue(localStorage.getItem('src'), 1);
}

var left = document.getElementById('left');
var messager = document.getElementById('messager');
var messagerContainer = document.getElementById('messagerContainer');
var evalButton = document.getElementById('eval');
var recordButton = document.getElementById('record');
var saveButton = document.getElementById('save');
var svg = document.getElementById('svg');
var scrubber = document.getElementById('scrubber');
var timeSpinner = document.getElementById('timeSpinner');

function log(text) {
  messager.innerText = text;
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
    var measureGap = (bounds) => event.clientX - bounds.right;
    var resize = (event, bounds, gap) => {
      var bounds = element.getBoundingClientRect();
      var width = event.clientX - bounds.x - gap;
      element.style.width = width + 'px';
    };
  } else if (side === 'left') {
    var measureGap = (bounds) => event.clientX - bounds.left;
    var resize = (event, bounds, gap) => {
      var bounds = element.getBoundingClientRect();
      var width = bounds.right - event.clientX - gap;
      element.style.width = width + 'px';
    };
  } else if (side === 'top') {
    var measureGap = (bounds) => event.clientY - bounds.top;
    var resize = (event, bounds, gap) => {
      var bounds = messagerContainer.getBoundingClientRect();
      var height = bounds.bottom - event.clientY;
      messagerContainer.style.height = height + 'px';
    };
  } else if (side === 'bottom') {
    var measureGap = (bounds) => event.clientY - bounds.bottom;
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
      var gap = measureGap(bounds);
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

var encoder;
recordButton.onclick = function() {
	encoder = new GIFEncoder();
  encoder.setRepeat(0);
	encoder.setDelay(100);
  var bool = encoder.start();

	var canvas = document.getElementById('canvas');
  var context = canvas.getContext('2d');
  var DOMURL = window.URL || window.webkitURL || window;

	function tick(i) {
		if (i > 39) return;

		env.shapes.forEach(shape => shape.draw(env.svg, i));

		var data = (new XMLSerializer()).serializeToString(svg);
		var img = new Image();
		var svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
		var url = DOMURL.createObjectURL(svgBlob);

		img.onload = function () {
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.drawImage(img, 0, 0);
			DOMURL.revokeObjectURL(url);
			encoder.addFrame(context);
			tick(i + 1);
		};

		img.src = url;
	}

	tick(0);
} 

saveButton.onclick = function() {
  // encoder.finish();
	// encoder.download("download.gif");
  localStorage.setItem('src', editor.getValue());
}

var env;

scrubber.oninput = function() {
  timeSpinner.value = scrubber.value;
  env.shapes.forEach(shape => shape.draw(env.svg, scrubber.value));
}

timeSpinner.oninput = function() {
  scrubber.value = timeSpinner.value;
  env.shapes.forEach(shape => shape.draw(env.svg, scrubber.value));
}

var result
evalButton.onclick = function() {
  while (svg.lastChild) {
    svg.removeChild(svg.lastChild);
  }

  tokens = lex(editor.getValue());
  ast = parse(tokens);

  env = TwovilleEnvironment.create({svg: svg, shapes: [], bindings: [], parent: null});

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
  result = ast.evaluate(env);
  console.log("env:", env);

  // console.log("env.bindings['c'].bindings['opacity']:", env.bindings['c'].bindings['opacity'].intervals);

  env.shapes.forEach(shape => shape.draw(env.svg, 0));
}
