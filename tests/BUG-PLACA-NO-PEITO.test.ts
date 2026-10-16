// BUG-PLACA-NO-PEITO (relato do operador, 2026-10-16) — o serf parado com a pedra mostrava um quadrado escuro no
// peito: a placa do icone da carga, que e do quadrado provisorio. Com sprite, a carga fica nas maos em qualquer pose.
import { describe, expect, it } from 'vitest';
import { cargaVaiNasMaos } from '../src/render/carga-nas-maos';

describe('BUG-PLACA-NO-PEITO', () => {
  it.each([
    ['carregando', true, true],
    ['parado', true, true],
    ['andar', true, true],
    ['carregando', false, true],
    ['parado', false, false],
  ] as const)('pose %s, com sprite %s: nas maos %s', (pose, comSprite, nasMaos) => {
    expect(cargaVaiNasMaos(pose, comSprite)).toBe(nasMaos);
  });
});
