/**
 * F-REPL-e — os estados da arvore na tela (docs/planos/2026-09-28-8-F-REPL-e.md).
 *
 * A sim so sabe quando o tile foi plantado (`semeadoEm`); o render deriva muda,
 * crescendo_1 e crescendo_2 pela fracao do tempo de crescer. A fronteira da adulta
 * NAO e copia de numero: o teste afirma, tick a tick, que ela e a mesma do
 * `tileMaduro` da sim.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import type { GameState, RecursoNoTile } from '../src/sim/state';
import { tileMaduro } from '../src/sim/recursos';
import { salvar } from '../src/sim/save';
import { step } from '../src/sim/tick';
import {
  ESTADOS_DE_CRESCIMENTO, escalaDoPlaceholder, estadoDeCrescimento, especiesDaVegetacao,
} from '../src/render/crescimento';
import { recursosDeRender } from '../src/render/mapa';
import { mataCurta } from './helpers/mata-curta';
import { comEspacoNaSaida } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const crescer = recursosDeRender.ticksDeCrescer.tree ?? 0;

describe('F-REPL-e — estadoDeCrescimento', () => {
  it('o funil entrega o crescer da arvore em ticks, o mesmo do dado carregado', () => {
    expect(crescer).toBe(gameData.recursos.tipos.tree?.reposicao?.ticksDeCrescer);
    expect(crescer).toBeGreaterThan(0);
  });

  it('adulta (null) exatamente onde a sim diz maduro, tick a tick', () => {
    const semeadoEm = 100;
    const arvore: RecursoNoTile = { tipo: 'tree', quantidade: 4, semeadoEm };
    let divergencias = 0;
    for (let tick = semeadoEm; tick <= semeadoEm + crescer + 5; tick += 1) {
      const s = { tick } as GameState;
      const adultaNaTela = estadoDeCrescimento(arvore, tick, crescer) === null;
      if (adultaNaTela !== tileMaduro(s, arvore, gameData)) divergencias += 1;
    }
    expect(divergencias).toBe(0);
  });

  it('os tres estados aparecem em ordem, nenhum vazio, e so avancam', () => {
    const arvore: RecursoNoTile = { tipo: 'tree', quantidade: 4, semeadoEm: 0 };
    const vistos: string[] = [];
    let anterior = -1;
    for (let tick = 0; tick < crescer; tick += 1) {
      const e = estadoDeCrescimento(arvore, tick, crescer);
      expect(e).not.toBeNull();
      const i = ESTADOS_DE_CRESCIMENTO.indexOf(e as (typeof ESTADOS_DE_CRESCIMENTO)[number]);
      expect(i).toBeGreaterThanOrEqual(anterior);
      if (i !== anterior) vistos.push(e as string);
      anterior = i;
    }
    expect(vistos).toEqual([...ESTADOS_DE_CRESCIMENTO]);
  });

  it('toco, arvore do mapa (sem relogio) e crescer nulo nao crescem', () => {
    expect(estadoDeCrescimento({ tipo: 'tree', quantidade: 0 }, 5, crescer)).toBeNull();
    expect(estadoDeCrescimento({ tipo: 'tree', quantidade: 4 }, 5, crescer)).toBeNull();
    expect(estadoDeCrescimento({ tipo: 'rock', quantidade: 4, semeadoEm: 0 }, 5, 0)).toBeNull();
    expect(estadoDeCrescimento(undefined, 5, crescer)).toBeNull();
  });

  it('o placeholder cresce com o estado e fica abaixo da adulta', () => {
    const escalas = ESTADOS_DE_CRESCIMENTO.map(escalaDoPlaceholder);
    for (let i = 1; i < escalas.length; i += 1) expect(escalas[i]).toBeGreaterThan(escalas[i - 1] as number);
    expect(Math.max(...escalas)).toBeLessThan(1);
    // o brief: a muda cabe na metade de baixo do tile
    expect(escalaDoPlaceholder('muda')).toBeLessThanOrEqual(0.5);
  });

  it('estado de crescimento nunca entra no sorteio da especie', () => {
    const estados = ['presente', 'umbuzeiro', 'muda', 'crescendo_1', 'crescendo_2', 'mandacaru'];
    expect(especiesDaVegetacao(estados)).toEqual(['presente', 'umbuzeiro', 'mandacaru']);
  });
});

describe('F-REPL-e — a partida que o roteiro carrega', () => {
  it('um toco replantado pelo lenhador, gravado no tick do plantio', () => {
    const { s: s0, tiles } = mataCurta(gameData, 2);
    let s: GameState = s0;
    let plantado: string | null = null;
    for (let i = 0; i < 20_000 && plantado === null; i += 1) {
      s = comEspacoNaSaida(step(s, [], gameData), 'w1');
      plantado = tiles.find((k) => {
        const r = s.recursos[k];
        return r !== undefined && estadoDeCrescimento(r, s.tick, crescer) === 'muda';
      }) ?? null;
    }
    expect(plantado, 'o lenhador deveria replantar um toco').not.toBeNull();
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F-REPL-e.save.txt`, salvar(s));
    const r = s.recursos[plantado as string] as RecursoNoTile;
    gravarEvidencia('F-REPL-e', {
      tile: plantado, tick: s.tick, semeadoEm: r.semeadoEm, ticksDeCrescer: crescer,
      fronteiras: ESTADOS_DE_CRESCIMENTO.map((e, i) => ({
        estado: e, desde: (r.semeadoEm as number) + Math.ceil((i * crescer) / ESTADOS_DE_CRESCIMENTO.length),
      })),
      adultaEm: (r.semeadoEm as number) + crescer,
    });
  });
});
