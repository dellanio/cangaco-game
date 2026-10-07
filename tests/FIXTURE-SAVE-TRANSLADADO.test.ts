import { describe, expect, it } from 'vitest';
import { fixtureSaveTransladado } from './helpers/fixture-save-transladado';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transladarMapa } = require('../tools/transladar-mundo.js') as {
  transladarMapa: (mapa: unknown, k: number) => unknown;
};
const origem = { id: 'teste', hash: 'origem', largura: 8, altura: 8 };
const destino = { id: 'teste', hash: 'destino', largura: 10, altura: 10 };
const estado = {
  tick: 23, rng: { seed: 12, cursor: 15 },
  predios: { porId: { p1: { id: 'p1', gx: 2, gy: 3, estoque: { corn: 7 } } }, ordem: ['p1'] },
  unidades: { porId: { u1: { gx: 3, gy: 4, fsmData: { caminho: [{ gx: 4, gy: 4 }], alvo: '4,4' } } }, ordem: ['u1'] },
  recursos: { '4,4': { tipo: 'tree', quantidade: 5 } },
  estradas: { '2,4': true }, jobs: { t1: { origemTile: { gx: 4, gy: 4 }, destino: 'p1' } },
  descoberto: { '0': [0x80000001, 1], '1': [0, 0x80000000] },
};
const texto = JSON.stringify({ versao: 4, mapa: origem.id, hashDoMapa: origem.hash, estado });

describe('fixture-save-transladado', () => {
  it('desloca posições/caminhos/chaves sem alterar tick, RNG, ids, estoques ou argumento', () => {
    const antes = JSON.stringify(estado);
    const e = JSON.parse(fixtureSaveTransladado(texto, origem, destino, 2)) as { hashDoMapa: string; estado: typeof estado };
    expect(e.hashDoMapa).toBe(destino.hash);
    expect(e.estado.tick).toBe(estado.tick);
    expect(e.estado.rng).toEqual(estado.rng);
    expect(e.estado.predios.porId.p1).toEqual({ ...estado.predios.porId.p1, gx: 4, gy: 5 });
    expect(e.estado.predios.ordem).toEqual(['p1']);
    expect(e.estado.unidades.porId.u1).toEqual({ gx: 5, gy: 6, fsmData: { caminho: [{ gx: 6, gy: 6 }], alvo: '6,6' } });
    expect(e.estado.recursos).toEqual({ '6,6': estado.recursos['4,4'] });
    expect(e.estado.estradas).toEqual({ '4,6': true });
    expect(e.estado.jobs).toEqual({ t1: { origemTile: { gx: 6, gy: 6 }, destino: 'p1' } });
    expect(JSON.stringify(estado)).toBe(antes);
  });
  it('conserva exatamente os tiles descobertos de todos os lados, inclusive bit 31', () => {
    const e = JSON.parse(fixtureSaveTransladado(texto, origem, destino, 2)) as { estado: typeof estado };
    const tiles = (palavras: readonly number[], largura: number): string[] => {
      const r: string[] = [];
      for (let i = 0; i < palavras.length * 32; i++) {
        if (((palavras[i >>> 5] ?? 0) & (1 << (i & 31))) !== 0) r.push(`${i % largura},${Math.floor(i / largura)}`);
      }
      return r;
    };
    expect(tiles(e.estado.descoberto['0'], 10)).toEqual(['2,2', '9,5', '2,6']);
    expect(tiles(e.estado.descoberto['1'], 10)).toEqual(['9,9']);
  });
  it('recusa save de outro mapa/hash e destino que não corresponde ao deslocamento', () => {
    expect(() => fixtureSaveTransladado(texto, { ...origem, hash: 'outro' }, destino, 2)).toThrow('incompatível');
    expect(() => fixtureSaveTransladado(texto, { ...origem, id: 'outro' }, destino, 2)).toThrow('incompatível');
    expect(() => fixtureSaveTransladado(texto, origem, { ...destino, largura: 11 }, 2)).toThrow('incompatíveis');
  });
  it('translada o mapa sem regerar recursos ou alterar seu argumento', () => {
    const mapa = { largura: 2, altura: 2, legenda: { g: 'grama', m: 'montanha' }, linhas: ['gm', 'gg'], recursos: { tree: [[0, 1]] } };
    expect(transladarMapa(mapa, 1)).toEqual({ ...mapa, largura: 3, altura: 3, linhas: ['ggg', 'ggm', 'ggg'], recursos: { tree: [[1, 2]] } });
    expect(mapa.linhas).toEqual(['gm', 'gg']);
    expect(mapa.recursos).toEqual({ tree: [[0, 1]] });
  });
});
