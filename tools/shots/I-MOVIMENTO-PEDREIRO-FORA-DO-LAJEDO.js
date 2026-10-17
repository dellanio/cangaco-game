'use strict';
const { carregarGaveta } = require('./_partida');
// I-MOVIMENTO-PEDREIRO-FORA-DO-LAJEDO — a captura em jogo do aceite. Carrega a vila pronta
// (`saves/teste-operador-vila-pronta.txt`, D-SAVE-VILA-PRONTA), avanca pela ponte ate o pedreiro estar
// LAVRANDO (`colhendo`) e afirma, pelo estado que a ponte publica, que o tile dele nao tem rocha e e
// vizinho de um tile de rocha: ele lavra AO LADO do lajedo. Captura de perto, em zoom 2, centrada nele.
const { readFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida';
const SAVE = 'saves/teste-operador-vila-pronta.txt';
const PASSO = 20;
const TETO = 4000;

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(SAVE, 'utf8')]);
  await esperarFrame();
  await carregarGaveta(page);
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  const pedreiroLavrando = () => page.evaluate(() => {
    const s = JSON.parse(window.__cangacoPartida.estadoSerializado());
    const u = s.unidades.ordem.map((id) => s.unidades.porId[id]).find((x) => x.tipo === 'stonemason' && x.lado === 0 && x.fsm === 'colhendo');
    if (u === undefined) return null;
    const rocha = (gx, gy) => { const r = s.recursos[`${gx},${gy}`]; return r !== undefined && r.tipo === 'rock' && r.quantidade > 0; };
    let vizinhaDeRocha = false;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if ((dx !== 0 || dy !== 0) && rocha(u.gx + dx, u.gy + dy)) vizinhaDeRocha = true;
    return { gx: u.gx, gy: u.gy, emCimaDaRocha: rocha(u.gx, u.gy), vizinhaDeRocha };
  });

  let ticks = 0;
  let visto = await pedreiroLavrando();
  while (visto === null && ticks < TETO) {
    await page.evaluate((k) => window.__cangaco.avancar(k), PASSO);
    ticks += PASSO;
    visto = await pedreiroLavrando();
  }
  afirmar(visto !== null, `o pedreiro deveria estar lavrando ate ${TETO} ticks`);
  afirmar(!visto.emCimaDaRocha, `o pedreiro nao pode lavrar em cima da rocha: ${JSON.stringify(visto)}`);
  afirmar(visto.vizinhaDeRocha, `o pedreiro lavra ao lado do lajedo: ${JSON.stringify(visto)}`);

  await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
  for (let i = 0; i < 10 && (await estado()).camera.zoom < 2; i += 1) {
    await page.mouse.wheel(0, -200);
    await esperarFrame();
  }
  await page.evaluate((s) => window.__cangaco.fixarCamera(s), {
    scrollX: Math.round((visto.gx + 0.5) * TILE_PX - canvas.width / 2), scrollY: Math.round((visto.gy + 0.5) * TILE_PX - canvas.height / 2),
  });
  await esperarFrame();
  await capturar('ao-lado-do-lajedo');
}

module.exports = { roteiro };
