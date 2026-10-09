'use strict';
const { roteiro: pedreira } = require('./F-T3');
const { retanguloDoCanvas } = require('./_canvas');
const { writeFileSync } = require('node:fs');
const terreno = require('../../data/terrain.json');
const manifesto = require('../../assets/manifest.json');
const dados = require('../../data/serra.json');

async function roteiro(ctx) {
  const {page,estado,afirmar,capturar}=ctx;
  await pedreira(ctx);
  const inicial=(await estado()).serra;
  afirmar(Object.keys(inicial.trechos).length>0,'serra desenhada no mapa');
  const conferir=s=>{
    for(const [chave,t] of Object.entries(s.serra.trechos)) {
      afirmar(t.textura===`vegetacao:rock:v${t.volume}:h${t.altura}:m${t.mascara}`,`textura real de ${chave}: ${t.textura}`);
      afirmar((t.altura&~t.mascara)===0,'h e subconjunto de m');
      afirmar(s.lajedoDesenhado[chave]===`m${t.mascara}`,'guarda F-TR continua lendo conexao real no chao');
    }
  };
  conferir(await estado());
  await page.waitForTimeout(200);
  const parado=(await estado()).serra;
  afirmar(parado.recalculos===inicial.recalculos && parado.repinturas===inicial.repinturas,'quadros sem tick nao recalculam nem repintam serra');
  const vistos=new Set(), medidas=[];
  let alvo=Object.keys(inicial.trechos).find(k=>inicial.trechos[k].volume!==15)??null;
  const canvas=await retanguloDoCanvas(page);
  if(alvo!==null) {
    const trecho=inicial.trechos[alvo];vistos.add(trecho.volume);
    medidas.push({tick:(await estado()).tick,alvo,volume:trecho.volume,trecho});
    await capturar(`extracao-local-volume-${trecho.volume}`);
  }
  for(let n=0;n<6000;n+=5) {
    await page.evaluate(n=>window.__cangaco.avancar(n),5);
    await page.waitForTimeout(30);
    const s=await estado();conferir(s);
    if(alvo===null) alvo=Object.keys(inicial.trechos).find(k=>s.serra.trechos[k]?.volume!==inicial.trechos[k].volume)??null;
    if(alvo===null)continue;
    const trecho=s.serra.trechos[alvo];
    const volume=trecho?.volume??0;
    if(vistos.has(volume))continue;
    vistos.add(volume);
    const [gx,gy]=alvo.split(',').map(Number);
    await page.evaluate(c=>window.__cangaco.fixarCamera(c),{
      scrollX:(gx+0.5)*terreno.tile_px-canvas.width/(2*s.camera.zoom),
      scrollY:(gy+0.5)*terreno.tile_px-canvas.height/(2*s.camera.zoom),
    });
    await page.waitForTimeout(100);
    medidas.push({tick:s.tick,alvo,volume,trecho});
    await capturar(`extracao-local-volume-${volume}`);
    if(volume===0) {
      afirmar(s.lajedoDesenhado[alvo]===undefined,'zero remove sprite');
      afirmar(Object.entries(s.serra.trechos).some(([k,t])=>k!==alvo && t.volume===15),'vizinho/conjunto conserva volume integro');
      break;
    }
  }
  afirmar([12,9,6,3,0].every(v=>vistos.has(v)),`extracao atravessa cinco marcos: ${[...vistos]}`);
  const rock=manifesto.assets.find(a=>a.tipo==='vegetacao'&&a.id==='rock');
  for(const zoom of [0.5,1,2]) {
    // Prancha carregada dos mesmos PNGs que o render usa, sem grade nem numeros.
    await page.evaluate(async({estados,zoom,volumes,chao})=>{
      const carregar=async src=>{const i=new globalThis.Image();i.src='/assets/'+src;await i.decode();return i;};
      const sprites={};for(const v of volumes)for(let h=0;h<16;h++)sprites[`${v}:${h}`]=await carregar(estados[`v${v}:h${h}:m${h}`]);
      const fundos=[await carregar(chao),await carregar('sprites/terrain/areia.png')];
      const inteiro=volumes.map(v=>Array.from({length:3},()=>Array(3).fill(v)));
      const mistos=[[[15,15,15],[15,9,15],[9,9,9]],[[12,12,12],[6,12,6],[6,6,6]],[[6,6,6],[3,6,3],[3,0,3]],[[15,15,15],[0,15,0],[0,0,0]],[[15,9,6],[12,6,3],[6,3,0]]];
      const c=globalThis.document.createElement('canvas');c.id='serra-prova';c.width=1440*zoom;c.height=360*zoom*8;
      c.style.cssText='position:absolute;z-index:9999;left:0;top:0';globalThis.document.body.append(c);const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
      let linha=0;
      for(const mapas of [inteiro,mistos])for(const solo of fundos)for(const tint of [1,0.8]){
        const p=globalThis.document.createElement('canvas');p.width=1440;p.height=360;const pc=p.getContext('2d');pc.imageSmoothingEnabled=false;
        for(let y=0;y<360;y+=64)for(let x=0;x<1440;x+=64)pc.drawImage(solo,x,y,64,64);
        mapas.forEach((mapa,i)=>mapa.forEach((row,y)=>row.forEach((v,x)=>{
          if(!v)return;const q=(dx,dy)=>mapa[y+dy]?.[x+dx]??0;
          const h=(q(0,-1)>=v?1:0)|(q(1,0)>=v?2:0)|(q(0,1)>=v?4:0)|(q(-1,0)>=v?8:0);
          pc.drawImage(sprites[`${v}:${h}`],40+i*275+x*64-32,y*64,128,160);
        })));
        if(tint!==1){const d=pc.getImageData(0,0,1440,360);for(let n=0;n<d.data.length;n+=4)for(let k=0;k<3;k++)d.data[n+k]*=tint;pc.putImageData(d,0,0);}
        ctx.drawImage(p,0,linha++*360*zoom,1440*zoom,360*zoom);
      }
    },{estados:rock.estados,zoom,volumes:dados.volumes,chao:manifesto.assets.find(a=>a.tipo==='terreno'&&a.id==='grama').estados.padrao});
    await page.locator('#serra-prova').screenshot({path:`screenshots/I-TELA-SERRA-DESGASTE-LOCAL-prancha-zoom-${zoom}.png`});
    await page.evaluate(()=>globalThis.document.getElementById('serra-prova').remove());
  }
  writeFileSync('test-output/I-TELA-SERRA-DESGASTE-LOCAL-medidas.json',JSON.stringify({inicial,parado,medidas,final:(await estado()).serra},null,2));
}
module.exports={roteiro};
