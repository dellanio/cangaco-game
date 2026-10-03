/**
 * C6 — revidar enquanto marcha (fila do operador, item 6; plano em
 * docs/planos/2026-09-28-C6-revidar-marchando.md). Aceite:
 *  (a) o militar marchando que passa encostado num inimigo luta com ele;
 *  (b) vencida a luta, retoma a marcha e chega ao destino original;
 *  (c) ordem nova durante a luta apaga o destino velho;
 *  (d) o arqueiro marchando nao para para atirar;
 *  (e) determinismo.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Command } from '../src/sim/commands';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';
import { comOlheiro } from './helpers/vista';

const INIMIGO = LADO_DO_JOGADOR + 1;
const semCivis = (s: GameState): GameState => ({ ...s, unidades: { porId: {}, ordem: [] } });
function unidade(id: string, tipo: string, lado: number, t: { gx: number; gy: number }, extra: Partial<Unidade> = {}): Unidade {
  return { lado, id, tipo, gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tipo), ...extra };
}
function com(s: GameState, ...us: Unidade[]): GameState {
  const porId = { ...s.unidades.porId };
  const ordem = [...s.unidades.ordem];
  for (const u of us) {
    porId[u.id] = u;
    ordem.push(u.id);
  }
  return { ...s, unidades: { porId, ordem } };
}
function campo(s: GameState): { gx: number; gy: number } {
  for (let r = 8; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const c = naVila(d, r);
      let livre = true;
      for (let dy = -8; dy <= 8 && livre; dy += 1) for (let dx = -10; dx <= 10 && livre; dx += 1) livre = tileAndavel(s, { gx: c.gx + dx, gy: c.gy + dy }, 'livre', gameData);
      if (livre) return c;
    }
  }
  throw new Error('fixture: sem campo');
}
const mover = (id: string, destino: { gx: number; gy: number }): Command => ({ type: 'MoveUnits', unidades: [id], destino });

describe('C6 — revidar enquanto marcha', () => {
  const base = semCivis(createInitialState(1));
  const c = campo(base);
  // o marchador sai a oeste e vai a leste pela linha c.gy; o inimigo fica colado a linha,
  // um tile ao norte, no meio do caminho, parado e fraco (HP 1)
  const marchador = unidade('m', 'militia', LADO_DO_JOGADOR, { gx: c.gx - 8, gy: c.gy }, { hp: 99 });
  // o inimigo e um ARQUEIRO colado: nao luta de perto e nao atira a menos de 4 tiles, entao
  // nao inicia luta nenhuma — se houver golpe do marchador, foi ELE que revidou andando
  const inimigo = unidade('i', 'bowman', INIMIGO, { gx: c.gx, gy: c.gy - 1 }, { hp: 1, direcao: 0 });
  const destino = { gx: c.gx + 8, gy: c.gy };

  function correr(s0: GameState, ticks: number, cmdsNoTick: Record<number, Command[]> = {}): { s: GameState; golpes: GameEvent[]; estados: string[]; ondeGolpeou: { gx: number; gy: number } | null } {
    let s = s0;
    const golpes: GameEvent[] = [];
    const estados: string[] = [];
    let ondeGolpeou: { gx: number; gy: number } | null = null;
    for (let t = 0; t < ticks; t += 1) {
      s = step(s, cmdsNoTick[t] ?? [], gameData);
      const deM = s.events.filter((e) => e.type === 'unit-struck' && e.atacante === 'm');
      if (deM.length > 0 && ondeGolpeou === null) ondeGolpeou = { gx: s.unidades.porId['m']?.gx ?? -1, gy: s.unidades.porId['m']?.gy ?? -1 };
      golpes.push(...deM);
      estados.push(s.unidades.porId['m']?.fsm ?? '-');
    }
    return { s, golpes, estados, ondeGolpeou };
  }

  it('(a)(b) passa encostado, luta, vence e retoma a marcha ate o destino', () => {
    const r = correr(com(base, marchador, inimigo), 1500, { 0: [mover('m', destino)] });
    expect(r.golpes.length).toBeGreaterThan(0); // revidou
    // e revidou NO CAMINHO, perto do inimigo, nao depois de chegar ao destino
    expect(r.ondeGolpeou).not.toBeNull();
    expect(Math.abs((r.ondeGolpeou?.gx ?? 0) - c.gx)).toBeLessThanOrEqual(1);
    expect(r.s.unidades.porId['i']).toBeUndefined(); // venceu
    expect(r.estados).toContain('lutando');
    const m = r.s.unidades.porId['m'] as Unidade;
    expect(`${m.gx},${m.gy}`).toBe(`${destino.gx},${destino.gy}`); // retomou e chegou
    expect(m.retomarMarcha).toBeUndefined();
    gravarEvidencia('C6-revidou', { golpes: r.golpes.length, chegou: `${m.gx},${m.gy}` });
  });

  it('(c) ordem nova durante a luta apaga o destino velho', () => {
    // a ordem nova e ATACAR um predio inimigo: ela tira a unidade da marcha (sem recontato),
    // e o destino velho tem de sumir ja no tick da ordem
    const escolaId = base.predios.ordem.find((id) => base.predios.porId[id]?.tipo === 'schoolhouse') as string;
    const escola = base.predios.porId[escolaId];
    if (escola === undefined) throw new Error('fixture: escola');
    const comEscolaInimiga: GameState = { ...base, predios: { ...base.predios, porId: { ...base.predios.porId, [escolaId]: { ...escola, lado: INIMIGO } } } };
    const forte = { ...inimigo, hp: 99 };
    let s = step(com(comEscolaInimiga, marchador, forte), [mover('m', destino)], gameData);
    for (let t = 0; t < 400 && s.unidades.porId['m']?.fsm !== 'lutando'; t += 1) s = step(s, [], gameData);
    expect(s.unidades.porId['m']?.fsm).toBe('lutando');
    expect(s.unidades.porId['m']?.retomarMarcha).toEqual(destino);
    // F-COMBATE-ALVO-NA-VISTA: a escola inimiga fica longe da luta; um olheiro do jogador a ve
    s = step(comOlheiro(s, escola), [{ type: 'AttackBuilding', unidades: ['m'], predio: escolaId }], gameData);
    expect(s.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    expect(s.unidades.porId['m']?.retomarMarcha).toBeUndefined();
  });

  it('(d) o arqueiro marchando nao para para atirar', () => {
    const arq = unidade('m', 'bowman', LADO_DO_JOGADOR, { gx: c.gx - 8, gy: c.gy }, { hp: 99, direcao: 2 });
    const longe = unidade('i', 'militia', INIMIGO, { gx: c.gx, gy: c.gy - 6 }, { hp: 99 });
    const r = correr(com(base, arq, longe), 300, { 0: [mover('m', destino)] });
    expect(r.estados).not.toContain('atirando');
    expect(r.estados).not.toContain('lutando');
  });

  it('(e) a mesma corrida duas vezes da o mesmo estado', () => {
    const uma = (): GameState => correr(com(base, marchador, inimigo), 600, { 0: [mover('m', destino)] }).s;
    expect(salvar(uma())).toBe(salvar(uma()));
  });
});
