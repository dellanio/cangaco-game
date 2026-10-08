'use strict';
const {readFileSync}=require('node:fs');
const {retanguloDoCanvas}=require('./_canvas');
const {roteiro:regressao}=require('./F26b');
const terreno=require('../../data/terrain.json');
const medidas=require('../../data/pes-dos-militares.json');
async function roteiro(ctx){
  const {page,estado,capturar,afirmar}=ctx;
  async function conferir(){
    const s=await estado();
    afirmar(s.aneisDeSelecao.length===s.selecaoMilitar.length,'aneis correspondem a selecao real, inclusive zero apos limpar selecao');
    for(const g of s.aneisDeSelecao){
      const u=s.unidadesRenderizadas.find(u=>u.id===g.id),m=medidas.porQuadro[u.frame];
      afirmar(m!==undefined,`quadro militar medido: ${u.frame}`);
      const escala=(u.corpoPx.y1-u.corpoPx.y0)/m.alturaDoQuadro;
      const esperado=(u.gyDesenhado+0.5)*terreno.tile_px+u.deslocamentoPx.y+(u.peY??0)-m.recuoInferiorPx*escala;
      afirmar(Math.abs(g.y-esperado)<0.001,`anel no pe: ${g.id}`);
    }
  }
  await regressao({...ctx,capturar:async nome=>{await conferir();await capturar(nome);}});
  const canvas=await retanguloDoCanvas(page);
  const texto=readFileSync('test-output/I-TELA-SELECAO-NO-PE.save.txt','utf8');
  await page.evaluate(s=>window.localStorage.setItem('cangaco:partida',s),texto);
  await page.keyboard.press('h');await page.click('#ajuda [data-acao="carregar"]');await page.keyboard.press('Escape');
  const lista=(await estado()).unidadesRenderizadas.filter(u=>u.id.startsWith('galeria-'));
  const xs=lista.map(u=>(u.gxDesenhado+0.5)*terreno.tile_px+u.deslocamentoPx.x),ys=lista.map(u=>(u.gyDesenhado+0.5)*terreno.tile_px+u.deslocamentoPx.y);
  const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  await page.evaluate(s=>window.__cangaco.fixarCamera(s),{scrollX:cx-canvas.width/2,scrollY:cy-canvas.height/2});
  await page.waitForTimeout(200);
  const cam=(await estado()).camera;
  await page.keyboard.press('p');
  await page.mouse.move(canvas.left+Math.min(...xs)-cam.scrollX-32,canvas.top+Math.min(...ys)-cam.scrollY-32);
  await page.mouse.down();await page.waitForTimeout(150);
  await page.mouse.move(canvas.left+Math.max(...xs)-cam.scrollX+32,canvas.top+Math.max(...ys)-cam.scrollY+32,{steps:8});
  await page.waitForTimeout(150);await page.mouse.up();await page.keyboard.press('p');await page.waitForTimeout(200);
  afirmar((await estado()).selecaoMilitar.length===medidas.fontes.length,'quinze militares selecionados pela caixa');
  for(const zoom of [0.5,1,2]){
    await page.mouse.move(canvas.left+canvas.width/2,canvas.top+canvas.height/2);
    for(let i=0;i<10&&(await estado()).camera.zoom!==zoom;i++){
      await page.mouse.wheel(0,(await estado()).camera.zoom<zoom?-200:200);await page.waitForTimeout(200);
    }
    await conferir();await capturar(`quinze-militares-zoom-${zoom}`);
  }
}
module.exports={roteiro};
