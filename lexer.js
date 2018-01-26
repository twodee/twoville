function lex(source) {
  
  var i = 0;
  var tokens = [];
  var tokenSoFar = '';

  function consume() {
    tokenSoFar += source[i];
    i += 1;
  }

  function has(pattern) {
    if (pattern instanceof RegExp) {
      return source.charAt(i).match(pattern);
    } else {
      return source.charAt(i) == pattern;
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
    } else if (has('.')) {
      decimal();
    } else {
      emit(Token.Minus);
    }
  }

  function identifier() {
    consume(); // eat identifier lead
    while (has(/[a-zA-Z0-9_]/)) {
      consume();
    }
  }

  function digits() {
    while (has(/\d/)) {
      consume();
    }
    
    if (has('.')) {
      decimal();
    } else {
      emit(Tokens.Integer);
    }
  }

  function decimal() {
    consume(); // eat .
    while (has(/\d/)) {
      consume();
    }
    emit(Tokens.Real);
  }

  while (i < source.length) {
    if (has(/\d/)) {
      digits();
    } else if (has(/a-zA-Z_/)) {
      identifier();
    } else if (has('-')) {
      dash();
    } else if (has('+')) {
      consume();
      emit(Tokens.Plus);
    } else if (has('*')) {
      consume();
      emit(Tokens.Asterisk);
    } else if (has('%')) {
      consume();
      emit(Tokens.Percent);
    } else if (has('/')) {
      consume();
      emit(Tokens.ForwardSlash);
    } else {
      throw 'unknowned!';
    }
  }

  emit(Tokens.EOF);

  return tokens;
}
