/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const assert = require('assert');
const fs = require('fs');

const Coffee = require('../../src/languages/coffee');
const Javascript = require('../../src/languages/javascript');
const model = require('../../src/model');
const helper = require('../../src/helper');

const coffee = new Coffee();
const js = new Javascript();

describe('Model',function() {
  it('should be able to perform basic token operations', function() {
    const a = new model.Token();
    const b = new model.Token();
    const c = new model.Token();
    const d = new model.Token();

    assert.strictEqual(helper.connect(a, b), b, 'connect() returns argument');

    assert.strictEqual(a.prev, null, 'connect assembles correct linked list');
    assert.strictEqual(a.next, b, 'connect assembles correct linked list');
    assert.strictEqual(b.prev, a, 'connect assembles correct linked list');
    assert.strictEqual(b.next, null, 'connect assembles correct linked list');

    helper.connect(b, c);
    b.remove();

    assert.strictEqual(a.next, c, 'remove removes token');
    return assert.strictEqual(c.prev, a, 'remove removes token');
  });

  it('should be able to do proper parenting', function() {
    const cont1 = new model.Document();
    const cont2 = new model.Container();

    const a = cont1.start;
    const b = new model.Token();
    const c = cont2.start;
    const d = new model.Token();
    const e = cont2.end;
    const f = cont1.end;

    helper.string([a, b, c, d, e, f]);

    cont1.correctParentTree();

    assert.strictEqual(a.parent, null, 'correctParentTree() output is correct (a)');
    assert.strictEqual(b.parent, cont1, 'correctParentTree() output is correct (b)');
    assert.strictEqual(c.parent, cont1, 'correctParentTree() output is correct (c)');
    assert.strictEqual(d.parent, cont2, 'correctParentTree() output is correct (d)');
    assert.strictEqual(e.parent, cont1, 'correctParentTree() output is correct (e)');
    assert.strictEqual(f.parent, null, 'correctParentTree() output is correct (f)');

    const g = new model.Token();
    const h = new model.Token();
    helper.connect(g, h);

    const list = new model.List(g, h);
    cont1.insert(d, list);

    assert.strictEqual(a.parent, null, 'splice in parents still work');
    assert.strictEqual(b.parent, cont1, 'splice in parents still work');
    assert.strictEqual(c.parent, cont1, 'splice in parents still work');
    assert.strictEqual(d.parent, cont2, 'splice in parents still work');
    assert.strictEqual(g.parent, cont2, 'splice in parents still work');
    assert.strictEqual(h.parent, cont2, 'splice in parents still work');
    assert.strictEqual(e.parent, cont1, 'splice in parents still work');
    assert.strictEqual(f.parent, null, 'splice in parents still work');

    const cont3 = new model.Container();
    cont1.insert(g, cont3);

    return assert.strictEqual(h.parent, cont2, 'splice in parents still work');
  });

  it('should be able to get a block on a line', function() {
    const document = coffee.parse(`\
for i in [1..10]
  console.log i
if a is b
  console.log k
  if b is c
    console.log q
else
  console.log j\
`
    );

    assert.strictEqual(document.getBlockOnLine(1).stringify(), 'console.log i', 'line 1');
    assert.strictEqual(document.getBlockOnLine(3).stringify(), 'console.log k', 'line 3');
    assert.strictEqual(document.getBlockOnLine(5).stringify(), 'console.log q', 'line 5');
    return assert.strictEqual(document.getBlockOnLine(7).stringify(), 'console.log j', 'line 7');
  });

  it('should be able to move a block', function() {
    const document = coffee.parse(`\
for i in [1..10]
  console.log hello
  console.log world\
`
    );

    let block = document.getBlockOnLine(2);
    document.remove(block);
    document.insert(document.start, block);

    assert.strictEqual(document.stringify(), `\
console.log world
for i in [1..10]
  console.log hello\
`, 'Move console.log world out');

    block = document.getBlockOnLine(2);
    document.remove(block);
    document.insert(document.start, block);

    assert.strictEqual(document.stringify(), `\
console.log hello
console.log world
for i in [1..10]
  \`\`\
`, 'Move both out');

    block = document.getBlockOnLine(0);
    const destination = document.getBlockOnLine(2).end.prev.container.start;
    document.remove(block);
    document.insert(destination, block);

    return assert.strictEqual(document.stringify(), `\
console.log world
for i in [1..10]
  console.log hello\
`, 'Move hello back in');
  });

  it('should be able to exactly undo and redo removes and inserts', function() {
    const document = coffee.parse(`\
for i in [1..10]
  console.log hello
  console.log world\
`
    );

    const testRemove = function(block, expected, message) {
      const old = document.stringify();

      const operation = document.remove(block);
      if (expected != null) {
        assert.strictEqual(document.stringify(), expected, message);
      } else {
        expected = document.stringify();
      }

      document.perform(operation, 'backward');
      assert.strictEqual(document.stringify(), old, message + ' (undo test)');

      document.perform(operation, 'forward');
      return assert.strictEqual(document.stringify(), expected, message + ' (redo test)');
    };

    const testInsert = function(location, block, expected, message) {
      const old = document.stringify();

      const operation = document.insert(location, block);
      if (expected != null) {
        assert.strictEqual(document.stringify(), expected, message);
      } else {
        expected = document.stringify();
      }

      document.perform(operation, 'backward');
      assert.strictEqual(document.stringify(), old, message + ' (undo test)');

      document.perform(operation, 'forward');
      return assert.strictEqual(document.stringify(), expected, message + ' (redo test)');
    };

    let block = document.getBlockOnLine(2);
    testRemove(block, `\
for i in [1..10]
  console.log hello\
`, 'Remove console.log world');
    testInsert(document.start, block, `\
console.log world
for i in [1..10]
  console.log hello\
`, 'Move console.log world out');

    block = document.getBlockOnLine(2);
    testRemove(block, `\
console.log world
for i in [1..10]
  \`\`\
`, 'Remove console.log hello');
    testInsert(document.start, block, `\
console.log hello
console.log world
for i in [1..10]
  \`\`\
`, 'Move both out');

    block = document.getBlockOnLine(0);
    const destination = document.getBlockOnLine(2).end.prev.container.start;
    testRemove(block, `\
console.log world
for i in [1..10]
  \`\`\
`, 'Remove console.log hello');
    return testInsert(destination, block, `\
console.log world
for i in [1..10]
  console.log hello\
`, 'Move hello back in');
  });

  it('should assign indentation properly', function() {
    const document = coffee.parse(`\
for i in [1..10]
  \`\`
for i in [1..10]
  alert 10\
`
    );

    const block = document.getBlockOnLine(2);
    const destination = document.getBlockOnLine(1).end.prev.container.start;
    document.remove(block);
    document.insert(destination, block);

    return assert.strictEqual(document.stringify(), `\
for i in [1..10]
  for i in [1..10]
    alert 10\
`
    );
  });

  it('should assign indent even without emptyIndent', function() {
    const document = js.parse(`\
if (x < 10) {
  
}
if (x < 10) {
  
}
if (x < 10) {
  
}\
`
    );

    const block1 = document.getBlockOnLine(3);
    const block2 = document.getBlockOnLine(6);
    let destination = document.getBlockOnLine(0).end.prev.prev.prev.container.start;
    document.remove(block2);
    document.remove(block1);
    document.insert(destination, block1);
    destination = document.getBlockOnLine(1).end.prev.prev.prev.container.start;
    document.insert(destination, block2);

    return assert.strictEqual(document.stringify(), `\
if (x < 10) {
  if (x < 10) {
    if (x < 10) {
      
    }
  }
}\
`
    );
  });

  // DropletLocation unity
  const testString = str =>
    it(`should have unity for all tokens on '${str.slice(0, 11)}...'`, function() {
      const document = coffee.parse(str, {wrapAtRoot: true});
      let head = document.start;
      return (() => {
        const result = [];
        while (head !== document.end) {
          assert.strictEqual(document.getFromLocation(head.getLocation()), head);
          result.push(head = head.next);
        }
        return result;
      })();
    })
  ;
  testString('/// #{x} ///');
  testString('fd 10');
  testString('fd 10 + 10');
  testString('console.log 10 + 10');
  testString(`\
for i in [1..10]
  console.log 10 + 10\
`
  );
  return testString(`\
array = []
if a is b
  while p is q
    make spaghetti
    eat spaghetti
    array.push spaghetti
  for i in [1..10]
    console.log 10 + 10
else
  see 'hi'
  for key, value in window
    see key + ' is ' + value
    see key is value
    see array[n]\
`
  );
});
