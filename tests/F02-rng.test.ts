import { describe, it, expect } from 'vitest';
import { createRng, nextU32, nextFloat, nextInt } from '../src/sim/rng';

describe('F02 — rng', () => {
  it('mesma semente produz a mesma sequencia', () => {
    const colher = (seed: number): number[] => {
      let rng = createRng(seed);
      const saida: number[] = [];
      for (let i = 0; i < 100; i++) {
        const passo = nextU32(rng);
        rng = passo.rng;
        saida.push(passo.value);
      }
      return saida;
    };
    expect(colher(12345)).toEqual(colher(12345));
  });

  it('sementes diferentes divergem', () => {
    expect(nextU32(createRng(1)).value).not.toBe(nextU32(createRng(2)).value);
  });

  it('nao muta o estado recebido', () => {
    const rng = Object.freeze(createRng(7));
    const antes = JSON.stringify(rng);
    nextU32(rng);
    expect(JSON.stringify(rng)).toBe(antes);
  });

  it('nextFloat fica em [0,1)', () => {
    let rng = createRng(99);
    for (let i = 0; i < 500; i++) {
      const passo = nextFloat(rng);
      rng = passo.rng;
      expect(passo.value).toBeGreaterThanOrEqual(0);
      expect(passo.value).toBeLessThan(1);
    }
  });

  it('nextInt respeita os limites', () => {
    let rng = createRng(4);
    const vistos = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const passo = nextInt(rng, 3, 7);
      rng = passo.rng;
      expect(passo.value).toBeGreaterThanOrEqual(3);
      expect(passo.value).toBeLessThan(7);
      expect(Number.isInteger(passo.value)).toBe(true);
      vistos.add(passo.value);
    }
    expect([...vistos].sort()).toEqual([3, 4, 5, 6]);
  });

  it('nextInt nao enviesa: 10000 sorteios em [0,3) ficam a +-5% de 1/3', () => {
    let rng = createRng(20260919);
    const contagem = [0, 0, 0];
    const total = 10000;
    for (let i = 0; i < total; i++) {
      const passo = nextInt(rng, 0, 3);
      rng = passo.rng;
      contagem[passo.value] = (contagem[passo.value] ?? 0) + 1;
    }
    const esperado = 1 / 3;
    for (const face of contagem) {
      const frequencia = face / total;
      expect(frequencia).toBeGreaterThan(esperado * 0.95);
      expect(frequencia).toBeLessThan(esperado * 1.05);
    }
    expect(contagem.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it('nextInt e deterministico mesmo com rejeicao', () => {
    const colher = (): number[] => {
      let rng = createRng(555);
      const saida: number[] = [];
      for (let i = 0; i < 200; i++) {
        const passo = nextInt(rng, 0, 7);
        rng = passo.rng;
        saida.push(passo.value);
      }
      return saida;
    };
    expect(colher()).toEqual(colher());
  });

  it('nextInt rejeita faixa vazia ou invertida', () => {
    expect(() => nextInt(createRng(1), 5, 5)).toThrow();
    expect(() => nextInt(createRng(1), 5, 2)).toThrow();
  });

  it('RngState sobrevive a ida e volta por JSON', () => {
    const rng = nextU32(nextU32(createRng(42)).rng).rng;
    const revivido = JSON.parse(JSON.stringify(rng)) as typeof rng;
    expect(revivido).toEqual(rng);
    expect(nextU32(revivido).value).toBe(nextU32(rng).value);
  });
});
