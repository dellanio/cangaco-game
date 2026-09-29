'use strict';
// Roteiro da F-REPL-d — O SELETOR DE MODO DO LENHADOR NO PAINEL.
//
// Carrega a partida que `tests/F-REPL-d-seletor-de-modo.test.ts` grava: o cenario do
// oraculo, com o lenhador `w1` completo e no modo padrao.
//   1. abre o painel de `w1` com o jogo ANDANDO (mouse.down/up, §8): a linha "Trabalho"
//      diz o padrao do dado, e ha um botao por modo, o atual marcado;
//   2. ainda andando, "Cortar" seguro 150 ms: a linha vira `cortar`, e o botao marcado tambem;
//   3. "Cortar e plantar": volta a `cortar_e_plantar`.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const producao = require('../../data/production.json');
const tema = require('../../data/theme-sertao.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  const arquivo = 'test-output/F-REPL-d.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  const w1 = s.prediosDoEstado.w1;
  afirmar(w1 !== undefined && w1.tipo === 'woodcutters', 'a partida deveria ter o lenhador w1');

  async function centrarNoEixo(alvoEmTiles, eixo) {
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
  await centrarNoEixo(w1.gx + 1, 'x');
  await centrarNoEixo(w1.gy + 1, 'y');
  s = await estado();

  // 1. o painel, aberto com o jogo andando
  await page.keyboard.press('p');
  await page.mouse.move(
    canvas.left + (w1.gx + 1.5) * TILE_PX - s.camera.scrollX,
    canvas.top + (w1.gy + 1) * TILE_PX - s.camera.scrollY,
  );
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(300);
  afirmar(await page.getAttribute('#painel-predio', 'data-predio-aberto') === 'w1', 'o painel deveria abrir no lenhador w1');

  const ids = Object.keys(producao.predios.woodcutters.modos);
  const padrao = producao.predios.woodcutters.modoPadrao;
  const leitura = () => page.evaluate(() => {
    const d = window.document;
    const l = d.querySelector('#painel-predio .linha.modo');
    return {
      modo: l?.getAttribute('data-modo') ?? null,
      texto: l?.querySelector('.valor')?.textContent ?? null,
      botoes: [...d.querySelectorAll('#painel-predio button.modo')].map((b) => ({
        id: b.getAttribute('data-modo-botao'), marcado: b.getAttribute('aria-pressed') === 'true', texto: b.textContent,
      })),
    };
  });
  const inicio = await leitura();
  afirmar(inicio.modo === padrao, `a linha deveria comecar no padrao ${padrao}, veio ${inicio.modo}`);
  afirmar(inicio.texto === tema.predios.woodcutters.modos[padrao].nome, `a linha deveria dizer o nome do tema, diz ${inicio.texto}`);
  afirmar(JSON.stringify(inicio.botoes.map((b) => b.id)) === JSON.stringify(ids), `um botao por modo do dado, veio ${JSON.stringify(inicio.botoes)}`);
  afirmar(inicio.botoes.filter((b) => b.marcado).map((b) => b.id).join() === padrao, 'so o botao do padrao deveria estar marcado');

  // 2 e 3. cada botao seguro 150 ms, com o jogo andando
  const apertar = async (id) => {
    const caixa = await page.evaluate((sel) => {
      const r = window.document.querySelector(sel)?.getBoundingClientRect();
      return r === undefined ? null : { x: r.x, y: r.y, width: r.width, height: r.height };
    }, `#painel-predio button.modo[data-modo-botao="${id}"]`);
    afirmar(caixa !== null, `o painel deveria ter o botao do modo ${id}`);
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(300);
  };
  await apertar('cortar');
  const cortando = await leitura();
  afirmar(cortando.modo === 'cortar', `depois de "Cortar" a linha deveria ser cortar, veio ${cortando.modo}`);
  afirmar(cortando.botoes.filter((b) => b.marcado).map((b) => b.id).join() === 'cortar', 'o botao marcado deveria ser cortar');
  await page.keyboard.press('p');
  await esperarFrame();
  await capturar('modo-cortar');

  await page.keyboard.press('p');
  await apertar('cortar_e_plantar');
  await page.keyboard.press('p');
  await esperarFrame();
  const voltou = await leitura();
  afirmar(voltou.modo === 'cortar_e_plantar', `a linha deveria voltar a cortar_e_plantar, veio ${voltou.modo}`);
  await capturar('modo-cortar-e-plantar');

  console.log(`F-REPL-d: ${JSON.stringify({ inicio, cortando: cortando.modo, voltou: voltou.modo })}`);
}

module.exports = { roteiro };
