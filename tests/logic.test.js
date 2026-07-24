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

test('distribuirEquilibrado iguala as somas de estrelas', function () {
  var nomes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
  var notas = { a: 5, b: 5, c: 5, d: 4, e: 4, f: 4, g: 2, h: 2, i: 2, j: 1, k: 1, l: 1 };
  var r = L.distribuirEquilibrado(nomes, notas, 4);
  var somas = r.times.map(function (t) {
    return t.reduce(function (s, n) { return s + notas[n]; }, 0);
  });
  assert.deepStrictEqual(somas, [12, 12, 12]);
  assert.deepStrictEqual(r.times.map(function (t) { return t.length; }), [4, 4, 4]);
  var todos = r.times[0].concat(r.times[1], r.times[2]).sort();
  assert.deepStrictEqual(todos, nomes.slice().sort());
});

test('distribuirEquilibrado usa nota padrão 3 pra desconhecidos', function () {
  var nomes = ['a', 'b', 'c', 'd', 'e', 'f'];
  var r = L.distribuirEquilibrado(nomes, {}, 2);
  assert.deepStrictEqual(r.times.map(function (t) { return t.length; }), [2, 2, 2]);
  var todos = r.times[0].concat(r.times[1], r.times[2]).sort();
  assert.deepStrictEqual(todos, nomes.slice().sort());
});

test('distribuirEquilibrado com lista incompleta: diferença máx 1 e faltam', function () {
  var nomes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  var r = L.distribuirEquilibrado(nomes, { a: 5, b: 1 }, 4);
  assert.strictEqual(r.faltam, 2);
  assert.deepStrictEqual(
    r.times.map(function (t) { return t.length; }).sort(),
    [3, 3, 4]
  );
});

test('distribuirEquilibrado separa próximos na ordem da lista', function () {
  var nomes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  var r = L.distribuirEquilibrado(nomes, {}, 2);
  assert.deepStrictEqual(r.proximos, ['g', 'h']);
});

var COLETES_FIXTURE = [
  { nome: 'Vermelho', emoji: '🔴' },
  { nome: 'Amarelo', emoji: '🟡' },
  { nome: 'Azul', emoji: '🔵' }
];

test('montarTexto sem notas reproduz o formato atual', function () {
  var sorteio = { times: [['João'], ['Pedro'], ['Rafinha']], proximos: ['Careca'] };
  var esperado = [
    '⚽ *SORTEIO DO RACHA* — Futsal (3 times de 4)',
    '',
    '🔴 *TIME VERMELHO*',
    '• João',
    '',
    '🟡 *TIME AMARELO*',
    '• Pedro',
    '',
    '🔵 *TIME AZUL*',
    '• Rafinha',
    '',
    '⏭️ *PRÓXIMOS*',
    '• Careca'
  ].join('\n');
  assert.strictEqual(
    L.montarTexto(sorteio, 'Futsal (3 times de 4)', COLETES_FIXTURE, null),
    esperado
  );
});

test('montarTexto com notas põe ⭐ por jogador, próximos sem nota', function () {
  var sorteio = { times: [['João'], ['Pedro'], ['Rafinha']], proximos: ['Careca'] };
  var notas = { 'joão': 4, pedro: 5 };
  var texto = L.montarTexto(sorteio, 'Futsal (3 times de 4)', COLETES_FIXTURE, notas);
  assert.ok(texto.indexOf('• João ⭐4') !== -1);
  assert.ok(texto.indexOf('• Pedro ⭐5') !== -1);
  assert.ok(texto.indexOf('• Rafinha ⭐3') !== -1); // padrão 3
  assert.ok(texto.indexOf('• Careca ⭐') === -1);   // próximo sem nota
});
