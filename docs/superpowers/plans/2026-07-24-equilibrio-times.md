# Sorteio Equilibrado por Qualidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao Sorteio do Racha um wizard de 3 etapas com avaliação opcional dos jogadores por estrelas (1–5) e sorteio equilibrado por snake draft, conforme o spec `docs/superpowers/specs/2026-07-24-equilibrio-times-design.md`.

**Architecture:** A lógica de domínio (parsing de nomes, embaralhamento, distribuição aleatória e equilibrada, montagem do texto de WhatsApp, repositório de notas) sai do `script.js` para um novo `logic.js` puro, sem DOM, com export duplo (global `RachaLogic` no browser, `module.exports` no Node) — o que permite testes com o runner embutido do Node. O `script.js` fica só com estado de UI e wiring de DOM; o `index.html` vira 3 seções de etapa alternadas por `hidden`.

**Tech Stack:** HTML/CSS/JavaScript vanilla (ES5-style, como o código existente). Testes com `node --test` (runner embutido, zero dependências). Node v25 já instalado na máquina.

## Global Constraints

- Proibido adicionar npm, `package.json`, dependências ou frameworks (de UI ou de teste) — spec, seção "Fora de escopo".
- Node é usado **apenas** para rodar testes: `node --test tests/` a partir da raiz do projeto.
- Todo texto de UI em pt-BR, no tom informal do app existente ("pra", "racha").
- Chave do localStorage, exata: `sorteioracha:notas`. Formato: objeto `{ "nome normalizado (minúsculas)": 1..5 }`.
- Nota padrão para jogador sem avaliação: **3**.
- O sorteio aleatório (fluxo "pular") mantém comportamento e texto exportado **idênticos** aos atuais — sem estrelas.
- Sempre 3 times; diferença máxima de 1 jogador entre times.
- Estilo de código: seguir o existente (`var`, IIFE, funções nomeadas, comentários curtos em pt-BR).
- Mensagens de commit terminam com:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- O app é aberto direto do disco: `file:///C:/Users/augus/Desktop/Projects/sorteioracha/index.html` (use o browser do Playwright MCP se disponível, senão peça verificação manual).

## File Structure

- `logic.js` (criar) — funções puras de domínio, sem DOM. Export duplo browser/Node.
- `tests/logic.test.js` (criar) — suíte `node:test` cobrindo todo o `logic.js`.
- `index.html` (modificar) — markup do wizard (3 etapas + indicador de progresso), carrega `logic.js` antes de `script.js`.
- `style.css` (modificar) — estilos do wizard, das linhas de avaliação e dos botões-link.
- `script.js` (modificar) — só estado de UI, eventos e render de DOM; delega domínio ao `RachaLogic`.

---

### Task 1: Criar `logic.js` com parsing de nomes + testes, e ligar no app

**Files:**
- Create: `logic.js`
- Create: `tests/logic.test.js`
- Modify: `index.html` (linha do `<script src="script.js">`)
- Modify: `script.js` (remover funções movidas, delegar ao `RachaLogic`)

**Interfaces:**
- Consumes: nada (primeira task).
- Produces (usado pelas tasks 2–8):
  - `RachaLogic.limparLinha(linha: string): string`
  - `RachaLogic.extrairNomes(texto: string, excluidos: Object<string, boolean>): string[]` — deduplica por nome em minúsculas, pula excluídos.
  - `RachaLogic.embaralhar(arr: any[]): any[]` — Fisher–Yates, **não** muta o original.
  - O esqueleto de export duplo onde as próximas tasks acrescentam funções.

- [ ] **Step 1: Escrever os testes (que devem falhar)**

Criar `tests/logic.test.js` com exatamente:

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module '../logic.js'`.

- [ ] **Step 3: Criar `logic.js`**

Conteúdo completo (as funções vêm do `script.js` atual, sem mudança de comportamento — `extrairNomes` é o antigo `nomesDetectados` recebendo o texto por parâmetro):

```js
(function (root) {
  'use strict';

  function limparLinha(linha) {
    var s = linha;
    s = s.replace(/^\s*\d+\s*[-–—.):>]*\s*/, '');            // numeração no começo
    s = s.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/gu, ''); // bandeiras e tons de pele
    s = s.replace(/[^\p{L}\s'’\-]/gu, ' ');                   // só letras, espaço, hífen, apóstrofo
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/^[-'’\s]+|[-'’\s]+$/g, '');
    return s;
  }

  function extrairNomes(texto, excluidos) {
    var vistos = {};
    var out = [];
    texto.split(/\r?\n/).forEach(function (linha) {
      var nome = limparLinha(linha);
      if (!nome) return;
      var chave = nome.toLowerCase();
      if (vistos[chave] || (excluidos && excluidos[chave])) return;
      vistos[chave] = true;
      out.push(nome);
    });
    return out;
  }

  function embaralhar(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var api = {
    limparLinha: limparLinha,
    extrairNomes: extrairNomes,
    embaralhar: embaralhar
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RachaLogic = api;
})(this);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS (3 testes).

- [ ] **Step 5: Ligar no app**

Em `index.html`, trocar:

```html
<script src="script.js"></script>
```

por:

```html
<script src="logic.js"></script>
<script src="script.js"></script>
```

Em `script.js`:
1. Logo após `(function () {`, adicionar: `var L = window.RachaLogic;`
2. Apagar as funções `limparLinha` e `embaralhar` inteiras.
3. Substituir a função `nomesDetectados` inteira por:

```js
  function nomesDetectados() { return L.extrairNomes(lista.value, excluidos); }
```

4. Na função `sortear`, trocar `var sorteados = embaralhar(jogam);` por `var sorteados = L.embaralhar(jogam);`.

- [ ] **Step 6: Verificar no browser**

Abrir `file:///C:/Users/augus/Desktop/Projects/sorteioracha/index.html`. Colar 12 nomes (um por linha) no textarea, conferir que os chips aparecem, clicar "Sortear times", conferir que os 3 coletes aparecem. Nenhum erro no console.

- [ ] **Step 7: Commit**

```bash
git add logic.js tests/logic.test.js index.html script.js
git commit -m "Extrai parsing de nomes para logic.js com testes em node --test

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `distribuirAleatorio` em `logic.js` + testes

**Files:**
- Modify: `logic.js`
- Test: `tests/logic.test.js` (acrescentar no final)

**Interfaces:**
- Consumes: `embaralhar` (Task 1).
- Produces (usado pelas tasks 3 e 6):
  - `RachaLogic.distribuirAleatorio(nomes: string[], porTime: number): { times: string[][], proximos: string[], faltam: number }` — replica o sorteio atual: primeiros `porTime × 3` jogam (ordem da lista = prioridade), embaralha e distribui round-robin `i % 3`.
  - Helper interno `separarJogadores(nomes, porTime): { jogam, proximos, faltam }` (não exportado; a Task 3 também o usa).

- [ ] **Step 1: Escrever os testes (que devem falhar)**

Acrescentar ao final de `tests/logic.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/`
Expected: os 3 testes novos FALHAM com `L.distribuirAleatorio is not a function`; os antigos passam.

- [ ] **Step 3: Implementar**

Em `logic.js`, antes de `var api = {`:

```js
  function separarJogadores(nomes, porTime) {
    var precisa = porTime * 3;
    var corte = Math.min(nomes.length, precisa);
    return {
      jogam: nomes.slice(0, corte),
      proximos: nomes.slice(precisa),
      faltam: Math.max(0, precisa - corte)
    };
  }

  function distribuirAleatorio(nomes, porTime) {
    var sep = separarJogadores(nomes, porTime);
    var times = [[], [], []];
    embaralhar(sep.jogam).forEach(function (nome, i) { times[i % 3].push(nome); });
    return { times: times, proximos: sep.proximos, faltam: sep.faltam };
  }
```

E no objeto `api`, acrescentar a linha:

```js
    distribuirAleatorio: distribuirAleatorio,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add logic.js tests/logic.test.js
git commit -m "Adiciona distribuirAleatorio puro em logic.js

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `distribuirEquilibrado` (snake draft) + testes

**Files:**
- Modify: `logic.js`
- Test: `tests/logic.test.js` (acrescentar no final)

**Interfaces:**
- Consumes: `embaralhar`, `separarJogadores` (Tasks 1–2).
- Produces (usado pelas tasks 4 e 6):
  - `RachaLogic.distribuirEquilibrado(nomes: string[], notas: Object<string, number>, porTime: number): { times: string[][], proximos: string[], faltam: number }` — `notas` tem chaves em minúsculas; nota ausente/inválida vale 3.
  - Helper interno `notaDe(notas, nome): number` — retorna a nota 1..5 ou 3 como padrão (a Task 4 também o usa; não exportado).

- [ ] **Step 1: Escrever os testes (que devem falhar)**

Acrescentar ao final de `tests/logic.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/`
Expected: os 4 testes novos FALHAM com `L.distribuirEquilibrado is not a function`.

- [ ] **Step 3: Implementar**

Em `logic.js`, depois de `distribuirAleatorio` e antes de `var api = {`:

```js
  function notaDe(notas, nome) {
    var n = notas ? notas[nome.toLowerCase()] : null;
    return (n >= 1 && n <= 5) ? n : 3;
  }

  function distribuirEquilibrado(nomes, notas, porTime) {
    var sep = separarJogadores(nomes, porTime);
    // agrupa por nota e embaralha os empatados: o sorteio continua sendo sorteio
    var grupos = {};
    sep.jogam.forEach(function (nome) {
      var n = notaDe(notas, nome);
      (grupos[n] = grupos[n] || []).push(nome);
    });
    var ordenados = [];
    [5, 4, 3, 2, 1].forEach(function (n) {
      if (grupos[n]) ordenados = ordenados.concat(embaralhar(grupos[n]));
    });
    // serpentina: rodada par distribui 1,2,3 — rodada ímpar 3,2,1
    var times = [[], [], []];
    ordenados.forEach(function (nome, i) {
      var rodada = Math.floor(i / 3);
      var pos = i % 3;
      times[rodada % 2 === 0 ? pos : 2 - pos].push(nome);
    });
    return { times: times, proximos: sep.proximos, faltam: sep.faltam };
  }
```

E no objeto `api`, acrescentar:

```js
    distribuirEquilibrado: distribuirEquilibrado,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add logic.js tests/logic.test.js
git commit -m "Adiciona sorteio equilibrado por snake draft com desempate aleatório

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `montarTexto` puro com estrelas opcionais + testes

**Files:**
- Modify: `logic.js`
- Test: `tests/logic.test.js` (acrescentar no final)

**Interfaces:**
- Consumes: `notaDe` (Task 3).
- Produces (usado pelas tasks 6 e 8):
  - `RachaLogic.montarTexto(sorteio: { times: string[][], proximos: string[] }, rotulo: string, coletes: Array<{ nome: string, emoji: string }>, notas: Object<string, number> | null): string` — com `notas`, cada jogador de time sai como `• Nome ⭐N` (próximos sem nota); com `null`, formato idêntico ao atual.

- [ ] **Step 1: Escrever os testes (que devem falhar)**

Acrescentar ao final de `tests/logic.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/`
Expected: os 2 testes novos FALHAM com `L.montarTexto is not a function`.

- [ ] **Step 3: Implementar**

Em `logic.js`, antes de `var api = {`:

```js
  function montarTexto(sorteio, rotulo, coletes, notas) {
    var linhas = ['⚽ *SORTEIO DO RACHA* — ' + rotulo, ''];
    sorteio.times.forEach(function (time, i) {
      linhas.push(coletes[i].emoji + ' *TIME ' + coletes[i].nome.toUpperCase() + '*');
      time.forEach(function (nome) {
        linhas.push('• ' + nome + (notas ? ' ⭐' + notaDe(notas, nome) : ''));
      });
      linhas.push('');
    });
    if (sorteio.proximos.length > 0) {
      linhas.push('⏭️ *PRÓXIMOS*');
      sorteio.proximos.forEach(function (nome) { linhas.push('• ' + nome); });
    }
    return linhas.join('\n').trim();
  }
```

E no objeto `api`, acrescentar:

```js
    montarTexto: montarTexto,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS (12 testes).

- [ ] **Step 5: Commit**

```bash
git add logic.js tests/logic.test.js
git commit -m "Adiciona montarTexto puro com estrelas opcionais

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Repositório de notas com localStorage injetável + testes

**Files:**
- Modify: `logic.js`
- Test: `tests/logic.test.js` (acrescentar no final)

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces (usado pelas tasks 6–8):
  - `RachaLogic.CHAVE_NOTAS: string` — `'sorteioracha:notas'`.
  - `RachaLogic.criarRepositorioNotas(storage: { getItem, setItem } | null): repo` com:
    - `repo.obter(nome: string): number | null` — nota 1..5 ou `null`; normaliza o nome pra minúsculas.
    - `repo.definir(nome: string, nota: number): void` — salva em memória e no storage na hora.
    - `repo.todas(): Object<string, number>` — cópia do mapa `{ nome minúsculo: nota }` (formato aceito por `distribuirEquilibrado` e `montarTexto`).
  - `storage === null`, storage que lança exceção, JSON corrompido ou valores inválidos: nunca quebram; degradam pra memória/valor padrão.

- [ ] **Step 1: Escrever os testes (que devem falhar)**

Acrescentar ao final de `tests/logic.test.js`:

```js
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

test('todas devolve cópia, no formato de distribuirEquilibrado', function () {
  var repo = L.criarRepositorioNotas(storageFake(JSON.stringify({ 'joão': 4 })));
  var copia = repo.todas();
  assert.deepStrictEqual(copia, { 'joão': 4 });
  copia['joão'] = 1;
  assert.strictEqual(repo.obter('João'), 4);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/`
Expected: os 5 testes novos FALHAM (`L.criarRepositorioNotas is not a function`).

- [ ] **Step 3: Implementar**

Em `logic.js`, antes de `var api = {`:

```js
  var CHAVE_NOTAS = 'sorteioracha:notas';

  function criarRepositorioNotas(storage) {
    var notas = {};
    if (storage) {
      try { notas = JSON.parse(storage.getItem(CHAVE_NOTAS)) || {}; }
      catch (e) { notas = {}; }
      if (typeof notas !== 'object' || Array.isArray(notas) || notas === null) notas = {};
    }
    function salvar() {
      if (!storage) return;
      try { storage.setItem(CHAVE_NOTAS, JSON.stringify(notas)); } catch (e) {}
    }
    return {
      obter: function (nome) {
        var n = notas[nome.toLowerCase()];
        return (n >= 1 && n <= 5) ? n : null;
      },
      definir: function (nome, nota) {
        notas[nome.toLowerCase()] = nota;
        salvar();
      },
      todas: function () {
        var copia = {};
        Object.keys(notas).forEach(function (k) { copia[k] = notas[k]; });
        return copia;
      }
    };
  }
```

E no objeto `api`, acrescentar:

```js
    criarRepositorioNotas: criarRepositorioNotas,
    CHAVE_NOTAS: CHAVE_NOTAS,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS (17 testes).

- [ ] **Step 5: Commit**

```bash
git add logic.js tests/logic.test.js
git commit -m "Adiciona repositório de notas com storage injetável

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Wizard de 3 etapas — markup, CSS, navegação e sorteios ligados

**Files:**
- Modify: `index.html` (corpo inteiro do `<body>`)
- Modify: `style.css`
- Modify: `script.js` (reescrita completa)

**Interfaces:**
- Consumes: `extrairNomes`, `distribuirAleatorio`, `distribuirEquilibrado`, `montarTexto`, `criarRepositorioNotas` (Tasks 1–5).
- Produces (usado pelas tasks 7–8):
  - IDs de DOM: `etapa1`, `etapa2`, `etapa3`, `passo1..3`, `continuarBtn`, `avaliacao`, `sortEqBtn`, `skipBtn`, `voltar2Btn`, `voltar3Btn`, e os já existentes (`lista`, `chips`, `counter`, `teams`, `bench`, `benchNames`, `rNote`, `waBtn`, `copyBtn`, `againBtn`, `toast`).
  - Em `script.js`: variáveis `tipoSorteio` (`'equilibrado' | 'aleatorio'`), `repoNotas` (repositório da Task 5), e as funções `renderAvaliacao()` (stub vazio que a Task 7 preenche), `mostrarResultado()`, `sortear(tipo)`, `irParaEtapa(n)`, `nomesDetectados()`.

Nesta task a etapa 2 ainda não tem as linhas de estrelas (`renderAvaliacao` é um stub); "Sortear equilibrado" já funciona usando as notas salvas (todo mundo sem nota vale 3). O app fica funcional e navegável de ponta a ponta.

- [ ] **Step 1: Reestruturar o `<body>` do `index.html`**

Substituir todo o conteúdo entre `<body>` e `</body>` (mantendo os `<script>` no final) por:

```html
<div class="court" aria-hidden="true">
  <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMin slice">
    <circle cx="500" cy="120" r="150" fill="none" stroke="rgba(242,245,239,0.06)" stroke-width="2"/>
    <line x1="0" y1="120" x2="1000" y2="120" stroke="rgba(242,245,239,0.06)" stroke-width="2"/>
    <circle cx="500" cy="120" r="5" fill="rgba(242,245,239,0.06)"/>
  </svg>
</div>

<div class="wrap">
  <header>
    <h1>Sorteio do Racha</h1>
    <nav class="passos" aria-label="Etapas">
      <span class="passo ativo" id="passo1">1 Lista</span>
      <span class="passo" id="passo2">2 Times</span>
      <span class="passo" id="passo3">3 Resultado</span>
    </nav>
  </header>

  <section class="etapa" id="etapa1">
    <div class="mode" role="group" aria-label="Modalidade">
      <button type="button" id="modeSociety" aria-pressed="false">
        <span class="m-name">Society</span>
        <span class="m-desc">3 times de 6 &middot; 18 em campo</span>
      </button>
      <button type="button" id="modeFutsal" aria-pressed="false">
        <span class="m-name">Futsal</span>
        <span class="m-desc">3 times de 4 &middot; 12 na quadra</span>
      </button>
    </div>

    <div class="field">
      <label for="lista">Cole a lista do grupo
        <span class="hint">&mdash; pode vir com números, emoji, traço, o que for. Eu limpo.</span>
      </label>
      <textarea id="lista" placeholder="1. João ⚽&#10;2. Pedro 🔥&#10;3 - Rafinha ✅&#10;4) Careca 😂&#10;..."></textarea>
      <div class="parsed">
        <div class="counter" id="counter">Nenhum nome detectado ainda.</div>
        <div class="chips" id="chips"></div>
      </div>
      <button class="cta" id="continuarBtn" disabled>Continuar</button>
    </div>
  </section>

  <section class="etapa" id="etapa2" hidden>
    <h2 class="etapa-titulo">Avalie os jogadores</h2>
    <p class="etapa-sub">Só você vê essas notas. Elas ficam salvas neste navegador pro próximo racha.</p>
    <div id="avaliacao"></div>
    <button class="cta" id="sortEqBtn">Sortear equilibrado</button>
    <div class="nav-sec">
      <button class="btn-link" id="skipBtn" type="button">Pular e sortear aleatório</button>
      <button class="btn-link" id="voltar2Btn" type="button">Voltar</button>
    </div>
  </section>

  <section class="etapa" id="etapa3" hidden>
    <p class="r-note" id="rNote" hidden></p>
    <div class="teams" id="teams"></div>
    <div class="bench" id="bench" hidden>
      <h3>Próximos (na ordem da lista)</h3>
      <p id="benchNames"></p>
    </div>
    <div class="actions">
      <button id="waBtn" type="button">Enviar no WhatsApp</button>
      <button id="copyBtn" type="button">Copiar texto</button>
      <button id="againBtn" type="button">Sortear de novo</button>
    </div>
    <div class="nav-sec">
      <button class="btn-link" id="voltar3Btn" type="button">Voltar</button>
    </div>
  </section>
</div>

<div id="toast" role="status">Copiado!</div>
```

- [ ] **Step 2: Atualizar o `style.css`**

1. Apagar a regra `#results { margin-top: 34px; }`.
2. Acrescentar no final do arquivo:

```css
/* wizard */
.passos {
  display: flex; justify-content: center; gap: 16px; margin-top: 12px;
  font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-dim);
}
.passo.ativo { color: var(--amarelo); font-weight: 700; }

.etapa-titulo {
  font-family: 'Anton', 'Arial Narrow', Impact, sans-serif; font-weight: 400;
  font-size: 24px; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 4px;
}
.etapa-sub { font-size: 13px; color: var(--ink-dim); margin-bottom: 14px; }

.nav-sec { display: flex; justify-content: center; gap: 22px; margin-top: 14px; }
.btn-link {
  background: none; border: none; color: var(--ink-dim); cursor: pointer;
  font-family: inherit; font-size: 14px; text-decoration: underline; padding: 6px;
}
.btn-link:hover { color: var(--ink); }
```

- [ ] **Step 3: Reescrever o `script.js`**

Conteúdo completo do arquivo:

```js
(function () {
  var L = window.RachaLogic;

  var COLETES = [
    { nome: 'Vermelho', cor: '#FF4D3E', emoji: '🔴' },
    { nome: 'Amarelo', cor: '#FFD400', emoji: '🟡' },
    { nome: 'Azul',    cor: '#2E9BFF', emoji: '🔵' }
  ];
  var MODES = { futsal: { porTime: 4, rotulo: 'Futsal (3 times de 4)' },
                society: { porTime: 6, rotulo: 'Society (3 times de 6)' } };

  var mode = 'futsal';
  var excluidos = {};        // nomes removidos manualmente (clique no ×)
  var ultimoSorteio = null;  // { times, proximos, faltam }
  var tipoSorteio = null;    // 'equilibrado' | 'aleatorio'

  var $ = function (id) { return document.getElementById(id); };
  var lista = $('lista'), chips = $('chips'), counter = $('counter'),
      continuarBtn = $('continuarBtn'), teamsEl = $('teams'),
      bench = $('bench'), benchNames = $('benchNames'), rNote = $('rNote'),
      avaliacao = $('avaliacao'), toast = $('toast');

  var repoNotas = L.criarRepositorioNotas((function () {
    try { return window.localStorage; } catch (e) { return null; }
  })());

  // sugere a modalidade pelo dia da semana (sex–dom = society)
  var dia = new Date().getDay();
  mode = (dia === 0 || dia === 5 || dia === 6) ? 'society' : 'futsal';

  function setMode(m) {
    mode = m;
    $('modeFutsal').setAttribute('aria-pressed', String(m === 'futsal'));
    $('modeSociety').setAttribute('aria-pressed', String(m === 'society'));
    render();
  }
  $('modeFutsal').addEventListener('click', function () { setMode('futsal'); });
  $('modeSociety').addEventListener('click', function () { setMode('society'); });

  function nomesDetectados() { return L.extrairNomes(lista.value, excluidos); }

  // ---- wizard ----
  function irParaEtapa(n) {
    $('etapa1').hidden = n !== 1;
    $('etapa2').hidden = n !== 2;
    $('etapa3').hidden = n !== 3;
    [1, 2, 3].forEach(function (i) {
      $('passo' + i).classList.toggle('ativo', i === n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- render da prévia (etapa 1) ----
  function render() {
    var nomes = nomesDetectados();
    var precisa = MODES[mode].porTime * 3;

    chips.innerHTML = '';
    nomes.forEach(function (nome, i) {
      var chip = document.createElement('span');
      chip.className = 'chip' + (i >= precisa ? ' bench-chip' : '');
      var txt = document.createElement('span');
      txt.textContent = nome;
      var x = document.createElement('button');
      x.type = 'button';
      x.textContent = '×';
      x.setAttribute('aria-label', 'Remover ' + nome);
      x.addEventListener('click', function () {
        excluidos[nome.toLowerCase()] = true;
        render();
      });
      chip.appendChild(txt);
      chip.appendChild(x);
      chips.appendChild(chip);
    });

    counter.className = 'counter';
    if (nomes.length === 0) {
      counter.textContent = 'Nenhum nome detectado ainda.';
    } else if (nomes.length < precisa) {
      counter.className += ' warn';
      counter.innerHTML = '<strong>' + nomes.length + ' nomes</strong> — faltam ' +
        (precisa - nomes.length) + ' pra fechar ' + precisa + ' (' + MODES[mode].rotulo + ').';
    } else if (nomes.length === precisa) {
      counter.className += ' ok';
      counter.innerHTML = '<strong>' + nomes.length + ' nomes</strong> — conta fechada pro ' + mode + '.';
    } else {
      counter.innerHTML = '<strong>' + nomes.length + ' nomes</strong> — os ' + precisa +
        ' primeiros da lista entram no sorteio, ' + (nomes.length - precisa) + ' ficam de próximo.';
    }

    continuarBtn.disabled = nomes.length < 3;
  }
  lista.addEventListener('input', function () { excluidos = {}; render(); });

  continuarBtn.addEventListener('click', function () {
    renderAvaliacao();
    irParaEtapa(2);
  });

  // ---- etapa 2: avaliação ----
  function renderAvaliacao() {
    // as linhas de estrelas entram na próxima tarefa
  }
  $('voltar2Btn').addEventListener('click', function () { irParaEtapa(1); });
  $('sortEqBtn').addEventListener('click', function () { sortear('equilibrado'); });
  $('skipBtn').addEventListener('click', function () { sortear('aleatorio'); });

  // ---- sorteio ----
  function sortear(tipo) {
    tipoSorteio = tipo;
    var nomes = nomesDetectados();
    var porTime = MODES[mode].porTime;
    ultimoSorteio = tipo === 'equilibrado'
      ? L.distribuirEquilibrado(nomes, repoNotas.todas(), porTime)
      : L.distribuirAleatorio(nomes, porTime);
    mostrarResultado();
    irParaEtapa(3);
  }

  function mostrarResultado() {
    var s = ultimoSorteio;
    teamsEl.innerHTML = '';
    s.times.forEach(function (time, i) {
      var card = document.createElement('article');
      card.className = 'colete';
      card.style.backgroundColor = COLETES[i].cor;
      var label = document.createElement('div');
      label.className = 't-label';
      label.textContent = 'Time ' + (i + 1);
      var h2 = document.createElement('h2');
      h2.textContent = 'Colete ' + COLETES[i].nome;
      var ol = document.createElement('ol');
      time.forEach(function (nome) {
        var li = document.createElement('li');
        li.textContent = nome;
        ol.appendChild(li);
      });
      card.appendChild(label);
      card.appendChild(h2);
      card.appendChild(ol);
      teamsEl.appendChild(card);
    });

    if (s.faltam > 0) {
      rNote.hidden = false;
      rNote.textContent = 'Faltaram ' + s.faltam + ' pra fechar a conta — sorteei com o que tem, times com diferença de no máximo 1.';
    } else {
      rNote.hidden = true;
    }

    if (s.proximos.length > 0) {
      bench.hidden = false;
      benchNames.textContent = s.proximos.join(' · ');
    } else {
      bench.hidden = true;
    }
  }

  $('againBtn').addEventListener('click', function () { sortear(tipoSorteio); });
  $('voltar3Btn').addEventListener('click', function () {
    irParaEtapa(tipoSorteio === 'aleatorio' ? 1 : 2);
  });

  // ---- exportar pro WhatsApp ----
  function textoAtual() {
    return L.montarTexto(ultimoSorteio, MODES[mode].rotulo, COLETES, null);
  }

  $('waBtn').addEventListener('click', function () {
    if (!ultimoSorteio) return;
    window.open('https://wa.me/?text=' + encodeURIComponent(textoAtual()), '_blank');
  });

  $('copyBtn').addEventListener('click', function () {
    if (!ultimoSorteio) return;
    var texto = textoAtual();

    function ok() {
      toast.classList.add('show');
      setTimeout(function () { toast.classList.remove('show'); }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(ok, function () { fallback(); });
    } else { fallback(); }

    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) {}
      document.body.removeChild(ta);
    }
  });

  setMode(mode);
  irParaEtapa(1);
})();
```

- [ ] **Step 4: Rodar os testes (garantir que nada quebrou)**

Run: `node --test tests/`
Expected: PASS (17 testes).

- [ ] **Step 5: Verificar no browser**

Abrir `file:///C:/Users/augus/Desktop/Projects/sorteioracha/index.html` e conferir:
1. Etapa 1 visível, indicador "1 Lista" em amarelo; "Continuar" desabilitado.
2. Colar 14 nomes → chips aparecem, contador conta, "Continuar" habilita.
3. "Continuar" → etapa 2 (título "Avalie os jogadores", área de avaliação vazia — esperado nesta task), "2 Times" em amarelo.
4. "Voltar" → etapa 1 com a lista intacta. "Continuar" de novo.
5. "Sortear equilibrado" → etapa 3 com 3 coletes de 4 jogadores cada (com 14 nomes no futsal, 12 jogam e os 2 últimos da lista ficam na seção "Próximos").
6. "Sortear de novo" → times mudam.
7. "Voltar" da etapa 3 → volta pra etapa 2.
8. Na etapa 2, "Pular e sortear aleatório" → etapa 3; "Voltar" agora volta pra etapa 1.
9. "Copiar texto" → toast "Copiado!"; texto sem estrelas.
10. Nenhum erro no console.

- [ ] **Step 6: Commit**

```bash
git add index.html style.css script.js
git commit -m "Transforma o app em wizard de 3 etapas com sorteio equilibrado

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Etapa de avaliação — linhas com estrelas, persistência e hint de xarás

**Files:**
- Modify: `script.js` (preencher `renderAvaliacao`)
- Modify: `style.css`
- Modify: `index.html` (hint do textarea)

**Interfaces:**
- Consumes: `repoNotas` (`obter`/`definir`), `nomesDetectados()`, IDs `avaliacao` e `continuarBtn` (Task 6).
- Produces: `renderAvaliacao()` completo — chamado ao entrar na etapa 2, re-renderiza a partir do estado atual (lista + modalidade + notas).

- [ ] **Step 1: Preencher `renderAvaliacao` no `script.js`**

Substituir o stub inteiro:

```js
  function renderAvaliacao() {
    // as linhas de estrelas entram na próxima tarefa
  }
```

por:

```js
  function renderAvaliacao() {
    var nomes = nomesDetectados();
    var precisa = MODES[mode].porTime * 3;
    avaliacao.innerHTML = '';
    nomes.forEach(function (nome, idx) {
      var row = document.createElement('div');
      row.className = 'aval-row' + (idx >= precisa ? ' aval-proximo' : '');
      var nomeEl = document.createElement('span');
      nomeEl.className = 'aval-nome';
      nomeEl.textContent = nome;
      var stars = document.createElement('div');
      stars.className = 'estrelas';
      stars.setAttribute('aria-label', 'Nota de ' + nome);
      var atual = repoNotas.obter(nome) || 3;
      for (var n = 1; n <= 5; n++) {
        (function (n) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'estrela' + (n <= atual ? ' cheia' : '');
          b.textContent = n <= atual ? '★' : '☆';
          b.setAttribute('aria-label', nome + ': ' + n + ' de 5');
          b.setAttribute('aria-pressed', String(n === atual));
          b.addEventListener('click', function () {
            repoNotas.definir(nome, n);
            renderAvaliacao();
          });
          stars.appendChild(b);
        })(n);
      }
      row.appendChild(nomeEl);
      row.appendChild(stars);
      avaliacao.appendChild(row);
    });
  }
```

- [ ] **Step 2: Estilos das linhas de avaliação no `style.css`**

Acrescentar no final do arquivo:

```css
/* etapa 2 — linhas de avaliação */
#avaliacao { margin-bottom: 6px; }
.aval-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 6px 0; border-bottom: 1px solid var(--line);
}
.aval-proximo { opacity: 0.55; }
.aval-nome { font-weight: 500; font-size: 15px; }
.estrelas { display: flex; }
.estrela {
  background: none; border: none; cursor: pointer;
  font-size: 24px; line-height: 1; padding: 6px 3px; color: var(--ink-dim);
}
.estrela.cheia { color: var(--amarelo); }
```

- [ ] **Step 3: Hint de xarás no `index.html`**

Trocar:

```html
        <span class="hint">&mdash; pode vir com números, emoji, traço, o que for. Eu limpo.</span>
```

por:

```html
        <span class="hint">&mdash; pode vir com números, emoji, traço, o que for. Eu limpo. Xarás? Diferencie na lista (ex.: João R. e João B.).</span>
```

- [ ] **Step 4: Rodar os testes**

Run: `node --test tests/`
Expected: PASS (17 testes).

- [ ] **Step 5: Verificar no browser**

Abrir `file:///C:/Users/augus/Desktop/Projects/sorteioracha/index.html` e conferir:
1. Colar 14 nomes → "Continuar" → etapa 2 lista os 14 na ordem da lista; os 2 além do corte (futsal: 13º e 14º) aparecem esmaecidos.
2. Todos começam com 3 estrelas cheias (★★★☆☆).
3. Tocar na 5ª estrela de um jogador → linha atualiza pra ★★★★★.
4. Recarregar a página, colar a mesma lista, "Continuar" → a nota dada persiste (5★), o resto continua 3★.
5. DevTools → Application → Local Storage → chave `sorteioracha:notas` contém o JSON esperado.
6. Voltar pra etapa 1, remover um jogador no ×, "Continuar" → ele some da avaliação.
7. Nenhum erro no console.

- [ ] **Step 6: Commit**

```bash
git add script.js style.css index.html
git commit -m "Adiciona avaliação por estrelas com persistência no navegador

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Estrelas no resultado e no WhatsApp + verificação final + push

**Files:**
- Modify: `script.js` (duas mudanças pequenas)

**Interfaces:**
- Consumes: `tipoSorteio`, `repoNotas`, `mostrarResultado`, `textoAtual` (Tasks 6–7); `montarTexto` com `notas` (Task 4).
- Produces: comportamento final do spec — nota por jogador visível no resultado e no texto exportado, **apenas** no sorteio equilibrado.

- [ ] **Step 1: Estrelas nos cards de resultado**

Em `mostrarResultado`, no `script.js`, trocar:

```js
      time.forEach(function (nome) {
        var li = document.createElement('li');
        li.textContent = nome;
        ol.appendChild(li);
      });
```

por:

```js
      time.forEach(function (nome) {
        var li = document.createElement('li');
        li.textContent = tipoSorteio === 'equilibrado'
          ? nome + ' ⭐' + (repoNotas.obter(nome) || 3)
          : nome;
        ol.appendChild(li);
      });
```

- [ ] **Step 2: Estrelas no texto exportado**

Em `script.js`, trocar a função `textoAtual` inteira por:

```js
  function textoAtual() {
    var notas = tipoSorteio === 'equilibrado' ? repoNotas.todas() : null;
    return L.montarTexto(ultimoSorteio, MODES[mode].rotulo, COLETES, notas);
  }
```

- [ ] **Step 3: Rodar os testes**

Run: `node --test tests/`
Expected: PASS (17 testes).

- [ ] **Step 4: Checklist manual completo (do spec)**

Abrir `file:///C:/Users/augus/Desktop/Projects/sorteioracha/index.html` e percorrer:
1. **Fluxo completo, futsal:** 12 nomes → Continuar → notas variadas → Sortear equilibrado → 3 times de 4 com "Nome ⭐N" em cada linha; somas de estrelas dos times visivelmente próximas (em listas típicas, diferença ≤ 2).
2. **Fluxo completo, society:** 18 nomes → mesmo caminho → 3 times de 6.
3. **Pular:** na etapa 2, "Pular e sortear aleatório" → resultado **sem** estrelas; "Copiar texto" → texto idêntico ao formato antigo (sem ⭐).
4. **Equilibrado + copiar:** sortear equilibrado → "Copiar texto" → colar em um editor: linhas `• Nome ⭐N`, próximos sem ⭐.
5. **Sortear de novo:** repetido no equilibrado → times mudam mas continuam com ⭐ e equilibrados; repetido no aleatório → sem ⭐.
6. **Persistência:** recarregar página → notas mantidas.
7. **Lista incompleta:** 10 nomes no futsal → aviso amarelo "Faltaram 2...", times 4/3/3.
8. **Voltar/avançar:** etapa 3 → Voltar → etapa 2 (equilibrado) ou etapa 1 (aleatório); nada se perde.
9. Nenhum erro no console em nenhum passo.

- [ ] **Step 5: Commit e push**

```bash
git add script.js
git commit -m "Mostra estrelas no resultado e no WhatsApp no sorteio equilibrado

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```
