function parse(tokens) {
  var i = 0;

  function has(type) {
    return tokens[i].type == type;
  }

  function consume() {
    i += 1;
    return tokens[i - 1];
  }

  function program() {
    statements = [];
    while (!has(Tokens.EOF)) {
      statements.push(statement());
    }
    return new Block(statements);
  }

  function statement() {
    return expression();
  }

  function expression() {
    var a = atom();
    while (has(Tokens.Plus) || has(Tokens.Minus)) {
      var operator = consume();
      var b = atom();
      if (operator.type == Tokens.Plus) {
        a = new ExpressionAdd(a, b);
      } else {
        a = new ExpressionSubtract(a, b);
      }
    }
    return a;
  }

  function atom() {
    if (has(Tokens.Integer)) {
      var token = consume();
      return new ExpressionInteger(parseInt(token.source));
    }
  }

  var ast = program();

  return ast;
}
