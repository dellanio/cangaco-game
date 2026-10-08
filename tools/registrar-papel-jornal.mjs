import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const caminho='assets/manifest.json',texto=readFileSync(caminho,'utf8');
const m=JSON.parse(texto);
const base='base/newspaper_paper/original.png',derivado='sprites/ui/newspaper_paper/normal.png';
const sha256=createHash('sha256').update(readFileSync(`assets/${base}`)).digest('hex');
const e={id:'newspaper_paper',tipo:'interface',footprint:[1,1],tamanho:[768,512],anchor:[0.5,0.5],estados:{normal:derivado},licenca:'Arte original gerada por OpenAI para Pianco',origem:{base,semente:null,nota:`OpenAI image_gen nativa, geracao exec-2625a7f6-8dcf-4e18-b58a-a379a5c46f41, SHA256 ${sha256}. Prompt em base/newspaper_paper/geracao.json`}};
if(m.assets.some(a=>a.id===e.id))throw Error('Papel ja registrado');
const inicio=texto.indexOf('[',texto.indexOf('"assets"'));let depth=0,quote=false,escape=false,fim=-1;
for(let p=inicio;p<texto.length;p++){const c=texto[p];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}if(c==='"')quote=true;else if(c==='[')depth++;else if(c===']'&&--depth===0){fim=p;break;}}
if(fim<0)throw Error('assets');
writeFileSync(caminho,texto.slice(0,fim).trimEnd()+',\n    '+JSON.stringify(e)+'\n  '+texto.slice(fim));
writeFileSync('assets/base/newspaper_paper/geracao.json',JSON.stringify({ferramenta:'image_gen nativa',sha256,prompt:'Original landscape flat opaque old newspaper paper texture for Brazilian sertao 1930 UI; warm yellowed cream cellulose fibers, soft age mottling and subtle fold creases; quiet bright central reading area; worn edges; no text, illustrations, watermarks, scene or perspective; diffuse light without east-west direction',derivacao:'ffmpeg Lanczos 768x512',homologacao:'Pendente do operador'},null,2));
