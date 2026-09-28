/**
 * F34 — o fim da escaramuca (decisao do operador, 2026-09-28): "Vitoria: destruir
 * Armazem, Escola e Quartel inimigos e todas as tropas. Derrota: perder os tres e
 * todas as tropas."
 *
 * Escaramuca e a partida que TEM IA (`state.ia`): os oponentes do jogador sao os lados
 * dela. Sem IA, nao ha vitoria (seria vazia: nao ha inimigo) nem derrota — o jogo livre
 * nunca acaba. A derrota vem antes da vitoria no mesmo tick: perda mutua e derrota.
 */
import type { GameState } from './state';
import { ID_DA_ESCOLA, ID_DO_ARMAZEM, ID_DO_QUARTEL, LADO_DO_JOGADOR } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { classeDaUnidade } from './condicao';

export type FimDaPartida = 'vitoria' | 'derrota';

/** Os tres predios que seguram um lado no jogo. Obra conta como de pe: ainda nao foi
 *  destruida. */
const PREDIOS_QUE_SEGURAM = [ID_DO_ARMAZEM, ID_DA_ESCOLA, ID_DO_QUARTEL] as const;

/** O lado ja caiu: nenhum dos tres predios e nenhum militar vivo. */
export function ladoCaiu(state: GameState, lado: number, dados: GameData = gameData): boolean {
  const temPredio = state.predios.ordem.some((id) => {
    const p = state.predios.porId[id];
    return p !== undefined && p.lado === lado && (PREDIOS_QUE_SEGURAM as readonly string[]).includes(p.tipo);
  });
  if (temPredio) return false;
  return !state.unidades.ordem.some((id) => {
    const u = state.unidades.porId[id];
    return u !== undefined && u.lado === lado && classeDaUnidade(u.tipo, dados) === 'militar';
  });
}

export function resultadoDaPartida(state: GameState, dados: GameData = gameData): FimDaPartida | null {
  if (state.ia === undefined) return null;
  const oponentes = Object.keys(state.ia).map(Number).filter((l) => l !== LADO_DO_JOGADOR);
  if (oponentes.length === 0) return null;
  if (ladoCaiu(state, LADO_DO_JOGADOR, dados)) return 'derrota';
  return oponentes.every((l) => ladoCaiu(state, l, dados)) ? 'vitoria' : null;
}
