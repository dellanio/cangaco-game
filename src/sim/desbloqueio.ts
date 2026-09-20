import type { GameState } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';

/**
 * Um tipo de predio esta liberado para construir quando:
 *  - esta em `economy.estadoInicial.menuBuildInicial` (so raiz sem pai —
 *    `tools/data-rules.js`), OU
 *  - o predio que o desbloqueia (`buildings.desbloqueadoPor`) ja chegou a
 *    `'completo'` alguma vez: consulta `state.tiposJaConstruidos`.
 *
 * PERMANENTE, nao presenca atual: demolir o ultimo Woodcutter's nao re-bloqueia
 * a Serraria, nem com uma Sawmill de pe, e demolir para reposicionar e um
 * cenario banal. Continua derivado e serializavel — o historico e uma lista de
 * ids no `GameState`. Nenhum id de predio aparece neste arquivo.
 *
 * Decisao NOSSA, proposta: o comportamento do original nao foi confirmado nas
 * fontes (ver PROGRESS.md).
 */
export function estaDesbloqueado(
  state: GameState, id: string, dados: GameData = gameData,
): boolean {
  const def = dados.predios.find((p) => p.id === id);
  if (!def) return false;
  if (dados.economia.estadoInicial.menuBuildInicial.includes(id)) return true;
  const pai = def.desbloqueadoPor;
  return pai !== null && state.tiposJaConstruidos.includes(pai);
}

/**
 * Registra que um predio do tipo `tipo` chegou a `'completo'`. Idempotente e
 * pura: se o tipo ja esta no historico devolve o MESMO estado; senao, um novo com
 * o tipo no fim da lista. Quem chama e o sistema que conclui obras (a F12 liga
 * isto ao `step()`); ate la o unico produtor e o `createInitialState`.
 */
export function registrarTipoConstruido(state: GameState, tipo: string): GameState {
  if (state.tiposJaConstruidos.includes(tipo)) return state;
  return { ...state, tiposJaConstruidos: [...state.tiposJaConstruidos, tipo] };
}
