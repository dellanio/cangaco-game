/**
 * F18a — zoom da camera. Plano em `docs/planos/F18a-zoom-da-camera.md`.
 *
 * Zoom e CAMERA, nao regra: nada aqui toca `src/sim/`, nada entra em
 * `GameState`. O que este arquivo prova e a aritmetica — a ida e volta da F04
 * continua exata em TODO nivel de zoom, e a lista de niveis vem do dado, nunca
 * digitada no codigo.
 */
import { describe, it, expect } from 'vitest';
import { configDoMapa } from '../src/render/mapa';
import { gameData } from '../src/sim/data';

describe('F18a — os niveis de zoom vem de data/terrain.json', () => {
  it('configDoMapa.zoom espelha gameData.terreno.zoom', () => {
    expect([...configDoMapa.zoom.niveis]).toEqual([...gameData.terreno.zoom.niveis]);
    expect(configDoMapa.zoom.inicial).toBe(gameData.terreno.zoom.inicial);
  });

  it('o nivel inicial e 1: e o que mantem a geometria de todo roteiro ja validado', () => {
    expect(configDoMapa.zoom.inicial).toBe(1);
    expect(configDoMapa.zoom.niveis).toContain(1);
  });

  it('os niveis sao crescentes, positivos e sem repeticao', () => {
    const niveis = configDoMapa.zoom.niveis;
    expect(niveis.length).toBeGreaterThanOrEqual(3);
    // Um `>` contra o anterior cobre as tres de uma vez: positivo (o primeiro
    // contra 0), crescente e sem repeticao.
    let anterior = 0;
    for (const nivel of niveis) {
      expect(nivel, `nivel ${nivel} depois de ${anterior}`).toBeGreaterThan(anterior);
      anterior = nivel;
    }
  });

  it('tilePx * nivel e INTEIRO em todo nivel: e o que mantem a ida e volta exata', () => {
    for (const nivel of configDoMapa.zoom.niveis) {
      expect(Number.isInteger(configDoMapa.tilePx * nivel), `nivel ${nivel}`).toBe(true);
    }
  });
});
