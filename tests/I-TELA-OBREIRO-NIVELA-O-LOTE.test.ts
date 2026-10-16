/**
 * I-TELA-OBREIRO-NIVELA-O-LOTE (aceite 1) — a ordem em zigue-zague do lote, o tile de cada obreiro que nivela pela
 * leitura do canteiro (a mesma da F17d) e o passo do desenho ate ele. So tela: a posicao logica nao muda.
 */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/sim/state';
import { indiceDoObreiroNoLote, ordemDeNivelamento, canteiroDaObra } from '../src/render/nivelamento-obra';
import { animacaoDoGesto, passoNoLote, tileDoNivelamento } from '../src/render/gesto-do-trabalho';
import type { GestoDoTrabalho } from '../src/render/gesto-do-trabalho';
import { caixaDeTipoNoMapa } from '../src/render/predios';
import { alvoDeNivelamento } from '../src/sim/obra';
import dados from '../data/gesto-do-trabalho.json';

const config = dados as unknown as GestoDoTrabalho;

describe('a ordem de nivelamento em zigue-zague', () => {
  it.each([[3, 2], [4, 3], [1, 1], [2, 4]])('lote %ix%i: todos os tiles uma vez, cada um vizinho do anterior', (l, a) => {
    const ordem = ordemDeNivelamento(l, a);
    expect(ordem).toHaveLength(l * a);
    expect(new Set(ordem.map((t) => `${t.gx},${t.gy}`)).size).toBe(l * a);
    for (let i = 1; i < ordem.length; i++) {
      expect(Math.abs(ordem[i]!.gx - ordem[i - 1]!.gx) + Math.abs(ordem[i]!.gy - ordem[i - 1]!.gy)).toBe(1);
    }
  });
  it('a fileira seguinte volta no sentido contrario', () => {
    expect(ordemDeNivelamento(3, 2).map((t) => `${t.gx},${t.gy}`)).toEqual(['0,0', '1,0', '2,0', '2,1', '1,1', '0,1']);
  });
});

describe('o tile de cada obreiro', () => {
  it.each([
    // tilesProntos, ordem, esperado (de 6 tiles)
    [0, 0, 0], [0, 1, 1], [2, 0, 2], [2, 1, 3], [5, 0, 5], [5, 1, 5], [6, 0, 5],
  ])('prontos %i, obreiro %i -> tile %i', (prontos, ordem, esperado) => {
    expect(indiceDoObreiroNoLote({ tilesProntos: prontos, tilesTotais: 6 }, ordem)).toBe(esperado);
  });
  it('dois obreiros nunca no mesmo tile enquanto ha tile, e nunca num tile ja aplainado', () => {
    for (let prontos = 0; prontos < 5; prontos++) {
      const a = indiceDoObreiroNoLote({ tilesProntos: prontos, tilesTotais: 6 }, 0);
      const b = indiceDoObreiroNoLote({ tilesProntos: prontos, tilesTotais: 6 }, 1);
      expect(a).not.toBe(b);
      expect(Math.min(a, b)).toBeGreaterThanOrEqual(prontos);
    }
  });
});

describe('no estado: o obreiro que nivela vai para dentro do lote', () => {
  const caixa = caixaDeTipoNoMapa('woodcutters', 10, 10)!;
  const area = (caixa.x1 - caixa.x0) * (caixa.y1 - caixa.y0);
  const porTile = alvoDeNivelamento('woodcutters') / area;
  function estado(nivelamento: number, obreiros: string[]): GameState {
    const unidades = Object.fromEntries(obreiros.map((id, i) => [id, { id, tipo: 'laborer', fsm: 'nivelando', fsmData: { tarefa: `t${i}` }, gx: 9, gy: 10 + i }]));
    const tarefas = Object.fromEntries(obreiros.map((_id, i) => [`t${i}`, { id: `t${i}`, tipo: 'construir', destino: 'o1' }]));
    return {
      unidades: { porId: unidades, ordem: obreiros },
      jobs: { tarefas: { porId: tarefas, ordem: Object.keys(tarefas) } },
      predios: { porId: { o1: { id: 'o1', tipo: 'woodcutters', gx: 10, gy: 10, estado: 'obra', obra: { faltam: {}, nivelamento } } }, ordem: ['o1'] },
    } as unknown as GameState;
  }
  it('o tile acompanha o canteiro: comeca no primeiro e anda pelo zigue-zague', () => {
    const vistos = new Set<string>();
    for (let n = 0; n < area; n++) {
      const e = estado(n * porTile, ['l1']);
      const t = tileDoNivelamento(e, e.unidades.porId['l1']!, caixaDeTipoNoMapa)!.tile;
      expect(t.gx).toBeGreaterThanOrEqual(caixa.x0); expect(t.gx).toBeLessThan(caixa.x1);
      expect(t.gy).toBeGreaterThanOrEqual(caixa.y0); expect(t.gy).toBeLessThan(caixa.y1);
      expect(canteiroDaObra(n * porTile, alvoDeNivelamento('woodcutters'), area).tilesProntos).toBe(n);
      vistos.add(`${t.gx},${t.gy}`);
    }
    expect(vistos.size).toBe(area);
  });
  it('dentro do tile, o ponto avanca para o tile seguinte com a fracao do nivelamento', () => {
    const e0 = estado(0, ['l1']); const e1 = estado(porTile / 2, ['l1']);
    const p0 = tileDoNivelamento(e0, e0.unidades.porId['l1']!, caixaDeTipoNoMapa)!;
    const p1 = tileDoNivelamento(e1, e1.unidades.porId['l1']!, caixaDeTipoNoMapa)!;
    expect(p1.tile).toEqual(p0.tile);
    expect(p1.gx - p0.gx).toBeCloseTo(0.5, 6);
  });
  it('com dois obreiros, cada um num tile', () => {
    const e = estado(porTile, ['l1', 'l2']);
    const a = tileDoNivelamento(e, e.unidades.porId['l1']!, caixaDeTipoNoMapa)!.tile;
    const b = tileDoNivelamento(e, e.unidades.porId['l2']!, caixaDeTipoNoMapa)!.tile;
    expect(`${a.gx},${a.gy}`).not.toBe(`${b.gx},${b.gy}`);
  });
  it('fora do nivelamento, nada (o martelar continua como era)', () => {
    const e = estado(0, ['l1']);
    expect(tileDoNivelamento(e, { ...e.unidades.porId['l1']!, fsm: 'martelando' }, caixaDeTipoNoMapa)).toBeNull();
  });
  it('o gesto ao nivelar e a enxada (arar), e o de martelar continua', () => {
    const e = estado(0, ['l1']);
    const anim = { trabalhar: {}, martelar: {}, arar: {}, andar: {} };
    expect(animacaoDoGesto(e, { tipo: 'laborer', fsm: 'nivelando', fsmData: { tarefa: 't0' } }, 'trabalhar', anim, config)).toBe('arar');
    expect(animacaoDoGesto(e, { tipo: 'laborer', fsm: 'martelando', fsmData: { tarefa: 't0' } }, 'trabalhar', anim, config)).toBe('martelar');
  });
});

describe('o passo do desenho no lote', () => {
  it('anda ate o alvo na velocidade dada e para nele', () => {
    let d = passoNoLote(null, { x: 64, y: 0 }, 0, 16);
    expect(d).toMatchObject({ x: 0, andando: true });
    d = passoNoLote(d, { x: 64, y: 0 }, 2, 16);
    expect(d).toMatchObject({ x: 32, andando: true });
    d = passoNoLote(d, { x: 64, y: 0 }, 10, 16);
    expect(d).toMatchObject({ x: 64, y: 0, andando: false });
    expect(d!.distanciaPx).toBeCloseTo(64, 6);
  });
  it('perto do alvo (dentro do limiar), segue capinando: nao conta como andar', () => {
    const d = passoNoLote({ x: 0, y: 0, tempo: 0, andando: false, distanciaPx: 0, dx: 0, dy: 0 }, { x: 10, y: 0 }, 0.1, 16, 16);
    expect(d).toMatchObject({ andando: false });
  });
  it('sem alvo, volta andando ao tile logico e sai do lote', () => {
    let d = passoNoLote({ x: 32, y: 0, tempo: 0, andando: false, distanciaPx: 0, dx: 1, dy: 0 }, null, 1, 16);
    expect(d).toMatchObject({ x: 16, andando: true });
    d = passoNoLote(d, null, 10, 16);
    expect(d).toBeNull();
  });
});
