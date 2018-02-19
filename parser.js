function parse(tokens) {
  var i = 0;

  function has(type, offset) {
    var index = i;
    if (offset) {
      index = i + offset;
    }

    if (index < 0 || index >= tokens.length) {
      return false;
    } else {
      return tokens[index].type == type;
    }
  }

  function consume() {
    i += 1;
    return tokens[i - 1];
  }

  function program() {
    var b = block();
    if (!has(Tokens.EOF)) {
      throw 'Expected EOF';
    }
    return b;
  }

  function block() {
    if (!has(Tokens.Indentation)) {
      throw 'expected indent';
    }

    var indentation = tokens[i];

    statements = [];
    while (has(Tokens.Indentation) && tokens[i].length == indentation.length) {
      consume(); // eat indentation
      if (!has(Tokens.EOF)) {
        statements.push(statement());
        console.log("i:", i);
      }
    }

    return new Block(statements);
  }

  function statement() {
    var e = expression();

    if (has(Tokens.Linebreak)) {
      consume();
    } else if (!has(Tokens.EOF)) {
      throw 'Expected linebreak or EOF';
    }

    return e;
  }

  function expression() {
    return expressionAssignment();
  }

  function expressionAssignment() {
    var lhs = expressionAdditive(); 
    if (has(Tokens.Assign)) {
      consume();
      var rhs = expressionAssignment();
      lhs = new ExpressionAssignment(lhs, rhs);
    }
    return lhs;
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
    var a = expressionProperty();
    while (has(Tokens.Asterisk) || has(Tokens.ForwardSlash) || has(Tokens.Percent)) {
      var operator = consume();
      var b = expressionProperty();
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

  function expressionProperty() {
    var base = atom();
    while (has(Tokens.Dot)) {
      consume(); 
      var property = atom();
      base = new ExpressionProperty(base, property);
    }
    return base;
  }

  function isFirstOfExpression(offset) {
    return has(Tokens.Integer, offset) ||
           has(Tokens.Identifier, offset);
  }

  function atom() {
    if (has(Tokens.Integer)) {
      var token = consume();
      return new ExpressionInteger(Number(token.source));
    } else if (has(Tokens.Real)) {
      var token = consume();
      return new ExpressionReal(Number(token.source));
    } else if (has(Tokens.LeftSquareBracket)) {
      consume(); // eat [
      var elements = [];
      while (!has(Tokens.RightSquareBracket)) {
        elements.push(expression());
        if (!has(Tokens.RightSquareBracket)) {
          if (has(Tokens.Comma)) {
            consume(); // eat ,
          } else {
            throw 'bad bad bad';
          }
        }
      }
      consume(); // eat ]
      return new ExpressionVector(elements);
    } else if (has(Tokens.Identifier) && has(Tokens.LeftParenthesis, 1)) {
      var name = consume().source;
      consume(); // eat (

      var actuals = [];
      if (isFirstOfExpression()) {
        actuals.push(expression());
        while (has(Tokens.Comma) && isFirstOfExpression(1)) {
          consume(); // eat ,
          actuals.push(atom());
        }
      }

      if (has(Tokens.RightParenthesis)) {
        consume();
      } else {
        throw 'Missing )';
      }

      return new ExpressionFunctionCall(name, actuals);
    } else if (has(Tokens.Identifier)) {
      var id = consume();
      return new ExpressionIdentifier(id);
    } else {
      throw 'Don\'t know [' + tokens[i].source + ',' + tokens[i].type + ']';
    }
  }

  var ast = program();

  return ast;
}
