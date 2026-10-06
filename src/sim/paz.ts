/**
 * C-IA-03b (cenario de escaramuca: peacetime e tropas; plano em
 * docs/planos/2026-09-29-C-IA-03-cenario-de-escaramuca.md) — o PEACETIME do KaM.
 *
 * Enquanto `state.tick < state.pazAteTick`, a partida esta em paz:
 *  - as ordens de COMBATE sao recusadas com `em-paz`: ataque a unidade, ataque a predio,
 *    treino no quartel e mercenario na prefeitura — a lista do KaM (`BLOCKED_BY_PEACETIME`,
 *    KM_GameInputProcess.pas:153-155: walk, attack unit, attack house, barracks equip, town
 *    hall equip; o resto dela e formacao, split, link, halt e storm) MENOS a marcha. O
 *    mercenario (BUG-S) tinha ficado de fora;
 *  - a IA nao defende, nao repoe e nao ataca (KaM: KM_AIGeneral.pas:218, 331, 395) — ver
 *    `sistemaDaIA`. Alimentar a tropa continua: no KaM `CheckArmy` alimenta antes do
 *    guarda de paz (KM_AIGeneral.pas:316-331).
 * Isto responde "se ela fica parada, eu marcho ate a vila dela e espero la fora": nao.
 *
 * C-COMBATE-02b — a MARCHA e livre em paz, e isso DIVERGE do KaM por decisao do operador
 * (2026-09-29, segunda partida): "REMOVA a cerca da paz. Ela impede os meus soldados de
 * avancar no mapa". A cerca da C-COMBATE-02 (marcha a ate N tiles da vila) saiu inteira.
 *
 * O campo so existe no estado da escaramuca (`criarEscaramuca`); o jogo livre nao tem paz.
 * A duracao vem do cenario (`data/escaramuca.json`): o padrao, ou a que o jogador escolheu antes da
 * escaramuca (E-TELA-CONFIGURAR-PARTIDA, `criarEscaramuca(semente, dados, { pazMinBase })`). Vira
 * parametro de fase no sistema de
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
 * A recusa de um comando de combate em paz, ou `null` se o comando passa. Uma recusa por
 * comando, no formato do `command-rejected` de cada tipo, com o motivo `em-paz`. A marcha
 * passa (C-COMBATE-02b).
 */
export function recusaNaPaz(state: GameState, command: Command): GameEvent | null {
  if (!emPaz(state)) return null;
  switch (command.type) {
    case 'AttackUnit':
      return { type: 'command-rejected', command: 'AttackUnit', alvo: command.alvo, unidade: null, motivo: 'em-paz' };
    case 'AttackBuilding':
      return { type: 'command-rejected', command: 'AttackBuilding', predio: command.predio, unidade: null, motivo: 'em-paz' };
    // C-COMBATE-01b: o storm esta no BLOCKED_BY_PEACETIME do KaM (PARA REVISAO: a marcha saiu)
    case 'StormAttack':
      return { type: 'command-rejected', command: 'StormAttack', unidade: null, motivo: 'em-paz' };
    // I-COMBATE-CONVERTER: converter e ordem de guerra
    case 'ConvertUnit':
      return { type: 'command-rejected', command: 'ConvertUnit', padre: command.padre, alvo: command.alvo, motivo: 'em-paz' };
    case 'TrainSoldier':
      return { type: 'command-rejected', command: 'TrainSoldier', predio: command.predio, tipo: command.tipo, motivo: 'em-paz' };
    // BUG-S: o equipar da prefeitura (mercenario) esta na lista do KaM (gicHouseTownHallEquip)
    case 'HireMercenary':
      return { type: 'command-rejected', command: 'HireMercenary', predio: command.predio, tipo: command.tipo, motivo: 'em-paz' };
    default:
      return null;
  }
}
