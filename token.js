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
  EOF: 'EOF'
});

function SourceLocation(lineStart, lineEnd, columnStart, columnEnd, indexStart, indexEnd) {
  this.lineStart = lineStart;
  this.lineEnd = lineEnd;
  this.columnStart = columnStart;
  this.columnEnd = columnEnd;
  this.indexStart = indexStart;
  this.indexEnd = indexEnd;
}

var Token = {
  create: function (type, source, where) {
    return Object.assign({}, {
      type: type,
      source: source,
      where: where
    });
  }
}
