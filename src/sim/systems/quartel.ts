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
import type { GameState, Predio, Unidade } from '../state';
import { ID_DO_RECRUTA } from '../state';
import type { GameData } from '../data/types';
import { condicaoCheiaDoTipo } from '../condicao';
import { tileDeSaida } from './escolas';
import { ehQuartelCompleto, motivoDaRecusaDeSoldado, recrutasNoQuartel, requisitosDoTipo } from '../quartel';
import type { MotivoDeRecusaDeSoldado } from '../quartel';
import { tilesDaPorta } from '../estradas';
import { comPredio } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

export type TrainSoldier = Extract<Command, { readonly type: 'TrainSoldier' }>;

/**
 * C3 — por que `tipo` nao se forma AGORA neste quartel: o motivo da regra
 * (`motivoDaRecusaDeSoldado`) mais a porta. E a UNICA regra — o comando e o painel
 * perguntam aqui, entao o painel diz "porta bloqueada" exatamente quando o comando recusa.
 */
export function motivoParaFormar(
  state: GameState, predioId: string, tipo: string, dados: GameData,
): MotivoDeRecusaDeSoldado | null {
  const motivo = motivoDaRecusaDeSoldado(state, predioId, tipo, dados);
  if (motivo !== null) return motivo;
  const quartel = state.predios.porId[predioId];
  return ehQuartelCompleto(quartel) && tileDeSaida(state, quartel, dados) === null ? 'porta-bloqueada' : null;
}

/**
 * C3 — os recrutas de dentro NAO se perdem quando o quartel sai (demolido ou derrubado): o
 * KaM "esquece" deles e eles voltam ao mapa (KM_HouseBarracks.pas:143-149). Cada um vira
 * uma unidade `recruit` ociosa, do lado do quartel, na porta andavel (ou no 1o tile da
 * porta, que fica livre com o predio saindo). Chamar ANTES de tirar o predio do estado.
 */
export function soltarRecrutas(state: GameState, predio: Predio, dados: GameData): GameState {
  if (!ehQuartelCompleto(predio) || recrutasNoQuartel(predio) < 1) return state;
  const porta = tileDeSaida(state, predio, dados) ?? tilesDaPorta(predio, dados)[0] ?? { gx: predio.gx, gy: predio.gy };
  let atual = state;
  for (let i = 0; i < recrutasNoQuartel(predio); i += 1) {
    const id = `u${atual.proximoId}`;
    const recruta: Unidade = {
      id, lado: predio.lado, tipo: ID_DO_RECRUTA, gx: porta.gx, gy: porta.gy,
      fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(ID_DO_RECRUTA, dados),
    };
    atual = {
      ...atual,
      proximoId: atual.proximoId + 1,
      unidades: { porId: { ...atual.unidades.porId, [id]: recruta }, ordem: [...atual.unidades.ordem, id] },
    };
  }
  return atual;
}

export function aplicarTrainSoldier(state: GameState, comando: TrainSoldier, dados: GameData): ResultadoDeSistema {
  const quartel = state.predios.porId[comando.predio];
  const requisitos = requisitosDoTipo(comando.tipo, dados);
  // a porta ANDAVEL, a mesma regra de onde a escola solta o formado
  const porta = ehQuartelCompleto(quartel) ? tileDeSaida(state, quartel, dados) : null;
  const recusa = motivoParaFormar(state, comando.predio, comando.tipo, dados);
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
