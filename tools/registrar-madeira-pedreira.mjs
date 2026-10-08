import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const arquivo='assets/manifest.json';
let texto=readFileSync(arquivo,'utf8');
const e=JSON.parse(texto).assets.find(a=>a.id==='quarry');
const base='base/quarry/quarry-madeira-20261007-original.png';
const derivado='sprites/quarry/quarry_madeira-D-20261007.png';
const sha256=createHash('sha256').update(readFileSync(`assets/${base}`)).digest('hex');
const registro={id:'quarry',estado:'madeira',base,derivado,sha256,referencia:e.estados.completo,
  ferramenta:'image_gen nativa',chamadas:1,limiteDeChamadas:1,
  geracao:'exec-0692fcb5-a803-4ad2-809d-5735d4f7dac8',
  prompt:readFileSync('test-output/quarry-madeira-prompt.txt','utf8'),
  licenca:'Arte original do projeto, geracao nativa autorizada pelo operador em 2026-10-07',
  homologacao:'aguardando operador'};
if(e.estados.madeira===derivado)throw Error('Estado ja registrado');
texto=texto.replace(e.estados.madeira,derivado);
const nota=e.origem.nota+` Madeira atual derivada da referencia completa em 2026-10-07; base ${base}, SHA256 ${sha256}, registro em base/quarry/quarry-madeira-20261007-geracao.json.`;
if(!texto.includes(JSON.stringify(e.origem.nota)))throw Error('Nota original nao encontrada');
texto=texto.replace(JSON.stringify(e.origem.nota),JSON.stringify(nota));
writeFileSync('assets/base/quarry/quarry-madeira-20261007-geracao.json',JSON.stringify(registro,null,2)+'\n');
writeFileSync(arquivo,texto);
