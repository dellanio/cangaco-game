/**
 * `SetWareDistribution` (D-TRANSPORTE-02a): o jogador muda o maximo de UM par
 * mercadoria/tipo de predio no menu de distribuicao, sempre no lado dele.
 *
 * So o campo muda. Quem pede menos e `demandaDeInsumo`, que passa a ler o limite, e quem
 * derruba a aberta alem do limite novo e o saneamento do mesmo tick (`grupoDeAbertas`, o
 * teto e `demandaNoDestino`) — o `TryRemoveDemand` do KaM, sem caminho novo de release.
 */
import type { Command } from '../commands';
import type { GameState } from '../state';
import { LADO_DO_JOGADOR } from '../state';
import type { GameData } from '../data/types';
import { comDistribuicao, limiteDeDistribuicao, motivoDaRecusaDeDistribuicao } from '../distribuicao';
import type { ResultadoDeSistema } from './jobs';

export type SetWareDistribution = Extract<Command, { readonly type: 'SetWareDistribution' }>;

export function aplicarSetWareDistribution(
  state: GameState, comando: SetWareDistribution, dados: GameData,
): ResultadoDeSistema {
  const { mercadoria, tipo, quantidade } = comando;
  const motivo = motivoDaRecusaDeDistribuicao(mercadoria, tipo, quantidade, dados);
  if (motivo !== null) {
    return {
      state,
      events: [{ type: 'command-rejected', command: 'SetWareDistribution', mercadoria, tipo, motivo }],
    };
  }
  // idempotente: o mesmo valor devolve o MESMO estado
  if (limiteDeDistribuicao(state, LADO_DO_JOGADOR, tipo, mercadoria, dados) === quantidade) {
    return { state, events: [] };
  }
  return { state: comDistribuicao(state, LADO_DO_JOGADOR, mercadoria, tipo, quantidade, dados), events: [] };
}
