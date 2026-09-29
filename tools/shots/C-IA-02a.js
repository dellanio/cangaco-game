// Roteiro C-IA-02a — a vila da IA com producao
// (plano em docs/planos/2026-09-29-C-IA-02a-vila-da-ia-com-producao.md).
//
//   1. comeca a escaramuca pelo painel H;
//   2. afirma, pelo debug, os predios da IA do dado (completos, bandeira azul) e os civis da
//      IA na contagem do dado;
//   3. avanca 3000 ticks: roçado, moinho e padaria com ocupante, e algum serf da IA carregando;
//   4. leva a camera a fileira nova e captura.
//
// O px sai do debug (`camera`, `prediosDoEstado`), nunca de pixel da captura.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const escaramuca = require('../../data/escaramuca.json');

const TILE_PX = terreno.tile_px;
const LADO_DA_IA = 1;
const AZUL = '#3F72D6';
const TICKS = 3000; // a sonda headless: o pao da IA ja subiu no tick 6000, e o serf ja carrega antes
const COM_OCUPANTE = ['farm', 'mill', 'bakery'];

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="escaramuca"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  afirmar(s.tick === 0, `a escaramuca deveria nascer no tick 0, veio ${s.tick}`);
  const prediosDaIA = () => Object.values(s.prediosDoEstado).filter((p) => p.lado === LADO_DA_IA);
  const tipos = prediosDaIA().map((p) => `${p.tipo}@${p.gx},${p.gy}`).sort();
  const doDado = escaramuca.predios.map((p) => `${p.id}@${p.gx},${p.gy}`).sort();
  afirmar(JSON.stringify(tipos) === JSON.stringify(doDado), `os predios da IA deveriam ser os do dado, vieram ${tipos.join(' ')}`);
  afirmar(prediosDaIA().every((p) => p.estado === 'completo' && p.corDoBando === AZUL), 'os predios da IA deveriam nascer completos, com a bandeira azul');
  const civisDoDado = Object.values(escaramuca.producao.civis.tipos).reduce((n, k) => n + k, 0);
  const civisDaIA = () => s.unidadesRenderizadas.filter((u) => u.lado === LADO_DA_IA && u.tipo in escaramuca.producao.civis.tipos);
  afirmar(civisDaIA().length === civisDoDado, `a IA deveria nascer com ${civisDoDado} civis, veio ${civisDaIA().length}`);

  // a cadeia anda: os especialistas entram, e algum serf carrega (amostra a cada 100 ticks)
  let carregou = false;
  for (let t = 0; t < TICKS; t += 100) {
    await page.evaluate((k) => window.__cangaco.avancar(k), 100);
    s = await estado();
    if (civisDaIA().some((u) => u.tipo === 'serf' && u.carga !== null)) carregou = true;
  }
  await esperarFrame();
  s = await estado();
  const semOcupante = prediosDaIA().filter((p) => COM_OCUPANTE.includes(p.tipo) && p.ocupante === null).map((p) => p.tipo);
  afirmar(semOcupante.length === 0, `roçado, moinho e padaria da IA deveriam ter ocupante, faltou ${semOcupante.join(' ')}`);
  afirmar(carregou, `algum serf da IA deveria carregar em ${TICKS} ticks`);

  // a camera no meio da fileira nova (roçado ate a estalagem)
  const fileira = prediosDaIA().filter((p) => ['farm', 'inn'].includes(p.tipo));
  const meio = {
    gx: Math.round(fileira.reduce((n, p) => n + p.gx, 0) / fileira.length) + 1,
    gy: Math.round(fileira.reduce((n, p) => n + p.gy, 0) / fileira.length),
  };
  for (const [eixo, alvoEmTiles] of [['x', meio.gx], ['y', meio.gy]]) {
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    const alvo = alvoEmTiles * TILE_PX - vao / 2;
    const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX) break;
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 300 : 80);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }
  s = await estado();
  const serfs = civisDaIA().filter((u) => u.tipo === 'serf');
  await capturar('vila-da-ia');
  console.log(`C-IA-02a: ${prediosDaIA().length} predios da IA, ${civisDaIA().length} civis, serf carregou: ${carregou}, tick ${s.tick}, serfs ${serfs.map((u) => `${u.fsm}${u.carga === null ? '' : `+${u.carga}`}`).join(' ')}`);
}

module.exports = { roteiro };
