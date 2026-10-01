'use strict';
// A regra do selo da suite longa, pura, para o teste exercitar sem git e sem disco
// (tests/SELO-longo.test.ts). Quem a usa e tools/selo-longo.js.

/** O que impede o selo de valer. Lista vazia = o selo vale para `head` agora. */
function problemasDoSelo(selo, head, arvoreSujaAgora) {
  if (selo === null || typeof selo !== 'object') return ['nao ha selo: `npm run test:longo` nunca rodou aqui'];
  const p = [];
  if (selo.commit !== head) p.push(`o selo e do commit ${String(selo.commit).slice(0, 7)}, e o HEAD e ${head.slice(0, 7)}`);
  if (selo.verde !== true) p.push('a suite longa nao passou');
  if (selo.arvoreLimpa !== true) p.push('a arvore estava suja quando a suite rodou: o commit nao e o que foi testado');
  if (arvoreSujaAgora) p.push('a arvore esta suja agora: o HEAD nao e o que esta no disco');
  if (selo.sozinha === false) p.push('havia outro teste rodando na maquina');
  if (selo.sozinha === null || selo.sozinha === undefined) p.push('nao deu para medir se a suite rodou sozinha');
  return p;
}

module.exports = { problemasDoSelo };
