/**
 * `SetProductionQuota` (F24a): o jogador diz quantas de cada arma a oficina faz.
 *
 * A cota e PESO do rodizio, e nao encomenda que se esgota (`EscolhaDeSaida`,
 * `state.ts`): com `{ lance: 1 }` so sai aguilhada, para sempre, ate o jogador
 * mudar. Fixar a cota zera a vez: o proximo ciclo entrega a primeira saida do
 * rodizio novo. O ciclo em curso nao e perdido nem refeito — o insumo ja foi
 * cobrado, e o que muda e so qual mercadoria ele vira.
 */
import type { Command } from '../commands';
import type { GameData } from '../data/types';
import type { GameState } from '../state';
import { motivoDaRecusaDeCota } from '../cota';
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
  // so as saidas com peso: a cota guardada nao carrega zero, e duas cotas que dao
  // o mesmo rodizio ficam iguais byte a byte
  const cota: Record<string, number> = {};
  for (const m of dados.economia.mercadorias) {
    const q = comando.cota[m] ?? 0;
    if (q > 0) cota[m] = q;
  }
  return {
    state: comPredio(state, { ...predio, producao: { ...predio.producao, escolha: { cota, proxima: 0 } } }),
    events: [],
  };
}
