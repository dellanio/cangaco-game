'use strict';
const {readFileSync}=require('node:fs');
const {retanguloDoCanvas}=require('./_canvas');
const terreno=require('../../data/terrain.json');
const visual=require('../../data/estoque-visual.json');
async function roteiro({page,capturar,estado,afirmar}){
  const salvo=JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt','utf8'));
  const p=salvo.estado.predios.ordem.map(id=>salvo.estado.predios.porId[id]).find(p=>p.tipo==='quarry'&&p.lado===0);
  afirmar(p!==undefined,'fixture contem pedreira');
  p.estoque.saida.stone=3;
  await page.evaluate(s=>window.localStorage.setItem('cangaco:partida',s),JSON.stringify(salvo));
  await page.keyboard.press('h');await page.click('#ajuda [data-acao="carregar"]');await page.keyboard.press('Escape');
  const canvas=await retanguloDoCanvas(page);
  await page.mouse.move(canvas.left+canvas.width/2,canvas.top+canvas.height/2);
  for(let i=0;i<10&&(await estado()).camera.zoom!==2;i++){
    await page.mouse.wheel(0,-200);await page.waitForTimeout(200);
  }
  await page.evaluate(s=>window.__cangaco.fixarCamera(s),{scrollX:Math.round((p.gx+1.5)*terreno.tile_px-canvas.width/2),scrollY:Math.round((p.gy+1)*terreno.tile_px-canvas.height/2)});
  await page.waitForTimeout(200);
  const pilha=(await estado()).pilhasDesenhadas[p.id].find(x=>x.mercadoria==='stone');
  afirmar(pilha.n===3,'tres pedras permanecem tres pedras');
  afirmar(Math.abs(pilha.ladoPx-terreno.tile_px*visual.ladoEmTiles*1.3)<0.001,`lado real da pedra aumentou 30%: ${JSON.stringify(pilha)}`);
  await capturar('pedreira-tres-pedras-30-porcento');
}
module.exports={roteiro};
