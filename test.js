const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { document } = (new JSDOM(`...`)).window;
const {} = require('./messager');

const {Messager} = require('./messager');
const {ExpressionBoolean} = require('./ast');
const {GlobalEnvironment} = require('./types');
const {lex} = require('./lexer');
const {parse} = require('./parser');

function evaluateOutput(src, lines) {
  let root = document.createElement('div');
  
  new Messager(root, document);
  let tokens = lex(src);
  let ast = parse(tokens);
  let env = new GlobalEnvironment();
  ast.evaluate(env);

  let html = lines.join('<br>') + '<br>';

  expect(root.innerHTML).toBe(html);
}

test('gets true from boolean literal', () => {
  let a = new ExpressionBoolean(true);
  expect(a.value).toBe(true);
});

// --------------------------------------------------------------------------- 
// Loops
// --------------------------------------------------------------------------- 

test('for to marches from 0 to exclusive upper bound', () => {
  let src = `
for i to 5
  print(i)
`.substring(1);
  let lines = ['0', '1', '2', '3', '4'];
  evaluateOutput(src, lines);
});

test('for through marches from 0 to inclusive upper bound', () => {
  let src = `
for i through 5
  print(i)
`.substring(1);
  let lines = ['0', '1', '2', '3', '4', '5'];
  evaluateOutput(src, lines);
});

test('for in marches through inclusive range', () => {
  let src = `
for i in 0..5
  print(i)
`.substring(1);
  let lines = ['0', '1', '2', '3', '4', '5'];
  evaluateOutput(src, lines);
});

test('for to-by marches from 0 to exclusive upper bound', () => {
  let src = `
for i to 5 by 2
  print(i)
`.substring(1);
  let lines = ['0', '2', '4'];
  evaluateOutput(src, lines);
});

test('for through-by marches from 0 to inclusive upper bound', () => {
  let src = `
for i through 5 by 2
  print(i)
`.substring(1);
  let lines = ['0', '2', '4'];
  evaluateOutput(src, lines);
});

test('for in-by marches through inclusive range', () => {
  let src = `
for i in 0..5 by 2
  print(i)
`.substring(1);
  let lines = ['0', '2', '4'];
  evaluateOutput(src, lines);
});

test('for to-by marches from 0 to exclusive upper bound', () => {
  let src = `
for i to 6 by 2
  print(i)
`.substring(1);
  let lines = ['0', '2', '4'];
  evaluateOutput(src, lines);
});

test('for through-by marches from 0 to inclusive upper bound', () => {
  let src = `
for i through 6 by 2
  print(i)
`.substring(1);
  let lines = ['0', '2', '4', '6'];
  evaluateOutput(src, lines);
});

test('for in-by marches through inclusive range', () => {
  let src = `
for i in 0..6 by 2
  print(i)
`.substring(1);
  let lines = ['0', '2', '4', '6'];
  evaluateOutput(src, lines);
});

// --------------------------------------------------------------------------- 

test('functions don\'t violate parent\'s scope', () => {
  let src = `
to foo(a, b)
  print(a + b)
  a = 11

a = 9
foo(a, 7)
print(a)
`.substring(1);
  let lines = ['16', '9'];
  evaluateOutput(src, lines);
});

// --------------------------------------------------------------------------- 

