/**
 * I-PRODUCAO-ACUDE-IRRIGACAO — a fazenda perto do Acude cresce melhor na seca (plano
 * docs/planos/2026-10-05-acude-e-clima.md, etapa 5, opcao A). A razao, e nao o total: o mesmo tile semeado
 * na seca, irrigado e nao, amadurece na razao do dado; e pelo `step` o roceiro marca o tile irrigado.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, PredioCompleto, RecursoNoTile } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { faseNoTick, multiplicadorNoTick } from '../src/sim/clima';
import { tileMaduro } from '../src/sim/recursos';
import { acudeDaFazenda, fazendasQueConsomem, multiplicadorComIrrigacao } from '../src/sim/acude';
import { canPlace } from '../src/sim/placement';
import { painelDoPredio } from '../src/sim/selectors';
import { cenarioDeFazendaDeUmTile } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const A = gameData.acude;
const CRESCER = gameData.recursos.tipos['corn']!.reposicao!.ticksDeCrescer;

function inicioDa(id: string): number {
  for (let t = 1; t < 40_000; t++) if (faseNoTick(t)?.id === id && faseNoTick(t - 1)?.id !== id) return t;
  throw new Error(`fase ${id} nao achada`);
}
function acude(id: string, gx: number, gy: number, agua: number, lado = LADO_DO_JOGADOR): PredioCompleto {
  const def = gameData.predios.find((p) => p.id === 'reservoir')!;
  return { ...completarObra({ lado, id, tipo: 'reservoir', gx, gy, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 } }, gameData) as PredioCompleto, agua };
}
const com = (s: GameState, ...ps: PredioCompleto[]): GameState => ({
  ...s, predios: { porId: { ...s.predios.porId, ...Object.fromEntries(ps.map((p) => [p.id, p])) }, ordem: [...s.predios.ordem, ...ps.map((p) => p.id)] },
});
/** Um lugar valido (pelo `canPlace`) para o Acude, com o centro a `d` tiles (ou mais perto) do centro da fazenda. */
function lugarPerto(s: GameState, fazenda: PredioCompleto, dMax: number, dMin = 0): { gx: number; gy: number } {
  const liberado = { ...s, tiposJaConstruidos: [...s.tiposJaConstruidos, 'quarry'] };
  const cx = fazenda.gx + 2, cy = fazenda.gy + 1.5;
  const candidatos: { gx: number; gy: number; d: number }[] = [];
  for (let gy = fazenda.gy - 12; gy <= fazenda.gy + 12; gy++) {
    for (let gx = fazenda.gx - 12; gx <= fazenda.gx + 12; gx++) {
      const d = Math.hypot(gx + 2 - cx, gy + 1.5 - cy);
      if (d <= dMax && d >= dMin && canPlace(liberado, 'reservoir', gx, gy).ok) candidatos.push({ gx, gy, d });
    }
  }
  candidatos.sort((a, b) => a.d - b.d || a.gy - b.gy || a.gx - b.gx);
  if (candidatos[0] === undefined) throw new Error('fixture: sem lugar para o Acude');
  return candidatos[0];
}
const semeado = (irrigado: boolean, semeadoEm: number): RecursoNoTile => ({ tipo: 'corn', quantidade: 4, semeadoEm, ...(irrigado ? { irrigado: true as const } : {}) });
function maduroEm(irrigado: boolean, t0: number): number {
  const base = createInitialState(1);
  for (let t = t0; ; t++) if (tileMaduro({ ...base, tick: t }, semeado(irrigado, t0))) return t - t0;
}

describe('I-PRODUCAO-ACUDE-IRRIGACAO', () => {
  it('(1) a razao: o milho semeado na seca, irrigado e nao, amadurece na razao do dado', () => {
    const t0 = inicioDa('seca') + 10;
    const m = multiplicadorNoTick(t0);
    expect(m).toBeLessThan(A.tetoDoMultiplicador);
    const sem = maduroEm(false, t0), comAgua = maduroEm(true, t0);
    expect(sem).toBe(Math.round(CRESCER / m));
    expect(comAgua).toBe(Math.round(CRESCER / multiplicadorComIrrigacao(m)));
    expect(sem / comAgua).toBeCloseTo(multiplicadorComIrrigacao(m) / m, 1);
    // no inverno, acima do teto, a irrigacao nao muda nada
    const ti = inicioDa('inverno') + 10;
    expect(maduroEm(true, ti)).toBe(maduroEm(false, ti));
    gravarEvidencia('I-PRODUCAO-ACUDE-IRRIGACAO', { m, sem, comAgua, razao: sem / comAgua });
  });

  it('pelo step: com o Acude perto, o roceiro marca o tile irrigado na semeadura; sem ele, nao', () => {
    const base = cenarioDeFazendaDeUmTile();
    const f1 = base.predios.porId['f1'] as PredioCompleto;
    const lugar = lugarPerto(base, f1, A.raio_tiles);
    const rodar = (s0: GameState): RecursoNoTile | null => {
      let s = s0;
      for (let t = 0; t < 12_000; t++) {
        s = step(s, []);
        const r = Object.values(s.recursos).find((x) => x.tipo === 'corn' && x.semeadoEm !== undefined);
        if (r !== undefined) return r;
      }
      return null;
    };
    const comAcude = rodar(com(base, acude('a1', lugar.gx, lugar.gy, A.capacidade)));
    const semAcude = rodar(base);
    expect(comAcude?.irrigado).toBe(true);
    expect(semAcude).not.toBeNull();
    expect(semAcude?.irrigado).toBeUndefined();
  }, 120_000);

  it('(2) vazio nao irriga, dois nao somam; (3) fora do raio e do outro lado, nao; (5) o painel', () => {
    const base = cenarioDeFazendaDeUmTile();
    const f1 = base.predios.porId['f1'] as PredioCompleto;
    const perto = lugarPerto(base, f1, A.raio_tiles);
    const longe = lugarPerto(base, f1, A.raio_tiles + 6, A.raio_tiles + 0.5);
    expect(acudeDaFazenda(com(base, acude('a1', perto.gx, perto.gy, A.capacidade)), f1)).toBe('a1');
    expect(acudeDaFazenda(com(base, acude('a1', perto.gx, perto.gy, A.aguaMinimaParaIrrigar - 1)), f1)).toBeNull();
    expect(acudeDaFazenda(com(base, acude('a1', longe.gx, longe.gy, A.capacidade)), f1)).toBeNull();
    expect(acudeDaFazenda(com(base, acude('a1', perto.gx, perto.gy, A.capacidade, LADO_DA_IA)), f1)).toBeNull();
    // dois: vale um so (o mais perto), e o multiplicador do tile e o mesmo de um
    const dois = com(base, acude('a1', perto.gx, perto.gy, A.capacidade), acude('a2', longe.gx, longe.gy, A.capacidade));
    expect(acudeDaFazenda(dois, f1)).toBe('a1');
    expect(painelDoPredio(com(base, acude('a1', perto.gx, perto.gy, A.capacidade)), 'f1')?.irrigada).toBe(true);
    expect(painelDoPredio(base, 'f1')?.irrigada).toBe(false);
    expect(painelDoPredio(base, base.predios.ordem.find((id) => base.predios.porId[id]?.tipo === 'storehouse')!)?.irrigada).toBeNull();
  });

  it('(4) a fazenda irrigada e ocupada consome na seca e nao no inverno', () => {
    const base = cenarioDeFazendaDeUmTile();
    const f1 = base.predios.porId['f1'] as PredioCompleto;
    expect(f1.ocupante).not.toBeNull();
    const perto = lugarPerto(base, f1, A.raio_tiles);
    const s = com(base, acude('a1', perto.gx, perto.gy, A.capacidade));
    expect(fazendasQueConsomem(s, s.predios.porId['a1'] as PredioCompleto)).toBe(1);
    const nivelDepois = (t0: number, n: number): number => {
      let x: GameState = { ...s, tick: t0 };
      for (let i = 0; i < n; i++) x = step(x, []);
      return (x.predios.porId['a1'] as PredioCompleto).agua ?? 0;
    };
    const n = A.ticksPorConsumo * 4;
    // na seca: evaporacao + consumo; no inverno: entrada + evaporacao, sem consumo
    const ts = inicioDa('seca') + 5;
    const naSeca = nivelDepois(ts, n);
    let consumos = 0, evaporacoes = 0;
    for (let t = ts + 1; t <= ts + n; t++) { if (t % A.ticksPorConsumo === 0) consumos += 1; if (t % A.ticksPorEvaporacao === 0) evaporacoes += 1; }
    expect(naSeca).toBe(A.capacidade - consumos - evaporacoes);
    expect(consumos).toBeGreaterThan(0);
    const ti = inicioDa('inverno') + 5;
    expect(nivelDepois(ti, n)).toBe(A.capacidade);
  }, 60_000);
});
