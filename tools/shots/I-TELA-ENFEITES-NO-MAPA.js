const { readFileSync, writeFileSync } = require('node:fs');
const { URL } = require('node:url');
const mapa = JSON.parse(readFileSync('data/maps/sertao-128.json','utf8'));
const economia = require('../../data/economy.json');
const terreno = require('../../data/terrain.json');
const { retanguloDoCanvas } = require('./_canvas');
async function roteiro({page,capturar,estado,afirmar}) {
  // Harness de visualizacao existente: remove apenas a pelicula da nevoa, nao o estado.
  const url = new URL(page.url()); url.searchParams.set('semNevoa','');
  await page.goto(url.toString());
  await page.waitForFunction(()=>window.__cangaco?.pronto);
  const canvas = await retanguloDoCanvas(page);
  const vila = economia.estadoInicial.spawnDeUnidades;
  async function centro(tile) {
    const s=await estado();
    await page.evaluate(({x,y})=>window.__cangaco.fixarCamera({scrollX:x,scrollY:y}),{
      x:(tile.gx+0.5)*terreno.tile_px-canvas.width/(2*s.camera.zoom),
      y:(tile.gy+0.5)*terreno.tile_px-canvas.height/(2*s.camera.zoom)
    });
    await page.waitForTimeout(150);
  }
  await centro(vila);
  const sobreVila=await estado();
  afirmar(sobreVila.enfeitesNaVista===0,`vila: ${sobreVila.enfeitesNaVista} enfeites`);
  await capturar('vila-sem-enfeites');
  let mato=null;
  for(let gy=Math.floor(mapa.altura/2);gy<mapa.altura-12 && !mato;gy+=8) for(let gx=Math.floor(mapa.largura/2);gx<mapa.largura-12;gx+=8) {
    await centro({gx,gy});
    const s=await estado();
    if(s.enfeitesNaVista>0) { mato={gx,gy,quantidade:s.enfeitesNaVista}; break; }
  }
  afirmar(mato!==null,`vista de mato com enfeites >0: ${mato?.quantidade}`);
  await capturar('mato-com-enfeites');
  const antes=await estado(); await page.waitForTimeout(250); const depois=await estado();
  afirmar(antes.recalculosDosEnfeites===depois.recalculosDosEnfeites,'pausado nao recalcula por quadro');
  writeFileSync('test-output/I-TELA-ENFEITES-NO-MAPA-medidas.json',JSON.stringify({vila:sobreVila.enfeitesNaVista,mato,recalculos:depois.recalculosDosEnfeites},null,2));
}
module.exports={roteiro};
