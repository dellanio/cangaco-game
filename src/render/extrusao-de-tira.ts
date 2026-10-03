/** Dado de tela: dois pixels da propria borda protegem o filtro linear nos zooms
 * fracionarios. Nao muda o tamanho do tile no mundo nem os indices da tira. */
export const EXTRUSAO_DA_TIRA = 2;
export const MARGEM_DA_TIRA = EXTRUSAO_DA_TIRA;
export const ESPACAMENTO_DA_TIRA = 2 * EXTRUSAO_DA_TIRA;

export interface TiraExtrudada {
  readonly pixels: Uint8ClampedArray;
  readonly largura: number;
  readonly altura: number;
  readonly margem: number;
  readonly espacamento: number;
}

/** Tira horizontal RGBA, sem engine ou canvas. Cada bloco recebe uma copia
 * limitada ao SEU tile: inclusive os quatro cantos e os pixels transparentes.
 * O interior do tile i comeca em margem + i * (tilePx + espacamento). */
export function extrudarTira(
  origem: Uint8ClampedArray, tilePx: number, quantidade: number,
  extrusao: number = EXTRUSAO_DA_TIRA,
): TiraExtrudada {
  if (![tilePx, quantidade, extrusao].every((n) => Number.isSafeInteger(n) && n > 0)) {
    throw new Error('extrudarTira: tile, quantidade e extrusao devem ser inteiros positivos.');
  }
  const larguraOriginal = tilePx * quantidade;
  if (origem.length !== larguraOriginal * tilePx * 4) {
    throw new Error('extrudarTira: tamanho RGBA incompativel com a tira.');
  }
  const passo = tilePx + 2 * extrusao;
  const largura = quantidade * passo;
  const altura = passo;
  const pixels = new Uint8ClampedArray(largura * altura * 4);
  for (let tile = 0; tile < quantidade; tile += 1) {
    for (let y = 0; y < altura; y += 1) {
      const sy = Math.max(0, Math.min(tilePx - 1, y - extrusao));
      for (let x = 0; x < passo; x += 1) {
        const sx = tile * tilePx + Math.max(0, Math.min(tilePx - 1, x - extrusao));
        const de = (sy * larguraOriginal + sx) * 4;
        const para = (y * largura + tile * passo + x) * 4;
        pixels.set(origem.subarray(de, de + 4), para);
      }
    }
  }
  return { pixels, largura, altura, margem: extrusao, espacamento: 2 * extrusao };
}
