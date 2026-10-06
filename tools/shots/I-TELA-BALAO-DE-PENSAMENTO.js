'use strict';
// I-TELA-BALAO-DE-PENSAMENTO: o balao sobre a cabeca de quem vai a algum lugar. O roteiro puxa uma
// rua a oeste da porta do armazem (a linha 34; a 33 cruza a pedra do lajedo), anda o relogio ate um
// serf com balao de ICONE aparecer na ponte (`unidadesRenderizadas[].pensamento`), confere o balao
// contra o estado da unidade e captura com a camera nele.
const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const RUA = { de: { gx: 29, gy: 34 }, ate: { gx: 20, gy: 34 } };
const TETO = 2000;
const PASSO = 5;

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(150);
  const fixar = (gx, gy) => page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
    scrollX: Math.round((gx + 0.5) * TILE_PX - canvas.width / 2),
    scrollY: Math.round((gy + 0.5) * TILE_PX - canvas.height / 2),
  });
  const pontoDoTile = (gx, gy, camera) => ({
    x: canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX,
    y: canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY,
  });

  await fixar((RUA.de.gx + RUA.ate.gx) / 2, RUA.de.gy);
  await esperarFrame();
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  const { camera } = await estado();
  await arrastarDentroDoCanvas(page, canvas, [pontoDoTile(RUA.de.gx, RUA.de.gy, camera), pontoDoTile(RUA.ate.gx, RUA.ate.gy, camera)]);
  await page.evaluate(() => window.__cangaco.avancar(1));
  await page.keyboard.press('Escape');
  await esperarFrame();

  let ticks = 0;
  let com = null;
  const vistos = new Set();
  while (ticks < TETO) {
    await page.evaluate((k) => window.__cangaco.avancar(k), PASSO);
    ticks += PASSO;
    await esperarFrame();
    const s = await estado();
    for (const u of s.unidadesRenderizadas) if (u.pensamento) vistos.add(`${u.pensamento}/${u.balaoComo}`);
    com = s.unidadesRenderizadas.find((u) => u.tipo === 'serf' && u.pensamento && u.balaoComo === 'icone') ?? null;
    if (com !== null) break;
  }
  afirmar(com !== null, `nenhum serf com balao de icone em ${TETO} ticks; vistos ${JSON.stringify([...vistos])}`);
  // I-TELA-BALAO-TRANSPARENTE: o balao com 10 % de transparencia
  afirmar(Math.abs(com.balaoOpacidade - 0.9) < 1e-6, `o balao deveria ter opacidade 0,9, veio ${com.balaoOpacidade}`);
  afirmar(['indo_buscar', 'indo_entregar'].includes(com.fsm), `o balao de mercadoria e de quem vai buscar ou entregar, veio ${com.fsm}`);
  // quem nao vai a lugar nenhum nao pensa
  const s = await estado();
  const parados = s.unidadesRenderizadas.filter((u) => ['ocioso', 'martelando', 'trabalhando'].includes(u.fsm) && u.pensamento);
  afirmar(parados.length === 0, `parado nao tem balao: ${JSON.stringify(parados.map((u) => [u.id, u.fsm, u.pensamento]))}`);
  console.log(`I-TELA-BALAO-DE-PENSAMENTO — ${com.id} (${com.fsm}) pensa em ${com.pensamento} no tick ${ticks}; vistos ${JSON.stringify([...vistos])}`);
  await fixar(com.gx, com.gy - 0.5);
  await esperarFrame();
  await capturar('balao');

  // I-TELA-BALAO-COM-MARTELO: um obreiro indo a obra, com o martelo no balao, batendo (o angulo muda)
  let obreiro = null;
  const angulos = new Set();
  for (let t = 0; t < TETO && angulos.size < 2; t += PASSO) {
    await page.evaluate((k) => window.__cangaco.avancar(k), PASSO);
    await esperarFrame();
    const achado = (await estado()).unidadesRenderizadas.find((u) => u.tipo === 'laborer' && u.pensamento === 'construir');
    if (achado) {
      obreiro = achado;
      angulos.add(Math.round(achado.balaoAngulo));
    }
  }
  afirmar(obreiro !== null && obreiro.balaoComo === 'icone', `o obreiro indo a obra deveria ter o martelo (icone): ${JSON.stringify(obreiro)}`);
  afirmar(angulos.size >= 2, `o martelo deveria bater (o angulo mudar): ${JSON.stringify([...angulos])}`);
  await fixar(obreiro.gx, obreiro.gy - 0.5);
  await esperarFrame();
  await capturar('martelo');
}
module.exports = { roteiro };
