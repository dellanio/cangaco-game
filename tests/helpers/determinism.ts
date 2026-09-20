import type { GameState } from '../../src/sim/state';
import { createInitialState } from '../../src/sim/state';
import { step } from '../../src/sim/tick';
import type { Command } from '../../src/sim/commands';

export { deepFreeze } from '../../src/sim/freeze';

/** Round-trip por JSON, como um save/load faria. */
export function reviverPorJson(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/**
 * O teste canonico de determinismo do projeto (BUILD_PLAN F02 e F23).
 *
 * Roda `totalTicks` de duas formas: direto, e salvando/recarregando em
 * `saveAtTick`. Os dois caminhos tem que chegar ao mesmo JSON.
 *
 * `comandosNoTick` (opcional, F07): devolve os comandos a rodar quando o estado
 * esta em `state.tick` (antes do `step`). Sem ele, so tempo passa, como na F02.
 *
 * `antesDoStep` (opcional, F09): transforma o estado ANTES do step daquele tick — para
 * injetar o que nao e comando do jogador (ex.: um claim do JobBoard, que sera a FSM do
 * serf da F10). Sem ele, so tempo e comandos passam.
 *
 * A F23 (save e load) reusa esta funcao com o estado ja povoado, em vez de
 * inventar outro teste. Se um campo novo do GameState nao sobreviver ao
 * JSON, e aqui que quebra.
 */
export function compararComESemSave(opts: {
  readonly seed: number;
  readonly totalTicks: number;
  readonly saveAtTick: number;
  readonly comandosNoTick?: (tickAntesDoStep: number) => readonly Command[];
  readonly antesDoStep?: (estado: GameState) => GameState;
}): { readonly direto: string; readonly comSave: string } {
  const rodar = (salvarEm: number | null): GameState => {
    let state = createInitialState(opts.seed);
    for (let i = 0; i < opts.totalTicks; i++) {
      const preparado = opts.antesDoStep ? opts.antesDoStep(state) : state;
      state = step(preparado, opts.comandosNoTick?.(state.tick) ?? []);
      if (salvarEm !== null && state.tick === salvarEm) {
        state = reviverPorJson(state);
      }
    }
    return state;
  };
  return {
    direto: JSON.stringify(rodar(null)),
    comSave: JSON.stringify(rodar(opts.saveAtTick)),
  };
}
