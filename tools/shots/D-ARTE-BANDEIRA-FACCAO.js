'use strict';
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  // F-TELA-NEVOA: a vila da IA nasce na nevoa, e a bandeira dela nao se desenharia (a captura do
  // lado 1 em T e em T+5 sairia preta e igual). Ela ganha a vista pelo caminho do jogo: um cabra
  // do jogador parado 4 tiles ao sul do predio da IA, posto no save antes de carregar.
  const envelope = JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8'));
  const daIA = envelope.estado.predios.ordem.map((id) => envelope.estado.predios.porId[id]).find((p) => p.lado === 1);
  afirmar(daIA !== undefined, 'o save precisa de um predio da IA');
  envelope.estado.unidades.porId.olheiro = {
    id: 'olheiro', lado: 0, tipo: 'militia', gx: daIA.gx + 1, gy: daIA.gy + 6, fsm: 'ocioso', fsmData: {}, condicao: 18000,
  };
  envelope.estado.unidades.ordem.push('olheiro');
  const save = JSON.stringify(envelope);
  const salvo = envelope.estado;
  const canvas = await retanguloDoCanvas(page);
  const clip = { x: canvas.left, y: canvas.top, width: canvas.width, height: canvas.height };
  const esperar = () => page.waitForTimeout(200);
  async function carregar() {
    await page.evaluate((v) => window.localStorage.setItem('cangaco:partida', v), save);
    await page.keyboard.press('h');
    await esperar();
    await page.click('#ajuda [data-acao="carregar"]');
    await esperar();
    await page.keyboard.press('Escape');
    await esperar();
    afirmar((await estado()).tick === salvo.tick, 'save carregado no tick original');
  }
  const vistas = [0, 1].map((lado) => {
    const p = salvo.predios.ordem.map((id) => salvo.predios.porId[id]).find((p) => p.lado === lado);
    afirmar(p !== undefined, `save precisa de uma bandeira do lado ${lado}`);
    return { lado, id: p.id, scrollX: Math.round((p.gx + 1) * terreno.tile_px - canvas.width / 2),
      scrollY: Math.round((p.gy + 1) * terreno.tile_px - canvas.height / 2) };
  });
  const resultados = [];
  for (let corrida = 0; corrida < 2; corrida += 1) {
    await carregar();
    for (const vista of vistas) {
      await page.evaluate((v) => window.__cangaco.fixarCamera(v), vista);
      await esperar();
      const s = await estado();
      afirmar(s.pausado && s.bandeirasRedesenhadas === 0, 'pausado e camera parada: zero redesenhos');
      afirmar(Object.values(s.prediosDoEstado).some((p) => p.lado === vista.lado), 'dono preservado no debug');
      await capturar(`corrida-${corrida + 1}-lado-${vista.lado}-tick-T`);
      const sha256 = createHash('sha256').update(await page.screenshot({ clip })).digest('hex');
      const anterior = resultados.find((r) => r.lado === vista.lado);
      if (anterior) afirmar(sha256 === anterior.sha256, `lado ${vista.lado}: sha256 de T igual nas duas corridas`);
      resultados.push({ corrida: corrida + 1, lado: vista.lado, tick: s.tick, sha256,
        bandeirasRedesenhadasPausado: s.bandeirasRedesenhadas });
    }
  }
  await page.evaluate(() => window.__cangaco.avancar(5));
  await esperar();
  afirmar((await estado()).tick === salvo.tick + 5, 'captura em T+5');
  for (const vista of vistas) {
    await page.evaluate((v) => window.__cangaco.fixarCamera(v), vista);
    await esperar();
    await capturar(`lado-${vista.lado}-tick-T-mais-5`);
    const hash = createHash('sha256').update(await page.screenshot({ clip })).digest('hex');
    afirmar(hash !== resultados.find((r) => r.lado === vista.lado).sha256, 'T+5 difere de T');
  }
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  await page.keyboard.press('p');
  afirmar((await estado()).pausado, 'passo despausado encerra pausado');
  mkdirSync('test-output', { recursive: true });
  writeFileSync('test-output/D-ARTE-BANDEIRA-FACCAO-captura.json', JSON.stringify(resultados, null, 2) + '\n');
  console.log(JSON.stringify(resultados));
}
module.exports = { roteiro };
