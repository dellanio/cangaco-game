import { deepFreeze } from '../freeze';
import { rawGameData } from './raw';
import { loadGameData } from './loader';

/**
 * O `GameData` carregado, uma vez, e congelado em profundidade. Singleton
 * importado por todo `sim/` — se nao fosse congelado ate as folhas, um
 * sistema escrevendo em `gameData.predios[0]` ou em `gameData.conversoes`
 * contaminaria todos os outros importadores e quebraria o determinismo sem
 * deixar rastro (ver `src/sim/freeze.ts`).
 */
export const gameData = deepFreeze(loadGameData(rawGameData));

export { loadGameData } from './loader';
export { rawGameData } from './raw';
export type { RawGameData } from './raw';
export type {
  GameData, Ticks, ConversaoRegistrada, GrupoDeEscala, PredioData,
} from './types';
