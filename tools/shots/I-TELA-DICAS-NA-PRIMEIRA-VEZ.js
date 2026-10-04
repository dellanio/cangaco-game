'use strict';

// Roteiro da I-TELA-DICAS-NA-PRIMEIRA-VEZ — duas dicas, aceite (d), e a chave das Opcoes, (b).
//
// Carrega pela ajuda (gaveta 1) o save que `tests/I-TELA-DICAS-NA-PRIMEIRA-VEZ.test.ts` grava: a
// escola com o lenhador na fila e sem estrada, e uma pedreira pronta, ligada e sem pedreiro.
//   1. a primeira dica (sem estrada) aparece, apontando a escola; captura;
//   2. DESPAUSADO (§8), com o aperto segurado 150 ms: "Ver onde" anda a camera, "Entendi" fecha, e a
//      segunda dica (sem trabalhador) aparece no tick seguinte; captura. As duas ficam marcadas no
//      `localStorage`, e nao no save;
//   3. com as marcas apagadas e as dicas desligadas nas Opcoes, o mesmo save nao mostra dica nenhuma.

const { existsSync, readFileSync } = require('node:fs');
const { URL } = require('node:url');
const tema = require('../../data/theme-sertao.json');
const { pontoParaApertar } = require('./_canvas');

const SAVE = 'test-output/I-TELA-DICAS-NA-PRIMEIRA-VEZ.save.txt';
const CHAVE_DO_SAVE = 'cangaco:partida'; // src/arquivo-da-partida.ts
const CHAVE_DAS_DICAS = 'cangaco:dicas'; // src/preferencias-de-dicas.ts
const TIMEOUT_MS = 15_000;

async function roteiro(ctx) {
  const { page, capturar, afirmar, estado } = ctx;
  const base = new URL('/', page.url()).href;
  const esperarFrame = () => page.waitForTimeout(200);
  afirmar(existsSync(SAVE), `${SAVE} nao existe: rode \`npm run test\` antes`);
  const save = readFileSync(SAVE, 'utf8');

  async function segurar(seletor) {
    const p = await pontoParaApertar(page, seletor);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
  }
  async function abrirComOSave() {
    await page.goto(`${base}?pausado`);
    await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), { timeout: TIMEOUT_MS });
    await page.keyboard.press('h');
    await esperarFrame();
    await page.click('#ajuda button[data-acao="carregar"][data-gaveta="1"]');
    await esperarFrame();
    await page.keyboard.press('Escape');
    await esperarFrame();
  }
  const dicaNaTela = () => page.evaluate(() => {
    const n = window.document.querySelector('#dica');
    return n === null || n.hidden ? null : { id: n.dataset.dica, texto: n.querySelector('.texto').textContent };
  });
  const dicasGuardadas = () => page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), CHAVE_DAS_DICAS);

  // ---- 1. a primeira dica -----------------------------------------------------------------------
  await page.evaluate(([k, v]) => { window.localStorage.clear(); window.localStorage.setItem(k, v); }, [CHAVE_DO_SAVE, save]);
  await abrirComOSave();
  await page.waitForFunction(() => window.document.querySelector('#dica')?.dataset.dica === 'sem-estrada', null, { timeout: TIMEOUT_MS });
  let dica = await dicaNaTela();
  afirmar(dica !== null && dica.texto === tema.dicas.textos['sem-estrada'], `a primeira dica deveria ser a da estrada, veio ${JSON.stringify(dica)}`);
  afirmar(await page.isVisible('#dica button[data-acao="ver"]'), 'a dica da casa deveria ter o Ver onde');
  await capturar('dica-sem-estrada');

  // ---- 2. despausado: Ver onde, Entendi, e a segunda ----------------------------------------------
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o passo dos botoes precisa rodar com o laco ANDANDO (§8)');
  const antes = (await estado()).camera;
  await segurar('#dica button[data-acao="ver"]');
  await esperarFrame();
  const depois = (await estado()).camera;
  afirmar(antes.scrollX !== depois.scrollX || antes.scrollY !== depois.scrollY, `Ver onde deveria andar a camera (${JSON.stringify(antes)} -> ${JSON.stringify(depois)})`);
  await segurar('#dica button[data-acao="entendi"]');
  await page.waitForFunction(() => window.document.querySelector('#dica')?.dataset.dica === 'sem-trabalhador', null, { timeout: TIMEOUT_MS });
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'P deveria pausar de volta');
  dica = await dicaNaTela();
  afirmar(dica !== null && dica.texto === tema.dicas.textos['sem-trabalhador'], `a segunda dica deveria ser a do trabalhador, veio ${JSON.stringify(dica)}`);
  await capturar('dica-sem-trabalhador');
  const guardadas = await dicasGuardadas();
  afirmar(JSON.stringify(guardadas.vistas) === JSON.stringify(['sem-estrada', 'sem-trabalhador']), `as duas dicas deveriam estar marcadas no localStorage, veio ${JSON.stringify(guardadas)}`);
  const serializado = await page.evaluate(() => window.__cangacoPartida.estadoSerializado());
  afirmar(!serializado.includes('sem-trabalhador') && !serializado.includes(CHAVE_DAS_DICAS), 'a marca da dica nao pode entrar no estado da partida');

  // ---- 3. desligadas nas Opcoes: nenhuma dica ------------------------------------------------------
  await page.evaluate((k) => window.localStorage.removeItem(k), CHAVE_DAS_DICAS);
  await page.goto(`${base}?pausado`);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), { timeout: TIMEOUT_MS });
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda button[data-acao="opcoes-de-som"]');
  await esperarFrame();
  afirmar(await page.isChecked('#opcoes-de-som input[data-opcao="dicas"]'), 'as dicas deveriam nascer ligadas');
  await page.uncheck('#opcoes-de-som input[data-opcao="dicas"]');
  await page.click('#opcoes-de-som button[data-acao="fechar"]');
  await esperarFrame();
  await page.click('#ajuda button[data-acao="carregar"][data-gaveta="1"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__cangaco.avancar(20));
  await page.waitForTimeout(500);
  afirmar((await dicaNaTela()) === null, 'com as dicas desligadas, nenhuma dica deveria aparecer');
  const desligadas = await dicasGuardadas();
  afirmar(desligadas.ligadas === false && desligadas.vistas.length === 0, `a chave deveria estar guardada desligada e sem vistas, veio ${JSON.stringify(desligadas)}`);
  console.log(`I-TELA-DICAS-NA-PRIMEIRA-VEZ: sem-estrada -> sem-trabalhador, marcadas no localStorage; desligadas, nenhuma (tick ${(await estado()).tick})`);
}

module.exports = { roteiro };
