/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS202: Simplify dynamic range loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const helper = require('../../src/helper');

const model = require('../../src/model');
const view = require('../../src/view');
const controller = require('../../src/controller');

const parser = require('../../src/parser');
const Coffee = require('../../src/languages/coffee');
const C = require('../../src/languages/c');
const JavaScript = require('../../src/languages/javascript');

const droplet = require('../../dist/droplet-full.js');

const coffee = new Coffee();
const c = new C();

asyncTest('Parser success', function() {
  window.dumpObj = [];
  for (let testCase of Array.from(parserSuccessData)) {
    strictEqual(
      helper.xmlPrettyPrint(coffee.parse(testCase.str, {wrapAtRoot: true}).serialize()),
      helper.xmlPrettyPrint(testCase.expected),
      testCase.message
    );
    window.dumpObj.push({
      message: testCase.message,
      str: testCase.str,
      expected: helper.xmlPrettyPrint(coffee.parse(testCase.str, {wrapAtRoot: true}).serialize())
    });
  }
  return start();
});

asyncTest('XML parser unity', function() {
  for (let testCase of Array.from(parserSuccessData)) {
    const xml = coffee.parse(testCase.str, {wrapAtRoot: true}).serialize();
    strictEqual(
      helper.xmlPrettyPrint(parser.parseXML(xml).serialize()),
      helper.xmlPrettyPrint(xml),
      `Parser unity for: ${testCase.message}`
    );
  }
  return start();
});

asyncTest('View: compute children', function() {
  const view_ = new view.View();

  let document = coffee.parse(`\
alert 10\
`
  );

  let documentView = view_.getViewNodeFor(document);
  documentView.layout();

  strictEqual(documentView.lineChildren[0].length, 1, 'Children length 1 in `alert 10`');
  strictEqual(documentView.lineChildren[0][0].child, document.getBlockOnLine(0), 'Child matches');
  strictEqual(documentView.lineChildren[0][0].startLine, 0, 'Child starts on correct line');

  let blockView = view_.getViewNodeFor(document.getBlockOnLine(0));
  strictEqual(blockView.lineChildren[0].length, 2, 'Children length 2 in `alert 10` block');
  strictEqual(blockView.lineChildren[0][0].child.type, 'text', 'First child is text');
  strictEqual(blockView.lineChildren[0][1].child.type, 'socket', 'Second child is socket');

  document = coffee.parse(`\
for [1..10]
  alert 10
  prompt 10
  alert 20\
`
  );

  documentView = view_.getViewNodeFor(document);
  documentView.layout();

  blockView = view_.getViewNodeFor(document.getBlockOnLine(0));
  strictEqual(blockView.lineChildren[1].length, 1, 'One child in indent');
  strictEqual(blockView.lineChildren[2][0].startLine, 0, 'Indent start line');
  strictEqual(blockView.multilineChildrenData[0], 1, 'Indent start data');
  strictEqual(blockView.multilineChildrenData[1], 2, 'Indent middle data');
  strictEqual(blockView.multilineChildrenData[2], 2, 'Indent middle data');
  strictEqual(blockView.multilineChildrenData[3], 3, 'Indent end data');

  document = coffee.parse(`\
for [1..10]
  for [1..10]
    alert 10
    alert 20\
`
  );

  documentView = view_.getViewNodeFor(document);
  documentView.layout();

  const indentView = view_.getViewNodeFor(document.getBlockOnLine(1).end.prev.container);
  strictEqual(indentView.lineChildren[1][0].child.stringify(), 'alert 10', 'Relative line numbers');

  document = coffee.parse(`\
console.log (for [1..10]
  alert 10)\
`
  );

  documentView = view_.getViewNodeFor(document);
  documentView.layout();

  blockView = view_.getViewNodeFor(document.getBlockOnLine(0).start.next.next.container);

  strictEqual(blockView.lineChildren[1].length, 1, 'One child in indent in socket');
  strictEqual(blockView.multilineChildrenData[1], 3, 'Indent end data');
  return start();
});

asyncTest('View: compute dimensions', function() {
  const view_ = new view.View();

  let document = coffee.parse(`\
for [1..10]
  alert 10
  alert 20\
`
  );

  let documentView = view_.getViewNodeFor(document);
  documentView.layout();

  strictEqual(documentView.dimensions[0].height,
    view_.opts.textHeight + (4 * view_.opts.padding) + (2 * view_.opts.textPadding),
    'First line height (block, 2 padding)');
  strictEqual(documentView.dimensions[1].height,
    view_.opts.textHeight + (2 * view_.opts.padding) + (2 * view_.opts.textPadding),
    'Second line height (single block in indent)');
  strictEqual(documentView.dimensions[2].height,
    view_.opts.textHeight + (2 * view_.opts.padding) + (2 * view_.opts.textPadding) +
    view_.opts.indentTongueHeight,
    'Third line height (indentEnd at root)');

  document = coffee.parse(`\
alert (for [1..10]
  alert 10
  alert 20)\
`
  );

  documentView = view_.getViewNodeFor(document);
  documentView.layout();

  strictEqual(documentView.dimensions[0].height,
    view_.opts.textHeight + (5 * view_.opts.padding) + (2 * view_.opts.textPadding),
    'First line height (block, 3.5 padding)');
  strictEqual(documentView.dimensions[1].height,
    view_.opts.textHeight + (2 * view_.opts.padding) + (2 * view_.opts.textPadding),
    'Second line height (single block in nested indent)');
  strictEqual(documentView.dimensions[2].height,
    view_.opts.textHeight + (3 * view_.opts.padding) +
    view_.opts.indentTongueHeight + (2 * view_.opts.textPadding),
    'Third line height (indentEnd with padding)');

  document = coffee.parse(`\
alert 10

alert 20\
`
  );

  documentView = view_.getViewNodeFor(document);
  documentView.layout();

  strictEqual(documentView.dimensions[1].height,
    view_.opts.textHeight + (2 * view_.opts.padding),
    'Renders empty lines');
  return start();
});

asyncTest('View: bounding box flag stuff', function() {
  const view_ = new view.View();

  const document = coffee.parse(`\
alert 10
alert 20
alert 30
alert 40\
`
  );

  const documentView = view_.getViewNodeFor(document);
  documentView.layout();

  const blockView = view_.getViewNodeFor(document.getBlockOnLine(3));

  strictEqual(blockView.path._points[0].y,
    (view_.opts.textHeight * 4) + (view_.opts.padding * 8) + (view_.opts.textPadding * 8),
    'Original path points are O.K.');

  document.remove(document.getBlockOnLine(2));
  documentView.layout();

  strictEqual(blockView.path._points[0].y,
    (view_.opts.textHeight * 3) + (view_.opts.padding * 6) + (view_.opts.textPadding * 6),
    'Final path points are O.K.');
  return start();
});

asyncTest('View: sockets caching', function() {
  let block;
  const view_ = new view.View();

  const document = coffee.parse(`\
for i in a()()()
  alert 10\
`
  );

  const documentView = view_.getViewNodeFor(document);
  documentView.layout();

  const socketView = view_.getViewNodeFor(getNthToken(document, 8).container);

  strictEqual(socketView.model.stringify(), 'a()()()', 'Correct block selected');

  strictEqual(socketView.dimensions[0].height,
    view_.opts.textHeight + (6 * view_.opts.padding) + (2 * view_.opts.textPadding),
    'Original height is O.K.');

  document.remove((block = getNthToken(document, 9).container));
  document.insert(document.getBlockOnLine(1).start.prev.prev, block);
  documentView.layout();

  strictEqual(socketView.dimensions[0].height,
    view_.opts.textHeight + (2 * view_.opts.textPadding),
    'Final height is O.K.');
  return start();
});

asyncTest('View: bottomLineSticksToTop bug', function() {
  const view_ = new view.View();

  const document = coffee.parse(`\
setTimeout (->
  alert 20
  alert 10), 1 + 2 + 3 + 4 + 5\
`
  );

  const documentView = view_.getViewNodeFor(document);
  documentView.layout();

  const testedBlock = document.getBlockOnLine(2);
  const testedBlockView = view_.getViewNodeFor(testedBlock);

  strictEqual(testedBlockView.dimensions[0].height,
    ((2 * view_.opts.textPadding) +
    (1 * view_.opts.textHeight) +
    (10 * view_.opts.padding)) -
    (1 * view_.opts.indentTongueHeight), 'Original height O.K.');

  const block = document.getBlockOnLine(1);
  const dest = document.getBlockOnLine(2).end;

  document.remove(block);
  document.insert(dest, block);

  documentView.layout();

  strictEqual(testedBlockView.dimensions[0].height,
    (2 * view_.opts.textPadding) +
    (1 * view_.opts.textHeight) +
    (2 * view_.opts.padding), 'Final height O.K.');

  document.remove(block);
  document.insert(testedBlock.start.prev.prev, block);

  documentView.layout();

  strictEqual(testedBlockView.dimensions[0].height,
    ((2 * view_.opts.textPadding) +
    (1 * view_.opts.textHeight) +
    (10 * view_.opts.padding)) -
    (1 * view_.opts.indentTongueHeight), 'Dragging other block in works');
  return start();
});

asyncTest('View: triple-quote sockets caching issue', function() {
  const view_ = new view.View();

  const document = coffee.parse(`\
console.log 'hi'\
`
  );

  const documentView = view_.getViewNodeFor(document);
  documentView.layout();

  let socketView = view_.getViewNodeFor(getNthToken(document, 4).container);

  strictEqual(socketView.model.stringify(), '\'hi\'', 'Correct block selected');
  strictEqual(socketView.dimensions[0].height, view_.opts.textHeight + (2 * view_.opts.textPadding), 'Original height O.K.');
  strictEqual(socketView.topLineSticksToBottom, false, 'Original topstick O.K.');

  helper.string([
    socketView.model.start,
    new model.TextToken('"""'),
    new model.NewlineToken(),
    new model.TextToken('hello'),
    new model.NewlineToken(),
    new model.TextToken('world"""'),
    socketView.model.end
  ]);

  socketView.model.notifyChange();

  documentView.layout();

  strictEqual(socketView.topLineSticksToBottom, true, 'Intermediate topstick O.K.');

  helper.string([
    socketView.model.start,
    new model.TextToken('\'hi\''),
    socketView.model.end
  ]);

  socketView.model.notifyChange();
  documentView.layout();

  socketView = view_.getViewNodeFor(getNthToken(document, 4).container);

  strictEqual(socketView.dimensions[0].height, view_.opts.textHeight + (2 * view_.opts.textPadding), 'Final height O.K.');
  strictEqual(socketView.topLineSticksToBottom, false, 'Final topstick O.K.');
  return start();
});

asyncTest('View: empty socket heights', function() {
  const view_ = new view.View();

  const document = coffee.parse(`\
if \`\` is a
  \`\`\
`
  );

  const documentView = view_.getViewNodeFor(document);
  documentView.layout();

  const emptySocketView = view_.getViewNodeFor(getNthToken(document, 6).container);
  const fullSocketView = view_.getViewNodeFor(getNthToken(document, 9).container);

  strictEqual(emptySocketView.dimensions[0].height, fullSocketView.dimensions[0].height, 'Full and empty sockets same height');
  return start();
});

asyncTest('View: indent carriage arrow', function() {
  const view_ = new view.View();

  const document = parser.parseXML(`\
<block>hello <indent prefix="  "><block>my <socket>name</socket></block>
<block>is elder <socket>price</socket></block></indent></block>\
`
  );

  const documentView = view_.getViewNodeFor(document);
  documentView.layout();

  const block = document.getBlockOnLine(1).start.prev.prev.container;
  const blockView = view_.getViewNodeFor(block);

  strictEqual(blockView.carriageArrow, 1, 'Carriage arrow flag is set');

  strictEqual(blockView.dropPoint.x, view_.opts.indentWidth, 'Drop point is on the left');
  strictEqual(blockView.dropPoint.y,
    Math.max(
      (1 * view_.opts.textHeight) +
      (3 * view_.opts.padding) +
      (2 * view_.opts.textPadding)
    ), 'Drop point is further down');

  const indent = block.start.prev.container;
  const indentView = view_.getViewNodeFor(indent);


  ok((indentView.glue[0] != null), 'Carriage arrow causes glue (exists)');
  strictEqual(indentView.glue[0].height, view_.opts.padding, 'Carriage arrow causes glue (correct height)');
  return start();
});

asyncTest('View: sidealong carriage arrow', function() {
  const view_ = new view.View();

  const document = parser.parseXML(`\
<block>hello <indent prefix="  ">
<block>my <socket>name</socket></block><block>is elder <socket>price</socket></block></indent></block>\
`
  );

  const documentView = view_.getViewNodeFor(document);
  documentView.layout();

  const block = document.getBlockOnLine(1).end.next.container;
  const blockView = view_.getViewNodeFor(block);

  strictEqual(blockView.carriageArrow, 0, 'Carriage arrow flag is set');

  strictEqual(blockView.dropPoint.x, view_.opts.indentWidth, 'Drop point is on the left');

  const indent = block.end.next.container;
  const indentView = view_.getViewNodeFor(indent);

  strictEqual(indentView.dimensions[1].height,
    view_.opts.textHeight +
    (2 * view_.opts.textPadding) +
    (3 * view_.opts.padding), 'Carriage arrow causes expand');
  return start();
});

asyncTest('Controller: ace editor mode', function() {
  const editor = new droplet.Editor(document.getElementById('test-main'), {
    mode: 'coffeescript',
    palette: []
  });
  let done = false;
  let resolved = false;
  const resolve = function() {
    if (resolved) { return; }
    resolved = true;
    ok(done);
    return start();
  };
  editor.aceEditor.session.on('changeMode', function() {
    strictEqual(editor.aceEditor.session.getMode().$id, 'ace/mode/coffee');
    done = true;
    return resolve();
  });
  return setTimeout(resolve, 1000);
});

asyncTest('Controller: melt/freeze events', function() {
  expect(3);

  const states = [];
  document.getElementById('test-main').innerHTML = '';
  const editor = new droplet.Editor(document.getElementById('test-main'), {
    mode: 'coffeescript',
    palette: []
  });

  editor.on('statechange', usingBlocks => states.push(usingBlocks));

  return editor.performMeltAnimation(10, 10, () =>
    editor.performFreezeAnimation(10, 10, function() {
      strictEqual(states.length, 2);
      strictEqual(states[0], false);
      strictEqual(states[1], true);
      return start();
    })
  );
});

asyncTest('View: absorbCache', function() {
  const view_ = new view.View();

  const document = c.parse(`\
int main() {
  /* some comment
  some comment */ puts("Hello"); /* more comments
  more comments */
  return 0;
}\
`
  );

  const documentView = view_.getViewNodeFor(document);
  documentView.layout();

  const start_ = document.getBlockOnLine(1).start;
  const { end } = document.getBlockOnLine(3);

  const list = new model.List(start_, end);

  for (let i = 0; i < 10; i++) {
    const oldY = [
      view_.getViewNodeFor(document.getBlockOnLine(1)).bounds[1].y, // some comment */
      view_.getViewNodeFor(document.getFromTextLocation({ // return 0;
        row: 2,
        col: 18,
        type: 'block'
      })).bounds[0].y,
      view_.getViewNodeFor(document.getFromTextLocation({ // /* more comments
        row: 2,
        col: 31,
        type: 'block'
      })).bounds[0].y
    ];

    view_.getViewNodeFor(list).absorbCache();

    const newY = [
      view_.getViewNodeFor(document.getBlockOnLine(1)).bounds[1].y, // some comment */
      view_.getViewNodeFor(document.getFromTextLocation({ // return 0;
        row: 2,
        col: 18,
        type: 'block'
      })).bounds[0].y,
      view_.getViewNodeFor(document.getFromTextLocation({ // /* more comments
        row: 2,
        col: 31,
        type: 'block'
      })).bounds[0].y
    ];

    equal(newY[0], oldY[0], 'First block preserved');
    equal(newY[1], oldY[1], 'Second block preserved');
    equal(newY[2], oldY[2], 'Third block preserved');
  }

  return start();
});

asyncTest('Controller: palette events', function() {
  let start;
  let asc, j;
  document.getElementById('test-main').innerHTML = '';
  const editor = new droplet.Editor(document.getElementById('test-main'), {
    mode: 'coffeescript',
    palette: [{
      name: 'Draw',
      color: 'blue',
      blocks: [{
        block: 'pen purple',
        title: 'Set the pen color',
        id: 'pen'
      }],
    }, {
      name: 'Move',
      color: 'red',
      blocks: [{
        block: 'moveto 100, 100',
        title: 'Move to a coordinate',
        id: 'moveto'
      }]
    }]
  });
  const dispatchMouse = function(name, e) {
    const cr = e.getBoundingClientRect();
    const mx = Math.floor((cr.left + cr.right) / 2);
    const my = Math.floor((cr.top + cr.bottom) / 2);
    const ev = document.createEvent('MouseEvents');
    ev.initMouseEvent(name, true, true, window,
        0, mx, my, mx, my, false, false, false, false, 0, null);
    return e.dispatchEvent(ev);
  };

  const states = [];
  editor.on('selectpalette', name => states.push(`s:${name}`));
  const headers = document.getElementsByClassName('droplet-palette-group-header');
  for (start = headers.length - 1, j = start, asc = start <= 0; asc ? j <= 0 : j >= 0; asc ? j++ : j--) {
    dispatchMouse('click', headers[j]);
  }
  deepEqual(states, ['s:Move', 's:Draw']);
  // TODO, fix layout in test environment, and test pickblock event.
  return start();
});

asyncTest('Controller: cursor motion and rendering', function() {
  const states = [];
  document.getElementById('test-main').innerHTML = '';
  const editor = new droplet.Editor(document.getElementById('test-main'), {
    mode: 'coffeescript',
    palette: []
  });

  editor.setValue(`\
alert 10
if a is b
  alert 20
  alert 30
else
  alert 40\
`
  );

  const moveCursorUp = function() {
    let left;
    return editor.setCursor(
      ((left = editor.getCursor().prev) != null ? left : editor.getCursor().start.prev),
      (token => token.type !== 'socketStart'),
      'before'
    );
  };

  const moveCursorDown = function() {
    let left;
    return editor.setCursor(
      ((left = editor.getCursor().next) != null ? left : editor.getCursor().end.next),
      (token => token.type !== 'socketStart'),
      'after'
    );
  };

  strictEqual(editor.determineCursorPosition().x, 0, 'Cursor position correct (x - down)');
  strictEqual(editor.determineCursorPosition().y, editor.nubbyHeight, 'Cursor position correct (y - down)');

  moveCursorDown();

  strictEqual(editor.determineCursorPosition().x, 0,
    'Cursor position correct after \'alert 10\' (x - down)');
  strictEqual(editor.determineCursorPosition().y, editor.nubbyHeight +
    (1 * editor.session.view.opts.textHeight) +
    (2 * editor.session.view.opts.padding) +
    (2 * editor.session.view.opts.textPadding), 'Cursor position correct after \'alert 10\' (y - down)');

  moveCursorDown();

  strictEqual(editor.determineCursorPosition().x, editor.session.view.opts.indentWidth,
    'Cursor position correct after \'if a is b\' (x - down)');
  strictEqual(editor.determineCursorPosition().y, editor.nubbyHeight +
    (2 * editor.session.view.opts.textHeight) +
    (6 * editor.session.view.opts.padding) +
    (4 * editor.session.view.opts.textPadding), 'Cursor position correct after \'if a is b\' (y - down)');

  moveCursorDown();

  strictEqual(editor.determineCursorPosition().x, editor.session.view.opts.indentWidth,
    'Cursor position correct after \'alert 20\' (x - down)');
  strictEqual(editor.determineCursorPosition().y, editor.nubbyHeight +
    (3 * editor.session.view.opts.textHeight) +
    (8 * editor.session.view.opts.padding) +
    (6 * editor.session.view.opts.textPadding), 'Cursor position correct after \'alert 20\' (y - down)');

  moveCursorDown();

  strictEqual(editor.determineCursorPosition().x, editor.session.view.opts.indentWidth,
    'Cursor position correct at end of indent (x - down)');
  strictEqual(editor.determineCursorPosition().y, editor.nubbyHeight +
    (4 * editor.session.view.opts.textHeight) +
    (10 * editor.session.view.opts.padding) +
    (8 * editor.session.view.opts.textPadding), 'Cursor position at end of indent (y - down)');

  moveCursorDown();

  strictEqual(editor.session.cursor.location.type, 'indentStart', 'Cursor skipped middle of block');

  moveCursorUp();

  strictEqual(editor.determineCursorPosition().x, editor.session.view.opts.indentWidth,
    'Cursor position correct at end of indent (x - up)');
  strictEqual(editor.determineCursorPosition().y, editor.nubbyHeight +
    (4 * editor.session.view.opts.textHeight) +
    (10 * editor.session.view.opts.padding) +
    (8 * editor.session.view.opts.textPadding), 'Cursor position at end of indent (y - up)');

  moveCursorUp();

  strictEqual(editor.determineCursorPosition().x, editor.session.view.opts.indentWidth,
    'Cursor position correct after \'alert 20\' (x - up)');
  strictEqual(editor.determineCursorPosition().y, editor.nubbyHeight +
    (3 * editor.session.view.opts.textHeight) +
    (8 * editor.session.view.opts.padding) +
    (6 * editor.session.view.opts.textPadding), 'Cursor position correct after \'alert 20\' (y - up)');

  moveCursorUp();

  strictEqual(editor.determineCursorPosition().x, editor.session.view.opts.indentWidth,
    'Cursor position correct after \'if a is b\' (y - up)');
  strictEqual(editor.determineCursorPosition().y, editor.nubbyHeight +
    (2 * editor.session.view.opts.textHeight) +
    (6 * editor.session.view.opts.padding) +
    (4 * editor.session.view.opts.textPadding), 'Cursor position correct after \'if a is b\' (y - up)');

  moveCursorUp();

  strictEqual(editor.determineCursorPosition().x, 0,
    'Cursor position correct after \'alert 10\' (x - up)');
  strictEqual(editor.determineCursorPosition().y, editor.nubbyHeight +
    (1 * editor.session.view.opts.textHeight) +
    (2 * editor.session.view.opts.padding) +
    (2 * editor.session.view.opts.textPadding), 'Cursor position correct after \'alert 10\' (y - up)');

  moveCursorUp();

  strictEqual(editor.determineCursorPosition().x, 0, 'Cursor position correct at origin (x - up)');
  strictEqual(editor.determineCursorPosition().y, editor.nubbyHeight, 'Cursor position correct at origin (y - up)');
  return start();
});

asyncTest('Controller: setMode', function() {
  document.getElementById('test-main').innerHTML = '';
  const editor = new droplet.Editor(document.getElementById('test-main'), {
    mode: 'coffeescript',
    palette: []
  });
  strictEqual('coffeescript', editor.getMode());
  editor.setMode('javascript');
  strictEqual('javascript', editor.getMode());
  return start();
});

/*
asyncTest 'Controller: setValue errors', ->
  document.getElementById('test-main').innerHTML = ''
  editor = new droplet.Editor document.getElementById('test-main'), {
    mode: 'coffeescript'
    palette: []
  }

  editor.setEditorState true

  editor.setValue '''
  pen red
  speed 30
  for [1..30]
    lt 90
    lt 90, 20
    if ``
    ``
    lt 90
    lt 90, 20
    dot blue, 15
    dot yellow, 10
    rt 105, 100
    rt 90
  (((((((((((((((((((((((loop))))))))))))))))))))))) = (param) ->
    ``
  '''

  strictEqual editor.currentlyUsingBlocks, false
  start()
*/

asyncTest('Controller: arbitrary row/column marking', function() {
  document.getElementById('test-main').innerHTML = '';
  const editor = new droplet.Editor(document.getElementById('test-main'), {
    mode: 'coffeescript',
    palette: []
  });

  editor.setEditorState(true);

  editor.setValue(`\
for [1..10]
  alert 10 + 10
  prompt 10 - 10
  alert 10 * 10
  prompt 10 / 10\
`
  );

  equal(editor.session.tree.getFromTextLocation({row: 2, col: 9, type: 'block'}).stringify(), '10 - 10', 'Selected the right block');

  const before = $('[stroke=#F00]').length;

  const key = editor.mark({row: 2, col: 9, type: 'block'}, {color: '#F00'});

  const after = $('[stroke=#F00]').length;

  ok(after > before, 'Added a red mark');

  return start();
});

asyncTest('Controller: dropdown menus', function() {
  document.getElementById('test-main').innerHTML = '';
  const editor = new droplet.Editor(document.getElementById('test-main'), {
    mode: 'coffeescript',
    palette: [],
    modeOptions: {
      functions: {
        'pen': {
          dropdown: {
            0: [
              {text: 'red', display: '<b>red</b>'},
              'blue'
            ]
          }
        }
      }
    }
  });

  editor.setEditorState(true);

  editor.setValue(`\
pen red\
`
  );

  // Assert that the arrow is there
  strictEqual(Math.round(editor.session.view.getViewNodeFor(editor.session.tree.getBlockOnLine(0)).bounds[0].width), 90);

  // no-throw
  editor.setCursor(editor.session.tree.getBlockOnLine(0).end.prev.container.start);
  editor.showDropdown();
  return start();
});

asyncTest('Controller: dropdown menus with functions', function() {
  document.getElementById('test-main').innerHTML = '';
  const editor = new droplet.Editor(document.getElementById('test-main'), {
    mode: 'coffeescript',
    palette: [],
    modeOptions: {
      functions: {
        'pen': {
          dropdown: {
            0() { return [
              {text: 'red', display: '<b>red</b>'},
              'blue'
            ]; }
          }
        }
      }
    }
  });

  editor.setEditorState(true);

  editor.setValue(`\
pen red\
`
  );

  // Assert that the arrow is there
  strictEqual(Math.round(editor.session.view.getViewNodeFor(editor.session.tree.getBlockOnLine(0)).bounds[0].width), 90);

  // no-throw
  editor.setCursor(editor.session.tree.getBlockOnLine(0).end.prev.container.start);
  editor.showDropdown();
  return start();
});

asyncTest('Controller: showPaletteInTextMode false', function() {
  expect(4);

  const states = [];
  document.getElementById('test-main').innerHTML = '';
  const editor = new droplet.Editor(document.getElementById('test-main'), {
    mode: 'coffeescript',
    palette: [],
    showPaletteInTextMode: false
  });

  const paletteWrapper = document.querySelector('.droplet-palette-wrapper');
  const aceEditor = document.querySelector('.ace_editor');

  editor.on('statechange', usingBlocks => states.push(usingBlocks));

  return editor.performMeltAnimation(10, 10, function() {
    strictEqual(paletteWrapper.style.left, '-270px');
    strictEqual(aceEditor.style.left, '0px');
    return editor.performFreezeAnimation(10, 10, function() {
      strictEqual(paletteWrapper.style.left, '0px');
      strictEqual(aceEditor.style.left, '-9999px');
      return start();
    });
  });
});

asyncTest('Controller: showPaletteInTextMode true', function() {
  expect(4);

  const states = [];
  document.getElementById('test-main').innerHTML = '';
  const editor = new droplet.Editor(document.getElementById('test-main'), {
    mode: 'coffeescript',
    palette: [],
    showPaletteInTextMode: true
  });

  const paletteWrapper = document.querySelector('.droplet-palette-wrapper');
  const aceEditor = document.querySelector('.ace_editor');

  editor.on('statechange', usingBlocks => states.push(usingBlocks));

  return editor.performMeltAnimation(10, 10, function() {
    strictEqual(paletteWrapper.style.left, '0px');
    strictEqual(aceEditor.style.left, '270px');
    return editor.performFreezeAnimation(10, 10, function() {
      strictEqual(paletteWrapper.style.left, '0px');
      strictEqual(aceEditor.style.left, '-9999px');
      return start();
    });
  });
});

asyncTest('Controller: enablePalette false', function() {
  expect(4);

  document.getElementById('test-main').innerHTML = '';
  const editor = new droplet.Editor(document.getElementById('test-main'), {
    mode: 'coffeescript',
    palette: []
  });

  const paletteWrapper = document.querySelector('.droplet-palette-wrapper');
  const dropletWrapper = document.querySelector('.droplet-wrapper-div');

  strictEqual(paletteWrapper.style.left, '0px');
  strictEqual(dropletWrapper.style.left, '270px');

  const verifyPaletteHidden = function() {
    strictEqual(paletteWrapper.style.left, '-270px');
    strictEqual(dropletWrapper.style.left, '0px');
    return start();
  };

  editor.enablePalette(false);

  return setTimeout(verifyPaletteHidden, 500);
});

var getNthToken = function(document, n) {
  let head = document.start;
  for (let i = 1, end = n, asc = 1 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
    head = head.next;
  }
  return head;
};
