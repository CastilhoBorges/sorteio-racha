var test = require('node:test');
var assert = require('node:assert');
var L = require('../logic.js');

test('limparLinha remove numeração, emoji e sujeira', function () {
  assert.strictEqual(L.limparLinha('1. João ⚽'), 'João');
  assert.strictEqual(L.limparLinha('3 - Rafinha ✅'), 'Rafinha');
  assert.strictEqual(L.limparLinha('4) Careca 😂'), 'Careca');
  assert.strictEqual(L.limparLinha('  12 -  Zé Pequeno 🔥🔥 '), 'Zé Pequeno');
  assert.strictEqual(L.limparLinha('- - -'), '');
  assert.strictEqual(L.limparLinha(''), '');
  assert.strictEqual(L.limparLinha('1. O\u{2019}Neill ⚽'), 'O\u{2019}Neill');
});

test('extrairNomes deduplica e respeita excluídos', function () {
  var texto = '1. João\n2. Pedro\n3. joão\n\n4. Rafinha';
  assert.deepStrictEqual(L.extrairNomes(texto, {}), ['João', 'Pedro', 'Rafinha']);
  assert.deepStrictEqual(L.extrairNomes(texto, { pedro: true }), ['João', 'Rafinha']);
});

test('embaralhar preserva elementos e não muta o original', function () {
  var orig = ['a', 'b', 'c', 'd', 'e'];
  var copia = orig.slice();
  var res = L.embaralhar(orig);
  assert.deepStrictEqual(orig, copia);
  assert.strictEqual(res.length, 5);
  assert.deepStrictEqual(res.slice().sort(), copia.slice().sort());
});

test('distribuirAleatorio monta 3 times com todo mundo', function () {
  var nomes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
  var r = L.distribuirAleatorio(nomes, 4);
  assert.strictEqual(r.times.length, 3);
  assert.deepStrictEqual(r.times.map(function (t) { return t.length; }), [4, 4, 4]);
  assert.deepStrictEqual(r.proximos, []);
  assert.strictEqual(r.faltam, 0);
  var todos = r.times[0].concat(r.times[1], r.times[2]).sort();
  assert.deepStrictEqual(todos, nomes.slice().sort());
});

test('distribuirAleatorio separa próximos na ordem da lista', function () {
  var nomes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'];
  var r = L.distribuirAleatorio(nomes, 4);
  assert.deepStrictEqual(r.proximos, ['m', 'n']);
  assert.strictEqual(r.faltam, 0);
});

test('distribuirAleatorio com lista incompleta: faltam e diferença máx 1', function () {
  var nomes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  var r = L.distribuirAleatorio(nomes, 4);
  assert.strictEqual(r.faltam, 2);
  assert.deepStrictEqual(
    r.times.map(function (t) { return t.length; }).sort(),
    [3, 3, 4]
  );
});
