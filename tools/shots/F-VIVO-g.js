'use strict';
// Roteiro da F-VIVO-g (o curral guarda os animais), aceite 3 do BUILD_PLAN.md.
//
// Carrega pelo botao "carregar" (F23b) a partida que o aceite 2 de
// `tests/F-VIVO-g-curral-guarda.test.ts` grava: a cadeia da carne 40 ticks antes de o curral
// da sim (`animaisDoCurral`) esvaziar com o Curral ocupado. Passo 0 mede pela ponte de
// debug que o curral carregado tem animais. Depois DESPAUSA o relogio (§8) e le a ponte ate
// passar do tick em que a sim esvazia: `debug.animaisDoCurral` (src/render/debug.ts) nunca
// fica vazio na sf1. Pausa de volta e captura dentro da janela vazia da sim. Nao clica em
// painel: o `#ajuda` do carregar e o mesmo da F-VIVO-e.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const ZOOM = 2;
const CHAVE_DO_SAVE = 'cangaco:partida'; // src/arquivo-da-partida.ts

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER

  async function centrarNoEixo(alvoEmTiles, eixo) {
    { // D-TELA-CAPTURA-DETERMINISTICA: a camera vai exata pela ponte (harness), e nao por setas no tempo de parede
      const vao = eixo === 'x' ? canvas.width : canvas.height;
      const alvo = alvoEmTiles * TILE_PX - vao / 2;
      await page.evaluate(([e, v]) => window.__cangaco.fixarCamera(e === 'x' ? { scrollX: v } : { scrollY: v }), [eixo, alvo]);
      await page.waitForTimeout(200); // o quadro seguinte publica a camera nova na ponte
    }
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

  for (const arquivo of ['test-output/F-VIVO-g.save.txt', 'test-output/F-VIVO-g.partida.json']) {
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  }
  const plano = JSON.parse(readFileSync('test-output/F-VIVO-g.partida.json', 'utf8'));
  const animais = (s) => s.animaisDoCurral[plano.predio] ?? [];
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync('test-output/F-VIVO-g.save.txt', 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  // passo 0: a medida, com o relogio parado
  let s = await estado();
  afirmar(s.tick === plano.tick, `a partida carregada deveria estar no tick ${plano.tick}, veio ${s.tick}`);
  afirmar(animais(s).length > 0, `a ${plano.predio} carregada deveria ter animais no curral`);

  await zoomPara(ZOOM);
  await centrarNoEixo(plano.centro.gx, 'x');
  await centrarNoEixo(plano.centro.gy, 'y');

  // relogio andando (§8) ate passar do tick em que a sim esvazia o curral
  const alvo = plano.esvazia + 20;
  afirmar(alvo < plano.reenche, 'a janela vazia da sim deveria durar mais de 20 ticks');
  await page.keyboard.press('p');
  let leituras = 0;
  for (let i = 0; i < 100 && s.tick < alvo; i += 1) {
    await page.waitForTimeout(150);
    s = await estado();
    leituras += 1;
    afirmar(animais(s).length > 0, `com o relogio andando, o curral da ${plano.predio} ficou vazio no tick ${s.tick}`);
  }
  await page.keyboard.press('p');
  await esperarFrame();
  s = await estado();
  afirmar(s.tick >= alvo, `o relogio deveria passar do tick ${alvo}, parou em ${s.tick}`);
  afirmar(s.tick < plano.reenche, `a captura deveria cair na janela vazia da sim (antes de ${plano.reenche}), veio ${s.tick}`);
  afirmar(animais(s).length > 0, `pausado no tick ${s.tick}, o curral da ${plano.predio} deveria seguir cheio`);
  afirmar(leituras > 5, `poucas leituras com o relogio andando: ${leituras}`);
  await capturar('curral-entre-entregas');
}

module.exports = { roteiro };
