/**
 * I-TELA-OBRA-PARTE-A-PARTE — a obra sobe por blocos, linha a linha de baixo para cima, numa ordem
 * fixa embaralhada por predio (pedido do operador, 2026-10-05). Regra pura de render, por tabela.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { blocosVisiveis, ordemDosBlocos, quantosBlocos, recorteDoBloco } from '../src/render/obra-revelacao';
import type { GradeDaObra } from '../src/render/obra-revelacao';
import type { Fracao } from '../src/render/estagio-obra';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { validarInterface } from '../tools/data-rules.js';

const grade = JSON.parse(readFileSync('data/obra-revelacao.json', 'utf8')) as GradeDaObra;
const total = grade.linhas * grade.colunas;
const chave = (b: { linha: number; coluna: number }) => `${b.linha},${b.coluna}`;

describe('I-TELA-OBRA-PARTE-A-PARTE', () => {
  it('(1) fracao -> blocos: 0 nada, 1 tudo, e a contagem segue a fracao', () => {
    const tabela: [Fracao, number][] = [
      [[0, 1], 0], [[1, 1], total], [[5, 4], total], [[1, total], 1], [[1, total * 2], 0],
      [[1, 2], Math.floor(total / 2)], [[3, 4], Math.floor((3 * total) / 4)], [[total - 1, total], total - 1],
    ];
    for (const [fracao, n] of tabela) {
      expect(quantosBlocos(fracao, grade), JSON.stringify(fracao)).toBe(n);
      expect(blocosVisiveis(fracao, grade, 'p1:madeira')).toHaveLength(n);
    }
    expect(new Set(blocosVisiveis([1, 1], grade, 'p1:madeira').map(chave)).size).toBe(total);
  });

  it('(1) monotonica: o bloco que apareceu nao some quando a fracao cresce', () => {
    let antes = new Set<string>();
    for (let num = 0; num <= 100; num++) {
      const agora = new Set(blocosVisiveis([num, 100], grade, 'p7:pedra').map(chave));
      for (const b of antes) expect(agora.has(b), `${b} em ${num}/100`).toBe(true);
      antes = agora;
    }
  });

  it('(1) linha a linha de baixo para cima; a mesma ordem para o mesmo predio, outra para outro', () => {
    const ordem = ordemDosBlocos(grade, 'p1:madeira');
    for (let i = 1; i < ordem.length; i++) expect(ordem[i]!.linha).toBeGreaterThanOrEqual(ordem[i - 1]!.linha);
    expect(ordem[0]!.linha).toBe(0);
    expect(ordemDosBlocos(grade, 'p1:madeira')).toEqual(ordem);
    const outras = ['p2:madeira', 'p3:madeira', 'p1:pedra', 'obra-9:madeira'].map((s) => ordemDosBlocos(grade, s).map(chave).join(' '));
    expect(outras.some((o) => o !== ordem.map(chave).join(' '))).toBe(true);
    // embaralhada: em alguma linha, a ordem das colunas nao e a crescente
    const crescente = ordem.every((b, i) => b.coluna === i % grade.colunas);
    expect(crescente).toBe(false);
  });

  it('o recorte dos blocos cobre a textura inteira, sem fresta e sem sobreposicao', () => {
    const [w, h] = [97, 131];
    let area = 0;
    for (const b of ordemDosBlocos(grade, 'x')) {
      const r = recorteDoBloco(b, grade, w, h);
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
      area += r.w * r.h;
    }
    expect(area).toBe(w * h);
    // a linha 0 e a de baixo da textura
    expect(recorteDoBloco({ linha: 0, coluna: 0 }, grade, w, h).y + recorteDoBloco({ linha: 0, coluna: 0 }, grade, w, h).h).toBe(h);
  });

  it('o dado: o validador reprova a grade sem linhas', () => {
    const ler = (nomes: readonly string[]) => Object.fromEntries(nomes.map((nome) => [nome, JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'))]));
    const dados = ler(ARQUIVOS), interfaceUi = ler(ARQUIVOS_DA_INTERFACE);
    expect(validarInterface(dados, interfaceUi)).toEqual([]);
    expect(validarInterface(dados, { ...interfaceUi, 'obra-revelacao': { ...grade, linhas: 0 } }))
      .toContain('interface/obra-revelacao: linhas precisa ser inteiro > 0');
  });
});
