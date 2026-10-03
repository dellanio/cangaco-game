'use strict';

// Roteiro da E-TELA-CONFIGURAR-PARTIDA — A PAZ DA ESCARAMUCA SE ESCOLHE.
//
// O headless (`tests/E-TELA-CONFIGURAR-PARTIDA.test.ts`) prova a regra de cada opcao pelo `step`.
// Aqui, a tela: Novo jogo > Escaramuca abre a configuracao, com uma opcao por valor do dado e o
// padrao marcado; escolher outra paz e Comecar faz o contador do minimapa mostrar a duracao escolhida
// no tick 0. Um passo e DESPAUSADO (§8): o Comecar com mouse.down / 150 ms / mouse.up, o relogio
// corre, o contador desce, e o `P` pausa de volta.

const { URL } = require('node:url');
const tema = require('../../data/theme-sertao.json');
const escaramuca = require('../../data/escaramuca.json');
const tempo = require('../../data/time.json');

const BOTAO = (acao) => `#menu-inicial button[data-acao="${acao}"]`;
const PAZ = '#menu-inicial select[data-campo="paz"]';
const CONTADOR = '#minimapa [data-campo="paz"]';
const TIMEOUT_PRONTO_MS = 10_000;

/** Os segundos de JOGO de uma opcao: minutos base, divididos pela escala do grupo dela. A conta
 *  do carregador, refeita aqui porque o roteiro nao importa TypeScript. */
function segundosDeJogo(minBase) {
  return (minBase * 60) / tempo.escalas[escaramuca.escala];
}
function mmss(segundos) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

async function roteiro(ctx) {
  const { page, capturar, afirmar } = ctx;
  const base = new URL('/', page.url()).href;
  const esperarJogo = () => page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), { timeout: TIMEOUT_PRONTO_MS });
  async function segurar(seletor) {
    const c = await page.$eval(seletor, (n) => {
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
  }

  // ---- 1. a tela: uma opcao por valor do dado, o padrao marcado --------------------------------
  await page.goto(`${base}?menu&pausado`);
  await page.waitForSelector('#menu-inicial');
  await page.click(BOTAO('novo'));
  await page.click(BOTAO('escaramuca'));
  afirmar(await page.isVisible(PAZ), 'Escaramuca deveria abrir a escolha da paz');
  const opcoes = await page.$$eval(`${PAZ} option`, (ns) => ns.map((n) => ({ valor: Number(n.value), texto: n.textContent, marcada: n.selected })));
  afirmar(JSON.stringify(opcoes.map((o) => o.valor)) === JSON.stringify(escaramuca.peacetime_opcoes_min_base),
    `as opcoes deveriam ser as do dado: ${JSON.stringify(opcoes.map((o) => o.valor))}`);
  const marcada = opcoes.filter((o) => o.marcada).map((o) => o.valor);
  afirmar(JSON.stringify(marcada) === JSON.stringify([escaramuca.peacetime_min_base]), `o padrao deveria vir marcado: ${JSON.stringify(marcada)}`);
  afirmar(opcoes.find((o) => o.valor === 0).texto === tema.menuInicial.configurar.semPaz, 'a opcao 0 deveria dizer que nao ha paz');
  await capturar('configurar');

  // ---- 2. outra paz, pausado: o contador mostra a duracao escolhida no tick 0 -------------------
  const escolhida = escaramuca.peacetime_opcoes_min_base.find((v) => v > escaramuca.peacetime_min_base);
  await page.selectOption(PAZ, String(escolhida));
  await page.click(BOTAO('comecar'));
  await esperarJogo();
  await page.waitForTimeout(200);
  const esperado = tema.paz.rotulo.replace('{tempo}', mmss(segundosDeJogo(escolhida)));
  const noTick0 = await page.textContent(CONTADOR);
  afirmar((await page.evaluate(() => window.__cangaco.tick)) === 0, 'pausado, a escaramuca deveria estar no tick 0');
  afirmar(noTick0 === esperado, `o contador deveria mostrar '${esperado}', mostra '${noTick0}'`);
  await capturar('contador');

  // ---- 3. despausado: o Comecar segurado 150 ms, o relogio corre e o contador desce -------------
  await page.goto(base);
  await page.waitForSelector('#menu-inicial');
  await page.click(BOTAO('novo'));
  await page.click(BOTAO('escaramuca'));
  await page.selectOption(PAZ, String(escolhida));
  await segurar(BOTAO('comecar'));
  await esperarJogo();
  await page.waitForFunction(() => window.__cangaco.tick >= 20, { timeout: TIMEOUT_PRONTO_MS });
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  const corrido = await page.evaluate(() => ({ tick: window.__cangaco.tick, pausado: window.__cangaco.pausado }));
  afirmar(corrido.pausado, 'P deveria pausar de volta');
  const contadorDepois = await page.textContent(CONTADOR);
  const restante = Math.ceil((segundosDeJogo(escolhida) * tempo.tickHz - corrido.tick) / tempo.tickHz);
  afirmar(contadorDepois === tema.paz.rotulo.replace('{tempo}', mmss(restante)),
    `no tick ${corrido.tick} o contador deveria mostrar ${mmss(restante)}, mostra '${contadorDepois}'`);
  console.log(`E-TELA-CONFIGURAR-PARTIDA: paz ${escolhida} min base, contador '${noTick0}' no tick 0 e '${contadorDepois}' no tick ${corrido.tick}`);
}

module.exports = { roteiro };
