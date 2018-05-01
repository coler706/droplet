// Droplet Java mode
//
// Copyright (c) 2015 Anthony Bau
// MIT License
const parser = require('../parser');
const antlrHelper = require('../antlr');

const INDENTS = ['block', 'classBody'];
const SKIPS = ['compilationUnit',
  'variableDeclarators',
  'variableDeclarator',
  'classDeclaration',
  'memberDeclaration',
  'constructorDeclaration',
  'methodDeclaration',
  'formalParameters',
  'formalParameterList'
];
const PARENS = [
  'statement',
  'blockStatement',
  'localVariableDeclarationStatement',
  'primary'
];
const SOCKET_TOKENS = [
  'Identifier',
  'IntegerLiteral',
  'StringLiteral'
];
const COLORS_FORWARD = {
  'statement': 'control',
  'typeDeclaration': 'control',
  'classBodyDeclaration': 'control',
  'variableDeclarator': 'command',
  'formalParameter': 'command',
  'statementExpression': 'command',
  'blockStatement': 'command',
  'expression': 'value'
};
const COLORS_BACKWARD = {};

const config = {
  INDENTS, SKIPS, PARENS, SOCKET_TOKENS, COLORS_FORWARD, COLORS_BACKWARD,
};

module.exports = parser.wrapParser(antlrHelper.createANTLRParser('Java', config));
