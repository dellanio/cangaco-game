'use strict';

// Roteiro da I-TELA-PARTIDA-GUIADA — Aprender a jogar, aceite (d).
//
// O runner abre `/?pausado`; daqui o roteiro vai ao menu (`/?menu&pausado`) e escolhe Aprender a
// jogar. A faixa aparece no passo 1 (a estrada). O passo 1 se cumpre com o GESTO do jogador,
// DESPAUSADO (§8): R pega a estrada, e o arrasto vai da porta da escola a porta do armazem com o
// botao segurado 150 ms antes de andar. O passo 2 aparece (engajar o lenhador), e se cumpre com o
// clique segurado na escola e no botao do lenhador do painel. O passo 3 aparece. Uma captura por
// passo. No fim, Esconder recolhe a faixa e Passos a reabre.

const { URL } = require('node:url');
const tema = require('../../data/theme-sertao.json');
const predios = require('../../data/buildings.json').predios;
const { retanguloDoCanvas, pontoDoTileNaTela, pontoParaApertar } = require('./_canvas');

const TIMEOUT_MS = 15_000;
const TILE_PX = 64;

async function roteiro(ctx) {
  const { page, capturar, afirmar, estado } = ctx;
  const base = new URL('/', page.url()).href;
  const esperarFrame = () => page.waitForTimeout(200);

  /** Aperto cru, segurado 150 ms (§8): o laco redesenha entre o aperto e a soltura. */
  async function segurarEm(ponto) {
    await page.mouse.move(ponto.x, ponto.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
  }
  const passoNaFaixa = () => page.evaluate(() => window.document.querySelector('#partida-guiada')?.dataset.passo ?? null);
  const textoDaFaixa = () => page.evaluate(() => window.document.querySelector('#partida-guiada .titulo')?.textContent ?? '');
  const esperarPasso = (id) => page.waitForFunction((p) => window.document.querySelector('#partida-guiada')?.dataset.passo === p, id, { timeout: TIMEOUT_MS });

  // ---- 1. o menu: Aprender a jogar abre o jogo com a faixa no primeiro passo -------------------
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(`${base}?menu&pausado`);
  await page.waitForSelector('#menu-inicial');
  const rotulo = await page.textContent('#menu-inicial button[data-acao="aprender"]');
  afirmar(rotulo === tema.menuInicial.aprender, `o menu deveria oferecer '${tema.menuInicial.aprender}', veio '${rotulo}'`);
  await page.click('#menu-inicial button[data-acao="aprender"]');
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), { timeout: TIMEOUT_MS });
  await page.waitForSelector('#partida-guiada');
  await esperarFrame();
  afirmar(await page.isVisible('#partida-guiada'), 'a faixa de passos deveria aparecer no Aprender a jogar');
  afirmar((await passoNaFaixa()) === 'estrada', `o primeiro passo deveria ser a estrada, veio '${await passoNaFaixa()}'`);
  afirmar((await estado()).tick === 0, 'o Aprender a jogar pausado deveria estar no tick 0');
  await capturar('passo-1');

  // ---- 2. o passo 1 pelo gesto, despausado ----------------------------------------------------
  const s = await estado();
  const lista = Object.values(s.prediosDoEstado);
  const escola = lista.find((p) => p.tipo === 'schoolhouse' && p.lado === 0);
  const armazem = lista.find((p) => p.tipo === 'storehouse' && p.lado === 0);
  afirmar(escola !== undefined && armazem !== undefined, 'o jogo livre deveria nascer com escola e armazem');
  const altura = (tipo) => predios.find((p) => p.id === tipo).tamanho[1];
  const largura = (tipo) => predios.find((p) => p.id === tipo).tamanho[0];
  // a porta e a linha logo abaixo da casa; o arrasto vai do canto da escola mais perto do armazem
  const deEscola = { gx: escola.gx > armazem.gx ? escola.gx : escola.gx + largura('schoolhouse') - 1, gy: escola.gy + altura('schoolhouse') };
  const ateArmazem = { gx: escola.gx > armazem.gx ? armazem.gx + largura('storehouse') - 1 : armazem.gx, gy: armazem.gy + altura('storehouse') };
  afirmar(deEscola.gy === ateArmazem.gy, 'o roteiro supoe a escola e o armazem na mesma linha de porta');
  const canvas = await retanguloDoCanvas(page);

  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o passo do gesto precisa rodar com o laco ANDANDO (§8)');
  await page.keyboard.press('r');
  await esperarFrame();
  const { camera } = await estado();
  const a = pontoDoTileNaTela(canvas, deEscola, camera, TILE_PX);
  const b = pontoDoTileNaTela(canvas, ateArmazem, camera, TILE_PX);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await esperarPasso('escola');
  await page.keyboard.press('Escape'); // larga a estrada
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'P deveria pausar de volta');
  afirmar((await textoDaFaixa()).includes(tema.civis.woodcutter.nome), `o passo 2 deveria pedir o ${tema.civis.woodcutter.nome}`);
  await capturar('passo-2');

  // ---- 3. o passo 2: a escola, o botao do lenhador; o passo 3 aparece --------------------------
  await page.keyboard.press('p');
  await esperarFrame();
  const camera2 = (await estado()).camera;
  await segurarEm(pontoDoTileNaTela(canvas, { gx: escola.gx + 1, gy: escola.gy + 1 }, camera2, TILE_PX));
  await page.waitForSelector('#painel-predio [data-treinar="woodcutter"]', { timeout: TIMEOUT_MS });
  await segurarEm(await pontoParaApertar(page, '#painel-predio [data-treinar="woodcutter"]'));
  await esperarPasso('lenhador');
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'P deveria pausar de volta');
  afirmar((await textoDaFaixa()).includes(tema.predios.woodcutters.nome), `o passo 3 deveria pedir a ${tema.predios.woodcutters.nome}`);
  await capturar('passo-3');

  // ---- 4. Esconder recolhe, Passos reabre ------------------------------------------------------
  await page.click('#partida-guiada button[data-acao="pular"]');
  await esperarFrame();
  afirmar(await page.isHidden('#partida-guiada'), 'Esconder deveria recolher a faixa');
  afirmar(await page.isVisible('#reabrir-passos'), 'com a faixa recolhida, o botao Passos deveria aparecer');
  await page.click('#reabrir-passos');
  await esperarFrame();
  afirmar(await page.isVisible('#partida-guiada'), 'Passos deveria reabrir a faixa');
  afirmar((await passoNaFaixa()) === 'lenhador', 'a faixa reaberta deveria estar no passo atual');
  console.log(`I-TELA-PARTIDA-GUIADA: estrada -> escola -> lenhador pelo gesto; tick ${(await estado()).tick}`);
}

module.exports = { roteiro };
