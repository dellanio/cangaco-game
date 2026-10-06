/**
 * H-TELA-CAMADA-DE-SOM — os `type` que a sim emite (`GameEvent`, `src/sim/state.ts`), em valor.
 *
 * O `validate:data` (JS, sem compilador) precisa da lista para recusar evento que a sim nao emite
 * em `data/som.json`. A lista e conferida pelo COMPILADOR nos dois sentidos: `satisfies` recusa
 * um `type` que nao existe, e `_TODOS` deixa de compilar quando a sim ganha um evento que nao
 * esta aqui. So `import type`: o arquivo roda no Node sem transpilar (o `validate:data` o le).
 */
import type { GameEvent } from '../sim/state';

export const EVENTOS_DA_SIM = [
  'tick-advanced', 'command-rejected', 'building-attacked', 'unit-trained', 'task-released', 'unit-fed',
  'task-completed', 'cargo-returned', 'building-completed', 'building-occupied', 'goods-produced',
  'production-order-completed', 'building-demolished', 'vein-exhausted', 'unit-starved', 'unit-struck',
  'projectile-fired', 'stone-thrown', 'match-ended', 'peace-ended', 'unit-killed', 'troop-hungry', 'season-changed', 'unit-converted',
] as const satisfies readonly GameEvent['type'][];

type Faltando = Exclude<GameEvent['type'], (typeof EVENTOS_DA_SIM)[number]>;
/** Nao compila se faltar `type` na lista. */
export const _TODOS: [Faltando] extends [never] ? true : Faltando = true;
