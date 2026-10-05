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
  alturaMaxPorLargura, escalaDoSprite, regraDeLarguraDoManifesto, regraDoManifesto, violacoesDaAltura, violacoesDaLargura,
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

  it('tirar a excecao de quem a declara muda o desenho: ela nao e enfeite', () => {
    const comExcecao = predios.filter((e) => e.alturaMaxPorLargura !== undefined);
    expect(comExcecao.length).toBeGreaterThan(0);
    for (const e of comExcecao) {
      const lote = e.footprint[0] * tilePx;
      const { alturaMaxPorLargura: _, ...semExcecao } = e;
      // D-ARTE-PESCADOR-BAIXO: a prova e o desenho (o predicado do runtime), nos dois sentidos
      expect(escalaDoSprite(semExcecao, regra, tilePx, lote), e.id).not.toBe(escalaDoSprite(e, regra, tilePx, lote));
      const sem = comEntrada(e.id, ({ alturaMaxPorLargura: __, ...resto }) => resto);
      // a excecao acima de k segura arte alta: sem ela, o manifesto reprova
      if (e.tamanho[1] / lote > regra.k) {
        expect(violacoesDaAltura(sem, regra, tilePx), e.id).toEqual([{ id: e.id, motivo: 'alto-sem-excecao' }]);
      }
    }
  });

  it('D-ARTE-PESCADOR-BAIXO: a excecao morta pelo runtime, por tabela, nos dois eixos', () => {
    const base = predios.find((e) => e.id === 'bakery') as EntradaDeAsset; // 192 x 192 num lote de 192
    const lote = base.footprint[0] * tilePx;
    const casos: [string, number, number, boolean][] = [
      // [caso, razao do arquivo, teto declarado, morta?]
      ['acima de k num arquivo que cabe em k', 0.9, 1.5, true],
      ['abaixo da razao do arquivo (encolhe)', 0.9, 0.8, false],
      ['igual a k', 0.9, 1, true],
      ['acima de k num arquivo que passa de k', 1.3, 1.4, false],
      ['entre a razao e k (nao encolhe)', 0.9, 0.95, true],
    ];
    for (const [caso, razao, teto, morta] of casos) {
      const px = Math.round(razao * lote);
      const alto = comEntrada(base.id, (e) => ({ ...e, tamanho: [e.tamanho[0], px] as const, alturaMaxPorLargura: teto }));
      const largo = comEntrada(base.id, (e) => ({ ...e, tamanho: [px, e.tamanho[1]] as const, larguraMaxPorLote: teto }));
      const acusou = (v: readonly { motivo: string }[]) => v.some((x) => x.motivo === 'excecao-morta');
      expect(acusou(violacoesDaAltura(alto, regra, tilePx)), `altura: ${caso}`).toBe(morta);
      expect(acusou(violacoesDaLargura(largo, regraDeLarguraDoManifesto(manifesto), tilePx)), `largura: ${caso}`).toBe(morta);
    }
  });

  it('D-ARTE-PESCADOR-BAIXO: a Casa do Pescador desenha 0,8 do lote de altura, sem deformar', () => {
    const casa = predios.find((e) => e.id === 'fishermans') as EntradaDeAsset;
    const lote = casa.footprint[0] * tilePx;
    const escala = escalaDoSprite(casa, regra, tilePx, lote, regraDeLarguraDoManifesto(manifesto));
    expect(casa.tamanho[1] * escala).toBeCloseTo(0.8 * lote, 10);
    expect(escala).toBeLessThan(1);
    // uma escala so para os dois eixos: a largura cai na mesma proporcao
    expect((casa.tamanho[0] * escala) / (casa.tamanho[1] * escala)).toBeCloseTo(casa.tamanho[0] / casa.tamanho[1], 10);
  });

  it('a escala pura: dentro da regra nao muda nada; alto demais encolhe ate o teto', () => {
    const medidas: Record<string, unknown>[] = [];
    for (const e of predios) {
      const lote = e.footprint[0] * tilePx;
      const escala = escalaDoSprite(e, regra, tilePx, lote);
      // a arte de hoje esta toda dentro da regra (com as excecoes): nenhum sprite muda, menos a Bodega,
      // que desenha a 1,2 do lote com um arquivo de 1,5 (D-ARTE-BODEGA-MENOR, decisao do operador)
      if (e.id === 'inn') expect(escala, e.id).toBeCloseTo(1.2 / 1.5, 10);
      else if (e.id === 'fishermans') expect(escala, e.id).toBeCloseTo((0.8 * 192) / 176, 10);
      // I-ARTE-PREDIOS-MAIORES (2026-10-05): o fator de exibicao vem depois dos tetos; sem ele, 1
      else expect(escala, e.id).toBe(e.escalaDeExibicao ?? 1);
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
