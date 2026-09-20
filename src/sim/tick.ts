import type { Command } from './commands';
import type { GameEvent, GameState } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { aplicarPlaceBlueprint } from './systems/build';

/**
 * A unica porta de entrada da simulacao.
 * Pura: nao muta `state` nem `commands`, devolve um estado novo.
 *
 * Os comandos rodam EM ORDEM dentro do tick, cada um sobre o estado que o
 * anterior deixou (dois `PlaceBlueprint` na mesma posicao, na mesma lista: o
 * segundo e rejeitado). Os sistemas com relogio (haul, produce, eat, combat)
 * entram a partir da F09.
 *
 * `dados` e injetavel pelo mesmo motivo de `createInitialState`: um teste prova
 * que nenhum numero foi digitado em `sim/` trocando o dado.
 */
export function step(
  state: GameState, commands: readonly Command[], dados: GameData = gameData,
): GameState {
  const tick = state.tick + 1;
  const events: GameEvent[] = [{ type: 'tick-advanced', tick }];

  let atual = state;
  for (const command of commands) {
    switch (command.type) {
      case 'PlaceBlueprint': {
        const resultado = aplicarPlaceBlueprint(atual, command, dados);
        atual = resultado.state;
        events.push(...resultado.events);
        break;
      }
      default: {
        // Exaustividade: acrescentar um membro a `Command` sem tratar aqui
        // reprova o `typecheck` (este `never` deixa de compilar). Atribui-se a
        // DISCRIMINANTE, nao `command`: com um unico membro na uniao o TypeScript
        // nao estreita `command` para `never` (so filtra membros de uma uniao),
        // mas estreita `command.type` — e continua valendo quando a uniao crescer.
        // O throw cobre o que o compilador nao ve: comando fora da uniao vindo de
        // um save corrompido.
        const naoTratado: never = command.type;
        throw new Error(`step: comando desconhecido '${naoTratado}': ${JSON.stringify(command)}`);
      }
    }
  }

  return {
    tick,
    rng: atual.rng,
    events,
    predios: atual.predios,
    unidades: atual.unidades,
    proximoId: atual.proximoId,
    tiposJaConstruidos: atual.tiposJaConstruidos,
  };
}
