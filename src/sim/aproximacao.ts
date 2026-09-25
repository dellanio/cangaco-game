/**
 * F-T3 — POR ONDE se chega a um tile de trabalho.
 *
 * O que fecha o passo e o RECURSO, tile por tile, e nao o oficio: a arvore em pe
 * bloqueia (`resources.json: tipos.tree.bloqueiaPasso`, F-T2b), entao o lenhador
 * fica ao LADO e derruba; a rocha e o milho nao bloqueiam (decisao escrita do
 * BUG-C: a pedreira se assenta em cima do lajedo), entao o pedreiro e o roceiro
 * pisam no proprio tile. Uma regra so para os dois casos: o alvo e o tile MAIS os
 * oito vizinhos, filtrados por `tileAndavel`, e quem escolhe entre eles e o custo
 * do A*. Nenhum sistema precisa saber qual recurso bloqueia o que.
 *
 * Arquivo proprio, e nao um par de funcoes em `recursos.ts`, por causa do ciclo:
 * `pathfinding.ts` importa `recursos.ts` (camada de bloqueio), entao `recursos.ts`
 * nao pode importar `pathfinding.ts`. Aqui, em cima dos dois, nao ha ciclo.
 */
import { tileDeChave } from './estradas';
import type { TileDeGrid } from './estradas';
import { tileAndavel, tileCobertoPorPredio } from './pathfinding';
import { gameData } from './data';
import type { GameData } from './data/types';
import type { GameState } from './state';

type MundoDePasso = Pick<GameState, 'predios' | 'estradas' | 'recursos'>;

/** Ordem FIXA (varredura em linha, noroeste para sudeste): o A* recebe os alvos
 *  sempre na mesma ordem, e o desempate dele deixa de depender de quem chamou. */
const VIZINHOS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/**
 * De onde se trabalha este tile, do mais perto para o mais longe: o proprio tile
 * primeiro (custo zero para quem ja esta nele), depois os oito vizinhos andaveis.
 * Vazio quer dizer "ninguem alcanca" — veio no meio da serra, tile cercado de
 * parede.
 *
 * Copia as coordenadas em vez de devolver o `tile` que veio: o resultado entra em
 * `buscarCaminho` e em `fsmData`, e o que vai para o estado tem de ser
 * serializavel e sem campo a mais do chamador.
 */
export function alvosDeAproximacao(
  state: MundoDePasso, tile: TileDeGrid, dados: GameData = gameData,
): readonly TileDeGrid[] {
  const alvos: TileDeGrid[] = [];
  if (tileAndavel(state, tile, 'livre', dados)) alvos.push({ gx: tile.gx, gy: tile.gy });
  for (const [dx, dy] of VIZINHOS) {
    const vizinho = { gx: tile.gx + dx, gy: tile.gy + dy };
    if (tileAndavel(state, vizinho, 'livre', dados)) alvos.push(vizinho);
  }
  return alvos;
}

/**
 * Da para TRABALHAR neste tile? Duas recusas, e as duas sao de POSICAO, nunca de
 * quantidade — quanto ainda ha e pergunta de `tileTrabalhavel`:
 *
 * - tile debaixo do footprint de um predio (a nota herdada da F18): o roceiro
 *   andaria ate um tile que esta debaixo da propria fazenda. O BUG-F fechou o caso
 *   da rocha e da arvore recusando a CONSTRUCAO, e deixou o milho de proposito —
 *   tile de milho e tile que o jogador plantou, e proibir construir ali seria pior
 *   que o bug. A consequencia que sobrou morre aqui: o tile continua existindo,
 *   so nao da mais trabalho a ninguem.
 * - tile sem nenhuma aproximacao andavel: cercado de predio, de parede de serra
 *   ou de agua.
 *
 * Local de proposito (nove tiles, sem A*): a pergunta do CAMINHO inteiro e de quem
 * reclama a tarefa, e roda uma vez por tile escolhido.
 */
export function tileAlcancavelParaColheita(
  state: MundoDePasso, chaveDoTile: string, dados: GameData = gameData,
): boolean {
  const tile = tileDeChave(chaveDoTile);
  if (tileCobertoPorPredio(state, tile, dados)) return false;
  return alvosDeAproximacao(state, tile, dados).length > 0;
}
