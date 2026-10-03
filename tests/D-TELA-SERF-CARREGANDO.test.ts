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
