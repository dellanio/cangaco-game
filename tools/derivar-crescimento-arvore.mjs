import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { decodePng, encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import { ESTADOS_DE_CRESCIMENTO, escalaDoPlaceholder } from '../src/render/crescimento.ts';
import { bleedRgba } from './png-bleed.mjs';

const raiz = resolve(process.argv[2]);
const saida = resolve(process.argv[3]);
mkdirSync(saida, { recursive: true });
const m = JSON.parse(readFileSync('assets/manifest.json', 'utf8'));
const tree = m.assets.find(a => a.id === 'tree' && a.tipo === 'vegetacao');
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
function caixa(p) {
  let x0 = p.width, y0 = p.height, x1 = -1, y1 = -1;
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
    if (p.data[(y * p.width + x) * 4 + 3] > 0) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) throw new Error('Imagem vazia');
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
const adulta = caixa(decodePng(readFileSync(`assets/${tree.estados.presente}`)));
const medidas = [];
for (const estado of ESTADOS_DE_CRESCIMENTO) {
  const fonte = join(raiz, `${estado}-original.png`);
  const raw = decodePng(readFileSync(fonte));
  for (let i = 0; i < raw.data.length; i += 4) if (raw.data[i + 3] === 0) raw.data.fill(0, i, i + 4);
  const limpa = join(saida, `${estado}-rgba.png`);
  writeFileSync(limpa, encodePng(raw));
  const b = caixa(raw);
  const h = Math.min(Math.round(adulta.h * escalaDoPlaceholder(estado)),
    Math.floor((tree.tamanho[0] - 4) * b.h / b.w));
  const w = Math.round(b.w * h / b.h);
  const arquivos = [];
  for (const k of [1, 2]) {
    const arquivo = join(saida, `tree-${estado}-20261012${k === 2 ? '-master-2x' : ''}.png`);
    const filtro = `format=rgba,crop=${b.w}:${b.h}:${b.x0}:${b.y0},premultiply=inplace=1,scale=${w * k}:${h * k}:flags=lanczos,unpremultiply=inplace=1,pad=${tree.tamanho[0] * k}:${tree.tamanho[1] * k}:${Math.floor((tree.tamanho[0] - w) / 2) * k}:${(adulta.y1 + 1 - h) * k}:color=black@0,format=rgba`;
    const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', limpa, '-vf', filtro, '-frames:v', '1', arquivo], { encoding: 'utf8' });
    if (ff.status !== 0) throw new Error(ff.stderr);
    const p = decodePng(readFileSync(arquivo));
    const pe = (adulta.y1 + 1) * k - 1;
    const delta = pe - caixa(p).y1;
    if (delta !== 0) {
      const dados = Buffer.alloc(p.data.length);
      for (let y = 0; y < p.height; y++) {
        const alvo = y + delta;
        if (alvo >= 0 && alvo < p.height) dados.set(p.data.subarray(y * p.width * 4, (y + 1) * p.width * 4), alvo * p.width * 4);
      }
      p.data = dados;
      writeFileSync(arquivo, encodePng(p));
    }
    writeFileSync(arquivo, encodePng(bleedRgba(p)));
    const final = caixa(decodePng(readFileSync(arquivo)));
    arquivos.push({ arquivo, tamanho: [p.width, p.height], pe: final.y1, altura: final.h, sha256: sha(arquivo) });
  }
  medidas.push({ estado, fonte, sha256: sha(fonte), arquivos });
}
writeFileSync(join(saida, 'derivacao.json'), JSON.stringify({
  referencia: tree.origem.base, anchor: tree.anchor, canvas: tree.tamanho, pe: adulta.y1,
  preservados: Object.fromEntries(Object.entries(tree.estados)
    .filter(([e]) => !ESTADOS_DE_CRESCIMENTO.some(s => s === e))
    .map(([e, p]) => [e, { arquivo: p, sha256: sha(`assets/${p}`) }])),
  medidas,
}, null, 2) + '\n');
