/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Droplet model.
//
// Copyright (c) 2014 Anthony Bau (dab1998@gmail.com)
// MIT License
let Block, BlockEndToken, BlockStartToken, Container, Document, DocumentEndToken, DocumentStartToken, EndToken, Indent, IndentEndToken, IndentStartToken, isTreeValid, List, Location, NewlineToken, Socket, SocketEndToken, SocketStartToken, StartToken, TextLocation, TextToken, Token;
const helper = require('./helper');

const YES = () => true;
const NO = () => false;

const NORMAL = {default: helper.NORMAL};
const FORBID = {default: helper.FORBID};

const DEFAULT_STRINGIFY_OPTS = {preserveEmpty: true};

let _id = 0;

// Getter/setter utility function
Function.prototype.trigger = function(prop, get, set) {
  return Object.defineProperty(this.prototype, prop, {
    get,
    set
  }
  );
};

// TODO add parenting checks
exports.isTreeValid = (isTreeValid = function(tree) {
  let hare;
  let k;
  let tortise = (hare = tree.start.next);

  const stack =  [];

  while (true) {
    tortise = tortise.next;

    let lastHare = hare;
    hare = hare.next;
    if (hare == null) {
      window._droplet_debug_lastHare = lastHare;
      throw new Error('Ran off the end of the document before EOF');
    }
    if (lastHare !== hare.prev) {
      throw new Error('Linked list is not properly bidirectional');
    }
    if (hare === tree.end) {
      if (stack.length > 0) {
        throw new Error('Document ended before: ' + ((() => {
          const result = [];
          for (k of Array.from(stack)) {             result.push(k.type);
          }
          return result;
        })()).join(','));
      }
      break;
    }
    if (hare instanceof StartToken) {
      stack.push(hare.container);
    } else if (hare instanceof EndToken) {
      if (stack[stack.length - 1] !== hare.container) {
        throw new Error(`Stack does not align ${__guard__(stack[stack.length - 1], x => x.type)} != ${(hare.container != null ? hare.container.type : undefined)}`);
      } else {
        stack.pop();
      }
    }


    lastHare = hare;
    hare = hare.next;
    if (hare == null) {
      window._droplet_debug_lastHare = lastHare;
      throw new Error('Ran off the end of the document before EOF');
    }
    if (lastHare !== hare.prev) {
      throw new Error('Linked list is not properly bidirectional');
    }
    if (hare === tree.end) {
      if (stack.length > 0) {
        throw new Error('Document ended before: ' + ((() => {
          const result1 = [];
          for (k of Array.from(stack)) {             result1.push(k.type);
          }
          return result1;
        })()).join(','));
      }
      break;
    }
    if (hare instanceof StartToken) {
      stack.push(hare.container);
    } else if (hare instanceof EndToken) {
      if (stack[stack.length - 1] !== hare.container) {
        throw new Error(`Stack does not align ${__guard__(stack[stack.length - 1], x1 => x1.type)} != ${(hare.container != null ? hare.container.type : undefined)}`);
      } else {
        stack.pop();
      }
    }

    if (tortise === hare) {
      throw new Error('Linked list loops');
    }
  }

  return true;
});

class Operation {
  constructor(type, list) {
    this.type = type;
    this.location = null; // Needs to be set by someone else

    this.list = list.clone();

    this.start = list.start.getLocation();
    this.end = list.end.getLocation();
  }

  toString() { return JSON.stringify({
    location: this.location.toString(),
    list: this.list.stringify(),
    start: this.start.toString(),
    end: this.end.toString(),
    type: this.type
  }); }
}

class ReplaceOperation {
  constructor(
        beforeStart, before, beforeEnd,
        afterStart, after, afterEnd
      ) {
    this.beforeStart = beforeStart;
    this.before = before;
    this.beforeEnd = beforeEnd;
    this.afterStart = afterStart;
    this.after = after;
    this.afterEnd = afterEnd;
    this.type = 'replace';
  }

  toString() { return JSON.stringify({
    beforeStart: this.beforeStart.toString(),
    before: this.before.stringify(),
    beforeEnd: this.beforeEnd.toString(),
    afterStart: this.afterStart.toString(),
    after: this.after.stringify(),
    afterEnd: this.afterEnd.toString(),
    type: this.type
  }); }
}

exports.List = (List = class List {
  constructor(start, end) {
    this.start = start;
    this.end = end;
    this.id = ++_id;
    this.type = 'list';
  }

  hasParent(x) { return false; }

  contains(token) {
    if (token instanceof Container) {
      token = token.start;
    }

    let head = this.start;
    while (head !== this.end) {
      if (head === token) {
        return true;
      }
      head = head.next;
    }

    if (token === this.end) {
      return true;
    } else {
      return false;
    }
  }

  getDocument() { return this.start.getDocument(); }

  // ## insert ##
  // Insert another list into us
  // and return an (undoable) record
  // of this operation
  insert(token, list, updates) {
    let operation;
    if (updates == null) { updates = []; }
    let [first, last] = Array.from([list.start, list.end]);

    const updateTokens = updates.map(x => this.getFromLocation(x));

    // Append newlines, etc. to the parent
    // if necessary.
    switch (token.type) {
      case 'indentStart':
        var head = token.container.end.prev;

        if (head.type === 'newline') {
          token = token.next;
        } else {
          first = new NewlineToken();
          helper.connect(first, list.start);
        }
        break;

      case 'blockEnd':
        first = new NewlineToken();
        helper.connect(first, list.start);
        break;

      case 'documentStart':
        if (token.next !== token.container.end) {
          last = new NewlineToken();
          helper.connect(list.end, last);
        }
        break;
    }

    // Get the location
    const location = token.getLocation();

    // New list with added newlines
    list = new List(first, last);

    // Literally splice in
    const after = token.next;
    helper.connect(token, list.start);

    if (token instanceof StartToken) {
      list.setParent(token.container);
    } else {
      list.setParent(token.parent);
    }

    helper.connect(list.end, after);
    list.notifyChange();

    if (location != null) {
      // Make and return an undo operation
      operation = new Operation('insert', list);
      operation.location = location;

      // Preserve updates
      updates.forEach((x, i) => x.set(updateTokens[i].getLocation()));
    } else {
      operation = null;
    }

    return operation;
  }

  // ## remove ##
  // Remove ourselves from the linked
  // list that we are in.
  remove(list, updates) {
    // Do not leave empty lines behind.

    // First,
    // let's determine what the previous and next
    // visible tokens are, to see if they are
    // two consecutive newlines, or similar.
    if (updates == null) { updates = []; }
    let first = list.start.prev; let last = list.end.next;

    // If the previous visible token is a newline,
    // and the next visible token is a newline, indentEnd,
    // or end of document, remove the first one, as it will
    // cause an empty line.
    //
    // Exception: do not do this if it would collapse
    // and indent to 0 length.
    while (((first != null ? first.type : undefined) === 'newline') &&
       [undefined, 'newline', 'indentEnd', 'documentEnd'].includes(last != null ? last.type : undefined) &&
       !(((first.prev != null ? first.prev.type : undefined) === 'indentStart') &&
       (first.prev.container.end === last))) {
      first = first.prev;
    }

    // If the next visible token is a newline,
    // and the previous visible token is the beginning
    // of the document, remove it.
    while (((last != null ? last.type : undefined) === 'newline') &&
        ((__guard__(last != null ? last.next : undefined, x => x.type) === 'newline') ||
        [undefined, 'documentStart'].includes(first != null ? first.type : undefined))) {
      last = last.next;
    }

    first = first.next;
    last = last.prev;

    // Expand the list based on this analysis
    list = new List(first, last);

    list.notifyChange();

    const updateTokens = updates.map(x => this.getFromLocation(x)).map(x => {
      if (list.contains(x)) {
        return list.start.prev;
      } else {
        return x;
      }
    });

    // Make an undo operation
    const record = new Operation('remove', list);
    const location = list.start.prev;

    helper.connect(list.start.prev, list.end.next);
    list.start.prev = (list.end.next = null);
    list.setParent(null);

    // Correct the location in case
    // lengths or coordinates changed
    record.location = location.getLocation();

    updates.forEach((x, i) => {
      return x.set(updateTokens[i].getLocation());
    });

    // Return the undo operation
    return record;
  }

  replace(before, after, updates) {
    if (updates == null) { updates = []; }
    const updateTextLocations = updates.map(x => this.getFromLocation(x).getTextLocation());

    const beforeStart = before.start.getLocation();
    const beforeEnd = before.end.getLocation();

    const beforeLength = before.stringify().length;

    const { parent } = before.start;

    helper.connect(before.start.prev, after.start);
    helper.connect(after.end, before.end.next);

    before.setParent(null);
    after.setParent(parent);
    after.notifyChange();

    const afterStart = after.start.getLocation();
    const afterEnd = after.end.getLocation();

    updates.forEach((x, i) => {
      return x.set(this.getFromTextLocation(updateTextLocations[i]).getLocation());
    });

    return new ReplaceOperation(
      beforeStart, before.clone(), beforeEnd,
      afterStart, after.clone(), afterEnd
    );
  }

  perform(operation, direction, updates) {
    let after, before;
    if (updates == null) { updates = []; }
    if (operation instanceof Operation) {
      let list, updateTokens;
      if ((operation.type === 'insert') !== (direction === 'forward')) {
        list = new List(this.getFromLocation(operation.start), this.getFromLocation(operation.end));
        list.notifyChange();

        // Preserve update tokens
        updateTokens = updates.map(x => this.getFromLocation(x)).map(x => {
          if (list.contains(x)) {
            return list.start.prev;
          } else {
            return x;
          }
        });

        helper.connect(list.start.prev, list.end.next);

        updates.forEach((x, i) => x.set(updateTokens[i].getLocation()));

        return operation;

      } else if ((operation.type === 'remove') !== (direction === 'forward')) {
        // Preserve update tokens
        updateTokens = updates.map(x => this.getFromLocation(x));

        list = operation.list.clone();

        before = this.getFromLocation(operation.location);
        after = before.next;

        helper.connect(before, list.start);
        helper.connect(list.end, after);

        if (before instanceof StartToken) {
          list.setParent(before.container);
        } else {
          list.setParent(before.parent);
        }

        list.notifyChange();

        updates.forEach((x, i) => x.set(updateTokens[i].getLocation()));

        return operation;
      }

    } else if (operation.type === 'replace') {
      const updateTextLocations = updates.map(x => this.getFromLocation(x).getTextLocation());

      if (direction === 'forward') {
        before = new List(this.getFromLocation(operation.beforeStart), this.getFromLocation(operation.beforeEnd));
        after = operation.after.clone();
      } else {
        before = new List(this.getFromLocation(operation.afterStart), this.getFromLocation(operation.afterEnd));
        after = operation.before.clone();
      }

      const { parent } = before.start;

      helper.connect(before.start.prev, after.start);
      helper.connect(after.end, before.end.next);

      after.setParent(parent);
      before.setParent(null);
      after.notifyChange();

      updates.forEach((x, i) => {
        return x.set(this.getFromTextLocation(updateTextLocations[i]).getLocation());
      });

      return null; // TODO new ReplaceOperation here
    }
  }

  notifyChange() {
    return this.traverseOneLevel(head => head.notifyChange());
  }

  traverseOneLevel(fn) {
    return traverseOneLevel(this.start, fn, this.end);
  }

  isFirstOnLine() {
    return [(this.parent != null ? this.parent.start : undefined), __guard__(this.parent != null ? this.parent.parent : undefined, x => x.start), null].includes(this.start.prev) ||
      ((this.start.prev != null ? this.start.prev.type : undefined) === 'newline');
  }

  isLastOnLine() {
    return [(this.parent != null ? this.parent.end : undefined), __guard__(this.parent != null ? this.parent.parent : undefined, x => x.end), null].includes(this.end.next) ||
      ['newline', 'indentStart', 'indentEnd'].includes(this.end.next != null ? this.end.next.type : undefined);
  }

  getReader() { return {type: 'document', classes: []}; }

  setParent(parent) {
    return traverseOneLevel(this.start, (head=> head.setParent(parent)), this.end);
  }

  // ## clone ##
  // Clone this container, with all the token inside,
  // but with no linked-list pointers in common.
  clone() {
    let head;
    let assembler = (head = {});

    this.traverseOneLevel(head => {
      // If we have hit a container,
      // ask it to clone, so that
      // we copy over appropriate metadata.
      let clone;
      if (head instanceof Container) {
        clone = head.clone();
        helper.connect(assembler, clone.start);
        return assembler = clone.end;

      // Otherwise, helper.connect just, a cloned
      // version of this token.
      } else {
        return assembler = helper.connect(assembler, head.clone());
      }
    });

    head = head.next; head.prev = null;

    const clone = new List(head, assembler);
    clone.correctParentTree();

    return clone;
  }

  // ## correctParentTree ##
  // Generally called immediately after assembling
  // a token stream by hand; corrects the entire
  // parent tree for the linked list.
  correctParentTree() {
    return this.traverseOneLevel(head => {
      head.parent = this;
      if (head instanceof Container) {
        head.start.parent = (head.end.parent = this);
        return head.correctParentTree();
      }
    });
  }

  // ## stringify ##
  // Get a string representation of us,
  // using the `stringify()` method on all of
  // the tokens that we contain.
  stringify(opts) {
    if (opts == null) { opts = DEFAULT_STRINGIFY_OPTS; }
    let head = this.start;
    let str = head.stringify(opts);

    while (head !== this.end) {
      head = head.next;
      str += head.stringify(opts);
    }

    return str;
  }

  stringifyInPlace() {
    let str = '';

    const indent = [];

    let head = this.start;
    while (true) {
      if (head instanceof IndentStartToken) {
        indent.push(head.container.prefix);
      } else if (head instanceof IndentEndToken) {
        indent.pop();
      }
      if (head instanceof NewlineToken) {
        str += `\n${head.specialIndent != null ? head.specialIndent : indent.join('')}`;
      } else {
        str += head.stringify();
      }

      if (head === this.end) {
        break;
      }
      head = head.next;
    }

    return str;
  }
});

// Container
// ==================
// A generic XML-style container from which
// all other containers (Block, Indent, Socket) will extend.
exports.Container = (Container = (function() {
  Container = class Container extends List {
    static initClass() {
  
      this.prototype._serialize_header = "<container>";
      this.prototype._serialize_header = "</container>";
    }
    constructor() {
      {
        // Hack: trick Babel/TypeScript into allowing this before super.
        if (false) { super(); }
        let thisFn = (() => { return this; }).toString();
        let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
        eval(`${thisName} = this;`);
      }
      if ((this.start == null) && (this.end == null)) {
        this.start = new StartToken(this);
        this.end = new EndToken(this);

        this.type = 'container';
      }

      this.id = ++_id;
      this.parent = null;
      this.version = 0;
      helper.connect(this.start, this.end);

      this.ephemeral = false;

      // Line mark colours
      this.lineMarkStyles = [];
    }

    // A `Container`'s location is its start's location
    // with the container's type
    getLocation() {
      const location = this.start.getLocation();
      location.type = this.type;
      return location;
    }
    getTextLocation() {
      const location = this.start.getTextLocation();
      location.type = this.type;
      return location;
    }

    // _cloneEmpty should simply instantiate
    // a new instance of this Container
    // with the same metadata.
    _cloneEmpty() { return new Container(); }

    // Utility function to first block
    // child if an indent/segment
    _firstChild() {
      let head = this.start.next;
      while (head !== this.end) {
        if (head instanceof StartToken) {
          return head.container;
        }
        head = head.next;
      }
      return null;
    }

    getReader() {
      return {
        id: this.id,
        type: this.type,
        precedence: this.precedence,
        classes: this.classes,
        parseContext: this.parseContext
      };
    }

    setParent(parent) {
      return this.parent = (this.start.parent = (this.end.parent = parent));
    }

    hasParent(parent) {
      let head = this;
      while ([parent, null].includes(head)) {
        head = head.parent;
      }

      return head === parent;
    }

    getLinesToParent() {
      let head = this.start; let lines = 0;
      while (head !== this.parent.start) {
        if (head.type === 'newline') { lines++; }
        head = head.prev;
      }
      return lines;
    }

    clone() {
      const selfClone = this._cloneEmpty();
      let assembler = selfClone.start;

      this.traverseOneLevel(head => {
        // If we have hit a container,
        // ask it to clone, so that
        // we copy over appropriate metadata.
        let clone;
        if (head instanceof Container) {
          clone = head.clone();
          helper.connect(assembler, clone.start);
          return assembler = clone.end;

        // Otherwise, helper.connect just, a cloned
        // version of this token.
        } else {
          return assembler = helper.connect(assembler, head.clone());
        }
      });

      helper.connect(assembler, selfClone.end);
      selfClone.correctParentTree();

      return selfClone;
    }

    rawReplace(other) {
      if (other.start.prev != null) {
        helper.connect(other.start.prev, this.start);
      }

      if (other.end.next != null) {
        helper.connect(this.end, other.end.next);
      }

      this.start.parent = (this.end.parent = (this.parent = other.parent));

      other.parent = (other.start.parent = (other.end.parent = null));
      other.start.prev = (other.end.next = null);

      return this.notifyChange();
    }

    // Get the newline preceding the nth line
    // in this container (or the start or end of the container) by scanning
    // forward through the whole document. Start of document is 0.
    getNewlineBefore(n) {
      let head = this.start; let lines = 0;
      while ((lines !== n) && (head !== this.end)) {
        head = head.next;
        if (head.type === 'newline') { lines++; }
      }
      return head;
    }

    // Get the true nth newline token
    getNewlineAfter(n) {
      let head = this.getNewlineBefore(n).next;
      while ((start.type !== 'newline') && (head !== this.end)) { head = head.next; }
      return head;
    }

    // Getters and setters for
    // leading and trailing text, for use
    // by modes to do paren-wrapping and
    // semicolon insertion
    getLeadingText() {
      if (this.start.next.type === 'text') {
        return this.start.next.value;
      } else {
        return '';
      }
    }

    getTrailingText() {
      if (this.end.prev.type === 'text') {
        return this.end.prev.value;
      } else {
        return '';
      }
    }

    setLeadingText(value) {
      if (value != null) {
        if (this.start.next.type === 'text') {
          if (value.length === 0) {
            return this.start.next.remove();
          } else {
            return this.start.next.value = value;
          }
        } else if (value.length !== 0) {
          return this.start.insert(new TextToken(value));
        }
      }
    }

    setTrailingText(value) {
      if (value != null) {
        if (this.end.prev.type === 'text') {
          if (value.length === 0) {
            return this.end.prev.remove();
          } else {
            return this.end.prev.value = value;
          }
        } else if (value.length !== 0) {
          return this.end.prev.insert(new TextToken(value));
        }
      }
    }

    // ## serialize ##
    // Simple debugging output representation
    // of the tokens in this Container. Like XML.
    serialize() {
      let str = this._serialize_header();
      this.traverseOneLevel(child => str += child.serialize());
      return str += this._serialize_footer();
    }

    // ## contents ##
    // Get a cloned version of a
    // linked list with our contents.
    contents() {
      const clone = this.clone();

      if (clone.start.next === clone.end) {
        return null;

      } else {
        clone.start.next.prev = null;
        clone.end.prev.next = null;

        return clone.start.next;
      }
    }

    // ## notifyChange ##
    // Increase version number (for caching purposes)
    notifyChange() {
      let head = this;
      return (() => {
        const result = [];
        while (head != null) {
          head.version++;
          result.push(head = head.parent);
        }
        return result;
      })();
    }

    // ## getBlockOnLine ##
    // Get the innermost block that contains
    // the given line.
    getBlockOnLine(line) {
      let head = this.start; let lineCount = 0;
      const stack = [];

      while ((lineCount !== line) && !(head == null)) {
        switch (head.type) {
          case 'newline': lineCount++; break;
          case 'blockStart': stack.push(head.container); break;
          case 'blockEnd': stack.pop(); break;
        }
        head = head.next;
      }

      while (((head != null ? head.type : undefined) === 'newline') || (head instanceof StartToken && (head.type !== 'blockStart'))) {
        head = head.next;
      }
      if ((head != null ? head.type : undefined) === 'blockStart') { stack.push(head.container); }

      return stack[stack.length - 1];
    }

    // ## traverseOneLevel ##
    // Identical to the utility function below;
    // traverse one tree level between our
    // start and end tokens.
    traverseOneLevel(fn) {
      if (this.start.next !== this.end) {
        return traverseOneLevel(this.start.next, fn, this.end.prev);
      }
    }

    // Line mark mutators
    addLineMark(mark) {
      return this.lineMarkStyles.push(mark);
    }

    removeLineMark(tag) {
      return this.lineMarkStyles = (Array.from(this.lineMarkStyles).filter((mark) => mark.tag !== tag));
    }

    clearLineMarks() {
      return this.lineMarkStyles = [];
    }

    getFromLocation(location) {
      let head = this.start;
      for (let i = 0, end = location.count, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
        head = head.next;
      }

      if (location.type === head.type) {
        return head;
      } else if (location.type === head.container.type) {
        return head.container;
      } else {
        throw new Error(`Could not retrieve location ${location}`);
      }
    }

    // ## getFromTextLocation ##
    // Given a TextLocation, find the token at that row, column, and length.
    getFromTextLocation(location) {
      let col;
      let head = this.start.next; // Move past the DocumentStartToken
      let best = head;

      let row = 0;

      while (!(head == null) && (row !== location.row)) {
        head = head.next;
        if (head instanceof NewlineToken) {
          row += 1;
        }
      }

      // If the coordinate is invalid,
      // just return as close as we can get
      // (our last token)
      if ((head == null)) {
        return this.end;
      } else {
        best = head;
      }

      if (head instanceof NewlineToken) {
        col = head.stringify().length - 1;
        head = head.next;
      } else {
        col = head.stringify().length;
      }

      while ((!(head == null) && !(head instanceof NewlineToken)) && !(col >= location.col)) {
        col += head.stringify().length;
        head = head.next;
      }

      // Again, if the coordinate was invalid,
      // return as close as we can get
      if (col < location.col) {
        return head != null ? head : this.end;
      } else {
        best = head;
      }

      // Go forward until we are the proper length
      // or the column changed
      if (location.length != null) {
        while ((!(head == null) && !(head.stringify().length > 0)) &&
              ((head.container != null ? head.container : head).stringify().length !== location.length)) {
          head = head.next;
        }

        if ((head != null) &&
            ((head.container != null ? head.container : head).stringify().length === location.length)) {
          best = head;
        } else {
          head = best;
        }
      }

      // Go forward until we are the proper token type
      // or the column changed
      if (location.type != null) {
        while ((!(head == null) && !(head.stringify().length > 0)) &&
            (head.type !== location.type) &&
            (head.container.type !== location.type)) {
          head = head.next;
        }

        if (__guard__(head != null ? head.container : undefined, x => x.type) === location.type) {
          head = head.container;
        }

        if ((head != null ? head.type : undefined) === location.type) {
          best = head;
        }
      }

      return best;
    }
  };
  Container.initClass();
  return Container;
})());

// Token
// ==================
// Base class from which all other
// tokens extend; knows some basic
// linked list operations.
exports.Token = (Token = class Token {
  constructor() {
    this.id = ++_id;

    this.prev = (this.next = (this.parent = null));

    this.version = 0;
  }

  getLinesToParent() {
    let head = this; let lines = 0;
    while (head !== this.parent.start) {
      if (head.type === 'newline') { lines++; }
      head = head.prev;
    }
    return lines;
  }

  setParent(parent) {
    this.parent = parent;
  }

  hasParent(parent) {
    let head = this;
    while ([parent, null].includes(head)) {
      head = head.parent;
    }

    return head === parent;
  }

  insert(token) {
    token.next = this.next; token.prev = this;
    this.next.prev = token; this.next = token;

    if (this instanceof StartToken) {
      token.parent = this.container;
    } else {
      token.parent = parent;
    }

    return token;
  }

  remove() {
    if (this.prev != null) { helper.connect(this.prev, this.next);
    } else if (this.next != null) { this.next.prev = null; }

    return this.prev = (this.next = (this.parent = null));
  }

  notifyChange() {
    let head = this;
    while (head != null) {
      head.version++;
      head = head.parent;
    }

    return null;
  }

  isFirstOnLine() {
    return (this.prev === (this.parent != null ? this.parent.start : undefined)) ||
      ((this.prev != null ? this.prev.type : undefined) === 'newline');
  }

  isLastOnLine() {
    return (this.next === (this.parent != null ? this.parent.end : undefined)) ||
      ['newline', 'indentEnd'].includes(this.next != null ? this.next.type : undefined);
  }

  clone() { return new Token(); }

  getSerializedLocation() {
    let head = this; let count = 0;
    while (head !== null) {
      count++;
      head = head.prev;
    }
    return count;
  }

  // Get the indent level here
  getIndent() {
    let head = this;
    let prefix = '';
    while (head != null) {
      if (head.type === 'indent') {
        prefix = head.prefix + prefix;
      }
      head = head.parent;
    }
    return prefix;
  }

  getTextLocation() {
    const location = new TextLocation(); let head = this.prev;

    location.type = this.type;
    if (this instanceof StartToken || this instanceof EndToken) {
      location.length = this.container.stringify().length;
    } else {
      location.length = this.stringify().length;
    }

    while ((!(head == null)) && !(head instanceof NewlineToken)) {
      location.col += head.stringify().length;
      head = head.prev;
    }
    if (head != null) {
      location.col += head.stringify().length - 1;
    }

    while (head != null) {
      if (head instanceof NewlineToken) {
        location.row += 1;
      }
      head = head.prev;
    }

    return location;
  }

  getDocument() {
    let head = this.container != null ? this.container : this;
    while (!(head == null) && !(head instanceof Document)) {
      head = head.parent;
    }
    return head;
  }

  getLocation() {
    let count = 0;
    let head = this;
    const dropletDocument = this.getDocument();

    if ((dropletDocument == null)) {
      return null;
    }

    while (head !== dropletDocument.start) {
      head = head.prev;
      count += 1;
    }

    return new Location(count, this.type);
  }

  stringify() { return ''; }
  serialize() { return ''; }
});

exports.Location = (Location = class Location {
  constructor(count, type) {
    this.count = count;
    this.type = type;
  }

  toString() { return `${this.count}, ${this.type}`; }

  set(other) { this.count = other.count; return this.type = other.type; }

  is(other) {
    if (!(other instanceof Location)) {
      other = other.getLocation();
    }
    return (other.count === this.count) && (other.type === this.type);
  }

  clone() { return new Location(this.count, this.type); }
});

exports.TextLocation = (TextLocation = class TextLocation {
  constructor(
    row,
    col,
    type = null,
    length = null
  ) {
    if (row == null) { row = 0; }
    this.row = row;
    if (col == null) { col = 0; }
    this.col = col;
    this.type = type;
    this.length = length;
  }

  toString() { return `(${this.row}, ${this.col}, ${this.type}, ${this.length})`; }

  set(other) {
    this.row = other.row;
    this.col = other.col;
    this.type = other.type;
    return this.length = other.length;
  }

  is(other) {
    if (!(other instanceof TextLocation)) {
      other = other.getLocation();
    }

    var answer = (other.row === this.row) && (other.col === this.col) &&

    (this.type != null) && (other.type != null) ?
      (answer = answer && (this.type === other.type)) : undefined;

    if ((this.length != null) && (other.length != null)) {
      answer = answer && (this.length === other.length);
    }

    return answer;
  }
});

exports.StartToken = (StartToken = class StartToken extends Token {
  constructor(container) {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
      eval(`${thisName} = this;`);
    }
    this.container = container;
    super(...arguments); this.markup = 'begin';
  }

  insert(token) {
    if (token instanceof StartToken ||
       token instanceof EndToken) {
     console.warn('"insert"-ing a container can cause problems');
   }

    token.next = this.next; token.prev = this;
    this.next.prev = token; this.next = token;

    token.parent = this.container;

    return token;
  }

  serialize() { return '<container>'; }
});

exports.EndToken = (EndToken = class EndToken extends Token {
  constructor(container) {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
      eval(`${thisName} = this;`);
    }
    this.container = container;
    super(...arguments); this.markup = 'end';
  }

  insert(token) {
    if (token instanceof StartToken ||
       token instanceof EndToken) {
     console.warn('"insert"-ing a container can cause problems');
   }

    token.next = this.next; token.prev = this;
    this.next.prev = token; this.next = token;

    token.parent = this.container.parent;

    return token;
  }

  serialize() { return '</container>'; }
});

// Block
// ==================

exports.BlockStartToken = (BlockStartToken = class BlockStartToken extends StartToken {
  constructor(container) { {     // Hack: trick Babel/TypeScript into allowing this before super.
    if (false) { super(); }     let thisFn = (() => { return this; }).toString();     let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();     eval(`${thisName} = this;`);   }   this.container = container; super(...arguments); this.type = 'blockStart'; }
});

exports.BlockEndToken = (BlockEndToken = class BlockEndToken extends EndToken {
  constructor(container) { {     // Hack: trick Babel/TypeScript into allowing this before super.
    if (false) { super(); }     let thisFn = (() => { return this; }).toString();     let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();     eval(`${thisName} = this;`);   }   this.container = container; super(...arguments); this.type = 'blockEnd'; }
  serialize() { return "</block>"; }
});

exports.Block = (Block = class Block extends Container {
  constructor(precedence, color, socketLevel, classes, parseContext, buttons) {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
      eval(`${thisName} = this;`);
    }
    if (precedence == null) { precedence = 0; }
    this.precedence = precedence;
    if (color == null) { color = 'blank'; }
    this.color = color;
    if (socketLevel == null) { socketLevel = helper.ANY_DROP; }
    this.socketLevel = socketLevel;
    if (classes == null) { classes = []; }
    this.classes = classes;
    this.parseContext = parseContext;
    if (buttons == null) { buttons = {}; }
    this.buttons = buttons;
    this.start = new BlockStartToken(this);
    this.end = new BlockEndToken(this);

    this.type = 'block';

    super(...arguments);
  }

  nextSibling() {
    let head = this.end.next;
    const { parent } = head;
    while (head && (head.container !== parent)) {
      if (head instanceof StartToken) {
        return head.container;
      }
      head = head.next;
    }
    return null;
  }

  _cloneEmpty() {
    const clone = new Block(this.precedence, this.color, this.socketLevel, this.classes, this.parseContext, this.buttons);
    clone.currentlyParenWrapped = this.currentlyParenWrapped;

    return clone;
  }

  _serialize_header() { let left;
  return `<block precedence=\"${
    this.precedence}\" color=\"${
    this.color}\" socketLevel=\"${
    this.socketLevel}\" classes=\"${
    (left = __guardMethod__(this.classes, 'join', o => o.join(' '))) != null ? left : ''}\" \
>`; }
  _serialize_footer() { return "</block>"; }
});

// Socket
// ==================

exports.SocketStartToken = (SocketStartToken = class SocketStartToken extends StartToken {
  constructor(container) { {     // Hack: trick Babel/TypeScript into allowing this before super.
    if (false) { super(); }     let thisFn = (() => { return this; }).toString();     let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();     eval(`${thisName} = this;`);   }   this.container = container; super(...arguments); this.type = 'socketStart'; }
});

exports.SocketEndToken = (SocketEndToken = class SocketEndToken extends EndToken {
  constructor(container) { {     // Hack: trick Babel/TypeScript into allowing this before super.
    if (false) { super(); }     let thisFn = (() => { return this; }).toString();     let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();     eval(`${thisName} = this;`);   }   this.container = container; super(...arguments); this.type = 'socketEnd'; }

  stringify(opts) {
    // If preserveEmpty is turned on, substitute our placeholder string
    // for an empty socket
    if (opts == null) { opts = DEFAULT_STRINGIFY_OPTS; }
    if ((opts.preserveEmpty && (this.prev === this.container.start)) ||
        ((this.prev.type === 'text') && (this.prev.value === ''))) {
      return this.container.emptyString;

    // Otherwise, do nothing, and allow the socket to stringify to ''
    } else { return ''; }
  }
});

exports.Socket = (Socket = class Socket extends Container {
  constructor(
      // @emptyString -- the string that this will stringify to when it is empty,
      // used for round-tripping empty sockets
      emptyString,

      // @precedence -- used to compare with `Block.precedence` to see if a block
      // can drop in a socket or if it needs parentheses. Not used in ANTLR modes.
      precedence,

      // @handwritten -- whether this is a socket in a block that was created by pressing Enter in the editor.
      // This determines whether it can be deleted again by pressing delete when the socket is empty.
      handwritten,

      // @classes -- passed to mode callbacks for droppability and parentheses callbacks
      classes,

      // @dropdown -- dropdown options, if they exist
      dropdown = null,

      // @parseContext -- the interior node in the parse tree that this socket represents.
      // Passed to the parser when doing live reparsing in this socket.
      parseContext = null) {

    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
      eval(`${thisName} = this;`);
    }
    this.emptyString = emptyString;
    if (precedence == null) { precedence = 0; }
    this.precedence = precedence;
    if (handwritten == null) { handwritten = false; }
    this.handwritten = handwritten;
    if (classes == null) { classes = []; }
    this.classes = classes;
    this.dropdown = dropdown;
    this.parseContext = parseContext;
    this.start = new SocketStartToken(this);
    this.end = new SocketEndToken(this);

    this.type = 'socket';

    super(...arguments);
  }

  textContent() {
    let head = this.start.next; let str = '';
    while (head !== this.end) {
      str += head.stringify();
      head = head.next;
    }
    return str;
  }

  hasDropdown() { return (this.dropdown != null) && this.isDroppable(); }

  editable() { return (!((this.dropdown != null) && this.dropdown.dropdownOnly)) && this.isDroppable(); }

  isDroppable() { return (this.start.next === this.end) || (this.start.next.type === 'text'); }

  _cloneEmpty() { return new Socket(this.emptyString, this.precedence, this.handwritten, this.classes, this.dropdown, this.parseContext); }

  _serialize_header() { let left, left1;
  return `<socket precedence=\"${
      this.precedence
    }\" handwritten=\"${
      this.handwritten
    }\" classes=\"${
      (left = __guardMethod__(this.classes, 'join', o => o.join(' '))) != null ? left : ''
    }\"${
      (this.dropdown != null) ?
        ` dropdown=\"${(left1 = __guardMethod__(this.dropdown, 'join', o1 => o1.join(' '))) != null ? left1 : ''}\"`
      : ''
    }>`; }

  _serialize_footer() { return "</socket>"; }
});

// Indent
// ==================

exports.IndentStartToken = (IndentStartToken = class IndentStartToken extends StartToken {
  constructor(container) { {     // Hack: trick Babel/TypeScript into allowing this before super.
    if (false) { super(); }     let thisFn = (() => { return this; }).toString();     let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();     eval(`${thisName} = this;`);   }   this.container = container; super(...arguments); this.type = 'indentStart'; }
});

exports.IndentEndToken = (IndentEndToken = class IndentEndToken extends EndToken {
  constructor(container) { {     // Hack: trick Babel/TypeScript into allowing this before super.
    if (false) { super(); }     let thisFn = (() => { return this; }).toString();     let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();     eval(`${thisName} = this;`);   }   this.container = container; super(...arguments); this.type = 'indentEnd'; }
  stringify(opts) {
    // As with sockets, substitute a placeholder string if preserveEmpty
    // is turned on.
    if (opts == null) { opts = DEFAULT_STRINGIFY_OPTS; }
    if (opts.preserveEmpty && (this.prev.prev === this.container.start)) {
      return this.container.emptyString;
    } else { return ''; }
  }
  serialize() { return "</indent>"; }
});

exports.Indent = (Indent = class Indent extends Container {
  constructor(emptyString, prefix, classes, parseContext = null) {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
      eval(`${thisName} = this;`);
    }
    this.emptyString = emptyString;
    if (prefix == null) { prefix = ''; }
    this.prefix = prefix;
    if (classes == null) { classes = []; }
    this.classes = classes;
    this.parseContext = parseContext;
    this.start = new IndentStartToken(this);
    this.end = new IndentEndToken(this);

    this.type = 'indent';

    this.depth = this.prefix.length;

    super(...arguments);
  }

  _cloneEmpty() { return new Indent(this.emptyString, this.prefix, this.classes, this.parseContext); }
  firstChild() { return this._firstChild(); }

  _serialize_header() { let left;
  return `<indent prefix=\"${
    this.prefix
  }\" classes=\"${
    (left = __guardMethod__(this.classes, 'join', o => o.join(' '))) != null ? left : ''
  }\">`; }
  _serialize_footer() { return "</indent>"; }
});


// Document
// ==================

exports.DocumentStartToken = (DocumentStartToken = class DocumentStartToken extends StartToken {
  constructor(container) { {     // Hack: trick Babel/TypeScript into allowing this before super.
    if (false) { super(); }     let thisFn = (() => { return this; }).toString();     let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();     eval(`${thisName} = this;`);   }   this.container = container; super(...arguments); this.type = 'documentStart'; }
  serialize() { return "<document>"; }
});

exports.DocumentEndToken = (DocumentEndToken = class DocumentEndToken extends EndToken {
  constructor(container) { {     // Hack: trick Babel/TypeScript into allowing this before super.
    if (false) { super(); }     let thisFn = (() => { return this; }).toString();     let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();     eval(`${thisName} = this;`);   }   this.container = container; super(...arguments); this.type = 'documentEnd'; }
  serialize() { return "</document>"; }
});

exports.Document = (Document = class Document extends Container {
  constructor(parseContext, opts) {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
      eval(`${thisName} = this;`);
    }
    this.parseContext = parseContext;
    if (opts == null) { opts = {}; }
    this.opts = opts;
    this.start = new DocumentStartToken(this);
    this.end = new DocumentEndToken(this);
    this.classes = ['__document__'];

    this.type = 'document';

    super(...arguments);
  }

  _cloneEmpty() { return new Document(this.parseContext, this.opts); }
  firstChild() { return this._firstChild(); }

  _serialize_header() { return "<document>"; }
  _serialize_footer() { return "</document>"; }
});


// Text
exports.TextToken = (TextToken = (function() {
  TextToken = class TextToken extends Token {
    static initClass() {
  
      // We will define getter/setter for the @value property
      // of TextToken, which is meant to be mutable but
      // also causes content change.
      this.trigger('value', (function() { return this._value; }), function(value) {
        this._value = value;
        return this.notifyChange();
      });
    }
    constructor(_value) {
      {
        // Hack: trick Babel/TypeScript into allowing this before super.
        if (false) { super(); }
        let thisFn = (() => { return this; }).toString();
        let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
        eval(`${thisName} = this;`);
      }
      this._value = _value;
      super(...arguments);
      this.type = 'text';
    }

    stringify() { return this._value; }
    serialize() { return helper.escapeXMLText(this._value); }

    clone() { return new TextToken(this._value); }
  };
  TextToken.initClass();
  return TextToken;
})());

exports.NewlineToken = (NewlineToken = class NewlineToken extends Token {
  constructor(specialIndent) { {     // Hack: trick Babel/TypeScript into allowing this before super.
    if (false) { super(); }     let thisFn = (() => { return this; }).toString();     let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();     eval(`${thisName} = this;`);   }   this.specialIndent = specialIndent; super(...arguments); this.type = 'newline'; }
  stringify() { return `\n${this.specialIndent != null ? this.specialIndent : this.getIndent()}`; }
  serialize() { return '\n'; }
  clone() { return new NewlineToken(this.specialIndent); }
});

// Utility function for traversing all
// the blocks at the same nesting depth
// as the head token.
var traverseOneLevel = function(head, fn, tail) {
  while (true) {
    if (head instanceof StartToken) {
      fn(head.container);
      head = head.container.end;
    } else {
      fn(head);
    }

    if (head === tail) {
      return;
    }

    head = head.next;
  }
};

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