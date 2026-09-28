/**
 * `TrainSoldier` (F25a): o jogador forma um soldado no quartel (GDD §2.3, "tipo de
 * soldado a treinar"; Anexo A 12.1, "requisitos, sempre + 1 Recruit").
 *
 * Na hora, como no KaM: o comando aceito consome 1 de cada requisito da gaveta
 * `entrada` e 1 recruta, e a unidade militar nasce na porta NO MESMO TICK, com o lado
 * do quartel e o HP cheio (campo ausente, `sim/vida.ts`). Sem fila e sem duracao: o
 * dado nao tem tempo de treino de soldado, e inventar um seria numero novo.
 */
import type { Command } from '../commands';
import type { GameState, Unidade } from '../state';
import type { GameData } from '../data/types';
import { condicaoCheiaDoTipo } from '../condicao';
import { tileDeSaida } from './escolas';
import { ehQuartelCompleto, motivoDaRecusaDeSoldado, recrutasNoQuartel, requisitosDoTipo } from '../quartel';
import { comPredio } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

export type TrainSoldier = Extract<Command, { readonly type: 'TrainSoldier' }>;

export function aplicarTrainSoldier(state: GameState, comando: TrainSoldier, dados: GameData): ResultadoDeSistema {
  const motivo = motivoDaRecusaDeSoldado(state, comando.predio, comando.tipo, dados);
  const quartel = state.predios.porId[comando.predio];
  const requisitos = requisitosDoTipo(comando.tipo, dados);
  // a porta ANDAVEL, a mesma regra de onde a escola solta o formado
  const porta = ehQuartelCompleto(quartel) ? tileDeSaida(state, quartel, dados) : null;
  const recusa = motivo ?? (porta === null ? 'porta-bloqueada' : null);
  if (recusa !== null || !ehQuartelCompleto(quartel) || requisitos === null || porta === null) {
    return {
      state,
      events: [{
        type: 'command-rejected', command: 'TrainSoldier', predio: comando.predio, tipo: comando.tipo,
        motivo: recusa ?? 'predio-nao-e-quartel',
      }],
    };
  }
  const entrada = { ...quartel.estoque.entrada };
  for (const m of requisitos) entrada[m] = (entrada[m] ?? 0) - 1;
  const depois = comPredio(state, {
    ...quartel, estoque: { ...quartel.estoque, entrada }, recrutas: recrutasNoQuartel(quartel) - 1,
  });
  const id = `u${depois.proximoId}`;
  const soldado: Unidade = {
    id, lado: quartel.lado, tipo: comando.tipo, gx: porta.gx, gy: porta.gy,
    fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(comando.tipo, dados),
  };
  return {
    state: {
      ...depois,
      proximoId: depois.proximoId + 1,
      unidades: { porId: { ...depois.unidades.porId, [id]: soldado }, ordem: [...depois.unidades.ordem, id] },
    },
    events: [{ type: 'unit-trained', predio: quartel.id, unidade: id, tipo: comando.tipo }],
  };
}
