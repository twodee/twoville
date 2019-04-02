import {
  Tokens,
  SourceLocation
} from './token.js';

import {
  LocatedException,
  MessagedException,
} from './types.js';

import {
  ExpressionAdd,
  ExpressionAssignment,
  ExpressionBlock,
  ExpressionBoolean,
  ExpressionDivide,
  ExpressionFor,
  ExpressionFunctionCall,
  ExpressionFunctionDefinition,
  ExpressionIdentifier,
  ExpressionIf,
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
  let symbols = {
    ':clockwise': new ExpressionInteger(0),
    ':counterclockwise': new ExpressionInteger(1),

    // for alignment-baseline on text elements
    // See https://vanseodesign.com/web-design/svg-text-baseline-alignment for semantics.
    ':top': new ExpressionString('hanging'),
    ':center': new ExpressionString('middle'),
    ':bottom': new ExpressionString('baseline'),

    ':start': new ExpressionString('start'),
    ':middle': new ExpressionString('middle'),
    ':end': new ExpressionString('end'),

    // TODO colors

    ':absolute': new ExpressionInteger(0),
    ':relative': new ExpressionInteger(1),

    // Polygon
    ':open': new ExpressionInteger(0),
    ':closed': new ExpressionInteger(1),
  };

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
    if (has(Tokens.Indentation) && tokens[i].source.length != 0) {
      throw new LocatedException(tokens[i].where, 'I expected no indentation at the top-level of the program.');
    }

    let b = block();
    if (!has(Tokens.EOF)) {
      throw new LocatedException(b.where, 'I expected the program to end after this, but it didn\'t.');
    }
    return b;
  }

  function block() {
    if (!has(Tokens.Indentation)) {
      throw new LocatedException(tokens[i].where, 'I expected the code to be indented here, but it wasn\'t.');
    }

    let indentation = tokens[i];

    if (indentation.source.length <= indents[indents.length - 1]) {
      throw new LocatedException(indentation.where, 'I expected the indentation to increase upon entering a block.');
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

    if (tokens[i].source.length > indentation.source.length) {
      throw new LocatedException(tokens[i].where, `I expected consistent indentation within this block (which is indented with ${indentation.source.length} character${indentation.source.length == 1 ? '' : 's'}), but this indentation jumps around.`);
    }

    indents.pop();

    let sourceStart = indentation.where;
    let sourceEnd = sourceStart;
    if (statements.length > 0) {
      sourceStart = statements[0].where;
      sourceEnd = statements[statements.length - 1].where;
    }

    return new ExpressionBlock(statements, SourceLocation.span(sourceStart, sourceEnd));
  }

  function statement() {
    if (has(Tokens.T)) {
      let firstT = tokens[i];
      consume();
      if (has(Tokens.RightArrow)) { // t ->
        consume();
        let e = expression();
        if (has(Tokens.Linebreak)) { // t -> 10
          consume();
          let b = block();
          return new StatementTo(SourceLocation.span(e.where, b.where), e, b);
        } else if (has(Tokens.RightArrow)) { // t -> 10 ->
          let arrow = tokens[i];
          consume();
          if (has(Tokens.T)) {
            let secondT = tokens[i];
            consume();
            if (has(Tokens.Linebreak)) {
              consume();
              let b = block();
              return new StatementThrough(SourceLocation.span(e.where, b.where), e, b);
            } else {
              throw new LocatedException(SourceLocation.span(firstT.where, secondT.where), 'I expected a linebreak after this time interval.');
            }
          } else {
            throw new LocatedException(SourceLocation.span(firstT.where, arrow.where), 'I expected a second t in this through-interval.');
          }
        } else {
          throw new LocatedException(SourceLocation.span(firstT.where, e.where), 'I expected either a to-interval or a through-interval, but that\'s not what I found.');
        }
      } else {
        throw new LocatedException(firstT.where, 'I expected either a to-interval or a through-interval, but that\'s not what I found.');
      }
    }
    
    // A statement that doesn't start with T.
    else {
      let e = expression();

      if (has(Tokens.RightArrow)) {
        let arrow = tokens[i].where;
        let from = e;
        consume();
        if (has(Tokens.T)) {
          let t = tokens[i];
          consume();
          if (has(Tokens.Linebreak)) { // 10 -> t
            consume();
            let b = block();
            return new StatementFrom(SourceLocation.span(from.where, b.where), from, b);
          } else if (has(Tokens.RightArrow)) { // 10 -> t -> 20
            consume();
            let to = expression();
            if (has(Tokens.Linebreak)) {
              consume();
              let b = block();
              return new StatementBetween(SourceLocation.span(from.where, b.where), from, to, b);
            } else {
              throw new LocatedException(SourceLocation.span(from.where, to.where), 'I expected either a line break after this interval.');
            }
          } else {
            throw new LocatedException(SourceLocation.span(e.where, t.where), 'I expected either a from-interval or a between-interval, but that\'s not what I found.');
          }
        } else {
          throw new LocatedException(SourceLocation.span(e.where, arrow.where), 'I expected either a from-interval or a between-interval, but that\'s not what I found.');
        }
      } else {
        if (has(Tokens.Linebreak)) {
          consume();
          return e;
        } else if (has(Tokens.EOF) || has(Tokens.Indentation)) { // Check for indentation because some expressions end in blocks, which have eaten their linebreak already
          return e;
        } else if (!has(Tokens.EOF)) {
          throw new LocatedException(tokens[i].where, 'I expected a line break or the end the program, but that\'s not what I found.');
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
      lhs = new ExpressionAssignment(lhs, rhs, SourceLocation.span(lhs.where, rhs.where));
    }
    return lhs;
  }

  function expressionAdditive() {
    let a = expressionMultiplicative();
    while (has(Tokens.Plus) || has(Tokens.Minus)) {
      let operator = consume();
      let b = expressionMultiplicative();
      if (operator.type == Tokens.Plus) {
        a = new ExpressionAdd(a, b, SourceLocation.span(a.where, b.where));
      } else {
        a = new ExpressionSubtract(a, b, SourceLocation.span(a.where, b.where));
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
        a = new ExpressionMultiply(a, b, SourceLocation.span(a.where, b.where));
      } else if (operator.type == Tokens.ForwardSlash) {
        a = new ExpressionDivide(a, b, SourceLocation.span(a.where, b.where));
      } else {
        a = new ExpressionRemainder(a, b, SourceLocation.span(a.where, b.where));
      }
    }
    return a;
  }

  function expressionProperty() {
    let base = atom();
    while (has(Tokens.Dot)) {
      consume(); 
      let property = atom();
      base = new ExpressionProperty(base, property, SourceLocation.span(base.where, property.where));
    }
    return base;
  }

  function isFirstOfExpression(offset = 0) {
    return has(Tokens.Integer, offset) ||
           has(Tokens.Real, offset) ||
           has(Tokens.T, offset) ||
           has(Tokens.Boolean, offset) ||
           has(Tokens.Symbol, offset) ||
           has(Tokens.String, offset) ||
           has(Tokens.Identifier, offset) ||
           has(Tokens.LeftSquareBracket, offset) ||
           has(Tokens.Repeat, offset) ||
           has(Tokens.For, offset) ||
           has(Tokens.If, offset);
  }

  function atom() {
    if (has(Tokens.Integer)) {
      let token = consume();
      return new ExpressionInteger(Number(token.source), token.where);
    } else if (has(Tokens.Symbol)) {
      let token = consume();
      if (symbols.hasOwnProperty(token.source)) {
        let e = symbols[token.source].clone();
        e.where = token.where;
        return e;
      } else {
        throw new LocatedException(token.where, `I don't recognize the symbol "${token.source}".`);
      }
    } else if (has(Tokens.String)) {
      let token = consume();
      return new ExpressionString(token.source, token.where);
    } else if (has(Tokens.Real)) {
      let token = consume();
      return new ExpressionReal(Number(token.source), token.where);
    } else if (has(Tokens.Boolean)) {
      let token = consume();
      return new ExpressionBoolean(token.source == 'true', token.where);
    } else if (has(Tokens.To)) {
      let sourceStart = tokens[i].where;
      consume(); // eat if

      if (!has(Tokens.Identifier)) {
        throw new LocatedException(tokens[i].where, 'I expected a function name after to.');
      }
      let idToken = tokens[i];
      consume();

      if (!has(Tokens.LeftParenthesis)) {
        throw new LocatedException(tokens[i].where, 'I expected a left parenthesis after a function\'s name.');
      }
      consume();

      // Parse formals.
      let formals = [];
      if (has(Tokens.Identifier)) {
        formals.push(tokens[i].source);
        consume();

        while (has(Tokens.Comma)) {
          consume(); // eat comma
          if (has(Tokens.Identifier)) {
            formals.push(tokens[i].source);
            consume();
          } else {
            throw new LocatedException(tokens[i].where, 'I expected a parameter name after a comma in the parameter list.');
          }
        }
      }

      if (!has(Tokens.RightParenthesis)) {
        throw new LocatedException(tokens[i].where, 'I expected a right parenthesis after a function\'s parameter list.');
      }
      consume();

      if (!has(Tokens.Linebreak)) {
        throw new LocatedException(tokens[i].where, 'I expected a linebreak after a function header.');
      }
      consume();

      let body = block();

      return new ExpressionFunctionDefinition(idToken.source, formals, body, SourceLocation.span(sourceStart, body.where));

    } else if (has(Tokens.If)) {
      let sourceStart = tokens[i].where;
      let sourceEnd = sourceStart;
      consume(); // eat if

      let conditions = [];
      let thenBlocks = [];
      let elseBlock = null;

      if (isFirstOfExpression()) {
        let condition = expression();

        if (!has(Tokens.Linebreak)) {
          throw new LocatedException(condition.where, 'I expected a linebreak after this if\'s condition.');
        }
        consume(); // eat linebreak
        let thenBlock = block();

        conditions.push(condition);
        thenBlocks.push(thenBlock);
        sourceEnd = thenBlock.where;
      }

      while (has(Tokens.Indentation) && indents[indents.length - 1] == tokens[i].source.length && has(Tokens.ElseIf, 1)) {
        consume(); // eat indent
        let elseIfToken = tokens[i];
        consume(); // eat else if

        if (!isFirstOfExpression()) {
          throw new LocatedException(elseIfToken.where, 'I expected a condition after this else-if.');
        }

        let condition = expression();

        if (!has(Tokens.Linebreak)) {
          throw new LocatedException(condition.where, 'I expected a linebreak after this if\'s condition.');
        }
        consume(); // eat linebreak
        let thenBlock = block();

        conditions.push(condition);
        thenBlocks.push(thenBlock);
        sourceEnd = thenBlock.where;
      }

      if (conditions.length == 0) {
        throw new LocatedException(sourceStart, 'I expected this if statement to have at least one condition.');
      }
      
      if (has(Tokens.Indentation) && indents[indents.length - 1] == tokens[i].source.length && has(Tokens.Else, 1)) {
        consume(); // eat indentation
        let elseToken = consume(); // eat else
        if (!has(Tokens.Linebreak)) {
          throw new LocatedException(elseToken.where, 'I expected a linebreak after this if\'s else.');
        }
        consume(); // TODO linebreak
        elseBlock = block();
        sourceEnd = elseBlock.where;
      }

      return new ExpressionIf(conditions, thenBlocks, elseBlock, SourceLocation.span(sourceStart, sourceEnd));
    } else if (has(Tokens.For)) {
      let sourceStart = tokens[i].where;
      consume();
      if (isFirstOfExpression()) {
        let j = expression();

        // for i in 0..10
        // for i to 10
        // for i through 10

        let start;
        let stop;
        let by;
        
        if (has(Tokens.In)) {
          consume(); // eat in
          start = expression();
          if (has(Tokens.Range)) {
            consume(); // eat ..
            stop = expression();
            stop = new ExpressionAdd(new ExpressionInteger(1), stop);
          } else {
            throw new LocatedException(SourceLocation.span(sourceStart, start.where), 'I expected the range operator .. in a for-in loop.');
          }
        } else if (has(Tokens.To)) {
          consume(); // eat to
          start = new ExpressionInteger(0);
          stop = expression();
        } else if (has(Tokens.Through)) {
          consume(); // eat through
          start = new ExpressionInteger(0);
          stop = expression();
          stop = new ExpressionAdd(new ExpressionInteger(1), stop);
        } else {
          throw new LocatedException(sourceStart, 'I expected one of to, through, or in to specify the for loop\'s range.');
        }

        if (has(Tokens.By)) {
          consume(); // eat by
          by = expression();
        } else {
          by = new ExpressionInteger(1);
        }

        if (!has(Tokens.Linebreak)) {
          throw new LocatedException(SourceLocation.span(sourceStart, stop.where), 'I expected a linebreak after this loop\'s range.');
        }
        consume(); // eat linebreak
        let body = block();

        return new ExpressionFor(j, start, stop, by, body, SourceLocation.span(sourceStart, body.where));
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
            throw new LocatedException(SourceLocation.span(e.where, tokens[i].where), 'I expected a comma between vector elements.');
          }
        }
      }
      let sourceEnd = tokens[i].where;
      consume(); // eat ]
      return new ExpressionVector(elements, SourceLocation.span(sourceStart, sourceEnd));
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
        throw new LocatedException(SourceLocation.span(sourceStart, sourceEnd), `I expected a right parenthesis to close the function call, but I encountered "${tokens[i].source}" (${tokens[i].type}) instead.`);
      }

      return new ExpressionFunctionCall(name, actuals, SourceLocation.span(sourceStart, sourceEnd));
    } else if (has(Tokens.Repeat)) {
      let sourceStart = tokens[i].where;
      consume(); // eat repeat
      let count = expression();
      if (!has(Tokens.Linebreak)) {
        throw new LocatedException(SourceLocation.span(sourceStart, count.where), 'I expected a linebreak after this repeat\'s count.');
      }
      consume(); // eat linebreak
      let body = block();
      return new ExpressionRepeat(count, body, SourceLocation.span(sourceStart, body.where));
    } else if (has(Tokens.Identifier) || has(Tokens.T)) {
      let where = tokens[i].where;
      let id = consume();
      return new ExpressionIdentifier(id, where);
    } else if (has(Tokens.With)) {
      let sourceStart = tokens[i].where;
      consume(); // eat with
      let scope = expression();
      if (!has(Tokens.Linebreak)) {
        throw new LocatedException(SourceLocation.span(sourceStart, scope.where), 'I expected a linebreak after this with statement\'s scope expression.');
      }
      consume(); // eat linebreak
      let body = block();
      return new ExpressionWith(scope, body, SourceLocation.span(sourceStart, body.where));
    } else {
      if (!has(Tokens.Linebreak)) {
        throw new LocatedException(tokens[i].where, `I don't know what "${tokens[i].source}" means here.`);
      }
    }
  }

  let ast = program();

  return ast;
}
