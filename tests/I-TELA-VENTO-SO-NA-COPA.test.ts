/**
 * I-TELA-VENTO-SO-NA-COPA (aceite 1) — na arte real: a copa do juazeiro tem os pixels verdes e nao o tronco, o pivo fica
 * na base da copa; a arvore seca nao tem copa; e so as especies de copa balancam (os cactos sao rigidos).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import { copaDaArvore } from '../src/render/copa-da-arvore';
import vento from '../data/vento.json';

const ler = (a: string) => decodePng(readFileSync(`assets/sprites/vegetation/${a}`));

describe('I-TELA-VENTO-SO-NA-COPA', () => {
  const juazeiro = ler('tree-D-double.png');
  const copa = copaDaArvore(juazeiro);
  it('o juazeiro: a copa e boa parte da arvore, o pe do tronco fica fora, e o pivo na base da copa', () => {
    let opacos = 0;
    for (let i = 3; i < juazeiro.data.length; i += 4) if (juazeiro.data[i]! >= 40) opacos++;
    expect(copa.pixels / opacos).toBeGreaterThan(0.4);
    // as 30 linhas de baixo do sprite (o pe do tronco) sem copa
    let noPe = 0;
    for (let y = juazeiro.height - 30; y < juazeiro.height; y++) for (let x = 0; x < juazeiro.width; x++) noPe += copa.mascara[y * juazeiro.width + x]!;
    expect(noPe).toBe(0);
    let base = -1;
    for (let i = 0; i < copa.mascara.length; i++) if (copa.mascara[i]) base = Math.max(base, Math.floor(i / juazeiro.width));
    expect(copa.pivo.y).toBe(base);
  });
  it('a arvore seca nao tem folha, entao nao tem copa', () => {
    expect(copaDaArvore(ler('tree-seca-20261008.png')).pixels).toBe(0);
    expect(copaDaArvore(ler('arvore-seca-double-frame.png')).pixels).toBe(0);
  });
  it('so o juazeiro balanca a copa; os cactos e a macambira nao', () => {
    expect(vento.copaQueBalanca).toEqual(['presente']);
    for (const cacto of ['mandacaru', 'facheiro', 'xique-xique', 'macambira']) expect(vento.copaQueBalanca).not.toContain(cacto);
  });
});
