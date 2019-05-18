export let Tokens = Object.freeze({
  Assign: 'Assign',
  Asterisk: 'Asterisk',
  Boolean: 'Boolean',
  By: 'By',
  Circle: 'Circle',
  Circumflex: 'Circumflex',
  Comma: 'Comma',
  Dot: 'Dot',
  EOF: 'EOF',
  Else: 'Else',
  ElseIf: 'ElseIf',
  ForwardSlash: 'ForwardSlash',
  Identifier: 'Identifier',
  If: 'If',
  In: 'In',
  Indentation: 'Indentation',
  Integer: 'Integer',
  LeftCurlyBrace: 'LeftCurlyBrace',
  LeftParenthesis: 'LeftParenthesis',
  LeftSquareBracket: 'LeftSquareBracket',
  Less: 'Less',
  LessEqual: 'LessEqual',
  Linebreak: 'Linebreak',
  Minus: 'Minus',
  More: 'More',
  MoreEqual: 'MoreEqual',
  NotSame: 'NotSame',
  Percent: 'Percent',
  Plus: 'Plus',
  Range: 'Range',
  Real: 'Real',
  Repeat: 'Repeat',
  RightArrow: 'RightArrow',
  RightCurlyBrace: 'RightCurlyBrace',
  RightParenthesis: 'RightParenthesis',
  RightSquareBracket: 'RightSquareBracket',
  Same: 'Same',
  String: 'String',
  Symbol: 'Symbol',
  T: 'T',
  Through: 'Through',
  To: 'To',
  With: 'With',
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

  clone() {
    return new SourceLocation(this.lineStart, this.lineEnd, this.columnStart, this.columnEnd, this.indexStart, this.indexEnd);
  }

  debugPrefix() {
    return this.lineStart + ':' +
           this.lineEnd + ':' +
           this.columnStart + ':' +
           this.columnEnd + ':';
  }

  static span(a, b) {
    return new SourceLocation(a.lineStart, b.lineEnd, a.columnStart, b.columnEnd, a.indexStart, b.indexEnd);
  }
}

export class Token {
  constructor(type, source, where) {
    this.type = type;
    this.source = source;
    this.where = where;
  }
}
