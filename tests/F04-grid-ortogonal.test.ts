import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  gridToScreen, gridToScreenCentro, screenToGrid, depthDeY, tileDentroDoMapa,
} from '../src/render/grid';
import { configDoMapa } from '../src/render/mapa';
import { gameData } from '../src/sim/data';
import { createRng, nextInt, nextFloat } from '../src/sim/rng';
import { gravarEvidencia } from './helpers/evidence';

const TAMANHOS_DE_TILE = [16, 32, 48, 64] as const;

describe('F04 — grid ortogonal: ida e volta', () => {
  it('screenToGrid(gridToScreen(t)) === t para 1000 tiles, RNG semeado', () => {
    let rng = createRng(20260919);
    for (let i = 0; i < 1000; i++) {
      const passoGx = nextInt(rng, -50, 200); rng = passoGx.rng;
      const passoGy = nextInt(rng, -50, 200); rng = passoGy.rng;
      const tile = { gx: passoGx.value, gy: passoGy.value };
      const volta = screenToGrid(gridToScreen(tile, 64), 64);
      expect(volta).toEqual(tile);
    }
  });

  it('ida e volta com jitter dentro do tile ainda cai no mesmo tile (prova floor, nao round)', () => {
    let rng = createRng(777);
    for (let i = 0; i < 1000; i++) {
      const passoGx = nextInt(rng, -50, 200); rng = passoGx.rng;
      const passoGy = nextInt(rng, -50, 200); rng = passoGy.rng;
      const tile = { gx: passoGx.value, gy: passoGy.value };
      const canto = gridToScreen(tile, 64);

      const jx = nextFloat(rng); rng = jx.rng;
      const jy = nextFloat(rng); rng = jy.rng;
      const pontoDentro = { x: canto.x + jx.value * 64, y: canto.y + jy.value * 64 };

      expect(screenToGrid(pontoDentro, 64)).toEqual(tile);
    }
  });

  it('coordenada negativa volta certo (floor, nao truncamento)', () => {
    expect(screenToGrid({ x: -1, y: -1 }, 64)).toEqual({ gx: -1, gy: -1 });
    expect(screenToGrid({ x: -64, y: -64 }, 64)).toEqual({ gx: -1, gy: -1 });
    expect(screenToGrid({ x: -65, y: 0 }, 64)).toEqual({ gx: -2, gy: 0 });
  });

  it.each(TAMANHOS_DE_TILE)('a ida e volta vale para tilePx = %i, nao so 64', (tilePx) => {
    let rng = createRng(tilePx * 1000 + 1);
    for (let i = 0; i < 200; i++) {
      const passoGx = nextInt(rng, 0, 100); rng = passoGx.rng;
      const passoGy = nextInt(rng, 0, 100); rng = passoGy.rng;
      const tile = { gx: passoGx.value, gy: passoGy.value };
      expect(screenToGrid(gridToScreen(tile, tilePx), tilePx)).toEqual(tile);
    }
  });

  it('gridToScreenCentro fica no meio do tile', () => {
    expect(gridToScreenCentro({ gx: 2, gy: 3 }, 64)).toEqual({ x: 160, y: 224 });
  });

  it('tilePx <= 0 lanca erro em vez de dividir por zero em silencio', () => {
    expect(() => gridToScreen({ gx: 0, gy: 0 }, 0)).toThrow();
    expect(() => screenToGrid({ x: 0, y: 0 }, -1)).toThrow();
  });
});

describe('F04 — depth sorting e limites do mapa', () => {
  it('depthDeY e estritamente monotonica em y', () => {
    expect(depthDeY(10)).toBeLessThan(depthDeY(20));
    expect(depthDeY(-5)).toBeLessThan(depthDeY(0));
  });

  it('tileDentroDoMapa reconhece bordas e fora do mapa', () => {
    expect(tileDentroDoMapa({ gx: 0, gy: 0 }, 64, 64)).toBe(true);
    expect(tileDentroDoMapa({ gx: 63, gy: 63 }, 64, 64)).toBe(true);
    expect(tileDentroDoMapa({ gx: 64, gy: 0 }, 64, 64)).toBe(false);
    expect(tileDentroDoMapa({ gx: -1, gy: 0 }, 64, 64)).toBe(false);
  });
});

describe('F04 — tile vem de data/terrain.json, nao hardcoded', () => {
  it('configDoMapa.tilePx bate com gameData.terreno.tilePx', () => {
    expect(configDoMapa.tilePx).toBe(gameData.terreno.tilePx);
    expect(gameData.terreno.tilePx).toBe(64); // rastreado ate data/terrain.json: tile_px
  });

  it('configDoMapa.largura/altura batem com gameData.terreno.mapaPadrao', () => {
    expect(configDoMapa.largura).toBe(gameData.terreno.mapaPadrao.largura);
    expect(configDoMapa.altura).toBe(gameData.terreno.mapaPadrao.altura);
    expect(gameData.terreno.mapaPadrao).toEqual({ largura: 64, altura: 64 });
  });

  it('larguraPx/alturaPx sao o produto direto, sem arredondamento escondido', () => {
    expect(configDoMapa.larguraPx).toBe(configDoMapa.largura * configDoMapa.tilePx);
    expect(configDoMapa.alturaPx).toBe(configDoMapa.altura * configDoMapa.tilePx);
  });
});

// --- guardas estruturais (nao varredura textual de numero — ver PROGRESS.md) ---

function listarArquivosTs(dir: string): string[] {
  const resultado: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      resultado.push(...listarArquivosTs(caminho));
    } else if (entrada.name.endsWith('.ts')) {
      resultado.push(caminho);
    }
  }
  return resultado;
}

function gridTsTemImport(): boolean {
  const fonte = readFileSync('src/render/grid.ts', 'utf-8');
  return /^\s*import\b/m.test(fonte);
}

function arquivosQueLeemSimDataForaDeMapa(): string[] {
  const arquivos = listarArquivosTs('src/render').filter((f) => !f.endsWith(join('src', 'render', 'mapa.ts')));
  return arquivos.filter((f) => /from\s+['"].*sim\/data['"]/.test(readFileSync(f, 'utf-8')));
}

describe('F04 — guardas estruturais', () => {
  it('src/render/grid.ts nao importa nada: e aritmetica pura', () => {
    expect(gridTsTemImport()).toBe(false);
  });

  it('nenhum arquivo de src/render/ alem de mapa.ts importa ../sim/data', () => {
    expect(arquivosQueLeemSimDataForaDeMapa()).toEqual([]);
  });
});

afterAll(() => {
  gravarEvidencia('F04', {
    feature: 'F04-grid-ortogonal',
    idaEVolta: { amostras: 1000, semente: 20260919, tamanhosDeTileTestados: TAMANHOS_DE_TILE },
    configDoMapa,
    fonteDoTile: { arquivo: 'data/terrain.json', chave: 'tile_px', valor: gameData.terreno.tilePx },
    guardas: {
      gridTsSemImport: !gridTsTemImport(),
      soMapaTsLeSimData: arquivosQueLeemSimDataForaDeMapa().length === 0,
    },
  });
});
