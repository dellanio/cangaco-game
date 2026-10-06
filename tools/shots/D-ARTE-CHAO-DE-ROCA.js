'use strict';
const { readFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const SAVE = 'saves/teste-operador-vila-pronta.txt';
const CHAVE_DO_SAVE = 'cangaco:partida';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const texto = readFileSync(SAVE, 'utf8');
  const salvo = JSON.parse(texto).estado;
  const cana = Object.entries(salvo.recursos)
    .filter(([, recurso]) => recurso.tipo === 'grapes')
    .map(([chave, recurso]) => ({
      ...Object.fromEntries(chave.split(',').map((n, i) => [i === 0 ? 'gx' : 'gy', Number(n)])),
      quantidade: recurso.quantidade,
    }));
  // I-TELA-CHAO-DA-ROCA-DO-MILHO: o chao cobre tambem o milho; a contagem do chao e a de toda cultura
  const roca = Object.entries(salvo.recursos)
    .filter(([, recurso]) => recurso.tipo === 'grapes' || recurso.tipo === 'corn')
    .map(([chave]) => Object.fromEntries(chave.split(',').map((n, i) => [i === 0 ? 'gx' : 'gy', Number(n)])));
  const naCaixa = (tiles, v) => tiles.filter(({ gx, gy }) => {
    const x = gx * terreno.tile_px; const y = gy * terreno.tile_px;
    return x < v.direita && x + terreno.tile_px > v.esquerda && y < v.fundo && y + terreno.tile_px > v.topo;
  });
  afirmar(cana.length > 0, 'o save precisa conter tiles de cana');
  afirmar(cana.some((tile) => tile.quantidade === 0), 'o save precisa conter cana em pousio');
  const servido = await page.evaluate(async ([chave, url]) => {
    const resposta = await window.fetch(url);
    const conteudo = await resposta.text();
    window.localStorage.setItem(chave, conteudo);
    return conteudo.length;
  }, [CHAVE_DO_SAVE, `/${SAVE}`]);
  afirmar(servido === texto.length, 'o save servido precisa estar completo');
  await page.keyboard.press('h');
  await page.waitForTimeout(200);
  await page.click('#ajuda [data-acao="carregar"]');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const canvas = await retanguloDoCanvas(page);
  const centroX = cana.reduce((total, tile) => total + tile.gx, 0) / cana.length;
  const centroY = cana.reduce((total, tile) => total + tile.gy, 0) / cana.length;
  await page.evaluate((scroll) => window.__cangaco.fixarCamera(scroll), {
    scrollX: Math.round(centroX * terreno.tile_px - canvas.width / 2),
    scrollY: Math.round(centroY * terreno.tile_px - canvas.height / 2),
  });
  await page.waitForTimeout(200);
  const s = await estado();
  afirmar(s.tick === salvo.tick, 'a partida carregada precisa manter o tick do save');
  const vista = {
    esquerda: s.camera.scrollX,
    topo: s.camera.scrollY,
    direita: s.camera.scrollX + canvas.width / s.camera.zoom,
    fundo: s.camera.scrollY + canvas.height / s.camera.zoom,
  };
  const naVista = cana.filter(({ gx, gy }) => {
    const x = gx * terreno.tile_px;
    const y = gy * terreno.tile_px;
    return x < vista.direita && x + terreno.tile_px > vista.esquerda
      && y < vista.fundo && y + terreno.tile_px > vista.topo;
  });
  afirmar(naVista.length > 0, 'a camera precisa ver a cana');
  afirmar(naVista.some((tile) => tile.quantidade === 0), 'a camera precisa ver cana em pousio');
  const rocaNaVista = naCaixa(roca, vista).length;
  afirmar(s.chaoDaCanaDesenhado === rocaNaVista,
    `chao desenhado ${s.chaoDaCanaDesenhado}, cultura na vista ${rocaNaVista} (cana ${naVista.length})`);
  // Outra vista, sem tick novo: a contagem acompanha a camera sem varrer recursos.
  await page.evaluate(() => window.__cangaco.fixarCamera({ scrollX: 0, scrollY: 0 }));
  await page.waitForTimeout(200);
  const outra = await estado();
  const outraVista = { esquerda: outra.camera.scrollX, topo: outra.camera.scrollY,
    direita: outra.camera.scrollX + canvas.width / outra.camera.zoom,
    fundo: outra.camera.scrollY + canvas.height / outra.camera.zoom };
  const canaNaOutraVista = cana.filter(({ gx, gy }) => {
    const x = gx * terreno.tile_px; const y = gy * terreno.tile_px;
    return x < outraVista.direita && x + terreno.tile_px > outraVista.esquerda &&
      y < outraVista.fundo && y + terreno.tile_px > outraVista.topo;
  });
  afirmar(canaNaOutraVista.length !== naVista.length, 'a mudanca de camera precisa mudar a cana visivel');
  afirmar(outra.tick === s.tick, 'fixarCamera nao avanca o tick');
  afirmar(outra.chaoDaCanaDesenhado === naCaixa(roca, outraVista).length, 'o chao acompanha a roca na nova vista sem tick');
  afirmar(outra.recursosVarridosPeloChao === 0, 'camera nova nao varre recursos');
  await page.evaluate((scroll) => window.__cangaco.fixarCamera(scroll),
    { scrollX: s.camera.scrollX, scrollY: s.camera.scrollY });
  await page.waitForTimeout(200);
  const voltou = await estado();
  afirmar(voltou.tick === s.tick && voltou.chaoDaCanaDesenhado === rocaNaVista,
    'a contagem volta com a camera, ainda sem tick');
  afirmar(voltou.recursosVarridosPeloChao === 0, 'voltar a camera tambem nao varre recursos');
  await capturar('chao-de-roca-da-cana');
  // A grade da ferramenta (depth 0,25) fica por cima do chao da cana (0,22): com a estrada
  // escolhida, as linhas aparecem sobre o partido. A captura e aberta na sessao.
  await page.keyboard.press('r');
  await page.waitForTimeout(200);
  await capturar('chao-de-roca-com-a-grade');
  await page.keyboard.press('Escape');
}

module.exports = { roteiro };
