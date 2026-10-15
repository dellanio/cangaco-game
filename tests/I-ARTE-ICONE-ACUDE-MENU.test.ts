/**
 * I-ARTE-ICONE-ACUDE-MENU — o ícone do Açude no menu de construir (aceite no BUILD_PLAN.md). O ícone é DERIVADO
 * da base por recorte quadrado, sem desenho novo (CLAUDE.md §9). Medido, e não afirmado por tabela: a cobertura do
 * quadrado sobe de 44,0% (o açude inteiro encaixado, achatado) para 67,5%.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifesto from '../assets/manifest.json';
import { decodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import { gravarEvidencia } from './helpers/evidence';

const ALFA_MINIMO = 16;
const PISO_DA_COBERTURA = 0.65;

function cobertura(arquivo: string): { largura: number; altura: number; cobertura: number } {
  const png = decodePng(readFileSync(`assets/${arquivo}`));
  let opacos = 0;
  for (let i = 3; i < png.data.length; i += 4) if ((png.data[i] ?? 0) > ALFA_MINIMO) opacos += 1;
  return { largura: png.width, altura: png.height, cobertura: opacos / (png.width * png.height) };
}

describe('I-ARTE-ICONE-ACUDE-MENU', () => {
  const icone = manifesto.icones.predios.reservoir;
  const anterior = 'sprites/reservoir/icone-atual.png';

  it('aceite 1: o manifesto aponta o PNG novo de 72x72, derivado da base, e o anterior fica no disco', () => {
    expect(icone.arquivo).toBe('sprites/reservoir/icone-recorte-20261015.png');
    expect([...icone.tamanho]).toEqual([72, 72]);
    expect(existsSync(`assets/${icone.arquivo}`)).toBe(true);
    expect(existsSync(`assets/${anterior}`)).toBe(true);
    expect(icone.origem.base).toBe('base/reservoir/cheio-master-2x.png');
    expect(existsSync(`assets/${icone.origem.base}`)).toBe(true);
    expect(icone.origem.nota).toContain('crop=330:330:150:110');
  });

  it('aceite 2: o novo cobre o quadrado bem mais que o anterior (piso de 65%) e difere dele', () => {
    const novo = cobertura(icone.arquivo);
    const velho = cobertura(anterior);
    gravarEvidencia('I-ARTE-ICONE-ACUDE-MENU', { novo, anterior: velho, piso: PISO_DA_COBERTURA });
    expect([novo.largura, novo.altura]).toEqual([72, 72]);
    expect(novo.cobertura).toBeGreaterThanOrEqual(PISO_DA_COBERTURA);
    expect(novo.cobertura).toBeGreaterThan(velho.cobertura);
    expect(readFileSync(`assets/${icone.arquivo}`).equals(readFileSync(`assets/${anterior}`))).toBe(false);
  });
});
