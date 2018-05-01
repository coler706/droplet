/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Droplet ANTLR adapter
//
// Copyright (c) 2015 Anthony Bau (dab1998@gmail.com)
// MIT License

const helper = require('./helper');
const model = require('./model');
let parser = require('./parser');
const treewalk = require('./treewalk');
const antlr4 = require('antlr4');

const ANTLR_PARSER_COLLECTION = {
  'JavaLexer': require('../antlr/JavaLexer'),
  'JavaParser': require('../antlr/JavaParser'),
  'CLexer': require('../antlr/CLexer'),
  'CParser': require('../antlr/CParser'),
  'jvmBasicLexer': require('../antlr/jvmBasicLexer'),
  'jvmBasicParser': require('../antlr/jvmBasicParser'),
};

exports.createANTLRParser = function(name, config, root) {
  if (root == null) { root = 'compilationUnit'; }

  const parse = function(context, text) {
    // Construct but do not execute all of the necessary ANTLR accessories
    const chars = new antlr4.InputStream(text);
    const lexer = new (ANTLR_PARSER_COLLECTION[`${name}Lexer`][`${name}Lexer`])(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    parser = new (ANTLR_PARSER_COLLECTION[`${name}Parser`][`${name}Parser`])(tokens);

    parser._errHandler = new antlr4.error.BailErrorStrategy();

    // Build the actual parse tree
    parser.buildParseTrees = true;
    return transform(parser[context + '_DropletFile']());
  };

  // Transform an ANTLR tree into a treewalker-type tree
  var transform = function(node, parent = null) {
    const result = {};
    if (node.children != null) {
      result.terminal = node.children.length === 0;
      result.type = node.parser.ruleNames[node.ruleIndex];
      result.children = (Array.from(node.children).map((child) => transform(child, result)));
      result.bounds = getBounds(node);
      result.parent = parent;
    } else {
      result.terminal = true;
      result.children = [];
      result.bounds = getBounds(node);
      result.parent = parent;
      if (node.symbol != null) {
        result.type = (node.parser != null ? node.parser : node.parentCtx.parser).symbolicNames[node.symbol.type];
        result.data = {text: node.symbol.text};
      } else {
        result.type = node.parser.ruleNames[node.ruleIndex];
        result.data = {};
      }
    }
    if ((result.type != null) && (result.type.slice(-'_DropletFile'.length) === '_DropletFile')) {
      result.type = result.type.slice(0, -'_DropletFile'.length);
      result.children.pop();
    }

    return result;
  };

  var getBounds = function(node) {
    if ((node.start != null) && (node.stop != null)) {
      return {
        start: {
          line: node.start.line - 1,
          column: node.start.column
        },
        end: {
          line: node.stop.line - 1,
          column: ((node.stop.column + node.stop.stop) - node.stop.start) + 1
        }
      };
    } else if ((node.start != null) && (node.symbol == null)) {
      return {
        start: {
          line: node.start.line - 1,
          column: node.start.column
        },
        end: {
          line: node.start.line - 1,
          column: node.start.column
        }
      };
    } else {
      return {
        start: {
          line: node.symbol.line - 1,
          column: node.symbol.column
        },
        end: {
          line: node.symbol.line - 1,
          column: ((node.symbol.column + node.symbol.stop) - node.symbol.start) + 1
        }
      };
    }
  };

  return treewalk.createTreewalkParser(parse, config, root);
};
