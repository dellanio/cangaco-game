import type { GameEvent, GameState } from './state';
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
 * o tipo no fim da lista. Quem chama e `registrarConclusoes`, logo abaixo (F12);
 * o outro produtor e o `createInitialState`.
 */
export function registrarTipoConstruido(state: GameState, tipo: string): GameState {
  if (state.tiposJaConstruidos.includes(tipo)) return state;
  return { ...state, tiposJaConstruidos: [...state.tiposJaConstruidos, tipo] };
}

/**
 * F12 — o gancho do desbloqueio: os eventos de UM tick, dobrados sobre
 * `registrarTipoConstruido`. Pura e idempotente por heranca dele — dois
 * `building-completed` do mesmo tipo no mesmo tick registram uma vez so, e um tick
 * sem nenhum devolve o MESMO estado (identidade, nao copia).
 *
 * Por que ler EVENTO e nao comparar `predios` com o tick anterior: a transicao ja e
 * anunciada por quem a faz (`sistemaDosLaborers`, F11c) e o evento e o contrato
 * registrado no BUILD_PLAN. Redescobrir a transicao por diferenca de estado seria uma
 * segunda fonte de verdade — e amarraria o desbloqueio ao sistema que hoje por acaso
 * conclui obras.
 *
 * Continua sem nenhum id de predio: o `tipo` vem do evento, a arvore vem do dado.
 */
export function registrarConclusoes(
  state: GameState, events: readonly GameEvent[],
): GameState {
  let atual = state;
  for (const evento of events) {
    if (evento.type === 'building-completed') atual = registrarTipoConstruido(atual, evento.tipo);
  }
  return atual;
}
