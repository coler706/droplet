/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Copyright (c) 2014 Anthony Bau (dab1998@gmail.com)
// MIT License
//
// Minimalistic HTML5 canvas wrapper. Mainly used as conveneince tools in Droplet.

//# Private (convenience) functions
let _collinear, Draw, Point, Rectangle, Size;
const BEVEL_SIZE = 1.5;
const EPSILON = 0.00001;

const helper = require('./helper');
const { SVG_STANDARD } = helper;

// ## _area ##
// Signed area of the triangle formed by vectors [ab] and [ac]
const _area = (a, b, c) => ((b.x - a.x) * (c.y - a.y)) - ((c.x - a.x) * (b.y - a.y));

// ## _intersects ##
// Test the intersection of two line segments
const _intersects = (a, b, c, d) => ((_area(a, b, c) > 0) !== (_area(a, b, d) > 0)) && ((_area(c, d, a) > 0) !== (_area(c, d, b) > 0));

const _bisector = function(a, b, c, magnitude) {
  let sampleB;
  if (magnitude == null) { magnitude = 1; }
  if (a.equals(b) || b.equals(c)) {
    return null;
  }

  const sample = a.from(b).normalize();

  let diagonal = sample.plus(
    sampleB = c.from(b).normalize()
  );

  if (diagonal.almostEquals(ZERO)) {
    return null;
  } else if (sample.almostEquals(sampleB)) {
    return null;
  }

  diagonal = diagonal.normalize();

  const scalar = magnitude / Math.sqrt((1 - Math.pow(diagonal.dot(sample), 2)));

  diagonal.x *= scalar;
  diagonal.y *= scalar;

  if (_area(a, b, c) < 0) {
    diagonal.x *= -1;
    diagonal.y *= -1;
  }

  return diagonal;
};

const max = (a, b) => a > b ? a : b;
const min = (a, b) => b > a ? a : b;

const toRGB = function(hex) {
  // Convert to 6-char hex if not already there
  if (hex.length === 4) {
    hex = (Array.from(hex).map((c) => c + c)).join('').slice(1);
  }

  // Extract integers from hex
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return [r, g, b];
};

const zeroPad = function(str, len) {
  if (str.length < len) {
    return (__range__(str.length, len, false).map((i) => '0')).join('') + str;
  } else {
    return str;
  }
};

const twoDigitHex = n => zeroPad(Math.round(n).toString(16), 2);

const toHex = rgb => `#${(Array.from(rgb).map((k) => twoDigitHex(k))).join('')}`;

const memoizedAvgColor = {};

const avgColor = function(a, factor, b) {
  const c = (a + ',' + factor + ',' + b);
  if (c in memoizedAvgColor) {
    return memoizedAvgColor[c];
  }
  a = toRGB(a);
  b = toRGB(b);

  const newRGB = (Array.from(a).map((k, i) => (a[i] * factor) + (b[i] * (1 - factor))));

  return memoizedAvgColor[c] = toHex(newRGB);
};

exports.Draw = (Draw = class Draw {
  //# Public functions
  constructor(ctx) {
    let ElementWrapper, Group, NoRectangle, Path, Text;
    this.ctx = ctx;
    const canvas = document.createElement('canvas');
    this.measureCtx = canvas.getContext('2d');
    this.fontSize = 15;
    this.fontFamily = 'Courier New, monospace';
    this.fontAscent = -2;
    this.fontBaseline = 10;

    this.measureCtx.font = `${this.fontSize}px ${this.fontFamily}`;

    this.ctx.style.fontFamily = this.fontFamily;
    this.ctx.style.fontSize = this.fontSize;

    const self = this;

    // ## Point ##
    // A point knows its x and y coordinate, and can do some vector operations.
    this.Point = Point;

    // ## Size ##
    // A Size knows its width and height.
    this.Size = Size;

    // ## Rectangle ##
    // A Rectangle knows its upper-left corner, width, and height,
    // and can do rectangular overlap, polygonal intersection,
    // and rectangle or point union (point union is called "swallow").
    this.Rectangle = Rectangle;
    // ## NoRectangle ##
    // NoRectangle is an alternate constructor for Rectangle which starts
    // the rectangle as nothing (without even a location). It can gain location and size
    // via unite() and swallow().
    this.NoRectangle = (NoRectangle = class NoRectangle extends Rectangle {
      constructor() { super(null, null, 0, 0); }
    });

    // ## ElementWrapper ###
    this.ElementWrapper = (ElementWrapper = class ElementWrapper {
      constructor(element) {
        this.element = element;
        if (this.element != null) {
          this.element.style.display = 'none';
        }
        this.active = false;
        this.parent = (this.element != null ? this.element.parentElement : undefined) != null ? (this.element != null ? this.element.parentElement : undefined) : self.ctx;
      }

      manifest() {
        if (this.element == null) {
          this.element = this.makeElement();
          this.getParentElement().appendChild(this.element);

          if (!this.active) {
            return this.element.style.display = 'none';
          }
        } else if (this.element.parentElement == null) {
          return this.getParentElement().appendChild(this.element);
        }
      }

      deactivate() {
        if (this.active) {
          this.active = false;
          return __guard__(this.element != null ? this.element.style : undefined, x => x.display = 'none');
        }
      }

      activate() {
        this.manifest();
        if (!this.active) {
          this.active = true;
          return __guard__(this.element != null ? this.element.style : undefined, x => x.display = '');
        }
      }

      focus() {
        this.activate();
        return this.getParentElement().appendChild(this.element);
      }

      getParentElement() {
        if (this.parent instanceof ElementWrapper) {
          this.parent.manifest();
          return this.parent.element;
        } else {
          return this.parent;
        }
      }

      setParent(parent) {
        this.parent = parent;

        if (this.element != null) {
          parent = this.getParentElement();
          if (parent !== this.element.parentElement) {
            return parent.appendChild(this.element);
          }
        }
      }

      destroy() {
        if (this.element != null) {
          if (this.element.parentElement != null) {
            return this.element.parentElement.removeChild(this.element);
          }
        }
      }
    });

    this.Group = (Group = class Group extends ElementWrapper {
      constructor() {
        super();
      }

      makeElement() {
        return document.createElementNS(SVG_STANDARD, 'g');
      }
    });

    // ## Path ##
    // This is called Path, but is forced to be closed so is actually a polygon.
    // It can do fast translation and rectangular intersection.
    this.Path = (Path = class Path extends ElementWrapper {
      constructor(_points, bevel, style) {
        {
          // Hack: trick Babel/TypeScript into allowing this before super.
          if (false) { super(); }
          let thisFn = (() => { return this; }).toString();
          let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
          eval(`${thisName} = this;`);
        }
        if (_points == null) { _points = []; }
        this._points = _points;
        if (bevel == null) { bevel = false; }
        this.bevel = bevel;
        this.style = style;
        this._cachedTranslation = new Point(0, 0);
        this._cacheFlag = true;
        this._bounds = new NoRectangle();

        this._clearCache();

        this.style = helper.extend({
          'strokeColor': 'none',
          'lineWidth': 1,
          'fillColor': 'none',
          'dotted': ''
        }, this.style);

        super();
      }

      _clearCache() {
        if (this._cacheFlag) {
          // If we have no points, return the empty rectangle
          // as our bounding box
          if (this._points.length === 0) {
            this._bounds = new NoRectangle();
            return this._lightBevelPath = (this._darkBevelPath = '');

          // Otherwise, find our bounding box based
          // on our points.
          } else {
            // Bounds
            let i, insetCoord, maxY, minY;
            let minX = (minY = Infinity);
            let maxX = (maxY = 0);
            for (var point of Array.from(this._points)) {
              minX = min(minX, point.x);
              maxX = max(maxX, point.x);

              minY = min(minY, point.y);
              maxY = max(maxY, point.y);
            }

            this._bounds.x = minX; this._bounds.y = minY;
            this._bounds.width = maxX - minX; this._bounds.height = maxY - minY;

            // Light bevels
            let subpaths = [];
            let outsidePoints = [];
            let insidePoints = [];
            const iterable = this._points.slice(1);
            for (i = 0; i < iterable.length; i++) {
              point = iterable[i];
              if (((point.x > this._points[i].x) && (point.y <= this._points[i].y)) ||
                 ((point.y < this._points[i].y) && (point.x >= this._points[i].x))) {
                if (outsidePoints.length === 0) {
                  insetCoord = this.getInsetCoordinate(i, BEVEL_SIZE);
                  if (insetCoord != null) {
                    outsidePoints.push(this._points[i]);
                    insidePoints.push(insetCoord);
                  }
                }
                insetCoord = this.getInsetCoordinate(i + 1, BEVEL_SIZE);
                if (insetCoord != null) {
                  outsidePoints.push(point);
                  insidePoints.push(insetCoord);
                }
              } else if (!point.equals(this._points[i]) && (outsidePoints.length !== 0)) {
                subpaths.push(
                  `M${outsidePoints.concat(insidePoints.reverse()).map(point => `${point.x} ${point.y}`).join(" L")} Z`
                );
                outsidePoints.length = (insidePoints.length = 0);
              }
            }

            if ((this._points[0].x > this._points[this._points.length - 1].x) ||
                (this._points[0].y < this._points[this._points.length - 1].y)) {
              if (outsidePoints.length === 0) {
                insetCoord = this.getInsetCoordinate(this._points.length - 1, BEVEL_SIZE);
                if (insetCoord != null) {
                  outsidePoints.push(this._points[this._points.length - 1]);
                  insidePoints.push(insetCoord);
                }
              }
              insetCoord = this.getInsetCoordinate(0, BEVEL_SIZE);
              if (insetCoord != null) {
                outsidePoints.push(this._points[0]);
                insidePoints.push(insetCoord);
              }
            }

            if (outsidePoints.length > 0) {
              subpaths.push(
                `M${outsidePoints.concat(insidePoints.reverse()).map(point => `${point.x} ${point.y}`).join(" L")} Z`
              );
            }

            this._lightBevelPath = subpaths.join(' ');

            // Dark bevels
            subpaths = [];
            outsidePoints = [];
            insidePoints = [];
            const iterable1 = this._points.slice(1);
            for (i = 0; i < iterable1.length; i++) {
              point = iterable1[i];
              if (((point.x < this._points[i].x) && (point.y >= this._points[i].y)) ||
                 ((point.y > this._points[i].y) && (point.x <= this._points[i].x))) {
                if (outsidePoints.length === 0) {
                  insetCoord = this.getInsetCoordinate(i, BEVEL_SIZE);
                  if (insetCoord != null) {
                    outsidePoints.push(this._points[i]);
                    insidePoints.push(insetCoord);
                  }
                }

                insetCoord = this.getInsetCoordinate(i + 1, BEVEL_SIZE);
                if (insetCoord != null) {
                  outsidePoints.push(point);
                  insidePoints.push(insetCoord);
                }
              } else if (!point.equals(this._points[i]) && (outsidePoints.length !== 0)) {
                subpaths.push(
                  `M${outsidePoints.concat(insidePoints.reverse()).map(point => `${point.x} ${point.y}`).join(" L")} Z`
                );
                outsidePoints.length = (insidePoints.length = 0);
              }
            }

            if ((this._points[0].x < this._points[this._points.length - 1].x) ||
                (this._points[0].y > this._points[this._points.length - 1].y)) {
              if (outsidePoints.length === 0) {
                insetCoord = this.getInsetCoordinate(this._points.length - 1, BEVEL_SIZE);
                if (insetCoord != null) {
                  outsidePoints.push(this._points[this._points.length - 1]);
                  insidePoints.push(insetCoord);
                }
              }
              insetCoord = this.getInsetCoordinate(0, BEVEL_SIZE);
              if (insetCoord != null) {
                outsidePoints.push(this._points[0]);
                insidePoints.push(insetCoord);
              }
            }

            if (outsidePoints.length > 0) {
              subpaths.push(
                `M${outsidePoints.concat(insidePoints.reverse()).map(point => `${point.x} ${point.y}`).join(" L")} Z`
              );
            }

            this._darkBevelPath = subpaths.join(' ');

            return this._cacheFlag = false;
          }
        }
      }

      _setPoints_raw(points) {
        this._points = points;
        this._cacheFlag = true;
        return this._updateFlag = true;
      }

      setMarkStyle(style) {
        if ((style != null) && (style.color !== (this.markColor != null))) {
          this.markColor = style.color;
          return this._markFlag = true;
        } else if (this.markColor != null) {
          this.markColor = null;
          return this._markFlag = true;
        }
      }

      setPoints(points) {
        if (points.length !== this._points.length) {
          this._setPoints_raw(points);
          return;
        }
        for (let i = 0; i < points.length; i++) {
          const el = points[i];
          if (!this._points[i].equals(el)) {
            this._setPoints_raw(points);
            return;
          }
        }
      }

      push(point) {
        this._points.push(point);
        this._cacheFlag = true;
        return this._updateFlag = true;
      }

      unshift(point) {
        this._points.unshift(point);
        this._cacheFlag = true;
        return this._updateFlag = true;
      }

      reverse() {
        this._points.reverse();
        return this;
      }

      // ### Point containment ###
      // Accomplished with ray-casting
      contains(point) {
        this._clearCache();

        if (this._points.length === 0) { return false; }

        if (!this._bounds.contains(point)) { return false; }

        // "Ray" to the left
        const dest = new Point(this._bounds.x - 10, point.y);

        // Count intersections
        let count = 0;
        let last = this._points[this._points.length - 1];
        for (let end of Array.from(this._points)) {
          if (_intersects(last, end, point, dest)) { count += 1; }
          last = end;
        }

        return (count % 2) === 1;
      }

      equals(other) {
        if (!(other instanceof Path)) {
          return false;
        }
        if (other._points.length !== this._points.length) {
          return false;
        }
        for (let i = 0; i < other._points.length; i++) {
          const el = other._points[i];
          if (!this._points[i].equals(el)) {
            return false;
          }
        }
        return true;
      }

      // ### Rectangular intersection ###
      // Succeeds if any edges intersect or either shape is
      // entirely within the other.
      intersects(rectangle) {
        this._clearCache();

        if (this._points.length === 0) { return false; }

        if (!rectangle.overlap(this._bounds)) { return false;
        } else {
          // Try each pair of edges for intersections
          let last = this._points[this._points.length - 1];
          const rectSides = [
            new Point(rectangle.x, rectangle.y),
            new Point(rectangle.right(), rectangle.y),
            new Point(rectangle.right(), rectangle.bottom()),
            new Point(rectangle.x, rectangle.bottom())
          ];
          for (let end of Array.from(this._points)) {
            let lastSide = rectSides[rectSides.length - 1];
            for (let side of Array.from(rectSides)) {
              if (_intersects(last, end, lastSide, side)) { return true; }
              lastSide = side;
            }
            last = end;
          }

          // Intersections failed; see if we contain the rectangle.
          // Note that if we contain the rectangle we must contain all of its vertices,
          // so it suffices to test one vertex.
          if (this.contains(rectSides[0])) { return true; }

          // We don't contain the rectangle; see if it contains us.
          if (rectangle.contains(this._points[0])) { return true; }

          // No luck
          return false;
        }
      }

      bounds() { this._clearCache(); return this._bounds; }

      translate(vector) {
        this._cachedTranslation.translate(vector);
        return this._cacheFlag = true;
      }

      getCommandString() {
        if (this._points.length === 0) {
          return '';
        }

        const pathCommands = [];

        pathCommands.push(`M${Math.round(this._points[0].x)} ${Math.round(this._points[0].y)}`);
        for (let point of Array.from(this._points)) {
          pathCommands.push(`L${Math.round(point.x)} ${Math.round(point.y)}`);
        }
        pathCommands.push(`L${Math.round(this._points[0].x)} ${Math.round(this._points[0].y)}`);
        pathCommands.push("Z");
        return pathCommands.join(' ');
      }

      getInsetCoordinate(i, length) {
        let j = i; let prev = this._points[i];
        while (prev.equals(this._points[i]) && (j > (i - this._points.length))) {
          j--;
          prev = this._points[__mod__(j, this._points.length)];
        }

        let k = i; let next = this._points[i];
        while (next.equals(this._points[i]) && (k < (i + this._points.length))) {
          k++;
          next = this._points[__mod__(k, this._points.length)];
        }

        const vector = _bisector(prev, this._points[i], next, length);
        if (vector == null) { return null; }

        const point = this._points[i].plus(vector);

        return point;
      }

      getLightBevelPath() { this._clearCache(); return this._lightBevelPath; }
      getDarkBevelPath() {
        this._clearCache();
        return this._darkBevelPath;
      }

      // TODO unhackify
      makeElement() {
        this._clearCache();

        let pathElement = document.createElementNS(SVG_STANDARD, 'path');

        if (this.style.fillColor != null) {
          pathElement.setAttribute('fill', this.style.fillColor);
        }

        this.__lastFillColor = this.style.fillColor;
        this.__lastStrokeColor = this.style.strokeColor;
        this.__lastLineWidth = this.style.lineWidth;
        this.__lastDotted = this.style.dotted;
        this.__lastCssClass = this.style.cssClass;
        this.__lastTransform = this.style.transform;

        const pathString = this.getCommandString();

        if (pathString.length > 0) {
          pathElement.setAttribute('d', pathString);
        }

        if (this.bevel) {
          this.backgroundPathElement = pathElement;
          this.backgroundPathElement.setAttribute('class', 'droplet-background-path');
          pathElement = document.createElementNS(SVG_STANDARD, 'g');

          this.lightPathElement = document.createElementNS(SVG_STANDARD, 'path');
          this.lightPathElement.setAttribute('fill', avgColor(this.style.fillColor, 0.7, '#FFF'));
          if (pathString.length > 0) {
            this.lightPathElement.setAttribute('d', this.getLightBevelPath());
          }
          this.lightPathElement.setAttribute('class', 'droplet-light-bevel-path');

          this.darkPathElement = document.createElementNS(SVG_STANDARD, 'path');
          this.darkPathElement.setAttribute('fill', avgColor(this.style.fillColor, 0.7, '#000'));
          if (pathString.length > 0) {
            this.darkPathElement.setAttribute('d', this.getDarkBevelPath());
          }
          this.darkPathElement.setAttribute('class', 'droplet-dark-bevel-path');

          pathElement.appendChild(this.backgroundPathElement);
          pathElement.appendChild(this.lightPathElement);
          pathElement.appendChild(this.darkPathElement);
        } else {
          pathElement.setAttribute('stroke', this.style.strokeColor);
          pathElement.setAttribute('stroke-width', this.style.lineWidth);
          if (((this.style.dotted != null ? this.style.dotted.length : undefined) != null ? (this.style.dotted != null ? this.style.dotted.length : undefined) : 0) > 0) {
            pathElement.setAttribute('stroke-dasharray', this.style.dotted);
          }
        }

        if (this.style.cssClass != null) {
          pathElement.setAttribute('class', this.style.cssClass);
        }

        if (this.style.transform != null) {
          pathElement.setAttribute('transform', this.style.transform);
        }

        return pathElement;
      }

      update() {
        if (this.element == null) { return; }
        if (this.style.fillColor !== this.__lastFillColor) {
          this.__lastFillColor = this.style.fillColor;

          if (this.bevel) {
            this.backgroundPathElement.setAttribute('fill', this.style.fillColor);
            this.lightPathElement.setAttribute('fill', avgColor(this.style.fillColor, 0.7, '#FFF'));
            this.darkPathElement.setAttribute('fill', avgColor(this.style.fillColor, 0.7, '#000'));
          } else {
            this.element.setAttribute('fill', this.style.fillColor);
          }
        }

        if (!this.bevel && (this.style.strokeColor !== this.__lastStrokeColor)) {
          this.__lastStrokeColor = this.style.strokeColor;
          this.element.setAttribute('stroke', this.style.strokeColor);
        }

        if (!this.bevel && (this.style.dotted !== this.__lastDotted)) {
          this.__lastDotted = this.style.dotted;
          this.element.setAttribute('stroke-dasharray', this.style.dotted);
        }

        if (!this.bevel && (this.style.lineWidth !== this.__lastLineWidth)) {
          this.__lastLineWidth = this.style.lineWidth;
          this.element.setAttribute('stroke-width', this.style.lineWidth);
        }

        if ((this.style.cssClass != null) && (this.style.cssClass !== this._lastCssClass)) {
          this._lastCssClass = this.style.cssClass;
          this.element.setAttribute('class', this.style.cssClass);
        }

        if ((this.style.transform != null) && (this.style.transform !== this._lastTransform)) {
          this._lastTransform = this.style.transform;
          this.element.setAttribute('transform', this.style.transform);
        }

        if (this._markFlag) {
          if (this.markColor != null) {
            if (this.bevel) {
              this.backgroundPathElement.setAttribute('stroke', this.markColor);
              this.backgroundPathElement.setAttribute('stroke-width', '2');
              this.lightPathElement.setAttribute('visibility', 'hidden');
              this.darkPathElement.setAttribute('visibility', 'hidden');
            } else {
              this.element.setAttribute('stroke', this.markColor);
              this.element.setAttribute('stroke-width', '2');
            }
          } else {
            if (this.bevel) {
              this.backgroundPathElement.setAttribute('stroke', 'none');
              this.lightPathElement.setAttribute('visibility', 'visible');
              this.darkPathElement.setAttribute('visibility', 'visible');
            } else {
              this.element.setAttribute('stroke', this.style.strokeColor);
              this.backgroundPathElement.setAttribute('line-width', this.style.lineWidth);
            }
          }
        }

        if (this._updateFlag) {
          this._updateFlag = false;
          const pathString = this.getCommandString();
          if (pathString.length > 0) {
            if (this.bevel) {
              this.backgroundPathElement.setAttribute('d', pathString);
              this.lightPathElement.setAttribute('d', this.getLightBevelPath());
              return this.darkPathElement.setAttribute('d', this.getDarkBevelPath());
            } else {
              return this.element.setAttribute('d', pathString);
            }
          }
        }
      }

      clone() {
        const clone = new Path(this._points.slice(0), this.bevel, {
          lineWidth: this.style.lineWidth,
          fillColor: this.style.fillColor,
          strokeColor: this.style.strokeColor,
          dotted: this.style.dotted,
          cssClass: this.style.cssClass
        });
        clone._clearCache();
        clone.update();
        return clone;
      }
    });

    // ## Text ##
    // A Text element. Mainly this exists for computing bounding boxes, which is
    // accomplished via ctx.measureText().
    this.Text = (Text = class Text extends ElementWrapper {
      constructor(point, value) {
        {
          // Hack: trick Babel/TypeScript into allowing this before super.
          if (false) { super(); }
          let thisFn = (() => { return this; }).toString();
          let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
          eval(`${thisName} = this;`);
        }
        this.point = point;
        this.value = value;
        this.__lastValue = this.value;
        this.__lastPoint = this.point.clone();

        this._bounds = new Rectangle(this.point.x, this.point.y, self.measureCtx.measureText(this.value).width, self.fontSize);

        super();
      }

      clone() { return new Text(this.point, this.value); }
      equals(other) { return (other != null) && this.point.equals(other.point) && (this.value === other.value); }

      bounds() { return this._bounds; }
      contains(point) { return this._bounds.contains(point); }

      setPosition(point) { return this.translate(point.from(this.point)); }

      makeElement() {
        const element = document.createElementNS(SVG_STANDARD, 'text');
        //element.setAttribute 'fill', '#444'

        // We use the alphabetic baseline and add the distance
        // to base ourselves to avoid a chrome bug where text zooming
        // doesn't work for non-alphabetic baselines
        element.setAttribute('x', this.point.x);
        element.setAttribute('y', (this.point.y + self.fontBaseline) - (self.fontAscent / 2));
        element.setAttribute('dominant-baseline', 'alphabetic');

        //element.setAttribute 'font-family', self.fontFamily
        //element.setAttribute 'font-size', self.fontSize

        const text = document.createTextNode(this.value.replace(/ /g, '\u00A0')); // Preserve whitespace
        element.appendChild(text);

        return element;
      }

      update() {
        if (this.element == null) { return; }
        if (!this.point.equals(this.__lastPoint)) {
          this.__lastPoint = this.point.clone();
          this.element.setAttribute('x', this.point.x);
          this.element.setAttribute('y', (this.point.y + self.fontBaseline) - (self.fontAscent / 2));
        }

        if (this.value !== this.__lastValue) {
          this.__lastValue = this.value;
          this.element.removeChild(this.element.lastChild);
          const text = document.createTextNode(this.value.replace(/ /g, '\u00A0'));
          return this.element.appendChild(text);
        }
      }
    });
  }

  refreshFontCapital() {
    const metrics = helper.fontMetrics(this.fontFamily, this.fontSize);
    this.fontAscent = metrics.prettytop;
    return this.fontBaseline = metrics.baseline;
  }

  setGlobalFontSize(size) {
    this.fontSize = size;
    this.ctx.style.fontSize = size;
    this.measureCtx.font = `${this.fontSize}px ${this.fontFamily}`;
    return this.refreshFontCapital();
  }

  setGlobalFontFamily(family) {
    this.fontFamily = family;
    this.ctx.style.fontFamily = family;
    this.measureCtx.font = `${this.fontSize}px ${this.fontFamily}`;
    return this.refreshFontCapital();
  }

  getGlobalFontSize() { return this.fontSize; }
});

exports.Point = (Point = class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  clone() { return new Point(this.x, this.y); }

  magnitude() { return Math.sqrt((this.x * this.x) + (this.y * this.y)); }

  times(scalar) { return new Point(this.x * scalar, this.y * scalar); }

  normalize() { return this.times(1 / this.magnitude()); }

  translate(vector) {
    this.x += vector.x; return this.y += vector.y;
  }

  add(x, y) { this.x += x; return this.y += y; }

  dot(other) { return (this.x * other.x) + (this.y * other.y); }

  plus({x, y}) { return new Point(this.x + x, this.y + y); }

  toMagnitude(mag) {
    const r = mag / this.magnitude();
    return new Point(this.x * r, this.y * r);
  }

  copy(point) {
    this.x = point.x; this.y = point.y;
    return this;
  }

  from(point) { return new Point(this.x - point.x, this.y - point.y); }

  clear() { return this.x = (this.y = 0); }

  equals(point) { return (point.x === this.x) && (point.y === this.y); }

  almostEquals(point) {
    return (Math.abs(point.x - this.x) < EPSILON) &&
    (Math.abs(point.y - this.y) < EPSILON);
  }
});

var ZERO = new Point(0, 0);

exports.Size = (Size = class Size {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }
  equals(size) {
    return (this.width === size.width) && (this.height === size.height);
  }
  static copy(size) {
    return new Size(size.width, size.height);
  }
});

exports.Rectangle = (Rectangle = class Rectangle {
      constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
      }

      contains(point) { return (this.x != null) && (this.y != null) && !((point.x < this.x) || (point.x > (this.x + this.width)) || (point.y < this.y) || (point.y > (this.y + this.height))); }

      equals(other) {
        if (!(other instanceof Rectangle)) {
          return false;
        }
        return (this.x === other.x) &&
        (this.y === other.y) &&
        (this.width === other.width) &&
        (this.height === other.height);
      }

      copy(rect) {
        this.x = rect.x; this.y = rect.y;
        this.width = rect.width; this.height = rect.height;
        return this;
      }

      clone() {
        const rect = new Rectangle(0, 0, 0, 0);
        rect.copy(this);
        return rect;
      }

      clear() { this.width = (this.height = 0); return this.x = (this.y = null); }

      bottom() { return this.y + this.height; }
      right() { return this.x + this.width; }

      unite(rectangle) {
        if ((this.x == null) || (this.y == null)) { return this.copy(rectangle);
        } else if ((rectangle.x == null) || (rectangle.y == null)) { return;
        } else {
          this.width = max(this.right(), rectangle.right()) - (this.x = min(this.x, rectangle.x));
          return this.height = max(this.bottom(), rectangle.bottom()) - (this.y = min(this.y, rectangle.y));
        }
      }

      swallow(point) {
        if ((this.x == null) || (this.y == null)) { return this.copy(new Rectangle(point.x, point.y, 0, 0));
        } else {
          this.width = max(this.right(), point.x) - (this.x = min(this.x, point.x));
          return this.height = max(this.bottom(), point.y) - (this.y = min(this.y, point.y));
        }
      }

      overlap(rectangle) { return (this.x != null) && (this.y != null) && !(((rectangle.right()) < this.x) || (rectangle.bottom() < this.y) || (rectangle.x > this.right()) || (rectangle.y > this.bottom())); }

      translate(vector) {
        this.x += vector.x; return this.y += vector.y;
      }

      upperLeftCorner() { return new Point(this.x, this.y); }

      toPath() {
        const path = new Path();
        for (let point of ([
          [this.x, this.y],
          [this.x, this.bottom()],
          [this.right(), this.bottom()],
          [this.right(), this.y]
        ])) { path.push(new Point(point[0], point[1])); }
        return path;
      }
    });

exports._collinear = (_collinear = function(a, b, c) {
  const first = b.from(a).normalize();
  const second = c.from(b).normalize();
  return first.almostEquals(second) || first.almostEquals(second.times(-1));
});

function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}
function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
function __mod__(a, b) {
  a = +a;
  b = +b;
  return (a % b + b) % b;
}