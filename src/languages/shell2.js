/*
 * decaffeinate suggestions:
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Droplet Python mode
//
// Copyright (c) 2015 Anthony Bau
// MIT License

const helper = require('../helper');
const model = require('../model');
const parser = require('../parser');
const treewalk = require('../treewalk');

const skulpt = require('../../vendor/skulpt');

// PARSER SECTION
const parse = function(context, text) {
  const result = transform(skulpt.parser.parse('file.py', text), text.split('\n'));
  console.log(result);
  return result;
};

var getBounds = function(node, lines) {
  const bounds = {
    start: {
      line: node.lineno - 1,
      column: node.col_offset
    }
  };
  if ((node.children != null) && (node.children.length > 0)) {
    if (skulpt.tables.ParseTables.number2symbol[node.type] === 'suite') {
      // Avoid including DEDENT in the indent.
      bounds.end = getBounds(node.children[node.children.length - 2], lines).end;
    } else {
      bounds.end = getBounds(node.children[node.children.length - 1], lines).end;
    }
  } else {
    bounds.end = {
      line: node.line_end - 1,
      column: node.col_end
    };
  }
  return bounds;
};

var transform = function(node, lines, parent = null) {
  let left;
  const result = {
    type: (left = skulpt.tables.ParseTables.number2symbol[node.type] != null ? skulpt.tables.ParseTables.number2symbol[node.type] : skulpt.Tokenizer.tokenNames[node.type]) != null ? left : node.type,
    bounds: getBounds(node, lines),
    parent
  };
  result.children = (node.children != null) ?
      node.children.map((x => transform(x, lines, result)))
    : [];

  return result;
};

// CONFIG SECTION
const INDENTS = ['suite'];
const SKIPS = [
  'file_input',
  'parameters',
  'compound_stmt',
  'small_stmt',
  'simple_stmt',
  'trailer',
  'arglist',
  'testlist_comp'
];
const PARENS = [
  'stmt'
];
const SOCKET_TOKENS = [
  'T_NAME', 'T_NUMBER', 'T_STRING'
];
const COLORS_FORWARD = {
  'funcdef': 'control',
  'for_stmt': 'control',
  'while_stmt': 'control',
  'if_stmt': 'control',
  'import_stmt': 'command',
  'print_stmt': 'command',
  'expr_stmt': 'command',
  'testlist': 'value',
  'test': 'value',
  'expr': 'value'
};
const COLORS_BACKWARD = {};

const config = {
  INDENTS, SKIPS, PARENS, SOCKET_TOKENS, COLORS_FORWARD, COLORS_BACKWARD,
};

module.exports = parser.wrapParser(treewalk.createTreewalkParser(parse, config));
