'use strict';
// Roteiro da F-ESC (c) — A CAIXA DESENHADA DE CADA PREDIO, MEDIDA NA TELA.
//
// Roda a abertura da F17 inteira (a vila da Fase A feita com o mouse, sem ponte de
// injecao) e, com os seis predios da regua de pe — armazem, escola, lenhador,
// pedreira, serraria e Bodega —, le `debug.caixasDesenhadas`: a caixa que cada sprite
// ocupa, tirada da IMAGEM desenhada (`displayWidth`/`displayHeight`), nao recalculada.
//
// Afirma a regra da F-ESC pelo que foi desenhado: `h <= teto x lote`, com o teto lido
// AQUI do manifesto (`alturaMaxPorLargura` do predio, ou `regraDeAltura.k`). Grava a
// tabela em `test-output/F-ESC-caixas.json` e captura os seis num quadro a 0,5.
const { writeFileSync, mkdirSync } = require('node:fs');
const { roteiro: roteiroDaFaseA } = require('./F17');
const { retanguloDoCanvas } = require('./_canvas');
const manifesto = require('../../assets/manifest.json');
const terreno = require('../../data/terrain.json');
const { predios: DEFS } = require('../../data/buildings.json');

const TILE_PX = terreno.tile_px;
const ZOOM_DO_QUADRO = 0.5;
/** Os seis da regua aprovada (BUILD_PLAN, F-ESC, primeira tabela). */
const SEIS = ['storehouse', 'schoolhouse', 'woodcutters', 'quarry', 'sawmill', 'inn'];
/** Folga de arredondamento do float da escala, em px. */
const FOLGA_PX = 0.5;

function tetoDoManifesto(tipo) {
  const entrada = manifesto.assets.find((a) => a.tipo === 'predio' && a.id === tipo);
  return entrada?.alturaMaxPorLargura ?? manifesto.regraDeAltura.k;
}

/** C10 — o teto de LARGURA, lido AQUI do manifesto (`larguraMaxPorLote` ou `regraDeLargura.k`). */
function tetoDeLargura(tipo) {
  const entrada = manifesto.assets.find((a) => a.tipo === 'predio' && a.id === tipo);
  return entrada?.larguraMaxPorLote ?? manifesto.regraDeLargura.k;
}

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  await roteiroDaFaseA(ctx);
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  await page.keyboard.press('Escape'); // o painel da Bodega, aberto pela F17
  await esperarFrame();

  let s = await estado();
  const caixas = s.caixasDesenhadas;
  const porTipo = {};
  for (const [id, caixa] of Object.entries(caixas)) {
    const teto = tetoDoManifesto(caixa.tipo);
    afirmar(
      caixa.h <= teto * caixa.lote + FOLGA_PX,
      `'${id}' (${caixa.tipo}) desenha ${caixa.h.toFixed(1)} px de altura num lote de ${caixa.lote}: `
        + `passa de ${teto} x lote`,
    );
    // C10: a largura desenhada tambem nao passa do teto de largura
    const tetoL = tetoDeLargura(caixa.tipo);
    afirmar(
      caixa.w <= tetoL * caixa.lote + FOLGA_PX,
      `'${id}' (${caixa.tipo}) desenha ${caixa.w.toFixed(1)} px de largura num lote de ${caixa.lote}: `
        + `passa de ${tetoL} x lote`,
    );
    (porTipo[caixa.tipo] ??= []).push({ id, ...caixa, teto, tetoL, alturaPorLote: caixa.h / caixa.lote, larguraPorLote: caixa.w / caixa.lote });
  }
  for (const tipo of SEIS) {
    afirmar(porTipo[tipo] !== undefined, `a vila da F17 deveria desenhar '${tipo}' com arte, e nao desenhou`);
  }

  // os seis num quadro a 0,5, centrados na caixa que os contem
  const ids = SEIS.flatMap((t) => (porTipo[t] ?? []).map((c) => c.id));
  const doEstado = ids.map((id) => s.prediosDoEstado[id]);
  const tamanho = (p) => DEFS.find((d) => d.id === p.tipo).tamanho;
  const x0 = Math.min(...doEstado.map((p) => p.gx));
  const x1 = Math.max(...doEstado.map((p) => p.gx + tamanho(p)[0]));
  const y0 = Math.min(...doEstado.map((p) => p.gy));
  const y1 = Math.max(...doEstado.map((p) => p.gy + tamanho(p)[1]));
  await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
  for (let i = 0; i < 10 && (await estado()).camera.zoom !== ZOOM_DO_QUADRO; i += 1) {
    const { camera } = await estado();
    await page.mouse.wheel(0, camera.zoom > ZOOM_DO_QUADRO ? +200 : -200);
    await esperarFrame();
  }
  const centrar = async (alvoEmTiles, eixo) => {
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    const alvo = alvoEmTiles * TILE_PX - vao / 2;
    const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX / 2) return;
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 300 : 80);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  };
  await centrar((x0 + x1) / 2, 'x');
  await centrar((y0 + y1) / 2, 'y');
  s = await estado();
  const zoom = s.camera.zoom;
  afirmar(zoom === ZOOM_DO_QUADRO, `a camera deveria estar a ${ZOOM_DO_QUADRO}, esta a ${zoom}`);
  const meiaL = canvas.width / (2 * zoom);
  const meiaA = canvas.height / (2 * zoom);
  const cx = s.camera.scrollX + canvas.width / 2;
  const cy = s.camera.scrollY + canvas.height / 2;
  for (const p of doEstado) {
    const [w, h] = tamanho(p);
    afirmar(
      p.gx * TILE_PX >= cx - meiaL && (p.gx + w) * TILE_PX <= cx + meiaL
        && p.gy * TILE_PX >= cy - meiaA && (p.gy + h) * TILE_PX <= cy + meiaA,
      `o lote de '${p.tipo}' (${p.gx},${p.gy}) deveria caber no quadro a ${zoom}`,
    );
  }
  await capturar('seis-predios-a-0,5');

  mkdirSync('test-output', { recursive: true });
  writeFileSync('test-output/F-ESC-caixas.json', JSON.stringify({
    k: manifesto.regraDeAltura.k, tilePx: TILE_PX, zoomDoQuadro: zoom, caixasEmPxDeMundo: porTipo,
  }, null, 2));
  const resumo = Object.fromEntries(Object.entries(porTipo).map(([t, cs]) => [
    t, `${cs[0].w.toFixed(0)}x${cs[0].h.toFixed(0)} lote ${cs[0].lote} teto ${cs[0].teto}`]));
  console.log(`F-ESC: ${JSON.stringify(resumo)}`);
}

module.exports = { roteiro };
