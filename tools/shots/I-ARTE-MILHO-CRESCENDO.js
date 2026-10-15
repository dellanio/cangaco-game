'use strict';
const { roteiro: campo } = require('./BUG-W');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const manifesto = require('../../assets/manifest.json');
const visual = require('../../data/culturas-visual.json');
const terreno = require('../../data/terrain.json');

async function roteiro(ctx) {
  const plano = JSON.parse(readFileSync('test-output/BUG-W.partida.json', 'utf8'));
  const corn = manifesto.assets.find(a => a.tipo === 'recurso' && a.id === 'corn');
  await campo({ ...ctx, capturar: async () => {
    const s = await ctx.estado(), vistos = new Set();
    for (const [tile, estagio] of Object.entries(plano.estagios)) {
      const arte = s.arteDasCulturas[tile];
      ctx.afirmar(arte?.fonte === 'png', `${tile}/${estagio}: arte própria PNG na vista`);
      ctx.afirmar(arte.textura === `recurso:corn:${estagio === 'pronto' ? 'presente' : estagio}`, `${tile}/${estagio}: textura correta`);
      const altura = terreno.tile_px * (estagio === 'pronto' ? visual.escalaMadura.corn.altura : 1);
      ctx.afirmar(arte.altura === altura && arte.largura === terreno.tile_px, `${tile}/${estagio}: escala preservada`);
      vistos.add(estagio);
    }
    ctx.afirmar(vistos.size === 4, 'os quatro estágios coexistem na partida semeada pelo step');
    ctx.afirmar(corn.estados.presente === 'sprites/resources/corn-D.png', 'madura preservada');
    await ctx.capturar('estagios-zoom-2');
  } });
  const canvas = await retanguloDoCanvas(ctx.page);
  await ctx.page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
  for (const zoom of [1, 0.5]) {
    for (let i = 0; i < 10 && (await ctx.estado()).camera.zoom !== zoom; i++) {
      await ctx.page.mouse.wheel(0, 200);
      await ctx.page.waitForTimeout(200);
    }
    ctx.afirmar((await ctx.estado()).camera.zoom === zoom, `zoom ${zoom}`);
    await ctx.capturar(`estagios-zoom-${zoom}`);
  }
  execFileSync(process.execPath, ['tools/prancha-crescimento-milho.mjs', 'screenshots/I-ARTE-MILHO-CRESCENDO-pranchas'], { stdio: 'inherit' });
}
module.exports = { roteiro };
