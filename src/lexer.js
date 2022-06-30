import {
  LocatedException,
  Tokens,
  Token,
  SourceLocation
} from './common.js';

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

    if (has('>')) {
      consume();
      emit(Tokens.RightArrow);
    } else if (has('.')) {
      decimal();
    } else {
      emit(Tokens.Minus);
    }
  }

  function character() {
    consume();
    consume();
    if (!has("'")) {
      throw new LocatedException(new SourceLocation(iStartLine, iEndLine, iStartColumn, iEndColumn, iStartIndex, iEndIndex), `I see a character literal, but it isn't closed with '.`);
    }
    consume();
    tokenSoFar = tokenSoFar.substr(1, tokenSoFar.length - 2); // chop off '
    emit(Tokens.Character);
  }

  function string() {
    consume();
    // TODO newline?
    while (!has('"') && i < source.length) {
      consume();
    }

    if (!has('"')) {
      throw new LocatedException(new SourceLocation(iStartLine, iEndLine, iStartColumn, iEndColumn, iStartIndex, iEndIndex), `I see a string literal, but it isn't closed with ".`);
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
    } else if (tokenSoFar == 'and') {
      emit(Tokens.And);
    } else if (tokenSoFar == 'or') {
      emit(Tokens.Or);
    } else if (tokenSoFar == 'not') {
      emit(Tokens.Not);
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
    } else if (tokenSoFar == 'around') {
      emit(Tokens.Around);
    } else if (tokenSoFar == 'if') {
      if (tokens.length > 0 && tokens[tokens.length - 1].type == Tokens.Else) {
        let elseToken = tokens.pop();
        iStartLine = elseToken.where.lineStart;
        iStartColumn = elseToken.where.columnStart;
        tokenSoFar = 'else if';
        emit(Tokens.ElseIf);
      } else {
        emit(Tokens.If);
      }
    } else if (tokenSoFar == 'else') {
      emit(Tokens.Else);
    } else if (tokenSoFar == 'to') {
      emit(Tokens.To);
    } else if (tokenSoFar == 'in') {
      emit(Tokens.In);
    } else if (tokenSoFar == 'then') {
      emit(Tokens.Then);
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

    if (has('/') && has('/', 1)) {
      consume();
      consume();
      wholeLineComment();
    } else if (has('\n')) {
      consume();
      resetToken();
      indentation();
    } else if (i === source.length) {
      resetToken();
    } else {
      emit(Tokens.Indentation);
    }
  }

  function equals() {
    consume();
    if (has('=')) {
      consume();
      emit(Tokens.Same);
    } else {
      emit(Tokens.Assign);
    }
  }

  function bang() {
    consume();
    if (has('=')) {
      consume();
      emit(Tokens.NotSame);
    }
  }

  function less() {
    consume();
    if (has('=')) {
      consume();
      emit(Tokens.LessEqual);
    } else {
      emit(Tokens.Less);
    }
  }

  function more() {
    consume();
    if (has('=')) {
      consume();
      emit(Tokens.MoreEqual);
    } else {
      emit(Tokens.More);
    }
  }

  function inlineComment() {
    // eat till end of line
    while (i < source.length && !has('\n')) {
      consume();
    }
    resetToken();
  }

  function wholeLineComment() {
    // eat through end of line
    while (i < source.length && !has('\n')) {
      consume();
    }
    consume(); // eat \n
    resetToken();
    indentation();
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
    } else if (has('\'')) {
      character();
    } else if (has('.')) {
      dot();
    } else if (has('-')) {
      dash();
    } else if (has('=')) {
      equals();
    } else if (has('<')) {
      less();
    } else if (has('>')) {
      more();
    } else if (has('!')) {
      bang();
    } else if (has('#')) {
      consume();
      emit(Tokens.Distribute);
    } else if (has('~')) {
      consume();
      emit(Tokens.Tilde);
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
      if (has('=')) {
        consume();
        emit(Tokens.UpAssign);
      } else {
        emit(Tokens.Circumflex);
      }
    } else if (has('*')) {
      consume();
      emit(Tokens.Asterisk);
    } else if (has('%')) {
      consume();
      emit(Tokens.Percent);
    } else if (has('/')) {
      consume();
      if (has('/')) {
        consume();
        inlineComment();
      } else {
        emit(Tokens.ForwardSlash);
      }
    } else if (has('\r')) {
      consume();
      resetToken();
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
      throw new LocatedException(new SourceLocation(iStartLine, iEndLine, iStartColumn, iEndColumn, iStartIndex, iEndIndex), `I encountered <var>${tokenSoFar}</var>, and I don't know what it means.`);
    }
  }

  emit(Tokens.EOF);

  // console.log("tokens:", tokens);
  return tokens;
}
