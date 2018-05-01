/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS202: Simplify dynamic range loops
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Droplet CoffeeScript mode
//
// Copyright (c) Anthony Bau (dab1998@gmail.com)
// MIT License

let CoffeeScriptParser;
const helper = require('../helper');
const model = require('../model');
const parser = require('../parser');

const {fixQuotedString, looseCUnescape, quoteAndCEscape} = helper;

const {CoffeeScript} = require('../../vendor/coffee-script.js');

const ANY_DROP = ['any-drop'];
const BLOCK_ONLY = ['block-only'];
const MOSTLY_BLOCK = ['mostly-block'];
const MOSTLY_VALUE = ['mostly-value'];
const VALUE_ONLY = ['value-only'];
const LVALUE = ['lvalue'];
const FORBID_ALL = ['forbid-all'];
const PROPERTY_ACCESS = ['prop-access'];

const KNOWN_FUNCTIONS = {
  'alert'       : {},
  'prompt'      : {},
  'console.log' : {},
  '*.toString'  : {},
  'Math.abs'    : {value: true},
  'Math.acos'   : {value: true},
  'Math.asin'   : {value: true},
  'Math.atan'   : {value: true},
  'Math.atan2'  : {value: true},
  'Math.cos'    : {value: true},
  'Math.sin'    : {value: true},
  'Math.tan'    : {value: true},
  'Math.ceil'   : {value: true},
  'Math.floor'  : {value: true},
  'Math.round'  : {value: true},
  'Math.exp'    : {value: true},
  'Math.ln'     : {value: true},
  'Math.log10'  : {value: true},
  'Math.pow'    : {value: true},
  'Math.sqrt'   : {value: true},
  'Math.max'    : {value: true},
  'Math.min'    : {value: true},
  'Math.random' : {value: true}
};

const STATEMENT_KEYWORDS = [
  'break',
  'continue'
];

const CATEGORIES = {
  functions: {color: 'purple'},
  returns: {color: 'yellow'},
  comments: {color: 'gray'},
  arithmetic: {color: 'green'},
  logic: {color: 'cyan'},
  containers: {color: 'teal'},
  assignments: {color: 'blue'},
  loops: {color: 'orange'},
  conditionals: {color: 'orange'},
  value: {color: 'green'},
  command: {color: 'blue'},
  errors: {color: '#f00'}
};

const NODE_CATEGORY = {
  Parens: 'command',
  Op: 'value',         // overridden by operator test
  Existence: 'logic',
  In: 'logic',
  Value: 'value',
  Literal: 'value',    // overridden by break, continue, errors
  Call: 'command',     // overridden by complicated logic
  Code: 'functions',
  Class: 'functions',
  Assign: 'assignments',  // overriden by test for function definition
  For: 'loops',
  While: 'loops',
  If: 'conditionals',
  Switch: 'conditionals',
  Range: 'containers',
  Arr: 'containers',
  Obj: 'containers',
  Return: 'returns'
};

const LOGICAL_OPERATORS = {
  '==': true,
  '!=': true,
  '===': true,
  '!==': true,
  '<': true,
  '<=': true,
  '>': true,
  '>=': true,
  'in': true,
  'instanceof': true,
  '||': true,
  '&&': true,
  '!': true
};

/*
OPERATOR_PRECEDENCES =
  '*': 5
  '/': 5
  '%': 5
  '+': 6
  '-': 6
  '<<': 7
  '>>': 7
  '>>>': 7
  '<': 8
  '>': 8
  '>=': 8
  'in': 8
  'instanceof': 8
  '==': 9
  '!=': 9
  '===': 9
  '!==': 9
  '&': 10
  '^': 11
  '|': 12
  '&&': 13
  '||': 14
*/

const OPERATOR_PRECEDENCES = {
  '||': 1,
  '&&': 2,
  'instanceof': 3,
  '===': 3,
  '!==': 3,
  '>': 3,
  '<': 3,
  '>=': 3,
  '<=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  '%': 6,
  '**': 7,
  '%%': 7
};

const YES = () => true;
const NO = () => false;

const spacestring = n => (__range__(0, Math.max(0, n), false).map((i) => ' ')).join('');

const getClassesFor = function(node) {
  const classes = [];

  classes.push(node.nodeType());
  if ((node.nodeType() === 'Call') && (!node.do) && (!node.isNew)) {
    classes.push('works-as-method-call');
  }

  return classes;
};

var annotateCsNodes = function(tree) {
  tree.eachChild(function(child) {
    child.dropletParent = tree;
    return annotateCsNodes(child);
  });
  return tree;
};

exportsScriptParser = (CoffeeScriptParser = class CoffeeScriptParser extends parser.Parser {
  constructor(text, opts) {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
      eval(`${thisName} = this;`);
    }
    this.text = text;
    super(...arguments);

    if (this.opts.functions == null) { this.opts.functions = KNOWN_FUNCTIONS; }
    this.opts.categories = helper.extend({}, CATEGORIES, this.opts.categories);

    this.lines = this.text.split('\n');

    this.hasLineBeenMarked = {};

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      this.hasLineBeenMarked[i] = false;
    }
  }

  markRoot() {
    // Preprocess comments
    let nodes;
    let retries = Math.max(1, Math.min(5, Math.ceil(this.lines.length / 2)));
    let firstError = null;
    // Get the CoffeeScript AST from the text
    while (true) {
      try {
        (this.stripComments)();

        const tree = CoffeeScript.nodes(this.text);
        annotateCsNodes(tree);
        nodes = tree.expressions;
        break;
      } catch (e) {
        if (firstError == null) { firstError = e; }
        if ((retries > 0) && fixCoffeeScriptError(this.lines, e)) {
          this.text = this.lines.join('\n');
        } else {
          // If recovery isn't possible, insert a loc object with
          // the possible location of the error, and throw the error.
          if (firstError.location) {
            firstError.loc = {
              line: firstError.location.first_line,
              column: firstError.location.first_column
            };
          }
          throw firstError;
        }
      }
      retries -= 1;
    }

    // Mark all the nodes
    // in the block.
    for (let node of Array.from(nodes)) {
      this.mark(node, 3, 0, null, 0);
    }

    // Deal with semicoloned lines
    // at the root level
    return this.wrapSemicolons(nodes, 0);
  }

  isComment(str) {
    return (str.match(/^\s*#.*$/) != null);
  }

  parseComment(str) {
    return {
      sockets: [[__guard__(str.match(/^\s*#/), x => x[0].length), str.length]]
    };
  }

  stripComments() {
    // Preprocess comment lines:
    let tokens;
    try {
      tokens = CoffeeScript.tokens(this.text, {
        rewrite: false,
        preserveComments: true
      }
      );
    } catch (syntaxError) {
      // Right now, we do not attempt to recover from failures in tokenization
      if (syntaxError.location) {
        syntaxError.loc = {
          line: syntaxError.location.first_line,
          column: syntaxError.location.first_column
        };
      }
      throw syntaxError;
    }

    // In the @lines record, replace all
    // comments with spaces, so that blocks
    // avoid them whenever possible.
    for (let token of Array.from(tokens)) {
      if (token[0] === 'COMMENT') {

        var line;
        if (token[2].first_line === token[2].last_line) {
          line = this.lines[token[2].first_line];
          this.lines[token[2].first_line] =
            line.slice(0, token[2].first_column) +
            spacestring((token[2].last_column - token[2].first_column) + 1) +
            line.slice(token[2].last_column);

        } else {
          line = this.lines[token[2].first_line];
          this.lines[token[2].first_line] = line.slice(0, token[2].first_column) +
            spacestring(line.length - token[2].first_column);

          this.lines[token[2].last_line] =
            spacestring(token[2].last_column + 1) +
              this.lines[token[2].last_line].slice(token[2].last_column + 1);

          for (let start = token[2].first_line + 1, i = start, end = token[2].last_line, asc = start <= end; asc ? i < end : i > end; asc ? i++ : i--) {
            this.lines[i] = spacestring(this.lines[i].length);
          }
        }
      }
    }

    // We will leave comments unmarked
    // until the applyMarkup postprocessing
    // phase, when they will be surrounded
    // by blocks if they are outside anything else.
    return null;
  }

  functionNameNodes(node) {
    if (node.nodeType() !== 'Call') { throw new Error; }
    if (node.variable != null) {
      // Two possible forms of a Call node:
      // fn(...) ->
      //    node.variable.base = fn
      // x.y.z.fn()
      //    node.variable.base = x
      //    properties = [y, z, fn]
      const nodes = [];
      if ((node.variable.base != null ? node.variable.base.value : undefined)) {
        nodes.push(node.variable.base);
      } else {
        nodes.push(null);
      }
      if (node.variable.properties != null) {
        for (let prop of Array.from(node.variable.properties)) {
          nodes.push(prop.name);
        }
      }
      return nodes;
    }
    return [];
  }

  emptyLocation(loc) {
    return (loc.first_column === loc.last_column) && (loc.first_line === loc.last_line);
  }

  implicitName(nn) {
    // Deal with weird coffeescript rewrites, e.g., /// #{x} ///
    // is rewritten to RegExp(...)
    if (nn.length === 0) { return false; }
    const node = nn[nn.length - 1];
    return (__guard__(node != null ? node.value : undefined, x => x.length) > 1) && this.emptyLocation(node.locationData);
  }

  lookupFunctionName(nn) {
    // Test the name nodes list against the given list, and return
    // null if not found, or a tuple of information about the match.
    let wildcard;
    const full = (nn.map(n => (n != null ? n.value : undefined) || '*')).join('.');
    if (full in this.opts.functions) {
      return {name: full, anyobj: false, fn: this.opts.functions[full]};
    }
    const last = __guard__(nn[nn.length - 1], x => x.value);
    if ((nn.length > 1) && !((wildcard = `*.${last}`) in this.opts.functions)) {
      wildcard = null;  // no match for '*.name'
    }
    if (!wildcard && !((wildcard = `?.${last}`) in this.opts.functions)) {
      wildcard = null;  // no match for '?.name'
    }
    if (wildcard !== null) {
      return {name: last, anyobj: true, fn: this.opts.functions[wildcard]};
    }
    return null;
  }

  // ## addCode ##
  // This shared logic handles the sockets for the Code function
  // definitions, even when merged into a parent block.
  addCode(node, depth, indentDepth) {
    // Combining all the parameters into one socket
    if ((node.params != null ? node.params.length : undefined) != null ? (node.params != null ? node.params.length : undefined) : 0 > 0) {
      this.addSocket({
        bounds: this.boundCombine(this.getBounds(node.params[0]), this.getBounds(node.params[node.params.length - 1])),
        depth,
        precedence: 0,
        dropdown: null,
        classes: ['forbid-all', '__function_param__'],
        empty: ''
      });

    // If there are no parameters, attempt to insert an empty socket so the user can add some
    } else {
      const nodeBoundsStart = this.getBounds(node).start;
      const match = this.lines[nodeBoundsStart.line].slice(nodeBoundsStart.column).match(/^(\s*\()(\s*)\)\s*(-|=)>/);
      if (match != null) {
        this.addSocket({
          bounds: {
            start: {
              line: nodeBoundsStart.line,
              column: nodeBoundsStart.column + match[1].length
            },
            end: {
              line: nodeBoundsStart.line,
              column: nodeBoundsStart.column + match[1].length + match[2].length
            }
          },
          depth,
          precedence: 0,
          dropdown: null,
          classes: ['forbid-all', '__function_param__'],
          empty: ''
        });
      }
    }
    return this.mark(node.body, depth, 0, null, indentDepth);
  }

  // ## mark ##
  // Mark a single node.  The main recursive function.
  mark(node, depth, precedence, wrappingParen, indentDepth) {

    let known, line, lines;
    let asc, end1;
    switch (node.nodeType()) {

      // ### Block ###
      // A Block is a group of expressions,
      // which is represented by either an indent or a socket.
      case 'Block':
        // Abort if empty
        if (node.expressions.length === 0) { return; }

        // Otherwise, get the bounds to determine
        // whether we want to do it on one line or multiple lines.
        var bounds = this.getBounds(node);

        // See if we want to wrap in a socket
        // rather than an indent.
        var shouldBeOneLine = false;

        // Check to see if any parent node is occupying a line
        // we are on. If so, we probably want to wrap in
        // a socket rather than an indent.
        for (({ line } = bounds.start), end1 = bounds.end.line, asc = bounds.start.line <= end1; asc ? line <= end1 : line >= end1; asc ? line++ : line--) {
          if (!shouldBeOneLine) { shouldBeOneLine = this.hasLineBeenMarked[line]; }
        }

        if (this.lines[bounds.start.line].slice(0, bounds.start.column).trim().length !== 0) {
          shouldBeOneLine = true;
        }

        if (shouldBeOneLine) {
          this.csSocket(node, depth, 0);

        // Otherwise, wrap in an indent.
        } else {
          // Determine the new indent depth by literal text inspection
          const textLine = this.lines[node.locationData.first_line];
          const trueIndentDepth = textLine.length - textLine.trimLeft().length;

          // As a block, we also want to consume as much whitespace above us as possible
          // (to free it from actual ICE editor blocks).
          while ((bounds.start.line > 0) && (this.lines[bounds.start.line - 1].trim().length === 0)) {
            bounds.start.line -= 1;
            bounds.start.column = this.lines[bounds.start.line].length + 1;
          }

          // Move the boundaries back by one line,
          // as per the standard way to add an Indent.
          bounds.start.line -= 1;
          bounds.start.column = this.lines[bounds.start.line].length + 1;

          this.addIndent({
            depth,
            bounds,
            prefix: this.lines[node.locationData.first_line].slice(indentDepth, trueIndentDepth)
          });

          // Then update indent depth data to reflect.
          indentDepth = trueIndentDepth;
        }

        // Mark children. We do this at depth + 3 to
        // make room for semicolon wrappers where necessary.
        for (var expr of Array.from(node.expressions)) {
          this.mark(expr, depth + 3, 0, null, indentDepth);
        }

        // Wrap semicolons.
        return this.wrapSemicolons(node.expressions, depth);

      // ### Parens ###
      // Parens are special; they get no marks
      // but pass to the next node with themselves
      // as the wrapping parens.
      //
      // If we are ourselves wrapped by a parenthesis,
      // then keep that parenthesis when we pass on.
      case 'Parens':
        if (node.body != null) {
          if (node.body.nodeType() !== 'Block') {
            return this.mark(node.body, depth + 1, 0, (wrappingParen != null ? wrappingParen : node), indentDepth);
          } else {
            if (node.body.unwrap() === node.body) {
              // We are filled with some things
              // connected by semicolons; wrap them all,
              this.csBlock(node, depth, -2, null, MOSTLY_BLOCK);

              return (() => {
                const result = [];
                for (expr of Array.from(node.body.expressions)) {
                  result.push(this.csSocketAndMark(expr, depth + 1, -2, indentDepth));
                }
                return result;
              })();

            } else {
              return this.mark(node.body.unwrap(), depth + 1, 0, (wrappingParen != null ? wrappingParen : node), indentDepth);
            }
          }
        }
        break;

      // ### Op ###
      // Color VALUE, sockets @first and (sometimes) @second
      case 'Op':
        // An addition operator might be
        // a string interpolation, in which case
        // we want to ignore it.
        if ((node.first != null) && (node.second != null) && (node.operator === '+')) {
          // We will search for a literal "+" symbol
          // between the two operands. If there is none,
          // we assume string interpolation.
          const firstBounds = this.getBounds(node.first);
          const secondBounds = this.getBounds(node.second);

          lines = this.lines.slice(firstBounds.end.line, +secondBounds.start.line + 1 || undefined).join('\n');

          const infix = lines.slice(firstBounds.end.column, -(this.lines[secondBounds.start.line].length - secondBounds.start.column));

          if (infix.indexOf('+') === -1) {
            return;
          }
        }

        // Treat unary - and + specially if they surround a literal: then
        // they should just be sucked into the literal.
        if (node.first && !node.second && ['+', '-'].includes(node.operator) &&
            (__guardMethod__(node.first != null ? node.first.base : undefined, 'nodeType', o => o.nodeType()) === 'Literal')) {
          return;
        }

        this.csBlock(node, depth, OPERATOR_PRECEDENCES[node.operator], wrappingParen, VALUE_ONLY);

        this.csSocketAndMark(node.first, depth + 1, OPERATOR_PRECEDENCES[node.operator], indentDepth);

        if (node.second != null) {
          return this.csSocketAndMark(node.second, depth + 1, OPERATOR_PRECEDENCES[node.operator], indentDepth);
        }
        break;

      // ### Existence ###
      // Color VALUE, socket @expression, precedence 100
      case 'Existence':
        this.csBlock(node, depth, 100, wrappingParen, VALUE_ONLY);
        return this.csSocketAndMark(node.expression, depth + 1, 101, indentDepth);

      // ### In ###
      // Color VALUE, sockets @object and @array, precedence 100
      case 'In':
        this.csBlock(node, depth, 0, wrappingParen, VALUE_ONLY);
        this.csSocketAndMark(node.object, depth + 1, 0, indentDepth);
        return this.csSocketAndMark(node.array, depth + 1, 0, indentDepth);

      // ### Value ###
      // Completely pass through to @base; we do not care
      // about this node.
      case 'Value':
        if ((node.properties != null) && (node.properties.length > 0)) {
          this.csBlock(node, depth, 0, wrappingParen, MOSTLY_VALUE);
          this.csSocketAndMark(node.base, depth + 1, 0, indentDepth);
          return (() => {
            const result1 = [];
            for (let property of Array.from(node.properties)) {
              if (property.nodeType() === 'Access') {
                result1.push(this.csSocketAndMark(property.name, depth + 1, -2, indentDepth, PROPERTY_ACCESS));
              } else if (property.nodeType() === 'Index') {
                result1.push(this.csSocketAndMark(property.index, depth + 1, 0, indentDepth));
              } else {
                result1.push(undefined);
              }
            }
            return result1;
          })();

        // Fake-remove backticks hack
        } else if ((node.base.nodeType() === 'Literal') &&
            ((node.base.value === '') || (node.base.value === this.empty))) {
          const fakeBlock =
              this.csBlock(node.base, depth, 0, wrappingParen, ANY_DROP);
          return fakeBlock.flagToRemove = true;

        // Preserved-error backticks hack
        } else if ((node.base.nodeType() === 'Literal') &&
            /^#/.test(node.base.value)) {
          this.csBlock(node.base, depth, 0, wrappingParen, ANY_DROP);
          const errorSocket = this.csSocket(node.base, depth + 1, -2);
          return errorSocket.flagToStrip = { left: 2, right: 1 };

        } else {
          return this.mark(node.base, depth + 1, 0, wrappingParen, indentDepth);
        }

      // ### Keywords ###
      case 'Literal':
        if (Array.from(STATEMENT_KEYWORDS).includes(node.value)) {
          // handle break and continue
          return this.csBlock(node, depth, 0, wrappingParen, BLOCK_ONLY);
        } else {
          // otherwise, leave it as a white block
          return 0;
        }

      // ### Literal ###
      // No-op. Translate directly to text
      case 'Literal': case 'Bool': case 'Undefined': case 'Null': return 0;

      // ### Call ###
      // Color COMMAND, sockets @variable and @args.
      // We will not add a socket around @variable when it
      // is only some text
      case 'Call':
        var hasCallParen = false;
        if (node.variable != null) {
          let classes;
          const namenodes = this.functionNameNodes(node);
          known = this.lookupFunctionName(namenodes);
          if (known) {
            if (known.fn.value) {
              classes = known.fn.command ? ANY_DROP : MOSTLY_VALUE;
            } else {
              classes = MOSTLY_BLOCK;
            }
          } else {
            classes = ANY_DROP;
          }
          this.csBlock(node, depth, 0, wrappingParen, classes);

          const variableBounds = this.getBounds(node.variable);
          hasCallParen = (this.lines[variableBounds.end.line][variableBounds.end.column] === '(');

          // Some function names (like /// RegExps ///) are never editable.
          if (this.implicitName(namenodes)) {
            // do nothing
          } else if (!known) {
            // In the 'advanced' case where the methodname should be
            // editable, treat the whole (x.y.fn) as an expression to socket.
            this.csSocketAndMark(node.variable, depth + 1, 0, indentDepth);
          } else if (known.anyobj && ((node.variable.properties != null ? node.variable.properties.length : undefined) > 0)) {
            // In the 'beginner' case of a simple method call with a
            // simple base object variable, let the variable be socketed.
            this.csSocketAndMark(node.variable.base, depth + 1, 0, indentDepth);
          }

          if (!known && (node.args.length === 0) && !node.do) {
            // The only way we can have zero arguments in CoffeeScript
            // is for the parenthesis to open immediately after the function name.
            const start = {
              line: variableBounds.end.line,
              column: variableBounds.end.column + 1
            };
            const end = {
              line: start.line,
              column: start.column
            };
            const space = this.lines[start.line].slice(start.column).match(/^(\s*)\)/);
            if (space != null) {
              end.column += space[1].length;
            }
            this.addSocket({
              bounds: {start, end},
              depth,
              precedence: 0,
              dropdown: null,
              classes: ['mostly-value'],
              empty: ''
            });
          }
        } else {
          this.csBlock(node, depth, 0, wrappingParen, ANY_DROP);
        }

        if (!node.do) {
          return (() => {
            const result2 = [];
            for (var index = 0; index < node.args.length; index++) {
              const arg = node.args[index];
              const last = index === (node.args.length - 1);
              // special case: the last argument slot of a function
              // gathers anything inside it, without parens needed.
              precedence = last ? -1 : 0;
              if (last && (arg.nodeType() === 'Code')) {
                // Inline function definitions that appear as the last arg
                // of a function call will be melded into the parent block.
                result2.push(this.addCode(arg, depth + 1, indentDepth));
              } else if (!known && hasCallParen && (index === 0) && (node.args.length === 1)) {
                result2.push(this.csSocketAndMark(arg, depth + 1, precedence, indentDepth, null, __guard__(__guard__(known != null ? known.fn : undefined, x1 => x1.dropdown), x => x[index]), ''));
              } else {
                result2.push(this.csSocketAndMark(arg, depth + 1, precedence, indentDepth, null, __guard__(__guard__(known != null ? known.fn : undefined, x3 => x3.dropdown), x2 => x2[index])));
              }
            }
            return result2;
          })();
        }
        break;

      // ### Code ###
      // Function definition. Color VALUE, sockets @params,
      // and indent @body.
      case 'Code':
        this.csBlock(node, depth, 0, wrappingParen, VALUE_ONLY);
        return this.addCode(node, depth + 1, indentDepth);

      // ### Assign ###
      // Color COMMAND, sockets @variable and @value.
      case 'Assign':
        this.csBlock(node, depth, 0, wrappingParen, MOSTLY_BLOCK);
        this.csSocketAndMark(node.variable, depth + 1, 0, indentDepth, LVALUE);

        if (node.value.nodeType() === 'Code') {
          return this.addCode(node.value, depth + 1, indentDepth);
        } else {
          return this.csSocketAndMark(node.value, depth + 1, 0, indentDepth);
        }

      // ### For ###
      // Color CONTROL, options sockets @index, @source, @name, @from.
      // Indent/socket @body.
      case 'For':
        this.csBlock(node, depth, -3, wrappingParen, MOSTLY_BLOCK);

        for (var childName of ['source', 'from', 'guard', 'step']) {
          if (node[childName] != null) { this.csSocketAndMark(node[childName], depth + 1, 0, indentDepth); }
        }

        for (childName of ['index', 'name']) {
          if (node[childName] != null) { this.csSocketAndMark(node[childName], depth + 1, 0, indentDepth, FORBID_ALL); }
        }

        return this.mark(node.body, depth + 1, 0, null, indentDepth);

      // ### Range ###
      // Color VALUE, sockets @from and @to.
      case 'Range':
        this.csBlock(node, depth, 100, wrappingParen, VALUE_ONLY);
        this.csSocketAndMark(node.from, depth, 0, indentDepth);
        return this.csSocketAndMark(node.to, depth, 0, indentDepth);

      // ### If ###
      // Color CONTROL, socket @condition.
      // indent/socket body, optional indent/socket node.elseBody.
      //
      // Special case: "unless" keyword; in this case
      // we want to skip the Op that wraps the condition.
      case 'If':
        this.csBlock(node, depth, 0, wrappingParen, MOSTLY_BLOCK, {addButton: '+'});

        // Check to see if we are an "unless".
        // We will deem that we are an unless if:
        //   - Our starting line contains "unless" and
        //   - Our condition starts at the same location as
        //     ourselves.

        // Note: for now, we have hacked CoffeeScript
        // to give us the raw condition location data.
        //
        // Perhaps in the future we should do this at
        // wrapper level.

        /*
        bounds = @getBounds node
        if @lines[bounds.start.line].indexOf('unless') >= 0 and
            @locationsAreIdentical(bounds.start, @getBounds(node.condition).start) and
            node.condition.nodeType() is 'Op'

          @csSocketAndMark node.condition.first, depth + 1, 0, indentDepth
        else
        */

        this.csSocketAndMark(node.rawCondition, depth + 1, 0, indentDepth);

        this.mark(node.body, depth + 1, 0, null, indentDepth);

        var currentNode = node;

        return (() => {
          const result3 = [];
          while (currentNode != null) {
            if (currentNode.isChain) {
              currentNode = currentNode.elseBodyNode();
              this.csSocketAndMark(currentNode.rawCondition, depth + 1, 0, indentDepth);
              result3.push(this.mark(currentNode.body, depth + 1, 0, null, indentDepth));

            } else if (currentNode.elseBody != null) {
              // Artificially "mark" the line containing the "else"
              // token, so that the following body can be single-line
              // if necessary.
              this.flagLineAsMarked(currentNode.elseToken.first_line);
              this.mark(currentNode.elseBody, depth + 1, 0, null, indentDepth);
              result3.push(currentNode = null);

            } else {
              result3.push(currentNode = null);
            }
          }
          return result3;
        })();

      // ### Arr ###
      // Color VALUE, sockets @objects.
      case 'Arr':
        this.csBlock(node, depth, 100, wrappingParen, VALUE_ONLY);

        if (node.objects.length > 0) {
          this.csIndentAndMark(indentDepth, node.objects, depth + 1);
        }
        return (() => {
          const result4 = [];
          for (let object of Array.from(node.objects)) {
            if ((object.nodeType() === 'Value') && (object.base.nodeType() === 'Literal') &&
                [0, undefined].includes(object.properties != null ? object.properties.length : undefined)) {
              result4.push(this.csBlock(object, depth + 2, 100, null, VALUE_ONLY));
            } else {
              result4.push(undefined);
            }
          }
          return result4;
        })();

      // ### Return ###
      // Color RETURN, optional socket @expression.
      case 'Return':
        this.csBlock(node, depth, 0, wrappingParen, BLOCK_ONLY);
        if (node.expression != null) {
          return this.csSocketAndMark(node.expression, depth + 1, 0, indentDepth);
        }
        break;

      // ### While ###
      // Color CONTROL. Socket @condition, socket/indent @body.
      case 'While':
        this.csBlock(node, depth, -3, wrappingParen, MOSTLY_BLOCK);
        this.csSocketAndMark(node.rawCondition, depth + 1, 0, indentDepth);
        if (node.guard != null) { this.csSocketAndMark(node.guard, depth + 1, 0, indentDepth); }
        return this.mark(node.body, depth + 1, 0, null, indentDepth);

      // ### Switch ###
      // Color CONTROL. Socket @subject, optional sockets @cases[x][0],
      // indent/socket @cases[x][1]. indent/socket @otherwise.
      case 'Switch':
        this.csBlock(node, depth, 0, wrappingParen, MOSTLY_BLOCK);

        if (node.subject != null) { this.csSocketAndMark(node.subject, depth + 1, 0, indentDepth); }

        for (let switchCase of Array.from(node.cases)) {
          if (switchCase[0].constructor === Array) {
            for (let condition of Array.from(switchCase[0])) {
              this.csSocketAndMark(condition, depth + 1, 0, indentDepth);
            } // (condition)
          } else {
            this.csSocketAndMark(switchCase[0], depth + 1, 0, indentDepth); // (condition)
          }
          this.mark(switchCase[1], depth + 1, 0, null, indentDepth);
        } // (body)

        if (node.otherwise != null) {
          return this.mark(node.otherwise, depth + 1, 0, null, indentDepth);
        }
        break;

      // ### Class ###
      // Color CONTROL. Optional sockets @variable, @parent. Optional indent/socket
      // @obdy.
      case 'Class':
        this.csBlock(node, depth, 0, wrappingParen, ANY_DROP);

        if (node.variable != null) { this.csSocketAndMark(node.variable, depth + 1, 0, indentDepth, FORBID_ALL); }
        if (node.parent != null) { this.csSocketAndMark(node.parent, depth + 1, 0, indentDepth); }

        if (node.body != null) { return this.mark(node.body, depth + 1, 0, null, indentDepth); }
        break;

      // ### Obj ###
      // Color VALUE. Optional sockets @property[x].variable, @property[x].value.
      // TODO: This doesn't quite line up with what we want it to be visually;
      // maybe our View architecture is wrong.
      case 'Obj':
        this.csBlock(node, depth, 0, wrappingParen, VALUE_ONLY);

        return (() => {
          const result5 = [];
          for (let property of Array.from(node.properties)) {
            if (property.nodeType() === 'Assign') {
              this.csSocketAndMark(property.variable, depth + 1, 0, indentDepth, FORBID_ALL);
              result5.push(this.csSocketAndMark(property.value, depth + 1, 0, indentDepth));
            } else {
              result5.push(undefined);
            }
          }
          return result5;
        })();
    }
  }


  handleButton(text, button, oldBlock) {
    if ((button === 'add-button') && Array.from(oldBlock.classes).includes('If')) {
      // Parse to find the last "else" or "else if"
      const node = CoffeeScript.nodes(text, {
        locations: true,
        line: 0,
        allowReturnOutsideFunction: true
      }).expressions[0];

      let lines = text.split('\n');

      let currentNode = node;
      let elseLocation = null;

      while (currentNode.isChain) {
        currentNode = currentNode.elseBodyNode();
      }

      if (currentNode.elseBody != null) {
        lines = text.split('\n');
        elseLocation = {
          line: currentNode.elseToken.last_line,
          column: currentNode.elseToken.last_column + 2
        };
        elseLocation = lines.slice(0, elseLocation.line).join('\n').length + elseLocation.column;
        return text.slice(0, elseLocation).trimRight() + ' if ``' + ((text.slice(elseLocation).match(/^ *\n/) != null) ? '' : ' then ') + text.slice(elseLocation) + '\nelse\n  ``';
      } else {
        return text + '\nelse\n  ``';
      }
    }
  }

  locationsAreIdentical(a, b) {
    return (a.line === b.line) && (a.column === b.column);
  }

  boundMin(a, b) {
    if (a.line < b.line) { return a;
    } else if (b.line < a.line) { return b;
    } else if (a.column < b.column) { return a;
    } else { return b; }
  }

  boundMax(a, b) {
    if (a.line < b.line) { return b;
    } else if (b.line < a.line) { return a;
    } else if (a.column < b.column) { return b;
    } else { return a; }
  }

  boundCombine(a, b) {
    const start = this.boundMin(a.start, b.start);
    const end = this.boundMax(a.end, b.end);
    return {start, end};
  }

  // ## getBounds ##
  // Get the boundary locations of a CoffeeScript node,
  // using CoffeeScript location data and
  // adjust to deal with some quirks.
  getBounds(node) {
    // Most of the time, we can just
    // take CoffeeScript locationData.
    let bounds = {
      start: {
        line: node.locationData.first_line,
        column: node.locationData.first_column
      },
      end: {
        line: node.locationData.last_line,
        column: node.locationData.last_column + 1
      }
    };

    // There are four cases where CoffeeScript
    // actually gets location data wrong.

    // The first is CoffeeScript 'Block's,
    // which give us only the first line.
    // So we need to adjust.
    if (node.nodeType() === 'Block') {
      // If we have any child expressions,
      // set the end boundary to be the end
      // of the last one
      if (node.expressions.length > 0) {
        bounds.end = this.getBounds(node.expressions[node.expressions.length - 1]).end;

      //If we have no child expressions, make the bounds actually empty.
      } else {
        bounds.start = bounds.end;
      }
    }

    // The second is 'If' statements,
    // which do not surround the elseBody
    // when it exists.
    if (node.nodeType() === 'If') {
      bounds.start = this.boundMin(bounds.start, this.getBounds(node.body).start);
      bounds.end = this.boundMax(this.getBounds(node.rawCondition).end, this.getBounds(node.body).end);

      if (node.elseBody != null) {
        bounds.end = this.boundMax(bounds.end, this.getBounds(node.elseBody).end);
      }
    }

    // The third is 'While', which
    // fails to surround the loop body,
    // or sometimes the loop guard.
    if (node.nodeType() === 'While') {
      bounds.start = this.boundMin(bounds.start, this.getBounds(node.body).start);
      bounds.end = this.boundMax(bounds.end, this.getBounds(node.body).end);

      if (node.guard != null) {
        bounds.end = this.boundMax(bounds.end, this.getBounds(node.guard).end);
      }
    }

    // Hack: Functions should end immediately
    // when their bodies end.
    if ((node.nodeType() === 'Code') && (node.body != null)) {
      bounds.end = this.getBounds(node.body).end;
    }

    // The fourth is general. Sometimes we get
    // spaces at the start of the next line.
    // We don't want those spaces; discard them.
    while (this.lines[bounds.end.line].slice(0, bounds.end.column).trim().length === 0) {
      bounds.end.line -= 1;
      bounds.end.column = this.lines[bounds.end.line].length + 1;
    }

    // When we have a 'Value' object,
    // its base may have some exceptions in it,
    // in which case we want to pass on to
    // those.
    if (node.nodeType() === 'Value') {
      bounds = this.getBounds(node.base);

      if ((node.properties != null) && (node.properties.length > 0)) {
        for (let property of Array.from(node.properties)) {
          bounds.end = this.boundMax(bounds.end, this.getBounds(property).end);
        }
      }
    }

    // Special case to deal with commas in arrays:
    if ((__guardMethod__(node.dropletParent, 'nodeType', o => o.nodeType()) === 'Arr') ||
       ((__guardMethod__(node.dropletParent, 'nodeType', o1 => o1.nodeType()) === 'Value') && (__guardMethod__(node.dropletParent.dropletParent, 'nodeType', o2 => o2.nodeType()) === 'Arr'))) {
      const match = this.lines[bounds.end.line].slice(bounds.end.column).match(/^\s*,\s*/);
      if (match != null) {
        bounds.end.column += match[0].length;
      }
    }

    return bounds;
  }

  // ## getColor ##
  // Looks up color of the given node, respecting options.
  getColor(node) {
    let category = NODE_CATEGORY[node.nodeType()] || 'command';
    switch (node.nodeType()) {
      case 'Op':
        if (LOGICAL_OPERATORS[node.operator]) {
          category = 'logic';
        } else {
          category = 'arithmetic';
        }
        break;
      case 'Call':
        if (node.variable != null) {
          const namenodes = this.functionNameNodes(node);
          const known = this.lookupFunctionName(namenodes);
          if (known) {
            if (known.fn.value) {
              category = known.fn.color ||
                (known.fn.command ? 'command' : 'value');
            } else {
              category = known.fn.color || 'command';
            }
          }
        }
        break;
      case 'Assign':
        // Assignments with a function RHS are function definitions
        if (node.value.nodeType() === 'Code') {
          category = 'functions';
        }
        break;
      case 'Literal':
        // Preserved errors
        if (/^#/.test(node.value)) {
          category = 'error';
        // break and continue
        } else if (Array.from(STATEMENT_KEYWORDS).includes(node.value)) {
          category = 'returns';
        }
        break;
    }
    return (this.opts.categories[category] != null ? this.opts.categories[category].color : undefined) || category;
  }

  // ## flagLineAsMarked ##
  flagLineAsMarked(line) {
    this.hasLineBeenMarked[line] = true;
    return (() => {
      const result = [];
      while (this.lines[line][this.lines[line].length - 1] === '\\') {
        line += 1;
        result.push(this.hasLineBeenMarked[line] = true);
      }
      return result;
    })();
  }

  // ## addMarkup ##
  // Override addMarkup to flagLineAsMarked
  addMarkup(container, bounds, depth) {
    super.addMarkup(...arguments);

    this.flagLineAsMarked(bounds.start.line);

    return container;
  }

  // ## csBlock ##
  // A general utility function for adding an ICE editor
  // block around a given node.
  csBlock(node, depth, precedence, wrappingParen, classes, buttons) {
    if (classes == null) { classes = []; }
    return this.addBlock({
      bounds: this.getBounds((wrappingParen != null ? wrappingParen : node)),
      depth,
      precedence,
      color: this.getColor(node),
      classes: getClassesFor(node).concat(classes),
      parenWrapped: (wrappingParen != null),
      buttons
    });
  }

  // Add an indent node and guess
  // at the indent depth
  csIndent(indentDepth, firstNode, lastNode, depth) {
    let prefix, trueDepth;
    const first = this.getBounds(firstNode).start;
    const last = this.getBounds(lastNode).end;

    if (this.lines[first.line].slice(0, first.column).trim().length === 0) {
      first.line -= 1;
      first.column = this.lines[first.line].length;
    }

    if (first.line !== last.line) {
      trueDepth = this.lines[last.line].length - this.lines[last.line].trimLeft().length;
      prefix = this.lines[last.line].slice(indentDepth, trueDepth);
    } else {
      trueDepth = indentDepth + 2;
      prefix = '  ';
    }

    this.addIndent({
      bounds: {
        start: first,
        end: last
      },
      depth,

      prefix
    });

    return trueDepth;
  }

  csIndentAndMark(indentDepth, nodes, depth) {
    const trueDepth = this.csIndent(indentDepth, nodes[0], nodes[nodes.length - 1], depth);
    return Array.from(nodes).map((node) =>
      this.mark(node, depth + 1, 0, null, trueDepth));
  }

  // ## csSocket ##
  // A similar utility function for adding sockets.
  csSocket(node, depth, precedence, classes, dropdown, empty) {
    if (classes == null) { classes = []; }
    return this.addSocket({
      bounds: this.getBounds(node),
      depth, precedence, dropdown, empty,
      classes: getClassesFor(node).concat(classes)
    });
  }

  // ## csSocketAndMark ##
  // Adds a socket for a node, and recursively @marks it.
  csSocketAndMark(node, depth, precedence, indentDepth, classes, dropdown, empty) {
    const socket = this.csSocket(node, depth, precedence, classes, dropdown, empty);
    this.mark(node, depth + 1, precedence, null, indentDepth);
    return socket;
  }

  // ## wrapSemicolonLine ##
  // Wrap a single line in a block
  // for semicolons.
  wrapSemicolonLine(firstBounds, lastBounds, expressions, depth) {
    const surroundingBounds = {
      start: firstBounds.start,
      end: lastBounds.end
    };
    this.addBlock({
      bounds: surroundingBounds,
      depth: depth + 1,
      precedence: -2,
      color: this.opts.categories['command'].color,
      socketLevel: ANY_DROP,
      classes: ['semicolon']
    });

    // Add sockets for each expression
    return Array.from(expressions).map((child) =>
      this.csSocket(child, depth + 2, -2));
  }

  // ## wrapSemicolons ##
  // If there are mutliple expressions we have on the same line,
  // add a semicolon block around them.
  wrapSemicolons(expressions, depth) {
    // We will keep track of the first and last
    // nodes on the current line, and their bounds.
    let firstBounds, lastBounds, lastNode;
    let firstNode = (lastNode =
      (firstBounds = (lastBounds = null)));

    // We will also keep track of the nodes
    // that are on this line, so that
    // we can surround them in sockets
    // in the future.
    let nodesOnCurrentLine = [];

    for (let expr of Array.from(expressions)) {
      // Get the bounds for this expression
      const bounds = this.getBounds(expr);

      // If we are on the same line as the last expression, update
      // lastNode to reflect.
      if (bounds.start.line === (firstBounds != null ? firstBounds.end.line : undefined)) {
        lastNode = expr; lastBounds = bounds;
        nodesOnCurrentLine.push(expr);

      // Otherwise, we are on a new line.
      // See if the previous line needed a semicolon wrapper

      // If there were at least two blocks on the previous line,
      // they do need a semicolon wrapper.
      } else {
        if (lastNode != null) {
          this.wrapSemicolonLine(firstBounds, lastBounds, nodesOnCurrentLine, depth);
        }

        // Regardless of whether or not we added semicolons on the last line,
        // clear the records to make way for the new line.
        firstNode = expr; lastNode = null;
        firstBounds = this.getBounds(expr); lastBounds = null;
        nodesOnCurrentLine = [expr];
      }
    }

    // Wrap up the last line if necessary.
    if (lastNode != null) {
      return this.wrapSemicolonLine(firstBounds, lastBounds, nodesOnCurrentLine, depth);
    }
  }
});

// ERROR RECOVERY
// =============

var fixCoffeeScriptError = function(lines, e) {
  if ((lines.length === 1) && /^['"]|['"]$/.test(lines[0])) {
    return fixQuotedString(lines);
  }
  if (/unexpected\s*(?:newline|if|for|while|switch|unless|end of input)/.test(
      e.message) && /^\s*(?:if|for|while|unless)\s+\S+/.test(
      lines[e.location.first_line])) {
    return addEmptyBackTickLineAfter(lines, e.location.first_line);
  }
  if (/unexpected/.test(e.message)) {
    return backTickLine(lines, e.location.first_line);
  }

  if (/missing "/.test(e.message) && Array.from(lines[e.location.first_line]).includes('"')) {
    return backTickLine(lines, e.location.first_line);
  }

  // Try to find the line with an opening unmatched thing
  if (/unmatched|missing \)/.test(e.message)) {
    const unmatchedline = findUnmatchedLine(lines, e.location.first_line);
    if (unmatchedline !== null) {
      return backTickLine(lines, unmatchedline);
    }
  }

  return null;
};

var findUnmatchedLine = (lines, above) =>
  // Not done yet
  null
;

var backTickLine = function(lines, n) {
  if ((n < 0) || (n >= lines.length)) {
    return false;
  }
  // This strategy fails if the line is already backticked or is empty.
  if (/`/.test(lines[n]) || /^\s*$/.test(lines[n])) {
    return false;
  }
  lines[n] = lines[n].replace(/^(\s*)(\S.*\S|\S)(\s*)$/, '$1`#$2`$3');
  return true;
};

var addEmptyBackTickLineAfter = function(lines, n) {
  if ((n < 0) || (n >= lines.length)) {
    return false;
  }
  // Refuse to add another empty backtick line if there is one already
  if (((n + 1) < lines.length) && /^\s*``$/.test(lines[n + 1])) {
    return false;
  }
  const leading = /^\s*/.exec(lines[n]);
  // If we are all spaces then fail.
  if (!leading || (leading[0].length >= lines[n].length)) {
    return false;
  }
  return lines.splice(n + 1, 0, leading[0] + '  ``');
};

CoffeeScriptParser.empty = "``";
CoffeeScriptParser.emptyIndent = "``";
CoffeeScriptParser.startComment = '###';
CoffeeScriptParser.endComment = '###';
CoffeeScriptParser.startSingleLineComment = '# ';

CoffeeScriptParser.drop = function(block, context, pred) {
  if (context.type === 'socket') {
    if (Array.from(context.classes).includes('forbid-all')) {
      return helper.FORBID;
    }

    if (Array.from(context.classes).includes('lvalue')) {
      if (Array.from(block.classes).includes('Value') && ((block.properties != null ? block.properties.length : undefined) > 0)) {
        return helper.ENCOURAGE;
      } else {
        return helper.FORBID;
      }

    } else if (Array.from(context.classes).includes('property-access')) {
      if (Array.from(block.classes).includes('works-as-method-call')) {
        return helper.ENCOURAGE;
      } else {
        return helper.FORBID;
      }

    } else if (Array.from(block.classes).includes('value-only') ||
        Array.from(block.classes).includes('mostly-value') ||
        Array.from(block.classes).includes('any-drop')) {
      return helper.ENCOURAGE;

    } else if (Array.from(block.classes).includes('mostly-block')) {
      return helper.DISCOURAGE;
    }

  } else if (['indent', 'document'].includes(context.type)) {
    if (Array.from(block.classes).includes('block-only') ||
        Array.from(block.classes).includes('mostly-block') ||
        Array.from(block.classes).includes('any-drop') ||
        (block.type === 'document')) {
      return helper.ENCOURAGE;

    } else if (Array.from(block.classes).includes('mostly-value')) {
      return helper.DISCOURAGE;
    }
  }

  return helper.DISCOURAGE;
};

CoffeeScriptParser.parens = function(leading, trailing, node, context) {
  // Don't attempt to paren wrap comments
  if (Array.from(node.classes).includes('__comment__')) { return; }

  trailing(trailing().replace(/\s*,\s*$/, ''));
  // Remove existing parentheses
  while (true) {
    if ((leading().match(/^\s*\(/) != null) && (trailing().match(/\)\s*/) != null)) {
      leading(leading().replace(/^\s*\(\s*/, ''));
      trailing(trailing().replace(/\s*\)\s*$/, ''));
    } else {
      break;
    }
  }
  if ((context === null) || (context.type !== 'socket') ||
      (context.precedence < node.precedence)) {
  } else {
    leading(`(${leading()}`);
    trailing(trailing() + ')');
  }

};

CoffeeScriptParser.getDefaultSelectionRange = function(string) {
  let start = 0; let end = string.length;
  if ((string.length > 1) && (string[0] === string[string.length - 1]) && ['"', '\'', '/'].includes(string[0])) {
    let needle;
    start += 1; end -= 1;
    if ((string.length > 5) && (string.slice(0, 3) === string.slice(-3)) && (needle = string.slice(0, 3), ['"""', '\'\'\'', '///'].includes(needle))) {
      start += 2; end -= 2;
    }
  }
  return {start, end};
};

CoffeeScriptParser.stringFixer = function(string) {
  if (/^['"]|['"]$/.test(string)) {
    return fixQuotedString([string]);
  } else {
    return string;
  }
};

module.exports = parser.wrapParser(CoffeeScriptParser);

function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}
function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
function __guardMethod__(obj, methodName, transform) {
  if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
    return transform(obj, methodName);
  } else {
    return undefined;
  }
}