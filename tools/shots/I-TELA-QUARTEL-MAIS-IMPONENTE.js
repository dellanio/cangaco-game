'use strict';
const { carregarGaveta } = require('./_partida');
const {readFileSync}=require('node:fs');
const {retanguloDoCanvas}=require('./_canvas');
const terreno=require('../../data/terrain.json');
async function roteiro({page,capturar,estado,afirmar}){
  const texto=readFileSync('test-output/I-TELA-QUARTEL-MAIS-IMPONENTE.save.txt','utf8');
  const salvo=JSON.parse(texto),p=salvo.estado.predios.porId.quartel;
  await page.evaluate(s=>window.localStorage.setItem('cangaco:partida',s),texto);
  await carregarGaveta(page);await page.keyboard.press('Escape');
  const entendi=page.getByRole('button',{name:'Entendi',exact:true});
  if(await entendi.isVisible()){
    await page.keyboard.press('p');
    const r=await entendi.boundingBox();
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2);
    await page.mouse.down();await page.waitForTimeout(150);await page.mouse.up();
    await page.keyboard.press('p');
  }
  const canvas=await retanguloDoCanvas(page);
  await page.mouse.move(canvas.left+canvas.width/2,canvas.top+canvas.height/2);
  for(let i=0;i<10&&(await estado()).camera.zoom!==1.5;i++){
    await page.mouse.wheel(0,(await estado()).camera.zoom<1.5?-200:200);await page.waitForTimeout(200);
  }
  await page.evaluate(s=>window.__cangaco.fixarCamera(s),{scrollX:Math.round(p.gx*terreno.tile_px-canvas.width/2),scrollY:Math.round((p.gy+1.5)*terreno.tile_px-canvas.height/2)});
  await page.waitForTimeout(200);
  const s=await estado(),caixa=s.caixasDesenhadas.quartel;
  afirmar(Math.abs(caixa.w-4*terreno.tile_px*1.2)<0.001&&Math.abs(caixa.h-4*terreno.tile_px*1.2)<0.001,'quartel desenhado 20% maior nos dois eixos');
  afirmar(typeof s.spritesDePredio.igreja==='string','igreja de referencia usa arte atual');
  await capturar('quartel-e-igreja');
}
module.exports={roteiro};
