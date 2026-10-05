/**
 * I-ARTE-PREDIOS-MAIORES — Casa de Carne, Casa do Gibao e Curtume 20% maiores, Cocheira 30% (pedido
 * do operador, 2026-10-05). O campo `escalaDeExibicao` do manifesto multiplica a escala DEPOIS dos
 * tetos de altura e largura; o footprint e a sim nao mudam.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { EntradaDeAsset, Manifesto } from '../src/render/manifesto';
import { escalaDoSprite, regraDeLarguraDoManifesto, regraDoManifesto } from '../src/render/escala-predio';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInitialState } from '../src/sim/state';
import { salvar } from '../src/sim/save';
import { comPredioCompletoEm } from './helpers/jobs-cenario';
import { naVila } from './helpers/ancoras';

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;
const regraA = regraDoManifesto(manifesto);
const regraL = regraDeLarguraDoManifesto(manifesto);
const TILE = 64;
const predios = manifesto.assets.filter((e): e is EntradaDeAsset => e.tipo === 'predio') as EntradaDeAsset[];
const ESPERADO: Record<string, number> = { butchers: 1.2, armory_workshop: 1.2, tannery: 1.2, stables: 1.3 };

describe('I-ARTE-PREDIOS-MAIORES', () => {
  it('os quatro saem maiores pelo fator pedido, e os outros nao mudam', () => {
    for (const e of predios) {
      const lote = e.footprint[0] * TILE;
      const { escalaDeExibicao: _f, ...semOCampo } = e;
      void _f;
      const semFator = escalaDoSprite(semOCampo, regraA, TILE, lote, regraL);
      const comFator = escalaDoSprite(e, regraA, TILE, lote, regraL);
      expect(comFator / semFator, e.id).toBeCloseTo(ESPERADO[e.id] ?? 1, 9);
    }
    expect(predios.filter((e) => e.escalaDeExibicao !== undefined).map((e) => e.id).sort())
      .toEqual(Object.keys(ESPERADO).sort());
  });

  it('o campo, quando existe, e numero maior que zero', () => {
    for (const e of predios) if (e.escalaDeExibicao !== undefined) expect(e.escalaDeExibicao, e.id).toBeGreaterThan(0);
  });

  it('o save do roteiro: os quatro de pe, ao lado de um predio do mesmo lote que nao mudou', () => {
    // em fila a 6 tiles da vila: Casa de Carne, Casa do Gibao, Curtume, Cocheira e o Moinho (3x3 de
    // referencia, sem fator)
    let s = createInitialState(1);
    const lista: [string, string, number][] = [['butchers', 'cc', 0], ['armory_workshop', 'cg', 5], ['tannery', 'ct', 10], ['stables', 'co', 15], ['mill', 'mo', 21]];
    for (const [tipo, id, dx] of lista) s = comPredioCompletoEm(s, id, { tipo, ...naVila(dx - 6, 9) });
    mkdirSync('test-output', { recursive: true });
    writeFileSync('test-output/I-ARTE-PREDIOS-MAIORES.save.txt', salvar(s));
    expect(s.predios.ordem.filter((id) => ['cc', 'cg', 'ct', 'co', 'mo'].includes(id))).toHaveLength(5);
  });
});
