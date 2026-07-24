(function () {
  var COLETES = [
    { nome: 'Vermelho', cor: '#FF4D3E', emoji: '🔴' },
    { nome: 'Amarelo', cor: '#FFD400', emoji: '🟡' },
    { nome: 'Azul',    cor: '#2E9BFF', emoji: '🔵' }
  ];
  var MODES = { futsal: { porTime: 4, rotulo: 'Futsal (3 times de 4)' },
                society: { porTime: 6, rotulo: 'Society (3 times de 6)' } };

  var mode = 'futsal';
  var excluidos = {};        // nomes removidos manualmente (clique no ×)
  var ultimoSorteio = null;  // { times: [[..],[..],[..]], proximos: [..] }

  var $ = function (id) { return document.getElementById(id); };
  var lista = $('lista'), chips = $('chips'), counter = $('counter'),
      sortBtn = $('sortBtn'), results = $('results'), teamsEl = $('teams'),
      bench = $('bench'), benchNames = $('benchNames'), rNote = $('rNote'),
      toast = $('toast');

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

  // ---- limpeza da lista ----
  function limparLinha(linha) {
    var s = linha;
    s = s.replace(/^\s*\d+\s*[-–—.):>]*\s*/, '');            // numeração no começo
    s = s.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/gu, ''); // bandeiras e tons de pele
    s = s.replace(/[^\p{L}\s'’\-]/gu, ' ');                   // só letras, espaço, hífen, apóstrofo
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/^[-'’\s]+|[-'’\s]+$/g, '');
    return s;
  }

  function nomesDetectados() {
    var vistos = {};
    var out = [];
    lista.value.split(/\r?\n/).forEach(function (linha) {
      var nome = limparLinha(linha);
      if (!nome) return;
      var chave = nome.toLowerCase();
      if (vistos[chave] || excluidos[chave]) return;
      vistos[chave] = true;
      out.push(nome);
    });
    return out;
  }

  // ---- render da prévia ----
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

    sortBtn.disabled = nomes.length < 3;
  }
  lista.addEventListener('input', function () { excluidos = {}; render(); });

  // ---- sorteio ----
  function embaralhar(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function sortear() {
    var nomes = nomesDetectados();
    var precisa = MODES[mode].porTime * 3;

    var jogam = nomes.slice(0, Math.min(nomes.length, precisa)); // ordem da lista = prioridade
    var proximos = nomes.slice(precisa);

    var sorteados = embaralhar(jogam);
    var times = [[], [], []];
    sorteados.forEach(function (nome, i) { times[i % 3].push(nome); });

    ultimoSorteio = { times: times, proximos: proximos, faltam: Math.max(0, precisa - jogam.length) };
    mostrarResultado();
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

    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  sortBtn.addEventListener('click', sortear);
  $('againBtn').addEventListener('click', sortear);

  // ---- exportar pro WhatsApp ----
  function montarTexto() {
    var s = ultimoSorteio;
    var linhas = ['⚽ *SORTEIO DO RACHA* — ' + MODES[mode].rotulo, ''];
    s.times.forEach(function (time, i) {
      linhas.push(COLETES[i].emoji + ' *TIME ' + COLETES[i].nome.toUpperCase() + '*');
      time.forEach(function (nome) { linhas.push('• ' + nome); });
      linhas.push('');
    });
    if (s.proximos.length > 0) {
      linhas.push('⏭️ *PRÓXIMOS*');
      s.proximos.forEach(function (nome) { linhas.push('• ' + nome); });
    }
    return linhas.join('\n').trim();
  }

  $('waBtn').addEventListener('click', function () {
    if (!ultimoSorteio) return;
    window.open('https://wa.me/?text=' + encodeURIComponent(montarTexto()), '_blank');
  });

  $('copyBtn').addEventListener('click', function () {
    if (!ultimoSorteio) return;
    var texto = montarTexto();

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
})();
