/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS201: Simplify complex destructure assignments
 * DS202: Simplify dynamic range loops
 * DS203: Remove `|| {}` from converted for-own loops
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * DS209: Avoid top-level return
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Array Literals
// --------------

// * Array Literals
// * Splats in Array Literals

// TODO: add indexing and method invocation tests: [1][0] is 1, [].toString()

let baseFileName, compact, count, ends, extend, flatten, fs, last, merge, repeat, starts, vm;
let key;
test("trailing commas", function() {
  let trailingComma = [1, 2, 3,];
  ok((trailingComma[0] === 1) && (trailingComma[2] === 3) && (trailingComma.length === 3));

  trailingComma = [
    1, 2, 3,
    4, 5, 6,
    7, 8, 9,
  ];
  for (let n of Array.from(trailingComma)) { var sum = (sum || 0) + n; }

  const a = [(x => x), (x => x * x)];
  return ok(a.length === 2);
});

test("incorrect indentation without commas", function() {
  const result = [['a'],
   {b: 'c'}];
  ok(result[0][0] === 'a');
  return ok(result[1]['b'] === 'c');
});


// Splats in Array Literals

test("array splat expansions with assignments", function() {
  let a, b;
  const nums = [1, 2, 3];
  const list = [(a = 0), ...Array.from(nums), (b = 4)];
  eq(0, a);
  eq(4, b);
  return arrayEq([0,1,2,3,4], list);
});


test("mixed shorthand objects in array lists", function() {

  let arr = [
    {a:1},
    'b',
    {c:1}
  ];
  ok(arr.length === 3);
  ok(arr[2].c === 1);

  arr = [{b: 1, a: 2}, 100];
  eq(arr[1], 100);

  arr = [{a:0, b:1}, (1 + 1)];
  eq(arr[1], 2);

  arr = [{a:1}, 'a', {b:1}, 'b'];
  eq(arr.length, 4);
  eq(arr[2].b, 1);
  return eq(arr[3], 'b');
});


test("array splats with nested arrays", function() {
  const nonce = {};
  let a = [nonce];
  let list = [1, 2, ...Array.from(a)];
  eq(list[0], 1);
  eq(list[2], nonce);

  a = [[nonce]];
  list = [1, 2, ...Array.from(a)];
  return arrayEq(list, [1, 2, [nonce]]);
});

test("#1274: `[] = a()` compiles to `false` instead of `a()`", function() {
  let a = false;
  const fn = () => a = true;
  const array = fn();
  return ok(a);
});
// Assignment
// ----------

// * Assignment
// * Compound Assignment
// * Destructuring Assignment
// * Context Property (@) Assignment
// * Existential Assignment (?=)

test("context property assignment (using @)", function() {
  const nonce = {};
  const addMethod = function() {
    this.method = () => nonce;
    return this;
  };
  return eq(nonce, addMethod.call({}).method());
});

test("unassignable values", function() {
  const nonce = {};
  return Array.from(['', '""', '0', 'f()'].concat(CoffeeScript.RESERVED)).map((nonref) =>
    eq(nonce, ((() => { try { return CoffeeScript.compile(`${nonref} = v`); } catch (e) { return nonce; } })())));
});

// Compound Assignment

test("boolean operators", function() {
  let f;
  const nonce = {};

  let a  = 0;
  if (!a) { a = nonce; }
  eq(nonce, a);

  let b  = 1;
  if (!b) { b = nonce; }
  eq(1, b);

  let c = 0;
  if (c) { c = nonce; }
  eq(0, c);

  let d = 1;
  if (d) { d = nonce; }
  eq(nonce, d);

  // ensure that RHS is treated as a group
  let e = (f = false);
  if (e) { e = f || true; }
  return eq(false, e);
});

test("compound assignment as a sub expression", function() {
  let [a, b, c] = Array.from([1, 2, 3]);
  eq(6, (a + (b += c)));
  eq(1, a);
  eq(5, b);
  return eq(3, c);
});

// *note: this test could still use refactoring*
test("compound assignment should be careful about caching variables", function() {
  let base1, base2, base3, name, name1, name2;
  let count = 0;
  const list = [];

  if (!list[name = ++count]) { list[name] = 1; }
  eq(1, list[1]);
  eq(1, count);

  if (list[name1 = ++count] == null) { list[name1] = 2; }
  eq(2, list[2]);
  eq(2, count);

  if (list[name2 = count++]) { list[name2] = 6; }
  eq(6, list[2]);
  eq(3, count);

  var base = function() {
    ++count;
    return base;
  };

  if (!(base1 = base()).four) { base1.four = 4; }
  eq(4, base.four);
  eq(4, count);

  if ((base2 = base()).five == null) { base2.five = 5; }
  eq(5, base.five);
  eq(5, count);

  eq(5, (base3 = base()).five != null ? base3.five : (base3.five = 6));
  return eq(6, count);
});

test("compound assignment with implicit objects", function() {
  let obj = undefined;
  if (obj == null) { obj =
    {one: 1}; }

  eq(1, obj.one);

  if (obj) { obj = {two: 2}; }

  eq(undefined, obj.one);
  return eq(2, obj.two);
});

test("compound assignment (math operators)", function() {
  let num = 10;
  num -= 5;
  eq(5, num);

  num *= 10;
  eq(50, num);

  num /= 10;
  eq(5, num);

  num %= 3;
  return eq(2, num);
});

test("more compound assignment", function() {
  const a = {};
  let val = undefined;
  if (!val) { val = a; }
  if (!val) { val = true; }
  eq(a, val);

  const b = {};
  if (val) { val = true; }
  eq(val, true);
  if (val) { val = b; }
  eq(b, val);

  const c = {};
  val = null;
  if (val == null) { val = c; }
  if (val == null) { val = true; }
  return eq(c, val);
});


// Destructuring Assignment

test("empty destructuring assignment", function() {
  let ref;
  return ref = (undefined), ref;
});

test("chained destructuring assignments", function() {
  let b, c, nonce;
  const [a] = Array.from(({0: b} = ({'0': c} = [(nonce={})])));
  eq(nonce, a);
  eq(nonce, b);
  return eq(nonce, c);
});

test("variable swapping to verify caching of RHS values when appropriate", function() {
  let nonceA, nonceB, nonceC;
  let a = (nonceA = {});
  let b = (nonceB = {});
  let c = (nonceC = {});
  [a, b, c] = Array.from([b, c, a]);
  eq(nonceB, a);
  eq(nonceC, b);
  eq(nonceA, c);
  [a, b, c] = Array.from([b, c, a]);
  eq(nonceC, a);
  eq(nonceA, b);
  eq(nonceB, c);
  const fn = function() {
    let ref;
    return [a, b, c] = Array.from(ref = [b, c, a]), ref;
  };
  arrayEq([nonceA,nonceB,nonceC], fn());
  eq(nonceA, a);
  eq(nonceB, b);
  return eq(nonceC, c);
});

test("#713", function() {
  let a, b, c, d, nonceA, nonceB, ref;
  const nonces = [(nonceA={}),(nonceB={})];
  eq(nonces, ([a, b] = Array.from(ref = ([c, d] = Array.from(nonces), nonces)), ref));
  eq(nonceA, a);
  eq(nonceA, c);
  eq(nonceB, b);
  return eq(nonceB, d);
});

test("destructuring assignment with splats", function() {
  const a = {}; const b = {}; const c = {}; const d = {}; const e = {};
  const array = [a,b,c,d,e],
    x = array[0],
    adjustedLength = Math.max(array.length, 2),
    y = array.slice(1, adjustedLength - 1),
    z = array[adjustedLength - 1];
  eq(a, x);
  arrayEq([b,c,d], y);
  return eq(e, z);
});

test("deep destructuring assignment with splats", function() {
  const a={}; const b={}; const c={}; const d={}; const e={}; const f={}; const g={}; const h={}; const i={};
  const array = [a, [b, c, d, e], f, g, h, i],
    u = array[0],
    array1 = array[1],
    v = array1[0],
    adjustedLength = Math.max(array1.length, 2),
    w = array1.slice(1, adjustedLength - 1),
    x = array1[adjustedLength - 1],
    adjustedLength1 = Math.max(array.length, 3),
    y = array.slice(2, adjustedLength1 - 1),
    z = array[adjustedLength1 - 1];
  eq(a, u);
  eq(b, v);
  arrayEq([c,d], w);
  eq(e, x);
  arrayEq([f,g,h], y);
  return eq(i, z);
});

test("destructuring assignment with objects", function() {
  const a={}; const b={}; const c={};
  const obj = {a,b,c};
  const {a:x, b:y, c:z} = obj;
  eq(a, x);
  eq(b, y);
  return eq(c, z);
});

test("deep destructuring assignment with objects", function() {
  const a={}; const b={}; const c={}; const d={};
  const obj = {
    a,
    b: {
      'c': {
        d: [
          b,
          {e: c, f: d}
        ]
      }
    }
  };
  const w = obj.a, obj1 = obj['b'], obj2 = obj1.c, [x, {'f': z, e: y}] = Array.from(obj2.d);
  eq(a, w);
  eq(b, x);
  eq(c, y);
  return eq(d, z);
});

test("destructuring assignment with objects and splats", function() {
  const a={}; const b={}; const c={}; const d={};
  const obj = {a: {b: [a, b, c, d]}};
  const obj1 = obj.a, [y, ...z] = Array.from(obj1.b);
  eq(a, y);
  return arrayEq([b,c,d], z);
});

test("destructuring assignment against an expression", function() {
  const a={}; const b={};
  const [y, z] = Array.from(true ? [a, b] : [b, a]);
  eq(a, y);
  return eq(b, z);
});

test("bracket insertion when necessary", function() {
  let left;
  const [a] = Array.from((left = [0]) != null ? left : [1]);
  return eq(a, 0);
});

// for implicit destructuring assignment in comprehensions, see the comprehension tests

test("destructuring assignment with context (@) properties", function() {
  const a={}; const b={}; const c={}; const d={}; const e={};
  const obj = {
    fn() {
      const local = [a, {b, c}, d, e];
      return [this.a, {b: this.b, c: this.c}, this.d, this.e] = Array.from(local), local;
    }
  };
  for (key of ['a','b','c','d','e']) { eq(undefined, obj[key]); }
  obj.fn();
  eq(a, obj.a);
  eq(b, obj.b);
  eq(c, obj.c);
  eq(d, obj.d);
  return eq(e, obj.e);
});

test("#1024", function() {
  let ref;
  return eq(2 * (ref = 3 + 5, ref), 16);
});

test("#1005: invalid identifiers allowed on LHS of destructuring assignment", function() {
  let tSplat;
  const disallowed = ['eval', 'arguments'].concat(CoffeeScript.RESERVED);
  throws((() => CoffeeScript.compile(`[${disallowed.join(', ')}] = x`)), null, 'all disallowed');
  throws((() => CoffeeScript.compile(`[${disallowed.join('..., ')}...] = x`)), null, 'all disallowed as splats');
  let t = (tSplat = null);
  for (var v of Array.from(disallowed)) { // `class` by itself is an expression
    if (v !== 'class') {
      throws((() => CoffeeScript.compile(t)), null, (t = `[${v}] = x`));
      throws((() => CoffeeScript.compile(tSplat)), null, (tSplat = `[${v}...] = x`));
    }
  }
  return doesNotThrow(() =>
    (() => {
      const result1 = [];
      for (v of Array.from(disallowed)) {
        CoffeeScript.compile(`[a.${v}] = x`);
        CoffeeScript.compile(`[a.${v}...] = x`);
        CoffeeScript.compile(`[@${v}] = x`);
        result1.push(CoffeeScript.compile(`[@${v}...] = x`));
      }
      return result1;
    })()
  );
});

test("#2055: destructuring assignment with `new`", function() {
  const {length} = new Array;
  return eq(0, length);
});

test("#156: destructuring with expansion", function() {
  let lastButOne, second;
  const array = [1, 2, 3, 4, 5];
  let first = array[0], last = array[array.length - 1];
  eq(1, first);
  eq(5, last);
  lastButOne = array[array.length - 2], last = array[array.length - 1];
  eq(4, lastButOne);
  eq(5, last);
  first = array[0], second = array[1], last = array[array.length - 1];
  eq(2, second);
  last = 'strings as well -> x'['strings as well -> x'.length - 1];
  eq('x', last);
  throws((() => CoffeeScript.compile("[1, ..., 3]")),        null, "prohibit expansion outside of assignment");
  throws((() => CoffeeScript.compile("[..., a, b...] = c")), null, "prohibit expansion and a splat");
  return throws((() => CoffeeScript.compile("[...] = c")),          null, "prohibit lone expansion");
});


// Existential Assignment

test("existential assignment", function() {
  const nonce = {};
  let a = false;
  if (a == null) { a = nonce; }
  eq(false, a);
  let b = undefined;
  if (b == null) { b = nonce; }
  eq(nonce, b);
  let c = null;
  if (c == null) { c = nonce; }
  return eq(nonce, c);
});

test("#1627: prohibit conditional assignment of undefined variables", function() {
  throws((() => CoffeeScript.compile("x ?= 10")),        null, "prohibit (x ?= 10)");
  throws((() => CoffeeScript.compile("x ||= 10")),       null, "prohibit (x ||= 10)");
  throws((() => CoffeeScript.compile("x or= 10")),       null, "prohibit (x or= 10)");
  throws((() => CoffeeScript.compile("do -> x ?= 10")),  null, "prohibit (do -> x ?= 10)");
  throws((() => CoffeeScript.compile("do -> x ||= 10")), null, "prohibit (do -> x ||= 10)");
  throws((() => CoffeeScript.compile("do -> x or= 10")), null, "prohibit (do -> x or= 10)");
  doesNotThrow((() => CoffeeScript.compile("x = null; x ?= 10")),        "allow (x = null; x ?= 10)");
  doesNotThrow((() => CoffeeScript.compile("x = null; x ||= 10")),       "allow (x = null; x ||= 10)");
  doesNotThrow((() => CoffeeScript.compile("x = null; x or= 10")),       "allow (x = null; x or= 10)");
  doesNotThrow((() => CoffeeScript.compile("x = null; do -> x ?= 10")),  "allow (x = null; do -> x ?= 10)");
  doesNotThrow((() => CoffeeScript.compile("x = null; do -> x ||= 10")), "allow (x = null; do -> x ||= 10)");
  doesNotThrow((() => CoffeeScript.compile("x = null; do -> x or= 10")), "allow (x = null; do -> x or= 10)");

  throws((() => CoffeeScript.compile("-> -> -> x ?= 10")), null, "prohibit (-> -> -> x ?= 10)");
  return doesNotThrow((() => CoffeeScript.compile("x = null; -> -> -> x ?= 10")), "allow (x = null; -> -> -> x ?= 10)");
});

test("more existential assignment", function() {
  if (global.temp == null) { global.temp = 0; }
  eq(global.temp, 0);
  if (!global.temp) { global.temp = 100; }
  eq(global.temp, 100);
  return delete global.temp;
});

test("#1348, #1216: existential assignment compilation", function() {
  const nonce = {};
  let a = nonce;
  let b = (a != null ? a : (a = 0));
  eq(nonce, b);
  //the first ?= compiles into a statement; the second ?= compiles to a ternary expression
  eq(a != null ? a : (a = b != null ? b : (b = 1)), nonce);

  if (a) { if (a == null) { a = 2; } } else { a = 3; }
  return eq(a, nonce);
});

test("#1591, #1101: splatted expressions in destructuring assignment must be assignable", function() {
  const nonce = {};
  return Array.from(['', '""', '0', 'f()', '(->)'].concat(CoffeeScript.RESERVED)).map((nonref) =>
    eq(nonce, ((() => { try { return CoffeeScript.compile(`[${nonref}...] = v`); } catch (e) { return nonce; } })())));
});

test("#1643: splatted accesses in destructuring assignments should not be declared as variables", function() {
  let code, i, j;
  let e;
  const nonce = {};
  const accesses = ['o.a', 'o["a"]', '(o.a)', '(o.a).a', '@o.a', 'C::a', 'C::', 'f().a', 'o?.a', 'o?.a.b', 'f?().a'];
  for (let access of Array.from(accesses)) {
    const iterable = [1,2,3];
    for (j = 0; j < iterable.length; j++) { //position can matter
      i = iterable[j];
      code =
        `\
nonce = {}; nonce2 = {}; nonce3 = {};
@o = o = new (class C then a:{}); f = -> o
[${new Array(i).join('x,')}${access}...] = [${new Array(i).join('0,')}nonce, nonce2, nonce3]
unless ${access}[0] is nonce and ${access}[1] is nonce2 and ${access}[2] is nonce3 then throw new Error('[...]')\
`;
      eq(nonce, (!(() => { try { return CoffeeScript.run(code, {bare: true}); } catch (error) { e = error; return true; } })()) ? nonce : undefined);
    }
  }
  // subpatterns like `[[a]...]` and `[{a}...]`
  const subpatterns = ['[sub, sub2, sub3]', '{0: sub, 1: sub2, 2: sub3}'];
  return Array.from(subpatterns).map((subpattern) =>
    (() => {
      const result1 = [];
      const iterable1 = [1,2,3];
      for (j = 0; j < iterable1.length; j++) {
        i = iterable1[j];
        code =
          `\
nonce = {}; nonce2 = {}; nonce3 = {};
[${new Array(i).join('x,')}${subpattern}...] = [${new Array(i).join('0,')}nonce, nonce2, nonce3]
unless sub is nonce and sub2 is nonce2 and sub3 is nonce3 then throw new Error('[sub...]')\
`;
        result1.push(eq(nonce, (!(() => { try { return CoffeeScript.run(code, {bare: true}); } catch (error1) { e = error1; return true; } })()) ? nonce : undefined));
      }
      return result1;
    })());
});

test("#1838: Regression with variable assignment", function() {
  const name =
  'dave';

  return eq(name, 'dave');
});

test('#2211: splats in destructured parameters', function() {
  doesNotThrow(() => CoffeeScript.compile('([a...]) ->'));
  doesNotThrow(() => CoffeeScript.compile('([a...],b) ->'));
  doesNotThrow(() => CoffeeScript.compile('([a...],[b...]) ->'));
  throws(() => CoffeeScript.compile('([a...,[a...]]) ->'));
  return doesNotThrow(() => CoffeeScript.compile('([a...,[b...]]) ->'));
});

test('#2213: invocations within destructured parameters', function() {
  throws(() => CoffeeScript.compile('([a()])->'));
  throws(() => CoffeeScript.compile('([a:b()])->'));
  throws(() => CoffeeScript.compile('([a:b.c()])->'));
  throws(() => CoffeeScript.compile('({a()})->'));
  throws(() => CoffeeScript.compile('({a:b()})->'));
  return throws(() => CoffeeScript.compile('({a:b.c()})->'));
});

test('#2532: compound assignment with terminator', () =>
  doesNotThrow(() => CoffeeScript.compile(`\
a = "hello"
a +=
"
world
!
"\
`
  )
   )
);

test("#2613: parens on LHS of destructuring", function() {
  const a = {};
  [(a).b] = Array.from([1, 2, 3]);
  return eq(a.b, 1);
});

test("#2181: conditional assignment as a subexpression", function() {
  let a = false;
  false && (a || (a = true));
  eq(false, a);
  return eq(false, !(a || (a = true)));
});
// Boolean Literals
// ----------------

// TODO: add method invocation tests: true.toString() is "true"

test("#764 Booleans should be indexable", function() {
  const { toString } = Boolean.prototype;

  eq(toString, true['toString']);
  eq(toString, false['toString']);
  eq(toString, true['toString']);
  eq(toString, false['toString']);
  eq(toString, true['toString']);
  eq(toString, false['toString']);

  eq(toString, true.toString);
  eq(toString, false.toString);
  eq(toString, true.toString);
  eq(toString, false.toString);
  eq(toString, true.toString);
  return eq(toString, false.toString);
});
// Classes
// -------

// * Class Definition
// * Class Instantiation
// * Inheritance and Super

test("classes with a four-level inheritance chain", function() {

  let cls;
  class Base {
    func(string) {
      return `zero/${string}`;
    }

    static static(string) {
      return `static/${string}`;
    }
  }

  class FirstChild extends Base {
    func(string) {
      return super.func('one/') + string;
    }
  }

  const SecondChild = class extends FirstChild {
    func(string) {
      return super.func('two/') + string;
    }
  };

  const thirdCtor = function() {
    return this.array = [1, 2, 3];
  };

  class ThirdChild extends SecondChild {
    constructor() { {       // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }       let thisFn = (() => { return this; }).toString();       let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();       eval(`${thisName} = this;`);     }     thirdCtor.call(this); }

    // Gratuitous comment for testing.
    func(string) {
      return super.func('three/') + string;
    }
  }

  let result = (new ThirdChild).func('four');

  ok(result === 'zero/one/two/three/four');
  ok(Base.static('word') === 'static/word');

  (cls = FirstChild).prototype.func = function(string) {
    return cls.prototype.__proto__.func.call(this, 'one/').length + string;
  };

  result = (new ThirdChild).func('four');

  ok(result === '9two/three/four');

  return ok((new ThirdChild).array.join(' ') === '1 2 3');
});


test("constructors with inheritance and super", function() {

  const identity = f => f;

  class TopClass {
    constructor(arg) {
      this.prop = `top-${arg}`;
    }
  }

  class SuperClass extends TopClass {
    constructor(arg) {
      identity(super(`super-${arg}`));
    }
  }

  class SubClass extends SuperClass {
    constructor() {
      identity(super('sub'));
    }
  }

  return ok((new SubClass).prop === 'top-super-sub');
});


test("Overriding the static property new doesn't clobber Function::new", function() {

  class OneClass {
    static initClass() {
      this.new = 'new';
      this.prototype.function = 'function';
    }
    constructor(name) { this.name = name; }
  }
  OneClass.initClass();

  class TwoClass extends OneClass {}
  delete TwoClass.new;

  Function.prototype.new = function() { return new (this)(...arguments); };

  ok((TwoClass.new('three')).name === 'three');
  ok((new OneClass).function === 'function');
  ok(OneClass.new === 'new');

  return delete Function.prototype.new;
});


test("basic classes, again, but in the manual prototype style", function() {

  let cls, cls1, cls2;
  const Base = function() {};
  Base.prototype.func = string => `zero/${string}`;
  Base.prototype['func-func'] = string => `dynamic-${string}`;

  const FirstChild = function() {};
  const SecondChild = function() {};
  const ThirdChild = function() {
    this.array = [1, 2, 3];
    return this;
  };

  __extends__(ThirdChild, __extends__(SecondChild, __extends__(FirstChild, Base)));

  (cls = FirstChild).prototype.func = function(string) {
    return cls.prototype.__proto__.func.call(this, 'one/') + string;
  };

  (cls1 = SecondChild).prototype.func = function(string) {
    return cls1.prototype.__proto__.func.call(this, 'two/') + string;
  };

  (cls2 = ThirdChild).prototype.func = function(string) {
    return cls2.prototype.__proto__.func.call(this, 'three/') + string;
  };

  const result = (new ThirdChild).func('four');

  ok(result === 'zero/one/two/three/four');

  return ok((new ThirdChild)['func-func']('thing') === 'dynamic-thing');
});


test("super with plain ol' prototypes", function() {

  let cls, cls1;
  const TopClass = function() {};
  TopClass.prototype.func = arg => `top-${arg}`;

  const SuperClass = function() {};
  __extends__(SuperClass, TopClass);
  (cls = SuperClass).prototype.func = function(arg) {
    return cls.prototype.__proto__.func.call(this, `super-${arg}`);
  };

  const SubClass = function() {};
  __extends__(SubClass, SuperClass);
  (cls1 = SubClass).prototype.func = function() {
    return cls1.prototype.__proto__.func.call(this, 'sub');
  };

  return eq((new SubClass).func(), 'top-super-sub');
});


test("'@' referring to the current instance, and not being coerced into a call", function() {

  class ClassName {
    amI() {
      return this instanceof ClassName;
    }
  }

  const obj = new ClassName;
  return ok(obj.amI());
});


test("super() calls in constructors of classes that are defined as object properties", function() {

  class Hive {
    constructor(name) { this.name = name; }
  }

  Hive.Bee = class Bee extends Hive {
    constructor(name) { super(...arguments); }
  };

  const maya = new Hive.Bee('Maya');
  return ok(maya.name === 'Maya');
});


test("classes with JS-keyword properties", function() {

  class Class {
    static initClass() {
      this.prototype.class = 'class';
    }
    name() { return this.class; }
  }
  Class.initClass();

  const instance = new Class;
  ok(instance.class === 'class');
  return ok(instance.name() === 'class');
});


test("Classes with methods that are pre-bound to the instance, or statically, to the class", function() {

  class Dog {
    static initClass() {
  
      this.static = () => {
        return new (this)('Dog');
      };
    }
    constructor(name) {
      this.bark = this.bark.bind(this);
      this.name = name;
    }

    bark() {
      return `${this.name} woofs!`;
    }
  }
  Dog.initClass();

  const spark = new Dog('Spark');
  const fido  = new Dog('Fido');
  fido.bark = spark.bark;

  ok(fido.bark() === 'Spark woofs!');

  const obj = {func: Dog.static};

  return ok(obj.func().name === 'Dog');
});


test("a bound function in a bound function", function() {

  class Mini {
    constructor() {
      this.generate = this.generate.bind(this);
    }

    static initClass() {
      this.prototype.num = 10;
    }
    generate() {
      return [1, 2, 3].map((i) =>
        () => {
          return this.num;
        });
    }
  }
  Mini.initClass();

  const m = new Mini;
  return eq((Array.from(m.generate()).map((func) => func())).join(' '), '10 10 10');
});


test("contructor called with varargs", function() {

  class Connection {
    constructor(one, two, three) {
      [this.one, this.two, this.three] = Array.from([one, two, three]);
    }

    out() {
      return `${this.one}-${this.two}-${this.three}`;
    }
  }

  const list = [3, 2, 1];
  const conn = new Connection(...Array.from(list || []));
  ok(conn instanceof Connection);
  return ok(conn.out() === '3-2-1');
});


test("calling super and passing along all arguments", function() {

  class Parent {
    method(...args) { return this.args = args; }
  }

  class Child extends Parent {
    method() { return super.method(...arguments); }
  }

  const c = new Child;
  c.method(1, 2, 3, 4);
  return ok(c.args.join(' ') === '1 2 3 4');
});


test("classes wrapped in decorators", function() {

  let Test;
  const func = function(klass) {
    klass.prototype.prop = 'value';
    return klass;
  };

  func(Test = (function() {
    Test = class Test {
      static initClass() {
        this.prototype.prop2 = 'value2';
      }
    };
    Test.initClass();
    return Test;
  })()
  );

  ok((new Test).prop  === 'value');
  return ok((new Test).prop2 === 'value2');
});


test("anonymous classes", function() {

  const obj = {
    klass: class {
      method() { return 'value'; }
    }
  };

  const instance = new obj.klass;
  return ok(instance.method() === 'value');
});


test("Implicit objects as static properties", function() {

  class Static {
    static initClass() {
      this.static = {
        one: 1,
        two: 2
      };
    }
  }
  Static.initClass();

  ok(Static.static.one === 1);
  return ok(Static.static.two === 2);
});


test("nothing classes", function() {

  const c = class {};
  return ok(c instanceof Function);
});


test("classes with static-level implicit objects", function() {

  class A {
    static initClass() {
      this.static = {one: 1};
      this.prototype.two = 2;
    }
  }
  A.initClass();

  class B {
    static initClass() {
      this.static = { one: 1,
      two: 2
    };
    }
  }
  B.initClass();

  eq(A.static.one, 1);
  eq(A.static.two, undefined);
  eq((new A).two, 2);

  eq(B.static.one, 1);
  eq(B.static.two, 2);
  return eq((new B).two, undefined);
});


test("classes with value'd constructors", function() {

  let counter = 0;
  const classMaker = function() {
    const inner = ++counter;
    return function() {
      return this.value = inner;
    };
  };

  let createOne = undefined;
  class One {
    static initClass() {
      createOne = classMaker();
    }
    constructor() {
      return createOne.apply(this, arguments);
    }
  }
  One.initClass();

  let createTwo = undefined;
  class Two {
    static initClass() {
      createTwo = classMaker();
    }
    constructor() {
      return createTwo.apply(this, arguments);
    }
  }
  Two.initClass();

  eq((new One).value, 1);
  eq((new Two).value, 2);
  eq((new One).value, 1);
  return eq((new Two).value, 2);
});


test("executable class bodies", function() {

  class A {
    static initClass() {
      if (true) {
        this.prototype.b = 'b';
      } else {
        this.prototype.c = 'c';
      }
    }
  }
  A.initClass();

  const a = new A;

  eq(a.b, 'b');
  return eq(a.c, undefined);
});


test("#2502: parenthesizing inner object values", function() {

  class A {
    static initClass() {
      this.prototype.category =  ({type: 'string'});
      this.prototype.sections =  ({type: 'number', default: 0});
    }
  }
  A.initClass();

  eq((new A).category.type, 'string');

  return eq((new A).sections.default, 0);
});


test("conditional prototype property assignment", function() {
  const debug = false;

  class Person {
    static initClass() {
      if (debug) {
        this.prototype.age = () => 10;
      } else {
        this.prototype.age = () => 20;
      }
    }
  }
  Person.initClass();

  return eq((new Person).age(), 20);
});


test("mild metaprogramming", function() {

  class Base {
    static attr(name) {
      return this.prototype[name] = function(val) {
        if (arguments.length > 0) {
          return this[`_${name}`] = val;
        } else {
          return this[`_${name}`];
        }
      };
    }
  }

  class Robot extends Base {
    static initClass() {
      this.attr('power');
      this.attr('speed');
    }
  }
  Robot.initClass();

  const robby = new Robot;

  ok(robby.power() === undefined);

  robby.power(11);
  robby.speed(Infinity);

  eq(robby.power(), 11);
  return eq(robby.speed(), Infinity);
});


test("namespaced classes do not reserve their function name in outside scope", function() {

  const one = {};
  const two = {};

  let Cls = (one.Klass = class Klass {
    static initClass() {
      this.label = "one";
    }
  });
  Cls.initClass();

  Cls = (two.Klass = class Klass {
    static initClass() {
      this.label = "two";
    }
  });
  Cls.initClass();

  eq(typeof Klass, 'undefined');
  eq(one.Klass.label, 'one');
  return eq(two.Klass.label, 'two');
});


test("nested classes", function() {

  class Outer {
    static initClass() {
  
      this.Inner = class Inner {
        constructor() {
          this.label = 'inner';
        }
      };
    }
    constructor() {
      this.label = 'outer';
    }
  }
  Outer.initClass();

  eq((new Outer).label, 'outer');
  return eq((new Outer.Inner).label, 'inner');
});


test("variables in constructor bodies are correctly scoped", function() {

  var A = (function() {
    let x = undefined;
    let y = undefined;
    A = class A {
      static initClass() {
        x = 1;
        y = 2;
      }
      constructor() {
        x = 10;
        y = 20;
      }
      captured() {
        return {x, y};
      }
    };
    A.initClass();
    return A;
  })();

  const a = new A;
  eq(a.captured().x, 10);
  return eq(a.captured().y, 2);
});


test("Issue #924: Static methods in nested classes", function() {

  class A {
    static initClass() {
      this.B = class {
        static c() { return 5; }
      };
    }
  }
  A.initClass();

  return eq(A.B.c(), 5);
});


test("`class extends this`", function() {

  class A {
    func() { return 'A'; }
  }

  let B = null;
  const makeClass = function() {
    return B = class extends this {
      func() { return super.func(...arguments) + ' B'; }
    };
  };

  makeClass.call(A);

  return eq((new B()).func(), 'A B');
});


test("ensure that constructors invoked with splats return a new object", function() {

  const args = [1, 2, 3];
  let Type = function(args1) {
    this.args = args1;
  };
  const type = new Type(args);

  ok(type && type instanceof Type);
  ok(type.args && type.args instanceof Array);
  for (let i = 0; i < type.args.length; i++) { const v = type.args[i]; ok(v === args[i]); }

  const Type1 = function(a1, b1, c1) {
    this.a = a1;
    this.b = b1;
    this.c = c1;
  };
  const type1 = new Type1(...Array.from(args || []));

  ok(type1 instanceof   Type1);
  eq(type1.constructor, Type1);
  ok((type1.a === args[0]) && (type1.b === args[1]) && (type1.c === args[2]));

  // Ensure that constructors invoked with splats cache the function.
  let called = 0;
  const get = function() { if (called++) { return false; } else { return (Type = class Type {}); } };
  return new get()(...Array.from(args || []));
});

test("`new` shouldn't add extra parens", () => ok(new Date().constructor === Date));


test("`new` works against bare function", () =>

  eq(Date, new (function() {
    eq(this, new (() => this));
    return Date;
  })
  )
);


test("#1182: a subclass should be able to set its constructor to an external function", function() {
  const ctor = function() {
    return this.val = 1;
  };
  class A {}
  let createB = undefined;
  class B extends A {
    static initClass() {
      createB = ctor;
    }
    constructor() {
      {
        // Hack: trick Babel/TypeScript into allowing this before super.
        if (false) { super(); }
        let thisFn = (() => { return this; }).toString();
        let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
        eval(`${thisName} = this;`);
      }
      return createB.apply(this, arguments);
    }
  }
  B.initClass();
  return eq((new B).val, 1);
});

test("#1182: external constructors continued", function() {
  const ctor = function() {};
  class A {}
  let createB = undefined;
  class B extends A {
    static initClass() {
      createB = ctor;
    }
    method() {}
    constructor() {
      {
        // Hack: trick Babel/TypeScript into allowing this before super.
        if (false) { super(); }
        let thisFn = (() => { return this; }).toString();
        let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
        eval(`${thisName} = this;`);
      }
      return createB.apply(this, arguments);
    }
  }
  B.initClass();
  return ok(B.prototype.method);
});

test("#1313: misplaced __extends", function() {
  const nonce = {};
  class A {}
  class B extends A {
    static initClass() {
      this.prototype.prop = nonce;
    }
    constructor() {
      {
        // Hack: trick Babel/TypeScript into allowing this before super.
        if (false) { super(); }
        let thisFn = (() => { return this; }).toString();
        let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
        eval(`${thisName} = this;`);
      }
    }
  }
  B.initClass();
  return eq(nonce, B.prototype.prop);
});

test("#1182: execution order needs to be considered as well", function() {
  let B;
  let counter = 0;
  const makeFn = function(n) { eq(n, ++counter); return function() {}; };
  return B = (function() {
    let createB = undefined;
    B = class B extends (makeFn(1)) {
      static initClass() {
        this.B = makeFn(2);
        createB = makeFn(3);
      }
      constructor() {
        {
          // Hack: trick Babel/TypeScript into allowing this before super.
          if (false) { super(); }
          let thisFn = (() => { return this; }).toString();
          let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
          eval(`${thisName} = this;`);
        }
        return createB.apply(this, arguments);
      }
    };
    B.initClass();
    return B;
  })();
});

test("#1182: external constructors with bound functions", function() {
  const fn = function() {
    ({one: 1});
    return this;
  };
  class B {}
  let createA = undefined;
  class A {
    static initClass() {
      createA = fn;
    }
    constructor() {
      this.method = this.method.bind(this);
      return createA.apply(this, arguments);
    }
    method() { return this instanceof A; }
  }
  A.initClass();
  return ok((new A).method.call(new B));
});

test("#1372: bound class methods with reserved names", function() {
  class C {
    constructor() {
      this.delete = this.delete.bind(this);
    }

    delete() {}
  }
  return ok(C.prototype.delete);
});

test("#1380: `super` with reserved names", function() {
  class C {
    do() { return super.do(...arguments); }
  }
  ok(C.prototype.do);

  class B {
    0() { return super[0](...arguments); }
  }
  return ok(B.prototype[0]);
});

test("#1464: bound class methods should keep context", function() {
  const nonce  = {};
  const nonce2 = {};
  class C {
    static initClass() {
      this.boundStaticColon = () => new (this)(nonce);
      this.boundStaticEqual= () => new (this)(nonce2);
    }
    constructor(id1) {
      this.id = id1;
    }
  }
  C.initClass();
  eq(nonce,  C.boundStaticColon().id);
  return eq(nonce2, C.boundStaticEqual().id);
});

test("#1009: classes with reserved words as determined names", () => (function() {
  eq('function', typeof (this.for = class _for {}));
  ok(!/\beval\b/.test((this.eval = class _eval {}).toString()));
  return ok(!/\barguments\b/.test((this.arguments = class _arguments {}).toString()));
}).call({}) );

test("#1482: classes can extend expressions", function() {
  const id = x => x;
  const nonce = {};
  class A {
    static initClass() {
      this.prototype.nonce = nonce;
    }
  }
  A.initClass();
  class B extends id(A) {}
  return eq(nonce, (new B).nonce);
});

test("#1598: super works for static methods too", function() {

  class Parent {
    method() {
      return 'NO';
    }
    static method() {
      return 'yes';
    }
  }

  class Child extends Parent {
    static method() {
      return `pass? ${super.method(...arguments)}`;
    }
  }

  return eq(Child.method(), 'pass? yes');
});

test("#1842: Regression with bound functions within bound class methods", function() {

  class Store {
    static initClass() {
      this.bound = () => {
        return (() => {
          return eq(this, Store);
        })();
      };
    }
  }
  Store.initClass();

  Store.bound();

  // And a fancier case:

  Store = class Store {
    constructor() {
      this.instance = this.instance.bind(this);
    }

    static initClass() {
  
      eq(this, Store);
  
      this.bound = () => {
        return (() => {
          return eq(this, Store);
        })();
      };
    }

    static unbound() {
      return eq(this, Store);
    }

    instance() {
      return ok(this instanceof Store);
    }
  };
  Store.initClass();

  Store.bound();
  Store.unbound();
  return (new Store).instance();
});

test("#1876: Class @A extends A", function() {
  class A {}
  this.A = class A extends A {};

  return ok((new this.A) instanceof A);
});

test("#1813: Passing class definitions as expressions", function() {
  let A, B;
  const ident = x => x;

  let result = ident(A = (function() {
    let x = undefined;
    A = class A {
      static initClass() {
        x = 1;
      }
    };
    A.initClass();
    return A;
  })());

  eq(result, A);

  result = ident(B = (function() {
    let x = undefined;
    B = class B extends A {
      static initClass() {
        x = 1;
      }
    };
    B.initClass();
    return B;
  })()
  );

  return eq(result, B);
});

test("#1966: external constructors should produce their return value", function() {
  const ctor = () => ({});
  let createA = undefined;
  class A {
    static initClass() {
      createA = ctor;
    }
    constructor() {
      return createA.apply(this, arguments);
    }
  }
  A.initClass();
  return ok(!((new A) instanceof A));
});

test("#1980: regression with an inherited class with static function members", function() {

  class A {}

  class B extends A {
    static initClass() {
      this.static = () => 'value';
    }
  }
  B.initClass();

  return eq(B.static(), 'value');
});

test("#1534: class then 'use strict'", function() {
  // [14.1 Directive Prologues and the Use Strict Directive](http://es5.github.com/#x14.1)
  const nonce = {};
  const error = 'do -> ok this';
  const strictTest = `do ->'use strict';${error}`;
  if (((() => { try { return CoffeeScript.run(strictTest, {bare: true}); } catch (e) { return nonce; } })()) !== nonce) { return; }

  throws(() => CoffeeScript.run(`class then 'use strict';${error}`, {bare: true}));
  doesNotThrow(() => CoffeeScript.run(`class then ${error}`, {bare: true}));
  doesNotThrow(() => CoffeeScript.run(`class then ${error};'use strict'`, {bare: true}));

  // comments are ignored in the Directive Prologue
  const comments = [`\
class
  ### comment ###
  'use strict'
  ${error}`,
  `\
class
  ### comment 1 ###
  ### comment 2 ###
  'use strict'
  ${error}`,
  `\
class
  ### comment 1 ###
  ### comment 2 ###
  'use strict'
  ${error}
  ### comment 3 ###`
  ];
  for (var comment of Array.from(comments)) { throws((() => CoffeeScript.run(comment, {bare: true}))); }

  // [ES5 §14.1](http://es5.github.com/#x14.1) allows for other directives
  const directives = [`\
class
  'directive 1'
  'use strict'
  ${error}`,
  `\
class
  'use strict'
  'directive 2'
  ${error}`,
  `\
class
  ### comment 1 ###
  'directive 1'
  'use strict'
  ${error}`,
  `\
class
  ### comment 1 ###
  'directive 1'
  ### comment 2 ###
  'use strict'
  ${error}`
  ];
  return Array.from(directives).map((directive) => throws((() => CoffeeScript.run(directive, {bare: true}))));
});

test("#2052: classes should work in strict mode", function() {
  try {
    return (function() {
      'use strict';
      let A;
      return (A = class A {});
    })();
  } catch (e) {
    return ok(false);
  }
});

test("directives in class with extends ", function() {
  const strictTest = `\
class extends Object
  ### comment ###
  'use strict'
  do -> eq this, undefined\
`;
  return CoffeeScript.run(strictTest, {bare: true});
});

test("#2630: class bodies can't reference arguments", () =>
  throws(() => CoffeeScript.compile('class Test then arguments'))
);

test("#2319: fn class n extends o.p [INDENT] x = 123", function() {
  let OneKeeper;
  const first = function() {};

  const base = {onebase() {}};

  first(OneKeeper = (function() {
    let one = undefined;
    OneKeeper = class OneKeeper extends base.onebase {
      static initClass() {
        one = 1;
      }
      one() { return one; }
    };
    OneKeeper.initClass();
    return OneKeeper;
  })()
  );

  return eq(new OneKeeper().one(), 1);
});


test("#2599: other typed constructors should be inherited", function() {
  class Base {
    constructor() { return {}; }
  }

  class Derived extends Base {}

  ok(!((new Derived) instanceof Derived));
  ok(!((new Derived) instanceof Base));
  return ok(!((new Base) instanceof Base));
});

test("#2359: extending native objects that use other typed constructors requires defining a constructor", function() {
  class BrokenArray extends Array {
    method() { return 'no one will call me'; }
  }

  const brokenArray = new BrokenArray;
  ok(!(brokenArray instanceof BrokenArray));
  ok(typeof brokenArray.method === 'undefined');

  class WorkingArray extends Array {
    constructor() { super(...arguments); }
    method() { return 'yes!'; }
  }

  const workingArray = new WorkingArray;
  ok(workingArray instanceof WorkingArray);
  return eq('yes!', workingArray.method());
});


test("#2782: non-alphanumeric-named bound functions", function() {
  class A {
    constructor() {
      this['b:c'] = this['b:c'].bind(this);
    }

    'b:c'() {
      return 'd';
    }
  }

  return eq((new A)['b:c'](), 'd');
});


test("#2781: overriding bound functions", function() {
  class A {
    constructor() {
      this.b = this.b.bind(this);
    }

    a() {
        return this.b();
      }
    b() {
        return 1;
      }
  }

  class B extends A {
    constructor(...args) {
      {
        // Hack: trick Babel/TypeScript into allowing this before super.
        if (false) { super(); }
        let thisFn = (() => { return this; }).toString();
        let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
        eval(`${thisName} = this;`);
      }
      this.b = this.b.bind(this);
      super(...args);
    }

    b() {
        return 2;
      }
  }

  let { b } = (new A);
  eq(b(), 1);

  ({ b } = (new B));
  return eq(b(), 2);
});


test("#2791: bound function with destructured argument", function() {
  class Foo {
    constructor() {
      this.method = this.method.bind(this);
    }

    method({a}) { return 'Bar'; }
  }

  return eq((new Foo).method({a: 'Bar'}), 'Bar');
});


test("#2796: ditto, ditto, ditto", function() {
  let answer = null;

  const outsideMethod = func => func.call({message: 'wrong!'});

  class Base {
    constructor() {
      this.echo = this.echo.bind(this);
      this.message = 'right!';
      outsideMethod(this.echo);
    }

    echo() {
      return answer = this.message;
    }
  }

  new Base;
  return eq(answer, 'right!');
});

test("#3063: Class bodies cannot contain pure statements", () =>
  throws(() => CoffeeScript.compile(`\
class extends S
  return if S.f
  @f: => this\
`
  )
   )
);

test("#2949: super in static method with reserved name", function() {
  class Foo {
    static static() { return 'baz'; }
  }

  class Bar extends Foo {
    static static() { return super.static(...arguments); }
  }

  return eq(Bar.static(), 'baz');
});

test("#3232: super in static methods (not object-assigned)", function() {
  class Foo {
    static baz() { return true; }
    static qux() { return true; }
  }

  class Bar extends Foo {
    static baz() { return super.baz(...arguments); }
    static qux() { return super.qux(...arguments); }
  }

  ok(Bar.baz());
  return ok(Bar.qux());
});
// Cluster Module
// ---------

if (typeof testingBrowser !== 'undefined' && testingBrowser !== null) { return; }

const cluster = require('cluster');

if (cluster.isMaster) {
  test("#2737 - cluster module can spawn workers from a coffeescript process", function() {
    cluster.once('exit', (worker, code) => eq(code, 0));

    return cluster.fork();
  });
} else {
  process.exit(0);
}
// Comments
// --------

// * Single-Line Comments
// * Block Comments

// Note: awkward spacing seen in some tests is likely intentional.

test("comments in objects", function() {
  const obj1 = {
  // comment
    // comment
      // comment
    one: 1,
  // comment
    two: 2
      // comment
  };

  ok(Object.prototype.hasOwnProperty.call(obj1,'one'));
  eq(obj1.one, 1);
  ok(Object.prototype.hasOwnProperty.call(obj1,'two'));
  return eq(obj1.two, 2);
});

test("comments in YAML-style objects", function() {
  const obj2 = {
  // comment
    // comment
      // comment
    three: 3,
  // comment
    four: 4
  };
      // comment

  ok(Object.prototype.hasOwnProperty.call(obj2,'three'));
  eq(obj2.three, 3);
  ok(Object.prototype.hasOwnProperty.call(obj2,'four'));
  return eq(obj2.four, 4);
});

test("comments following operators that continue lines", function() {
  const sum =
    1 +
    1 + // comment
    1;
  return eq(3, sum);
});

test("comments in functions", function() {
  const fn = function() {
  // comment
    false;
    false;   // comment
    false;
    // comment

  // comment
    return true;
  };

  ok(fn());

  const fn2 = () => //comment
    fn()
  ;
    // comment

  return ok(fn2());
});

test("trailing comment before an outdent", function() {
  const nonce = {};
  const fn3 = function() {
    if (true) {
      undefined; // comment
    }
    return nonce;
  };

  return eq(nonce, fn3());
});

test("comments in a switch", function() {
  const nonce = {};
  const result = (() => { switch (nonce) { //comment
    // comment
    case false: return undefined;
    // comment
    case null: //comment
      return undefined;
    default: return nonce; // comment
  } })();

  return eq(nonce, result);
});

test("comment with conditional statements", function() {
  const nonce = {};
  const result = false ? // comment
    undefined
  //comment
  : // comment
    nonce;
    // comment
  return eq(nonce, result);
});

test("spaced comments with conditional statements", function() {
  const nonce = {};
  const result = false ?
    undefined

  // comment
  : false ?
    undefined

  // comment
  :
    nonce;

  return eq(nonce, result);
});


// Block Comments

/*
  This is a here-comment.
  Kind of like a heredoc.
*/

test("block comments in objects", function() {
  const a = {};
  const b = {};
  const obj = {
    a,
    /*
    comment
    */
    b
  };

  eq(a, obj.a);
  return eq(b, obj.b);
});

test("block comments in YAML-style", function() {
  const a = {};
  const b = {};
  const obj = {
    a,
    /*
    comment
    */
    b
  };

  eq(a, obj.a);
  return eq(b, obj.b);
});


test("block comments in functions", function() {
  const nonce = {};

  const fn1 = () => true;

  ok(fn1());

  const fn2 =  () =>
    /*
    block comment
    */
    nonce
  ;

  eq(nonce, fn2());

  const fn3 = () => nonce;
  /*
  block comment
  */

  eq(nonce, fn3());

  const fn4 = function() {
    let one;
    return one = function() {
      /*
        block comment
      */
      let two;
      return two = function() {
        let three;
        return three = () => nonce;
      };
    };
  };

  return eq(nonce, fn4()()()());
});

test("block comments inside class bodies", function() {
  class A {
    a() {}

    /*
    Comment
    */
    b() {}
  }

  ok(A.prototype.b instanceof Function);

  class B {
    /*
    Comment
    */
    a() {}
    b() {}
  }

  return ok(B.prototype.a instanceof Function);
});

test("#2037: herecomments shouldn't imply line terminators", () => ((() => /* */ fail ))());

test("#2916: block comment before implicit call with implicit object", function() {
  const fn = obj => ok(obj.a);
  /* */
  return fn({
    a: true});
});

test("#3132: Format single-line block comment nicely", function() {
  const input = `\
### Single-line block comment without additional space here => ###`;

  const result = `\

/* Single-line block comment without additional space here => */

\
`;
  return eq(CoffeeScript.compile(input, {bare: true}), result);
});

test("#3132: Format multi-line block comment nicely", function() {
  const input = `\
###
# Multi-line
# block
# comment
###`;

  const result = `\

/*
 * Multi-line
 * block
 * comment
 */

\
`;
  return eq(CoffeeScript.compile(input, {bare: true}), result);
});

test("#3132: Format simple block comment nicely", function() {
  const input = `\
###
No
Preceding hash
###`;

  const result = `\

/*
No
Preceding hash
 */

\
`;

  return eq(CoffeeScript.compile(input, {bare: true}), result);
});

test("#3132: Format indented block-comment nicely", function() {
  const input = `\
fn = () ->
  ###
  # Indented
  Multiline
  ###
  1`;

  const result = `\
var fn;

fn = function() {

  /*
   * Indented
  Multiline
   */
  return 1;
};
\
`;
  return eq(CoffeeScript.compile(input, {bare: true}), result);
});

// Although adequately working, block comment-placement is not yet perfect.
// (Considering a case where multiple variables have been declared …)
test("#3132: Format jsdoc-style block-comment nicely", function() {
  const input = `\
###*
# Multiline for jsdoc-"@doctags"
#
# @type {Function}
###
fn = () -> 1\
`;

  const result = `\

/**
 * Multiline for jsdoc-"@doctags"
 *
 * @type {Function}
 */
var fn;

fn = function() {
  return 1;
};
\
`;
  return eq(CoffeeScript.compile(input, {bare: true}), result);
});

// Although adequately working, block comment-placement is not yet perfect.
// (Considering a case where multiple variables have been declared …)
test("#3132: Format hand-made (raw) jsdoc-style block-comment nicely", function() {
  const input = `\
###*
 * Multiline for jsdoc-"@doctags"
 *
 * @type {Function}
###
fn = () -> 1\
`;

  const result = `\

/**
 * Multiline for jsdoc-"@doctags"
 *
 * @type {Function}
 */
var fn;

fn = function() {
  return 1;
};
\
`;
  return eq(CoffeeScript.compile(input, {bare: true}), result);
});

// Although adequately working, block comment-placement is not yet perfect.
// (Considering a case where multiple variables have been declared …)
test("#3132: Place block-comments nicely", function() {
  const input = `\
###*
# A dummy class definition
#
# @class
###
class DummyClass

  ###*
  # @constructor
  ###
  constructor: ->

  ###*
  # Singleton reference
  #
  # @type {DummyClass}
  ###
  @instance = new DummyClass()
\
`;

  const result = `\

/**
 * A dummy class definition
 *
 * @class
 */
var DummyClass;

DummyClass = (function() {

  /**
   * @constructor
   */
  function DummyClass() {}


  /**
   * Singleton reference
   *
   * @type {DummyClass}
   */

  DummyClass.instance = new DummyClass();

  return DummyClass;

})();
\
`;
  return eq(CoffeeScript.compile(input, {bare: true}), result);
});
// Compilation
// -----------

// helper to assert that a string should fail compilation
let cantCompile = code => throws(() => CoffeeScript.compile(code));


test("ensure that carriage returns don't break compilation on Windows", () => doesNotThrow(() => CoffeeScript.compile('one\r\ntwo', {bare: true})));

test("#3089 - don't mutate passed in options to compile", function() {
  const opts = {};
  CoffeeScript.compile('1 + 1', opts);
  return ok(!opts.scope);
});

test("--bare", function() {
  eq(-1, CoffeeScript.compile('x = y', {bare: true}).indexOf('function'));
  return ok('passed' === CoffeeScript.eval('"passed"', {bare: true, filename: 'test'}));
});

test("header (#1778)", function() {
  const header = `// Generated by CoffeeScript ${CoffeeScript.VERSION}\n`;
  return eq(0, CoffeeScript.compile('x = y', {header: true}).indexOf(header));
});

test("header is disabled by default", function() {
  const header = `// Generated by CoffeeScript ${CoffeeScript.VERSION}\n`;
  return eq(-1, CoffeeScript.compile('x = y').indexOf(header));
});

test("multiple generated references", function() {
  let middle;
  const a = {b: []};
  a.b[true] = function() { return this === a.b; };
  let c = 0;
  const d = [];
  return ok(a.b[0<(middle = ++c) && middle<2](...Array.from(d || [])));
});

test("splat on a line by itself is invalid", () => cantCompile("x 'a'\n...\n"));

test("Issue 750", function() {

  cantCompile('f(->');

  cantCompile('a = (break)');

  cantCompile('a = (return 5 for item in list)');

  cantCompile('a = (return 5 while condition)');

  return cantCompile('a = for x in y\n  return 5');
});

test("Issue #986: Unicode identifiers", function() {
  const λ = 5;
  return eq(λ, 5);
});

test("don't accidentally stringify keywords", () => ok((function() { return this === 'this'; })() === false));

test("#1026", () =>
  cantCompile(`\
if a
  b
else
  c
else
  d\
`
  )
);

test("#1050", () => cantCompile("### */ ###"));

test("#1273: escaping quotes at the end of heredocs", function() {
  cantCompile('"""\\"""'); // """\"""
  return cantCompile('"""\\\\\\"""');
}); // """\\\"""

test("#1106: __proto__ compilation", function() {
  const object = eq;
  this["__proto__"] = true;
  return ok(__proto__);
});

test("reference named hasOwnProperty", () => CoffeeScript.compile('hasOwnProperty = 0; a = 1'));

test("#1055: invalid keys in real (but not work-product) objects", () => cantCompile("@key: value"));

test("#1066: interpolated strings are not implicit functions", () => cantCompile('"int#{er}polated" arg'));

test("#2846: while with empty body", () => CoffeeScript.compile('while 1 then', {sourceMap: true}));

test("#2944: implicit call with a regex argument", () => CoffeeScript.compile('o[key] /regex/'));

test("#3001: `own` shouldn't be allowed in a `for`-`in` loop", () => cantCompile("a for own b in c"));

test("#2994: single-line `if` requires `then`", () => cantCompile("if b else x"));
// Comprehensions
// --------------

// * Array Comprehensions
// * Range Comprehensions
// * Object Comprehensions
// * Implicit Destructuring Assignment
// * Comprehensions with Nonstandard Step

// TODO: refactor comprehension tests

test("Basic array comprehensions.", function() {

  let n;
  const nums    = ((() => {
    const result1 = [];
    for (n of [1, 2, 3]) {       if (n & 1) {
        result1.push(n * n);
      }
    }
    return result1;
  })());
  const results = ((() => {
    const result2 = [];
    for (n of Array.from(nums)) {       result2.push(n * 2);
    }
    return result2;
  })());

  return ok(results.join(',') === '2,18');
});


test("Basic object comprehensions.", function() {

  let prop;
  const obj   = {one: 1, two: 2, three: 3};
  const names = ((() => {
    const result1 = [];
    for (prop in obj) {
      result1.push(prop + '!');
    }
    return result1;
  })());
  const odds  = ((() => {
    const result2 = [];
    for (prop in obj) {
      const value = obj[prop];
      if (value & 1) {
        result2.push(prop + '!');
      }
    }
    return result2;
  })());

  ok(names.join(' ') === "one! two! three!");
  return ok(odds.join(' ')  === "one! three!");
});


test("Basic range comprehensions.", function() {

  const nums = ([1, 2, 3].map((i) => i * 3));

  let negs = (__range__(-20, -5*2, true));
  negs = negs.slice(0, 3);

  const result = nums.concat(negs).join(', ');

  return ok(result === '3, 6, 9, -20, -19, -18');
});


test("With range comprehensions, you can loop in steps.", function() {

  let x;
  let results = ((() => {
    const result1 = [];
    for (x = 0; x < 15; x += 5) {
      result1.push(x);
    }
    return result1;
  })());
  ok(results.join(' ') === '0 5 10');

  results = ((() => {
    const result2 = [];
    for (x = 0; x <= 100; x += 10) {
      result2.push(x);
    }
    return result2;
  })());
  return ok(results.join(' ') === '0 10 20 30 40 50 60 70 80 90 100');
});


test("And can loop downwards, with a negative step.", function() {

  let x;
  let results = ((() => {
    const result1 = [];
    for (x = 5; x >= 1; x--) {
      result1.push(x);
    }
    return result1;
  })());

  ok(results.join(' ') === '5 4 3 2 1');
  ok(results.join(' ') === __range__((10-5), (-2+3), true).join(' '));

  results = ((() => {
    const result2 = [];
    for (x = 10; x >= 1; x--) {
      result2.push(x);
    }
    return result2;
  })());
  ok(results.join(' ') === [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].join(' '));

  results = ((() => {
    const result3 = [];
    for (x = 10; x > 0; x -= 2) {
      result3.push(x);
    }
    return result3;
  })());
  return ok(results.join(' ') === [10, 8, 6, 4, 2].join(' '));
});


test("Range comprehension gymnastics.", function() {

  let i;
  eq(`${(() => {
    const result1 = [];
    for (i = 5; i >= 1; i--) {
      result1.push(i);
    }
    return result1;
  })()}`, '5,4,3,2,1');
  eq(`${(() => {
    let end;
    const result2 = [];
    for (i = 5, end = -5; i >= end; i -= 5) {
      result2.push(i);
    }
    return result2;
  })()}`, '5,0,-5');

  const a = 6;
  const b = 0;
  const c = -2;

  eq(`${(() => {
    let asc, end1;
    const result3 = [];
    for (i = a, end1 = b, asc = a <= end1; asc ? i <= end1 : i >= end1; asc ? i++ : i--) {
      result3.push(i);
    }
    return result3;
  })()}`, '6,5,4,3,2,1,0');
  return eq(`${(() => {
    let asc1, end2, step;
    const result4 = [];
    for (i = a, end2 = b, step = c, asc1 = step > 0; asc1 ? i <= end2 : i >= end2; i += step) {
      result4.push(i);
    }
    return result4;
  })()}`, '6,4,2,0');
});


test("Multiline array comprehension with filter.", function() {

  const evens = (() => {
    const result1 = [];
    for (let num of [1, 2, 3, 4, 5, 6]) {
      if (!(num & 1)) {
         num *= -1;
         num -= 2;
         result1.push(num * -1);
      }
    }
    return result1;
  })();
  eq(evens + '', '4,6,8');


  return test("The in operator still works, standalone.", () => ok(2 in evens));
});


test("all isn't reserved.", function() {

  let all;
  return all = 1;
});


test("Ensure that the closure wrapper preserves local variables.", function() {

  const obj = {};

  for (let method of ['one', 'two', 'three']) { (method =>
    obj[method] = () => `I'm ${method}`
  )(method); }

  ok(obj.one()   === "I'm one");
  ok(obj.two()   === "I'm two");
  return ok(obj.three() === "I'm three");
});


test("Index values at the end of a loop.", function() {

  let i = 0;
  for (i = 1; i <= 3; i++) {
    () => 'func';
    if (false) { break; }
  }
  return ok(i === 4);
});


test("Ensure that local variables are closed over for range comprehensions.", function() {

  let i;
  const funcs = (() => {
    const result1 = [];
    for (i = 1; i <= 3; i++) {
      result1.push((i => () => -i)(i));
    }
    return result1;
  })();

  eq((Array.from(funcs).map((func) => func())).join(' '), '-1 -2 -3');
  return ok(i === 4);
});


test("Even when referenced in the filter.", function() {

  const list = ['one', 'two', 'three'];

  const methods = (() => {
    const result1 = [];
    for (let i = 0; i < list.length; i++) {
      const num = list[i];
      if ((num !== 'two') && (i !== 1)) {
        result1.push(((num, i) => () => num + ' ' + i)(num, i));
      }
    }
    return result1;
  })();

  ok(methods.length === 2);
  ok(methods[0]() === 'one 0');
  return ok(methods[1]() === 'three 2');
});


test("Even a convoluted one.", function() {

  let i, z, x;
  let funcs = [];

  for (i = 1; i <= 3; i++) {
    (function(i) {
      x = i * 2;
      return (z=> funcs.push(() => z + ' ' + i))(x);
    })(i);
  }

  ok((Array.from(funcs).map((func) => func())).join(', ') === '2 1, 4 2, 6 3');

  funcs = [];

  const results = (() => {
    const result1 = [];
    for (i = 1; i <= 3; i++) {
      result1.push((function(i) {
        z = (__range__(1, i, true).map((x) => x * 3));
        return ((a, b, c) => [a, b, c].join(' ')).apply(this, z);
      })(i));
    }
    return result1;
  })();

  return ok(results.join(', ') === '3  , 3 6 , 3 6 9');
});


test("Naked ranges are expanded into arrays.", function() {

  const array = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return ok((() => {
    const result1 = [];
    for (let j = 0; j < array.length; j += 2) {
      const num = array[j];
      result1.push((num % 2) === 0);
    }
    return result1;
  })());
});


test("Nested shared scopes.", function() {

  const foo = () =>
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
      (i =>
        [0, 1, 2, 3, 4, 5, 6, 7].map((j) =>
          (j => () => i + j)(j))
      )(i))
  ;

  return eq(foo()[3][4](), 7);
});


test("Scoped loop pattern matching.", function() {

  const a = [[0], [1]];
  const funcs = [];

  for (let [v] of Array.from(a)) {
    (v => funcs.push(() => v))(v);
  }

  eq(funcs[0](), 0);
  return eq(funcs[1](), 1);
});


test("Nested comprehensions.", function() {

  let x, y;
  const multiLiner =
    (() => {
    const result1 = [];
    for (x = 3; x <= 5; x++) {
      result1.push((() => {
        const result2 = [];
        for (y = 3; y <= 5; y++) {
          result2.push([x, y]);
        }
        return result2;
      })());
    }
    return result1;
  })();

  const singleLiner =
    ((() => {
    const result3 = [];
    for (x = 3; x <= 5; x++) {
      result3.push(((() => {
        const result4 = [];
        for (y = 3; y <= 5; y++) {
          result4.push([x, y]);
        }
        return result4;
      })()));
    }
    return result3;
  })());

  ok(multiLiner.length === singleLiner.length);
  ok(5 === multiLiner[2][2][1]);
  return ok(5 === singleLiner[2][2][1]);
});


test("Comprehensions within parentheses.", function() {

  let result = null;
  const store = obj => result = obj;
  store(([3, 2, 1].map((x) => x * 2)));

  return ok(result.join(' ') === '6 4 2');
});


test("Closure-wrapped comprehensions that refer to the 'arguments' object.", function() {

  const expr = function() {
    let result;
    return result = (Array.from(arguments).map((item) => item * item));
  };

  return ok(expr(2, 4, 8).join(' ') === '4 16 64');
});


test("Fast object comprehensions over all properties, including prototypal ones.", function() {

  let key, value;
  class Cat {
    static initClass() {
      this.prototype.breed = 'tabby';
      this.prototype.hair =  'cream';
    }
    constructor() { this.name = 'Whiskers'; }
  }
  Cat.initClass();

  const whiskers = new Cat;
  const own = ((() => {
    const result1 = [];
    for (key of Object.keys(whiskers || {})) {
      value = whiskers[key];
      result1.push(value);
    }
    return result1;
  })());
  const all = ((() => {
    const result2 = [];
    for (key in whiskers) {
      value = whiskers[key];
      result2.push(value);
    }
    return result2;
  })());

  ok(own.join(' ') === 'Whiskers');
  return ok(all.sort().join(' ') === 'Whiskers cream tabby');
});


test("Optimized range comprehensions.", function() {

  const exxes = ([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((j) => 'x'));
  return ok(exxes.join(' ') === 'x x x x x x x x x x');
});


test("Loop variables should be able to reference outer variables", function() {
  let outer = 1;
  (() =>
    (() => {
      const result1 = [];
      for (outer of [1, 2, 3]) {         result1.push(null);
      }
      return result1;
    })()
  )();
  return eq(outer, 3);
});


test("Lenient on pure statements not trying to reach out of the closure", function() {

  let i;
  const val = (() => {
    const result1 = [];
    for (i of [1]) {
      for (let j of []) { break; }
      result1.push(i);
    }
    return result1;
  })();
  return ok(val[0] === i);
});


test(`Comprehensions only wrap their last line in a closure, allowing other lines \
to have pure expressions in them.`, function() {

  const func = () => (() => {
    const result1 = [];
    for (let i of [1]) {
      if (i === 2) { break; }
      result1.push([1]);
    }
    return result1;
  })() ;

  ok(func()[0][0] === 1);

  let i = 6;
  const odds = (() => {
    const result1 = [];
    while (i--) {
      if (!(i & 1)) { continue; }
      result1.push(i);
    }
    return result1;
  })();

  return ok(odds.join(', ') === '5, 3, 1');
});


test("Issue #897: Ensure that plucked function variables aren't leaked.", function() {

  const facets = {};
  const list = ['one', 'two'];

  (() =>
    Array.from(list).map((entity) =>
      (facets[entity] = () => entity))
  )();

  eq(typeof entity, 'undefined');
  return eq(facets['two'](), 'two');
});


test("Issue #905. Soaks as the for loop subject.", function() {

  let e;
  const a = {b: {c: [1, 2, 3]}};
  for (let d of Array.from((a.b != null ? a.b.c : undefined))) {
    e = d;
  }

  return eq(e, 3);
});


test("Issue #948. Capturing loop variables.", function() {

  const funcs = [];
  const list  = () => [1, 2, 3];

  for (let y of Array.from(list())) {
    (function(y) {
      const z = y;
      return funcs.push(() => `y is ${y} and z is ${z}`);
    })(y);
  }

  return eq(funcs[1](), "y is 2 and z is 2");
});


test("Cancel the comprehension if there's a jump inside the loop.", function() {

  const result = (() => { try {
    let i;
    for (i = 0; i < 10; i++) {
      if (i < 5) { continue; }
    }
    return i;
  } catch (error) {} })();

  return eq(result, 10);
});


test("Comprehensions over break.", () =>

  arrayEq(((() => {
    const result1 = [];
    for (let j = 1; j <= 10; j++) {
      break;
    }
    return result1;
  })()), [])
);


test("Comprehensions over continue.", () =>

  arrayEq(((() => {
    const result1 = [];
    for (let j = 1; j <= 10; j++) {
      continue;
    }
    return result1;
  })()), [])
);


test("Comprehensions over function literals.", function() {

  let a = 0;
  for (let f of [() => a = 1]) {
    (f => f())(f);
  }

  return eq(a, 1);
});


test("Comprehensions that mention arguments.", function() {

  const list = [{arguments: 10}];
  const args = Array.from(list).map((f) =>
    (function(f) {
      return f.arguments;
    })(f));
  return eq(args[0], 10);
});


test("expression conversion under explicit returns", function() {
  const nonce = {};
  let fn = () => [1,2,3].map((x) => nonce);
  arrayEq([nonce,nonce,nonce], fn());
  fn = () => [[1,2,3].map((x) => nonce)][0];
  arrayEq([nonce,nonce,nonce], fn());
  fn = () => [([1, 2, 3].map((x) => nonce))][0];
  return arrayEq([nonce,nonce,nonce], fn());
});


test("implicit destructuring assignment in object of objects", function() {
  const a={}; const b={}; const c={};
  const obj = {
    a: { d: a },
    b: { d: b },
    c: { d: c }
  };
  const result = ((() => {
    const result1 = [];
    for (let y in obj) {
      const { d: z } = obj[y];
      result1.push([y,z]);
    }
    return result1;
  })());
  return arrayEq([['a',a],['b',b],['c',c]], result);
});


test("implicit destructuring assignment in array of objects", function() {
  const a={}; const b={}; const c={}; const d={}; const e={}; const f={};
  const arr = [
    { a, b: { c: b } },
    { a: c, b: { c: d } },
    { a: e, b: { c: f } }
  ];
  const result = ((() => {
    const result1 = [];
    for (let { a: y, b: { c: z } } of Array.from(arr)) {       result1.push([y,z]);
    }
    return result1;
  })());
  return arrayEq([[a,b],[c,d],[e,f]], result);
});


test("implicit destructuring assignment in array of arrays", function() {
  const a={}; const b={}; const c={}; const d={}; const e={}; const f={};
  const arr = [[a, [b]], [c, [d]], [e, [f]]];
  const result = ((() => {
    const result1 = [];
    for (let value1 of Array.from(arr)) {       const y = value1[0], [z] = Array.from(value1[1]); result1.push([y,z]);
    }
    return result1;
  })());
  return arrayEq([[a,b],[c,d],[e,f]], result);
});

test("issue #1124: don't assign a variable in two scopes", function() {
  const lista = [1, 2, 3, 4, 5];
  const listb = (Array.from(lista).map((_i) => _i + 1));
  return arrayEq([2, 3, 4, 5, 6], listb);
});

test("#1326: `by` value is uncached", function() {
  let gi, hi;
  let asc, step;
  let i;
  const a = [0,1,2];
  let fi = (gi = (hi = 0));
  const f = () => ++fi;
  const g = () => ++gi;
  const h = () => ++hi;

  const forCompile = [];
  let rangeCompileSimple = [];

  //exercises For.compile
  for (step = f(), asc = step > 0, i = asc ? 0 : a.length - 1; asc ? i < a.length : i >= 0; i += step) {
    const v = a[i];
    forCompile.push(i);
  }

  //exercises Range.compileSimple
  rangeCompileSimple = ((() => {
    let step1;
    const result1 = [];
    for (i = 0, step1 = g(); i <= 2; i += step1) {
      result1.push(i);
    }
    return result1;
  })());

  arrayEq(a, forCompile);
  arrayEq(a, rangeCompileSimple);
  //exercises Range.compile
  return eq(`${(() => {
    let step2;
    const result2 = [];
    for (i = 0, step2 = h(); i <= 2; i += step2) {
      result2.push(i);
    }
    return result2;
  })()}`, '0,1,2');
});

test("#1669: break/continue should skip the result only for that branch", function() {
  let n;
  let ns = (() => {
    const result1 = [];
    for (n = 0; n <= 99; n++) {
      if (n > 9) {
        break;
      } else if (n & 1) {
        continue;
      } else {
        result1.push(n);
      }
    }
    return result1;
  })();
  eq(`${ns}`, '0,2,4,6,8');

  // `else undefined` is implied.
  ns = (() => {
    const result2 = [];
    for (n = 1; n <= 9; n++) {
      if (n % 2) {
        if (!(n % 5)) { continue; }
        result2.push(n);
      } else {
        result2.push(undefined);
      }
    }
    return result2;
  })();
  eq(`${ns}`, "1,,3,,,7,,9");

  // Ditto.
  ns = (() => {
    const result3 = [];
    for (n = 1; n <= 9; n++) {
      switch (false) {
        case !(n % 2):
          if (!(n % 5)) { continue; }
          result3.push(n);
          break;
        default:
          result3.push(undefined);
      }
    }
    return result3;
  })();
  return eq(`${ns}`, "1,,3,,,7,,9");
});

test("#1850: inner `for` should not be expression-ized if `return`ing", () =>
  eq('3,4,5', (function() {
    for (let a = 1; a <= 9; a++) { 
      for (let b = 1; b <= 9; b++) {
        const c = Math.sqrt((a*a) + (b*b));
        if (!(c % 1)) { return String([a, b, c]); }
      }
    }
  })()
  )
);

test("#1910: loop index should be mutable within a loop iteration and immutable between loop iterations", function() {
  let j;
  let k;
  let asc, end;
  let i1;
  let v;
  const n = 1;
  let iterations = 0;
  let arr = __range__(0, n, true);
  for (j = 0, k = j; j < arr.length; j++, k = j) {
    v = arr[k];
    ++iterations;
    v = (k = 5);
    eq(5, k);
  }
  eq(2, k);
  eq(2, iterations);

  iterations = 0;
  for (v = 0, end = n, asc = 0 <= end; asc ? v <= end : v >= end; asc ? v++ : v--) {
    ++iterations;
  }
  eq(2, k);
  eq(2, iterations);

  arr = ((() => {
    const result1 = [];
    for (v = 0; v <= 5; v++) {
      result1.push([v, v + 1]);
    }
    return result1;
  })());
  iterations = 0;
  for (i1 = 0, k = i1; i1 < arr.length; i1++, k = i1) {
    const [v0, v1] = arr[k];
    if (v0) {
      k += 3;
      ++iterations;
    }
  }
  eq(6, k);
  return eq(5, iterations);
});

test("#2007: Return object literal from comprehension", function() {
  let x;
  let y = (() => {
    const result1 = [];
    for (x of [1, 2]) {
      result1.push({foo: `foo${x}`});
    }
    return result1;
  })();
  eq(2, y.length);
  eq("foo1", y[0].foo);
  eq("foo2", y[1].foo);

  x = 2;
  y = (() => {
    const result2 = [];
    while (x) {
      result2.push({x: --x});
    }
    return result2;
  })();
  eq(2, y.length);
  eq(1, y[0].x);
  return eq(0, y[1].x);
});

test("#2274: Allow @values as loop variables", function() {
  const obj = {
    item: null,
    method() {
      return (() => {
        const result1 = [];
        for (this.item of [1, 2, 3]) {
          result1.push(null);
        }
        return result1;
      })();
    }
  };
  eq(obj.item, null);
  obj.method();
  return eq(obj.item, 3);
});

test("#2525, #1187, #1208, #1758, looping over an array forwards", function() {
  let i, index;
  const list = [0, 1, 2, 3, 4];

  const ident = x => x;

  arrayEq(((() => {
    const result1 = [];
    for (i of Array.from(list)) {       result1.push(i);
    }
    return result1;
  })()), list);

  arrayEq(((() => {
    const result2 = [];
    for (index = 0; index < list.length; index++) {
      i = list[index];
      result2.push(index);
    }
    return result2;
  })()), list);

  arrayEq(((() => {
    const result3 = [];
    for (let j = 0; j < list.length; j++) {
      i = list[j];
      result3.push(i);
    }
    return result3;
  })()), list);

  arrayEq(((() => {
    const result4 = [];
    for (let step = ident(1), asc = step > 0, k = asc ? 0 : list.length - 1; asc ? k < list.length : k >= 0; k += step) {
      i = list[k];
      result4.push(i);
    }
    return result4;
  })()), list);

  arrayEq(((() => {
    const result5 = [];
    for (let step1 = ident(1) * 2, asc1 = step1 > 0, i1 = asc1 ? 0 : list.length - 1; asc1 ? i1 < list.length : i1 >= 0; i1 += step1) {
      i = list[i1];
      result5.push(i);
    }
    return result5;
  })()), [0, 2, 4]);

  return arrayEq(((() => {
    let asc2, step2;
    const result6 = [];
    for (step2 = ident(1) * 2, asc2 = step2 > 0, index = asc2 ? 0 : list.length - 1; asc2 ? index < list.length : index >= 0; index += step2) {
      i = list[index];
      result6.push(index);
    }
    return result6;
  })()), [0, 2, 4]);
});

test("#2525, #1187, #1208, #1758, looping over an array backwards", function() {
  let i, index;
  const list = [0, 1, 2, 3, 4];
  const backwards = [4, 3, 2, 1, 0];

  const ident = x => x;

  arrayEq(((() => {
    const result1 = [];
    for (let j = list.length - 1; j >= 0; j--) {
      i = list[j];
      result1.push(i);
    }
    return result1;
  })()), backwards);

  arrayEq(((() => {
    const result2 = [];
    for (index = list.length - 1; index >= 0; index--) {
      i = list[index];
      result2.push(index);
    }
    return result2;
  })()), backwards);

  arrayEq(((() => {
    const result3 = [];
    for (let step = ident(-1), asc = step > 0, k = asc ? 0 : list.length - 1; asc ? k < list.length : k >= 0; k += step) {
      i = list[k];
      result3.push(i);
    }
    return result3;
  })()), backwards);

  arrayEq(((() => {
    const result4 = [];
    for (let step1 = ident(-1) * 2, asc1 = step1 > 0, i1 = asc1 ? 0 : list.length - 1; asc1 ? i1 < list.length : i1 >= 0; i1 += step1) {
      i = list[i1];
      result4.push(i);
    }
    return result4;
  })()), [4, 2, 0]);

  return arrayEq(((() => {
    let asc2, step2;
    const result5 = [];
    for (step2 = ident(-1) * 2, asc2 = step2 > 0, index = asc2 ? 0 : list.length - 1; asc2 ? index < list.length : index >= 0; index += step2) {
      i = list[index];
      result5.push(index);
    }
    return result5;
  })()), [4, 2, 0]);
});

test("splats in destructuring in comprehensions", function() {
  const list = [[0, 1, 2], [2, 3, 4], [4, 5, 6]];
  return arrayEq(((() => {
    const result1 = [];
    for (let [rep, ...seq] of Array.from(list)) {       result1.push(seq);
    }
    return result1;
  })()), [[1, 2], [3, 4], [5, 6]]);
});

test("#156: expansion in destructuring in comprehensions", function() {
  const list = [[0, 1, 2], [2, 3, 4], [4, 5, 6]];
  return arrayEq(((() => {
    const result1 = [];
    for (let value1 of Array.from(list)) {       const last = value1[value1.length - 1]; result1.push(last);
    }
    return result1;
  })()), [2, 4, 6]);
});
// Control Flow
// ------------

// * Conditionals
// * Loops
//   * For
//   * While
//   * Until
//   * Loop
// * Switch
// * Throw

// TODO: make sure postfix forms and expression coercion are properly tested

// shared identity function
let id = function(_) { if (arguments.length === 1) { return _; } else { return Array.prototype.slice.call(arguments); } };

// Conditionals

test("basic conditionals", function() {
  if (false) {
    ok(false);
  } else if (false) {
    ok(false);
  } else {
    ok(true);
  }

  if (true) {
    ok(true);
  } else if (true) {
    ok(false);
  } else {
    ok(true);
  }

  if (!true) {
    ok(false);
  } else if (!true) {
    ok(false);
  } else {
    ok(true);
  }

  if (!false) {
    return ok(true);
  } else if (!false) {
    return ok(false);
  } else {
    return ok(true);
  }
});

test("single-line conditional", function() {
  if (false) { ok(false); } else { ok(true); }
  if (!false) { return ok(true); } else { return ok(false); }
});

test("nested conditionals", function() {
  const nonce = {};
  return eq(nonce, ((() => {
    if (true) {
    if (!false) {
      if (false) { return false; } else {
        if (true) {
          return nonce;
        }
      }
    }
  }
  })())
  );
});

test("nested single-line conditionals", function() {
  let b;
  const nonce = {};

  const a = false ? undefined : (b = 0 ? undefined : nonce);
  eq(nonce, a);
  eq(nonce, b);

  const c = false ? undefined : (0 ? undefined : nonce);
  eq(nonce, c);

  const d = true ? id(false ? undefined : nonce) : undefined;
  return eq(nonce, d);
});

test("empty conditional bodies", () =>
  eq(undefined, ((() => {
    if (false) {
  } else if (false) {} 
  else {}
  })())
  )
);

test("conditional bodies containing only comments", function() {
  eq(undefined, (true ?
    /*
    block comment
    */
  undefined : undefined
    // comment
  )
  );

  return eq(undefined, ((() => {
    if (false) {
    // comment
  } else if (true) {} 
    /*
    block comment
    */
  else {}
  })())
  );
});

test("return value of if-else is from the proper body", function() {
  const nonce = {};
  return eq(nonce, false ? undefined : nonce);
});

test("return value of unless-else is from the proper body", function() {
  const nonce = {};
  return eq(nonce, !true ? undefined : nonce);
});

test("assign inside the condition of a conditional statement", function() {
  let a, b;
  const nonce = {};
  if (a = nonce) { 1; }
  eq(nonce, a);
  if (b = nonce) { 1; }
  return eq(nonce, b);
});


// Interactions With Functions

test("single-line function definition with single-line conditional", function() {
  const fn = function() { if (1 < 0.5) { return 1; } else { return -1; } };
  return ok(fn() === -1);
});

test("function resturns conditional value with no `else`", function() {
  const fn = function() {
    if (false) { return true; }
  };
  return eq(undefined, fn());
});

test("function returns a conditional value", function() {
  const a = {};
  const fnA = function() {
    if (false) { return undefined; } else { return a; }
  };
  eq(a, fnA());

  const b = {};
  const fnB = function() {
    if (!false) { return b; } else { return undefined; }
  };
  return eq(b, fnB());
});

test("passing a conditional value to a function", function() {
  const nonce = {};
  return eq(nonce, id(false ? undefined : nonce));
});

test("unmatched `then` should catch implicit calls", function() {
  let a = 0;
  const trueFn = () => true;
  if (trueFn(undefined)) { a++; }
  return eq(1, a);
});


// if-to-ternary

test("if-to-ternary with instanceof requires parentheses", function() {
  const nonce = {};
  return eq(nonce, ({} instanceof Object ?
    nonce
  :
    undefined)
  );
});

test("if-to-ternary as part of a larger operation requires parentheses", () => ok(2, 1 + (false ? 0 : 1)));


// Odd Formatting

test("if-else indented within an assignment", function() {
  const nonce = {};
  const result =
    false ?
      undefined
    :
      nonce;
  return eq(nonce, result);
});

test("suppressed indentation via assignment", function() {
  const nonce = {};
  const result =
    false ? undefined
    : false    ? undefined
    : 0     ? undefined
    : 1 < 0 ? undefined
    :               id(
         false ? undefined
         :          nonce
    );
  return eq(nonce, result);
});

test("tight formatting with leading `then`", function() {
  const nonce = {};
  return eq(nonce,
  true
  ? nonce
  : undefined
  );
});

test("#738", function() {
  const nonce = {};
  const fn = true ? () => nonce : undefined;
  return eq(nonce, fn());
});

test("#748: trailing reserved identifiers", function() {
  const nonce = {};
  const obj = {delete: true};
  const result = obj.delete ?
    nonce : undefined;
  return eq(nonce, result);
});

// Postfix

test("#3056: multiple postfix conditionals", function() {
  let temp = 'initial';
  if (false) { if (!true) { temp = 'ignored'; } }
  return eq(temp, 'initial');
});

// Loops

test("basic `while` loops", function() {

  let i = 5;
  let list = (() => {
    const result1 = [];
    while ((i -= 1)) {
      result1.push(i * 2);
    }
    return result1;
  })();
  ok(list.join(' ') === "8 6 4 2");

  i = 5;
  list = ((() => {
    const result2 = [];
    while ((i -= 1)) {
      result2.push(i * 3);
    }
    return result2;
  })());
  ok(list.join(' ') === "12 9 6 3");

  i = 5;
  const func   = num => i -= num;
  const assert = () => ok(i < 5 && 5 > 0);
  let results = (() => {
    const result3 = [];
    while (func(1)) {
      assert();
      result3.push(i);
    }
    return result3;
  })();
  ok(results.join(' ') === '4 3 2 1');

  i = 10;
  results = (() => {
    const result4 = [];
    while ((i -= 1)) {
      if ((i % 2) === 0) {
        result4.push(i * 2);
      }
    }
    return result4;
  })();
  return ok(results.join(' ') === '16 12 8 4');
});


test("Issue 759: `if` within `while` condition", () =>

  (() => {
    const result1 = [];
    while (1 ? 0 : undefined) {
      result1.push(2);
    }
    return result1;
  })()
);


test("assignment inside the condition of a `while` loop", function() {

  let a, b;
  const nonce = {};
  let count = 1;
  while (count--) { a = nonce; }
  eq(nonce, a);
  count = 1;
  while (count--) {
    b = nonce;
  }
  return eq(nonce, b);
});


test("While over break.", function() {

  let i = 0;
  const result = (() => {
    const result1 = [];
    while (i < 10) {
      i++;
      break;
    }
    return result1;
  })();
  return arrayEq(result, []);
});


test("While over continue.", function() {

  let i = 0;
  const result = (() => {
    const result1 = [];
    while (i < 10) {
      i++;
      continue;
    }
    return result1;
  })();
  return arrayEq(result, []);
});


test("Basic `until`", function() {

  let value;
  value = false;
  let i = 0;
  const results = (() => {
    const result1 = [];
    while (!value) {
      if (i === 5) { value = true; }
      result1.push(i++);
    }
    return result1;
  })();
  return ok(i === 6);
});


test("Basic `loop`", function() {

  let i = 5;
  const list = [];
  while (true) {
    i -= 1;
    if (i === 0) { break; }
    list.push(i * 2);
  }
  return ok(list.join(' ') === '8 6 4 2');
});


test("break at the top level", function() {
  let result;
  for (let i of [1,2,3]) {
    result = i;
    if (i === 2) {
      break;
    }
  }
  return eq(2, result);
});

test("break *not* at the top level", function() {
  const someFunc = function() {
    let result;
    let i = 0;
    while (++i < 3) {
      result = i;
      if (i > 1) { break; }
    }
    return result;
  };
  return eq(2, someFunc());
});

// Switch

test("basic `switch`", function() {

  const num = 10;
  const result = (() => { switch (num) {
    case 5: return false;
    case 'a':
      true;
      true;
      return false;
    case 10: return true;


    // Mid-switch comment with whitespace
    // and multi line
    case 11: return false;
    default: return false;
  } })();

  ok(result);


  const func = function(num) {
    switch (num) {
      case 2: case 4: case 6:
        return true;
      case 1: case 3: case 5:
        return false;
    }
  };

  ok(func(2));
  ok(func(6));
  ok(!func(3));
  return eq(func(8), undefined);
});


test("Ensure that trailing switch elses don't get rewritten.", function() {

  let result = false;
  switch ("word") {
    case "one thing":
      doSomething();
      break;
    default:
      if (!false) { result = true; }
  }

  ok(result);

  result = false;
  switch ("word") {
    case "one thing":
      doSomething();
      break;
    case "other thing":
      doSomething();
      break;
    default:
      if (!false) { result = true; }
  }

  return ok(result);
});


test("Should be able to handle switches sans-condition.", function() {

  const result = (() => { switch (false) {
    case !null:                     return 0;
    case !!1:                       return 1;
    case '' in {'': ''}:           return 2;
    case [] instanceof Array:  return 3;
    case true !== false:            return 4;
    case !('x' < 'y' && 'y' > 'z'):          return 5;
    case !['b', 'c'].includes('a'):        return 6;
    case !['e', 'f'].includes('d'):      return 7;
    default: return ok;
  } })();

  return eq(result, ok);
});


test("Should be able to use `@properties` within the switch clause.", function() {

  const obj = {
    num: 101,
    func() {
      switch (this.num) {
        case 101: return '101!';
        default: return 'other';
      }
    }
  };

  return ok(obj.func() === '101!');
});


test("Should be able to use `@properties` within the switch cases.", function() {

  const obj = {
    num: 101,
    func(yesOrNo) {
      const result = (() => { switch (yesOrNo) {
        case true: return this.num;
        default: return 'other';
      } })();
      return result;
    }
  };

  return ok(obj.func(true) === 101);
});


test("Switch with break as the return value of a loop.", function() {

  let i = 10;
  const results = (() => {
    const result1 = [];
    while (i > 0) {
      i--;
      switch (i % 2) {
        case 1: result1.push(i); break;
        case 0: break;
        default:
          result1.push(undefined);
      }
    }
    return result1;
  })();

  return eq(results.join(', '), '9, 7, 5, 3, 1');
});


test("Issue #997. Switch doesn't fallthrough.", function() {

  let val = 1;
  switch (true) {
    case true:
      if (false) {
        return 5;
      }
      break;
    default:
      val = 2;
  }

  return eq(val, 1);
});

// Throw

test("Throw should be usable as an expression.", function() {
  try {
    false || (() => { throw 'up'; })();
    throw new Error('failed');
  } catch (e) {
    return ok(e === 'up');
  }
});


test("#2555, strange function if bodies", function() {
  const success = () => ok(true);
  const failure = () => ok(false);

  if ((() => true)()) { success(); }

  if ((() => { try {
    return false;
  } catch (error) {} })()) { return failure(); }
});

test("#1057: `catch` or `finally` in single-line functions", function() {
  ok((function() { try { throw 'up'; } catch (error) { return true; } })());
  return ok((function() { try { return true; } finally {'nothing'; } })());
});

test("#2367: super in for-loop", function() {
  class Foo {
    static initClass() {
      this.prototype.sum = 0;
    }
    add(val) { return this.sum += val; }
  }
  Foo.initClass();

  class Bar extends Foo {
    add(...vals) {
      for (let val of Array.from(vals)) { super.add(val); }
      return this.sum;
    }
  }

  return eq(10, (new Bar).add(2, 3, 5));
});
// Error Formating
// ---------------

// Ensure that errors of different kinds (lexer, parser and compiler) are shown
// in a consistent way.

const assertErrorFormat = (code, expectedErrorFormat) =>
  throws((() => CoffeeScript.run(code)), function(err) {
    err.colorful = false;
    eq(expectedErrorFormat, `${err}`);
    return true;
  })
;

test("lexer errors formating", () =>
  assertErrorFormat(`\
normalObject    = {}
insideOutObject = }{\
`,
  `\
[stdin]:2:19: error: unmatched }
insideOutObject = }{
                  ^\
`
  )
);

test("parser error formating", () =>
  assertErrorFormat(`\
foo in bar or in baz\
`,
  `\
[stdin]:1:15: error: unexpected in
foo in bar or in baz
              ^^\
`
  )
);

test("compiler error formatting", () =>
  assertErrorFormat(`\
evil = (foo, eval, bar) ->\
`,
  `\
[stdin]:1:14: error: parameter name "eval" is not allowed
evil = (foo, eval, bar) ->
             ^^^^\
`
  )
);


if (typeof require !== 'undefined' && require !== null) {
  fs   = require('fs');
  const path = require('path');

  test("patchStackTrace line patching", function() {
    const err = new Error('error');
    return ok(err.stack.match(/test[\/\\]error_messages\:\d+:\d+\b/));
  });

  test("patchStackTrace stack prelude consistent with V8", function() {
    let err = new Error;
    ok(err.stack.match(/^Error\n/)); // Notice no colon when no message.

    err = new Error('error');
    return ok(err.stack.match(/^Error: error\n/));
  });

  test("#2849: compilation error in a require()d file", function() {
    // Create a temporary file to require().
    ok(!fs.existsSync('test/syntax-error'));
    fs.writeFileSync('test/syntax-error', 'foo in bar or in baz');

    try {
      return assertErrorFormat(`\
require './test/syntax-error'\
`,
      `\
${path.join(__dirname, 'syntax-error')}:1:15: error: unexpected in
foo in bar or in baz
              ^^\
`
      );
    } finally {
      fs.unlink('test/syntax-error');
    }
  });
}


test("#1096: unexpected generated tokens", function() {
  // Unexpected interpolation
  assertErrorFormat('{"#{key}": val}', `\
[stdin]:1:3: error: unexpected string interpolation
{"#{key}": val}
  ^^\
`
  );
  // Implicit ends
  assertErrorFormat('a:, b', `\
[stdin]:1:3: error: unexpected ,
a:, b
  ^\
`
  );
  // Explicit ends
  assertErrorFormat('(a:)', `\
[stdin]:1:4: error: unexpected )
(a:)
   ^\
`
  );
  // Unexpected end of file
  assertErrorFormat('a:', `\
[stdin]:1:3: error: unexpected end of input
a:
  ^\
`
  );
  // Unexpected implicit object
  return assertErrorFormat(`\
for i in [1]:
  1\
`, `\
[stdin]:1:13: error: unexpected :
for i in [1]:
            ^\
`
  );
});

test("#3325: implicit indentation errors", () =>
  assertErrorFormat(`\
i for i in a then i\
`, `\
[stdin]:1:14: error: unexpected then
i for i in a then i
             ^^^^\
`
  )
);

test("explicit indentation errors", () =>
  assertErrorFormat(`\
a = b
  c\
`, `\
[stdin]:2:1: error: unexpected indentation
  c
^^\
`
  )
);
if (vm = typeof require === 'function' ? require('vm') : undefined) {

  test("CoffeeScript.eval runs in the global context by default", function() {
    global.punctuation = '!';
    const code = `\
global.fhqwhgads = "global superpower#{global.punctuation}"\
`;
    const result = CoffeeScript.eval(code);
    eq(result, 'global superpower!');
    return eq(fhqwhgads, 'global superpower!');
  });

  test("CoffeeScript.eval can run in, and modify, a Script context sandbox", function() {
    const sandbox = vm.Script.createContext();
    sandbox.foo = 'bar';
    const code = `\
global.foo = 'not bar!'\
`;
    const result = CoffeeScript.eval(code, {sandbox});
    eq(result, 'not bar!');
    return eq(sandbox.foo, 'not bar!');
  });

  test("CoffeeScript.eval can run in, but cannot modify, an ordinary object sandbox", function() {
    const sandbox = {foo: 'bar'};
    const code = `\
global.foo = 'not bar!'\
`;
    const result = CoffeeScript.eval(code, {sandbox});
    eq(result, 'not bar!');
    return eq(sandbox.foo, 'bar');
  });
}
// Exception Handling
// ------------------

// shared nonce
let nonce = {};


// Throw

test("basic exception throwing", () => throws((function() { throw 'error'; }), 'error'));


// Empty Try/Catch/Finally

test("try can exist alone", function() {
  try {} catch (error) {}
});

test("try/catch with empty try, empty catch", function() {
  try {}
    // nothing
  catch (err) {}
});
    // nothing

test("single-line try/catch with empty try, empty catch", function() {
  try {} catch (err) {}
});

test("try/finally with empty try, empty finally", function() {
  try {}
    // nothing
  finally {}
});
    // nothing

test("single-line try/finally with empty try, empty finally", function() {
  try {} finally {}
});

test("try/catch/finally with empty try, empty catch, empty finally", function() {
  try {}
  catch (err) {}
  finally {}
});

test("single-line try/catch/finally with empty try, empty catch, empty finally", function() {
  try {} catch (err) {} finally {}
});


// Try/Catch/Finally as an Expression

test("return the result of try when no exception is thrown", function() {
  const result = (() => { try {
    return nonce;
  } catch (err) {
    return undefined;
  }
  finally {
    undefined;
  } })();
  return eq(nonce, result);
});

test("single-line result of try when no exception is thrown", function() {
  const result = (() => { try { return nonce; } catch (err) { return undefined; } })();
  return eq(nonce, result);
});

test("return the result of catch when an exception is thrown", function() {
  const fn = function() {
    try {
      throw function() {};
    } catch (err) {
      return nonce;
    }
  };
  doesNotThrow(fn);
  return eq(nonce, fn());
});

test("single-line result of catch when an exception is thrown", function() {
  const fn = function() {
    try { throw (function() {}); } catch (err) { return nonce; }
  };
  doesNotThrow(fn);
  return eq(nonce, fn());
});

test("optional catch", function() {
  const fn = function() {
    try { throw function() {}; } catch (error) {}
    return nonce;
  };
  doesNotThrow(fn);
  return eq(nonce, fn());
});


// Try/Catch/Finally Interaction With Other Constructs

test("try/catch with empty catch as last statement in a function body", function() {
  const fn = function() {
    try { return nonce; }
    catch (err) {}
  };
  return eq(nonce, fn());
});


// Catch leads to broken scoping: #1595

test("try/catch with a reused variable name.", function() {
  (function() {
    let inner;
    try {
      return inner = 5;
    } catch (error) { return inner = error; }
  })();
      // nothing
  return eq(typeof inner, 'undefined');
});


// Allowed to destructure exceptions: #2580

test("try/catch with destructuring the exception object", function() {

  let message;
  const result = (() => { try {
    return missing.object;
  } catch (error) {
    ({message} = error);
    return message;
  } })();

  return eq(message, 'missing is not defined');
});



test("Try catch finally as implicit arguments", function() {
  let foo, e;
  const first = x => x;

  foo = false;
  try {
    first((() => { try { return iamwhoiam(); } finally {foo = true; } })());
  } catch (error) { e = error; }
  eq(foo, true);

  let bar = false;
  try {
    first((() => { try { return iamwhoiam(); } catch (error1) { return e = error1; } finally {} })());
    bar = true;
  } catch (error2) { e = error2; }
  return eq(bar, true);
});

// Catch Should Not Require Param: #2900
test("parameter-less catch clause", function() {
  try {
    throw new Error('failed');
  } catch (error) {
    ok(true);
  }

  try { throw new Error('failed'); } catch (error1) {} finally {ok(true); }

  return ok((() => { try { throw new Error('failed'); } catch (error2) { return true; } })());
});
// Formatting
// ----------

// TODO: maybe this file should be split up into their respective sections:
//   operators -> operators
//   array literals -> array literals
//   string literals -> string literals
//   function invocations -> function invocations

doesNotThrow(() => CoffeeScript.compile("a = then b"));

test("multiple semicolon-separated statements in parentheticals", function() {
  nonce = {};
  eq(nonce, (1, 2, nonce));
  return eq(nonce, (() => (1, 2, nonce))());
});

// * Line Continuation
//   * Property Accesss
//   * Operators
//   * Array Literals
//   * Function Invocations
//   * String Literals

// Property Access

test("chained accesses split on period/newline, backwards and forwards", function() {
  const str = 'abc';
  let result = str.
    split('').
    reverse().
    reverse().
    reverse();
  arrayEq(['c','b','a'], result);
  arrayEq(['c','b','a'], str.
    split('').
    reverse().
    reverse().
    reverse()
  );
  result = str
    .split('')
    .reverse()
    .reverse()
    .reverse();
  arrayEq(['c','b','a'], result);
  arrayEq(['c','b','a'],
    str
    .split('')
    .reverse()
    .reverse()
    .reverse()
  );
  return arrayEq(['c','b','a'],
    str.
    split('')
    .reverse().
    reverse()
    .reverse()
  );
});

// Operators

test("newline suppression for operators", function() {
  const six =
    1 +
    2 +
    3;
  return eq(6, six);
});

test("`?.` and `::` should continue lines", () =>
  ok(!(
    Date
    .prototype != null ? Date
    .prototype.foo
   : undefined)
  )
);
  //eq Object::toString, Date?.
  //prototype
  //::
  //?.foo

doesNotThrow(() => CoffeeScript.compile(`\
oh. yes
oh?. true
oh:: return\
`
)
 );

doesNotThrow(() => CoffeeScript.compile(`\
a?[b..]
a?[...b]
a?[b..c]\
`
)
 );

// Array Literals

test("indented array literals don't trigger whitespace rewriting", function() {
  const getArgs = function() { return arguments; };
  const result = getArgs(
    [[[[[],
                  []],
                [[]]]],
      []]);
  return eq(1, result.length);
});

// Function Invocations

doesNotThrow(() => CoffeeScript.compile(`\
obj = then fn 1,
  1: 1
  a:
    b: ->
      fn c,
        d: e
  f: 1\
`
)
 );

// String Literals

test("indented heredoc", function() {
  const result = (_ => _)(
                `\
abc\
`);
  return eq("abc", result);
});

// Chaining - all open calls are closed by property access starting a new line
// * chaining after
//   * indented argument
//   * function block
//   * indented object
//
//   * single line arguments
//   * inline function literal
//   * inline object literal

test("chaining after outdent", function() {
  id = x => x;

  // indented argument
  const ff = id(parseInt("ff",
    16)).toString();
  eq('255', ff);

  // function block
  const str = 'abc';
  const zero = parseInt(str.replace(/\w/, letter => 0)).toString();
  eq('0', zero);

  // indented object
  const { a } = id(id({
    a: 1}));
  return eq(1, a);
});

test("#1495, method call chaining", function() {
  const str = 'abc';

  let result = str.split('')
              .join(', ');
  eq('a, b, c', result);

  result = str
  .split('')
  .join(', ');
  eq('a, b, c', result);

  eq('a, b, c', (str
    .split('')
    .join(', ')
  )
  );

  eq('abc',
    'aaabbbccc'.replace(/(\w)\1\1/g, '$1$1')
               .replace(/([abc])\1/g, '$1')
  );

  // Nested calls
  result = [1, 2, 3]
    .slice(Math.max(0, 1))
    .concat([3]);
  arrayEq([2, 3, 3], result);

  // Single line function arguments
  result = [1, 2, 3, 4, 5, 6]
    .map(x => x * x)
    .filter(x => (x % 2) === 0)
    .reverse();
  arrayEq([36, 16, 4], result);

  // Single line implicit objects
  id = x => x;
  result = id({a: 1})
    .a;
  eq(1, result);

  // The parens are forced
  result = str.split(''.
    split('')
    .join('')
  ).join(', ');
  return eq('a, b, c', result);
});

// Nested blocks caused by paren unwrapping
test("#1492: Nested blocks don't cause double semicolons", function() {
  const js = CoffeeScript.compile('(0;0)');
  return eq(-1, js.indexOf(';;'));
});

test("#1195 Ignore trailing semicolons (before newlines or as the last char in a program)", function() {
  const preNewline = numSemicolons =>
    `\
nonce = {}; nonce2 = {}
f = -> nonce${Array(numSemicolons+1).join(';')}
nonce2
unless f() is nonce then throw new Error('; before linebreak should = newline')\
`
  ;
  for (let n of [1,2,3]) { CoffeeScript.run(preNewline(n), {bare: true}); }

  const lastChar = '-> lastChar;';
  return doesNotThrow(() => CoffeeScript.compile(lastChar, {bare: true}));
});

test("#1299: Disallow token misnesting", function() {
  try {
    CoffeeScript.compile(`\
[{
   ]}\
`
    );
    return ok(false);
  } catch (e) {
    return eq('unmatched ]', e.message);
  }
});

test("#2981: Enforce initial indentation", function() {
  try {
    CoffeeScript.compile('  a\nb-');
    return ok(false);
  } catch (e) {
    return eq('missing indentation', e.message);
  }
});

test("'single-line' expression containing multiple lines", () =>
  doesNotThrow(() => CoffeeScript.compile(`\
(a, b) -> if a
  -a
else if b
then -b
else null\
`
  )
   )
);

test("#1275: allow indentation before closing brackets", function() {
  const array = [
      1,
      2,
      3
    ];
  eq(array, array);
  (function() {})();
  
    const a = 1
   ;
  return eq(1, a);
});
// Function Invocation
// -------------------

// * Function Invocation
// * Splats in Function Invocations
// * Implicit Returns
// * Explicit Returns

// shared identity function
id = function(_) { if (arguments.length === 1) { return _; } else { return [...arguments]; } };

// helper to assert that a string should fail compilation
cantCompile = code => throws(() => CoffeeScript.compile(code));

test("basic argument passing", function() {

  const a = {};
  const b = {};
  const c = {};
  eq(1, (id(1)));
  eq(2, (id(1, 2))[1]);
  eq(a, (id(a)));
  return eq(c, (id(a, b, c))[2]);
});


test("passing arguments on separate lines", function() {

  const a = {};
  const b = {};
  const c = {};
  ok(id(
    a,
    b,
    c
  )[1] === b);
  eq(0, id(
    0,
    10
  )[0]);
  eq(a,id(
    a
  ));
  return eq(b,
  (id(b)));
});


test("optional parens can be used in a nested fashion", function() {

  const call = func => func();
  const add = (a,b) => a + b;
  const result = call(function() {
    let inner;
    return inner = call(() => add(5, 5));
  });
  return ok(result === 10);
});


test("hanging commas and semicolons in argument list", function() {

  const fn = function() { return arguments.length; };
  eq(2, fn(0,1));
  eq(3, fn(0, 1,
  2)
  );
  eq(2, fn(0, 1));
  // TODO: this test fails (the string compiles), but should it?
  //throws -> CoffeeScript.compile "fn(0,1,;)"
  throws(() => CoffeeScript.compile("fn(0,1,;;)"));
  throws(() => CoffeeScript.compile("fn(0, 1;,)"));
  throws(() => CoffeeScript.compile("fn(,0)"));
  return throws(() => CoffeeScript.compile("fn(;0)"));
});


test("function invocation", function() {

  const func = function() {
    if (true) { return; }
  };
  eq(undefined, func());

  const result = ("hello".slice)(3);
  return ok(result === 'lo');
});


test("And even with strange things like this:", function() {

  const funcs  = [(x => x), (x => x * x)];
  const result = funcs[1](5);
  return ok(result === 25);
});


test("More fun with optional parens.", function() {

  const fn = arg => arg;
  ok(fn(fn({prop: 101})).prop === 101);

  const okFunc = f => ok(f());
  return okFunc(() => true);
});


test("chained function calls", function() {
  nonce = {};
  const identityWrap = x => () => x;
  eq(nonce, identityWrap(identityWrap(nonce))()());
  return eq(nonce, (identityWrap(identityWrap(nonce)))()());
});


test("Multi-blocks with optional parens.", function() {

  const fn = arg => arg;
  const result = fn( () =>
    fn(() => "Wrapped")
  );
  return ok(result()() === 'Wrapped');
});


test("method calls", function() {

  const fnId = fn => function() { return fn.apply(this, arguments); };
  const math = {
    add(a, b) { return a + b; },
    anonymousAdd(a, b) { return a + b; },
    fastAdd: fnId((a, b) => a + b)
  };
  ok(math.add(5, 5) === 10);
  ok(math.anonymousAdd(10, 10) === 20);
  return ok(math.fastAdd(20, 20) === 40);
});


test("Ensure that functions can have a trailing comma in their argument list", function() {

  const mult = function(x, ...rest) {
    let adjustedLength, mids;
    let y;
    adjustedLength = Math.max(rest.length, 1),
      mids = rest.slice(0, adjustedLength - 1),
      y = rest[adjustedLength - 1];
    for (let n of Array.from(mids)) { x *= n; }
    return x *= y;
  };
  //ok mult(1, 2,) is 2
  //ok mult(1, 2, 3,) is 6
  return ok(mult(10, ...Array.from((([1, 2, 3, 4, 5, 6])))) === 7200);
});


test("`@` and `this` should both be able to invoke a method", function() {
  nonce = {};
  const fn          = arg => eq(nonce, arg);
  fn.withAt   = function() { return this(nonce); };
  fn.withThis = function() { return this(nonce); };
  fn.withAt();
  return fn.withThis();
});


test("Trying an implicit object call with a trailing function.", function() {

  let a = null;
  const meth = (arg, obj, func) => a = [obj.a, arg, func()].join(' ');
  meth('apple', {b: 1, a: 13}, () => 'orange');
  return ok(a === '13 apple orange');
});


test("Ensure that empty functions don't return mistaken values.", function() {

  const obj = {
    func(param, ...rest) {
      this.param = param;
      [...this.rest] = Array.from(rest);
    }
  };
  ok(obj.func(101, 102, 103, 104) === undefined);
  ok(obj.param === 101);
  return ok(obj.rest.join(' ') === '102 103 104');
});


test("Passing multiple functions without paren-wrapping is legal, and should compile.", function() {

  const sum = (one, two) => one() + two();
  const result = sum(() => 7 + 9
  , () => 1 + 3);
  return ok(result === 20);
});


test("Implicit call with a trailing if statement as a param.", function() {

  const func = function() { return arguments[1]; };
  const result = func('one', false ? 100 : 13);
  return ok(result === 13);
});


test("Test more function passing:", function() {

  let sum = (one, two) => one() + two();

  let result = sum( () => 1 + 2
  , () => 2 + 1);
  ok(result === 6);

  sum = (a, b) => a + b;
  result = sum(1
  , 2);
  return ok(result === 3);
});


test("Chained blocks, with proper indentation levels:", function() {

  const counter = {
    results: [],
    tick(func) {
      this.results.push(func());
      return this;
    }
  };
  counter
    .tick(() => 3).tick(() => 2).tick(() => 1);
  return arrayEq([3,2,1], counter.results);
});


test("This is a crazy one.", function() {

  const x = (obj, func) => func(obj);
  const ident = x => x;
  const result = x({one: ident(1)}, function(obj) {
    const inner = ident(obj);
    return ident(inner);
  });
  return ok(result.one === 1);
});


test("More paren compilation tests:", function() {

  const reverse = obj => obj.reverse();
  return ok(reverse([1, 2].concat(3)).join(' ') === '3 2 1');
});


test("Test for inline functions with parentheses and implicit calls.", function() {

  const combine = (func, num) => func() * num;
  const result  = combine((() => 1 + 2), 3);
  return ok(result === 9);
});


test("Test for calls/parens/multiline-chains.", function() {

  const f = x => x;
  const result = (f(1)).toString()
    .length;
  return ok(result === 1);
});


test("Test implicit calls in functions in parens:", function() {

  const result = (function(val) {
    [].push(val);
    return val;
  })(10);
  return ok(result === 10);
});


test("Ensure that chained calls with indented implicit object literals below are alright.", function() {

  let result = null;
  const obj = {
    method(val)  { return this; },
    second(hash) { return result = hash.three; }
  };
  obj
    .method(
      101
    ).second({
      one: {
        two: 2
      },
      three: 3
    });
  return eq(result, 3);
});


test("Test newline-supressed call chains with nested functions.", function() {

  const obj  =
    {call() { return this; }};
  const func = function() {
    obj
      .call(() => one(two)).call(() => three(four));
    return 101;
  };
  return eq(func(), 101);
});


test("Implicit objects with number arguments.", function() {

  const func = (x, y) => y;
  const obj =
    {prop: func("a", 1)};
  return ok(obj.prop === 1);
});


test("Non-spaced unary and binary operators should cause a function call.", function() {

  const func = val => val + 1;
  ok((func(+5)) === 6);
  return ok((func(-5)) === -4);
});


test("Prefix unary assignment operators are allowed in parenless calls.", function() {

  const func = val => val + 1;
  let val = 5;
  return ok((func(--val)) === 5);
});

test("#855: execution context for `func arr...` should be `null`", function() {
  const contextTest = function() { return eq(this, (typeof window !== 'undefined' && window !== null) ? window : global); };
  const array = [];
  contextTest(array);
  contextTest.apply(null, array);
  return contextTest(...Array.from(array || []));
});

test("#904: Destructuring function arguments with same-named variables in scope", function() {
  let b, c, d;
  const a = (b = (nonce = {}));
  const fn = function(...args) { let a, b; [a,b] = Array.from(args[0]); return {a,b}; };
  const result = fn([(c={}),(d={})]);
  eq(c, result.a);
  eq(d, result.b);
  eq(nonce, a);
  return eq(nonce, b);
});

test("Simple Destructuring function arguments with same-named variables in scope", function() {
  const x = 1;
  const f = function(...args) { let x; [x] = Array.from(args[0]); return x; };
  eq(f([2]), 2);
  return eq(x, 1);
});

test("caching base value", function() {

  var obj = {
    index: 0,
    0: {method() { return this === obj[0]; }}
  };
  return ok(obj[obj.index++].method(...Array.from([] || [])));
});


test("passing splats to functions", function() {
  arrayEq([0, 1, 2, 3, 4], id(id(...Array.from([0, 1, 2, 3, 4] || []))));
  const fn = function(a, b, ...rest) { let adjustedLength, d;
  let c; adjustedLength = Math.max(rest.length, 1),
    c = rest.slice(0, adjustedLength - 1),
    d = rest[adjustedLength - 1]; return [a, b, c, d]; };
  const range = [0, 1, 2, 3];
  const [first, second, others, last] = Array.from(fn(...Array.from(range), 4, ...Array.from([5, 6, 7])));
  eq(0, first);
  eq(1, second);
  arrayEq([2, 3, 4, 5, 6], others);
  return eq(7, last);
});

test("splat variables are local to the function", function() {
  const outer = "x";
  const clobber = (avar, ...outer) => outer;
  clobber("foo", "bar");
  return eq("x", outer);
});


test("Issue 894: Splatting against constructor-chained functions.", function() {

  let x = null;
  class Foo {
    bar(y) { return x = y; }
  }
  new Foo().bar(...Array.from([101] || []));
  return eq(x, 101);
});


test("Functions with splats being called with too few arguments.", function() {

  let pen = null;
  const method = function(first, ...rest) {
    const adjustedLength = Math.max(rest.length, 2),
      variable = rest.slice(0, adjustedLength - 2),
      penultimate = rest[adjustedLength - 2],
      ultimate = rest[adjustedLength - 1];
    return pen = penultimate;
  };
  method(1, 2, 3, 4, 5, 6, 7, 8, 9);
  ok(pen === 8);
  method(1, 2, 3);
  ok(pen === 2);
  method(1, 2);
  return ok(pen === 2);
});


test("splats with super() within classes.", function() {

  class Parent {
    meth(...args) {
      return args;
    }
  }
  class Child extends Parent {
    meth() {
      const nums = [3, 2, 1];
      return super.meth(...Array.from(nums || []));
    }
  }
  return ok((new Child).meth().join(' ') === '3 2 1');
});


test("#1011: passing a splat to a method of a number", function() {
  eq('1011', (11).toString(...Array.from([2] || [])));
  eq('1011', ((31)).toString(...Array.from([3] || [])));
  eq('1011', 69.0.toString(...Array.from([4] || [])));
  return eq('1011', (131.0).toString(...Array.from([5] || [])));
});


test("splats and the `new` operator: functions that return `null` should construct their instance", function() {
  let constructor;
  const args = [];
  const child = new (constructor = () => null)(...Array.from(args || []));
  return ok(child instanceof constructor);
});

test("splats and the `new` operator: functions that return functions should construct their return value", function() {
  let constructor;
  const args = [];
  const fn = function() {};
  const child = new (constructor = () => fn)(...Array.from(args || []));
  ok(!(child instanceof constructor));
  return eq(fn, child);
});

test("implicit return", () =>

  eq(ok, new (function() {
    return ok;
    /* Should `return` implicitly   */
    /* even with trailing comments. */
  })
  )
);


test("implicit returns with multiple branches", function() {
  nonce = {};
  const fn = function() {
    if (false) {
      for (let a of Array.from(b)) {
        if (d) { return c; }
      }
    } else {
      return nonce;
    }
  };
  return eq(nonce, fn());
});


test("implicit returns with switches", function() {
  nonce = {};
  const fn = function() {
    switch (nonce) {
      case nonce: return nonce;
      default: return undefined;
    }
  };
  return eq(nonce, fn());
});


test("preserve context when generating closure wrappers for expression conversions", function() {
  nonce = {};
  const obj = {
    property: nonce,
    method() {
      return this.result = (() => {
        if (false) {
        return 10;
      } else {
        "a";
        "b";
        return this.property;
      }
      })();
    }
  };
  eq(nonce, obj.method());
  return eq(nonce, obj.property);
});


test("don't wrap 'pure' statements in a closure", function() {
  nonce = {};
  const items = [0, 1, 2, 3, nonce, 4, 5];
  const fn = function(items) {
    for (let item of Array.from(items)) {
      if (item === nonce) { return item; }
    }
  };
  return eq(nonce, fn(items));
});


test("usage of `new` is careful about where the invocation parens end up", function() {
  eq('object', typeof new ((() => { try { return Array; } catch (error) {} })()));
  return eq('object', typeof new ((() => function() {})()));
});


test("implicit call against control structures", function() {
  let error;
  let result = null;
  const save   = obj => result = obj;

  save((() => { switch (id(false)) {
    case true:
      return 'true';
    case false:
      return 'false';
  
  } })());

  eq(result, 'false');

  save(id(false) ?
    'false'
  :
    'true'
  );

  eq(result, 'true');

  save(!id(false) ?
    'true'
  :
    'false'
  );

  eq(result, 'true');

  save((() => { try {
    return doesnt(exist);
  } catch (error1) {
    error = error1;
    return 'caught';
  }
   })());

  eq(result, 'caught');

  save((() => { try { return doesnt(exist); } catch (error2) { error = error2; return 'caught2'; } })());

  return eq(result, 'caught2');
});


test("#1420: things like `(fn() ->)`; there are no words for this one", function() {
  const fn = () => f => f();
  nonce = {};
  return eq(nonce, (fn()(() => nonce)));
});

test("#1416: don't omit one 'new' when compiling 'new new'", function() {
  nonce = {};
  const obj = new (new (function() { return () => ({prop: nonce}); }));
  return eq(obj.prop, nonce);
});

test("#1416: don't omit one 'new' when compiling 'new new fn()()'", function() {
  nonce = {};
  const argNonceA = {};
  const argNonceB = {};
  const fn = a => b => ({a, b, prop: nonce});
  const obj = new (new fn(argNonceA))(argNonceB);
  eq(obj.prop, nonce);
  eq(obj.a, argNonceA);
  return eq(obj.b, argNonceB);
});

test("#1840: accessing the `prototype` after function invocation should compile", function() {
  doesNotThrow(() => CoffeeScript.compile('fn()::prop'));

  nonce = {};
  class Test {
    static initClass() {
      this.prototype.id = nonce;
    }
  }
  Test.initClass();

  const dotAccess = () => Test.prototype;
  const protoAccess = () => Test;

  eq(dotAccess().id, nonce);
  return eq(protoAccess().prototype.id, nonce);
});

test("#960: improved 'do'", function() {

  let func;
  (nonExistent => eq(nonExistent, 'one'))('one');

  const overridden = 1;
  (overridden => eq(overridden, 2))(2);

  const two = 2;
  (function(one, two, three) {
    eq(one, 1);
    eq(two, 2);
    return eq(three, 3);
  })(1, two, 3);

  const ret = (func = function(two) {
    eq(two, 2);
    return func;
  })(two);
  return eq(ret, func);
});

test("#2617: implicit call before unrelated implicit object", function() {
  const pass = () => true;

  const result = pass(1) ?
    {one: 1} : undefined;
  return eq(result.one, 1);
});

test("#2292, b: f (z),(x)", function() {
  const f = (x, y) => y;
  const one = 1;
  const two = 2;
  const o = {b: f((one),(two))};
  return eq(o.b, 2);
});

test("#2297, Different behaviors on interpreting literal", function() {
  const foo = (x, y) => y;
  const bar =
    {baz: foo(100, true)};

  eq(bar.baz, true);

  const qux = x => x;
  const quux = qux({
    corge: foo(100, true)});

  eq(quux.corge, true);

  const xyzzy = {
    e: 1,
    f: foo({
      a: 1,
      b: 2
    }
    , {
      one: 1,
      two: 2,
      three: 3
    }
    ),
    g: {
      a: 1,
      b: 2,
      c: foo(2, {
        one: 1,
        two: 2,
        three: 3
      }
      ),
      d: 3
    },
    four: 4,
    h: foo({one: 1, two: 2, three: {three: {three: 3}}},
      2)
  };

  eq(xyzzy.f.two, 2);
  eq(xyzzy.g.c.three, 3);
  eq(xyzzy.four, 4);
  return eq(xyzzy.h, 2);
});

test("#2715, Chained implicit calls", function() {
  const first  = x    => x;
  const second = (x, y) => y;

  const foo = first(first({
    one: 1})
  );
  eq(foo.one, 1);

  const bar = first(second(
    {one: 1}, 2)
  );
  eq(bar, 2);

  const baz = first(second(
    {one: 1},
    2)
  );
  return eq(baz, 2);
});

test("Implicit calls and new", function() {
  const first = x => x;
  const foo = function(x1) {
    this.x = x1;
  };
  const bar = first(new foo(first(1)));
  eq(bar.x, 1);

  const third = (x, y, z) => z;
  const baz = first(new foo(new foo(third({
        one: 1,
        two: 2
      },
        1,
        {three: 3},
        2)
  )
  )
  );
  return eq(baz.x.x.three, 3);
});

test("Loose tokens inside of explicit call lists", function() {
  let bar;
  const first = x => x;
  const second = (x, y) => y;
  const one = 1;

  const foo = second( one,
                2);
  eq(foo, 2);

  return bar = first( first({
               one: 1}));
});

test("Non-callable literals shouldn't compile", function() {
  cantCompile('1(2)');
  cantCompile('1 2');
  cantCompile('/t/(2)');
  cantCompile('/t/ 2');
  cantCompile('///t///(2)');
  cantCompile('///t/// 2');
  cantCompile("''(2)");
  cantCompile("'' 2");
  cantCompile('""(2)');
  cantCompile('"" 2');
  cantCompile('""""""(2)');
  cantCompile('"""""" 2');
  cantCompile('{}(2)');
  cantCompile('{} 2');
  cantCompile('[](2)');
  cantCompile('[] 2');
  cantCompile('[2..9] 2');
  cantCompile('[2..9](2)');
  cantCompile('[1..10][2..9] 2');
  return cantCompile('[1..10][2..9](2)');
});
// Function Literals
// -----------------

// TODO: add indexing and method invocation tests: (->)[0], (->).call()

// * Function Definition
// * Bound Function Definition
// * Parameter List Features
//   * Splat Parameters
//   * Context (@) Parameters
//   * Parameter Destructuring
//   * Default Parameters

// Function Definition

let x = 1;
const y = {};
y.x = () => 3;
ok(x === 1);
ok(typeof(y.x) === 'function');
ok(y.x instanceof Function);
ok(y.x() === 3);

// The empty function should not cause a syntax error.
(function() {});
(function() {});

// Multiple nested function declarations mixed with implicit calls should not
// cause a syntax error.
one => two => three(four, five => six(seven, eight, function(nine) {}));

// with multiple single-line functions on the same line.
let func = x => x => x => x;
ok(func(1)(2)(3) === 3);

// Make incorrect indentation safe.
func = function() {
  const obj = {
          key: 10
        };
  return obj.key - 5;
};
eq(func(), 5);

// Ensure that functions with the same name don't clash with helper functions.
let del = () => 5;
ok(del() === 5);


// Bound Function Definition

let obj = {
  bound() {
    return (() => this)();
  },
  unbound() {
    return (function() { return this; })();
  },
  nested() {
    return (() => {
      return (() => {
        return (() => this)();
      }
      )();
    }
    )();
  }
};
eq(obj, obj.bound());
ok(obj !== obj.unbound());
eq(obj, obj.nested());


test("even more fancy bound functions", function() {
  obj = {
    one() {
      return (() => {
        return this.two();
      })();
    },
    two() {
      return (() => {
        return (() => {
          return (() => {
            return this.three;
          })();
        })();
      })();
    },
    three: 3
  };

  return eq(obj.one(), 3);
});


test("self-referencing functions", function() {
  var changeMe = () => changeMe = 2;

  changeMe();
  return eq(changeMe, 2);
});


// Parameter List Features

test("splats", function() {
  arrayEq([0, 1, 2], (((...splat) => splat)(0, 1, 2)));
  arrayEq([2, 3], (((_, _1, ...splat) => splat)(0, 1, 2, 3)));
  arrayEq([0, 1], ((function(...args) { const adjustedLength = Math.max(args.length, 2),
    splat = args.slice(0, adjustedLength - 2),
    _ = args[adjustedLength - 2],
    _1 = args[adjustedLength - 1]; return splat; })(0, 1, 2, 3)));
  return arrayEq([2], ((function(_, _1, ...rest) { const adjustedLength = Math.max(rest.length, 1),
    splat = rest.slice(0, adjustedLength - 1),
    _2 = rest[adjustedLength - 1]; return splat; })(0, 1, 2, 3)));
});

test("destructured splatted parameters", function() {
  const arr = [0,1,2];
  const splatArray = function(...args) { let a; [...a] = Array.from(args[0]); return a; };
  const splatArrayRest = function(...args) { let a, b; [...a] = Array.from(args[0]), b = args.slice(1, args.length - 0); arrayEq(a,b); return b; };
  arrayEq(splatArray(arr), arr);
  return arrayEq(splatArrayRest(arr,0,1,2), arr);
});

test("@-parameters: automatically assign an argument's value to a property of the context", function() {
  let context;
  nonce = {};

  (function(prop) {
    this.prop = prop;
    }).call((context = {}), nonce);
  eq(nonce, context.prop);

  // allow splats along side the special argument
  (function(...args) {
    let adjustedLength, splat;
    adjustedLength = Math.max(args.length, 1),
      splat = args.slice(0, adjustedLength - 1),
      this.prop = args[adjustedLength - 1];
    }).apply((context = {}), [0, 0, nonce]);
  eq(nonce, context.prop);

  // allow the argument itself to be a splat
  (function(...args) {
    [...this.prop] = Array.from(args);
    }).call((context = {}), 0, nonce, 0);
  eq(nonce, context.prop[1]);

  // the argument should still be able to be referenced normally
  return eq(nonce, ((function(prop) { this.prop = prop; return prop; }).call({}, nonce)));
});

test("@-parameters and splats with constructors", function() {
  const a = {};
  const b = {};
  class Klass {
    constructor(first, ...rest) {
      let adjustedLength, splat;
      this.first = first;
      adjustedLength = Math.max(rest.length, 1),
        splat = rest.slice(0, adjustedLength - 1),
        this.last = rest[adjustedLength - 1];
    }
  }

  obj = new Klass(a, 0, 0, b);
  eq(a, obj.first);
  return eq(b, obj.last);
});

test("destructuring in function definition", () =>
  (function(...args) {
    let array, obj1;
    let b, c;
    array = args.slice(0, args.length - 0), obj1 = array[0], [b] = Array.from(obj1.a), { c } = obj1;
    eq(1, b);
    return eq(2, c);
  })({a: [1], c: 2})
);

test("default values", function() {
  const nonceA = {};
  const nonceB = {};
  const a = function(_,_1,arg) { if (arg == null) { arg = nonceA; } return arg; };
  eq(nonceA, a());
  eq(nonceA, a(0));
  eq(nonceB, a(0,0,nonceB));
  eq(nonceA, a(0,0,undefined));
  eq(nonceA, a(0,0,null));
  eq(false , a(0,0,false));
  eq(nonceB, a(undefined,undefined,nonceB,undefined));
  const b = function(_,arg,_1,_2) { if (arg == null) { arg = nonceA; } return arg; };
  eq(nonceA, b());
  eq(nonceA, b(0));
  eq(nonceB, b(0,nonceB));
  eq(nonceA, b(0,undefined));
  eq(nonceA, b(0,null));
  eq(false , b(0,false));
  eq(nonceB, b(undefined,nonceB,undefined));
  const c = function(arg,_,_1) { if (arg == null) { arg = nonceA; } return arg; };
  eq(nonceA, c());
  eq(0, c(0));
  eq(nonceB, c(nonceB));
  eq(nonceA, c(undefined));
  eq(nonceA, c(null));
  eq(false , c(false));
  return eq(nonceB, c(nonceB,undefined,undefined));
});

test("default values with @-parameters", function() {
  const a = {};
  const b = {};
  obj = {f(q, p) { if (q == null) { q = a; } if (p == null) { p = b; } this.p = p; return q; }};
  eq(a, obj.f());
  return eq(b, obj.p);
});

test("default values with splatted arguments", function() {
  const withSplats = function(a, ...rest) { let adjustedLength, c, d, val1, val2;
  let b; if (a == null) { a = 2; } adjustedLength = Math.max(rest.length, 2),
    b = rest.slice(0, adjustedLength - 2),
    val1 = rest[adjustedLength - 2],
    c = val1 != null ? val1 : 3,
    val2 = rest[adjustedLength - 1],
    d = val2 != null ? val2 : 5; return a * (b.length + 1) * c * d; };
  eq(30, withSplats());
  eq(15, withSplats(1));
  eq(5, withSplats(1,1));
  eq(1, withSplats(1,1,1));
  return eq(2, withSplats(1,1,1,1));
});

test("#156: parameter lists with expansion", function() {
  const expandArguments = function(...args) {
    let first, lastButOne;
    let last;
    first = args[0], lastButOne = args[args.length - 2], last = args[args.length - 1];
    eq(1, first);
    eq(4, lastButOne);
    return last;
  };
  eq(5, expandArguments(1, 2, 3, 4, 5));

  throws((() => CoffeeScript.compile("(..., a, b...) ->")), null, "prohibit expansion and a splat");
  return throws((() => CoffeeScript.compile("(...) ->")),          null, "prohibit lone expansion");
});

test("#156: parameter lists with expansion in array destructuring", function() {
  const expandArray = function(...args) {
    let array;
    let last;
    array = args[args.length - 1], last = array[array.length - 1];
    return last;
  };
  return eq(3, expandArray(1, 2, 3, [1, 2, 3]));
});

test("default values with function calls", () => doesNotThrow(() => CoffeeScript.compile("(x = f()) ->")));

test("arguments vs parameters", function() {
  doesNotThrow(() => CoffeeScript.compile("f(x) ->"));
  const f = g => g();
  return eq(5, f(x => 5));
});

test("#1844: bound functions in nested comprehensions causing empty var statements", function() {
  var a = ([0].map((b) => (() => {
    const result1 = [];
    for (a of [0]) {       result1.push((() => {}));
    }
    return result1;
  })()));
  return eq(1, a.length);
});

test("#1859: inline function bodies shouldn't modify prior postfix ifs", function() {
  const list = [1, 2, 3];
  if (list.some(x => x === 2)) { return ok(true); }
});

test("#2258: allow whitespace-style parameter lists in function definitions", function() {
  func = (
    a, b, c
  ) => c;
  eq(func(1, 2, 3), 3);

  func = (
    a,
    b,
    c
  ) => b;
  return eq(func(1, 2, 3), 2);
});

test("#2621: fancy destructuring in parameter lists", function() {
  func = function(...args) {
    let key1, key2, obj1, obj2;
    let a, b, c;
    obj1 = args[0],
      { key1 } = obj1.prop1,
      obj2 = obj1.prop2,
      { key2 } = obj2,
      [a, b, c] = Array.from(obj2.key3);
    eq(key2, 'key2');
    return eq(a, 'a');
  };

  return func({prop1: {key1: 'key1'}, prop2: {key2: 'key2', key3: ['a', 'b', 'c']}});
});

test("#1435 Indented property access", function() {
  var rec = () => ({rec});

  return eq(1, (function() {
    rec()
      .rec(() =>
        rec()
          .rec(() => rec.rec()).rec()
    );
    return 1;
  })()
  );
});

test("#1038 Optimize trailing return statements", function() {
  const compile = code => CoffeeScript.compile(code, {bare: true}).trim().replace(/\s+/g, " ");

  eq("(function() {});",                 compile("->"));
  eq("(function() {});",                 compile("-> return"));
  eq("(function() { return void 0; });", compile("-> undefined"));
  eq("(function() { return void 0; });", compile("-> return undefined"));
  return eq("(function() { foo(); });",         compile(`\
->
  foo()
  return\
`)
  );
});
// Helpers
// -------

// pull the helpers from `CoffeeScript.helpers` into local variables
({starts, ends, repeat, compact, count, merge, extend, flatten, del, last, baseFileName} = CoffeeScript.helpers);


// `starts`

test("the `starts` helper tests if a string starts with another string", function() {
  ok(starts('01234', '012'));
  return ok(!starts('01234', '123'));
});

test("the `starts` helper can take an optional offset", function() {
  ok(starts('01234', '34', 3));
  return ok(!starts('01234', '01', 1));
});


// `ends`

test("the `ends` helper tests if a string ends with another string", function() {
  ok(ends('01234', '234'));
  return ok(!ends('01234', '012'));
});

test("the `ends` helper can take an optional offset", function() {
  ok(ends('01234', '012', 2));
  return ok(!ends('01234', '234', 6));
});


// `repeat`

test("the `repeat` helper concatenates a given number of times", () => eq('asdasdasd', repeat('asd', 3)));

test("`repeat`ing a string 0 times always returns the empty string", () => eq('', repeat('whatever', 0)));


// `compact`

test("the `compact` helper removes falsey values from an array, preserves truthy ones", function() {
  const allValues = [1, 0, false, (obj={}), [], '', ' ', -1, null, undefined, true];
  const truthyValues = [1, obj, [], ' ', -1, true];
  return arrayEq(truthyValues, compact(allValues));
});


// `count`

test("the `count` helper counts the number of occurances of a string in another string", function() {
  eq(1/0, count('abc', ''));
  eq(0, count('abc', 'z'));
  eq(1, count('abc', 'a'));
  eq(1, count('abc', 'b'));
  eq(2, count('abcdc', 'c'));
  return eq(2, count('abcdabcd','abc'));
});


// `merge`

test("the `merge` helper makes a new object with all properties of the objects given as its arguments", function() {
  const ary = [0, 1, 2, 3, 4];
  obj = {};
  const merged = merge(obj, ary);
  ok(merged !== obj);
  ok(merged !== ary);
  return (() => {
    const result1 = [];
    for (key of Object.keys(ary || {})) {
      const val = ary[key];
      result1.push(eq(val, merged[key]));
    }
    return result1;
  })();
});


// `extend`

test("the `extend` helper performs a shallow copy", function() {
  const ary = [0, 1, 2, 3];
  obj = {};
  // should return the object being extended
  eq(obj, extend(obj, ary));
  // should copy the other object's properties as well (obviously)
  return eq(2, obj[2]);
});


// `flatten`

test("the `flatten` helper flattens an array", function() {
  let success = true;
  for (let n of Array.from(flatten([0, [[[1]], 2], 3, [4]]))) { if (success) { success = typeof n === 'number'; } }
  return ok(success);
});


// `del`

test("the `del` helper deletes a property from an object and returns the deleted value", function() {
  obj = [0, 1, 2];
  eq(1, del(obj, 1));
  return ok(!(1 in obj));
});


// `last`

test("the `last` helper returns the last item of an array-like object", function() {
  const ary = [0, 1, 2, 3, 4];
  return eq(4, last(ary));
});

test("the `last` helper allows one to specify an optional offset", function() {
  const ary = [0, 1, 2, 3, 4];
  return eq(2, last(ary, 2));
});

// `baseFileName`

test("the `baseFileName` helper returns the file name to write to", function() {
  const ext = '.js';
  const sourceToCompiled = {
    '': ext,
    'a': `a${ext}`,
    'b': `b${ext}`,
    'coffee': `coffee${ext}`,

    '.litcoffee': ext,
    'a.litcoffee': `a${ext}`,
    'b.litcoffee': `b${ext}`,
    'coffee.litcoffee': `coffee${ext}`,

    '.lit': ext,
    'a.lit': `a${ext}`,
    'b.lit': `b${ext}`,
    'coffee.lit': `coffee${ext}`,

    '.md': ext,
    'a.md': `a${ext}`,
    'b.md': `b${ext}`,
    'coffee.md': `coffee${ext}`
  };

  return (() => {
    const result1 = [];
    for (let sourceFileName in sourceToCompiled) {
      const expectedFileName = sourceToCompiled[sourceFileName];
      const name = baseFileName(sourceFileName, true);
      const filename = name + ext;
      result1.push(eq(filename, expectedFileName));
    }
    return result1;
  })();
});
// Importing
// ---------

if ((typeof window === 'undefined' || window === null) && (typeof testingBrowser === 'undefined' || testingBrowser === null)) {
  test("coffeescript modules can be imported and executed", function() {

    const magicKey = __filename;
    const magicValue = 0xFFFF;

    if (global[magicKey] != null) {
      if (typeof exports !== 'undefined' && exports !== null) {
        const local = magicValue;
        return exports.method = () => local;
      }
    } else {
      global[magicKey] = {};
      if ((typeof require !== 'undefined' && require !== null ? require.extensions : undefined) != null) {
        ok(require(__filename).method() === magicValue);
      }
      return delete global[magicKey];
    }
});

  test("javascript modules can be imported", function() {
    const magicVal = 1;
    return Array.from('import.js import2 .import2 import.extension.js import.unknownextension  .md'.split(' ')).map((module) =>
      ok(__guardMethod__(require(`./importing/${module}`), 'value', o => o.value()) === magicVal, module));
  });

  test("coffeescript modules can be imported", function() {
    const magicVal = 2;
    return Array.from('.import import import.extension'.split(' ')).map((module) =>
      ok(__guardMethod__(require(`./importing/${module}`), 'value', o => o.value()) === magicVal, module));
  });

  test("literate coffeescript modules can be imported", function() {
    const magicVal = 3;
    // Leading space intentional to check for index.md
    return Array.from(' .import.md import.md import.litcoffee import.extension.md'.split(' ')).map((module) =>
      ok(__guardMethod__(require(`./importing/${module}`), 'value', o => o.value()) === magicVal, module));
  });
}
// Interpolation
// -------------

// * String Interpolation
// * Regular Expression Interpolation

// String Interpolation

// TODO: refactor string interpolation tests

eq('multiline nested "interpolations" work', `multiline ${
  `nested ${
    ok(true),
    "\"interpolations\""
  }`
} work`
);

// Issue #923: Tricky interpolation.
eq(`${ "{" }`, "{");
eq(`${ '#{}}' } }`, '#{}} }');
eq(`${`'${ ({a: `b${1}`}['a']) }'`}`, "'b1'");

// Issue #1150: String interpolation regression
eq(`${'"/'}`,                '"/');
eq(`${"/'"}`,                "/'");
eq(`${/'"/}`,                '/\'"/');
eq(`${`'//"${/"'/}`}`,  '\'//"/"\'/');
eq(`${"'/"}${'/"'}${/"'/}`,  '\'//"/"\'/');
eq(`${6 / 2}`,               '3');
eq(`${6 / 2}${6 / 2}`,       '33'); // parsed as division
eq(`${6 + /2}#{6/ + 2}`,     '6/2}#{6/2'); // parsed as a regex
eq(`${6/2} \
${6/2}`,                 '3 3'); // newline cannot be part of a regex, so it's division
eq(`${new RegExp(`"'/'"/"`)}`,     '/"\'\\/\'"\\/"/'); // heregex, stuffed with spicy characters
eq(`${/\\'/}`,               "/\\\\'/");

const hello = 'Hello';
const world = 'World';
ok('#{hello} #{world}!' === '#{hello} #{world}!');
ok(`${hello} ${world}!` === 'Hello World!');
ok(`[${hello}${world}]` === '[HelloWorld]');
ok(`${hello}#${world}` === 'Hello#World');
ok(`Hello ${ 1 + 2 } World` === 'Hello 3 World');
ok(`${hello} ${ 1 + 2 } ${world}` === "Hello 3 World");

let [s, t, r, i, n, g] = Array.from(['s', 't', 'r', 'i', 'n', 'g']);
ok(`${s}${t}${r}${i}${n}${g}` === 'string');
ok("\#{s}\#{t}\#{r}\#{i}\#{n}\#{g}" === '#{s}#{t}#{r}#{i}#{n}#{g}');
ok("\#{string}" === '#{string}');

ok("\#{Escaping} first" === '#{Escaping} first');
ok("Escaping \#{in} middle" === 'Escaping #{in} middle');
ok("Escaping \#{last}" === 'Escaping #{last}');

ok("##" === '##');
ok(`` === '');
ok(`A  B` === 'A  B');
ok("\\\#{}" === '\\#{}');

ok(`I won #${20} last night.` === 'I won #20 last night.');
ok(`I won #${'#20'} last night.` === 'I won ##20 last night.');

ok(`${hello + world}` === 'HelloWorld');
ok(`${hello + ' ' + world + '!'}` === 'Hello World!');

let list = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
ok(`values: ${list.join(', ')}, length: ${list.length}.` === 'values: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, length: 10.');
ok(`values: ${list.join(' ')}` === 'values: 0 1 2 3 4 5 6 7 8 9');

obj = {
  name: 'Joe',
  hi() { return `Hello ${this.name}.`; },
  cya() { return `Hello ${this.name}.`.replace('Hello','Goodbye'); }
};
ok(obj.hi() === "Hello Joe.");
ok(obj.cya() === "Goodbye Joe.");

ok(`With ${"quotes"}` === 'With quotes');
ok('With #{"quotes"}' === 'With #{"quotes"}');

ok(`Where is ${obj["name"] + '?'}` === 'Where is Joe?');

ok(`Where is ${`the nested ${obj["name"]}`}?` === 'Where is the nested Joe?');
ok(`Hello ${world != null ? world : `${hello}`}` === 'Hello World');

ok(`Hello ${`${`${obj["name"]}` + '!'}`}` === 'Hello Joe!');

let a = `\
Hello ${ "Joe" }\
`;
ok(a === "Hello Joe");

a = 1;
var b = 2;
var c = 3;
ok(`${a}${b}${c}` === '123');

let result = null;
const stash = str => result = str;
stash(`a ${ ('aa').replace(/a/g, 'b') } c`);
ok(result === 'a bb c');

let foo = "hello";
ok(`${foo.replace("\"", "")}` === 'hello');

let val = 10;
a = `\
basic heredoc ${val}
on two lines\
`;
b = `\
basic heredoc #{val}
on two lines\
`;
ok(a === "basic heredoc 10\non two lines");
ok(b === "basic heredoc \#{val}\non two lines");

eq('multiline nested "interpolations" work', `multiline ${
  `nested ${(function() {
    ok(true);
    return "\"interpolations\"";
  })()}`
} work`
);


// Regular Expression Interpolation

// TODO: improve heregex interpolation tests

test("heregex interpolation", () =>
  eq(/\\#{}\\\"/ + '', new RegExp(`\
${
     `${ '\\' }` // normal comment
   }\
\
\\#{}\
\\\\\\"\
`) + ''
  )
);
// Javascript Literals
// -------------------

// TODO: refactor javascript literal tests
// TODO: add indexing and method invocation tests: `[1]`[0] is 1, `function(){}`.call()

eq('\\`', 
  // Inline JS
  "\`"

);
const testScript = `\
if true
  x = 6
  console.log "A console #{x + 7} log"

foo = "bar"
z = /// ^ (a#{foo}) ///

x = () ->
    try
        console.log "foo"
    catch err
        # Rewriter will generate explicit indentation here.

    return null\
`;

test("Verify location of generated tokens", function() {
  const tokens = CoffeeScript.tokens("a = 79");

  eq(tokens.length, 4);

  const aToken = tokens[0];
  eq(aToken[2].first_line, 0);
  eq(aToken[2].first_column, 0);
  eq(aToken[2].last_line, 0);
  eq(aToken[2].last_column, 0);

  const equalsToken = tokens[1];
  eq(equalsToken[2].first_line, 0);
  eq(equalsToken[2].first_column, 2);
  eq(equalsToken[2].last_line, 0);
  eq(equalsToken[2].last_column, 2);

  const numberToken = tokens[2];
  eq(numberToken[2].first_line, 0);
  eq(numberToken[2].first_column, 4);
  eq(numberToken[2].last_line, 0);
  return eq(numberToken[2].last_column, 5);
});

test("Verify location of generated tokens (with indented first line)", function() {
  const tokens = CoffeeScript.tokens("  a = 83");

  eq(tokens.length, 4);
  const [aToken, equalsToken, numberToken] = Array.from(tokens);

  eq(aToken[2].first_line, 0);
  eq(aToken[2].first_column, 2);
  eq(aToken[2].last_line, 0);
  eq(aToken[2].last_column, 2);

  eq(equalsToken[2].first_line, 0);
  eq(equalsToken[2].first_column, 4);
  eq(equalsToken[2].last_line, 0);
  eq(equalsToken[2].last_column, 4);

  eq(numberToken[2].first_line, 0);
  eq(numberToken[2].first_column, 6);
  eq(numberToken[2].last_line, 0);
  return eq(numberToken[2].last_column, 7);
});

test("Verify locations in string interpolation", function() {
  let closeParen, firstPlus, openParen, secondPlus;
  const tokens = CoffeeScript.tokens('"a#{b}c"');

  eq(tokens.length, 8);
  [openParen, a, firstPlus, b, secondPlus, c, closeParen] = Array.from(tokens);

  eq(a[2].first_line, 0);
  eq(a[2].first_column, 1);
  eq(a[2].last_line, 0);
  eq(a[2].last_column, 1);

  eq(b[2].first_line, 0);
  eq(b[2].first_column, 4);
  eq(b[2].last_line, 0);
  eq(b[2].last_column, 4);

  eq(c[2].first_line, 0);
  eq(c[2].first_column, 6);
  eq(c[2].last_line, 0);
  return eq(c[2].last_column, 6);
});

test("Verify all tokens get a location", () =>
  doesNotThrow(function() {
    const tokens = CoffeeScript.tokens(testScript);
    return Array.from(tokens).map((token) =>
        ok(!!token[2]));})
);
// Number Literals
// ---------------

// * Decimal Integer Literals
// * Octal Integer Literals
// * Hexadecimal Integer Literals
// * Scientific Notation Integer Literals
// * Scientific Notation Non-Integer Literals
// * Non-Integer Literals
// * Binary Integer Literals


// Binary Integer Literals
// Binary notation is understood as would be decimal notation.

test("Parser recognises binary numbers", () => eq(4, 0b100));

// Decimal Integer Literals

test("call methods directly on numbers", function() {
  eq(4, (4).valueOf());
  return eq('11', (4).toString(3));
});

eq(-1, 3 -4);

//764: Numbers should be indexable
eq(Number.prototype.toString, 42['toString']);

eq(Number.prototype.toString, (42).toString);


// Non-Integer Literals

// Decimal number literals.
let value = .25 + .75;
ok(value === 1);
value = ((0.0 + -.25) - -.75) + 0.0;
ok(value === 0.5);

//764: Numbers should be indexable
eq(Number.prototype.toString,   4['toString']);
eq(Number.prototype.toString, 4.2['toString']);
eq(Number.prototype.toString, .42['toString']);
eq(Number.prototype.toString, (4)['toString']);

eq(Number.prototype.toString,   (4).toString);
eq(Number.prototype.toString, 4.2.toString);
eq(Number.prototype.toString, .42.toString);
eq(Number.prototype.toString, ((4)).toString);

test('#1168: leading floating point suppresses newline', () =>
  eq(1, (function() {
    1;
    return .5 + 0.5;
  })()
  )
);

test("Python-style octal literal notation '0o777'", function() {
  eq(511, 0o777);
  eq(1, 0o1);
  eq(1, 0o00001);
  eq(parseInt('0777', 8), 0o777);
  eq('777', (0o777).toString(8));
  eq(4, (0o4).valueOf());
  eq(Number.prototype.toString, 0o777['toString']);
  return eq(Number.prototype.toString, (0o777).toString);
});

test("#2060: Disallow uppercase radix prefixes and exponential notation", () =>
  (() => {
    const result1 = [];
    for (let char of ['b', 'o', 'x', 'e']) {
      var program = `0${char}0`;
      doesNotThrow(() => CoffeeScript.compile(program, {bare: true}));
      result1.push(throws(() => CoffeeScript.compile(program.toUpperCase(), {bare: true})));
    }
    return result1;
  })()
);

test("#2224: hex literals with 0b or B or E", function() {
  eq(176, 0x0b0);
  eq(177, 0x0B1);
  return eq(225, 0xE1);
});
// Object Literals
// ---------------

// TODO: refactor object literal tests
// TODO: add indexing and method invocation tests: {a}['a'] is a, {a}.a()

const trailingComma = {k1: "v1", k2: 4, k3() { return true; },};
ok(trailingComma.k3() && (trailingComma.k2 === 4) && (trailingComma.k1 === "v1"));

ok({a(num) { return num === 10; } }.a(10));

const moe = {
  name:  'Moe',
  greet(salutation) {
    return salutation + " " + this.name;
  },
  hello() {
    return this['greet']("Hello");
  },
  10: 'number'
};
ok(moe.hello() === "Hello Moe");
ok(moe[10] === 'number');
moe.hello = function() {
  return this['greet']("Hello");
};
ok(moe.hello() === 'Hello Moe');

obj = {
  is() { return true; },
  'not'() { return false; },
};
ok(obj.is());
ok(!obj.not());

({
  /* Top-level object literal... */
  obj: 1
  /* ...doesn't break things. */
});

// Object literals should be able to include keywords.
obj = {class: 'höt'};
obj.function = 'dog';
ok((obj.class + obj.function) === 'hötdog');

// Implicit objects as part of chained calls.
const pluck = x => x.a;
eq(100, pluck(pluck(pluck({a: {a: {a: 100}}}))));


test("YAML-style object literals", function() {
  obj = {
    a: 1,
    b: 2
  };
  eq(1, obj.a);
  eq(2, obj.b);

  const config = {
    development: {
      server: 'localhost',
      timeout: 10
    },

    production: {
      server: 'dreamboat',
      timeout: 1000
    }
  };

  ok(config.development.server  === 'localhost');
  ok(config.production.server   === 'dreamboat');
  ok(config.development.timeout === 10);
  return ok(config.production.timeout  === 1000);
});

obj = {
  a: 1,
  b: 2,
};
ok(obj.a === 1);
ok(obj.b === 2);

// Implicit objects nesting.
obj = {
  options: {
    value: true
  },
  fn() {
    ({});
    return null;
  }
};
ok(obj.options.value === true);
ok(obj.fn() === null);

// Implicit objects with wacky indentation:
obj = {
  'reverse'(obj) {
    return Array.prototype.reverse.call(obj);
  },
  abc() {
    return this.reverse(
      this.reverse(this.reverse(['a', 'b', 'c'].reverse()))
    );
  },
  one: [1, 2,
    {a: 'b'},
  3, 4],
  red: {
    orange: {
          yellow: {
                  green: 'blue'
                }
        },
    indigo: 'violet'
  },
  misdent: [[],
  [],
                  [],
      []]
};
ok(obj.abc().join(' ') === 'a b c');
ok(obj.one.length === 5);
ok(obj.one[4] === 4);
ok(obj.one[2].a === 'b');
ok(((() => {
  const result1 = [];
  for (key in obj.red) {
    result1.push(key);
  }
  return result1;
})()).length === 2);
ok(obj.red.orange.yellow.green === 'blue');
ok(obj.red.indigo === 'violet');
ok(obj.misdent.toString() === ',,,');

//542: Objects leading expression statement should be parenthesized.
({f() { return ok(true); } }.f() + 1);

// String-keyed objects shouldn't suppress newlines.
var one =
  {'>!': 3};
({six() { return 10; }});
ok(!one.six);

// Shorthand objects with property references.
obj = {
  /* comment one */
  /* comment two */
  one: 1,
  two: 2,
  object() { return {one: this.one, two: this.two}; },
  list() { return [this.one, this.two]; }
};
result = obj.object();
eq(result.one, 1);
eq(result.two, 2);
eq(result.two, obj.list()[1]);

let third = (a, b, c) => c;
obj = {
  one: 'one',
  two: third('one', 'two', 'three')
};
ok(obj.one === 'one');
ok(obj.two === 'three');

test("invoking functions with implicit object literals", function() {
  const generateGetter = prop => obj => obj[prop];
  const getA = generateGetter('a');
  const getArgs = function() { return arguments; };
  a = (b = 30);

  result = getA({
    a: 10});
  eq(10, result);

  result = getA({
    "a": 20});
  eq(20, result);

  result = getA(a,
    {b:1});
  eq(undefined, result);

  result = getA({b:1,
  a:43
  });
  eq(43, result);

  result = getA({b:1},
    {a:62});
  eq(undefined, result);

  result = getA(
    {b:1},
    a);
  eq(undefined, result);

  result = getA({
    a: {
      b:2
    },
    b:1
  });
  eq(2, result.b);

  result = getArgs(
    {a:1},
    b,
    {c:1});
  ok(result.length === 3);
  ok(result[2].c === 1);

  result = getA({b: 13, a: 42}, 2);
  eq(42, result);

  result = getArgs({a:1}, (1 + 1));
  ok(result[1] === 2);

  result = getArgs({a:1}, b);
  ok(result.length === 2);
  ok(result[1] === 30);

  result = getArgs({a:1}, b, {b:1}, a);
  ok(result.length === 4);
  ok(result[2].b === 1);

  return throws(() => CoffeeScript.compile("a = b:1, c"));
});

test("some weird indentation in YAML-style object literals", function() {
  const two = (a, b) => b;
  obj = two(1, {
    1: 1,
    a: {
      b() {
        return fn(c,
          {d: e});
      }
    },
    f: 1
  }
  );
  return eq(1, obj[1]);
});

test("#1274: `{} = a()` compiles to `false` instead of `a()`", function() {
  a = false;
  const fn = () => a = true;
  const obj1 = fn();
  return ok(a);
});

test("#1436: `for` etc. work as normal property names", function() {
  obj = {};
  eq(false, obj.hasOwnProperty('for'));
  obj.for = 'foo' in obj;
  return eq(true, obj.hasOwnProperty('for'));
});

test("#2706, Un-bracketed object as argument causes inconsistent behavior", function() {
  foo = (x, y) => y;
  const bar = {baz: true};

  return eq(true, foo({x: 1}, bar.baz));
});

test("#2608, Allow inline objects in arguments to be followed by more arguments", function() {
  foo = (x, y) => y;

  return eq(true, foo({x: 1, y: 2}, true));
});

test("#2308, a: b = c:1", function() {
  foo = {a: (b = {c: true})};
  eq(b.c, true);
  return eq(foo.a.c, true);
});

test("#2317, a: b c: 1", function() {
  foo = x => x;
  const bar = {a: foo({c: true})};
  return eq(bar.a.c, true);
});

test("#1896, a: func b, {c: d}", function() {
  const first = x => x;
  const second = (x, y) => y;
  third = (x, y, z) => z;

  one = 1;
  const two = 2;
  const three = 3;
  const four = 4;

  foo = {a: second(one, {c: two})};
  eq(foo.a.c, two);

  const bar = {a: second(one, {c: two})};
  eq(bar.a.c, two);

  const baz = {a: second(one, {c: two}, {e: first(first({h: three}))})};
  eq(baz.a.c, two);

  const qux = {a: third(one, {c: two}, {e: first(first({h: three}))})};
  eq(qux.a.e.h, three);

  const quux = {a: third(one, {c: two}, {e: first(three), h: four})};
  eq(quux.a.e, three);
  eq(quux.a.h, four);

  const corge = {a: third(one, {c: two}, {e: second(three, {h: four})})};
  return eq(corge.a.e.h, four);
});

test("Implicit objects, functions and arrays", function() {
  const first  = x => x;
  const second = (x, y) => y;

  foo = [
    1, {
    one: 1,
    two: 2,
    three: 3,
    more: {
      four: 4,
      five: 5, six: 6
    }
  },
    2, 3, 4,
    5];
  eq(foo[2], 2);
  eq(foo[1].more.six, 6);

  const bar = [
    1,
    first(first(first(second(1,
      {one: 1, twoandthree: {twoandthree: {two: 2, three: 3}}},
      2)
    )
    )
    ),
    2, {
    one: 1,
    two: 2,
    three: first(second(() => false
    , () => 3)
    )
  },
    3,
    4];
  eq(bar[2], 2);
  eq(bar[1].twoandthree.twoandthree.two, 2);
  eq(bar[3].three(), 3);
  return eq(bar[4], 3);
});

test("#2549, Brace-less Object Literal as a Second Operand on a New Line", function() {
  foo = false ||{
    one: 1,
    two: 2,
    three: 3
  };
  eq(foo.one, 1);

  const bar = true && {one: 1};
  eq(bar.one, 1);

  const baz = null != null ? null : {
    one: 1,
    two: 2
  };
  return eq(baz.two, 2);
});

test("#2757, Nested", function() {
  foo = {
    bar: {
      one: 1
    }
  };
  eq(foo.bar.one, 1);

  const baz = {
    qux: {
      one: 1
    },
    corge: {
      two: 2,
      three: { three: {three: 3}
    }
    },
    xyzzy: {
      thud: {
        four: {
          four: 4
        }
      },
      five: 5
    }
  };

  eq(baz.qux.one, 1);
  eq(baz.corge.three.three.three, 3);
  eq(baz.xyzzy.thud.four.four, 4);
  return eq(baz.xyzzy.five, 5);
});

test("#1865, syntax regression 1.1.3", function() {
  foo = (x, y) => y;

  const bar = { a: foo((function() {}),
    {c: true})
};
  eq(bar.a.c, true);

  const baz = {a: foo((function() {}), {c: true})};
  return eq(baz.a.c, true);
});


test("#1322: implicit call against implicit object with block comments", () =>
  (function(obj, arg) {
    eq(obj.x * obj.y, 6);
    return ok(!arg);
  })({
    /*
    x
    */
    x: 2,
    /* y */
    y: 3
  })
);

test("#1513: Top level bare objs need to be wrapped in parens for unary and existence ops", function() {
  doesNotThrow(() => CoffeeScript.run("{}?", {bare: true}));
  return doesNotThrow(() => CoffeeScript.run("{}.a++", {bare: true}));
});

test("#1871: Special case for IMPLICIT_END in the middle of an implicit object", function() {
  result = 'result';
  const ident = x => x;

  if (false) { result = ident({one: 1}); }

  eq(result, 'result');

  result = ident({
    one: 1,
    two: ((() => {
      const result2 = [];
      for (i = 1; i <= 3; i++) {
        result2.push(2);
      }
      return result2;
    })())});

  return eq(result.two.join(' '), '2 2 2');
});

test("#1871: implicit object closed by IMPLICIT_END in implicit returns", function() {
  const ob = (function() {
    if (false) { return {a: 1}; }
  })();
  eq(ob, undefined);

  // instead these return an object
  func = () =>
    ({
      key:
        ((() => {
        const result2 = [];
        for (i of [1, 2, 3]) {           result2.push(i);
        }
        return result2;
      })())
    })
  ;

  eq(func().key.join(' '), '1 2 3');

  func = () =>
    ({key: (((() => {
      const result2 = [];
      for (i of [1, 2, 3]) {         result2.push(i);
      }
      return result2;
    })()))})
  ;

  return eq(func().key.join(' '), '1 2 3');
});

test("#1961, #1974, regression with compound assigning to an implicit object", function() {

  obj = null;

  if (obj == null) { obj = {
    one: 1,
    two: 2
  }; }

  eq(obj.two, 2);

  obj = null;

  if (!obj) { obj =  {
    three: 3,
    four: 4
  }; }

  return eq(obj.four, 4);
});

test("#2207: Immediate implicit closes don't close implicit objects", function() {
  func = () =>
    ({key: (() => {
      const result2 = [];
      for (i of [1, 2, 3]) {         result2.push(i);
      }
      return result2;
    })()})
  ;

  return eq(func().key.join(' '), '1 2 3');
});

test("#3216: For loop declaration as a value of an implicit object", function() {
  let i, v;
  const test = [0, 1, 2];
  const ob = {
    a: (() => {
      const result2 = [];
      for (i = 0; i < test.length; i++) {
        v = test[i];
        result2.push(i);
      }
      return result2;
    })(),
    b: (() => {
      const result3 = [];
      for (i = 0; i < test.length; i++) {
        v = test[i];
        result3.push(i);
      }
      return result3;
    })(),
    c: (() => {
      const result4 = [];
      for (let j = 0; j < test.length; j++) {
        v = test[j];
        result4.push(v);
      }
      return result4;
    })(),
    d: (() => {
      const result5 = [];
      for (v of Array.from(test)) {         if (true) {
          result5.push(v);
        }
      }
      return result5;
    })()
  };
  arrayEq(ob.a, test);
  arrayEq(ob.b, test);
  arrayEq(ob.c, test);
  return arrayEq(ob.d, test);
});

test('inline implicit object literals within multiline implicit object literals', function() {
  x = {
    a: { aa: 0
  },
    b: 0
  };
  eq(0, x.b);
  return eq(0, x.a.aa);
});
// Operators
// ---------

// * Operators
// * Existential Operator (Binary)
// * Existential Operator (Unary)
// * Aliased Operators
// * [not] in/of
// * Chained Comparison

test("binary (2-ary) math operators do not require spaces", function() {
  a = 1;
  b = -1;
  eq(+1, a*-b);
  eq(-1, a*+b);
  eq(+1, a/-b);
  return eq(-1, a/+b);
});

test("operators should respect new lines as spaced", function() {
  a = 123 +
  456;
  eq(579, a);

  b = `1${2}3` +
  "456";
  return eq('123456', b);
});

test("multiple operators should space themselves", () => eq((+ +1), (- -1)));

test("compound operators on successive lines", function() {
  a = 1;
  a +=
  1;
  return eq(a, 2);
});

test("bitwise operators", function() {
  eq(2, (10 &   3));
  eq(11, (10 |   3));
  eq(9, (10 ^   3));
  eq(80, (10 <<  3));
  eq(1, (10 >>  3));
  eq(1, (10 >>> 3));
  let num = 10; eq(2, (num &=   3));
  num = 10; eq(11, (num |=   3));
  num = 10; eq(9, (num ^=   3));
  num = 10; eq(80, (num <<=  3));
  num = 10; eq(1, (num >>=  3));
  num = 10; return eq(1, (num >>>= 3));
});

test("`instanceof`", function() {
  ok(new String instanceof String);
  ok(new Boolean instanceof Boolean);
  // `instanceof` supports negation by prefixing the operator with `not`
  ok(!(new Number instanceof String));
  return ok(!(new Array instanceof Boolean));
});

test("use `::` operator on keywords `this` and `@`", function() {
  nonce = {};
  obj = {
    withAt() { return this.prototype.prop; },
    withThis() { return this.prototype.prop; }
  };
  obj.prototype = {prop: nonce};
  eq(nonce, obj.withAt());
  return eq(nonce, obj.withThis());
});


// Existential Operator (Binary)

test("binary existential operator", function() {
  nonce = {};

  b = a != null ? a : nonce;
  eq(nonce, b);

  a = null;
  b = undefined;
  b = a != null ? a : nonce;
  eq(nonce, b);

  a = false;
  b = a != null ? a : nonce;
  eq(false, b);

  a = 0;
  b = a != null ? a : nonce;
  return eq(0, b);
});

test("binary existential operator conditionally evaluates second operand", function() {
  let left;
  i = 1;
  func = () => i -= 1;
  result = (left = func()) != null ? left : func();
  return eq(result, 0);
});

test("binary existential operator with negative number", function() {
  a = null != null ? null : - 1;
  return eq(-1, a);
});


// Existential Operator (Unary)

test("postfix existential operator", function() {
  ok(((typeof nonexistent !== 'undefined' && nonexistent !== null) ? false : true));
  let defined = true;
  ok(defined != null);
  defined = false;
  return ok(defined != null);
});

test("postfix existential operator only evaluates its operand once", function() {
  let semaphore = 0;
  const fn = function() {
    if (semaphore) { ok(false); }
    return ++semaphore;
  };
  return ok((fn() != null) ? true : false);
});

test("negated postfix existential operator", () => ok(!(typeof nothing !== 'undefined' && nothing !== null ? nothing.value : undefined)));

test("postfix existential operator on expressions", () => eq(true, ((1 || 0) != null), true));


// `is`,`isnt`,`==`,`!=`

test("`==` and `is` should be interchangeable", function() {
  a = (b = 1);
  ok((a === 1) && (b === 1));
  ok(a === b);
  return ok(a === b);
});

test("`!=` and `isnt` should be interchangeable", function() {
  a = 0;
  b = 1;
  ok((a !== 1) && (b !== 0));
  ok(a !== b);
  return ok(a !== b);
});


// [not] in/of

// - `in` should check if an array contains a value using `indexOf`
// - `of` should check if a property is defined on an object using `in`
test("in, of", function() {
  const arr = [1];
  ok(0 in arr);
  ok(Array.from(arr).includes(1));
  // prefixing `not` to `in and `of` should negate them
  ok(!(1 in arr));
  return ok(!Array.from(arr).includes(0));
});

test("`in` should be able to operate on an array literal", function() {
  let needle, needle1;
  ok([0, 1, 2, 3].includes(2));
  ok(![0, 1, 2, 3].includes(4));
  let arr = [0, 1, 2, 3];
  ok(Array.from(arr).includes(2));
  ok(!Array.from(arr).includes(4));
  // should cache the value used to test the array
  arr = [0];
  val = 0;
  ok((needle = val++, Array.from(arr).includes(needle)));
  ok((needle1 = val++, !Array.from(arr).includes(needle1)));
  val = 0;
  ok(val++ in arr);
  return ok(!(val++ in arr));
});

test("`of` and `in` should be able to operate on instance variables", function() {
  obj = {
    list: [2,3],
    in_list(value) { return Array.from(this.list).includes(value); },
    not_in_list(value) { return !Array.from(this.list).includes(value); },
    of_list(value) { return value in this.list; },
    not_of_list(value) { return !(value in this.list); }
  };
  ok(obj.in_list(3));
  ok(obj.not_in_list(1));
  ok(obj.of_list(0));
  return ok(obj.not_of_list(2));
});

test("#???: `in` with cache and `__indexOf` should work in argument lists", function() {
  let needle;
  return eq(1, [(needle = Object(), Array.from(Array()).includes(needle))].length);
});

test("#737: `in` should have higher precedence than logical operators", () => eq(1, [1].includes(1) && 1));

test("#768: `in` should preserve evaluation order", function() {
  let needle;
  let share = 0;
  a = function() { if (share === 0) { return share++; } };
  b = function() { if (share === 1) { return share++; } };
  c = function() { if (share === 2) { return share++; } };
  ok((needle = a(), ![b(),c()].includes(needle)));
  return eq(3, share);
});

test("#1099: empty array after `in` should compile to `false`", function() {
  eq(1, [[].includes(5)].length);
  return eq(false, (() => [].includes(0))());
});

test("#1354: optimized `in` checks should not happen when splats are present", function() {
  let needle;
  a = [6, 9];
  return eq((needle = 9, [3, ...Array.from(a)].includes(needle)), true);
});

test("#1100: precedence in or-test compilation of `in`", function() {
  ok([1 && 0].includes(0));
  ok([1, 1 && 0].includes(0));
  return ok(!([1, 0 || 1].includes(0)));
});

test("#1630: `in` should check `hasOwnProperty`", function() {
  let needle;
  return ok((needle = undefined, !Array.from({length: 1}).includes(needle)));
});

test("#1714: lexer bug with raw range `for` followed by `in`", function() {
  for (let j = 1; j <= 2; j++) { 0; }
  ok(!(['b'].includes('a')));

  for (let k = 1; k <= 2; k++) { 0; } ok(!(['b'].includes('a')));

  for (let i1 = 1; i1 <= 10; i1++) { 0; } // comment ending
  return ok(!(['b'].includes('a')));
});

test("#1099: statically determined `not in []` reporting incorrect result", () => ok(![].includes(0)));

test("#1099: make sure expression tested gets evaluted when array is empty", function() {
  let needle;
  a = 0;
  ((needle = (() => a = 1)()), [].includes(needle));
  return eq(a, 1);
});

// Chained Comparison

test("chainable operators", function() {
  ok(100 > 10 && 10 > 1 && 1 > 0 && 0 > -1);
  return ok(-1 < 0 && 0 < 1 && 1 < 10 && 10 < 100);
});

test("`is` and `isnt` may be chained", function() {
  ok(true === !false && !false === true && true === !false);
  return ok(0 === 0 && 0 !== 1 && 1 === 1);
});

test("different comparison operators (`>`,`<`,`is`,etc.) may be combined", function() {
  let middle;
  ok(1 < 2 && 2 > 1);
  return ok(10 < 20 && 20 > (middle = 2+3) && middle === 5);
});

test("some chainable operators can be negated by `unless`", () => ok((0!==10 || 10===100 ? true : undefined)));

test("operator precedence: `|` lower than `<`", () => eq(1, 1 | (2 < 3 && 3 < 4)));

test("preserve references", function() {
  a = (b = (c = 1));
  // `a == b <= c` should become `a === b && b <= c`
  // (this test does not seem to test for this)
  return ok(a === b && b <= c);
});

test("chained operations should evaluate each value only once", function() {
  let middle;
  a = 0;
  return ok(1 > (middle = a++) && middle < 1);
});

test("#891: incorrect inversion of chained comparisons", () => ok((!(0 > 1 && 1 > 2) ? true : undefined)));

test("#1234: Applying a splat to :: applies the splat to the wrong object", function() {
  nonce = {};
  class C {
    static initClass() {
      this.prototype.nonce = nonce;
    }
    method() { return this.nonce; }
  }
  C.initClass();

  const arr = [];
  return eq(nonce, C.prototype.method(...Array.from(arr || [])));
}); // should be applied to `C::`

test("#1102: String literal prevents line continuation", () =>
  eq("': '", '' +
     "': '"
  )
);

test("#1703, ---x is invalid JS", function() {
  x = 2;
  return eq((- --x), -1);
});

test("Regression with implicit calls against an indented assignment", function() {
  eq(1, (a =
    1)
  );

  return eq(a, 1);
});

test("#2155 ... conditional assignment to a closure", function() {
  x = null;
  func = () => x != null ? x : (x = (function() { if (true) { return 'hi'; } }));
  func();
  return eq(x(), 'hi');
});

test("#2197: Existential existential double trouble", function() {
  let counter = 0;
  func = () => counter++;
  if ((func() != null) == null) { 100; }
  return eq(counter, 1);
});

test("#2567: Optimization of negated existential produces correct result", function() {
  a = 1;
  ok(!((a == null)));
  return ok((b == null));
});

test("#2508: Existential access of the prototype", function() {
  eq(typeof NonExistent !== 'undefined' && NonExistent !== null ? NonExistent.prototype.nothing : undefined, undefined);
  return ok(Object != null ? Object.prototype.toString : undefined);
});

test("power operator", () => eq(27, Math.pow(3, 3)));

test("power operator has higher precedence than other maths operators", function() {
  eq(55, 1 + (Math.pow(3, 3) * 2));
  eq(-4, -Math.pow(2, 2));
  eq(false, !Math.pow(2, 2));
  eq(0, Math.pow((!2), 2));
  return eq(-2, ~Math.pow(1, 5));
});

test("power operator is right associative", () => eq(2, Math.pow(2, Math.pow(1, 3))));

test("power operator compound assignment", function() {
  a = 2;
  a **= 3;
  return eq(8, a);
});

test("floor division operator", function() {
  eq(2, Math.floor(7 / 3));
  eq(-3, Math.floor(-7 / 3));
  return eq(NaN, Math.floor(0 / 0));
});

test("floor division operator compound assignment", function() {
  a = 7;
  a = Math.floor(a / 2);
  return eq(3, a);
});

test("modulo operator", function() {
  const check = (a, b, expected) => eq(expected, __mod__(a, b), `expected ${a} %%%% ${b} to be ${expected}`);
  check(0, 1, 0);
  check(0, -1, -0);
  check(1, 0, NaN);
  check(1, 2, 1);
  check(1, -2, -1);
  check(1, 3, 1);
  check(2, 3, 2);
  check(3, 3, 0);
  check(4, 3, 1);
  check(-1, 3, 2);
  check(-2, 3, 1);
  check(-3, 3, 0);
  check(-4, 3, 2);
  check(5.5, 2.5, 0.5);
  return check(-5.5, 2.5, 2.0);
});

test("modulo operator compound assignment", function() {
  a = -2;
  a = __mod__(a, 5);
  return eq(3, a);
});

test("modulo operator converts arguments to numbers", function() {
  eq(1, __mod__(1, '42'));
  eq(1, __mod__('1', 42));
  return eq(1, __mod__('1', '42'));
});

test("#3361: Modulo operator coerces right operand once", function() {
  count = 0;
  const res = __mod__(42, {valueOf() { return count += 1; }});
  eq(1, count);
  return eq(0, res);
});

test("#3363: Modulo operator coercing order", function() {
  count = 2;
  a = {valueOf() { return count *= 2; }};
  b = {valueOf() { return count += 1; }};
  eq(4, __mod__(a, b));
  return eq(5, count);
});
// Option Parser
// -------------

// TODO: refactor option parser tests

// Ensure that the OptionParser handles arguments correctly.
if (typeof require === 'undefined' || require === null) { return; }
const {OptionParser} = require('./../lib/coffee-script/optparse');

const opt = new OptionParser([
  ['-r', '--required [DIR]',  'desc required'],
  ['-o', '--optional',        'desc optional'],
  ['-l', '--list [FILES*]',   'desc list']
]);

test("basic arguments", function() {
  const args = ['one', 'two', 'three', '-r', 'dir'];
  result = opt.parse(args);
  arrayEq(args, result.arguments);
  return eq(undefined, result.required);
});

test("boolean and parameterised options", function() {
  result = opt.parse(['--optional', '-r', 'folder', 'one', 'two']);
  ok(result.optional);
  eq('folder', result.required);
  return arrayEq(['one', 'two'], result.arguments);
});

test("list options", function() {
  result = opt.parse(['-l', 'one.txt', '-l', 'two.txt', 'three']);
  arrayEq(['one.txt', 'two.txt'], result.list);
  return arrayEq(['three'], result.arguments);
});

test("-- and interesting combinations", function() {
  result = opt.parse(['-o','-r','a','-r','b','-o','--','-a','b','--c','d']);
  arrayEq(['-a', 'b', '--c', 'd'], result.arguments);
  ok(result.optional);
  eq('b', result.required);

  const args = ['--','-o','a','-r','c','-o','--','-a','arg0','-b','arg1'];
  result = opt.parse(args);
  eq(undefined, result.optional);
  eq(undefined, result.required);
  return arrayEq(args.slice(1), result.arguments);
});
// Range Literals
// --------------

// TODO: add indexing and method invocation tests: [1..4][0] is 1, [0...3].toString()

// shared array
let shared = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

test("basic inclusive ranges", function() {
  arrayEq([1, 2, 3] , [1, 2, 3]);
  arrayEq([0, 1, 2] , [0, 1, 2]);
  arrayEq([0, 1]    , [0, 1]);
  arrayEq([0]       , [0]);
  arrayEq([-1]      , __range__(-1, -1, true));
  arrayEq([-1, 0]   , __range__(-1, 0, true));
  return arrayEq([-1, 0, 1], __range__(-1, 1, true));
});

test("basic exclusive ranges", function() {
  arrayEq([1, 2, 3] , [1, 2, 3]);
  arrayEq([0, 1, 2] , [0, 1, 2]);
  arrayEq([0, 1]    , [0, 1]);
  arrayEq([0]       , [0]);
  arrayEq([-1]      , __range__(-1, 0, false));
  arrayEq([-1, 0]   , __range__(-1, 1, false));
  arrayEq([-1, 0, 1], __range__(-1, 2, false));

  arrayEq([], []);
  arrayEq([], []);
  return arrayEq([], __range__(-1, -1, false));
});

test("downward ranges", function() {
  arrayEq(shared, [9, 8, 7, 6, 5, 4, 3, 2, 1, 0].reverse());
  arrayEq([5, 4, 3, 2] , [5, 4, 3, 2]);
  arrayEq([2, 1, 0, -1], __range__(2, -1, true));

  arrayEq([3, 2, 1]  , [3, 2, 1]);
  arrayEq([2, 1, 0]  , [2, 1, 0]);
  arrayEq([1, 0]     , [1, 0]);
  arrayEq([0]        , [0]);
  arrayEq([-1]       , __range__(-1, -1, true));
  arrayEq([0, -1]    , __range__(0, -1, true));
  arrayEq([1, 0, -1] , __range__(1, -1, true));
  arrayEq([0, -1, -2], __range__(0, -2, true));

  arrayEq([4, 3, 2], [4, 3, 2]);
  arrayEq([3, 2, 1], [3, 2, 1]);
  arrayEq([2, 1]   , [2, 1]);
  arrayEq([1]      , [1]);
  arrayEq([]       , []);
  arrayEq([]       , __range__(-1, -1, false));
  arrayEq([0]      , __range__(0, -1, false));
  arrayEq([0, -1]  , __range__(0, -2, false));
  arrayEq([1, 0]   , __range__(1, -1, false));
  return arrayEq([2, 1, 0], __range__(2, -1, false));
});

test("ranges with variables as enpoints", function() {
  [a, b] = Array.from([1, 3]);
  arrayEq([1, 2, 3], __range__(a, b, true));
  arrayEq([1, 2]   , __range__(a, b, false));
  b = -2;
  arrayEq([1, 0, -1, -2], __range__(a, b, true));
  return arrayEq([1, 0, -1]    , __range__(a, b, false));
});

test("ranges with expressions as endpoints", function() {
  [a, b] = Array.from([1, 3]);
  arrayEq([2, 3, 4, 5, 6], __range__((a+1), 2*b, true));
  return arrayEq([2, 3, 4, 5]   , __range__((a+1), 2*b, false));
});

test("large ranges are generated with looping constructs", function() {
  let len;
  const down = __range__(99, 0, true);
  eq(100, (len = down.length));
  eq(0, down[len - 1]);

  const up = __range__(0, 100, false);
  eq(100, (len = up.length));
  return eq(99, up[len - 1]);
});

test("#1012 slices with arguments object", function() {
  const expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const argsAtStart = (function() { return __range__(arguments[0], 9, true); })(0);
  arrayEq(expected, argsAtStart);
  const argsAtEnd = (function() { return __range__(0, arguments[0], true); })(9);
  arrayEq(expected, argsAtEnd);
  const argsAtBoth = (function() { return __range__(arguments[0], arguments[1], true); })(0, 9);
  return arrayEq(expected, argsAtBoth);
});

test("#1409: creating large ranges outside of a function body", () => CoffeeScript.eval('[0..100]'));
// Regular Expression Literals
// ---------------------------

// TODO: add method invocation tests: /regex/.toString()

// * Regexen
// * Heregexen

test("basic regular expression literals", function() {
  ok('a'.match(/a/));
  ok('a'.match(/a/));
  ok('a'.match(/a/g));
  return ok('a'.match(/a/g));
});

test("division is not confused for a regular expression", function() {
  eq(2, 4 / 2 / 1);

  a = 4;
  b = 2;
  g = 1;
  eq(2, a / b/g);

  a = 10;
  b = (a /= 4 / 2);
  eq(a, 5);

  obj = {method() { return 2; }};
  const two = 2;
  eq(2, ((obj.method()/two) + (obj.method()/two)));

  i = 1;
  eq(2, (4)/2/i);
  return eq(1, i/i/i);
});

test("#764: regular expressions should be indexable", () => eq(/0/['source'], new RegExp(`${0}`)['source']));

test("#584: slashes are allowed unescaped in character classes", () => ok(/^a\/[/]b$/.test('a//b')));

test("#1724: regular expressions beginning with `*`", () => throws(() => CoffeeScript.compile('/*/')));


// Heregexe(n|s)

test("a heregex will ignore whitespace and comments", () =>
  eq(/^I'm\x20+[a]\s+Heregex?\/\/\//gim + '', new RegExp(`\
^I'm\\x20+[a]\\s+\
Heregex?///\
`, 'gim') + ''
  )
);

test("an empty heregex will compile to an empty, non-capturing group", () => eq(/(?:)/ + '', new RegExp(``) + ''));

test("#1724: regular expressions beginning with `*`", () => throws(() => CoffeeScript.compile('/// * ///')));
if (global.testingBrowser) { return; }

fs = require('fs');

// REPL
// ----
const Stream = require('stream');

class MockInputStream extends Stream {
  constructor() {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
      eval(`${thisName} = this;`);
    }
    this.readable = true;
  }

  resume() {}

  emitLine(val) {
    return this.emit('data', new Buffer(`${val}\n`));
  }
}

class MockOutputStream extends Stream {
  constructor() {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
      eval(`${thisName} = this;`);
    }
    this.writable = true;
    this.written = [];
  }

  write(data) {
    //console.log 'output write', arguments
    return this.written.push(data);
  }

  lastWrite(fromEnd) {
    if (fromEnd == null) { fromEnd = -1; }
    return this.written[(this.written.length - 1) + fromEnd].replace(/\n$/, '');
  }
}

// Create a dummy history file
const historyFile = '_history_test';
fs.writeFileSync(historyFile, '1 + 2\n');

const testRepl = function(desc, fn) {
  const input = new MockInputStream;
  const output = new MockOutputStream;
  const repl = Repl.start({input, output, historyFile});
  return test(desc, () => fn(input, output, repl));
};

const ctrlV = { ctrl: true, name: 'v'};


testRepl('reads history file', function(input, output, repl) {
  input.emitLine(repl.rli.history[0]);
  return eq('3', output.lastWrite());
});

testRepl("starts with coffee prompt", (input, output) => eq('coffee> ', output.lastWrite(0)));

testRepl("writes eval to output", function(input, output) {
  input.emitLine('1+1');
  return eq('2', output.lastWrite());
});

testRepl("comments are ignored", function(input, output) {
  input.emitLine('1 + 1 #foo');
  return eq('2', output.lastWrite());
});

testRepl("output in inspect mode", function(input, output) {
  input.emitLine('"1 + 1\\n"');
  return eq("'1 + 1\\n'", output.lastWrite());
});

testRepl("variables are saved", function(input, output) {
  input.emitLine("foo = 'foo'");
  input.emitLine('foobar = "#{foo}bar"');
  return eq("'foobar'", output.lastWrite());
});

testRepl("empty command evaluates to undefined", function(input, output) {
  input.emitLine('');
  return eq('undefined', output.lastWrite());
});

testRepl("ctrl-v toggles multiline prompt", function(input, output) {
  input.emit('keypress', null, ctrlV);
  eq('------> ', output.lastWrite(0));
  input.emit('keypress', null, ctrlV);
  return eq('coffee> ', output.lastWrite(0));
});

testRepl("multiline continuation changes prompt", function(input, output) {
  input.emit('keypress', null, ctrlV);
  input.emitLine('');
  return eq('....... ', output.lastWrite(0));
});

testRepl("evaluates multiline", function(input, output) {
  // Stubs. Could assert on their use.
  output.cursorTo = function(pos) {};
  output.clearLine = function() {};

  input.emit('keypress', null, ctrlV);
  input.emitLine('do ->');
  input.emitLine('  1 + 1');
  input.emit('keypress', null, ctrlV);
  return eq('2', output.lastWrite());
});

testRepl("variables in scope are preserved", function(input, output) {
  input.emitLine('a = 1');
  input.emitLine('do -> a = 2');
  input.emitLine('a');
  return eq('2', output.lastWrite());
});

testRepl("existential assignment of previously declared variable", function(input, output) {
  input.emitLine('a = null');
  input.emitLine('a ?= 42');
  return eq('42', output.lastWrite());
});

testRepl("keeps running after runtime error", function(input, output) {
  input.emitLine('a = b');
  eq(0, output.lastWrite().indexOf('ReferenceError: b is not defined'));
  input.emitLine('a');
  return eq('undefined', output.lastWrite());
});

process.on('exit', () => fs.unlinkSync(historyFile));
// Scope
// -----

// * Variable Safety
// * Variable Shadowing
// * Auto-closure (`do`)
// * Global Scope Leaks

test("reference `arguments` inside of functions", function() {
  const sumOfArgs = function() {
    let sum = (a,b) => a + b;
    sum = 0;
    for (let num of Array.from(arguments)) { sum += num; }
    return sum;
  };
  return eq(10, sumOfArgs(0, 1, 2, 3, 4));
});

test("assignment to an Object.prototype-named variable should not leak to outer scope", function() {
  // FIXME: fails on IE
  (function() {
    let constructor;
    return constructor = 'word';
  })();
  return ok(constructor !== 'word');
});

test("siblings of splat parameters shouldn't leak to surrounding scope", function() {
  x = 10;
  const oops = function(x, ...args) {};
  oops(20, 1, 2, 3);
  return eq(x, 10);
});

test("catch statements should introduce their argument to scope", function() {
  try { throw ''; }
  catch (e) {
    (() => e = 5)();
    return eq(5, e);
  }
});

test("loop variable should be accessible after for-of loop", function() {
  let x;
  const d = ((() => {
    const result2 = [];
    for (x in {1:'a',2:'b'}) {
      result2.push(x);
    }
    return result2;
  })());
  return ok(['1','2'].includes(x));
});

test("loop variable should be accessible after for-in loop", function() {
  let x;
  const d = ((() => {
    const result2 = [];
    for (x of [1,2]) {       result2.push(x);
    }
    return result2;
  })());
  return eq(x, 2);
});

class Array {
  static initClass() {
    this.prototype.slice = fail;
  }
}
Array.initClass(); // needs to be global
class Object {
  static initClass() {
    this.prototype.hasOwnProperty = fail;
  }
}
Object.initClass();
test("#1973: redefining Array/Object constructors shouldn't confuse __X helpers", function() {
  const arr = [1, 2, 3, 4];
  arrayEq([3, 4], arr.slice(2));
  obj = {arr};
  return (() => {
    const result2 = [];
    for (let k of Object.keys(obj || {})) {
      result2.push(eq(arr, obj[k]));
    }
    return result2;
  })();
});

test("#2255: global leak with splatted @-params", function() {
  ok((x == null));
  arrayEq([0], (function(...args) { [...this.x] = Array.from(args); return this.x; }).call({}, 0));
  return ok((x == null));
});

test("#1183: super + fat arrows", function() {
  const dolater = cb => cb();

  class A {
  	constructor() {
  		this._i = 0;
}
  	foo(cb) {
  		return dolater(() => {
  			this._i += 1;
  			return cb();
  });
}
}

  class B extends A {
  	constructor() {
  		super(...arguments);
}
  	foo(cb) {
  		return dolater(() => {
  			return dolater(() => {
  				this._i += 2;
  				return B.prototype.__proto__.foo.call(this, cb);
  });
  });
}
}

  b = new B;
  return b.foo(() => eq(b._i, 3));
});

test("#1183: super + wrap", function() {
  let cls;
  class A {
    m() { return 10; }
  }

  class B extends A {
    constructor() { super(...arguments); }
  }

  (cls = B).prototype.m = function() { return r = (() => { try { return cls.prototype.__proto__.m.call(this, ); } catch (error) {} })(); };

  return eq((new B).m(), 10);
});

test("#1183: super + closures", function() {
  class A {
    constructor() {
      this.i = 10;
    }
    foo() { return this.i; }
  }

  class B extends A {
    foo() {
      const ret = (() => { switch (1) {
        case 0: return 0;
        case 1: return super.foo();
      } })();
      return ret;
    }
  }
  return eq((new B).foo(), 10);
});

test("#2331: bound super regression", function() {
  class A {
    static initClass() {
      this.value = 'A';
    }
    method() { return this.constructor.value; }
  }
  A.initClass();

  class B extends A {
    constructor(...args) {
      {
        // Hack: trick Babel/TypeScript into allowing this before super.
        if (false) { super(); }
        let thisFn = (() => { return this; }).toString();
        let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
        eval(`${thisName} = this;`);
      }
      this.method = this.method.bind(this);
      super(...args);
    }

    method() { return super.method(...arguments); }
  }

  return eq((new B).method(), 'A');
});

test("#3259: leak with @-params within destructured parameters", function() {
  const fn = function({foo1}, ...rest) {
    let bar, baz;
    this.foo = foo1;
    [this.bar] = Array.from(rest[0]), [{baz: this.baz}] = Array.from(rest[1]);
    return foo = (bar = (baz = false));
  };

  fn.call({}, {foo: 'foo'}, ['bar'], [{baz: 'baz'}]);

  eq('undefined', typeof foo);
  eq('undefined', typeof bar);
  return eq('undefined', typeof baz);
});
// Slicing and Splicing
// --------------------

// * Slicing
// * Splicing

// shared array
shared = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// Slicing

test("basic slicing", function() {
  arrayEq([7, 8, 9]   , shared.slice(7, 10));
  arrayEq([2, 3]      , shared.slice(2, 4));
  return arrayEq([2, 3, 4, 5], shared.slice(2, 6));
});

test("slicing with variables as endpoints", function() {
  [a, b] = Array.from([1, 4]);
  arrayEq([1, 2, 3, 4], shared.slice(a, +b + 1 || undefined));
  return arrayEq([1, 2, 3]   , shared.slice(a, b));
});

test("slicing with expressions as endpoints", function() {
  [a, b] = Array.from([1, 3]);
  arrayEq([2, 3, 4, 5, 6], shared.slice((a+1), +(2*b) + 1 || undefined));
  return arrayEq([2, 3, 4, 5]   , shared.slice(a+1, (2*b)));
});

test("unbounded slicing", function() {
  let asc, end;
  let asc1, end1, start;
  arrayEq([7, 8, 9]   , shared.slice(7));
  arrayEq([8, 9]      , shared.slice(-2));
  arrayEq([9]         , shared.slice(-1));
  arrayEq([0, 1, 2]   , shared.slice(0, 3));
  arrayEq([0, 1, 2, 3], shared.slice(0, +-7 + 1 || undefined));

  arrayEq(shared      , shared.slice(0));
  arrayEq(shared.slice(0, 9), shared.slice(0, -1));

  for (a = -shared.length, end = shared.length, asc = -shared.length <= end; asc ? a <= end : a >= end; asc ? a++ : a--) {
    arrayEq(shared.slice(a) , shared.slice(a));
  }
  for (start = -shared.length+1, a = start, end1 = shared.length, asc1 = start <= end1; asc1 ? a < end1 : a > end1; asc1 ? a++ : a--) {
    arrayEq(shared.slice(0, +a + 1 || undefined).slice(0, -1) , shared.slice(0, a));
  }

  return arrayEq([1, 2, 3], [1, 2, 3].slice());
});

test("#930, #835, #831, #746 #624: inclusive slices to -1 should slice to end", function() {
  arrayEq(shared, shared.slice(0));
  arrayEq(shared, shared.slice(0));
  return arrayEq(shared.slice(1,shared.length), shared.slice(1));
});

test("string slicing", function() {
  const str = "abcdefghijklmnopqrstuvwxyz";
  ok(str.slice(1, 1) === "");
  ok(str.slice(1, 2) === "b");
  ok(str.slice(1, 5) === "bcde");
  ok(str.slice(0, 5) === "abcde");
  return ok(str.slice(-5) === "vwxyz");
});

test("#1722: operator precedence in unbounded slice compilation", function() {
  list = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  n = 2; // some truthy number in `list`
  arrayEq(__range__(0, n, true), list.slice(0, +n + 1 || undefined));
  arrayEq(__range__(0, n, true), list.slice(0, +(n || 0) + 1 || undefined));
  return arrayEq(__range__(0, n, true), list.slice(0, +(n ? n : 0) + 1 || undefined));
});

test("#2349: inclusive slicing to numeric strings", () => arrayEq([0, 1], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].slice(0, +"1" + 1 || undefined)));


// Splicing

test("basic splicing", function() {
  let ary = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  ary.splice(5, 9 - 5 + 1, ...[].concat([0, 0, 0]));
  arrayEq([0, 1, 2, 3, 4, 0, 0, 0], ary);

  ary = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  ary.splice(2, 8 - 2, ...[].concat([]));
  return arrayEq([0, 1, 8, 9], ary);
});

test("unbounded splicing", function() {
  const ary = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  ary.splice(3, 9e9, ...[].concat([9, 8, 7]));
  arrayEq([0, 1, 2, 9, 8, 7]. ary);

  ary.splice(0, 3, ...[].concat([7, 8, 9]));
  arrayEq([7, 8, 9, 9, 8, 7], ary);

  ary.splice(0, 9e9, ...[].concat([1, 2, 3]));
  return arrayEq([1, 2, 3], ary);
});

test("splicing with variables as endpoints", function() {
  [a, b] = Array.from([1, 8]);

  let ary = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  ary.splice(a, b - a + 1, ...[].concat([2, 3]));
  arrayEq([0, 2, 3, 9], ary);

  ary = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  ary.splice(a, b - a, ...[].concat([5]));
  return arrayEq([0, 5, 8, 9], ary);
});

test("splicing with expressions as endpoints", function() {
  let ref, ref1;
  [a, b] = Array.from([1, 3]);

  let ary = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  ary.splice( ref = a+1 ,  ((2*b)+1) - ref + 1 , ...[].concat([4]));
  arrayEq([0, 1, 4, 8, 9], ary);

  ary = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  ary.splice(ref1 = a+1, ((2*b)+1) - ref1, ...[].concat([4]));
  return arrayEq([0, 1, 4, 7, 8, 9], ary);
});

test("splicing to the end, against a one-time function", function() {
  let ary = null;
  const fn = function() {
    if (ary) {
      throw 'err';
    } else {
      return ary = [1, 2, 3];
    }
  };

  fn().splice(0, 9e9, ...[].concat(1));

  return arrayEq(ary, [1]);
});

test("the return value of a splice literal should be the RHS", function() {
  let ary = [0, 0, 0];
  eq(((ary.splice(0, 1 + 1, ...[].concat(2)), 2)), 2);

  ary = [0, 0, 0];
  eq(((ary.splice(0, 9e9, ...[].concat(3)), 3)), 3);

  return arrayEq([(ary.splice(0, 0 + 1, ...[].concat(0)), 0)], [0]);
});

test("#1723: operator precedence in unbounded splice compilation", function() {
  n = 4; // some truthy number in `list`

  list = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  list.splice(0, n + 1, ...[].concat(n));
  arrayEq(__range__(n, 9, true), list);

  list = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  list.splice(0, (n || 0) + 1, ...[].concat(n));
  arrayEq(__range__(n, 9, true), list);

  list = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  list.splice(0, (n ? n : 0) + 1, ...[].concat(n));
  return arrayEq(__range__(n, 9, true), list);
});

test("#2953: methods on endpoints in assignment from array splice literal", function() {
  let ref;
  list = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  Number.prototype.same = function() { return this; };
  list.splice(ref = (1).same(), (9).same() - ref, ...[].concat(5));
  delete Number.prototype.same;

  return arrayEq([0, 5, 9], list);
});
// Soaks
// -----

// * Soaked Property Access
// * Soaked Method Invocation
// * Soaked Function Invocation


// Soaked Property Access

test("soaked property access", function() {
  nonce = {};
  obj = {a: {b: nonce}};
  eq(nonce    , obj != null ? obj.a.b : undefined);
  eq(nonce    , obj != null ? obj['a'].b : undefined);
  eq(nonce    , obj.a != null ? obj.a.b : undefined);
  eq(nonce    , __guard__(obj != null ? obj.a : undefined, x1 => x1['b']));
  return eq(undefined, __guard__(__guard__(__guard__(obj != null ? obj.a : undefined, x4 => x4.non), x3 => x3.existent), x2 => x2.property));
});

test("soaked property access caches method calls", function() {
  nonce ={};
  obj = {fn() { return {a: nonce}; }};
  eq(nonce    , __guard__(obj.fn(), x1 => x1.a));
  return eq(undefined, __guard__(obj.fn(), x2 => x2.b));
});

test("soaked property access caching", function() {
  nonce = {};
  let counter = 0;
  const fn = function() {
    counter++;
    return 'self';
  };
  obj = {
    self() { return this; },
    prop: nonce
  };
  eq(nonce, __guard__(obj[fn()]()[fn()]()[fn()](), x1 => x1.prop));
  return eq(3, counter);
});

test("method calls on soaked methods", function() {
  nonce = {};
  obj = null;
  eq(undefined, obj != null ? obj.a().b() : undefined);
  obj = {a() { return {b() { return nonce; }}; }};
  return eq(nonce    , obj != null ? obj.a().b() : undefined);
});

test("postfix existential operator mixes well with soaked property accesses", () => eq(false, ((typeof nonexistent !== 'undefined' && nonexistent !== null ? nonexistent.property : undefined) != null)));

test("function invocation with soaked property access", function() {
  id = _ => _;
  return eq(undefined, id(typeof nonexistent !== 'undefined' && nonexistent !== null ? nonexistent.method() : undefined));
});

test("if-to-ternary should safely parenthesize soaked property accesses", () => ok(((typeof nonexistent !== 'undefined' && nonexistent !== null ? nonexistent.property : undefined) ? false : true)));

test("#726", () =>
  // TODO: check this test, looks like it's not really testing anything
  eq(undefined, typeof nonexistent !== 'undefined' && nonexistent !== null ? nonexistent[Date()] : undefined)
);

test("#756", function() {
  // TODO: improve this test
  a = null;
  ok(isNaN((a != null ? a.b.c : undefined) +  1));
  eq(undefined, (a != null ? a.b.c += 1 : undefined));
  eq(undefined, a != null ? ++a.b.c : undefined);
  return eq(undefined, a != null ? delete a.b.c : undefined);
});

test("operations on soaked properties", function() {
  // TODO: improve this test
  a = {b: {c: 0}};
  eq(1,   (a != null ? a.b.c : undefined) +  1);
  eq(1,   (a != null ? a.b.c += 1 : undefined));
  eq(2,   a != null ? ++a.b.c : undefined);
  return eq(true, a != null ? delete a.b.c : undefined);
});


// Soaked Method Invocation

test("soaked method invocation", function() {
  nonce = {};
  let counter = 0;
  obj = {
    self() { return this; },
    increment() { counter++; return this; }
  };
  eq(obj      , typeof obj.self === 'function' ? obj.self() : undefined);
  eq(undefined, typeof obj.method === 'function' ? obj.method() : undefined);
  eq(nonce    , (typeof obj.self === 'function' ? obj.self().property = nonce : undefined));
  eq(undefined, (typeof obj.method === 'function' ? obj.method().property = nonce : undefined));
  eq(obj      , __guardMethod__(obj.increment().increment(), 'self', o => o.self()));
  return eq(2        , counter);
});

test("#733", function() {
  a = {b: {c: null}};
  eq(__guardMethod__(a.b, 'c', o => o.c()), undefined);
  if (a.b != null) {
    a.b.c || (a.b.c = it => it);
  }
  eq(__guardMethod__(a.b, 'c', o1 => o1.c(1)), 1);
  return eq(__guardMethod__(a.b, 'c', o2 => o2.c(...Array.from([2, 3] || []))), 2);
});


// Soaked Function Invocation

test("soaked function invocation", function() {
  nonce = {};
  id = _ => _;
  eq(nonce    , typeof id === 'function' ? id(nonce) : undefined);
  eq(nonce    , (typeof id === 'function' ? id(nonce) : undefined));
  eq(undefined, typeof nonexistent === 'function' ? nonexistent(nonce) : undefined);
  return eq(undefined, (typeof nonexistent === 'function' ? nonexistent(nonce) : undefined));
});

test("soaked function invocation with generated functions", function() {
  nonce = {};
  id = _ => _;
  const maybe = function(fn, arg) { if (typeof fn === 'function') { return () => fn(arg); } };
  eq(__guardFunc__(maybe(id, nonce), f => f()), nonce);
  eq(__guardFunc__((maybe(id, nonce)), f1 => f1()), nonce);
  return eq(__guardFunc__((maybe(false, nonce)), f2 => f2()), undefined);
});

test("soaked constructor invocation", function() {
  eq(42       , +(typeof Number === 'function' ? new Number(42) : undefined));
  return eq(undefined,  typeof Other === 'function' ? new Other(42) : undefined);
});

test("soaked constructor invocations with caching and property access", function() {
  let semaphore = 0;
  nonce = {};
  class C {
    static initClass() {
      this.prototype.prop = nonce;
    }
    constructor() {
      if (semaphore) { ok(false); }
      semaphore++;
    }
  }
  C.initClass();
  eq(nonce, __guard__((new C()), x1 => x1.prop));
  return eq(1, semaphore);
});

test("soaked function invocation safe on non-functions", function() {
  eq(undefined, typeof 0 === 'function' ? (0)(1) : undefined);
  return eq(undefined, typeof 0 === 'function' ? (0)(1, 2) : undefined);
});
if (global.testingBrowser) { return; }

const SourceMap = require('../src/sourcemap');

const vlqEncodedValues = [
    [1, "C"],
    [-1, "D"],
    [2, "E"],
    [-2, "F"],
    [0, "A"],
    [16, "gB"],
    [948, "o7B"]
];

test("encodeVlq tests", () =>
  Array.from(vlqEncodedValues).map((pair) =>
    eq(((new SourceMap).encodeVlq(pair[0])), pair[1]))
);

const eqJson = (a, b) => eq((JSON.stringify(JSON.parse(a))), (JSON.stringify(JSON.parse(b))));

test("SourceMap tests", function() {
  const map = new SourceMap;
  map.add([0, 0], [0, 0]);
  map.add([1, 5], [2, 4]);
  map.add([1, 6], [2, 7]);
  map.add([1, 9], [2, 8]);
  map.add([3, 0], [3, 4]);

  const testWithFilenames = map.generate({
        sourceRoot: "",
        sourceFiles: ["source"],
        generatedFile: "source.js"});
  eqJson(testWithFilenames, '{"version":3,"file":"source.js","sourceRoot":"","sources":["source"],"names":[],"mappings":"AAAA;;IACK,GAAC,CAAG;IAET"}');
  eqJson(map.generate(), '{"version":3,"file":"","sourceRoot":"","sources":[""],"names":[],"mappings":"AAAA;;IACK,GAAC,CAAG;IAET"}');

  // Look up a generated column - should get back the original source position.
  arrayEq(map.sourceLocation([2,8]), [1,9]);

  // Look up a point futher along on the same line - should get back the same source position.
  return arrayEq(map.sourceLocation([2,10]), [1,9]);
});
// Strict Early Errors
// -------------------

// The following are prohibited under ES5's `strict` mode
// * `Octal Integer Literals`
// * `Octal Escape Sequences`
// * duplicate property definitions in `Object Literal`s
// * duplicate formal parameter
// * `delete` operand is a variable
// * `delete` operand is a parameter
// * `delete` operand is `undefined`
// * `Future Reserved Word`s as identifiers: implements, interface, let, package, private, protected, public, static, yield
// * `eval` or `arguments` as `catch` identifier
// * `eval` or `arguments` as formal parameter
// * `eval` or `arguments` as function declaration identifier
// * `eval` or `arguments` as LHS of assignment
// * `eval` or `arguments` as the operand of a post/pre-fix inc/dec-rement expression

// helper to assert that code complies with strict prohibitions
const strict = (code, msg) => throws((() => CoffeeScript.compile(code)), null, msg != null ? msg : code);
const strictOk = (code, msg) => doesNotThrow((() => CoffeeScript.compile(code)), msg != null ? msg : code);


test("octal integer literals prohibited", function() {
  strict('01');
  strict('07777');
  // decimals with a leading '0' are also prohibited
  strict('09');
  strict('079');
  return strictOk('`01`');
});

test("octal escape sequences prohibited", function() {
  strict('"\\1"');
  strict('"\\7"');
  strict('"\\001"');
  strict('"\\777"');
  strict('"_\\1"');
  strict('"\\1_"');
  strict('"_\\1_"');
  strict('"\\\\\\1"');
  strictOk('"\\0"');
  eq("\x00", "\0");
  strictOk('"\\08"');
  eq("\x008", "\08");
  strictOk('"\\0\\8"');
  eq("\x008", "\0\8");
  strictOk('"\\8"');
  eq("8", "\8");
  strictOk('"\\\\1"');
  eq("\\1", "\\1");
  strictOk('"\\\\\\\\1"');
  eq("\\\\1", "\\\\1");
  strictOk("`'\\1'`");
  return eq("\\1", "\\1");
});

test("duplicate formal parameters are prohibited", function() {
  nonce = {};
  // a Param can be an Identifier, ThisProperty( @-param ), Array, or Object
  // a Param can also be a splat (...) or an assignment (param=value)
  // the following function expressions should throw errors
  strict('(_,_)->',          'param, param');
  strict('(_,@_)->',         'param, @param');
  strict('(_,_...)->',       'param, param...');
  strict('(@_,_...)->',      '@param, param...');
  strict('(_,_ = true)->',   'param, param=');
  strict('(@_,@_)->',        'two @params');
  strict('(_,@_ = true)->',  'param, @param=');
  strict('(_,{_})->',        'param, {param}');
  strict('(@_,{_})->',       '@param, {param}');
  strict('({_,_})->',        '{param, param}');
  strict('({_,@_})->',       '{param, @param}');
  strict('(_,[_])->',        'param, [param]');
  strict('([_,_])->',        '[param, param]');
  strict('([_,@_])->',       '[param, @param]');
  strict('(_,[_]=true)->',   'param, [param]=');
  strict('(_,[@_,{_}])->',   'param, [@param, {param}]');
  strict('(_,[_,{@_}])->',   'param, [param, {@param}]');
  strict('(_,[_,{_}])->',    'param, [param, {param}]');
  strict('(_,[_,{__}])->',   'param, [param, {param2}]');
  strict('(_,[__,{_}])->',   'param, [param2, {param}]');
  strict('(__,[_,{_}])->',   'param, [param2, {param2}]');
  strict('(0:a,1:a)->',      '0:param,1:param');
  strict('({0:a,1:a})->',    '{0:param,1:param}');
  // the following function expressions should **not** throw errors
  strictOk('({},_arg)->');
  strictOk('({},{})->');
  strictOk('([]...,_arg)->');
  strictOk('({}...,_arg)->');
  strictOk('({}...,[],_arg)->');
  strictOk('([]...,{},_arg)->');
  strictOk('(@case,_case)->');
  strictOk('(@case,_case...)->');
  strictOk('(@case...,_case)->');
  strictOk('(_case,@case)->');
  strictOk('(_case,@case...)->');
  strictOk('(a:a)->');
  return strictOk('(a:a,a:b)->');
});

test("`delete` operand restrictions", function() {
  strict('a = 1; delete a');
  strictOk('delete a'); //noop
  strict('(a) -> delete a');
  strict('(@a) -> delete a');
  strict('(a...) -> delete a');
  strict('(a = 1) -> delete a');
  strict('([a]) -> delete a');
  return strict('({a}) -> delete a');
});

test("`Future Reserved Word`s, `eval` and `arguments` restrictions", function() {

  const access = function(keyword, check) {
    if (check == null) { check = strict; }
    check(`${keyword}.a = 1`);
    return check(`${keyword}[0] = 1`);
  };
  const assign = function(keyword, check) {
    if (check == null) { check = strict; }
    check(`${keyword} = 1`);
    check(`${keyword} += 1`);
    check(`${keyword} -= 1`);
    check(`${keyword} *= 1`);
    check(`${keyword} /= 1`);
    check(`${keyword} ?= 1`);
    check("{keyword}++");
    check("++{keyword}");
    check("{keyword}--");
    return check("--{keyword}");
  };
  const destruct = function(keyword, check) {
    if (check == null) { check = strict; }
    check(`{${keyword}}`);
    return check(`o = {${keyword}}`);
  };
  const invoke = function(keyword, check) {
    if (check == null) { check = strict; }
    check(`${keyword} yes`);
    return check(`do ${keyword}`);
  };
  const fnDecl = function(keyword, check) {
    if (check == null) { check = strict; }
    return check(`class ${keyword}`);
  };
  const param = function(keyword, check) {
    if (check == null) { check = strict; }
    check(`(${keyword}) ->`);
    return check(`({${keyword}}) ->`);
  };
  const prop = function(keyword, check) {
    if (check == null) { check = strict; }
    return check(`a.${keyword} = 1`);
  };
  const tryCatch = function(keyword, check) {
    if (check == null) { check = strict; }
    return check(`try new Error catch ${keyword}`);
  };

  const future = 'implements interface let package private protected public static yield'.split(' ');
  for (var keyword of Array.from(future)) {
    access(keyword);
    assign(keyword);
    destruct(keyword);
    invoke(keyword);
    fnDecl(keyword);
    param(keyword);
    prop(keyword, strictOk);
    tryCatch(keyword);
  }

  return (() => {
    const result2 = [];
    for (keyword of ['eval', 'arguments']) {
      access(keyword, strictOk);
      assign(keyword);
      destruct(keyword, strictOk);
      invoke(keyword, strictOk);
      fnDecl(keyword);
      param(keyword);
      prop(keyword, strictOk);
      result2.push(tryCatch(keyword));
    }
    return result2;
  })();
});
// String Literals
// ---------------

// TODO: refactor string literal tests
// TODO: add indexing and method invocation tests: "string"["toString"] is String::toString, "string".toString() is "string"

// * Strings
// * Heredocs

test("backslash escapes", () => eq("\\/\\\\", /\/\\/.source));

eq('(((dollars)))', '\(\(\(dollars\)\)\)');
eq('one two three', `one \
two \
three`
);
eq("four five", `four \
\
five`
);

test("#3229, multiline strings", function() {
  // Separate lines by default by a single space in literal strings.
  eq(`one \
two`, 'one two');
  eq(`one \
two`, 'one two');
  eq(`\
a \
b\
`, 'a b');
  eq(`\
a \
b\
`, 'a b');
  eq(`one \
\
two`, 'one two');
  eq(`one \
\
two`, 'one two');
  eq(`\
indentation \
doesn\'t \
matter`, 'indentation doesn\'t matter');
  eq(`trailing ws \
doesn\'t matter`, 'trailing ws doesn\'t matter');

  // Use backslashes at the end of a line to specify whitespace between lines.
  eq(`a \
b\
c  \
d`, 'a bc  d');
  eq(`a \
b\
c  \
d`, 'a bc  d');
  eq(`ignore  \
trailing whitespace`, 'ignore  trailing whitespace');

  // Backslash at the beginning of a literal string.
  eq(`\
ok`, 'ok');
  eq(`  \
ok`, '  ok');

  // #1273, empty strings.
  eq(`\
`, '');
  eq(`\
`, '');
  eq(`\
`, '');
  eq('   ', '   ');

  // Same behavior in interpolated strings.
  eq(`interpolation ${1} \
follows ${2}  \
too ${3}\
!`, 'interpolation 1 follows 2  too 3!');
  eq(`a ${
    'string ' + `inside \
interpolation`
    }`, "a string inside interpolation");
  eq(`\
${1}\
`, '1');

  // Handle escaped backslashes correctly.
  eq('\\', '\\');
  eq(`escaped backslash at EOL\\ \
next line`, 'escaped backslash at EOL\\ next line');
  eq(`\\ \
next line`, '\\ next line');
  eq(`\\\
`, '\\');
  eq(`\\\\\\\
`, '\\\\\\');
  eq(`${1}\\ \
after interpolation`, '1\\ after interpolation');
  eq(`escaped backslash before slash\\  \
next line`, 'escaped backslash before slash\\  next line');
  eq(`triple backslash\\\
next line`, 'triple backslash\\next line');
  eq(`several escaped backslashes\\\\\\ \
ok`, 'several escaped backslashes\\\\\\ ok');
  eq(`several escaped backslashes slash\\\\\\\
ok`, 'several escaped backslashes slash\\\\\\ok');
  eq(`several escaped backslashes with trailing ws \\\\\\ \
ok`, 'several escaped backslashes with trailing ws \\\\\\ ok');

  // Backslashes at beginning of lines.
  eq(`first line \
\   backslash at BOL`, 'first line \   backslash at BOL');
  eq(`first line\
\   backslash at BOL`, 'first line\   backslash at BOL');

  // Edge case.
  return eq(`lone \
\
\
\
backslash`, 'lone backslash');
});

test("#3249, escape newlines in heredocs with backslashes", function() {
  // Ignore escaped newlines
  eq(`\
Set whitespace      \
<- this is ignored\
none
  normal indentation\
`, 'Set whitespace      <- this is ignorednone\n  normal indentation');
  eq(`\
Set whitespace      \
<- this is ignored\
none
  normal indentation\
`, 'Set whitespace      <- this is ignorednone\n  normal indentation');

  // Changed from #647, trailing backslash.
  eq(`\
Hello, World\
\
`, 'Hello, World');
  eq(`\
\\\
`, '\\');

  // Backslash at the beginning of a literal string.
  eq(`\
ok`, 'ok');
  eq(`  \
ok`, '  ok');

  // Same behavior in interpolated strings.
  eq(`\
interpolation ${1}
  follows ${2}  \
too ${3}\
!\
`, 'interpolation 1\n  follows 2  too 3!');
  eq(`\

${1} ${2}
\
`, '\n1 2\n');

  // TODO: uncomment when #2388 is fixed
  // eq """a heredoc #{
  //     "inside \
  //       interpolation"
  //   }""", "a heredoc inside interpolation"

  // Handle escaped backslashes correctly.
  eq(`\
escaped backslash at EOL\\
  next line\
`, 'escaped backslash at EOL\\\n  next line');
  eq(`\\
\
`, '\\\n');

  // Backslashes at beginning of lines.
  eq(`first line
\   backslash at BOL`, 'first line\n\   backslash at BOL');
  eq(`first line\
\   backslash at BOL`, 'first line\   backslash at BOL');

  // Edge cases.
  eq(`lone

  \
\
\
\
backslash`, 'lone\n\n  backslash');
  return eq(`\
`, '');
});

//647
eq("''Hello, World\\''", `\
'\'Hello, World\\\''\
`
);
eq('""Hello, World\\""', `\
"\"Hello, World\\\""\
`
);

test("#1273, escaping quotes at the end of heredocs.", function() {
  // """\""" no longer compiles
  eq("\\", '\\');
  return eq("\\\"", '\\\"');
});

a = `\
basic heredoc
on two lines\
`;
ok(a === "basic heredoc\non two lines");

a = `\
a
  "b
c\
`;
ok(a === "a\n  \"b\nc");

a = `\
a
 b
  c\
`;
ok(a === "a\n b\n  c");

a = 'one-liner';
ok(a === 'one-liner');

a = `\
out
here\
`;
ok(a === "out\nhere");

a = `\
    a
  b
c\
`;
ok(a === "    a\n  b\nc");

a = `\
a


b c\
`;
ok(a === "a\n\n\nb c");

a = 'more"than"one"quote';
ok(a === 'more"than"one"quote');

a = 'here\'s an apostrophe';
ok(a === "here's an apostrophe");

// The indentation detector ignores blank lines without trailing whitespace
a = `\
one
two
\
`;
ok(a === "one\ntwo\n");

eq(` line 0
should not be relevant
  to the indent level\
`, ' line 0\nshould not be relevant\n  to the indent level');

eq(' \'\\\' ', " '\\' ");
eq(" \"\\\" ", ' "\\" ');

eq('  <- keep these spaces ->  ', '  <- keep these spaces ->  ');


test("#1046, empty string interpolations", () => eq(``, ''));

function __extends__(child, parent) {
  Object.getOwnPropertyNames(parent).forEach(
    name => child[name] = parent[name]
  );
  child.prototype = Object.create(parent.prototype);
  child.__super__ = parent.prototype;
  return child;
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
function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
function __guardFunc__(func, transform) {
  return typeof func === 'function' ? transform(func) : undefined;
}