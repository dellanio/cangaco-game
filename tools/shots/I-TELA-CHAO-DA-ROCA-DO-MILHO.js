'use strict';
// I-TELA-CHAO-DA-ROCA-DO-MILHO: carrega a partida que `tests/I-TELA-CHAO-DA-ROCA-DO-MILHO.test.ts` grava (um
// rocado de milho e um de cana arados pelo jogador, metade semeada) e captura os dois. Todo tile de cultura
// na vista tem o chao da roca desenhado, e a celula do pousio na tira de recurso e vazia (sem losango; o
// esgotado, que continua losango, e o controle de que a medida acusa).
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const CULTURAS = ['corn', 'grapes'];

async function roteiro({ page, capturar, estado, afirmar }) {
  const arquivo = 'test-output/I-TELA-CHAO-DA-ROCA-DO-MILHO.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode o teste antes`);
  const texto = readFileSync(arquivo, 'utf8');
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), ['cangaco:partida', texto]);
  await page.keyboard.press('h');
  await page.waitForTimeout(250);
  await page.click('#ajuda [data-acao="carregar"]');
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  const recursos = JSON.parse(await page.evaluate(() => window.__cangacoPartida.estadoSerializado())).recursos ?? {};
  const roca = Object.entries(recursos).filter(([, r]) => CULTURAS.includes(r.tipo))
    .map(([chave, r]) => { const [gx, gy] = chave.split(',').map(Number); return { gx, gy, tipo: r.tipo, quantidade: r.quantidade }; });
  // o rocado do jogador (y 36-37 do teste); o do mapa fica fora da conta
  const doJogador = roca.filter((t) => t.gy >= 36 && t.gy <= 37 && t.gx >= 26 && t.gx <= 44);
  afirmar(doJogador.some((t) => t.tipo === 'corn' && t.quantidade === 0) && doJogador.some((t) => t.tipo === 'grapes' && t.quantidade === 0),
    `a partida deveria ter milho e cana em pousio: ${JSON.stringify(doJogador)}`);
  afirmar(doJogador.some((t) => t.quantidade > 0), 'a partida deveria ter rocado semeado');
  const canvas = await retanguloDoCanvas(page);
  await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
    scrollX: Math.round(35 * TILE_PX - canvas.width / 2),
    scrollY: Math.round(36.5 * TILE_PX - canvas.height / 2),
  });
  await page.waitForTimeout(400);
  const s = await estado();
  afirmar(s.losangoNaTira !== null && s.losangoNaTira.pousio === 0 && s.losangoNaTira.esgotado > 0,
    `a celula do pousio deveria ser vazia (e a do esgotado, losango): ${JSON.stringify(s.losangoNaTira)}`);
  const vista = { x0: s.camera.scrollX, y0: s.camera.scrollY, x1: s.camera.scrollX + canvas.width / s.camera.zoom, y1: s.camera.scrollY + canvas.height / s.camera.zoom };
  const naVista = roca.filter(({ gx, gy }) => gx * TILE_PX < vista.x1 && (gx + 1) * TILE_PX > vista.x0 && gy * TILE_PX < vista.y1 && (gy + 1) * TILE_PX > vista.y0);
  afirmar(naVista.length >= doJogador.length, `o rocado do jogador deveria estar na vista: ${naVista.length}`);
  afirmar(s.chaoDaCanaDesenhado === naVista.length, `todo tile de cultura na vista deveria ter chao: ${s.chaoDaCanaDesenhado} de ${naVista.length}`);
  console.log(`I-TELA-CHAO-DA-ROCA-DO-MILHO — ${naVista.length} tiles de cultura na vista, chao em ${s.chaoDaCanaDesenhado}; tira ${JSON.stringify(s.losangoNaTira)}`);
  await capturar('rocado');
}
module.exports = { roteiro };
