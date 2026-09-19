import { createRng, type RngState } from './rng';

/**
 * Efeito colateral emitido por um sistema para o render consumir
 * (CLAUDE.md secao 5). A sim nunca chama o render.
 *
 * Ciclo de vida: `events` carrega SOMENTE os eventos do tick corrente.
 * `step()` comeca cada tick com a lista vazia. Isso mantem o GameState
 * limitado — 1000 ticks nao incham o JSON.
 *
 * Eventos sao funcao pura do estado e dos comandos: dois runs com a mesma
 * semente e os mesmos comandos produzem os mesmos eventos, na mesma ordem.
 * O teste de determinismo compara o estado inteiro, `events` incluso.
 */
export type GameEvent = { readonly type: 'tick-advanced'; readonly tick: number };

/**
 * O GameState inteiro, serializavel em JSON.
 *
 * Proibido aqui: funcao, classe com metodo, Map, Set, Date, undefined,
 * referencia circular. `JSON.parse(JSON.stringify(state))` tem que devolver
 * um estado equivalente — e ha teste que verifica isso estruturalmente.
 */
export interface GameState {
  readonly tick: number;
  /** O RNG vive DENTRO do estado. Semente fora do estado quebra o load. */
  readonly rng: RngState;
  readonly events: readonly GameEvent[];
}

export function createInitialState(seed: number): GameState {
  return { tick: 0, rng: createRng(seed), events: [] };
}
