'use strict';

/** Acrescenta leitores textuais de dados ao grafo de imports do vitest related. */
function testesQueLeemDado(arquivosAlterados, fontesDosTestes) {
  const dados = arquivosAlterados.filter((f) => f === 'assets/manifest.json'
    || /^data\/.+\.json$/.test(f) || /^saves\/[^/]+\.txt$/.test(f));
  return Object.entries(fontesDosTestes)
    .filter(([, fonte]) => dados.some((dado) => fonte.includes(dado)))
    .map(([arquivo]) => arquivo);
}

module.exports = { testesQueLeemDado };
