(function (root) {
  'use strict';

  function limparLinha(linha) {
    var s = linha;
    s = s.replace(/^\s*\d+\s*[-–—.):>]*\s*/, '');            // numeração no começo
    s = s.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/gu, ''); // bandeiras e tons de pele
    s = s.replace(/[^\p{L}\s'\u{2019}\-]/gu, ' ');                   // só letras, espaço, hífen, apóstrofo
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/^[-'\u{2019}\s]+|[-'\u{2019}\s]+$/g, '');
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

  var api = {
    limparLinha: limparLinha,
    extrairNomes: extrairNomes,
    embaralhar: embaralhar,
    distribuirAleatorio: distribuirAleatorio,
    distribuirEquilibrado: distribuirEquilibrado
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RachaLogic = api;
})(this);
