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

  var api = {
    limparLinha: limparLinha,
    extrairNomes: extrairNomes,
    embaralhar: embaralhar
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RachaLogic = api;
})(this);
