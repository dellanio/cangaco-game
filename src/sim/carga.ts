/**
 * C-COMBATE-01b (storm attack) — o que a carga precisa e que o desenho tambem le: o nome do
 * estado, quem pode carregar e quanto custa o passo. O comando e o sistema estao em
 * `systems/carga.ts`; isto fica fora dele para `selectors.ts` interpolar o passo sem puxar
 * os sistemas.
 */
import type { GameState, Unidade } from './state';
import type { GameData } from './data/types';
import type { TileDeGrid } from './estradas';
import { gameData } from './data';
import { classeDaUnidade } from './condicao';
import { defDaTropa, ehADistancia } from './combate';
import { custoDoPasso } from './pathfinding';

export const FSM_EM_CARGA = 'em_carga';

/** `stormAttack.apenas` admite o tipo? `infantariaCorpoACorpo`: militar que nao atira e nao
 *  e montado (KM_Defaults.pas:685-696). O valor e o unico que `data-rules` aceita. */
export function carregaNaInvestida(tipo: string, dados: GameData = gameData): boolean {
  if (dados.combate.stormAttack.apenas !== 'infantariaCorpoACorpo') return false;
  const def = defDaTropa(tipo, dados);
  return classeDaUnidade(tipo, dados) === 'militar' && def !== null && !ehADistancia(tipo, dados) && def.montado !== true;
}

/** A unidade esta em carga e a carga nao aceita ordem: `MoveUnits`, `AttackUnit` e
 *  `AttackBuilding` a pulam. */
export function emCargaIncontrolavel(u: Unidade | undefined, dados: GameData = gameData): boolean {
  return u !== undefined && u.fsm === FSM_EM_CARGA && dados.combate.stormAttack.incontrolavel;
}

/** Ticks do passo de `u` para `para`: o de `custoDoPasso`, e em carga dividido por
 *  `stormAttack.multiplicadorVelocidade` (arredondado, nunca abaixo de 1). */
export function custoDoPassoDaUnidade(
  state: GameState, u: Unidade, para: TileDeGrid, dados: GameData = gameData,
): number {
  const custo = custoDoPasso(state.estradas, { gx: u.gx, gy: u.gy }, para, dados);
  if (u.fsm !== FSM_EM_CARGA) return custo;
  return Math.max(1, Math.round(custo / dados.combate.stormAttack.multiplicadorVelocidade));
}
