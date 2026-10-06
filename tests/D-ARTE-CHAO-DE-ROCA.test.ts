import { describe, expect, it } from 'vitest';
import { CHAO_DA_CANA, CHAO_DO_MILHO, chaoDaRoca } from '../src/render/chao-da-roca';
import type { RecursoNoTile } from '../src/sim/state';

describe('chão da roça da cana', () => {
  it.each([
    ['cana plantada', { tipo: 'grapes', quantidade: 3 }, CHAO_DA_CANA],
    ['cana em pousio', { tipo: 'grapes', quantidade: 0 }, CHAO_DA_CANA],
    // I-TELA-CHAO-DA-ROCA-DO-MILHO (2026-10-06): o milho ganhou o chao arado
    ['milho plantado', { tipo: 'corn', quantidade: 3 }, CHAO_DO_MILHO],
    ['milho em pousio', { tipo: 'corn', quantidade: 0 }, CHAO_DO_MILHO],
    ['outro recurso', { tipo: 'tree', quantidade: 2 }, null],
    ['tile vazio', undefined, null],
  ] as const)('%s: %j', (_caso, recurso, esperado) => {
    expect(chaoDaRoca(recurso as RecursoNoTile | undefined)).toBe(esperado);
  });
});
