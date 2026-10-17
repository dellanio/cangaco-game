/**
 * I-ARTE-MONTANHA-COM-VEIOS (aceite 1) — o bloco de cada tile pelo terreno e pelo recurso: granito, ferro, ouro; o veio
 * esgotado volta ao granito; fora da montanha, nenhum; a mesma posicao, a mesma variante. E, no mapa do sertao, todo
 * veio de ferro e de ouro esta num tile de montanha (o que torna o bloco com veio o desenho certo do minerio).
 */
import { describe, expect, it } from 'vitest';
import { blocoDoMacico, VEIOS_NA_MONTANHA } from '../src/render/macico';
import { LACOS_DO_MACICO } from '../src/render/manifesto-camadas';
import mapa from '../data/maps/sertao-128.json';

describe('o bloco do macico', () => {
  it.each([
    ['montanha', undefined, /^granito_[1-4]$/],
    ['montanha', { tipo: 'iron_ore', quantidade: 12 }, /^ferro_[12]$/],
    ['montanha', { tipo: 'gold_ore', quantidade: 8 }, /^ouro_[12]$/],
    ['montanha', { tipo: 'iron_ore', quantidade: 0 }, /^granito_[1-4]$/],
    ['montanha', { tipo: 'gold_ore', quantidade: 0 }, /^granito_[1-4]$/],
    ['montanha', { tipo: 'coal', quantidade: 15 }, /^granito_[1-4]$/],
  ])('%s com %j', (terreno, recurso, esperado) => {
    expect(blocoDoMacico(terreno, 7, 9, recurso)).toMatch(esperado);
  });
  it.each(['grama', 'areia', 'agua'])('fora da montanha (%s), nenhum bloco', (terreno) => {
    expect(blocoDoMacico(terreno, 7, 9, { tipo: 'iron_ore', quantidade: 12 })).toBeNull();
  });
  it('na rocha, so o veio tem bloco (a saia de pedra do macico); sem veio, ou esgotado, o lajedo', () => {
    expect(blocoDoMacico('rocha', 7, 9, { tipo: 'gold_ore', quantidade: 8 })).toMatch(/^ouro_[12]$/);
    expect(blocoDoMacico('rocha', 7, 9, { tipo: 'gold_ore', quantidade: 0 })).toBeNull();
    expect(blocoDoMacico('rocha', 7, 9, { tipo: 'rock', quantidade: 15 })).toBeNull();
    expect(blocoDoMacico('rocha', 7, 9, undefined)).toBeNull();
  });
  it('a mesma posicao da sempre a mesma variante, e as variantes todas aparecem num macico', () => {
    const vistos = new Set<string>();
    for (let gx = 0; gx < 20; gx++) for (let gy = 0; gy < 20; gy++) {
      const a = blocoDoMacico('montanha', gx, gy, undefined);
      expect(blocoDoMacico('montanha', gx, gy, undefined)).toBe(a);
      vistos.add(a!);
    }
    expect(vistos.size).toBe(LACOS_DO_MACICO.granito);
  });
  it('o morrinho que sai do mapa e so o do ferro e o do ouro (o carvao continua no chao)', () => {
    expect([...VEIOS_NA_MONTANHA].sort()).toEqual(['gold_ore', 'iron_ore']);
  });
});

describe('no mapa do sertao', () => {
  const linhas = (mapa as unknown as { linhas: string[] }).linhas;
  const legenda = (mapa as unknown as { legenda: Record<string, string> }).legenda;
  const recursos = (mapa as unknown as { recursos: Record<string, [number, number][]> }).recursos;
  const terreno = (gx: number, gy: number): string | undefined => legenda[linhas[gy]?.[gx] ?? ''];
  it.each(['iron_ore', 'gold_ore'])('todo veio de %s esta na montanha, ou na rocha encostada nela (a ate 2 tiles)', (tipo) => {
    const tiles = recursos[tipo] ?? [];
    expect(tiles.length).toBeGreaterThan(0);
    for (const [gx, gy] of tiles) {
      const t = terreno(gx, gy);
      let montanhaPerto = false;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (terreno(gx + dx, gy + dy) === 'montanha') montanhaPerto = true;
      expect(t === 'montanha' || (t === 'rocha' && montanhaPerto), `${tipo} em ${gx},${gy} (${t})`).toBe(true);
    }
  });
});
