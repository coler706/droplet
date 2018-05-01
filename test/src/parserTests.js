/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const assert = require('assert');
const fs = require('fs');

const Coffee = require('../../src/languages/coffee');

const coffee = new Coffee();

describe('Parser unity', function(done) {
  const testString = str =>
    it(`should round-trip ${str.split('\n')[0]}` +
        (str.split('\n').length > 1 ? '...' : ''), () => assert.equal(str, coffee.parse(str, {wrapAtRoot: true}).stringify(coffee)))
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
  testString(`\
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
  const testFile = name =>
    it(`should round-trip on ${name}`, function() {
      const file = fs.readFileSync(name).toString();

      const unparsed = coffee.parse(file, {wrapAtRoot: true}).stringify(coffee);

      const filelines = file.split('\n');
      return Array.from(unparsed.split('\n')).map((line, i) =>
        assert.equal(line, filelines[i], `${i} failed`));
    })
  ;

  testFile('test/data/nodes');
  return testFile('test/data/allTests');
});
