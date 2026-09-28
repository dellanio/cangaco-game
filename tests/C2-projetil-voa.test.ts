/**
 * C2a — o projetil voa (fila do operador, item 2; plano em
 * docs/planos/2026-09-28-C2-projetil-voa.md). Aceite:
 *  (a) o dado em milesimos de tick por tile;
 *  (b) o alvo parado a d tiles e atingido `max(1, round(d x m / 1000))` ticks depois do
 *      lancamento, nao no tick do tiro;
 *  (c) erra quem andou: o alvo que sai do tile nao e atingido; o amigo que entra, e;
 *  (d) o atirador que morre com a flecha no ar nao a cancela;
 *  (e) a pedra da torre persegue o alvo marcado e o mata onde ele estiver;
 *  (f) save e load com projetil no ar: a viagem e byte a byte e a corrida segue igual;
 *  (g) a mesma corrida duas vezes da o mesmo estado.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { distanciaDaTorre } from '../src/sim/torre';
import { carregar, salvar } from '../src/sim/save';
import { comEntrada, comProdutorOcupado } from './helpers/producao-cenario';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const INIMIGO = LADO_DO_JOGADOR + 1;
const M = gameData.combate.milesimosDeTickPorTile;
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
const mover = (s: GameState, id: string, t: { gx: number; gy: number }): GameState =>
  ({ ...s, unidades: { ...s.unidades, porId: { ...s.unidades.porId, [id]: { ...(s.unidades.porId[id] as Unidade), ...t } } } });
const sem = (s: GameState, id: string): GameState => {
  const porId = { ...s.unidades.porId };
  delete porId[id];
  return { ...s, unidades: { porId, ordem: s.unidades.ordem.filter((i) => i !== id) } };
};

const D = 6;
/** Arqueiro olhando ao norte e um alvo parado a D tiles, com HP de sobra. */
function duelo(): { s: GameState; c: { gx: number; gy: number } } {
  const base = semCivis(createInitialState(1));
  for (let r = 6; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const c = naVila(d, r);
      const livre = [0, 1, 2, 3, 4, 5, 6, 7].every((k) => tileAndavel(base, { gx: c.gx, gy: c.gy - k }, 'livre', gameData)
        && tileAndavel(base, { gx: c.gx + 1, gy: c.gy - k }, 'livre', gameData));
      if (!livre) continue;
      return {
        s: com(base, unidade('arq', 'bowman', LADO_DO_JOGADOR, c, { direcao: 0 }), unidade('alvo', 'militia', INIMIGO, { gx: c.gx, gy: c.gy - D }, { hp: 9999 })),
        c,
      };
    }
  }
  throw new Error('fixture: sem campo');
}
/** Anda ate o primeiro lancamento do arqueiro; devolve o estado desse tick e o voo. */
function ateLancar(s0: GameState): { s: GameState; voo: number } {
  let s = s0;
  for (let t = 0; t < 100; t += 1) {
    s = step(s, [], gameData);
    const f = s.events.find((e): e is Extract<GameEvent, { type: 'projectile-fired' }> => e.type === 'projectile-fired' && e.de === 'arq');
    if (f !== undefined) return { s, voo: f.voo };
  }
  throw new Error('o arqueiro nao atirou');
}
/** Os golpes DA FLECHA do arqueiro neste tick (os de corpo a corpo de quem estiver
 *  encostado nao contam). */
const golpesEm = (s: GameState): string[] => s.events
  .filter((e): e is Extract<GameEvent, { type: 'unit-struck' }> => e.type === 'unit-struck' && e.atacante === 'arq').map((e) => e.alvo);

describe('C2a — o projetil voa', () => {
  it('(a) o dado: milesimos de tick por tile, na escala de combate 1,5', () => {
    const v = gameData.combate.aDistancia.velocidade_tilesPorSegundo_base as unknown as Record<string, number>;
    for (const p of ['flecha', 'virote', 'funda', 'pedraDaTorre']) {
      expect(M[p], p).toBe(Math.round((1000 * 10) / ((v[p] ?? 0) * 1.5)));
    }
    expect([M['flecha'], M['funda'], M['pedraDaTorre']]).toEqual([889, 1111, 833]);
  });

  it('(b) o alvo parado e atingido `voo` ticks depois do tiro, e nao no tick do tiro', () => {
    const { s: lancado, voo } = ateLancar(duelo().s);
    expect(voo).toBe(Math.max(1, Math.round((D * (M['flecha'] ?? 0)) / 1000)));
    expect(golpesEm(lancado)).toEqual([]);
    expect(lancado.projeteis).toHaveLength(1);
    let s = lancado;
    for (let k = 1; k < voo; k += 1) {
      s = step(s, [], gameData);
      expect(golpesEm(s), `tick +${k}`).toEqual([]);
    }
    s = step(s, [], gameData);
    expect(golpesEm(s)).toEqual(['alvo']);
    gravarEvidencia('C2-voo', { distancia: D, voo, milesimos: M['flecha'], lancadoNoTick: lancado.tick, chegouNoTick: s.tick });
  });

  it('(c) erra quem andou; o amigo que entra no tile leva a flecha', () => {
    const { s: lancado, voo } = ateLancar(duelo().s);
    const alvo = lancado.unidades.porId['alvo'] as Unidade;
    let s = mover(lancado, 'alvo', { gx: alvo.gx + 1, gy: alvo.gy });
    const golpes: string[] = [];
    for (let k = 0; k < voo; k += 1) {
      s = step(s, [], gameData);
      golpes.push(...golpesEm(s));
    }
    expect(golpes).toEqual([]); // saiu do tile: a flecha caiu no chao
    // o mesmo tiro, com um amigo do arqueiro entrando no tile onde a flecha vai cair
    let s2 = com(mover(lancado, 'alvo', { gx: alvo.gx + 1, gy: alvo.gy }), unidade('amigo', 'militia', LADO_DO_JOGADOR, { gx: alvo.gx, gy: alvo.gy }, { hp: 9999 }));
    const golpes2: string[] = [];
    for (let k = 0; k < voo; k += 1) {
      s2 = step(s2, [], gameData);
      golpes2.push(...golpesEm(s2));
    }
    expect(golpes2).toEqual(['amigo']);
  });

  it('(d) o arqueiro que morre com a flecha no ar nao a cancela', () => {
    const { s: lancado, voo } = ateLancar(duelo().s);
    let s = sem(lancado, 'arq');
    const golpes: GameEvent[] = [];
    for (let k = 0; k < voo; k += 1) {
      s = step(s, [], gameData);
      golpes.push(...s.events.filter((e) => e.type === 'unit-struck'));
    }
    expect(golpes).toHaveLength(1);
    expect(golpes[0]).toMatchObject({ atacante: 'arq', alvo: 'alvo' });
    expect(s.projeteis).toBeUndefined(); // nada mais voa: o campo some
  });

  it('(e) a pedra da torre persegue o alvo marcado e o mata onde ele estiver', () => {
    let s = semCivis(createInitialState(1));
    const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'quarry'])] };
    let lugar: { gx: number; gy: number } | null = null;
    for (let r = 10; r < 30 && lugar === null; r += 1) {
      for (let d = -r; d <= r && lugar === null; d += 1) {
        const p = naVila(d, r);
        if (canPlace(busca, 'watchtower', p.gx, p.gy, gameData).ok) lugar = p;
      }
    }
    if (lugar === null) throw new Error('fixture: torre');
    s = comEntrada(comProdutorOcupado(s, { tipo: 'watchtower', id: 'torre', unidade: 'vigia', ...lugar }, gameData), 'torre', { stone: 1 });
    const torre = s.predios.porId['torre'];
    if (torre === undefined) throw new Error('fixture: torre');
    let alvoTile: { gx: number; gy: number } | null = null;
    for (let gy = torre.gy - 8; gy <= torre.gy + 9 && alvoTile === null; gy += 1) {
      for (let gx = torre.gx - 8; gx <= torre.gx + 9 && alvoTile === null; gx += 1) {
        const t = { gx, gy };
        const d = distanciaDaTorre(torre, t);
        if (d >= 4 && d <= 6 && tileAndavel(s, t, 'livre', gameData) && tileAndavel(s, { gx: gx + 1, gy }, 'livre', gameData)) alvoTile = t;
      }
    }
    if (alvoTile === null) throw new Error('fixture: alvo');
    s = com(s, unidade('inimigo', 'militia', INIMIGO, alvoTile));
    let voo = 0;
    for (let t = 0; t < 60 && voo === 0; t += 1) {
      s = step(s, [], gameData);
      voo = s.events.find((e): e is Extract<GameEvent, { type: 'projectile-fired' }> => e.type === 'projectile-fired')?.voo ?? 0;
    }
    expect(voo).toBeGreaterThan(0);
    s = mover(s, 'inimigo', { gx: alvoTile.gx + 1, gy: alvoTile.gy }); // anda um tile com a pedra no ar
    const mortos: string[] = [];
    for (let k = 0; k < voo; k += 1) {
      s = step(s, [], gameData);
      for (const e of s.events) if (e.type === 'unit-killed') mortos.push(e.unidade);
    }
    expect(mortos).toEqual(['inimigo']);
  });

  it('(f) save e load com a flecha no ar: viagem byte a byte e a corrida segue igual', () => {
    const { s: lancado, voo } = ateLancar(duelo().s);
    const texto = salvar(lancado);
    const recarregado = carregar(texto);
    expect(salvar(recarregado)).toBe(texto);
    let a = lancado;
    let b = recarregado;
    for (let k = 0; k < voo + 5; k += 1) {
      a = step(a, [], gameData);
      b = step(b, [], gameData);
    }
    expect(salvar(b)).toBe(salvar(a));
    // sem nada no ar, o campo nem aparece no save
    expect(salvar(semCivis(createInitialState(1)))).not.toContain('projeteis');
  });

  it('(g) a mesma corrida duas vezes da o mesmo estado', () => {
    const correr = (): GameState => {
      let s = duelo().s;
      for (let t = 0; t < 200; t += 1) s = step(s, [], gameData);
      return s;
    };
    expect(salvar(correr())).toBe(salvar(correr()));
  });
});
