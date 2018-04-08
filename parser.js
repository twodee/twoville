function parse(tokens) {
  var i = 0;
  var indents = [-1];

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
      throw 'Expected EOF saw [' + tokens[i].type + '|' + tokens[i].source + ']';
    }
    return b;
  }

  function block() {
    if (!has(Tokens.Indentation)) {
      throw 'expected indent';
    }

    var indentation = tokens[i];

    if (indentation.source.length <= indents[indents.length - 1]) {
      throw 'not indented enough';
    }
    indents.push(indentation.source.length);

    var statements = [];
    while (has(Tokens.Indentation) && tokens[i].source.length == indentation.source.length) {
      consume(); // eat indentation
      if (has(Tokens.Linebreak)) {
        consume();
      } else if (!has(Tokens.EOF)) {
        var s = statement();
        statements.push(s);
      }
    }

    indents.pop();

    return Block.create(statements);
  }

  function statement() {
    if (has(Tokens.T)) {
      if (has(Tokens.Dot, 1)) {
        var e = expression();
        if (has(Tokens.Linebreak) || has(Tokens.EOF)) {
          consume();
          return e;
        } else {
          throw 'expected linebreak after t-expression';
        }
      } else {
        consume();
        if (has(Tokens.RightArrow)) {
          consume();
          var e = expression();
          if (has(Tokens.Linebreak)) {
            consume();
            var b = block();
            return StatementTo.create(e, b);
          } else if (has(Tokens.RightArrow)) {
            consume();
            if (has(Tokens.T)) {
              consume();
              if (has(Tokens.Linebreak)) {
                consume();
                var b = block();
                return StatementThrough.create(e, b);
              } else {
                throw 'expected linebreak after through';
              }
            } else {
              throw 'expected t on through';
            }
          } else {
            throw 'expected linebreak';
          }
        } else {
          throw 'expected ->';
        }
      }
    }

    else if (has(Tokens.With)) {
      consume(); // eat with
      var scope = expression();
      if (!has(Tokens.Linebreak)) {
        throw 'expected linebreak';
      }
      consume(); // eat linebreak
      var body = block();
      return StatementWith.create(scope, body);
    }
    
    // A statement that doesn't start with T.
    else {
      var e = expression();

      if (has(Tokens.RightArrow)) {
        var from = e;
        consume();
        if (has(Tokens.T)) {
          consume();
          if (has(Tokens.Linebreak)) {
            consume();
            var b = block();
            return StatementFrom.create(from, b);
          } else if (has(Tokens.RightArrow)) {
            consume();
            var to = expression();
            if (has(Tokens.Linebreak)) {
              consume();
              var b = block();
              return StatementBetween.create(from, to, b);
            } else {
              throw 'expected linebreak';
            }
          } else {
            throw 'expected linebreak';
          }
        } else {
          throw 'expected t' 
        }
      } else {
        if (has(Tokens.Linebreak)) {
          consume();
          return e;
        } else if (has(Tokens.EOF)) {
          return e;
        } else if (!has(Tokens.EOF)) {
          throw 'Expected linebreak or EOF but had ' + tokens[i].source;
        }
      }
    }
  }

  function expression() {
    return expressionAssignment();
  }

  function expressionAssignment() {
    var lhs = expressionAdditive(); 
    if (has(Tokens.Assign)) {
      consume();
      var rhs = expressionAssignment();
      lhs = ExpressionAssignment.create(lhs, rhs);
    }
    return lhs;
  }

  function expressionAdditive() {
    var a = expressionMultiplicative();
    while (has(Tokens.Plus) || has(Tokens.Minus)) {
      var operator = consume();
      var b = expressionMultiplicative();
      if (operator.type == Tokens.Plus) {
        a = ExpressionAdd.create(a, b);
      } else {
        a = ExpressionSubtract.create(a, b);
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
        a = ExpressionMultiply.create(a, b);
      } else if (operator.type == Tokens.ForwardSlash) {
        a = ExpressionDivide.create(a, b);
      } else {
        a = ExpressionRemainder.create(a, b);
      }
    }
    return a;
  }

  function expressionProperty() {
    var base = atom();
    while (has(Tokens.Dot)) {
      consume(); 
      var property = atom();
      base = ExpressionProperty.create(base, property);
    }
    return base;
  }

  function isFirstOfExpression(offset) {
    return has(Tokens.Integer, offset) ||
           has(Tokens.T, offset) ||
           has(Tokens.Identifier, offset) ||
           has(Tokens.Repeat, offset);
  }

  function atom() {
    if (has(Tokens.Integer)) {
      var token = consume();
      var ei = ExpressionInteger.create(Number(token.source));
      return ei;
    } else if (has(Tokens.Real)) {
      var token = consume();
      return ExpressionReal.create(Number(token.source));
    } else if (has(Tokens.LeftSquareBracket)) {
      consume(); // eat [
      var elements = [];
      while (!has(Tokens.RightSquareBracket)) {
        var e = expression();
        elements.push(e);
        if (!has(Tokens.RightSquareBracket)) {
          if (has(Tokens.Comma)) {
            consume(); // eat ,
          } else {
            throw 'bad bad bad';
          }
        }
      }
      consume(); // eat ]
      return ExpressionVector.create(elements);
    } else if (has(Tokens.Identifier) && has(Tokens.LeftParenthesis, 1)) {
      var name = consume().source;
      consume(); // eat (

      var actuals = [];
      if (isFirstOfExpression()) {
        actuals.push(expression());
        while (has(Tokens.Comma) && isFirstOfExpression(1)) {
          consume(); // eat ,
          actuals.push(expression());
        }
      }

      if (has(Tokens.RightParenthesis)) {
        consume();
      } else {
        throw 'Missing )';
      }

      return ExpressionFunctionCall.create(name, actuals);
    } else if (has(Tokens.Repeat)) {
      consume(); // eat repeat
      var count = expression();
      if (!has(Tokens.Linebreak)) {
        throw 'expected linebreak';
      }
      consume(); // eat linebreak
      var body = block();
      return ExpressionRepeat.create(count, body);
    } else if (has(Tokens.Identifier) || has(Tokens.T)) {
      var id = consume();
      return ExpressionIdentifier.create(id);
    } else {
      throw 'Don\'t know [' + tokens[i].source + ',' + tokens[i].type + ']';
    }
  }

  var ast = program();

  return ast;
}
