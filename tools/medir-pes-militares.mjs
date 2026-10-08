import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {log} from 'node:console';
import {decodePng} from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
const m=JSON.parse(readFileSync('assets/manifest.json','utf8'));
const tema=JSON.parse(readFileSync('data/theme-sertao.json','utf8'));
const config=JSON.parse(readFileSync('data/selecao-visual.json','utf8'));
const ids=new Set([...Object.keys(tema.militares),...Object.keys(tema.mercenarios)]);
const porQuadro={},fontes=[];
for(const e of m.assets.filter(e=>e.tipo==='unidade'&&ids.has(e.id)&&typeof e.atlas==='string')){
  const arquivo=`assets/${e.atlas}`,atlas=JSON.parse(readFileSync(arquivo,'utf8'));
  const imagem=join(dirname(arquivo),atlas.meta.image).replaceAll('\\','/');
  const bytes=readFileSync(imagem),png=decodePng(bytes);
  fontes.push({id:e.id,atlas:arquivo,imagem,sha256:createHash('sha256').update(bytes).digest('hex')});
  for(const [nome,d] of Object.entries(atlas.frames)){
    const f=d.frame;let linha=-1;
    for(let y=f.h-1;y>=0&&linha<0;y--)for(let x=0;x<f.w;x++)if(png.data[((f.y+y)*png.width+f.x+x)*4+3]>=config.alphaOpaco){linha=y;break;}
    if(nome in porQuadro)throw Error(`Quadro duplicado: ${nome}`);
    porQuadro[nome]={recuoInferiorPx:linha<0?0:f.h-linha-1,alturaDoQuadro:f.h};
  }
}
if(fontes.length!==ids.size)throw Error(`Faltam atlases militares: ${fontes.length}/${ids.size}`);
writeFileSync('data/pes-dos-militares.json',JSON.stringify({_doc:'Medicoes deterministicas de PNG por quadro; regenerar com node tools/medir-pes-militares.mjs depois de trocar arte militar.',fontes,porQuadro},null,2)+'\n');
log(`${fontes.length} militares, ${Object.keys(porQuadro).length} quadros medidos`);
