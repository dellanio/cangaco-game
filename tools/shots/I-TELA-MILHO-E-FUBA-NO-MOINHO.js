'use strict';
const { carregarGaveta } = require('./_partida');
const {readFileSync}=require('node:fs');
const {retanguloDoCanvas}=require('./_canvas');
const terreno=require('../../data/terrain.json');
const visual=require('../../data/estoque-visual.json');
async function roteiro({page,capturar,estado,afirmar}){
 const salvo=JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt','utf8'));
 const p=salvo.estado.predios.ordem.map(id=>salvo.estado.predios.porId[id]).find(p=>p.tipo==='mill'&&p.lado===0);
 afirmar(p!==undefined,'fixture contem moinho');
 p.estoque.entrada.corn=5;p.estoque.saida.flour=5;
 await page.evaluate(s=>window.localStorage.setItem('cangaco:partida',s),JSON.stringify(salvo));
 await carregarGaveta(page);await page.keyboard.press('Escape');
 const canvas=await retanguloDoCanvas(page);
 await page.mouse.move(canvas.left+canvas.width/2,canvas.top+canvas.height/2);
 for(let i=0;i<10&&(await estado()).camera.zoom!==2;i++){await page.mouse.wheel(0,-200);await page.waitForTimeout(200);}
 await page.evaluate(s=>window.__cangaco.fixarCamera(s),{scrollX:Math.round((p.gx+1.5)*terreno.tile_px-canvas.width/2),scrollY:Math.round((p.gy+1.5)*terreno.tile_px-canvas.height/2)});
 await page.waitForTimeout(200);
 const pilhas=(await estado()).pilhasDesenhadas[p.id];
 for(const m of ['corn','flour']){const pilha=pilhas.find(x=>x.mercadoria===m);afirmar(pilha.n===5,'cinco unidades permanecem cinco');afirmar(Math.abs(pilha.ladoPx-terreno.tile_px*visual.ladoEmTiles*visual.escalaPorPredio.mill[m])<0.001,`escala real de ${m}: ${JSON.stringify(pilha)}`);}
 await capturar('moinho-milho-30-fuba-100-porcento');
}
module.exports={roteiro};
