/**
 * BUG-Z (nome de unidade coberto pelas unidades da frente) — aceite 1, em Node: a camada dos
 * nomes fica acima de toda unidade e de todo predio (que se ordenam por `depthDeY`, o y em px de
 * mundo) no maior mapa do dado, e abaixo da selecao. O aceite 2, o da tela, e o roteiro
 * `tools/shots/BUG-Z.js`.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import {
  depthDeY, ESCALA_DO_MUNDO, gridToScreen, PROFUNDIDADE_DA_SELECAO, PROFUNDIDADE_DOS_NOMES,
} from '../src/render/grid';
import { gravarEvidencia } from './helpers/evidence';

const TILE_PX = (JSON.parse(readFileSync('data/terrain.json', 'utf8')) as { tile_px: number }).tile_px;

describe('BUG-Z aceite 1 — a camada dos nomes', () => {
  it('fica acima da borda de baixo do maior mapa e abaixo da selecao', () => {
    const mapas = readdirSync('data/maps').filter((f) => f.endsWith('.json'))
      .map((f) => ({ f, ...(JSON.parse(readFileSync(`data/maps/${f}`, 'utf8')) as { largura: number; altura: number }) }));
    expect(mapas.length).toBeGreaterThan(0);
    const maiorAltura = Math.max(...mapas.map((m) => m.altura));
    const fundo = depthDeY(gridToScreen({ gx: 0, gy: maiorAltura }, TILE_PX, ESCALA_DO_MUNDO).y);
    gravarEvidencia('BUG-Z', { mapas: mapas.map((m) => ({ f: m.f, altura: m.altura })), fundo, nomes: PROFUNDIDADE_DOS_NOMES, selecao: PROFUNDIDADE_DA_SELECAO });
    expect(PROFUNDIDADE_DOS_NOMES).toBeGreaterThan(fundo);
    expect(PROFUNDIDADE_DOS_NOMES).toBeLessThan(PROFUNDIDADE_DA_SELECAO);
  });
});
