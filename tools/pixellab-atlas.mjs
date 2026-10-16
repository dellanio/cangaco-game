// I-ARTE-SERF-PIXELLAB-V2 — do personagem do PixelLab para o atlas do jogo, sem mudar o carregador.
// Uso: node tools/pixellab-atlas.mjs <tipo> <pasta-dos-quadros> [largura altura] [--manter <atlas-de-antes.json>]
// A pasta tem <anim>/<direcao-do-pixellab>/<i>.png (south, south-east, east, north-east, north). Grava em
// assets/sprites/units/<tipo>/: o atlas <tipo>.png + <tipo>.json (8 quadros por linha, chaves <tipo>/<anim>/<dir>/<nnnn>
// com as direcoes do jogo n, ne, l, se, s) e o parado.png (o parado de frente, o fallback do manifesto). Quadro de outro
// tamanho e centrado em x com o pe na mesma linha de baixo; nada e reamostrado (pixel art).
// I-ARTE-UNIDADES-PIXELLAB-V2: com --manter, as animacoes do atlas de antes que a pasta nao traz (trabalhar, atacar...)
// entram como estavam, quadro a quadro; e um `morrer` com menos de 12 quadros e completado no contrato da
// G-ARTE-MORTE-DAS-UNIDADES: o ultimo quadro parado e depois esmaecendo.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { decodePng, encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

const DIRECOES = { north: 'n', 'north-east': 'ne', east: 'l', 'south-east': 'se', south: 's' };
const POR_LINHA = 8;

const argv = process.argv.slice(2);
const iManter = argv.indexOf('--manter');
const manter = iManter >= 0 ? argv.splice(iManter, 2)[1] : null;
const [tipo, pasta, larguraTexto = '64', alturaTexto = '96'] = argv;
const QUADROS_DA_MORTE = 12;
const ESMAECER = [1, 0.75, 0.5, 0.3, 0.15];
const L = Number(larguraTexto), A = Number(alturaTexto);
const animacoes = readdirSync(pasta).filter((a) => existsSync(join(pasta, a, 'south'))).sort();

function noQuadro(img) {
  const out = { width: L, height: A, data: new Uint8Array(L * A * 4) };
  // a linha do pe: a ultima linha com alfa, posta a 6 px da borda de baixo, como no serf de hoje
  let pe = -1;
  for (let y = img.height - 1; y >= 0 && pe < 0; y--) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] > 40) { pe = y; break; }
  const dy = (A - 6) - pe;
  const dx = Math.round((L - img.width) / 2);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const ty = y + dy, tx = x + dx;
    if (ty < 0 || ty >= A || tx < 0 || tx >= L) continue;
    const i = (y * img.width + x) * 4;
    out.data.set(img.data.subarray(i, i + 4), (ty * L + tx) * 4);
  }
  return { img: out, pe };
}

const quadros = [];
const contagem = {};
/** quadros gerados por animacao, iguais em todas as direcoes (a morte completada nao entra aqui) */
const geradas = {};
/** quadros ja prontos (do atlas de antes ou completados), pela chave */
const prontos = {};
for (const anim of animacoes) for (const [dirPixellab, dir] of Object.entries(DIRECOES)) {
  const p = join(pasta, anim, dirPixellab);
  if (!existsSync(p)) throw new Error(`${anim}: falta a direcao ${dirPixellab}`);
  const arquivos = readdirSync(p).filter((f) => f.endsWith('.png')).sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0]));
  geradas[anim] = geradas[anim] ?? arquivos.length;
  if (geradas[anim] !== arquivos.length) throw new Error(`${anim}: ${dirPixellab} tem ${arquivos.length} quadros, as outras ${geradas[anim]}`);
  contagem[anim] = arquivos.length;
  arquivos.forEach((f, i) => quadros.push({ chave: `${tipo}/${anim}/${dir}/${String(i).padStart(4, '0')}`, caminho: join(p, f) }));
  if (anim === 'morrer' && arquivos.length < QUADROS_DA_MORTE) {
    const ultimo = noQuadro(decodePng(readFileSync(join(p, arquivos[arquivos.length - 1])))).img;
    for (let i = arquivos.length; i < QUADROS_DA_MORTE; i++) {
      const f = ESMAECER[Math.min(ESMAECER.length - 1, Math.max(0, i - (QUADROS_DA_MORTE - ESMAECER.length)))];
      const img = { width: ultimo.width, height: ultimo.height, data: Uint8Array.from(ultimo.data) };
      for (let k = 3; k < img.data.length; k += 4) img.data[k] = Math.round(img.data[k] * f);
      const chave = `${tipo}/${anim}/${dir}/${String(i).padStart(4, '0')}`;
      prontos[chave] = img;
      quadros.push({ chave });
    }
    contagem[anim] = QUADROS_DA_MORTE;
  }
}
if (manter !== null) {
  const antes = JSON.parse(readFileSync(manter, 'utf8'));
  const imagemDeAntes = decodePng(readFileSync(join(manter, '..', antes.meta.image)));
  for (const [chave, q] of Object.entries(antes.frames)) {
    const anim = chave.split('/')[1];
    if (animacoes.includes(anim)) continue;
    const { x, y, w, h } = q.frame;
    const img = { width: w, height: h, data: new Uint8Array(w * h * 4) };
    for (let r = 0; r < h; r++) img.data.set(imagemDeAntes.data.subarray(((y + r) * imagemDeAntes.width + x) * 4, ((y + r) * imagemDeAntes.width + x + w) * 4), r * w * 4);
    prontos[chave] = img;
    quadros.push({ chave });
    contagem[anim] = (contagem[anim] ?? 0) + (chave.split('/')[2] === 's' ? 1 : 0);
  }
}
const linhas = Math.ceil(quadros.length / POR_LINHA);
const atlas = { width: L * POR_LINHA, height: A * linhas, data: new Uint8Array(L * POR_LINHA * A * linhas * 4) };
const frames = {};
quadros.forEach((q, n) => {
  const img = prontos[q.chave] ?? noQuadro(decodePng(readFileSync(q.caminho))).img;
  const x = (n % POR_LINHA) * L, y = Math.floor(n / POR_LINHA) * A;
  for (let r = 0; r < A; r++) atlas.data.set(img.data.subarray(r * L * 4, (r + 1) * L * 4), ((y + r) * atlas.width + x) * 4);
  frames[q.chave] = { frame: { x, y, w: L, h: A }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: L, h: A }, sourceSize: { w: L, h: A } };
  if (q.chave === `${tipo}/parado/s/0000`) {
    mkdirSync(`assets/sprites/units/${tipo}`, { recursive: true });
    writeFileSync(`assets/sprites/units/${tipo}/parado.png`, encodePng(img));
  }
});
const destino = `assets/sprites/units/${tipo}`;
mkdirSync(destino, { recursive: true });
writeFileSync(join(destino, `${tipo}.png`), encodePng(atlas));
writeFileSync(join(destino, `${tipo}.json`), `${JSON.stringify({ frames, meta: { image: `${tipo}.png`, size: { w: atlas.width, h: atlas.height }, scale: '1' } }, null, 1)}\n`);
console.log(`${tipo}: ${quadros.length} quadros (${Object.entries(contagem).map(([a, n]) => `${a} ${n}`).join(', ')}), atlas ${atlas.width}x${atlas.height}`);
