import type { Command } from './commands';
import type { GameEvent, GameState } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { aplicarPlaceBlueprint } from './systems/build';
import { aplicarDemolishRoad, aplicarPlaceRoad } from './systems/estradas';

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
      case 'PlaceRoad': {
        const resultado = aplicarPlaceRoad(atual, command, dados);
        atual = resultado.state;
        events.push(...resultado.events);
        break;
      }
      case 'DemolishRoad': {
        const resultado = aplicarDemolishRoad(atual, command, dados);
        atual = resultado.state;
        events.push(...resultado.events);
        break;
      }
      default: {
        // Exaustividade: acrescentar um membro a `Command` sem tratar aqui
        // reprova o `typecheck` (este `never` deixa de compilar). Aqui `command` ja
        // e `never`: a uniao tem membros de verdade (F08). Na F07, com UM unico
        // membro, o TypeScript nao estreitava `command` (so filtra membros de uma
        // uniao) e a atribuicao era da discriminante — o que deixa de compilar
        // assim que a uniao cresce, porque `command.type` nao existe em `never`.
        // O throw cobre o que o compilador nao ve: comando fora da uniao vindo de
        // um save corrompido.
        const naoTratado: never = command;
        throw new Error(`step: comando desconhecido ${JSON.stringify(naoTratado)}`);
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
    estradas: atual.estradas,
  };
}
