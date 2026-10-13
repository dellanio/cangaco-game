import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import process from 'node:process';

const raiz = resolve(process.argv[2]), derivados = join(raiz, 'derivados');
const base = 'base/corn/crescimento', sprites = 'sprites/resources';
mkdirSync(`assets/${base}`, { recursive: true });
const meta = JSON.parse(readFileSync(join(derivados, 'derivacao.json'), 'utf8'));
const fonteManifesto = readFileSync('assets/manifest.json', 'utf8');
const manifesto = JSON.parse(fonteManifesto);
const corn = manifesto.assets.find(a => a.tipo === 'recurso' && a.id === 'corn');
for (const medida of meta.medidas) {
  const fonte = `${base}/${medida.estado}-original.png`;
  copyFileSync(medida.fonte, `assets/${fonte}`);
  medida.fonte = fonte;
  for (const [i, arquivo] of medida.arquivos.entries()) {
    const relativo = `${i === 0 ? sprites : base}/${basename(arquivo.arquivo)}`;
    copyFileSync(arquivo.arquivo, `assets/${relativo}`);
    arquivo.arquivo = relativo;
  }
  corn.estados[medida.estado] = medida.arquivos[0].arquivo;
}
meta.referenciaDeEstilo = 'base/bakery/madeira-original-20261012.png';
meta.licenca = 'arte propria gerada por imagegen nativo';
meta.nota = 'Maduro preservado; originais juvenis transparentes. Padaria usada apenas como estilo, sem reutilizar objetos. Recorte pela caixa alfa128 com margem do dado; premultiplicacao e RGB bleed na reducao.';
writeFileSync(`assets/${base}/derivacao.json`, JSON.stringify(meta, null, 2) + '\n');
const spec = JSON.parse(readFileSync(join(derivados, 'validacao-spec.json'), 'utf8'));
spec.frames = meta.medidas.map(m => ({ state: m.estado, direction: 'S', index: 0, pivot: meta.anchor,
  path: `assets/${m.arquivos[0].arquivo}`, masterPath: `assets/${m.arquivos[1].arquivo}` }));
writeFileSync(`assets/${base}/validacao-spec.json`, JSON.stringify(spec, null, 2) + '\n');
copyFileSync(join(raiz, 'validacao/report.json'), `assets/${base}/validacao-tecnica.json`);
corn.origem.crescimento = `${base}/derivacao.json`;
// Altera só a entrada corn, preservando o formato e bytes de todas as demais.
const id = fonteManifesto.indexOf('"id": "corn"');
if (id < 0) throw new Error('Entrada corn ausente');
const inicio = fonteManifesto.lastIndexOf('{', id);
let nivel = 0, texto = false, escape = false, fim = inicio;
for (; fim < fonteManifesto.length; fim++) {
  const c = fonteManifesto[fim];
  if (texto) {
    if (escape) escape = false;
    else if (c === '\\') escape = true;
    else if (c === '"') texto = false;
  } else if (c === '"') texto = true;
  else if (c === '{') nivel++;
  else if (c === '}' && --nivel === 0) { fim++; break; }
}
const indent = fonteManifesto.slice(fonteManifesto.lastIndexOf('\n', inicio) + 1, inicio);
const trecho = JSON.stringify(corn, null, 2).split('\n').join(`\n${indent}`);
writeFileSync('assets/manifest.json', fonteManifesto.slice(0, inicio) + trecho + fonteManifesto.slice(fim));
