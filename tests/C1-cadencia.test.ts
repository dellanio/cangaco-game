/**
 * C1 — cadencia propria para projetil e torre (fila do operador, item 1; plano em
 * docs/planos/2026-09-28-C1-cadencia-por-ataque.md). Medido no fonte do kam_remake:
 * torre = 2 + 1 + 20 ticks (sem o voo); atirador = animacao + mira sorteada. Aceite:
 *  (a) o dado convertido: a torre e os tres projeteis em ticks, lidos do dado;
 *  (b) a torre com 5 pedras e 5 inimigos gasta as 5 em >= 4 x a recarga, nao em 1,5 s;
 *  (c) os intervalos entre tiros do arqueiro ficam em [recarga, recarga+miraAleatoria-1],
 *      e aparece mais de um valor (o sorteio age);
 *  (d) a mesma corrida duas vezes da o mesmo estado;
 *  (e) o corpo a corpo nao muda (a cadencia do golpe e a de antes).
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
import { salvar } from '../src/sim/save';
import { comEntrada, comProdutorOcupado } from './helpers/producao-cenario';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const INIMIGO = LADO_DO_JOGADOR + 1;
const C = gameData.combate;
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

describe('C1 — cadencia por tipo de ataque', () => {
  it('(a) o dado convertido: torre e projeteis em ticks, na escala de combate', () => {
    const escala = 1.5;
    const emTicks = (seg: number): number => Math.round((seg / escala) * 10);
    expect(C.watchtower.ticksRecarga).toBe(emTicks(C.watchtower.recarga_segundos_base));
    const cad = C.aDistancia.cadencia as unknown as Record<string, { recarga_segundos_base: number; miraAleatoria_segundos_base: number }>;
    for (const p of ['flecha', 'virote', 'funda']) {
      expect(C.ticksCadenciaAtirador[p], p).toEqual({
        recarga: emTicks(cad[p]?.recarga_segundos_base ?? -1), miraAleatoria: emTicks(cad[p]?.miraAleatoria_segundos_base ?? -1),
      });
    }
    // a proporcao medida: a torre e mais de 4x o golpe; o arco atira mais devagar que o golpe
    expect(C.watchtower.ticksRecarga).toBeGreaterThan(4 * C.ticksCadenciaDeAtaque);
    expect(C.ticksCadenciaAtirador['flecha']?.recarga).toBeGreaterThan(C.ticksCadenciaDeAtaque);
    gravarEvidencia('C1-cadencia', {
      golpe: C.ticksCadenciaDeAtaque, golpeEmPredio: C.ataqueAPredio.ticksCadencia,
      torre: C.watchtower.ticksRecarga, atirador: C.ticksCadenciaAtirador,
    });
  });

  it('(b) a torre gasta 5 pedras em >= 4 x a recarga', () => {
    let s = semCivis(createInitialState(1));
    const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'quarry'])] };
    let lugar: { gx: number; gy: number } | null = null;
    for (let r = 10; r < 30 && lugar === null; r += 1) {
      for (let d = -r; d <= r && lugar === null; d += 1) {
        const p = naVila(d, r);
        if (canPlace(busca, 'watchtower', p.gx, p.gy, gameData).ok) lugar = p;
      }
    }
    if (lugar === null) throw new Error('fixture: a torre nao coube');
    s = comEntrada(comProdutorOcupado(s, { tipo: 'watchtower', id: 'torre', unidade: 'vigia', ...lugar }, gameData), 'torre', { stone: 5 });
    const torre = s.predios.porId['torre'];
    if (torre === undefined || torre.estado !== 'completo') throw new Error('fixture: sem torre');
    const alvos: Unidade[] = [];
    for (let gy = torre.gy - 10; gy <= torre.gy + 12 && alvos.length < 5; gy += 3) {
      for (let gx = torre.gx - 10; gx <= torre.gx + 12 && alvos.length < 5; gx += 3) {
        const d = distanciaDaTorre(torre, { gx, gy });
        if (d >= 3 && d <= C.watchtower.alcance_tiles && tileAndavel(s, { gx, gy }, 'livre', gameData)) alvos.push(unidade(`i${alvos.length}`, 'militia', INIMIGO, { gx, gy }));
      }
    }
    expect(alvos).toHaveLength(5);
    s = com(s, ...alvos);
    const quando: number[] = [];
    for (let t = 0; t < 400; t += 1) {
      s = step(s, [], gameData);
      if (s.events.some((e) => e.type === 'stone-thrown')) quando.push(s.tick);
    }
    expect(quando).toHaveLength(5);
    const intervalos = quando.slice(1).map((q, i) => q - (quando[i] as number));
    for (const i of intervalos) expect(i).toBe(C.watchtower.ticksRecarga);
    expect((quando[4] as number) - (quando[0] as number)).toBeGreaterThanOrEqual(4 * C.watchtower.ticksRecarga);
    gravarEvidencia('C1-torre', { pedrasNosTicks: quando, intervalos });
  });

  function arqueiroContraAlvo(tipo: string, ticks: number): { quando: number[]; s: GameState } {
    const base = semCivis(createInitialState(1));
    let c: { gx: number; gy: number } | null = null;
    for (let r = 6; r < 40 && c === null; r += 1) {
      for (let d = -r; d <= r && c === null; d += 1) {
        const p = naVila(d, r);
        if (tileAndavel(base, p, 'livre', gameData) && tileAndavel(base, { gx: p.gx, gy: p.gy - 6 }, 'livre', gameData)) c = p;
      }
    }
    if (c === null) throw new Error('fixture: sem campo');
    // o alvo nao morre (HP alto) e nao revida (a 6 tiles, parado)
    let s = com(base, unidade('arq', tipo, LADO_DO_JOGADOR, c, { direcao: 0 }), unidade('alvo', 'militia', INIMIGO, { gx: c.gx, gy: c.gy - 6 }, { hp: 9999 }));
    const quando: number[] = [];
    for (let t = 0; t < ticks; t += 1) {
      s = step(s, [], gameData);
      if (s.events.some((e: GameEvent) => e.type === 'unit-struck' && e.atacante === 'arq')) quando.push(s.tick);
    }
    return { quando, s };
  }

  it('(c) o arqueiro e o besteiro: intervalos na faixa do dado, e o sorteio age', () => {
    for (const [tipo, projetil] of [['bowman', 'flecha'], ['crossbowman', 'virote']] as const) {
      const cad = C.ticksCadenciaAtirador[projetil];
      if (cad === undefined) throw new Error(projetil);
      const { quando } = arqueiroContraAlvo(tipo, 600);
      const intervalos = quando.slice(1).map((q, i) => q - (quando[i] as number));
      expect(intervalos.length, tipo).toBeGreaterThan(20);
      for (const i of intervalos) {
        expect(i, tipo).toBeGreaterThanOrEqual(cad.recarga);
        expect(i, tipo).toBeLessThanOrEqual(cad.recarga + cad.miraAleatoria - 1);
      }
      expect(new Set(intervalos).size, `${tipo}: o sorteio da mira deveria variar`).toBeGreaterThan(1);
      gravarEvidencia(`C1-${projetil}`, { recarga: cad.recarga, miraAleatoria: cad.miraAleatoria, intervalos: [...new Set(intervalos)].sort() });
    }
  });

  it('(c2) o arqueiro contra predio usa a cadencia do projetil; o golpe em predio, a sua', () => {
    const base = semCivis(createInitialState(1));
    const armId = base.predios.ordem[0] as string;
    const arm = base.predios.porId[armId];
    if (arm === undefined) throw new Error('fixture: sem predio');
    // o predio vira do inimigo, com HP de sobra para nao cair na janela
    let s: GameState = { ...base, predios: { ...base.predios, porId: { ...base.predios.porId, [armId]: { ...arm, lado: INIMIGO, hp: 99999 } } } };
    let perto: { gx: number; gy: number } | null = null;
    for (let d = 6; d < 10 && perto === null; d += 1) {
      for (const t of [{ gx: arm.gx, gy: arm.gy + d }, { gx: arm.gx - d, gy: arm.gy }, { gx: arm.gx + d, gy: arm.gy }]) {
        if (perto === null && tileAndavel(s, t, 'livre', gameData)) perto = t;
      }
    }
    if (perto === null) throw new Error('fixture: sem tile para o arqueiro');
    s = com(s, unidade('arq', 'bowman', LADO_DO_JOGADOR, perto));
    s = step(s, [{ type: 'AttackBuilding', unidades: ['arq'], predio: armId }], gameData);
    const quando: number[] = [];
    for (let t = 0; t < 600; t += 1) {
      s = step(s, [], gameData);
      if (s.events.some((e) => e.type === 'building-attacked' && e.unidade === 'arq')) quando.push(s.tick);
    }
    const cad = C.ticksCadenciaAtirador['flecha'];
    if (cad === undefined) throw new Error('flecha');
    const intervalos = quando.slice(1).map((q, i) => q - (quando[i] as number));
    expect(intervalos.length).toBeGreaterThan(20);
    for (const i of intervalos) {
      expect(i).toBeGreaterThanOrEqual(cad.recarga);
      expect(i).toBeLessThanOrEqual(cad.recarga + cad.miraAleatoria - 1);
    }
    expect(new Set(intervalos).size).toBeGreaterThan(1);
  });

  it('(d) a mesma corrida duas vezes da o mesmo estado', () => {
    expect(salvar(arqueiroContraAlvo('bowman', 300).s)).toBe(salvar(arqueiroContraAlvo('bowman', 300).s));
  });

  it('(e) o corpo a corpo nao muda: o golpe continua a cada ticksCadenciaDeAtaque', () => {
    expect(C.ticksCadenciaDeAtaque).toBe(3); // 0,5 s na escala de combate 1,5 — o de antes da C1
  });
});
