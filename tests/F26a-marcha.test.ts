/**
 * F26a — a ordem de mover a tropa (plano em docs/planos/2026-09-28-A9-F26-grupo.md).
 *
 * Aceite escrito na sessao autonoma (PARA REVISAO):
 *  - o grupo chega a tiles DISTINTOS e andaveis em volta do destino, o primeiro no
 *    proprio destino, e fica `ocioso`;
 *  - a ordem de mover substitui o ataque (a tropa para de golpear);
 *  - cada recusa tem motivo e deixa o estado igual;
 *  - a mesma corrida duas vezes da o mesmo estado.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Predio, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Command } from '../src/sim/commands';
import { tileAndavel } from '../src/sim/pathfinding';
import { canPlace } from '../src/sim/placement';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const semCivis = (s: GameState): GameState => ({ ...s, unidades: { porId: {}, ordem: [] } });

function comSoldados(s: GameState, n: number, lado = LADO_DO_JOGADOR, tipo = 'militia'): GameState {
  const unidades = { porId: { ...s.unidades.porId }, ordem: [...s.unidades.ordem] };
  let colocados = 0;
  for (let dx = 0; colocados < n && dx < 30; dx += 1) {
    const t = naVila(-6 + dx, 8);
    if (!tileAndavel(s, t, 'livre', gameData)) continue;
    const u: Unidade = {
      lado, id: `sold${colocados + 1}`, tipo, gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tipo),
    };
    unidades.porId[u.id] = u;
    unidades.ordem.push(u.id);
    colocados += 1;
  }
  return { ...s, unidades };
}

const mover = (unidades: readonly string[], gx: number, gy: number): Command => ({ type: 'MoveUnits', unidades, destino: { gx, gy } });
const andar = (s0: GameState, n: number): GameState => {
  let s = s0;
  for (let i = 0; i < n; i += 1) s = step(s, [], gameData);
  return s;
};

describe('F26a — a ordem de mover a tropa', () => {
  const base = semCivis(createInitialState(1));
  const destino = naVila(8, 12);

  it('o grupo chega a tiles distintos e andaveis em volta do destino, e fica ocioso', () => {
    expect(tileAndavel(base, destino, 'livre', gameData)).toBe(true);
    const s0 = comSoldados(base, 5);
    const ids = ['sold1', 'sold2', 'sold3', 'sold4', 'sold5'];
    const s = andar(step(s0, [mover(ids, destino.gx, destino.gy)], gameData), 400);
    const tiles = ids.map((id) => s.unidades.porId[id] as Unidade);
    for (const u of tiles) {
      expect(u.fsm).toBe('ocioso');
      expect(Math.max(Math.abs(u.gx - destino.gx), Math.abs(u.gy - destino.gy))).toBeLessThanOrEqual(1);
      expect(tileAndavel(s, u, 'livre', gameData)).toBe(true);
    }
    expect(new Set(tiles.map((u) => `${u.gx},${u.gy}`)).size).toBe(5);
    expect(tiles[0]).toMatchObject({ gx: destino.gx, gy: destino.gy }); // o primeiro no proprio ponto
    gravarEvidencia('F26a', { destino, chegada: tiles.map((u) => [u.gx, u.gy]), tick: s.tick });
  });

  it('a ordem de mover tira a tropa do ataque', () => {
    let s = comSoldados(base, 1);
    let lugar: { gx: number; gy: number } | null = null;
    for (let r = 4; r < 30 && lugar === null; r += 1) {
      for (let d = -r; d <= r && lugar === null; d += 1) {
        const p = naVila(d, r);
        if (canPlace(s, 'schoolhouse', p.gx, p.gy, gameData).ok) lugar = p;
      }
    }
    if (lugar === null) throw new Error('fixture: sem lugar');
    const alvo = completarObra({
      lado: LADO_DO_JOGADOR + 1, id: 'inimigo', tipo: 'schoolhouse', ...lugar, estado: 'obra', hp: 550,
      obra: { faltam: {}, nivelamento: 0 },
    }, gameData);
    s = { ...s, predios: { porId: { ...s.predios.porId, inimigo: alvo }, ordem: [...s.predios.ordem, 'inimigo'] } };
    s = step(s, [{ type: 'AttackBuilding', unidades: ['sold1'], predio: 'inimigo' }], gameData);
    while ((s.predios.porId['inimigo'] as Predio).hp === 550 && s.tick < 600) s = step(s, [], gameData);
    expect((s.predios.porId['inimigo'] as Predio).hp).toBeLessThan(550);
    s = step(s, [mover(['sold1'], destino.gx, destino.gy)], gameData);
    const hp = (s.predios.porId['inimigo'] as Predio).hp;
    s = andar(s, 300);
    expect((s.predios.porId['inimigo'] as Predio).hp).toBe(hp);
    expect(s.unidades.porId['sold1']?.fsm).toBe('ocioso');
  });

  it('recusas com motivo, e o estado fica igual', () => {
    const s0 = comSoldados(comSoldados(createInitialState(1), 1), 0);
    const civil = s0.unidades.ordem.find((id) => s0.unidades.porId[id]?.tipo === 'serf') as string;
    const inimigo = comSoldados(s0, 1, LADO_DO_JOGADOR + 1);
    const inimigoComAmigo: GameState = {
      ...inimigo,
      unidades: {
        porId: { ...inimigo.unidades.porId, amigo: { ...(s0.unidades.porId['sold1'] as Unidade), id: 'amigo' } },
        ordem: [...inimigo.unidades.ordem, 'amigo'],
      },
    };
    const agua = { gx: -1, gy: -1 };
    const casos: [GameState, Command, string][] = [
      [s0, mover([], destino.gx, destino.gy), 'sem-unidades'],
      [s0, mover(['fantasma'], destino.gx, destino.gy), 'unidade-inexistente'],
      [s0, mover([civil], destino.gx, destino.gy), 'unidade-nao-militar'],
      [inimigoComAmigo, mover(['amigo', 'sold1'], destino.gx, destino.gy), 'lados-diferentes'],
      [s0, mover(['sold1'], agua.gx, agua.gy), 'destino-inandavel'],
    ];
    for (const [s, cmd, motivo] of casos) {
      const r = step(s, [cmd], gameData);
      expect(r.events.find((e) => e.type === 'command-rejected'), motivo).toMatchObject({ command: 'MoveUnits', motivo });
      expect(salvar({ ...r, events: [] })).toBe(salvar({ ...step(s, [], gameData), events: [] }));
    }
  });

  it('a mesma corrida duas vezes da o mesmo estado', () => {
    const correr = (): GameState => andar(step(comSoldados(base, 4), [mover(['sold4', 'sold2', 'sold1', 'sold3'], destino.gx, destino.gy)], gameData), 300);
    expect(salvar(correr())).toBe(salvar(correr()));
  });
});
