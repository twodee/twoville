var INTEGER = 'INTEGER';
var IDENTIFIER = 'IDENTIFIER';
var EOF = 'EOF';
var LEFT_PARENTHESIS = 'LEFT_PARENTHESIS';
var RIGHT_PARENTHESIS = 'RIGHT_PARENTHESIS';
var LEFT_BRACKET = 'LEFT_BRACKET';
var RIGHT_BRACKET = 'RIGHT_BRACKET';
var NEWLINE = 'NEWLINE';
var PLUS = 'PLUS';
var TIMES = 'TIMES';
var DOT = 'DOT';
var RANGE = 'RANGE';
var ASSIGN = 'ASSIGN';
var MINUS = 'MINUS';
var DIVIDE = 'DIVIDE';
var COMMA = 'COMMA';
var RECTANGLE = 'RECTANGLE';
var CIRCLE = 'CIRCLE';
var REPEAT = 'REPEAT';
var END = 'END';
var TO = 'TO';
var COLON = 'COLON';

function Token(type, source) {
  this.type = type;
  this.source = source;
}

function lex(source) {
  var iToRead = 0;
  var tokens = [];
  var tokenSoFar = '';

  var has = function(regex) {
    return regex.test(source.charAt(iToRead));
  }

  // Assumes iToRead is in bounds.
  var consume = function() {
    tokenSoFar += source.charAt(iToRead);
    ++iToRead;
  }

  var emitToken = function(type) {
    tokens.push(new Token(type, tokenSoFar));
    tokenSoFar = '';
  }

  // Assumes first character has already been consumed.
  var identifier = function() {
    while (has(/[A-Za-z0-9_]/)) {
      consume();
    }
    emitToken(IDENTIFIER);
  }

  var integer = function() {
    while (has(/\d/)) {
      consume();
    }
    emitToken(INTEGER);
  }

  while (iToRead < source.length) {
    if (has(/[ \t\r]+/)) {
      consume();
      tokenSoFar = '';
    } else if (has(/\+/)) {
      consume();
      emitToken(PLUS);
    } else if (has(/\*/)) {
      consume();
      emitToken(TIMES);
    } else if (has(/\//)) {
      consume();
      emitToken(DIVIDE);
    } else if (has(/\(/)) {
      consume();
      emitToken(LEFT_PARENTHESIS);
    } else if (has(/\)/)) {
      consume();
      emitToken(RIGHT_PARENTHESIS);
    } else if (has(/#/)) {
      while (!has(/\n/)) {
        consume();
      }
      consume();
      tokenSoFar = '';
    } else if (has(/\[/)) {
      consume();
      emitToken(LEFT_BRACKET);
    } else if (has(/\]/)) {
      consume();
      emitToken(RIGHT_BRACKET);
    } else if (has(/=/)) {
      consume();
      emitToken(ASSIGN);
    } else if (has(/,/)) {
      consume();
      emitToken(COMMA);
    } else if (has(/\./)) {
      consume();
      if (has(/\./)) {
        consume();
        emitToken(RANGE);
      } else {
        emitToken(DOT);
      }
    } else if (has(/:/)) {
      consume();
      emitToken(COLON);
    } else if (has(/[a-zA-Z]/)) {
      consume();
      identifier();
    } else if (has(/[0-9]/)) {
      consume();
      integer();
    } else if (has(/\n/)) {
      consume();
      emitToken(NEWLINE);
    } else {
      throw 'You fell into the tomb of the unknown symbol: ' + source.charAt(iToRead);
    }
  }

  emitToken(EOF);

  return tokens;
}

function Stroke(width, color) {
  this.width = width;
  this.color = color;
}

function Rectangle(center, width, height, fill, stroke) {
  this.center = center;
  this.width = width;
  this.height = height;
  this.fill = fill;
  console.log("fill:", fill);
  this.stroke = stroke;
}

// BUILTIN FUNCTIONS ----------------------------------------------------------

function stroke(env) {
  width = env['width'];
  color = env['color'];
  return new Stroke(width, color);
}

function rectangle(env) {
  center = env['center'];
  width = env['width'];
  height = env['height'];
  fill = env['fill'];
  stroke = env['stroke'];
  return new Rectangle(center, width, height, fill, stroke);
}

// PROGRAM CONSTRUCTS ---------------------------------------------------------

var output = '';
function Block(statements) {
  this.evaluate = function(env) {
    var value = null;
    output += '<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">' + "\n";
    statements.forEach(statement => {
      value = statement.evaluate(env)
      if (value instanceof Rectangle) {
        var r = value;
        output += '<rect x="' + (r.center[0] - r.width * 0.5) + '" y="' + (r.center[1] - r.height * 0.5) + '" width="' + r.width + '" height="' + r.height + '">' + "\n";
      }
    });
    output += '</svg>' + "\n";
    console.log(output);
    return value;
  };

  this.toString = function() {
    return statements.map(statement => statement.toString()).join(' ');
  };
}

function ExpressionRepeat(count, body) {
  this.evaluate = function(env) {
    var n = count.evaluate(env);
    var value = null;
    for (var i = 0; i < n; ++i) {
      value = body.evaluate(env);
    }
    return value;
  };
}

function ExpressionDefine(name, formals, body) {
  this.evaluate = function(env) {
    return env[name] = {name: name, formals: formals, body: body};
  };
}

function ExpressionInteger(literal) {
  this.evaluate = function(env) {
    return literal;
  };

  this.toString = function() {
    return '' + literal;
  };
}

function ExpressionArray(elements) {
  this.evaluate = function(env) {
    return this;
  };

  this.toString = function() {
    return '(array ' + elements.map(element => '' + element).join(' ') + ')';
  };
}

function ExpressionArrayLiteral(element_expressions) {
  this.evaluate = function(env) {
    var values = element_expressions.map(element_expression => element_expression.evaluate(env));
    return values; //new ExpressionArray(values);
  };

  this.toString = function() {
    return '(ARRAY ' + element_expressions.map(element_expression => element_expression.toString()).join(' ') + ')';
  };
}

function ExpressionAdd(l, r) {
  this.evaluate = function(env) {
    return l.evaluate(env) + r.evaluate(env);
  };

  this.toString = function() {
    return '(+ ' + l.toString() + ' ' + r.toString() + ')';
  };
}

function ExpressionSubtract(l, r) {
  this.evaluate = function(env) {
    return l.evaluate(env) - r.evaluate(env);
  };

  this.toString = function() {
    return '(- ' + l.toString() + ' ' + r.toString() + ')';
  };
}

function ExpressionMultiply(l, r) {
  this.evaluate = function(env) {
    return l.evaluate(env) * r.evaluate(env);
  };

  this.toString = function() {
    return '(* ' + l.toString() + ' ' + r.toString() + ')';
  };
}

function ExpressionDivide(l, r) {
  this.evaluate = function(env) {
    return l.evaluate(env) / r.evaluate(env);
  };

  this.toString = function() {
    return '(/ ' + l.toString() + ' ' + r.toString() + ')';
  };
}

function ExpressionAssignment(id, rhs) {
  this.evaluate = function(env) {
    console.log("id:", id);
    console.log("rhs.toString():", rhs.toString());
    var return_value = rhs.evaluate(env);
    env[id] = return_value;
    console.log("return_value:", return_value);
    return return_value;
  };

  this.toString = function() {
    return '(= ' + id + ' ' + rhs.toString() + ')';
  };
}

function ExpressionCall(id, parameters) {
  this.evaluate = function(env) {
    var parameterValues = {};
    for (var key in parameters) {
      if (parameters.hasOwnProperty(key)) {
        parameterValues[key] = parameters[key].evaluate(env);
      }
    }
    console.log("env[", id, "]:", env[id]);
    if (typeof env[id] === 'function') {
      var return_value = env[id](parameterValues);
      console.log("return_value:", return_value);
      return return_value;
    } else {
      return env[id];
    }
  };

  this.toString = function() {
    var params = [];
    for (var key in parameters) {
      if (parameters.hasOwnProperty(key)) {
        params.push(key + ' ' + parameters[key]);
      }
    }
    return '(call ' + id + params.map(p => ' (' + p + ')').join() + ')';
  };
}

function Program(ast) {
  this.ast = ast;
  this.execute = function() {
    var env = {
      stroke: stroke,
      rectangle: rectangle,
    };
    return ast.evaluate(env);
  };
  this.toString = function() {
    return ast.toString();
  }
}

function parse(tokens) {
  var iToParse = 0;

  var has = function(type, lookahead) {
    if (!lookahead) {
      lookahead = 0;
    }
    return iToParse + lookahead < tokens.length && tokens[iToParse + lookahead].type == type;
  }

  var consume = function() {
    ++iToParse;
  }

  var statement = function() {
    var e = e1();
    if (has(NEWLINE)) {
      consume();
      return e;
    } else {
      throw 'Expected newline.';
    }
  }

  var e1 = function() {
    if (has(IDENTIFIER) && has(ASSIGN, 1)) {
      var idToken = tokens[iToParse];
      consume();
      consume();
      var rhs = e1();
      return new ExpressionAssignment(idToken.source, rhs);
    } else {
      return e2();
    }
  }

  var e2 = function() {
    var a = e3();
    while (has(PLUS) || has(MINUS)) {
      var isPlus = has(PLUS);
      consume();
      var b = e3();
      if (isPlus) {
        a = new ExpressionAdd(a, b);
      } else {
        a = new ExpressionSubtract(a, b);
      }
    }
    return a;
  }

  var e3 = function() {
    var a = e4();
    while (has(TIMES) || has(DIVIDE)) {
      var isTimes = has(TIMES);
      consume();
      var b = e4();
      if (isTimes) {
        a = new ExpressionMultiply(a, b);
      } else {
        a = new ExpressionDivide(a, b);
      }
    }
    return a;
  }

  var e4 = function() {
    var atom;

    if (has(INTEGER)) {
      atom = new ExpressionInteger(parseInt(tokens[iToParse].source));
      consume();
    } else if (has(IDENTIFIER)) {
      var idToken = tokens[iToParse];
      consume();

      var parameters = {};
      while (has(IDENTIFIER) && has(COLON, 1)) {
        var parameterNameToken = tokens[iToParse];
        consume(); // eat parameter name
        consume(); // eat colon
        var parameterValueToken = e1();
        parameters[parameterNameToken.source] = parameterValueToken;
      }

      atom = new ExpressionCall(idToken.source, parameters);
    } else if (has(LEFT_BRACKET)) {
      consume();
      var elements = [];

      if (iToParse < tokens.length && !has(RIGHT_BRACKET)) {
        elements.push(e1()); 
        while (has(COMMA)) {
          consume();
          elements.push(e1()); 
        }
      }

      if (has(RIGHT_BRACKET)) {
        consume();
      } else {
        throw 'Expected ]';
      }

      atom = new ExpressionArrayLiteral(elements);
    } else {
      throw 'unknown atom: ' + tokens[iToParse];
    }

    return atom;
  }

  var program = function() {
    var statements = [];
    while (!has(EOF)) {
      statements.push(statement());
    }
    return new Block(statements);
  }

  return program();
}

const fs = require('fs');
var source = fs.readFileSync('foo.two').toString();
var tokens = lex(source);
console.log(tokens);
var ast = parse(tokens);
console.log("ast.toString():", ast.toString());
var program = new Program(ast);

console.log(program.execute());
