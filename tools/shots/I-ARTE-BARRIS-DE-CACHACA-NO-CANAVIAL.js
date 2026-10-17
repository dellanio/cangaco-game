'use strict';
const { carregarGaveta } = require('./_partida');
const {readFileSync}=require('node:fs');
const {retanguloDoCanvas}=require('./_canvas');
const terreno=require('../../data/terrain.json');
const manifesto=require('../../assets/manifest.json');
async function roteiro({page,capturar,estado,afirmar}){
 const original=JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt','utf8'));
 const id=original.estado.predios.ordem.find(id=>original.estado.predios.porId[id].tipo==='wineyard'&&original.estado.predios.porId[id].lado===0);
 afirmar(id!==undefined,'fixture contem canavial');
 const canvas=await retanguloDoCanvas(page);
 for(const n of [0,1,5]){
  const salvo=JSON.parse(JSON.stringify(original)),p=salvo.estado.predios.porId[id];p.estoque.saida.wine=n;
  await page.evaluate(s=>window.localStorage.setItem('cangaco:partida',s),JSON.stringify(salvo));
  await carregarGaveta(page);await page.keyboard.press('Escape');
  await page.mouse.move(canvas.left+canvas.width/2,canvas.top+canvas.height/2);
  for(let i=0;i<10&&(await estado()).camera.zoom!==2;i++){await page.mouse.wheel(0,-200);await page.waitForTimeout(200);}
  await page.evaluate(s=>window.__cangaco.fixarCamera(s),{scrollX:Math.round((p.gx+1.5)*terreno.tile_px-canvas.width/2),scrollY:Math.round((p.gy+1)*terreno.tile_px-canvas.height/2)});
  await page.waitForTimeout(200);
  const pilhas=(await estado()).pilhasDesenhadas[id]??[];
  afirmar(pilhas.length===(n===0?0:1),'zero sem barril; estoque positivo tem pilha');
  if(n>0){afirmar(pilhas[0].mercadoria==='wine'&&pilhas[0].n===n,'barris representam cachaca pronta');afirmar(pilhas[0].fonte==='pilha','sprite de barril carregado');}
  await capturar(`${n}-barris-cachaca-pronta`);
 }
 const arquivo=manifesto.assets.find(a=>a.tipo==='pilha'&&a.id==='wine').estados.unidade;
 const chao=manifesto.assets.find(a=>a.tipo==='terreno'&&a.id==='grama').estados.padrao;
 await page.evaluate(async ([arquivo,chao])=>{
  const carregar=src=>new Promise((ok,erro)=>{const i=new window.Image();i.onload=()=>ok(i);i.onerror=erro;i.src='/assets/'+src;});
  const [sprite,solo]=await Promise.all([carregar(arquivo),carregar(chao)]);
  const c=window.document.createElement('canvas');c.id='prancha-barris';c.width=720;c.height=350;c.style.cssText='position:fixed;z-index:9999;left:260px;top:40px;border:2px solid #442b17';window.document.body.append(c);
  const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
  for(let y=0;y<c.height;y+=64)for(let x=0;x<c.width;x+=64)ctx.drawImage(solo,x,y,64,64);
  ctx.fillStyle='#20140c';ctx.font='18px serif';ctx.fillText('Barril de carvalho — normal / RGB x 0,8 — zoom 0,5 / 1 / 2',15,28);
  for(let r=0;r<2;r++)for(let i=0;i<3;i++){
   const z=[0.5,1,2][i],s=window.document.createElement('canvas');s.width=sprite.width;s.height=sprite.height;const sc=s.getContext('2d');sc.drawImage(sprite,0,0);
   if(r){const d=sc.getImageData(0,0,s.width,s.height);for(let p=0;p<d.data.length;p+=4)for(let k=0;k<3;k++)d.data[p+k]*=0.8;sc.putImageData(d,0,0);}
   const x=130+i*230,y=150+r*150;ctx.drawImage(s,x-s.width*z/2,y-s.height*z,s.width*z,s.height*z);ctx.fillText(String(z),x-10,y+24);
  }
 },[arquivo,chao]);
 await capturar('prancha-barril-no-solo');await page.evaluate(()=>window.document.getElementById('prancha-barris').remove());
}
module.exports={roteiro};
