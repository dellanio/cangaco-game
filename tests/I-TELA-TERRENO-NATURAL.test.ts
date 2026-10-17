/**
 * I-TELA-TERRENO-NATURAL (aceite 1) — o campo da areia: 1 no miolo, 0 longe dela; a borda de um quadrado de areia sem
 * degrau de tile (o limiar corta os tiles de canto); a mesma semente, o mesmo campo; o tom dentro do alfa maximo; e so a
 * fase 1 na lista.
 */
import { describe, expect, it } from 'vitest';
import { campoDaAreia, manchasDeTom, mascarasDaBorda } from '../src/render/terreno-natural';
import type { ConfigDoTerrenoNatural } from '../src/render/terreno-natural';
import dados from '../data/terreno-natural.json';

const config = dados as unknown as ConfigDoTerrenoNatural;
const A = config.amostrasPorTile;
// um quadrado de areia de 6x6 tiles no meio de 16x16 de grama
const ehAreia = (gx: number, gy: number): boolean => gx >= 5 && gx < 11 && gy >= 5 && gy < 11;
const campo = campoDaAreia(ehAreia, 16, 16, 42, config);
const valor = (tx: number, ty: number): number => campo.areia[Math.round(ty * A) * campo.largura + Math.round(tx * A)]!;

describe('I-TELA-TERRENO-NATURAL', () => {
  it('areia no miolo, grama longe dela', () => {
    expect(valor(8, 8)).toBe(1);
    expect(valor(1.5, 1.5)).toBe(0);
    expect(valor(14.5, 14.5)).toBe(0);
  });
  it('o canto do quadrado e arredondado: o limiar corta o tile de canto, e a quina fica grama', () => {
    // a quina exata do quadrado (o canto de fora do tile 5,5) fica grama; o meio da aresta, na mesma distancia, areia
    expect(valor(5.1, 5.1)).toBeLessThan(0.5);
    expect(valor(8, 5.1)).toBeGreaterThan(0.5);
  });
  it('as mascaras so mexem nos tiles de areia e grama, e a mesma semente da o mesmo campo', () => {
    const tipo = (gx: number, gy: number): 'areia' | 'grama' | 'outro' => (gx === 0 ? 'outro' : ehAreia(gx, gy) ? 'areia' : 'grama');
    const m = mascarasDaBorda(campo, tipo, A);
    for (let y = 0; y < campo.altura; y++) for (let x = 0; x < A; x++) {
      expect(m.areia[y * campo.largura + x]).toBe(0);
      expect(m.grama[y * campo.largura + x]).toBe(0);
    }
    expect(campoDaAreia(ehAreia, 16, 16, 42, config).areia).toEqual(campo.areia);
    expect(campoDaAreia(ehAreia, 16, 16, 43, config).areia).not.toEqual(campo.areia);
  });
  it('o tom fica dentro do alfa maximo, e a lista tem so a fase 1', () => {
    const tons = manchasDeTom(32, 32, 7, config);
    let maior = 0;
    for (let i = 3; i < tons.length; i += 4) maior = Math.max(maior, tons[i]!);
    expect(maior).toBeGreaterThan(0);
    expect(maior).toBeLessThanOrEqual(Math.round(config.tons.alfaMaximo * 255));
    expect(config.mapas).toEqual(['fase-01-pianco']);
  });
});
