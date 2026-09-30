'use strict';
// Roteiro do BUG-W — O CAMPO RECEM-PLANTADO NAO SE DESENHA MADURO.
//
// Carrega pelo botao "carregar" (F23b) a partida que `tests/BUG-W-estagio-da-cultura.test.ts`
// grava no tick em que o primeiro milho do roçado amadurece: o roceiro semeia em rodizio,
// entao o mesmo roçado tem o tile pronto e, ao lado, os semeados depois dele. Centra no
// roçado e afirma que o render desenhou cada tile no estagio que a funcao pura da, e que
// o recem-semeado nao usa o desenho do maduro (alfa do marcador diferente).
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const ZOOM_DO_ROCADO = 2;
const CHAVE_DO_SAVE = 'cangaco:partida'; // src/arquivo-da-partida.ts

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER

  async function centrarNoEixo(alvoEmTiles, eixo) {
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const alvo = alvoEmTiles * TILE_PX - vao / 2;
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX / 2) return;
      const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 400 : 60);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }
  /** A roda, com o cursor no meio do canvas: o centro da vista nao anda. */
  async function zoomPara(nivel) {
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    for (let i = 0; i < 10; i += 1) {
      const { camera } = await estado();
      if (camera.zoom === nivel) return;
      await page.mouse.wheel(0, camera.zoom > nivel ? +200 : -200);
      await esperarFrame();
    }
    afirmar((await estado()).camera.zoom === nivel, `a camera deveria chegar a ${nivel}`);
  }

  for (const arquivo of ['test-output/BUG-W.save.txt', 'test-output/BUG-W.partida.json']) {
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  }
  const plano = JSON.parse(readFileSync('test-output/BUG-W.partida.json', 'utf8'));
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync('test-output/BUG-W.save.txt', 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  afirmar(s.tick === plano.tick, `a partida carregada deveria estar no tick ${plano.tick}, veio ${s.tick}`);
  const [mx, my] = plano.maduro.split(',').map(Number);
  const [sx, sy] = plano.semeado.split(',').map(Number);
  await zoomPara(ZOOM_DO_ROCADO);
  await centrarNoEixo((mx + sx) / 2 + 0.5, 'x');
  await centrarNoEixo((my + sy) / 2 + 0.5, 'y');
  s = await estado();
  const desenhado = s.estagiosDasCulturas;
  for (const [tile, esperado] of Object.entries(plano.estagios)) {
    afirmar(desenhado[tile] === esperado, `t${s.tick}: o tile ${tile} deveria desenhar '${esperado}', desenhou '${desenhado[tile]}'`);
  }
  afirmar(desenhado[plano.maduro] === 'pronto', `o tile ${plano.maduro} deveria estar pronto`);
  afirmar(desenhado[plano.semeado] === 'semeado', `o tile ${plano.semeado} deveria estar semeado, nao no desenho do maduro`);
  await capturar('rocado-em-estagios');
}

module.exports = { roteiro };
