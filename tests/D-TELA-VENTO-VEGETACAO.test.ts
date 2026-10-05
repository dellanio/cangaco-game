import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { balancaVegetacao, faseDoTile, transformacaoDoVento, type DadosDoVento } from '../src/render/vento';
import { validarVento } from '../tools/data-rules.js';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { gravarEvidencia } from './helpers/evidence';

const dados = JSON.parse(readFileSync('data/vento.json', 'utf8')) as DadosDoVento;
const transformar = (d: DadosDoVento, t: number, a: number, x: number, y: number) =>
  transformacaoDoVento(d, t, a, x, y, x * 64 + 32, y * 64 + 64);

describe('D-TELA-VENTO-VEGETACAO', () => {
  it('e pura, limitada, sem vento parado e com fases distintas por tile', () => {
    expect(transformar(dados, 73, 0.25, 3, 4)).toEqual(transformar(dados, 73, 0.25, 3, 4));
    const semForca = { ...dados, forca: 0 };
    let maior = 0;
    for (let t = 0; t < 2000; t += 1) {
      for (let y = 0; y < 10; y += 1) for (let x = 0; x < 10; x += 1) {
        const v = transformar(dados, t, 0, x, y);
        maior = Math.max(maior, Math.abs(v.deslocamentoGraus));
        expect(Math.abs(v.deslocamentoGraus)).toBeLessThanOrEqual(dados.amplitudeMaximaGraus);
        expect(transformar(semForca, t, 0, x, y).deslocamentoGraus).toBe(0);
      }
    }
    const fasesDistintas = new Set(Array.from({ length: 100 }, (_v, n) =>
      faseDoTile(n % 10, Math.floor(n / 10)))).size;
    expect(fasesDistintas).toBeGreaterThan(1);
    gravarEvidencia('D-TELA-VENTO-VEGETACAO', { maiorDeslocamentoGraus: maior, fasesDistintas, tiles: 100, ticks: 2000 });
  // `timeout` NAO e assercao de tempo (CLAUDE.md §8): existe para o caso travar. Sozinho 2,2 s (medido
  // 2026-10-05); na suite carregada passou do padrao de 5 s duas vezes (2026-10-04 e 2026-10-05).
  }, 15_000);

  it('a rajada chega ao tile jusante depois do montante, pela velocidade do dado', () => {
    const pico = (x: number) => {
      let melhor = -1;
      let tick = -1;
      for (let t = 0; t < dados.rajada.intervaloTicks; t += 1) {
        const intensidade = transformar(dados, t, 0, x, 0).intensidadeDaRajada;
        if (intensidade > melhor) { melhor = intensidade; tick = t; }
      }
      return tick;
    };
    const distancia = 10;
    const atraso = distancia / dados.rajada.velocidadeTilesPorTick;
    expect(pico(distancia)).toBeGreaterThan(pico(0));
    expect(Math.abs(pico(distancia) - pico(0) - atraso)).toBeLessThanOrEqual(1);
  });

  it('preserva o pe e so lista a arvore', () => {
    const v = transformar(dados, 81, 0.4, 2, 5);
    expect([v.xPe, v.yPe, v.origem]).toEqual([160, 384, [0.5, 1]]);
    expect(balancaVegetacao('tree', dados)).toBe(true);
    expect(balancaVegetacao('rock', dados)).toBe(false);
  });

  it('o dado e so de interface e a regra reprova id fora do manifesto', () => {
    expect(ARQUIVOS_DA_INTERFACE).toContain('vento');
    expect(ARQUIVOS).not.toContain('vento');
    const erros: string[] = [];
    validarVento({ ...dados, vegetacaoQueBalanca: ['arvore-inventada'] }, erros);
    expect(erros.some((e) => e.includes('interface/vento') && e.includes('arvore-inventada'))).toBe(true);
  });
});
