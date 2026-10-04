'use strict';
// G-TELA-OBREIRO-POR-TAREFA e G-TELA-ROCEIRO-NO-CAMPO: no jogo normal (sem ?depuracao), o obreiro martela
// a obra e assenta a pedra da estrada, e o roceiro semeia e colhe dentro do campo e volta com o milho.
// Os saves vem do `npm run test` (D-TELA-05c e G-TELA-GESTO-DO-TRABALHO).
const { readFileSync, existsSync, writeFileSync } = require('node:fs');
const { retanguloDoCanvas, pontoDoTileNaTela, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const terreno = require('../../data/terrain.json');
const { predios } = require('../../data/buildings.json');

async function roteiro({ page, estado, afirmar, capturar }) {
  const c = await retanguloDoCanvas(page);
  const registro = {};
  const centrar = async (u) => {
    await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), { scrollX: u.gx * 64 - c.width / 2, scrollY: u.gy * 64 - c.height / 2 });
    await page.waitForTimeout(150);
  };
  const carregar = async (arquivo) => {
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
    await page.evaluate((t) => window.localStorage.setItem('cangaco:partida', t), readFileSync(arquivo, 'utf8'));
    await page.keyboard.press('h'); await page.click('#ajuda [data-acao="carregar"]'); await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  };
  const avancarAte = async (predicado, limite, nome) => {
    for (let n = 0; n < limite; n++) {
      const s = await estado();
      const achado = s.unidadesRenderizadas.find(predicado);
      if (achado) return achado;
      await page.evaluate(() => window.__cangaco.avancar(1));
      await page.waitForFunction((t) => window.__cangaco.tick > t, s.tick);
    }
    afirmar(false, `nao apareceu: ${nome}`);
  };

  // 1. o obreiro na obra martela (save do D-TELA-05c)
  await carregar('test-output/D-TELA-05c-laborer.save.txt');
  let u = await avancarAte((x) => x.tipo === 'laborer' && x.frame?.startsWith('laborer/martelar/'), 300, 'obreiro martelando');
  await centrar(u);
  u = await avancarAte((x) => x.tipo === 'laborer' && x.frame?.startsWith('laborer/martelar/'), 50, 'obreiro martelando');
  registro.martelar = u.frame;
  await capturar('obreiro-martelando');

  // 2. o roceiro: semeando e colhendo dentro do tile, e voltando com o milho nas maos
  for (const [fase, prefixo] of [['semeando', 'farmer/semear/'], ['colhendo', 'farmer/colher/'], ['voltando', 'farmer/carregando/']]) {
    await carregar(`test-output/G-TELA-ROCEIRO-${fase}.save.txt`);
    // o atlas do roceiro carrega sob demanda depois do save: espera o quadro antes de andar a sim
    const r0 = (await estado()).unidadesRenderizadas.find((x) => x.id === 'roceiro');
    await centrar(r0);
    await page.waitForFunction(() => window.__cangaco.unidadesRenderizadas.find((x) => x.id === 'roceiro')?.frame);
    u = await avancarAte((x) => x.id === 'roceiro' && x.frame?.startsWith(prefixo), 60, `roceiro ${fase}`);
    await centrar(u);
    u = await avancarAte((x) => x.id === 'roceiro' && x.frame?.startsWith(prefixo), 30, `roceiro ${fase}`);
    if (fase === 'voltando') afirmar(u.carga === 'corn', `o roceiro volta com o milho nas maos: ${u.carga}`);
    registro[fase] = u.frame;
    await capturar(`roceiro-${fase}`);
  }

  // 3. o obreiro na estrada assenta a pedra (o gesto do D-ARTE-PIXEL-ART-MILITARES)
  await page.goto(page.url().split('?')[0] + '?pausado');
  await page.waitForFunction(() => window.__cangaco?.pronto);
  let s = await estado();
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const [w, h] = predios.find((p) => p.id === 'storehouse').tamanho;
  const y = armazem.gy + h;
  await page.keyboard.press('r'); await page.waitForTimeout(100);
  await arrastarDentroDoCanvas(page, await retanguloDoCanvas(page), [
    pontoDoTileNaTela(c, { gx: armazem.gx, gy: y }, s.camera, terreno.tile_px),
    pontoDoTileNaTela(c, { gx: armazem.gx + w + 1, gy: y }, s.camera, terreno.tile_px),
  ]);
  await page.keyboard.press('Escape');
  u = await avancarAte((x) => x.tipo === 'laborer' && x.frame?.startsWith('laborer/assentar/'), 900, 'obreiro assentando');
  await centrar(u);
  registro.assentar = u.frame;
  await capturar('obreiro-assentando');
  // passo despausado (CLAUDE.md §8)
  await page.keyboard.press('p'); await page.waitForTimeout(600); await page.keyboard.press('p');
  writeFileSync('test-output/G-TELA-GESTO-DO-TRABALHO.json', JSON.stringify(registro, null, 2));
}
module.exports = { roteiro };
