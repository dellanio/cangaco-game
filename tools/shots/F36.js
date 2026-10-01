'use strict';
// Roteiro da F36 — A PREFEITURA NA TELA.
//
// Carrega a partida que `tests/F36-prefeitura.test.ts` grava: a vila e uma Prefeitura
// completa com 5 de ouro na gaveta, SEM rua (o ouro nao se repoe).
//   1. abre o painel com o jogo ANDANDO (mouse.down/up, §8): cinco botoes, custos
//      2/3/5/7/8, e os dois que nao cabem (7 e 8) desabilitados dizendo quanto falta;
//   2. contrata o Retirante (2) pelo botao, com o jogo andando: o ouro cai para 3, o
//      mercenario aparece, e o botao de 5 passa a desabilitado.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  const arquivo = 'test-output/F36.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  const prefeitura = s.prediosDoEstado.prefeitura;
  afirmar(prefeitura !== undefined && prefeitura.tipo === 'town_hall', 'a partida deveria ter a prefeitura');
  const unidadesAntes = s.unidadesRenderizadas.length;

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
  await centrarNoEixo(prefeitura.gx + 2, 'x');
  await centrarNoEixo(prefeitura.gy + 1, 'y');
  s = await estado();

  // 1. o painel, aberto com o jogo andando
  const noCanvas = {
    x: canvas.left + (prefeitura.gx + 2) * TILE_PX - s.camera.scrollX,
    y: canvas.top + (prefeitura.gy + 1) * TILE_PX - s.camera.scrollY,
  };
  await page.keyboard.press('p');
  await page.mouse.move(noCanvas.x, noCanvas.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(500);

  const botoes = () => page.$$eval('#painel-predio button.contratar', (bs) => bs.map((b) => ({
    tipo: b.dataset.tipo, custo: Number(b.dataset.custo), falta: Number(b.dataset.falta), desabilitado: b.disabled, texto: b.textContent,
  })));
  let lista = await botoes();
  afirmar(JSON.stringify(lista.map((b) => b.custo)) === '[2,3,5,7,8]', `os custos deveriam ser 2/3/5/7/8, vieram ${JSON.stringify(lista.map((b) => b.custo))}`);
  afirmar(JSON.stringify(lista.map((b) => b.desabilitado)) === '[false,false,false,true,true]',
    `so 7 e 8 deveriam estar desabilitados com 5 de ouro, veio ${JSON.stringify(lista.map((b) => b.desabilitado))}`);
  afirmar(lista[4].falta === 3 && lista[4].texto.includes('3'), `o de 8 deveria dizer que faltam 3, diz "${lista[4].texto}"`);
  await capturar('prefeitura-com-5');

  // 2. contrata o de 2 pelo botao, com o jogo andando
  // a caixa e medida numa avaliacao SO: com o jogo andando o painel se redesenha a 10 Hz,
  // e um handle resolvido numa ida ao navegador ja esta fora da arvore na seguinte
  // (consulta e medida no MESMO `evaluate`, como `_canvas.js`)
  const caixa = await page.evaluate(() => {
    const b = window.document.querySelector('#painel-predio button.contratar[data-tipo="rebel"]');
    if (b === null) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  afirmar(caixa !== null, 'o botao do Retirante deveria estar na tela');
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.keyboard.press('p');
  await esperarFrame();

  const ouro = await page.getAttribute('#painel-predio .linha.prefeitura', 'data-ouro');
  afirmar(ouro === '3', `o ouro deveria cair para 3, veio ${ouro}`);
  lista = await botoes();
  afirmar(JSON.stringify(lista.map((b) => b.desabilitado)) === '[false,false,true,true,true]',
    `com 3 de ouro, 5/7/8 deveriam estar desabilitados, veio ${JSON.stringify(lista.map((b) => b.desabilitado))}`);
  s = await estado();
  afirmar(s.unidadesRenderizadas.length === unidadesAntes + 1, `o mercenario deveria aparecer (${unidadesAntes} -> ${s.unidadesRenderizadas.length})`);
  await capturar('contratado');
  console.log(`F36: ouro 5 -> ${ouro}, unidades ${unidadesAntes} -> ${s.unidadesRenderizadas.length}, botoes ${JSON.stringify(lista.map((b) => b.texto))}`);
}

module.exports = { roteiro };
