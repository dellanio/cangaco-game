'use strict';
// Roteiro da F24c — A CASA DO GIBAO POR ENCOMENDA, e o Shift+clique que pede de dez em dez.
//
// Carrega a partida que `tests/F24c-casa-do-gibao-por-encomenda.test.ts` grava: a Casa do
// Gibao (`aw1`) parada, com couro e madeira na entrada e a encomenda em zero.
//   1. a tela de ajuda conta o Shift+clique, no grupo da casa aberta (decisao do operador,
//      2026-09-29: atalho que a ajuda nao conta e funcionalidade invisivel);
//   2. o painel, aberto com o jogo ANDANDO (§8): gibao e escudo, os dois em zero, "sem
//      encomenda";
//   3. Shift + mouse.down/150/up no + do escudo com o jogo andando: o escudo pedido dez vezes
//      (falta 10, ou 9 e em curso se o ciclo ja comecou).
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const tema = require('../../data/theme-sertao.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida';
const CASA = 'aw1';
const DEZ = 10;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  const arquivo = 'test-output/F24c.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);

  // 1. a ajuda conta o gesto
  await page.keyboard.press('h');
  await esperarFrame();
  const naAjuda = await page.evaluate(() => {
    const l = window.document.querySelector('#ajuda .grupo[data-grupo="casa"] [data-atalho="encomenda-dez"]');
    return l === null ? null : { tecla: l.querySelector('.tecla')?.textContent, rotulo: l.querySelector('.rotulo')?.textContent };
  });
  afirmar(naAjuda !== null, 'a ajuda deveria ter a linha do Shift+clique no grupo da casa aberta');
  afirmar(naAjuda.tecla === tema.ajuda.gestos['encomenda-dez'] && naAjuda.rotulo === tema.ajuda.rotulos['encomenda-dez'],
    `a linha deveria vir do tema: ${JSON.stringify(naAjuda)}`);
  // a ajuda rola: o grupo da casa aberta e o ultimo, abaixo da dobra
  await page.evaluate(() => window.document.querySelector('#ajuda [data-atalho="encomenda-dez"]')?.scrollIntoView({ block: 'center' }));
  await esperarFrame();
  await capturar('ajuda');
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  const casa = s.prediosDoEstado[CASA];
  afirmar(casa !== undefined && casa.tipo === 'armory_workshop', 'a partida deveria ter a Casa do Gibao');

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
  await centrarNoEixo(casa.gx + 1, 'x');
  await centrarNoEixo(casa.gy + 1, 'y');
  s = await estado();

  const linhas = () => page.evaluate(() => [...window.document.querySelectorAll('#painel-predio .linha.encomenda-saida')].map((l) => ({
    mercadoria: l.dataset.encomenda, falta: Number(l.dataset.falta), emCurso: l.dataset.emCurso === 'true',
  })));
  const semEncomenda = () => page.evaluate(() => window.document.querySelector('#painel-predio [data-sem-encomenda]') !== null);

  // 2. o painel, aberto com o jogo andando
  const noCanvas = {
    x: canvas.left + (casa.gx + 1) * TILE_PX - s.camera.scrollX,
    y: canvas.top + (casa.gy + 1) * TILE_PX - s.camera.scrollY,
  };
  await page.keyboard.press('p');
  await page.mouse.move(noCanvas.x, noCanvas.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.keyboard.press('p');
  await esperarFrame();

  let lista = await linhas();
  afirmar(JSON.stringify(lista.map((l) => l.mercadoria)) === '["leather_armor","wooden_shield"]',
    `deveriam ser duas linhas (gibao, escudo), vieram ${JSON.stringify(lista)}`);
  afirmar(lista.every((l) => l.falta === 0 && !l.emCurso), `a Casa do Gibao deveria nascer parada: ${JSON.stringify(lista)}`);
  afirmar(await semEncomenda(), 'parada, o painel deveria dizer "sem encomenda"');

  // 3. Shift + o + do escudo, com o jogo andando
  const caixa = await page.evaluate(() => {
    const b = window.document.querySelector('#painel-predio .linha.encomenda-saida[data-encomenda="wooden_shield"] button[data-feira-controle="mais"]');
    if (b === null) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, title: b.title };
  });
  afirmar(caixa !== null, 'o + do escudo deveria estar na tela');
  afirmar(caixa.title === tema.painelPredio.encomendaMais, `a dica do + deveria contar o Shift: ${JSON.stringify(caixa.title)}`);
  await page.keyboard.press('p');
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForTimeout(400);
  await page.keyboard.press('p');
  await esperarFrame();
  lista = await linhas();
  const escudo = lista.find((l) => l.mercadoria === 'wooden_shield');
  const gibao = lista.find((l) => l.mercadoria === 'leather_armor');
  afirmar(escudo !== undefined && escudo.falta + (escudo.emCurso ? 1 : 0) === DEZ,
    `o escudo deveria estar pedido dez vezes (falta 10, ou 9 e em curso): ${JSON.stringify(escudo)}`);
  afirmar(gibao !== undefined && gibao.falta === 0 && !gibao.emCurso, `o gibao continua sem encomenda: ${JSON.stringify(gibao)}`);
  await capturar('escudo-dez');
  console.log(`F24c: ajuda ${JSON.stringify(naAjuda)}, escudo ${JSON.stringify(escudo)}`);
}

module.exports = { roteiro };
