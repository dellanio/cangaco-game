'use strict';
const { carregarGaveta } = require('./_partida');
const {readFileSync}=require('node:fs');
const {retanguloDoCanvas}=require('./_canvas');
const terreno=require('../../data/terrain.json');
const economia=require('../../data/economy.json');
async function roteiro({page,capturar,estado,afirmar}){
  const salvo=JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt','utf8'));
  const bodega=salvo.estado.predios.porId.bodega;
  // Fixture carregada pela mesma porta de save do jogador; render so le o estoque.
  bodega.estoque.entrada=Object.fromEntries(economia.grupos.comida.map(m=>[m,1]));
  await page.evaluate(s=>window.localStorage.setItem('cangaco:partida',s),JSON.stringify(salvo));
  await carregarGaveta(page);
  await page.keyboard.press('Escape');
  const canvas=await retanguloDoCanvas(page);
  await page.mouse.move(canvas.left+canvas.width/2,canvas.top+canvas.height/2);
  for(let n=0;n<10 && (await estado()).camera.zoom!==2;n++){
    await page.mouse.wheel(0,-200);await page.waitForTimeout(200);
  }
  await page.evaluate(s=>window.__cangaco.fixarCamera(s),{
    scrollX:Math.round((bodega.gx+2)*terreno.tile_px-canvas.width/2),
    scrollY:Math.round((bodega.gy+1.5)*terreno.tile_px-canvas.height/2)
  });
  await page.waitForTimeout(200);
  const s=await estado(),pilhas=s.pilhasDesenhadas.bodega;
  afirmar(typeof s.spritesDePredio.bodega==='string','Bodega usa PNG atual');
  afirmar(pilhas.length===4 && pilhas.every(p=>p.n===1),'quatro alimentos reais desenhados');
  await capturar('quatro-comidas-nas-mesas');
}
module.exports={roteiro};
