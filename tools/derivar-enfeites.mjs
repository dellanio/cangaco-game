import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { decodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

const raiz = 'D:/projetos-pessoal/cangaco-game-candidatos/arte/sertao-mapa';
const ids = ['stick_fence', 'well', 'ox_cart', 'drying_rack', 'firewood', 'ox_bones', 'roadside_cross', 'flat_slab'];
const assuntos = ['cerca de vara reta', 'cacimba de pedra', 'carro de boi vazio', 'varal de carne de sol', 'pilha de lenha', 'ossada de boi', 'cruz de beira de estrada', 'lajedo baixo'];
const textoManifesto = readFileSync('assets/manifest.json', 'utf8');
const manifesto = JSON.parse(textoManifesto);
const novos = [];
const registro = JSON.parse(readFileSync('assets/base/sertao-mapa-geracao.json', 'utf8'));
registro.itens = [];
for (const [i, id] of ids.entries()) {
  const fonte = `${raiz}/${id}/generation-01.png`;
  const base = `base/${id}/original.png`;
  const derivado = `sprites/props/${id}/normal.png`;
  mkdirSync(`assets/base/${id}`, { recursive: true });
  mkdirSync(`assets/sprites/props/${id}`, { recursive: true });
  copyFileSync(fonte, `assets/${base}`);
  const png = decodePng(readFileSync(fonte));
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    if (png.data[(y * png.width + x) * 4 + 3] > 0) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (x1 < x0) throw new Error(`${id}: PNG vazio`);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const fator = 60 / Math.max(w, h);
  const dw = Math.max(1, Math.round(w * fator)), dh = Math.max(1, Math.round(h * fator));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', fonte, '-vf',
    `crop=${w}:${h}:${x0}:${y0},scale=${dw}:${dh}:flags=lanczos,pad=64:64:${Math.floor((64-dw)/2)}:${64-dh}:color=0x00000000,format=rgba`,
    '-frames:v', '1', `assets/${derivado}`]);
  const hash = createHash('sha256').update(readFileSync(fonte)).digest('hex');
  const origem = { base, semente: null, nota: `OpenAI image_gen; SHA256 ${hash}; contrato e prompt em base/sertao-mapa-geracao.json. Homologacao pendente.` };
  const entrada = { id, tipo: 'enfeite', footprint: [1,1], tamanho: [64,64], anchor: [0.5,1], estados: { normal: derivado }, licenca: 'Arte original gerada por OpenAI para o projeto Pianco', origem };
  if (manifesto.assets.some(a => a.id === id && a.tipo === 'enfeite')) throw new Error(`${id} ja registrado`);
  manifesto.assets.push(entrada);
  novos.push(entrada);
  registro.itens.push({ id, assunto: assuntos[i], fonte, hash, base, derivado, crop: [x0,y0,w,h], ferramenta: 'OpenAI image_gen nativa; ffmpeg Lanczos para derivacao', resultado: 'Candidata integrada para homologacao', proximoPasso: 'Prancha e homologacao do operador' });
}
// Preserva byte a byte todas as entradas antigas, inclusive seu formato.
const inicio = textoManifesto.indexOf('[', textoManifesto.indexOf('"assets"'));
let profundidade = 0, emString = false, escape = false, fim = -1;
for (let p = inicio; p < textoManifesto.length; p++) {
  const c = textoManifesto[p];
  if (emString) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === '"') emString = false; continue; }
  if (c === '"') emString = true;
  else if (c === '[') profundidade++;
  else if (c === ']' && --profundidade === 0) { fim = p; break; }
}
if (fim < 0) throw new Error('Array assets nao encontrado');
const antes = textoManifesto.slice(0, fim).trimEnd();
writeFileSync('assets/manifest.json', antes + ',\n' + novos.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ' + textoManifesto.slice(fim));
writeFileSync('assets/base/sertao-mapa-geracao.json', JSON.stringify(registro, null, 2) + '\n');
