/**
 * I-TELA-LENHA-NO-DEQUE-DO-LENHADOR (aceite 2) — a lenha da cabana gira 25° com a pilha inteira, maior, e no deque.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ladoDaMercadoriaNoEstoque, posicoesGiradas, rotacaoDaMercadoriaNoEstoque } from '../src/render/estoque-visual';

describe('I-TELA-LENHA-NO-DEQUE-DO-LENHADOR', () => {
  it('a rotacao: a lenha da cabana 25 graus, o resto 0', () => {
    expect(rotacaoDaMercadoriaNoEstoque('woodcutters', 'tree_trunk')).toBe(25);
    expect(rotacaoDaMercadoriaNoEstoque('quarry', 'stone')).toBe(0);
    expect(rotacaoDaMercadoriaNoEstoque('woodcutters', 'stone')).toBe(0);
  });

  it('as posicoes giram junto, e 0 grau nao mexe', () => {
    const p = [[1, 0], [0, -1]] as const;
    expect(posicoesGiradas(p, 0)).toBe(p);
    const g = posicoesGiradas(p, 90);
    expect(g[0]?.[0]).toBeCloseTo(0, 9);
    expect(g[0]?.[1]).toBeCloseTo(1, 9);
    expect(g[1]?.[0]).toBeCloseTo(1, 9);
    expect(g[1]?.[1]).toBeCloseTo(0, 9);
  });

  it('maior que o padrao, e o ponto de saida no deque da arte', () => {
    expect(ladoDaMercadoriaNoEstoque('woodcutters', 'tree_trunk', 10)).toBeCloseTo(18, 9);
    const m = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets: { id: string; tipo: string; ancoras?: { estoque?: { saida?: number[][] } } }[] };
    const saida = m.assets.find((a) => a.id === 'woodcutters' && a.tipo === 'predio')?.ancoras?.estoque?.saida;
    expect(saida).toEqual([[0.83, 0.86]]);
  });
});
