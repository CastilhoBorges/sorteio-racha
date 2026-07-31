(function () {
  var L = window.RachaLogic;
  var LIM = L.LIMITES_CONFIG;

  var excluidos = {};        // nomes removidos manualmente (clique no ×)
  var ultimoSorteio = null;  // { times, proximos, faltam }
  var tipoSorteio = null;    // 'equilibrado' | 'aleatorio'
  var paletaAberta = null;   // índice do time com a paleta de cores aberta, ou null

  var $ = function (id) { return document.getElementById(id); };
  var lista = $('lista'), chips = $('chips'), counter = $('counter'),
      continuarBtn = $('continuarBtn'), teamsEl = $('teams'),
      bench = $('bench'), benchNames = $('benchNames'), rNote = $('rNote'),
      avaliacao = $('avaliacao'), toast = $('toast'),
      coletesRow = $('coletesRow'), paleta = $('paleta'),
      timesVal = $('timesVal'), porTimeVal = $('porTimeVal');

  var storage = (function () {
    try { return window.localStorage; } catch (e) { return null; }
  })();
  var repoNotas = L.criarRepositorioNotas(storage);
  var repoConfig = L.criarRepositorioConfig(storage);
  var config = repoConfig.obter();

  function aplicarConfig(novo) {
    config = repoConfig.definir(novo);
    renderConfig();
    render();
  }

  // ---- configuração: steppers e coletes ----
  $('timesMenos').addEventListener('click', function () {
    aplicarConfig({ times: config.times - 1, porTime: config.porTime, cores: config.cores });
  });
  $('timesMais').addEventListener('click', function () {
    aplicarConfig({ times: config.times + 1, porTime: config.porTime, cores: config.cores });
  });
  $('porTimeMenos').addEventListener('click', function () {
    aplicarConfig({ times: config.times, porTime: config.porTime - 1, cores: config.cores });
  });
  $('porTimeMais').addEventListener('click', function () {
    aplicarConfig({ times: config.times, porTime: config.porTime + 1, cores: config.cores });
  });

  function renderConfig() {
    timesVal.textContent = config.times;
    porTimeVal.textContent = config.porTime;
    $('timesMenos').disabled = config.times <= LIM.minTimes;
    $('timesMais').disabled = config.times >= LIM.maxTimes;
    $('porTimeMenos').disabled = config.porTime <= LIM.minPorTime;
    $('porTimeMais').disabled = config.porTime >= LIM.maxPorTime;

    if (paletaAberta !== null && paletaAberta >= config.times) paletaAberta = null;

    coletesRow.innerHTML = '';
    config.cores.forEach(function (id, i) {
      var c = L.corPorId(id);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'colete-dot' + (c.escuro ? ' escuro' : '') + (paletaAberta === i ? ' aberto' : '');
      b.style.backgroundColor = c.cor;
      b.textContent = i + 1;
      b.setAttribute('aria-label', 'Time ' + (i + 1) + ': colete ' + c.nome.toLowerCase() + '. Trocar cor.');
      b.setAttribute('aria-expanded', String(paletaAberta === i));
      b.addEventListener('click', function () {
        paletaAberta = paletaAberta === i ? null : i;
        renderConfig();
      });
      coletesRow.appendChild(b);
    });

    paleta.innerHTML = '';
    paleta.hidden = paletaAberta === null;
    if (paletaAberta === null) return;

    var titulo = document.createElement('span');
    titulo.className = 'paleta-titulo';
    titulo.textContent = 'Cor do time ' + (paletaAberta + 1) + ':';
    paleta.appendChild(titulo);
    L.CORES_COLETE.forEach(function (c) {
      var usadaPor = config.cores.indexOf(c.id);
      var minha = usadaPor === paletaAberta;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'paleta-dot' + (minha ? ' atual' : '');
      b.style.backgroundColor = c.cor;
      b.title = c.nome;
      b.disabled = usadaPor !== -1 && !minha;
      b.setAttribute('aria-label', c.nome + (b.disabled ? ' (já usada por outro time)' : ''));
      b.addEventListener('click', function () {
        var cores = config.cores.slice();
        cores[paletaAberta] = c.id;
        paletaAberta = null;
        aplicarConfig({ times: config.times, porTime: config.porTime, cores: cores });
      });
      paleta.appendChild(b);
    });
  }

  function rotulo() { return config.times + ' times de ' + config.porTime; }
  function coletesAtuais() {
    return config.cores.map(function (id) { return L.corPorId(id); });
  }

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
    var precisa = config.times * config.porTime;

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
        (precisa - nomes.length) + ' pra fechar ' + precisa + ' (' + rotulo() + ').';
    } else if (nomes.length === precisa) {
      counter.className += ' ok';
      counter.innerHTML = '<strong>' + nomes.length + ' nomes</strong> — conta fechada: ' + rotulo() + '.';
    } else {
      counter.innerHTML = '<strong>' + nomes.length + ' nomes</strong> — os ' + precisa +
        ' primeiros da lista entram no sorteio, ' + (nomes.length - precisa) + ' ficam de próximo.';
    }

    continuarBtn.disabled = nomes.length < config.times;
  }
  lista.addEventListener('input', function () { excluidos = {}; render(); });

  continuarBtn.addEventListener('click', function () {
    renderAvaliacao();
    irParaEtapa(2);
  });

  // ---- etapa 2: avaliação ----
  function renderAvaliacao() {
    var nomes = nomesDetectados();
    var precisa = config.times * config.porTime;
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
    ultimoSorteio = tipo === 'equilibrado'
      ? L.distribuirEquilibrado(nomes, repoNotas.todas(), config.porTime, config.times)
      : L.distribuirAleatorio(nomes, config.porTime, config.times);
    mostrarResultado();
    irParaEtapa(3);
  }

  function mostrarResultado() {
    var s = ultimoSorteio;
    teamsEl.innerHTML = '';
    s.times.forEach(function (time, i) {
      var c = L.corPorId(config.cores[i]);
      var card = document.createElement('article');
      card.className = 'colete' + (c.escuro ? ' escuro' : '');
      card.style.backgroundColor = c.cor;
      card.style.animationDelay = (i * 0.08) + 's';
      var label = document.createElement('div');
      label.className = 't-label';
      label.textContent = 'Time ' + (i + 1);
      var h2 = document.createElement('h2');
      h2.textContent = 'Colete ' + c.nome;
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
    return L.montarTexto(ultimoSorteio, rotulo(), coletesAtuais(), null);
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

  renderConfig();
  render();
  irParaEtapa(1);
})();
