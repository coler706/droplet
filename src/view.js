/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS202: Simplify dynamic range loops
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Droplet editor view.
//
// Copyright (c) 2015 Anthony Bau (dab1998@gmail.com)
// MIT License

let View;
const helper = require('./helper');
const draw = require('./draw');
const model = require('./model');

const NO_MULTILINE = 0;
const MULTILINE_START = 1;
const MULTILINE_MIDDLE = 2;
const MULTILINE_END = 3;
const MULTILINE_END_START = 4;

const { ANY_DROP } = helper;
const { BLOCK_ONLY } = helper;
const { MOSTLY_BLOCK } = helper;
const { MOSTLY_VALUE } = helper;
const { VALUE_ONLY } = helper;

const CARRIAGE_ARROW_SIDEALONG = 0;
const CARRIAGE_ARROW_INDENT = 1;
const CARRIAGE_ARROW_NONE = 2;
const CARRIAGE_GROW_DOWN = 3;

const DROPDOWN_ARROW_HEIGHT = 8;

const DROP_TRIANGLE_COLOR = '#555';
const { SVG_STANDARD } = helper;

const DEFAULT_OPTIONS = {
  buttonWidth: 15,
  buttonHeight: 15,
  buttonPadding: 6,
  minIndentTongueWidth: 150,
  showDropdowns: true,
  padding: 5,
  indentWidth: 20,
  indentTongueHeight: 20,
  tabOffset: 10,
  tabWidth: 15,
  tabHeight: 5,
  tabSideWidth: 0.125,
  dropAreaHeight: 20,
  indentDropAreaMinWidth: 50,
  minSocketWidth: 10,
  invisibleSocketWidth: 5,
  textHeight: 15,
  textPadding: 1,
  emptyLineWidth: 50,
  highlightAreaHeight: 10,
  bevelClip: 3,
  shadowBlur: 5,
  colors: {
    error: '#ff0000',
    comment: '#c0c0c0',  // gray
    return: '#fff59d',   // yellow
    control: '#ffcc80',  // orange
    value: '#a5d6a7',    // green
    command: '#90caf9',  // blue
    red: '#ef9a9a',
    pink: '#f48fb1',
    purple: '#ce93d8',
    deeppurple: '#b39ddb',
    indigo: '#9fa8da',
    blue: '#90caf9',
    lightblue: '#81d4fa',
    cyan: '#80deea',
    teal: '#80cbc4',
    green: '#a5d6a7',
    lightgreen: '#c5e1a5',
    lime: '#e6ee9c',
    yellow: '#fff59d',
    amber: '#ffe082',
    orange: '#ffcc80',
    deeporange: '#ffab91',
    brown: '#bcaaa4',
    grey: '#eeeeee',
    bluegrey: '#b0bec5'
  }
};

const YES = () => true;
const NO = () => false;

const arrayEq = function(a, b) {
  if (a.length !== b.length) { return false; }
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k !== b[i]) {
      return false;
    }
  }
  return true;
};

// # View
// The View class contains options and caches
// for rendering. The controller instantiates a View
// and interacts with things through it.
//
// Inner classes in the View correspond to Model
// types (e.g. SocketViewNode, etc.) all of which
// will have access to their View's caches
// and options object.
exports.View = (View = (function() {
  let AuxiliaryViewNode = undefined;
  let GenericViewNode = undefined;
  let ListViewNode = undefined;
  let ContainerViewNode = undefined;
  let BlockViewNode = undefined;
  let SocketViewNode = undefined;
  let IndentViewNode = undefined;
  let DocumentViewNode = undefined;
  let TextViewNode = undefined;
  View = class View {
    static initClass() {
  
      AuxiliaryViewNode = class AuxiliaryViewNode {
        constructor(view, model1) {
          this.view = view;
          this.model = model1;
          this.children = {};
          this.computedVersion = -1;
        }
  
        cleanup() {
          let child;
          this.view.unflag(this);
  
          if (this.model.version === this.computedVersion) {
            return;
          }
  
          const children = {};
          if (this.model instanceof model.Container) {
            this.model.traverseOneLevel(head => {
              if (head instanceof model.NewlineToken) {
                return;
              } else {
                return children[head.id] = this.view.getAuxiliaryNode(head);
              }
            });
          }
  
          for (var id in this.children) {
            child = this.children[id];
            if (!(id in children)) {
              this.view.flag(child);
            }
          }
  
          return (() => {
            const result = [];
            for (id in children) {
              child = children[id];
              this.children[id] = child;
              result.push(child.cleanup());
            }
            return result;
          })();
        }
  
        update() {
          this.view.unflag(this);
  
          if (this.model.version === this.computedVersion) {
            return;
          }
  
          const children = {};
          if (this.model instanceof model.Container) {
            this.model.traverseOneLevel(head => {
              if (head instanceof model.NewlineToken) {
                return;
              } else {
                return children[head.id] = this.view.getAuxiliaryNode(head);
              }
            });
          }
  
          this.children = children;
  
          for (let id in this.children) {
            const child = this.children[id];
            child.update();
          }
  
          return this.computedVersion = this.model.version;
        }
      };
  
      // # GenericViewNode
      // Class from which all renderer classes will
      // extend.
      GenericViewNode = class GenericViewNode {
        constructor(model1, view) {
          // Record ourselves in the map
          // from model to renderer
          this.model = model1;
          this.view = view;
          this.view.map[this.model.id] = this;
  
          this.view.registerRoot(this.model);
  
          this.lastCoordinate = new this.view.draw.Point(0, 0);
  
          this.invalidate = false;
  
          // *Zeroth pass variables*
          // computeChildren
          this.lineLength = 0; // How many lines does this take up?
          this.children = []; // All children, flat
          this.oldChildren = []; // Previous children, for removing
          this.lineChildren = []; // Children who own each line
          this.multilineChildrenData = []; // Where do indents start/end?
  
          // *First pass variables*
          // computeMargins
          this.margins = {left:0, right:0, top:0, bottom:0};
          this.topLineSticksToBottom = false;
          this.bottomLineSticksToTop = false;
  
          // *Pre-second pass variables*
          // computeMinDimensions
          // @view.draw.Size type, {width:n, height:m}
          this.minDimensions = []; // Dimensions on each line
          this.minDistanceToBase = []; // {above:n, below:n}
  
          // *Second pass variables*
          // computeDimensions
          // @view.draw.Size type, {width:n, height:m}
          this.dimensions = []; // Dimensions on each line
          this.distanceToBase = []; // {above:n, below:n}
  
          this.carriageArrow = CARRIAGE_ARROW_NONE;
  
          this.bevels = {
            top: false,
            bottom: false
          };
  
          // *Third/fifth pass variables*
          // computeBoundingBoxX, computeBoundingBoxY
          // @view.draw.Rectangle type, {x:0, y:0, width:200, height:100}
          this.bounds = []; // Bounding boxes on each line
          this.changedBoundingBox = true; // Did any bounding boxes change just now?
  
          // *Fourth pass variables*
          // computeGlue
          // {height:2, draw:true}
          this.glue = {};
  
          this.elements = [];
          this.activeElements = [];
  
          // Versions. The corresponding
          // Model will keep corresponding version
          // numbers, and each of our passes can
          // become a no-op when we are up-to-date (so
          // that rerendering is fast when there are
          // few or no changes to the Model).
          this.computedVersion = -1;
        }
  
        draw(boundingRect, style, parent = null) {
          if (style == null) { style = {}; }
          return this.drawSelf(style, parent);
        }
  
        root() {
          return Array.from(this.elements).map((element) =>
            element.setParent(this.view.draw.ctx));
        }
  
        serialize(line) {
          let child, i;
          const result = [];
          for (var prop of [
              'lineLength',
              'margins',
              'topLineSticksToBottom',
              'bottomLineSticksToTop',
              'changedBoundingBox',
              'path',
              'highlightArea',
              'computedVersion',
              'carriageArrow',
              'bevels']) {
            result.push(prop + ': ' + JSON.stringify(this[prop]));
          }
          for (i = 0; i < this.children.length; i++) {
            child = this.children[i];
            result.push(`child ${i}: {startLine: ${child.startLine}, ` +
                        `endLine: ${child.endLine}}`);
          }
          if (line != null) {
            for (prop of [
                'multilineChildrenData',
                'minDimensions',
                'minDistanceToBase',
                'dimensions',
                'distanceToBase',
                'bounds',
                'glue']) {
              result.push(`${prop} ${line}: ${JSON.stringify(this[prop][line])}`);
            }
            for (i = 0; i < this.lineChildren[line].length; i++) {
              child = this.lineChildren[line][i];
              result.push(`line ${line} child ${i}: ` +
                          `{startLine: ${child.startLine}, ` +
                          `endLine: ${child.endLine}}}`);
            }
          } else {
            let asc, end;
            for (line = 0, end = this.lineLength, asc = 0 <= end; asc ? line < end : line > end; asc ? line++ : line--) {
              for (prop of [
                  'multilineChildrenData',
                  'minDimensions',
                  'minDistanceToBase',
                  'dimensions',
                  'distanceToBase',
                  'bounds',
                  'glue']) {
                result.push(`${prop} ${line}: ${JSON.stringify(this[prop][line])}`);
              }
              for (i = 0; i < this.lineChildren[line].length; i++) {
                child = this.lineChildren[line][i];
                result.push(`line ${line} child ${i}: ` +
                            `{startLine: ${child.startLine}, ` +
                            `endLine: ${child.endLine}}}`);
              }
            }
          }
  
          return result.join('\n');
        }
  
        // ## computeChildren (GenericViewNode)
        // Find out which of our children lie on each line that we
        // own, and also how many lines we own.
        //
        // Return the number of lines we own.
        //
        // This is basically a void computeChildren that should be
        // overridden.
        computeChildren() { return this.lineLength; }
  
        focusAll() {
          return this.group.focus();
        }
  
        computeCarriageArrow() {
          for (let childObj of Array.from(this.children)) {
            this.view.getViewNodeFor(childObj.child).computeCarriageArrow();
          }
  
          return this.carriageArrow;
        }
  
        // ## computeMargins (GenericViewNode)
        // Compute the amount of margin required outside the child
        // on the top, bottom, left, and right.
        //
        // This is a void computeMargins that should be overridden.
        computeMargins() {
          if ((this.computedVersion === this.model.version) &&
             ((this.model.parent == null) || !this.view.hasViewNodeFor(this.model.parent) ||
             (this.model.parent.version === this.view.getViewNodeFor(this.model.parent).computedVersion))) {
            return this.margins;
          }
  
          // the margins I need depend on the type of my parent
          const parenttype = this.model.parent != null ? this.model.parent.type : undefined;
          const { padding } = this.view.opts;
  
          const left = this.model.isFirstOnLine() || (this.lineLength > 1) ? padding : 0;
          const right = this.model.isLastOnLine() || (this.lineLength > 1) ? padding : 0;
  
          if ((parenttype === 'block') && (this.model.type === 'indent')) {
            this.margins = {
              top: 0,
              bottom: this.lineLength > 1 ? this.view.opts.indentTongueHeight : padding,
  
              firstLeft: 0,
              midLeft: this.view.opts.indentWidth,
              lastLeft: this.view.opts.indentWidth,
  
              firstRight: 0,
              midRight: 0,
              lastRight: padding
            };
  
          } else if ((this.model.type === 'text') && (parenttype === 'socket')) {
            this.margins = {
              top: this.view.opts.textPadding,
              bottom: this.view.opts.textPadding,
  
              firstLeft: this.view.opts.textPadding,
              midLeft: this.view.opts.textPadding,
              lastLeft: this.view.opts.textPadding,
  
              firstRight: this.view.opts.textPadding,
              midRight: this.view.opts.textPadding,
              lastRight: this.view.opts.textPadding
            };
  
          } else if ((this.model.type === 'text') && (parenttype === 'block')) {
            let textPadding;
            if ((((this.model.prev != null ? this.model.prev.type : undefined) === 'newline') && ['newline', 'indentStart'].includes(this.model.next != null ? this.model.next.type : undefined)) || (__guard__(this.model.prev != null ? this.model.prev.prev : undefined, x => x.type) === 'indentEnd')) {
              textPadding = padding / 2;
            } else {
              textPadding = padding;
            }
            this.margins = {
              top: textPadding,
              bottom: textPadding, //padding
  
              firstLeft: left,
              midLeft: left,
              lastLeft: left,
  
              firstRight: right,
              midRight: right,
              lastRight: right
            };
  
          } else if (parenttype === 'block') {
            this.margins = {
              top: padding,
              bottom: padding,
  
              firstLeft: left,
              midLeft: padding,
              lastLeft: padding,
  
              firstRight: right,
              midRight: 0,
              lastRight: right
            };
          } else {
            this.margins = {
              firstLeft: 0, midLeft:0, lastLeft: 0,
              firstRight: 0, midRight:0, lastRight: 0,
              top:0, bottom:0
            };
          }
  
          this.firstMargins = {
            left: this.margins.firstLeft,
            right: this.margins.firstRight,
            top: this.margins.top,
            bottom: this.lineLength === 1 ? this.margins.bottom : 0
          };
  
          this.midMargins = {
            left: this.margins.midLeft,
            right: this.margins.midRight,
            top: 0,
            bottom: 0
          };
  
          this.lastMargins = {
            left: this.margins.lastLeft,
            right: this.margins.lastRight,
            top: this.lineLength === 1 ? this.margins.top : 0,
            bottom: this.margins.bottom
          };
  
          for (let childObj of Array.from(this.children)) {
            this.view.getViewNodeFor(childObj.child).computeMargins();
          }
  
          return null;
        }
  
        getMargins(line) {
          if (line === 0) { return this.firstMargins;
          } else if (line === (this.lineLength - 1)) { return this.lastMargins;
          } else { return this.midMargins; }
        }
  
        computeBevels() {
          for (let childObj of Array.from(this.children)) {
            this.view.getViewNodeFor(childObj.child).computeBevels();
          }
  
          return this.bevels;
        }
  
        // ## computeMinDimensions (GenericViewNode)
        // Compute the size of our bounding box on each
        // line that we contain.
        //
        // Return child node.
        //
        // This is a void computeDimensinos that should be overridden.
        computeMinDimensions() {
          if (this.minDimensions.length > this.lineLength) {
            this.minDimensions.length = (this.minDistanceToBase.length = this.lineLength);
          } else {
            while (this.minDimensions.length !== this.lineLength) {
              this.minDimensions.push(new this.view.draw.Size(0, 0));
              this.minDistanceToBase.push({above: 0, below: 0});
            }
          }
  
          for (let i = 0, end = this.lineLength, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
            this.minDimensions[i].width = (this.minDimensions[i].height = 0);
            this.minDistanceToBase[i].above = (this.minDistanceToBase[i].below = 0);
          }
  
          return null;
        }
  
  
        // ## computeDimensions (GenericViewNode)
        // Compute the size of our bounding box on each
        // line that we contain.
        //
        // Return child node.
        computeDimensions(force, root) {
          if (root == null) { root = false; }
          if ((this.computedVersion === this.model.version) && !force && !this.invalidate) {
            return;
          }
  
          const oldDimensions = this.dimensions;
          const oldDistanceToBase = this.distanceToBase;
  
          this.dimensions = (__range__(0, this.lineLength, false).map((j) => new this.view.draw.Size(0, 0)));
          this.distanceToBase = (__range__(0, this.lineLength, false).map((k) => ({above: 0, below: 0})));
  
          for (let i = 0; i < this.minDimensions.length; i++) {
            const size = this.minDimensions[i];
            this.dimensions[i].width = size.width; this.dimensions[i].height = size.height;
            this.distanceToBase[i].above = this.minDistanceToBase[i].above;
            this.distanceToBase[i].below = this.minDistanceToBase[i].below;
          }
  
          if ((this.model.parent != null) && this.view.hasViewNodeFor(this.model.parent) && !root &&
              (this.topLineSticksToBottom || this.bottomLineSticksToTop ||
               ((this.lineLength > 1) && !this.model.isLastOnLine()))) {
            let distance, lineCount;
            const parentNode = this.view.getViewNodeFor(this.model.parent);
            const startLine = this.model.getLinesToParent();
  
            // grow below if "stick to bottom" is set.
            if (this.topLineSticksToBottom) {
              distance = this.distanceToBase[0];
              distance.below = Math.max(distance.below,
                  parentNode.distanceToBase[startLine].below);
              this.dimensions[0] = new this.view.draw.Size(
                  this.dimensions[0].width,
                  distance.below + distance.above);
            }
  
            // grow above if "stick to top" is set.
            if (this.bottomLineSticksToTop) {
              lineCount = this.distanceToBase.length;
              distance = this.distanceToBase[lineCount - 1];
              distance.above = Math.max(distance.above,
                  parentNode.distanceToBase[(startLine + lineCount) - 1].above);
              this.dimensions[lineCount - 1] = new this.view.draw.Size(
                  this.dimensions[lineCount - 1].width,
                  distance.below + distance.above);
            }
  
            if ((this.lineLength > 1) && !this.model.isLastOnLine() && (this.model.type === 'block')) {
              distance = this.distanceToBase[this.lineLength - 1];
              distance.below = parentNode.distanceToBase[(startLine + this.lineLength) - 1].below;
              this.dimensions[lineCount - 1] = new this.view.draw.Size(
                  this.dimensions[lineCount - 1].width,
                  distance.below + distance.above);
            }
          }
  
          let changed = (oldDimensions.length !== this.lineLength);
          if (!changed) { for (let line = 0, end = this.lineLength, asc = 0 <= end; asc ? line < end : line > end; asc ? line++ : line--) {
            if (!oldDimensions[line].equals(this.dimensions[line]) ||
                (oldDistanceToBase[line].above !== this.distanceToBase[line].above) ||
                (oldDistanceToBase[line].below !== this.distanceToBase[line].below)) {
              changed = true;
              break;
            }
          } }
  
          if (!this.changedBoundingBox) { this.changedBoundingBox = changed; }
  
          for (let childObj of Array.from(this.children)) {
            var needle;
            if (Array.from(this.lineChildren[0]).includes(childObj) || (needle = childObj, Array.from(this.lineChildren[this.lineLength - 1]).includes(needle))) {
              this.view.getViewNodeFor(childObj.child).computeDimensions(changed, !(this.model instanceof model.Container)); //(hack)
            } else {
              this.view.getViewNodeFor(childObj.child).computeDimensions(false, !(this.model instanceof model.Container)); //(hack)
            }
          }
  
          return null;
        }
  
        // ## computeBoundingBoxX (GenericViewNode)
        // Given the left edge coordinate for our bounding box on
        // this line, recursively layout the x-coordinates of us
        // and all our children on this line.
        computeBoundingBoxX(left, line) {
          // Attempt to use our cache. Because modifications in the parent
          // can affect the shape of child blocks, we can't only rely
          // on versioning. For instance, changing `fd 10` to `forward 10`
          // does not update the version on `10`, but the bounding box for
          // `10` still needs to change. So we must also check
          // that the coordinate we are given to begin the bounding box on matches.
          if (((this.computedVersion === this.model.version) &&
             (left === (this.bounds[line] != null ? this.bounds[line].x : undefined)) && !this.changedBoundingBox) ||
             (((this.bounds[line] != null ? this.bounds[line].x : undefined) === left) &&
             ((this.bounds[line] != null ? this.bounds[line].width : undefined) === this.dimensions[line].width))) {
            return this.bounds[line];
          }
  
          this.changedBoundingBox = true;
  
          // Avoid re-instantiating a Rectangle object,
          // if possible.
          if (this.bounds[line] != null) {
            this.bounds[line].x = left;
            this.bounds[line].width = this.dimensions[line].width;
  
          // If not, create one.
          } else {
            this.bounds[line] = new this.view.draw.Rectangle(
              left, 0,
              this.dimensions[line].width, 0
            );
          }
  
          return this.bounds[line];
        }
  
        // ## computeAllBoundingBoxX (GenericViewNode)
        // Call `@computeBoundingBoxX` on all lines,
        // thus laying out the entire document horizontally.
        computeAllBoundingBoxX(left) {
          if (left == null) { left = 0; }
          for (let line = 0; line < this.dimensions.length; line++) {
            const size = this.dimensions[line];
            this.computeBoundingBoxX(left, line);
          }
  
          return this.bounds;
        }
  
        // ## computeGlue (GenericViewNode)
        // If there are disconnected bounding boxes
        // that belong to the same block,
        // insert "glue" spacers between lines
        // to connect them. For instance:
        //
        // ```
        // someLongFunctionName ''' hello
        // world '''
        // ```
        //
        // would require glue between 'hello' and 'world'.
        //
        // This is a void function that should be overridden.
        computeGlue() {
          return this.glue = {};
        }
  
        // ## computeBoundingBoxY (GenericViewNode)
        // Like computeBoundingBoxX. We must separate
        // these passes because glue spacers from `computeGlue`
        // affect computeBoundingBoxY.
        computeBoundingBoxY(top, line) {
          // Again, we need to check to make sure that the coordinate
          // we are given matches, since we cannot only rely on
          // versioning (see computeBoundingBoxX).
          if (((this.computedVersion === this.model.version) &&
             (top === (this.bounds[line] != null ? this.bounds[line].y : undefined)) && !this.changedBoundingBox) ||
             ((this.bounds[line].y === top) &&
             (this.bounds[line].height === this.dimensions[line].height))) {
            return this.bounds[line];
          }
  
          this.changedBoundingBox = true;
  
          // Accept the bounding box edge we were given.
          // We assume here that computeBoundingBoxX was
          // already run for this version, so we
          // should be guaranteed that `@bounds[line]` exists.
          this.bounds[line].y = top;
          this.bounds[line].height = this.dimensions[line].height;
  
          return this.bounds[line];
        }
  
        // ## computeAllBoundingBoxY (GenericViewNode)
        // Call `@computeBoundingBoxY` on all lines,
        // thus laying out the entire document vertically.
        //
        // Account for glue spacing between lines.
        computeAllBoundingBoxY(top) {
          if (top == null) { top = 0; }
          for (let line = 0; line < this.dimensions.length; line++) {
            const size = this.dimensions[line];
            this.computeBoundingBoxY(top, line);
            top += size.height;
            if (line in this.glue) { top += this.glue[line].height; }
          }
  
          return this.bounds;
        }
  
        // ## getBounds (GenericViewNode)
        // Deprecated. Access `@totalBounds` directly instead.
        getBounds() { return this.totalBounds; }
  
        // ## computeOwnPath
        // Using bounding box data, compute the vertices
        // of the polygon that will wrap them. This function
        // will be called from `computePath`, which does this
        // recursively so as to draw the entire tree.
        //
        // Many nodes do not have paths at all,
        // and so need not override this function.
        computeOwnPath() {}
  
        // ## computePath (GenericViewNode)
        // Call `@computeOwnPath` and recurse. This function
        // should never need to be overridden; override `@computeOwnPath`
        // instead.
        computePath() {
          // Here, we cannot just rely on versioning either.
          // We need to know if any bounding box data changed. So,
          // look at `@changedBoundingBox`, which should be set
          // to `true` whenever a bounding box changed on the bounding box
          // passes.
          if ((this.computedVersion === this.model.version) &&
               (this.model.isLastOnLine() === this.lastComputedLinePredicate) &&
               !this.changedBoundingBox) {
            return null;
          }
  
          // Recurse.
          for (let childObj of Array.from(this.children)) {
            this.view.getViewNodeFor(childObj.child).computePath();
          }
  
          // It is possible that we have a version increment
          // without changing bounding boxes. If this is the case,
          // we don't need to recompute our own path.
          if (this.changedBoundingBox || (this.model.isLastOnLine() !== this.lastComputedLinePredicate)) {
            this.computeOwnPath();
  
            // Recompute `totalBounds`, which is used
            // to avoid re*drawing* polygons that
            // are not on-screen. `totalBounds` is the AABB
            // of the everything that has to do with the element,
            // and we redraw iff it overlaps the AABB of the viewport.
            this.totalBounds = new this.view.draw.NoRectangle();
            if (this.bounds.length > 0) {
              this.totalBounds.unite(this.bounds[0]);
              this.totalBounds.unite(this.bounds[this.bounds.length - 1]);
            }
  
            // Figure out our total bounding box however is faster.
            if (this.bounds.length > this.children.length) {
              for (let child of Array.from(this.children)) {
                this.totalBounds.unite(this.view.getViewNodeFor(child.child).totalBounds);
              }
            } else {
              let maxRight = this.totalBounds.right();
              for (let bound of Array.from(this.bounds)) {
                this.totalBounds.x = Math.min(this.totalBounds.x, bound.x);
                maxRight = Math.max(maxRight, bound.right());
              }
  
              this.totalBounds.width = maxRight - this.totalBounds.x;
            }
  
            if (this.path != null) {
              this.totalBounds.unite(this.path.bounds());
            }
          }
  
          this.lastComputedLinePredicate = this.model.isLastOnLine();
  
          return null;
        }
  
        // ## computeOwnDropArea (GenericViewNode)
        // Using bounding box data, compute the drop area
        // for drag-and-drop blocks, if it exists.
        //
        // If we cannot drop something on this node
        // (e.g. a socket that already contains a block),
        // set `@dropArea` to null.
        //
        // Simultaneously, compute `@highlightArea`, which
        // is the white polygon that lights up
        // when we hover over a drop area.
        computeOwnDropArea() {}
  
        // ## computeDropAreas (GenericViewNode)
        // Call `@computeOwnDropArea`, and recurse.
        //
        // This should never have to be overridden;
        // override `@computeOwnDropArea` instead.
        computeDropAreas() {
          // Like with `@computePath`, we cannot rely solely on versioning,
          // so we check the bounding box flag.
          if ((this.computedVersion === this.model.version) &&
              !this.changedBoundingBox) {
            return null;
          }
  
          // Compute drop and highlight areas for ourself
          this.computeOwnDropArea();
  
          // Recurse.
          for (let childObj of Array.from(this.children)) {
            this.view.getViewNodeFor(childObj.child).computeDropAreas();
          }
  
          return null;
        }
  
        computeNewVersionNumber() {
          if ((this.computedVersion === this.model.version) &&
              !this.changedBoundingBox) {
            return null;
          }
  
          this.changedBoundingBox = false;
          this.invalidate = false;
          this.computedVersion = this.model.version;
  
          // Recurse.
          for (let childObj of Array.from(this.children)) {
            this.view.getViewNodeFor(childObj.child).computeNewVersionNumber();
          }
  
          return null;
        }
  
  
        // ## drawSelf (GenericViewNode)
        // Draw our own polygon on a canvas context.
        // May require special effects, like graying-out
        // or blueing for lasso select.
        drawSelf(style) {
          if (style == null) { style = {}; }
        }
  
        hide() {
          for (let element of Array.from(this.elements)) {
            __guardMethod__(element, 'deactivate', o => o.deactivate());
          }
          return this.activeElements = [];
        }
  
        destroy(root) {
          if (root == null) { root = true; }
          if (root) {
            for (let element of Array.from(this.elements)) {
              __guardMethod__(element, 'destroy', o => o.destroy());
            }
          } else if (this.highlightArea != null) {
            this.highlightArea.destroy();
          }
  
          this.activeElements = [];
  
          return Array.from(this.children).map((child) =>
            this.view.getViewNodeFor(child.child).destroy(false));
        }
      };
  
      ListViewNode = class ListViewNode extends GenericViewNode {
        constructor(model1, view) {
          {
            // Hack: trick Babel/TypeScript into allowing this before super.
            if (false) { super(); }
            let thisFn = (() => { return this; }).toString();
            let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
            eval(`${thisName} = this;`);
          }
          this.model = model1;
          this.view = view;
          super(...arguments);
        }
  
        draw(boundingRect, style, parent = null) {
          if (style == null) { style = {}; }
          super.draw(...arguments);
          return Array.from(this.children).map((childObj) =>
            this.view.getViewNodeFor(childObj.child).draw(boundingRect, style, this.group));
        }
  
        root() {
          return Array.from(this.children).map((child) =>
            this.view.getViewNodeFor(child.child).root());
        }
  
        destroy(root) {
          if (root == null) { root = true; }
          return Array.from(this.children).map((child) =>
            this.view.getViewNodeFor(child.child).destroy());
        }
  
        // ## computeChildren (ListViewNode)
        // Figure out which children lie on each line,
        // and compute `@multilineChildrenData` simultaneously.
        //
        // We will do this by going to all of our immediate children,
        // recursing, then calculating their starting and ending lines
        // based on their computing line lengths.
        computeChildren() {
          // If we can, use our cached information.
          if (this.computedVersion === this.model.version) {
            return this.lineLength;
          }
  
          // Otherwise, recompute.
          this.lineLength = 0;
          this.lineChildren = [[]];
          this.children = [];
          this.multilineChildrenData = [];
          this.topLineSticksToBottom = false;
          this.bottomLineSticksToTop = false;
  
          let line = 0;
  
          // Go to all our immediate children.
          this.model.traverseOneLevel(head => {
            // If the child is a newline, simply advance the
            // line counter.
            if (head.type === 'newline') {
              line += 1;
              return this.lineChildren[line] != null ? this.lineChildren[line] : (this.lineChildren[line] = []);
  
            // Otherwise, get the view object associated
            // with this model, and ask it to
            // compute children.
            } else {
              let i;
              let asc, end;
              const view = this.view.getViewNodeFor(head);
              const childLength = view.computeChildren();
  
              // Construct a childObject,
              // which will remember starting and endling lines.
              const childObject = {
                child: head,
                startLine: line,
                endLine: (line + childLength) - 1
              };
  
              // Put it into `@children`.
              this.children.push(childObject);
  
              // Put it into `@lineChildren`.
              for (i = line, end = line + childLength, asc = line <= end; asc ? i < end : i > end; asc ? i++ : i--) {
                if (this.lineChildren[i] == null) { this.lineChildren[i] = []; }
  
                // We don't want to store cursor tokens
                // in `@lineChildren`, as they are inconvenient
                // to deal with in layout, which is the only
                // thing `@lineChildren` is used for.
                if (head.type !== 'cursor') {
                  this.lineChildren[i].push(childObject);
                }
              }
  
              // If this object is a multiline child,
              // update our multiline child data to reflect
              // where it started and ended.
              if (view.lineLength > 1) {
                let asc1, end1, start;
                if (this.multilineChildrenData[line] === MULTILINE_END) {
                  this.multilineChildrenData[line] = MULTILINE_END_START;
                } else {
                  this.multilineChildrenData[line] = MULTILINE_START;
                }
  
                for (start = line + 1, i = start, end1 = (line + childLength) - 1, asc1 = start <= end1; asc1 ? i < end1 : i > end1; asc1 ? i++ : i--) { this.multilineChildrenData[i] = MULTILINE_MIDDLE; }
                this.multilineChildrenData[(line + childLength) - 1] = MULTILINE_END;
              }
  
              // Advance our line counter
              // by however long the child was
              // (i.e. however many newlines
              // we skipped).
              return line += childLength - 1;
            }
          });
  
          // Set @lineLength to reflect
          // what we just found out.
          this.lineLength = line + 1;
  
          // If we have changed in line length,
          // there has obviously been a bounding box change.
          // The bounding box pass as it stands only deals
          // with lines it knows exists, so we need to chop off
          // the end of the array.
          if (this.bounds.length !== this.lineLength) {
            this.changedBoundingBox = true;
            this.bounds = this.bounds.slice(0, this.lineLength);
          }
  
          // Fill in gaps in @multilineChildrenData with NO_MULTILINE
          for (let i = 0, end = this.lineLength, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) { if (this.multilineChildrenData[i] == null) { this.multilineChildrenData[i] = NO_MULTILINE; } }
  
          if (this.lineLength > 1) {
            this.topLineSticksToBottom = true;
            this.bottomLineSticksToTop = true;
          }
  
          return this.lineLength;
        }
  
        // ## computeDimensions (ListViewNode)
        // Compute the size of our bounding box on each line.
        computeMinDimensions() {
          // If we can, use cached data.
          let line, minDimensions, minDistanceToBase;
          if (this.computedVersion === this.model.version) {
            return null;
          }
  
          // start at zero min dimensions
          super.computeMinDimensions(...arguments);
  
          // Lines immediately after the end of Indents
          // have to be extended to a minimum width.
          // Record the lines that need to be extended here.
          const linesToExtend = [];
          const preIndentLines = [];
  
          // Recurse on our children, updating
          // our dimensions as we go to contain them.
          for (let childObject of Array.from(this.children)) {
            // Ask the child to compute dimensions
            const childNode = this.view.getViewNodeFor(childObject.child);
            childNode.computeMinDimensions();
            ({ minDimensions } = childNode);
            ({ minDistanceToBase } = childNode);
  
            // Horizontal margins get added to every line.
            for (line = 0; line < minDimensions.length; line++) {
              var bottomMargin;
              const size = minDimensions[line];
              const desiredLine = line + childObject.startLine;
              const margins = childNode.getMargins(line);
  
              // Unless we are in the middle of an indent,
              // add padding on the right of the child.
              //
              // Exception: Children with invisible bounding boxes
              // should remain invisible. This matters
              // mainly for indents starting at the end of a line.
              this.minDimensions[desiredLine].width += size.width +
                margins.left +
                margins.right;
  
              // Compute max distance above and below text
              //
              // Exception: do not add the bottom padding on an
              // Indent if we own the next line as well.
  
              if ((childObject.child.type === 'indent') &&
                  (line === (minDimensions.length - 1)) &&
                  (desiredLine < (this.lineLength - 1))) {
                bottomMargin = 0;
                linesToExtend.push(desiredLine + 1);
              } else if ((childObject.child.type === 'indent') &&
                  (line === 0)) {
                preIndentLines.push(desiredLine);
                bottomMargin = margins.bottom;
              } else {
                bottomMargin = margins.bottom;
              }
  
  
              this.minDistanceToBase[desiredLine].above = Math.max(
                this.minDistanceToBase[desiredLine].above,
                minDistanceToBase[line].above + margins.top);
              this.minDistanceToBase[desiredLine].below = Math.max(
                this.minDistanceToBase[desiredLine].below,
                minDistanceToBase[line].below + Math.max(bottomMargin, (
                  ((this.model.buttons != null ? this.model.buttons.addButton : undefined) || (this.model.buttons != null ? this.model.buttons.subtractButton : undefined)) &&
                      (desiredLine === (this.lineLength - 1)) &&
                      (this.multilineChildrenData[line] === MULTILINE_END) &&
                      (this.lineChildren[line].length === 1) ?
                    this.view.opts.buttonPadding + this.view.opts.buttonHeight
                  :
                    0
                )));
            }
          }
  
          // Height is just the sum of the above-base and below-base counts.
          // Empty lines should have some height.
          for (line = 0; line < this.minDimensions.length; line++) {
            const minDimension = this.minDimensions[line];
            if (this.lineChildren[line].length === 0) {
              // Socket should be shorter than other blocks
              if (this.model.type === 'socket') {
                this.minDistanceToBase[line].above = this.view.opts.textHeight + this.view.opts.textPadding;
                this.minDistanceToBase[line].below = this.view.opts.textPadding;
  
              // Text should not claim any padding
              } else if (this.model.type === 'text') {
                this.minDistanceToBase[line].above = this.view.opts.textHeight;
                this.minDistanceToBase[line].below = 0;
  
              // The first line of an indent is often empty; this is the desired behavior
              } else if ((this.model.type === 'indent') && (line === 0)) {
                this.minDistanceToBase[line].above = 0;
                this.minDistanceToBase[line].below = 0;
  
              // Empty blocks should be the height of lines with text
              } else {
                this.minDistanceToBase[line].above = this.view.opts.textHeight + this.view.opts.padding;
                this.minDistanceToBase[line].below = this.view.opts.padding;
              }
            }
  
            minDimension.height =
              this.minDistanceToBase[line].above +
              this.minDistanceToBase[line].below;
          }
  
          // Go through and adjust the width of rectangles
          // immediately after the end of an indent to
          // be as long as necessary
          for (line of Array.from(linesToExtend)) {
            this.minDimensions[line].width = Math.max(
              this.minDimensions[line].width, Math.max(
                this.view.opts.minIndentTongueWidth,
                this.view.opts.indentWidth + this.view.opts.tabWidth + this.view.opts.tabOffset + this.view.opts.bevelClip
            ));
          }
  
          for (line of Array.from(preIndentLines)) {
            this.minDimensions[line].width = Math.max(
              this.minDimensions[line].width, Math.max(
                this.view.opts.minIndentTongueWidth,
                this.view.opts.indentWidth + this.view.opts.tabWidth + this.view.opts.tabOffset + this.view.opts.bevelClip
            ));
          }
  
          // Add space for carriage arrow
          for (let lineChild of Array.from(this.lineChildren[this.lineLength - 1])) {
            const lineChildView = this.view.getViewNodeFor(lineChild.child);
            if (lineChildView.carriageArrow !== CARRIAGE_ARROW_NONE) {
              this.minDistanceToBase[this.lineLength - 1].below += this.view.opts.padding;
              this.minDimensions[this.lineLength - 1].height =
                this.minDistanceToBase[this.lineLength - 1].above +
                this.minDistanceToBase[this.lineLength - 1].below;
              break;
            }
          }
  
          return null;
        }
  
        // ## computeBoundingBoxX (ListViewNode)
        // Layout bounding box positions horizontally.
        // This needs to be separate from y-coordinate computation
        // because of glue spacing (the space between lines
        // that keeps weird-shaped blocks continuous), which
        // can shift y-coordinates around.
        computeBoundingBoxX(left, line, offset) {
          // Use cached data if possible
          if (offset == null) { offset = 0; }
          if ((this.computedVersion === this.model.version) &&
              (left === (this.bounds[line] != null ? this.bounds[line].x : undefined)) && !this.changedBoundingBox) {
            return this.bounds[line];
          }
  
          // If the bounding box we're being asked
          // to layout is exactly the same,
          // avoid setting `@changedBoundingBox`
          // for performance reasons (also, trivially,
          // avoid changing bounding box coords).
          if (((this.bounds[line] != null ? this.bounds[line].x : undefined) !== left) ||
                 ((this.bounds[line] != null ? this.bounds[line].width : undefined) !== this.dimensions[line].width)) {
  
            // Assign our own bounding box given
            // this center-left coordinate
            if (this.bounds[line] != null) {
              this.bounds[line].x = left;
              this.bounds[line].width = this.dimensions[line].width;
            } else {
              this.bounds[line] = new this.view.draw.Rectangle(
                left, 0,
                this.dimensions[line].width, 0
              );
            }
  
            this.changedBoundingBox = true;
          }
  
          // Now recurse. We will keep track
          // of a "cursor" as we go along,
          // placing children down and
          // adding padding and sizes
          // to make them not overlap.
          let childLeft = left + offset;
  
          // Get rendering info on each of these children
          for (let i = 0; i < this.lineChildren[line].length; i++) {
            const lineChild = this.lineChildren[line][i];
            const childView = this.view.getViewNodeFor(lineChild.child);
            const childLine = line - lineChild.startLine;
            const childMargins = childView.getMargins(childLine);
  
            childLeft += childMargins.left;
            childView.computeBoundingBoxX(childLeft, childLine);
            childLeft +=
              childView.dimensions[childLine].width + childMargins.right;
          }
  
          // Return the bounds we just
          // computed.
          return this.bounds[line];
        }
  
  
        // ## computeBoundingBoxY
        // Layout a line vertically.
        computeBoundingBoxY(top, line) {
          // Use our cache if possible.
          if ((this.computedVersion === this.model.version) &&
              (top === (this.bounds[line] != null ? this.bounds[line].y : undefined)) && !this.changedBoundingBox) {
            return this.bounds[line];
          }
  
          // Avoid setting `@changedBoundingBox` if our
          // bounding box has not actually changed,
          // for performance reasons. (Still need to
          // recurse, in case children have changed
          // but not us)
          if (((this.bounds[line] != null ? this.bounds[line].y : undefined) !== top) ||
             ((this.bounds[line] != null ? this.bounds[line].height : undefined) !== this.dimensions[line].height)) {
  
            // Assign our own bounding box given
            // this center-left coordinate
            this.bounds[line].y = top;
            this.bounds[line].height = this.dimensions[line].height;
  
            this.changedBoundingBox = true;
          }
  
          // Go to each child and lay them out so that their distanceToBase
          // lines up.
          const { above } = this.distanceToBase[line];
          for (let i = 0; i < this.lineChildren[line].length; i++) {
            const lineChild = this.lineChildren[line][i];
            const childView = this.view.getViewNodeFor(lineChild.child);
            const childLine = line - lineChild.startLine;
            const childAbove = childView.distanceToBase[childLine].above;
            childView.computeBoundingBoxY((top + above) - childAbove, childLine);
          }
  
          // Return the bounds we just computed.
          return this.bounds[line];
        }
  
        // ## layout
        // Run all of these layout steps in order.
        //
        // Takes two arguments, which can be changed
        // to translate the entire document from the upper-left corner.
        layout(left, top) {
          if (left == null) { left = this.lastCoordinate.x; }
          if (top == null) { top = this.lastCoordinate.y; }
          this.view.registerRoot(this.model);
  
          this.lastCoordinate = new this.view.draw.Point(left, top);
  
          this.computeChildren();
          this.computeCarriageArrow(true);
          this.computeMargins();
          this.computeBevels();
          this.computeMinDimensions();
          this.computeDimensions(0, true);
          this.computeAllBoundingBoxX(left);
          this.computeGlue();
          this.computeAllBoundingBoxY(top);
          this.computePath();
          this.computeDropAreas();
  
          const { changedBoundingBox } = this;
          this.computeNewVersionNumber();
  
          return changedBoundingBox;
        }
  
        // ## absorbCache
        // A hacky thing to get a view node of a new List
        // to acquire all the properties of its children
        // TODO re-examine
        absorbCache() {
          let child, childView, line, size;
          this.view.registerRoot(this.model);
  
          this.computeChildren();
          this.computeCarriageArrow(true);
          this.computeMargins();
          this.computeBevels();
          this.computeMinDimensions();
          // Replacement for computeDimensions
          for (line = 0; line < this.minDimensions.length; line++) {
            size = this.minDimensions[line];
            this.distanceToBase[line] = {
              above: this.lineChildren[line].map(child => this.view.getViewNodeFor(child.child).distanceToBase[line - child.startLine].above).reduce((a, b) => Math.max(a, b)),
              below: this.lineChildren[line].map(child => this.view.getViewNodeFor(child.child).distanceToBase[line - child.startLine].below).reduce((a, b) => Math.max(a, b))
            };
            this.dimensions[line] = new draw.Size(this.minDimensions[line].width, this.minDimensions[line].height);
          }
  
          //@computeDimensions false, true
          // Replacement for computeAllBoundingBoxX
          for (line = 0; line < this.dimensions.length; line++) {
            size = this.dimensions[line];
            child = this.lineChildren[line][0];
            childView = this.view.getViewNodeFor(child.child);
            const left = childView.bounds[line - child.startLine].x;
            this.computeBoundingBoxX(left, line);
          }
          this.computeGlue();
          // Replacement for computeAllBoundingBoxY
          for (line = 0; line < this.dimensions.length; line++) {
            size = this.dimensions[line];
            child = this.lineChildren[line][0];
            childView = this.view.getViewNodeFor(child.child);
            const oldY = childView.bounds[line - child.startLine].y;
            const top = (childView.bounds[line - child.startLine].y +
              childView.distanceToBase[line - child.startLine].above) -
              this.distanceToBase[line].above;
            this.computeBoundingBoxY(top, line);
          }
          this.computePath();
          this.computeDropAreas();
  
          return true;
        }
  
        // ## computeGlue
        // Compute the necessary glue spacing between lines.
        //
        // If a block has disconnected blocks, e.g.
        // ```
        // someLongFunctionName '''hello
        // world'''
        // ```
        //
        // it requires glue spacing. Then, any surrounding blocks
        // must add their padding to that glue spacing, until we
        // reach an Indent, at which point we can stop.
        //
        // Parents outside the indent must stil know that there is
        // a space between these line, but they wil not have
        // to colour in that space. This will be flaged
        // by the `draw` flag on the glue objects.
        computeGlue() {
          // Use our cache if possible
          if ((this.computedVersion === this.model.version) &&
              !this.changedBoundingBox) {
            return this.glue;
          }
  
          // Immediately recurse, as we will
          // need to know child glue info in order
          // to compute our own (adding padding, etc.).
          for (let childObj of Array.from(this.children)) {
            this.view.getViewNodeFor(childObj.child).computeGlue();
          }
  
          this.glue = {};
  
          // Go through every pair of adjacent bounding boxes
          // to see if they overlap or not
          for (let line = 0; line < this.bounds.length; line++) {
  
            const box = this.bounds[line];
            if (line < (this.bounds.length - 1)) {
              this.glue[line] = {
                type: 'normal',
                height: 0,
                draw: false
              };
  
              // We will always have glue spacing at least as big
              // as the biggest child's glue spacing.
              for (let lineChild of Array.from(this.lineChildren[line])) {
                const childView = this.view.getViewNodeFor(lineChild.child);
                const childLine = line - lineChild.startLine;
  
                if (childLine in childView.glue) {
                  // Either add padding or not, depending
                  // on whether there is an indent between us.
                  this.glue[line].height = Math.max(this.glue[line].height, childView.glue[childLine].height);
                }
  
                if (childView.carriageArrow !== CARRIAGE_ARROW_NONE) {
                  this.glue[line].height = Math.max(this.glue[line].height, this.view.opts.padding);
                }
              }
            }
          }
  
          // Return the glue we just computed.
          return this.glue;
        }
      };
  
      // # ContainerViewNode
      // Class from which `socketView`, `indentView`, `blockView`, and `documentView` extend.
      // Contains function for dealing with multiple children, making polygons to wrap
      // multiple lines, etc.
      ContainerViewNode = class ContainerViewNode extends ListViewNode {
        static initClass() {
    
          // ## shouldAddTab
          // By default, we will ask
          // not to have a tab.
          this.prototype.shouldAddTab = NO;
        }
        constructor(model1, view) {
          {
            // Hack: trick Babel/TypeScript into allowing this before super.
            if (false) { super(); }
            let thisFn = (() => { return this; }).toString();
            let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
            eval(`${thisName} = this;`);
          }
          this.model = model1;
          this.view = view;
          super(...arguments);
  
          // *Sixth pass variables*
          // computePath
          this.group = new this.view.draw.Group('droplet-container-group');
  
          if (this.model.type === 'block') {
            this.path = new this.view.draw.Path([], true, {
              cssClass: 'droplet-block-path'
            });
          } else {
            this.path = new this.view.draw.Path([], false, {
              cssClass: `droplet-${this.model.type}-path`
            });
          }
          this.totalBounds = new this.view.draw.NoRectangle();
  
          this.path.setParent(this.group);
  
          // *Seventh pass variables*
          // computeDropAreas
          // each one is a @view.draw.Path (or null)
          this.dropArea = null;
          this.highlightArea = new this.view.draw.Path([], false, {
            fillColor: '#FF0',
            strokeColor: '#FF0',
            lineWidth: 1
          });
          this.highlightArea.deactivate();
  
          this.elements.push(this.group);
          this.elements.push(this.path);
          this.elements.push(this.highlightArea);
        }
  
        destroy(root) {
          if (root == null) { root = true; }
          if (root) {
            for (let element of Array.from(this.elements)) {
              __guardMethod__(element, 'destroy', o => o.destroy());
            }
          } else if (this.highlightArea != null) {
            this.highlightArea.destroy();
          }
  
          return Array.from(this.children).map((child) =>
            this.view.getViewNodeFor(child.child).destroy(false));
        }
  
        root() {
          return this.group.setParent(this.view.draw.ctx);
        }
  
        // ## draw (GenericViewNode)
        // Call `drawSelf` and recurse, if we are in the viewport.
        draw(boundingRect, style, parent = null) {
          if (style == null) { style = {}; }
          if ((boundingRect == null) || this.totalBounds.overlap(boundingRect)) {
            this.drawSelf(style, parent);
  
            this.group.activate(); this.path.activate();
  
            for (let element of Array.from(this.activeElements)) {
              element.activate();
            }
  
            if (this.highlightArea != null) {
              this.highlightArea.setParent(this.view.draw.ctx);
            }
  
            if (parent != null) {
              this.group.setParent(parent);
            }
  
            return Array.from(this.children).map((childObj) =>
              this.view.getViewNodeFor(childObj.child).draw(boundingRect, style, this.group));
  
          } else {
            this.group.destroy();
            if (this.highlightArea != null) {
              return this.highlightArea.destroy();
            }
          }
        }
  
        computeCarriageArrow(root) {
          if (root == null) { root = false; }
          const oldCarriageArrow = this.carriageArrow;
          this.carriageArrow = CARRIAGE_ARROW_NONE;
  
          const { parent } = this.model;
  
          if ((!root) && ((parent != null ? parent.type : undefined) === 'indent') && this.view.hasViewNodeFor(parent) &&
              (this.view.getViewNodeFor(parent).lineLength > 1) &&
              (this.lineLength === 1)) {
            let head = this.model.start;
            while ((head !== parent.start) && (head.type !== 'newline')) {
              head = head.prev;
            }
  
            if (head === parent.start) {
              if (this.model.isLastOnLine()) {
                this.carriageArrow = CARRIAGE_ARROW_INDENT;
              } else {
                this.carriageArrow = CARRIAGE_GROW_DOWN;
              }
            } else if (!this.model.isFirstOnLine()) {
              this.carriageArrow = CARRIAGE_ARROW_SIDEALONG;
            }
          }
  
          if (this.carriageArrow !== oldCarriageArrow) {
            this.changedBoundingBox = true;
          }
  
          if ((this.computedVersion === this.model.version) &&
             ((this.model.parent == null) || !this.view.hasViewNodeFor(this.model.parent) ||
             (this.model.parent.version === this.view.getViewNodeFor(this.model.parent).computedVersion))) {
            return null;
          }
  
          return super.computeCarriageArrow(...arguments);
        }
  
        computeGlue() {
          // Use our cache if possible
          if ((this.computedVersion === this.model.version) &&
              !this.changedBoundingBox) {
            return this.glue;
          }
  
          super.computeGlue(...arguments);
  
          for (let line = 0; line < this.bounds.length; line++) {
            // Additionally, we add glue spacing padding if we are disconnected
            // from the bounding box on the next line.
            const box = this.bounds[line];
            if (line < (this.bounds.length - 1)) {
              if (this.multilineChildrenData[line] !== MULTILINE_MIDDLE) {
                // Find the horizontal overlap between these two bounding rectangles,
                // which is our right edge minus their left, or vice versa.
                let overlap = Math.min(this.bounds[line].right() - this.bounds[line + 1].x, this.bounds[line + 1].right() - this.bounds[line].x);
  
                // If we are starting an indent, then our "bounding box"
                // on the next line is not actually how we will be visualized;
                // instead, we must connect to the small rectangle
                // on the left of a C-shaped indent thing. So,
                // compute overlap with that as well.
                if ([MULTILINE_START, MULTILINE_END_START].includes(this.multilineChildrenData[line])) {
                  overlap = Math.min(overlap, (this.bounds[line + 1].x + this.view.opts.indentWidth) - this.bounds[line].x);
                }
  
                // If the overlap is too small, demand glue.
                if ((overlap < this.view.opts.padding) && (this.model.type !== 'indent')) {
                  this.glue[line].height += this.view.opts.padding;
                  this.glue[line].draw = true;
                }
              }
            }
          }
  
          return this.glue;
        }
  
        computeBevels() {
          const oldBevels = this.bevels;
          this.bevels = {
            top: true,
            bottom: true
          };
  
          if ((['indent', 'document'].includes(this.model.parent != null ? this.model.parent.type : undefined)) &&
             ((this.model.start.prev != null ? this.model.start.prev.type : undefined) === 'newline') &&
             ((this.model.start.prev != null ? this.model.start.prev.prev : undefined) !== this.model.parent.start)) {
            this.bevels.top = false;
          }
  
          if ((['indent', 'document'].includes(this.model.parent != null ? this.model.parent.type : undefined)) &&
             ((this.model.end.next != null ? this.model.end.next.type : undefined) === 'newline')) {
            this.bevels.bottom = false;
          }
  
          if ((oldBevels.top !== this.bevels.top) ||
              (oldBevels.bottom !== this.bevels.bottom)) {
            this.changedBoundingBox = true;
          }
  
          if (this.computedVersion === this.model.version) {
            return null;
          }
  
          return super.computeBevels(...arguments);
        }
  
        // ## computeOwnPath
        // Using bounding box data, compute the polygon
        // that represents us. This contains a lot of special cases
        // for glue and multiline starts and ends.
  
        computeOwnPath() {
          // There are four kinds of line,
          // for the purposes of computing the path.
          //
          // 1. Normal block line; we surround the bounding rectangle.
          // 2. Beginning of a multiline block. Avoid that block on the right and bottom.
          // 3. Middle of a multiline block. We avoid to the left side
          // 4. End of a multiline block. We make a G-shape if necessary. If it is an Indent,
          //    this will leave a thick tongue due to things done in dimension
          //    computation.
  
          // We will keep track of two sets of coordinates,
          // the left side of the polygon and the right side.
          //
          // At the end, we will reverse `left` and concatenate these
          // so as to create a counterclockwise path.
          let bounds, multilineBounds, multilineChild;
          const left = [];
          const right = [];
  
          // If necessary, add tab
          // at the top.
          if (this.shouldAddTab() && this.model.isFirstOnLine() &&
              (this.carriageArrow !== CARRIAGE_ARROW_SIDEALONG)) {
            this.addTabReverse(right, new this.view.draw.Point(this.bounds[0].x + this.view.opts.tabOffset, this.bounds[0].y));
          }
  
          for (let line = 0; line < this.bounds.length; line++) {
  
            // Case 1. Normal rendering.
            var destinationBounds, glueTop, multilineView, parentViewNode;
            bounds = this.bounds[line];
            if (this.multilineChildrenData[line] === NO_MULTILINE) {
              // Draw the left edge of the bounding box.
              left.push(new this.view.draw.Point(bounds.x, bounds.y));
              left.push(new this.view.draw.Point(bounds.x, bounds.bottom()));
  
              // Draw the right edge of the bounding box.
              right.push(new this.view.draw.Point(bounds.right(), bounds.y));
              right.push(new this.view.draw.Point(bounds.right(), bounds.bottom()));
            }
  
            // Case 2. Start of a multiline block.
            if (this.multilineChildrenData[line] === MULTILINE_START) {
              // Draw the left edge of the bounding box.
              left.push(new this.view.draw.Point(bounds.x, bounds.y));
              left.push(new this.view.draw.Point(bounds.x, bounds.bottom()));
  
              // Find the multiline child that's starting on this line,
              // so that we can know its bounds
              multilineChild = this.lineChildren[line][this.lineChildren[line].length - 1];
              multilineView = this.view.getViewNodeFor(multilineChild.child);
              multilineBounds = multilineView.bounds[line - multilineChild.startLine];
  
              // If the multiline child here is invisible,
              // draw the line just normally.
              if (multilineBounds.width === 0) {
                right.push(new this.view.draw.Point(bounds.right(), bounds.y));
  
              // Otherwise, avoid the block by tracing out its
              // top and left edges, then going to our bound's bottom.
              } else {
                right.push(new this.view.draw.Point(bounds.right(), bounds.y));
                right.push(new this.view.draw.Point(bounds.right(), multilineBounds.y));
                if (multilineChild.child.type === 'indent') {
                  this.addTab(right, new this.view.draw.Point(multilineBounds.x + this.view.opts.tabOffset, multilineBounds.y));
                }
                right.push(new this.view.draw.Point(multilineBounds.x, multilineBounds.y));
                right.push(new this.view.draw.Point(multilineBounds.x, multilineBounds.bottom()));
              }
            }
  
            // Case 3. Middle of an indent.
            if (this.multilineChildrenData[line] === MULTILINE_MIDDLE) {
              var needle;
              multilineChild = this.lineChildren[line][0];
              multilineBounds = this.view.getViewNodeFor(multilineChild.child).bounds[line - multilineChild.startLine];
  
              // Draw the left edge normally.
              left.push(new this.view.draw.Point(bounds.x, bounds.y));
              left.push(new this.view.draw.Point(bounds.x, bounds.bottom()));
  
              // Draw the right edge straight down,
              // exactly to the left of the multiline child.
              if ((needle = this.multilineChildrenData[line - 1], ![MULTILINE_START, MULTILINE_END_START].includes(needle)) ||
                     (multilineChild.child.type !== 'indent')) {
                right.push(new this.view.draw.Point(multilineBounds.x, bounds.y));
              }
              right.push(new this.view.draw.Point(multilineBounds.x, bounds.bottom()));
            }
  
            // Case 4. End of an indent.
            if ([MULTILINE_END, MULTILINE_END_START].includes(this.multilineChildrenData[line])) {
              var needle1;
              left.push(new this.view.draw.Point(bounds.x, bounds.y));
              left.push(new this.view.draw.Point(bounds.x, bounds.bottom()));
  
              // Find the child that is the indent
              multilineChild = this.lineChildren[line][0];
              multilineBounds = this.view.getViewNodeFor(multilineChild.child).bounds[line - multilineChild.startLine];
  
              // Avoid the indented area
              if ((needle1 = this.multilineChildrenData[line - 1], ![MULTILINE_START, MULTILINE_END_START].includes(needle1)) ||
                     (multilineChild.child.type !== 'indent')) {
                right.push(new this.view.draw.Point(multilineBounds.x, multilineBounds.y));
              }
              right.push(new this.view.draw.Point(multilineBounds.x, multilineBounds.bottom()));
  
              if (multilineChild.child.type === 'indent') {
                this.addTabReverse(right, new this.view.draw.Point(multilineBounds.x + this.view.opts.tabOffset, multilineBounds.bottom()));
              }
  
              right.push(new this.view.draw.Point(multilineBounds.right(), multilineBounds.bottom()));
  
              // If we must, make the "G"-shape
              if (this.lineChildren[line].length > 1) {
                right.push(new this.view.draw.Point(multilineBounds.right(), multilineBounds.y));
  
                if (this.multilineChildrenData[line] === MULTILINE_END) {
                  right.push(new this.view.draw.Point(bounds.right(), bounds.y));
                  right.push(new this.view.draw.Point(bounds.right(), bounds.bottom()));
                } else {
                  // Find the multiline child that's starting on this line,
                  // so that we can know its bounds
                  multilineChild = this.lineChildren[line][this.lineChildren[line].length - 1];
                  multilineView = this.view.getViewNodeFor(multilineChild.child);
                  multilineBounds = multilineView.bounds[line - multilineChild.startLine];
  
                  // Draw the upper-right corner
                  right.push(new this.view.draw.Point(bounds.right(), bounds.y));
  
                  // If the multiline child here is invisible,
                  // draw the line just normally.
                  if (multilineBounds.width === 0) {
                    right.push(new this.view.draw.Point(bounds.right(), bounds.y));
                    right.push(new this.view.draw.Point(bounds.right(), bounds.bottom()));
  
                  // Otherwise, avoid the block by tracing out its
                  // top and left edges, then going to our bound's bottom.
                  } else {
                    right.push(new this.view.draw.Point(bounds.right(), multilineBounds.y));
                    right.push(new this.view.draw.Point(multilineBounds.x, multilineBounds.y));
                    right.push(new this.view.draw.Point(multilineBounds.x, multilineBounds.bottom()));
                  }
                }
  
              // Otherwise, don't.
              } else {
                right.push(new this.view.draw.Point(bounds.right(), multilineBounds.bottom()));
                right.push(new this.view.draw.Point(bounds.right(), bounds.bottom()));
              }
            }
  
            // "Glue" phase
            // Here we use our glue spacing data
            // to draw glue, if necessary.
            //
            // If we are being told to draw some glue here,
            // do so.
            if ((line < (this.lineLength - 1)) && line in this.glue && this.glue[line].draw) {
              // Extract information from the glue spacing
              // and bounding box data combined.
              //
              // `glueTop` will be the top of the "glue" box.
              // `leftmost` and `rightmost` are the leftmost
              // and rightmost extremes of this and the next line's
              // bounding boxes.
              glueTop = this.bounds[line + 1].y - this.glue[line].height;
              const leftmost = Math.min(this.bounds[line + 1].x, this.bounds[line].x);
              const rightmost = Math.max(this.bounds[line + 1].right(), this.bounds[line].right());
  
              // Bring the left down to the glue top line, then down to the
              // level of the next line's bounding box. This prepares
              // it to go straight horizontally over
              // to the top of the next bounding box,
              // once the loop reaches that point.
              left.push(new this.view.draw.Point(this.bounds[line].x, glueTop));
              left.push(new this.view.draw.Point(leftmost, glueTop));
              left.push(new this.view.draw.Point(leftmost, glueTop + this.view.opts.padding));
  
              // Do the same for the right side, unless we can't
              // because we're avoiding intersections with a multiline child that's
              // in the way.
              if (this.multilineChildrenData[line] !== MULTILINE_START) {
                right.push(new this.view.draw.Point(this.bounds[line].right(), glueTop));
                right.push(new this.view.draw.Point(rightmost, glueTop));
                right.push(new this.view.draw.Point(rightmost, glueTop + this.view.opts.padding));
              }
  
            // Otherwise, bring us gracefully to the next line
            // without lots of glue (minimize the extra colour).
            } else if ((this.bounds[line + 1] != null) && (this.multilineChildrenData[line] !== MULTILINE_MIDDLE)) {
              // Instead of outward extremes, we take inner extremes this time,
              // to minimize extra colour between lines.
              const innerLeft = Math.max(this.bounds[line + 1].x, this.bounds[line].x);
              const innerRight = Math.min(this.bounds[line + 1].right(), this.bounds[line].right());
  
              // Drop down to the next line on the left, minimizing extra colour
              left.push(new this.view.draw.Point(innerLeft, this.bounds[line].bottom()));
              left.push(new this.view.draw.Point(innerLeft, this.bounds[line + 1].y));
  
              // Do the same on the right, unless we need to avoid
              // a multiline block that's starting here.
              if (![MULTILINE_START, MULTILINE_END_START].includes(this.multilineChildrenData[line])) {
                right.push(new this.view.draw.Point(innerRight, this.bounds[line].bottom()));
                right.push(new this.view.draw.Point(innerRight, this.bounds[line + 1].y));
              }
            } else if (this.carriageArrow === CARRIAGE_GROW_DOWN) {
              parentViewNode = this.view.getViewNodeFor(this.model.parent);
              destinationBounds = parentViewNode.bounds[1];
  
              right.push(new this.view.draw.Point(this.bounds[line].right(), destinationBounds.y - this.view.opts.padding));
              left.push(new this.view.draw.Point(this.bounds[line].x, destinationBounds.y - this.view.opts.padding));
  
            } else if (this.carriageArrow === CARRIAGE_ARROW_INDENT) {
              parentViewNode = this.view.getViewNodeFor(this.model.parent);
              destinationBounds = parentViewNode.bounds[1];
  
              right.push(new this.view.draw.Point(this.bounds[line].right(), destinationBounds.y));
              right.push(new this.view.draw.Point(destinationBounds.x + this.view.opts.tabOffset + this.view.opts.tabWidth, destinationBounds.y));
  
              left.push(new this.view.draw.Point(this.bounds[line].x, destinationBounds.y - this.view.opts.padding));
              left.push(new this.view.draw.Point(destinationBounds.x, destinationBounds.y - this.view.opts.padding));
              left.push(new this.view.draw.Point(destinationBounds.x, destinationBounds.y));
  
              this.addTab(right, new this.view.draw.Point(destinationBounds.x + this.view.opts.tabOffset, destinationBounds.y));
            } else if ((this.carriageArrow === CARRIAGE_ARROW_SIDEALONG) && this.model.isLastOnLine()) {
              parentViewNode = this.view.getViewNodeFor(this.model.parent);
              destinationBounds = parentViewNode.bounds[this.model.getLinesToParent()];
  
              right.push(new this.view.draw.Point(this.bounds[line].right(), destinationBounds.bottom() + this.view.opts.padding));
              right.push(new this.view.draw.Point(destinationBounds.x + this.view.opts.tabOffset + this.view.opts.tabWidth,
                destinationBounds.bottom() + this.view.opts.padding)
              );
  
              left.push(new this.view.draw.Point(this.bounds[line].x, destinationBounds.bottom()));
              left.push(new this.view.draw.Point(destinationBounds.x, destinationBounds.bottom()));
              left.push(new this.view.draw.Point(destinationBounds.x, destinationBounds.bottom() + this.view.opts.padding));
  
              this.addTab(right, new this.view.draw.Point(destinationBounds.x + this.view.opts.tabOffset,
                destinationBounds.bottom() + this.view.opts.padding)
              );
            }
  
            // If we're avoiding intersections with a multiline child in the way,
            // bring us gracefully to the next line's top. We had to keep avoiding
            // using bounding box right-edge data earlier, because it would have overlapped;
            // instead, we want to use the left edge of the multiline block that's
            // starting here.
            if ([MULTILINE_START, MULTILINE_END_START].includes(this.multilineChildrenData[line])) {
              multilineChild = this.lineChildren[line][this.lineChildren[line].length - 1];
              const multilineNode = this.view.getViewNodeFor(multilineChild.child);
              multilineBounds = multilineNode.bounds[line - multilineChild.startLine];
  
              if ((this.glue[line] != null ? this.glue[line].draw : undefined)) {
                glueTop = (this.bounds[line + 1].y - this.glue[line].height) + this.view.opts.padding;
              } else {
                glueTop = this.bounds[line].bottom();
              }
  
              // Special case for indents that start with newlines;
              // don't do any of the same-line-start multiline stuff.
              if ((multilineChild.child.type === 'indent') && (multilineChild.child.start.next.type === 'newline')) {
                  right.push(new this.view.draw.Point(this.bounds[line].right(), glueTop));
  
                  this.addTab(right, new this.view.draw.Point(this.bounds[line + 1].x +
                    this.view.opts.indentWidth +
                    this.view.opts.tabOffset, glueTop), true);
              } else {
                right.push(new this.view.draw.Point(multilineBounds.x, glueTop));
              }
  
              if (glueTop !== this.bounds[line + 1].y) {
                right.push(new this.view.draw.Point(multilineNode.bounds[(line - multilineChild.startLine) + 1].x, glueTop));
              }
              right.push(new this.view.draw.Point(multilineNode.bounds[(line - multilineChild.startLine) + 1].x, this.bounds[line + 1].y));
            }
          }
  
          // If necessary, add tab
          // at the bottom.
          if (this.shouldAddTab() && this.model.isLastOnLine() &&
                (this.carriageArrow === CARRIAGE_ARROW_NONE)) {
              this.addTab(right, new this.view.draw.Point(this.bounds[this.lineLength - 1].x + this.view.opts.tabOffset,
                this.bounds[this.lineLength - 1].bottom())
              );
            }
  
          const topLeftPoint = left[0];
  
          // Reverse the left and concatenate it with the right
          // to make a counterclockwise path
          const path = dedupe(left.reverse().concat(right));
  
          const newPath = [];
  
          for (let i = 0; i < path.length; i++) {
            const point = path[i];
            if ((i === 0) && !this.bevels.bottom) {
              newPath.push(point);
              continue;
            }
  
            if ((!this.bevels.top) && point.almostEquals(topLeftPoint)) {
              newPath.push(point);
              continue;
            }
  
            const next = path[__mod__((i + 1), path.length)];
            const prev = path[__mod__((i - 1), path.length)];
  
            if (((point.x === next.x) !== (point.y === next.y)) &&
               ((point.x === prev.x) !== (point.y === prev.y)) &&
               (point.from(prev).magnitude() >= (this.view.opts.bevelClip * 2)) &&
               (point.from(next).magnitude() >= (this.view.opts.bevelClip * 2))) {
              newPath.push(point.plus(point.from(prev).toMagnitude(-this.view.opts.bevelClip)));
              newPath.push(point.plus(point.from(next).toMagnitude(-this.view.opts.bevelClip)));
            } else {
              newPath.push(point);
            }
          }
  
          // Make a Path object out of these points
          this.path.setPoints(newPath);
          if (this.model.type === 'block') {
            this.path.style.fillColor = this.view.getColor(this.model.color);
          }
  
          // Add the add button if necessary
          if (this.model.buttons != null ? this.model.buttons.addButton : undefined) {
            const lastLine = this.bounds.length - 1;
            const lastRect = this.bounds[lastLine];
            const start = (lastRect.x + lastRect.width) - this.extraWidth;
            let top = (lastRect.y + (lastRect.height/2)) - (this.view.opts.buttonHeight/2);
            // Cases when last line is MULTILINE
            if (this.multilineChildrenData[lastLine] === MULTILINE_END) {
              let height;
              multilineChild = this.lineChildren[lastLine][0];
              multilineBounds = this.view.getViewNodeFor(multilineChild.child).bounds[lastLine - multilineChild.startLine];
              // If it is a G-Shape
              if (this.lineChildren[lastLine].length > 1) {
                height = multilineBounds.bottom() - lastRect.y;
                top = (lastRect.y + (height/2)) - (this.view.opts.buttonHeight/2);
              } else {
                height = lastRect.bottom() - multilineBounds.bottom();
                top = (multilineBounds.bottom() + (height/2)) - (this.view.opts.buttonHeight/2);
              }
            }
  
            this.addButtonPath.style.transform = `translate(${start}, ${top})`;
            this.addButtonPath.update();
            this.addButtonRect = new this.view.draw.Rectangle(start, top, this.view.opts.buttonWidth, this.view.opts.buttonHeight);
  
            this.elements.push(this.addButtonPath);
          }
  
          // Return it.
          return this.path;
        }
  
        // ## addTab
        // Add the tab graphic to a path in a given location.
        addTab(array, point) {
          // Rightmost point of the tab, where it begins to dip down.
          array.push(new this.view.draw.Point(point.x + this.view.opts.tabWidth,
            point.y)
          );
          // Dip down.
          array.push(new this.view.draw.Point(point.x +  (this.view.opts.tabWidth * (1 - this.view.opts.tabSideWidth)),
            point.y + this.view.opts.tabHeight)
          );
          // Bottom plateau.
          array.push(new this.view.draw.Point(point.x + (this.view.opts.tabWidth * this.view.opts.tabSideWidth),
            point.y + this.view.opts.tabHeight)
          );
          // Rise back up.
          array.push(new this.view.draw.Point(point.x, point.y));
          // Move over to the given corner itself.
          return array.push(point);
        }
  
        // ## addTabReverse
        // Add the tab in reverse order
        addTabReverse(array, point) {
          array.push(point);
          array.push(new this.view.draw.Point(point.x, point.y));
          array.push(new this.view.draw.Point(point.x + (this.view.opts.tabWidth * this.view.opts.tabSideWidth),
            point.y + this.view.opts.tabHeight)
          );
          array.push(new this.view.draw.Point(point.x +  (this.view.opts.tabWidth * (1 - this.view.opts.tabSideWidth)),
            point.y + this.view.opts.tabHeight)
          );
          return array.push(new this.view.draw.Point(point.x + this.view.opts.tabWidth,
            point.y)
          );
        }
  
        mark(style) {
          this.view.registerMark(this.model.id);
          this.markStyle = style;
          return this.focusAll();
        }
  
        unmark() { return this.markStyle = null; }
  
        // ## drawSelf
        // Draw our path, with applied
        // styles if necessary.
        drawSelf(style) {
          // We might want to apply some
          // temporary color changes,
          // so store the old colors
          if (style == null) { style = {}; }
          const oldFill = this.path.style.fillColor;
          const oldStroke = this.path.style.strokeColor;
  
          if (style.grayscale) {
            if (this.path.style.fillColor !== 'none') {
              this.path.style.fillColor = avgColor(this.path.style.fillColor, 0.5, '#888');
            }
            if (this.path.style.strokeColor !== 'none') {
              this.path.style.strokeColor = avgColor(this.path.style.strokeColor, 0.5, '#888');
            }
          }
  
          if (style.selected) {
            if (this.path.style.fillColor !== 'none') {
              this.path.style.fillColor = avgColor(this.path.style.fillColor, 0.7, '#00F');
            }
            if (this.path.style.strokeColor !== 'none') {
              this.path.style.strokeColor = avgColor(this.path.style.strokeColor, 0.7, '#00F');
            }
          }
  
          this.path.setMarkStyle(this.markStyle);
  
          this.path.update();
  
          // Unset all the things we changed
          this.path.style.fillColor = oldFill;
          this.path.style.strokeColor = oldStroke;
  
          return null;
        }
  
        // ## computeOwnDropArea
        // By default, we will not have a
        // drop area (not be droppable).
        computeOwnDropArea() {
          this.dropArea = null;
          if (this.highlightArea != null) {
            this.elements = this.elements.filter(function(x) { return x !== this.highlightArea; });
            this.highlightArea.destroy();
            return this.highlightArea = null;
          }
        }
      };
      ContainerViewNode.initClass();
  
      // # BlockViewNode
      BlockViewNode = class BlockViewNode extends ContainerViewNode {
        constructor() {
          super(...arguments);
          if (this.model.buttons != null ? this.model.buttons.addButton : undefined) {
            this.addButtonPath = new this.view.draw.Path([
                new this.view.draw.Point(0, 0),
                new this.view.draw.Point(0 + this.view.opts.buttonWidth, 0),
                new this.view.draw.Point(0 + this.view.opts.buttonWidth, 0 + this.view.opts.buttonHeight),
                new this.view.draw.Point(0, 0 + this.view.opts.buttonHeight)
            ], true, {
              fillColor: this.view.getColor(this.model.color),
              cssClass: 'droplet-button-path'
            });
  
            const textElement = new this.view.draw.Text(new this.view.draw.Point(
              (this.view.opts.buttonWidth - this.view.draw.measureCtx.measureText('+').width)/ 2,
              this.view.opts.buttonHeight - this.view.opts.textHeight
            ), '+');
            textElement.setParent(this.addButtonPath);
  
            this.addButtonPath.setParent(this.group);
            this.elements.push(this.addButtonPath);
  
            this.activeElements.push(textElement);
            this.activeElements.push(this.addButtonPath);
          }
        }
  
        computeMinDimensions() {
          if (this.computedVersion === this.model.version) {
            return null;
          }
  
          super.computeMinDimensions(...arguments);
  
          this.extraWidth = 0;
          if (this.model.buttons.addButton) {
            this.extraWidth += this.view.opts.buttonWidth + this.view.opts.buttonPadding;
          }
  
          if (this.model.buttons.subtractButton) {
            this.extraWidth += this.view.opts.buttonWidth + this.view.opts.buttonPadding;
          }
  
          // Blocks have a shape including a lego nubby "tab", and so
          // they need to be at least wide enough for tabWidth+tabOffset.
          for (let i = 0; i < this.minDimensions.length; i++) {
            const size = this.minDimensions[i];
            size.width = Math.max(size.width,
                this.view.opts.tabWidth + this.view.opts.tabOffset);
          }
  
          this.minDimensions[this.minDimensions.length - 1].width += this.extraWidth;
  
          return null;
        }
  
        shouldAddTab() {
          if ((this.model.parent != null) && this.view.hasViewNodeFor(this.model.parent) && !((this.model.parent.type === 'document') && this.model.parent.opts.roundedSingletons &&
              (this.model.start.prev === this.model.parent.start) && (this.model.end.next === this.model.parent.end))) {
            return (this.model.parent != null ? this.model.parent.type : undefined) !== 'socket';
          } else {
            return !(Array.from(this.model.classes).includes('mostly-value') ||
              Array.from(this.model.classes).includes('value-only'));
          }
        }
  
        computeOwnDropArea() {
          let destinationBounds, lastBoundsLeft, lastBoundsRight, parentViewNode;
          if (!['indent', 'document'].includes(this.model.parent != null ? this.model.parent.type : undefined)) { return; }
          // Our drop area is a puzzle-piece shaped path
          // of height opts.highlightAreaHeight and width
          // equal to our last line width,
          // positioned at the bottom of our last line.
          if (this.carriageArrow === CARRIAGE_ARROW_INDENT) {
            parentViewNode = this.view.getViewNodeFor(this.model.parent);
            destinationBounds = parentViewNode.bounds[1];
  
            this.dropPoint = new this.view.draw.Point(destinationBounds.x, destinationBounds.y);
            lastBoundsLeft = destinationBounds.x;
            lastBoundsRight = destinationBounds.right();
          } else if (this.carriageArrow === CARRIAGE_ARROW_SIDEALONG) {
            parentViewNode = this.view.getViewNodeFor(this.model.parent);
            destinationBounds = parentViewNode.bounds[1];
  
            this.dropPoint = new this.view.draw.Point(destinationBounds.x,
              this.bounds[this.lineLength - 1].bottom() + this.view.opts.padding);
            lastBoundsLeft = destinationBounds.x;
            lastBoundsRight = this.bounds[this.lineLength - 1].right();
          } else {
            this.dropPoint = new this.view.draw.Point(this.bounds[this.lineLength - 1].x, this.bounds[this.lineLength - 1].bottom());
            lastBoundsLeft = this.bounds[this.lineLength - 1].x;
            lastBoundsRight = this.bounds[this.lineLength - 1].right();
          }
  
          // Our highlight area is the a rectangle in the same place,
          // with a height that can be given by a different option.
  
          const highlightAreaPoints = [];
  
          highlightAreaPoints.push(new this.view.draw.Point(lastBoundsLeft, (this.dropPoint.y - (this.view.opts.highlightAreaHeight / 2)) + this.view.opts.bevelClip));
          highlightAreaPoints.push(new this.view.draw.Point(lastBoundsLeft + this.view.opts.bevelClip, this.dropPoint.y - (this.view.opts.highlightAreaHeight / 2)));
  
          this.addTabReverse(highlightAreaPoints, new this.view.draw.Point(lastBoundsLeft + this.view.opts.tabOffset, this.dropPoint.y - (this.view.opts.highlightAreaHeight / 2)));
  
          highlightAreaPoints.push(new this.view.draw.Point(lastBoundsRight - this.view.opts.bevelClip, this.dropPoint.y - (this.view.opts.highlightAreaHeight / 2)));
          highlightAreaPoints.push(new this.view.draw.Point(lastBoundsRight, (this.dropPoint.y - (this.view.opts.highlightAreaHeight / 2)) + this.view.opts.bevelClip));
  
          highlightAreaPoints.push(new this.view.draw.Point(lastBoundsRight, (this.dropPoint.y + (this.view.opts.highlightAreaHeight / 2)) - this.view.opts.bevelClip));
          highlightAreaPoints.push(new this.view.draw.Point(lastBoundsRight - this.view.opts.bevelClip, this.dropPoint.y + (this.view.opts.highlightAreaHeight / 2)));
  
          this.addTab(highlightAreaPoints, new this.view.draw.Point(lastBoundsLeft + this.view.opts.tabOffset, this.dropPoint.y + (this.view.opts.highlightAreaHeight / 2)));
  
          highlightAreaPoints.push(new this.view.draw.Point(lastBoundsLeft + this.view.opts.bevelClip, this.dropPoint.y + (this.view.opts.highlightAreaHeight / 2)));
          highlightAreaPoints.push(new this.view.draw.Point(lastBoundsLeft, (this.dropPoint.y + (this.view.opts.highlightAreaHeight / 2)) - this.view.opts.bevelClip));
  
          this.highlightArea.setPoints(highlightAreaPoints);
          return this.highlightArea.deactivate();
        }
      };
  
      // # SocketViewNode
      SocketViewNode = class SocketViewNode extends ContainerViewNode {
        static initClass() {
    
          this.prototype.shouldAddTab = NO;
        }
        constructor() {
          super(...arguments);
          if (this.view.opts.showDropdowns && (this.model.dropdown != null)) {
            if (this.dropdownElement == null) { this.dropdownElement = new this.view.draw.Path([], false, {fillColor: DROP_TRIANGLE_COLOR, cssClass: 'droplet-dropdown-arrow'}); }
            this.dropdownElement.deactivate();
  
            this.dropdownElement.setParent(this.group);
  
            this.elements.push(this.dropdownElement);
          }
        }
  
        isInvisibleSocket() {
          return ('' === this.model.emptyString) && ((this.model.start != null ? this.model.start.next : undefined) === this.model.end);
        }
  
        // ## computeDimensions (SocketViewNode)
        // Sockets have a couple exceptions to normal dimension computation.
        //
        // 1. Sockets have minimum dimensions even if empty.
        // 2. Sockets containing blocks mimic the block exactly.
        computeMinDimensions() {
          // Use cache if possible.
          if (this.computedVersion === this.model.version) {
            return null;
          }
  
          super.computeMinDimensions(...arguments);
  
          this.minDistanceToBase[0].above = Math.max(this.minDistanceToBase[0].above,
              this.view.opts.textHeight + this.view.opts.textPadding);
          this.minDistanceToBase[0].below = Math.max(this.minDistanceToBase[0].below,
              this.view.opts.textPadding);
  
          this.minDimensions[0].height =
              this.minDistanceToBase[0].above + this.minDistanceToBase[0].below;
  
          for (let dimension of Array.from(this.minDimensions)) {
            dimension.width = Math.max(dimension.width,
              this.isInvisibleSocket() ?
                this.view.opts.invisibleSocketWidth
              :
                this.view.opts.minSocketWidth);
  
            if (this.model.hasDropdown() && this.view.opts.showDropdowns) {
              dimension.width += helper.DROPDOWN_ARROW_WIDTH;
            }
          }
  
          return null;
        }
  
        // ## computeBoundingBoxX (SocketViewNode)
        computeBoundingBoxX(left, line) {
          return super.computeBoundingBoxX(left, line, (
            this.model.hasDropdown() && this.view.opts.showDropdowns ?
              helper.DROPDOWN_ARROW_WIDTH
            : 0
          )
          );
        }
  
        // ## computeGlue
        // Sockets have one exception to normal glue spacing computation:
        // sockets containing a block should **not** add padding to
        // the glue.
        computeGlue() {
          // Use cache if possible
          if ((this.computedVersion === this.model.version) &&
              !this.changedBoundingBox) {
            return this.glue;
          }
  
          // Do not add padding to the glue
          // if our child is a block.
          if (this.model.start.next.type === 'blockStart') {
            const view = this.view.getViewNodeFor(this.model.start.next.container);
            return this.glue = view.computeGlue();
  
          // Otherwise, decrement the glue version
          // to force super to recompute,
          // and call super.
          } else {
            return super.computeGlue(...arguments);
          }
        }
  
        // ## computeOwnPath (SocketViewNode)
        // Again, exception: sockets containing block
        // should mimic blocks exactly.
        //
        // Under normal circumstances this shouldn't
        // actually be an issue, but if we decide
        // to change the Block's path,
        // the socket should not have stuff sticking out,
        // and should hit-test properly.
        computeOwnPath() {
          // Use cache if possible.
          if ((this.computedVersion === this.model.version) &&
              !this.changedBoundingBox) {
            return this.path;
          }
  
          if (this.model.start.next.type === 'blockStart') {
            this.path.style.fill = 'none';
  
          // Otherwise, call super.
          } else {
            super.computeOwnPath(...arguments);
          }
  
          // If the socket is empty, make it invisible except
          // for mouseover
          if (('' === this.model.emptyString) && ((this.model.start != null ? this.model.start.next : undefined) === this.model.end)) {
            this.path.style.cssClass = 'droplet-socket-path droplet-empty-socket-path';
            this.path.style.fillColor = 'none';
          } else {
            this.path.style.cssClass = 'droplet-socket-path';
            this.path.style.fillColor = '#FFF';
          }
  
          return this.path;
        }
  
        // ## drawSelf (SocketViewNode)
        drawSelf(style) {
          if (style == null) { style = {}; }
          super.drawSelf(...arguments);
  
          if (this.model.hasDropdown() && this.view.opts.showDropdowns) {
            this.dropdownElement.setPoints([new this.view.draw.Point(this.bounds[0].x + helper.DROPDOWN_ARROW_PADDING,
                this.bounds[0].y + ((this.bounds[0].height - DROPDOWN_ARROW_HEIGHT) / 2)),
              new this.view.draw.Point((this.bounds[0].x + helper.DROPDOWN_ARROW_WIDTH) - helper.DROPDOWN_ARROW_PADDING,
                this.bounds[0].y + ((this.bounds[0].height - DROPDOWN_ARROW_HEIGHT) / 2)),
              new this.view.draw.Point(this.bounds[0].x + (helper.DROPDOWN_ARROW_WIDTH / 2),
                this.bounds[0].y + ((this.bounds[0].height + DROPDOWN_ARROW_HEIGHT) / 2))
            ]);
            this.dropdownElement.update();
  
            return this.activeElements.push(this.dropdownElement);
  
          } else if (this.dropdownElement != null) {
            this.activeElements = this.activeElements.filter(function(x) { return x !== this.dropdownElement; });
            return this.dropdownElement.deactivate();
          }
        }
  
        // ## computeOwnDropArea (SocketViewNode)
        // Socket drop areas are actually the same
        // shape as the sockets themselves, which
        // is different from most other
        // things.
        computeOwnDropArea() {
          if (this.model.start.next.type === 'blockStart') {
            this.dropArea = null;
            return this.highlightArea.deactivate();
          } else {
            this.dropPoint = this.bounds[0].upperLeftCorner();
            this.highlightArea.setPoints(this.path._points);
            this.highlightArea.style.strokeColor = '#FF0';
            this.highlightArea.style.fillColor = 'none';
            this.highlightArea.style.lineWidth = this.view.opts.highlightAreaHeight / 2;
            this.highlightArea.update();
            return this.highlightArea.deactivate();
          }
        }
      };
      SocketViewNode.initClass();
  
      // # IndentViewNode
      IndentViewNode = class IndentViewNode extends ContainerViewNode {
        constructor() {
          super(...arguments);
          this.lastFirstChildren = [];
          this.lastLastChildren = [];
        }
  
        // ## computeOwnPath
        // An Indent should also have no drawn
        // or hit-tested path.
        computeOwnPath() {}
  
        // ## computeChildren
        computeChildren() {
          let childView;
          super.computeChildren(...arguments);
  
          if (!arrayEq(this.lineChildren[0], this.lastFirstChildren) ||
                 !arrayEq(this.lineChildren[this.lineLength - 1], this.lastLastChildren)) {
            for (let childObj of Array.from(this.children)) {
              childView = this.view.getViewNodeFor(childObj.child);
  
              if (childView.topLineSticksToBottom || childView.bottomLineSticksToTop) {
                childView.invalidate = true;
              }
              if (childView.lineLength === 1) {
                childView.topLineSticksToBottom =
                  (childView.bottomLineSticksToTop = false);
              }
            }
          }
  
          for (var childRef of Array.from(this.lineChildren[0])) {
            childView = this.view.getViewNodeFor(childRef.child);
            if (!childView.topLineSticksToBottom) {
              childView.invalidate = true;
            }
            childView.topLineSticksToBottom = true;
          }
          for (childRef of Array.from(this.lineChildren[this.lineChildren.length - 1])) {
            childView = this.view.getViewNodeFor(childRef.child);
            if (!childView.bottomLineSticksToTop) {
              childView.invalidate = true;
            }
            childView.bottomLineSticksToTop = true;
          }
  
          return this.lineLength;
        }
  
  
        // ## computeDimensions (IndentViewNode)
        //
        // Give width to any empty lines
        // in the Indent.
        computeMinDimensions() {
          super.computeMinDimensions(...arguments);
  
          return (() => {
            const result = [];
            const iterable = this.minDimensions.slice(1);
            for (let line = 0; line < iterable.length; line++) {
              const size = iterable[line];
              if (size.width === 0) {
                result.push(size.width = this.view.opts.emptyLineWidth);
              }
            }
            return result;
          })();
        }
  
        // ## drawSelf
        //
        // Again, an Indent should draw nothing.
        drawSelf() {}
  
        // ## computeOwnDropArea
        //
        // Our drop area is a rectangle of
        // height dropAreaHeight and a width
        // equal to our first line width,
        // positioned at the top of our firs tline
        computeOwnDropArea() {
          const lastBounds = new this.view.draw.NoRectangle();
          if (this.model.start.next.type === 'newline') {
            this.dropPoint = this.bounds[1].upperLeftCorner();
            lastBounds.copy(this.bounds[1]);
          } else {
            this.dropPoint = this.bounds[0].upperLeftCorner();
            lastBounds.copy(this.bounds[0]);
          }
          lastBounds.width = Math.max(lastBounds.width, this.view.opts.indentDropAreaMinWidth);
  
          // Our highlight area is the a rectangle in the same place,
          // with a height that can be given by a different option.
  
          const highlightAreaPoints = [];
  
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.x, (lastBounds.y - (this.view.opts.highlightAreaHeight / 2)) + this.view.opts.bevelClip));
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.x + this.view.opts.bevelClip, lastBounds.y - (this.view.opts.highlightAreaHeight / 2)));
  
          this.addTabReverse(highlightAreaPoints, new this.view.draw.Point(lastBounds.x + this.view.opts.tabOffset, lastBounds.y - (this.view.opts.highlightAreaHeight / 2)));
  
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.right() - this.view.opts.bevelClip, lastBounds.y - (this.view.opts.highlightAreaHeight / 2)));
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.right(), (lastBounds.y - (this.view.opts.highlightAreaHeight / 2)) + this.view.opts.bevelClip));
  
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.right(), (lastBounds.y + (this.view.opts.highlightAreaHeight / 2)) - this.view.opts.bevelClip));
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.right() - this.view.opts.bevelClip, lastBounds.y + (this.view.opts.highlightAreaHeight / 2)));
  
          this.addTab(highlightAreaPoints, new this.view.draw.Point(lastBounds.x + this.view.opts.tabOffset, lastBounds.y + (this.view.opts.highlightAreaHeight / 2)));
  
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.x + this.view.opts.bevelClip, lastBounds.y + (this.view.opts.highlightAreaHeight / 2)));
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.x, (lastBounds.y + (this.view.opts.highlightAreaHeight / 2)) - this.view.opts.bevelClip));
  
          this.highlightArea.setPoints(highlightAreaPoints);
          return this.highlightArea.deactivate();
        }
      };
  
  
      // # DocumentViewNode
      // Represents a Document. Draws little, but
      // recurses.
      DocumentViewNode = class DocumentViewNode extends ContainerViewNode {
        constructor() { super(...arguments); }
  
        // ## computeOwnPath
        //
        computeOwnPath() {}
  
        // ## computeOwnDropArea
        //
        // Root documents
        // can be dropped at their beginning.
        computeOwnDropArea() {
          this.dropPoint = this.bounds[0].upperLeftCorner();
  
          const highlightAreaPoints = [];
  
          const lastBounds = new this.view.draw.NoRectangle();
          lastBounds.copy(this.bounds[0]);
          lastBounds.width = Math.max(lastBounds.width, this.view.opts.indentDropAreaMinWidth);
  
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.x, (lastBounds.y - (this.view.opts.highlightAreaHeight / 2)) + this.view.opts.bevelClip));
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.x + this.view.opts.bevelClip, lastBounds.y - (this.view.opts.highlightAreaHeight / 2)));
  
          this.addTabReverse(highlightAreaPoints, new this.view.draw.Point(lastBounds.x + this.view.opts.tabOffset, lastBounds.y - (this.view.opts.highlightAreaHeight / 2)));
  
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.right() - this.view.opts.bevelClip, lastBounds.y - (this.view.opts.highlightAreaHeight / 2)));
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.right(), (lastBounds.y - (this.view.opts.highlightAreaHeight / 2)) + this.view.opts.bevelClip));
  
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.right(), (lastBounds.y + (this.view.opts.highlightAreaHeight / 2)) - this.view.opts.bevelClip));
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.right() - this.view.opts.bevelClip, lastBounds.y + (this.view.opts.highlightAreaHeight / 2)));
  
          this.addTab(highlightAreaPoints, new this.view.draw.Point(lastBounds.x + this.view.opts.tabOffset, lastBounds.y + (this.view.opts.highlightAreaHeight / 2)));
  
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.x + this.view.opts.bevelClip, lastBounds.y + (this.view.opts.highlightAreaHeight / 2)));
          highlightAreaPoints.push(new this.view.draw.Point(lastBounds.x, (lastBounds.y + (this.view.opts.highlightAreaHeight / 2)) - this.view.opts.bevelClip));
  
          this.highlightArea.setPoints(highlightAreaPoints);
          this.highlightArea.deactivate();
  
          return null;
        }
      };
  
      // # TextViewNode
      //
      // TextViewNode does not extend ContainerViewNode.
      // We contain a @view.draw.TextElement to measure
      // bounding boxes and draw text.
      TextViewNode = class TextViewNode extends GenericViewNode {
        constructor(model1, view) {
          {
            // Hack: trick Babel/TypeScript into allowing this before super.
            if (false) { super(); }
            let thisFn = (() => { return this; }).toString();
            let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
            eval(`${thisName} = this;`);
          }
          this.model = model1;
          this.view = view;
          super(...arguments);
          this.textElement = new this.view.draw.Text(
            new this.view.draw.Point(0, 0),
            this.model.value
          );
          this.textElement.destroy();
          this.elements.push(this.textElement);
        }
  
        // ## computeChildren
        //
        // Text elements are one line
        // and contain no children (and thus
        // no multiline children, either)
        computeChildren() {
          this.multilineChildrenData = [NO_MULTILINE];
          return this.lineLength = 1;
        }
  
        // ## computeMinDimensions (TextViewNode)
        //
        // Set our dimensions to the measured dimensinos
        // of our text value.
        computeMinDimensions() {
          if (this.computedVersion === this.model.version) {
            return null;
          }
  
          this.textElement.point = new this.view.draw.Point(0, 0);
          this.textElement.value = this.model.value;
  
          const height = this.view.opts.textHeight;
          this.minDimensions[0] = new this.view.draw.Size(this.textElement.bounds().width, height);
          this.minDistanceToBase[0] = {above: height, below: 0};
  
          return null;
        }
  
        // ## computeBoundingBox (x and y)
        //
        // Assign the position of our textElement
        // to match our laid out bounding box position.
        computeBoundingBoxX(left, line) {
          this.textElement.point.x = left; return super.computeBoundingBoxX(...arguments);
        }
  
        computeBoundingBoxY(top, line) {
          this.textElement.point.y = top; return super.computeBoundingBoxY(...arguments);
        }
  
        // ## drawSelf
        //
        // Draw the text element itself.
        drawSelf(style, parent = null) {
          if (style == null) { style = {}; }
          this.textElement.update();
          if (style.noText) {
            this.textElement.deactivate();
          } else {
            this.textElement.activate();
          }
  
          if (parent != null) {
            return this.textElement.setParent(parent);
          }
        }
      };
    }
    constructor(ctx, opts) {
      this.ctx = ctx;
      if (opts == null) { opts = {}; }
      this.opts = opts;
      if (this.ctx == null) { this.ctx = document.createElementNS(SVG_STANDARD, 'svg'); }

      // @map maps Model objects
      // to corresponding View objects,
      // so that rerendering the same model
      // can be fast
      this.map = {};

      this.oldRoots = {};
      this.newRoots = {};
      this.auxiliaryMap = {};

      this.flaggedToDelete = {};
      this.unflaggedToDelete = {};

      this.marks = {};

      this.draw = new draw.Draw(this.ctx);

      // Apply default options
      for (let option in DEFAULT_OPTIONS) {
        if (!(option in this.opts)) {
          this.opts[option] = DEFAULT_OPTIONS[option];
        }
      }

      for (let color in DEFAULT_OPTIONS.colors) {
        if (!(color in this.opts.colors)) {
          this.opts.colors[color] = DEFAULT_OPTIONS.colors[color];
        }
      }
    }

    // Simple method for clearing caches
    clearCache() {
      this.beginDraw();
      return this.garbageCollect();
    }

    // Remove everything from the canvas
    clearFromCanvas() {
      this.beginDraw();
      return this.cleanupDraw();
    }

    // ## getViewNodeFor
    // Given a model object,
    // give the corresponding renderer object
    // under this View. If one does not exist,
    // create one, then preserve it in our map.
    getViewNodeFor(model) {
      if (model.id in this.map) {
        return this.map[model.id];
      } else {
        return this.createView(model);
      }
    }

    registerMark(id) {
      return this.marks[id] = true;
    }

    clearMarks() {
      for (let key in this.marks) {
        const val = this.marks[key];
        this.map[key].unmark();
      }
      return this.marks = {};
    }

    beginDraw() {
      return this.newRoots = {};
    }

    hasViewNodeFor(model) {
      return (model != null) && model.id in this.map;
    }

    getAuxiliaryNode(node) {
      if (node.id in this.auxiliaryMap) {
        return this.auxiliaryMap[node.id];
      } else {
        return this.auxiliaryMap[node.id] = new AuxiliaryViewNode(this, node);
      }
    }

    registerRoot(node) {
      if (node instanceof model.List && !(
         node instanceof model.Container)) {
        node.traverseOneLevel(head => {
          if (!(head instanceof model.NewlineToken)) {
            return this.registerRoot(head);
          }
        });
        return;
      }
      for (let id in this.newRoots) {
        const aux = this.newRoots[id];
        if (aux.model.hasParent(node)) {
          delete this.newRoots[id];
        } else if (node.hasParent(aux.model)) {
          return;
        }
      }

      return this.newRoots[node.id] = this.getAuxiliaryNode(node);
    }

    cleanupDraw() {
      let el;
      this.flaggedToDelete = {};
      this.unflaggedToDelete = {};

      for (var id in this.oldRoots) {
        el = this.oldRoots[id];
        if (!(id in this.newRoots)) {
          this.flag(el);
        }
      }

      for (id in this.newRoots) {
        el = this.newRoots[id];
        el.cleanup();
      }

      for (id in this.flaggedToDelete) {
        el = this.flaggedToDelete[id];
        if (id in this.unflaggedToDelete) {
          delete this.flaggedToDelete[id];
        }
      }

      return (() => {
        const result = [];
        for (id in this.flaggedToDelete) {
          el = this.flaggedToDelete[id];
          if (id in this.map) {
            result.push(this.map[id].hide());
          }
        }
        return result;
      })();
    }

    flag(auxiliaryNode) {
      return this.flaggedToDelete[auxiliaryNode.model.id] = auxiliaryNode;
    }

    unflag(auxiliaryNode) {
      return this.unflaggedToDelete[auxiliaryNode.model.id] = auxiliaryNode;
    }

    garbageCollect() {
      let el;
      this.cleanupDraw();

      for (var id in this.flaggedToDelete) {
        el = this.flaggedToDelete[id];
        if (id in this.map) {
          this.map[id].destroy();
          this.destroy(id);
        }
      }

      for (id in this.newRoots) {
        el = this.newRoots[id];
        el.update();
      }

      return this.oldRoots = this.newRoots;
    }

    destroy(id) {
      for (let child of Array.from(this.map[id].children)) {
        if ((this.map[child.child.id] != null) && !this.unflaggedToDelete[child.child.id]) {
          this.destroy(child.child.id);
        }
      }
      delete this.map[id];
      delete this.auxiliaryMap[id];
      return delete this.flaggedToDelete[id];
    }

    hasViewNodeFor(model) { return (model != null) && model.id in this.map; }

    // ## createView
    // Given a model object, create a renderer object
    // of the appropriate type.
    createView(entity) {
      if ((entity instanceof model.List) && !(entity instanceof model.Container)) {
        return new ListViewNode(entity, this);
      }
      switch (entity.type) {
        case 'text': return new TextViewNode(entity, this);
        case 'block': return new BlockViewNode(entity, this);
        case 'indent': return new IndentViewNode(entity, this);
        case 'socket': return new SocketViewNode(entity, this);
        case 'document': return new DocumentViewNode(entity, this);
      }
    }

    // Looks up a color name, or passes through a #hex color.
    getColor(color) {
      if (color && ('#' === color.charAt(0))) {
        return color;
      } else {
        return this.opts.colors[color] != null ? this.opts.colors[color] : '#ffffff';
      }
    }
  };
  View.initClass();
  return View;
})());

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

var avgColor = function(a, factor, b) {
  a = toRGB(a);
  b = toRGB(b);

  const newRGB = (Array.from(a).map((k, i) => (a[i] * factor) + (b[i] * (1 - factor))));

  return toHex(newRGB);
};

var dedupe = function(path) {
  path = path.filter((x, i) => !x.equals(path[__mod__((i - 1), path.length)]));

  path = path.filter((x, i) => !draw._collinear(path[__mod__((i - 1), path.length)], x, path[__mod__((i + 1), path.length)]));

  return path;
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
function __mod__(a, b) {
  a = +a;
  b = +b;
  return (a % b + b) % b;
}