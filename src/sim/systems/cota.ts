/**
 * `SetProductionQuota` (F24a): o jogador diz quantas de cada arma a oficina faz.
 *
 * D-PRODUCAO-03a — a cota e ENCOMENDA (`EscolhaDeSaida`, `state.ts`): o comando
 * SUBSTITUI o que falta de cada saida, e tudo zero para a oficina. A vez
 * (`proxima`) e o ciclo em curso (`emCurso`) ficam, como no KaM, que nao mexe em
 * `fLastOrderProduced` ao mudar a encomenda: o ciclo em curso ja foi descontado e
 * entrega o que comecou.
 */
import type { Command } from '../commands';
import type { GameData } from '../data/types';
import type { GameState } from '../state';
import { motivoDaRecusaDeCota } from '../cota';
import { escolhaInicial, saidasDaReceita } from '../producao';
import { comPredio } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

export type SetProductionQuota = Extract<Command, { readonly type: 'SetProductionQuota' }>;

export function aplicarSetProductionQuota(
  state: GameState, comando: SetProductionQuota, dados: GameData,
): ResultadoDeSistema {
  const predio = state.predios.porId[comando.predio];
  const motivo = motivoDaRecusaDeCota(predio, comando.cota, dados);
  if (motivo !== null) {
    return {
      state,
      events: [{ type: 'command-rejected', command: 'SetProductionQuota', predio: comando.predio, motivo }],
    };
  }
  // o `motivo === null` ja garantiu predio completo com receita que escolhe; a
  // guarda explicita e para o TypeScript, como em `systems/pausa.ts`
  if (predio === undefined || predio.estado !== 'completo' || predio.producao === null) return { state, events: [] };
  const receita = dados.producao.receitas[predio.tipo];
  if (receita === undefined) return { state, events: [] };
  // toda saida da receita, com zero inclusive: e a forma de `escolhaInicial`, e duas
  // encomendas iguais ficam iguais byte a byte
  const cota: Record<string, number> = {};
  for (const m of saidasDaReceita(receita, dados)) cota[m] = comando.cota[m] ?? 0;
  const anterior = predio.producao.escolha ?? escolhaInicial(receita, dados);
  return {
    state: comPredio(state, { ...predio, producao: { ...predio.producao, escolha: { ...anterior, cota } } }),
    events: [],
  };
}
