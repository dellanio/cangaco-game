'use strict';

// F-CANA-b — mancha de cana da vila, na tela da abertura.
//
// O que a tela tem de mostrar: o partido de cana que o gerador pousa ao lado
// da vila (`CANAVIAL_DA_VILA`, tools/gerar-mapa.js) e o rocado do milho
// (`ROCADO_DA_VILA`), os dois no QUADRO DE ABERTURA, sem o jogador mexer na
// camera. Ate a noite 17 as manchas comecavam em y=38 e o quadro de abertura
// (medido: y 25,9..37,1 nesta janela) nao as alcancava; o roteiro descia a
// camera para achar. Decisao do operador (2026-09-26): as duas vem para a faixa
// sul, alongadas, e o roteiro passa a afirmar o quadro que o jogador ve primeiro.
// A cana nasce em pousio (`quantidadeInicial: 0`), entao a cena a conta como
// `esgotado`, junto do milho do rocado.
//
// Sem clique em painel e sem arrasto: o roteiro so fotografa, e a regra do
// passo despausado (CLAUDE.md §8) nao se aplica.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');
const { CANAVIAL_DA_VILA, ROCADO_DA_VILA, faixa } = require('../gerar-mapa');

const TILE_PX = terreno.tile_px;

/** O retangulo de MUNDO exibido, em pixel, com a origem 0.5 do Phaser. Mesma
 *  conta do roteiro F-D3. */
function mundoVisivel(canvas, camera) {
  const meioX = canvas.width / 2;
  const meioY = canvas.height / 2;
  return {
    x0: camera.scrollX + meioX - meioX / camera.zoom,
    x1: camera.scrollX + meioX + meioX / camera.zoom,
    y0: camera.scrollY + meioY - meioY / camera.zoom,
    y1: camera.scrollY + meioY + meioY / camera.zoom,
  };
}

const inteiroDentro = (vista, gx, gy) => gx * TILE_PX >= vista.x0 && (gx + 1) * TILE_PX <= vista.x1
  && gy * TILE_PX >= vista.y0 && (gy + 1) * TILE_PX <= vista.y1;

async function roteiro(ctx) {
  const { capturar, estado, afirmar, page } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const s = await estado();
  afirmar(s.tick === 0, 'o roteiro comeca no tick 0');

  // ---- 1. a mancha do gerador e a do arquivo, e as duas inteiras no quadro
  //         de ABERTURA: a camera nao foi tocada ------------------------------
  const mancha = faixa(CANAVIAL_DA_VILA);
  const doArquivo = new Set((mapa.recursos.grapes || []).map(([gx, gy]) => `${gx},${gy}`));
  afirmar(
    mancha.every(([gx, gy]) => doArquivo.has(`${gx},${gy}`)),
    `o arquivo de mapa deveria ter a mancha inteira do gerador, veio ${JSON.stringify(mapa.recursos.grapes)}`,
  );
  const vista = mundoVisivel(canvas, s.camera);
  const rocado = faixa(ROCADO_DA_VILA);
  const letraDoArado = Object.keys(mapa.legenda).find((l) => mapa.legenda[l] === 'campoArado');
  const doTerreno = rocado.filter(([gx, gy]) => mapa.linhas[gy]?.[gx] === letraDoArado);
  afirmar(
    doTerreno.length === rocado.length,
    `o arquivo de mapa deveria ter o rocado inteiro do gerador em campoArado, veio ${doTerreno.length} de ${rocado.length}`,
  );
  const fora = [...mancha, ...rocado].filter(([gx, gy]) => !inteiroDentro(vista, gx, gy));
  afirmar(
    fora.length === 0,
    `a cana e o rocado deveriam estar inteiros no quadro de abertura; fora: ${JSON.stringify(fora)}, `
      + `vista em tiles x ${(vista.x0 / TILE_PX).toFixed(1)}..${(vista.x1 / TILE_PX).toFixed(1)}, `
      + `y ${(vista.y0 / TILE_PX).toFixed(1)}..${(vista.y1 / TILE_PX).toFixed(1)}`,
  );

  // ---- 2. e a cena a desenha: em pousio, como o rocado ---------------------
  afirmar(
    (s.recursosVisiveis.grapes || 0) === 0,
    `a cana nasce em pousio: 'grapes' maduro a vista deveria ser 0, veio ${JSON.stringify(s.recursosVisiveis)}`,
  );
  afirmar(
    (s.recursosVisiveis.esgotado || 0) >= mancha.length + rocado.length,
    `os ${mancha.length} tiles da cana e os ${rocado.length} do rocado deveriam entrar no 'esgotado', `
      + `veio ${JSON.stringify(s.recursosVisiveis)}`,
  );

  await capturar('abertura-com-a-cana');
}

module.exports = { roteiro };
