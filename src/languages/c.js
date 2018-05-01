/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Droplet C mode
//
// Copyright (c) 2015 Anthony Bau
// MIT License

const helper = require('../helper');
const parser = require('../parser');
const antlrHelper = require('../antlr');

const {fixQuotedString, looseCUnescape, quoteAndCEscape} = helper;

const RULES = {
  // Indents
  'compoundStatement': {
    'type': 'indent',
    'indentContext': 'blockItem',
  },
  'structDeclarationsBlock': {
    'type': 'indent',
    'indentContext': 'structDeclaration'
  },

  // Parens
  'expressionStatement': 'parens',
  'primaryExpression': 'parens',
  'structDeclaration': 'parens',

  // Skips
  'blockItemList': 'skip',
  'macroParamList': 'skip',
  'compilationUnit': 'skip',
  'translationUnit': 'skip',
  'declarationSpecifiers': 'skip',
  'declarationSpecifier': 'skip',
  'typeSpecifier': 'skip',
  'structOrUnionSpecifier': 'skip',
  'structDeclarationList': 'skip',
  'declarator': 'skip',
  'directDeclarator': 'skip',
  'rootDeclarator': 'skip',
  'parameterTypeList': 'skip',
  'parameterList': 'skip',
  'argumentExpressionList': 'skip',
  'initializerList': 'skip',
  'initDeclaratorList': 'skip',

  // Sockets
  'Identifier': 'socket',
  'StringLiteral': 'socket',
  'SharedIncludeLiteral': 'socket',
  'Constant': 'socket'
};

const COLOR_RULES = [
  ['jumpStatement', 'return'], // e.g. `return 0;`
  ['declaration', 'control'], // e.g. `int a;`
  ['specialMethodCall', 'command'], // e.g. `a(b);`
  ['equalityExpression', 'value'], // e.g. `a == b`
  ['additiveExpression', 'value'], // e.g. `a + b`
  ['multiplicativeExpression', 'value'], // e.g. `a * b`
  ['postfixExpression', 'command'], // e.g. `a(b, c);` OR `a++`
  ['iterationStatement', 'control'], // e.g. `for (int i = 0; i < 10; i++) { }`
  ['selectionStatement', 'control'], // e.g. if `(a) { } else { }` OR `switch (a) { }`
  ['assignmentExpression', 'command'], // e.g. `a = b;` OR `a = b`
  ['relationalExpression', 'value'], // e.g. `a < b`
  ['initDeclarator', 'command'], // e.g. `a = b` when inside `int a = b;`
  ['blockItemList', 'control'], // List of commands
  ['compoundStatement', 'control'], // List of commands inside braces
  ['externalDeclaration', 'control'], // e.g. `int a = b` when global
  ['structDeclaration', 'command'], // e.g. `struct a { }`
  ['declarationSpecifier', 'control'], // e.g. `int` when in `int a = b;`
  ['statement', 'command'], // Any statement, like `return 0;`
  ['functionDefinition', 'control'], // e.g. `int myMethod() { }`
  ['expressionStatement', 'command'], // Statement that consists of an expression, like `a = b;`
  ['expression', 'value'], // Any expression, like `a + b`
  ['parameterDeclaration', 'command'], // e.g. `int a` when in `int myMethod(int a) { }`
  ['unaryExpression', 'value'], // e.g. `sizeof(a)`
  ['typeName', 'value'], // e.g. `int`
  ['initializer', 'value'], // e.g. `{a, b, c}` when in `int x[] = {a, b, c};`
  ['castExpression', 'value'] // e.g. `(b)a`
];

const SHAPE_RULES = [
  ['blockItem', 'block-only'], // Any statement, like `return 0;`
  ['expression', 'value-only'], // Any expression, like `a + b`
  ['postfixExpression', 'block-only'], // e.g. `a(b, c);` OR `a++`
  ['equalityExpression', 'value-only'], // e.g. `a == b`
  ['logicalAndExpression', 'value-only'], // e.g. `a && b`
  ['logicalOrExpression', 'value-only'], // e.g. `a || b`
  ['iterationStatement', 'block-only'], // e.g. `for (int i = 0; i < 10; i++) { }`
  ['selectionStatement', 'block-only'], // e.g. if `(a) { } else { }` OR `switch (a) { }`
  ['assignmentExpression', 'block-only'], // e.g. `a = b;` OR `a = b`
  ['relationalExpression', 'value-only'], // e.g. `a < b`
  ['initDeclarator', 'block-only'], // e.g. `a = b` when inside `int a = b;`
  ['externalDeclaration', 'block-only'], // e.g. `int a = b` when global
  ['structDeclaration', 'block-only'], // e.g. `struct a { }`
  ['declarationSpecifier', 'block-only'], // e.g. `int` when in `int a = b;`
  ['statement', 'block-only'], // Any statement, like `return 0;`
  ['functionDefinition', 'block-only'], // e.g. `int myMethod() { }`
  ['expressionStatement', 'block-only'], // Statement that consists of an expression, like `a = b;`
  ['additiveExpression', 'value-only'], // e.g. `a + b`
  ['multiplicativeExpression', 'value-only'], // e.g. `a * b`
  ['declaration', 'block-only'], // e.g. `int a;`
  ['parameterDeclaration', 'block-only'], // e.g. `int a` when in `int myMethod(int a) { }`
  ['unaryExpression', 'value-only'], // e.g. `sizeof(a)`
  ['typeName', 'value-only'], // e.g. `int`
  ['initializer', 'value-only'], // e.g. `{a, b, c}` when in `int x[] = {a, b, c};`
  ['castExpression', 'value-only'] // e.g. `(b)a`
];

const config = {
  RULES, COLOR_RULES, SHAPE_RULES
};

const ADD_PARENS = function(leading, trailing, node, context) {
  leading(`(${leading()}`);
  return trailing(trailing() + ')');
};

const STATEMENT_TO_EXPRESSION = function(leading, trailing, node, context) {
  let matching = false;
  for (let c of Array.from(node.classes)) {
    if (c.slice(0, '__parse__'.length) === '__parse__') {
      if (Array.from(context.classes).includes(c)) {
        matching = true;
        break;
      }
    }
  }
  if (matching) {
    leading(`(${leading()}`);
    return trailing(trailing().replace(/\s*;\s*$/, '') + ')');
  } else {
    return trailing(trailing().replace(/\s*;\s*$/, ''));
  }
};

const EXPRESSION_TO_STATEMENT = function(leading, trailing, node, context) {
  while (true) {
    if ((leading().match(/^\s*\(/) != null) && (trailing().match(/\)\s*/) != null)) {
      leading(leading().replace(/^\s*\(\s*/, ''));
      trailing(trailing().replace(/\s*\)\s*$/, ''));
    } else {
      break;
    }
  }

  return trailing(trailing() + ';');
};

config.PAREN_RULES = {
  'primaryExpression': {
    'expression': ADD_PARENS,
    'additiveExpression': ADD_PARENS,
    'multiplicativeExpression': ADD_PARENS,
    'assignmentExpression': ADD_PARENS,
    'postfixExpression': ADD_PARENS,
    'expressionStatement': STATEMENT_TO_EXPRESSION,
    'specialMethodCall': STATEMENT_TO_EXPRESSION
  },
  'blockItem': {
    'expression': EXPRESSION_TO_STATEMENT,
    'additiveExpression': EXPRESSION_TO_STATEMENT,
    'multiplicativeExpression': EXPRESSION_TO_STATEMENT,
    'assignmentExpression': EXPRESSION_TO_STATEMENT,
    'postfixExpression': EXPRESSION_TO_STATEMENT
  }
};

// Test to see if a node is a method call
const getMethodName = function(node) {
  if ((node.type === 'postfixExpression') &&
     // The children of a method call are either
     // `(method) '(' (paramlist) ')'` OR `(method) '(' ')'`
     [3, 4].includes(node.children.length) &&
     // Check to make sure that the correct children are parentheses
     (node.children[1].type === 'LeftParen') &&
     ((node.children[2].type === 'RightParen') || ((node.children[3] != null ? node.children[3].type : undefined) === 'RightParen')) &&
     // Check to see whether the called method is a single identifier, like `puts` in
     // `getc()`, rather than `getFunctionPointer()()` or `a.b()`
     (node.children[0].children[0].type === 'primaryExpression') &&
     (node.children[0].children[0].children[0].type === 'Identifier')) {

    // If all of these are true, we have a function name to give
    return node.children[0].children[0].children[0].data.text;

  // Alternatively, we could have the special `a(b)` node.
  } else if (node.type === 'specialMethodCall') {
    return node.children[0].data.text;
  }

  return null;
};

config.SHOULD_SOCKET = function(opts, node) {
  // We will not socket if we are the identifier
  // in a single-identifier function call like `a(b, c)`
  // and `a` is in the known functions list.
  //
  // We can only be such an identifier if we have the appropriate number of parents;
  // check.
  if ((opts.knownFunctions == null) || (((node.parent == null) || (node.parent.parent == null) || (node.parent.parent.parent == null)) &&
      ((node.parent != null ? node.parent.type : undefined) !== 'specialMethodCall'))) {
    return true;
  }

  // Check to see whether the thing we are in is a function
  if ((((node.parent != null ? node.parent.type : undefined) === 'specialMethodCall') || ((getMethodName(node.parent.parent.parent) != null) &&
     // Check to see whether we are the first child
     (node.parent.parent === node.parent.parent.parent.children[0]) &&
     (node.parent === node.parent.parent.children[0]) &&
     (node === node.parent.children[0]))) &&
     // Finally, check to see if our name is a known function name
     node.data.text in opts.knownFunctions) {

    // If the checks pass, do not socket.
    return false;
  }

  return true;
};

// Color and shape callbacks look up the method name
// in the known functions list if available.
config.COLOR_CALLBACK = function(opts, node) {
  if (opts.knownFunctions == null) { return null; }

  const name = getMethodName(node);

  if ((name != null) && name in opts.knownFunctions) {
    return opts.knownFunctions[name].color;
  } else {
    return null;
  }
};

config.SHAPE_CALLBACK = function(opts, node) {
  if (opts.knownFunctions == null) { return null; }

  const name = getMethodName(node);

  if ((name != null) && name in opts.knownFunctions) {
    return opts.knownFunctions[name].shape;
  } else {
    return null;
  }
};

config.isComment = text => text.match(/^(\s*\/\/.*)|(#.*)$/) != null;

config.parseComment = function(text) {
  // Try standard comment
  let color, sockets;
  const comment = text.match(/^(\s*\/\/)(.*)$/);
  if (comment != null) {
    sockets =  [
      [comment[1].length, comment[1].length + comment[2].length]
    ];
    color = 'comment';

    return {sockets, color};
  }

  if (text.match(/^#\s*((?:else)|(?:endif))$/)) {
    sockets =  [];
    color = 'purple';

    return {sockets, color};
  }

  // Try #define directive
  let binary = text.match(/^(#\s*(?:(?:define))\s*)([a-zA-Z_][0-9a-zA-Z_]*)(\s+)(.*)$/);
  if (binary != null) {
    sockets =  [
      [binary[1].length, binary[1].length + binary[2].length],
      [binary[1].length + binary[2].length + binary[3].length, binary[1].length + binary[2].length + binary[3].length + binary[4].length]
    ];
    color = 'purple';

    return {sockets, color};
  }

  // Try functional #define directive.
  binary = text.match(/^(#\s*define\s*)([a-zA-Z_][0-9a-zA-Z_]*\s*\((?:[a-zA-Z_][0-9a-zA-Z_]*,\s)*[a-zA-Z_][0-9a-zA-Z_]*\s*\))(\s+)(.*)$/);
  if (binary != null) {
    sockets =  [
      [binary[1].length, binary[1].length + binary[2].length],
      [binary[1].length + binary[2].length + binary[3].length, binary[1].length + binary[2].length + binary[3].length + binary[4].length]
    ];
    color = 'purple';

    return {sockets, color};
  }

  // Try any of the unary directives: #define, #if, #ifdef, #ifndef, #undef, #pragma
  let unary = text.match(/^(#\s*(?:(?:define)|(?:ifdef)|(?:if)|(?:ifndef)|(?:undef)|(?:pragma))\s*)(.*)$/);
  if (unary != null) {
    sockets =  [
      [unary[1].length, unary[1].length + unary[2].length]
    ];
    color = 'purple';

    return {sockets, color};
  }

  // Try #include, which must include the quotations
  unary = text.match(/^(#\s*include\s*<)(.*)>\s*$/);
  if (unary != null) {
    sockets =  [
      [unary[1].length, unary[1].length + unary[2].length]
    ];
    color = 'purple';

    return {sockets, color};
  }

  unary = text.match(/^(#\s*include\s*")(.*)"\s*$/);
  if (unary != null) {
    sockets =  [
      [unary[1].length, unary[1].length + unary[2].length]
    ];
    color = 'purple';

    return {sockets, color};
  }
};

config.getDefaultSelectionRange = function(string) {
  let middle;
  let start = 0; let end = string.length;
  if ((string.length > 1) && (string[0] === string[string.length - 1]) && (string[0] === '"')) {
    start += 1; end -= 1;
  }
  if ((string.length > 1) && (string[0] === '<') && (string[string.length - 1] === '>')) {
    start += 1; end -= 1;
  }
  if ((string.length === 3) && (string[0] === (middle = string[string.length - 1]) && middle === '\'')) {
    start += 1; end -= 1;
  }
  return {start, end};
};

config.stringFixer = function(string) {
  if (/^['"]|['"]$/.test(string)) {
    return fixQuotedString([string]);
  } else {
    return string;
  }
};

config.empty = '__0_droplet__';
config.emptyIndent = '';

// TODO Implement removing parentheses at some point
//config.unParenWrap = (leading, trailing, node, context) ->
//  while true
//   if leading().match(/^\s*\(/)? and trailing().match(/\)\s*/)?
//     leading leading().replace(/^\s*\(\s*/, '')
//      trailing trailing().replace(/\s*\)\s*$/, '')
//    else
//      break

// DEBUG
config.unParenWrap = null;

module.exports = parser.wrapParser(antlrHelper.createANTLRParser('C', config));
