// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function (mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function (CodeMirror) {
  var ie_lt8 = /MSIE \d/.test(navigator.userAgent) &&
    (document.documentMode == null || document.documentMode < 8);

  var Pos = CodeMirror.Pos;

  var matching = {"(": ")>", ")": "(<", "[": "]>", "]": "[<", "{": "}>", "}": "{<"};

  function bracketRegex(config) {
    return config && config.bracketRegex || /[(){}[\]]/
  }

  function findMatchingBracket(cm, where, config) {
    var line = cm.getLineHandle(where.line), pos = where.ch - 1;
    var lineNum = where.line;
    var afterCursor = config && config.afterCursor
    if (afterCursor == null)
      afterCursor = /(^| )cm-fat-cursor($| )/.test(cm.getWrapperElement().className)

    var re = bracketRegex(config)

    // A cursor is defined as between two characters, but in in vim command mode
    // (i.e. not insert mode), the cursor is visually represented as a
    // highlighted box on top of the 2nd character. Otherwise, we allow matches
    // from before or after the cursor.
    var match = (!afterCursor && pos >= 0 && re.test(line.text.charAt(pos)) && matching[line.text.charAt(pos)]) ||
      re.test(line.text.charAt(pos + 1)) && matching[line.text.charAt(++pos)];

    //old code: only matching ch before/after the cursor
    if (!match) return null;
    var dir = match.charAt(1) == ">" ? 1 : -1;
    if (config && config.strict && (dir > 0) != (pos == where.ch)) return null;
    var style = cm.getTokenTypeAt(Pos(where.line, pos + 1));

    var found = scanForBracket(cm, Pos(where.line, pos + (dir > 0 ? 1 : 0)), dir, style || null, config);
    if (found == null) return null;
    return {
      from: Pos(where.line, pos), to: found && found.pos,
      match: found && found.ch == match.charAt(0), forward: dir > 0
    };
  }

  function scanForBracket(cm, where, dir, style, config) {
    var maxScanLen = (config && config.maxScanLineLength) || 10000;
    var maxScanLines = (config && config.maxScanLines) || 1000;

    var stack = [];
    var re = bracketRegex(config)
    var lineEnd = dir > 0 ? Math.min(where.line + maxScanLines, cm.lastLine() + 1)
      : Math.max(cm.firstLine() - 1, where.line - maxScanLines);
    for (var lineNo = where.line; lineNo != lineEnd; lineNo += dir) {
      var line = cm.getLine(lineNo);
      if (!line) continue;
      var pos = dir > 0 ? 0 : line.length - 1, end = dir > 0 ? line.length : -1;
      if (line.length > maxScanLen) continue;
      if (lineNo == where.line) pos = where.ch - (dir < 0 ? 1 : 0);
      for (; pos != end; pos += dir) {
        var ch = line.charAt(pos);
        if (re.test(ch) && (style === undefined || cm.getTokenTypeAt(Pos(lineNo, pos + 1)) == style)) {
          var match = matching[ch];
          if (match && (match.charAt(1) == ">") == (dir > 0)) stack.push(ch);
          else if (!stack.length) return {pos: Pos(lineNo, pos), ch: ch};
          else stack.pop();
        }
      }
    }
    return lineNo - dir == (dir > 0 ? cm.lastLine() : cm.firstLine()) ? false : null;
  }

  function matchBrackets(cm, config) {
    // Disable brace matching in long lines, since it'll cause hugely slow updates
    var maxHighlightLen = cm.state.matchBrackets.maxHighlightLineLength || 1000;
    var marks = [], ranges = cm.listSelections();
    // console.log(ranges[0]);
    for (var i = 0; i < ranges.length; i++) {
      var match = ranges[i].empty() && findMatchingBracket(cm, ranges[i].head, config);
      if (match && cm.getLine(match.from.line).length <= maxHighlightLen) {
        // old code below
        // var style = match.match ? "CodeMirror-matchingbracket" : "CodeMirror-nonmatchingbracket";
        // var scopeStyle = "CodeMirror-matchingbracketscope";
        // marks.push(cm.markText(match.from, Pos(match.from.line, match.from.ch + 1), {className: style}));
        // if (match.to && cm.getLine(match.to.line).length <= maxHighlightLen)
        //   marks.push(cm.markText(match.to, Pos(match.to.line, match.to.ch + 1), {className: style}));
        //   //added for highlighting scope
        //   if (match.from.line < match.to.line || (match.from.line == match.to.line && match.from.ch < match.to.ch)) {
        //     marks.push(cm.markText(match.from, Pos(match.to.line, match.to.ch+1), {className: "highlighted-scope"}));
        //   } else if (match.to) { // if there's a match
        //     marks.push(cm.markText(match.to, Pos(match.from.line, match.from.ch + 1), {className: "highlighted-scope"}));
        //   }

        if (match.match) {
          var style = "CodeMirror-matchingbracket";
          // var scopeStyle = "CodeMirror-matchingbracketscope";
          marks.push(cm.markText(match.from, Pos(match.from.line, match.from.ch + 1), {className: style}));
          if (match.to && cm.getLine(match.to.line).length <= maxHighlightLen)
            marks.push(cm.markText(match.to, Pos(match.to.line, match.to.ch + 1), {className: style}));
          //added for highlighting scope
          if (match.from.line < match.to.line || (match.from.line == match.to.line && match.from.ch < match.to.ch)) {
            marks.push(cm.markText(match.from, Pos(match.to.line, match.to.ch + 1), {className: "highlighted-scope"}));
          } else if (match.to) { // if there's a match
            marks.push(cm.markText(match.to, Pos(match.from.line, match.from.ch + 1), {className: "highlighted-scope"}));
          }
        }

      }
    }

    return marks;
  }

  function highlightUnbalancedBrackets(cm, config) {
    var stack = [], marks = [];
    var style = "CodeMirror-nonmatchingbracket";
    for (var l = cm.firstLine(); l <= cm.lastLine(); l++) {
      var line = cm.getLineHandle(l);
      for (var pos = 0; pos < line.text.length; pos++) {
        var bracketMatch = matching[line.text.charAt(pos)];
        if (!bracketMatch) continue;
        var openBracket = bracketMatch.charAt(1) == ">";
        if (openBracket) {
          stack.push({"text": line.text.charAt(pos), "where": Pos(l, pos)});
        } else { // closeBracket
          var last = stack[stack.length - 1];
          if (last && bracketMatch.charAt(0) == last.text) {
            stack.pop();
          } else {
            marks.push(cm.markText(Pos(l, pos), Pos(l, pos + 1), {className: style}));
          }
        }
      }
    }
    if (stack.length) {
      for (var s = 0; s < stack.length; s++) {
        var where = stack[s].where;
        marks.push(cm.markText(where, Pos(where.line, where.ch + 1), {className: style}));
      }
    }
    var isBalancedIndicator = document.getElementById("isBalanced");
    if (isBalancedIndicator) {
      if (marks.length) {
        document.getElementById("isBalanced").innerHTML = "not balanced";
      } else {
        document.getElementById("isBalanced").innerHTML = "balanced";
      }
    }

    return marks;
  }

  // wrapper function
  function highlightBrackets(cm, autoclear, config) {
    var marks = highlightUnbalancedBrackets(cm, config);
    var matchMarks = matchBrackets(cm, config);
    marks.push(...matchMarks);

    if (marks.length) {
      // Kludge to work around the IE bug from issue #1193, where text
      // input stops going to the textare whever this fires.
      if (ie_lt8 && cm.state.focused) cm.focus();

      var clear = function () {
        cm.operation(function () {
          for (var i = 0; i < marks.length; i++) marks[i].clear();
        });
      };
      if (autoclear) setTimeout(clear, 800);
      else return clear;
    }
  }

  function doMatchBrackets(cm) {
    cm.operation(function () {
      if (cm.state.matchBrackets.currentlyHighlighted) {
        cm.state.matchBrackets.currentlyHighlighted();
      }
      cm.state.matchBrackets.currentlyHighlighted = highlightBrackets(cm, false, cm.state.matchBrackets);
    });
  }

  function boundariesAround(stream, re) {
    return (!stream.start || !re.test(stream.string.charAt(stream.start - 1))) &&
      (stream.pos == stream.string.length || !re.test(stream.string.charAt(stream.pos)));
  }

  function makeOverlay(query, hasBoundary, style) {
    return {
      token: function (stream) {
        if (stream.match(query) &&
          (!hasBoundary || boundariesAround(stream, hasBoundary)))
          return style;
        stream.next();
        stream.skipTo(query.charAt(0)) || stream.skipToEnd();
      }
    };
  }

  CodeMirror.defineOption("matchBrackets", false, function (cm, val, old) {
    if (old && old != CodeMirror.Init) {
      cm.off("cursorActivity", doMatchBrackets);
      if (cm.state.matchBrackets && cm.state.matchBrackets.currentlyHighlighted) {
        cm.state.matchBrackets.currentlyHighlighted();
      }
    }
    if (val) {
      cm.state.matchBrackets = typeof val == "object" ? val : {};
      cm.on("cursorActivity", doMatchBrackets);
    }
  });

  CodeMirror.defineExtension("matchBrackets", function () {
    matchBrackets(this, SVGComponentTransferFunctionElement);
  });
  CodeMirror.defineExtension("findMatchingBracket", function (pos, config, oldConfig) {
    // Backwards-compatibility kludge
    if (oldConfig || typeof config == "boolean") {
      if (!oldConfig) {
        config = config ? {strict: true} : null
      } else {
        oldConfig.strict = config;
        config = oldConfig;
      }
    }
    return findMatchingBracket(this, pos, config);
  });
  CodeMirror.defineExtension("scanForBracket", function (pos, dir, style, config) {
    return scanForBracket(this, pos, dir, style, config);
  });
});
