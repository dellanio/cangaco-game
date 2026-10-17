'use strict';
const { carregarGaveta } = require('./_partida');
// I-TELA-COMENSAIS-NA-BODEGA — a Bodega com tres civis `comendo`: a tela os senta a mesa, animados. A fixture e a
// mesma da I-TELA-PILHAS-NAS-MESAS-DA-BODEGA (a vila pronta do operador), carregada pela porta de save do jogador;
// tres civis entram como `comendo` encostados na Bodega, com a refeicao longa. O roteiro despausa um instante
// (CLAUDE.md §8) para o quadro andar, e pausa de volta.
const { readFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const economia = require('../../data/economy.json');

const COMENSAIS = 3;
const REFEICAO_LONGA = 2000;

async function roteiro({ page, capturar, estado, afirmar }) {
  const salvo = JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8'));
  const e = salvo.estado;
  const bodega = e.predios.porId.bodega;
  bodega.estoque.entrada = Object.fromEntries(economia.grupos.comida.map((m) => [m, 1]));
  // os obreiros ociosos da fixture (os carregadores estao todos com tarefa), e um terceiro com id novo pelo
  // `proximoId` do estado, para o lugar espelhado tambem aparecer
  const livres = e.unidades.ordem.filter((id) => e.unidades.porId[id].tipo === 'laborer' && e.unidades.porId[id].fsm === 'ocioso');
  while (livres.length < COMENSAIS) {
    const id = `u${e.proximoId}`;
    e.proximoId += 1;
    e.unidades.porId[id] = { ...e.unidades.porId[livres[0]], id };
    e.unidades.ordem.push(id);
    livres.push(id);
  }
  const civis = livres.slice(0, COMENSAIS);
  for (const id of civis) {
    const u = e.unidades.porId[id];
    // a tarefa que ele segurasse ficaria sem dono: so entra quem esta sem tarefa
    afirmar(u.fsmData.tarefa === undefined, `${id} sem tarefa na fixture`);
    e.unidades.porId[id] = { ...u, fsm: 'comendo', fsmData: { progresso: REFEICAO_LONGA }, gx: bodega.gx + 1, gy: bodega.gy + 3 };
  }
  await page.evaluate((s) => window.localStorage.setItem('cangaco:partida', s), JSON.stringify(salvo));
  await carregarGaveta(page);
  await page.keyboard.press('Escape');
  const canvas = await retanguloDoCanvas(page);
  await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
  for (let n = 0; n < 10 && (await estado()).camera.zoom !== 2; n++) {
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(200);
  }
  await page.evaluate((s) => window.__cangaco.fixarCamera(s), {
    scrollX: Math.round((bodega.gx + 2) * terreno.tile_px - canvas.width / 2),
    scrollY: Math.round((bodega.gy + 1.5) * terreno.tile_px - canvas.height / 2),
  });
  await page.waitForTimeout(200);

  const antes = (await estado()).comensaisDaBodega.bodega ?? [];
  afirmar(antes.length === COMENSAIS, `${COMENSAIS} comensais a mesa: ${JSON.stringify(antes)}`);
  afirmar(antes.every((c) => c.sprite), `todos com PNG: ${JSON.stringify(antes)}`);
  afirmar(antes.some((c) => c.olha === 'oeste') || COMENSAIS <= 2, `um deles espelhado: ${JSON.stringify(antes)}`);
  await capturar('comensais-a-mesa');

  // despausado: o quadro anda
  const tickAntes = (await estado()).tick;
  await page.keyboard.press('p');
  const vistos = new Set();
  for (let n = 0; n < 8; n++) {
    await page.waitForTimeout(150);
    const agora = (await estado()).comensaisDaBodega.bodega ?? [];
    if (agora[0] !== undefined) vistos.add(agora[0].quadro);
  }
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  const tickDepois = (await estado()).tick;
  console.log(`[I-TELA-COMENSAIS-NA-BODEGA] tick ${tickAntes} -> ${tickDepois}`);
  const depois = (await estado()).comensaisDaBodega.bodega ?? [];
  afirmar(depois.length === COMENSAIS, `continuam a mesa depois de despausar: ${JSON.stringify(depois)}`);
  afirmar(vistos.size >= 2, `o quadro do primeiro lugar andou: ${JSON.stringify([...vistos])}`);
  await capturar('comensais-depois');
  console.log(`[I-TELA-COMENSAIS-NA-BODEGA] antes ${JSON.stringify(antes)}; depois ${JSON.stringify(depois)}`);
}

module.exports = { roteiro };
