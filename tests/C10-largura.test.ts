/**
 * C10 — a excecao de largura por predio no dado, como a de altura (fila do operador, item
 * 10; plano em docs/planos/2026-09-28-C10-excecao-de-largura.md). Aceite:
 *  (a) o manifesto real nao tem violacao de largura;
 *  (b) sintetico: largo sem excecao -> `largo-sem-excecao`; excecao que cabe -> `excecao-morta`;
 *  (c) `escalaDoSprite` encolhe o largo demais para `k x lote`, sem deformar; o armazem e
 *      a escola continuam na escala de antes.
 */
import { describe, expect, it } from 'vitest';
import manifestoJson from '../assets/manifest.json';
import terreno from '../data/terrain.json';
import type { EntradaDeAsset, Manifesto } from '../src/render/manifesto';
import {
  escalaDoSprite, larguraMaxPorLote, regraDeLarguraDoManifesto, regraDoManifesto, SEM_REGRA_DE_LARGURA, violacoesDaLargura,
} from '../src/render/escala-predio';
import { gravarEvidencia } from './helpers/evidence';

const manifesto = manifestoJson as unknown as Manifesto;
const TILE = terreno.tile_px;
const regraL = regraDeLarguraDoManifesto(manifesto);
const regraA = regraDoManifesto(manifesto);
const predios = manifesto.assets.filter((e) => e.tipo === 'predio') as EntradaDeAsset[];
const comEntrada = (id: string, f: (e: EntradaDeAsset) => EntradaDeAsset): Manifesto =>
  ({ ...manifesto, assets: manifesto.assets.map((e) => (e.tipo === 'predio' && e.id === id ? f(e as EntradaDeAsset) : e)) });

describe('C10 — a largura do predio tem regra, como a altura', () => {
  it('(a) o manifesto real: k = 1 e nenhuma violacao', () => {
    expect(regraL.k).toBe(1);
    expect(violacoesDaLargura(manifesto, regraL, TILE)).toEqual([]);
    const comExcecao = predios.filter((e) => e.larguraMaxPorLote !== undefined).map((e) => ({
      id: e.id, larguraPorLote: e.tamanho[0] / (e.footprint[0] * TILE), teto: larguraMaxPorLote(e, regraL),
    }));
    expect(comExcecao.map((c) => c.id).sort()).toEqual(['schoolhouse', 'storehouse']);
    gravarEvidencia('C10-largura', { k: regraL.k, comExcecao });
  });

  it('(b) sintetico: largo sem excecao e excecao morta sao acusados', () => {
    const semExcecao = comEntrada('storehouse', ({ larguraMaxPorLote: _, ...resto }) => resto);
    expect(violacoesDaLargura(semExcecao, regraL, TILE)).toEqual([{ id: 'storehouse', motivo: 'largo-sem-excecao' }]);
    const estreito = predios.find((e) => e.larguraMaxPorLote === undefined && e.tamanho[0] <= e.footprint[0] * TILE);
    if (estreito === undefined) throw new Error('fixture: sem predio estreito');
    const morta = comEntrada(estreito.id, (e) => ({ ...e, larguraMaxPorLote: 1.5 }));
    expect(violacoesDaLargura(morta, regraL, TILE)).toEqual([{ id: estreito.id, motivo: 'excecao-morta' }]);
  });

  it('(c) o largo demais encolhe para k x lote, sem deformar; os dois de hoje nao mudam', () => {
    const armazem = predios.find((e) => e.id === 'storehouse') as EntradaDeAsset;
    const lote = armazem.footprint[0] * TILE;
    // sem a excecao, a largura desenhada vira exatamente o lote (k = 1)
    const { larguraMaxPorLote: _, ...semExcecao } = armazem;
    const escala = escalaDoSprite(semExcecao, regraA, TILE, lote, regraL);
    expect(semExcecao.tamanho[0] * escala).toBeCloseTo(lote, 6);
    // com a excecao declarada (1,12), a escala e a de antes da C10 (a regra de largura nao age)
    expect(escalaDoSprite(armazem, regraA, TILE, lote, regraL)).toBe(escalaDoSprite(armazem, regraA, TILE, lote, SEM_REGRA_DE_LARGURA));
    const escola = predios.find((e) => e.id === 'schoolhouse') as EntradaDeAsset;
    expect(escalaDoSprite(escola, regraA, TILE, lote, regraL)).toBe(escalaDoSprite(escola, regraA, TILE, lote, SEM_REGRA_DE_LARGURA));
  });
});
