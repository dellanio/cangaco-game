import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {decodePng} from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
const texto=readFileSync('assets/manifest.json','utf8');
const m=JSON.parse(texto);
for(const id of ['woodcutters','quarry','church']) {
  const e=m.assets.find(a=>a.id===id&&a.tipo==='predio');
  const fonte=e.estados.completo;
  const png=decodePng(readFileSync(`assets/${fonte}`));
  let x0=png.width,y0=png.height,x1=-1,y1=-1;
  for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++)if(png.data[(y*png.width+x)*4+3]>16){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  const lado=m.icones.predios[id]?.tamanho[0]??m.icones.predios.quarry.tamanho[0];
  const w=x1-x0+1,h=y1-y0+1,f=lado/Math.max(w,h),dw=Math.round(w*f),dh=Math.round(h*f);
  const arquivo=`sprites/${id}/icone-atual.png`;
  mkdirSync(`assets/sprites/${id}`,{recursive:true});
  execFileSync('ffmpeg',['-y','-loglevel','error','-i',`assets/${fonte}`,'-vf',`crop=${w}:${h}:${x0}:${y0},scale=${dw}:${dh}:flags=lanczos,pad=${lado}:${lado}:${Math.floor((lado-dw)/2)}:${Math.floor((lado-dh)/2)}:color=0x00000000,format=rgba`,'-frames:v','1',`assets/${arquivo}`]);
  m.icones.predios[id]={arquivo,tamanho:[lado,lado],licenca:e.licenca,origem:{base:e.origem.base,semente:e.origem.semente,fonteCompleta:fonte,sha256:createHash('sha256').update(readFileSync(`assets/${fonte}`)).digest('hex'),nota:'Derivado do completo ATUAL por tools/atualizar-icones-completos.mjs'}};
}
const inicio=texto.indexOf('{',texto.indexOf('"predios":',texto.indexOf('"icones":')));
let depth=0,quote=false,escape=false,fim=-1;
for(let p=inicio;p<texto.length;p++){const c=texto[p];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}if(c==='"')quote=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){fim=p;break;}}
if(fim<0)throw Error('icones.predios');
writeFileSync('assets/manifest.json',texto.slice(0,inicio)+JSON.stringify(m.icones.predios,null,2)+texto.slice(fim+1));
