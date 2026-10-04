/**
 * Decodificador PNG minimo para os testes de arte (Fase G): RGBA ou RGB de 8 bits, sem entrelacamento,
 * que e o que o PIL grava. Sem dependencia nova: so `node:zlib`. Le pixel, nao texto.
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export interface Imagem { readonly largura: number; readonly altura: number; readonly rgba: Uint8Array }

export function lerPng(caminho: string): Imagem {
  const b = readFileSync(caminho);
  let pos = 8; let largura = 0; let altura = 0; let tipoCor = 0; let prof = 0; const idat: Buffer[] = [];
  while (pos < b.length) {
    const tam = b.readUInt32BE(pos); const tipo = b.toString('ascii', pos + 4, pos + 8); const dado = b.subarray(pos + 8, pos + 8 + tam);
    if (tipo === 'IHDR') { largura = dado.readUInt32BE(0); altura = dado.readUInt32BE(4); prof = dado[8]!; tipoCor = dado[9]!; }
    if (tipo === 'IDAT') idat.push(dado);
    pos += 12 + tam;
  }
  if (prof !== 8 || (tipoCor !== 6 && tipoCor !== 2)) throw new Error(`${caminho}: so RGB/RGBA de 8 bits (prof ${prof}, cor ${tipoCor})`);
  const bpp = tipoCor === 6 ? 4 : 3;
  const cru = inflateSync(Buffer.concat(idat)); const linha = largura * bpp; const px = new Uint8Array(linha * altura);
  for (let y = 0; y < altura; y++) {
    const filtro = cru[y * (linha + 1)]!; const ini = y * (linha + 1) + 1;
    for (let x = 0; x < linha; x++) {
      const v = cru[ini + x]!; const a = x >= bpp ? px[y * linha + x - bpp]! : 0; const c = y > 0 ? px[(y - 1) * linha + x]! : 0;
      const ac = x >= bpp && y > 0 ? px[(y - 1) * linha + x - bpp]! : 0;
      const p = a + c - ac; const pa = Math.abs(p - a); const pb = Math.abs(p - c); const pc = Math.abs(p - ac);
      const pred = filtro === 0 ? 0 : filtro === 1 ? a : filtro === 2 ? c : filtro === 3 ? (a + c) >> 1
        : pa <= pb && pa <= pc ? a : pb <= pc ? c : ac;
      px[y * linha + x] = (v + pred) & 255;
    }
  }
  if (bpp === 4) return { largura, altura, rgba: px };
  const rgba = new Uint8Array(largura * altura * 4);
  for (let i = 0; i < largura * altura; i++) { rgba.set(px.subarray(i * 3, i * 3 + 3), i * 4); rgba[i * 4 + 3] = 255; }
  return { largura, altura, rgba };
}

export interface Retangulo { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export function alfa(img: Imagem, x: number, y: number): number { return img.rgba[(y * img.largura + x) * 4 + 3]!; }

/** Caixa dos pixels opacos (alfa > 128) dentro do retangulo, em coordenadas do retangulo. */
export function caixaOpaca(img: Imagem, r: Retangulo): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    if (alfa(img, r.x + x, r.y + y) > 128) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
