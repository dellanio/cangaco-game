/**
 * BUG-O (a etiqueta da carga mostrava o id neutro): o rotulo da carga sobre a unidade
 * vem do tema, e toda mercadoria de `economy.json` tem nome la (CLAUDE.md §9).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { rotuloDaCarga } from '../src/render/rotulo-da-carga';
import temaSertao from '../data/theme-sertao.json';

describe('BUG-O — o rotulo da carga', () => {
  it('o pao aparece como o tema diz, nao como "loaves"', () => {
    expect(rotuloDaCarga('loaves')).toBe(temaSertao.mercadorias.loaves);
    expect(rotuloDaCarga('loaves')).not.toBe('loaves');
  });

  it('toda mercadoria da economia tem nome no tema', () => {
    for (const m of gameData.economia.mercadorias) expect(() => rotuloDaCarga(m), m).not.toThrow();
  });

  it('mercadoria sem tema reprova alto, em vez de cair no id', () => {
    expect(() => rotuloDaCarga('mercadoria-de-outra-versao')).toThrow(/nao tem nome/);
  });
});
