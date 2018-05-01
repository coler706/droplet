/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Droplet parser wrapper.
// Utility functions for defining Droplet parsers.
//
// Copyright (c) 2015 Anthony Bau (dab1998@gmail.com)
// MIT License

let Parser, ParserFactory;
const helper = require('./helper');
const model = require('./model');

const sax = require('sax');

const _extend = function(opts, defaults) {
  if (opts == null) { return defaults; }
  for (let key in defaults) {
    const val = defaults[key];
    if (!(key in opts)) {
      opts[key] = val;
    }
  }
  return opts;
};

const YES = () => true;

const isPrefix = (a, b) => a.slice(0, b.length) === b;

exports.ParserFactory = (ParserFactory = class ParserFactory {
  constructor(opts) {
    if (opts == null) { opts = {}; }
    this.opts = opts;
  }

  createParser(text) { return new Parser(text, this.opts); }
});

// ## Parser ##
// The Parser class is a simple
// wrapper on the above functions
// and a given parser function.
exports.Parser = (Parser = class Parser {
  constructor(text, opts) {
    // Text can sometimes be subject to change
    // when doing error recovery, so keep a record of
    // the original text.
    this.text = text;
    if (opts == null) { opts = {}; }
    this.opts = opts;
    this.originalText = this.text;
    this.markup = [];
  }

  // ## parse ##
  _parse(opts) {
    opts = _extend(opts, {
      wrapAtRoot: true,
      preserveEmpty: true
    });
    // Generate the list of tokens
    this.markRoot(opts.context);

    // Sort by position and depth
    (this.sortMarkup)();

    // Generate a document from the markup
    const document = this.applyMarkup(opts);

    this.detectParenWrap(document);

    // Correct parent tree
    document.correctParentTree();

    // Strip away blocks flagged to be removed
    // (for `` hack and error recovery)
    if (opts.preserveEmpty) {
      stripFlaggedBlocks(document);
    }

    return document;
  }

  markRoot() {}

  isParenWrapped(block) {
    return ((block.start.next.type === 'text') &&
      (block.start.next.value[0] === '(') &&
      (block.end.prev.type === 'text') &&
      (block.end.prev.value[block.end.prev.value.length - 1] === ')'));
  }

  detectParenWrap(document) {
    let head = document.start;
    while (head !== document.end) {
      head = head.next;
      if ((head.type === 'blockStart') &&
          this.isParenWrapped(head.container)) {
        head.container.currentlyParenWrapped = true;
      }
    }
    return document;
  }

  // ## addBlock ##
  // addBlock takes {
  //   bounds: {
  //     start: {line, column}
  //     end: {line, column}
  //   }
  //   depth: Number
  //   precedence: Number
  //   color: String
  //   classes: []
  //   socketLevel: Number
  //   parenWrapped: Boolean
  // }
  addBlock(opts) {
    const block = new model.Block(opts.precedence,
      opts.color,
      opts.socketLevel,
      opts.classes,
      opts.parseContext,
      opts.buttons);

    return this.addMarkup(block, opts.bounds, opts.depth);
  }

  // flagToRemove, used for removing the placeholders that
  // are placed when round-tripping empty sockets, so that, e.g. in CoffeeScript mode
  // a + (empty socket) -> a + `` -> a + (empty socket).
  //
  // These are done by placing blocks around that text and then removing that block from the tree.
  flagToRemove(bounds, depth) {
    const block = new model.Block();

    block.flagToRemove = true;

    return this.addMarkup(block, bounds, depth);
  }

  // ## addSocket ##
  // addSocket takes {
  //   bounds: {
  //     start: {line, column}
  //     end: {line, column}
  //   }
  //   depth: Number
  //   precedence: Number
  //   accepts: shallow_dict
  // }
  addSocket(opts) {
    const socket = new model.Socket(opts.empty != null ? opts.empty : this.empty, opts.precedence,
      false,
      opts.classes,
      opts.dropdown,
      opts.parseContext);

    return this.addMarkup(socket, opts.bounds, opts.depth);
  }

  // ## addIndent ##
  // addIndent takes {
  //   bounds: {
  //     start: {line, column}
  //     end: {line, column}
  //   }
  //   depth: Number
  //   prefix: String
  // }
  addIndent(opts) {
    const indent = new model.Indent(this.emptyIndent, opts.prefix, opts.classes, opts.parseContext);

    return this.addMarkup(indent, opts.bounds, opts.depth);
  }

  checkBounds(bounds) {
    if (!((__guard__(bounds != null ? bounds.start : undefined, x => x.line) != null) && (__guard__(bounds != null ? bounds.start : undefined, x1 => x1.column) != null) &&
            (__guard__(bounds != null ? bounds.end : undefined, x2 => x2.line) != null) && (__guard__(bounds != null ? bounds.end : undefined, x3 => x3.column) != null))) {
      throw new IllegalArgumentException('bad bounds object');
    }
  }

  // ## addMarkup ##
  // Add a container around some bounds
  addMarkup(container, bounds, depth) {
    this.checkBounds(bounds);
    this.markup.push({
      token: container.start,
      location: bounds.start,
      depth,
      start: true
    });

    this.markup.push({
      token: container.end,
      location: bounds.end,
      depth,
      start: false
    });

    return container;
  }

  // ## sortMarkup ##
  // Sort the markup by the order
  // in which it will appear in the text.
  sortMarkup() {
    return this.markup.sort(function(a, b) {
      // First by line
      if (a.location.line > b.location.line) {
        return 1;
      }

      if (b.location.line > a.location.line) {
        return -1;
      }

      // Then by column
      if (a.location.column > b.location.column) {
        return 1;
      }

      if (b.location.column > a.location.column) {
        return -1;
      }

      // If two pieces of markup are in the same position, end markup
      // comes before start markup
      let isDifferent = 1;
      if (a.token.container === b.token.container) {
        isDifferent = -1;
      }

      if (a.start && !b.start) {
        return isDifferent;
      }

      if (b.start && !a.start) {
        return -isDifferent;
      }

      // If two pieces of markup are in the same position,
      // and are both start or end,
      // the markup placed earlier gets to go on the outside
      if (a.start && b.start) {
        if (a.depth > b.depth) {
          return 1;
        } else { return -1; }
      }

      if ((!a.start) && (!b.start)) {
        if (a.depth > b.depth) {
          return -1;
        } else { return 1; }
      }
    });
  }

  // ## constructHandwrittenBlock
  // Construct a handwritten block with the given
  // text inside
  constructHandwrittenBlock(text) {
    let socket, textToken;
    const block = new model.Block(0, 'comment', helper.ANY_DROP);
    if (this.isComment(text)) {
      block.socketLevel = helper.BLOCK_ONLY;
      block.classes = ['__comment__', 'block-only'];

      let head = block.start;

      const {sockets, color} = this.parseComment(text);

      if (color != null) {
        block.color = color;
      }

      let lastPosition = 0;

      if (sockets != null) {
        for (let socketPosition of Array.from(sockets)) {
          socket = new model.Socket('', 0, true);
          socket.setParent(block);

          socket.classes = ['__comment__'];

          const padText = text.slice(lastPosition, socketPosition[0]);

          if (padText.length > 0) {
            const padTextToken = new model.TextToken(padText);
            padTextToken.setParent(block);

            helper.connect(head, padTextToken);

            head = padTextToken;
          }

          textToken = new model.TextToken(text.slice(socketPosition[0], socketPosition[1]));
          textToken.setParent(block);

          helper.connect(head, socket.start);
          helper.connect(socket.start, textToken);
          helper.connect(textToken, socket.end);

          head = socket.end;

          lastPosition = socketPosition[1];
        }
      }

      const finalPadText = text.slice(lastPosition, text.length);

      if (finalPadText.length > 0) {
        const finalPadTextToken = new model.TextToken(finalPadText);
        finalPadTextToken.setParent(block);

        helper.connect(head, finalPadTextToken);

        head = finalPadTextToken;
      }

      helper.connect(head, block.end);

    } else {
      socket = new model.Socket('', 0, true);
      textToken = new model.TextToken(text);
      textToken.setParent(socket);

      block.classes = ['__handwritten__', 'block-only'];
      helper.connect(block.start, socket.start);

      helper.connect(socket.start, textToken);
      helper.connect(textToken, socket.end);
      helper.connect(socket.end, block.end);
    }


    return block;
  }

  handleButton(text, command, oldblock) {
    return text;
  }

  // applyMarkup
  // -----------
  //
  // The parser adapter will throw out markup in arbitrary orders. `applyMarkup`'s job is to assemble
  // a parse tree from this markup. `applyMarkup` also cleans up any leftover text that lies outside blocks or
  // sockets by passing them through a comment-handling procedure.
  //
  // `applyMarkup` applies the generated markup by sorting it, then walking from the beginning to the end of the
  // document, creating `TextToken`s and inserting the markup between them. It also keeps a stack
  // of which containers it is currently in, for error detection and comment handling.
  //
  // Whenever the container is currently an `Indent` or a `Document` and we get some text, we handle it as a comment.
  // If it contains block-comment tokens, like /* or */, we immediately make comment blocks around them, amalgamating multiline comments
  // into single blocks. We do this by scanning forward and just toggling on or off a bit that says whether we're inside
  // a block comment, refusing to put any markup while we're inside one.
  //
  // When outside a block-comment, we pass free text to the mode's comment parser. This comment parser
  // will return a set of text ranges to put in sockets, usually the place where freeform text can be put in the comment.
  // For instance, `//hello` in JavaScript should return (2, 6) to put a socket around 'hello'. In C, this is used
  // to handle preprocessor directives.

  applyMarkup(opts) {
    // For convenience, will we
    // separate the markup by the line on which it is placed.
    const markupOnLines = {};

    for (var mark of Array.from(this.markup)) {
      if (markupOnLines[mark.location.line] == null) { markupOnLines[mark.location.line] = []; }
      markupOnLines[mark.location.line].push(mark);
    }

    // Now, we will interact with the text
    // by line-column coordinates. So we first want
    // to split the text into lines.
    const lines = this.text.split('\n');

    let indentDepth = 0;
    const stack = [];
    const document = new model.Document(opts.context != null ? opts.context : this.rootContext); let head = document.start;

    let currentlyCommented = false;

    for (let i = 0; i < lines.length; i++) {
      // If there is no markup on this line,
      // helper.connect simply, the text of this line to the document
      // (stripping things as needed for indent)
      var block;
      let line = lines[i];
      if (!(i in markupOnLines)) {
        // If this line is not properly indented,
        // flag it in the model.
        var needle;
        if ((indentDepth > line.length) || (line.slice(0, indentDepth).trim().length > 0)) {
          head.specialIndent = (__range__(0, line.length - line.trimLeft().length, false).map((j) => ' ')).join('');
          line = line.trimLeft();
        } else {
          line = line.slice(indentDepth);
        }

        // If we have some text here that
        // is floating (not surrounded by a block),
        // wrap it in a generic block automatically.
        //
        // We will also send it through a pass through a comment parser here,
        // for special handling of different forms of comments (or, e.g. in C mode, directives),
        // and amalgamate multiline comments.
        let placedSomething = false;
        while (line.length > 0) {
          if (currentlyCommented) {
            placedSomething = true;
            if (line.indexOf(this.endComment) > -1) {
              head = helper.connect(head,
                new model.TextToken(line.slice(0, line.indexOf(this.endComment) + this.endComment.length)));
              line = line.slice(line.indexOf(this.endComment) + this.endComment.length);

              head = helper.connect(head, stack.pop().end);
              currentlyCommented = false;
            }
          }

          if (!currentlyCommented &&
              ((opts.wrapAtRoot && (stack.length === 0)) || (__guard__(stack[stack.length - 1], x => x.type) === 'indent')) &&
              (line.length > 0)) {
            placedSomething = true;
            if (isPrefix(line.trimLeft(), this.startComment)) {
              currentlyCommented = true;
              block = new model.Block(0, 'comment', helper.ANY_DROP);
              stack.push(block);

              helper.connect(head, block.start);
              head = block.start;

            } else {
              block = this.constructHandwrittenBlock(line);

              helper.connect(head, block.start);
              head = block.end;

              line = '';
            }

          } else if (line.length > 0) {
            placedSomething = true;
            head = helper.connect(head, new model.TextToken(line));

            line = '';
          }
        }

        if ((line.length === 0) && !placedSomething && (needle = __guard__(stack[stack.length - 1], x1 => x1.type), ['indent', 'document', undefined].includes(needle)) &&
            hasSomeTextAfter(lines, i)) {
          block = new model.Block(0, this.opts.emptyLineColor, helper.BLOCK_ONLY);
          block.classes = ['__comment__', 'any-drop'];

          head = helper.connect(head, block.start);
          head = helper.connect(head, block.end);
        }

        head = helper.connect(head, new model.NewlineToken());

      // If there is markup on this line, insert it.
      } else {
        // Flag if this line is not properly indented.
        var lastIndex;
        if ((indentDepth > line.length) || (line.slice(0, indentDepth).trim().length > 0)) {
          lastIndex = line.length - line.trimLeft().length;
          head.specialIndent = line.slice(0, lastIndex);
        } else {
          lastIndex = indentDepth;
        }

        for (mark of Array.from(markupOnLines[i])) {
          // If flagToRemove is turned off, ignore markup
          // that was generated by the flagToRemove mechanism. This will simply
          // create text tokens instead of creating a block slated to be removed.
          if ((mark.token.container != null) && mark.token.container.flagToRemove && !opts.preserveEmpty) { continue; }

          // Insert a text token for all the text up until this markup
          // (unless there is no such text
          if (!(lastIndex >= mark.location.column) && !(lastIndex >= line.length)) {
            if (((!currentlyCommented) &&
                (opts.wrapAtRoot && (stack.length === 0))) || (__guard__(stack[stack.length - 1], x2 => x2.type) === 'indent')) {
              block = this.constructHandwrittenBlock(line.slice(lastIndex, mark.location.column));

              helper.connect(head, block.start);
              head = block.end;
            } else {
              head = helper.connect(head, new model.TextToken(line.slice(lastIndex, mark.location.column)));
            }

            if (currentlyCommented) {
              head = helper.connect(head, stack.pop().end);
              currentlyCommented = false;
            }
          }

          // Note, if we have inserted something,
          // the new indent depth and the new stack.
          switch (mark.token.type) {
            case 'indentStart':
              // An Indent is only allowed to be
              // directly inside a block; if not, then throw.
              if (__guard__(stack != null ? stack[stack.length - 1] : undefined, x3 => x3.type) !== 'block') {
                throw new Error(`Improper parser: indent must be inside block, but is inside ${__guard__(stack != null ? stack[stack.length - 1] : undefined, x4 => x4.type)}`);
              }
              indentDepth += mark.token.container.prefix.length;
              break;

            case 'blockStart':
              // If the a block is embedded
              // directly in another block, throw.
              if (__guard__(stack[stack.length - 1], x5 => x5.type) === 'block') {
                throw new Error('Improper parser: block cannot nest immediately inside another block.');
              }
              break;

            case 'socketStart':
              // A socket is only allowed to be directly inside a block.
              if (__guard__(stack[stack.length - 1], x6 => x6.type) !== 'block') {
                throw new Error('Improper parser: socket must be immediately inside a block.');
              }
              break;

            case 'indentEnd':
              indentDepth -= mark.token.container.prefix.length;
              break;
          }

          // Update the stack
          if (mark.token instanceof model.StartToken) {
            stack.push(mark.token.container);
          } else if (mark.token instanceof model.EndToken) {
            if (mark.token.container !== stack[stack.length - 1]) {
              throw new Error(`Improper parser: ${head.container.type} ended too early.`);
            }
            stack.pop();
          }

          // Append the token
          head = helper.connect(head, mark.token);

          lastIndex = mark.location.column;
        }

        // Append the rest of the string
        // (after the last piece of markup)
        while (!(lastIndex >= line.length)) {
          if (currentlyCommented) {
            if (line.slice(lastIndex).indexOf(this.endComment) > -1) {
              head = helper.connect(head,
                new model.TextToken(line.slice(lastIndex, lastIndex + line.slice(lastIndex).indexOf(this.endComment) + this.endComment.length)));

              lastIndex += line.slice(lastIndex).indexOf(this.endComment) + this.endComment.length;

              head = helper.connect(head, stack.pop().end);
              currentlyCommented = false;
            }
          }

          if (!currentlyCommented &&
              ((opts.wrapAtRoot && (stack.length === 0)) || (__guard__(stack[stack.length - 1], x7 => x7.type) === 'indent')) &&
              (line.length > 0)) {
            if (isPrefix(line.slice(lastIndex).trimLeft(), this.startComment)) {
              currentlyCommented = true;
              block = new model.Block(0, 'comment', helper.ANY_DROP);
              stack.push(block);

              helper.connect(head, block.start);
              head = block.start;

            } else {
              block = this.constructHandwrittenBlock(line.slice(lastIndex));

              helper.connect(head, block.start);
              head = block.end;

              lastIndex = line.length;
            }

          } else if (lastIndex < line.length) {
            head = helper.connect(head, new model.TextToken(line.slice(lastIndex)));

            lastIndex = line.length;
          }
        }

        head = helper.connect(head, new model.NewlineToken());
      }
    }

    // Pop off the last newline token, which is not necessary
    head = head.prev;
    head.next.remove();

    // Reinsert the end token of the document,
    // which we previously threw away by using "connect"
    head = helper.connect(head, document.end);

    // Return the document
    return document;
  }
});

exports.parseXML = function(xml) {
  const root = new model.Document(); let head = root.start;
  const stack = [];
  const parser = sax.parser(true);

  parser.ontext = function(text) {
    const tokens = text.split('\n');
    return (() => {
      const result = [];
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.length !== 0) {
          head = helper.connect(head, new model.TextToken(token));
        }
        if (i !== (tokens.length - 1)) {
          result.push(head = helper.connect(head, new model.NewlineToken()));
        } else {
          result.push(undefined);
        }
      }
      return result;
    })();
  };

  // TODO Improve serialization format
  // for test updates. Currently no longer unity
  // because @empty is not preserved.
  parser.onopentag = function(node) {
    let container;
    const { attributes } = node;
    switch (node.name) {
      case 'block':
        container = new model.Block(attributes.precedence, attributes.color,
          attributes.socketLevel, __guardMethod__(attributes.classes, 'split', o => o.split(' ')));
        break;
      case 'socket':
        container = new model.Socket('', attributes.precedence, attributes.handritten,
          __guardMethod__(attributes.classes, 'split', o1 => o1.split(' ')));
        break;
      case 'indent':
        container = new model.Indent('', attributes.prefix, __guardMethod__(attributes.classes, 'split', o2 => o2.split(' ')));
        break;
      case 'document':
        // Root is optional
        if (stack.length !== 0) {
          container = new model.Document();
        }
        break;
      case 'br':
        head = helper.connect(head, new model.NewlineToken());
        return null;
        break;
    }

    if (container != null) {
      stack.push({
        node,
        container
      });

      return head = helper.connect(head, container.start);
    }
  };

  parser.onclosetag = function(nodeName) {
    if ((stack.length > 0) && (nodeName === stack[stack.length - 1].node.name)) {
      head = helper.connect(head, stack[stack.length - 1].container.end);
      return stack.pop();
    }
  };

  parser.onerror = function(e) {
    throw e;
  };

  parser.write(xml).close();

  head = helper.connect(head, root.end);
  root.correctParentTree();

  return root;
};

var hasSomeTextAfter = function(lines, i) {
  while (i !== lines.length) {
    if (lines[i].length > 0) { return true; }
    i += 1;
  }
  return false;
};

// ## applyMarkup ##
// Given some text and (sorted) markup,
// produce an ICE editor document
// with the markup inserted into the text.
//
// Automatically insert sockets around blocks along the way.
var stripFlaggedBlocks = function(document) {
  let head = document.start;
  return (() => {
    const result = [];
    while (head !== document.end) {
      var container;
      if (head instanceof model.StartToken &&
          head.container.flagToRemove) {

        ({ container } = head);
        head = container.end.next;

        result.push(document.remove(container));
      } else if (head instanceof model.StartToken &&
          head.container.flagToStrip) {
        if (head.container.parent != null) {
          head.container.parent.color = 'error';
        }
        const text = head.next;
        text.value =
          text.value.substring(
            head.container.flagToStrip.left,
            text.value.length - head.container.flagToStrip.right);
        result.push(head = text.next);
      } else {
        result.push(head = head.next);
      }
    }
    return result;
  })();
};

Parser.parens = function(leading, trailing, node, context) {
  if ((context === null) || (context.type !== 'socket') ||
      ((context != null ? context.precedence : undefined) < node.precedence)) {
    return (() => {
      const result = [];
      while (true) {
        if ((leading().match(/^\s*\(/) != null) && (trailing().match(/\)\s*/) != null)) {
          leading(leading().replace(/^\s*\(\s*/, ''));
          result.push(trailing(trailing().replace(/^\s*\)\s*/, '')));
        } else {
          break;
        }
      }
      return result;
    })();
  } else {
    leading(`(${leading()}`);
    return trailing(trailing() + ')');
  }
};

Parser.drop = function(block, context, pred, next) {
  if ((block.type === 'document') && (context.type === 'socket')) {
    return helper.FORBID;
  } else {
    return helper.ENCOURAGE;
  }
};

Parser.empty = '';
Parser.emptyIndent = '';

const getDefaultSelectionRange = string => ({start: 0, end: string.length});

exports.wrapParser = function(CustomParser) {
  let CustomParserFactory;
  return (CustomParserFactory = class CustomParserFactory extends ParserFactory {
    constructor(opts) {
      {
        // Hack: trick Babel/TypeScript into allowing this before super.
        if (false) { super(); }
        let thisFn = (() => { return this; }).toString();
        let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
        eval(`${thisName} = this;`);
      }
      if (opts == null) { opts = {}; }
      this.opts = opts;
      this.empty = CustomParser.empty;
      this.emptyIndent = CustomParser.emptyIndent;
      this.startComment = CustomParser.startComment != null ? CustomParser.startComment : '/*';
      this.endComment = CustomParser.endComment != null ? CustomParser.endComment : '*/';
      this.startSingleLineComment = CustomParser.startSingleLineComment;
      this.getDefaultSelectionRange = CustomParser.getDefaultSelectionRange != null ? CustomParser.getDefaultSelectionRange : getDefaultSelectionRange;
      this.rootContext = CustomParser.rootContext;
    }

    // TODO kind of hacky assignation of @empty,
    // maybe change the api?
    createParser(text) {
      const parser = new CustomParser(text, this.opts);
      parser.startComment = this.startComment;
      parser.endComment = this.endComment;
      parser.empty = this.empty;
      parser.emptyIndent = this.emptyIndent;
      return parser;
    }

    stringFixer(string) {
      if (CustomParser.stringFixer != null) {
        return CustomParser.stringFixer.apply(this, arguments);
      } else {
        return string;
      }
    }

    parse(text, opts) {
      this.opts.parseOptions = opts;
      if (opts == null) { opts = {wrapAtRoot: true}; }
      return this.createParser(text)._parse(opts);
    }

    parens(leading, trailing, node, context) {
      // leadingFn is always a getter/setter for leading
      let trailingFn;
      const leadingFn = function(value) {
        if (value != null) {
          leading = value;
        }
        return leading;
      };

      // trailingFn may either get/set leading or trailing;
      // will point to leading if leading is the only token,
      // but will point to trailing otherwise.
      if (trailing != null) {
        trailingFn = function(value) {
          if (value != null) {
            trailing = value;
          }
          return trailing;
        };
      } else {
        trailingFn = leadingFn;
      }

      CustomParser.parens(leadingFn, trailingFn, node, context);

      return [leading, trailing];
    }

    drop(block, context, pred, next) { return CustomParser.drop(block, context, pred, next); }

    handleButton(text, command, oldblock) {
      const parser = this.createParser(text);
      return parser.handleButton(text, command, oldblock);
    }
  });
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}
function __guardMethod__(obj, methodName, transform) {
  if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
    return transform(obj, methodName);
  } else {
    return undefined;
  }
}