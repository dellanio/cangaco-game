/**
 * F-ESC — a altura do predio pela largura do lote (k = 1,0, decisao do operador,
 * 2026-09-27), com excecao por predio declarada no manifesto.
 *
 * O teste le o manifesto de verdade e o tile de `data/terrain.json` pelo loader; as
 * copias adulteradas provam que a regra ACUSA, nao so que nao acusa a toa.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { ehEntradaDePredio } from '../src/render/manifesto';
import type { EntradaDeAsset, Manifesto } from '../src/render/manifesto';
import {
  alturaMaxPorLargura, escalaDoSprite, regraDoManifesto, violacoesDaAltura,
} from '../src/render/escala-predio';
import { gravarEvidencia } from './helpers/evidence';

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;
const tilePx = gameData.terreno.tilePx;
const regra = regraDoManifesto(manifesto);
const predios = manifesto.assets.filter(ehEntradaDePredio);

/** O manifesto com UMA entrada de predio trocada. */
function comEntrada(id: string, troca: (e: EntradaDeAsset) => EntradaDeAsset): Manifesto {
  return {
    ...manifesto,
    assets: manifesto.assets.map((e) => (ehEntradaDePredio(e) && e.id === id ? troca(e) : e)),
  };
}

describe('F-ESC — altura maxima pela largura do lote', () => {
  it('o armazem cresce 20% nos dois eixos desde o ensaio de tres tiles', () => {
    const armazem = predios.find((e) => e.id === 'storehouse');
    expect(armazem).toBeDefined();
    if (!armazem) return;
    const alvo = Math.round(3 * tilePx * 1.2);
    expect(armazem.tamanho).toEqual([alvo, alvo]);
    expect(armazem.alturaMaxPorLargura).toBeGreaterThanOrEqual(1.2);
    expect(armazem.larguraMaxPorLote).toBeGreaterThanOrEqual(1.2);
  });

  it('o manifesto declara a regra, com k = 1,0', () => {
    expect(manifesto.regraDeAltura?.k).toBe(1);
  });

  it('nenhum predio passa de k sem excecao, e nenhuma excecao cabe em k', () => {
    expect(violacoesDaAltura(manifesto, regra, tilePx)).toEqual([]);
  });

  it('um predio alto demais, sem excecao, reprova', () => {
    const alvo = predios.find((e) => e.alturaMaxPorLargura === undefined);
    expect(alvo).toBeDefined();
    if (!alvo) return;
    const alto = comEntrada(alvo.id, (e) => ({
      ...e, tamanho: [e.tamanho[0], e.footprint[0] * tilePx * regra.k + 1] as const,
    }));
    expect(violacoesDaAltura(alto, regra, tilePx)).toEqual([{ id: alvo.id, motivo: 'alto-sem-excecao' }]);
  });

  it('uma excecao declarada num predio que ja cabe em k reprova (excecao morta)', () => {
    const baixo = predios.find((e) => e.tamanho[1] <= e.footprint[0] * tilePx * regra.k);
    expect(baixo).toBeDefined();
    if (!baixo) return;
    const morta = comEntrada(baixo.id, (e) => ({ ...e, alturaMaxPorLargura: 1.5 }));
    expect(violacoesDaAltura(morta, regra, tilePx)).toEqual([{ id: baixo.id, motivo: 'excecao-morta' }]);
  });

  it('tirar a excecao de quem a declara reprova: ela nao e enfeite', () => {
    const comExcecao = predios.filter((e) => e.alturaMaxPorLargura !== undefined);
    expect(comExcecao.length).toBeGreaterThan(0);
    for (const e of comExcecao) {
      const sem = comEntrada(e.id, ({ alturaMaxPorLargura: _, ...resto }) => resto);
      expect(violacoesDaAltura(sem, regra, tilePx), e.id).toEqual([{ id: e.id, motivo: 'alto-sem-excecao' }]);
    }
  });

  it('a escala pura: dentro da regra nao muda nada; alto demais encolhe ate o teto', () => {
    const medidas: Record<string, unknown>[] = [];
    for (const e of predios) {
      const lote = e.footprint[0] * tilePx;
      const escala = escalaDoSprite(e, regra, tilePx, lote);
      // a arte de hoje esta toda dentro da regra (com as excecoes): nenhum sprite muda
      expect(escala, e.id).toBe(1);
      medidas.push({
        id: e.id, footprint: e.footprint, tamanho: e.tamanho, teto: alturaMaxPorLargura(e, regra),
        alturaSobreLote: +(e.tamanho[1] / lote).toFixed(3), escala,
      });
    }
    // o caso que encolhe: o primeiro predio sem excecao com o dobro da altura do teto
    const alvo = predios.find((e) => e.alturaMaxPorLargura === undefined);
    if (!alvo) throw new Error('sem predio sem excecao');
    const lote = alvo.footprint[0] * tilePx;
    const alto: EntradaDeAsset = { ...alvo, tamanho: [alvo.tamanho[0], 2 * regra.k * lote] };
    const escala = escalaDoSprite(alto, regra, tilePx, lote);
    expect(escala).toBeCloseTo(0.5, 10);
    expect(alto.tamanho[1] * escala).toBeCloseTo(regra.k * lote, 10);
    // no zoom (lote maior em px de tela) a proporcao e a mesma
    expect(escalaDoSprite(alto, regra, tilePx, 2 * lote)).toBeCloseTo(1, 10);
    gravarEvidencia('F-ESC', { k: regra.k, tilePx, predios: medidas, casoQueEncolhe: { id: alvo.id, escala } });
  });
});
