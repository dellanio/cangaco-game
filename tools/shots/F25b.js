'use strict';
// Roteiro da F25b — O PAINEL DO QUARTEL NA TELA.
//
// Carrega a partida que `tests/F25b-painel-do-quartel.test.ts` grava: a vila e um quartel
// completo com 1 machado, 1 gibao e 2 recrutas, SEM rua (nada se repoe).
//   1. abre o painel com o jogo ANDANDO (mouse.down/up, §8): 2 recrutas, nove botoes, so o
//      Cabra (militia) habilitado; o Cabra de Gibao diz o que falta (o escudo);
//   2. forma o Cabra pelo botao, com o jogo andando: recrutas 2 -> 1, o soldado aparece,
//      e o botao do Cabra passa a dizer que falta o machado.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const tema = require('../../data/theme-sertao.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  const arquivo = 'test-output/F25b.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  const quartel = s.prediosDoEstado.quartel;
  afirmar(quartel !== undefined && quartel.tipo === 'barracks', 'a partida deveria ter o quartel');
  const unidadesAntes = s.unidadesRenderizadas.length;

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
  await centrarNoEixo(quartel.gx + 1, 'x');
  await centrarNoEixo(quartel.gy + 1, 'y');
  s = await estado();

  // 1. o painel, aberto com o jogo andando
  const noCanvas = {
    x: canvas.left + (quartel.gx + 1) * TILE_PX - s.camera.scrollX,
    y: canvas.top + (quartel.gy + 1) * TILE_PX - s.camera.scrollY,
  };
  await page.keyboard.press('p');
  await page.mouse.move(noCanvas.x, noCanvas.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(500);

  // os botoes sao lidos numa avaliacao SO: o painel se redesenha a 10 Hz com o jogo andando
  const botoes = () => page.evaluate(() => [...window.document.querySelectorAll('#painel-predio button.formar')].map((b) => ({
    tipo: b.dataset.tipo, motivo: b.dataset.motivo, desabilitado: b.disabled, texto: b.textContent,
  })));
  const recrutas = () => page.evaluate(() => window.document.querySelector('#painel-predio .linha.quartel')?.dataset.recrutas ?? null);
  let lista = await botoes();
  afirmar(lista.length === 9, `deveriam ser nove botoes, vieram ${lista.length}`);
  afirmar(JSON.stringify(lista.filter((b) => !b.desabilitado).map((b) => b.tipo)) === '["militia"]',
    `so o militia deveria estar habilitado, veio ${JSON.stringify(lista.filter((b) => !b.desabilitado).map((b) => b.tipo))}`);
  afirmar((await recrutas()) === '2', 'o painel deveria mostrar 2 recrutas');
  const gibao = lista.find((b) => b.tipo === 'axe_fighter');
  const escudo = tema.mercadorias.wooden_shield;
  afirmar(gibao.motivo === 'sem-requisito' && gibao.texto.includes(escudo) && !gibao.texto.includes(tema.mercadorias.hand_axe),
    `o Cabra de Gibao deveria dizer que falta so "${escudo}", diz "${gibao.texto}"`);
  // nove botoes passam da altura: o corpo da aba ROLA e mostra a sombra de "ha mais"
  const rola = await page.evaluate(() => {
    const c = window.document.getElementById('corpo-aba');
    return c !== null && c.scrollHeight > c.clientHeight && c.hasAttribute('data-ha-mais');
  });
  afirmar(rola, 'com nove botoes o corpo da aba deveria rolar, com a sombra de "ha mais"');
  await capturar('quartel-com-um-machado');

  // 2. forma o militia pelo botao, com o jogo andando
  const caixa = await page.evaluate(() => {
    const b = window.document.querySelector('#painel-predio button.formar[data-tipo="militia"]');
    if (b === null) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  afirmar(caixa !== null, 'o botao do Cabra deveria estar na tela');
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.keyboard.press('p');
  await esperarFrame();

  afirmar((await recrutas()) === '1', 'os recrutas deveriam cair para 1');
  lista = await botoes();
  const cabra = lista.find((b) => b.tipo === 'militia');
  afirmar(cabra.desabilitado && cabra.motivo === 'sem-requisito' && cabra.texto.includes(tema.mercadorias.hand_axe),
    `sem o machado, o Cabra deveria dizer que falta, diz "${cabra.texto}"`);
  s = await estado();
  afirmar(s.unidadesRenderizadas.length === unidadesAntes + 1, `o soldado deveria aparecer (${unidadesAntes} -> ${s.unidadesRenderizadas.length})`);
  await capturar('formado');
  console.log(`F25b: recrutas 2 -> 1, unidades ${unidadesAntes} -> ${s.unidadesRenderizadas.length}, Cabra "${cabra.texto}", Gibao "${gibao.texto}"`);
}

module.exports = { roteiro };
