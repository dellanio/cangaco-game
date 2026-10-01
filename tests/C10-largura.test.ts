/**
 * C10 — a excecao de largura por predio no dado, como a de altura (fila do operador, item
 * 10; plano em docs/planos/2026-09-28-C10-excecao-de-largura.md). Aceite:
 *  (a) o manifesto real nao tem violacao de largura;
 *  (b) sintetico: largo sem excecao -> `largo-sem-excecao`; excecao que cabe -> `excecao-morta`;
 *  (c) `escalaDoSprite` encolhe um caso sintetico largo demais para `k x lote`, sem deformar;
 *      o armazem D agora cabe no lote e a escola preserva sua excecao.
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
    expect(comExcecao.map((c) => c.id).sort()).toEqual(['farm', 'inn', 'mill', 'schoolhouse', 'storehouse', 'wineyard']);
    const moinho = comExcecao.find((c) => c.id === 'mill');
    expect(moinho?.larguraPorLote).toBeCloseTo(221 / 192, 6);
    expect(moinho?.teto).toBe(1.16);
    // D-ARTE-BODEGA-MENOR (decisao do operador): o arquivo de 384 px desenha a 1,2 do lote, e nao a 1,5
    const bodega = predios.find((e) => e.id === 'inn') as EntradaDeAsset;
    const loteDaBodega = bodega.footprint[0] * TILE;
    expect(bodega.tamanho[0] / loteDaBodega).toBeCloseTo(384 / 256, 6);
    expect(larguraMaxPorLote(bodega, regraL)).toBe(1.2);
    expect(bodega.tamanho[0] * escalaDoSprite(bodega, regraA, TILE, loteDaBodega, regraL)).toBeCloseTo(1.2 * loteDaBodega, 6);
    expect(comExcecao.find((c) => c.id === 'wineyard')?.teto).toBe(1.303);
    gravarEvidencia('C10-largura', { k: regraL.k, comExcecao });
  });

  it('(b) sintetico: largo sem excecao e excecao morta sao acusados', () => {
    const largo = comEntrada('woodcutters', (e) => ({ ...e, tamanho: [214, e.tamanho[1]] as const }));
    expect(violacoesDaLargura(largo, regraL, TILE)).toEqual([{ id: 'woodcutters', motivo: 'largo-sem-excecao' }]);
    const estreito = predios.find((e) => e.larguraMaxPorLote === undefined && e.tamanho[0] <= e.footprint[0] * TILE);
    if (estreito === undefined) throw new Error('fixture: sem predio estreito');
    const morta = comEntrada(estreito.id, (e) => ({ ...e, larguraMaxPorLote: 1.5 }));
    expect(violacoesDaLargura(morta, regraL, TILE)).toEqual([{ id: estreito.id, motivo: 'excecao-morta' }]);
  });

  it('(c) o largo demais encolhe para k x lote; excecoes preservam escala', () => {
    const cabana = predios.find((e) => e.id === 'woodcutters') as EntradaDeAsset;
    const lote = cabana.footprint[0] * TILE;
    const largo: EntradaDeAsset = { ...cabana, tamanho: [214, cabana.tamanho[1]] };
    const escala = escalaDoSprite(largo, regraA, TILE, lote, regraL);
    expect(largo.tamanho[0] * escala).toBeCloseTo(lote, 6);
    expect(cabana.tamanho[0]).toBe(lote);
    expect(escalaDoSprite(cabana, regraA, TILE, lote, regraL)).toBe(
      escalaDoSprite(cabana, regraA, TILE, lote, SEM_REGRA_DE_LARGURA));
    for (const id of ['storehouse', 'schoolhouse']) {
      const entrada = predios.find((e) => e.id === id) as EntradaDeAsset;
      expect(escalaDoSprite(entrada, regraA, TILE, lote, regraL)).toBe(
        escalaDoSprite(entrada, regraA, TILE, lote, SEM_REGRA_DE_LARGURA));
    }
  });
});
