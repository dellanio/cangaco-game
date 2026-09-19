/**
 * Conversao grid <-> tela. Funcao pura, ZERO import — nem Phaser, nem sim/,
 * nem window. E o que torna a ida e volta testavel headless (CLAUDE.md §4:
 * grid ORTOGONAL, tiles quadrados — nao isometrico, nada de losango).
 *
 * `tilePx` e sempre parametro, nunca constante aqui: a ida e volta e
 * propriedade da matematica, nao uma coincidencia do numero que
 * `data/terrain.json` guarda hoje. Quem le o dado e `render/mapa.ts`.
 */

export interface Tile {
  readonly gx: number;
  readonly gy: number;
}

export interface Ponto {
  readonly x: number;
  readonly y: number;
}

function validarTilePx(tilePx: number): void {
  if (!(tilePx > 0)) {
    throw new Error(`grid: tilePx precisa ser > 0 (recebeu ${tilePx}).`);
  }
}

/** Canto superior-esquerdo do tile, em pixels de mundo. */
export function gridToScreen(tile: Tile, tilePx: number): Ponto {
  validarTilePx(tilePx);
  return { x: tile.gx * tilePx, y: tile.gy * tilePx };
}

/** Centro do tile, em pixels de mundo — util para posicionar sprite/highlight. */
export function gridToScreenCentro(tile: Tile, tilePx: number): Ponto {
  validarTilePx(tilePx);
  return { x: tile.gx * tilePx + tilePx / 2, y: tile.gy * tilePx + tilePx / 2 };
}

/**
 * Ponto de mundo -> tile. `Math.floor`, nunca `round` nem truncamento por
 * `| 0`: floor e o unico que acerta coordenada negativa
 * (`floor(-1/64) === -1`, mas `-1/64 | 0 === 0`) e o unico que faz qualquer
 * ponto dentro do tile voltar para o mesmo tile — nao so os cantos.
 */
export function screenToGrid(ponto: Ponto, tilePx: number): Tile {
  validarTilePx(tilePx);
  return { gx: Math.floor(ponto.x / tilePx), gy: Math.floor(ponto.y / tilePx) };
}

/** Ordenacao de desenho: quem esta mais ao sul (y maior) desenha por cima. */
export function depthDeY(worldY: number): number {
  return worldY;
}

export function tileDentroDoMapa(tile: Tile, largura: number, altura: number): boolean {
  return tile.gx >= 0 && tile.gy >= 0 && tile.gx < largura && tile.gy < altura;
}
