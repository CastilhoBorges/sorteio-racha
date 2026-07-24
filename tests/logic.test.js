// rode com: node --test  (rodar com "node --test tests/" falha nesta versão do Node)
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

test('limparLinha não corrompe nomes terminados/começados em letras do escape \\u2019 (regressão)', function () {
  // regressão: uma versão anterior da regex de trim usava /\u{2019}/ sem a flag "u",
  // o que degradava para o escape de identidade "u" seguido de "2019" literais,
  // apagando a letra "u" (e dígitos/chaves) do início/fim dos nomes.
  assert.strictEqual(L.limparLinha('11. Edu'), 'Edu');
  assert.strictEqual(L.limparLinha('Cacau'), 'Cacau');
  assert.strictEqual(L.limparLinha('3. Du'), 'Du');
  // apóstrofo curvo líder/final deve ser removido (ao contrário do interno, em "O’Neill")
  assert.strictEqual(L.limparLinha('\u{2019}Ana\u{2019}'), 'Ana');
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

test('distribuirEquilibrado sorteia de novo produz arranjos diferentes (embaralha empatados)', function () {
  // todo mundo empatado na mesma nota: com 3+ jogadores no mesmo grupo, o embaralhamento
  // dentro do empate deve gerar arranjos de times diferentes em execuções repetidas.
  var nomes = ['a', 'b', 'c'];
  var notas = { a: 3, b: 3, c: 3 };
  var arranjos = {};
  for (var i = 0; i < 50; i++) {
    var r = L.distribuirEquilibrado(nomes, notas, 1);
    arranjos[JSON.stringify(r.times)] = true;
  }
  assert.ok(Object.keys(arranjos).length > 1,
    'esperava mais de 1 arranjo distinto em 50 sorteios, obteve ' + Object.keys(arranjos).length);
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

function storageFake(valorInicial) {
  var dados = {};
  if (valorInicial !== undefined) dados[L.CHAVE_NOTAS] = valorInicial;
  return {
    getItem: function (k) { return k in dados ? dados[k] : null; },
    setItem: function (k, v) { dados[k] = String(v); },
    _dados: dados
  };
}

test('repositório lê notas salvas e normaliza o nome', function () {
  var st = storageFake(JSON.stringify({ 'joão': 5, pedro: 2 }));
  var repo = L.criarRepositorioNotas(st);
  assert.strictEqual(repo.obter('João'), 5);
  assert.strictEqual(repo.obter('PEDRO'), 2);
  assert.strictEqual(repo.obter('Rafinha'), null);
});

test('definir salva no storage na hora', function () {
  var st = storageFake();
  var repo = L.criarRepositorioNotas(st);
  repo.definir('Careca', 4);
  assert.strictEqual(JSON.parse(st._dados[L.CHAVE_NOTAS]).careca, 4);
  assert.strictEqual(repo.obter('careca'), 4);
});

test('storage nulo funciona só em memória', function () {
  var repo = L.criarRepositorioNotas(null);
  repo.definir('João', 2);
  assert.strictEqual(repo.obter('joão'), 2);
});

test('JSON corrompido ou valores inválidos não quebram', function () {
  var repo = L.criarRepositorioNotas(storageFake('{{{'));
  assert.strictEqual(repo.obter('João'), null);
  var repo2 = L.criarRepositorioNotas(storageFake(JSON.stringify({ 'joão': 9 })));
  assert.strictEqual(repo2.obter('João'), null);
});

test('nota não inteira ou truthy não vira jogador fantasma (regressão): obter/notaDe degradam ao padrão', function () {
  // regressão: notaDe e repo.obter só checavam n >= 1 && n <= 5, sem exigir inteiro.
  // um valor corrompido tipo 4.5 ou true caía num grupo (grupos[4.5]/grupos[true]) que o
  // laço [5,4,3,2,1] nunca lê, apagando o jogador de todos os times e de "próximos".
  var repo = L.criarRepositorioNotas(storageFake(JSON.stringify({ 'joão': 4.5, maria: true })));
  assert.strictEqual(repo.obter('joão'), null);
  assert.strictEqual(repo.obter('maria'), null);
  assert.strictEqual(L.notaDe({ joão: 4.5 }, 'joão'), 3);
  assert.strictEqual(L.notaDe({ maria: true }, 'maria'), 3);

  var nomes = ['joão', 'a', 'b'];
  var r = L.distribuirEquilibrado(nomes, { joão: 4.5 }, 1);
  var todos = r.times[0].concat(r.times[1], r.times[2], r.proximos).sort();
  assert.deepStrictEqual(todos, nomes.slice().sort());
});

test('todas devolve cópia, no formato de distribuirEquilibrado', function () {
  var repo = L.criarRepositorioNotas(storageFake(JSON.stringify({ 'joão': 4 })));
  var copia = repo.todas();
  assert.deepStrictEqual(copia, { 'joão': 4 });
  copia['joão'] = 1;
  assert.strictEqual(repo.obter('João'), 4);
});

test('storage que lança exceção não quebra', function () {
  var storageQuebrado = {
    getItem: function () { throw new Error('falhou'); },
    setItem: function () { throw new Error('falhou'); }
  };
  var repo = L.criarRepositorioNotas(storageQuebrado);
  assert.strictEqual(repo.obter('João'), null);
  repo.definir('João', 4);
  assert.strictEqual(repo.obter('João'), 4);
});
