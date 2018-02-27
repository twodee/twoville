var eBox = document.getElementById('e');
var evalButton = document.getElementById('eval');
var recordButton = document.getElementById('record');
var saveButton = document.getElementById('save');
var svg = document.getElementById('svg');
var scrubber = document.getElementById('scrubber');

var encoder;
recordButton.onclick = function() {
	encoder = new GIFEncoder();
  encoder.setRepeat(0);
	encoder.setDelay(100);
  var bool = encoder.start();
	console.log("bool:", bool);

	var canvas = document.getElementById('canvas');
  var context = canvas.getContext('2d');
  var DOMURL = window.URL || window.webkitURL || window;

	function tick(i) {
		if (i > 39) return;
    console.log("i:", i);

		env.shapes.forEach(shape => shape.draw(env.svg, i));

		var data = (new XMLSerializer()).serializeToString(svg);
		var img = new Image();
		var svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
		var url = DOMURL.createObjectURL(svgBlob);

		img.onload = function () {
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.drawImage(img, 0, 0);
			DOMURL.revokeObjectURL(url);
			console.log('foofoo');
			encoder.addFrame(context);
			tick(i + 1);
		};

		img.src = url;
	}

	tick(0);
} 

saveButton.onclick = function() {
  encoder.finish();
	encoder.download("download.gif");
}

var env;
scrubber.oninput = function() {
  console.log("scrubber.value:", scrubber.value);
  env.shapes.forEach(shape => shape.draw(env.svg, scrubber.value));
}

var result
evalButton.onclick = function() {
  while (svg.lastChild) {
    svg.removeChild(svg.lastChild);
  }

  tokens = lex(eBox.value);
  ast = parse(tokens);

  env = new TwovilleEnvironment({svg: svg, shapes: [], bindings: [], parent: null});

  env.bindings['rectangle'] = {
    name: 'rectangle',
    formals: [],
    body: new ExpressionRectangle()
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

  console.log("ast:", ast);
  result = ast.evaluate(env);

  env.shapes.forEach(shape => shape.draw(env.svg, 0));
}
