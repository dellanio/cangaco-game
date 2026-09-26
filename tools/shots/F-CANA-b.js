'use strict';
// F-CANA-b — a mancha de cana da vila, na tela da abertura.
//
// O que a tela tem de mostrar: o partido de cana que o gerador pousa ao lado
// da vila (`CANAVIAL_DA_VILA`, tools/gerar-mapa.js), no mesmo recorte do rocado
// do milho. "A vista da abertura", no escopo, e o criterio do rocado: encostar
// na borda sul da folga, a poucos tiles do armazem. NAO e o quadro de abertura —
// medido (2026-09-26), nesta janela ele cobre y 25,9..37,1 e as DUAS manchas
// comecam em y=38. Por isso a camera desce ate um quadro com a vila e as duas.
// A cana nasce em pousio (`quantidadeInicial: 0`), entao a cena a conta como
// `esgotado`, junto do milho do rocado.
//
// Sem clique em painel: o roteiro so arrasta a camera e fotografa, e a regra do
// passo despausado (CLAUDE.md §8) nao se aplica.

const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');
const { CANAVIAL_DA_VILA, ROCADO_DA_VILA, disco } = require('../gerar-mapa');

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

/** Arrasta a camera com o botao do MEIO ate `alvo` (tile) ficar no centro do
 *  quadro. Mesmo gesto do roteiro F18 (`irPara`), em versao curta: o destino
 *  aqui esta a poucos tiles. */
async function irPara(page, canvas, estado, alvo) {
  const meio = { x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 };
  let s = await estado();
  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const faltaX = (alvo.gx * TILE_PX + TILE_PX / 2 - canvas.width / 2 - s.camera.scrollX) * s.camera.zoom;
    const faltaY = (alvo.gy * TILE_PX + TILE_PX / 2 - canvas.height / 2 - s.camera.scrollY) * s.camera.zoom;
    if (Math.abs(faltaX) < 1 && Math.abs(faltaY) < 1) break;
    await page.mouse.move(meio.x, meio.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(meio.x - faltaX, meio.y - faltaY, { steps: 10 });
    await page.mouse.up({ button: 'middle' });
    await page.waitForTimeout(200);
    s = await estado();
  }
  return s;
}

async function roteiro(ctx) {
  const { capturar, estado, afirmar, page } = ctx;
  const canvas = await retanguloDoCanvas(page);
  afirmar((await estado()).tick === 0, 'o roteiro comeca no tick 0');
  // o centro das duas manchas: a vila fica na metade de cima do quadro
  const alvo = {
    gx: Math.round((CANAVIAL_DA_VILA.gx + ROCADO_DA_VILA.gx) / 2),
    gy: Math.round((CANAVIAL_DA_VILA.gy + ROCADO_DA_VILA.gy) / 2) - 3,
  };
  const s = await irPara(page, canvas, estado, alvo);

  // ---- 1. a mancha do gerador e a do arquivo, e esta inteira no quadro -----
  const mancha = disco(CANAVIAL_DA_VILA.gx, CANAVIAL_DA_VILA.gy, CANAVIAL_DA_VILA.raio);
  const doArquivo = new Set((mapa.recursos.grapes || []).map(([gx, gy]) => `${gx},${gy}`));
  afirmar(
    mancha.every(([gx, gy]) => doArquivo.has(`${gx},${gy}`)),
    `o arquivo de mapa deveria ter a mancha inteira do gerador, veio ${JSON.stringify(mapa.recursos.grapes)}`,
  );
  const vista = mundoVisivel(canvas, s.camera);
  const rocado = disco(ROCADO_DA_VILA.gx, ROCADO_DA_VILA.gy, ROCADO_DA_VILA.raio);
  const fora = [...mancha, ...rocado].filter(([gx, gy]) => !inteiroDentro(vista, gx, gy));
  afirmar(
    fora.length === 0,
    `a cana e o rocado deveriam estar inteiros no quadro; fora: ${JSON.stringify(fora)}, `
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
