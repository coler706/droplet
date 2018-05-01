// Droplet BASIC mode
//
// Copyright (c) Anthony Bau
// MIT License

const parser = require('../parser');
const antlrHelper = require('../antlr');

const INDENTS = ['compoundStatement'];
const SKIPS = [
  'prog',
  'gte',
  'lte',
];
const PARENS = ['func'];
const SOCKET_TOKENS = ['NUMBER', 'FLOAT', 'STRINGLITERAL', 'LETTERS', 'COMMENT'];
const COLORS_FORWARD = {
  'line': 'control',
  'statement': 'command',
  'expression': 'value',
  'printlist': 'value'
};
const COLORS_BACKWARD = {
};

const config = {
  INDENTS, SKIPS, PARENS, SOCKET_TOKENS, COLORS_FORWARD, COLORS_BACKWARD
};

module.exports = parser.wrapParser(antlrHelper.createANTLRParser('jvmBasic', config, 'prog'));
