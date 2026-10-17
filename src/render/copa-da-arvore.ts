/**
 * I-TELA-VENTO-SO-NA-COPA (pedido do operador, 2026-10-17) — a copa de uma arvore: os pixels de folha, lidos da propria
 * arte, para o vento mexer so ela, e nao a arvore inteira. Pura e sem `phaser`.
 *
 * Folha e o pixel verde (matiz entre `MATIZ_MINIMO` e `MATIZ_MAXIMO`, saturado e com luz); o contorno escuro e o miolo
 * apagado da folhagem entram com a copa quando a maioria dos vizinhos (5x5) e folha. O tronco, cinza e marrom, fica fora.
 */
export interface ImagemRgba { readonly width: number; readonly height: number; readonly data: ArrayLike<number> }
export interface CopaDaArvore {
  /** 1 no pixel da copa */
  readonly mascara: Uint8Array;
  readonly pixels: number;
  /** o pivo do giro, em px da textura: o meio da base da copa (a linha mais baixa com folha) */
  readonly pivo: { readonly x: number; readonly y: number };
}

const MATIZ_MINIMO = 45;
const MATIZ_MAXIMO = 170;
const SATURACAO_MINIMA = 0.2;
const LUZ_MINIMA = 40;
const ALFA_MINIMO = 40;

function ehFolha(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (max < LUZ_MINIMA || d / max < SATURACAO_MINIMA) return false;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const matiz = (h * 60 + 360) % 360;
  return matiz >= MATIZ_MINIMO && matiz <= MATIZ_MAXIMO;
}

export function copaDaArvore(img: ImagemRgba): CopaDaArvore {
  const { width: w, height: h } = img;
  const folha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (img.data[i * 4 + 3]! >= ALFA_MINIMO && ehFolha(img.data[i * 4]!, img.data[i * 4 + 1]!, img.data[i * 4 + 2]!)) folha[i] = 1;
  }
  const mascara = Uint8Array.from(folha);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (folha[i] === 1 || img.data[i * 4 + 3]! < ALFA_MINIMO) continue;
    let n = 0, total = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || img.data[(yy * w + xx) * 4 + 3]! < ALFA_MINIMO) continue;
      total++; n += folha[yy * w + xx]!;
    }
    if (total > 0 && n * 2 > total) mascara[i] = 1;
  }
  let pixels = 0, base = -1, x0 = w, x1 = -1;
  for (let i = 0; i < w * h; i++) if (mascara[i] === 1) {
    pixels++;
    const x = i % w, y = Math.floor(i / w);
    base = Math.max(base, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x);
  }
  return { mascara, pixels, pivo: pixels === 0 ? { x: w / 2, y: h } : { x: (x0 + x1) / 2, y: base } };
}
