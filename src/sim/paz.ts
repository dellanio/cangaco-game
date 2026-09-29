/**
 * C-IA-03b (cenario de escaramuca: peacetime e tropas; plano em
 * docs/planos/2026-09-29-C-IA-03-cenario-de-escaramuca.md) — o PEACETIME do KaM.
 *
 * Enquanto `state.tick < state.pazAteTick`, a partida esta em paz:
 *  - as ordens de EXERCITO sao recusadas com `em-paz`: marcha, ataque a unidade, ataque a
 *    predio, treino no quartel e mercenario na prefeitura — a lista do KaM
 *    (`BLOCKED_BY_PEACETIME`, KM_GameInputProcess.pas:153-155: walk, attack unit, attack
 *    house, barracks equip, town hall equip; o resto dela e formacao, split, link, halt e
 *    storm, que a sim ainda nao tem). O mercenario (BUG-S) tinha ficado de fora;
 *  - a IA nao defende, nao repoe e nao ataca (KaM: KM_AIGeneral.pas:218, 331, 395) — ver
 *    `sistemaDaIA`. Alimentar a tropa continua: no KaM `CheckArmy` alimenta antes do
 *    guarda de paz (KM_AIGeneral.pas:316-331).
 * Isto responde "se ela fica parada, eu marcho ate a vila dela e espero la fora": nao.
 *
 * C-COMBATE-02 — a CERCA da paz, que DIVERGE do KaM por decisao do operador (2026-09-29):
 * "posicionar tropa na propria vila e preparacao, nao ataque". A marcha passa em paz se o
 * destino esta a ate `cercaDaPaz_tiles` da caixa de um predio PRONTO do lado das unidades;
 * fora disso, `longe-na-paz`. As outras quatro ordens seguem `em-paz`.
 *
 * O campo so existe no estado da escaramuca (`criarEscaramuca`); o jogo livre nao tem paz.
 * O valor e FIXO no cenario (`data/escaramuca.json`) e vira parametro de fase no sistema de
 * fases.
 */
import type { Command } from './commands';
import type { GameEvent, GameState } from './state';
import type { GameData } from './data/types';
import type { TileDeGrid } from './estradas';
import { gameData } from './data';
import { caixaDoPredio } from './footprint';

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
 * C-COMBATE-02 — o tile esta dentro da cerca da paz do `lado`: a ate `cercaDaPaz_tiles`
 * (Chebyshev) da caixa de algum predio PRONTO dele. Obra nao conta: a cerca e da vila que
 * existe, nao da planta.
 */
export function dentroDaCercaDaPaz(state: GameState, tile: TileDeGrid, lado: number, dados: GameData = gameData): boolean {
  const n = dados.escaramuca.cercaDaPaz_tiles;
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p === undefined || p.lado !== lado || p.estado !== 'completo') continue;
    const c = caixaDoPredio(p, dados);
    if (c === null) continue;
    // a caixa e [x0, x1) x [y0, y1)
    const dx = Math.max(c.x0 - tile.gx, 0, tile.gx - (c.x1 - 1));
    const dy = Math.max(c.y0 - tile.gy, 0, tile.gy - (c.y1 - 1));
    if (Math.max(dx, dy) <= n) return true;
  }
  return false;
}

/**
 * A recusa de um comando de exercito em paz, ou `null` se o comando passa. Uma recusa por
 * comando, no formato do `command-rejected` de cada tipo, com o motivo `em-paz` — ou, na
 * marcha, `longe-na-paz` quando o destino sai da cerca (C-COMBATE-02).
 */
export function recusaNaPaz(state: GameState, command: Command, dados: GameData = gameData): GameEvent | null {
  if (!emPaz(state)) return null;
  switch (command.type) {
    case 'MoveUnits': {
      // o lado e o das unidades; lista vazia ou unidade que nao existe, a marcha recusa
      const primeira = command.unidades.map((id) => state.unidades.porId[id]).find((u) => u !== undefined);
      if (primeira === undefined || dentroDaCercaDaPaz(state, command.destino, primeira.lado, dados)) return null;
      return { type: 'command-rejected', command: 'MoveUnits', unidade: null, motivo: 'longe-na-paz' };
    }
    case 'AttackUnit':
      return { type: 'command-rejected', command: 'AttackUnit', alvo: command.alvo, unidade: null, motivo: 'em-paz' };
    case 'AttackBuilding':
      return { type: 'command-rejected', command: 'AttackBuilding', predio: command.predio, unidade: null, motivo: 'em-paz' };
    case 'TrainSoldier':
      return { type: 'command-rejected', command: 'TrainSoldier', predio: command.predio, tipo: command.tipo, motivo: 'em-paz' };
    // BUG-S: o equipar da prefeitura (mercenario) esta na lista do KaM (gicHouseTownHallEquip)
    case 'HireMercenary':
      return { type: 'command-rejected', command: 'HireMercenary', predio: command.predio, tipo: command.tipo, motivo: 'em-paz' };
    default:
      return null;
  }
}
