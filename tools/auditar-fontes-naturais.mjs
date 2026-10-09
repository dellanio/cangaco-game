import {readFileSync,writeFileSync} from 'node:fs';
import process from 'node:process';
import console from 'node:console';
import {createHash} from 'node:crypto';
import {decodePng} from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import {validateSpriteSpec} from '../skills/pianco-sprite-tools/scripts/validate-sprites.mjs';
const manifesto=JSON.parse(readFileSync('assets/manifest.json','utf8'));
const recursos=JSON.parse(readFileSync('data/resources.json','utf8'));
const fontes=[];
for(const id of Object.keys(recursos.tipos)){
  const entrada=manifesto.assets.find(a=>a.id===id&&['recurso','vegetacao'].includes(a.tipo));
  if(!entrada)throw new Error(`Fonte sem manifesto: ${id}`);
  const estados=[];
  for(const [estado,path]of Object.entries(entrada.estados)){
    const bytes=readFileSync(`assets/${path}`),png=decodePng(bytes);
    let pe=-1;for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++)if(png.data[(y*png.width+x)*4+3]>0)pe=y;
    // Diagnostico da superficie/luz/borda; nao certifica master nem paleta de arte legada.
    const report=validateSpriteSpec({id:`auditoria-${id}`,kind:'resource',mode:'trial',frameSize:entrada.tamanho,masterSize:entrada.tamanho.map(n=>n*2),frames:[{state:estado,direction:'front',index:0,path:`assets/${path}`,pivot:entrada.anchor}]});
    estados.push({estado,path,tamanho:[png.width,png.height],pe,sha256:createHash('sha256').update(bytes).digest('hex'),erros:report.errors});
  }
  fontes.push({id,categoria:['corn','grapes'].includes(id)?'cultivo':'natural',tipo:entrada.tipo,footprint:entrada.footprint,anchor:entrada.anchor,origem:entrada.origem,estados});
}
const destino=process.argv[2]??'test-output/fontes-naturais-inventario.json';
writeFileSync(destino,JSON.stringify({doc:'Diagnostico sem alterar ativos; arte nova precisa validar integralmente.',fontes},null,2)+'\n');
console.log(JSON.stringify(fontes.map(f=>({id:f.id,estados:f.estados.length,erros:f.estados.flatMap(e=>e.erros).reduce((a,e)=>({...a,[e.code]:(a[e.code]??0)+1}),{})})),null,2));
