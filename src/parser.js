import {
  Tokens,
  SourceLocation,
  LocatedException,
  MessagedException,
} from './common.js';

import {
  Symbol,
} from './symbol.js';

import {
  ExpressionAdd,
  ExpressionAnd,
  ExpressionAssignment,
  ExpressionBlock,
  ExpressionBoolean,
  ExpressionCharacter,
  ExpressionDitto,
  ExpressionDivide,
  ExpressionDistributedIdentifier,
  ExpressionFor,
  ExpressionForArray,
  ExpressionFunctionCall,
  ExpressionFunctionDefinition,
  ExpressionMore,
  ExpressionMoreEqual,
  ExpressionIdentifier,
  ExpressionIf,
  ExpressionInteger,
  ExpressionLess,
  ExpressionLessEqual,
  ExpressionMemberFunctionCall,
  ExpressionMemberIdentifier,
  ExpressionMultiply,
  ExpressionNegative,
  ExpressionNotSame,
  ExpressionNot,
  ExpressionOr,
  ExpressionPower,
  ExpressionReal,
  ExpressionRemainder,
  ExpressionRepeat,
  ExpressionRepeatAround,
  ExpressionSame,
  ExpressionString,
  ExpressionSubscript,
  ExpressionSubtract,
  ExpressionUnit,
  ExpressionVector,
  ExpressionWith,
  StatementBetween,
  StatementFrom,
  StatementFromStasis,
  StatementTo,
  StatementToStasis,
  StatementThrough,
  StatementThroughStasis,
} from './ast.js';

export function parse(tokens, source) {

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

    let b;
    if (has(Tokens.EOF)) {
      let eofToken = consume();
      b = new ExpressionBlock([], eofToken.where);
    } else {
      b = block();
      if (!has(Tokens.EOF)) {
        throw new LocatedException(b.where, 'I expected the program to end after this, but it didn\'t.');
      }
    }

    return b;
  }

  function block() {
    if (!has(Tokens.Indentation)) {
      throw new LocatedException(tokens[i].where, 'I expected the code to be indented here, but it wasn\'t.');
    }

    let indentation = tokens[i];

    if (indentation.source.length <= indents[indents.length - 1]) {
      if (has(Tokens.Linebreak, 1) || has(Tokens.EOF, 1)) {
        throw new LocatedException(indentation.where, 'I found an empty block, but those are forbidden.');
      } else {
        throw new LocatedException(indentation.where, 'I expected the indentation to increase upon entering a block.');
      }
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

  function parseTimeframes() {
    // Read timeframe headers. There may be 0 or many. Stop reading right
    // before the following block.
    const timeframes = [];
    let hasSameIndentation;

    do {
      if (has(Tokens.T)) {
        let firstT = tokens[i];
        consume();
        if (has(Tokens.RightArrow)) { // t ->
          consume();
          let e = expression();

          if (has(Tokens.Linebreak)) { // t -> 10
            consume();
            timeframes.push(b => new StatementTo(e, b, SourceLocation.span(e.where, b.where)));
          }

          else if (has(Tokens.RightArrow)) { // t -> 10 ->
            let arrow = tokens[i];
            consume();
            if (has(Tokens.T)) {
              let secondT = tokens[i];
              consume();
              if (has(Tokens.Linebreak)) {
                consume();
                timeframes.push(b => new StatementThrough(e, b, SourceLocation.span(firstT.where, b.where)));
              } else {
                throw new LocatedException(SourceLocation.span(firstT.where, secondT.where), 'I expected a linebreak after this time interval.');
              }
            } else {
              let e2 = expression();
              if (has(Tokens.Linebreak)) {
                consume();
                timeframes.push(b => new StatementToStasis(e, e2, b, SourceLocation.span(firstT.where, b.where)));
              } else if (has(Tokens.RightArrow)) {
                // TODO check for other things
                consume(); // eat arrow
                if (has(Tokens.T)) {
                  consume(); // eat t
                  if (has(Tokens.Linebreak)) {
                    consume(); // eat linebreak
                    timeframes.push(b => new StatementThroughStasis(e, e2, b, SourceLocation.span(firstT.where, b.where)));
                  }
                }
              } else {
                throw new LocatedException(SourceLocation.span(firstT.where, secondT.where), 'I expected a linebreak after this time interval.');
              }
              // throw new LocatedException(SourceLocation.span(firstT.where, arrow.where), 'I expected a second t in this through-interval.');
            }
          } else {
            throw new LocatedException(SourceLocation.span(firstT.where, e.where), 'I expected either a to-interval or a through-interval, but that\'s not what I found.');
          }
        } else {
          throw new LocatedException(firstT.where, 'I expected either a to-interval or a through-interval, but that\'s not what I found.');
        }
      } else if (isFirstOfExpression()) {
        let indexBeforeExpression = i;
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
              timeframes.push(b => new StatementFrom(from, b, SourceLocation.span(from.where, b.where)));
            } else if (has(Tokens.RightArrow)) { // 10 -> t -> 20
              consume();
              let to = expression();
              if (has(Tokens.Linebreak)) {
                consume();
                timeframes.push(b => new StatementBetween(from, to, b, SourceLocation.span(from.where, b.where)));
              } else {
                throw new LocatedException(SourceLocation.span(from.where, to.where), 'I expected a linebreak after this interval.');
              }
            } else {
              throw new LocatedException(SourceLocation.span(e.where, t.where), 'I expected either a from-interval or a between-interval, but that\'s not what I found.');
            }
          } else if (isFirstOfExpression()) {
            let to = expression();
            if (has(Tokens.RightArrow)) { // 10 -> 20 ->
              consume();
              if (has(Tokens.T)) {
                consume();
                if (has(Tokens.Linebreak)) {
                  consume();
                  timeframes.push(b => new StatementFromStasis(from, to, b, SourceLocation.span(from.where, b.where)));
                } else {
                  throw new LocatedException(SourceLocation.span(from.where, to.where), 'I expected a linebreak after this interval.');
                }
              } else {
                throw new LocatedException(SourceLocation.span(from.where, to.where), 'I expected a from-stasis-interval, but that\'s not what I found.');
              }
            } else {
              throw new LocatedException(SourceLocation.span(from.where, to.where), 'I expected a from-stasis-interval, but that\'s not what I found.');
            }
          } else {
            throw new LocatedException(SourceLocation.span(e.where, arrow.where), 'I expected either a from-interval or a between-interval, but that\'s not what I found.');
          }
        } else if (timeframes.length > 0) {
          // This isn't a timeframe header, but it's at the same indentation as a preceding timeframe header.
          // throw
        } else {
          // This isn't a time block.
          i = indexBeforeExpression;
          break;
        }
      }

      // If next line has the same indentation as this one, we assume that it
      // was meant to be another timeframe header.
      hasSameIndentation = has(Tokens.Indentation) && tokens[i].source.length === indents[indents.length - 1];
      if (hasSameIndentation) {
        consume(); // eat indentation
      }
    } while (hasSameIndentation);

    return timeframes;
  }

  function statement() {
    const timeframes = parseTimeframes();
    
    // If there were no timeframes, then the statement must just be a simple
    // expression.
    if (timeframes.length === 0) {
      let e = expression();
      if (has(Tokens.Linebreak)) {
        consume();

        // If it has more indentation, read it as a block and make a with.
        if (has(Tokens.Indentation) && tokens[i].source.length > indents[indents.length - 1]) {
          const scope = e;
          const body = block();
          return new ExpressionWith(scope, body, SourceLocation.span(scope.where, body.where));
        } else {
          return e;
        }
      } else if (has(Tokens.EOF) || has(Tokens.Indentation)) { // Check for indentation because some expressions end in blocks, which have eaten their linebreak already
        return e;
      } else if (has(Tokens.Comma)) {
        throw new LocatedException(tokens[i].where, `I found a comma in a strange place. They only appear in lists, function calls, and function headers, but this code isn't any of those. Either you meant it to be or you have a stray comma.`);
      } else if (!has(Tokens.EOF)) {
        throw new LocatedException(tokens[i].where, `I ran into a stray <var>${tokens[i].source}</var>, and I'm not sure what to do with that.`);
      }
    }

    // If there were timeframes, we need to turn them into time statements and
    // attach the succeeding block.
    else {
      const b = block();
      const statements = timeframes.map(timeframe => timeframe(b));
      if (statements.length === 1) {
        return statements[0];
      } else {
        return new ExpressionBlock(statements, SourceLocation.span(statements[0].where, statements[statements.length - 1].where));
      }
    }
  }

  function expression() {
    return expressionAssignment();
  }

  function expressionAssignment() {
    // TODO array assignment? multi assignment?
    let lhs = expressionOr();
    if (has(Tokens.Assign)) {
      consume();
      let rhs = expressionAssignment();
      lhs = new ExpressionAssignment(lhs, rhs, SourceLocation.span(lhs.where, rhs.where));
    }
    return lhs;
  }

  function expressionOr() {
    let a = expressionAnd();
    while (has(Tokens.Or)) {
      consume(); // eat or
      let b = expressionAnd();
      a = new ExpressionOr(a, b, SourceLocation.span(a.where, b.where));
    }
    return a;
  }

  function expressionAnd() {
    let a = expressionEquality();
    while (has(Tokens.And)) {
      consume(); // eat and
      let b = expressionEquality();
      a = new ExpressionAnd(a, b, SourceLocation.span(a.where, b.where));
    }
    return a;
  }

  function expressionEquality() {
    let a = expressionRelational();
    while (has(Tokens.Same) || has(Tokens.NotSame)) {
      let operator = consume();
      let b = expressionRelational();
      if (operator.type === Tokens.Same) {
        a = new ExpressionSame(a, b, SourceLocation.span(a.where, b.where));
      } else {
        a = new ExpressionNotSame(a, b, SourceLocation.span(a.where, b.where));
      }
    }
    return a;
  }

  function expressionRelational() {
    let a = expressionAdditive();
    while (has(Tokens.Less) || has(Tokens.More) || has(Tokens.MoreEqual) || has(Tokens.LessEqual)) {
      let operator = consume();
      let b = expressionAdditive();
      if (operator.type === Tokens.Less) {
        a = new ExpressionLess(a, b, SourceLocation.span(a.where, b.where));
      } else if (operator.type === Tokens.LessEqual) {
        a = new ExpressionLessEqual(a, b, SourceLocation.span(a.where, b.where));
      } else if (operator.type === Tokens.More) {
        a = new ExpressionMore(a, b, SourceLocation.span(a.where, b.where));
      } else {
        a = new ExpressionMoreEqual(a, b, SourceLocation.span(a.where, b.where));
      }
    }
    return a;
  }

  function expressionAdditive() {
    let a = expressionMultiplicative();
    while (has(Tokens.Plus) || has(Tokens.Minus)) {
      let operator = consume();
      let b = expressionMultiplicative();
      if (operator.type === Tokens.Plus) {
        a = new ExpressionAdd(a, b, SourceLocation.span(a.where, b.where));
      } else {
        a = new ExpressionSubtract(a, b, SourceLocation.span(a.where, b.where));
      }
    }
    return a;
  }

  function expressionMultiplicative() {
    let a = expressionUnary();
    while (has(Tokens.Asterisk) || has(Tokens.ForwardSlash) || has(Tokens.Percent)) {
      let operator = consume();
      let b = expressionUnary();
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

  function expressionUnary() {
    let a;
    if (has(Tokens.Minus)) {
      const negativeToken = consume(); // eat -
      a = expressionUnary();
      a = new ExpressionNegative(a, SourceLocation.span(negativeToken.where, a.where));
    } else if (has(Tokens.Not)) {
      consume(); // eat !
      a = expressionUnary();
      a = new ExpressionNot(a, a.where);
    } else {
      a = expressionPower();
    }
    return a;
  }

  function expressionPower() {
    let a = expressionMember();
    while (has(Tokens.Circumflex)) {
      let operator = consume();
      let b = expressionMember();
      a = new ExpressionPower(a, b, SourceLocation.span(a.where, b.where));
    }
    return a;
  }

  function expressionMember() {
    let base = atom();
    while (has(Tokens.Dot) || has(Tokens.Distribute) || has(Tokens.LeftSquareBracket)) {
      if (has(Tokens.Dot)) {
        let dotToken = consume(); // eat .

        if (!has(Tokens.Identifier)) {
          throw new LocatedException(dotToken.where, `expected ID`);
        }

        let nameToken = consume();

        if (has(Tokens.LeftParenthesis)) {
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
          if (!has(Tokens.RightParenthesis)) {
            throw new LocatedException(SourceLocation.span(sourceStart, sourceEnd), `I expected a right parenthesis to close the function call, but I encountered "${tokens[i].source}" (${tokens[i].type}) instead.`);
          }
          consume();

          base = new ExpressionMemberFunctionCall(base, nameToken, actuals, SourceLocation.span(base.where, sourceEnd));
        } else {
          base = new ExpressionMemberIdentifier(base, nameToken, SourceLocation.span(base.where, nameToken.where));
        }
      } else if (has(Tokens.Distribute)) {
        let hashToken = consume(); // eat #

        if (!has(Tokens.Identifier)) {
          throw new LocatedException(hashToken.where, `expected ID`);
        }

        let nameToken = consume();
        base = new ExpressionDistributedIdentifier(base, nameToken, SourceLocation.span(base.where, nameToken.where));
      } else {
        consume(); // eat [
        let index = expression();
        if (!has(Tokens.RightSquareBracket)) {
          throw new LocatedException(SourceLocation.span(base.where, index.where), `I found some code that looked like a subscript expression, and I expected to find a <var>]</var> to close it off. But that's not what I found. Either this code isn't really a subscript or it's missing a <var>]</var>.`);
        }
        let rightBracketToken = consume(); // eat ]
        base = new ExpressionSubscript(base, index, SourceLocation.span(base.where, rightBracketToken.where));
      }
    }
    return base;
  }

  function isFirstOfExpression(offset = 0) {
    return has(Tokens.Integer, offset) ||
           has(Tokens.Real, offset) ||
           has(Tokens.T, offset) ||
           has(Tokens.Minus, offset) ||
           has(Tokens.Boolean, offset) ||
           has(Tokens.Symbol, offset) ||
           has(Tokens.String, offset) ||
           has(Tokens.Identifier, offset) ||
           has(Tokens.LeftSquareBracket, offset) ||
           has(Tokens.LeftParenthesis, offset) ||
           has(Tokens.Repeat, offset) ||
           has(Tokens.For, offset) ||
           has(Tokens.If, offset);
  }

  function atom() {
    if (has(Tokens.Integer)) {
      let token = consume();
      return new ExpressionInteger(Number(token.source), token.where);
    } else if (has(Tokens.LeftParenthesis)) {
      let leftToken = consume();
      let a = expression();
      a.isLocked = true;
      if (has(Tokens.RightParenthesis)) {
        let rightToken = consume();
        a.where = SourceLocation.span(leftToken.where, rightToken.where);
        return a;
      } else {
        throw new LocatedException(SourceLocation.span(leftToken.where, a.where), 'I expected a right parenthesis after this expression.');
      }
    } else if (has(Tokens.Tilde)) {
      const token = consume(); // eat ~
      return new ExpressionDitto(token.where);
    } else if (has(Tokens.Symbol)) {
      let token = consume();
      if (Symbol.hasOwnProperty(token.source)) {
        let e = Symbol[token.source].clone();
        e.where = token.where;
        return e;
      } else {
        throw new LocatedException(token.where, `I don't recognize the symbol "${token.source}".`);
      }
    } else if (has(Tokens.String)) {
      let token = consume();
      return new ExpressionString(token.source, token.where);
    } else if (has(Tokens.Character)) {
      let token = consume();
      return new ExpressionCharacter(token.source, token.where);
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

      let body;
      if (has(Tokens.Assign)) {
        consume();
        body = statement();
      } else {
        if (!has(Tokens.Linebreak)) {
          throw new LocatedException(tokens[i].where, 'I expected a linebreak after a function header.');
        }
        consume();
        body = block();
      }

      return new ExpressionFunctionDefinition(idToken.source, formals, body, SourceLocation.span(sourceStart, body.where));

    } else if (has(Tokens.If)) {
      let sourceStart = tokens[i].where;
      let sourceEnd = sourceStart;
      consume(); // eat if

      let conditions = [];
      let thenBlocks = [];
      let elseBlock = null;
      let isOneLiner;

      if (isFirstOfExpression()) {
        let condition = expression();

        let thenBlock;
        if (has(Tokens.Linebreak)) {
          consume(); // eat linebreak
          thenBlock = block();
          isOneLiner = false;
        } else if (has(Tokens.Then)) {
          consume(); // eat then
          thenBlock = expression();
          isOneLiner = true;
        } else {
          throw new LocatedException(sourceStart, 'I expected either a linebreak or then after the condition.');
        }

        conditions.push(condition);
        thenBlocks.push(thenBlock);
        sourceEnd = thenBlock.where;
      } else {
        throw new LocatedException(sourceStart, 'I expected a condition for this if.');
      }

      while ((isOneLiner && has(Tokens.ElseIf)) ||
             (!isOneLiner && has(Tokens.Indentation) && indents[indents.length - 1] == tokens[i].source.length && has(Tokens.ElseIf, 1))) {
        if (!isOneLiner) {
          consume(); // eat indent
        }
        let elseIfToken = tokens[i];
        consume(); // eat else if

        if (!isFirstOfExpression()) {
          throw new LocatedException(elseIfToken.where, 'I expected a condition after this else-if.');
        }

        let condition = expression();

        let thenBlock;
        if (has(Tokens.Linebreak)) {
          consume(); // eat linebreak
          thenBlock = block();
          isOneLiner = false;
        } else if (has(Tokens.Then)) {
          consume(); // eat then
          thenBlock = expression();
          isOneLiner = true;
        } else {
          throw new LocatedException(sourceStart, 'I expected either a linebreak or then after the condition.');
        }

        conditions.push(condition);
        thenBlocks.push(thenBlock);
        sourceEnd = thenBlock.where;
      }

      if (conditions.length == 0) {
        throw new LocatedException(sourceStart, 'I expected this if statement to have at least one condition.');
      }
      
      if ((isOneLiner && has(Tokens.Else)) ||
          (!isOneLiner && has(Tokens.Indentation) && indents[indents.length - 1] == tokens[i].source.length && has(Tokens.Else, 1))) {
        if (!isOneLiner) {
          consume(); // eat indentation
        }
        let elseToken = consume(); // eat else

        if (has(Tokens.Linebreak)) {
          consume(); // eat linebreak
          elseBlock = block();
          isOneLiner = false;
        } else {
          elseBlock = expression();
          isOneLiner = true;
        }

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
            stop = new ExpressionAdd(stop, new ExpressionInteger(1));
          } else {
            // throw new LocatedException(SourceLocation.span(sourceStart, start.where), 'I expected the range operator .. in a for-in loop.');
            const array = start;
            if (has(Tokens.Linebreak)) {
              consume(); // eat linebreak
              let body = block();
              return new ExpressionForArray(j, array, body, SourceLocation.span(sourceStart, body.where));
            } else {
              throw new LocatedException(SourceLocation.span(sourceStart, start.where), 'Bad for-in');
            }
          }
        } else if (has(Tokens.To)) {
          consume(); // eat to
          start = new ExpressionUnit();
          stop = expression();
        } else if (has(Tokens.Through)) {
          consume(); // eat through
          start = new ExpressionUnit();
          stop = expression();
          stop = new ExpressionAdd(stop, new ExpressionInteger(1));
        } else {
          throw new LocatedException(sourceStart, 'I expected one of to, through, or in to specify the for loop\'s range.');
        }

        if (has(Tokens.By)) {
          consume(); // eat by
          by = expression();
        } else {
          by = new ExpressionUnit();
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
      const leftToken = consume(); // eat [
      let elements = [];

      // Allow linebreak followed by indentation.
      let hasLinebreaks = false;
      if (has(Tokens.Linebreak)) {
        consume();
        if (has(Tokens.Indentation)) {
          if (indents[indents.length - 1] < tokens[i].source.length) {
            indents.push(tokens[i].source.length);
            hasLinebreaks = true;
            consume();
          } else {
            throw new LocatedException(tokens[i].where, 'I expected the vector\'s elements to be indented one level.');
          }
        } else {
          throw new LocatedException(leftToken.where, 'I expected the vector\'s elements to be indented one level.');
        }
      }

      while (!has(Tokens.RightSquareBracket)) {
        const e = expression();
        // if (has(Tokens.Tilde)) {
          // let tildeToken = consume();
          // if (elements.length == 0) {
            // throw new LocatedException(tildeToken.where, 'I found ~ at index 0 of this vector. Operator ~ repeats the previous element and can only appear after index 0.');
          // }
          // e = new ExpressionDitto();
        // } else {
          // e = expression();
        // }
        elements.push(e);
        if (!has(Tokens.RightSquareBracket)) {
          if (has(Tokens.Comma)) {
            consume(); // eat ,

            if (has(Tokens.Linebreak)) {
              if (hasLinebreaks) {
                consume(); // eat break
                if (has(Tokens.Indentation)) {
                  if (indents[indents.length - 1] === tokens[i].source.length) {
                    consume();
                  } else {
                    throw new LocatedException(tokens[i].where, 'I expected all of the vector\'s elements to have the same level of indentation. But this element has a different indentation.');
                  }
                }
              } else {
                throw new LocatedException(tokens[i].where, 'I expected no linebreaks in this vector because there was no linebreak after the opening [.');
              }
            }
          } else if (has(Tokens.Linebreak)) {
            if (hasLinebreaks) {
              consume();
              if (has(Tokens.Indentation) && has(Tokens.RightSquareBracket, 1)) {
                indents.pop();
                if (indents[indents.length - 1] === tokens[i].source.length) {
                  consume();
                } else {
                  consume();
                  throw new LocatedException(tokens[i].where, 'I expected the vector\'s closing line to have the same indentation as its opening line.');
                }
              } else {
                throw new LocatedException(tokens[i].where, 'I expected the vector to be closed with ].');
              }
            } else {
              throw new LocatedException(tokens[i].where, 'I expected no linebreaks in this vector because there was no linebreak after the opening [.');
            }
          } else {
            throw new LocatedException(tokens[i].where, 'I expected a comma between vector elements.');
          }
        }
      }
      let sourceEnd = tokens[i].where;
      consume(); // eat ]
      return new ExpressionVector(elements, SourceLocation.span(sourceStart, sourceEnd));
    } else if (has(Tokens.Identifier) && has(Tokens.LeftParenthesis, 1)) {
      let sourceStart = tokens[i].where;

      let nameToken = consume();
      const leftToken = consume(); // eat (

      // Allow linebreak followed by indentation.
      let hasLinebreaks = false;
      if (has(Tokens.Linebreak)) {
        consume();
        if (has(Tokens.Indentation)) {
          if (indents[indents.length - 1] < tokens[i].source.length) {
            indents.push(tokens[i].source.length);
            hasLinebreaks = true;
            consume();
          } else {
            throw new LocatedException(tokens[i].where, 'I expected the parameters to be indented one level.');
          }
        } else {
          throw new LocatedException(leftToken.where, 'I expected the parameters to be indented one level.');
        }
      }

      let actuals = [];
      while (!has(Tokens.RightParenthesis)) {
        actuals.push(expression());
        if (!has(Tokens.RightParenthesis)) {
          if (has(Tokens.Comma)) {
            consume(); // eat ,

            if (has(Tokens.Linebreak)) {
              if (hasLinebreaks) {
                consume(); // eat break
                if (has(Tokens.Indentation)) {
                  if (indents[indents.length - 1] === tokens[i].source.length) {
                    consume();
                  } else {
                    throw new LocatedException(tokens[i].where, 'I expected all of the parameters to have the same level of indentation. But this element has a different indentation.');
                  }
                }
              } else {
                throw new LocatedException(tokens[i].where, 'I expected no linebreaks in this call because there was no linebreak after the opening (.');
              }
            }
          } else if (has(Tokens.Linebreak)) {
            if (hasLinebreaks) {
              consume();
              if (has(Tokens.Indentation) && has(Tokens.RightParenthesis, 1)) {
                indents.pop();
                if (indents[indents.length - 1] === tokens[i].source.length) {
                  consume();
                } else {
                  consume();
                  throw new LocatedException(tokens[i].where, 'I expected the call\'s closing line to have the same indentation as its opening line.');
                }
              } else {
                throw new LocatedException(tokens[i].where, 'I expected the call to be closed with ).');
              }
            } else {
              throw new LocatedException(tokens[i].where, 'I expected no linebreaks in this call because there was no linebreak after the opening (.');
            }
          } else {
            throw new LocatedException(tokens[i].where, 'I expected a comma between parameters.');
          }
        }
      }

      let sourceEnd = tokens[i].where;
      if (has(Tokens.RightParenthesis)) {
        consume();
      } else {
        throw new LocatedException(SourceLocation.span(sourceStart, sourceEnd), `I expected a right parenthesis to close the function call, but I encountered "${tokens[i].source}" (${tokens[i].type}) instead.`);
      }

      return new ExpressionFunctionCall(nameToken, actuals, SourceLocation.span(sourceStart, sourceEnd));
    } else if (has(Tokens.Repeat)) {
      let sourceStart = tokens[i].where;
      consume(); // eat repeat
      let count = expression();
      if (!has(Tokens.Linebreak)) {
        throw new LocatedException(SourceLocation.span(sourceStart, count.where), 'I expected a linebreak after this repeat\'s count.');
      }
      consume(); // eat linebreak
      let body = block();
      if (has(Tokens.Indentation) && indents[indents.length - 1] == tokens[i].source.length && has(Tokens.Around, 1)) {
        consume(); // eat indent
        consume(); // eat around
        consume(); // eat linebreak
        let around = block();
        return new ExpressionRepeatAround(count, body, around, SourceLocation.span(sourceStart, around.where));
      } else {
        return new ExpressionRepeat(count, body, SourceLocation.span(sourceStart, body.where));
      }
    } else if (has(Tokens.Identifier) || has(Tokens.T)) {
      let where = tokens[i].where;
      let id = consume();
      return new ExpressionIdentifier(id, where);
    } else if (has(Tokens.With)) {
      let sourceStart = tokens[i].where;
      consume(); // eat with
      let scope = expression();
      if (has(Tokens.Linebreak)) {
        consume(); // eat linebreak
      } else if (has(Tokens.EOF)) {
        throw new LocatedException(SourceLocation.span(sourceStart, tokens[i].where), `I reached the end of the program, but this <code>with</code> statement was not complete.`);
      } else if (has(Tokens.EOF)) {
        throw new LocatedException(tokens[i].where, `I found a stray <code>${tokens[i].source}</code> in this <code>with</code> statement's scope expression, and I don't know what to do with that.`);
      }
      let body = block();
      return new ExpressionWith(scope, body, SourceLocation.span(sourceStart, body.where));
    } else {
      throw new LocatedException(tokens[i].where, `I expected an expression, but I didn't find one.`);
      // console.log("tokens[i]:", tokens[i]);
      // if (!has(Tokens.Linebreak)) {
        // throw new LocatedException(tokens[i].where, `I don't know what "${tokens[i].source}" means here.`);
      // }
    }
  }

  let ast = program();

  return ast;
}
