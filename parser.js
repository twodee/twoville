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
    if (has(Tokens.Rectangle)) {
      consume();
      var left = expressionAdditive();
      var bottom = expressionAdditive();
      var width = expressionAdditive();
      var height = expressionAdditive();
      return new ExpressionRectangle(left, bottom, width, height);
    } else {
      throw 'ick';
    }
  }

  function expressionAdditive() {
    var a = expressionMultiplicative();
    while (has(Tokens.Plus) || has(Tokens.Minus)) {
      var operator = consume();
      var b = expressionMultiplicative();
      if (operator.type == Tokens.Plus) {
        a = new ExpressionAdd(a, b);
      } else {
        a = new ExpressionSubtract(a, b);
      }
    }
    return a;
  }

  function expressionMultiplicative() {
    var a = atom();
    while (has(Tokens.Asterisk) || has(Tokens.ForwardSlash) || has(Tokens.Percent)) {
      var operator = consume();
      var b = atom();
      if (operator.type == Tokens.Asterisk) {
        a = new ExpressionMultiply(a, b);
      } else if (operator.type == Tokens.ForwardSlash) {
        a = new ExpressionDivide(a, b);
      } else {
        a = new ExpressionRemainder(a, b);
      }
    }
    return a;
  }

  function atom() {
    if (has(Tokens.Integer)) {
      var token = consume();
      return new ExpressionInteger(Number(token.source));
    } else if (has(Tokens.Real)) {
      var token = consume();
      return new ExpressionReal(Number(token.source));
    } else {
      throw 'Don\'t know ' + tokens[i];
    }
  }

  var ast = program();

  return ast;
}
