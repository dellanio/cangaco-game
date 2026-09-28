/**
 * `SetBuildingRepair` (F-CERCO-b): o jogador liga ou desliga o reparo de UM predio.
 *
 * So o campo muda. Quem cria a tarefa e o gerador do JobBoard (`gerarTarefas`), e quem
 * a derruba quando o reparo e desligado no meio e o saneamento do mesmo tick
 * (`motivoDoDestino`, `'destino-completo'`) — nenhum caminho novo de release.
 */
import type { Command } from '../commands';
import type { GameState } from '../state';
import { motivoDaRecusaDeReparo } from '../reparo';
import { comPredio } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

export type SetBuildingRepair = Extract<Command, { readonly type: 'SetBuildingRepair' }>;

export function aplicarSetBuildingRepair(state: GameState, comando: SetBuildingRepair): ResultadoDeSistema {
  const predio = state.predios.porId[comando.predio];
  const motivo = motivoDaRecusaDeReparo(predio);
  if (motivo !== null) {
    return {
      state,
      events: [{ type: 'command-rejected', command: 'SetBuildingRepair', predio: comando.predio, motivo }],
    };
  }
  if (predio === undefined || predio.estado !== 'completo') return { state, events: [] };
  // idempotente, no molde de `SetBuildingPaused`: o mesmo valor devolve o MESMO estado
  if (predio.reparo === comando.ligado) return { state, events: [] };
  return { state: comPredio(state, { ...predio, reparo: comando.ligado }), events: [] };
}
