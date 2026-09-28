/**
 * F28a — o corpo a corpo (plano em docs/planos/2026-09-28-A10-F28-tropa.md).
 *
 * Aceite escrito na sessao autonoma (PARA REVISAO):
 *  (a) a chance e a formula de combat.json: o valor puro para frente, flanco, costas e
 *      contra montado; e, SORTEADA no RNG do estado, a taxa de acerto de milhares de
 *      golpes fica a menos de 3 pontos da chance;
 *  (b) `AttackUnit`: a tropa persegue, golpeia na cadencia do dado, cada acerto tira
 *      exatamente 1 HP, e o alvo morre com HP zero e sai do estado;
 *  (c) contato: dois militares inimigos ociosos encostados lutam sem ordem, e a 2 tiles
 *      nao (o militar encostado em PREDIO inimigo sem ordem e o teste 2 da F-CERCO-a2);
 *  (d) recusas com motivo, estado igual; (e) mesma semente, mesmo estado.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Command } from '../src/sim/commands';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { chanceDeAcerto, ladoDoGolpe } from '../src/sim/combate';
import { hpMaximoDoTipo } from '../src/sim/vida';
import { createRng } from '../src/sim/rng';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const INIMIGO = LADO_DO_JOGADOR + 1;
const C = gameData.combate;

function soldado(id: string, tipo: string, lado: number, gx: number, gy: number, direcao?: number): Unidade {
  return {
    lado, id, tipo, gx, gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tipo),
    ...(direcao === undefined ? {} : { direcao }),
  };
}

function comUnidades(s: GameState, ...us: Unidade[]): GameState {
  const porId = { ...s.unidades.porId };
  const ordem = [...s.unidades.ordem];
  for (const u of us) {
    porId[u.id] = u;
    ordem.push(u.id);
  }
  return { ...s, unidades: { porId, ordem } };
}

/** Um tile andavel na vila com os oito vizinhos andaveis: o ringue. */
function ringue(s: GameState): { gx: number; gy: number } {
  for (let r = 6; r < 30; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const c = naVila(d, r);
      let livre = true;
      for (let dy = -2; dy <= 2 && livre; dy += 1) for (let dx = -2; dx <= 2 && livre; dx += 1) livre = tileAndavel(s, { gx: c.gx + dx, gy: c.gy + dy }, 'livre', gameData);
      if (livre) return c;
    }
  }
  throw new Error('fixture: sem ringue');
}

const golpes = (events: readonly GameEvent[]) => events.filter((e): e is Extract<GameEvent, { type: 'unit-struck' }> => e.type === 'unit-struck');
const semCivis = (s: GameState): GameState => ({ ...s, unidades: { porId: {}, ordem: [] } });

describe('F28a — o corpo a corpo', () => {
  const base = semCivis(createInitialState(1));
  const c = ringue(base);

  it('(a) a chance pura: frente, flanco, costas e contra montado, pela formula do dado', () => {
    // o alvo olha para o norte (0); o atacante vem do norte, do leste e do sul
    const alvo = soldado('alvo', 'militia', INIMIGO, 10, 10, 0);
    const deFrente = soldado('a', 'militia', 0, 10, 9);
    const deLado = soldado('a', 'militia', 0, 11, 10);
    const dasCostas = soldado('a', 'militia', 0, 10, 11);
    expect([ladoDoGolpe(deFrente, alvo), ladoDoGolpe(deLado, alvo), ladoDoGolpe(dasCostas, alvo)]).toEqual(['frente', 'flanco', 'costas']);
    // miliciano 35 contra defesa 1: 0,35 x 1,0 / 0,35 x 1,35 / 0,35 x 1,75
    expect(chanceDeAcerto(deFrente, alvo)).toBeCloseTo(0.35, 10);
    expect(chanceDeAcerto(deLado, alvo)).toBeCloseTo(0.35 * C.multiplicadorDirecao.flanco, 10);
    expect(chanceDeAcerto(dasCostas, alvo)).toBeCloseTo(0.35 * C.multiplicadorDirecao.costas, 10);
    // piqueiro (35 + 45 contra cavalo) contra cavaleiro (defesa 3): 80 / 300
    const cavaleiro = soldado('k', 'knight', INIMIGO, 10, 10, 0);
    expect(chanceDeAcerto(soldado('p', 'pikeman', 0, 10, 9), cavaleiro)).toBeCloseTo(80 / 300, 10);
    // o teto: besteiro (120) contra defesa 1 daria 1,2
    expect(chanceDeAcerto(soldado('x', 'crossbowman', 0, 10, 9), alvo)).toBe(C.tetoAcerto);
    // o piso NUNCA age com o dado de hoje: o menor par e 25 / 300 = 0,083 > 0,08 (achado)
    expect(chanceDeAcerto(soldado('l', 'lance_carrier', 0, 10, 9), soldado('s', 'sword_fighter', INIMIGO, 10, 10, 0))).toBeCloseTo(25 / 300, 10);
  });

  it('(a) sorteada no RNG do estado, a taxa de acerto fica a menos de 3 pontos da chance', () => {
    // 3000 golpes de um miliciano de frente contra um espadachim que nunca morre (HP
    // devolvido a cada tick pela fixture): so conta acerto e erro
    const alvo = soldado('alvo', 'axe_fighter', INIMIGO, c.gx, c.gy - 1, 4);
    let s = comUnidades(base, soldado('atk', 'militia', 0, c.gx, c.gy, 0), alvo);
    s = step(s, [{ type: 'AttackUnit', unidades: ['atk'], alvo: 'alvo' }], gameData);
    let acertos = 0;
    let total = 0;
    for (let t = 0; t < 60_000 && total < 3000; t += 1) {
      s = step(s, [], gameData);
      for (const g of golpes(s.events).filter((x) => x.atacante === 'atk')) {
        total += 1;
        if (g.acertou) acertos += 1;
      }
      // os dois ficam vivos: o alvo revida por contato, e aqui so se mede o sorteio
      const a = s.unidades.porId['alvo'] as Unidade;
      const k = s.unidades.porId['atk'] as Unidade;
      s = { ...s, unidades: { ...s.unidades, porId: { ...s.unidades.porId, alvo: { ...a, hp: 99 }, atk: { ...k, hp: 99 } } } };
    }
    expect(total).toBe(3000);
    const chance = chanceDeAcerto(s.unidades.porId['atk'] as Unidade, s.unidades.porId['alvo'] as Unidade);
    expect(Math.abs(acertos / total - chance)).toBeLessThan(0.03);
    gravarEvidencia('F28a-taxa', { golpes: total, acertos, taxa: acertos / total, chance });
  });

  it('(b) AttackUnit: persegue, golpeia na cadencia, 1 HP por acerto, e o alvo morre e sai', () => {
    // o atacante aguenta mais (fixture): o alvo revida por contato, e o aceite e a morte DELE
    let s = comUnidades(base, { ...soldado('atk', 'militia', 0, c.gx - 2, c.gy), hp: 99 }, soldado('alvo', 'militia', INIMIGO, c.gx + 2, c.gy));
    s = step(s, [{ type: 'AttackUnit', unidades: ['atk'], alvo: 'alvo' }], gameData);
    const hpCheio = hpMaximoDoTipo('militia') as number;
    const ticksDosGolpes: number[] = [];
    let hp = hpCheio;
    let morte: GameEvent | undefined;
    const violacoes: string[] = [];
    for (let t = 0; t < 3000 && morte === undefined; t += 1) {
      s = step(s, [], gameData);
      // a regeneracao (F28c) roda antes da luta no tick: o HP antes do golpe ja a inclui
      if (s.tick % gameData.combate.regeneracao.ticksIntervalo === 0 && hp < hpCheio) hp += 1;
      for (const g of golpes(s.events).filter((x) => x.atacante === 'atk')) {
        ticksDosGolpes.push(s.tick);
        if (g.acertou) hp -= 1;
        expect(g.hp).toBe(hp);
      }
      morte = s.events.find((e) => e.type === 'unit-killed');
      violacoes.push(...violacoesDeInvariantes(s, gameData));
    }
    expect(violacoes).toEqual([]);
    expect(morte).toMatchObject({ unidade: 'alvo', por: 'atk' });
    expect(s.unidades.porId['alvo']).toBeUndefined();
    expect(s.unidades.ordem).not.toContain('alvo');
    // o alvo revidou por contato, entao o atacante pode ter perdido HP — mas vive
    expect(s.unidades.porId['atk']).toBeDefined();
    // a cadencia: os golpes do atacante saem de ticksCadenciaDeAtaque em ticksCadenciaDeAtaque
    const intervalos = ticksDosGolpes.slice(1).map((t, i) => t - (ticksDosGolpes[i] as number));
    expect(new Set(intervalos)).toEqual(new Set([C.ticksCadenciaDeAtaque]));
    gravarEvidencia('F28a-luta', { golpes: ticksDosGolpes.length, tickDaMorte: s.tick, cadencia: C.ticksCadenciaDeAtaque });
  });

  it('(c) contato: militares inimigos encostados lutam sem ordem; a 2 tiles, ninguem (predio encostado: F-CERCO-a2, teste 2)', () => {
    let s = comUnidades(base, soldado('a', 'militia', 0, c.gx, c.gy), soldado('b', 'militia', INIMIGO, c.gx + 1, c.gy));
    s = step(s, [], gameData);
    expect(s.unidades.porId['a']?.fsm).toBe('lutando');
    expect(s.unidades.porId['b']?.fsm).toBe('lutando');
    // longe (2 tiles), ninguem luta
    let longe = comUnidades(base, soldado('a', 'militia', 0, c.gx, c.gy), soldado('b', 'militia', INIMIGO, c.gx + 2, c.gy));
    for (let t = 0; t < 50; t += 1) longe = step(longe, [], gameData);
    expect(longe.unidades.porId['a']?.fsm).toBe('ocioso');
    expect(golpes(longe.events)).toEqual([]);
  });

  it('(d) recusas com motivo, e o estado fica igual', () => {
    const s0 = comUnidades(createInitialState(1),
      soldado('a', 'militia', 0, c.gx, c.gy), soldado('amigo', 'militia', 0, c.gx + 1, c.gy),
      soldado('arq', 'bowman', 0, c.gx, c.gy + 1), soldado('b', 'militia', INIMIGO, c.gx + 3, c.gy));
    const civil = s0.unidades.ordem.find((id) => s0.unidades.porId[id]?.tipo === 'serf') as string;
    const casos: [Command, string][] = [
      [{ type: 'AttackUnit', unidades: [], alvo: 'b' }, 'sem-unidades'],
      [{ type: 'AttackUnit', unidades: ['a'], alvo: 'fantasma' }, 'alvo-inexistente'],
      [{ type: 'AttackUnit', unidades: ['a'], alvo: civil }, 'alvo-sem-hp'],
      [{ type: 'AttackUnit', unidades: ['fantasma'], alvo: 'b' }, 'unidade-inexistente'],
      [{ type: 'AttackUnit', unidades: [civil], alvo: 'b' }, 'unidade-nao-militar'],
      [{ type: 'AttackUnit', unidades: ['arq'], alvo: 'b' }, 'unidade-a-distancia'],
      [{ type: 'AttackUnit', unidades: ['a'], alvo: 'amigo' }, 'alvo-do-proprio-lado'],
    ];
    for (const [cmd, motivo] of casos) {
      const r = step(s0, [cmd], gameData);
      expect(r.events.find((e) => e.type === 'command-rejected'), motivo).toMatchObject({ command: 'AttackUnit', motivo });
      expect(salvar({ ...r, events: [] })).toBe(salvar({ ...step(s0, [], gameData), events: [] }));
    }
  });

  it('(e) mesma semente, mesmo estado; outra semente, outro sorteio', () => {
    const correr = (semente: number): GameState => {
      let s = comUnidades({ ...base, rng: createRng(semente) },
        soldado('a', 'militia', 0, c.gx, c.gy), soldado('b', 'militia', INIMIGO, c.gx + 1, c.gy));
      for (let t = 0; t < 400; t += 1) s = step(s, [], gameData);
      return s;
    };
    expect(salvar(correr(7))).toBe(salvar(correr(7)));
    expect(salvar(correr(7))).not.toBe(salvar(correr(8)));
  });
});
