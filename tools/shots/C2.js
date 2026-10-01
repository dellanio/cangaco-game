'use strict';
// Roteiro da C2b — O PROJETIL NO AR.
//
// Carrega o duelo que `tests/C2b-projetil-na-tela.test.ts` grava: um arqueiro olhando ao
// norte e um alvo parado a 6 tiles. Roda DESPAUSADO ate a primeira flecha estar no ar e
// afirma, pelo estado de debug (nunca pelo pixel), uma flecha com fracao estritamente
// entre 0 e 1, acima do chao. Captura a tela com ela no meio do voo.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  const arquivo = 'test-output/C2.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  const arq = s.unidadesRenderizadas.find((u) => u.id === 'arq');
  afirmar(arq !== undefined, 'a partida deveria ter o arqueiro');

  async function centrarNoEixo(alvoEmTiles, eixo) {
    { // D-TELA-CAPTURA-DETERMINISTICA: a camera vai exata pela ponte (harness), e nao por setas no tempo de parede
      const vao = eixo === 'x' ? canvas.width : canvas.height;
      const alvo = alvoEmTiles * TILE_PX - vao / 2;
      await page.evaluate(([e, v]) => window.__cangaco.fixarCamera(e === 'x' ? { scrollX: v } : { scrollY: v }), [eixo, alvo]);
      await page.waitForTimeout(200); // o quadro seguinte publica a camera nova na ponte
    }
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    const alvo = alvoEmTiles * TILE_PX - vao / 2;
    const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX) return;
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 300 : 80);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }
  await centrarNoEixo(arq.gx, 'x');
  await centrarNoEixo(arq.gy - 3, 'y');

  // despausa e espera a flecha no MEIO do voo
  await page.keyboard.press('p');
  let noMeio = null;
  for (let i = 0; i < 400 && noMeio === null; i += 1) {
    await page.waitForTimeout(15);
    s = await estado();
    noMeio = (s.projeteisNoAr || []).find((p) => p.projetil === 'flecha' && p.fracao > 0.3 && p.fracao < 0.7) || null;
  }
  await page.keyboard.press('p');
  afirmar(noMeio !== null, 'deveria haver uma flecha no meio do voo');
  afirmar(noMeio.altura > 0, `a flecha no meio do voo deveria estar acima do chao, altura ${noMeio && noMeio.altura}`);
  await esperarFrame();
  s = await estado();
  // pausado o alfa e 1: a flecha a um tick de chegar fica com fracao 1, ainda desenhada
  const aindaNoAr = (s.projeteisNoAr || []).find((p) => p.projetil === 'flecha' && p.fracao > 0);
  afirmar(aindaNoAr !== undefined, 'pausado, a flecha deveria continuar desenhada no ar');
  await capturar('flecha-no-ar');
  console.log(`C2: flecha no ar, fracao ${aindaNoAr.fracao.toFixed(2)}, altura ${aindaNoAr.altura.toFixed(2)} tiles`);
}

module.exports = { roteiro };
