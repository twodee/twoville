var eBox = document.getElementById('e');
var evalButton = document.getElementById('eval');
var svg = document.getElementById('canvas');

evalButton.onclick = function() {
  while (svg.lastChild) {
    svg.removeChild(svg.lastChild);
  }

  tokens = lex(eBox.value);
  ast = parse(tokens);
  var env = {
    svg: svg,
    variables: {},
    functions: {},
    shapes: []
  };

  env.functions['rectangle'] = {
    name: 'rectangle',
    formals: [],
    body: new ExpressionRectangle()
  };

  env.functions['print'] = {
    name: 'print',
    formals: ['message'],
    body: new ExpressionPrint()
  };

  result = ast.evaluate(env);

  env.shapes.forEach(shape => shape.draw(env.svg));
}
