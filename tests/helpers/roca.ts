import type { GameState } from '../../src/sim/state';
import type { GameData } from '../../src/sim/data/types';
import { gameData } from '../../src/sim/data';

/**
 * I-OBRA-SEM-PREDIO-NA-ROCA — o estado sem roca: tira os recursos de tipo que se ara (`aradura` no dado,
 * o mesmo predicado do `canPlace`) e os campos planejados. Para a fixture cujo lote cai, por acaso, no
 * rocado de partida do mapa (o `campoArado` abaixo da vila e a cana do mapa), e cujo assunto nao e a roca.
 */
export function semRoca(estado: GameState, dados: GameData = gameData): GameState {
  const recursos = Object.fromEntries(Object.entries(estado.recursos)
    .filter(([, r]) => (dados.recursos.tipos[r.tipo]?.aradura ?? null) === null));
  return { ...estado, recursos, camposPlanejados: {} };
}
