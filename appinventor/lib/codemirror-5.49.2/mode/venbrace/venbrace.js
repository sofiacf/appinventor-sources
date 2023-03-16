// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

/**
 * Author: Koh Zi Han, based on implementation by Koh Zi Chun
 */



(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.defineMode("venbrace", function () {
    var BUILTIN = "builtin", COMMENT = "comment", STRING = "string",
        ATOM = "atom", NUMBER = "number", BRACKET = "bracket";
    var INDENT_WORD_SKIP = 2;

    function makeKeywords(words) {
        var obj = {};//, words = str.split(" ");
        var brackets = ["'{'", "'}'", "'('", "')'", "'['", "']'", 
        "','", "'==='", "'.'", "'<-'", "':'"]
        for (var i = 0; i < words.length; ++i) {
            if (words[i] != null && !(words[i] in brackets)) {
                // get rid of the single quotation marks
                var word = words[i].substr(1, (words[i].length-2));
                obj[word] = true;
            }
        }
        return obj;
    }

    //TODO: automate this
    var VenbraceKeywords = [ null, "'y'", "'x'", null, "'{'", "'}'", "'('", "')'", 
    "'['", "']'", "','", "'==='", "'.'", "'<-'", "':'", 
    "'true'", "'false'", "'when'", "'if'", "'then'", "'else'", 
    "'else if'", "'for'", "'each'", "'do'", "'result'", "'to'", 
    "'call'", "'get'", "'set'", "'global'", "'initialize'", 
    "'local'", "'in'", "'by'", "'from'", "'while'", "'test'", 
    "'screenName'", "'startValue'", "'break'", 
    "'not'", "'and'", "'or'", "'xor'", "'<'", "'>'", "'<='", 
    "'>='", "'='", "'!='", null, null, "'+'", "'-'", "'*'", 
    "'/'", "'^'", "'decimal'", "'binary'", "'octal'", "'hexadecimal'", 
    "'bitwise'", "'square'", "'root'", "'absolute'", "'neg'", 
    "'log'", "'e^'", "'round'", "'ceiling'", "'floor'", 
    "'random'","' integer'", "'random'", "'fraction'", "'min'", "'max'", 
    "'modulo'", "'remainder'", "'quotient'", "'of'", "'convert'", 
    "'sin'", "'cos'", "'tan'", "'asin'", "'acos'", "'atan'", 
    "'atan2'", "'join'", "'length'", "'is'","'empty'", "'compare'", "'texts'", 
    "'trim'", "'upcase'", "'downcase'", "'starts'", "'at'", 
    "'contains'", "'split'", "'first'", "'any'", 
    "'of'", "'spaces'", "'segment'", 
    "'replace'", "'all'", "'replacement'", 
    "'reverse'", "'mappings'", "'in'",  
    "'index'","'list'", "'thing'",
    "'preferring'", "'longest string first'", "'dictionary'" ];
    // var VenbraceKeywords = [ null, null, "'{'", "'}'", "'('", "')'", "'['", "']'", 
    //                  "','", "'==='", "'.'", "'<-'", "':'", "'true'", "'false'", 
    //                  "'when'", "'if'", "'then'", "'else'", "'else if'", 
    //                  "'forEach'", "'do'", "'result'", "'to'", "'call'", 
    //                  "'get'", "'set'", "'global'", "'in'", "'by'", "'from'", 
    //                  "'while'", "'test'", "'evaluateButIgnoreResult'", "'openAnotherScreen'", 
    //                  "'closeScreen'", "'closeApplication'", "'initialize'", 
    //                  "'local'", "'getStartValue'", "'getPlainStartText'", 
    //                  "'not'", "'and'", "'or'", "'<'", "'>'", "'<='", "'>='", 
    //                  "'equals'", "'not_equals'", "'='", "'!='", "'+'", "'-'", 
    //                  "'*'", "'/'", "'^'", "'sqrt'", "'absolute'", "'neg'", 
    //                  "'log'", "'e^'", "'round'", "'ceiling'", "'floor'", 
    //                  "'randomInteger'", "'randomFraction'", "'min'", "'max'", 
    //                  "'moduloOf'", "'remainderOf'", "'quotientOf'", "'radiansToDegrees'", 
    //                  "'degreesToRadians'", "'formatAsDecimal'", "'isNumber'", 
    //                  "'sin'", "'cos'", "'tan'", "'asin'", "'acos'", "'atan'", 
    //                  "'color'", "'make_color'", "'black'", "'blue'", "'white'", 
    //                  "'magenta'", "'red'", "'light_gray'", "'pink'", "'gray'", 
    //                  "'orange'", "'dark_gray'", "'yellow'", "'green'", "'cyan'", 
    //                  "'make_a_list'", "'list'" ];


    var keywords = makeKeywords(VenbraceKeywords);
    // hardcoded for now
    var indentKeys = ["for each", "do", "result", "to", "initialize",
                        "while"];

    function stateStack(indent, type, prev) { // represents a state stack object
        this.indent = indent;
        this.type = type;
        this.prev = prev;
    }

    function pushStack(state, indent, type) {
        state.indentStack = new stateStack(indent, type, state.indentStack);
    }

    function popStack(state) {
        state.indentStack = state.indentStack.prev;
    }

    var binaryMatcher = new RegExp(/^(?:[-+]i|[-+][01]+#*(?:\/[01]+#*)?i|[-+]?[01]+#*(?:\/[01]+#*)?@[-+]?[01]+#*(?:\/[01]+#*)?|[-+]?[01]+#*(?:\/[01]+#*)?[-+](?:[01]+#*(?:\/[01]+#*)?)?i|[-+]?[01]+#*(?:\/[01]+#*)?)(?=[()\s;"]|$)/i);
    var octalMatcher = new RegExp(/^(?:[-+]i|[-+][0-7]+#*(?:\/[0-7]+#*)?i|[-+]?[0-7]+#*(?:\/[0-7]+#*)?@[-+]?[0-7]+#*(?:\/[0-7]+#*)?|[-+]?[0-7]+#*(?:\/[0-7]+#*)?[-+](?:[0-7]+#*(?:\/[0-7]+#*)?)?i|[-+]?[0-7]+#*(?:\/[0-7]+#*)?)(?=[()\s;"]|$)/i);
    var hexMatcher = new RegExp(/^(?:[-+]i|[-+][\da-f]+#*(?:\/[\da-f]+#*)?i|[-+]?[\da-f]+#*(?:\/[\da-f]+#*)?@[-+]?[\da-f]+#*(?:\/[\da-f]+#*)?|[-+]?[\da-f]+#*(?:\/[\da-f]+#*)?[-+](?:[\da-f]+#*(?:\/[\da-f]+#*)?)?i|[-+]?[\da-f]+#*(?:\/[\da-f]+#*)?)(?=[()\s;"]|$)/i);
    var decimalMatcher = new RegExp(/^(?:[-+]i|[-+](?:(?:(?:\d+#+\.?#*|\d+\.\d*#*|\.\d+#*|\d+)(?:[esfdl][-+]?\d+)?)|\d+#*\/\d+#*)i|[-+]?(?:(?:(?:\d+#+\.?#*|\d+\.\d*#*|\.\d+#*|\d+)(?:[esfdl][-+]?\d+)?)|\d+#*\/\d+#*)@[-+]?(?:(?:(?:\d+#+\.?#*|\d+\.\d*#*|\.\d+#*|\d+)(?:[esfdl][-+]?\d+)?)|\d+#*\/\d+#*)|[-+]?(?:(?:(?:\d+#+\.?#*|\d+\.\d*#*|\.\d+#*|\d+)(?:[esfdl][-+]?\d+)?)|\d+#*\/\d+#*)[-+](?:(?:(?:\d+#+\.?#*|\d+\.\d*#*|\.\d+#*|\d+)(?:[esfdl][-+]?\d+)?)|\d+#*\/\d+#*)?i|(?:(?:(?:\d+#+\.?#*|\d+\.\d*#*|\.\d+#*|\d+)(?:[esfdl][-+]?\d+)?)|\d+#*\/\d+#*))(?=[()\s;"]|$)/i);

    function isBinaryNumber (stream) {
        return stream.match(binaryMatcher);
    }

    function isOctalNumber (stream) {
        return stream.match(octalMatcher);
    }

    function isDecimalNumber (stream, backup) {
        if (backup === true) {
            stream.backUp(1);
        }
        return stream.match(decimalMatcher);
    }

    function isHexNumber (stream) {
        return stream.match(hexMatcher);
    }

    return {
        startState: function () {
            return {
                indentStack: null,
                indentation: 0,
                mode: false,
                sExprComment: false,
                sExprQuote: false
            };
        },

        token: function (stream, state) {
            if (state.indentStack == null && stream.sol()) {
                // update indentation, but only if indentStack is empty
                state.indentation = stream.indentation();
            }

            // skip spaces
            if (stream.eatSpace()) {
                return null;
            }
            var returnType = null;

            switch(state.mode){
                case "string": // multi-line string parsing mode
                    var next, escaped = false;
                    while ((next = stream.next()) != null) {
                        if (next == "\"" && !escaped) {

                            state.mode = false;
                            break;
                        }
                        escaped = !escaped && next == "\\";
                    }
                    returnType = STRING; // continue on in scheme-string mode
                    break;
                case "comment": // comment parsing mode
                    var next, maybeEnd = false;
                    while ((next = stream.next()) != null) {
                        if (next == "#" && maybeEnd) {

                            state.mode = false;
                            break;
                        }
                        maybeEnd = (next == "|");
                    }
                    returnType = COMMENT;
                    break;
                case "s-expr-comment": // s-expr commenting mode
                    state.mode = false;
                    if(stream.peek() == "(" || stream.peek() == "["){
                        // actually start scheme s-expr commenting mode
                        state.sExprComment = 0;
                    }else{
                        // if not we just comment the entire of the next token
                        stream.eatWhile(/[^\s\(\)\[\]]/); // eat symbol atom
                        returnType = COMMENT;
                        break;
                    }
                default: // default parsing mode
                    var ch = stream.next();

                    if (ch == "\"") {
                        state.mode = "string";
                        returnType = STRING;

                    } else if (ch == "'") {
                        if (stream.peek() == "(" || stream.peek() == "["){
                            if (typeof state.sExprQuote != "number") {
                                state.sExprQuote = 0;
                            } // else already in a quoted expression
                            returnType = ATOM;
                        } else {
                            stream.eatWhile(/[\w_\-!$%&*+\.:<=>?@\^~]/);
                            returnType = ATOM;
                        }
                    } else if (ch == '#') {
                        if (stream.eat("|")) {                    // Multi-line comment
                            state.mode = "comment"; // toggle to comment mode
                            returnType = COMMENT;
                        } else if (stream.eat(/[tf]/i)) {            // #t/#f (atom)
                            returnType = ATOM;
                        } else if (stream.eat(';')) {                // S-Expr comment
                            state.mode = "s-expr-comment";
                            returnType = COMMENT;
                        } else {
                            var numTest = null, hasExactness = false, hasRadix = true;
                            if (stream.eat(/[ei]/i)) {
                                hasExactness = true;
                            } else {
                                stream.backUp(1);       // must be radix specifier
                            }
                            if (stream.match(/^#b/i)) {
                                numTest = isBinaryNumber;
                            } else if (stream.match(/^#o/i)) {
                                numTest = isOctalNumber;
                            } else if (stream.match(/^#x/i)) {
                                numTest = isHexNumber;
                            } else if (stream.match(/^#d/i)) {
                                numTest = isDecimalNumber;
                            } else if (stream.match(/^[-+0-9.]/, false)) {
                                hasRadix = false;
                                numTest = isDecimalNumber;
                            // re-consume the intial # if all matches failed
                            } else if (!hasExactness) {
                                stream.eat('#');
                            }
                            if (numTest != null) {
                                if (hasRadix && !hasExactness) {
                                    // consume optional exactness after radix
                                    stream.match(/^#[ei]/i);
                                }
                                if (numTest(stream))
                                    returnType = NUMBER;
                            }
                        }
                    } else if (/^[-+0-9.]/.test(ch) && isDecimalNumber(stream, true)) { // match non-prefixed number, must be decimal
                        returnType = NUMBER;
                    } else if (ch == "/" && stream.eat('/')) { // comment
                        stream.skipToEnd(); // rest of the line is a comment
                        returnType = COMMENT;
                    } else if (ch == "(" || ch == "[" || ch == "{") {
                      var keyWord = ''; var indentTemp = stream.column(), letter;
                        /**
                        Either
                        (indent-word ..
                        (non-indent-word ..
                        (;something else, bracket, etc.
                        */

                        while ((letter = stream.eat(/[^\s\(\[\{\;\)\]\}]/)) != null) {
                            keyWord += letter;
                        }

                        if (keyWord.length > 0 && indentKeys.propertyIsEnumerable(keyWord)) { // indent-word

                            pushStack(state, indentTemp + INDENT_WORD_SKIP, ch);
                        } else { // non-indent word
                            // we continue eating the spaces
                            stream.eatSpace();
                            if (stream.eol() || stream.peek() == ";") {
                                // nothing significant after
                                // we restart indentation 1 space after
                                pushStack(state, indentTemp + 1, ch);
                            } else {
                                pushStack(state, indentTemp + stream.current().length, ch); // else we match
                            }
                        }
                        stream.backUp(stream.current().length - 1); // undo all the eating

                        if(typeof state.sExprComment == "number") state.sExprComment++;
                        if(typeof state.sExprQuote == "number") state.sExprQuote++;

                        returnType = BRACKET;
                    } else if (ch == ")" || ch == "]" || ch == "}") {
                        returnType = BRACKET;
                        var matchBracket = null;
                        switch (ch) {
                            case "]":
                                matchBracket = "[";
                                break;
                            case "}":
                                matchBracket = "{";
                                break;
                            case ")":
                                matchBracket = "(";
                                break;
                            default: // ch == ")"
                                matchBracket = "(";
                        }
                        
                        if (state.indentStack != null && state.indentStack.type == matchBracket) {
                            popStack(state);
                        }
                    } else {
                        stream.eatWhile(/[\w_\-!$%&*+\.:<=>?@\^~]/);

                        if (keywords && keywords.propertyIsEnumerable(stream.current())) {
                            returnType = BUILTIN;
                        } else returnType = "variable";
                    }
            }
            return (typeof state.sExprComment == "number") ? COMMENT : ((typeof state.sExprQuote == "number") ? ATOM : returnType);
        },

        indent: function (state) {
            if (state.indentStack == null) return state.indentation;
            return state.indentStack.indent;
        },

        closeBrackets: {pairs: "()[]{}\"\""},
        lineComment: "//"
    };
});

CodeMirror.defineMIME("text/x-scheme", "venbrace");

});
