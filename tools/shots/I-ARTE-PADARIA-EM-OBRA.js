'use strict';
const { abrirGavetas } = require('./_partida');
const { readFileSync, writeFileSync } = require('node:fs');
const { Buffer } = require('node:buffer');
const { URL } = require('node:url');
const config = require('../../data/bakery-obra-arte.json');
const terreno = require('../../data/terrain.json');
const manifesto = require('../../assets/manifest.json');
const { retanguloDoCanvas } = require('./_canvas');
async function roteiro({ page, estado, afirmar, capturar }) {
  const url=new URL(page.url()); url.searchParams.set('semNevoa','');
  await page.goto(url.toString()); await page.waitForFunction(()=>window.__cangaco?.pronto);
  const canvas=await retanguloDoCanvas(page);
  for(const nivel of config.estados) {
    const save=readFileSync(`test-output/I-ARTE-PADARIA-EM-OBRA-${nivel}.save.txt`,'utf8');
    await page.evaluate(v=>window.localStorage.setItem('cangaco:partida',v),save);
    await abrirGavetas(page, 'carregar'); await page.waitForTimeout(150);
    const b=await page.locator('#gavetas button[data-acao="carregar"][data-gaveta="1"]').boundingBox(); afirmar(b!==null,'carregar existe');
    await page.keyboard.press('p'); await page.mouse.move(b.x+b.width/2,b.y+b.height/2); await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up(); await page.click('#abas [data-aba="construir"]');
    await page.waitForTimeout(200); await page.keyboard.press('Escape'); if(!(await estado()).pausado) await page.keyboard.press('p');
    const s=await estado(), p=s.prediosDoEstado['bakery-arte']; afirmar(p?.tipo==='bakery','cenário da Padaria carregado');
    afirmar(s.spritesDePredio['bakery-arte']===`predio:bakery:${nivel}`,`Padaria ${nivel} usa PNG real: ${s.spritesDePredio['bakery-arte']}`);
    for(const z of config.zooms) {
      await page.mouse.move(canvas.left+canvas.width/2,canvas.top+canvas.height/2);
      for(let i=0;i<10 && (await estado()).camera.zoom!==z;i++) { await page.mouse.wheel(0,(await estado()).camera.zoom>z?200:-200); await page.waitForTimeout(100); }
      afirmar((await estado()).camera.zoom===z,`zoom${z}`);
      await page.evaluate(c=>window.__cangaco.fixarCamera(c),{scrollX:(p.gx+1.5)*terreno.tile_px-canvas.width/2,scrollY:(p.gy+1.5)*terreno.tile_px-canvas.height/2});
      await page.mouse.move(20,20); await page.waitForTimeout(200); await capturar(`${nivel}-zoom-${z}`);
    }
  }
  const entrada=manifesto.assets.find(a=>a.id==='bakery'), solos=['grama','areia','rocha'].map(id=>({id,path:manifesto.assets.find(a=>a.id===id).estados.padrao}));
  for(const z of config.zooms) {
    const png=await page.evaluate(async ({config,entrada,solos,z})=>{
      const load=src=>new Promise((ok,erro)=>{const im=new window.Image();im.onload=()=>ok(im);im.onerror=erro;im.src='/assets/'+src;});
      const pares=await Promise.all(config.estados.map(s=>load(entrada.estados[s]))), fundos=await Promise.all(solos.map(s=>load(s.path)));
      const m=config.prancha.margem, w=(config.canvas[0]*2+m*3)*z,h=(config.canvas[1]+m)*z+config.prancha.rodape;
      const c=window.document.createElement('canvas');c.width=w*solos.length;c.height=h*config.fatoresRGB.length;const ctx=c.getContext('2d');
      config.fatoresRGB.forEach((f,row)=>fundos.forEach((fundo,col)=>{
        const t=window.document.createElement('canvas');t.width=w;t.height=h-config.prancha.rodape;const p=t.getContext('2d');
        for(let y=0;y<t.height;y+=fundo.height*z) for(let x=0;x<t.width;x+=fundo.width*z) p.drawImage(fundo,x,y,fundo.width*z,fundo.height*z);
        pares.forEach((im,i)=>p.drawImage(im,(m+i*(config.canvas[0]+m))*z,0,im.width*z,im.height*z));
        if(f!==1){const d=p.getImageData(0,0,t.width,t.height);for(let i=0;i<d.data.length;i+=4)for(let k=0;k<3;k++)d.data[i+k]=Math.round(d.data[i+k]*f);p.putImageData(d,0,0);}
        ctx.drawImage(t,col*w,row*h);ctx.fillStyle='#ede3d0';ctx.fillRect(col*w,row*h+t.height,w,config.prancha.rodape);ctx.fillStyle='#21180f';ctx.font='16px serif';ctx.fillText(`${solos[col].id} madeira/completo zoom${z} RGBx${f}`,col*w+8,row*h+t.height+20);
      }));return c.toDataURL('image/png');
    },{config,entrada,solos,z});
    afirmar(png.startsWith('data:image/png;base64,'),'prancha real');writeFileSync(`screenshots/I-ARTE-PADARIA-EM-OBRA-prancha-zoom-${z}.png`,Buffer.from(png.split(',')[1],'base64'));
  }
}
module.exports={roteiro};
