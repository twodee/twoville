Tokens = Object.freeze({
  Plus: 'Plus',
  Minus: 'Minus',
  Asterisk: 'Asterisk',
  ForwardSlash: 'ForwardSlash',
  Integer: 'Integer',
  Real: 'Real',
  Percent: 'Percent',
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

function Token(type, source, where) {
  this.type = type;
  this.source = source;
  this.where = where;
}
