import { chromium } from '@playwright/test';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import {Buffer} from 'node:buffer';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bleedPng} from '../../../tools/png-bleed.mjs';
const base=dirname(fileURLToPath(import.meta.url)),repo=resolve(base,'../../..');
const pasta=process.argv[2];
if(!pasta)throw new Error('Informe uma pasta externa para os derivados e provas');
const volumes=[15,12,9,6,3];
const uri=p=>`data:image/png;base64,${readFileSync(p).toString('base64')}`;
const fontes=Object.fromEntries(volumes.map(v=>[v,uri(`${base}/volume-${v}.png`)]));
const manifesto=JSON.parse(readFileSync(`${repo}/assets/manifest.json`,'utf8'));
const solo=manifesto.assets.find(a=>a.tipo==='terreno'&&a.id==='grama').estados.padrao;
const solos={solo:uri(`${repo}/assets/${solo}`),areia:uri(`${repo}/assets/sprites/terrain/areia.png`)};
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  const r=await page.evaluate(async({fontes,solos,volumes})=>{
    const carregar=async(src)=>{const i=new globalThis.Image();i.src=src;await i.decode();return i;};
    const sprites={},medidas={},arquivos={};
    for(const v of volumes){
      const fonte=await carregar(fontes[v]);medidas[v]=[];
      for(let m=0;m<16;m++){
        const c=globalThis.document.createElement('canvas');c.width=128;c.height=160;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
        const x0=Math.floor((m%4)*fonte.width/4),x1=Math.floor((m%4+1)*fonte.width/4),y0=Math.floor(Math.floor(m/4)*fonte.height/4),y1=Math.floor((Math.floor(m/4)+1)*fonte.height/4);
        ctx.drawImage(fonte,x0,y0,x1-x0,y1-y0,0,0,128,160);
        const dados=ctx.getImageData(0,0,128,160);let pe=-1;
        for(let y=0;y<160;y++)for(let x=0;x<128;x++){const j=(y*128+x)*4+3;if(dados.data[j]<24)dados.data[j]=0;if(dados.data[j]>0)pe=y;}
        ctx.putImageData(dados,0,0);const alinhado=globalThis.document.createElement('canvas');alinhado.width=128;alinhado.height=160;const ac=alinhado.getContext('2d');ac.drawImage(c,0,157-pe);
        const pixels=ac.getImageData(0,0,128,160);
        const esquerda=Array.from({length:160},(_,y)=>{for(let x=0;x<128;x++)if(pixels.data[(y*128+x)*4+3]>32)return x;return 128;});
        const topo=Array.from({length:128},(_,x)=>{for(let y=0;y<160;y++)if(pixels.data[(y*128+x)*4+3]>32)return y;return 160;});
        for(let y=0;y<160;y++)for(let x=0;x<128;x++){
          const j=(y*128+x)*4+3;const fx=(m&8)?Math.min(1,Math.max(0,(x-esquerda[y])/22)):1;const fy=(m&1)?Math.min(1,Math.max(0,(y-topo[x])/16)):1;
          pixels.data[j]=Math.round(pixels.data[j]*Math.min(fx,fy));
        }
        ac.putImageData(pixels,0,0);
        let ultimo=-1,primeiro=160,area=0;
        for(let y=0;y<160;y++)for(let x=0;x<128;x++)if(pixels.data[(y*128+x)*4+3]>0){ultimo=y;primeiro=Math.min(primeiro,y);area++;}
        const final=globalThis.document.createElement('canvas');final.width=128;final.height=160;final.getContext('2d').drawImage(alinhado,0,157-ultimo);
        sprites[`${v}:${m}`]=final;arquivos[`v${v}-m${m}`]=final.toDataURL('image/png').split(',')[1];medidas[v].push({mascara:m,altura:ultimo-primeiro+1,pe:157,area});
      }
    }
    const fundos={};for(const [nome,src]of Object.entries(solos))fundos[nome]=await carregar(src);
    const montar=(combinacoes,solo)=>{
      const c=globalThis.document.createElement('canvas');c.width=1440;c.height=360;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
      for(let y=0;y<c.height;y+=64)for(let x=0;x<c.width;x+=64)ctx.drawImage(fundos[solo],x,y,64,64);
      for(let i=0;i<combinacoes.length;i++){
        const mapa=combinacoes[i];const altura=mapa.length,largura=mapa[0].length;const ox=40+i*275;
        for(let y=0;y<altura;y++)for(let x=0;x<largura;x++){
          const v=mapa[y][x];if(!v)continue;
          const q=(dx,dy)=>mapa[y+dy]?.[x+dx]??0;
          const h=(q(0,-1)>=v?1:0)|(q(1,0)>=v?2:0)|(q(0,1)>=v?4:0)|(q(-1,0)>=v?8:0);
          ctx.drawImage(sprites[`${v}:${h}`],ox+x*64-32,160+y*64-160,128,160);
        }
      }
      return c.toDataURL('image/png').split(',')[1];
    };
    const inteiros=volumes.map(v=>Array.from({length:3},()=>Array(3).fill(v)));
    const mistos=volumes.length===5?[[[15,15,15],[15,9,15],[9,9,9]],[[12,12,12],[6,12,6],[6,6,6]],[[6,6,6],[3,6,3],[3,0,3]],[[15,15,15],[0,15,0],[0,0,0]],[[15,9,6],[12,6,3],[6,3,0]]]:inteiros;
    return {arquivos,medidas,provas:{'volumes-solo':montar(inteiros,'solo'),'volumes-areia':montar(inteiros,'areia'),'mistos-solo':montar(mistos,'solo'),'mistos-areia':montar(mistos,'areia')}};
  },{fontes,solos,volumes});
  mkdirSync(`${pasta}/derivados`,{recursive:true});
  for(const[nome,b64]of Object.entries(r.arquivos))writeFileSync(`${pasta}/derivados/${nome}.png`,bleedPng(Buffer.from(b64,'base64')));
  for(const[nome,b64]of Object.entries(r.provas))writeFileSync(`${pasta}/prova-${nome}.png`,Buffer.from(b64,'base64'));
  const hashes=Object.fromEntries(volumes.map(v=>[v,createHash('sha256').update(readFileSync(`${base}/volume-${v}.png`)).digest('hex')]));
  writeFileSync(`${pasta}/medidas-volumes.json`,JSON.stringify({hashes,medidas:r.medidas},null,2));
  console.log(JSON.stringify(Object.fromEntries(volumes.map(v=>[v,r.medidas[v].reduce((s,m)=>s+m.altura,0)/16]))));
} finally{await browser.close();}

