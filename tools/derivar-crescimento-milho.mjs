import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { decodePng, encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import { bleedRgba } from './png-bleed.mjs';

const raiz = resolve(process.argv[2]), saida = join(raiz, 'derivados');
mkdirSync(saida, { recursive: true });
const dados = JSON.parse(readFileSync('data/corn-crescimento-arte.json', 'utf8'));
const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8'));
const corn = manifesto.assets.find(a => a.id === 'corn' && a.tipo === 'recurso');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
function caixa(p, alfa = 1) {
  let x0 = p.width, y0 = p.height, x1 = -1, y1 = -1;
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
    if (p.data[(y * p.width + x) * 4 + 3] >= alfa) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) throw new Error('PNG vazio');
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
const adulta = caixa(decodePng(readFileSync(`assets/${corn.estados.presente}`)));
const geracoes = {
  semeado: 'exec-db9d7561-2462-4b18-80cc-dc0536972021',
  muda: 'exec-71dc8a0f-1456-40f2-a9cc-241df9e07610',
  verde: 'exec-0e3ea8d5-98ad-4aca-8900-426c9ca62b47',
};
const medidas = [];
for (const [estado, altura] of Object.entries(dados.alturas)) {
  const fonte = join(raiz, `${estado}-original.png`);
  const p = decodePng(readFileSync(fonte));
  for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3] === 0) p.data.fill(0, i, i + 4);
  const limpa = join(saida, `${estado}-limpo.png`);
  writeFileSync(limpa, encodePng(p));
  const visivel = caixa(p, 128), margem = dados.margemRecorte;
  const x0 = Math.max(0, visivel.x0 - margem), y0 = Math.max(0, visivel.y0 - margem);
  const x1 = Math.min(p.width - 1, visivel.x1 + margem), y1 = Math.min(p.height - 1, visivel.y1 + margem);
  const b = { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  const h = Math.min(altura, Math.floor((corn.tamanho[0] - 2 * dados.margemLateral) * b.h / b.w));
  const w = Math.round(b.w * h / b.h);
  const arquivos = [];
  for (const k of [1, 2]) {
    const arquivo = join(saida, `corn-${estado}-20261013${k === 2 ? '-master-2x' : ''}.png`);
    const filtro = `format=rgba,crop=${b.w}:${b.h}:${b.x0}:${b.y0},premultiply=inplace=1,scale=${w * k}:${h * k}:flags=lanczos,unpremultiply=inplace=1,pad=${corn.tamanho[0] * k}:${corn.tamanho[1] * k}:${Math.floor((corn.tamanho[0] - w) / 2) * k}:${(adulta.y1 + 1 - h) * k}:color=black@0,format=rgba`;
    const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', limpa, '-vf', filtro, '-frames:v', '1', arquivo], { encoding: 'utf8' });
    if (ff.status !== 0) throw new Error(ff.stderr);
    const out = decodePng(readFileSync(arquivo)), delta = (adulta.y1 + 1) * k - 1 - caixa(out).y1;
    if (delta !== 0) {
      const bytes = Buffer.alloc(out.data.length);
      for (let y = 0; y < out.height; y++) if (y + delta >= 0 && y + delta < out.height) {
        bytes.set(out.data.subarray(y * out.width * 4, (y + 1) * out.width * 4), (y + delta) * out.width * 4);
      }
      out.data = bytes;
    }
    writeFileSync(arquivo, encodePng(bleedRgba(out)));
    const final = decodePng(readFileSync(arquivo)), opaca = caixa(final, 128);
    arquivos.push({ arquivo, sha256: sha(arquivo), tamanho: [final.width, final.height], pe: caixa(final).y1, alturaOpaca: opaca.h });
  }
  medidas.push({ estado, fonte, sha256: sha(fonte), geracao: geracoes[estado], arquivos });
}
writeFileSync(join(saida, 'derivacao.json'), JSON.stringify({
  referencia: corn.origem.base, canvas: corn.tamanho, anchor: corn.anchor, pe: adulta.y1,
  preservados: Object.fromEntries(Object.entries(corn.estados).map(([e, p]) => [e, { arquivo: p, sha256: sha(`assets/${p}`) }])), medidas,
}, null, 2));
writeFileSync(join(saida, 'validacao-spec.json'), JSON.stringify({
  id: 'corn', kind: 'resource', mode: 'trial', frameSize: corn.tamanho, masterSize: corn.tamanho.map(n => n * 2),
  frames: medidas.map(m => ({ state: m.estado, direction: 'S', index: 0, pivot: corn.anchor, path: m.arquivos[0].arquivo, masterPath: m.arquivos[1].arquivo })),
}, null, 2));
