/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Droplet Treewalker framework.
//
// Copyright (c) Anthony Bau (dab1998@gmail.com)
// MIT License
const helper = require('./helper');
const model = require('./model');
const parser = require('./parser');

exports.createTreewalkParser = function(parse, config, root) {
  class TreewalkParser extends parser.Parser {
    constructor(text, opts) {
      {
        // Hack: trick Babel/TypeScript into allowing this before super.
        if (false) { super(); }
        let thisFn = (() => { return this; }).toString();
        let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
        eval(`${thisName} = this;`);
      }
      this.text = text;
      if (opts == null) { opts = {}; }
      this.opts = opts;
      super(...arguments);

      this.lines = this.text.split('\n');
    }

    isComment(text) {
      if ((config != null ? config.isComment : undefined) != null) {
        return config.isComment(text);
      } else {
        return false;
      }
    }

    parseComment(text) {
      return config.parseComment(text);
    }

    markRoot(context) {
      if (context == null) { context = root; }
      const parseTree = parse(context, this.text);

      // Parse
      return this.mark(parseTree, '', 0);
    }

    guessPrefix(bounds) {
      const line = this.lines[bounds.start.line + 1];
      return line.slice(0, line.length - line.trimLeft().length);
    }

    applyRule(rule, node) {
      if ('string' === typeof rule) {
        return {type: rule};
      } else if (rule instanceof Function) {
        return rule(node);
      } else {
        return rule;
      }
    }

    det(node) {
      if (node.type in config.RULES) {
        return this.applyRule(config.RULES[node.type], node).type;
      }
      return 'block';
    }

    detNode(node) { if (node.blockified) { return 'block'; } else { return this.det(node); } }

    getColor(node, rules) {
      const color = typeof config.COLOR_CALLBACK === 'function' ? config.COLOR_CALLBACK(this.opts, node) : undefined;
      if (color != null) {
        return color;
      }

      // Apply the static rules set given in config
      const rulesSet = {};
      rules.forEach(el => rulesSet[el] = true);

      for (let colorRule of Array.from(config.COLOR_RULES)) {
        if (colorRule[0] in rulesSet) {
          return colorRule[1];
        }
      }

      return 'comment';
    }

    getShape(node, rules) {
      const shape = typeof config.SHAPE_CALLBACK === 'function' ? config.SHAPE_CALLBACK(this.opts, node) : undefined;
      if (shape != null) {
        return shape;
      }

      // Apply the static rules set given in config
      const rulesSet = {};
      rules.forEach(el => rulesSet[el] = true);

      for (let shapeRule of Array.from(config.SHAPE_RULES)) {
        if (shapeRule[0] in rulesSet) {
          return shapeRule[1];
        }
      }

      return 'any-drop';
    }

    mark(node, prefix, depth, pass, rules, context, wrap, wrapRules) {
      let bounds, end, start;
      if (!pass) {
        let needle;
        context = node.parent;
        while ((context != null) && (needle = this.detNode(context), ['skip', 'parens'].includes(needle))) {
          context = context.parent;
        }
      }

      if (rules == null) { rules = []; }
      rules = rules.slice(0);
      rules.push(node.type);

      // Pass through to child if single-child
      if ((node.children.length === 1) && (this.detNode(node) !== 'indent')) {
        return this.mark(node.children[0], prefix, depth, true, rules, context, wrap, wrapRules);

      } else if (node.children.length > 0) {
        let child;
        let i, origin;
        switch (this.detNode(node)) {
          case 'block':
            if (wrap != null) {
              ({ bounds } = wrap);
            } else {
              ({ bounds } = node);
            }

            if ((context != null) && (this.detNode(context) === 'block')) {
              this.addSocket({
                bounds,
                depth,
                classes: padRules(wrapRules != null ? wrapRules : rules),
                parseContext: rules[0]}); //(if wrap? then wrap.type else rules[0])
            }

            this.addBlock({
              bounds,
              depth: depth + 1,
              color: this.getColor(node, rules),
              classes: padRules(wrapRules != null ? wrapRules : rules).concat(this.getShape(node, rules)),
              parseContext: rules[0]}); //(if wrap? then wrap.type else rules[0])
            break;

          case 'parens':
            // Parens are assumed to wrap the only child that has children
            child = null; var ok = true;
            for (i = 0; i < node.children.length; i++) {
              const el = node.children[i];
              if (el.children.length > 0) {
                if (child != null) {
                  ok = false;
                  break;
                } else {
                  child = el;
                }
              }
            }
            if (ok) {
              this.mark(child, prefix, depth, true, rules, context, wrap != null ? wrap : node, wrapRules != null ? wrapRules : rules);
              return;

            } else {
              node.blockified = true;

              if (wrap != null) {
                ({ bounds } = wrap);
              } else {
                ({ bounds } = node);
              }

              if ((context != null) && (this.detNode(context) === 'block')) {
                this.addSocket({
                  bounds,
                  depth,
                  classes: padRules(wrapRules != null ? wrapRules : rules),
                  parseContext: rules[0]}); //(if wrap? then wrap.type else rules[0])
              }

              this.addBlock({
                bounds,
                depth: depth + 1,
                color: this.getColor(node, rules),
                classes: padRules(wrapRules != null ? wrapRules : rules).concat(this.getShape(node, rules)),
                parseContext: rules[0]}); //(if wrap? then wrap.type else rules[0])
            }
            break;

          case 'indent':
            // A lone indent needs to be wrapped in a block.
            if (this.det(context) !== 'block') {
              this.addBlock({
                bounds: node.bounds,
                depth,
                color: this.getColor(node, rules),
                classes: padRules(wrapRules != null ? wrapRules : rules).concat(this.getShape(node, rules)),
                parseContext: rules[0]}); //(if wrap? then wrap.type else rules[0])

              depth += 1;
            }

            start = (origin = node.children[0].bounds.start);
            for (i = 0; i < node.children.length; i++) {
              child = node.children[i];
              if (child.children.length > 0) {
                break;
              } else if ((helper.clipLines(this.lines, origin, child.bounds.end).trim().length !== 0) && (i !== (node.children.length - 1))) {
                start = child.bounds.end;
              }
            }

            ({ end } = node.children[node.children.length - 1].bounds);
            for (i = node.children.length - 1; i >= 0; i--) {
              child = node.children[i];
              if (child.children.length > 0) {
                ({ end } = child.bounds);
                break;
              } else if (i !== 0) {
                end = child.bounds.start;
                if (this.lines[end.line].slice(0, end.column).trim().length === 0) {
                  end.line -= 1;
                  end.column = this.lines[end.line].length;
                }
              }
            }

            bounds = {
              start,
              end
            };

            var oldPrefix = prefix;
            prefix = this.guessPrefix(bounds);

            this.addIndent({
              bounds,
              depth,
              prefix: prefix.slice(oldPrefix.length, prefix.length),
              classes: padRules(wrapRules != null ? wrapRules : rules),
              parseContext: this.applyRule(config.RULES[node.type], node).indentContext
            });
            break;
        }

        return (() => {
          const result = [];
          for (child of Array.from(node.children)) {
            result.push(this.mark(child, prefix, depth + 2, false));
          }
          return result;
        })();
      } else if ((context != null) && (this.detNode(context) === 'block')) {
        if ((this.det(node) === 'socket') && (((config.SHOULD_SOCKET == null)) || config.SHOULD_SOCKET(this.opts, node))) {
          this.addSocket({
            bounds: node.bounds,
            depth,
            classes: padRules(wrapRules != null ? wrapRules : rules),
            parseContext: rules[0]}); //(if wrap? then wrap.type else rules[0])

          if ((config.empty != null) && !this.opts.preserveEmpty && (helper.clipLines(this.lines, node.bounds.start, node.bounds.end) === config.empty)) {
            return this.flagToRemove(node.bounds, depth + 1);
          }
        }
      }
    }
  }

  TreewalkParser.drop = function(block, context, pred) {
    let m;
    if (context.type === 'socket') {
      if (Array.from(block.classes).includes('__comment__')) {
        return helper.DISCOURAGE;
      }
      for (let c of Array.from(parseClasses(context))) {
        var needle;
        if ((needle = c, Array.from(parseClasses(block)).includes(needle))) {
          return helper.ENCOURAGE;
        }

        // Check to see if we could paren-wrap this
        if ((config.PAREN_RULES != null) && c in config.PAREN_RULES) {
          for (m of Array.from(parseClasses(block))) {
            if (m in config.PAREN_RULES[c]) {
              return helper.ENCOURAGE;
            }
          }
        }
      }
      return helper.DISCOURAGE;

    } else if (context.type === 'indent') {
      let needle1;
      if (Array.from(block.classes).includes('__comment__')) {
        return helper.ENCOURAGE;
      }

      if ((needle1 = context.parseContext, Array.from(parseClasses(block)).includes(needle1))) {
        return helper.ENCOURAGE;
      }

      // Check to see if we could paren-wrap this
      if ((config.PAREN_RULES != null) && context.parseContext in config.PAREN_RULES) {
        for (m of Array.from(parseClasses(block))) {
          if (m in config.PAREN_RULES[context.parseContext]) {
            return helper.ENCOURAGE;
          }
        }
      }

      return helper.DISCOURAGE;

    } else if (context.type === 'document') {
      let needle2;
      if (Array.from(block.classes).includes('__comment__')) {
        return helper.ENCOURAGE;
      }

      if ((needle2 = context.parseContext, Array.from(parseClasses(block)).includes(needle2))) {
        return helper.ENCOURAGE;
      }

      return helper.DISCOURAGE;
    }

    return helper.DISCOURAGE;
  };


  // Doesn't yet deal with parens
  TreewalkParser.parens = function(leading, trailing, node, context){
    // If we're moving to null, remove parens (where possible)
    if (context == null) {
      if (config.unParenWrap != null) {
        return config.unParenWrap(leading, trailing, node, context);
      } else {
        return;
      }
    }

    // If we already match types, we're fine
    for (var c of Array.from(parseClasses(context))) {
      var needle;
      if ((needle = c, Array.from(parseClasses(node)).includes(needle))) {
        return;
      }
    }

    // Otherwise, wrap according to the provided rule
    for (c of Array.from(parseClasses(context))) {
      if (c in config.PAREN_RULES) {
        for (let m of Array.from(parseClasses(node))) {
          if (m in config.PAREN_RULES[c]) {
            return config.PAREN_RULES[c][m](leading, trailing, node, context);
          }
        }
      }
    }
  };

  TreewalkParser.stringFixer = config.stringFixer;
  TreewalkParser.getDefaultSelectionRange = config.getDefaultSelectionRange;
  TreewalkParser.empty = config.empty;

  TreewalkParser.rootContext = root;

  return TreewalkParser;
};

const PARSE_PREFIX = "__parse__";
var padRules = rules => rules.map(x => `${PARSE_PREFIX}${x}`);
var parseClasses = node => node.classes.filter(x => x.slice(0, PARSE_PREFIX.length) === PARSE_PREFIX).map(x => x.slice(PARSE_PREFIX.length)).concat(node.parseContext);
