import { Tokens } from './token.js';
import {
  ExpressionAdd,
  ExpressionAssignment,
  ExpressionBlock,
  ExpressionBoolean,
  ExpressionDivide,
  ExpressionFor,
  ExpressionFunctionCall,
  ExpressionIdentifier,
  ExpressionInteger,
  ExpressionMultiply,
  ExpressionProperty,
  ExpressionReal,
  ExpressionRemainder,
  ExpressionRepeat,
  ExpressionString,
  ExpressionSubtract,
  ExpressionVector,
  ExpressionWith,
  StatementTo,
  StatementThrough,
  StatementFrom,
  StatementBetween,
} from './ast.js';

export function parse(tokens) {
  let i = 0;
  let indents = [-1];

  function has(type, offset) {
    let index = i;
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
    let b = block();
    if (!has(Tokens.EOF)) {
      throw 'Expected EOF saw [' + tokens[i].type + '|' + tokens[i].source + ']';
    }
    return b;
  }

  function block() {
    if (!has(Tokens.Indentation)) {
      throw 'expected indent';
    }

    let indentation = tokens[i];

    if (indentation.source.length <= indents[indents.length - 1]) {
      throw 'not indented enough';
    }
    indents.push(indentation.source.length);

    let statements = [];
    while (has(Tokens.Indentation) && tokens[i].source.length == indentation.source.length) {
      consume(); // eat indentation
      if (has(Tokens.Linebreak)) {
        consume();
      } else if (!has(Tokens.EOF)) {
        let s = statement();
        statements.push(s);
      }
    }

    indents.pop();

    return ExpressionBlock.create(statements);
  }

  function statement() {
    if (has(Tokens.T)) {
      if (has(Tokens.Dot, 1)) {
        let e = expression();
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
          let e = expression();
          if (has(Tokens.Linebreak)) {
            consume();
            let b = block();
            return StatementTo.create(e, b);
          } else if (has(Tokens.RightArrow)) {
            consume();
            if (has(Tokens.T)) {
              consume();
              if (has(Tokens.Linebreak)) {
                consume();
                let b = block();
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
    
    // A statement that doesn't start with T.
    else {
      let e = expression();

      if (has(Tokens.RightArrow)) {
        let from = e;
        consume();
        if (has(Tokens.T)) {
          consume();
          if (has(Tokens.Linebreak)) {
            consume();
            let b = block();
            return StatementFrom.create(from, b);
          } else if (has(Tokens.RightArrow)) {
            consume();
            let to = expression();
            if (has(Tokens.Linebreak)) {
              consume();
              let b = block();
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
        } else if (has(Tokens.EOF) || has(Tokens.Indentation)) { // Check for indentation because some expressions end in blocks, which have eaten their linebreak already
          return e;
        } else if (!has(Tokens.EOF)) {
          throw 'Expected linebreak or EOF but had "' + tokens[i].source + '" (' + tokens[i].type + ')';
        }
      }
    }
  }

  function expression() {
    return expressionAssignment();
  }

  function expressionAssignment() {
    let lhs = expressionAdditive(); 
    if (has(Tokens.Assign)) {
      consume();
      let rhs = expressionAssignment();
      lhs = ExpressionAssignment.create(lhs, rhs);
    }
    return lhs;
  }

  function expressionAdditive() {
    let a = expressionMultiplicative();
    while (has(Tokens.Plus) || has(Tokens.Minus)) {
      let operator = consume();
      let b = expressionMultiplicative();
      if (operator.type == Tokens.Plus) {
        a = ExpressionAdd.create(a, b);
      } else {
        a = ExpressionSubtract.create(a, b);
      }
    }
    return a;
  }

  function expressionMultiplicative() {
    let a = expressionProperty();
    while (has(Tokens.Asterisk) || has(Tokens.ForwardSlash) || has(Tokens.Percent)) {
      let operator = consume();
      let b = expressionProperty();
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
    let base = atom();
    while (has(Tokens.Dot)) {
      consume(); 
      let property = atom();
      base = ExpressionProperty.create(base, property);
    }
    return base;
  }

  function isFirstOfExpression(offset = 0) {
    return has(Tokens.Integer, offset) ||
           has(Tokens.T, offset) ||
           has(Tokens.Boolean, offset) ||
           has(Tokens.String, offset) ||
           has(Tokens.Identifier, offset) ||
           has(Tokens.LeftSquareBracket, offset) ||
           has(Tokens.Repeat, offset) ||
           has(Tokens.For, offset);
  }

  function atom() {
    if (has(Tokens.Integer)) {
      let token = consume();
      return ExpressionInteger.create(Number(token.source));
    } else if (has(Tokens.String)) {
      let token = consume();
      return ExpressionString.create(token.source);
    } else if (has(Tokens.Real)) {
      let token = consume();
      return ExpressionReal.create(Number(token.source));
    } else if (has(Tokens.Boolean)) {
      let token = consume();
      return ExpressionBoolean.create(token.source == 'true');
    } else if (has(Tokens.For)) {
      consume();
      if (isFirstOfExpression()) {
        let j = expression();
        if (has(Tokens.From) && isFirstOfExpression(1)) {
          consume();
          let start = expression();
          if (has(Tokens.To) && isFirstOfExpression(1)) {
            consume();
            let stop = expression();

            if (!has(Tokens.Linebreak)) {
              throw 'expected linebreak';
            }
            consume(); // eat linebreak
            let body = block();

            let by = ExpressionInteger.create(1);

            return ExpressionFor.create(j, start, stop, by, body);
          }
        }
      }
    } else if (has(Tokens.LeftSquareBracket)) {
      consume(); // eat [
      let elements = [];
      while (!has(Tokens.RightSquareBracket)) {
        let e = expression();
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
      let name = consume().source;
      consume(); // eat (

      let actuals = [];
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
      let count = expression();
      if (!has(Tokens.Linebreak)) {
        throw 'expected linebreak';
      }
      consume(); // eat linebreak
      let body = block();
      return ExpressionRepeat.create(count, body);
    } else if (has(Tokens.Identifier) || has(Tokens.T)) {
      let id = consume();
      return ExpressionIdentifier.create(id);
    } else if (has(Tokens.With)) {
      consume(); // eat with
      let scope = expression();
      if (!has(Tokens.Linebreak)) {
        throw 'expected linebreak';
      }
      consume(); // eat linebreak
      let body = block();
      return ExpressionWith.create(scope, body);
    } else {
      throw 'Don\'t know [' + tokens[i].source + ',' + tokens[i].type + ']';
    }
  }

  let ast = program();

  return ast;
}
