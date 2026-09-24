/**
 * Conversao grid <-> tela. Funcao pura, ZERO import — nem Phaser, nem sim/,
 * nem window. E o que torna a ida e volta testavel headless (CLAUDE.md §4:
 * grid ORTOGONAL, tiles quadrados — nao isometrico, nada de losango).
 *
 * `tilePx` e `escala` sao sempre parametro, nunca constante aqui: a ida e
 * volta e propriedade da matematica, nao uma coincidencia do numero que
 * `data/terrain.json` guarda hoje. Quem le o dado e `render/mapa.ts`.
 *
 * F18a — A ESCALA. A F05b deixou escrito que estas funcoes eram cegas a zoom
 * e que precisariam do parametro quando ele entrasse. `escala` diz quantos
 * pixels do espaco de saida valem um pixel de MUNDO:
 *
 *  - quem DESENHA trabalha em pixel de mundo e passa `ESCALA_DO_MUNDO`. Sob o
 *    Phaser o zoom e transformacao de CAMERA: o objeto fica em coordenada de
 *    mundo e aparece no lugar certo em qualquer nivel, sem multiplicar nada.
 *  - quem converte pixel de TELA que ainda NAO passou pela camera passa o
 *    nivel de zoom. E o caso dos roteiros de screenshot, que calculam a
 *    posicao do tile no canvas por fora do Phaser.
 *
 * O caminho do ponteiro na cena passa `ESCALA_DO_MUNDO` de proposito: o ponto
 * ja veio de `camera.getWorldPoint`, que JA inverteu o zoom. Passar o nivel
 * ali dividiria duas vezes.
 */

export interface Tile {
  readonly gx: number;
  readonly gy: number;
}

export interface Ponto {
  readonly x: number;
  readonly y: number;
}

/** A escala de quem trabalha em pixel de mundo. Nomeada, e nao `1` solto no
 *  chamador, para que o eixo exista a vista de quem le o codigo. */
export const ESCALA_DO_MUNDO = 1;

/** O lado do tile no espaco de saida. Os dois fatores dividem em
 *  `screenToGrid`, entao os dois erram igual se forem zero. */
function ladoDoTile(tilePx: number, escala: number): number {
  if (!(tilePx > 0)) {
    throw new Error(`grid: tilePx precisa ser > 0 (recebeu ${tilePx}).`);
  }
  if (!(escala > 0)) {
    throw new Error(`grid: escala precisa ser > 0 (recebeu ${escala}).`);
  }
  return tilePx * escala;
}

/** Canto superior-esquerdo do tile, em pixels do espaco de `escala`. */
export function gridToScreen(tile: Tile, tilePx: number, escala: number): Ponto {
  const lado = ladoDoTile(tilePx, escala);
  return { x: tile.gx * lado, y: tile.gy * lado };
}

/** Centro do tile, em pixels de mundo — util para posicionar sprite/highlight. */
export function gridToScreenCentro(tile: Tile, tilePx: number, escala: number): Ponto {
  const lado = ladoDoTile(tilePx, escala);
  return { x: tile.gx * lado + lado / 2, y: tile.gy * lado + lado / 2 };
}

/**
 * Ponto de mundo -> tile. `Math.floor`, nunca `round` nem truncamento por
 * `| 0`: floor e o unico que acerta coordenada negativa
 * (`floor(-1/64) === -1`, mas `-1/64 | 0 === 0`) e o unico que faz qualquer
 * ponto dentro do tile voltar para o mesmo tile — nao so os cantos.
 */
export function screenToGrid(ponto: Ponto, tilePx: number, escala: number): Tile {
  const lado = ladoDoTile(tilePx, escala);
  return { gx: Math.floor(ponto.x / lado), gy: Math.floor(ponto.y / lado) };
}

/** Ordenacao de desenho: quem esta mais ao sul (y maior) desenha por cima. */
export function depthDeY(worldY: number): number {
  return worldY;
}

export function tileDentroDoMapa(tile: Tile, largura: number, altura: number): boolean {
  return tile.gx >= 0 && tile.gy >= 0 && tile.gx < largura && tile.gy < altura;
}
