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
import {
  gridToScreen, gridToScreenCentro, screenToGrid, ESCALA_DO_MUNDO,
} from '../src/render/grid';
import { proximoNivel } from '../src/render/zoom';
import { createRng, nextInt, nextFloat } from '../src/sim/rng';
import { gravarEvidencia } from './helpers/evidence';

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

const NIVEIS = configDoMapa.zoom.niveis;
const TILE = configDoMapa.tilePx;
const MENOR = NIVEIS[0] as number;
const MAIOR = NIVEIS[NIVEIS.length - 1] as number;

describe('F18a — ACEITE: a ida e volta da F04 vale em TODO nivel de zoom', () => {
  it.each([...NIVEIS])('1000 coordenadas com RNG semeado, escala %s', (escala) => {
    let rng = createRng(Math.round(20260923 + escala * 1000));
    for (let i = 0; i < 1000; i++) {
      const px = nextInt(rng, -50, 200); rng = px.rng;
      const py = nextInt(rng, -50, 200); rng = py.rng;
      const tile = { gx: px.value, gy: py.value };
      expect(screenToGrid(gridToScreen(tile, TILE, escala), TILE, escala)).toEqual(tile);
    }
  });

  it.each([...NIVEIS])('jitter dentro do tile ainda volta ao mesmo tile, escala %s', (escala) => {
    let rng = createRng(Math.round(777 + escala * 1000));
    for (let i = 0; i < 500; i++) {
      const px = nextInt(rng, -50, 200); rng = px.rng;
      const py = nextInt(rng, -50, 200); rng = py.rng;
      const tile = { gx: px.value, gy: py.value };
      const canto = gridToScreen(tile, TILE, escala);
      const jx = nextFloat(rng); rng = jx.rng;
      const jy = nextFloat(rng); rng = jy.rng;
      const dentro = {
        x: canto.x + jx.value * TILE * escala,
        y: canto.y + jy.value * TILE * escala,
      };
      expect(screenToGrid(dentro, TILE, escala)).toEqual(tile);
    }
  });

  it('a escala neutra devolve exatamente o pixel de mundo', () => {
    expect(ESCALA_DO_MUNDO).toBe(1);
    expect(gridToScreen({ gx: 3, gy: 4 }, 64, ESCALA_DO_MUNDO)).toEqual({ x: 192, y: 256 });
    expect(gridToScreenCentro({ gx: 3, gy: 4 }, 64, ESCALA_DO_MUNDO)).toEqual({ x: 224, y: 288 });
  });

  it('escala dobrada dobra o pixel, e o centro acompanha', () => {
    expect(gridToScreen({ gx: 3, gy: 4 }, 64, 2)).toEqual({ x: 384, y: 512 });
    expect(gridToScreenCentro({ gx: 3, gy: 4 }, 64, 2)).toEqual({ x: 448, y: 576 });
  });

  it('escala <= 0 lanca, como tilePx <= 0 (F04): nao divide por zero em silencio', () => {
    expect(() => gridToScreen({ gx: 0, gy: 0 }, 64, 0)).toThrow();
    expect(() => screenToGrid({ x: 0, y: 0 }, 64, -1)).toThrow();
    expect(() => gridToScreenCentro({ gx: 0, gy: 0 }, 64, 0)).toThrow();
  });
});

describe('F18a — proximoNivel: passos discretos, com as pontas fechadas', () => {
  it('anda um passo para cada lado a partir do neutro', () => {
    const i = NIVEIS.indexOf(1);
    expect(proximoNivel(NIVEIS, 1, +1)).toBe(NIVEIS[i + 1]);
    expect(proximoNivel(NIVEIS, 1, -1)).toBe(NIVEIS[i - 1]);
  });

  it('nas pontas fica parado, nunca sai da lista', () => {
    expect(proximoNivel(NIVEIS, MENOR, -1)).toBe(MENOR);
    expect(proximoNivel(NIVEIS, MAIOR, +1)).toBe(MAIOR);
  });

  it('varrendo a lista inteira: todo resultado e um nivel da lista', () => {
    for (const nivel of NIVEIS) {
      for (const direcao of [-1, +1]) {
        expect(NIVEIS).toContain(proximoNivel(NIVEIS, nivel, direcao));
      }
    }
  });

  it('nivel fora da lista cai no mais proximo em vez de travar a roda', () => {
    expect(NIVEIS).toContain(proximoNivel(NIVEIS, 0.61, +1));
    expect(NIVEIS).toContain(proximoNivel(NIVEIS, 999, -1));
    expect(proximoNivel(NIVEIS, 999, -1)).toBe(NIVEIS[NIVEIS.length - 2]);
  });

  it('a lista vazia lanca em vez de devolver undefined', () => {
    expect(() => proximoNivel([], 1, +1)).toThrow();
  });

  it('grava a evidencia do aceite', () => {
    gravarEvidencia('F18a', {
      feature: 'F18a-zoom-da-camera',
      tilePx: TILE,
      niveis: [...NIVEIS],
      inicial: configDoMapa.zoom.inicial,
      porNivel: NIVEIS.map((escala) => ({
        escala,
        tilePxNaTela: TILE * escala,
        cantoDoTile_10_10: gridToScreen({ gx: 10, gy: 10 }, TILE, escala),
        idaEVoltaDoTile_10_10: screenToGrid(gridToScreen({ gx: 10, gy: 10 }, TILE, escala), TILE, escala),
        passoAcima: proximoNivel(NIVEIS, escala, +1),
        passoAbaixo: proximoNivel(NIVEIS, escala, -1),
      })),
    });
  });
});
