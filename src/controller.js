/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS202: Simplify dynamic range loops
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Droplet controller.
//
// Copyright (c) 2014 Anthony Bau (dab1998@gmail.com)
// MIT License.

let Editor;
const helper = require('./helper');
const draw = require('./draw');
const model = require('./model');
const view = require('./view');

const QUAD = require('../vendor/quadtree.js');
const modes = require('./modes');

// ## Magic constants
const PALETTE_TOP_MARGIN = 5;
const PALETTE_MARGIN = 5;
const MIN_DRAG_DISTANCE = 1;
const PALETTE_LEFT_MARGIN = 5;
const DEFAULT_INDENT_DEPTH = '  ';
const ANIMATION_FRAME_RATE = 60;
const DISCOURAGE_DROP_TIMEOUT = 1000;
const MAX_DROP_DISTANCE = 100;
const CURSOR_WIDTH_DECREASE = 3;
const CURSOR_HEIGHT_DECREASE = 2;
const CURSOR_UNFOCUSED_OPACITY = 0.5;
const DEBUG_FLAG = false;
const DROPDOWN_SCROLLBAR_PADDING = 17;

const BACKSPACE_KEY = 8;
const TAB_KEY = 9;
const ENTER_KEY = 13;
const LEFT_ARROW_KEY = 37;
const UP_ARROW_KEY = 38;
const RIGHT_ARROW_KEY = 39;
const DOWN_ARROW_KEY = 40;
const Z_KEY = 90;
const Y_KEY = 89;

const META_KEYS = [91, 92, 93, 223, 224];
const CONTROL_KEYS = [17, 162, 163];
const GRAY_BLOCK_MARGIN = 5;
const GRAY_BLOCK_HANDLE_WIDTH = 15;
const GRAY_BLOCK_HANDLE_HEIGHT = 30;
const GRAY_BLOCK_COLOR = 'rgba(256, 256, 256, 0.5)';
const GRAY_BLOCK_BORDER = '#AAA';

let userAgent = '';
if ((typeof(window) !== 'undefined') && (window.navigator != null ? window.navigator.userAgent : undefined)) {
  ({ userAgent } = window.navigator);
}
const isOSX = /OS X/.test(userAgent);
const command_modifiers = isOSX ? META_KEYS : CONTROL_KEYS;
const command_pressed = function(e) { if (isOSX) { return e.metaKey; } else { return e.ctrlKey; } };

// FOUNDATION
// ================================

// ## Editor event bindings
//
// These are different events associated with the Editor
// that features will want to bind to.
const unsortedEditorBindings = {
  'populate': [],          // after an empty editor is created

  'resize': [],            // after the window is resized
  'resize_palette': [],    // after the palette is resized

  'redraw_main': [],       // whenever we need to redraw the main canvas
  'redraw_palette': [],    // repaint the graphics of the palette
  'rebuild_palette': [],   // redraw the paltte, both graphics and elements

  'mousedown': [],
  'mousemove': [],
  'mouseup': [],
  'dblclick': [],

  'keydown': [],
  'keyup': []
};

const editorBindings = {};

const { SVG_STANDARD } = helper;

const EMBOSS_FILTER_SVG =  `\
<svg xlmns="${SVG_STANDARD}">
  <filter id="dropShadow" x="0" y="0" width="200%" height="200%">
    <feOffset result="offOut" in="SourceAlpha" dx="5" dy="5" />
    <feGaussianBlur result="blurOut" in="offOut" stdDeviation="1" />
    <feBlend in="SourceGraphic" in2="blurOut" out="blendOut" mode="normal" />
    <feComposite in="blendOut" in2="SourceGraphic" k2="0.5" k3="0.5" operator="arithmetic" />
  </filter>
</svg>\
`;

// This hook function is for convenience,
// for features to add events that will occur at
// various times in the editor lifecycle.
const hook = (event, priority, fn) =>
  unsortedEditorBindings[event].push({
    priority,
    fn
  })
;

class Session {
  constructor(_main, _palette, _drag, options, standardViewSettings) { // TODO rearchitecture so that a session is independent of elements again
    // Option flags
    this.options = options;
    this.readOnly = false;
    this.paletteGroups = this.options.palette;
    this.showPaletteInTextMode = this.options.showPaletteInTextMode != null ? this.options.showPaletteInTextMode : false;
    this.paletteEnabled = this.options.enablePaletteAtStart != null ? this.options.enablePaletteAtStart : true;
    this.dropIntoAceAtLineStart = this.options.dropIntoAceAtLineStart != null ? this.options.dropIntoAceAtLineStart : false;
    this.allowFloatingBlocks = this.options.allowFloatingBlocks != null ? this.options.allowFloatingBlocks : true;

    // By default, attempt to preserve empty sockets when round-tripping
    if (this.options.preserveEmpty == null) { this.options.preserveEmpty = true; }

    // Mode
    this.options.mode = this.options.mode.replace(/$\/ace\/mode\//, '');

    if (this.options.mode in modes) {
      this.mode = new (modes[this.options.mode])(this.options.modeOptions);
    } else {
      this.mode = null;
    }

    // Instantiate an Droplet editor view
    this.view = new view.View(_main, helper.extend(standardViewSettings, this.options.viewSettings != null ? this.options.viewSettings : {}));
    this.paletteView = new view.View(_palette, helper.extend({}, standardViewSettings, this.options.viewSettings != null ? this.options.viewSettings : {}, {
      showDropdowns: this.options.showDropdownInPalette != null ? this.options.showDropdownInPalette : false
    }));
    this.dragView = new view.View(_drag, helper.extend({}, standardViewSettings, this.options.viewSettings != null ? this.options.viewSettings : {}));

    // ## Document initialization
    // We start off with an empty document
    this.tree = new model.Document(this.rootContext);

    // Line markings
    this.markedLines = {};
    this.markedBlocks = {}; this.nextMarkedBlockId = 0;
    this.extraMarks = {};

    // Undo/redo stack
    this.undoStack = [];
    this.redoStack = [];
    this.changeEventVersion = 0;

    // Floating blocks
    this.floatingBlocks = [];

    // Cursor
    this.cursor = new CrossDocumentLocation(0, new model.Location(0, 'documentStart'));

    // Scrolling

    this.viewports = {
      main: new draw.Rectangle(0, 0, 0, 0),
      palette: new draw.Rectangle(0, 0, 0, 0)
    };
    // Block toggle
    this.currentlyUsingBlocks = true;

    // Fonts
    this.fontSize = 15;
    this.fontFamily = 'Courier New';

    const metrics = helper.fontMetrics(this.fontFamily, this.fontSize);
    this.fontAscent = metrics.prettytop;
    this.fontDescent = metrics.descent;
    this.fontWidth = this.view.draw.measureCtx.measureText(' ').width;

    // Remembered sockets
    this.rememberedSockets = [];
  }
}

// ## The Editor Class
exports.Editor = (Editor = class Editor {
  constructor(aceEditor, options) {
    // ## DOM Population
    // This stage of ICE Editor construction populates the given wrapper
    // element with all the necessary ICE editor components.
    this.aceEditor = aceEditor;
    this.options = options;
    this.debugging = true;

    this.options = helper.deepCopy(this.options);

    // ### Wrapper
    // Create the div that will contain all the ICE Editor graphics

    this.dropletElement = document.createElement('div');
    this.dropletElement.className = 'droplet-wrapper-div';

    this.dropletElement.innerHTML = EMBOSS_FILTER_SVG;

    // We give our element a tabIndex so that it can be focused and capture keypresses.
    this.dropletElement.tabIndex = 0;

    // ### Canvases
    // Create the palette and main canvases

    // A measuring canvas for measuring text
    this.measureCanvas = document.createElement('canvas');
    this.measureCtx = this.measureCanvas.getContext('2d');

    // Main canvas first
    this.mainCanvas = document.createElementNS(SVG_STANDARD, 'svg');
    //@mainCanvasWrapper = document.createElementNS SVG_STANDARD, 'g'
    //@mainCanvas = document.createElementNS SVG_STANDARD, 'g'
    //@mainCanvas.appendChild @mainCanvasWrapper
    //@mainCanvasWrapper.appendChild @mainCanvas
    this.mainCanvas.setAttribute('class',  'droplet-main-canvas');
    this.mainCanvas.setAttribute('shape-rendering', 'optimizeSpeed');

    this.paletteWrapper = document.createElement('div');
    this.paletteWrapper.className = 'droplet-palette-wrapper';

    this.paletteElement = document.createElement('div');
    this.paletteElement.className = 'droplet-palette-element';
    this.paletteWrapper.appendChild(this.paletteElement);

    // Then palette canvas
    this.paletteCanvas = (this.paletteCtx = document.createElementNS(SVG_STANDARD, 'svg'));
    this.paletteCanvas.setAttribute('class',  'droplet-palette-canvas');

    this.paletteWrapper.style.position = 'absolute';
    this.paletteWrapper.style.left = '0px';
    this.paletteWrapper.style.top = '0px';
    this.paletteWrapper.style.bottom = '0px';
    this.paletteWrapper.style.width = '270px';

    // We will also have to initialize the
    // drag canvas.
    this.dragCanvas = (this.dragCtx = document.createElementNS(SVG_STANDARD, 'svg'));
    this.dragCanvas.setAttribute('class',  'droplet-drag-canvas');

    this.dragCanvas.style.left = '0px';
    this.dragCanvas.style.top = '0px';
    this.dragCanvas.style.transform = 'translate(-9999px,-9999px)';

    this.draw = new draw.Draw(this.mainCanvas);

    this.dropletElement.style.left = this.paletteWrapper.clientWidth + 'px';

    (this.draw.refreshFontCapital)();

    this.standardViewSettings = {
      padding: 5,
      indentWidth: 20,
      textHeight: helper.getFontHeight('Courier New', 15),
      indentTongueHeight: 20,
      tabOffset: 10,
      tabWidth: 15,
      tabHeight: 4,
      tabSideWidth: 1 / 4,
      dropAreaHeight: 20,
      indentDropAreaMinWidth: 50,
      emptySocketWidth: 20,
      emptyLineHeight: 25,
      highlightAreaHeight: 10,
      shadowBlur: 5,
      ctx: this.measureCtx,
      draw: this.draw
    };

    // We can be passed a div
    if (this.aceEditor instanceof Node) {
      this.wrapperElement = this.aceEditor;

      this.wrapperElement.style.position = 'absolute';
      this.wrapperElement.style.right =
        (this.wrapperElement.style.left =
        (this.wrapperElement.style.top =
        (this.wrapperElement.style.bottom = '0px')));
      this.wrapperElement.style.overflow = 'hidden';

      this.aceElement = document.createElement('div');
      this.aceElement.className = 'droplet-ace';

      this.wrapperElement.appendChild(this.aceElement);

      this.aceEditor = ace.edit(this.aceElement);

      this.aceEditor.setTheme('ace/theme/chrome');
      this.aceEditor.setFontSize(15);
      let acemode = this.options.mode;
      if (acemode === 'coffeescript') { acemode = 'coffee'; }
      this.aceEditor.getSession().setMode(`ace/mode/${acemode}`);
      this.aceEditor.getSession().setTabSize(2);

    } else {
      this.wrapperElement = document.createElement('div');
      this.wrapperElement.style.position = 'absolute';
      this.wrapperElement.style.right =
        (this.wrapperElement.style.left =
        (this.wrapperElement.style.top =
        (this.wrapperElement.style.bottom = '0px')));
      this.wrapperElement.style.overflow = 'hidden';

      this.aceElement = this.aceEditor.container;
      this.aceElement.className += ' droplet-ace';

      this.aceEditor.container.parentElement.appendChild(this.wrapperElement);
      this.wrapperElement.appendChild(this.aceEditor.container);
    }

    // Append populated divs
    this.wrapperElement.appendChild(this.dropletElement);
    this.wrapperElement.appendChild(this.paletteWrapper);

    this.wrapperElement.style.backgroundColor = '#FFF';

    this.currentlyAnimating = false;

    this.transitionContainer = document.createElement('div');
    this.transitionContainer.className = 'droplet-transition-container';

    this.dropletElement.appendChild(this.transitionContainer);

    if (this.options != null) {
      this.session = new Session(this.mainCanvas, this.paletteCanvas, this.dragCanvas, this.options, this.standardViewSettings);
      this.sessions = new helper.PairDict([
        [this.aceEditor.getSession(), this.session]
      ]);
    } else {
      this.session = null;
      this.sessions = new helper.PairDict([]);

      this.options = {
        extraBottomHeight: 10
      };
    }

    // Sessions are bound to other ace sessions;
    // on ace session change Droplet will also change sessions.
    this.aceEditor.on('changeSession', e => {
      if (this.sessions.contains(e.session)) {
        return this.updateNewSession(this.sessions.get(e.session));
      } else if (e.session._dropletSession != null) {
        this.updateNewSession(e.session._dropletSession);
        return this.sessions.set(e.session, e.session._dropletSession);
      } else {
        this.updateNewSession(null);
        return this.setEditorState(false);
      }
    });

    // Set up event bindings before creating a view
    this.bindings = {};

    const boundListeners = [];

    // Call all the feature bindings that are supposed
    // to happen now.
    for (let binding of Array.from(editorBindings.populate)) {
      binding.call(this);
    }

    // ## Resize
    // This stage of ICE editor construction, which is repeated
    // whenever the editor is resized, should adjust the sizes
    // of all the ICE editor componenents to fit the wrapper.
    window.addEventListener('resize', () => this.resizeBlockMode());

    // ## Tracker Events
    // We allow binding to the tracker element.
    const dispatchMouseEvent = event => {
      // Ignore mouse clicks that are not the left-button
      if ((event.type !== 'mousemove') && (event.which !== 1)) { return; }

      // Ignore mouse clicks whose target is the scrollbar
      if (event.target === this.mainScroller) { return; }

      const trackPoint = new this.draw.Point(event.clientX, event.clientY);

      // We keep a state object so that handlers
      // can know about each other.
      const state = {};

      // Call all the handlers.
      for (let handler of Array.from(editorBindings[event.type])) {
        handler.call(this, trackPoint, event, state);
      }

      // Stop mousedown event default behavior so that
      // we don't get bad selections
      if (event.type === 'mousedown') {
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        event.returnValue = false;
        return false;
      }
    };

    const dispatchKeyEvent = event => {
      // We keep a state object so that handlers
      // can know about each other.
      const state = {};

      // Call all the handlers.
      return Array.from(editorBindings[event.type]).map((handler) =>
        handler.call(this, event, state));
    };

    const object = {
        keydown: [this.dropletElement, this.paletteElement],
        keyup: [this.dropletElement, this.paletteElement],
        mousedown: [this.dropletElement, this.paletteElement, this.dragCover],
        dblclick: [this.dropletElement, this.paletteElement, this.dragCover],
        mouseup: [window],
        mousemove: [window] };
    for (let eventName in object) { const elements = object[eventName]; ((eventName, elements) => {
      return Array.from(elements).map((element) =>
        /^key/.test(eventName) ?
          element.addEventListener(eventName, dispatchKeyEvent)
        :
          element.addEventListener(eventName, dispatchMouseEvent));
    })(eventName, elements); }

    this.resizeBlockMode();

    // Now that we've populated everything, immediately redraw.
    this.redrawMain();
    this.rebuildPalette();

    // If we were given an unrecognized mode or asked to start in text mode,
    // flip into text mode here
    const useBlockMode = ((this.session != null ? this.session.mode : undefined) != null) && !this.options.textModeAtStart;
    // Always call @setEditorState to ensure palette is positioned properly
    this.setEditorState(useBlockMode);

    return this;
  }

  setMode(mode, modeOptions) {
    const modeClass = modes[mode];
    if (modeClass) {
      this.options.mode = mode;
      this.session.mode = new modeClass(modeOptions);
    } else {
      this.options.mode = null;
      this.session.mode = null;
    }
    return this.setValue(this.getValue());
  }

  getMode() {
    return this.options.mode;
  }

  setReadOnly(readOnly) {
    this.session.readOnly = readOnly;
    return this.aceEditor.setReadOnly(readOnly);
  }

  getReadOnly() {
    return this.session.readOnly;
  }

  // ## Foundational Resize
  // At the editor core, we will need to resize
  // all of the natively-added canvases, as well
  // as the wrapper element, whenever a resize
  // occurs.
  resizeTextMode() {
    this.resizeAceElement();
    this.aceEditor.resize(true);

    if (this.session != null) {
      this.resizePalette();
    }

  }

  resizeBlockMode() {
    if (this.session == null) { return; }

    this.resizeTextMode();

    this.dropletElement.style.height = `${this.wrapperElement.clientHeight}px`;
    if (this.session.paletteEnabled) {
      this.dropletElement.style.left = `${this.paletteWrapper.clientWidth}px`;
      this.dropletElement.style.width = `${this.wrapperElement.clientWidth - this.paletteWrapper.clientWidth}px`;
    } else {
      this.dropletElement.style.left = "0px";
      this.dropletElement.style.width = `${this.wrapperElement.clientWidth}px`;
    }

    //@resizeGutter()

    this.session.viewports.main.height = this.dropletElement.clientHeight;
    this.session.viewports.main.width = this.dropletElement.clientWidth - this.gutter.clientWidth;

    this.mainCanvas.setAttribute('width', this.dropletElement.clientWidth - this.gutter.clientWidth);

    this.mainCanvas.style.left = `${this.gutter.clientWidth}px`;
    this.transitionContainer.style.left = `${this.gutter.clientWidth}px`;

    this.resizePalette();
    this.resizePaletteHighlight();
    this.resizeNubby();
    this.resizeMainScroller();
    this.resizeDragCanvas();

    // Re-scroll and redraw main
    this.session.viewports.main.y = this.mainScroller.scrollTop;
    return this.session.viewports.main.x = this.mainScroller.scrollLeft;
  }

  resizePalette() {
    for (let binding of Array.from(editorBindings.resize_palette)) {
      binding.call(this);
    }

    if (!(this.session != null ? this.session.currentlyUsingBlocks : undefined) && !((this.session != null ? this.session.showPaletteInTextMode : undefined) || !(this.session != null ? this.session.paletteEnabled : undefined))) {
     this.paletteWrapper.style.left = `${-this.paletteWrapper.clientWidth}px`;
   }

    return this.rebuildPalette();
  }

  resize() {
    if ((this.session != null ? this.session.currentlyUsingBlocks : undefined)) { //TODO session
      return this.resizeBlockMode();
    } else {
      return this.resizeTextMode();
    }
  }

  updateNewSession(session) {
    this.session.view.clearFromCanvas();
    this.session.paletteView.clearFromCanvas();
    this.session.dragView.clearFromCanvas();
    this.session = session;

    if (session == null) { return; }

    // Force scroll into our position
    const offsetY = this.session.viewports.main.y;
    const offsetX = this.session.viewports.main.x;

    this.setEditorState(this.session.currentlyUsingBlocks);

    this.redrawMain();

    this.mainScroller.scrollTop = offsetY;
    this.mainScroller.scrollLeft = offsetX;

    return this.setPalette(this.session.paletteGroups);
  }

  hasSessionFor(aceSession) { return this.sessions.contains(aceSession); }

  bindNewSession(opts) {
    if (this.sessions.contains(this.aceEditor.getSession())) {
      throw new ArgumentError('Cannot bind a new session where one already exists.');
    } else {
      const session = new Session(this.mainCanvas, this.paletteCanvas, this.dragCanvas, opts, this.standardViewSettings);
      this.sessions.set(this.aceEditor.getSession(), session);
      this.session = session;
      this.aceEditor.getSession()._dropletSession = this.session;
      this.session.currentlyUsingBlocks = false;
      this.setValue_raw(this.getAceValue());
      this.setPalette(this.session.paletteGroups);
      return session;
    }
  }
});

Editor.prototype.clearCanvas = function(canvas) {}; // TODO remove and remove all references to

// RENDERING CAPABILITIES
// ================================

// ## Redraw
// There are two different redraw events, redraw_main and rebuild_palette,
// for redrawing the main canvas and palette canvas, respectively.
//
// Redrawing simply involves issuing a call to the View.

Editor.prototype.clearMain = function(opts) {}; // TODO remove and remove all references to

Editor.prototype.setTopNubbyStyle = function(height, color) {
  if (height == null) { height = 10; }
  if (color == null) { color = '#EBEBEB'; }
  this.nubbyHeight = Math.max(0, height); this.nubbyColor = color;

  if (this.topNubbyPath == null) { this.topNubbyPath = new this.draw.Path([], true); }
  this.topNubbyPath.activate();
  this.topNubbyPath.setParent(this.mainCanvas);

  const points = [];

  points.push(new this.draw.Point(this.mainCanvas.clientWidth, -5));
  points.push(new this.draw.Point(this.mainCanvas.clientWidth, height));

  points.push(new this.draw.Point(this.session.view.opts.tabOffset + this.session.view.opts.tabWidth, height));
  points.push(new this.draw.Point(this.session.view.opts.tabOffset + (this.session.view.opts.tabWidth * (1 - this.session.view.opts.tabSideWidth)),
      this.session.view.opts.tabHeight + height)
  );
  points.push(new this.draw.Point(this.session.view.opts.tabOffset + (this.session.view.opts.tabWidth * this.session.view.opts.tabSideWidth),
      this.session.view.opts.tabHeight + height)
  );
  points.push(new this.draw.Point(this.session.view.opts.tabOffset, height));

  points.push(new this.draw.Point(this.session.view.opts.bevelClip, height));
  points.push(new this.draw.Point(0, height + this.session.view.opts.bevelClip));
  points.push(new this.draw.Point(-5, height + this.session.view.opts.bevelClip));
  points.push(new this.draw.Point(-5, -5));

  this.topNubbyPath.setPoints(points);

  this.topNubbyPath.style.fillColor = color;

  return this.redrawMain();
};

Editor.prototype.resizeNubby = function() {
  return this.setTopNubbyStyle(this.nubbyHeight, this.nubbyColor);
};

Editor.prototype.initializeFloatingBlock = function(record, i) {
  record.renderGroup = new this.session.view.draw.Group();

  record.grayBox = new this.session.view.draw.NoRectangle();
  record.grayBoxPath = new this.session.view.draw.Path(
    [], false, {
      fillColor: GRAY_BLOCK_COLOR,
      strokeColor: GRAY_BLOCK_BORDER,
      lineWidth: 4,
      dotted: '8 5',
      cssClass: 'droplet-floating-container'
    }
  );
  record.startText = new this.session.view.draw.Text(
    (new this.session.view.draw.Point(0, 0)), this.session.mode.startComment
  );
  record.endText = new this.session.view.draw.Text(
    (new this.session.view.draw.Point(0, 0)), this.session.mode.endComment
  );

  for (let element of [record.grayBoxPath, record.startText, record.endText]) {
    element.setParent(record.renderGroup);
    element.activate();
  }

  this.session.view.getViewNodeFor(record.block).group.setParent(record.renderGroup);

  record.renderGroup.activate();

  // TODO maybe refactor into qualifiedFocus
  if (i < this.session.floatingBlocks.length) {
    return this.mainCanvas.insertBefore(record.renderGroup.element, this.session.floatingBlocks[i].renderGroup.element);
  } else {
    return this.mainCanvas.appendChild(record.renderGroup);
  }
};

Editor.prototype.drawFloatingBlock = function(record, startWidth, endWidth, rect, opts) {
  const blockView = this.session.view.getViewNodeFor(record.block);
  blockView.layout(record.position.x, record.position.y);

  const rectangle = new this.session.view.draw.Rectangle(); rectangle.copy(blockView.totalBounds);
  rectangle.x -= GRAY_BLOCK_MARGIN; rectangle.y -= GRAY_BLOCK_MARGIN;
  rectangle.width += 2 * GRAY_BLOCK_MARGIN; rectangle.height += 2 * GRAY_BLOCK_MARGIN;

  let bottomTextPosition = blockView.totalBounds.bottom() - blockView.distanceToBase[blockView.lineLength - 1].below - this.session.fontSize;

  if ((blockView.totalBounds.width - blockView.bounds[blockView.bounds.length - 1].width) < endWidth) {
    if (blockView.lineLength > 1) {
      rectangle.height += this.session.fontSize;
      bottomTextPosition = rectangle.bottom() - this.session.fontSize - 5;
    } else {
      rectangle.width += endWidth;
    }
  }

  if (!rectangle.equals(record.grayBox)) {
    let left;
    record.grayBox = rectangle;

    const oldBounds = (left = __guardMethod__(record.grayBoxPath, 'bounds', o => o.bounds())) != null ? left : new this.session.view.draw.NoRectangle();

    const startHeight = blockView.bounds[0].height + 10;

    const points = [];

    // Make the path surrounding the gray box (with rounded corners)
    points.push(new this.session.view.draw.Point(rectangle.right() - 5, rectangle.y));
    points.push(new this.session.view.draw.Point(rectangle.right(), rectangle.y + 5));
    points.push(new this.session.view.draw.Point(rectangle.right(), rectangle.bottom() - 5));
    points.push(new this.session.view.draw.Point(rectangle.right() - 5, rectangle.bottom()));

    if (blockView.lineLength > 1) {
      points.push(new this.session.view.draw.Point(rectangle.x + 5, rectangle.bottom()));
      points.push(new this.session.view.draw.Point(rectangle.x, rectangle.bottom() - 5));
    } else {
      points.push(new this.session.view.draw.Point(rectangle.x, rectangle.bottom()));
    }

    // Handle
    points.push(new this.session.view.draw.Point(rectangle.x, rectangle.y + startHeight));
    points.push(new this.session.view.draw.Point((rectangle.x - startWidth) + 5, rectangle.y + startHeight));
    points.push(new this.session.view.draw.Point(rectangle.x - startWidth, (rectangle.y + startHeight) - 5));
    points.push(new this.session.view.draw.Point(rectangle.x - startWidth, rectangle.y + 5));
    points.push(new this.session.view.draw.Point((rectangle.x - startWidth) + 5, rectangle.y));

    points.push(new this.session.view.draw.Point(rectangle.x, rectangle.y));

    record.grayBoxPath.setPoints(points);

    if (opts.boundingRectangle != null) {
      opts.boundingRectangle.unite(path.bounds());
      opts.boundingRectangle.unite(oldBounds);
      return this.redrawMain(opts);
    }
  }

  record.grayBoxPath.update();

  record.startText.point.x = blockView.totalBounds.x - startWidth;
  record.startText.point.y = (blockView.totalBounds.y + blockView.distanceToBase[0].above) - this.session.fontSize;
  record.startText.update();

  record.endText.point.x = record.grayBox.right() - endWidth - 5;
  record.endText.point.y = bottomTextPosition;
  record.endText.update();

  return blockView.draw(rect, {
    grayscale: false,
    selected: false,
    noText: false
  });
};

hook('populate', 0, function() {
  return this.currentlyDrawnFloatingBlocks = [];
});

Editor.prototype.redrawMain = function(opts) {
  if (opts == null) { opts = {}; }
  if (this.session == null) { return; }
  if (!this.currentlyAnimating_suprressRedraw) {

    this.session.view.beginDraw();

    // Clear the main canvas
    this.clearMain(opts);

    this.topNubbyPath.update();

    const rect = this.session.viewports.main;

    const options = {
      grayscale: false,
      selected: false,
      noText: (opts.noText != null ? opts.noText : false)
    };

    // Draw the new tree on the main context
    const layoutResult = this.session.view.getViewNodeFor(this.session.tree).layout(0, this.nubbyHeight);
    this.session.view.getViewNodeFor(this.session.tree).draw(rect, options);
    this.session.view.getViewNodeFor(this.session.tree).root();

    for (let i = 0; i < this.currentlyDrawnFloatingBlocks.length; i++) {
      const el = this.currentlyDrawnFloatingBlocks[i];
      if (!Array.from(this.session.floatingBlocks).includes(el.record)) {
        el.record.grayBoxPath.destroy();
        el.record.startText.destroy();
        el.record.endText.destroy();
      }
    }

    this.currentlyDrawnFloatingBlocks = [];

    // Draw floating blocks
    const startWidth = this.session.mode.startComment.length * this.session.fontWidth;
    const endWidth = this.session.mode.endComment.length * this.session.fontWidth;
    for (let record of Array.from(this.session.floatingBlocks)) {
      const element = this.drawFloatingBlock(record, startWidth, endWidth, rect, opts);
      this.currentlyDrawnFloatingBlocks.push({
        record
      });
    }

    // Draw the cursor (if exists, and is inserted)
    this.redrawCursors(); this.redrawHighlights();
    this.resizeGutter();

    for (let binding of Array.from(editorBindings.redraw_main)) {
      binding.call(this, layoutResult);
    }

    if (this.session.changeEventVersion !== this.session.tree.version) {
      this.session.changeEventVersion = this.session.tree.version;

      this.fireEvent('change', []);
    }

    this.session.view.cleanupDraw();

    if (!this.alreadyScheduledCleanup) {
      this.alreadyScheduledCleanup = true;
      setTimeout((() => {
        this.alreadyScheduledCleanup = false;
        if (this.session != null) {
          return this.session.view.garbageCollect();
        }
      }
      ), 0);
    }

    return null;
  }
};

Editor.prototype.redrawHighlights = function() {
  this.redrawCursors();
  this.redrawLassoHighlight();

  // If there is an block that is being dragged,
  // draw it in gray
  if ((this.draggingBlock != null) && this.inDisplay(this.draggingBlock)) {
    return this.session.view.getViewNodeFor(this.draggingBlock).draw(new this.draw.Rectangle(
      this.session.viewports.main.x,
      this.session.viewports.main.y,
      this.session.viewports.main.width,
      this.session.viewports.main.height
    ), {grayscale: true});
  }
};

Editor.prototype.clearCursorCanvas = function() {
  this.textCursorPath.deactivate();
  return this.cursorPath.deactivate();
};

Editor.prototype.redrawCursors = function() {
  if (this.session == null) { return; }
  this.clearCursorCanvas();

  if (this.cursorAtSocket()) {
    return this.redrawTextHighlights();
  } else if (this.lassoSelection == null) {
    return this.drawCursor();
  }
};

Editor.prototype.drawCursor = function() { return this.strokeCursor(this.determineCursorPosition()); };

Editor.prototype.clearPalette = function() {}; // TODO remove and remove all references to

Editor.prototype.clearPaletteHighlightCanvas = function() {}; // TODO remove and remove all references to

Editor.prototype.redrawPalette = function() {
  if ((this.session != null ? this.session.currentPaletteBlocks : undefined) == null) { return; }

  this.clearPalette();

  this.session.paletteView.beginDraw();

  // We will construct a vertical layout
  // with padding for the palette blocks.
  // To do this, we will need to keep track
  // of the last bottom edge of a palette block.
  let lastBottomEdge = PALETTE_TOP_MARGIN;

  for (let entry of Array.from(this.session.currentPaletteBlocks)) {
    // Layout this block
    const paletteBlockView = this.session.paletteView.getViewNodeFor(entry.block);
    paletteBlockView.layout(PALETTE_LEFT_MARGIN, lastBottomEdge);

    // Render the block
    paletteBlockView.draw();
    paletteBlockView.group.setParent(this.paletteCtx);

    const element = document.createElementNS(SVG_STANDARD, 'title');
    element.innerHTML = entry.title != null ? entry.title : entry.block.stringify();
    paletteBlockView.group.element.appendChild(element);

    paletteBlockView.group.element.setAttribute('data-id', entry.id);

    // Update lastBottomEdge
    lastBottomEdge = paletteBlockView.getBounds().bottom() + PALETTE_MARGIN;
  }

  for (let binding of Array.from(editorBindings.redraw_palette)) {
    binding.call(this);
  }

  this.paletteCanvas.style.height = lastBottomEdge + 'px';

  return this.session.paletteView.garbageCollect();
};

Editor.prototype.rebuildPalette = function() {
  if ((this.session != null ? this.session.currentPaletteBlocks : undefined) == null) { return; }
  this.redrawPalette();
  return Array.from(editorBindings.rebuild_palette).map((binding) =>
    binding.call(this));
};

// MOUSE INTERACTION WRAPPERS
// ================================

// These are some common operations we need to do with
// the mouse that will be convenient later.

Editor.prototype.absoluteOffset = function(el) {
  const point = new this.draw.Point(el.offsetLeft, el.offsetTop);
  el = el.offsetParent;

  while ((el !== document.body) && !(el == null)) {
    point.x += el.offsetLeft - el.scrollLeft;
    point.y += el.offsetTop - el.scrollTop;

    el = el.offsetParent;
  }

  return point;
};

// ### Conversion functions
// Convert a point relative to the page into
// a point relative to one of the two canvases.
Editor.prototype.trackerPointToMain = function(point) {
  if ((this.mainCanvas.parentElement == null)) {
    return new this.draw.Point(NaN, NaN);
  }
  const gbr = this.mainCanvas.getBoundingClientRect();
  return new this.draw.Point(point.x - gbr.left,
                  point.y - gbr.top);
};

Editor.prototype.trackerPointToPalette = function(point) {
  if ((this.paletteCanvas.parentElement == null)) {
    return new this.draw.Point(NaN, NaN);
  }
  const gbr = this.paletteCanvas.getBoundingClientRect();
  return new this.draw.Point(point.x - gbr.left,
                  point.y - gbr.top);
};

Editor.prototype.trackerPointIsInElement = function(point, element) {
  if ((this.session == null) || this.session.readOnly) {
    return false;
  }
  if ((element.parentElement == null)) {
    return false;
  }
  const gbr = element.getBoundingClientRect();
  return (point.x >= gbr.left) && (point.x < gbr.right) &&
         (point.y >= gbr.top) && (point.y < gbr.bottom);
};

Editor.prototype.trackerPointIsInMain = function(point) {
  return this.trackerPointIsInElement(point, this.mainCanvas);
};

Editor.prototype.trackerPointIsInMainScroller = function(point) {
  return this.trackerPointIsInElement(point, this.mainScroller);
};

Editor.prototype.trackerPointIsInGutter = function(point) {
  return this.trackerPointIsInElement(point, this.gutter);
};

Editor.prototype.trackerPointIsInPalette = function(point) {
  return this.trackerPointIsInElement(point, this.paletteCanvas);
};

Editor.prototype.trackerPointIsInAce = function(point) {
  return this.trackerPointIsInElement(point, this.aceElement);
};


// ### hitTest
// Simple function for going through a linked-list block
// and seeing what the innermost child is that we hit.
Editor.prototype.hitTest = function(point, block, view) {
  if (view == null) { ({ view } = this.session); }
  if (this.session.readOnly) {
    return null;
  }

  let head = block.start;
  let seek = block.end;
  let result = null;

  while (head !== seek) {
    if ((head.type === 'blockStart') && view.getViewNodeFor(head.container).path.contains(point)) {
      result = head.container;
      seek = head.container.end;
    }
    head = head.next;
  }

  // If we had a child hit, return it.
  return result;
};

hook('mousedown', 10, function() {
  const x = document.body.scrollLeft;
  const y = document.body.scrollTop;
  this.dropletElement.focus();
  return window.scrollTo(x, y);
});

Editor.prototype.removeBlankLines = function() {
  // If we have blank lines at the end,
  // get rid of them
  let tail;
  let head = (tail = this.session.tree.end.prev);
  while ((head != null ? head.type : undefined) === 'newline') {
    head = head.prev;
  }

  if (head.type === 'newline') {
    return this.spliceOut(new model.List(head, tail));
  }
};

// UNDO STACK SUPPORT
// ================================

// We must declare a few
// fields a populate time

// Now we hook to ctrl-z to undo.
hook('keydown', 0, function(event, state) {
  if ((event.which === Z_KEY) && event.shiftKey && command_pressed(event)) {
    return this.redo();
  } else if ((event.which === Z_KEY) && command_pressed(event)) {
    return this.undo();
  } else if ((event.which === Y_KEY) && command_pressed(event)) {
    return this.redo();
  }
});

class EditorState {
  constructor(root, floats) {
    this.root = root;
    this.floats = floats;
  }

  equals(other) {
    if ((this.root !== other.root) || (this.floats.length !== other.floats.length)) { return false; }
    for (let i = 0; i < this.floats.length; i++) {
      const el = this.floats[i];
      if (!el.position.equals(other.floats[i].position) || (el.string !== other.floats[i].string)) { return false; }
    }
    return true;
  }

  toString() { return JSON.stringify({
    root: this.root, floats: this.floats
  }); }
}

Editor.prototype.getSerializedEditorState = function() {
  return new EditorState(this.session.tree.stringify(), this.session.floatingBlocks.map(x => ({
    position: x.position,
    string: x.block.stringify()
  }) ));
};

Editor.prototype.clearUndoStack = function() {
  if (this.session == null) { return; }

  this.session.undoStack.length = 0;
  return this.session.redoStack.length = 0;
};

Editor.prototype.undo = function() {
  if (this.session == null) { return; }

  // Don't allow a socket to be highlighted during
  // an undo operation
  this.setCursor(this.session.cursor, (x => x.type !== 'socketStart'));

  const currentValue = this.getSerializedEditorState();

  while ((this.session.undoStack.length !== 0) &&
      (!(this.session.undoStack[this.session.undoStack.length - 1] instanceof CapturePoint) ||
      !!this.getSerializedEditorState().equals(currentValue))) {
    const operation = this.popUndo();
    if (operation instanceof FloatingOperation) {
      this.performFloatingOperation(operation, 'backward');
    } else {
      if (!(operation instanceof CapturePoint)) { this.getDocument(operation.document).perform(
        operation.operation, 'backward', this.getPreserves(operation.document)
      ); }
    }
  }

  // Set the the remembered socket contents to the state it was in
  // at this point in the undo stack.
  if (this.session.undoStack[this.session.undoStack.length - 1] instanceof CapturePoint) {
    this.session.rememberedSockets = this.session.undoStack[this.session.undoStack.length - 1].rememberedSockets.map(x => x.clone());
  }

  this.popUndo();
  this.correctCursor();
  this.redrawMain();
};

Editor.prototype.pushUndo = function(operation) {
  this.session.redoStack.length = 0;
  return this.session.undoStack.push(operation);
};

Editor.prototype.popUndo = function() {
  const operation = this.session.undoStack.pop();
  if (operation != null) { this.session.redoStack.push(operation); }
  return operation;
};

Editor.prototype.popRedo = function() {
  const operation = this.session.redoStack.pop();
  if (operation != null) { this.session.undoStack.push(operation); }
  return operation;
};

Editor.prototype.redo = function() {
  const currentValue = this.getSerializedEditorState();

  while ((this.session.redoStack.length !== 0) &&
      (!(this.session.redoStack[this.session.redoStack.length - 1] instanceof CapturePoint) ||
      !!this.getSerializedEditorState().equals(currentValue))) {
    const operation = this.popRedo();
    if (operation instanceof FloatingOperation) {
      this.performFloatingOperation(operation, 'forward');
    } else {
      if (!(operation instanceof CapturePoint)) { this.getDocument(operation.document).perform(
        operation.operation, 'forward', this.getPreserves(operation.document)
      ); }
    }
  }

  // Set the the remembered socket contents to the state it was in
  // at this point in the undo stack.
  if (this.session.undoStack[this.session.undoStack.length - 1] instanceof CapturePoint) {
    this.session.rememberedSockets = this.session.undoStack[this.session.undoStack.length - 1].rememberedSockets.map(x => x.clone());
  }

  this.popRedo();
  this.redrawMain();
};

// ## undoCapture and CapturePoint ##
// A CapturePoint is a sentinel indicating that the undo stack
// should stop when the user presses Ctrl+Z or Ctrl+Y. Each CapturePoint
// also remembers the @rememberedSocket state at the time it was placed,
// to preserved remembered socket contents across undo and redo.
Editor.prototype.undoCapture = function() {
  return this.pushUndo(new CapturePoint(this.session.rememberedSockets));
};

class CapturePoint {
  constructor(rememberedSockets) {
    this.rememberedSockets = rememberedSockets.map(x => x.clone());
  }
}

// BASIC BLOCK MOVE SUPPORT
// ================================

Editor.prototype.getPreserves = function(dropletDocument) {
  if (dropletDocument instanceof model.Document) {
    dropletDocument = this.documentIndex(dropletDocument);
  }

  let array = [this.session.cursor];

  array = array.concat(this.session.rememberedSockets.map(
    x => x.socket)
  );

  return array.filter(location => location.document === dropletDocument).map(location => location.location);
};

Editor.prototype.spliceOut = function(node, container = null) {
  // Make an empty list if we haven't been
  // passed one
  if (!(node instanceof model.List)) {
    node = new model.List(node, node);
  }

  let operation = null;

  const dropletDocument = node.getDocument();

  const { parent } = node;

  if (dropletDocument != null) {
    let i, socket;
    operation = node.getDocument().remove(node, this.getPreserves(dropletDocument));
    this.pushUndo({operation, document: this.getDocuments().indexOf(dropletDocument)});

    // If we are removing a block from a socket, and the socket is in our
    // dictionary of remembered socket contents, repopulate the socket with
    // its old contents.
    if (((parent != null ? parent.type : undefined) === 'socket') && (node.start.type === 'blockStart')) {
      for (i = 0; i < this.session.rememberedSockets.length; i++) {
        socket = this.session.rememberedSockets[i];
        if (this.fromCrossDocumentLocation(socket.socket) === parent) {
          this.session.rememberedSockets.splice(i, 0);
          this.populateSocket(parent, socket.text);
          break;
        }
      }
    }

    // Remove the floating dropletDocument if it is now
    // empty
    if (dropletDocument.start.next === dropletDocument.end) {
      for (i = 0; i < this.session.floatingBlocks.length; i++) {
        const record = this.session.floatingBlocks[i];
        if (record.block === dropletDocument) {
          this.pushUndo(new FloatingOperation(i, record.block, record.position, 'delete'));

          // If the cursor's document is about to vanish,
          // put it back in the main tree.
          if (this.session.cursor.document === (i + 1)) {
            this.setCursor(this.session.tree.start);
          }

          if (this.session.cursor.document > (i + 1)) {
            this.session.cursor.document -= 1;
          }

          this.session.floatingBlocks.splice(i, 1);

          for (socket of Array.from(this.session.rememberedSockets)) {
            if (socket.socket.document > i) {
              socket.socket.document -= 1;
            }
          }

          break;
        }
      }
    }
  } else if (container != null) {
    // No document, so try to remove from container if it was supplied
    container.remove(node);
  }

  this.prepareNode(node, null);
  this.correctCursor();
  return operation;
};

Editor.prototype.spliceIn = function(node, location) {
  // Track changes in the cursor by temporarily
  // using a pointer to it
  let container = location.container != null ? location.container : location.parent;
  if (container.type === 'block') {
    container = container.parent;
  } else if ((container.type === 'socket') &&
      (container.start.next !== container.end)) {
    if (this.documentIndex(container) !== -1) {
      // If we're splicing into a socket found in a document and it already has
      // something in it, remove it. Additionally, remember the old
      // contents in @session.rememberedSockets for later repopulation if they take
      // the block back out.
      this.session.rememberedSockets.push(new RememberedSocketRecord(
        this.toCrossDocumentLocation(container),
        container.textContent()
      )
      );
    }
    this.spliceOut((new model.List(container.start.next, container.end.prev)), container);
  }

  const dropletDocument = location.getDocument();

  this.prepareNode(node, container);

  if (dropletDocument != null) {
    const operation = dropletDocument.insert(location, node, this.getPreserves(dropletDocument));
    this.pushUndo({operation, document: this.getDocuments().indexOf(dropletDocument)});
    this.correctCursor();
    return operation;
  } else {
    // No document, so just insert into container
    container.insert(location, node);
    return null;
  }
};

class RememberedSocketRecord {
  constructor(socket, text) {
    this.socket = socket;
    this.text = text;
  }

  clone() {
    return new RememberedSocketRecord(
      this.socket.clone(),
      this.text
    );
  }
}

Editor.prototype.replace = function(before, after, updates) {
  if (updates == null) { updates = []; }
  const dropletDocument = before.start.getDocument();
  if (dropletDocument != null) {
    const operation = dropletDocument.replace(before, after, updates.concat(this.getPreserves(dropletDocument)));
    this.pushUndo({operation, document: this.documentIndex(dropletDocument)});
    this.correctCursor();
    return operation;
  } else {
    return null;
  }
};

Editor.prototype.adjustPosToLineStart = function(pos) {
  const line = this.aceEditor.session.getLine(pos.row);
  if (pos.row === (this.aceEditor.session.getLength() - 1)) {
    pos.column = (pos.column >= (line.length / 2)) ? line.length : 0;
  } else {
    pos.column = 0;
  }
  return pos;
};

Editor.prototype.correctCursor = function() {
  let cursor = this.fromCrossDocumentLocation(this.session.cursor);
  if (!this.validCursorPosition(cursor)) {
    while (!(cursor == null) && (!this.validCursorPosition(cursor) || (cursor.type === 'socketStart'))) {
      cursor = cursor.next;
    }
    if (cursor == null) { cursor = this.fromCrossDocumentLocation(this.session.cursor); }
    while (!(cursor == null) && (!this.validCursorPosition(cursor) || (cursor.type === 'socketStart'))) {
      cursor = cursor.prev;
    }
    return this.session.cursor = this.toCrossDocumentLocation(cursor);
  }
};

Editor.prototype.prepareNode = function(node, context) {
  if (node instanceof model.Container) {
    let classes, left, trailing;
    let leading = node.getLeadingText();
    if (node.start.next === node.end.prev) {
      trailing = null;
    } else {
      trailing = node.getTrailingText();
    }

    [leading, trailing, classes] = Array.from(this.session.mode.parens(leading, trailing, node.getReader(),
      (left = __guardMethod__(context, 'getReader', o => o.getReader())) != null ? left : null));

    node.setLeadingText(leading); return node.setTrailingText(trailing);
  }
};


// At population-time, we will
// want to set up a few fields.
hook('populate', 0, function() {
  this.clickedPoint = null;
  this.clickedBlock = null;
  this.clickedBlockPaletteEntry = null;

  this.draggingBlock = null;
  this.draggingOffset = null;

  this.lastHighlight = (this.lastHighlightPath = null);

  // And the canvas for drawing highlights
  this.highlightCanvas = (this.highlightCtx = document.createElementNS(SVG_STANDARD, 'g'));

  // We append it to the tracker element,
  // so that it can appear in front of the scrollers.
  //@dropletElement.appendChild @dragCanvas
  //document.body.appendChild @dragCanvas
  this.wrapperElement.appendChild(this.dragCanvas);
  return this.mainCanvas.appendChild(this.highlightCanvas);
});

Editor.prototype.clearHighlightCanvas = function() {
  return [this.textCursorPath].map((path) =>
    path.deactivate());
};

// Utility function for clearing the drag canvas,
// an operation we will be doing a lot.
Editor.prototype.clearDrag = function() {
  return this.clearHighlightCanvas();
};

// On resize, we will want to size the drag canvas correctly.
Editor.prototype.resizeDragCanvas = function() {
  this.dragCanvas.style.width = `${0}px`;
  this.dragCanvas.style.height = `${0}px`;

  this.highlightCanvas.style.width = `${this.dropletElement.clientWidth - this.gutter.clientWidth}px`;

  this.highlightCanvas.style.height = `${this.dropletElement.clientHeight}px`;

  return this.highlightCanvas.style.left = `${this.mainCanvas.offsetLeft}px`;
};


Editor.prototype.getDocuments = function() {
  const documents = [this.session.tree];
  for (let i = 0; i < this.session.floatingBlocks.length; i++) {
    const el = this.session.floatingBlocks[i];
    documents.push(el.block);
  }
  return documents;
};

Editor.prototype.getDocument = function(n) {
  if (n === 0) { return this.session.tree;
  } else { return this.session.floatingBlocks[n - 1].block; }
};

Editor.prototype.documentIndex = function(block) {
  return this.getDocuments().indexOf(block.getDocument());
};

Editor.prototype.fromCrossDocumentLocation = function(location) {
  return this.getDocument(location.document).getFromLocation(location.location);
};

Editor.prototype.toCrossDocumentLocation = function(block) {
  return new CrossDocumentLocation(this.documentIndex(block), block.getLocation());
};

// On mousedown, we will want to
// hit test blocks in the root tree to
// see if we want to move them.
//
// We do not do anything until the user
// drags their mouse five pixels
hook('mousedown', 1, function(point, event, state) {
  // If someone else has already taken this click, pass.
  if (state.consumedHitTest) { return; }

  // If it's not in the main pane, pass.
  if (!this.trackerPointIsInMain(point)) { return; }

  // Hit test against the tree.
  const mainPoint = this.trackerPointToMain(point);

  const iterable = this.getDocuments();
  for (let j = iterable.length - 1, i = j; j >= 0; j--, i = j) {
    // First attempt handling text input
    const dropletDocument = iterable[i];
    if (this.handleTextInputClick(mainPoint, dropletDocument)) {
      state.consumedHitTest = true;
      return;
    } else if ((this.session.cursor.document === i) && this.cursorAtSocket()) {
      this.setCursor(this.session.cursor, (token => token.type !== 'socketStart'));
    }

    const hitTestResult = this.hitTest(mainPoint, dropletDocument);

    // Produce debugging output
    if (this.debugging && event.shiftKey) {
      let line = null;
      const node = this.session.view.getViewNodeFor(hitTestResult);
      for (i = 0; i < node.bounds.length; i++) {
        const box = node.bounds[i];
        if (box.contains(mainPoint)) {
          line = i;
          break;
        }
      }
      this.dumpNodeForDebug(hitTestResult, line);
    }

    // If it came back positive,
    // deal with the click.
    if (hitTestResult != null) {
      // Record the hit test result (the block we want to pick up)
      this.clickedBlock = hitTestResult;
      this.clickedBlockPaletteEntry = null;

      // Move the cursor somewhere nearby
      this.setCursor(this.clickedBlock.start.next);

      // Record the point at which is was clicked (for clickedBlock->draggingBlock)
      this.clickedPoint = point;

      // Signify to any other hit testing
      // handlers that we have already consumed
      // the hit test opportunity for this event.
      state.consumedHitTest = true;
      return;

    } else if (i > 0) {
      const record = this.session.floatingBlocks[i - 1];
      if ((record.grayBoxPath != null) && record.grayBoxPath.contains(this.trackerPointToMain(point))) {
        this.clickedBlock = new model.List(record.block.start.next, record.block.end.prev);
        this.clickedPoint = point;

        this.session.view.getViewNodeFor(this.clickedBlock).absorbCache(); // TODO MERGE inspection

        state.consumedHitTest = true;

        this.redrawMain();
        return;
      }
    }
  }
});

// If the user clicks inside a block
// and the block contains a button
// which is either add or subtract button
// call the handleButton callback
hook('mousedown', 4, function(point, event, state) {
  if (state.consumedHitTest) { return; }
  if (!this.trackerPointIsInMain(point)) { return; }

  const mainPoint = this.trackerPointToMain(point);

  //Buttons aren't clickable in a selection
  if ((this.lassoSelection != null) && (this.hitTest(mainPoint, this.lassoSelection) != null)) { return; }

  const hitTestResult = this.hitTest(mainPoint, this.session.tree);

  if (hitTestResult != null) {
    const hitTestBlock = this.session.view.getViewNodeFor(hitTestResult);
    const str = hitTestResult.stringifyInPlace();

    if ((hitTestBlock.addButtonRect != null) && hitTestBlock.addButtonRect.contains(mainPoint)) {
      const line = this.session.mode.handleButton(str, 'add-button', hitTestResult.getReader());
      if ((line != null ? line.length : undefined) >= 0) {
        this.populateBlock(hitTestResult, line);
        this.redrawMain();
      }
      return state.consumedHitTest = true;
    }
    /* TODO
    else if hitTestBlock.subtractButtonRect? and hitTestBlock.subtractButtonRect.contains mainPoint
      line = @session.mode.handleButton str, 'subtract-button', hitTestResult.getReader()
      if line?.length >= 0
        @populateBlock hitTestResult, line
        @redrawMain()
      state.consumedHitTest = true
    */
  }
});

// If the user lifts the mouse
// before they have dragged five pixels,
// abort stuff.
hook('mouseup', 0, function(point, event, state) {
  // @clickedBlock and @clickedPoint should will exist iff
  // we have dragged not yet more than 5 pixels.
  //
  // To abort, all we need to do is null.
  if (this.clickedBlock != null) {
    this.clickedBlock = null;
    return this.clickedPoint = null;
  }
});

Editor.prototype.drawDraggingBlock = function() {
  // Draw the new dragging block on the drag canvas.
  //
  // When we are dragging things, we draw the shadow.
  // Also, we translate the block 1x1 to the right,
  // so that we can see its borders.
  this.session.dragView.clearCache();
  const draggingBlockView = this.session.dragView.getViewNodeFor(this.draggingBlock);
  draggingBlockView.layout(1, 1);

  this.dragCanvas.width = Math.min(draggingBlockView.totalBounds.width + 10, window.screen.width);
  this.dragCanvas.height = Math.min(draggingBlockView.totalBounds.height + 10, window.screen.height);

  return draggingBlockView.draw(new this.draw.Rectangle(0, 0, this.dragCanvas.width, this.dragCanvas.height));
};

Editor.prototype.wouldDelete = function(position) {

  const mainPoint = this.trackerPointToMain(position);
  const palettePoint = this.trackerPointToPalette(position);

  return !this.lastHighlight && !this.session.viewports.main.contains(mainPoint);
};

// On mousemove, if there is a clicked block but no drag block,
// we might want to transition to a dragging the block if the user
// moved their mouse far enough.
hook('mousemove', 1, function(point, event, state) {
  if (this.session == null) { return; }
  if (!state.capturedPickup && (this.clickedBlock != null) && (point.from(this.clickedPoint).magnitude() > MIN_DRAG_DISTANCE)) {

    // Signify that we are now dragging a block.
    this.draggingBlock = this.clickedBlock;
    this.dragReplacing = false;

    // Our dragging offset must be computed using the canvas on which this block
    // is rendered.
    //
    // NOTE: this really falls under "PALETTE SUPPORT", but must
    // go here. Try to organise this better.
    if (this.clickedBlockPaletteEntry) {
      this.draggingOffset = this.session.paletteView.getViewNodeFor(this.draggingBlock).bounds[0].upperLeftCorner().from(
        this.trackerPointToPalette(this.clickedPoint));

      // Substitute in expansion for this palette entry, if supplied.
      let { expansion } = this.clickedBlockPaletteEntry;

      // Call expansion() function with no parameter to get the initial value.
      if ('function' === typeof expansion) { expansion = expansion(); }
      if (expansion) { expansion = parseBlock(this.session.mode, expansion, this.clickedBlockPaletteEntry.context); }
      this.draggingBlock = (expansion || this.draggingBlock).clone();

      // Special @draggingBlock setup for expansion function blocks.
      if ('function' === typeof this.clickedBlockPaletteEntry.expansion) {
        // Any block generated from an expansion function should be treated as
        // any-drop because it can change with subsequent expansion() calls.
        if (Array.from(this.draggingBlock.classes).includes('mostly-value')) {
          this.draggingBlock.classes.push('any-drop');
        }

        // Attach expansion() function and lastExpansionText to @draggingBlock.
        this.draggingBlock.lastExpansionText = expansion;
        this.draggingBlock.expansion = this.clickedBlockPaletteEntry.expansion;
      }

    } else {
      // Find the line on the block that we have
      // actually clicked, and attempt to translate the block
      // so that if it re-shapes, we're still touching it.
      //
      // To do this, we will assume that the left edge of a free
      // block are all aligned.
      const mainPoint = this.trackerPointToMain(this.clickedPoint);
      const viewNode = this.session.view.getViewNodeFor(this.draggingBlock);

      if (this.draggingBlock instanceof model.List && !(this.draggingBlock instanceof model.Container)) {
        viewNode.absorbCache();
      }

      this.draggingOffset = null;

      for (let line = 0; line < viewNode.bounds.length; line++) {
        const bound = viewNode.bounds[line];
        if (bound.contains(mainPoint)) {
          this.draggingOffset = bound.upperLeftCorner().from(mainPoint);
          this.draggingOffset.y += viewNode.bounds[0].y - bound.y;
          break;
        }
      }

      if (this.draggingOffset == null) {
        this.draggingOffset = viewNode.bounds[0].upperLeftCorner().from(mainPoint);
      }
    }

    // TODO figure out what to do with lists here

    // Draw the new dragging block on the drag canvas.
    //
    // When we are dragging things, we draw the shadow.
    // Also, we translate the block 1x1 to the right,
    // so that we can see its borders.
    this.session.dragView.beginDraw();
    const draggingBlockView = this.session.dragView.getViewNodeFor(this.draggingBlock);
    draggingBlockView.layout(1, 1);
    draggingBlockView.root();
    draggingBlockView.draw();
    this.session.dragView.garbageCollect();

    this.dragCanvas.style.width = `${Math.min(draggingBlockView.totalBounds.width + 10, window.screen.width)}px`;
    this.dragCanvas.style.height = `${Math.min(draggingBlockView.totalBounds.height + 10, window.screen.height)}px`;

    // Translate it immediately into position
    const position = new this.draw.Point(
      point.x + this.draggingOffset.x,
      point.y + this.draggingOffset.y
    );

    // Construct a quadtree of drop areas
    // for faster dragging
    this.dropPointQuadTree = QUAD.init({
      x: this.session.viewports.main.x,
      y: this.session.viewports.main.y,
      w: this.session.viewports.main.width,
      h: this.session.viewports.main.height
    });

    for (let dropletDocument of Array.from(this.getDocuments())) {
      let head = dropletDocument.start;

      // Don't allow dropping at the start of the document
      // if we are already dragging a block that is at
      // the start of the document.
      if (this.draggingBlock.start.prev === head) {
        head = head.next;
      }

      while (head !== dropletDocument.end) {
        if (head === this.draggingBlock.start) {
          head = this.draggingBlock.end;
        }

        if (head instanceof model.StartToken) {
          const acceptLevel = this.getAcceptLevel(this.draggingBlock, head.container);
          if (acceptLevel !== helper.FORBID) {
            const { dropPoint } = this.session.view.getViewNodeFor(head.container);

            if (dropPoint != null) {
              let allowed = true;
              for (let i = this.session.floatingBlocks.length - 1; i >= 0; i--) {
                const record = this.session.floatingBlocks[i];
                if (record.block === dropletDocument) {
                  break;
                } else if (record.grayBoxPath.contains(dropPoint)) {
                  allowed = false;
                  break;
                }
              }
              if (allowed) {
                this.dropPointQuadTree.insert({
                  x: dropPoint.x,
                  y: dropPoint.y,
                  w: 0,
                  h: 0,
                  acceptLevel,
                  _droplet_node: head.container
                });
              }
            }
          }
        }

        head = head.next;
      }
    }

    this.dragCanvas.style.transform = `translate(${position.x + getOffsetLeft(this.dropletElement)}px,${position.y + getOffsetTop(this.dropletElement)}px)`;

    // Now we are done with the "clickedX" suite of stuff.
    this.clickedPoint = (this.clickedBlock = null);
    this.clickedBlockPaletteEntry = null;

    this.begunTrash = this.wouldDelete(position);

    // Redraw the main canvas
    return this.redrawMain();
  }
});

Editor.prototype.getClosestDroppableBlock = function(mainPoint, isDebugMode) {
  let best = null; let min = Infinity;

  if (!(this.dropPointQuadTree)) {
    return null;
  }

  const testPoints = this.dropPointQuadTree.retrieve({
    x: mainPoint.x - MAX_DROP_DISTANCE,
    y: mainPoint.y - MAX_DROP_DISTANCE,
    w: MAX_DROP_DISTANCE * 2,
    h: MAX_DROP_DISTANCE * 2
  }, point => {
    if ((point.acceptLevel !== helper.DISCOURAGE) || !!isDebugMode) {
      // Find a modified "distance" to the point
      // that weights horizontal distance more
      let distance = mainPoint.from(point);
      distance.y *= 2; distance = distance.magnitude();

      // Select the node that is closest by said "distance"
      if ((distance < min) && (mainPoint.from(point).magnitude() < MAX_DROP_DISTANCE) &&
         (this.session.view.getViewNodeFor(point._droplet_node).highlightArea != null)) {
        best = point._droplet_node;
        return min = distance;
      }
    }
  });
  return best;
};

Editor.prototype.getClosestDroppableBlockFromPosition = function(position, isDebugMode) {
  if (!this.session.currentlyUsingBlocks) {
    return null;
  }

  const mainPoint = this.trackerPointToMain(position);
  return this.getClosestDroppableBlock(mainPoint, isDebugMode);
};

Editor.prototype.getAcceptLevel = function(drag, drop) {
  let next;
  if (drop.type === 'socket') {
    if (drag.type === 'list') {
      return helper.FORBID;
    } else {
      return this.session.mode.drop(drag.getReader(), drop.getReader(), null, null);
    }

  // If it's a list/selection, try all of its children
  } else if (drag.type === 'list') {
    let minimum = helper.ENCOURAGE;
    drag.traverseOneLevel(child => {
      if (child instanceof model.Container) {
        return minimum = Math.min(minimum, this.getAcceptLevel(child, drop));
      }
    });
    return minimum;

  } else if (drop.type === 'block') {
    if (drop.parent.type === 'socket') {
      return helper.FORBID;
    } else {
      next = drop.nextSibling();
      return this.session.mode.drop(drag.getReader(), drop.parent.getReader(), drop.getReader(), __guardMethod__(next, 'getReader', o => o.getReader()));
    }
  } else {
    next = drop.firstChild();
    return this.session.mode.drop(drag.getReader(), drop.getReader(), drop.getReader(), __guardMethod__(next, 'getReader', o1 => o1.getReader()));
  }
};

// On mousemove, if there is a dragged block, we want to
// translate the drag canvas into place,
// as well as highlighting any focused drop areas.
hook('mousemove', 0, function(point, event, state) {
  if (this.draggingBlock != null) {
    // Translate the drag canvas into position.
    const position = new this.draw.Point(
      point.x + this.draggingOffset.x,
      point.y + this.draggingOffset.y
    );

    // If there is an expansion function, call it again here.
    if (this.draggingBlock.expansion) {
      // Call expansion() with the closest droppable block for all drag moves.
      const expansionText = this.draggingBlock.expansion(this.getClosestDroppableBlockFromPosition(position, event.shiftKey));

      // Create replacement @draggingBlock if the returned text is new.
      if (expansionText !== this.draggingBlock.lastExpansionText) {
        const newBlock = parseBlock(this.session.mode, expansionText);
        newBlock.lastExpansionText = expansionText;
        newBlock.expansion = this.draggingBlock.expansion;
        if (Array.from(this.draggingBlock.classes).includes('any-drop')) {
          newBlock.classes.push('any-drop');
        }
        this.draggingBlock = newBlock;
        this.drawDraggingBlock();
      }
    }

    if (!this.session.currentlyUsingBlocks) {
      if (this.trackerPointIsInAce(position)) {
        let pos = this.aceEditor.renderer.screenToTextCoordinates(position.x, position.y);

        if (this.session.dropIntoAceAtLineStart) {
          pos = this.adjustPosToLineStart(pos);
        }

        this.aceEditor.focus();
        this.aceEditor.session.selection.moveToPosition(pos);
      } else {
        this.aceEditor.blur();
      }
    }

    const rect = this.wrapperElement.getBoundingClientRect();

    this.dragCanvas.style.transform =  `translate(${position.x - rect.left}px,${position.y - rect.top}px)`;

    const mainPoint = this.trackerPointToMain(position);

    // Check to see if the tree is empty;
    // if it is, drop on the tree always
    let head = this.session.tree.start.next;
    while (['newline', 'cursor'].includes(head.type) || ((head.type === 'text') && (head.value === ''))) {
      head = head.next;
    }

    if ((head === this.session.tree.end) && (this.session.floatingBlocks.length === 0) &&
        (this.session.viewports.main.right() > mainPoint.x && mainPoint.x > this.session.viewports.main.x - this.gutter.clientWidth) &&
        (this.session.viewports.main.bottom() > mainPoint.y && mainPoint.y > this.session.viewports.main.y) &&
        (this.getAcceptLevel(this.draggingBlock, this.session.tree) === helper.ENCOURAGE)) {
      this.session.view.getViewNodeFor(this.session.tree).highlightArea.update();
      this.lastHighlight = this.session.tree;

    } else {
      // If the user is touching the original location,
      // assume they want to replace the block where they found it.
      let dropBlock;
      if (this.hitTest(mainPoint, this.draggingBlock)) {
        this.dragReplacing = true;
        dropBlock = null;

      // If the user's block is outside the main pane, delete it
      } else if (!this.trackerPointIsInMain(position)) {
        this.dragReplacing = false;
        dropBlock= null;

      // Otherwise, find the closest droppable block
      } else {
        this.dragReplacing = false;
        dropBlock = this.getClosestDroppableBlock(mainPoint, event.shiftKey);
      }

      // Update highlight if necessary.
      if (dropBlock !== this.lastHighlight) {
        // TODO if this becomes a performance issue,
        // pull the drop highlights out into a new canvas.
        this.redrawHighlights();

        __guardMethod__(this.lastHighlightPath, 'deactivate', o => o.deactivate());

        if (dropBlock != null) {
          this.lastHighlightPath = this.session.view.getViewNodeFor(dropBlock).highlightArea;
          this.lastHighlightPath.update();

          this.qualifiedFocus(dropBlock, this.lastHighlightPath);
        }

        this.lastHighlight = dropBlock;
      }
    }

    const palettePoint = this.trackerPointToPalette(position);

    if (this.wouldDelete(position)) {
      if (this.begunTrash) {
        return this.dragCanvas.style.opacity = 0.85;
      } else {
        return this.dragCanvas.style.opacity = 0.3;
      }
    } else {
      this.dragCanvas.style.opacity = 0.85;
      return this.begunTrash = false;
    }
  }
});

Editor.prototype.qualifiedFocus = function(node, path) {
  const documentIndex = this.documentIndex(node);
  if (documentIndex < this.session.floatingBlocks.length) {
    path.activate();
    return this.mainCanvas.insertBefore(path.element, this.session.floatingBlocks[documentIndex].renderGroup.element);
  } else {
    path.activate();
    return this.mainCanvas.appendChild(path.element);
  }
};

hook('mouseup', 0, function() {
  clearTimeout(this.discourageDropTimeout); return this.discourageDropTimeout = null;
});

hook('mouseup', 1, function(point, event, state) {
  if (this.dragReplacing) {
    this.endDrag();
  }

  // We will consume this event iff we dropped it successfully
  // in the root tree.
  if (this.draggingBlock != null) {
    let text;
    if (!this.session.currentlyUsingBlocks) {
      // See if we can drop the block's text in ace mode.
      const position = new this.draw.Point(
        point.x + this.draggingOffset.x,
        point.y + this.draggingOffset.y
      );

      if (this.trackerPointIsInAce(position)) {
        const leadingWhitespaceRegex = /^(\s*)/;
        // Get the line of text we're dropping into
        let pos = this.aceEditor.renderer.screenToTextCoordinates(position.x, position.y);
        const line = this.aceEditor.session.getLine(pos.row);
        let indentation = leadingWhitespaceRegex.exec(line)[0];

        let skipInitialIndent = true;
        let prefix = '';
        let suffix = '';

        if (this.session.dropIntoAceAtLineStart) {
          // First, adjust indentation if we're dropping into the start of a
          // line that ends an indentation block
          const firstNonWhitespaceRegex = /\S/;
          const firstChar = firstNonWhitespaceRegex.exec(line);
          if (firstChar && (firstChar[0] === '}')) {
            // If this line starts with a closing bracket, use the previous line's indentation
            // TODO: generalize for language indentation semantics besides C/JavaScript
            const prevLine = this.aceEditor.session.getLine(pos.row - 1);
            indentation = leadingWhitespaceRegex.exec(prevLine)[0];
          }
          // Adjust pos to start of the line (as we did during mousemove)
          pos = this.adjustPosToLineStart(pos);
          skipInitialIndent = false;
          if (pos.column === 0) {
            suffix = '\n';
          } else {
            // Handle the case where we're dropping a block at the end of the last line
            prefix = '\n';
          }
        } else if ((indentation.length === line.length) || (indentation.length === pos.column)) {
          // line is whitespace only or we're inserting at the beginning of a line
          // Append with a newline
          suffix = `\n${indentation}`;
        } else if (pos.column === line.length) {
          // We're at the end of a non-empty line.
          // Insert a new line, and base our indentation off of the next line
          prefix = '\n';
          skipInitialIndent = false;
          const nextLine = this.aceEditor.session.getLine(pos.row + 1);
          indentation = leadingWhitespaceRegex.exec(nextLine)[0];
        }

        // Call prepareNode, which may append with a semicolon
        this.prepareNode(this.draggingBlock, null);
        text = this.draggingBlock.stringify(this.session.mode);

        // Indent each line, unless it's the first line and wasn't placed on
        // a newline
        text = text.split('\n').map((line, index) => {
          return ((index === 0) && skipInitialIndent ? '' : indentation) + line;
        }).join('\n');

        text = prefix + text + suffix;

        return this.aceEditor.onTextInput(text);
      }
    } else if (this.lastHighlight != null) {
      this.undoCapture();

      // Remove the block from the tree.
      const rememberedSocketOffsets = this.spliceRememberedSocketOffsets(this.draggingBlock);

      // TODO this is a hacky way of preserving locations
      // across parenthesis insertion
      const hadTextToken = this.draggingBlock.start.next.type === 'text';

      this.spliceOut(this.draggingBlock);

      this.clearHighlightCanvas();

      // Fire an event for a sound
      this.fireEvent('sound', [this.lastHighlight.type]);

      // Depending on what the highlighted element is,
      // we might want to drop the block at its
      // beginning or at its end.
      //
      // We will need to log undo operations here too.
      switch (this.lastHighlight.type) {
        case 'indent': case 'socket':
          this.spliceIn(this.draggingBlock, this.lastHighlight.start);
          break;
        case 'block':
          this.spliceIn(this.draggingBlock, this.lastHighlight.end);
          break;
        default:
          if (this.lastHighlight.type === 'document') {
            this.spliceIn(this.draggingBlock, this.lastHighlight.start);
          }
      }

      // TODO as above
      const hasTextToken = this.draggingBlock.start.next.type === 'text';
      if (hadTextToken && !hasTextToken) {
        rememberedSocketOffsets.forEach(x => x.offset -= 1);
      } else if (hasTextToken && !hadTextToken) {
        rememberedSocketOffsets.forEach(x => x.offset += 1);
      }

      const futureCursorLocation = this.toCrossDocumentLocation(this.draggingBlock.start);

      // Reparse the parent if we are
      // in a socket
      //
      // TODO "reparseable" property (or absent contexts), bubble up
      // TODO performance on large programs
      if (this.lastHighlight.type === 'socket') {
        this.reparse(this.draggingBlock.parent.parent);
      }

      // Now that we've done that, we can annul stuff.
      this.endDrag();

      if (futureCursorLocation != null) { this.setCursor(futureCursorLocation); }

      const newBeginning = futureCursorLocation.location.count;
      const newIndex = futureCursorLocation.document;

      for (let i = 0; i < rememberedSocketOffsets.length; i++) {
        const el = rememberedSocketOffsets[i];
        this.session.rememberedSockets.push(new RememberedSocketRecord(
          new CrossDocumentLocation(
            newIndex,
            new model.Location(el.offset + newBeginning, 'socket')
          ),
          el.text
        )
        );
      }

      // Fire the event for sound
      return this.fireEvent('block-click');
    }
  }
});

Editor.prototype.spliceRememberedSocketOffsets = function(block) {
  if (block.getDocument() != null) {
    const blockBegin = block.start.getLocation().count;
    const offsets = [];
    const newRememberedSockets = [];
    for (let i = 0; i < this.session.rememberedSockets.length; i++) {
      const el = this.session.rememberedSockets[i];
      if (block.contains(this.fromCrossDocumentLocation(el.socket))) {
        offsets.push({
          offset: el.socket.location.count - blockBegin,
          text: el.text
        });
      } else {
        newRememberedSockets.push(el);
      }
    }
    this.session.rememberedSockets = newRememberedSockets;
    return offsets;
  } else {
    return [];
  }
};

// FLOATING BLOCK SUPPORT
// ================================

class FloatingBlockRecord {
  constructor(block, position) {
    this.block = block;
    this.position = position;
  }
}

Editor.prototype.inTree = function(block) { return (block.container != null ? block.container : block).getDocument() === this.session.tree; };
Editor.prototype.inDisplay = function(block) { let needle;
return (needle = (block.container != null ? block.container : block).getDocument(), Array.from(this.getDocuments()).includes(needle)); };

// We can create floating blocks by dropping
// blocks without a highlight.
hook('mouseup', 0, function(point, event, state) {
  if ((this.draggingBlock != null) && (this.lastHighlight == null) && !this.dragReplacing) {
    let record, rememberedSocketOffsets;
    const oldParent = this.draggingBlock.parent;

    // Before we put this block into our list of floating blocks,
    // we need to figure out where on the main canvas
    // we are going to render it.
    const trackPoint = new this.draw.Point(
      point.x + this.draggingOffset.x,
      point.y + this.draggingOffset.y
    );
    const renderPoint = this.trackerPointToMain(trackPoint);
    const palettePoint = this.trackerPointToPalette(trackPoint);

    let removeBlock = true;
    let addBlockAsFloatingBlock = true;

    // If we dropped it off in the palette, abort (so as to delete the block).
    if (!(this.session.viewports.main.right() > renderPoint.x && renderPoint.x > this.session.viewports.main.x - this.gutter.clientWidth) ||
        !(this.session.viewports.main.bottom() > renderPoint.y && renderPoint.y > this.session.viewports.main.y)) {
      if (this.draggingBlock === this.lassoSelection) {
        this.lassoSelection = null;
      }

      addBlockAsFloatingBlock = false;
    } else {
      if ((renderPoint.x - this.session.viewports.main.x) < 0) {
        renderPoint.x = this.session.viewports.main.x;
      }

      // If @session.allowFloatingBlocks is false, we end the drag without deleting the block.
      if (!this.session.allowFloatingBlocks) {
        addBlockAsFloatingBlock = false;
        removeBlock = false;
      }
    }

    if (removeBlock) {
      // Remove the block from the tree.
      this.undoCapture();
      rememberedSocketOffsets = this.spliceRememberedSocketOffsets(this.draggingBlock);
      this.spliceOut(this.draggingBlock);
    }

    if (!addBlockAsFloatingBlock) {
      this.endDrag();
      return;

    } else if ((renderPoint.x - this.session.viewports.main.x) < 0) {
      renderPoint.x = this.session.viewports.main.x;
    }

    // Add the undo operation associated
    // with creating this floating block
    const newDocument = new model.Document((oldParent != null ? oldParent.parseContext : undefined) != null ? (oldParent != null ? oldParent.parseContext : undefined) : this.session.mode.rootContext, {roundedSingletons: true});
    newDocument.insert(newDocument.start, this.draggingBlock);
    this.pushUndo(new FloatingOperation(this.session.floatingBlocks.length, newDocument, renderPoint, 'create'));

    // Add this block to our list of floating blocks
    this.session.floatingBlocks.push(record = new FloatingBlockRecord(
      newDocument,
      renderPoint
    )
    );

    this.initializeFloatingBlock(record, this.session.floatingBlocks.length - 1);

    this.setCursor(this.draggingBlock.start);

    // TODO write a test for this logic
    for (let i = 0; i < rememberedSocketOffsets.length; i++) {
      const el = rememberedSocketOffsets[i];
      this.session.rememberedSockets.push(new RememberedSocketRecord(
        new CrossDocumentLocation(
          this.session.floatingBlocks.length,
          new model.Location(el.offset + 1, 'socket')
        ),
        el.text
      )
      );
    }

    // Now that we've done that, we can annul stuff.
    this.clearDrag();
    this.draggingBlock = null;
    this.draggingOffset = null;
    __guardMethod__(this.lastHighlightPath, 'destroy', o => o.destroy());
    this.lastHighlight = (this.lastHighlightPath = null);

    return this.redrawMain();
  }
});

Editor.prototype.performFloatingOperation = function(op, direction) {
  let socket;
  if ((op.type === 'create') === (direction === 'forward')) {
    let record;
    if (this.session.cursor.document > op.index) {
      this.session.cursor.document += 1;
    }

    for (socket of Array.from(this.session.rememberedSockets)) {
      if (socket.socket.document > op.index) {
        socket.socket.document += 1;
      }
    }

    this.session.floatingBlocks.splice(op.index, 0, (record = new FloatingBlockRecord(
      op.block.clone(),
      op.position
    ))
    );

    return this.initializeFloatingBlock(record, op.index);
  } else {
    // If the cursor's document is about to vanish,
    // put it back in the main tree.
    if (this.session.cursor.document === (op.index + 1)) {
      this.setCursor(this.session.tree.start);
    }

    for (socket of Array.from(this.session.rememberedSockets)) {
      if (socket.socket.document > (op.index + 1)) {
        socket.socket.document -= 1;
      }
    }

    return this.session.floatingBlocks.splice(op.index, 1);
  }
};

class FloatingOperation {
  constructor(index, block, position, type) {
    this.index = index;
    this.block = block;
    this.position = position;
    this.type = type;
    this.block = this.block.clone();
  }

  toString() { return JSON.stringify({
    index: this.index,
    block: this.block.stringify(),
    position: this.position.toString(),
    type: this.type
  }); }
}

// PALETTE SUPPORT
// ================================

// The first thing we will have to do with
// the palette is install the hierarchical menu.
//
// This happens at population time.
hook('populate', 0, function() {
  // Create the hierarchical menu element.
  this.paletteHeader = document.createElement('div');
  this.paletteHeader.className = 'droplet-palette-header';

  // Append the element.
  this.paletteElement.appendChild(this.paletteHeader);

  if (this.session != null) {
    return this.setPalette(this.session.paletteGroups);
  }
});

var parseBlock = (mode, code, context = null) => {
  const block = mode.parse(code, {context}).start.next.container;
  block.start.prev = (block.end.next = null);
  block.setParent(null);
  return block;
};

Editor.prototype.setPalette = function(paletteGroups) {
  this.paletteHeader.innerHTML = '';
  this.session.paletteGroups = paletteGroups;

  this.session.currentPaletteBlocks = [];
  this.session.currentPaletteMetadata = [];

  let paletteHeaderRow = null;

  for (let i = 0; i < this.session.paletteGroups.length; i++) { const paletteGroup = this.session.paletteGroups[i]; ((paletteGroup, i) => {
    // Start a new row, if we're at that point
    // in our appending cycle
    if ((i % 2) === 0) {
      paletteHeaderRow = document.createElement('div');
      paletteHeaderRow.className = 'droplet-palette-header-row';
      this.paletteHeader.appendChild(paletteHeaderRow);
      // hide the header if there is only one group, and it has no name.
      if ((this.session.paletteGroups.length === 1) && !paletteGroup.name) {
        paletteHeaderRow.style.height = 0;
      }
    }

    // Create the element itself
    const paletteGroupHeader = (paletteGroup.header = document.createElement('div'));
    paletteGroupHeader.className = 'droplet-palette-group-header';
    if (paletteGroup.id) {
      paletteGroupHeader.id = `droplet-palette-group-header-${paletteGroup.id}`;
    }
    paletteGroupHeader.innerText = (paletteGroupHeader.textContent = (paletteGroupHeader.textContent = paletteGroup.name)); // innerText and textContent for FF compatability
    if (paletteGroup.color) {
      paletteGroupHeader.className += ` ${paletteGroup.color}`;
    }

    paletteHeaderRow.appendChild(paletteGroupHeader);

    const newPaletteBlocks = [];

    // Parse all the blocks in this palette and clone them
    for (let data of Array.from(paletteGroup.blocks)) {
      const newBlock = parseBlock(this.session.mode, data.block, data.context);
      const expansion = data.expansion || null;
      newPaletteBlocks.push({
        block: newBlock,
        expansion,
        context: data.context,
        title: data.title,
        id: data.id
      });
    }

    paletteGroup.parsedBlocks = newPaletteBlocks;

    // When we click this element,
    // we should switch to it in the palette.
    const updatePalette = () => {
      return this.changePaletteGroup(paletteGroup);
    };

    const clickHandler = () => {
      return updatePalette();
    };

    paletteGroupHeader.addEventListener('click', clickHandler);
    paletteGroupHeader.addEventListener('touchstart', clickHandler);

    // If we are the first element, make us the selected palette group.
    if (i === 0) {
      return updatePalette();
    }
  })(paletteGroup, i); }

  this.resizePalette();
  return this.resizePaletteHighlight();
};

// Change which palette group is selected.
// group argument can be object, id (string), or name (string)
//
Editor.prototype.changePaletteGroup = function(group) {
  let i, paletteGroup;
  for (i = 0; i < this.session.paletteGroups.length; i++) {
    const curGroup = this.session.paletteGroups[i];
    if ((group === curGroup) || (group === curGroup.id) || (group === curGroup.name)) {
      paletteGroup = curGroup;
      break;
    }
  }

  if (!paletteGroup) {
    return;
  }

  // Record that we are the selected group now
  this.session.currentPaletteGroup = paletteGroup.name;
  this.session.currentPaletteBlocks = paletteGroup.parsedBlocks;
  this.session.currentPaletteMetadata = paletteGroup.parsedBlocks;

  // Unapply the "selected" style to the current palette group header
  if (this.session.currentPaletteGroupHeader != null) {
    this.session.currentPaletteGroupHeader.className =
      this.session.currentPaletteGroupHeader.className.replace(
          /\s[-\w]*-selected\b/, '');
  }

  // Now we are the current palette group header
  this.session.currentPaletteGroupHeader = paletteGroup.header;
  this.currentPaletteIndex = i;

  // Apply the "selected" style to us
  this.session.currentPaletteGroupHeader.className +=
      ' droplet-palette-group-header-selected';

  // Redraw the palette.
  this.rebuildPalette();
  return this.fireEvent('selectpalette', [paletteGroup.name]);
};

// The next thing we need to do with the palette
// is let people pick things up from it.
hook('mousedown', 6, function(point, event, state) {
  // If someone else has already taken this click, pass.
  if (state.consumedHitTest) { return; }

  // If it's not in the palette pane, pass.
  if (!this.trackerPointIsInPalette(point)) { return; }

  const palettePoint = this.trackerPointToPalette(point);
  if (this.session.viewports.palette.contains(palettePoint)) {
    if (this.handleTextInputClickInPalette(palettePoint)) {
      state.consumedHitTest = true;
      return;
    }

    for (let entry of Array.from(this.session.currentPaletteBlocks)) {
      const hitTestResult = this.hitTest(palettePoint, entry.block, this.session.paletteView);

      if (hitTestResult != null) {
        this.clickedBlock = entry.block;
        this.clickedPoint = point;
        this.clickedBlockPaletteEntry = entry;
        state.consumedHitTest = true;
        this.fireEvent('pickblock', [entry.id]);
        return;
      }
    }
  }

  return this.clickedBlockPaletteEntry = null;
});

// PALETTE HIGHLIGHT CODE
// ================================
hook('populate', 1, function() {
  this.paletteHighlightCanvas = (this.paletteHighlightCtx = document.createElementNS(SVG_STANDARD, 'svg'));
  this.paletteHighlightCanvas.setAttribute('class',  'droplet-palette-highlight-canvas');

  this.paletteHighlightPath = null;
  this.currentHighlightedPaletteBlock = null;

  return this.paletteElement.appendChild(this.paletteHighlightCanvas);
});

Editor.prototype.resizePaletteHighlight = function() {
  this.paletteHighlightCanvas.style.top = this.paletteHeader.clientHeight + 'px';
  this.paletteHighlightCanvas.style.width = `${this.paletteCanvas.clientWidth}px`;
  return this.paletteHighlightCanvas.style.height = `${this.paletteCanvas.clientHeight}px`;
};

hook('redraw_palette', 0, function() {
  this.clearPaletteHighlightCanvas();
  if (this.currentHighlightedPaletteBlock != null) {
    return this.paletteHighlightPath.update();
  }
});

// TEXT INPUT SUPPORT
// ================================

// At populate-time, we need
// to create and append the hidden input
// we will use for text input.
hook('populate', 1, function() {
  this.hiddenInput = document.createElement('textarea');
  this.hiddenInput.className = 'droplet-hidden-input';

  this.hiddenInput.addEventListener('focus', () => {
    if (this.cursorAtSocket()) {
      // Must ensure that @hiddenInput is within the client area
      // or else the other divs under @dropletElement will scroll out of
      // position when @hiddenInput receives keystrokes with focus
      // (left and top should not be closer than 10 pixels from the edge)

      let bounds;
      return bounds = this.session.view.getViewNodeFor(this.getCursor()).bounds[0];
      /*
      inputLeft = bounds.x + @mainCanvas.offsetLeft - @session.viewports.main.x
      inputLeft = Math.min inputLeft, @dropletElement.clientWidth - 10
      inputLeft = Math.max @mainCanvas.offsetLeft, inputLeft
      @hiddenInput.style.left = inputLeft + 'px'
      inputTop = bounds.y - @session.viewports.main.y
      inputTop = Math.min inputTop, @dropletElement.clientHeight - 10
      inputTop = Math.max 0, inputTop
      @hiddenInput.style.top = inputTop + 'px'
      */
    }
  });

  this.dropletElement.appendChild(this.hiddenInput);

  // We also need to initialise some fields
  // for knowing what is focused
  this.textInputAnchor = null;

  this.textInputSelecting = false;

  this.oldFocusValue = null;

  // Prevent kids from deleting a necessary quote accidentally
  this.hiddenInput.addEventListener('keydown', event => {
    if ((event.keyCode === 8) && (this.hiddenInput.value.length > 1) &&
        (this.hiddenInput.value[0] === this.hiddenInput.value[this.hiddenInput.value.length - 1]) &&
        ['\'', '\"'].includes(this.hiddenInput.value[0]) && (this.hiddenInput.selectionEnd === 1)) {
      return event.preventDefault();
    }
  });

  // The hidden input should be set up
  // to mirror the text to which it is associated.
  return (() => {
    const result = [];
    for (let event of ['input', 'keyup', 'keydown', 'select']) {
      result.push(this.hiddenInput.addEventListener(event, () => {
        this.highlightFlashShow();
        if (this.cursorAtSocket()) {
          this.redrawTextInput();

          // Update the dropdown size to match
          // the new length, if it is visible.
          if (this.dropdownVisible) {
            return this.formatDropdown();
          }
        }
      }));
    }
    return result;
  })();
});

Editor.prototype.resizeAceElement = function() {
  let width = this.wrapperElement.clientWidth;
  if ((this.session != null ? this.session.showPaletteInTextMode : undefined) && (this.session != null ? this.session.paletteEnabled : undefined)) {
    width -= this.paletteWrapper.clientWidth;
  }

  this.aceElement.style.width = `${width}px`;
  return this.aceElement.style.height = `${this.wrapperElement.clientHeight}px`;
};

const last_ = array => array[array.length - 1];

// Redraw function for text input
Editor.prototype.redrawTextInput = function() {
  if (this.session == null) { return; }

  const sameLength = this.getCursor().stringify().split('\n').length === this.hiddenInput.value.split('\n').length;
  const dropletDocument = this.getCursor().getDocument();

  // Set the value in the model to fit
  // the hidden input value.
  this.populateSocket(this.getCursor(), this.hiddenInput.value);

  const textFocusView = this.session.view.getViewNodeFor(this.getCursor());

  // Determine the coordinate positions
  // of the typing cursor
  const startRow = this.getCursor().stringify().slice(0, this.hiddenInput.selectionStart).split('\n').length - 1;
  const endRow = this.getCursor().stringify().slice(0, this.hiddenInput.selectionEnd).split('\n').length - 1;

  // Redraw the main canvas, on top of
  // which we will draw the cursor and
  // highlights.
  if (sameLength && (startRow === endRow)) {
    let line = endRow;
    let head = this.getCursor().start;

    while (head !== dropletDocument.start) {
      head = head.prev;
      if (head.type === 'newline') { line++; }
    }

    const treeView = this.session.view.getViewNodeFor(dropletDocument);

    const oldp = helper.deepCopy([
      treeView.glue[line - 1],
      treeView.glue[line],
      treeView.bounds[line].height
    ]);

    treeView.layout();

    const newp = helper.deepCopy([
      treeView.glue[line - 1],
      treeView.glue[line],
      treeView.bounds[line].height
    ]);

    // If the layout has not changed enough to affect
    // anything non-local, only redraw locally.
    return this.redrawMain();
    /*
    if helper.deepEquals newp, oldp
      rect = new @draw.NoRectangle()

      rect.unite treeView.bounds[line - 1] if line > 0
      rect.unite treeView.bounds[line]
      rect.unite treeView.bounds[line + 1] if line + 1 < treeView.bounds.length

      rect.width = Math.max rect.width, @mainCanvas.clientWidth

      @redrawMain
        boundingRectangle: rect

    else @redrawMain()
    */

  // Otherwise, redraw the whole thing
  } else {
    return this.redrawMain();
  }
};

Editor.prototype.redrawTextHighlights = function(scrollIntoView) {
  if (scrollIntoView == null) { scrollIntoView = false; }
  this.clearHighlightCanvas();

  if (this.session == null) { return; }
  if (!this.cursorAtSocket()) { return; }

  const textFocusView = this.session.view.getViewNodeFor(this.getCursor());

  // Determine the coordinate positions
  // of the typing cursor
  const startRow = this.getCursor().stringify().slice(0, this.hiddenInput.selectionStart).split('\n').length - 1;
  const endRow = this.getCursor().stringify().slice(0, this.hiddenInput.selectionEnd).split('\n').length - 1;

  const lines = this.getCursor().stringify().split('\n');

  const startPosition = textFocusView.bounds[startRow].x + this.session.view.opts.textPadding +
    (this.session.fontWidth * last_(this.getCursor().stringify().slice(0, this.hiddenInput.selectionStart).split('\n')).length) +
    (this.getCursor().hasDropdown() ? helper.DROPDOWN_ARROW_WIDTH : 0);

  const endPosition = textFocusView.bounds[endRow].x + this.session.view.opts.textPadding +
    (this.session.fontWidth * last_(this.getCursor().stringify().slice(0, this.hiddenInput.selectionEnd).split('\n')).length) +
    (this.getCursor().hasDropdown() ? helper.DROPDOWN_ARROW_WIDTH : 0);

  // Now draw the highlight/typing cursor
  //
  // Draw a line if it is just a cursor
  if (this.hiddenInput.selectionStart === this.hiddenInput.selectionEnd) {
    this.qualifiedFocus(this.getCursor(), this.textCursorPath);
    const points = [
      new this.session.view.draw.Point(startPosition, textFocusView.bounds[startRow].y + this.session.view.opts.textPadding),
      new this.session.view.draw.Point(startPosition, textFocusView.bounds[startRow].y + this.session.view.opts.textPadding + this.session.view.opts.textHeight)
    ];

    this.textCursorPath.setPoints(points);
    this.textCursorPath.style.strokeColor = '#000';
    this.textCursorPath.update();
    this.qualifiedFocus(this.getCursor(), this.textCursorPath);
    this.textInputHighlighted = false;

  // Draw a translucent rectangle if there is a selection.
  } else {
    let i;
    this.textInputHighlighted = true;

    // TODO maybe put this in the view?
    const rectangles = [];

    if (startRow === endRow) {
      rectangles.push(new this.session.view.draw.Rectangle(startPosition,
        textFocusView.bounds[startRow].y + this.session.view.opts.textPadding,
        endPosition - startPosition, this.session.view.opts.textHeight)
      );

    } else {
      let asc, end, start;
      rectangles.push(new this.session.view.draw.Rectangle(startPosition, textFocusView.bounds[startRow].y + this.session.view.opts.textPadding,
        textFocusView.bounds[startRow].right() - this.session.view.opts.textPadding - startPosition, this.session.view.opts.textHeight)
      );

      for (start = startRow + 1, i = start, end = endRow, asc = start <= end; asc ? i < end : i > end; asc ? i++ : i--) {
        rectangles.push(new this.session.view.draw.Rectangle(textFocusView.bounds[i].x,
          textFocusView.bounds[i].y + this.session.view.opts.textPadding,
          textFocusView.bounds[i].width,
          this.session.view.opts.textHeight)
        );
      }

      rectangles.push(new this.session.view.draw.Rectangle(textFocusView.bounds[endRow].x,
        textFocusView.bounds[endRow].y + this.session.view.opts.textPadding,
        endPosition - textFocusView.bounds[endRow].x,
        this.session.view.opts.textHeight)
      );
    }

    const left = []; const right = [];
    for (i = 0; i < rectangles.length; i++) {
      const el = rectangles[i];
      left.push(new this.session.view.draw.Point(el.x, el.y));
      left.push(new this.session.view.draw.Point(el.x, el.bottom()));
      right.push(new this.session.view.draw.Point(el.right(), el.y));
      right.push(new this.session.view.draw.Point(el.right(), el.bottom()));
    }

    this.textCursorPath.setPoints(left.concat(right.reverse()));
    this.textCursorPath.style.strokeColor = 'none';
    this.textCursorPath.update();
    this.qualifiedFocus(this.getCursor(), this.textCursorPath);
  }

  if (scrollIntoView && (endPosition > (this.session.viewports.main.x + this.mainCanvas.clientWidth))) {
    return this.mainScroller.scrollLeft = (endPosition - this.mainCanvas.clientWidth) + this.session.view.opts.padding;
  }
};

const escapeString = str => str[0] + str.slice(1, -1).replace(/(\'|\"|\n)/g, '\\$1') + str[str.length - 1];

hook('mousedown', 7, function() {
  return this.hideDropdown();
});


// If we can, try to reparse the focus
// value.
//
// When reparsing occurs, we first try to treat the socket
// as a separate block (inserting parentheses, etc), then fall
// back on reparsing it with original text before giving up.
//
// For instance:
//
// (a * b)
//   -> edits [b] to [b + c]
//   -> reparse to b + c
//   -> inserts with parens to (a * (b + c))
//   -> finished.
//
// OR
//
// function (a) {}
//   -> edits [a] to [a, b]
//   -> reparse to a, b
//   -> inserts with parens to function((a, b)) {}
//   -> FAILS.
//   -> Fall back to raw reparsing the parent with unparenthesized text
//   -> Reparses function(a, b) {} with two paremeters.
//   -> Finsihed.
Editor.prototype.reparse = function(list, recovery, updates, originalTrigger) {
  // Don't reparse sockets. When we reparse sockets,
  // reparse them first, then try reparsing their parent and
  // make sure everything checks out.
  let context, newList;
  if (updates == null) { updates = []; }
  if (originalTrigger == null) { originalTrigger = list; }
  if (list.start.type === 'socketStart') {
    if (list.start.next === list.end) { return; }

    const originalText = list.textContent();
    const originalUpdates = updates.map(location => ({count: location.count, type: location.type}));

    // If our language mode has a string-fixing feature (in most languages,
    // this will simply autoescape quoted "strings"), apply it
    if (this.session.mode.stringFixer != null) {
      this.populateSocket(list, this.session.mode.stringFixer(list.textContent()));
    }

    // Try reparsing the parent after beforetextfocus. If it fails,
    // repopulate with the original text and try again.
    if (!this.reparse(list.parent, recovery, updates, originalTrigger)) {
      this.populateSocket(list, originalText);
      originalUpdates.forEach(function(location, i) {
        updates[i].count = location.count;
        return updates[i].type = location.type;
      });
      this.reparse(list.parent, recovery, updates, originalTrigger);
    }
    return;
  }

  let { parent } = list.start;

  if (((parent != null ? parent.type : undefined) === 'indent') && ((list.start.container != null ? list.start.container.parseContext : undefined) == null)) {
    context = parent.parseContext;
  } else {
    context = (list.start.container != null ? list.start.container : list.start.parent).parseContext;
  }

  try {
    newList = this.session.mode.parse(list.stringifyInPlace(),{
      wrapAtRoot: parent.type !== 'socket',
      context
    });
  } catch (e) {
    try {
      newList = this.session.mode.parse(recovery(list.stringifyInPlace()), {
        wrapAtRoot: parent.type !== 'socket',
        context
      });
    } catch (error) {
      // Seek a parent that is not a socket
      // (since we should never reparse just a socket)
      e = error;
      while ((parent != null) && (parent.type === 'socket')) {
        ({ parent } = parent);
      }

      // Attempt to bubble up to the parent
      if (parent != null) {
        return this.reparse(parent, recovery, updates, originalTrigger);
      } else {
        this.session.view.getViewNodeFor(originalTrigger).mark({color: '#F00'});
        return false;
      }
    }
  }

  if (newList.start.next === newList.end) { return; }

  // Exclude the document start and end tags
  newList = new model.List(newList.start.next, newList.end.prev);

  // Prepare the new node for insertion
  newList.traverseOneLevel(head => {
    return this.prepareNode(head, parent);
  });

  this.replace(list, newList, updates);

  this.redrawMain();
  return true;
};

Editor.prototype.setTextSelectionRange = function(selectionStart, selectionEnd) {
  if ((selectionStart != null) && (selectionEnd == null)) {
    selectionEnd = selectionStart;
  }

  // Focus the hidden input.
  if (this.cursorAtSocket()) {
    this.hiddenInput.focus();
    if ((selectionStart != null) && (selectionEnd != null)) {
      this.hiddenInput.setSelectionRange(selectionStart, selectionEnd);
    } else if ((this.hiddenInput.value[0] === this.hiddenInput.value[this.hiddenInput.value.length - 1]) &&
       ['\'', '"'].includes(this.hiddenInput.value[0])) {
      this.hiddenInput.setSelectionRange(1, this.hiddenInput.value.length - 1);
    } else {
      this.hiddenInput.setSelectionRange(0, this.hiddenInput.value.length);
    }
    this.redrawTextInput();
  }

  // Redraw.
  this.redrawMain(); return this.redrawTextInput();
};

Editor.prototype.cursorAtSocket = function() { return this.getCursor().type === 'socket'; };

Editor.prototype.populateSocket = function(socket, string) {
  if (socket.textContent() !== string) {
    let last;
    const lines = string.split('\n');

    if (socket.start.next !== socket.end) {
      this.spliceOut(new model.List(socket.start.next, socket.end.prev));
    }

    const first = (last = new model.TextToken(lines[0]));
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i > 0) {
        last = helper.connect(last, new model.NewlineToken());
        last = helper.connect(last, new model.TextToken(line));
      }
    }

    return this.spliceIn((new model.List(first, last)), socket.start);
  }
};

Editor.prototype.populateBlock = function(block, string) {
  const newBlock = this.session.mode.parse(string, {wrapAtRoot: false}).start.next.container;
  if (newBlock) {
    // Find the first token before the block
    // that will still be around after the
    // block has been removed
    let position = block.start.prev;
    while (((position != null ? position.type : undefined) === 'newline') && !(
          ((position.prev != null ? position.prev.type : undefined) === 'indentStart') &&
          (position.prev.container.end === block.end.next))) {
      position = position.prev;
    }
    this.spliceOut(block);
    this.spliceIn(newBlock, position);
    return true;
  }
  return false;
};

// Convenience hit-testing function
Editor.prototype.hitTestTextInput = function(point, block) {
  let head = block.start;
  while (head != null) {
    if ((head.type === 'socketStart') && head.container.isDroppable() &&
        this.session.view.getViewNodeFor(head.container).path.contains(point)) {
      return head.container;
    }
    head = head.next;
  }

  return null;
};

// Convenience functions for setting
// the text input selection, given
// points on the main canvas.
Editor.prototype.getTextPosition = function(point) {
  const textFocusView = this.session.view.getViewNodeFor(this.getCursor());

  let row = Math.floor((point.y - textFocusView.bounds[0].y) / (this.session.fontSize + (2 * this.session.view.opts.padding)));

  row = Math.max(row, 0);
  row = Math.min(row, textFocusView.lineLength - 1);

  const column = Math.max(0, Math.round((point.x - textFocusView.bounds[row].x - this.session.view.opts.textPadding - (this.getCursor().hasDropdown() ? helper.DROPDOWN_ARROW_WIDTH : 0)) / this.session.fontWidth));

  const lines = this.getCursor().stringify().split('\n').slice(0, +row + 1 || undefined);
  lines[lines.length - 1] = lines[lines.length - 1].slice(0, column);

  return lines.join('\n').length;
};

Editor.prototype.setTextInputAnchor = function(point) {
  this.textInputAnchor = (this.textInputHead = this.getTextPosition(point));
  return this.hiddenInput.setSelectionRange(this.textInputAnchor, this.textInputHead);
};

Editor.prototype.selectDoubleClick = function(point) {
  let left, left1;
  const position = this.getTextPosition(point);

  const before = (left = __guard__(this.getCursor().stringify().slice(0, position).match(/\w*$/)[0], x => x.length)) != null ? left : 0;
  const after = (left1 = __guard__(this.getCursor().stringify().slice(position).match(/^\w*/)[0], x1 => x1.length)) != null ? left1 : 0;

  this.textInputAnchor = position - before;
  this.textInputHead = position + after;

  return this.hiddenInput.setSelectionRange(this.textInputAnchor, this.textInputHead);
};

Editor.prototype.setTextInputHead = function(point) {
  this.textInputHead = this.getTextPosition(point);
  return this.hiddenInput.setSelectionRange(Math.min(this.textInputAnchor, this.textInputHead), Math.max(this.textInputAnchor, this.textInputHead));
};

// On mousedown, we will want to start
// selections and focus text inputs
// if we apply.

Editor.prototype.handleTextInputClick = function(mainPoint, dropletDocument) {
  const hitTestResult = this.hitTestTextInput(mainPoint, dropletDocument);

  // If they have clicked a socket,
  // focus it.
  if (hitTestResult != null) {
    if (hitTestResult !== this.getCursor()) {
      if (hitTestResult.editable()) {
        this.undoCapture();
        this.setCursor(hitTestResult);
        this.redrawMain();
      }

      if (hitTestResult.hasDropdown() && ((!hitTestResult.editable()) ||
          ((mainPoint.x - this.session.view.getViewNodeFor(hitTestResult).bounds[0].x) < helper.DROPDOWN_ARROW_WIDTH))) {
        this.showDropdown(hitTestResult);
      }

      this.textInputSelecting = false;

    } else {
      if (this.getCursor().hasDropdown() &&
          ((mainPoint.x - this.session.view.getViewNodeFor(hitTestResult).bounds[0].x) < helper.DROPDOWN_ARROW_WIDTH)) {
        this.showDropdown();
      }

      this.setTextInputAnchor(mainPoint);
      this.redrawTextInput();

      this.textInputSelecting = true;
    }

    // Now that we have focused the text element
    // in the Droplet model, focus the hidden input.
    //
    // It is important that this be done after the Droplet model
    // has focused its text element, because
    // the hidden input moves on the focus() event to
    // the currently-focused Droplet element to make
    // mobile screen scroll properly.
    this.hiddenInput.focus();

    return true;
  } else {
    return false;
  }
};

// Convenience hit-testing function
Editor.prototype.hitTestTextInputInPalette = function(point, block) {
  let head = block.start;
  while (head != null) {
    if ((head.type === 'socketStart') && head.container.isDroppable() &&
        this.session.paletteView.getViewNodeFor(head.container).path.contains(point)) {
      return head.container;
    }
    head = head.next;
  }

  return null;
};

Editor.prototype.handleTextInputClickInPalette = function(palettePoint) {
  for (let entry of Array.from(this.session.currentPaletteBlocks)) {
    const hitTestResult = this.hitTestTextInputInPalette(palettePoint, entry.block);

    // If they have clicked a socket, check to see if it is a dropdown
    if (hitTestResult != null) {
      if (hitTestResult.hasDropdown()) {
        this.showDropdown(hitTestResult, true);
        return true;
      }
    }
  }

  return false;
};


// Create the dropdown DOM element at populate time.
hook('populate', 0, function() {
  this.dropdownElement = document.createElement('div');
  this.dropdownElement.className = 'droplet-dropdown';
  this.wrapperElement.appendChild(this.dropdownElement);

  this.dropdownElement.innerHTML = '';
  this.dropdownElement.style.display = 'inline-block';
  return this.dropdownVisible = false;
});

// Update the dropdown to match
// the current text focus font and size.
Editor.prototype.formatDropdown = function(socket, view) {
  if (socket == null) { socket = this.getCursor(); }
  if (view == null) { ({ view } = this.session); }
  this.dropdownElement.style.fontFamily = this.session.fontFamily;
  this.dropdownElement.style.fontSize = this.session.fontSize;
  return this.dropdownElement.style.minWidth = view.getViewNodeFor(socket).bounds[0].width;
};

Editor.prototype.getDropdownList = function(socket) {
  let result = socket.dropdown;
  if (result.generate) {
    result = result.generate;
  }
  if ('function' === typeof result) {
    result = socket.dropdown();
  } else {
    result = socket.dropdown;
  }
  if (result.options) {
    result = result.options;
  }
  const newresult = [];
  for (let key in result) {
    const val = result[key];
    newresult.push('string' === typeof val ? { text: val, display: val } : val);
  }
  return newresult;
};

Editor.prototype.showDropdown = function(socket, inPalette) {
  let el;
  if (socket == null) { socket = this.getCursor(); }
  if (inPalette == null) { inPalette = false; }
  this.dropdownVisible = true;

  const dropdownItems = [];

  this.dropdownElement.innerHTML = '';
  this.dropdownElement.style.display = 'inline-block';

  this.formatDropdown(socket, inPalette ? this.session.paletteView : this.session.view);

  const iterable = this.getDropdownList(socket);
  for (let i = 0; i < iterable.length; i++) { el = iterable[i]; (el => {
    const div = document.createElement('div');
    div.innerHTML = el.display;
    div.className = 'droplet-dropdown-item';

    dropdownItems.push(div);

    div.style.paddingLeft = helper.DROPDOWN_ARROW_WIDTH;

    const setText = text => {
      this.undoCapture();

      // Attempting to populate the socket after the dropdown has closed should no-op
      if (this.dropdownElement.style.display === 'none') {
        return;
      }

      if (inPalette) {
        this.populateSocket(socket, text);
        this.redrawPalette();
      } else if (!socket.editable()) {
        this.populateSocket(socket, text);
        this.redrawMain();
      } else {
        if (!this.cursorAtSocket()) {
          return;
        }
        this.populateSocket(this.getCursor(), text);
        this.hiddenInput.value = text;
        this.redrawMain();
      }

      return this.hideDropdown();
    };

    div.addEventListener('mouseup', function() {
      if (el.click) {
        return el.click(setText);
      } else {
        return setText(el.text);
      }
    });

    return this.dropdownElement.appendChild(div);
  })(el); }

  this.dropdownElement.style.top = '-9999px';
  this.dropdownElement.style.left = '-9999px';

  // Wait for a render. Then,
  // if the div is scrolled vertically, add
  // some padding on the right. After checking for this,
  // move the dropdown element into position
  return setTimeout((() => {
    let dropdownTop, location;
    if (this.dropdownElement.clientHeight < this.dropdownElement.scrollHeight) {
      for (el of Array.from(dropdownItems)) {
        el.style.paddingRight = DROPDOWN_SCROLLBAR_PADDING;
      }
    }

    if (inPalette) {
      location = this.session.paletteView.getViewNodeFor(socket).bounds[0];
      this.dropdownElement.style.left = (location.x - this.session.viewports.palette.x) + this.paletteCanvas.clientLeft + 'px';
      this.dropdownElement.style.minWidth = location.width + 'px';

      dropdownTop = ((location.y + this.session.fontSize) - this.session.viewports.palette.y) + this.paletteCanvas.clientTop;
      if ((dropdownTop + this.dropdownElement.clientHeight) > this.paletteElement.clientHeight) {
        dropdownTop -= (this.session.fontSize + this.dropdownElement.clientHeight);
      }
      return this.dropdownElement.style.top = dropdownTop + 'px';
    } else {
      location = this.session.view.getViewNodeFor(socket).bounds[0];
      this.dropdownElement.style.left = (location.x - this.session.viewports.main.x) + this.dropletElement.offsetLeft + this.gutter.clientWidth + 'px';
      this.dropdownElement.style.minWidth = location.width + 'px';

      dropdownTop = (location.y + this.session.fontSize) - this.session.viewports.main.y;
      if ((dropdownTop + this.dropdownElement.clientHeight) > this.dropletElement.clientHeight) {
        dropdownTop -= (this.session.fontSize + this.dropdownElement.clientHeight);
      }
      return this.dropdownElement.style.top = dropdownTop + 'px';
    }
  }
  ), 0);
};

Editor.prototype.hideDropdown = function() {
  this.dropdownVisible = false;
  this.dropdownElement.style.display = 'none';
  return this.dropletElement.focus();
};

hook('dblclick', 0, function(point, event, state) {
  // If someone else already took this click, return.
  if (state.consumedHitTest) { return; }

  for (let dropletDocument of Array.from(this.getDocuments())) {
    // Otherwise, look for a socket that
    // the user has clicked
    var mainPoint = this.trackerPointToMain(point);
    let hitTestResult = this.hitTestTextInput(mainPoint, this.session.tree);

    // If they have clicked a socket,
    // focus it, and
    if (hitTestResult !== this.getCursor()) {
      if ((hitTestResult != null) && hitTestResult.editable()) {
        this.redrawMain();
        hitTestResult = this.hitTestTextInput(mainPoint, this.session.tree);
      }
    }

    if ((hitTestResult != null) && hitTestResult.editable()) {
      this.setCursor(hitTestResult);
      this.redrawMain();

      setTimeout((() => {
        this.selectDoubleClick(mainPoint);
        this.redrawTextInput();

        return this.textInputSelecting = false;
      }
      ), 0);

      state.consumedHitTest = true;
      return;
    }
  }
});

// On mousemove, if we are selecting,
// we want to update the selection
// to match the mouse.
hook('mousemove', 0, function(point, event, state) {
  if (this.textInputSelecting) {
    if (!this.cursorAtSocket()) {
      this.textInputSelecting = false; return;
    }

    const mainPoint = this.trackerPointToMain(point);

    this.setTextInputHead(mainPoint);

    return this.redrawTextInput();
  }
});

// On mouseup, we want to stop selecting.
hook('mouseup', 0, function(point, event, state) {
  if (this.textInputSelecting) {
    const mainPoint = this.trackerPointToMain(point);

    this.setTextInputHead(mainPoint);

    this.redrawTextInput();

    return this.textInputSelecting = false;
  }
});

// LASSO SELECT SUPPORT
// ===============================

// The lasso select
// will have its own canvas
// for drawing the lasso. This needs
// to be added at populate-time, along
// with some fields.
hook('populate', 0, function() {
  this.lassoSelectRect = document.createElementNS(SVG_STANDARD, 'rect');
  this.lassoSelectRect.setAttribute('stroke', '#00f');
  this.lassoSelectRect.setAttribute('fill', 'none');

  this.lassoSelectAnchor = null;
  this.lassoSelection = null;

  return this.mainCanvas.appendChild(this.lassoSelectRect);
});

Editor.prototype.clearLassoSelection = function() {
  this.lassoSelection = null;
  return this.redrawHighlights();
};

// On mousedown, if nobody has taken
// a hit test yet, start a lasso select.
hook('mousedown', 0, function(point, event, state) {
  // Even if someone has taken it, we
  // should remove the lasso segment that is
  // already there.
  if (!state.clickedLassoSelection) { this.clearLassoSelection(); }

  if (state.consumedHitTest || state.suppressLassoSelect) { return; }

  // If it's not in the main pane, pass.
  if (!this.trackerPointIsInMain(point)) { return; }
  if (this.trackerPointIsInPalette(point)) { return; }

  // If the point was actually in the main canvas,
  // start a lasso select.
  const mainPoint = this.trackerPointToMain(point).from(this.session.viewports.main);
  const palettePoint = this.trackerPointToPalette(point).from(this.session.viewports.palette);

  return this.lassoSelectAnchor = this.trackerPointToMain(point);
});

// On mousemove, if we are in the middle of a
// lasso select, continue with it.
hook('mousemove', 0, function(point, event, state) {
  if (this.lassoSelectAnchor != null) {
    const mainPoint = this.trackerPointToMain(point);

    const lassoRectangle = new this.draw.Rectangle(
      Math.min(this.lassoSelectAnchor.x, mainPoint.x),
      Math.min(this.lassoSelectAnchor.y, mainPoint.y),
      Math.abs(this.lassoSelectAnchor.x - mainPoint.x),
      Math.abs(this.lassoSelectAnchor.y - mainPoint.y)
    );

    const findLassoSelect = dropletDocument => {
      let first = dropletDocument.start;
      while ((!(first == null)) && ((first.type !== 'blockStart') || !this.session.view.getViewNodeFor(first.container).path.intersects(lassoRectangle))) {
        first = first.next;
      }

      let last = dropletDocument.end;
      while ((!(last == null)) && ((last.type !== 'blockEnd') || !this.session.view.getViewNodeFor(last.container).path.intersects(lassoRectangle))) {
        last = last.prev;
      }

      this.clearHighlightCanvas();
      this.mainCanvas.appendChild(this.lassoSelectRect);
      this.lassoSelectRect.style.display = 'block';
      this.lassoSelectRect.setAttribute('x', lassoRectangle.x);
      this.lassoSelectRect.setAttribute('y', lassoRectangle.y);
      this.lassoSelectRect.setAttribute('width', lassoRectangle.width);
      this.lassoSelectRect.setAttribute('height', lassoRectangle.height);

      if (first && (last != null)) {
        [first, last] = Array.from(validateLassoSelection(dropletDocument, first, last));
        this.lassoSelection = new model.List(first, last);
        this.redrawLassoHighlight();
        return true;
      } else {
        this.lassoSelection = null;
        this.redrawLassoHighlight();
        return false;
      }
    };

    if ((this.lassoSelectionDocument == null) || !findLassoSelect(this.lassoSelectionDocument)) {
      return (() => {
        const result = [];
        for (let dropletDocument of Array.from(this.getDocuments())) {
          if (findLassoSelect(dropletDocument)) {
            this.lassoSelectionDocument = dropletDocument;
            break;
          } else {
            result.push(undefined);
          }
        }
        return result;
      })();
    }
  }
});

Editor.prototype.redrawLassoHighlight = function() {
  if (this.session == null) { return; }

  // Remove any existing selections
  for (let dropletDocument of Array.from(this.getDocuments())) {
    const dropletDocumentView = this.session.view.getViewNodeFor(dropletDocument);
    dropletDocumentView.draw(this.session.viewports.main, {
      selected: false,
      noText: this.currentlyAnimating // TODO add some modularized way of having global view options
    });
  }

  if (this.lassoSelection != null) {
    // Add any new selections
    const lassoView = this.session.view.getViewNodeFor(this.lassoSelection);
    lassoView.absorbCache();
    return lassoView.draw(this.session.viewports.main, {selected: true});
  }
};

// Convnience function for validating
// a lasso selection. A lasso selection
// cannot contain start tokens without
// their corresponding end tokens, or vice
// versa, and also must start and end
// with blocks (not Indents).
var validateLassoSelection = function(tree, first, last) {
  const tokensToInclude = [];
  let head = first;
  while (head !== last.next) {
    if (head instanceof model.StartToken ||
       head instanceof model.EndToken) {
      tokensToInclude.push(head.container.start);
      tokensToInclude.push(head.container.end);
    }
    head = head.next;
  }

  first = tree.start;
  while (Array.from(tokensToInclude).includes(first)) { first = first.next; }

  last = tree.end;
  while (Array.from(tokensToInclude).includes(last)) { last = last.prev; }

  while (first.type !== 'blockStart') {
    first = first.prev;
    if (first.type === 'blockEnd') { first = first.container.start.prev; }
  }

  while (last.type !== 'blockEnd') {
    last = last.next;
    if (last.type === 'blockStart') { last = last.container.end.next; }
  }

  return [first, last];
};

// On mouseup, if we were
// doing a lasso select, insert a lasso
// select segment.
hook('mouseup', 0, function(point, event, state) {
  if (this.lassoSelectAnchor != null) {
    if (this.lassoSelection != null) {
      // Move the cursor to the selection
      this.setCursor(this.lassoSelection.end);
    }

    this.lassoSelectAnchor = null;
    this.lassoSelectRect.style.display = 'none';

    this.redrawHighlights();
  }
  return this.lassoSelectionDocument = null;
});

// On mousedown, we might want to
// pick a selected segment up; check.
hook('mousedown', 3, function(point, event, state) {
  if (state.consumedHitTest) { return; }

  if ((this.lassoSelection != null) && (this.hitTest(this.trackerPointToMain(point), this.lassoSelection) != null)) {
    this.clickedBlock = this.lassoSelection;
    this.clickedBlockPaletteEntry = null;
    this.clickedPoint = point;

    state.consumedHitTest = true;
    return state.clickedLassoSelection = true;
  }
});

// CURSOR OPERATION SUPPORT
// ================================
class CrossDocumentLocation {
  constructor(document, location) {
    this.document = document;
    this.location = location;
  }

  is(other) { return this.location.is(other.location) && (this.document === other.document); }

  clone() {
    return new CrossDocumentLocation(
      this.document,
      this.location.clone()
    );
  }
}

Editor.prototype.validCursorPosition = destination =>
  ['documentStart', 'indentStart'].includes(destination.type) ||
         ((destination.type === 'blockEnd') && ['document', 'indent'].includes(destination.parent.type)) ||
         ((destination.type === 'socketStart') && destination.container.editable())
;

// A cursor is only allowed to be on a line.
Editor.prototype.setCursor = function(destination, validate, direction) {
  if (validate == null) { validate = () => true; }
  if (direction == null) { direction = 'after'; }
  if ((destination != null) && destination instanceof CrossDocumentLocation) {
    destination = this.fromCrossDocumentLocation(destination);
  }

  // Abort if there is no destination (usually means
  // someone wants to travel outside the document)
  if ((destination == null) || !this.inDisplay(destination)) { return; }

  // Now set the new cursor
  if (destination instanceof model.Container) {
    destination = destination.start;
  }

  while (!this.validCursorPosition(destination) || !validate(destination)) {
    destination = (direction === 'after' ? destination.next : destination.prev);
    if (destination == null) { return; }
  }

  destination = this.toCrossDocumentLocation(destination);

  // If the cursor was at a text input, reparse the old one
  if (this.cursorAtSocket() && !this.session.cursor.is(destination)) {
    const socket = this.getCursor();
    if (!Array.from(socket.classes).includes('__comment__')) {
      this.reparse(socket, null, (destination.document === this.session.cursor.document ? [destination.location] : []));
      this.hiddenInput.blur();
      this.dropletElement.focus();
    }
  }

  this.session.cursor = destination;

  // If we have messed up (usually because
  // of a reparse), scramble to find a nearby
  // okay place for the cursor
  this.correctCursor();

  this.redrawMain();
  this.highlightFlashShow();

  // If we are now at a text input, populate the hidden input
  if (this.cursorAtSocket()) {
    if (__guard__(this.getCursor(), x => x.id) in this.session.extraMarks) {
      delete this.session.extraMarks[typeof focus !== 'undefined' && focus !== null ? focus.id : undefined];
    }
    this.undoCapture();
    this.hiddenInput.value = this.getCursor().textContent();
    this.hiddenInput.focus();
    const {start, end} = this.session.mode.getDefaultSelectionRange(this.hiddenInput.value);
    return this.setTextSelectionRange(start, end);
  }
};

Editor.prototype.determineCursorPosition = function() {
  // Do enough of the redraw to get the bounds
  let bound, line;
  this.session.view.getViewNodeFor(this.session.tree).layout(0, this.nubbyHeight);

  // Get a cursor that is in the model
  const cursor = this.getCursor();

  if (cursor.type === 'documentStart') {
    bound = this.session.view.getViewNodeFor(cursor.container).bounds[0];
    return new this.draw.Point(bound.x, bound.y);

  } else if (cursor.type === 'indentStart') {
    line = cursor.next.type === 'newline' ? 1 : 0;
    bound = this.session.view.getViewNodeFor(cursor.container).bounds[line];
    return new this.draw.Point(bound.x, bound.y);

  } else {
    line = this.getCursor().getTextLocation().row - cursor.parent.getTextLocation().row;
    bound = this.session.view.getViewNodeFor(cursor.parent).bounds[line];
    return new this.draw.Point(bound.x, bound.bottom());
  }
};

Editor.prototype.getCursor = function() {
  const cursor = this.fromCrossDocumentLocation(this.session.cursor);

  if (cursor.type === 'socketStart') {
    return cursor.container;
  } else {
    return cursor;
  }
};

Editor.prototype.scrollCursorIntoPosition = function() {
  const axis = this.determineCursorPosition().y;

  if (axis < this.session.viewports.main.y) {
    this.mainScroller.scrollTop = axis;
  } else if (axis > this.session.viewports.main.bottom()) {
    this.mainScroller.scrollTop = axis - this.session.viewports.main.height;
  }

  return this.mainScroller.scrollLeft = 0;
};

// Moves the cursor to the end of the document and scrolls it into position
// (in block and text mode)
Editor.prototype.scrollCursorToEndOfDocument = function() {
  if (this.session.currentlyUsingBlocks) {
    let pos = this.session.tree.end;
    while (pos && !this.validCursorPosition(pos)) {
      pos = pos.prev;
    }
    this.setCursor(pos);
    return this.scrollCursorIntoPosition();
  } else {
    return this.aceEditor.scrollToLine(this.aceEditor.session.getLength());
  }
};


// Pressing the up-arrow moves the cursor up.
hook('keydown', 0, function(event, state) {
  let next, prev;
  if (event.which === UP_ARROW_KEY) {
    let left;
    this.clearLassoSelection();
    prev = (left = this.getCursor().prev) != null ? left : __guard__(this.getCursor().start, x => x.prev);
    this.setCursor(prev, (token => token.type !== 'socketStart'), 'before');
    return this.scrollCursorIntoPosition();
  } else if (event.which === DOWN_ARROW_KEY) {
    let left1;
    this.clearLassoSelection();
    next = (left1 = this.getCursor().next) != null ? left1 : __guard__(this.getCursor().end, x1 => x1.next);
    this.setCursor(next, (token => token.type !== 'socketStart'), 'after');
    return this.scrollCursorIntoPosition();
  } else if ((event.which === RIGHT_ARROW_KEY) &&
      (!this.cursorAtSocket() ||
      (this.hiddenInput.selectionStart === this.hiddenInput.value.length))) {
    let left2;
    this.clearLassoSelection();
    next = (left2 = this.getCursor().next) != null ? left2 : __guard__(this.getCursor().end, x2 => x2.next);
    this.setCursor(next, null, 'after');
    this.scrollCursorIntoPosition();
    return event.preventDefault();
  } else if ((event.which === LEFT_ARROW_KEY) &&
      (!this.cursorAtSocket() ||
      (this.hiddenInput.selectionEnd === 0))) {
    let left3;
    this.clearLassoSelection();
    prev = (left3 = this.getCursor().prev) != null ? left3 : __guard__(this.getCursor().start, x3 => x3.prev);
    this.setCursor(prev, null, 'before');
    this.scrollCursorIntoPosition();
    return event.preventDefault();
  }
});

hook('keydown', 0, function(event, state) {
  if (event.which !== TAB_KEY) { return; }

  if (event.shiftKey) {
    let left;
    const prev = (left = this.getCursor().prev) != null ? left : __guard__(this.getCursor().start, x => x.prev);
    this.setCursor(prev, (token => token.type === 'socketStart'), 'before');
  } else {
    let left1;
    const next = (left1 = this.getCursor().next) != null ? left1 : __guard__(this.getCursor().end, x1 => x1.next);
    this.setCursor(next, (token => token.type === 'socketStart'), 'after');
  }
  return event.preventDefault();
});

Editor.prototype.deleteAtCursor = function() {
  let block;
  if (this.getCursor().type === 'blockEnd') {
    block = this.getCursor().container;
  } else if (this.getCursor().type === 'indentStart') {
    block = this.getCursor().parent;
  } else {
    return;
  }

  this.setCursor(block.start, null, 'before');
  this.undoCapture();
  this.spliceOut(block);
  return this.redrawMain();
};

hook('keydown', 0, function(event, state) {
  if ((this.session == null) || this.session.readOnly) {
    return;
  }
  if (event.which !== BACKSPACE_KEY) {
    return;
  }
  if (state.capturedBackspace) {
    return;
  }

  // We don't want to interrupt any text input editing
  // sessions. We will, however, delete a handwritten
  // block if it is currently empty.
  if (this.lassoSelection != null) {
    this.deleteLassoSelection();
    event.preventDefault();
    return false;

  } else if (!this.cursorAtSocket() ||
      ((this.hiddenInput.value.length === 0) && this.getCursor().handwritten)) {
    this.deleteAtCursor();
    state.capturedBackspace = true;
    event.preventDefault();
    return false;
  }

  return true;
});

Editor.prototype.deleteLassoSelection = function() {
  if (this.lassoSelection == null) {
    if (DEBUG_FLAG) {
      throw new Error('Cannot delete nonexistent lasso segment');
    }
    return null;
  }

  const cursorTarget = this.lassoSelection.start.prev;

  this.spliceOut(this.lassoSelection);
  this.lassoSelection = null;

  this.setCursor(cursorTarget);

  return this.redrawMain();
};

// HANDWRITTEN BLOCK SUPPORT
// ================================

hook('keydown', 0, function(event, state) {
  if ((this.session == null) || this.session.readOnly) {
    return;
  }
  if (event.which === ENTER_KEY) {
    let head, newBlock, newSocket;
    if (!this.cursorAtSocket() && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      // Construct the block; flag the socket as handwritten
      newBlock = new model.Block(); newSocket = new model.Socket('', Infinity, true);
      newSocket.setParent(newBlock);
      helper.connect(newBlock.start, newSocket.start);
      helper.connect(newSocket.end, newBlock.end);

      // Seek a place near the cursor we can actually
      // put a block.
      head = this.getCursor();
      while (head.type === 'newline') {
        head = head.prev;
      }

      newSocket.parseContext = head.parent.parseContext;

      this.spliceIn(newBlock, head); //MUTATION

      this.redrawMain();

      return this.newHandwrittenSocket = newSocket;

    } else if (this.cursorAtSocket() && !event.shiftKey) {
      const socket = this.getCursor();
      this.hiddenInput.blur();
      this.dropletElement.focus();
      this.setCursor(this.session.cursor, token => token.type !== 'socketStart');
      this.redrawMain();
      if (Array.from(socket.classes).includes('__comment__') && this.session.mode.startSingleLineComment) {
        // Create another single line comment block just below
        newBlock = new model.Block(0, 'blank', helper.ANY_DROP);
        newBlock.classes = ['__comment__', 'block-only'];
        newBlock.socketLevel = helper.BLOCK_ONLY;
        const newTextMarker = new model.TextToken(this.session.mode.startSingleLineComment);
        newTextMarker.setParent(newBlock);
        newSocket = new model.Socket('', 0, true);
        newSocket.classes = ['__comment__'];
        newSocket.setParent(newBlock);

        helper.connect(newBlock.start, newTextMarker);
        helper.connect(newTextMarker, newSocket.start);
        helper.connect(newSocket.end, newBlock.end);

        // Seek a place near the cursor we can actually
        // put a block.
        head = this.getCursor();
        while (head.type === 'newline') {
          head = head.prev;
        }

        this.spliceIn(newBlock, head); //MUTATION

        this.redrawMain();

        return this.newHandwrittenSocket = newSocket;
      }
    }
  }
});

hook('keyup', 0, function(event, state) {
  if ((this.session == null) || this.session.readOnly) {
    return;
  }
  // prevents routing the initial enter keypress to a new handwritten
  // block by focusing the block only after the enter key is released.
  if (event.which === ENTER_KEY) {
    if (this.newHandwrittenSocket != null) {
      this.setCursor(this.newHandwrittenSocket);
      return this.newHandwrittenSocket = null;
    }
  }
});

const containsCursor = function(block) {
  let head = block.start;
  while (head !== block.end) {
    if (head.type === 'cursor') { return true; }
    head = head.next;
  }

  return false;
};

// ANIMATION AND ACE EDITOR SUPPORT
// ================================

Editor.prototype.copyAceEditor = function() {
  this.gutter.style.width = this.aceEditor.renderer.$gutterLayer.gutterWidth + 'px';
  this.resizeBlockMode();
  return this.setValue_raw(this.getAceValue());
};

// For animation and ace editor,
// we will need a couple convenience functions
// for getting the "absolute"-esque position
// of layouted elements (a la jQuery, without jQuery).
var getOffsetTop = function(element) {
  let top = element.offsetTop;

  while ((element = element.offsetParent) != null) {
    top += element.offsetTop;
  }

  return top;
};

var getOffsetLeft = function(element) {
  let left = element.offsetLeft;

  while ((element = element.offsetParent) != null) {
    left += element.offsetLeft;
  }

  return left;
};

Editor.prototype.computePlaintextTranslationVectors = function() {
  // Now we need to figure out where all the text elements are going
  // to end up.
  const textElements = []; const translationVectors = [];

  let head = this.session.tree.start;

  const aceSession = this.aceEditor.session;
  const state = {
    // Initial cursor positions are
    // determined by ACE editor configuration.
    x: (((this.aceEditor.container.getBoundingClientRect().left -
        this.aceElement.getBoundingClientRect().left) +
        this.aceEditor.renderer.$gutterLayer.gutterWidth) -
        this.gutter.clientWidth) + 5, // TODO find out where this 5 comes from
    y: (this.aceEditor.container.getBoundingClientRect().top -
        this.aceElement.getBoundingClientRect().top) -
        aceSession.getScrollTop(),

    // Initial indent depth is 0
    indent: 0,

    // Line height and left edge are
    // determined by ACE editor configuration.
    lineHeight: this.aceEditor.renderer.layerConfig.lineHeight,
    leftEdge: (((this.aceEditor.container.getBoundingClientRect().left -
        getOffsetLeft(this.aceElement)) +
        this.aceEditor.renderer.$gutterLayer.gutterWidth) -
        this.gutter.clientWidth) + 5 // TODO see above
  };

  this.measureCtx.font = this.aceFontSize() + ' ' + this.session.fontFamily;
  const fontWidth = this.measureCtx.measureText(' ').width;

  let rownum = 0;
  while (head !== this.session.tree.end) {
    switch (head.type) {
      case 'text':
        var corner = this.session.view.getViewNodeFor(head).bounds[0].upperLeftCorner();

        corner.x -= this.session.viewports.main.x;
        corner.y -= this.session.viewports.main.y;

        translationVectors.push((new this.draw.Point(state.x, state.y)).from(corner));
        textElements.push(this.session.view.getViewNodeFor(head));

        state.x += fontWidth * head.value.length;
        break;

      case 'socketStart':
        if ((head.next === head.container.end) ||
            ((head.next.type === 'text') && (head.next.value === ''))) {
          state.x += fontWidth * head.container.emptyString.length;
        }
        break;

      // Newline moves the cursor to the next line,
      // plus some indent.
      case 'newline':
        // Be aware of wrapped ace editor lines.
        var wrappedlines = Math.max(1,
            aceSession.documentToScreenRow(rownum + 1, 0) -
            aceSession.documentToScreenRow(rownum, 0));
        rownum += 1;
        state.y += state.lineHeight * wrappedlines;
        if (head.specialIndent != null) {
          state.x = state.leftEdge + (fontWidth * head.specialIndent.length);
        } else {
          state.x = state.leftEdge + (state.indent * fontWidth);
        }
        break;

      case 'indentStart':
        state.indent += head.container.depth;
        break;

      case 'indentEnd':
        state.indent -= head.container.depth;
        break;
    }

    head = head.next;
  }

  return {
    textElements,
    translationVectors
  };
};

Editor.prototype.checkAndHighlightEmptySockets = function() {
  let head = this.session.tree.start;
  let ok = true;
  while (head !== this.session.tree.end) {
    if ((((head.type === 'socketStart') && (head.next === head.container.end)) ||
       ((head.type === 'socketStart') && (head.next.type === 'text') && (head.next.value === ''))) &&
       (head.container.emptyString !== '')) {
      this.markBlock(head.container, {color: '#F00'});
      ok = false;
    }
    head = head.next;
  }
  return ok;
};

Editor.prototype.performMeltAnimation = function(fadeTime, translateTime, cb) {
  if (fadeTime == null) { fadeTime = 500; }
  if (translateTime == null) { translateTime = 1000; }
  if (cb == null) { cb = function() {}; }
  if (this.session.currentlyUsingBlocks && !this.currentlyAnimating) {

    // If the preserveEmpty option is turned off, we will not round-trip empty sockets.
    //
    // Therefore, forbid melting if there is an empty socket. If there is,
    // highlight it in red.
    let div;
    if (!this.session.options.preserveEmpty && !this.checkAndHighlightEmptySockets()) {
      this.redrawMain();
      return;
    }

    this.hideDropdown();

    this.fireEvent('statechange', [false]);

    this.setAceValue(this.getValue());

    let top = this.findLineNumberAtCoordinate(this.session.viewports.main.y);

    this.aceEditor.scrollToLine(top);

    this.aceEditor.resize(true);

    this.redrawMain({noText: true});

    // Hide scrollbars and increase width
    if (this.mainScroller.scrollWidth > this.mainScroller.clientWidth) {
      this.mainScroller.style.overflowX = 'scroll';
    } else {
      this.mainScroller.style.overflowX = 'hidden';
    }
    this.mainScroller.style.overflowY = 'hidden';
    this.dropletElement.style.width = this.wrapperElement.clientWidth + 'px';

    this.session.currentlyUsingBlocks = false; this.currentlyAnimating = (this.currentlyAnimating_suppressRedraw = true);

    // Compute where the text will end up
    // in the ace editor
    const {textElements, translationVectors} = this.computePlaintextTranslationVectors();

    const translatingElements = [];

    for (let i = 0; i < textElements.length; i++) {

      // Skip anything that's
      // off the screen the whole time.
      const textElement = textElements[i];
      if (!(0 < ((textElement.bounds[0].bottom() - this.session.viewports.main.y) + translationVectors[i].y)) ||
                 !(((textElement.bounds[0].y - this.session.viewports.main.y) + translationVectors[i].y) < this.session.viewports.main.height)) {
        continue;
      }

      div = document.createElement('div');
      div.style.whiteSpace = 'pre';

      div.innerText = (div.textContent = textElement.model.value);

      div.style.font = this.session.fontSize + 'px ' + this.session.fontFamily;

      div.style.left = `${textElement.bounds[0].x - this.session.viewports.main.x}px`;
      div.style.top = `${textElement.bounds[0].y - this.session.viewports.main.y - this.session.fontAscent}px`;

      div.className = 'droplet-transitioning-element';
      div.style.transition = `left ${translateTime}ms, top ${translateTime}ms, font-size ${translateTime}ms`;
      translatingElements.push(div);

      this.transitionContainer.appendChild(div);

      ((div, textElement, translationVectors, i) => {
        return setTimeout((() => {
          div.style.left = ((textElement.bounds[0].x - this.session.viewports.main.x) + translationVectors[i].x) + 'px';
          div.style.top = ((textElement.bounds[0].y - this.session.viewports.main.y) + translationVectors[i].y) + 'px';
          return div.style.fontSize = this.aceFontSize();
        }
        ), fadeTime);
      })(div, textElement, translationVectors, i);
    }

    top = Math.max(this.aceEditor.getFirstVisibleRow(), 0);
    const bottom = Math.min(this.aceEditor.getLastVisibleRow(), this.session.view.getViewNodeFor(this.session.tree).lineLength - 1);
    const aceScrollTop = this.aceEditor.session.getScrollTop();

    const treeView = this.session.view.getViewNodeFor(this.session.tree);
    const { lineHeight } = this.aceEditor.renderer.layerConfig;

    for (let line = top, end = bottom, asc = top <= end; asc ? line <= end : line >= end; asc ? line++ : line--) {
      div = document.createElement('div');
      div.style.whiteSpace = 'pre';

      div.innerText = (div.textContent = line + 1);

      div.style.left = 0;
      div.style.top = `${(treeView.bounds[line].y + treeView.distanceToBase[line].above) - this.session.view.opts.textHeight - this.session.fontAscent - this.session.viewports.main.y}px`;

      div.style.font = this.session.fontSize + 'px ' + this.session.fontFamily;
      div.style.width = `${this.gutter.clientWidth}px`;

      translatingElements.push(div);

      div.className = 'droplet-transitioning-element droplet-transitioning-gutter droplet-gutter-line';
      // Add annotation
      if (this.annotations[line] != null) {
        div.className += ` droplet_${getMostSevereAnnotationType(this.annotations[line])}`;
      }
      div.style.transition = `left ${translateTime}ms, top ${translateTime}ms, font-size ${translateTime}ms`;

      this.dropletElement.appendChild(div);

      ((div, line) => {
        // Set off the css transition
        return setTimeout((() => {
          div.style.left = '0px';
          div.style.top = ((this.aceEditor.session.documentToScreenRow(line, 0) *
              lineHeight) - aceScrollTop) + 'px';
          return div.style.fontSize = this.aceFontSize();
        }
        ), fadeTime);
      })(div, line);
    }

    this.lineNumberWrapper.style.display = 'none';

    // Kick off fade-out transition

    this.mainCanvas.style.transition =
      (this.highlightCanvas.style.transition = `opacity ${fadeTime}ms linear`);

    this.mainCanvas.style.opacity = 0;

    const paletteDisappearingWithMelt = this.session.paletteEnabled && !this.session.showPaletteInTextMode;

    if (paletteDisappearingWithMelt) {
      // Move the palette header into the background
      this.paletteHeader.style.zIndex = 0;

      setTimeout((() => {
        this.dropletElement.style.transition =
          (this.paletteWrapper.style.transition = `left ${translateTime}ms`);

        this.dropletElement.style.left = '0px';
        return this.paletteWrapper.style.left = `${-this.paletteWrapper.clientWidth}px`;
      }
      ), fadeTime);
    }

    setTimeout((() => {
      // Translate the ICE editor div out of frame.
      this.dropletElement.style.transition =
        (this.paletteWrapper.style.transition = '');

      // Translate the ACE editor div into frame.
      this.aceElement.style.top = '0px';
      if (this.session.showPaletteInTextMode && this.session.paletteEnabled) {
        this.aceElement.style.left = `${this.paletteWrapper.clientWidth}px`;
      } else {
        this.aceElement.style.left = '0px';
      }

      //if paletteDisappearingWithMelt
      //  @paletteWrapper.style.top = '-9999px'
      //  @paletteWrapper.style.left = '-9999px'

      this.dropletElement.style.top = '-9999px';
      this.dropletElement.style.left = '-9999px';

      // Finalize a bunch of animations
      // that should be complete by now,
      // but might not actually be due to
      // floating point stuff.
      this.currentlyAnimating = false;

      // Show scrollbars again
      this.mainScroller.style.overflow = 'auto';

      for (div of Array.from(translatingElements)) {
        div.parentNode.removeChild(div);
      }

      this.fireEvent('toggledone', [this.session.currentlyUsingBlocks]);

      if (cb != null) { return cb(); }
    }
    ), fadeTime + translateTime);

    return {success: true};
  }
};

Editor.prototype.aceFontSize = function() {
  return parseFloat(this.aceEditor.getFontSize()) + 'px';
};

Editor.prototype.performFreezeAnimation = function(fadeTime, translateTime, cb){
  if (fadeTime == null) { fadeTime = 500; }
  if (translateTime == null) { translateTime = 500; }
  if (cb == null) { cb = function() {}; }
  if (this.session == null) { return; }
  if (!this.session.currentlyUsingBlocks && !this.currentlyAnimating) {
    const beforeTime = +(new Date());
    const setValueResult = this.copyAceEditor();
    const afterTime = +(new Date());

    if (!setValueResult.success) {
      if (setValueResult.error) {
        this.fireEvent('parseerror', [setValueResult.error]);
      }
      return setValueResult;
    }

    if (this.aceEditor.getFirstVisibleRow() === 0) {
      this.mainScroller.scrollTop = 0;
    } else {
      this.mainScroller.scrollTop = this.session.view.getViewNodeFor(this.session.tree).bounds[this.aceEditor.getFirstVisibleRow()].y;
    }

    this.session.currentlyUsingBlocks = true;
    this.currentlyAnimating = true;
    this.fireEvent('statechange', [true]);

    setTimeout((() => {
      // Hide scrollbars and increase width
      let div;
      this.mainScroller.style.overflow = 'hidden';
      this.dropletElement.style.width = this.wrapperElement.clientWidth + 'px';

      this.redrawMain({noText: true});

      this.currentlyAnimating_suppressRedraw = true;

      this.aceElement.style.top = "-9999px";
      this.aceElement.style.left = "-9999px";

      const paletteAppearingWithFreeze = this.session.paletteEnabled && !this.session.showPaletteInTextMode;

      if (paletteAppearingWithFreeze) {
        this.paletteWrapper.style.top = '0px';
        this.paletteWrapper.style.left = `${-this.paletteWrapper.clientWidth}px`;
        this.paletteHeader.style.zIndex = 0;
      }

      this.dropletElement.style.top = "0px";
      if (this.session.paletteEnabled && !paletteAppearingWithFreeze) {
        this.dropletElement.style.left = `${this.paletteWrapper.clientWidth}px`;
      } else {
        this.dropletElement.style.left = "0px";
      }

      const {textElements, translationVectors} = this.computePlaintextTranslationVectors();

      const translatingElements = [];

      for (let i = 0; i < textElements.length; i++) {

        // Skip anything that's
        // off the screen the whole time.
        const textElement = textElements[i];
        if (!(0 < ((textElement.bounds[0].bottom() - this.session.viewports.main.y) + translationVectors[i].y)) ||
                 !(((textElement.bounds[0].y - this.session.viewports.main.y) + translationVectors[i].y) < this.session.viewports.main.height)) {
          continue;
        }

        div = document.createElement('div');
        div.style.whiteSpace = 'pre';

        div.innerText = (div.textContent = textElement.model.value);

        div.style.font = this.aceFontSize() + ' ' + this.session.fontFamily;
        div.style.position = 'absolute';

        div.style.left = `${(textElement.bounds[0].x - this.session.viewports.main.x) + translationVectors[i].x}px`;
        div.style.top = `${(textElement.bounds[0].y - this.session.viewports.main.y) + translationVectors[i].y}px`;

        div.className = 'droplet-transitioning-element';
        div.style.transition = `left ${translateTime}ms, top ${translateTime}ms, font-size ${translateTime}ms`;
        translatingElements.push(div);

        this.transitionContainer.appendChild(div);

        ((div, textElement) => {
          return setTimeout((() => {
            div.style.left = `${textElement.bounds[0].x - this.session.viewports.main.x}px`;
            div.style.top = `${textElement.bounds[0].y - this.session.viewports.main.y - this.session.fontAscent}px`;
            return div.style.fontSize = this.session.fontSize + 'px';
          }
          ), 0);
        })(div, textElement);
      }

      const top = Math.max(this.aceEditor.getFirstVisibleRow(), 0);
      const bottom = Math.min(this.aceEditor.getLastVisibleRow(), this.session.view.getViewNodeFor(this.session.tree).lineLength - 1);

      const treeView = this.session.view.getViewNodeFor(this.session.tree);
      const { lineHeight } = this.aceEditor.renderer.layerConfig;

      const aceScrollTop = this.aceEditor.session.getScrollTop();

      for (let line = top, end = bottom, asc = top <= end; asc ? line <= end : line >= end; asc ? line++ : line--) {
        div = document.createElement('div');
        div.style.whiteSpace = 'pre';

        div.innerText = (div.textContent = line + 1);

        div.style.font = this.aceFontSize() + ' ' + this.session.fontFamily;
        div.style.width = `${this.aceEditor.renderer.$gutter.clientWidth}px`;

        div.style.left = 0;
        div.style.top = `${(this.aceEditor.session.documentToScreenRow(line, 0) *
            lineHeight) - aceScrollTop}px`;

        div.className = 'droplet-transitioning-element droplet-transitioning-gutter droplet-gutter-line';
        // Add annotation
        if (this.annotations[line] != null) {
          div.className += ` droplet_${getMostSevereAnnotationType(this.annotations[line])}`;
        }
        div.style.transition = `left ${translateTime}ms, top ${translateTime}ms, font-size ${translateTime}ms`;
        translatingElements.push(div);

        this.dropletElement.appendChild(div);

        ((div, line) => {
          return setTimeout((() => {
            div.style.left = 0;
            div.style.top = `${(treeView.bounds[line].y + treeView.distanceToBase[line].above) - this.session.view.opts.textHeight - this.session.fontAscent - this.session.viewports.main.y}px`;
            return div.style.fontSize = this.session.fontSize + 'px';
          }
          ), 0);
        })(div, line);
      }

      this.mainCanvas.style.opacity = 0;

      setTimeout((() => {
        this.mainCanvas.style.transition = `opacity ${fadeTime}ms linear`;
        return this.mainCanvas.style.opacity = 1;
      }
      ), translateTime);

      this.dropletElement.style.transition = `left ${fadeTime}ms`;

      if (paletteAppearingWithFreeze) {
        this.paletteWrapper.style.transition = this.dropletElement.style.transition;
        this.dropletElement.style.left = `${this.paletteWrapper.clientWidth}px`;
        this.paletteWrapper.style.left = '0px';
      }

      return setTimeout((() => {
        this.dropletElement.style.transition =
          (this.paletteWrapper.style.transition = '');

        // Show scrollbars again
        this.mainScroller.style.overflow = 'auto';

        this.currentlyAnimating = false;
        this.lineNumberWrapper.style.display = 'block';
        this.redrawMain();
        this.paletteHeader.style.zIndex = 257;

        for (div of Array.from(translatingElements)) {
          div.parentNode.removeChild(div);
        }

        this.resizeBlockMode();

        this.fireEvent('toggledone', [this.session.currentlyUsingBlocks]);

        if (cb != null) { return cb(); }
      }
      ), translateTime + fadeTime);
    }

    ), 0);

    return {success: true};
  }
};

Editor.prototype.enablePalette = function(enabled) {
  if (!this.currentlyAnimating && (this.session.paletteEnabled !== enabled)) {
    let activeElement;
    this.session.paletteEnabled = enabled;
    this.currentlyAnimating = true;

    if (this.session.currentlyUsingBlocks) {
      activeElement = this.dropletElement;
    } else {
      activeElement = this.aceElement;
    }

    if (!this.session.paletteEnabled) {
      activeElement.style.transition =
        (this.paletteWrapper.style.transition = "left 500ms");

      activeElement.style.left = '0px';
      this.paletteWrapper.style.left = `${-this.paletteWrapper.clientWidth}px`;

      this.paletteHeader.style.zIndex = 0;

      this.resize();

      return setTimeout((() => {
        activeElement.style.transition =
          (this.paletteWrapper.style.transition = '');

        //@paletteWrapper.style.top = '-9999px'
        //@paletteWrapper.style.left = '-9999px'

        this.currentlyAnimating = false;

        return this.fireEvent('palettetoggledone', [this.session.paletteEnabled]);
      }
      ), 500);

    } else {
      this.paletteWrapper.style.top = '0px';
      this.paletteWrapper.style.left = `${-this.paletteWrapper.clientWidth}px`;
      this.paletteHeader.style.zIndex = 257;

      return setTimeout((() => {
        activeElement.style.transition =
          (this.paletteWrapper.style.transition = "left 500ms");

        activeElement.style.left = `${this.paletteWrapper.clientWidth}px`;
        this.paletteWrapper.style.left = '0px';

        return setTimeout((() => {
          activeElement.style.transition =
            (this.paletteWrapper.style.transition = '');

          this.resize();

          this.currentlyAnimating = false;

          return this.fireEvent('palettetoggledone', [this.session.paletteEnabled]);
        }
        ), 500);
      }
      ), 0);
    }
  }
};


Editor.prototype.toggleBlocks = function(cb) {
  if (this.session.currentlyUsingBlocks) {
    return this.performMeltAnimation(500, 1000, cb);
  } else {
    return this.performFreezeAnimation(500, 500, cb);
  }
};

// SCROLLING SUPPORT
// ================================

hook('populate', 2, function() {
  this.mainScroller = document.createElement('div');
  this.mainScroller.className = 'droplet-main-scroller';

  // @mainScrollerIntermediary -- this is so that we can be certain that
  // any event directly on @mainScroller is in fact on the @mainScroller scrollbar,
  // so should not be captured by editor mouse event handlers.
  this.mainScrollerIntermediary = document.createElement('div');
  this.mainScrollerIntermediary.className = 'droplet-main-scroller-intermediary';

  this.mainScrollerStuffing = document.createElement('div');
  this.mainScrollerStuffing.className = 'droplet-main-scroller-stuffing';

  this.mainScroller.appendChild(this.mainCanvas);
  this.dropletElement.appendChild(this.mainScroller);

  // Prevent scrolling on wrapper element
  this.wrapperElement.addEventListener('scroll', () => {
    return this.wrapperElement.scrollTop = (this.wrapperElement.scrollLeft = 0);
  });

  this.mainScroller.addEventListener('scroll', () => {
    this.session.viewports.main.y = this.mainScroller.scrollTop;
    this.session.viewports.main.x = this.mainScroller.scrollLeft;

    return this.redrawMain();
  });

  this.paletteScroller = document.createElement('div');
  this.paletteScroller.className = 'droplet-palette-scroller';
  this.paletteScroller.appendChild(this.paletteCanvas);

  this.paletteScrollerStuffing = document.createElement('div');
  this.paletteScrollerStuffing.className = 'droplet-palette-scroller-stuffing';

  this.paletteScroller.appendChild(this.paletteScrollerStuffing);
  this.paletteElement.appendChild(this.paletteScroller);

  return this.paletteScroller.addEventListener('scroll', () => {
    this.session.viewports.palette.y = this.paletteScroller.scrollTop;
    return this.session.viewports.palette.x = this.paletteScroller.scrollLeft;
  });
});

Editor.prototype.resizeMainScroller = function() {
  this.mainScroller.style.width = `${this.dropletElement.clientWidth}px`;
  return this.mainScroller.style.height = `${this.dropletElement.clientHeight}px`;
};

hook('resize_palette', 0, function() {
  this.paletteScroller.style.top = `${this.paletteHeader.clientHeight}px`;

  this.session.viewports.palette.height = this.paletteScroller.clientHeight;
  return this.session.viewports.palette.width = this.paletteScroller.clientWidth;
});

hook('redraw_main', 1, function() {
  const bounds = this.session.view.getViewNodeFor(this.session.tree).getBounds();
  for (let record of Array.from(this.session.floatingBlocks)) {
    bounds.unite(this.session.view.getViewNodeFor(record.block).getBounds());
  }

  // We add some extra height to the bottom
  // of the document so that the last block isn't
  // jammed up against the edge of the screen.
  //
  // Default this extra space to fontSize (approx. 1 line).
  const height = Math.max(
    bounds.bottom() + (this.options.extraBottomHeight != null ? this.options.extraBottomHeight : this.session.fontSize),
    this.dropletElement.clientHeight
  );

  if (height !== this.lastHeight) {
    this.lastHeight = height;
    this.mainCanvas.setAttribute('height', height);
    return this.mainCanvas.style.height = `${height}px`;
  }
});

hook('redraw_palette', 0, function() {
  const bounds = new this.draw.NoRectangle();
  for (let entry of Array.from(this.session.currentPaletteBlocks)) {
    bounds.unite(this.session.paletteView.getViewNodeFor(entry.block).getBounds());
  }

  // For now, we will comment out this line
  // due to bugs
  //@paletteScrollerStuffing.style.width = "#{bounds.right()}px"
  return this.paletteScrollerStuffing.style.height = `${bounds.bottom()}px`;
});

// MULTIPLE FONT SIZE SUPPORT
// ================================
hook('populate', 0, function() {
  this.session.fontSize = 15;
  this.session.fontFamily = 'Courier New';
  this.measureCtx.font = '15px Courier New';
  this.session.fontWidth = this.measureCtx.measureText(' ').width;

  const metrics = helper.fontMetrics(this.session.fontFamily, this.session.fontSize);
  this.session.fontAscent = metrics.prettytop;
  return this.session.fontDescent = metrics.descent;
});

Editor.prototype.setFontSize_raw = function(fontSize) {
  if (this.session.fontSize !== fontSize) {
    this.measureCtx.font = fontSize + ' px ' + this.session.fontFamily;
    this.session.fontWidth = this.measureCtx.measureText(' ').width;
    this.session.fontSize = fontSize;

    this.paletteHeader.style.fontSize = `${fontSize}px`;
    this.gutter.style.fontSize = `${fontSize}px`;
    this.tooltipElement.style.fontSize = `${fontSize}px`;

    this.session.view.opts.textHeight =
      (this.session.paletteView.opts.textHeight =
      (this.session.dragView.opts.textHeight = helper.getFontHeight(this.session.fontFamily, this.session.fontSize)));

    const metrics = helper.fontMetrics(this.session.fontFamily, this.session.fontSize);
    this.session.fontAscent = metrics.prettytop;
    this.session.fontDescent = metrics.descent;

    this.session.view.clearCache();
    this.session.paletteView.clearCache();
    this.session.dragView.clearCache();

    this.session.view.draw.setGlobalFontSize(this.session.fontSize);
    this.session.paletteView.draw.setGlobalFontSize(this.session.fontSize);
    this.session.dragView.draw.setGlobalFontSize(this.session.fontSize);

    this.gutter.style.width = this.aceEditor.renderer.$gutterLayer.gutterWidth + 'px';

    this.redrawMain();
    return this.rebuildPalette();
  }
};

Editor.prototype.setFontFamily = function(fontFamily) {
  this.measureCtx.font = this.session.fontSize + 'px ' + fontFamily;
  this.draw.setGlobalFontFamily(fontFamily);

  this.session.fontFamily = fontFamily;

  this.session.view.opts.textHeight = helper.getFontHeight(this.session.fontFamily, this.session.fontSize);
  this.session.fontAscent = helper.fontMetrics(this.session.fontFamily, this.session.fontSize).prettytop;

  this.session.view.clearCache(); this.session.dragView.clearCache();
  this.gutter.style.fontFamily = fontFamily;
  this.tooltipElement.style.fontFamily = fontFamily;

  this.redrawMain();
  return this.rebuildPalette();
};

Editor.prototype.setFontSize = function(fontSize) {
  this.setFontSize_raw(fontSize);
  return this.resizeBlockMode();
};

// LINE MARKING SUPPORT
// ================================
Editor.prototype.getHighlightPath = function(model, style, view) {
  if (view == null) { ({ view } = this.session); }
  const path = view.getViewNodeFor(model).path.clone();

  path.style.fillColor = null;
  path.style.strokeColor = style.color;
  path.style.lineWidth = 3;
  path.noclip = true; path.bevel = false;

  return path;
};

Editor.prototype.markLine = function(line, style) {
  if (this.session == null) { return; }

  const block = this.session.tree.getBlockOnLine(line);

  return this.session.view.getViewNodeFor(block).mark(style);
};

Editor.prototype.markBlock = function(block, style) {
  if (this.session == null) { return; }

  return this.session.view.getViewNodeFor(block).mark(style);
};

// ## Mark
// `mark(line, col, style)` will mark the first block after the given (line, col) coordinate
// with the given style.
Editor.prototype.mark = function(location, style) {
  if (this.session == null) { return; }

  let block = this.session.tree.getFromTextLocation(location);
  block = block.container != null ? block.container : block;

  this.session.view.getViewNodeFor(block).mark(style);

  return this.redrawHighlights(); // TODO MERGE investigate
};

Editor.prototype.clearLineMarks = function() {
  this.session.view.clearMarks();

  return this.redrawHighlights();
};

// LINE HOVER SUPPORT
// ================================

hook('populate', 0, function() {
  return this.lastHoveredLine = null;
});

hook('mousemove', 0, function(point, event, state) {
  // Do not attempt to detect this if we are currently dragging something,
  // or no event handlers are bound.
  if ((this.draggingBlock == null) && (this.clickedBlock == null) && this.hasEvent('linehover')) {
    if (!this.trackerPointIsInMainScroller(point)) { return; }

    const mainPoint = this.trackerPointToMain(point);

    const treeView = this.session.view.getViewNodeFor(this.session.tree);

    if ((this.lastHoveredLine != null) && (treeView.bounds[this.lastHoveredLine] != null) &&
        treeView.bounds[this.lastHoveredLine].contains(mainPoint)) {
      return;
    }

    let hoveredLine = this.findLineNumberAtCoordinate(mainPoint.y);

    if (!treeView.bounds[hoveredLine].contains(mainPoint)) {
      hoveredLine = null;
    }

    if (hoveredLine !== this.lastHoveredLine) {
      return this.fireEvent('linehover', [{line: (this.lastHoveredLine = hoveredLine)}]);
    }
  }
});

// GET/SET VALUE SUPPORT
// ================================

// Whitespace trimming hack enable/disable
// setter
hook('populate', 0, function() {
  return this.trimWhitespace = false;
});

Editor.prototype.setTrimWhitespace = function(trimWhitespace) {
  return this.trimWhitespace = trimWhitespace;
};

Editor.prototype.setValue_raw = function(value) {
  try {
    if (this.trimWhitespace) { value = value.trim(); }

    const newParse = this.session.mode.parse(value, {
      wrapAtRoot: true,
      preserveEmpty: this.session.options.preserveEmpty
    });

    if (this.session.tree.start.next !== this.session.tree.end) {
      const removal = new model.List(this.session.tree.start.next, this.session.tree.end.prev);
      this.spliceOut(removal);
    }

    if (newParse.start.next !== newParse.end) {
      this.spliceIn(new model.List(newParse.start.next, newParse.end.prev), this.session.tree.start);
    }

    this.removeBlankLines();
    this.redrawMain();

    return {success: true};

  } catch (e) {
    return {success: false, error: e};
  }
};

Editor.prototype.setValue = function(value) {
  if ((this.session == null)) {
    return this.aceEditor.setValue(value);
  }

  const oldScrollTop = this.aceEditor.session.getScrollTop();

  this.setAceValue(value);
  this.resizeTextMode();

  this.aceEditor.session.setScrollTop(oldScrollTop);

  if (this.session.currentlyUsingBlocks) {
    const result = this.setValue_raw(value);
    if (result.success === false) {
      this.setEditorState(false);
      this.aceEditor.setValue(value);
      if (result.error) {
        return this.fireEvent('parseerror', [result.error]);
      }
    }
  }
};

Editor.prototype.addEmptyLine = function(str) {
  if ((str.length === 0) || (str[str.length - 1] === '\n')) {
    return str;
  } else {
    return str + '\n';
  }
};

Editor.prototype.getValue = function() {
  if (this.session != null ? this.session.currentlyUsingBlocks : undefined) {
    return this.addEmptyLine(this.session.tree.stringify({
      preserveEmpty: this.session.options.preserveEmpty
    })
    );
  } else {
    return this.getAceValue();
  }
};

Editor.prototype.getAceValue = function() {
  const value = this.aceEditor.getValue();
  return this.lastAceSeenValue = value;
};

Editor.prototype.setAceValue = function(value) {
  if (value !== this.lastAceSeenValue) {
    this.aceEditor.setValue(value, 1);
    // TODO: move ace cursor to location matching droplet cursor.
    return this.lastAceSeenValue = value;
  }
};


// PUBLIC EVENT BINDING HOOKS
// ===============================

Editor.prototype.on = function(event, handler) {
  return this.bindings[event] = handler;
};

Editor.prototype.once = function(event, handler) {
  return this.bindings[event] = function() {
    handler.apply(this, arguments);
    return this.bindings[event] = null;
  };
};

Editor.prototype.fireEvent = function(event, args) {
  if (event in this.bindings) {
    return this.bindings[event].apply(this, args);
  }
};

Editor.prototype.hasEvent = function(event) { return event in this.bindings && (this.bindings[event] != null); };

// SYNCHRONOUS TOGGLE SUPPORT
// ================================

Editor.prototype.setEditorState = function(useBlocks) {
  this.mainCanvas.style.transition = (this.paletteWrapper.style.transition =
    (this.highlightCanvas.style.transition = ''));

  if (useBlocks) {
    if ((this.session == null)) {
      throw new ArgumentError('cannot switch to blocks if a session has not been set up.');
    }

    if (!this.session.currentlyUsingBlocks) {
      this.setValue_raw(this.getAceValue());
    }

    this.dropletElement.style.top = '0px';
    if (this.session.paletteEnabled) {
      this.paletteWrapper.style.top = (this.paletteWrapper.style.left = '0px');
      this.dropletElement.style.left = `${this.paletteWrapper.clientWidth}px`;
    } else {
      this.paletteWrapper.style.top = '0px';
      this.paletteWrapper.style.left = `${-this.paletteWrapper.clientWidth}px`;
      this.dropletElement.style.left = '0px';
    }

    this.aceElement.style.top = (this.aceElement.style.left = '-9999px');
    this.session.currentlyUsingBlocks = true;

    this.lineNumberWrapper.style.display = 'block';

    this.mainCanvas.style.opacity =
      (this.highlightCanvas.style.opacity = 1);

    this.resizeBlockMode(); return this.redrawMain();

  } else {
    // Forbid melting if there is an empty socket. If there is,
    // highlight it in red.
    if ((this.session != null) && !this.session.options.preserveEmpty && !this.checkAndHighlightEmptySockets()) {
      this.redrawMain();
      return;
    }

    this.hideDropdown();

    const paletteVisibleInNewState = (this.session != null ? this.session.paletteEnabled : undefined) && this.session.showPaletteInTextMode;

    const oldScrollTop = this.aceEditor.session.getScrollTop();

    if (this.session != null ? this.session.currentlyUsingBlocks : undefined) {
      this.setAceValue(this.getValue());
    }

    this.aceEditor.resize(true);

    this.aceEditor.session.setScrollTop(oldScrollTop);

    this.dropletElement.style.top = (this.dropletElement.style.left = '-9999px');
    if (paletteVisibleInNewState) {
      this.paletteWrapper.style.top = (this.paletteWrapper.style.left = '0px');
    } else {
      this.paletteWrapper.style.top = '0px';
      this.paletteWrapper.style.left = `${-this.paletteWrapper.clientWidth}px`;
    }

    this.aceElement.style.top = '0px';
    if (paletteVisibleInNewState) {
      this.aceElement.style.left = `${this.paletteWrapper.clientWidth}px`;
    } else {
      this.aceElement.style.left = '0px';
    }

    if (this.session != null) {
      this.session.currentlyUsingBlocks = false;
    }

    this.lineNumberWrapper.style.display = 'none';

    this.mainCanvas.style.opacity =
      (this.highlightCanvas.style.opacity = 0);

    return this.resizeBlockMode();
  }
};

// DRAG CANVAS SHOW/HIDE HACK
// ================================

hook('populate', 0, function() {
  this.dragCover = document.createElement('div');
  this.dragCover.className = 'droplet-drag-cover';
  this.dragCover.style.display = 'none';

  return document.body.appendChild(this.dragCover);
});

// On mousedown, bring the drag
// canvas to the front so that it
// appears to "float" over all other elements
hook('mousedown', -1, function() {
  if (this.clickedBlock != null) {
    return this.dragCover.style.display = 'block';
  }
});

// On mouseup, throw the drag canvas away completely.
hook('mouseup', 0, function() {
  this.dragCanvas.style.transform = "translate(-9999px, -9999px)";

  return this.dragCover.style.display = 'none';
});

// FAILSAFE END DRAG HACK
// ================================

hook('mousedown', 10, function() {
  if (this.draggingBlock != null) {
    return this.endDrag();
  }
});

Editor.prototype.endDrag = function() {
  // Ensure that the cursor is not in a socket.
  if (this.cursorAtSocket()) {
    this.setCursor(this.session.cursor, x => x.type !== 'socketStart');
  }

  this.clearDrag();
  this.draggingBlock = null;
  this.draggingOffset = null;
  __guardMethod__(this.lastHighlightPath, 'deactivate', o => o.deactivate());
  this.lastHighlight = (this.lastHighlightPath = null);

  this.redrawMain();
};

// PALETTE EVENT
// =================================
hook('rebuild_palette', 0, function() {
  return this.fireEvent('changepalette', []);
});

// TOUCHSCREEN SUPPORT
// =================================

// We will attempt to emulate
// mouse events using touchstart/end
// data.
const touchEvents = {
  'touchstart': 'mousedown',
  'touchmove': 'mousemove',
  'touchend': 'mouseup'
};

// A timeout for selection
const TOUCH_SELECTION_TIMEOUT = 1000;

Editor.prototype.touchEventToPoint = function(event, index) {
  const absolutePoint = new this.draw.Point(
    event.changedTouches[index].clientX,
    event.changedTouches[index].clientY
  );

  return absolutePoint;
};

Editor.prototype.queueLassoMousedown = function(trackPoint, event) {
  return this.lassoSelectStartTimeout = setTimeout((() => {
    const state = {};

    return Array.from(editorBindings.mousedown).map((handler) =>
      handler.call(this, trackPoint, event, state));
  }), TOUCH_SELECTION_TIMEOUT);
};

// We will bind the same way as mouse events do,
// wrapping to be compatible with a mouse event interface.
//
// When users drag with multiple fingers, we emulate scrolling.
// Otherwise, we emulate mousedown/mouseup
hook('populate', 0, function() {
  this.touchScrollAnchor = new this.draw.Point(0, 0);
  this.lassoSelectStartTimeout = null;

  this.wrapperElement.addEventListener('touchstart', event => {
    clearTimeout(this.lassoSelectStartTimeout);

    const trackPoint = this.touchEventToPoint(event, 0);

    // We keep a state object so that handlers
    // can know about each other.
    //
    // We will suppress lasso select to
    // allow scrolling.
    const state = {
      suppressLassoSelect: true
    };

    // Call all the handlers.
    for (let handler of Array.from(editorBindings.mousedown)) {
      handler.call(this, trackPoint, event, state);
    }

    // If we did not hit anything,
    // we may want to start a lasso select
    // in a little bit.
    if (state.consumedHitTest) {
      return event.preventDefault();
    } else {
      return this.queueLassoMousedown(trackPoint, event);
    }
  });

  this.wrapperElement.addEventListener('touchmove', event => {
    clearTimeout(this.lassoSelectStartTimeout);

    const trackPoint = this.touchEventToPoint(event, 0);

    if ((this.clickedBlock == null) && (this.draggingBlock == null)) {
      this.queueLassoMousedown(trackPoint, event);
    }

    // We keep a state object so that handlers
    // can know about each other.
    const state = {};

    // Call all the handlers.
    for (let handler of Array.from(editorBindings.mousemove)) {
      handler.call(this, trackPoint, event, state);
    }

    // If we are in the middle of some action,
    // prevent scrolling.
    if ((this.clickedBlock != null) || (this.draggingBlock != null) || (this.lassoSelectAnchor != null) || this.textInputSelecting) {
      return event.preventDefault();
    }
  });

  return this.wrapperElement.addEventListener('touchend', event => {
    clearTimeout(this.lassoSelectStartTimeout);

    const trackPoint = this.touchEventToPoint(event, 0);

    // We keep a state object so that handlers
    // can know about each other.
    const state = {};

    // Call all the handlers.
    for (let handler of Array.from(editorBindings.mouseup)) {
      handler.call(this, trackPoint, event, state);
    }

    return event.preventDefault();
  });
});

// CURSOR DRAW SUPPORRT
// ================================
hook('populate', 0, function() {
  this.cursorCtx = document.createElementNS(SVG_STANDARD, 'g');
  this.textCursorPath = new this.session.view.draw.Path([], false, {
    'strokeColor': '#000',
    'lineWidth': '2',
    'fillColor': 'rgba(0, 0, 256, 0.3)',
    'cssClass': 'droplet-cursor-path'
  });
  this.textCursorPath.setParent(this.mainCanvas);

  const cursorElement = document.createElementNS(SVG_STANDARD, 'path');
  cursorElement.setAttribute('fill', 'none');
  cursorElement.setAttribute('stroke', '#000');
  cursorElement.setAttribute('stroke-width', '3');
  cursorElement.setAttribute('stroke-linecap', 'round');
  cursorElement.setAttribute('d', `M${this.session.view.opts.tabOffset + (CURSOR_WIDTH_DECREASE / 2)} 0 ` +
      `Q${this.session.view.opts.tabOffset + (this.session.view.opts.tabWidth / 2)} ${this.session.view.opts.tabHeight}` +
      ` ${(this.session.view.opts.tabOffset + this.session.view.opts.tabWidth) - (CURSOR_WIDTH_DECREASE / 2)} 0`
  );

  this.cursorPath = new this.session.view.draw.ElementWrapper(cursorElement);
  this.cursorPath.setParent(this.mainCanvas);

  return this.mainCanvas.appendChild(this.cursorCtx);
});

Editor.prototype.strokeCursor = function(point) {
  if (point == null) { return; }
  this.cursorPath.element.setAttribute('transform', `translate(${point.x}, ${point.y})`);
  return this.qualifiedFocus(this.getCursor(), this.cursorPath);
};

Editor.prototype.highlightFlashShow = function() {
  if (this.session == null) { return; }

  if (this.flashTimeout != null) { clearTimeout(this.flashTimeout); }
  if (this.cursorAtSocket()) {
    this.textCursorPath.activate();
  } else {
    this.cursorPath.activate();
  }
  this.highlightsCurrentlyShown = true;
  return this.flashTimeout = setTimeout((() => this.flash()), 500);
};

Editor.prototype.highlightFlashHide = function() {
  if (this.session == null) { return; }

  if (this.flashTimeout != null) { clearTimeout(this.flashTimeout); }
  if (this.cursorAtSocket()) {
    this.textCursorPath.deactivate();
  } else {
    this.cursorPath.deactivate();
  }
  this.highlightsCurrentlyShown = false;
  return this.flashTimeout = setTimeout((() => this.flash()), 500);
};

Editor.prototype.editorHasFocus = function() {
  return [this.dropletElement, this.hiddenInput, this.copyPasteInput].includes(document.activeElement) &&
  document.hasFocus();
};

Editor.prototype.flash = function() {
  if (this.session == null) { return; }

  if ((this.lassoSelection != null) || (this.draggingBlock != null) ||
      (this.cursorAtSocket() && this.textInputHighlighted) ||
      !this.highlightsCurrentlyShown ||
      !this.editorHasFocus()) {
    return this.highlightFlashShow();
  } else {
    return this.highlightFlashHide();
  }
};

hook('populate', 0, function() {
  this.highlightsCurrentlyShown = false;

  const blurCursors = () => {
    this.highlightFlashShow();
    return this.cursorCtx.style.opacity = CURSOR_UNFOCUSED_OPACITY;
  };

  this.dropletElement.addEventListener('blur', blurCursors);
  this.hiddenInput.addEventListener('blur', blurCursors);
  this.copyPasteInput.addEventListener('blur', blurCursors);

  const focusCursors = () => {
    this.highlightFlashShow();
    this.cursorCtx.style.transition = '';
    return this.cursorCtx.style.opacity = 1;
  };

  this.dropletElement.addEventListener('focus', focusCursors);
  this.hiddenInput.addEventListener('focus', focusCursors);
  this.copyPasteInput.addEventListener('focus', focusCursors);

  return this.flashTimeout = setTimeout((() => this.flash()), 0);
});

// ONE MORE DROP CASE
// ================================

// TODO possibly move this next utility function to view?
Editor.prototype.viewOrChildrenContains = function(model, point, view) {
  if (view == null) { ({ view } = this.session); }
  const modelView = view.getViewNodeFor(model);

  if (modelView.path.contains(point)) {
    return true;
  }

  for (let childObj of Array.from(modelView.children)) {
    if (this.session.viewOrChildrenContains(childObj.child, point, view)) {
      return true;
    }
  }

  return false;
};

// LINE NUMBER GUTTER CODE
// ================================
hook('populate', 0, function() {
  this.gutter = document.createElement('div');
  this.gutter.className = 'droplet-gutter';

  this.lineNumberWrapper = document.createElement('div');
  this.gutter.appendChild(this.lineNumberWrapper);

  this.gutterVersion = -1;
  this.lastGutterWidth = null;

  this.lineNumberTags = {};

  this.mainScroller.appendChild(this.gutter);

  // Record of embedder-set annotations
  // and breakpoints used in rendering.
  // Should mirror ace all the time.
  this.annotations = {};
  this.breakpoints = {};

  this.tooltipElement = document.createElement('div');
  this.tooltipElement.className = 'droplet-tooltip';

  this.dropletElement.appendChild(this.tooltipElement);

  return this.aceEditor.on('guttermousedown', e => {
    // Ensure that the click actually happened
    // on a line and not just in gutter space.
    const { target } = e.domEvent;
    if (target.className.indexOf('ace_gutter-cell') === -1) {
      return;
    }

    // Otherwise, get the row and fire a Droplet gutter
    // mousedown event.
    const { row } = e.getDocumentPosition();
    e.stop();
    return this.fireEvent('guttermousedown', [{line: row, event: e.domEvent}]);
});
});

hook('mousedown', 11, function(point, event, state) {
  // Check if mousedown within the gutter
  if (!this.trackerPointIsInGutter(point)) { return; }

  // Find the line that was clicked
  const mainPoint = this.trackerPointToMain(point);
  const treeView = this.session.view.getViewNodeFor(this.session.tree);
  const clickedLine = this.findLineNumberAtCoordinate(mainPoint.y);
  this.fireEvent('guttermousedown', [{line: clickedLine, event}]);

  // Prevent other hooks from taking this event
  return true;
});

Editor.prototype.setBreakpoint = function(row) {
  // Delegate
  this.aceEditor.session.setBreakpoint(row);

  // Add to our own records
  this.breakpoints[row] = true;

  // Redraw gutter.
  // TODO: if this ends up being a performance issue,
  // selectively apply classes
  return this.redrawGutter(false);
};

Editor.prototype.clearBreakpoint = function(row) {
  this.aceEditor.session.clearBreakpoint(row);
  this.breakpoints[row] = false;
  return this.redrawGutter(false);
};

Editor.prototype.clearBreakpoints = function(row) {
  this.aceEditor.session.clearBreakpoints();
  this.breakpoints = {};
  return this.redrawGutter(false);
};

Editor.prototype.getBreakpoints = function(row) {
  return this.aceEditor.session.getBreakpoints();
};

Editor.prototype.setAnnotations = function(annotations) {
  this.aceEditor.session.setAnnotations(annotations);

  this.annotations = {};
  for (let i = 0; i < annotations.length; i++) {
    const el = annotations[i];
    if (this.annotations[el.row] == null) { this.annotations[el.row] = []; }
    this.annotations[el.row].push(el);
  }

  return this.redrawGutter(false);
};

Editor.prototype.resizeGutter = function() {
  if (this.lastGutterWidth !== this.aceEditor.renderer.$gutterLayer.gutterWidth) {
    this.lastGutterWidth = this.aceEditor.renderer.$gutterLayer.gutterWidth;
    this.gutter.style.width = this.lastGutterWidth + 'px';
    return this.resize();
  }

  if (this.lastGutterHeight !== Math.max(this.dropletElement.clientHeight, this.mainCanvas.clientHeight)) {
    this.lastGutterHeight = Math.max(this.dropletElement.clientHeight, this.mainCanvas.clientHeight);
    return this.gutter.style.height = this.lastGutterHeight + 'px';
  }
};

Editor.prototype.addLineNumberForLine = function(line) {
  let lineDiv;
  const treeView = this.session.view.getViewNodeFor(this.session.tree);

  if (line in this.lineNumberTags) {
    lineDiv = this.lineNumberTags[line].tag;

  } else {
    lineDiv = document.createElement('div');
    lineDiv.innerText = (lineDiv.textContent = line + 1);
    this.lineNumberTags[line] = {
      tag: lineDiv,
      lastPosition: null
    };
  }

  if (treeView.bounds[line].y !== this.lineNumberTags[line].lastPosition) {
    lineDiv.className = 'droplet-gutter-line';

    // Add annotation mouseover text
    // and graphics
    if (this.annotations[line] != null) {
      lineDiv.className += ` droplet_${getMostSevereAnnotationType(this.annotations[line])}`;

      const title = this.annotations[line].map(x => x.text).join('\n');

      lineDiv.addEventListener('mouseover', () => {
        this.tooltipElement.innerText =
          (this.tooltipElement.textContent = title);
        return this.tooltipElement.style.display = 'block';
      });
      lineDiv.addEventListener('mousemove', event => {
        this.tooltipElement.style.left = event.pageX + 'px';
        return this.tooltipElement.style.top = event.pageY + 'px';
      });
      lineDiv.addEventListener('mouseout', () => {
        return this.tooltipElement.style.display = 'none';
      });
    }

    // Add breakpoint graphics
    if (this.breakpoints[line]) {
      lineDiv.className += ' droplet_breakpoint';
    }

    lineDiv.style.top = `${treeView.bounds[line].y}px`;

    lineDiv.style.paddingTop = `${treeView.distanceToBase[line].above - this.session.view.opts.textHeight - this.session.fontAscent}px`;
    lineDiv.style.paddingBottom = `${treeView.distanceToBase[line].below - this.session.fontDescent}`;

    lineDiv.style.height =  treeView.bounds[line].height + 'px';
    lineDiv.style.fontSize = this.session.fontSize + 'px';

    this.lineNumberWrapper.appendChild(lineDiv);
    return this.lineNumberTags[line].lastPosition = treeView.bounds[line].y;
  }
};

const TYPE_SEVERITY = {
  'error': 2,
  'warning': 1,
  'info': 0
};
const TYPE_FROM_SEVERITY = ['info', 'warning', 'error'];
var getMostSevereAnnotationType = function(arr) {
  return TYPE_FROM_SEVERITY[Math.max.apply(this, arr.map(x => TYPE_SEVERITY[x.type]))];
};

Editor.prototype.findLineNumberAtCoordinate = function(coord) {
  const treeView = this.session.view.getViewNodeFor(this.session.tree);
  let start = 0; let end = treeView.bounds.length;
  let pivot = Math.floor((start + end) / 2);

  while ((treeView.bounds[pivot].y !== coord) && (start < end)) {
    if ((start === pivot) || (end === pivot)) {
      return pivot;
    }

    if (treeView.bounds[pivot].y > coord) {
      end = pivot;
    } else {
      start = pivot;
    }

    if (end < 0) { return 0; }
    if (start >= treeView.bounds.length) { return treeView.bounds.length - 1; }

    pivot = Math.floor((start + end) / 2);
  }

  return pivot;
};

hook('redraw_main', 0, function(changedBox) {
  return this.redrawGutter(changedBox);
});

Editor.prototype.redrawGutter = function(changedBox) {
  let line;
  let asc, end;
  if (changedBox == null) { changedBox = true; }
  if (this.session == null) { return; }
  const treeView = this.session.view.getViewNodeFor(this.session.tree);

  const top = this.findLineNumberAtCoordinate(this.session.viewports.main.y);
  const bottom = this.findLineNumberAtCoordinate(this.session.viewports.main.bottom());

  for (line = top, end = bottom, asc = top <= end; asc ? line <= end : line >= end; asc ? line++ : line--) {
    this.addLineNumberForLine(line);
  }

  for (line in this.lineNumberTags) {
    const tag = this.lineNumberTags[line];
    if ((line < top) || (line > bottom)) {
      this.lineNumberTags[line].tag.parentNode.removeChild(this.lineNumberTags[line].tag);
      delete this.lineNumberTags[line];
    }
  }

  if (changedBox) {
    return this.resizeGutter();
  }
};

Editor.prototype.setPaletteWidth = function(width) {
  this.paletteWrapper.style.width = width + 'px';
  return this.resizeBlockMode();
};

// COPY AND PASTE
// ================================
hook('populate', 1, function() {
  this.copyPasteInput = document.createElement('textarea');
  this.copyPasteInput.style.position = 'absolute';
  this.copyPasteInput.style.left = (this.copyPasteInput.style.top = '-9999px');

  this.dropletElement.appendChild(this.copyPasteInput);

  let pressedVKey = false;
  let pressedXKey = false;

  this.copyPasteInput.addEventListener('keydown', function(event) {
    pressedVKey = (pressedXKey = false);
    if (event.keyCode === 86) {
      return pressedVKey = true;
    } else if (event.keyCode === 88) {
      return pressedXKey = true;
    }
  });

  return this.copyPasteInput.addEventListener('input', () => {
    if ((this.session == null) || this.session.readOnly) {
      return;
    }
    if (pressedVKey && !this.cursorAtSocket()) {
      let blocks;
      let str = this.copyPasteInput.value; const lines = str.split('\n');

      // Strip any common leading indent
      // from all the lines of the pasted tet
      const minIndent = lines.map(line => line.length - line.trimLeft().length).reduce((a, b) => Math.min(a, b));
      str = lines.map(line => line.slice(minIndent)).join('\n');
      str = str.replace(/^\n*|\n*$/g, '');

      try {
        blocks = this.session.mode.parse(str, {context: this.getCursor().parent.parseContext});
        blocks = new model.List(blocks.start.next, blocks.end.prev);
      } catch (e) {
        blocks = null;
      }

      if (blocks == null) { return; }

      this.undoCapture();
      this.spliceIn(blocks, this.getCursor());
      this.setCursor(blocks.end);

      this.redrawMain();

      return this.copyPasteInput.setSelectionRange(0, this.copyPasteInput.value.length);
    } else if (pressedXKey && (this.lassoSelection != null)) {
      this.spliceOut(this.lassoSelection); this.lassoSelection = null;
      return this.redrawMain();
    }
  });
});

hook('keydown', 0, function(event, state) {
  if (Array.from(command_modifiers).includes(event.which)) {
    if (!this.cursorAtSocket()) {
      const x = document.body.scrollLeft;
      const y = document.body.scrollTop;
      this.copyPasteInput.focus();
      window.scrollTo(x, y);

      if (this.lassoSelection != null) {
        this.copyPasteInput.value = this.lassoSelection.stringifyInPlace();
      }
      return this.copyPasteInput.setSelectionRange(0, this.copyPasteInput.value.length);
    }
  }
});

hook('keyup', 0, function(point, event, state) {
  if (Array.from(command_modifiers).includes(event.which)) {
    if (this.cursorAtSocket()) {
      return this.hiddenInput.focus();
    } else {
      return this.dropletElement.focus();
    }
  }
});

// OVRFLOW BIT
// ================================

Editor.prototype.overflowsX = function() {
  return this.documentDimensions().width > this.session.viewportDimensions().width;
};

Editor.prototype.overflowsY = function() {
  return this.documentDimensions().height > this.session.viewportDimensions().height;
};

Editor.prototype.documentDimensions = function() {
  const bounds = this.session.view.getViewNodeFor(this.session.tree).totalBounds;
  return {
    width: bounds.width,
    height: bounds.height
  };
};

Editor.prototype.viewportDimensions = function() {
  return this.session.viewports.main;
};

// LINE LOCATION API
// =================
Editor.prototype.getLineMetrics = function(row) {
  const viewNode = this.session.view.getViewNodeFor(this.session.tree);
  const bounds = (new this.session.view.draw.Rectangle()).copy(viewNode.bounds[row]);
  bounds.x += this.mainCanvas.offsetLeft + this.mainCanvas.offsetParent.offsetLeft;
  return {
    bounds,
    distanceToBase: {
      above: viewNode.distanceToBase[row].above,
      below: viewNode.distanceToBase[row].below
    }
  };
};

// DEBUG CODE
// ================================
Editor.prototype.dumpNodeForDebug = function(hitTestResult, line) {
  console.log('Model node:');
  console.log(hitTestResult.serialize());
  console.log('View node:');
  return console.log(this.session.view.getViewNodeFor(hitTestResult).serialize(line));
};

// CLOSING FOUNDATIONAL STUFF
// ================================

// Order the arrays correctly.
for (let key in unsortedEditorBindings) {
  unsortedEditorBindings[key].sort(function(a, b) { if (a.priority > b.priority) { return -1; } else { return 1; } });

  editorBindings[key] = [];

  for (let binding of Array.from(unsortedEditorBindings[key])) {
    editorBindings[key].push(binding.fn);
  }
}

function __guardMethod__(obj, methodName, transform) {
  if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
    return transform(obj, methodName);
  } else {
    return undefined;
  }
}
function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}