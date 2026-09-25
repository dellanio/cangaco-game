'use strict';
// BUG-F (2026-09-24) — o que a obra e a estrada RECUSAM, para os roteiros.
//
// A regra e uma bandeira por tipo em `data/resources.json`
// (`tipos.<t>.bloqueiaConstrucao`), e o ONDE vem do arquivo de mapa. Este modulo
// nao repete a regra: ele repete a LEITURA do dado, e e por isso que virar a
// bandeira no JSON muda o roteiro junto com a sim. Milho nao entra porque a
// camada de milho e derivada do terreno, e milho nao bloqueia de qualquer forma.
const { tipos } = require('../../data/resources.json');
const mapa = require('../../data/maps/sertao-128.json');

const BLOQUEADOS = new Set(
  Object.entries(tipos)
    .filter(([, def]) => def.bloqueiaConstrucao === true)
    .flatMap(([tipo]) => (mapa.recursos[tipo] ?? []).map(([gx, gy]) => `${gx},${gy}`)),
);

/** Este tile recusa obra e estrada? */
function bloqueiaConstrucao(gx, gy) {
  return BLOQUEADOS.has(`${gx},${gy}`);
}

/** O footprint deste retangulo esta livre de recurso que bloqueia? */
function caixaLivre(gx0, gy0, largura, altura) {
  for (let gy = gy0; gy < gy0 + altura; gy += 1) {
    for (let gx = gx0; gx < gx0 + largura; gx += 1) {
      if (bloqueiaConstrucao(gx, gy)) return false;
    }
  }
  return true;
}

/**
 * A reta de `de` a `ate` na linha `gy`, DESCENDO um tile onde a reta cai em
 * recurso que bloqueia. Um buraco na reta partiria a rede em dois componentes;
 * o desvio de um tile nao, porque tile na diagonal conta como ligado (F-T2b).
 */
function ruaComDesvio(de, ate, gy) {
  const tiles = [];
  for (let gx = de; gx <= ate; gx += 1) {
    tiles.push({ gx, gy: bloqueiaConstrucao(gx, gy) ? gy + 1 : gy });
  }
  return tiles;
}

/**
 * Os arrastos que desenham esses tiles: um por trecho reto, e trecho mais comprido
 * que `maximo` vira dois com um tile em comum (o canvas mostra ~15 tiles, e um
 * arrasto que sai do quadro nao e clique de jogador).
 */
function arrastosDaRua(tiles, maximo = 12) {
  const trechos = [];
  for (const t of tiles) {
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && ultimo.gy === t.gy && ultimo.ate === t.gx - 1) ultimo.ate = t.gx;
    else trechos.push({ gy: t.gy, de: t.gx, ate: t.gx });
  }
  return trechos.flatMap(({ gy, de, ate }) => {
    if (ate - de + 1 <= maximo) return [{ gy, de, ate }];
    const meio = Math.floor((de + ate) / 2);
    return [{ gy, de, ate: meio }, { gy, de: meio, ate }];
  });
}

module.exports = { bloqueiaConstrucao, caixaLivre, ruaComDesvio, arrastosDaRua };
