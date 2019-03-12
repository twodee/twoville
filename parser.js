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

    let sourceStart = null;
    let sourceEnd = null;
    if (statements.length > 0) {
      sourceStart = statements[0].sourceStart;
      sourceEnd = statements[statements.length - 1].sourceStart;
    }

    return new ExpressionBlock(sourceStart, sourceEnd, statements);
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
            return new StatementTo(e.sourceStart, b.sourceEnd, e, b);
          } else if (has(Tokens.RightArrow)) {
            consume();
            if (has(Tokens.T)) {
              consume();
              if (has(Tokens.Linebreak)) {
                consume();
                let b = block();
                return new StatementThrough(e.sourceStart, b.sourceEnd, e, b);
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
            return new StatementFrom(from.sourceStart, b.sourceEnd, from, b);
          } else if (has(Tokens.RightArrow)) {
            consume();
            let to = expression();
            if (has(Tokens.Linebreak)) {
              consume();
              let b = block();
              return new StatementBetween(from.sourceStart, b.sourceEnd, from, to, b);
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
      lhs = new ExpressionAssignment(lhs.sourceStart, rhs.sourceEnd, lhs, rhs);
    }
    return lhs;
  }

  function expressionAdditive() {
    let a = expressionMultiplicative();
    while (has(Tokens.Plus) || has(Tokens.Minus)) {
      let operator = consume();
      let b = expressionMultiplicative();
      if (operator.type == Tokens.Plus) {
        a = new ExpressionAdd(a.sourceStart, b.sourceEnd, a, b);
      } else {
        a = new ExpressionSubtract(a.sourceStart, b.sourceEnd, a, b);
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
        a = new ExpressionMultiply(a.sourceStart, b.sourceEnd, a, b);
      } else if (operator.type == Tokens.ForwardSlash) {
        a = new ExpressionDivide(a.sourceStart, b.sourceEnd, a, b);
      } else {
        a = new ExpressionRemainder(a.sourceStart, b.sourceEnd, a, b);
      }
    }
    return a;
  }

  function expressionProperty() {
    let base = atom();
    while (has(Tokens.Dot)) {
      consume(); 
      let property = atom();
      base = new ExpressionProperty(base.sourceStart, property.sourceEnd, base, property);
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
      return new ExpressionInteger(token.where, token.where, Number(token.source));
    } else if (has(Tokens.String)) {
      let token = consume();
      return new ExpressionString(token.where, token.where, token.source);
    } else if (has(Tokens.Real)) {
      let token = consume();
      return new ExpressionReal(token.where, token.where, Number(token.source));
    } else if (has(Tokens.Boolean)) {
      let token = consume();
      return new ExpressionBoolean(token.where, token.where, token.source == 'true');
    } else if (has(Tokens.For)) {
      let sourceStart = tokens[i].where;
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

            let by = new ExpressionInteger(null, null, 1);

            return new ExpressionFor(sourceStart, body.sourceEnd, j, start, stop, by, body);
          }
        }
      }
    } else if (has(Tokens.LeftSquareBracket)) {
      let sourceStart = tokens[i].where;
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
      let sourceEnd = tokens[i].where;
      consume(); // eat ]
      return new ExpressionVector(sourceStart, sourceEnd, elements);
    } else if (has(Tokens.Identifier) && has(Tokens.LeftParenthesis, 1)) {
      let sourceStart = tokens[i].where;

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

      let sourceEnd = tokens[i].where;
      if (has(Tokens.RightParenthesis)) {
        consume();
      } else {
        throw 'Missing )';
      }

      return new ExpressionFunctionCall(sourceStart, sourceEnd, name, actuals);
    } else if (has(Tokens.Repeat)) {
      let sourceStart = tokens[i].where;
      consume(); // eat repeat
      let count = expression();
      if (!has(Tokens.Linebreak)) {
        throw 'expected linebreak';
      }
      consume(); // eat linebreak
      let body = block();
      return new ExpressionRepeat(sourceStart, body.sourceEnd, count, body);
    } else if (has(Tokens.Identifier) || has(Tokens.T)) {
      let sourceStart = tokens[i].where;
      let id = consume();
      return new ExpressionIdentifier(sourceStart, sourceStart, id);
    } else if (has(Tokens.With)) {
      let sourceStart = tokens[i].where;
      consume(); // eat with
      let scope = expression();
      if (!has(Tokens.Linebreak)) {
        throw 'expected linebreak';
      }
      consume(); // eat linebreak
      let body = block();
      return new ExpressionWith(sourceStart, body.sourceEnd, scope, body);
    } else {
      throw 'Don\'t know [' + tokens[i].source + ',' + tokens[i].type + ']';
    }
  }

  let ast = program();

  return ast;
}
