'use strict';
// I-TELA-OBRA-EM-ORDEM-DE-CONSTRUCAO (aceite 2) — uma obra de lenhador em tres momentos, na vila pronta do operador:
// so a fundacao, os pilares de pe, e a estrutura inteira com a parede subindo. O hp de cada momento sai da conta da F17g
// (timber 3, stone 2, hp 250: a madeira e hp*5/750 ate o hp 150; a pedra, (hp*5 - 750)/500).
const { readFileSync, writeFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const { predios } = require('../../data/buildings.json');

const MOMENTOS = [['fundacao', 30], ['pilares', 83], ['parede-subindo', 190]];

async function roteiro({ page, capturar, estado, afirmar }) {
  const salvo = JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8'));
  // a obra num lote de chao plano abaixo da vila (o do I-TELA-OBREIRO-NIVELA-O-LOTE, a leste da roca de milho)
  const lugar = { gx: 30, gy: 40 };
  const [w, h] = predios.find((p) => p.id === 'woodcutters').tamanho;
  const sobrepoe = Object.values(salvo.estado.predios.porId).filter((p) => {
    const [pw, ph] = predios.find((d) => d.id === p.tipo)?.tamanho ?? [1, 1];
    return p.gx < lugar.gx + w && p.gx + pw > lugar.gx && p.gy < lugar.gy + h && p.gy + ph > lugar.gy;
  });
  afirmar(sobrepoe.length === 0, `o lote da obra esta livre: ${sobrepoe.map((p) => p.id)}`);
  const canvas = await retanguloDoCanvas(page);
  const passos = {};
  for (const [nome, hp] of MOMENTOS) {
    const s0 = JSON.parse(JSON.stringify(salvo));
    s0.estado.predios.porId['obra-lenhador'] = { id: 'obra-lenhador', lado: 0, tipo: 'woodcutters', ...lugar, estado: 'obra', hp, obra: { faltam: {}, nivelamento: 100000 } };
    s0.estado.predios.ordem.push('obra-lenhador');
    // as unidades paradas em volta da obra (os cabras da vila pronta) saem da copia, para a foto mostrar so a obra
    const longe = (u) => Math.abs(u.gx - (lugar.gx + 1)) > 6 || Math.abs(u.gy - (lugar.gy + 1)) > 5;
    s0.estado.unidades.ordem = s0.estado.unidades.ordem.filter((id) => longe(s0.estado.unidades.porId[id]));
    for (const id of Object.keys(s0.estado.unidades.porId)) if (!s0.estado.unidades.ordem.includes(id)) delete s0.estado.unidades.porId[id];
    await page.evaluate((t) => window.localStorage.setItem('cangaco:partida', t), JSON.stringify(s0));
    await page.keyboard.press('h'); await page.click('#ajuda [data-acao="carregar"]'); await page.keyboard.press('Escape');
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    for (let n = 0; n < 10 && (await estado()).camera.zoom !== 2; n++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(200); }
    await page.evaluate((c) => window.__cangaco.fixarCamera(c), {
      scrollX: Math.round((lugar.gx + 1.5) * terreno.tile_px - canvas.width / 2), scrollY: Math.round((lugar.gy + 0.2) * terreno.tile_px - canvas.height / 2),
    });
    await page.waitForTimeout(300);
    const s = await estado();
    const madeira = s.passosDasObrasEmOrdem['obra-lenhador:madeira'];
    const pedra = s.passosDasObrasEmOrdem['obra-lenhador:pedra'];
    afirmar(typeof madeira === 'number' && typeof pedra === 'number', `a obra do lenhador desenhada em ordem de construcao: ${JSON.stringify(s.passosDasObrasEmOrdem)}`);
    passos[nome] = { hp, madeira, pedra };
    await capturar(nome);
  }
  // fundacao: so a faixa da fundacao (ate 25% da estrutura, 8 de 32); pilares: depois dela, antes das vigas (60%, 19);
  // parede: a estrutura inteira e a pedra comecando
  afirmar(passos.fundacao.madeira > 0 && passos.fundacao.madeira <= 8 && passos.fundacao.pedra === 0, `so a fundacao: ${JSON.stringify(passos.fundacao)}`);
  afirmar(passos.pilares.madeira > 8 && passos.pilares.madeira <= 19 && passos.pilares.pedra === 0, `os pilares de pe: ${JSON.stringify(passos.pilares)}`);
  afirmar(passos['parede-subindo'].madeira === 32 && passos['parede-subindo'].pedra > 0 && passos['parede-subindo'].pedra < 32, `a parede subindo: ${JSON.stringify(passos['parede-subindo'])}`);
  // passo despausado (CLAUDE.md §8)
  await page.keyboard.press('p'); await page.waitForTimeout(400); await page.keyboard.press('p'); await page.waitForTimeout(150);
  writeFileSync('test-output/I-TELA-OBRA-EM-ORDEM-DE-CONSTRUCAO.json', JSON.stringify({ lugar, passos }, null, 2));
}

module.exports = { roteiro };
