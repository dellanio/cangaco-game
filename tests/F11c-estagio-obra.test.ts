import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { estagioDaObra, estaEmObra } from '../src/render/estagio-obra';

// F17e: os tres estagios da F11c viraram seis (cinco em obra + completo). O que
// a F11c fixou continua valendo e e o que este arquivo guarda — "nada martelado",
// "em obra" e "de pe" —; a divisao fina do meio e da F17e.
describe('F11c — estagioDaObra: aritmetica pura, sem import nenhum', () => {
  it('hp === 0 e o chao: marcacao antes de nivelar, fundacao depois', () => {
    expect(estagioDaObra(0, 250, false)).toBe('marcacao');
    expect(estagioDaObra(0, 250, true)).toBe('fundacao');
  });

  it('0 < hp < hpTotal e SEMPRE um estagio de obra, nunca chao nem predio de pe', () => {
    for (const hp of [1, 120, 249]) {
      const e = estagioDaObra(hp, 250, true);
      expect(estaEmObra(e), `hp=${hp}`).toBe(true);
      expect(['marcacao', 'fundacao'], `hp=${hp}`).not.toContain(e);
    }
  });

  it('hp >= hpTotal e completo (o predio de pe)', () => {
    expect(estagioDaObra(250, 250, true)).toBe('completo');
  });

  it('nunca passa de hpTotal na pratica, mas a funcao nao trava se passasse', () => {
    expect(estagioDaObra(999, 250, true)).toBe('completo');
  });

  it('nao importa nada: aritmetica pura, como grid.ts', () => {
    const fonte = readFileSync('src/render/estagio-obra.ts', 'utf-8');
    expect(/^\s*import\b/m.test(fonte)).toBe(false);
  });
});
