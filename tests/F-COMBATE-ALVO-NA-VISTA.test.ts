/**
 * F-COMBATE-ALVO-NA-VISTA — ordem so contra o inimigo que se ve (aceite no BUILD_PLAN, Fase F).
 * `AttackUnit` e `AttackBuilding` do jogador contra alvo fora do `visivel` sao recusados com
 * `alvo-fora-da-vista`, e o estado fica igual. A IA nao muda: ela nao passa por comando.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { criarEscaramuca } from '../src/sim/cenario';
import { step } from '../src/sim/tick';
import { salvar } from '../src/sim/save';
import { predioNaVista, unidadeNaVista } from '../src/sim/nevoa';
import { FSM_INDO_LUTAR } from '../src/sim/systems/combate';
import { comOlheiro } from './helpers/vista';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
/** A escaramuca sem a paz: em paz o ataque e recusado antes (C-IA-03b). */
const s0: GameState = { ...criarEscaramuca(SEMENTE), pazAteTick: 0 };
const todas = (s: GameState): Unidade[] => s.unidades.ordem.map((id) => s.unidades.porId[id] as Unidade);
const tropa = todas(s0).filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === gameData.escaramuca.tropaDoJogador.tipo).map((u) => u.id);
const inimigo = todas(s0).find((u) => u.lado === LADO_DA_IA && u.tipo === 'militia') as Unidade;
const quartelDaIA = s0.predios.ordem.map((id) => s0.predios.porId[id]).find((p) => p?.lado === LADO_DA_IA && p.tipo === 'barracks');
if (quartelDaIA === undefined) throw new Error('fixture: o quartel da IA');

const recusas = (s: GameState): unknown[] => s.events.filter((e) => e.type === 'command-rejected');
/** O estado do tick, sem a lista de eventos: o que a recusa nao pode mudar. */
const semEventos = (s: GameState): string => salvar({ ...s, events: [] });

describe('F-COMBATE-ALVO-NA-VISTA — (a) fora da vista, recusa e estado igual', () => {
  const casos: [string, Command][] = [
    ['AttackUnit', { type: 'AttackUnit', unidades: tropa, alvo: inimigo.id }],
    ['AttackBuilding', { type: 'AttackBuilding', unidades: tropa, predio: quartelDaIA.id }],
  ];
  for (const [nome, cmd] of casos) {
    it(`${nome}: o alvo da vila da IA, a ~40 tiles, nao esta a vista`, () => {
      expect(unidadeNaVista(s0, inimigo.id)).toBe(false);
      expect(predioNaVista(s0, quartelDaIA.id)).toBe(false);
      const r = step(s0, [cmd], gameData);
      expect(recusas(r)).toEqual([expect.objectContaining({ command: nome, motivo: 'alvo-fora-da-vista' })]);
      expect(semEventos(r)).toBe(semEventos(step(s0, [], gameData)));
    });
  }
});

describe('F-COMBATE-ALVO-NA-VISTA — (b) com um cabra do jogador perto, aceita', () => {
  it('AttackUnit: o olheiro a menos de `visao` do inimigo da a vista, e a tropa sai para lutar', () => {
    const comVista = comOlheiro(s0, inimigo);
    expect(unidadeNaVista(comVista, inimigo.id)).toBe(true);
    const r = step(comVista, [{ type: 'AttackUnit', unidades: tropa, alvo: inimigo.id }], gameData);
    expect(recusas(r)).toEqual([]);
    expect(tropa.filter((id) => r.unidades.porId[id]?.fsm === FSM_INDO_LUTAR)).toHaveLength(tropa.length);
  });

  it('AttackBuilding: um canto do quartel a vista basta', () => {
    const comVista = comOlheiro(s0, quartelDaIA);
    expect(predioNaVista(comVista, quartelDaIA.id)).toBe(true);
    const r = step(comVista, [{ type: 'AttackBuilding', unidades: tropa, predio: quartelDaIA.id }], gameData);
    expect(recusas(r)).toEqual([]);
  });

  it('a recusa de antes continua com o motivo dela (o predio do proprio lado, o alvo que nao existe)', () => {
    const meu = s0.predios.ordem.find((id) => s0.predios.porId[id]?.lado === LADO_DO_JOGADOR) as string;
    const r1 = step(s0, [{ type: 'AttackBuilding', unidades: tropa, predio: meu }], gameData);
    expect(recusas(r1)).toEqual([expect.objectContaining({ motivo: 'predio-do-proprio-lado' })]);
    const r2 = step(s0, [{ type: 'AttackUnit', unidades: tropa, alvo: 'fantasma' }], gameData);
    expect(recusas(r2)).toEqual([expect.objectContaining({ motivo: 'alvo-inexistente' })]);
  });

  it('a IA nao passa pela regra: a ordem dada a tropa da IA, contra o jogador longe, e aceita', () => {
    const daIA = todas(s0).filter((u) => u.lado === LADO_DA_IA && u.tipo === 'militia').map((u) => u.id);
    const r = step(s0, [{ type: 'AttackUnit', unidades: daIA, alvo: tropa[0] as string }], gameData);
    expect(recusas(r)).toEqual([]);
  });

  it('estado sem a nevoa (montado a mao, save de antes da F): sem recusa pela vista', () => {
    const { descoberto: _d, ...semNevoa } = s0;
    const r = step(semNevoa, [{ type: 'AttackUnit', unidades: tropa, alvo: inimigo.id }], gameData);
    expect(recusas(r)).toEqual([]);
  });
});

describe('F-COMBATE-ALVO-NA-VISTA — (c) o alvo que sai da vista no meio do ataque', () => {
  it('a tropa segue o alvo ja escolhido (KaM, src/units/KM_UnitGroup.pas:1083-1092)', () => {
    // o olheiro da a vista, a ordem e aceita, e no tick seguinte o olheiro some (morreu):
    // o inimigo sai da vista, e quem ja tinha a ordem continua indo lutar com ele
    const atacante = tropa[0] as string;
    let s = step(comOlheiro(s0, inimigo), [{ type: 'AttackUnit', unidades: [atacante], alvo: inimigo.id }], gameData);
    expect(recusas(s)).toEqual([]);
    const { olheiro: _o, ...semOlheiro } = s.unidades.porId;
    s = { ...s, unidades: { porId: semOlheiro, ordem: s.unidades.ordem.filter((id) => id !== 'olheiro') } };
    let foraDaVistaEIndo = 0;
    let largou = 0;
    for (let t = 0; t < 200; t++) {
      s = step(s, [], gameData);
      const u = s.unidades.porId[atacante];
      if (u === undefined || s.unidades.porId[inimigo.id] === undefined) break;
      if (unidadeNaVista(s, inimigo.id)) break;
      if (u.fsm === FSM_INDO_LUTAR && u.fsmData.alvoUnidade === inimigo.id) foraDaVistaEIndo += 1;
      else largou += 1;
    }
    gravarEvidencia('F-COMBATE-ALVO-NA-VISTA-segue-o-alvo', { ticksForaDaVistaIndo: foraDaVistaEIndo, ticksQueLargou: largou });
    expect(foraDaVistaEIndo).toBeGreaterThan(0);
    expect(largou).toBe(0);
  });
});
