(function (root) {
  'use strict';

  function limparLinha(linha) {
    var s = linha;
    s = s.replace(/^\s*\d+\s*[-–—.):>]*\s*/, '');            // numeração no começo
    s = s.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/gu, ''); // bandeiras e tons de pele
    s = s.replace(/[^\p{L}\s'\u{2019}\-]/gu, ' ');                   // só letras, espaço, hífen, apóstrofo
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

  function separarJogadores(nomes, porTime, numTimes) {
    var precisa = porTime * numTimes;
    var corte = Math.min(nomes.length, precisa);
    return {
      jogam: nomes.slice(0, corte),
      proximos: nomes.slice(precisa),
      faltam: Math.max(0, precisa - corte)
    };
  }

  function criarTimes(numTimes) {
    var times = [];
    for (var i = 0; i < numTimes; i++) times.push([]);
    return times;
  }

  function distribuirAleatorio(nomes, porTime, numTimes) {
    var sep = separarJogadores(nomes, porTime, numTimes);
    var times = criarTimes(numTimes);
    embaralhar(sep.jogam).forEach(function (nome, i) { times[i % numTimes].push(nome); });
    return { times: times, proximos: sep.proximos, faltam: sep.faltam };
  }

  function notaDe(notas, nome) {
    var n = notas ? notas[nome.toLowerCase()] : null;
    return (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) ? n : 3;
  }

  function distribuirEquilibrado(nomes, notas, porTime, numTimes) {
    var sep = separarJogadores(nomes, porTime, numTimes);
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
    // serpentina: rodada par distribui 1..N — rodada ímpar N..1
    var times = criarTimes(numTimes);
    ordenados.forEach(function (nome, i) {
      var rodada = Math.floor(i / numTimes);
      var pos = i % numTimes;
      times[rodada % 2 === 0 ? pos : numTimes - 1 - pos].push(nome);
    });
    return { times: times, proximos: sep.proximos, faltam: sep.faltam };
  }

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

  // paleta de coletes: só cores que têm emoji de bolinha no WhatsApp.
  // "escuro" marca coletes que precisam de texto claro por cima.
  var CORES_COLETE = [
    { id: 'vermelho', nome: 'Vermelho', cor: '#FF4D3E', emoji: '🔴', escuro: false },
    { id: 'amarelo',  nome: 'Amarelo',  cor: '#FFD400', emoji: '🟡', escuro: false },
    { id: 'azul',     nome: 'Azul',     cor: '#2E9BFF', emoji: '🔵', escuro: false },
    { id: 'verde',    nome: 'Verde',    cor: '#3ECC5F', emoji: '🟢', escuro: false },
    { id: 'laranja',  nome: 'Laranja',  cor: '#FF8A2A', emoji: '🟠', escuro: false },
    { id: 'roxo',     nome: 'Roxo',     cor: '#7C4DFF', emoji: '🟣', escuro: true },
    { id: 'preto',    nome: 'Preto',    cor: '#23262B', emoji: '⚫', escuro: true },
    { id: 'branco',   nome: 'Branco',   cor: '#F2F5EF', emoji: '⚪', escuro: false },
    { id: 'marrom',   nome: 'Marrom',   cor: '#8B5A2B', emoji: '🟤', escuro: true }
  ];

  var LIMITES_CONFIG = { minTimes: 2, maxTimes: 6, minPorTime: 2, maxPorTime: 15 };

  function corPorId(id) {
    for (var i = 0; i < CORES_COLETE.length; i++) {
      if (CORES_COLETE[i].id === id) return CORES_COLETE[i];
    }
    return null;
  }

  function inteiroLimitado(v, min, max, padrao) {
    if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v) return padrao;
    return Math.min(max, Math.max(min, v));
  }

  function sanitizarConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') cfg = {};
    var times = inteiroLimitado(cfg.times, LIMITES_CONFIG.minTimes, LIMITES_CONFIG.maxTimes, 3);
    var porTime = inteiroLimitado(cfg.porTime, LIMITES_CONFIG.minPorTime, LIMITES_CONFIG.maxPorTime, 4);
    var cores = [];
    var usadas = {};
    (Array.isArray(cfg.cores) ? cfg.cores : []).forEach(function (id) {
      if (cores.length >= times || usadas[id] || !corPorId(id)) return;
      usadas[id] = true;
      cores.push(id);
    });
    // completa com as próximas cores livres na ordem da paleta
    CORES_COLETE.forEach(function (c) {
      if (cores.length >= times || usadas[c.id]) return;
      usadas[c.id] = true;
      cores.push(c.id);
    });
    return { times: times, porTime: porTime, cores: cores };
  }

  var CHAVE_CONFIG = 'sorteioracha:config';

  function criarRepositorioConfig(storage) {
    var config = sanitizarConfig(null);
    if (storage) {
      try { config = sanitizarConfig(JSON.parse(storage.getItem(CHAVE_CONFIG))); }
      catch (e) {}
    }
    function copia() {
      return { times: config.times, porTime: config.porTime, cores: config.cores.slice() };
    }
    return {
      obter: copia,
      definir: function (cfg) {
        config = sanitizarConfig(cfg);
        if (storage) {
          try { storage.setItem(CHAVE_CONFIG, JSON.stringify(config)); } catch (e) {}
        }
        return copia();
      }
    };
  }

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
        return (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) ? n : null;
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

  var api = {
    limparLinha: limparLinha,
    extrairNomes: extrairNomes,
    embaralhar: embaralhar,
    distribuirAleatorio: distribuirAleatorio,
    distribuirEquilibrado: distribuirEquilibrado,
    notaDe: notaDe,
    montarTexto: montarTexto,
    criarRepositorioNotas: criarRepositorioNotas,
    CHAVE_NOTAS: CHAVE_NOTAS,
    CORES_COLETE: CORES_COLETE,
    LIMITES_CONFIG: LIMITES_CONFIG,
    corPorId: corPorId,
    sanitizarConfig: sanitizarConfig,
    criarRepositorioConfig: criarRepositorioConfig,
    CHAVE_CONFIG: CHAVE_CONFIG
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RachaLogic = api;
})(this);
