/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const helper = require('../../src/helper');
const JavaScript = require('../../src/languages/javascript');

asyncTest('JS dotted methods', function() {
  const customJS = new JavaScript({
    functions: {
      'console.log': {},
      speak: {},
      'Math.log': {
        value: true
      },
      '*.toString': {
        value: true
      },
      '?.pos': {
        command: true,
        color: 'red'
      },
      setTimeout: {
        command: true,
        value: true
      }
    }
  });

  const customSerialization = customJS.parse(
    `\
x.pos(100);
return console.log(Math.log(log(x.toString(~pos()))));\
`
  ).serialize();

  const expectedSerialization = `<document><block
  precedence="2"
  color="red"
  socketLevel="0"
  classes="CallExpression mostly-block"><socket
  precedence="100"
  handwritten="false"
  classes=""
>x</socket
>.pos(<socket
  precedence="100"
  handwritten="false"
  classes="">100</socket>);</block>\n<block
  precedence="0"
  color="yellow"
  socketLevel="0"
  classes="ReturnStatement mostly-block"
>return <socket
  precedence="0"
  handwritten="false"
  classes=""
><block
  precedence="2"
  color="blue"
  socketLevel="0"
  classes="CallExpression mostly-block"
>console.log(<socket
  precedence="100"
  handwritten="false"
  classes=""
><block
  precedence="2"
  color="green"
  socketLevel="0"
  classes="CallExpression mostly-value"
>Math.log(<socket
  precedence="100"
  handwritten="false"
  classes=""
><block
  precedence="2"
  color="blue"
  socketLevel="0"
  classes="CallExpression any-drop"
><socket
  precedence="100"
  handwritten="false"
  classes=""
>log</socket>(<socket
  precedence="100"
  handwritten="false"
  classes=""
><block
  precedence="2"
  color="green"
  socketLevel="0"
  classes="CallExpression mostly-value"
><socket
  precedence="100"
  handwritten="false"
  classes=""
>x</socket>.toString(<socket
  precedence="100"
  handwritten="false"
  classes=""
><block
  precedence="4"
  color="green"
  socketLevel="0"
  classes="UnaryExpression mostly-value"
>~<socket
  precedence="4"
  handwritten="false"
  classes=""
><block
  precedence="2"
  color="red"
  socketLevel="0"
  classes="CallExpression mostly-block"
>pos()</block></socket></block></socket
>)</block></socket
>)</block></socket
>)</block></socket
>)</block></socket
>;</block></document>`;
  strictEqual(
      helper.xmlPrettyPrint(customSerialization),
      helper.xmlPrettyPrint(expectedSerialization),
      'Dotted known functions work');
  return start();
});

asyncTest('JS Custom Colors', function() {
  const customJS = new JavaScript({
    categories: {
      functions: {color: '#111'},
      returns: {color: '#222'},
      comments: {color: '#333'},
      arithmetic: {color: '#444'},
      containers: {color: '#666'},
      assignments: {color: '#777'},
      loops: {color: '#888'},
      conditionals: {color: '#999'},
      value: {color: '#aaa'},
      command: {color: '#bbb'}
    }
  });
  const customSerialization = customJS.parse(
      'return b != (a += [c + d][0]);').serialize();
  const expectedSerialization = `<document
><block
  precedence="0"
  color="#222"
  socketLevel="0"
  classes="ReturnStatement mostly-block"
>return <socket
  precedence="0"
  handwritten="false"
  classes=""
><block
  precedence="9"
  color="cyan"
  socketLevel="0"
  classes="BinaryExpression mostly-value"
><socket
  precedence="9"
  handwritten="false"
  classes=""
>b</socket
> != <socket
  precedence="9"
  handwritten="false"
  classes=""
><block
  precedence="0"
  color="#777"
  socketLevel="0"
  classes="mostly-block AssignmentExpression"
>(<socket
  precedence="100"
  handwritten="false"
  classes=""
>a</socket
> += <socket
  precedence="100"
  handwritten="false"
  classes=""
><block
  precedence="1"
  color="#666"
  socketLevel="0"
  classes="MemberExpression mostly-value"
><socket
  precedence="0"
  handwritten="false"
  classes=""
><block
  precedence="0"
  color="#666"
  socketLevel="0"
  classes="ArrayExpression mostly-value"
>[<socket
  precedence="0"
  handwritten="false"
  classes=""
><block
  precedence="6"
  color="#444"
  socketLevel="0"
  classes="BinaryExpression mostly-value"
><socket
  precedence="6"
  handwritten="false"
  classes=""
>c</socket
> + <socket
  precedence="6"
  handwritten="false"
  classes=""
>d</socket></block></socket
>]</block></socket
>[<socket
  precedence="0"
  handwritten="false"
  classes=""
>0</socket
>]</block></socket
>)</block></socket></block></socket
>;</block></document>`;
  strictEqual(
      helper.xmlPrettyPrint(customSerialization),
      helper.xmlPrettyPrint(expectedSerialization),
      'JS Custom colors work');
  return start();
});

asyncTest('JS empty indents', function() {
  const customJS = new JavaScript();
  const code = 'if (__) {\n\n}';
  const customSerialization = customJS.parse('if (__) {\n\n}');
  const stringifiedJS = customSerialization.stringify();
  strictEqual(stringifiedJS, code);
  return start();
});

asyncTest('JS LogicalExpressions', function() {
  const customJS = new JavaScript();
  const customSerialization = customJS.parse(
      'a && b').serialize();
  const expectedSerialization = `<document
><block
  precedence="13"
  color="cyan"
  socketLevel="0"
  classes="LogicalExpression mostly-value"
><socket
  precedence="13"
  handwritten="false"
  classes=""
>a</socket> &amp;&amp; <socket
  precedence="13"
  handwritten="false"
  classes=""
>b</socket></block></document>`;
  strictEqual(
      helper.xmlPrettyPrint(customSerialization),
      helper.xmlPrettyPrint(expectedSerialization),
      'Logical expression precedences are assigned.');
  return start();
});

asyncTest('JS omits unary +/- for literals', function() {
  const customJS = new JavaScript();
  const customSerialization = customJS.parse(
      'foo(+1, -1, +a());').serialize();
  const expectedSerialization =
      '<document' +
      '><block' +
      '  precedence="2"' +
      '  color="blue"' +
      '  socketLevel="0"' +
      '  classes="CallExpression any-drop"' +
      '><socket' +
      '  precedence="100"' +
      '  handwritten="false"' +
      '  classes=""' +
      '>foo</socket>(' +
      '<socket' +
      '  precedence="100"' +
      '  handwritten="false"' +
      '  classes=""' +
      '>+1</socket>, ' +
      '<socket' +
      '  precedence="100"' +
      '  handwritten="false"' +
      '  classes=""' +
      '>-1</socket>, ' +
      '<socket' +
      '  precedence="100"' +
      '  handwritten="false"' +
      '  classes=""' +
      '><block '  +
      '  precedence="6"' +
      '  color="green"' +
      '  socketLevel="0"' +
      '  classes="UnaryExpression mostly-value"' +
      '>+<socket ' +
      '  precedence="6"' +
      '  handwritten="false"' +
      '  classes=""' +
      '><block ' +
      '  precedence="2"' +
      '  color="blue"' +
      '  socketLevel="0"' +
      '  classes="CallExpression any-drop"' +
      '><socket ' +
      '  precedence="100"' +
      '  handwritten="false"' +
      '  classes=""' +
      `>a</socket>(<socket \
precedence="100" \
handwritten="false" \
classes="mostly-value" \
></socket>)</block></socket></block>` +
      '</socket>);</block></document>';
  strictEqual(
      helper.xmlPrettyPrint(customSerialization),
      helper.xmlPrettyPrint(expectedSerialization),
      'Unary literal +/- are not parsed, but unary nonliteral operators are');
  return start();
});


asyncTest('JS Elif', function() {
  const customJS = new JavaScript();
  const customSerialization = customJS.parse(
      'if (a == 0) {\n' +
      '  fd(0);\n' +
      '} else if (a == 1) {\n' +
      '  fd(100);\n' +
      '} else if (a == 2) {\n' +
      '  fd(200);\n' +
      '}'
  ).serialize();
  const expectedSerialization =
    '<document' +
    '><block' +
    '  precedence="0"' +
    '  color="orange"' +
    '  socketLevel="0"' +
    '  classes="ends-with-brace block-only IfStatement"' +
    '>if (' +
    '<socket' +
    '  precedence="100"' +
    '  handwritten="false"' +
    '  classes=""' +
    '><block' +
    '  precedence="9"' +
    '  color="cyan"' +
    '  socketLevel="0"' +
    '  classes="BinaryExpression mostly-value"' +
    '><socket' +
    '  precedence="9"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>a</socket> == ' +
    '<socket' +
    '  precedence="9"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>0</socket></block></socket>) {' +
    '<indent' +
    '  prefix="  "' +
    '  classes=""' +
    '>\n<block' +
    '  precedence="2"' +
    '  color="blue"' +
    '  socketLevel="0"' +
    '  classes="CallExpression any-drop"' +
    '><socket' +
    '  precedence="100"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>fd</socket>(<socket' +
    '  precedence="100"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>0</socket>);</block></indent>' +
    '\n} else if (' +
    '<socket' +
    '  precedence="0"' +
    '  handwritten="false"' +
    '  classes=""' +
    '><block ' +
    '  precedence="9"' +
    '  color="cyan"' +
    '  socketLevel="0"' +
    '  classes="BinaryExpression mostly-value"' +
    '><socket' +
    '  precedence="9"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>a</socket> == ' +
    '<socket' +
    '  precedence="9"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>1</socket></block></socket>) {' +
    '<indent' +
    '  prefix="  "'+
    '  classes=""' +
    '>\n<block' +
    '  precedence="2"' +
    '  color="blue"' +
    '  socketLevel="0"' +
    '  classes="CallExpression any-drop"' +
    '><socket' +
    '  precedence="100"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>fd</socket>(' +
    '<socket' +
    '  precedence="100"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>100</socket>);</block></indent>' +
    '\n} else if (' +
    '<socket' +
    '  precedence="0"' +
    '  handwritten="false"' +
    '  classes=""' +
    '><block' +
    '  precedence="9"' +
    '  color="cyan"' +
    '  socketLevel="0"' +
    '  classes="BinaryExpression mostly-value"' +
    '><socket' +
    '  precedence="9"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>a</socket> == ' +
    '<socket' +
    '  precedence="9"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>2</socket></block></socket>) {' +
    '<indent prefix="  "' +
    '  classes=""' +
    '>\n<block' +
    '  precedence="2"' +
    '  color="blue"' +
    '  socketLevel="0"' +
    '  classes="CallExpression any-drop"' +
    '><socket' +
    '  precedence="100"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>fd</socket>(' +
    '<socket' +
    '  precedence="100"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>200</socket>);</block></indent>\n' +
    '}</block></document>';
  strictEqual(
      helper.xmlPrettyPrint(customSerialization),
      helper.xmlPrettyPrint(expectedSerialization),
      'Combines if-else');
  return start();
});

asyncTest('JS beginner mode loops', function() {
  const customJS = new JavaScript({
    categories: {loops: {color: 'green', beginner: true}}
  });
  const customSerialization = customJS.parse(
    `\
for (var i = 0; i < 10; i++) {
  go();
}\
`
  ).serialize();
  const expectedSerialization =
    '<document' +
    '><block' +
    '  precedence="0"' +
    '  color="green"' +
    '  socketLevel="0"' +
    '  classes="ends-with-brace block-only ForStatement"' +
    '>for (var i = 0; i &amp;lt; <socket' +
    '  precedence="0"' +
    '  handwritten="false"' +
    '  classes=""' +
    '>10</socket>; i++) {<indent' +
    '  prefix="  "' +
    '  classes=""' +
    '>\n<block' +
    '  precedence="2"' +
    '  color="blue"' +
    '  socketLevel="0"' +
    '  classes="CallExpression any-drop"' +
    '><socket' +
    '  precedence="100"' +
    '  handwritten="false"' +
    '  classes=""' +
    `>go</socket>(<socket \
precedence="100" \
handwritten="false" \
classes="mostly-value" \
></socket>);</block></indent>\n}</block></document>`;
  strictEqual(
      helper.xmlPrettyPrint(customSerialization),
      helper.xmlPrettyPrint(expectedSerialization),
      'Combines if-else');
  return start();
});
