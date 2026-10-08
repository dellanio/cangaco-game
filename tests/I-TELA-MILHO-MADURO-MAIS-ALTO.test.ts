import { describe, expect, it } from 'vitest';
import { geometriaDaCultura } from '../src/render/culturas-visual';
import { ESTAGIOS_DA_CULTURA } from '../src/render/crescimento';

describe('I-TELA-MILHO-MADURO-MAIS-ALTO', () => {
  it('milho pronto ganha 50% de altura, preservando largura e contato com o solo', () => {
    const antes = geometriaDaCultura('corn', 'verde', 32);
    const pronto = geometriaDaCultura('corn', 'pronto', 32);
    expect(pronto.altura / antes.altura).toBe(1.5);
    expect(pronto.largura / antes.largura).toBe(1);
    expect([pronto.peX, pronto.peY]).toEqual([antes.peX, antes.peY]);
    expect(pronto.emPe).toBe(true);
  });
  it('so o milho maduro muda: estagios anteriores, pousio e cana preservados', () => {
    for (const estagio of [...ESTAGIOS_DA_CULTURA, null]) {
      expect(geometriaDaCultura('grapes', estagio, 32)).toEqual({ largura: 32, altura: 32, peX: 16, peY: 32, emPe: false });
      if (estagio !== 'pronto') expect(geometriaDaCultura('corn', estagio, 32).emPe).toBe(false);
    }
  });
});
