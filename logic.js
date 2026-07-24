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

  var api = {
    limparLinha: limparLinha,
    extrairNomes: extrairNomes,
    embaralhar: embaralhar,
    distribuirAleatorio: distribuirAleatorio
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RachaLogic = api;
})(this);
