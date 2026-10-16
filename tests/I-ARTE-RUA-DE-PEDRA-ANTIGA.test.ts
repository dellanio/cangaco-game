// I-ARTE-RUA-DE-PEDRA-ANTIGA (aceites 1 e 2) — a familia da rua sai do material do calcamento antigo, e a rua le como
// pedra: a saturacao media do road-m0 novo e menor que a da rua de barro de antes (guardada em assets/base).
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import { gravarEvidencia } from './helpers/evidence';

const ESTADOS = [...Array.from({ length: 16 }, (_, i) => `m${i}`), 'diagonal'];
const saturacaoMedia = (arquivo: string): number => {
  const img = decodePng(readFileSync(arquivo));
  let soma = 0;
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const [r = 0, g = 0, b = 0, a = 0] = img.data.subarray(i, i + 4);
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    soma += max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    n++;
  }
  return soma / n;
};

describe('I-ARTE-RUA-DE-PEDRA-ANTIGA', () => {
  it('as 17 pecas tem 64x64, e o material e o registro do Codex ficam na base', () => {
    for (const e of ESTADOS) {
      const img = decodePng(readFileSync(`assets/sprites/road/road-${e}.png`));
      expect([img.width, img.height], e).toEqual([64, 64]);
    }
    for (const f of ['material.png', 'base.png', 'geracao.json', 'layout.json']) {
      expect(existsSync(`assets/base/road-tiles/calcamento-antigo/${f}`), f).toBe(true);
    }
    const material = decodePng(readFileSync('assets/base/road-tiles/calcamento-antigo/material.png'));
    expect([material.width, material.height]).toEqual([128, 128]);
  });

  it('a rua le como pedra: menos saturada que a de barro', () => {
    const nova = saturacaoMedia('assets/sprites/road/road-m0.png');
    const barro = saturacaoMedia('assets/base/road-tiles/barro-2026-09-26/road-m0.png');
    gravarEvidencia('I-ARTE-RUA-DE-PEDRA-ANTIGA', { saturacaoNova: nova, saturacaoBarro: barro });
    expect(nova).toBeLessThan(barro);
  });
});
