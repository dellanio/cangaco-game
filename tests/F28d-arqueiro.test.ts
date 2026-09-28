/**
 * F28d — o arqueiro (plano em docs/planos/2026-09-28-A10-F28-tropa.md). Decisoes do
 * operador (2026-09-28): arco de 90 graus NO TOTAL, alcance de 4 a 11 tiles, escudo
 * dando defesa contra projetil, fogo amigo ligado, flecha em predio tirando 1 de HP.
 *
 * Aceite:
 *  (a) o alcance: a 3 nao atira, a 4 e a 11 atira, a 12 nao;
 *  (b) o arco: a frente e a 45 graus atira; a 50 e a 90 graus, e atras, nao; ele nao se vira;
 *  (c) o escudo: a chance contra quem tem escudo cai pela formula (+1 contra flecha e
 *      funda, +0,5 contra virote), e so contra projetil;
 *  (d) fogo amigo: com um soldado do proprio lado no tile do alvo, antes dele na lista,
 *      a flecha acerta o amigo;
 *  (e) flecha em predio: o arqueiro com a ordem para no alcance e tira 1 de HP por
 *      tiro, sem sorteio;
 *  (f) mesma semente, mesmo estado.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Predio, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { tileAndavel } from '../src/sim/pathfinding';
import { canPlace } from '../src/sim/placement';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { chanceDeAcerto, defesaDoEscudo, noAlcance, noArco, temEscudo } from '../src/sim/combate';
import { caixaDoPredio } from '../src/sim/footprint';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const INIMIGO = LADO_DO_JOGADOR + 1;
const NORTE = 0;

function unidade(id: string, tipo: string, lado: number, gx: number, gy: number, direcao?: number): Unidade {
  return {
    lado, id, tipo, gx, gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tipo),
    ...(direcao === undefined ? {} : { direcao }),
  };
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
const tiros = (events: readonly GameEvent[], quem: string) =>
  events.filter((e): e is Extract<GameEvent, { type: 'unit-struck' }> => e.type === 'unit-struck' && e.atacante === quem);
const semCivis = (s: GameState): GameState => ({ ...s, unidades: { porId: {}, ordem: [] } });

/** Um campo aberto: um tile com 13 andaveis em toda direcao. */
function campo(s: GameState): { gx: number; gy: number } {
  for (let r = 6; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const c = naVila(d, r);
      let livre = true;
      for (let dy = -12; dy <= 12 && livre; dy += 3) for (let dx = -12; dx <= 12 && livre; dx += 3) livre = tileAndavel(s, { gx: c.gx + dx, gy: c.gy + dy }, 'livre', gameData);
      if (livre) return c;
    }
  }
  throw new Error('fixture: sem campo aberto');
}

/** Atira em `ticks`? O arqueiro olha para o norte; o alvo e um miliciano parado. */
function atiraEm(s0: GameState, c: { gx: number; gy: number }, dx: number, dy: number, ticks = 40): number {
  let s = com(s0, unidade('arq', 'bowman', 0, c.gx, c.gy, NORTE), unidade('alvo', 'militia', INIMIGO, c.gx + dx, c.gy + dy, NORTE));
  let n = 0;
  for (let t = 0; t < ticks; t += 1) {
    s = step(s, [], gameData);
    n += tiros(s.events, 'arq').length;
  }
  return n;
}

describe('F28d — o arqueiro', () => {
  const base = semCivis(createInitialState(1));
  const c = campo(base);
  const A = gameData.combate.aDistancia;

  it('o dado: 4 a 11 tiles, 90 graus no total', () => {
    expect([A.alcanceMinimo_tiles, A.alcanceMaximo_tiles, A.arcoDeTiro_graus_total]).toEqual([4, 11, 90]);
  });

  it('(a) o alcance: a 3 nao atira, a 4 e a 11 atira, a 12 nao (em frente, ao norte)', () => {
    expect(atiraEm(base, c, 0, -3)).toBe(0);
    expect(atiraEm(base, c, 0, -4)).toBeGreaterThan(0);
    expect(atiraEm(base, c, 0, -11)).toBeGreaterThan(0);
    expect(atiraEm(base, c, 0, -12)).toBe(0);
    expect(noAlcance({ gx: 0, gy: 0 }, { gx: 7, gy: 8 })).toBe(true); // 10,63
    expect(noAlcance({ gx: 0, gy: 0 }, { gx: 8, gy: 8 })).toBe(false); // 11,31
  });

  it('(b) o arco: a frente e a 45 graus atira; a 50, a 90 e atras nao; ele nao se vira', () => {
    expect(atiraEm(base, c, 0, -6)).toBeGreaterThan(0); // 0 graus
    expect(atiraEm(base, c, 6, -6)).toBeGreaterThan(0); // 45 graus, borda inclusiva
    expect(atiraEm(base, c, 6, -5)).toBe(0); // ~50 graus
    expect(atiraEm(base, c, 6, 0)).toBe(0); // 90 graus
    expect(atiraEm(base, c, 0, 6)).toBe(0); // atras
    const arq = unidade('arq', 'bowman', 0, 0, 0, NORTE);
    expect(noArco(arq, { gx: -6, gy: -6 })).toBe(true);
    expect(noArco(arq, { gx: -7, gy: -6 })).toBe(false);
  });

  it('(c) o escudo: +1 contra flecha e funda, +0,5 contra virote, e nada de perto', () => {
    expect(temEscudo('axe_fighter')).toBe(true);
    expect(temEscudo('militia')).toBe(false);
    expect(temEscudo('knight')).toBe(true);
    expect(defesaDoEscudo('axe_fighter', 'flecha')).toBe(1);
    expect(defesaDoEscudo('axe_fighter', 'funda')).toBe(1);
    expect(defesaDoEscudo('axe_fighter', 'virote')).toBe(0.5);
    expect(defesaDoEscudo('axe_fighter', null)).toBe(0);
    const alvo = unidade('x', 'axe_fighter', INIMIGO, 0, -6, 4); // olha para o arqueiro: frente
    // arqueiro 60 contra defesa 2 + 1: 60/300; besteiro 120 contra 2 + 0,5: 120/250
    expect(chanceDeAcerto(unidade('a', 'bowman', 0, 0, 0, NORTE), alvo)).toBeCloseTo(60 / 300, 10);
    expect(chanceDeAcerto(unidade('b', 'crossbowman', 0, 0, 0, NORTE), alvo)).toBeCloseTo(120 / 250, 10);
    // de perto (machadeiro contra machadeiro) o escudo nao conta: 35 / 200
    expect(chanceDeAcerto(unidade('m', 'axe_fighter', 0, 0, -5), alvo)).toBeCloseTo(35 / 200, 10);
  });

  it('(d) fogo amigo: o amigo no tile do alvo, antes dele na lista, leva a flecha', () => {
    const amigo = unidade('amigo', 'militia', 0, c.gx, c.gy - 6, NORTE);
    let s = com(base, unidade('arq', 'bowman', 0, c.gx, c.gy, NORTE), amigo, unidade('alvo', 'militia', INIMIGO, c.gx, c.gy - 6, NORTE));
    const vitimas = new Set<string>();
    // 15 ticks: no maximo 5 flechas, e o amigo aguenta 6 — morto, a proxima iria ao alvo
    for (let t = 0; t < 15; t += 1) {
      s = step(s, [], gameData);
      for (const g of tiros(s.events, 'arq')) vitimas.add(g.alvo);
    }
    expect([...vitimas]).toEqual(['amigo']);
    gravarEvidencia('F28d-fogo-amigo', { vitimas: [...vitimas] });
  });

  it('(e) flecha em predio: para no alcance e tira 1 de HP por tiro, sem sorteio', () => {
    let lugar: { gx: number; gy: number } | null = null;
    for (let r = 4; r < 30 && lugar === null; r += 1) {
      for (let d = -r; d <= r && lugar === null; d += 1) {
        const p = naVila(d, r);
        if (canPlace(base, 'schoolhouse', p.gx, p.gy, gameData).ok) lugar = p;
      }
    }
    if (lugar === null) throw new Error('fixture: sem lugar');
    const escola = completarObra({
      lado: INIMIGO, id: 'escola', tipo: 'schoolhouse', ...lugar, estado: 'obra', hp: 550, obra: { faltam: {}, nivelamento: 0 },
    }, gameData);
    const caixa = caixaDoPredio(escola, gameData);
    if (caixa === null) throw new Error('sem caixa');
    // colado ao predio (distancia 1): o arqueiro tem de se AFASTAR ate o minimo para atirar
    let partida: { gx: number; gy: number } | null = null;
    for (let gx = caixa.x0; gx < caixa.x1 && partida === null; gx += 1) {
      const t = { gx, gy: caixa.y1 };
      if (tileAndavel(base, t, 'livre', gameData)) partida = t;
    }
    if (partida === null) throw new Error('fixture: sem tile de partida');
    let s: GameState = { ...base, predios: { porId: { ...base.predios.porId, escola }, ordem: [...base.predios.ordem, 'escola'] } };
    s = com(s, unidade('arq', 'bowman', 0, partida.gx, partida.gy));
    s = step(s, [{ type: 'AttackBuilding', unidades: ['arq'], predio: 'escola' }], gameData);
    const hps: number[] = [];
    for (let t = 0; t < 600 && hps.length < 5; t += 1) {
      s = step(s, [], gameData);
      for (const e of s.events) if (e.type === 'building-attacked') hps.push(e.hp);
    }
    expect(hps).toEqual([549, 548, 547, 546, 545]);
    const arq = s.unidades.porId['arq'] as Unidade;
    const gx = Math.min(Math.max(arq.gx, caixa.x0), caixa.x1 - 1);
    const gy = Math.min(Math.max(arq.gy, caixa.y0), caixa.y1 - 1);
    const d = Math.hypot(arq.gx - gx, arq.gy - gy);
    expect(d).toBeGreaterThanOrEqual(4);
    expect(d).toBeLessThanOrEqual(11);
    expect((s.predios.porId['escola'] as Predio).hp).toBe(545);
    gravarEvidencia('F28d-predio', { hps, distanciaDoTiro: d });
  });

  it('(f) mesma semente, mesmo estado', () => {
    const correr = (): GameState => {
      let s = com(base, unidade('arq', 'bowman', 0, c.gx, c.gy, NORTE), unidade('alvo', 'militia', INIMIGO, c.gx, c.gy - 6, NORTE));
      for (let t = 0; t < 200; t += 1) s = step(s, [], gameData);
      return s;
    };
    expect(salvar(correr())).toBe(salvar(correr()));
  });
});
