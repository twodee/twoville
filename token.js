Tokens = Object.freeze({
  Plus: 'Plus',
  T: 'T',
  Minus: 'Minus',
  Indentation: 'Indentation',
  Asterisk: 'Asterisk',
  ForwardSlash: 'ForwardSlash',
  Integer: 'Integer',
  Linebreak: 'Linebreak',
  Dot: 'Dot',
  Assign: 'Assign',
  Real: 'Real',
  Percent: 'Percent',
  With: 'With',
  Comma: 'Comma',
  RightArrow: 'RightArrow',
  LeftParenthesis: 'LeftParenthesis',
  RightParenthesis: 'RightParenthesis',
  LeftCurlyBrace: 'LeftCurlyBrace',
  RightCurlyBrace: 'RightCurlyBrace',
  LeftSquareBracket: 'LeftSquareBracket',
  RightSquareBracket: 'RightSquareBracket',
  Circumflex: 'Circumflex',
  Circle: 'Circle',
  Identifier: 'Identifier',
  Repeat: 'Repeat',
  Boolean: 'Boolean',
  EOF: 'EOF'
});

var SourceLocation = {
  create: function(lineStart, lineEnd, columnStart, columnEnd, indexStart, indexEnd) {
    var instance = Object.create(SourceLocation);
    return Object.assign(instance, {
      lineStart: lineStart,
      lineEnd: lineEnd,
      columnStart: columnStart,
      columnEnd: columnEnd,
      indexStart: indexStart,
      indexEnd: indexEnd
    });
  },
  debugPrefix: function() {
    return this.lineStart + ':' +
           this.lineEnd + ':' +
           this.columnStart + ':' +
           this.columnEnd + ':';
  }
}

var Token = {
  create: function(type, source, where) {
    var instance = Object.create(Token);
    return Object.assign(instance, {
      type: type,
      source: source,
      where: where
    });
  },
}
