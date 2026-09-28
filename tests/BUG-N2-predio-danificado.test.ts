/**
 * BUG-N2 (avaliador, 2026-09-28) — predio completo danificado era desenhado como obra e
 * perdia a arte: `WorldScene` calculava `estagioDaObra(hp, hpTotal)` tambem no completo.
 * `estagioDoPredio` e a regra da tela: completo e SEMPRE `completo`; obra segue o hp.
 */
import { describe, expect, it } from 'vitest';
import { estagioDaObra, estagioDoPredio } from '../src/render/estagio-obra';

describe('BUG-N2 — o predio completo danificado continua completo na tela', () => {
  it('completo com qualquer hp e `completo`', () => {
    for (const hp of [550, 548, 300, 1, 0]) expect(estagioDoPredio('completo', hp, 550, true), `hp ${hp}`).toBe('completo');
  });
  it('a obra continua seguindo o hp, igual a antes', () => {
    for (const hp of [0, 1, 100, 300, 548, 550]) {
      for (const nivelada of [true, false]) {
        expect(estagioDoPredio('obra', hp, 550, nivelada)).toBe(estagioDaObra(hp, 550, nivelada));
      }
    }
    // o caso da screenshot: 548/550 em obra e cobertura, completo e completo
    expect(estagioDoPredio('obra', 548, 550, true)).toBe('cobertura');
  });
});
