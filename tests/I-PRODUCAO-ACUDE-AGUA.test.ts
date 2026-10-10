/**
 * I-PRODUCAO-ACUDE-AGUA — o nivel de agua do Acude (plano docs/planos/2026-10-05-acude-e-clima.md, etapa 4).
 * Pelo `step`: enche nas estacoes de entrada, evapora sempre, fica entre 0 e a capacidade; o save leva o
 * nivel; o painel o publica.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Predio, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { faseNoTick } from '../src/sim/clima';
import { carregar, salvar } from '../src/sim/save';
import { painelDoPredio } from '../src/sim/selectors';
import { gravarEvidencia } from './helpers/evidence';

const A = gameData.acude;

function comAcude(s: GameState, agua: number | undefined): GameState {
  const def = gameData.predios.find((p) => p.id === 'reservoir')!;
  const completo = completarObra({ lado: LADO_DO_JOGADOR, id: 'acude', tipo: 'reservoir', gx: 4, gy: 4, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 } }, gameData) as PredioCompleto;
  const p: Predio = agua === undefined ? completo : { ...completo, agua };
  return { ...s, predios: { porId: { ...s.predios.porId, acude: p }, ordem: [...s.predios.ordem, 'acude'] } };
}
const agua = (s: GameState): number => ((s.predios.porId['acude'] as PredioCompleto).agua ?? 0);
/** O primeiro tick em que a fase `id` comeca. */
function inicioDa(id: string): number {
  for (let t = 1; t < 40_000; t++) if (faseNoTick(t)?.id === id && faseNoTick(t - 1)?.id !== id) return t;
  throw new Error(`fase ${id} nao achada`);
}
/** A regra escrita de novo, so com o dado: o nivel depois de rodar os ticks (de+1 .. ate). */
function esperado(inicial: number, de: number, ate: number): number {
  let n = inicial;
  for (let t = de + 1; t <= ate; t++) {
    if (A.estacoesDeEntrada.includes(faseNoTick(t)?.id ?? '') && t % A.ticksPorEntrada === 0) n += 1;
    if (t % A.ticksPorEvaporacao === 0) n -= 1;
    n = Math.max(0, Math.min(A.capacidade, n));
  }
  return n;
}

describe('I-PRODUCAO-ACUDE-AGUA', () => {
  const base = createInitialState(gameData.economia.estadoInicial.semente);

  it('(1) no inverno o Acude vazio enche pela regra, e para na capacidade', () => {
    const t0 = inicioDa('inverno');
    let s = comAcude({ ...base, tick: t0 - 1 }, undefined);
    const n = 1200;
    for (let i = 0; i < n; i++) s = step(s, []);
    expect(agua(s)).toBe(esperado(0, t0 - 1, t0 - 1 + n));
    expect(agua(s)).toBeGreaterThan(0);
    // longo o bastante, para no teto
    let cheio = comAcude({ ...base, tick: t0 - 1 }, A.capacidade - 2);
    for (let i = 0; i < A.ticksPorEntrada * 10; i++) cheio = step(cheio, []);
    expect(agua(cheio)).toBe(A.capacidade);
    gravarEvidencia('I-PRODUCAO-ACUDE-AGUA', { inverno: { ticks: n, nivel: agua(s) }, ticksPorEntrada: A.ticksPorEntrada, ticksPorEvaporacao: A.ticksPorEvaporacao });
  });

  it('(1) na seca so evapora, sem passar de 0', () => {
    const t0 = inicioDa('seca');
    let s = comAcude({ ...base, tick: t0 - 1 }, 3);
    const n = A.ticksPorEvaporacao * 5;
    for (let i = 0; i < n; i++) s = step(s, []);
    expect(agua(s)).toBe(esperado(3, t0 - 1, t0 - 1 + n));
    expect(agua(s)).toBe(0);
  });

  it('(3) determinismo, e o save leva o nivel; (4) o painel publica o nivel e a capacidade', () => {
    const t0 = inicioDa('inverno');
    const rodar = (): GameState => { let s = comAcude({ ...base, tick: t0 - 1 }, 10); for (let i = 0; i < 400; i++) s = step(s, []); return s; };
    const a = rodar(), b = rodar();
    expect(salvar(a)).toBe(salvar(b));
    expect(agua(carregar(salvar(a)))).toBe(agua(a));
    expect(painelDoPredio(a, 'acude')?.acude).toEqual({ agua: agua(a), capacidade: A.capacidade });
    expect(painelDoPredio(a, a.predios.ordem[0]!)?.acude).toBeNull();
  });
});
