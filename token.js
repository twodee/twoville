export let Tokens = Object.freeze({
  Plus: 'Plus',
  T: 'T',
  Minus: 'Minus',
  Indentation: 'Indentation',
  Asterisk: 'Asterisk',
  ForwardSlash: 'ForwardSlash',
  Integer: 'Integer',
  String: 'String',
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
  From: 'From',
  To: 'To',
  By: 'By',
  Through: 'Through',
  EOF: 'EOF'
});

export class SourceLocation {
  constructor(lineStart, lineEnd, columnStart, columnEnd, indexStart, indexEnd) {
    this.lineStart = lineStart;
    this.lineEnd = lineEnd;
    this.columnStart = columnStart;
    this.columnEnd = columnEnd;
    this.indexStart = indexStart;
    this.indexEnd = indexEnd;
  }

  debugPrefix() {
    return this.lineStart + ':' +
           this.lineEnd + ':' +
           this.columnStart + ':' +
           this.columnEnd + ':';
  }
}

export class Token {
  constructor(type, source, where) {
    this.type = type;
    this.source = source;
    this.where = where;
  }
}
