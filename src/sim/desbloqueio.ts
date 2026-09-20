import type { GameState } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';

/**
 * Um tipo de predio esta liberado para construir quando:
 *  - esta em `economy.estadoInicial.menuBuildInicial`, OU
 *  - o predio que o desbloqueia (`buildings.desbloqueadoPor`) existe, completo,
 *    em `state.predios`.
 *
 * Derivado de propósito, sem campo `desbloqueados` no GameState: a F12
 * ("concluir um predio libera os filhos") passa a valer sozinha assim que
 * existir predio completo, e nenhum formato novo de estado nasce aqui. A regra
 * e so um par de dados — nenhum id de predio aparece neste arquivo.
 */
export function estaDesbloqueado(
  state: GameState, id: string, dados: GameData = gameData,
): boolean {
  const def = dados.predios.find((p) => p.id === id);
  if (!def) return false;
  if (dados.economia.estadoInicial.menuBuildInicial.includes(id)) return true;
  const pai = def.desbloqueadoPor;
  if (pai === null) return false;
  for (const idDoPredio of state.predios.ordem) {
    const predio = state.predios.porId[idDoPredio];
    if (predio && predio.tipo === pai && predio.estado === 'completo') return true;
  }
  return false;
}
