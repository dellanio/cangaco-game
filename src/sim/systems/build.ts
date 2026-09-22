import type { Command } from '../commands';
import type { GameEvent, GameState, PredioEmObra } from '../state';
import type { GameData } from '../data/types';
import { canPlace } from '../placement';
import { custoDoPredio } from '../obra';

export type PlaceBlueprint = Extract<Command, { readonly type: 'PlaceBlueprint' }>;

/**
 * `PlaceBlueprint`: pergunta `canPlace` e, se aceitar, acrescenta uma OBRA
 * pendente ao estado; se recusar, devolve o MESMO estado e um evento
 * `command-rejected` com o motivo.
 *
 * A obra nasce com HP 0 (nada martelado) e `faltam` igual ao custo do dado.
 *
 * NAO DEBITA ESTOQUE. O custo sai na ENTREGA (F10: o serf tira do armazem e o
 * item passa a constar como entregue em `obra.faltam`), nunca no clique — e nao
 * ha checagem de "tenho material?": o jogador pode plantar sem ter, e a obra
 * espera as entregas. Nao "melhore" isto debitando aqui: tres travas em
 * `tests/F07-posicionar.test.ts` e no roteiro de screenshot da F07 quebram.
 */
export function aplicarPlaceBlueprint(
  state: GameState, comando: PlaceBlueprint, dados: GameData,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const resposta = canPlace(state, comando.buildingId, comando.gx, comando.gy, dados);
  if (!resposta.ok) {
    return {
      state,
      events: [{
        type: 'command-rejected',
        command: comando.type,
        buildingId: comando.buildingId,
        gx: comando.gx,
        gy: comando.gy,
        motivo: resposta.motivo,
      }],
    };
  }

  const def = dados.predios.find((p) => p.id === comando.buildingId);
  if (!def) {
    // canPlace so aceita tipo que existe no dado; chegar aqui e bug, nao entrada ruim.
    throw new Error(`aplicarPlaceBlueprint: canPlace aceitou '${comando.buildingId}', que nao tem definicao`);
  }

  const id = `p${state.proximoId}`;
  const obra: PredioEmObra = {
    id,
    tipo: comando.buildingId,
    gx: comando.gx,
    gy: comando.gy,
    estado: 'obra',
    hp: 0,
    obra: { faltam: custoDoPredio(def), nivelamento: 0 },
  };
  return {
    state: {
      ...state,
      predios: {
        porId: { ...state.predios.porId, [id]: obra },
        ordem: [...state.predios.ordem, id],
      },
      proximoId: state.proximoId + 1,
    },
    events: [],
  };
}
