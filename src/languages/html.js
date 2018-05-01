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
let HTMLParser;
const helper = require('../helper');
const parser = require('../parser');

const parse5 = require('parse5');

const ATTRIBUTE_CLASSES = ['#attribute'];

const TAGS = {
  //Metadata
  '#documentType': {category: 'metadata'},
  html: {category: 'metadata'},
  head: {category: 'metadata'},
  title: {category: 'metadata'},
  link: {category: 'metadata', dropdown: {'*': ['href=""', 'rel=""', 'type=""', 'media=""', 'title=""'] } },
  meta: {category: 'metadata', dropdown: {'*': ['content=""', 'name=""', 'http-equiv=""', 'property=""'] } },
  style: {category: 'metadata'},
  script: {category: 'metadata'},
  base: {category: 'metadata'},

  //Grouping
  p: {category: 'grouping'},
  hr: {category: 'grouping'},
  div: {category: 'grouping', dropdown: {'*': ['class=""', 'id=""', 'style=""'] } },
  ul: {category: 'grouping'},
  ol: {category: 'grouping'},
  li: {category: 'grouping'},
  dl: {category: 'grouping'},
  dt: {category: 'grouping'},
  dd: {category: 'grouping'},
  pre: {category: 'grouping'},
  blockquote: {category: 'grouping'},
  figure: {category: 'grouping'},
  figcaption: {category: 'grouping'},
  main: {category: 'grouping'},
  dd: {category: 'grouping'},

  //Content
  a: {category: 'content', dropdown: {'*': ['href=""', 'target=""', 'title=""', 'rel=""', 'onclick=""'] } },
  i: {category: 'content'},
  b: {category: 'content'},
  u: {category: 'content'},
  sub: {category: 'content'},
  sup: {category: 'content'},
  br: {category: 'content'},
  em: {category: 'content'},
  strong: {category: 'content'},
  small: {category: 'content'},
  s: {category: 'content'},
  cite: {category: 'content'},
  q: {category: 'content'},
  dfn: {category: 'content'},
  abbr: {category: 'content'},
  ruby: {category: 'content'},
  rt: {category: 'content'},
  rp: {category: 'content'},
  data: {category: 'content'},
  time: {category: 'content'},
  code: {category: 'content'},
  var: {category: 'content'},
  samp: {category: 'content'},
  kbd: {category: 'content'},
  mark: {category: 'content'},
  bdi: {category: 'content'},
  bdo: {category: 'content'},
  span: {category: 'content', dropdown: {'*': ['class=""', 'id=""', 'style=""'] } },
  wbr: {category: 'content'},
  '#text': {category: 'content'},

  //Sections
  body: {category: 'sections'},
  article: {category: 'sections'},
  section: {category: 'sections'},
  nav: {category: 'sections'},
  aside: {category: 'sections'},
  h1: {category: 'sections'},
  h2: {category: 'sections'},
  h3: {category: 'sections'},
  h4: {category: 'sections'},
  h5: {category: 'sections'},
  h6: {category: 'sections'},
  hgroup: {category: 'sections'},
  header: {category: 'sections'},
  footer: {category: 'sections'},
  address: {category: 'sections'},

  //Table
  table: {category: 'table'},
  caption: {category: 'table'},
  colgroup: {category: 'table'},
  col: {category: 'table'},
  tbody: {category: 'table'},
  thead: {category: 'table'},
  tfoot: {category: 'table'},
  tr: {category: 'table'},
  td: {category: 'table'},
  th: {category: 'table'},

  //Form
  form: {category: 'form', dropdown: {'*': ['action=""', 'method=""', 'name=""'] } },
  input: {category: 'form', dropdown: {'*': ['type=""', 'name=""', 'value=""'] } },
  textarea: {category: 'form', content: 'optional'},
  label: {category: 'form', dropdown: {'*': ['for=""'] } },
  button: {category: 'form'},
  select: {category: 'form'},
  option: {category: 'form'},
  optgroup: {category: 'form'},
  datalist: {category: 'form'},
  keygen: {category: 'form'},
  output: {category: 'form'},
  progress: {category: 'form', content: 'optional'},
  meter: {category: 'form', content: 'optional'},
  fieldset: {category: 'form'},
  legend: {category: 'form'},

  //Embedded
  img: {category: 'embedded', dropdown: { '*': ['src=""', 'alt=""', 'width=""', 'height=""', 'border=""', 'title=""'] } },
  iframe: {category: 'embedded', content: 'optional'},
  embed: {category: 'embedded'},
  object: {category: 'embedded'},
  param: {category: 'embedded'},
  video: {category: 'embedded'},
  audio: {category: 'embedded'},
  source: {category: 'embedded'},
  track: {category: 'embedded'},
  map: {category: 'embedded'},
  area: {category: 'embedded'},

  //Other known tags
  ins: {category: 'other'},
  del: {category: 'other'},
  details: {category: 'other'},
  summary: {category: 'other'},
  menu: {category: 'other'},
  menuitem: {category: 'other'},
  dialog: {category: 'other'},
  noscript: {category: 'other'},
  template: {category: 'other'},
  canvas: {category: 'other', content: 'optional'},
  svg: {category: 'other'},
  frameset: {category: 'other'}
};

const CATEGORIES = {
  metadata: {color: 'lightblue'},
  grouping: {color: 'purple'},
  content: {color: 'lightgreen'},
  sections: {color: 'orange'},
  table: {color: 'indigo'},
  form: {color: 'deeporange'},
  embedded: {color: 'teal'},
  other: {color: 'pink'},
  Default: {color: 'yellow'}
};

const DEFAULT_INDENT_DEPTH = '  ';

const EMPTY_ELEMENTS = ['area', 'base', 'basefont', 'bgsound', 'br', 'col', 'command', 'embed', 'frame', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr'];

const BLOCK_ELEMENTS = ['address', 'article', 'aside', 'audio', 'blockquote', 'canvas', 'dd', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'nav', 'noscript', 'ol', 'output', 'p', 'pre', 'section', 'table', 'tfoot', 'ul', 'video'];

const INLINE_ELEMENTS = ['a', 'abbr', 'acronym', 'b', 'bdi', 'bdo', 'big', 'br', 'button', 'cite', 'dfn', 'em', 'i', 'img', 'input', 'kbd', 'label', 'map', 'object', 'q', 'samp', 'script', 'select', 'small', 'span', 'strong', 'sub', 'sup', 'textarea', 'tt', 'var'];

const FLOW_ELEMENTS = (BLOCK_ELEMENTS.concat(INLINE_ELEMENTS)).sort();

const METADATA_CONTENT = ['base', 'link', 'meta', 'noscript', 'script', 'style', 'template', 'title'];

const FLOW_CONTENT = ['a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'bdi', 'bdo', 'blockquote', 'br', 'button', 'canvas', 'cite', 'code', 'data', 'datalist', 'del', 'dfn', 'div', 'dl', 'em', 'embed', 'fieldset', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'keygen', 'label', 'main', 'map', 'mark', 'math', 'meter', 'nav', 'noscript', 'object', 'ol', 'output', 'p', 'pre', 'progress', 'q', 'ruby', 's', 'samp', 'script', 'section', 'select', 'small', 'span', 'strong', 'sub', 'sup', 'svg', 'table', 'template', 'textarea', 'time', 'u', 'ul', 'var', 'video', 'wbr', '#text'];

const SECTIONING_CONTENT = ['article', 'aside', 'nav', 'section'];

const HEADING_CONTENT = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

const PHRASING_CONTENT = ['a', 'abbr', 'area', 'audio', 'b', 'bdi', 'bdo', 'br', 'button', 'canvas', 'cite', 'code', 'data', 'datalist', 'del', 'dfn', 'em', 'embed', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'keygen', 'label', 'map', 'mark', 'math', 'meter', 'noscript', 'object', 'output', 'progress', 'q', 'ruby', 's', 'samp', 'script', 'select', 'small', 'span', 'strong', 'sub', 'sup', 'svg', 'template', 'textarea', 'time', 'u', 'var', 'video', 'wbr', '#text'];

const EMBEDDED_CONTENT = ['audio', 'canvas', 'embed', 'iframe', 'img', 'math', 'object', 'svg', 'video'];

const INTERACTIVE_CONTENT = ['a', 'audio', 'button', 'embed', 'iframe', 'img', 'input', 'keygen', 'label', 'object', 'select', 'textarea', 'video'];

const PALPABLE_CONTENT = ['a', 'abbr', 'address', 'article', 'aside', 'audio', 'b', 'bdi', 'bdo', 'blockquote', 'button', 'canvas', 'cite', 'code', 'data', 'dfn', 'div', 'dl', 'em', 'embed', 'fieldset', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'keygen', 'label', 'main', 'map', 'mark', 'math', 'meter', 'nav', 'object', 'ol', 'output', 'p', 'pre', 'progress', 'q', 'ruby', 's', 'samp', 'section', 'select', 'small', 'span', 'strong', 'sub', 'sup', 'svg', 'table', 'textarea', 'time', 'u', 'ul', 'var', 'video', '#text'];

const SCRIPT_SUPPORTING = ['script', 'template'];

const htmlParser = {
  parseFragment(frag) {
    return parse5.parseFragment(frag, {decodeHtmlEntities: false, locationInfo: true});
  },

  parse(doc) {
    return parse5.parse(doc, {decodeHtmlEntities: false, locationInfo: true});
  }
};

const htmlSerializer = {
  serialize(tree) {
     return parse5.serialize(tree, {encodeHtmlEntities: false});
   }
};

exports.HTMLParser = (HTMLParser = class HTMLParser extends parser.Parser {

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

    this.opts.tags = helper.extend({}, TAGS, this.opts.tags);
    this.opts.categories = helper.extend({}, CATEGORIES, this.opts.categories);

    this.lines = this.text.split('\n');
  }

  getPrecedence(node) { return 1; }

  getClasses(node) {
    const classes = [node.nodeName];
    return classes;
  }

  getButtons(node) {
    const buttons = {};
    if (['thead', 'tbody', 'tr', 'table'].includes(node.nodeName)) {
      buttons.addButton = '+';
      if (node.childNodes.length !== 0) {
        buttons.subtractButton = '-';
      }
    }
    return buttons;
  }

  getColor(node) {
    if (this.opts.tags[node.nodeName]) {
      return this.opts.categories[this.opts.tags[node.nodeName].category].color;
    }
    return this.opts.categories.Default.color;
  }

  getDropdown(node) {
    return __guard__(this.opts.tags[node.nodeName] != null ? this.opts.tags[node.nodeName].dropdown : undefined, x => x['*']) != null ? __guard__(this.opts.tags[node.nodeName] != null ? this.opts.tags[node.nodeName].dropdown : undefined, x => x['*']) : null;
  }

  getBounds(node) {
    const bounds = {
      start: this.positions[node.__location.startOffset],
      end: this.positions[node.__location.endOffset]
    };

    return bounds;
  }

  genBounds(location) {
    const bounds = {
      start: this.positions[location.start],
      end: this.positions[location.end]
    };

    return bounds;
  }

  isBlockNode(node) {
    if (node.nodeName === '#documentType') {
      return false;
    }
    return !Array.from(EMPTY_ELEMENTS).includes(node.nodeName);
  }

  inline(node) {
    const bounds = this.getBounds(node);
    return bounds.start.line === bounds.end.line;
  }

  hasAttribute(node, attribute) {
    if (node.attrs != null) {
      for (let attr of Array.from(node.attrs)) {
        if (attr.name === attribute) {
          return true;
        }
      }
    }
    return false;
  }

  setAttribs(node, string) {
    let offset = node.__location.startOffset;
    node.attributes = [];
    string = string.toLowerCase();

    if (node.nodeName !== "#documentType") {
      let end = string.indexOf(node.nodeName) + node.nodeName.length;
      offset += end;
      string = string.slice(end);
      let start = 0;
      end = 0;

      return (() => {
        const result = [];
        for (let att of Array.from(node.attrs)) {
          start = string.indexOf(att.name.toLowerCase());
          end = start + att.name.length;
          string = string.slice(end);
          if (string.trimLeft()[0] === '=') {
            let add = 0;
            const newStr = string.trimLeft().slice(1).trimLeft();
            add = string.length - newStr.length;
            string = string.slice(add);
            if (['"', '\''].includes(string[0]) && (string[0] === string[1])) {
              add += 2;
              string = string.slice(2);
            }
            end += add;
          }
          if (att.value.length !== 0) {
            var needle;
            let diff = string.indexOf(att.value.toLowerCase());
            if ((needle = string[diff-1], ['"', '\''].includes(needle)) && (string[diff-1] === string[diff + att.value.length])) {
              diff++;
            }
            diff += att.value.length;
            string = string.slice(diff);
            end += diff;
          }
          node.attributes.push({start: offset + start, end: offset + end});
          result.push(offset += end);
        }
        return result;
      })();
    }
  }

  cleanTree(node) {
    if (!node) {
      return;
    }

    if (node.childNodes != null) {
      let i = 0;
      return (() => {
        const result = [];
        while (i < node.childNodes.length) {
          this.cleanTree(node.childNodes[i]);
          if (!node.childNodes[i].__location) {
            if (node.childNodes[i].childNodes != null) {
              for (let child of Array.from(node.childNodes[i].childNodes)) {
                child.parentNode = node;
              }
            }
            result.push(node.childNodes = node.childNodes.slice(0, i).concat(node.childNodes[i].childNodes || []).concat(node.childNodes.slice(i+1)));
          } else {
            result.push(i++);
          }
        }
        return result;
      })();
    }
  }

  fixBounds(node) {
    if (!node) {
      return;
    }

    if (node.childNodes != null) {
      let child;
      for (let i = 0; i < node.childNodes.length; i++) {
        child = node.childNodes[i];
        this.fixBounds(child);
      }
      const newList = [];
      for (child of Array.from(node.childNodes)) {
        if (!child.remove) {
          newList.push(child);
        }
      }
      node.childNodes = newList;
    }

    if ((node.nodeName === '#document') || (node.nodeName === '#document-fragment')) {
      node.type = 'document';
      return;
    }

    if (node.nodeName === '#text') {
      node.type = 'text';
      if (node.value.trim().length === 0) {
        node.remove = true;
      } else {
        this.trimText(node);
      }
      return;
    }

    if (node.nodeName === '#comment') {
      node.type = 'comment';
      return;
    }

    if (!this.isBlockNode(node)) {
      node.type = 'emptyTag';
      if (node.__location != null) {
        this.setAttribs(node, this.text.slice(node.__location.startOffset, node.__location.endOffset));
      }
      return;
    }

    node.type = 'blockTag';

    node.__indentLocation = {startOffset: node.__location.startTag.endOffset};

    if ((node.childNodes != null ? node.childNodes.length : undefined) > 0) {
      node.__indentLocation.endOffset = node.childNodes[node.childNodes.length - 1].__location.endOffset;
    } else {
      node.__indentLocation.endOffset = node.__location.startTag.endOffset;
    }

    if (!node.__location.endTag) {
      // Forcing object copy because
      // sometimes parse5 reuses location info
      // for semi-fake nodes.
      node.__location = {
        startOffset: node.__location.startOffset,
        endOffset: node.__indentLocation.endOffset
      };
    }

    return this.setAttribs(node, this.text.slice(node.__location.startOffset, node.__indentLocation.startOffset));
  }

  getEndPoint(node) {
    if (['#document', '#document-fragment'].includes(node.nodeName)) {
      return this.text.length;
    }
    let last = null;
    const parent = node.parentNode;
    const ind = parent.childNodes.indexOf(node);
    if (ind === (parent.childNodes.length - 1)) {
      last = ((parent.__location != null ? parent.__location.endTag : undefined) != null) ? parent.__location.endTag.startOffset : this.getEndPoint(parent);
    } else {
      last = parent.childNodes[ind+1].__location.startOffset;
    }
    return last;
  }

  trimText(node) {
    const location = node.__location;
    location.endOffset = Math.min(location.endOffset, this.getEndPoint(node));
    let text = this.text.slice(location.startOffset, location.endOffset).split('\n');
    let i = 0;
    while (text[i].trim().length === 0) {
      location.startOffset += text[i].length + 1;
      i++;
    }
    let j = text.length - 1;
    while (text[j].trim().length === 0) {
      j--;
    }
    text = text.slice(i, +j + 1 || undefined).join('\n');
    location.endOffset = location.startOffset + text.length;
    if (i !== 0) {
      const leftTrimText = text.trimLeft();
      location.startOffset += text.length - leftTrimText.length;
      text = leftTrimText;
    }
    return node.value = text;
  }

  makeIndentBounds(node) {
    const bounds = {
      start: this.positions[node.__indentLocation.startOffset],
      end: this.positions[node.__indentLocation.endOffset]
    };

    const trailingText = this.lines[bounds.start.line].slice(bounds.start.column);
    if ((trailingText.length > 0) && (trailingText.trim().length === 0)) {
      bounds.start = {
        line: bounds.start.line,
        column: this.lines[bounds.start.line].length
      };
    }

    if (node.__location.endTag != null) {
      const lastLine = this.positions[node.__location.endTag.startOffset].line - 1;
      if ((lastLine > bounds.end.line) || ((lastLine === bounds.end.line) && (this.lines[lastLine].length > bounds.end.column))) {
        bounds.end = {
          line: lastLine,
          column: this.lines[lastLine].length
        };
      } else if ((node.__indentLocation.startOffset === node.__indentLocation.endOffset) && node.__location.endTag) {
        bounds.end = this.positions[node.__location.endTag.startOffset];
      }
    }

    return bounds;
  }

  getSocketLevel(node) { return helper.ANY_DROP; }

  htmlBlock(node, depth, bounds) {
    return this.addBlock({
      bounds: bounds != null ? bounds : this.getBounds(node),
      depth,
      precedence: this.getPrecedence(node),
      color: this.getColor(node),
      classes: this.getClasses(node),
      socketLevel: this.getSocketLevel(node),
      parseContext: node.nodeName,
      buttons: this.getButtons(node)
    });
  }

  htmlSocket(node, depth, precedence, bounds, classes, noDropdown) {
    return this.addSocket({
      bounds: bounds != null ? bounds : this.getBounds(node),
      depth,
      precedence,
      classes: classes != null ? classes : this.getClasses(node),
      dropdown: noDropdown ? null : this.getDropdown(node)
    });
  }

  getIndentPrefix(bounds, indentDepth, depth) {
    if ((bounds.end.line - bounds.start.line) < 1) {
      return DEFAULT_INDENT_DEPTH;
    } else {
      let tmp = 1;
      while (this.lines[bounds.start.line + tmp].trim().length === 0) {
        tmp++;
      }
      const line = this.lines[bounds.start.line + tmp];
      const lineIndent = line.slice(indentDepth, (line.length - line.trimLeft().length));
      if (lineIndent.length >= DEFAULT_INDENT_DEPTH.length) {
        return lineIndent;
      } else {
        return DEFAULT_INDENT_DEPTH;
      }
    }
  }

  handleButton(text, button, oldblock) {
    const { classes } = oldblock;
    const fragment = htmlParser.parseFragment(text);
    this.prototype.cleanTree(fragment);
    const block = fragment.childNodes[0];
    let prev = null;
    if (block.nodeName === 'tr') {
      prev = 'td';
    } else if (['table', 'thead', 'tbody'].includes(block.nodeName)) {
      prev = 'tr';
    } else if (block.nodeName === 'div') {
      prev = 'div';
    }
    if (prev) {
      let last = block.childNodes.length - 1;
      while (last >= 0) {
        if (block.childNodes[last].nodeName === prev) {
          break;
        }
        last--;
      }
      last++;
      if (button === 'add-button') {
        let extra;
        let indentPrefix = DEFAULT_INDENT_DEPTH;
        if (((block.childNodes != null ? block.childNodes.length : undefined) === 1) && (block.childNodes[0].nodeName === '#text') && (block.childNodes[0].value.trim().length === 0)) {
          block.childNodes[0].value = '\n';
        } else {
          const lines = __guard__(__guard__(block.childNodes != null ? block.childNodes[0] : undefined, x1 => x1.value), x => x.split('\n'));
          if ((lines != null ? lines.length : undefined) > 1) {
            indentPrefix = lines[lines.length - 1];
          }
        }
        switch (block.nodeName) {
          case 'tr':
            extra = htmlParser.parseFragment(`\n${indentPrefix}<td></td>`);
            break;
          case 'table':
            extra = htmlParser.parseFragment(`\n${indentPrefix}<tr>\n${indentPrefix}\n${indentPrefix}</tr>`);
            break;
          case 'tbody':
            extra = htmlParser.parseFragment(`\n${indentPrefix}<tr>\n${indentPrefix}\n${indentPrefix}</tr>`);
            break;
          case 'thead':
            extra = htmlParser.parseFragment(`\n${indentPrefix}<tr>\n${indentPrefix}\n${indentPrefix}</tr>`);
            break;
          case 'div':
            extra = htmlParser.parseFragment(`\n${indentPrefix}<div>\n${indentPrefix}\n${indentPrefix}</div>`);
            break;
        }
        block.childNodes = block.childNodes.slice(0, last).concat(extra.childNodes).concat(block.childNodes.slice(last));
      } else if (button === 'subtract-button') {
          let mid = last - 2;
          while (mid >= 0) {
            if (block.childNodes[mid].nodeName === prev) {
              break;
            }
            mid--;
          }
          block.childNodes = (mid >=0 ? block.childNodes.slice(0, +mid + 1 || undefined) : []).concat(block.childNodes.slice(last));
          if ((block.childNodes.length === 1) && (block.childNodes[0].nodeName === '#text') && (block.childNodes[0].value.trim().length === 0)) {
            block.childNodes[0].value = '\n  \n';
          }
        }
    }

    return htmlSerializer.serialize(fragment);
  }

  markRoot() {
    let root;
    this.positions = [];
    let line = 0;
    let column = 0;
    for (let i = 0; i < this.text.length; i++) {
      const val = this.text[i];
      this.positions[i] = {'line': line, 'column': column};
      column++;
      if (val === '\n') {
        line++;
        column = 0;
      }
    }
    this.positions[this.text.length] = {'line': line, 'column': column};

    const parseContext = this.opts.parseOptions != null ? this.opts.parseOptions.context : undefined;

    if (parseContext && !['html', 'head', 'body'].includes(parseContext)) {
      root = htmlParser.parseFragment(this.text);
      this.cleanTree(root);
      this.fixBounds(root);
    } else {
      root = htmlParser.parse(this.text);
      this.cleanTree(root);
      this.fixBounds(root);
      if (root.childNodes.length === 0) {
        root = htmlParser.parseFragment(this.text);
        this.cleanTree(root);
        this.fixBounds(root);
      }
    }
    return this.mark(0, root, 0, null);
  }

  mark(indentDepth, node, depth, bounds, nomark) {

    if (nomark == null) { nomark = false; }
    switch (node.type) {
      case 'document':
        var lastChild = null;
        return (() => {
          const result = [];
          for (let child of Array.from(node.childNodes)) {
            if (lastChild && (lastChild.__location.endOffset > child.__location.startOffset)) { nomark = true; } else { nomark = false; }
            this.mark(indentDepth, child, depth + 1, null, nomark);
            if (!nomark) {
              result.push(lastChild = child);
            } else {
              result.push(undefined);
            }
          }
          return result;
        })();

      case 'emptyTag':
        if (!nomark) {
          this.htmlBlock(node, depth, bounds);
          return (() => {
            const result1 = [];
            for (let attrib of Array.from(node.attributes)) {
              if ((attrib.end - attrib.start) > 1) {
                result1.push(this.htmlSocket(node, depth + 1, null, this.genBounds(attrib), ATTRIBUTE_CLASSES));
              } else {
                result1.push(undefined);
              }
            }
            return result1;
          })();
        }
        break;

      case 'blockTag':
        if (!nomark) {
          this.htmlBlock(node, depth, bounds);
          for (let attrib of Array.from(node.attributes)) {
            this.htmlSocket(node, depth + 1, null, this.genBounds(attrib), ATTRIBUTE_CLASSES);
          }
          const indentBounds = this.makeIndentBounds(node);
          if ((indentBounds.start.line !== indentBounds.end.line) || (indentBounds.start.column !== indentBounds.end.column)) {
            depth++;
            const prefix = this.getIndentPrefix(indentBounds, indentDepth, depth);
            indentDepth += prefix.length;
            this.addIndent({
              bounds: indentBounds,
              depth,
              prefix,
              classes: this.getClasses(node)
            });
            lastChild = null;
          } else {
            if (((TAGS[node.nodeName] != null ? TAGS[node.nodeName].content : undefined) !== 'optional') &&
                ((node.nodeName !== 'script') || !this.hasAttribute(node, 'src')) &&
                (node.__indentLocation.endOffset !== node.__location.endOffset)) {
              this.htmlSocket(node, depth + 1, null, indentBounds, null, true);
            }
          }
        }
        return (() => {
          const result2 = [];
          for (let child of Array.from(node.childNodes)) {
            if (lastChild && (lastChild.__location.endOffset > child.__location.startOffset)) { nomark = true; } else { nomark = false; }
            this.mark(indentDepth, child, depth + 1, null, nomark);
            if (!nomark) {
              result2.push(lastChild = child);
            } else {
              result2.push(undefined);
            }
          }
          return result2;
        })();

      case 'text':
        if (!nomark) {
          this.htmlBlock(node, depth, bounds);
          return this.htmlSocket(node, depth + 1, null);
        }
        break;

      case 'comment':
        if (!nomark) {
          this.htmlBlock(node, depth, bounds);
          node.__location.startOffset += 4;
          node.__location.endOffset -= 3;
          return this.htmlSocket(node, depth + 1, null);
        }
        break;
    }
  }

  isComment(text) {
    return text.match(/<!--.*-->/);
  }

  indentAndCommentMarker(text) {
    return [''];
  }
});

HTMLParser.parens = (leading, trailing, node, context) => [leading, trailing];

HTMLParser.drop = function(block, context, pred, next) {

  const blockType = block.classes[0];
  const contextType = context.classes[0];
  const predType = pred != null ? pred.classes[0] : undefined;
  const nextType = next != null ? next.classes[0] : undefined;

  const check = function(blockType, allowList, forbidList) {
    if (forbidList == null) { forbidList = []; }
    if (Array.from(allowList).includes(blockType) && !Array.from(forbidList).includes(blockType)) {
      return helper.ENCOURAGE;
    }
    return helper.FORBID;
  };

  switch (contextType) {
    case 'html':
      if (blockType === 'head') {
        if ((predType === 'html') && (!next || ['body', 'frameset'].includes(nextType))) {
          return helper.ENCOURAGE;
        }
      }
      if (['body', 'frameset'].includes(blockType)) {
        if (['html', 'head'].includes(predType) && !next) {
          return helper.ENCOURAGE;
        }
        return helper.FORBID;
      }
      return helper.FORBID;
      break;
    case 'head':
      return check(blockType, METADATA_CONTENT);
      break;
    case 'title':
      return check(blockType, ['#text']);
      break;
    case 'style':
      return check(blockType, ['#text']);
      break;
    case 'body':
      return check(blockType, FLOW_CONTENT);
      break;
    case 'article':
      return check(blockType, FLOW_CONTENT);
      break;
    case 'section':
      return check(blockType, FLOW_CONTENT);
      break;
    case 'nav':
      return check(blockType, FLOW_CONTENT, ['main']);
      break;
    case 'aside':
      return check(blockType, FLOW_CONTENT, ['main']);
      break;
    case 'header':
      return check(blockType, FLOW_CONTENT, ['header', 'footer', 'main']);
      break;
    case 'footer':
      return check(blockType, FLOW_CONTENT, ['header', 'footer', 'main']);
      break;
    case 'address':
      return check(blockType, FLOW_CONTENT, HEADING_CONTENT.concat(SECTIONING_CONTENT).concat(['header', 'footer', 'address']));
      break;
    case 'p':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'pre':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'blockquote':
      return check(blockType, FLOW_CONTENT);
      break;
    case 'ol':
      return check(blockType, SCRIPT_SUPPORTING.concat('li'));
      break;
    case 'ul':
      return check(blockType, SCRIPT_SUPPORTING.concat('li'));
      break;
    case 'li':
      return check(blockType, FLOW_CONTENT);
      break;
    case 'dl':
      return check(blockType, ['dt', 'dd']);
      break;
    case 'dt':
      return check(blockType, FLOW_CONTENT, HEADING_CONTENT.concat(SECTIONING_CONTENT).concat(['header', 'footer']));
      break;
    case 'dd':
      return check(blockType, FLOW_CONTENT);
      break;
    case 'figure':
      return check(blockType, FLOW_CONTENT.concat('figcaption'));
      break;
    case 'figcaption':
      return check(blockType, FLOW_CONTENT);
      break;
    case 'div':
      return check(blockType, FLOW_CONTENT);
      break;
    case 'main':
      return check(blockType, FLOW_CONTENT);
      break;
    case 'a':
      return check(blockType, PHRASING_CONTENT, INTERACTIVE_CONTENT);  //SHOULD BE TRANSPARENT, INTERACTIVE
      break;
    case 'em':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'strong':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'small':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 's':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'cite':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'q':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'dfn':
      return check(blockType, PHRASING_CONTENT, ['dfn']);
      break;
    case 'abbr':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'data':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'time':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'code':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'var':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'samp':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'kbd':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'mark':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'ruby':
      return check(blockType, PHRASING_CONTENT.concat(['rb', 'rt', 'rtc', 'rp']));
      break;
    case 'rb':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'rt':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'rtc':
      return check(blockType, PHRASING_CONTENT.concat('rt'));
      break;
    case 'rp':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'bdi':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'bdo':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'span':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'ins':
      return check(blockType, PHRASING_CONTENT);  //Transparent
      break;
    case 'del':
      return check(blockType, PHRASING_CONTENT);  //Transparent
      break;
    case 'iframe':
      return check(blockType, ['#documentType', '#comment', 'html']);
      break;
    case 'object':                //HANDLE ALL TYPES OF EMBEDDED CONTENT
      return check(blockType, []);
      break;
    case 'map':
      return check(blockType, PHRASING_CONTENT);  //Transparent
      break;
    case 'table':
      return check(blockType, ['caption', 'colgroup', 'thead', 'tfoot', 'tbody', 'tr'].concat(SCRIPT_SUPPORTING));
      break;
    case 'caption':
      return check(blockType, FLOW_CONTENT, ['table']);
      break;
    case 'colgroup':
      return check(blockType, ['span', 'col', 'template']);
      break;
    case 'tbody':
      return check(blockType, SCRIPT_SUPPORTING.concat('tr'));
      break;
    case 'thead':
      return check(blockType, SCRIPT_SUPPORTING.concat('tr'));
      break;
    case 'tfoot':
      return check(blockType, SCRIPT_SUPPORTING.concat('tr'));
      break;
    case 'tr':
      return check(blockType, SCRIPT_SUPPORTING.concat(['td', 'th']));
      break;
    case 'td':
      return check(blockType, FLOW_CONTENT);
      break;
    case 'th':
      return check(blockType, FLOW_CONTENT, HEADING_CONTENT.concat(SECTIONING_CONTENT).concat(['header', 'footer']));
      break;
    case 'form':
      return check(blockType, FLOW_CONTENT, ['form']);
      break;
    case 'label':
      return check(blockType, PHRASING_CONTENT, ['label']);
      break;
    case 'button':
      return check(blockType, PHRASING_CONTENT, INTERACTIVE_CONTENT);
      break;
    case 'select':
      return check(blockType, SCRIPT_SUPPORTING.concat(['option', 'optgroup']));
      break;
    case 'datalist':
      return check(blockType, PHRASING_CONTENT.concat('option'));
      break;
    case 'optgroup':
      return check(blockType, SCRIPT_SUPPORTING.concat('option'));
      break;
    case 'option':
      return check(blockType, '#text');
      break;
    case 'textarea':
      return check(blockType, '#text');
      break;
    case 'output':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'progress':
      return check(blockType, PHRASING_CONTENT, ['progress']);
      break;
    case 'meter':
      return check(blockType, PHRASING_CONTENT, ['meter']);
      break;
    case 'fieldset':
      return check(blockType, FLOW_CONTENT.concat('legend'));
      break;
    case 'legend':
      return check(blockType, PHRASING_CONTENT);
      break;
    case 'script':
      return check(blockType, '#text');
      break;
    case 'noscript':
      return check(blockType, FLOW_CONTENT.concat(['link', 'style', 'meta']));
      break;
    case 'template':
      return check(blockType, METADATA_CONTENT.concat(FLOW_CONTENT).concat(['ol', 'ul', 'dl', 'figure', 'ruby', 'object', 'video', 'audio', 'table', 'colgroup', 'thead', 'tbody', 'tfoot', 'tr', 'fieldset', 'select']));
      break;
    case 'canvas':
      return check(blockType, FLOW_CONTENT);
      break;
    case '__document__':
      if (blockType === '#documentType') {
        if ((pred.type === 'document') && (!next || (nextType === 'html'))) {
          return helper.ENCOURAGE;
        }
        return helper.FORBID;
      }
      if (blockType === 'html') {
        if (((pred.type === 'document') || (predType === '#documentType')) && !next) {
          return helper.ENCOURAGE;
        }
        return helper.FORBID;
      }
      return helper.FORBID;
      break;
  }

  if (Array.from(HEADING_CONTENT).includes(contextType)) {
    return check(blockType, PHRASING_CONTENT);
  }

  if (['sub', 'sup', 'i', 'b', 'u'].includes(contextType)) {
    return check(blockType, PHRASING_CONTENT);
  }

  return helper.FORBID;
};

module.exports = parser.wrapParser(HTMLParser);

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}