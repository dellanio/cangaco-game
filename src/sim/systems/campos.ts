import type { Command } from '../commands';
import type { GameEvent, GameState } from '../state';
import type { GameData } from '../data/types';
import { canPlowField } from '../campos';
import { chaveDeTile } from '../estradas';
import { criarTarefaDeAradura } from '../jobs';

export type PlowField = Extract<Command, { readonly type: 'PlowField' }>;

interface Resultado {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/**
 * F18h — `PlowField`: pergunta `canPlowField` e, se aceitar, desenha os tiles NOVOS
 * no canteiro do campo (`camposPlanejados`) e abre uma tarefa de aradura para cada
 * um. Recusa = mesmo estado e um `command-rejected` com motivo e tile. Nada novo a
 * fazer (trecho vazio, tudo ja desenhado) = mesmo estado, sem tarefa e sem evento.
 *
 * E o `aplicarPlaceRoad` sem a unica coisa que la e material: o pagador. A tarefa de
 * aradura nao reserva nada, entao nenhuma pode faltar por falta de pedra e o laco
 * nao tem `break` — todo tile novo sai daqui com a tarefa dele. O remendo do
 * `gerarTarefas` cobre so o que CAI depois.
 */
export function aplicarPlowField(state: GameState, comando: PlowField, dados: GameData): Resultado {
  const resposta = canPlowField(state, comando.recurso, comando.tiles, dados);
  if (!resposta.ok) {
    return {
      state,
      events: [{ type: 'command-rejected', command: comando.type, motivo: resposta.motivo, tile: resposta.tile }],
    };
  }
  if (resposta.novos.length === 0) return { state, events: [] };

  const camposPlanejados: Record<string, string> = { ...state.camposPlanejados };
  for (const tile of resposta.novos) camposPlanejados[chaveDeTile(tile)] = comando.recurso;
  let atual: GameState = { ...state, camposPlanejados };
  for (const tile of resposta.novos) {
    atual = criarTarefaDeAradura(atual, tile, comando.recurso).state;
  }
  return { state: atual, events: [] };
}
