'use strict';
// Roteiro da C4 — O BOTAO DE REPARO.
//
// Carrega a partida que `tests/C4-reparo.test.ts` grava: a vila da abertura com a escola
// pela metade do HP e o reparo desligado.
//   1. abre o painel da escola com o jogo ANDANDO (mouse.down/up, §8): a linha diz
//      "desligado" e o botao "Ligar reparo";
//   2. liga o reparo pelo botao, com o jogo andando: a linha passa a ligado, e o HP da
//      escola sobe no estado (os obreiros consertam). Captura o painel ligado.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  const arquivo = 'test-output/C4.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  const [idEscola, escola] = Object.entries(s.prediosDoEstado).find(([, p]) => p.tipo === 'schoolhouse') || [];
  afirmar(escola !== undefined, 'a partida deveria ter a escola');

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
  await centrarNoEixo(escola.gx + 1, 'x');
  await centrarNoEixo(escola.gy + 1, 'y');
  s = await estado();

  const apertar = async (x, y) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
  };
  // 1. o painel, aberto com o jogo andando
  await page.keyboard.press('p');
  await apertar(canvas.left + (escola.gx + 1) * TILE_PX - s.camera.scrollX, canvas.top + (escola.gy + 1) * TILE_PX - s.camera.scrollY);
  await page.waitForTimeout(400);
  const lerReparo = () => page.evaluate(() => {
    const l = window.document.querySelector('#painel-predio .linha.reparo');
    const b = window.document.querySelector('#painel-predio button.reparo');
    return { linha: l === null ? null : l.dataset.reparo, texto: l === null ? null : l.textContent, botao: b === null ? null : b.textContent };
  });
  const antes = await lerReparo();
  afirmar(antes.linha === 'desligado', `o reparo deveria comecar desligado, veio ${JSON.stringify(antes)}`);

  // 2. liga pelo botao. No painel da escola (fila e tipos) ele fica ABAIXO da dobra, e o
  // jogador rola o corpo da aba ate ele — o roteiro faz o mesmo. A caixa e medida na mesma
  // avaliacao da rolagem: o painel redesenha a 10 Hz.
  const caixa = await page.evaluate(() => {
    const b = window.document.querySelector('#painel-predio button.reparo');
    if (b === null) return null;
    b.scrollIntoView({ block: 'nearest' });
    const r = b.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  afirmar(caixa !== null, 'o botao de reparo deveria estar na tela');
  const hpAntes = (await estado()).prediosDoEstado[idEscola].hp;
  await apertar(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  let hpDepois = hpAntes;
  for (let i = 0; i < 80 && hpDepois <= hpAntes; i += 1) {
    await page.waitForTimeout(250);
    hpDepois = (await estado()).prediosDoEstado[idEscola].hp;
  }
  await page.keyboard.press('p');
  await esperarFrame();
  const depois = await lerReparo();
  afirmar(depois.linha === 'ligado', `o reparo deveria estar ligado, veio ${JSON.stringify(depois)}`);
  afirmar(hpDepois > hpAntes, `o HP da escola deveria subir com o reparo (${hpAntes} -> ${hpDepois})`);
  await capturar('reparo-ligado');
  console.log(`C4: reparo ${antes.linha} -> ${depois.linha} ("${depois.texto}"), HP ${hpAntes} -> ${hpDepois}, botao "${depois.botao}"`);
}

module.exports = { roteiro };
