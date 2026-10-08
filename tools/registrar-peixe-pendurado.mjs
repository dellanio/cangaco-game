import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePng, encodePng} from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
const base='base/fish-stock/original-20261008.png', derivado='sprites/stock/fish/unidade-20261008.png';
const bytes=readFileSync(`assets/${base}`), p=decodePng(bytes);
let x0=p.width, y0=p.height, x1=0, y1=0;
for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
const w=32,h=80, escala=Math.min((w-2)/(x1-x0+1),(h-1)/(y1-y0+1));
const dw=Math.round((x1-x0+1)*escala), dh=Math.round((y1-y0+1)*escala), ox=Math.floor((w-dw)/2), oy=h-dh, data=new Uint8Array(w*h*4);
for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
  const sx=x0+Math.min(x1-x0,Math.floor(x/escala)),sy=y0+Math.min(y1-y0,Math.floor(y/escala));
  data.set(p.data.subarray((sy*p.width+sx)*4,(sy*p.width+sx)*4+4),((oy+y)*w+ox+x)*4);
}
writeFileSync(`assets/${derivado}`,encodePng({width:w,height:h,data}));
writeFileSync('assets/base/fish-stock/geracao.json',JSON.stringify({data:'2026-10-08',ferramenta:'OpenAI image_gen',geracao:'exec-4083dbf7-8ec8-43ee-b759-7cd966f9e191',referencias:[],descricao:'Peixe inteiro vertical, cabeca para baixo, corda curta de sisal no rabo. Luz superior ligeiramente do sul, sem eixo leste-oeste. Uma chamada, arte original.',sha256:createHash('sha256').update(bytes).digest('hex'),derivacao:{recorte:[x0,y0,x1,y1],tamanho:[w,h],filtro:'nearest',anchor:[0.5,1]}},null,2)+'\n');
const caminho='assets/manifest.json',texto=readFileSync(caminho,'utf8'),m=JSON.parse(texto);
if(m.assets.some(a=>a.tipo==='pilha'&&a.id==='fish'))throw Error('Pilha fish ja existe: nao sobrescrever');
const e={id:'fish',tipo:'pilha',footprint:[1,1],tamanho:[w,h],anchor:[0.5,1],estados:{unidade:derivado},licenca:'Arte OpenAI 2026-10-08',origem:{base,semente:null,nota:'Peixe pendurado da Bodega; registro e hash em base/fish-stock/geracao.json'}};
const inicio=texto.indexOf('[',texto.indexOf('"assets"'));let depth=0,quote=false,escape=false,fim=-1;
for(let i=inicio;i<texto.length;i++){const c=texto[i];if(quote){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c==='"')quote=false;continue;}if(c==='"'){quote=true;continue;}if(c==='[')depth++;if(c===']'&&--depth===0){fim=i;break;}}
if(fim<0)throw Error('Array assets nao encontrado');
writeFileSync(caminho,texto.slice(0,fim).trimEnd()+',\n    '+JSON.stringify(e)+'\n  '+texto.slice(fim));
