/**
 * F18c-1c — o guarda da corrida transladada (`npm run test:transladado`).
 *
 * Ela so protege se a troca de fato aconteceu: se o caminho de um dos tres JSON
 * mudar, o plugin nao casa, a suite roda no mundo versionado e passa por
 * vacuidade. Na corrida transladada, este arquivo confere que o que a suite ve
 * — por `import` E por `fs` — e o mundo versionado andado de +K. Na corrida
 * normal, confere que a translacao NAO vazou.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { ancoraDaVila } from './helpers/ancoras';

interface Versionado {
  readonly k: number;
  readonly largura: number;
  readonly altura: number;
  readonly predios: readonly { id: string; gx: number; gy: number }[];
}

const bruto = process.env['CANGACO_MUNDO_VERSIONADO'];
const lidoPorFs = (): { largura: number; altura: number } =>
  JSON.parse(readFileSync('data/maps/sertao-128.json', 'utf8')) as { largura: number; altura: number };

describe('F18c-1c — o mundo que a suite ve', () => {
  if (bruto === undefined) {
    it('corrida normal: import e fs leem o MESMO mapa, sem translacao', () => {
      expect(process.env['CANGACO_TRANSLADO_K']).toBeUndefined();
      const { largura, altura } = lidoPorFs();
      const fs = { largura, altura };
      expect({ largura: gameData.mapa.largura, altura: gameData.mapa.altura }).toEqual(fs);
      expect(gameData.terreno.mapaPadrao).toEqual(fs);
    });
    return;
  }
  const v = JSON.parse(bruto) as Versionado;

  it('corrida transladada: K e positivo', () => {
    expect(v.k).toBeGreaterThan(0);
  });

  it('o mapa importado cresceu de K, e o tamanho declarado acompanha', () => {
    expect(gameData.mapa.largura).toBe(v.largura + v.k);
    expect(gameData.mapa.altura).toBe(v.altura + v.k);
    expect(gameData.terreno.mapaPadrao).toEqual({ largura: v.largura + v.k, altura: v.altura + v.k });
  });

  it('a vila importada andou de +K, e a ancora dos testes com ela', () => {
    const esperado = v.predios.map((p) => ({ id: p.id, gx: p.gx + v.k, gy: p.gy + v.k }));
    expect(gameData.economia.estadoInicial.predios.map((p) => ({ id: p.id, gx: p.gx, gy: p.gy }))).toEqual(esperado);
    const armazem = esperado.find((p) => p.id === 'storehouse');
    expect(ancoraDaVila()).toEqual({ gx: armazem?.gx, gy: armazem?.gy });
  });

  it('o que se le por fs e o mesmo mundo transladado do import', () => {
    expect(lidoPorFs()).toMatchObject({ largura: v.largura + v.k, altura: v.altura + v.k });
  });
});
