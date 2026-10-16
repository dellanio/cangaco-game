/**
 * I-TELA-OBRA-EM-ORDEM-DE-CONSTRUCAO (aceite 1) — na arte real da cabana do lenhador: a fundacao antes dos pilares, os
 * pilares antes das vigas, o pilar de baixo para cima, o transparente nunca, e a camada completa do chao para cima.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import { ordemDeConstrucao, partesDaEstrutura, PASSOS, TRANSPARENTE } from '../src/render/ordem-de-construcao';
import dados from '../data/obra-revelacao.json';

const madeira = decodePng(readFileSync('assets/sprites/woodcutters/woodcutters_madeira.png'));
const completo = decodePng(readFileSync('assets/sprites/woodcutters/woodcutters_completo-D.png'));

describe('a estrutura da cabana do lenhador', () => {
  const partes = partesDaEstrutura(madeira);
  const ordem = ordemDeConstrucao(madeira, 'madeira');
  const da = (p: number): number[] => [...partes.keys()].filter((i) => partes[i] === p).map((i) => ordem[i]!);
  it('acha as tres partes, cada uma com uma boa quantidade de pixels', () => {
    for (const p of [1, 2, 3]) expect(da(p).length, `parte ${p}`).toBeGreaterThan(500);
  });
  it('toda a fundacao antes de todo pilar, e todo pilar antes de toda viga', () => {
    expect(Math.max(...da(1))).toBeLessThan(Math.min(...da(2)));
    expect(Math.max(...da(2))).toBeLessThan(Math.min(...da(3)));
  });
  it('o pilar sobe do pe: em cada coluna de pilar, o pixel de baixo entra antes (ou junto) do de cima', () => {
    for (let x = 0; x < madeira.width; x++) {
      let anterior = -1;
      for (let y = madeira.height - 1; y >= 0; y--) {
        const i = y * madeira.width + x;
        if (partes[i] !== 2) { anterior = -1; continue; }
        if (anterior >= 0) expect(ordem[i]!).toBeGreaterThanOrEqual(anterior);
        anterior = ordem[i]!;
      }
    }
  });
  it('o transparente nunca entra, e todo pixel visivel entra num passo valido', () => {
    for (let i = 0; i < ordem.length; i++) {
      if (madeira.data[i * 4 + 3]! < 40) expect(ordem[i]).toBe(TRANSPARENTE);
      else expect(ordem[i]!).toBeLessThan(PASSOS);
    }
  });
});

describe('o acabamento da cabana do lenhador', () => {
  it('a linha de baixo antes da de cima', () => {
    const ordem = ordemDeConstrucao(completo, 'pedra');
    const daLinha = (y: number): number => Math.min(...[...Array(completo.width).keys()].map((x) => ordem[y * completo.width + x]!));
    let ultima = -1;
    for (let y = completo.height - 1; y >= 0; y--) {
      const m = daLinha(y);
      if (m === TRANSPARENTE) continue;
      expect(m).toBeGreaterThanOrEqual(ultima);
      ultima = m;
    }
  });
  it('so a cabana do lenhador entra na ordem de construcao, por ora', () => {
    expect(dados.ordemDeConstrucao).toEqual(['woodcutters']);
  });
});
