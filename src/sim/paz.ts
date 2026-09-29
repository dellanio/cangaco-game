/**
 * C-IA-03b (cenario de escaramuca: peacetime e tropas; plano em
 * docs/planos/2026-09-29-C-IA-03-cenario-de-escaramuca.md) — o PEACETIME do KaM.
 *
 * Enquanto `state.tick < state.pazAteTick`, a partida esta em paz:
 *  - as ordens de EXERCITO sao recusadas com `em-paz`: marcha, ataque a unidade, ataque a
 *    predio e treino no quartel — a lista do KaM (`BLOCKED_BY_PEACETIME`,
 *    KM_GameInputProcess.pas:153-155: walk, attack unit, attack house, barracks equip; o
 *    resto dela e formacao, split, link, halt e storm, que a sim ainda nao tem);
 *  - a IA nao defende, nao repoe e nao ataca (KaM: KM_AIGeneral.pas:218, 331, 395) — ver
 *    `sistemaDaIA`. Alimentar a tropa continua: no KaM `CheckArmy` alimenta antes do
 *    guarda de paz (KM_AIGeneral.pas:316-331).
 * Isto responde "se ela fica parada, eu marcho ate a vila dela e espero la fora": nao,
 * porque ninguem marcha em paz.
 *
 * O campo so existe no estado da escaramuca (`criarEscaramuca`); o jogo livre nao tem paz.
 * O valor e FIXO no cenario (`data/escaramuca.json`) e vira parametro de fase no sistema de
 * fases.
 */
import type { Command } from './commands';
import type { GameEvent, GameState } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';

/** A partida esta em paz AGORA (no tick em que os comandos deste step sao aplicados)? */
export function emPaz(state: GameState): boolean {
  return state.pazAteTick !== undefined && state.tick < state.pazAteTick;
}

/** Quantos ticks faltam para a paz acabar; 0 fora da paz. E o contador da tela. */
export function ticksDePazRestantes(state: GameState): number {
  return emPaz(state) ? (state.pazAteTick as number) - state.tick : 0;
}

/** Os SEGUNDOS de jogo que faltam para a paz acabar, arredondados para cima (o contador
 *  nunca mostra 0:00 com a paz ainda valendo). 0 fora da paz. */
export function segundosDePazRestantes(state: GameState, dados: GameData = gameData): number {
  return Math.ceil(ticksDePazRestantes(state) / dados.tempo.tickHz);
}

/**
 * A recusa de um comando de exercito em paz, ou `null` se o comando passa. Uma recusa por
 * comando, no formato do `command-rejected` de cada tipo, com o motivo `em-paz`.
 */
export function recusaNaPaz(state: GameState, command: Command): GameEvent | null {
  if (!emPaz(state)) return null;
  switch (command.type) {
    case 'MoveUnits':
      return { type: 'command-rejected', command: 'MoveUnits', unidade: null, motivo: 'em-paz' };
    case 'AttackUnit':
      return { type: 'command-rejected', command: 'AttackUnit', alvo: command.alvo, unidade: null, motivo: 'em-paz' };
    case 'AttackBuilding':
      return { type: 'command-rejected', command: 'AttackBuilding', predio: command.predio, unidade: null, motivo: 'em-paz' };
    case 'TrainSoldier':
      return { type: 'command-rejected', command: 'TrainSoldier', predio: command.predio, tipo: command.tipo, motivo: 'em-paz' };
    default:
      return null;
  }
}
