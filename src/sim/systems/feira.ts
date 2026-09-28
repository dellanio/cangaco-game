/**
 * F35 — a Feira: `SetTrade` fixa a ordem, e `sistemaDaFeira` fecha UMA troca por tick em
 * cada feira que tem `taxa` de A na entrada: debita `taxa` de A e credita 1 de B na
 * saida, que os serfs escoam como a de qualquer predio (nivel 6). Sem ciclo e sem
 * trabalhador: o GDD nao da tempo de troca, e duracao nova seria numero inventado.
 */
import type { Command } from '../commands';
import type { GameState, PredioCompleto } from '../state';
import type { GameData } from '../data/types';
import { ehFeiraCompleta, motivoDaRecusaDeTroca, porQueNaoTroca, trocaAtiva } from '../feira';
import { comPredio } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

export type SetTrade = Extract<Command, { readonly type: 'SetTrade' }>;

export function aplicarSetTrade(state: GameState, comando: SetTrade, dados: GameData): ResultadoDeSistema {
  const motivo = motivoDaRecusaDeTroca(state, comando.predio, comando.da, comando.para, comando.quantidade, dados);
  const feira = state.predios.porId[comando.predio];
  if (motivo !== null || !ehFeiraCompleta(feira)) {
    return {
      state,
      events: [{ type: 'command-rejected', command: 'SetTrade', predio: comando.predio, motivo: motivo ?? 'predio-nao-e-feira' }],
    };
  }
  if (comando.quantidade === 0) {
    // cancela: o A que sobrou na entrada vira excedente e volta ao armazem (nivel 7)
    if (feira.troca === undefined) return { state, events: [] };
    const { troca: _cancelada, ...semOrdem } = feira;
    void _cancelada;
    return { state: comPredio(state, semOrdem as PredioCompleto), events: [] };
  }
  return {
    state: comPredio(state, { ...feira, troca: { da: comando.da, para: comando.para, quantidade: comando.quantidade, feitas: 0 } }),
    events: [],
  };
}

export function sistemaDaFeira(state: GameState, dados: GameData): GameState {
  let atual = state;
  const taxa = dados.economia.marketplace.taxa;
  for (const id of state.predios.ordem) {
    const feira = atual.predios.porId[id];
    if (!ehFeiraCompleta(feira) || porQueNaoTroca(feira, dados) !== null) continue;
    const t = trocaAtiva(feira);
    if (t === null) continue;
    const entrada = { ...feira.estoque.entrada, [t.da]: (feira.estoque.entrada[t.da] ?? 0) - taxa };
    const saida = { ...feira.estoque.saida, [t.para]: (feira.estoque.saida[t.para] ?? 0) + 1 };
    atual = comPredio(atual, { ...feira, estoque: { entrada, saida }, troca: { ...t, feitas: t.feitas + 1 } });
  }
  return atual;
}
