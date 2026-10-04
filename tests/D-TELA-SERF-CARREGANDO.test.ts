import { describe, expect, it } from 'vitest';
import { animacaoComCarga } from '../src/render/acao-de-unidade';

const com = { parado: {}, andar: {}, carregando: {} };
const sem = { parado: {}, andar: {} };

describe('D-TELA-SERF-CARREGANDO', () => {
  it.each([
    ['andar com carga e com a animacao', 'andar', true, com, 'carregando'],
    ['andar sem carga', 'andar', false, com, 'andar'],
    ['andar com carga, sem a animacao no manifesto', 'andar', true, sem, 'andar'],
    ['andar com carga, sem manifesto animado', 'andar', true, undefined, 'andar'],
    ['parado com carga', 'parado', true, com, 'parado'],
    ['trabalhar com carga', 'trabalhar', true, com, 'trabalhar'],
    ['atacar com carga', 'atacar', true, com, 'atacar'],
  ] as const)('%s', (_caso, acao, carga, animacoes, esperado) => {
    expect(animacaoComCarga(acao, carga, animacoes)).toBe(esperado);
  });
});

// D-ARTE-PIXEL-ART-CIVIS — o ponto da mercadoria entre as maos, por direcao, e a regra do dado.
import { readFileSync } from 'node:fs';
import { pontoDaCargaNasMaos } from '../src/render/carga-nas-maos';
import type { CargaNasMaos } from '../src/render/carga-nas-maos';
import { validarCargaNasMaos } from '../tools/data-rules.js';

const config = JSON.parse(readFileSync('data/carga-nas-maos.json', 'utf8')) as CargaNasMaos;

describe('D-ARTE-PIXEL-ART-CIVIS — a carga nas maos', () => {
  it.each(['n', 'ne', 'l', 'se', 's'] as const)('a direcao canonica %s le o ponto do dado', (d) => {
    expect(pontoDaCargaNasMaos(d, config)).toEqual(config.pontos[d]);
  });
  it.each([['o', 'l'], ['so', 'se'], ['no', 'ne']] as const)('o oeste %s e o espelho de %s', (oeste, leste) => {
    const p = config.pontos[leste];
    expect(pontoDaCargaNasMaos(oeste, config)).toEqual({ x: -p.x, y: p.y, atras: p.atras });
  });
  it('de frente a carga vai na frente do corpo, de costas atras', () => {
    expect(pontoDaCargaNasMaos('s', config).atras).toBe(false);
    expect(pontoDaCargaNasMaos('n', config).atras).toBe(true);
  });
  it('o dado de hoje passa, e a regra reprova cada defeito', () => {
    const erros = (c: unknown): string[] => { const e: string[] = []; validarCargaNasMaos(c, e); return e; };
    expect(erros(config)).toEqual([]);
    expect(erros({ ...config, tamanhoPx: 0 }).join()).toMatch(/tamanhoPx/);
    expect(erros({ ...config, pontos: { ...config.pontos, s: { x: 0, y: 5, atras: false } } }).join()).toMatch(/pontos\.s\.y/);
    expect(erros({ ...config, pontos: { ...config.pontos, n: { x: 0, y: -40 } } }).join()).toMatch(/pontos\.n/);
    expect(erros(null).join()).toMatch(/precisa existir/);
  });
});
