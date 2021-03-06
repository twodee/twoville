// --------------------------------------------------------------------------- 

export let Tokens = Object.freeze({
  And: 'And',
  Or: 'Or',
  Not: 'Not',
  Assign: 'Assign',
  Around: 'Around',
  Asterisk: 'Asterisk',
  Boolean: 'Boolean',
  By: 'By',
  Character: 'Character',
  Circle: 'Circle',
  Circumflex: 'Circumflex',
  Comma: 'Comma',
  Distribute: 'Distribute',
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
  Then: 'Then',
  Through: 'Through',
  Tilde: 'Tilde',
  To: 'To',
  UpAssign: 'UpAssign',
  With: 'With',
  Xor: 'Xor',
});

// --------------------------------------------------------------------------- 

export class SourceLocation {
  constructor(lineStart, lineEnd, columnStart, columnEnd) {
    this.lineStart = lineStart;
    this.lineEnd = lineEnd;
    this.columnStart = columnStart;
    this.columnEnd = columnEnd;
  }

  contains(column, row) {
    return this.lineStart <= row && row <= this.lineEnd && this.columnStart <= column && column - 1 <= this.columnEnd;
  }

  clone() {
    return new SourceLocation(this.lineStart, this.lineEnd, this.columnStart, this.columnEnd);
  }

  debugPrefix() {
    return this.lineStart + ':' +
           this.lineEnd + ':' +
           this.columnStart + ':' +
           this.columnEnd + ':';
  }

  static span(a, b) {
    return new SourceLocation(a.lineStart, b.lineEnd, a.columnStart, b.columnEnd);
  }

  static reify(pod) {
    if (pod) {
      return new SourceLocation(pod.lineStart, pod.lineEnd, pod.columnStart, pod.columnEnd);
    } else {
      return undefined;
    }
  }
}

// --------------------------------------------------------------------------- 

export class Token {
  constructor(type, source, where) {
    this.type = type;
    this.source = source;
    this.where = where;
  }

  static reify(pod) {
    return new Token(pod.type, pod.source, SourceLocation.reify(pod.where));
  }
}

// --------------------------------------------------------------------------- 

export class MessagedException extends Error {
  constructor(message) {
    super(message);
  }

  get userMessage() {
    return this.message;
  }
}

// --------------------------------------------------------------------------- 

export class LocatedException extends MessagedException {
  constructor(where, message) {
    super(message);
    if (!where) {
      console.trace("There's no where information.");
    }
    this.where = where;
  }

  get userMessage() {
    console.trace(this);
    return `${this.where.debugPrefix()}${this.message}`;
  }
}

// --------------------------------------------------------------------------- 

export class FunctionDefinition {
  constructor(name, formals, body) {
    this.name = name;
    this.formals = formals;
    this.body = body;
  }
}

// --------------------------------------------------------------------------- 

export class Turtle {
  constructor(position, heading) {
    this.position = position;
    this.heading = heading;
  }
}

// --------------------------------------------------------------------------- 

export const Precedence = Object.freeze({
  Atom: 100,
  Property: 99,
  Call: 98, // TODO?
  Power: 95,
  Not: 90,
  Multiplicative: 80,
  Additive: 70,
  Shift: 65,
  And: 60,
  Xor: 59,
  Or: 58,
  Relational: 50,
  Equality: 45,
  Assignment: 15,
});

// --------------------------------------------------------------------------- 

export const mop = (object, xform) => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, xform(value)]));

// --------------------------------------------------------------------------- 

export const svgNamespace = "http://www.w3.org/2000/svg";

// --------------------------------------------------------------------------- 

export function clearChildren(parent) {
  while (parent.lastChild) {
    parent.removeChild(parent.lastChild);
  }
}

// --------------------------------------------------------------------------- 

export function removeClassMembers(root, className) {
  if (root.classList.contains(className)) {
    root.parentNode.removeChild(root);
  } else {
    for (let i = root.childNodes.length - 1; i >= 0; --i) {
      if (root.childNodes[i].nodeType == Node.ELEMENT_NODE) {
        removeClassMembers(root.childNodes[i], className);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

export function removeClassMembersExcept(root, className, keepList) {
  if (root.classList.contains(className)) {
    if (!keepList.includes(root.id)) {
      root.parentNode.removeChild(root);
    }
  } else {
    for (let i = root.childNodes.length - 1; i >= 0; --i) {
      if (root.childNodes[i].nodeType == Node.ELEMENT_NODE) {
        removeClassMembersExcept(root.childNodes[i], className, keepList);
      }
    }
  }
}

// --------------------------------------------------------------------------- 

Number.prototype.toShortFloat = function(ndigits = 3) {
  return parseFloat(this.toLocaleString('fullwide', {useGrouping: false, maximumFractionDigits: ndigits}));
}

// --------------------------------------------------------------------------- 

export function formatFloat(x, ndigits) {
  return x.toLocaleString('fullwide', {useGrouping: false, minimumFractionDigits: ndigits, maximumFractionDigits: ndigits});
}

// --------------------------------------------------------------------------- 

export function standardizeDegrees(degrees) {
  if (degrees < 0) {
    while (degrees <= -360) {
      degrees += 360;
    }
  } else {
    while (degrees >= 360) {
      degrees -= 360;
    }
  }

  return degrees;
}

// --------------------------------------------------------------------------- 

export function classifyArc(degrees) {
  if (degrees < 0) {
    return {
      isLarge: degrees < -180 ? 1 : 0,
      isClockwise: 1,
    };
  } else {
    return {
      isLarge: degrees > 180 ? 1 : 0,
      isClockwise: 0,
    };
  }
}

// --------------------------------------------------------------------------- 

export function sentenceCase(s) {
  if (s.length > 0) {
    return s.charAt(0).toUpperCase() + s.substring(1);
  } else {
    return s;
  }
}

// --------------------------------------------------------------------------- 

export class BoundingBox {
  constructor() {
    this.isEmpty = true;
    this.min = [0, 0];
    this.max = [0, 0];
  }

  encloseBox(box) {
    if (this.isEmpty) {
      this.min[0] = box.min[0];
      this.min[1] = box.min[1];
      this.max[0] = box.max[0];
      this.max[1] = box.max[1];
      this.isEmpty = false;
    } else {
      if (box.min[0] < this.min[0]) {
        this.min[0] = box.min[0];
      }

      if (box.max[0] > this.max[0]) {
        this.max[0] = box.max[0];
      }

      if (box.min[1] < this.min[1]) {
        this.min[1] = box.min[1];
      }

      if (box.max[1] > this.max[1]) {
        this.max[1] = box.max[1];
      }
    }
  }

  enclosePoint(point) {
    if (this.isEmpty) {
      this.isEmpty = false;
      this.min[0] = point[0];
      this.min[1] = point[1];
      this.max[0] = point[0];
      this.max[1] = point[1];
    } else {
      if (point[0] < this.min[0]) {
        this.min[0] = point[0];
      } else if (point[0] > this.max[0]) {
        this.max[0] = point[0];
      }

      if (point[1] < this.min[1]) {
        this.min[1] = point[1];
      } else if (point[1] > this.max[1]) {
        this.max[1] = point[1];
      }
    }

    return this;
  }

  get width() {
    return this.max[0] - this.min[0];
  }

  get height() {
    return this.max[1] - this.min[1];
  }

  thicken(width) {
    this.min[0] -= width;
    this.min[1] -= width;
    this.max[0] += width;
    this.max[1] += width;
  }

  toString() {
    return this.min.toString() + ' | ' + this.max.toString();
  }
}

// --------------------------------------------------------------------------- 

export function typesToSeries(types) {
  const withArticles = types.map(type => `${type.article} ${type.type}`);
  if (withArticles.length > 1) {
    withArticles[withArticles.length - 1] = `or ${withArticles[withArticles.length - 1]}`;
  }
  if (withArticles.length > 2) {
    return withArticles.join(', ');
  } else {
    return withArticles.join(' ');
  }
}

// --------------------------------------------------------------------------- 

