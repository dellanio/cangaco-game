import { describe, expect, it } from 'vitest';
import { iconeNaPilha } from '../src/render/icone-da-mercadoria';
import carga from '../data/carga-nas-maos.json';
import { LADO_DA_UNIDADE_EM_TILES } from '../src/render/grid';
import terreno from '../data/terrain.json';

describe('G-TELA-ESTOQUE-SEM-PLACA — o icone do estoque sem placa escura, 20% maior', () => {
  it('a escala do dado e 1,2', () => {
    expect(carga.escalaDoIconeNaPilha).toBe(1.2);
  });
  it.each([[16], [24], [32]])('lado da unidade %i: sem placa, e o lado e 1,2 vez o de antes (lado - 3)', (lado) => {
    const d = iconeNaPilha(lado, carga.escalaDoIconeNaPilha);
    expect(d.placa).toBe(false);
    expect(d.lado).toBeCloseTo((lado - 3) * 1.2, 6);
  });
  it('no lado real do jogo, o icone fica maior que o de antes', () => {
    const lado = terreno.tile_px * LADO_DA_UNIDADE_EM_TILES;
    expect(iconeNaPilha(lado, carga.escalaDoIconeNaPilha).lado).toBeGreaterThan(lado - 3);
  });
});
