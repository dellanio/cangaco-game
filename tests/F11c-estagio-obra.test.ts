import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { estagioDaObra } from '../src/render/estagio-obra';

describe('F11c — estagioDaObra: aritmetica pura, sem import nenhum', () => {
  it('hp === 0 e marcacao', () => {
    expect(estagioDaObra(0, 250)).toBe('marcacao');
  });

  it('0 < hp < hpTotal e madeira', () => {
    expect(estagioDaObra(1, 250)).toBe('madeira');
    expect(estagioDaObra(120, 250)).toBe('madeira');
    expect(estagioDaObra(249, 250)).toBe('madeira');
  });

  it('hp >= hpTotal e completo (o predio de pe)', () => {
    expect(estagioDaObra(250, 250)).toBe('completo');
  });

  it('nunca passa de hpTotal na pratica, mas a funcao nao trava se passasse', () => {
    expect(estagioDaObra(999, 250)).toBe('completo');
  });

  it('nao importa nada: aritmetica pura, como grid.ts', () => {
    const fonte = readFileSync('src/render/estagio-obra.ts', 'utf-8');
    expect(/^\s*import\b/m.test(fonte)).toBe(false);
  });
});
