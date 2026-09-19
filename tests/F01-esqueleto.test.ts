import { describe, it, expect, afterAll } from 'vitest';
import { SIM_SKELETON } from '../src/sim/version';
import { gravarEvidencia } from './helpers/evidence';

describe('F01 — esqueleto', () => {
  it('a sim expoe o marcador de esqueleto', () => {
    expect(SIM_SKELETON).toBe('F01');
  });

  afterAll(() => {
    gravarEvidencia('F01', {
      feature: 'F01-esqueleto',
      estrutura: ['src/sim', 'src/render', 'src/ui', 'src/input', 'tests', 'tools', 'data'],
      nota: 'Toolchain verde. Nenhum codigo de jogo.',
    });
  });
});
