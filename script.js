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
      var atual = L.notaDe(repoNotas.todas(), nome);
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
        li.textContent = tipoSorteio === 'equilibrado'
          ? nome + ' ⭐' + L.notaDe(repoNotas.todas(), nome)
          : nome;
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
    var notas = tipoSorteio === 'equilibrado' ? repoNotas.todas() : null;
    return L.montarTexto(ultimoSorteio, MODES[mode].rotulo, COLETES, notas);
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
