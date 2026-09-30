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

/** Lado do quadrado da unidade, como fracao do tile (apresentacao, nao regra de jogo).
 *  Vive aqui, e nao em `unidades.ts`, porque o raio do anel da F18f deriva dele. */
export const LADO_DA_UNIDADE_EM_TILES = 0.5;

/**
 * F18f — quantas posicoes tem o anel em que o desenho da unidade se desloca dentro do
 * tile. Seis: e a pilha maxima medida no cenario (6 unidades no mesmo tile de porta) e e
 * o unico anel em que a corda entre vizinhos IGUALA o raio — com oito posicoes vizinhos
 * ficariam a 0,77 do raio um do outro, e a separacao afirmada no aceite seria menor do
 * que o raio. Ids congruentes modulo 6 no mesmo tile voltam a se esconder: limite
 * conhecido, registrado no BUILD_PLAN.
 */
export const POSICOES_DO_ANEL = 6;

/** Raio do anel, em tiles: o maximo que o centro anda sem o quadrado VAZAR do tile. */
export const RAIO_DO_ANEL_EM_TILES = (1 - LADO_DA_UNIDADE_EM_TILES) / 2;

/** Sufixo numerico do id (`u7` -> 7), reduzido ao anel; 0 se o id nao terminar em digito. */
function slotDoId(id: string): number {
  const digitos = /(\d+)$/.exec(id);
  return digitos ? Number(digitos[1]) % POSICOES_DO_ANEL : 0;
}

/**
 * F18f — o desvio do DESENHO da unidade em relacao ao centro do tile, em pixels do espaco
 * de `escala`. Existe porque duas unidades podem ocupar o mesmo tile (regra da F03, que
 * segue intacta) e, no mesmo pixel, a de cima escondia a de baixo inteira.
 *
 * Funcao pura do id: sem `Math.random()`, sem `Date.now()` e sem olhar quem mais esta no
 * tile — agrupar por tile daria N posicoes sempre distintas, mas faria a unidade SALTAR
 * quando outra entra ou sai. Nada disto chega a `sim/`: a posicao de jogo nao muda.
 *
 * Quem faz teste de acerto de clique (F26) tem de mirar o MESMO ponto, somando isto ao
 * centro do tile; mirar o centro erraria por ate um raio, e erraria mais no tile cheio.
 */
export function deslocamentoDaUnidade(id: string, tilePx: number, escala: number): Ponto {
  const raio = RAIO_DO_ANEL_EM_TILES * ladoDoTile(tilePx, escala);
  const angulo = (slotDoId(id) * 2 * Math.PI) / POSICOES_DO_ANEL;
  return { x: raio * Math.cos(angulo), y: raio * Math.sin(angulo) };
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

/** F26b — o anel do selecionado e a caixa, por cima do mundo e abaixo do highlight do
 *  tile (1 000 000). */
export const PROFUNDIDADE_DA_SELECAO = 999_999;

/** BUG-Z — a camada dos NOMES de unidade: acima de toda unidade e de todo predio (que se
 *  ordenam por `depthDeY`, o y em px de mundo, alguns milhares) e abaixo da selecao. Assim o
 *  nome que o desencontro de rotulos empurra para baixo nao some atras da fileira da frente. */
export const PROFUNDIDADE_DOS_NOMES = 900_000;

export function tileDentroDoMapa(tile: Tile, largura: number, altura: number): boolean {
  return tile.gx >= 0 && tile.gy >= 0 && tile.gx < largura && tile.gy < altura;
}
