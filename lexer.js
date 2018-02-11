function lex(source) {
  
  var i = 0;
  var tokens = [];
  var tokenSoFar = '';

  function consume() {
    tokenSoFar += source[i];
    i += 1;
  }

  function has(pattern, offset) {
    var index = i;
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

  function emit(type) {
    tokens.push(new Token(type, tokenSoFar, null));
    tokenSoFar = '';
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

  function identifier() {
    consume(); // eat identifier lead
    while (has(/[a-zA-Z0-9_]/)) {
      consume();
    }

    emit(Tokens.Identifier);
  }

  function digits() {
    while (has(/\d/)) {
      consume();
    }

    if (has('.')) {
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
      emit(Tokens.Dot);
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
      emit(Tokens.ForwardSlash);
    } else if (has('\n')) {
      consume();
      emit(Tokens.Linebreak);
      indentation();
    } else if (has(' ')) {
      ++i;
    } else {
      throw 'unknowned! [' + source[i] + ']';
    }
  }

  emit(Tokens.EOF);

  console.log("tokens:", tokens);
  return tokens;
}
