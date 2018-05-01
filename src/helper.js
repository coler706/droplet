/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS203: Remove `|| {}` from converted for-own loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Droplet helper functions.
//
// Copyright (c) 2015 Anthony Bau (dab1998@gmail.com).
// MIT License.
let deepCopy, deepEquals, fontMetrics, looseCUnescape, PairDict, quoteAndCEscape;
const sax = require('sax');

exports.ANY_DROP = 0;
exports.BLOCK_ONLY = 1;
exports.MOSTLY_BLOCK = 2;
exports.MOSTLY_VALUE = 3;
exports.VALUE_ONLY = 4;
exports.SVG_STANDARD = 'http://www.w3.org/2000/svg';

exports.ENCOURAGE = 1;
exports.DISCOURAGE = 0;
exports.FORBID = -1;

exports.DROPDOWN_ARROW_WIDTH = 15;
exports.DROPDOWN_ARROW_PADDING = 3;

if (typeof window !== 'undefined' && window !== null) {
  window.String.prototype.trimLeft = function() {
    return this.replace(/^\s+/, '');
  };

  window.String.prototype.trimRight = function() {
    return this.replace(/\s+$/, '');
  };
}

// Like $.extend
exports.extend = function(target) {
  const sources = [].slice.call(arguments, 1);
  sources.forEach(function(source) {
    if (source) {
      return Object.getOwnPropertyNames(source).forEach(prop =>
        Object.defineProperty(target, prop,
            Object.getOwnPropertyDescriptor(source, prop))
      );
    }
  });
  return target;
};

exports.xmlPrettyPrint = function(str) {
  let result = '';
  const xmlParser = sax.parser(true);

  xmlParser.ontext = text => result += exports.escapeXMLText(text);
  xmlParser.onopentag = function(node) {
    result += `<${node.name}`;
    for (let attr in node.attributes) {
      const val = node.attributes[attr];
      result += `\n  ${attr}=${JSON.stringify(val)}`;
    }
    return result += '>';
  };
  xmlParser.onclosetag = name => result += `</${name}>`;

  xmlParser.write(str).close();

  return result;
};

const fontMetricsCache = {};
exports.fontMetrics = (fontMetrics = function(fontFamily, fontHeight) {
  const fontStyle = `${fontHeight}px ${fontFamily}`;
  let result = fontMetricsCache[fontStyle];

  const textTopAndBottom = function(testText) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'white';
    ctx.fillText(testText, 0, 0);
    const right = Math.ceil(ctx.measureText(testText).width);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let first = -1;
    let last = height;
    for (let row = 0, end = height, asc = 0 <= end; asc ? row < end : row > end; asc ? row++ : row--) {
      var col;
      var asc1, end1;
      for (col = 1, end1 = right, asc1 = 1 <= end1; asc1 ? col < end1 : col > end1; asc1 ? col++ : col--) {
        const index = ((row * width) + col) * 4;
        if (pixels[index] !== 0) {
          if (first < 0) {
            first = row;
          }
          break;
        }
      }
      if ((first >= 0) && (col >= right)) {
        last = row;
        break;
      }
    }
    return {top: first, bottom: last};
  };

  if (!result) {
    const canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    ctx.font = fontStyle;
    const metrics = ctx.measureText('Hg');
    if ((canvas.height < (fontHeight * 2)) ||
       (canvas.width < metrics.width)) {
      canvas.width = Math.ceil(metrics.width);
      canvas.height = fontHeight * 2;
      ctx = canvas.getContext('2d');
      ctx.font = fontStyle;
    }
    var { width } = canvas;
    var { height } = canvas;
    const capital = textTopAndBottom('H');
    const ex = textTopAndBottom('x');
    const lf = textTopAndBottom('lf');
    const gp = textTopAndBottom('g');
    const baseline = capital.bottom;
    result = {
      ascent: lf.top,
      capital: capital.top,
      ex: ex.top,
      baseline: capital.bottom,
      descent: gp.bottom
    };
    result.prettytop = Math.max(0, Math.min(result.ascent,
      result.ex - (result.descent - result.baseline)));
    fontMetricsCache[fontStyle] = result;
  }
  return result;
});

exports.clipLines = function(lines, start, end) {
  if (start.line !== end.line) {
    //console.log 'pieces:',
    //  "'#{lines[start.line][start.column..]}'",
    //  "'#{lines[start.line + 1...end.line].join('\n')}'",
    //  "'#{lines[end.line][...end.column]}'"
    return lines[start.line].slice(start.column) +
    lines.slice(start.line + 1, end.line).join('\n') +
    lines[end.line].slice(0, end.column);
  } else {
    //console.log 'clipping', lines[start.line], 'from', start.column + 1, 'to', end.column
    return lines[start.line].slice(start.column, end.column);
  }
};

exports.getFontHeight = function(family, size) {
  const metrics = fontMetrics(family, size);
  return metrics.descent - metrics.prettytop;
};

exports.escapeXMLText = str => str.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

exports.serializeShallowDict = function(dict) {
  const props = [];
  for (let key in dict) {
    const val = dict[key];
    props.push(key + ':' + val);
  }
  return props.join(';');
};

exports.deserializeShallowDict = function(str) {
  if (str == null) { return undefined; }
  const dict = {}; const props = str.split(';');
  for (let prop of Array.from(props)) {
    const [key, val] = Array.from(prop.split(':'));
    dict[key] = val;
  }
  return dict;
};

exports.connect = function(a, b) {
  if (a != null) {
    a.next = b;
  }
  if (b != null) {
    b.prev = a;
  }
  return b;
};

exports.string = function(arr) {
  let last = arr[0];
  for (let i = 0; i < arr.length; i++) {
    const el = arr[i];
    if (i > 0) {
      last = exports.connect(last, el);
    }
  }
  return last;
};

exports.deepCopy = (deepCopy = function(a) {
  if (a instanceof Array) {
    return a.map(el => deepCopy(el));
  } else if (a instanceof Object) {
    const newObject = {};

    for (let key in a) {
      const val = a[key];
      if (val instanceof Function) {
        newObject[key] = val;
      } else {
        newObject[key] = deepCopy(val);
      }
    }

    return newObject;

  } else {
    return a;
  }
});

exports.deepEquals = (deepEquals = function(a, b) {
  if (a instanceof Object && b instanceof Object) {
    let val;
    for (var key of Object.keys(a || {})) {
      val = a[key];
      if (!deepEquals(b[key], val)) {
        return false;
      }
    }

    for (key of Object.keys(b || {})) {
      val = b[key];
      if (!key in a) {
        if (!deepEquals(a[key], val)) {
          return false;
        }
      }
    }

    return true;
  } else {
    return a === b;
  }
});

let _guid = 0;
exports.generateGUID = () => (_guid++).toString(16);

// General quoted-string-fixing functionality, for use in various
// language modes' stringFixer functions.

// To fix quoting errors, we first do a lenient C-unescape, then
// we do a string C-escaping, to add backlsashes where needed, but
// not where we already have good ones.
exports.fixQuotedString = function(lines) {
  let line = lines[0];
  const quotechar = /^"|"$/.test(line) ? '"' : "'";
  if (line.charAt(0) === quotechar) {
    line = line.substr(1);
  }
  if (line.charAt(line.length - 1) === quotechar) {
    line = line.substr(0, line.length - 1);
  }
  return lines[0] = quoteAndCEscape(looseCUnescape(line), quotechar);
};

exports.looseCUnescape = (looseCUnescape = function(str) {
  const codes = {
    '\\b': '\b',
    '\\t': '\t',
    '\\n': '\n',
    '\\f': '\f',
    '\\"': '"',
    "\\'": "'",
    "\\\\": "\\",
    "\\0": "\0"
  };
  return str.replace(/\\[btnf'"\\0]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}/g, function(m) {
    if (m.length === 2) { return codes[m]; }
    return String.fromCharCode(parseInt(m.substr(1), 16));
  });
});

exports.quoteAndCEscape = (quoteAndCEscape = function(str, quotechar) {
  const result = JSON.stringify(str);
  if (quotechar === "'") {
    return quotechar +
      result.substr(1, result.length - 2).
             replace(/((?:^|[^\\])(?:\\\\)*)\\"/g, '$1"').
      replace(/'/g, "\\'") + quotechar;
  }
  return result;
});

// A naive dictionary mapping arbitrary objects to arbitrary objects, for use in
// ace-to-droplet session matching.
//
// May replace with something more sophisticated if performance becomes an issue,
// but we don't envision any use cases where sessions flip really fast, so this is unexpected.
exports.PairDict = (PairDict = class PairDict {
  constructor(pairs) {
    this.pairs = pairs;
  }

  get(index) {
    for (let i = 0; i < this.pairs.length; i++) {
      const el = this.pairs[i];
      if (el[0] === index) {
        return el[1];
      }
    }
  }

  contains(index) {
    return this.pairs.some(x => x[0] === index);
  }

  set(index, value) {
    for (let i = 0; i < this.pairs.length; i++) {
      const el = this.pairs[i];
      if (el[0] === index) {
        el[1] = index;
        return true;
      }
    }
    this.pairs.push([index, value]);
    return false;
  }
});

