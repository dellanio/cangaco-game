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

/** Os tiles de UM tipo de recurso, como o arquivo de mapa os publica. */
const PORTIPO = new Map();
function temRecurso(tipo, gx, gy) {
  if (!PORTIPO.has(tipo)) {
    PORTIPO.set(tipo, new Set((mapa.recursos[tipo] ?? []).map(([x, y]) => `${x},${y}`)));
  }
  return PORTIPO.get(tipo).has(`${gx},${gy}`);
}

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
 * Os arrastos que desenham esses tiles: um por trecho reto — HORIZONTAL OU
 * VERTICAL, porque desde a F-T4b a rua da abertura tem ramo em L — e trecho mais
 * comprido que `maximo` vira dois com um tile em comum (o canvas mostra ~15
 * tiles, e um arrasto que sai do quadro nao e clique de jogador).
 *
 * Devolve `{ de: {gx,gy}, ate: {gx,gy} }`. Quem tem rua so reta usa
 * `arrastosDaRua`, que e este mesmo algoritmo na forma antiga.
 */
function arrastosDaRede(tiles, maximo = 12) {
  const trechos = [];
  for (const t of tiles) {
    const ultimo = trechos[trechos.length - 1];
    const dx = ultimo === undefined ? 0 : t.gx - ultimo.ate.gx;
    const dy = ultimo === undefined ? 0 : t.gy - ultimo.ate.gy;
    const continua =
      ultimo !== undefined &&
      ((dx === 1 && dy === 0 && ultimo.eixo !== 'y') || (dx === 0 && dy === 1 && ultimo.eixo !== 'x'));
    if (continua) {
      ultimo.ate = { gx: t.gx, gy: t.gy };
      ultimo.eixo = dx === 1 ? 'x' : 'y';
    } else {
      trechos.push({ de: { gx: t.gx, gy: t.gy }, ate: { gx: t.gx, gy: t.gy }, eixo: null });
    }
  }
  return trechos.flatMap(({ de, ate }) => {
    const passos = Math.max(Math.abs(ate.gx - de.gx), Math.abs(ate.gy - de.gy)) + 1;
    if (passos <= maximo) return [{ de, ate }];
    const meio = { gx: Math.floor((de.gx + ate.gx) / 2), gy: Math.floor((de.gy + ate.gy) / 2) };
    return [{ de, ate: meio }, { de: meio, ate }];
  });
}

/**
 * A forma antiga, `{ gy, de, ate }`, para os roteiros de rua reta. RECUSA trecho
 * vertical em vez de achatar: roteiro com L que chamasse esta funcao desenharia
 * a rua errada em silencio, e e mais barato estourar aqui.
 */
function arrastosDaRua(tiles, maximo = 12) {
  return arrastosDaRede(tiles, maximo).map(({ de, ate }) => {
    if (de.gy !== ate.gy) {
      throw new Error('arrastosDaRua: trecho vertical nesta rua — use arrastosDaRede');
    }
    return { gy: de.gy, de: de.gx, ate: ate.gx };
  });
}

module.exports = {
  bloqueiaConstrucao, temRecurso, caixaLivre, ruaComDesvio, arrastosDaRede, arrastosDaRua,
};
