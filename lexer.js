import {
  Tokens,
  Token,
  SourceLocation
} from './token.js';

import {
  LocatedException,
} from './types.js';

export function lex(source) {
  
  let iStartIndex = 0;
  let iEndIndex = -1;
  let iStartColumn = 0;
  let iEndColumn = -1;
  let iStartLine = 0;
  let iEndLine = 0;

  let i = 0;
  let tokens = [];
  let tokenSoFar = '';

  function consume() {
    iEndIndex += 1;
    iEndColumn += 1;
    if (source[i] == '\n') {
      iEndLine += 1;
      iEndColumn = -1;
    }
    tokenSoFar += source[i];
    i += 1;
  }

  function has(pattern, offset) {
    let index = i;
    if (offset) {
      index = i + offset;
    }

    if (index < 0 || index >= source.length) {
      return false;
    } else if (pattern instanceof RegExp) {
      return source.charAt(index).match(pattern);
    } else {
      return source.charAt(index) == pattern;
    }
  }

  function resetToken() {
    iStartIndex = iEndIndex + 1;
    iStartColumn = iEndColumn + 1;
    iStartLine = iEndLine;
    tokenSoFar = '';
  }

  function emit(type) {
    tokens.push(new Token(type, tokenSoFar, new SourceLocation(iStartLine, iEndLine, iStartColumn, iEndColumn, iStartIndex, iEndIndex)));
    resetToken();
  }

  function dash() {
    consume();

    if (has(/\d/)) {
      digits();
    } else if (has('>')) {
      consume();
      emit(Tokens.RightArrow);
    } else if (has('.')) {
      decimal();
    } else {
      emit(Tokens.Minus);
    }
  }

  function string() {
    consume();
    while (!has('"')) {
      consume();
    }
    consume();
    tokenSoFar = tokenSoFar.substr(1, tokenSoFar.length - 2); // chop off "
    emit(Tokens.String);
  }

  function symbol() {
    consume(); // eat symbol lead
    while (has(/[-a-zA-Z0-9_]/)) {
      consume();
    }
    emit(Tokens.Symbol);
  }

  function identifier() {
    consume(); // eat identifier lead
    while (has(/[a-zA-Z0-9_]/)) {
      consume();
    }

    if (tokenSoFar == 't') {
      emit(Tokens.T);
    } else if (tokenSoFar == 'repeat') {
      emit(Tokens.Repeat);
    } else if (tokenSoFar == 'true') {
      emit(Tokens.Boolean);
    } else if (tokenSoFar == 'false') {
      emit(Tokens.Boolean);
    } else if (tokenSoFar == 'with') {
      emit(Tokens.With);
    } else if (tokenSoFar == 'for') {
      emit(Tokens.For);
    } else if (tokenSoFar == 'in') {
      emit(Tokens.In);
    } else if (tokenSoFar == 'to') {
      emit(Tokens.To);
    } else if (tokenSoFar == 'in') {
      emit(Tokens.In);
    } else if (tokenSoFar == 'through') {
      emit(Tokens.Through);
    } else if (tokenSoFar == 'by') {
      emit(Tokens.By);
    } else {
      emit(Tokens.Identifier);
    }
  }

  function digits() {
    while (has(/\d/)) {
      consume();
    }

    if (has('.') && !has('.', 1)) {
      decimal();
    } else {
      if (has('e') && has(/\d/, 1)) {
        eSuffix();
      }
      emit(Tokens.Integer);
    }
  }

  function eSuffix() {
    consume();
    while (has(/\d/)) {
      consume();
    }
  }

  function decimal() {
    consume(); // eat .
    while (has(/\d/)) {
      consume();
    }

    // Handle e123.
    if (has('e') && has(/\d/, 1)) {
      eSuffix();
    }

    emit(Tokens.Real);
  }

  function dot() {
    if (has(/\d/, 1)) {
      decimal();
    } else {
      consume();
      if (has(/\./)) {
        consume();
        emit(Tokens.Range);
      } else {
        emit(Tokens.Dot);
      }
    }
  }

  function indentation() {
    while (has(/[ \t]/)) {
      consume();
    }
    emit(Tokens.Indentation);
  }

  function equals() {
    consume();
    if (has('=')) {
      consume();
      emit(Tokens.Equality);
    } else {
      emit(Tokens.Assign);
    }
  }

  indentation();
  while (i < source.length) {
    if (has(/\d/)) {
      digits();
    } else if (has(/[a-zA-Z_]/)) {
      identifier();
    } else if (has(':')) {
      symbol();
    } else if (has('"')) {
      string();
    } else if (has('.')) {
      dot();
    } else if (has('-')) {
      dash();
    } else if (has('=')) {
      equals();
    } else if (has(',')) {
      consume();
      emit(Tokens.Comma);
    } else if (has('(')) {
      consume();
      emit(Tokens.LeftParenthesis);
    } else if (has(')')) {
      consume();
      emit(Tokens.RightParenthesis);
    } else if (has('{')) {
      consume();
      emit(Tokens.LeftCurlyBrace);
    } else if (has('}')) {
      consume();
      emit(Tokens.RightCurlyBrace);
    } else if (has('[')) {
      consume();
      emit(Tokens.LeftSquareBracket);
    } else if (has(']')) {
      consume();
      emit(Tokens.RightSquareBracket);
    } else if (has('+')) {
      consume();
      emit(Tokens.Plus);
    } else if (has('^')) {
      consume();
      emit(Tokens.Circumflex);
    } else if (has('*')) {
      consume();
      emit(Tokens.Asterisk);
    } else if (has('%')) {
      consume();
      emit(Tokens.Percent);
    } else if (has('/')) {
      consume();
      if (has('/')) {
        // eat till end of line
        do {
          consume();
        } while (i < source.length && !has('\n'));
      } else {
        emit(Tokens.ForwardSlash);
      }
    } else if (has('\n')) {
      consume();
      emit(Tokens.Linebreak);
      indentation();
    } else if (has(' ')) {
      while (has(' ')) {
        consume();
      }
      resetToken();
    } else {
      consume();
      throw new LocatedException(new SourceLocation(iStartLine, iEndLine, iStartColumn, iEndColumn, iStartIndex, iEndIndex), `I encountered "${tokenSoFar}", and I don't know what it means.`);
    }
  }

  emit(Tokens.EOF);

  return tokens;
}
