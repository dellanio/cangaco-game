'use strict';
const { roteiro: base } = require('./F-SPR');
const mapa = require('../../data/maps/sertao-128.json');
async function roteiro(ctx) {
  await base(ctx);
  const [gx, gy] = mapa.recursos.fish[0];
  await ctx.page.evaluate(([x, y]) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }), [gx * 64 - 250, gy * 64 - 200]);
  await ctx.page.waitForTimeout(250);
  await ctx.capturar('agua-sem-peixes-boiando');
}
module.exports = { roteiro };
