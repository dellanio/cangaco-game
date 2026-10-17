'use strict';
const { carregarGaveta } = require('./_partida');
const {readFileSync}=require('node:fs');
const {retanguloDoCanvas}=require('./_canvas');
const terreno=require('../../data/terrain.json');
const manifesto=require('../../assets/manifest.json');
async function roteiro({page,capturar,estado,afirmar}){
  const canvas=await retanguloDoCanvas(page);
  for(const n of [25,50,60,75,100]){
    const texto=readFileSync(`test-output/I-TELA-OBRAS-COM-ARTE-ATUAL-${n}.save.txt`,'utf8');
    const salvo=JSON.parse(texto),q=salvo.estado.predios.porId.quarry;
    await page.evaluate(s=>window.localStorage.setItem('cangaco:partida',s),texto);
    await carregarGaveta(page);await page.keyboard.press('Escape');
    const entendi=page.getByRole('button',{name:'Entendi',exact:true});
    if(await entendi.isVisible()){
      await page.keyboard.press('p');
      const r=await entendi.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);
      await page.mouse.down();await page.waitForTimeout(150);await page.mouse.up();await page.keyboard.press('p');
    }
    await page.mouse.move(canvas.left+canvas.width/2,canvas.top+canvas.height/2);
    for(let i=0;i<10&&(await estado()).camera.zoom!==0.75;i++){
      await page.mouse.wheel(0,(await estado()).camera.zoom<0.75?-200:200);await page.waitForTimeout(200);
    }
    await page.evaluate(s=>window.__cangaco.fixarCamera(s),{scrollX:Math.round((q.gx-1)*terreno.tile_px-canvas.width/2),scrollY:Math.round((q.gy+4)*terreno.tile_px-canvas.height/2)});
    await page.waitForTimeout(200);
    const s=await estado();
    for(const id of ['quarry','mill','barracks','church']){
      afirmar(typeof s.spritesDePredio[id]==='string',`${id} usa arte no progresso ${n}`);
      if(n<100)afirmar(s.revelacaoDasObras[id]!==undefined,`${id} revela por partes`);
    }
    if(n<100)afirmar(s.spritesDePredio.quarry.includes('madeira'),'pedreira usa madeira atual');
    if(n!==60)await capturar(`quatro-predios-${n}-porcento`);
    if(n===60||n===100){
      for(let i=0;i<10&&(await estado()).camera.zoom!==2;i++){
        await page.mouse.wheel(0,-200);await page.waitForTimeout(200);
      }
      await page.evaluate(s=>window.__cangaco.fixarCamera(s),{scrollX:Math.round((q.gx+1.5)*terreno.tile_px-canvas.width/2),scrollY:Math.round((q.gy+0.5)*terreno.tile_px-canvas.height/2)});
      await page.waitForTimeout(200);
      await capturar(n===60?'pedreira-madeira-atual':'pedreira-completa');
    }
  }
  const q=manifesto.assets.find(e=>e.id==='quarry');
  const solo=manifesto.assets.find(e=>e.tipo==='terreno'&&e.id==='grama');
  const uri=p=>`data:image/png;base64,${readFileSync(`assets/${p}`).toString('base64')}`;
  await page.setViewportSize({width:1680,height:960});
  await page.evaluate(async dados=>{
    const carregar=async src=>{const i=new window.Image();i.src=src;await i.decode();return i;};
    const [chao,madeira,completo]=await Promise.all(dados.map(carregar));
    const canvas=window.document.createElement('canvas');canvas.width=1680;canvas.height=960;
    canvas.style.cssText='position:fixed;inset:0;z-index:99999';window.document.body.append(canvas);
    const c=canvas.getContext('2d');
    for(let y=0;y<960;y+=64)for(let x=0;x<1680;x+=64)c.drawImage(chao,x,y,64,64);
    const bases=[180,410,880];
    for(const [linha,zoom] of [0.5,1,2].entries()){
      for(let col=0;col<4;col++){
        const imagem=col%2===0?madeira:completo,px=210+col*420,py=bases[linha];
        c.filter=col>=2?'brightness(0.8)':'none';
        c.drawImage(imagem,px-imagem.width*zoom/2,py-imagem.height*zoom,imagem.width*zoom,imagem.height*zoom);
        c.filter='none';c.fillStyle='#2c1d12';c.font='18px Georgia';
        c.fillText(`${col%2===0?'madeira atual':'completo'} / zoom ${zoom}${col>=2?' / RGB x0,8':''}`,px-175,py+28);
      }
    }
  },[uri(Object.values(solo.estados)[0]),uri(q.estados.madeira),uri(q.estados.completo)]);
  await capturar('prancha-madeira-completo-no-solo');
}
module.exports={roteiro};
