/**
 * D-TELA-02 — a aritmetica do minimapa: onde o mapa cabe na caixa, onde um retangulo em
 * tiles cai em px de minimapa, e o tile sob um clique. Puro: nem phaser, nem DOM, nem
 * `sim/data`. Quem pinta e `ui/minimapa.ts`; o terreno vem de `render/mapa.ts` pelo
 * `main.ts`.
 */

/** O mapa enquadrado na caixa: `pxPorTile` igual nos dois eixos (proporcao mantida) e o
 *  desvio que centra o que sobrou. */
export interface Enquadro {
  readonly pxPorTile: number;
  readonly x0: number;
  readonly y0: number;
}

export interface RetanguloPx {
  readonly x: number;
  readonly y: number;
  readonly largura: number;
  readonly altura: number;
}

/** Retangulo em tiles, com `x1`/`y1` exclusivos, como o `CaixaEmTiles` do footprint. */
export interface RetanguloEmTiles {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export function enquadrar(
  largura: number, altura: number, caixaPx: { readonly largura: number; readonly altura: number },
): Enquadro {
  const pxPorTile = Math.min(caixaPx.largura / largura, caixaPx.altura / altura);
  return {
    pxPorTile,
    x0: (caixaPx.largura - largura * pxPorTile) / 2,
    y0: (caixaPx.altura - altura * pxPorTile) / 2,
  };
}

export function retanguloNoMinimapa(r: RetanguloEmTiles, e: Enquadro): RetanguloPx {
  return {
    x: e.x0 + r.x0 * e.pxPorTile,
    y: e.y0 + r.y0 * e.pxPorTile,
    largura: (r.x1 - r.x0) * e.pxPorTile,
    altura: (r.y1 - r.y0) * e.pxPorTile,
  };
}

/** O `worldView` da camera (px de mundo) em tiles fracionarios. */
export function vistaEmTiles(
  worldView: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  tilePx: number,
): RetanguloEmTiles {
  return {
    x0: worldView.x / tilePx,
    y0: worldView.y / tilePx,
    x1: (worldView.x + worldView.width) / tilePx,
    y1: (worldView.y + worldView.height) / tilePx,
  };
}

/** O tile sob o ponto (px de minimapa), preso ao mapa: clicar na faixa que sobra do
 *  enquadro leva a borda, nao a lugar nenhum. */
export function tileDoMinimapa(
  px: number, py: number, e: Enquadro, largura: number, altura: number,
): { gx: number; gy: number } {
  const prender = (v: number, max: number): number => Math.min(max - 1, Math.max(0, Math.floor(v)));
  return {
    gx: prender((px - e.x0) / e.pxPorTile, largura),
    gy: prender((py - e.y0) / e.pxPorTile, altura),
  };
}

/** Um RGBA por tile, row-major, com a cor (`#rrggbb`) do codigo do tile. */
export function pixelsDoTerreno(terreno: {
  readonly codigos: Uint8Array; readonly cores: readonly string[];
}): Uint8ClampedArray<ArrayBuffer> {
  const rgb = terreno.cores.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
  const pixels = new Uint8ClampedArray(new ArrayBuffer(terreno.codigos.length * 4));
  terreno.codigos.forEach((codigo, i) => {
    const [r, g, b] = rgb[codigo] ?? [0, 0, 0];
    pixels.set([r ?? 0, g ?? 0, b ?? 0, 255], i * 4);
  });
  return pixels;
}
