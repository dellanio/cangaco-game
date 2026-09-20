import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { estoqueTotal, comidaTotal, populacaoPorGrupo, centroDaVila } from '../src/sim/selectors';
import { gameData } from '../src/sim/data';
import temaSertao from '../data/theme-sertao.json';
import { gravarEvidencia } from './helpers/evidence';

describe('F05b — selectors do HUD', () => {
  const estado = createInitialState(1);

  it('comidaTotal soma so o que grupos.comida lista', () => {
    const total = estoqueTotal(estado);
    const esperado = gameData.economia.grupos.comida
      .reduce((soma, id) => soma + (total[id] ?? 0), 0);
    expect(comidaTotal(estado)).toBe(esperado);
    expect(comidaTotal(estado)).toBeLessThan(
      Object.values(total).reduce((a, b) => a + b, 0),
    );
  });

  it('populacaoPorGrupo separa civil de militar e bate com o total de unidades', () => {
    const pop = populacaoPorGrupo(estado);
    expect(pop).toEqual({ civil: 6, militar: 0 });
    expect(pop.civil + pop.militar).toBe(estado.unidades.ordem.length);
  });

  it('centroDaVila usa o bounding box dos footprints, derivado do JSON', () => {
    const caixas = gameData.economia.estadoInicial.predios.map((p) => {
      const def = gameData.predios.find((b) => b.id === p.id);
      if (!def) throw new Error(`sem definicao de predio para '${p.id}'`);
      const [largura, altura] = def.tamanho;
      if (largura === undefined || altura === undefined) {
        throw new Error(`predio '${p.id}' sem tamanho definido`);
      }
      return { x0: p.gx, y0: p.gy, x1: p.gx + largura, y1: p.gy + altura };
    });
    const esperado = {
      gx: (Math.min(...caixas.map((c) => c.x0)) + Math.max(...caixas.map((c) => c.x1))) / 2,
      gy: (Math.min(...caixas.map((c) => c.y0)) + Math.max(...caixas.map((c) => c.y1))) / 2,
    };
    expect(centroDaVila(estado)).toEqual(esperado);
    expect(centroDaVila(estado)).toEqual({ gx: 33, gy: 31.5 });
  });

  it('sem predio, cai para o bounding box das unidades', () => {
    const soUnidades: GameState = { ...estado, predios: { porId: {}, ordem: [] } };
    const unidades = soUnidades.unidades.ordem.map((id) => soUnidades.unidades.porId[id]);
    const gxs = unidades.map((u) => u!.gx);
    const gys = unidades.map((u) => u!.gy);
    expect(centroDaVila(soUnidades)).toEqual({
      gx: (Math.min(...gxs) + Math.max(...gxs) + 1) / 2,
      gy: (Math.min(...gys) + Math.max(...gys) + 1) / 2,
    });
  });

  it('sem predio e sem unidade, cai para o centro do mapa', () => {
    const vazio: GameState = {
      ...estado,
      predios: { porId: {}, ordem: [] },
      unidades: { porId: {}, ordem: [] },
    };
    const { largura, altura } = gameData.terreno.mapaPadrao;
    expect(centroDaVila(vazio)).toEqual({ gx: largura / 2, gy: altura / 2 });
  });
});

// --- guardas estruturais (import/igualdade, nunca varredura de substring) ---

function listarArquivosTs(dir: string): string[] {
  const resultado: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) resultado.push(...listarArquivosTs(caminho));
    else if (entrada.name.endsWith('.ts')) resultado.push(caminho);
  }
  return resultado;
}

function arquivosComImport(dir: string, alvo: RegExp): string[] {
  return listarArquivosTs(dir).filter((f) => alvo.test(readFileSync(f, 'utf-8')));
}

describe('F05b — guardas estruturais', () => {
  it('src/ui/ nao importa phaser', () => {
    expect(arquivosComImport('src/ui', /from\s+['"]phaser['"]/)).toEqual([]);
  });

  it('src/ui/ nao importa ../sim/data — le so os selectors', () => {
    expect(arquivosComImport('src/ui', /from\s+['"].*sim\/data['"]/)).toEqual([]);
  });

  it('src/sim/selectors.ts nao importa render/ nem ui/', () => {
    const fonte = readFileSync('src/sim/selectors.ts', 'utf-8');
    expect(/from\s+['"].*\/(render|ui)\//.test(fonte)).toBe(false);
  });

  it('o tema de fato renomeia os ids neutros (senao a prova de tela nao provaria nada)', () => {
    expect(temaSertao.mercadorias.gold).not.toBe('gold');
    expect(temaSertao.mercadorias.timber).not.toBe('timber');
    expect(temaSertao.mercadorias.stone).not.toBe('stone');
  });
});

afterAll(() => {
  const estado = createInitialState(1);
  gravarEvidencia('F05b', {
    feature: 'F05b-hud',
    selectors: {
      comidaTotal: comidaTotal(estado),
      populacaoPorGrupo: populacaoPorGrupo(estado),
      centroDaVila: centroDaVila(estado),
    },
    fallback: {
      soUnidades: centroDaVila({ ...estado, predios: { porId: {}, ordem: [] } }),
      vazio: centroDaVila({
        ...estado, predios: { porId: {}, ordem: [] }, unidades: { porId: {}, ordem: [] },
      }),
    },
    grupoComida: gameData.economia.grupos.comida,
    restauracaoPorComida: Object.keys(gameData.condicao.restauracaoPorComida ?? {}),
    // Screenshot e verificacao visual separada, fora deste arquivo e fora do
    // npm run verify (CLAUDE.md §8) — ver tools/shots/F05b.js e
    // test-output/F05b-shot.json.
    verificacaoVisual: 'fora deste arquivo: npm run shot -- F05b',
  });
});
