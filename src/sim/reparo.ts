/**
 * F-CERCO-b — a regra do REPARO, num lugar so: quem pede laborer e por que o comando
 * e recusado. O gerador, o saneamento, o claim e a FSM do laborer perguntam AQUI, e
 * nao cada um a sua copia de "predio completo, ligado e abaixo do total".
 */
import type { GameState, Predio } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { hpTotalDoTipo } from './obra';

export type MotivoDeRecusaDeReparo = 'predio-inexistente' | 'predio-em-obra';

/** `SetBuildingRepair` so vale em predio COMPLETO: obra nao tem reparo, tem martelada. */
export function motivoDaRecusaDeReparo(predio: Predio | undefined): MotivoDeRecusaDeReparo | null {
  if (predio === undefined) return 'predio-inexistente';
  if (predio.estado !== 'completo') return 'predio-em-obra';
  return null;
}

/** O predio pede reparo agora: completo, com o reparo ligado e o `hp` abaixo do total. */
export function predioReparavel(state: GameState, predioId: string, dados: GameData = gameData): boolean {
  const p = state.predios.porId[predioId];
  return p !== undefined && p.estado === 'completo' && p.reparo && p.hp < hpTotalDoTipo(p.tipo, dados);
}
