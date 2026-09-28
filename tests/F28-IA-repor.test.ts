/**
 * F28-IA, ponto 4 — repor pelo quartel ate 9 por posicao (plano em
 * docs/planos/2026-09-28-A12-F28-IA-defesa.md; aceite escrito na sessao autonoma, PARA
 * REVISAO):
 *  - a posicao vazia se enche ate 9 pelo quartel do lado, consumindo 1 requisito e 1
 *    recruta por soldado, e PARA no 9;
 *  - o tipo formado e o do grupo da posicao (arqueiro para a de distancia);
 *  - sem recruta (ou sem requisito), nada se forma;
 *  - a mesma corrida duas vezes da o mesmo estado.
 * O ponto 5 (alimentar os famintos) NAO tem teste: esta bloqueado — militar nao sente
 * fome na sim (`drenaCondicao`) e o comando Feed nao existe.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, PosicaoDeDefesa, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const IA = LADO_DO_JOGADOR + 1;

function comQuartelDaIA(s: GameState, entrada: Record<string, number>, recrutas: number): GameState {
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'sawmill'])] };
  for (let r = 10; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const p = naVila(d, r);
      if (!canPlace(busca, 'barracks', p.gx, p.gy, gameData).ok) continue;
      const q = completarObra({ lado: IA, id: 'quartel-ia', tipo: 'barracks', ...p, estado: 'obra', hp: 600, obra: { faltam: {}, nivelamento: 0 } }, gameData);
      const quartel: PredioCompleto = { ...q, estoque: { ...q.estoque, entrada }, recrutas };
      return { ...s, predios: { porId: { ...s.predios.porId, [quartel.id]: quartel }, ordem: [...s.predios.ordem, quartel.id] } };
    }
  }
  throw new Error('fixture: o quartel da IA nao coube');
}
const posicao = (id: string, tipo: PosicaoDeDefesa['tipoDeGrupo'], ponto: { gx: number; gy: number }): PosicaoDeDefesa =>
  ({ id, ponto, tipoDeGrupo: tipo, raio: 6, linha: 'frente', membros: [] });
const semCivis = (s: GameState): GameState => ({ ...s, unidades: { porId: {}, ordem: [] } });

function correr(s0: GameState, n: number): { s: GameState; formados: GameEvent[] } {
  let s = s0;
  const formados: GameEvent[] = [];
  for (let i = 0; i < n; i += 1) {
    s = step(s, [], gameData);
    formados.push(...s.events.filter((e) => e.type === 'unit-trained'));
  }
  return { s, formados };
}

describe('F28-IA — ponto 4: repor pelo quartel', () => {
  const base = semCivis(createInitialState(1));
  const ponto = naVila(-8, 14);

  it('enche a posicao ate 9, um requisito e um recruta por soldado, e para no 9', () => {
    const s0: GameState = { ...comQuartelDaIA(base, { hand_axe: 12 }, 12), ia: { [IA]: { posicoes: [posicao('p1', 'corpoACorpo', ponto)] } } };
    const r = correr(s0, 200);
    expect(r.formados).toHaveLength(9);
    expect(r.formados.every((e) => (e as { tipo: string }).tipo === 'militia')).toBe(true);
    expect(r.s.ia?.[IA]?.posicoes[0]?.membros).toHaveLength(9);
    const q = r.s.predios.porId['quartel-ia'] as PredioCompleto;
    expect(q.estoque.entrada['hand_axe']).toBe(3);
    expect(q.recrutas).toBe(3);
    for (const id of r.s.ia?.[IA]?.posicoes[0]?.membros ?? []) expect(r.s.unidades.porId[id]?.lado).toBe(IA);
    gravarEvidencia('F28-IA-repor', { formados: r.formados.length, sobrou: q.estoque.entrada, recrutas: q.recrutas });
  });

  it('forma o tipo do grupo: arqueiro para a posicao de distancia', () => {
    const s0: GameState = {
      ...comQuartelDaIA(base, { hand_axe: 2, longbow: 2, leather_armor: 2 }, 4),
      ia: { [IA]: { posicoes: [posicao('arco', 'distancia', ponto)] } },
    };
    const r = correr(s0, 50);
    expect(r.formados.map((e) => (e as { tipo: string }).tipo)).toEqual(['bowman', 'bowman']);
    expect(r.s.ia?.[IA]?.posicoes[0]?.membros).toHaveLength(2);
  });

  it('sem recruta, nada se forma', () => {
    const s0: GameState = { ...comQuartelDaIA(base, { hand_axe: 12 }, 0), ia: { [IA]: { posicoes: [posicao('p1', 'corpoACorpo', ponto)] } } };
    expect(correr(s0, 100).formados).toEqual([]);
  });

  it('a mesma corrida duas vezes da o mesmo estado', () => {
    const montar = (): GameState => ({ ...comQuartelDaIA(base, { hand_axe: 12 }, 12), ia: { [IA]: { posicoes: [posicao('p1', 'corpoACorpo', ponto)] } } });
    expect(salvar(correr(montar(), 300).s)).toBe(salvar(correr(montar(), 300).s));
  });
});
