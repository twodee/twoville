var eBox = document.getElementById('e');
var evalButton = document.getElementById('eval');
var svg = document.getElementById('canvas');
var scrubber = document.getElementById('scrubber');

var env;
scrubber.oninput = function() {
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
