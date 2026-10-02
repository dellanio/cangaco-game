import { describe, expect, it } from 'vitest';
import { arvoreNaVista, quadroDoVentoMudou } from '../src/render/vento';

describe('D-TELA-VENTO-NA-VISTA', () => {
  it('cruza o retangulo desenhado pelo pe, anchor e tamanho do manifesto', () => {
    const vista = { x: 0, y: 0, width: 100, height: 100 };
    const tamanho = [40, 80] as const;
    expect(arvoreNaVista({ x: 50, y: 100 }, [0.5, 1], tamanho, 1, vista)).toBe(true);
    expect(arvoreNaVista({ x: 110, y: 100 }, [0.5, 1], tamanho, 1, vista)).toBe(true);
    expect(arvoreNaVista({ x: 121, y: 100 }, [0.5, 1], tamanho, 1, vista)).toBe(false);
    expect(arvoreNaVista({ x: 50, y: 150 }, [0.5, 1], tamanho, 1, vista)).toBe(true);
    expect(arvoreNaVista({ x: 50, y: 181 }, [0.5, 1], tamanho, 1, vista)).toBe(false);
    expect(arvoreNaVista({ x: 110, y: 100 }, [0.5, 1], tamanho, 0.4, vista)).toBe(false);
    expect(arvoreNaVista({ x: -10, y: 50 }, [0, 0.5], tamanho, 1, vista)).toBe(true);
  });

  it('pula quadro repetido e atualiza por tick, alfa, camera ou sprite novo', () => {
    const quadro = { tick: 20, alfa: 1, vista: '0,0,100,100' };
    expect(quadroDoVentoMudou(null, quadro, false)).toBe(true);
    expect(quadroDoVentoMudou(quadro, quadro, false)).toBe(false);
    expect(quadroDoVentoMudou(quadro, { ...quadro, tick: 21 }, false)).toBe(true);
    expect(quadroDoVentoMudou(quadro, { ...quadro, alfa: 0.5 }, false)).toBe(true);
    expect(quadroDoVentoMudou(quadro, { ...quadro, vista: '20,0,100,100' }, false)).toBe(true);
    expect(quadroDoVentoMudou(quadro, quadro, true)).toBe(true);
  });
});
