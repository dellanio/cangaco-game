/**
 * `SetStorehouseAccept` (D-TRANSPORTE-01a): o jogador liga ou desliga UMA mercadoria num
 * armazem.
 *
 * So o campo muda. Quem manda a sobra a outro armazem e o gerador dos niveis 6 e 7
 * (`destinoQueAceita`), e quem derruba a tarefa que ia ao armazem que passou a bloquear e
 * o saneamento do mesmo tick (`motivoDoDestino`, `'destino-completo'`) — nenhum caminho
 * novo de release.
 */
import type { Command } from '../commands';
import type { GameState } from '../state';
import type { GameData } from '../data/types';
import { armazemAceita, comNaoAceita, motivoDaRecusaDeAceite } from '../armazem';
import { comPredio } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

export type SetStorehouseAccept = Extract<Command, { readonly type: 'SetStorehouseAccept' }>;

export function aplicarSetStorehouseAccept(
  state: GameState, comando: SetStorehouseAccept, dados: GameData,
): ResultadoDeSistema {
  const predio = state.predios.porId[comando.predio];
  const motivo = motivoDaRecusaDeAceite(predio, comando.mercadoria, dados);
  if (motivo !== null) {
    return {
      state,
      events: [{
        type: 'command-rejected', command: 'SetStorehouseAccept', predio: comando.predio,
        mercadoria: comando.mercadoria, motivo,
      }],
    };
  }
  if (predio === undefined || predio.estado !== 'completo') return { state, events: [] };
  // idempotente, no molde de `SetBuildingRepair`: o mesmo valor devolve o MESMO estado
  if (armazemAceita(predio, comando.mercadoria) === comando.aceita) return { state, events: [] };
  const antiga = predio.naoAceita ?? [];
  const nova = comando.aceita ? antiga.filter((m) => m !== comando.mercadoria) : [...antiga, comando.mercadoria];
  return { state: comPredio(state, comNaoAceita(predio, nova)), events: [] };
}
