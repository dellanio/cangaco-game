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
  afirmar(s.chaoDaCanaDesenhado === naVista.length,
    `chao desenhado ${s.chaoDaCanaDesenhado}, cana na vista ${naVista.length}`);
  await capturar('chao-de-roca-da-cana');
}

module.exports = { roteiro };
