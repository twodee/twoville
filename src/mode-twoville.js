ace.define('ace/mode/twoville', ['require', 'exports', 'module' , 'ace/lib/oop', 'ace/mode/text', 'ace/tokenizer', 'ace/mode/twoville_highlight_rules'], function(require, exports, module) {

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var Tokenizer = require("../tokenizer").Tokenizer;
var Range = ace.require('ace/range').Range;
var TwovilleHighlightRules = require("./twoville_highlight_rules").TwovilleHighlightRules;

var Mode = function() {
  this.HighlightRules = TwovilleHighlightRules;
};
oop.inherits(Mode, TextMode);

(function() {
  this.lineCommentStart = "//";
    
  this.getNextLineIndent = function(state, line, tab) {
    var match = line.match(/^\s*/);
    var currentIndent = match[0];
    if (/^\s*(if|else|to|for|repeat|while|then|around|with)\b/.test(line)) {
      return currentIndent + '  ';
    } else {
      return currentIndent;
    }
  };

  // Do I need to fix the indent?
  this.checkOutdent = function(state, line, input) {
    return /^\s{2,}(en|els|aroun)\s*$/.test(line);
  };

  // Fix the indent.
  this.autoOutdent = function(state, doc, row) {
    var line = doc.getLine(row);
    var match = line.match(/^\s{2,}(end|else|around)\b/);
    if (match) {
      doc.replace(new Range(row, 0, row, 2), '');
    }
  };
}).call(Mode.prototype);

exports.Mode = Mode;
});

ace.define('ace/mode/twoville_highlight_rules', ['require', 'exports', 'module' , 'ace/lib/oop', 'ace/mode/text_highlight_rules'], function(require, exports, module) {

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var TwovilleHighlightRules = function() {
  this.$rules = {
    "start" : [
      {
        token: "comment",
        regex: "//.*$",
        next: "start"
      },
      {
        token: "support.function",
        regex: /[\[\]\(\)]/,
        next: "start"
      },
      {
        token: "keyword.operator",
        regex: /->|\^=|==|!=|<=|>=|[-<>#+~/%*=^]/,
        next: "start"
      },
      {
        token: "keyword",
        regex: /\b(?:repeat|and|or|not|with|from|to|for|through|in|else|if|then|around)\b/,
        next: "start"
      },
      {
        token: "constant.language",
        regex: /:[A-Za-z][-A-Za-z0-9]*/,
        next: "start"
      },
      {
        token: "variable",
        regex: /[a-zA-Z]\w*/,
        next: "start"
      },
      {
        token: "constant.character",
        regex: /'[^']'/,
        next: "start"
      },
      {
        token: "string",
        regex: /"[^"]*"/,
        next: "start"
      },
      {
        token: "constant.numeric",
        regex: /-?\d+(?:\.(?!\.)\d*)?/,
        next: "start"
      }
    ],
  };
};

oop.inherits(TwovilleHighlightRules, TextHighlightRules);

exports.TwovilleHighlightRules = TwovilleHighlightRules;

});
