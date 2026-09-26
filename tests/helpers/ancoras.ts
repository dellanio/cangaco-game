/**
 * F18c-1a — de onde os cenarios tiram a posicao. Nenhum cenario escreve
 * coordenada absoluta: escreve DESLOCAMENTO a partir de uma ancora, e a ancora
 * sai do dado.
 *
 * Duas familias de ancora, e escolher a errada e o defeito que este arquivo
 * existe para evitar:
 *  - a VILA (o armazem do cenario inicial): rua ate a porta do armazem, predio
 *    vizinho sem recurso;
 *  - uma FEICAO do mapa (a mancha conexa de rocha, agua ou terra arada): o
 *    produtor que precisa do recurso ao alcance.
 * A pedreira da vila, derivada do armazem, passaria com o mundo transladado e
 * cairia no dia em que a vila mudasse de lugar sem o lajedo (F18c-2). Derivada do
 * lajedo, ela acompanha a rocha.
 *
 * A prova e a translacao do mundo inteiro (BUILD_PLAN, F18c): vila, mapa e
 * recursos andam +K juntos, e toda ancora anda +K com eles.
 */
import { ID_DO_ARMAZEM } from '../../src/sim/state';
import type { TileDeGrid } from '../../src/sim/estradas';
import { gameData } from '../../src/sim/data';
import type { GameData, TerrenoDeMapa } from '../../src/sim/data/types';

/** O canto noroeste da caixa que envolve uma mancha: inteiro, e anda junto com ela. */
export interface Mancha {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly tiles: number;
}

/** `(dx, dy) => tile`: o deslocamento a partir da ancora. */
export type Relativo = (dx: number, dy: number) => TileDeGrid;

export const relativoA = (ancora: { readonly gx: number; readonly gy: number }): Relativo =>
  (dx, dy) => ({ gx: ancora.gx + dx, gy: ancora.gy + dy });

const cantoDa = (m: Mancha): TileDeGrid => ({ gx: m.x0, gy: m.y0 });

/** A vila: o canto do armazem do cenario inicial. */
export function ancoraDaVila(dados: GameData = gameData): TileDeGrid {
  const armazem = dados.economia.estadoInicial.predios.find((p) => p.id === ID_DO_ARMAZEM);
  if (armazem === undefined) throw new Error('ancora: o cenario inicial nao tem armazem');
  return { gx: armazem.gx, gy: armazem.gy };
}

/** As manchas 4-conexas dos tiles que `pertence` aceita, varridas por linha. */
function manchas(dados: GameData, pertence: (gx: number, gy: number) => boolean): Mancha[] {
  const { largura, altura } = dados.mapa;
  const visto = new Uint8Array(largura * altura);
  const saida: Mancha[] = [];
  for (let gy = 0; gy < altura; gy++) {
    for (let gx = 0; gx < largura; gx++) {
      if (visto[gy * largura + gx] === 1 || !pertence(gx, gy)) continue;
      visto[gy * largura + gx] = 1;
      const pilha: TileDeGrid[] = [{ gx, gy }];
      let m = { x0: gx, y0: gy, x1: gx, y1: gy, tiles: 0 };
      while (pilha.length > 0) {
        const t = pilha.pop() as TileDeGrid;
        m = {
          x0: Math.min(m.x0, t.gx), y0: Math.min(m.y0, t.gy),
          x1: Math.max(m.x1, t.gx), y1: Math.max(m.y1, t.gy), tiles: m.tiles + 1,
        };
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = t.gx + dx;
          const ny = t.gy + dy;
          if (nx < 0 || ny < 0 || nx >= largura || ny >= altura) continue;
          if (visto[ny * largura + nx] === 1 || !pertence(nx, ny)) continue;
          visto[ny * largura + nx] = 1;
          pilha.push({ gx: nx, gy: ny });
        }
      }
      saida.push(m);
    }
  }
  return saida;
}

function manchasDeTerreno(dados: GameData, tipo: TerrenoDeMapa): Mancha[] {
  const { linhas, legenda } = dados.mapa;
  return manchas(dados, (gx, gy) => legenda[linhas[gy]?.[gx] ?? ''] === tipo);
}

function manchasDeRecurso(dados: GameData, recurso: string): Mancha[] {
  const tiles = new Set((dados.mapa.recursos[recurso] ?? []).map(([gx, gy]) => `${gx},${gy}`));
  return manchas(dados, (gx, gy) => tiles.has(`${gx},${gy}`));
}

/** Chebyshev da ancora da vila ate a caixa da mancha. */
function distanciaDaVila(m: Mancha, dados: GameData): number {
  const v = ancoraDaVila(dados);
  const dx = v.gx < m.x0 ? m.x0 - v.gx : v.gx > m.x1 ? v.gx - m.x1 : 0;
  const dy = v.gy < m.y0 ? m.y0 - v.gy : v.gy > m.y1 ? v.gy - m.y1 : 0;
  return Math.max(dx, dy);
}

/** A primeira pela ordem dada; empate em `ordem` e erro, nao sorte da varredura. */
function unica(lista: Mancha[], ordem: (a: Mancha, b: Mancha) => number, nome: string): Mancha {
  const [a, b] = [...lista].sort(ordem);
  if (a === undefined) throw new Error(`ancora: o mapa nao tem ${nome}`);
  if (b !== undefined && ordem(a, b) === 0) throw new Error(`ancora: ${nome} empata entre duas manchas`);
  return a;
}

/** O lajedo da vila: a mancha de rocha mais perto do armazem. */
export function ancoraDoLajedo(dados: GameData = gameData): TileDeGrid {
  return cantoDa(unica(manchasDeRecurso(dados, 'rock'),
    (a, b) => distanciaDaVila(a, dados) - distanciaDaVila(b, dados), 'lajedo perto da vila'));
}

/** O lago pequeno: a mancha de agua mais perto do armazem. */
export function ancoraDoLagoPequeno(dados: GameData = gameData): TileDeGrid {
  return cantoDa(unica(manchasDeTerreno(dados, 'agua'),
    (a, b) => distanciaDaVila(a, dados) - distanciaDaVila(b, dados), 'lago perto da vila'));
}

/** O lagamar: a maior mancha de agua do mapa. */
export function ancoraDoLagamar(dados: GameData = gameData): TileDeGrid {
  return cantoDa(unica(manchasDeTerreno(dados, 'agua'), (a, b) => b.tiles - a.tiles, 'lagamar'));
}

/** O rocado do norte: a mancha de terra arada mais ao norte (a da F18, a da cadeia do pao). */
export function ancoraDoRocadoDoNorte(dados: GameData = gameData): TileDeGrid {
  return cantoDa(unica(manchasDeTerreno(dados, 'campoArado'), (a, b) => a.y0 - b.y0, 'rocado do norte'));
}

/** A serra: a maior mancha de montanha (a encosta oeste e onde mora a cadeia do ouro). */
export function ancoraDaSerra(dados: GameData = gameData): TileDeGrid {
  return cantoDa(unica(manchasDeTerreno(dados, 'montanha'), (a, b) => b.tiles - a.tiles, 'serra'));
}

/** `linhaH` relativa: de `dx0` a `dx1` na linha `dy`, a partir da ancora. */
export const linhaHDe = (r: Relativo, dx0: number, dx1: number, dy: number): TileDeGrid[] =>
  Array.from({ length: dx1 - dx0 + 1 }, (_, i) => r(dx0 + i, dy));

/** `linhaV` relativa: de `dy0` a `dy1` na coluna `dx`, a partir da ancora. */
export const linhaVDe = (r: Relativo, dx: number, dy0: number, dy1: number): TileDeGrid[] =>
  Array.from({ length: dy1 - dy0 + 1 }, (_, i) => r(dx, dy0 + i));

/** A ancora da vila ja aplicada, para os arquivos que so precisam dela. */
export const naVila: Relativo = relativoA(ancoraDaVila());

/** O tile como par `[gx, gy]`, para as fixtures que recebem a posicao em dois argumentos. */
export const xy = (t: TileDeGrid): [number, number] => [t.gx, t.gy];
