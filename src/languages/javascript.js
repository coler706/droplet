/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Droplet JavaScript mode
//
// Copyright (c) 2015 Anthony Bau (dab1998@gmail.com)
// MIT License.

let JavaScriptParser;
const helper = require('../helper');
const model = require('../model');
const parser = require('../parser');

const acorn = require('../../vendor/acorn');

const STATEMENT_NODE_TYPES = [
  'ExpressionStatement',
  'ReturnStatement',
  'BreakStatement',
  'ThrowStatement'
];

const NEVER_PAREN = 100;

const KNOWN_FUNCTIONS = {
  'alert'       : {},
  'prompt'      : {},
  'console.log' : {},
  '*.toString'  : {value: true},
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

const NODE_CATEGORIES = {
  'BinaryExpression': 'arithmetic',  // actually, some are logic
  'UnaryExpression': 'arithmetic',   // actually, some are logic
  'ConditionalExpression': 'arithmetic',
  'LogicalExpression': 'logic',
  'FunctionExpression': 'functions',
  'FunctionDeclaration': 'functions',
  'AssignmentExpression': 'assignments',
  'UpdateExpression': 'assignments',
  'VariableDeclaration': 'assignments',
  'ReturnStatement': 'returns',
  'IfStatement': 'conditionals',
  'SwitchStatement': 'conditionals',
  'ForStatement': 'loops',
  'ForInStatement': 'loops',
  'WhileStatement': 'loops',
  'DoWhileStatement': 'loops',
  'NewExpression': 'containers',
  'ObjectExpression': 'containers',
  'ArrayExpression': 'containers',
  'MemberExpression': 'containers',
  'BreakStatement': 'returns',
  'ThrowStatement': 'returns',
  'TryStatement': 'returns',
  'CallExpression': 'command',
  'SequenceExpression': 'command',
  'Identifier': 'value'
};

// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
// These numbers are "19 - x" so that the lowest numbers bind most tightly.
const OPERATOR_PRECEDENCES = {
  '++': 3,
  '--': 3,
  '!': 4,
  '~': 4,
  '*': 5,
  '/': 5,
  '%': 5,
  '+': 6,
  '-': 6,
  '<<': 7,
  '>>': 7,
  '>>>': 7,
  '<': 8,
  '>': 8,
  '>=': 8,
  'in': 8,
  'instanceof': 8,
  '==': 9,
  '!=': 9,
  '===': 9,
  '!==': 9,
  '&': 10,
  '^': 11,
  '|': 12,
  '&&': 13,
  '||': 14
};

const CLASS_EXCEPTIONS = {
  'ForStatement': ['ends-with-brace', 'block-only'],
  'FunctionDeclaration': ['ends-with-brace', 'block-only'],
  'IfStatement': ['ends-with-brace', 'block-only'],
  'WhileStatement': ['ends-with-brace', 'block-only'],
  'DoWhileStatement': ['ends-with-brace', 'block-only'],
  'SwitchStatement': ['ends-with-brace', 'block-only'],
  'AssignmentExpression': ['mostly-block']
};

const DEFAULT_INDENT_DEPTH = '  ';

exports.JavaScriptParser = (JavaScriptParser = class JavaScriptParser extends parser.Parser {
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
  }

  markRoot() {
    const tree = acorn.parse(this.text, {
      locations: true,
      line: 0,
      allowReturnOutsideFunction: true
    });

    return this.mark(0, tree, 0, null);
  }

  fullNameArray(obj) {
    const props = [];
    while (obj.type === 'MemberExpression') {
      props.unshift(obj.property.name);
      obj = obj.object;
    }
    if (obj.type === 'Identifier') {
      props.unshift(obj.name);
    } else {
      props.unshift('*');
    }
    return props;
  }

  lookupKnownName(node) {
    let identifier, wildcard;
    if ((node.type === 'CallExpression') || (node.type === 'NewExpression')) {
      identifier = false;
    } else if ((node.type === 'Identifier') || (node.type === 'MemberExpression')) {
      identifier = true;
    } else {
      throw new Error;
    }
    const fname = this.fullNameArray(identifier ? node : node.callee);
    const full = fname.join('.');
    let fn = this.opts.functions[full];
    if (fn && ((identifier && fn.property) || (!identifier && !fn.property))) {
      return {name: full, anyobj: false, fn: this.opts.functions[full]};
    }
    const last = fname[fname.length - 1];
    if ((fname.length > 1) && !((wildcard = `*.${last}`) in this.opts.functions)) {
      wildcard = null;  // no match for '*.foo'
    }
    if (!wildcard && !((wildcard = `?.${last}`) in this.opts.functions)) {
      wildcard = null;  // no match for '?.foo'
    }
    if (wildcard !== null) {
      fn = this.opts.functions[wildcard];
      if (fn && ((identifier && fn.property) || (!identifier && !fn.property))) {
        return {name: last, anyobj: true, fn: this.opts.functions[wildcard]};
      }
    }
    return null;
  }

  getAcceptsRule(node) { return {default: helper.NORMAL}; }
  getClasses(node) {
    if (node.type in CLASS_EXCEPTIONS) {
      return CLASS_EXCEPTIONS[node.type].concat([node.type]);
    } else {
      if ((node.type === 'CallExpression') || (node.type === 'NewExpression') || (node.type === 'Identifier')) {
        const known = this.lookupKnownName(node);
        if (!known || (known.fn.value && known.fn.command)) {
          return [node.type, 'any-drop'];
        }
        if (known.fn.value) {
          return [node.type, 'mostly-value'];
        } else {
          return [node.type, 'mostly-block'];
        }
      }
      if (node.type.match(/Expression$/) != null) {
        return [node.type, 'mostly-value'];
      } else if (node.type.match(/Declaration$/) != null) {
        return [node.type, 'block-only'];
      } else if (node.type.match(/Statement$/) != null) {
        return [node.type, 'mostly-block'];
      } else {
        return [node.type, 'any-drop'];
      }
    }
  }

  getPrecedence(node) {
    switch (node.type) {
      case 'BinaryExpression': case 'LogicalExpression':
        return OPERATOR_PRECEDENCES[node.operator];
      case 'AssignStatement':
        return 16;
      case 'UnaryExpression':
        if (node.prefix) {
          return OPERATOR_PRECEDENCES[node.operator] != null ? OPERATOR_PRECEDENCES[node.operator] : 4;
        } else {
          return OPERATOR_PRECEDENCES[node.operator] != null ? OPERATOR_PRECEDENCES[node.operator] : 3;
        }
      case 'CallExpression':
        return 2;
      case 'NewExpression':
        return 2;
      case 'MemberExpression':
        return 1;
      case 'ExpressionStatement':
        return this.getPrecedence(node.expression);
      default:
        return 0;
    }
  }

  lookupCategory(node) {
    let category;
    switch (node.type) {
      case 'BinaryExpression': case 'UnaryExpression':
        if (LOGICAL_OPERATORS.hasOwnProperty(node.operator)) {
          category = 'logic';
        } else {
          category = 'arithmetic';
        }
        break;
      default:
        category = NODE_CATEGORIES[node.type];
    }
    return this.opts.categories[category];
  }

  getColor(node) {
    switch (node.type) {
      case 'ExpressionStatement':
        return this.getColor(node.expression);
        break;
      case 'CallExpression': case 'NewExpression': case 'MemberExpression': case 'Identifier':
        var known = this.lookupKnownName(node);
        if (known) {
          if (known.fn.color) {
            return known.fn.color;
          } else if (known.fn.value && !known.fn.command) {
            return this.opts.categories.value.color;
          }
        }
        break;
    }
    const category = this.lookupCategory(node);
    return (category != null ? category.color : undefined) || 'command';
  }

  getSocketLevel(node) { return helper.ANY_DROP; }

  getBounds(node) {
    // If we are a statement, scan
    // to find the semicolon
    let line;
    if (node.type === 'BlockStatement') {
      let left;
      const bounds = {
        start: {
          line: node.loc.start.line,
          column: node.loc.start.column + 1
        },
        end: {
          line: node.loc.end.line,
          column: node.loc.end.column - 1
        }
      };

      bounds.start.column += ((left = this.lines[bounds.start.line].slice(bounds.start.column).match(/^\s*/)) != null ? left : [''])[0].length;

      if (this.lines[bounds.end.line].slice(0, bounds.end.column).trim().length === 0) {
        bounds.end.line -= 1;
        bounds.end.column = this.lines[bounds.end.line].length;
      }

      return bounds;

    } else if (Array.from(STATEMENT_NODE_TYPES).includes(node.type)) {
      line = this.lines[node.loc.end.line];
      const semicolon = this.lines[node.loc.end.line].slice(node.loc.end.column - 1).indexOf(';');
      if (semicolon >= 0) {
        const semicolonLength = this.lines[node.loc.end.line].slice(node.loc.end.column - 1).match(/;\s*/)[0].length;
        return {
          start: {
            line: node.loc.start.line,
            column: node.loc.start.column
          },
          end: {
            line: node.loc.end.line,
            column: (node.loc.end.column + semicolon + semicolonLength) - 1
          }
        };
      }
    }

    return {
      start: {
        line: node.loc.start.line,
        column: node.loc.start.column
      },
      end: {
        line: node.loc.end.line,
        column: node.loc.end.column
      }
    };
  }

  getCaseIndentBounds(node) {
    const bounds = {
      start: this.getBounds(node.consequent[0]).start,
      end: this.getBounds(node.consequent[node.consequent.length - 1]).end
    };

    if (this.lines[bounds.start.line].slice(0, bounds.start.column).trim().length === 0) {
      bounds.start.line -= 1;
      bounds.start.column = this.lines[bounds.start.line].length;
    }

    if (this.lines[bounds.end.line].slice(0, bounds.end.column).trim().length === 0) {
      bounds.end.line -= 1;
      bounds.end.column = this.lines[bounds.end.line].length;
    }

    return bounds;
  }

  getIndentPrefix(bounds, indentDepth) {
    if ((bounds.end.line - bounds.start.line) < 1) {
      return DEFAULT_INDENT_DEPTH;
    } else {
      const line = this.lines[bounds.start.line + 1];
      return line.slice(indentDepth, (line.length - line.trimLeft().length));
    }
  }

  isComment(text) {
    return (text.match(/^\s*\/\/.*$/) != null);
  }

  parseComment(text) {
    return {
      sockets: [[text.match(/^\s*\/\//)[0].length, text.length]]
    };
  }

  handleButton(text, button, oldBlock) {
    let node;
    if ((button === 'add-button') && Array.from(oldBlock.classes).includes('IfStatement')) {
      // Parse to find the last "else" or "else if"
      node = acorn.parse(text, {
        locations: true,
        line: 0,
        allowReturnOutsideFunction: true
      }).body[0];
      let currentElif = node;
      let elseLocation = null;
      while (true) {
        if (currentElif.type === 'IfStatement') {
          if (currentElif.alternate != null) {
            elseLocation = {
              line: currentElif.alternate.loc.start.line,
              column: currentElif.alternate.loc.start.column
            };
            currentElif = currentElif.alternate;
          } else {
            elseLocation = null;
            break;
          }
        } else {
          break;
        }
      }

      if (elseLocation != null) {
        const lines = text.split('\n');
        elseLocation = lines.slice(0, elseLocation.line).join('\n').length + elseLocation.column + 1;
        return text.slice(0, elseLocation).trimRight() + ' if (__) ' + text.slice(elseLocation).trimLeft() + ` else {
  __
}`;
      } else {
        return text + ` else {
  __
}`;
      }
    } else if (Array.from(oldBlock.classes).includes('CallExpression')) {
      // Parse to find the last "else" or "else if"
      let lastArgPosition;
      node = acorn.parse(text, {
        line: 0,
        allowReturnOutsideFunction: true
      }).body[0];
      const known = this.lookupKnownName(node.expression);
      const argCount = node.expression.arguments.length;
      if (button === 'add-button') {
        let maxArgs = known != null ? known.fn.maxArgs : undefined;
        if (maxArgs == null) { maxArgs = Infinity; }
        if (argCount >= maxArgs) {
          return;
        }
        if (argCount) {
          lastArgPosition = node.expression.arguments[argCount - 1].end;
          return text.slice(0, lastArgPosition).trimRight() + ', __' + text.slice(lastArgPosition).trimLeft();
        } else {
          lastArgPosition = node.expression.end - 1;
          return text.slice(0, lastArgPosition).trimRight() + '__' + text.slice(lastArgPosition).trimLeft();
        }
      } else if (button === 'subtract-button') {
        let minArgs = known != null ? known.fn.minArgs : undefined;
        if (minArgs == null) { minArgs = 0; }
        if (argCount <= minArgs) {
          return;
        }
        if (argCount > 0) {
          let newLastArgPosition;
          lastArgPosition = node.expression.arguments[argCount - 1].end;
          if (argCount === 1) {
            newLastArgPosition = node.expression.arguments[0].start;
          } else {
            newLastArgPosition = node.expression.arguments[argCount - 2].end;
          }
          return text.slice(0, newLastArgPosition).trimRight() + text.slice(lastArgPosition).trimLeft();
        }
      }
    }
  }

  mark(indentDepth, node, depth, bounds) {
    let argument, block, match, maxArgs, minArgs, nodeBoundsStart, position, showButtons;
    switch (node.type) {
      case 'Program':
        return (() => {
          const result = [];
          for (let statement of Array.from(node.body)) {
            result.push(this.mark(indentDepth, statement, depth + 1, null));
          }
          return result;
        })();
      case 'Function':
        this.jsBlock(node, depth, bounds);
        return this.mark(indentDepth, node.body, depth + 1, null);
      case 'SequenceExpression':
        this.jsBlock(node, depth, bounds);
        return (() => {
          const result1 = [];
          for (let expression of Array.from(node.expressions)) {
            result1.push(this.jsSocketAndMark(indentDepth, expression, depth + 1, null));
          }
          return result1;
        })();
      case 'FunctionDeclaration':
        this.jsBlock(node, depth, bounds);
        this.mark(indentDepth, node.body, depth + 1, null);
        this.jsSocketAndMark(indentDepth, node.id, depth + 1, null, null, ['no-drop']);
        if (node.params.length > 0) {
          return this.addSocket({
            bounds: {
              start: this.getBounds(node.params[0]).start,
              end: this.getBounds(node.params[node.params.length - 1]).end
            },
            depth: depth + 1,
            precedence: 0,
            dropdown: null,
            classes: ['no-drop'],
            empty: ''
          });
        } else if (!this.opts.lockZeroParamFunctions) {
          nodeBoundsStart = this.getBounds(node.id).end;
          match = this.lines[nodeBoundsStart.line].slice(nodeBoundsStart.column).match(/^(\s*\()(\s*)\)/);
          if (match != null) {
            return this.addSocket({
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
        break;
      case 'FunctionExpression':
        this.jsBlock(node, depth, bounds);
        this.mark(indentDepth, node.body, depth + 1, null);
        if (node.id != null) {
          this.jsSocketAndMark(indentDepth, node.id, depth + 1, null, null, ['no-drop']);
        }
        if (node.params.length > 0) {
          return this.addSocket({
            bounds: {
              start: this.getBounds(node.params[0]).start,
              end: this.getBounds(node.params[node.params.length - 1]).end
            },
            depth: depth + 1,
            precedence: 0,
            dropdown: null,
            classes: ['no-drop'],
            empty: ''
          });
        } else if (!this.opts.lockZeroParamFunctions) {
          if (node.id != null) {
            nodeBoundsStart = this.getBounds(node.id).end;
            match = this.lines[nodeBoundsStart.line].slice(nodeBoundsStart.column).match(/^(\s*\()(\s*)\)/);
          } else {
            nodeBoundsStart = this.getBounds(node).start;
            match = this.lines[nodeBoundsStart.line].slice(nodeBoundsStart.column).match(/^(\s*function\s*\()(\s*)\)/);
          }
          if (match != null) {
            return position =
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
        break;
      case 'AssignmentExpression':
        this.jsBlock(node, depth, bounds);
        this.jsSocketAndMark(indentDepth, node.left, depth + 1, NEVER_PAREN);
        return this.jsSocketAndMark(indentDepth, node.right, depth + 1, NEVER_PAREN);
      case 'ReturnStatement':
        this.jsBlock(node, depth, bounds);
        if (node.argument != null) {
          return this.jsSocketAndMark(indentDepth, node.argument, depth + 1, null);
        }
        break;
      case 'IfStatement': case 'ConditionalExpression':
        this.jsBlock(node, depth, bounds, {addButton: '+'});
        this.jsSocketAndMark(indentDepth, node.test, depth + 1, NEVER_PAREN);
        this.jsSocketAndMark(indentDepth, node.consequent, depth + 1, null);

        // As long as the else fits the "else-if" pattern,
        // don't mark a new block. Instead, mark the condition
        // and body and continue down the elseif chain.
        var currentElif = node.alternate;
        return (() => {
          const result2 = [];
          while (currentElif != null) {
            if (currentElif.type === 'IfStatement') {
              this.jsSocketAndMark(indentDepth, currentElif.test, depth + 1, null);
              this.jsSocketAndMark(indentDepth, currentElif.consequent, depth + 1, null);
              result2.push(currentElif = currentElif.alternate);
            } else {
              this.jsSocketAndMark(indentDepth, currentElif, depth + 1, 10);
              result2.push(currentElif = null);
            }
          }
          return result2;
        })();
      case 'ForInStatement':
        this.jsBlock(node, depth, bounds);
        if (node.left != null) {
          this.jsSocketAndMark(indentDepth, node.left, depth + 1, NEVER_PAREN, null, ['foreach-lhs']);
        }
        if (node.right != null) {
          this.jsSocketAndMark(indentDepth, node.right, depth + 1, 10);
        }
        return this.mark(indentDepth, node.body, depth + 1);
      case 'BreakStatement': case 'ContinueStatement':
        this.jsBlock(node, depth, bounds);
        if (node.label != null) {
          return this.jsSocketAndMark(indentDepth, node.label, depth + 1, null);
        }
        break;
      case 'ThrowStatement':
        this.jsBlock(node, depth, bounds);
        return this.jsSocketAndMark(indentDepth, node.argument, depth + 1, null);
      case 'ForStatement':
        this.jsBlock(node, depth, bounds);

        // If we are in beginner mode, check to see if the for loop
        // matches the "standard" way, and if so only mark the loop
        // limit (the "b" in "for (...;a < b;...)").
        if (this.opts.categories.loops.beginner && isStandardForLoop(node)) {
           this.jsSocketAndMark(indentDepth, node.test.right);

        } else {
          if (node.init != null) {
            this.jsSocketAndMark(indentDepth, node.init, depth + 1, NEVER_PAREN, null, ['for-statement-init']);
          }
          if (node.test != null) {
            this.jsSocketAndMark(indentDepth, node.test, depth + 1, 10);
          }
          if (node.update != null) {
            this.jsSocketAndMark(indentDepth, node.update, depth + 1, 10, null, ['for-statement-update']);
          }
        }

        return this.mark(indentDepth, node.body, depth + 1);
      case 'BlockStatement':
        var prefix = this.getIndentPrefix(this.getBounds(node), indentDepth);
        indentDepth += prefix.length;
        this.addIndent({
          bounds: this.getBounds(node),
          depth,
          prefix
        });

        return (() => {
          const result3 = [];
          for (let statement of Array.from(node.body)) {
            result3.push(this.mark(indentDepth, statement, depth + 1, null));
          }
          return result3;
        })();
      case 'BinaryExpression':
        this.jsBlock(node, depth, bounds);
        this.jsSocketAndMark(indentDepth, node.left, depth + 1, OPERATOR_PRECEDENCES[node.operator]);
        return this.jsSocketAndMark(indentDepth, node.right, depth + 1, OPERATOR_PRECEDENCES[node.operator]);
      case 'UnaryExpression':
        if (!['-', '+'].includes(node.operator) ||
            !['Identifier', 'Literal'].includes(node.argument.type)) {
          this.jsBlock(node, depth, bounds);
          return this.jsSocketAndMark(indentDepth, node.argument, depth + 1, this.getPrecedence(node));
        }
        break;
      case 'ExpressionStatement':
        return this.mark(indentDepth, node.expression, depth + 1, this.getBounds(node));
      case 'Identifier':
        if (node.name === '__') {
          block = this.jsBlock(node, depth, bounds);
          return block.flagToRemove = true;
        } else if (this.lookupKnownName(node)) {
          return this.jsBlock(node, depth, bounds);
        }
        break;
      case 'CallExpression': case 'NewExpression':
        var known = this.lookupKnownName(node);
        var blockOpts = {};
        var argCount = node.arguments.length;
        if (known != null ? known.fn : undefined) {
          showButtons = (known.fn.minArgs != null) || (known.fn.maxArgs != null);
          minArgs = known.fn.minArgs != null ? known.fn.minArgs : 0;
          maxArgs = known.fn.maxArgs != null ? known.fn.maxArgs : Infinity;
        } else {
          showButtons = this.opts.paramButtonsForUnknownFunctions &&
              ((argCount !== 0) || !this.opts.lockZeroParamFunctions);
          minArgs = 0;
          maxArgs = Infinity;
        }

        if (showButtons) {
          if (argCount < maxArgs) {
            blockOpts.addButton = '\u21A0';
          }
          if (argCount > minArgs) {
            blockOpts.subtractButton = '\u219E';
          }
        }
        this.jsBlock(node, depth, bounds, blockOpts);

        if (!known) {
          this.jsSocketAndMark(indentDepth, node.callee, depth + 1, NEVER_PAREN);
        } else if (known.anyobj && (node.callee.type === 'MemberExpression')) {
          this.jsSocketAndMark(indentDepth, node.callee.object, depth + 1, NEVER_PAREN, null, null, __guard__(known != null ? known.fn : undefined, x => x.objectDropdown));
        }
        for (var i = 0; i < node.arguments.length; i++) {
          argument = node.arguments[i];
          this.jsSocketAndMark(indentDepth, argument, depth + 1, NEVER_PAREN, null, null, __guard__(__guard__(known != null ? known.fn : undefined, x2 => x2.dropdown), x1 => x1[i]));
        }
        if (!known && (argCount === 0) && !this.opts.lockZeroParamFunctions) {
          // Create a special socket that can be used for inserting the first parameter
          // (NOTE: this socket may not be visible if the bounds start/end are the same)
          position = {
            line: node.callee.loc.end.line,
            column: node.callee.loc.end.column
          };
          const string = this.lines[position.line].slice(position.column).match(/^\s*\(/)[0];
          position.column += string.length;
          const endPosition = {
            line: position.line,
            column: position.column
          };
          const space = this.lines[position.line].slice(position.column).match(/^(\s*)\)/);
          if (space != null) {
            endPosition.column += space[1].length;
          }
          return this.addSocket({
            bounds: {
              start: position,
              end: endPosition
            },
            depth: depth + 1,
            precedence: NEVER_PAREN,
            dropdown: null,
            classes: ['mostly-value'],
            empty: ''
          });
        }
        break;
      case 'MemberExpression':
        this.jsBlock(node, depth, bounds);
        known = this.lookupKnownName(node);
        if (!known) {
          this.jsSocketAndMark(indentDepth, node.property, depth + 1);
        }
        if (!known || known.anyobj) {
          return this.jsSocketAndMark(indentDepth, node.object, depth + 1);
        }
        break;
      case 'UpdateExpression':
        this.jsBlock(node, depth, bounds);
        return this.jsSocketAndMark(indentDepth, node.argument, depth + 1);
      case 'VariableDeclaration':
        this.jsBlock(node, depth, bounds);
        return Array.from(node.declarations).map((declaration) =>
          this.mark(indentDepth, declaration, depth + 1));
      case 'VariableDeclarator':
        this.jsSocketAndMark(indentDepth, node.id, depth);
        if (node.init != null) {
          return this.jsSocketAndMark(indentDepth, node.init, depth, NEVER_PAREN);
        }
        break;
      case 'LogicalExpression':
        this.jsBlock(node, depth, bounds);
        this.jsSocketAndMark(indentDepth, node.left, depth + 1, this.getPrecedence(node));
        return this.jsSocketAndMark(indentDepth, node.right, depth + 1, this.getPrecedence(node));
      case 'WhileStatement': case 'DoWhileStatement':
        this.jsBlock(node, depth, bounds);
        this.jsSocketAndMark(indentDepth, node.body, depth + 1);
        return this.jsSocketAndMark(indentDepth, node.test, depth + 1);
      case 'ObjectExpression':
        this.jsBlock(node, depth, bounds);
        return (() => {
          const result4 = [];
          for (let property of Array.from(node.properties)) {
            this.jsSocketAndMark(indentDepth, property.key, depth + 1);
            result4.push(this.jsSocketAndMark(indentDepth, property.value, depth + 1));
          }
          return result4;
        })();
      case 'SwitchStatement':
        this.jsBlock(node, depth, bounds);
        this.jsSocketAndMark(indentDepth, node.discriminant, depth + 1);
        return Array.from(node.cases).map((switchCase) =>
          this.mark(indentDepth, switchCase, depth + 1, null));
      case 'SwitchCase':
        if (node.test != null) {
          this.jsSocketAndMark(indentDepth, node.test, depth + 1);
        }

        if (node.consequent.length > 0) {
          bounds = this.getCaseIndentBounds(node);
          prefix = this.getIndentPrefix(this.getBounds(node), indentDepth);
          indentDepth += prefix.length;

          this.addIndent({
            bounds,
            depth: depth + 1,
            prefix
          });

          return (() => {
            const result5 = [];
            for (let statement of Array.from(node.consequent)) {
              result5.push(this.mark(indentDepth, statement, depth + 2));
            }
            return result5;
          })();
        }
        break;
      case 'TryStatement':
        this.jsBlock(node, depth, bounds);
        this.jsSocketAndMark(indentDepth, node.block, depth + 1, null);
        if (node.handler != null) {
          if (node.handler.guard != null) {
            this.jsSocketAndMark(indentDepth, node.handler.guard, depth + 1, null);
          }
          if (node.handler.param != null) {
            this.jsSocketAndMark(indentDepth, node.handler.param, depth + 1, null);
          }
          this.jsSocketAndMark(indentDepth, node.handler.body, depth + 1, null);
        }
        if (node.finalizer != null) {
          return this.jsSocketAndMark(indentDepth, node.finalizer, depth + 1, null);
        }
        break;
      case 'ArrayExpression':
        this.jsBlock(node, depth, bounds);
        return (() => {
          const result6 = [];
          for (let element of Array.from(node.elements)) {
            if (element != null) {
              result6.push(this.jsSocketAndMark(indentDepth, element, depth + 1, null));
            } else {
              result6.push(undefined);
            }
          }
          return result6;
        })();
      case 'Literal':
        return null;
      default:
        return console.log('Unrecognized', node);
    }
  }

  jsBlock(node, depth, bounds, buttons) {
    return this.addBlock({
      bounds: bounds != null ? bounds : this.getBounds(node),
      depth,
      precedence: this.getPrecedence(node),
      color: this.getColor(node),
      classes: this.getClasses(node),
      socketLevel: this.getSocketLevel(node),
      buttons
    });
  }

  jsSocketAndMark(indentDepth, node, depth, precedence, bounds, classes, dropdown, empty) {
    if (node.type !== 'BlockStatement') {
      this.addSocket({
        bounds: bounds != null ? bounds : this.getBounds(node),
        depth,
        precedence,
        classes: classes != null ? classes : [],
        dropdown,
        empty
      });
    }

    return this.mark(indentDepth, node, depth + 1, bounds);
  }
});

JavaScriptParser.parens = function(leading, trailing, node, context) {
  // Don't attempt to paren wrap comments
  if (Array.from(node.classes).includes('__comment__')) { return; }

  if (((context != null ? context.type : undefined) === 'socket') ||
     (((context == null) && Array.from(node.classes).includes('mostly-value')) || Array.from(node.classes).includes('value-only')) ||
     Array.from(node.classes).includes('ends-with-brace') ||
     (node.type === 'document')) {
    trailing(trailing().replace(/;?\s*$/, ''));
  } else {
    trailing(trailing().replace(/;?\s*$/, ';'));
  }

  while (true) {
    if ((leading().match(/^\s*\(/) != null) && (trailing().match(/\)\s*/) != null)) {
      leading(leading().replace(/^\s*\(\s*/, ''));
      trailing(trailing().replace(/\s*\)\s*$/, ''));
    } else {
      break;
    }
  }

  if ((context !== null) && (context.type === 'socket') &&
      !(context.precedence > node.precedence)) {
    leading(`(${leading()}`);
    return trailing(trailing() + ')');
  }
};

JavaScriptParser.drop = function(block, context, pred) {
  if (context.type === 'socket') {
    if (Array.from(context.classes).includes('lvalue')) {
      if (Array.from(block.classes).includes('Value') && ((block.properties != null ? block.properties.length : undefined) > 0)) {
        return helper.ENCOURAGE;
      } else {
        return helper.FORBID;
      }

    } else if (Array.from(context.classes).includes('no-drop')) {
      return helper.FORBID;

    } else if (Array.from(context.classes).includes('property-access')) {
      if (Array.from(block.classes).includes('works-as-method-call')) {
        return helper.ENCOURAGE;
      } else {
        return helper.FORBID;
      }

    } else if (Array.from(block.classes).includes('value-only') ||
        Array.from(block.classes).includes('mostly-value') ||
        Array.from(block.classes).includes('any-drop') ||
        Array.from(context.classes).includes('for-statement-init') ||
        (Array.from(block.classes).includes('mostly-block') &&
        Array.from(context.classes).includes('for-statement-update'))) {
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

// Check to see if a "for" loop is standard, for beginner mode.
// We will simplify any loop of the form:
// ```
// for (var i = X; i < Y; i++) {
//   // etc...
// }
// `
// Where "var" is optional and "i++" can be pre- or postincrement.
var isStandardForLoop = function(node) {
  let variableName;
  if ((node.init == null) || (node.test == null) || (node.update == null)) {
    return false;
  }

  // A standard for loop starts with "var a =" or "a = ".
  // Determine the variable name so that we can check against it
  // in the other two expression.
  if (node.init.type === 'VariableDeclaration') {
    variableName = node.init.declarations[0].id.name;
  } else if ((node.init.type === 'AssignmentExpression') &&
      (node.operator === '=') &&
      (node.left.type === 'Identifier')) {
    variableName = node.left.name;
  } else {
    return false;
  }

  return ((node.test.type === 'BinaryExpression') &&
      (node.test.operator === '<') &&
      (node.test.left.type === 'Identifier') &&
      (node.test.left.name === variableName) &&
      ['Literal', 'Identifier'].includes(node.test.right.type) &&
      (node.update.type === 'UpdateExpression') &&
      (node.update.operator === '++') &&
      (node.update.argument.type === 'Identifier') &&
      (node.update.argument.name === variableName));
};

JavaScriptParser.empty = "__";
JavaScriptParser.emptyIndent = "";
JavaScriptParser.startComment = '/*';
JavaScriptParser.endComment = '*/';
JavaScriptParser.startSingleLineComment = '//';

JavaScriptParser.getDefaultSelectionRange = function(string) {
  let start = 0; let end = string.length;
  if ((string[0] === string[string.length - 1]) && ['"', '\'', '/'].includes(string[0])) {
    start += 1; end -= 1;
  }
  return {start, end};
};

module.exports = parser.wrapParser(JavaScriptParser);

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}