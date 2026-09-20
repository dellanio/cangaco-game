import type { Command } from './commands';
import type { GameEvent, GameState } from './state';

/**
 * A unica porta de entrada da simulacao.
 * Pura: nao muta `state` nem `commands`, devolve um estado novo.
 *
 * A F02 nao tem sistema: o tick so incrementa o contador. Os sistemas
 * (build, haul, produce, eat, combat) entram a partir da F09.
 */
export function step(state: GameState, _commands: readonly Command[]): GameState {
  // `Command` e `never` na F02, entao nao ha comando para processar. O
  // parametro fica porque e o contrato: quando a F07 der o primeiro membro a
  // uniao, entra aqui o switch sobre `command.type`, com caso `default`
  // atribuindo a `never` para garantir exaustividade.
  const events: GameEvent[] = [];

  const tick = state.tick + 1;
  events.push({ type: 'tick-advanced', tick });

  return {
    tick,
    rng: state.rng,
    events,
    predios: state.predios,
    unidades: state.unidades,
    proximoId: state.proximoId,
    tiposJaConstruidos: state.tiposJaConstruidos,
  };
}
