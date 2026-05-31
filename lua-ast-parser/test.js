const { parse } = require('./src/index');

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function run() {
  for (const { name, fn } of tests) {
    try {
      fn();
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
      passed++;
    } catch (e) {
      console.log(`  \x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed}/${passed + failed} tests passed`);
  if (failed > 0) process.exit(1);
}

function ok(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function parseOk(source) {
  const { ast } = parse(source);
  ok(ast, 'Expected AST');
  return ast;
}

function parseFail(source) {
  try {
    parse(source);
    throw new Error('Expected parse error but got none');
  } catch (e) {
    if (e.message === 'Expected parse error but got none') throw e;
    // Good - expected to fail
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('empty source', () => {
  const ast = parseOk('');
  ok(ast.type === 'Block');
  ok(ast.body.length === 0);
});

test('local variable', () => {
  const ast = parseOk('local x = 42');
  ok(ast.body[0].type === 'LocalAssign');
  ok(ast.body[0].names[0] === 'x');
  ok(ast.body[0].values[0].value === 42);
});

test('local multiple vars', () => {
  const ast = parseOk('local a, b, c = 1, 2, 3');
  ok(ast.body[0].names.length === 3);
  ok(ast.body[0].values.length === 3);
});

test('assignment', () => {
  const ast = parseOk('x = 10');
  ok(ast.body[0].type === 'Assign');
});

test('function declaration', () => {
  const ast = parseOk('function foo(a, b) return a + b end');
  ok(ast.body[0].type === 'FunctionDecl');
  ok(ast.body[0].func.params[0] === 'a');
});

test('method declaration', () => {
  const ast = parseOk('function MyClass:init() end');
  ok(ast.body[0].type === 'FunctionDecl');
  ok(ast.body[0].func.params[0] === 'self');
});

test('local function', () => {
  const ast = parseOk('local function add(a, b) return a + b end');
  ok(ast.body[0].type === 'LocalFunction');
  ok(ast.body[0].name === 'add');
});

test('if/elseif/else', () => {
  const ast = parseOk('if x > 0 then return 1 elseif x < 0 then return -1 else return 0 end');
  ok(ast.body[0].type === 'If');
  ok(ast.body[0].clauses.length === 2);
  ok(ast.body[0].elseBody !== null);
});

test('while loop', () => {
  const ast = parseOk('while true do break end');
  ok(ast.body[0].type === 'While');
  ok(ast.body[0].body.body[0].type === 'Break');
});

test('repeat/until', () => {
  const ast = parseOk('repeat x = x + 1 until x >= 10');
  ok(ast.body[0].type === 'Repeat');
});

test('numeric for', () => {
  const ast = parseOk('for i = 1, 10, 2 do end');
  ok(ast.body[0].type === 'ForNum');
  ok(ast.body[0].name === 'i');
  ok(ast.body[0].step !== null);
});

test('generic for', () => {
  const ast = parseOk('for k, v in pairs(t) do end');
  ok(ast.body[0].type === 'ForIn');
  ok(ast.body[0].names.length === 2);
});

test('table constructor', () => {
  const ast = parseOk('local t = { a = 1, [2] = "two", 3 }');
  const tbl = ast.body[0].values[0];
  ok(tbl.type === 'Table');
  ok(tbl.fields[0].type === 'NamedField');
  ok(tbl.fields[1].type === 'IndexedField');
  ok(tbl.fields[2].type === 'ValueField');
});

test('method call', () => {
  const ast = parseOk('obj:method(a, b)');
  ok(ast.body[0].expr.type === 'Method');
  ok(ast.body[0].expr.method === 'method');
});

test('chained calls', () => {
  const ast = parseOk('a.b.c:foo()(1, 2)');
  ok(ast.body[0].type === 'ExprStmt');
});

test('vararg function', () => {
  const ast = parseOk('local function f(...) return ... end');
  ok(ast.body[0].func.hasVararg === true);
});

test('string escapes', () => {
  const ast = parseOk(String.raw`local s = "hello\nworld\t!"`);
  ok(ast.body[0].values[0].value === 'hello\nworld\t!');
});

test('long string', () => {
  const ast = parseOk('local s = [[hello\nworld]]');
  ok(ast.body[0].values[0].value === 'hello\nworld');
});

test('hex number', () => {
  const ast = parseOk('local n = 0xFF');
  ok(ast.body[0].values[0].raw === '0xFF');
});

test('binary operators', () => {
  const ast = parseOk('local x = 1 + 2 * 3 ^ 4');
  // Should be 1 + (2 * (3 ^ 4)) due to precedence
  const expr = ast.body[0].values[0];
  ok(expr.type === 'BinOp');
  ok(expr.op === '+');
  ok(expr.right.op === '*');
});

test('concat is right-associative', () => {
  const ast = parseOk('local s = a .. b .. c');
  const expr = ast.body[0].values[0];
  ok(expr.op === '..');
  ok(expr.right.op === '..');
});

test('unary operators', () => {
  const ast = parseOk('local x = -not #t');
  ok(ast.body[0].values[0].type === 'UnOp');
});

test('goto and label', () => {
  const ast = parseOk('::myLabel:: goto myLabel');
  ok(ast.body[0].type === 'Label');
  ok(ast.body[1].type === 'Goto');
});

test('do...end block', () => {
  const ast = parseOk('do local x = 1 end');
  ok(ast.body[0].type === 'Do');
});

test('multiline function call string arg', () => {
  const ast = parseOk('print "hello"');
  ok(ast.body[0].expr.type === 'Call');
});

test('nested functions', () => {
  const ast = parseOk(`
    function outer()
      local function inner()
        return 1
      end
      return inner()
    end
  `);
  ok(ast.body[0].type === 'FunctionDecl');
});

test('complex expression', () => {
  parseOk('local r = (a and b) or (c and not d)');
});

// ─── Luau-specific tests ──────────────────────────────────────────────────────

console.log('\n\x1b[1mLua Tests:\x1b[0m');
run();

const luauTests = [];
let luauPassed = 0;
let luauFailed = 0;

function luauTest(name, fn) {
  luauTests.push({ name, fn });
}

luauTest('type alias', () => {
  const ast = parseOk('type Point = { x: number, y: number }');
  ok(ast.body[0].type === 'TypeAlias');
  ok(ast.body[0].name === 'Point');
  ok(ast.body[0].typeNode !== undefined);
});

luauTest('export type', () => {
  const ast = parseOk('export type ID = string');
  ok(ast.body[0].type === 'TypeAlias');
  ok(ast.body[0].exported === true);
});

luauTest('type annotation on local', () => {
  const ast = parseOk('local x: number = 5');
  ok(ast.body[0].types[0] !== null);
});

luauTest('optional type', () => {
  const ast = parseOk('local x: string? = nil');
  ok(ast.body[0].types[0].type === 'TypeOptional');
});

luauTest('union type', () => {
  const ast = parseOk('type T = string | number | boolean');
  ok(ast.body[0].typeNode.type === 'TypeUnion');
});

luauTest('function type annotation', () => {
  const ast = parseOk('local f: (number) -> boolean = nil');
  ok(ast.body[0].types[0] !== null);
});

luauTest('generic type alias', () => {
  const ast = parseOk('type Array<T> = {[number]: T}');
  ok(ast.body[0].generics[0] === 'T');
});

luauTest('continue statement', () => {
  const ast = parseOk('while true do continue end');
  ok(ast.body[0].body.body[0].type === 'Continue');
});

luauTest('typeof in type', () => {
  const ast = parseOk('type T = typeof(42)');
  ok(ast.body[0].typeNode.type === 'TypeTypeof');
});

luauTest('complex Luau code', () => {
  parseOk(`
    type Result<T> = { success: true, value: T } | { success: false, error: string }
    
    local function fetchData(url: string): Result<string>
      if url == "" then
        return { success = false, error = "empty url" }
      end
      return { success = true, value = "data" }
    end
    
    export type Config = {
      host: string,
      port: number?,
      timeout: number,
    }
  `);
});

console.log('\n\x1b[1mLuau Extension Tests:\x1b[0m');
for (const { name, fn } of luauTests) {
  try {
    fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    luauPassed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${e.message}`);
    luauFailed++;
  }
}
console.log(`\n${luauPassed}/${luauPassed + luauFailed} Luau tests passed`);

const totalFailed = failed + luauFailed;
console.log(`\n\x1b[1mTotal: ${passed + luauPassed}/${passed + luauPassed + totalFailed} passed\x1b[0m`);
if (totalFailed > 0) process.exit(1);

