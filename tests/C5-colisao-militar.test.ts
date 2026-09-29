/**
 * C5 — colisao militar (fila do operador, item 5; GDD §6.4: "Militares colidem"; plano em
 * docs/planos/2026-09-28-C5-colisao-militar.md). Aceite:
 *  (a) dois militares de frente, em campo aberto: nunca no mesmo tile, e os dois chegam;
 *  (b) um militar parado no caminho: o que anda nunca entra no tile dele, contorna e chega;
 *  (c) o destino ocupado por um militar parado: o que anda para colado, ocioso;
 *  (d) civil nao colide: serf e militar dividem tile;
 *  (e) um grupo de 9 marchando nunca poe dois militares no mesmo tile, e chega;
 *  (f) a mesma corrida duas vezes da o mesmo estado;
 *  (g) C-MOVIMENTO-01: quem espera nao e desenhado recuando (o passo confere o tile antes).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Command } from '../src/sim/commands';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo, classeDaUnidade } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { posicaoDaUnidade } from '../src/sim/selectors';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const semCivis = (s: GameState): GameState => ({ ...s, unidades: { porId: {}, ordem: [] } });
function unidade(id: string, tipo: string, t: { gx: number; gy: number }): Unidade {
  return { lado: LADO_DO_JOGADOR, id, tipo, gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tipo) };
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
/** Um campo aberto de 25 x 25 tiles andaveis. */
function campo(s: GameState): { gx: number; gy: number } {
  for (let r = 8; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const c = naVila(d, r);
      let livre = true;
      for (let dy = -12; dy <= 12 && livre; dy += 1) for (let dx = -12; dx <= 12 && livre; dx += 1) livre = tileAndavel(s, { gx: c.gx + dx, gy: c.gy + dy }, 'livre', gameData);
      if (livre) return c;
    }
  }
  throw new Error('fixture: sem campo aberto');
}
const mover = (ids: string[], destino: { gx: number; gy: number }): Command => ({ type: 'MoveUnits', unidades: ids, destino });
/** Pares de militares no mesmo tile neste estado. */
function sobrepostos(s: GameState): string[] {
  const vistos = new Map<string, string>();
  const erros: string[] = [];
  for (const id of s.unidades.ordem) {
    const u = s.unidades.porId[id];
    if (u === undefined || classeDaUnidade(u.tipo, gameData) !== 'militar') continue;
    const k = `${u.gx},${u.gy}`;
    const outro = vistos.get(k);
    if (outro !== undefined) erros.push(`${outro}+${id}@${k}`);
    else vistos.set(k, id);
  }
  return erros;
}
function correr(s0: GameState, cmds: Command[], ticks: number): { s: GameState; sobreposicoes: string[] } {
  let s = step(s0, cmds, gameData);
  const sobreposicoes: string[] = [...sobrepostos(s)];
  for (let t = 0; t < ticks; t += 1) {
    s = step(s, [], gameData);
    sobreposicoes.push(...sobrepostos(s));
  }
  return { s, sobreposicoes };
}
const pos = (s: GameState, id: string): string => `${s.unidades.porId[id]?.gx},${s.unidades.porId[id]?.gy}`;

describe('C5 — militares colidem', () => {
  const base = semCivis(createInitialState(1));
  const c = campo(base);

  it('(a) dois de frente em campo aberto: nunca no mesmo tile, e os dois chegam', () => {
    const s0 = com(base, unidade('a', 'militia', { gx: c.gx - 6, gy: c.gy }), unidade('b', 'militia', { gx: c.gx + 6, gy: c.gy }));
    let s = step(s0, [mover(['a'], { gx: c.gx + 6, gy: c.gy }), mover(['b'], { gx: c.gx - 6, gy: c.gy })], gameData);
    const sob: string[] = [];
    for (let t = 0; t < 600; t += 1) {
      s = step(s, [], gameData);
      sob.push(...sobrepostos(s));
    }
    expect(sob).toEqual([]);
    expect([pos(s, 'a'), pos(s, 'b')]).toEqual([`${c.gx + 6},${c.gy}`, `${c.gx - 6},${c.gy}`]);
  });

  it('(b) um parado no caminho: o que anda nunca entra no tile dele, contorna e chega', () => {
    const s0 = com(base, unidade('anda', 'militia', { gx: c.gx - 5, gy: c.gy }), unidade('parado', 'militia', { gx: c.gx, gy: c.gy }));
    const r = correr(s0, [mover(['anda'], { gx: c.gx + 5, gy: c.gy })], 600);
    expect(r.sobreposicoes).toEqual([]);
    expect(pos(r.s, 'anda')).toBe(`${c.gx + 5},${c.gy}`);
    expect(pos(r.s, 'parado')).toBe(`${c.gx},${c.gy}`);
    gravarEvidencia('C5-contorno', { chegou: pos(r.s, 'anda'), tick: r.s.tick });
  });

  it('(c) o destino ocupado por um parado: o que anda para colado, ocioso', () => {
    const s0 = com(base, unidade('anda', 'militia', { gx: c.gx - 5, gy: c.gy }), unidade('parado', 'militia', { gx: c.gx, gy: c.gy }));
    const r = correr(s0, [mover(['anda'], { gx: c.gx, gy: c.gy })], 300);
    expect(r.sobreposicoes).toEqual([]);
    const a = r.s.unidades.porId['anda'] as Unidade;
    expect(Math.max(Math.abs(a.gx - c.gx), Math.abs(a.gy - c.gy))).toBe(1);
    expect(a.fsm).toBe('ocioso');
  });

  it('(d) civil nao colide: o militar entra no tile do serf, e o serf no do militar', () => {
    const s0 = com(base, unidade('anda', 'militia', { gx: c.gx - 3, gy: c.gy }), unidade('serf', 'serf', { gx: c.gx, gy: c.gy }));
    let s = step(s0, [mover(['anda'], { gx: c.gx, gy: c.gy })], gameData);
    for (let t = 0; t < 200; t += 1) s = step(s, [], gameData);
    expect(pos(s, 'anda')).toBe(`${c.gx},${c.gy}`);
  });

  it('(e) um grupo de 9 atravessa outro de 9 parado sem sobrepor ninguem, e chega', () => {
    const ids = Array.from({ length: 9 }, (_, i) => `g${i}`);
    const grupo = ids.map((id, i) => unidade(id, 'militia', { gx: c.gx - 8 + (i % 3), gy: c.gy - 1 + Math.floor(i / 3) }));
    const muro = Array.from({ length: 9 }, (_, i) => unidade(`m${i}`, 'militia', { gx: c.gx - 1 + (i % 3), gy: c.gy - 1 + Math.floor(i / 3) }));
    const r = correr(com(base, ...grupo, ...muro), [mover(ids, { gx: c.gx + 8, gy: c.gy })], 1200);
    expect(r.sobreposicoes).toEqual([]);
    const chegaram = ids.filter((id) => r.s.unidades.porId[id]?.fsm === 'ocioso' && Math.abs((r.s.unidades.porId[id]?.gx ?? 0) - (c.gx + 8)) <= 2);
    expect(chegaram).toHaveLength(9);
  });

  it('(f) a mesma corrida duas vezes da o mesmo estado', () => {
    const correrUma = (): GameState => {
      const ids = Array.from({ length: 9 }, (_, i) => `g${i}`);
      const grupo = ids.map((id, i) => unidade(id, 'militia', { gx: c.gx - 8 + (i % 3), gy: c.gy - 1 + Math.floor(i / 3) }));
      return correr(com(base, ...grupo, unidade('p', 'militia', c)), [mover(ids, { gx: c.gx + 8, gy: c.gy })], 400).s;
    };
    expect(salvar(correrUma())).toBe(salvar(correrUma()));
  });

  it('(g) C-MOVIMENTO-01: nenhum militar e desenhado recuando', () => {
    // Recuo: o tile da unidade nao muda entre dois ticks e o desenho salta mais de meio tile.
    // Era o "volta ao tile anterior" da partida: segurar o passo a `custo - 1` e zerar ao desviar.
    const recuos = (s0: GameState, cmds: Command[], ticks: number): { recuos: number; passos: number; sob: string[] } => {
      let s = step(s0, cmds, gameData);
      let n = 0;
      let passos = 0;
      const sob: string[] = [];
      for (let t = 0; t < ticks; t += 1) {
        const antes = s;
        s = step(s, [], gameData);
        sob.push(...sobrepostos(s));
        for (const id of s.unidades.ordem) {
          const u0 = antes.unidades.porId[id];
          const u1 = s.unidades.porId[id];
          if (u0 === undefined || u1 === undefined) continue;
          if (u0.gx !== u1.gx || u0.gy !== u1.gy) { passos += 1; continue; }
          const p0 = posicaoDaUnidade(antes, u0, gameData);
          const p1 = posicaoDaUnidade(s, u1, gameData);
          if (Math.hypot(p1.gx - p0.gx, p1.gy - p0.gy) > 0.5) n += 1;
        }
      }
      return { recuos: n, passos, sob };
    };
    const frente = recuos(
      com(base, unidade('a', 'militia', { gx: c.gx - 6, gy: c.gy }), unidade('b', 'militia', { gx: c.gx + 6, gy: c.gy })),
      [mover(['a'], { gx: c.gx + 6, gy: c.gy }), mover(['b'], { gx: c.gx - 6, gy: c.gy })], 600,
    );
    const ids9 = Array.from({ length: 9 }, (_, i) => `g${i}`);
    const muro = recuos(
      com(base, ...ids9.map((id, i) => unidade(id, 'militia', { gx: c.gx - 8 + (i % 3), gy: c.gy - 1 + Math.floor(i / 3) })),
        ...Array.from({ length: 9 }, (_, i) => unidade(`m${i}`, 'militia', { gx: c.gx - 1 + (i % 3), gy: c.gy - 1 + Math.floor(i / 3) }))),
      [mover(ids9, { gx: c.gx + 8, gy: c.gy })], 1200,
    );
    // a tropa da escaramuca: 18 em duas fileiras de 9, para longe e junto
    const ids18 = Array.from({ length: 18 }, (_, i) => `t${i}`);
    const tropa = recuos(
      com(base, ...ids18.map((id, i) => unidade(id, 'militia', { gx: c.gx - 10 + (i % 9), gy: c.gy - 1 + Math.floor(i / 9) }))),
      [mover(ids18, { gx: c.gx + 8, gy: c.gy + 6 })], 1200,
    );
    gravarEvidencia('C-MOVIMENTO-01', {
      frente: { recuos: frente.recuos, passos: frente.passos },
      grupoAtravessaMuro: { recuos: muro.recuos, passos: muro.passos },
      tropaDe18: { recuos: tropa.recuos, passos: tropa.passos },
    });
    expect([frente.sob, muro.sob, tropa.sob]).toEqual([[], [], []]);
    expect([frente.recuos, muro.recuos, tropa.recuos]).toEqual([0, 0, 0]);
  });
});
