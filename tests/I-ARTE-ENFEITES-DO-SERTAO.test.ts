import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import dados from '../assets/manifest.json';
import { errosDoEnfeite } from '../src/render/manifesto-enfeites';
import { TIPOS_DE_CAMADA } from '../src/render/manifesto';

const enfeites = dados.assets.filter(e => e.tipo === 'enfeite');
describe('I-ARTE-ENFEITES-DO-SERTAO', () => {
  it('registra nove bases (oito 1x1 de ate 64px, e a tapera 2x2 de ate 128px) com os oito campos', () => {
    expect(enfeites).toHaveLength(9); // I-TELA-ENFEITES-EM-SITIOS: a tapera, o centro do sitio
    expect(TIPOS_DE_CAMADA).toContain('enfeite');
    for (const e of enfeites) {
      expect(errosDoEnfeite(e), e.id).toEqual([]);
      expect(e.footprint).toEqual(e.id === 'tapera' ? [2, 2] : [1, 1]);
      expect(e.anchor).toEqual([0.5, 1]);
      expect(existsSync(`assets/${e.origem.base}`)).toBe(true);
      for (const rel of Object.values(e.estados)) {
        expect(rel).toMatch(new RegExp(`^sprites/props/${e.id}/`));
        const png = readFileSync(`assets/${rel}`);
        expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual(e.tamanho);
      }
    }
  });
  it('reprova enfeite sem anchor e anchor invalido; nao muda outras entradas', () => {
    const { anchor: _anchor, ...semAnchor } = enfeites[0]!;
    expect(errosDoEnfeite(semAnchor)).toContain('anchor');
    for (const anchor of [[0.5], [0.5, 2], [NaN, 1], null]) expect(errosDoEnfeite({ ...enfeites[0], anchor })).toContain('anchor');
    for (const e of dados.assets.filter(e => e.tipo !== 'enfeite')) expect(errosDoEnfeite(e)).toEqual([]);
  });
});
