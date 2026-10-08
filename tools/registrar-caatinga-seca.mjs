import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePng,encodePng} from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
const pares=JSON.parse(readFileSync('data/caatinga-arte.json','utf8')).pares;
const caminho='assets/manifest.json', texto=readFileSync(caminho,'utf8'), manifesto=JSON.parse(texto);
function caixa(p,limite=1){let x0=p.width,y0=p.height,x1=-1,y1=-1;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3]>=limite){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}if(x1<0)throw Error('PNG vazio');return {x0,y0,x1,y1};}
const alteradas=new Map();
for(const par of pares){
  const pasta=`base/${par.id}-seca`,base=`${pasta}/original-20261008.png`,inverno=`${pasta}/inverno.png`,derivado=`sprites/vegetation/${par.id}-seca-20261008.png`;
  const original=readFileSync(`assets/${base}`),p=decodePng(original),frioBytes=readFileSync(`assets/${par.inverno}`),frio=decodePng(frioBytes),alvo=caixa(frio),fonte=caixa(p,128);
  const dw=alvo.x1-alvo.x0+1,dh=alvo.y1-alvo.y0+1,sw=fonte.x1-fonte.x0+1,sh=fonte.y1-fonte.y0+1,data=new Uint8Array(frio.width*frio.height*4);
  // Reamostragem por maior alfa conserva os galhos finos e a linha de contato.
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
    let escolhido=-1,alfa=-1;
    const xa=fonte.x0+Math.floor(x*sw/dw),xb=Math.min(fonte.x1,fonte.x0+Math.ceil((x+1)*sw/dw)-1);
    const ya=fonte.y0+Math.floor(y*sh/dh),yb=Math.min(fonte.y1,fonte.y0+Math.ceil((y+1)*sh/dh)-1);
    for(let sy=ya;sy<=yb;sy++)for(let sx=xa;sx<=xb;sx++){const i=(sy*p.width+sx)*4;if(p.data[i+3]>alfa){escolhido=i;alfa=p.data[i+3];}}
    if(escolhido>=0)data.set(p.data.subarray(escolhido,escolhido+4),((alvo.y0+y)*frio.width+alvo.x0+x)*4);
  }
  const seco={width:frio.width,height:frio.height,data};
  if(caixa(seco).y1!==alvo.y1)throw Error(`${par.id}: pe mudou`);
  writeFileSync(`assets/${derivado}`,encodePng(seco));
  writeFileSync(`assets/${inverno}`,frioBytes);
  const hash=b=>createHash('sha256').update(b).digest('hex');
  writeFileSync(`assets/${pasta}/geracao.json`,JSON.stringify({data:'2026-10-08',ferramenta:'OpenAI image_gen',geracao:par.geracao,geracaoAnteriorReprovada:par.geracaoAnteriorReprovada,baseDoInverno:inverno,arquivoDoInverno:par.inverno,sha256Inverno:hash(frioBytes),sha256:hash(original),licenca:'Arte OpenAI 2026-10-08',promptResumo:par.promptResumo??'Par da seca do mesmo desenho; cactos palidos, macambira avermelhada, arvores sem folhas e galhos cinza; luz superior ligeiramente sul sem eixo leste-oeste.',derivacao:{tamanho:[frio.width,frio.height],caixaInverno:alvo,caixaGeracao:fonte,filtro:'maior alfa por area',anchor:[0.5,1],pe:alvo.y1}},null,2)+'\n');
  let entrada=manifesto.assets.find(a=>a.tipo==='vegetacao'&&a.id===par.entrada);
  if(!entrada)throw Error(`Vegetacao inexistente no manifesto: ${par.entrada}`);
  const estado=par.estado==='presente'?'seca':`seca:${par.estado}`;
  if(!entrada.origem.nota.includes('Pares da seca em base/')) entrada.origem.nota+=' Pares da seca em base/<especie>-seca/geracao.json, com origem apontando a copia versionada do inverno e SHA256. Seis estados OpenAI 2026-10-08; mesma linha do pe e quadro.';
  entrada.estados[estado]=derivado;alteradas.set(entrada.id,entrada);
}
// Substitui apenas entradas de vegetacao alteradas, conservando o restante do manifesto.
const inicio=texto.indexOf('[',texto.indexOf('"assets"'));let depth=0,quote=false,escape=false,abertura=-1,fim=-1;const spans=[];
for(let i=inicio;i<texto.length;i++){const c=texto[i];if(quote){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c==='"')quote=false;continue;}if(c==='"'){quote=true;continue;}if(c==='{'){if(depth===0)abertura=i;depth++;}if(c==='}'){depth--;if(depth===0)spans.push([abertura,i+1]);}if(c===']'&&depth===0){fim=i;break;}}
let resultado=texto;
for(const [a,b] of spans.reverse()){const e=JSON.parse(texto.slice(a,b));if(e.tipo==='vegetacao'&&alteradas.has(e.id)){const novo=JSON.stringify(alteradas.get(e.id));resultado=resultado.slice(0,a)+novo+resultado.slice(b);fim+=novo.length-(b-a);alteradas.delete(e.id);}}
if(alteradas.size){if(fim<0)throw Error('Fecho de assets nao encontrado');resultado=resultado.slice(0,fim).trimEnd()+',\n    '+[...alteradas.values()].map(e=>JSON.stringify(e)).join(',\n    ')+'\n  '+resultado.slice(fim);}
const conferido=JSON.parse(resultado);
if(conferido.assets.some(a=>a.footprint.some(n=>typeof n!=='number')))throw Error('Footprint corrompido');
writeFileSync(caminho,resultado);
