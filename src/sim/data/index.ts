import { deepFreeze } from '../freeze';
import { rawGameData } from './raw';
import { loadGameData } from './loader';
import type { GameData } from './types';

/**
 * O `GameData` carregado, uma vez, e congelado em profundidade. Singleton
 * importado por todo `sim/` — se nao fosse congelado ate as folhas, um
 * sistema escrevendo em `gameData.predios[0]` ou em `gameData.conversoes`
 * contaminaria todos os outros importadores e quebraria o determinismo sem
 * deixar rastro (ver `src/sim/freeze.ts`).
 *
 * I-TERRENO-FASE-NA-SIM — e uma ligacao viva (`export let`): a partida de campanha troca o mapa UMA
 * vez, antes do `main.ts` (`usarDadosDaFase`). Quem le `gameData` no momento do uso ja ve o mapa da
 * fase; quem guardou um pedaco dele numa constante de modulo antes da troca, nao.
 */
export let gameData: GameData = deepFreeze(loadGameData(rawGameData));

/** A fase cujo mapa esta no `gameData`, ou `null` no `sertao-128`. */
let faseEmUso: string | null = null;

/**
 * I-TERRENO-FASE-NA-SIM — troca o `gameData` pelo da fase (`dados` vem do `dadosDaFase`, em
 * `sim/fase.ts`, que importa este modulo e por isso nao pode ser chamado daqui). Uma vez por
 * pagina: "voltar ao menu" recarrega a pagina (`src/main.ts`), entao ninguem volta ao mapa de antes.
 * A mesma fase de novo nao muda nada; outra fase e erro.
 */
export function usarDadosDaFase(id: string, dados: GameData): void {
  if (faseEmUso === id) return;
  if (faseEmUso !== null) throw new Error(`usarDadosDaFase: a pagina ja joga '${faseEmUso}'; '${id}' pede outra pagina`);
  faseEmUso = id;
  gameData = dados;
}

export { loadGameData } from './loader';
export { rawGameData } from './raw';
export type { RawGameData } from './raw';
export type {
  GameData, Ticks, ConversaoRegistrada, GrupoDeEscala, PredioData,
} from './types';
