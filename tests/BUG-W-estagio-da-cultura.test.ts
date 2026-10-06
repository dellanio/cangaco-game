/**
 * BUG-W (campo recem-plantado se desenha maduro), aceite 1: a funcao pura de render que da o
 * estagio do tile de CULTURA a partir de `semeadoEm` e `ticksDeCrescer`, irma de
 * `estadoDeCrescimento` (molde: `tests/F-REPL-e-arvore.test.ts`). O `pronto` comeca no mesmo
 * tick em que a sim diz `tileMaduro`, afirmado tick a tick, para o milho e para a uva.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import type { GameState, RecursoNoTile } from '../src/sim/state';
import { tileMaduro } from '../src/sim/recursos';
import { ticksParaAmadurecer } from '../src/sim/clima';
import { ALFA_DO_ESTAGIO, ESTAGIOS_DA_CULTURA, estagioDaCultura } from '../src/render/crescimento';
import { recursosDeRender } from '../src/render/mapa';
import { salvar } from '../src/sim/save';
import { avancar, cenarioDeFazenda } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const CULTURAS = ['corn', 'grapes'] as const;
const crescerDe = (tipo: string): number => recursosDeRender.ticksDeCrescer[tipo] ?? 0;

describe('BUG-W — estagioDaCultura', () => {
  it('o funil entrega o crescer de cada cultura em ticks, o mesmo do dado carregado', () => {
    for (const tipo of CULTURAS) {
      expect(crescerDe(tipo)).toBe(gameData.recursos.tipos[tipo]?.reposicao?.ticksDeCrescer);
      expect(crescerDe(tipo)).toBeGreaterThan(0);
    }
  });

  it('pronto exatamente onde a sim diz maduro, tick a tick', () => {
    const evidencia: Record<string, { crescer: number; divergencias: number; primeiroPronto: number | null }> = {};
    // I-CLIMA-CRESCIMENTO (2026-10-06): o tempo de crescer e o da estacao da semeadura, e o render passa a
    // mesma conta (`ticksParaAmadurecer`). Semeado no inverno (tick 100) e na seca.
    const naSeca = gameData.clima.ciclo.slice(0, 2).reduce((s, f) => s + f.ticks, 0) + 100;
    for (const [tipo, semeadoEm] of CULTURAS.flatMap((c) => [[c, 100], [c, naSeca]] as const)) {
      const crescer = ticksParaAmadurecer(tipo, crescerDe(tipo), semeadoEm);
      const tile: RecursoNoTile = { tipo, quantidade: 4, semeadoEm };
      let divergencias = 0;
      let primeiroPronto: number | null = null;
      for (let tick = semeadoEm; tick <= semeadoEm + crescer + 5; tick += 1) {
        const pronto = estagioDaCultura(tile, tick, crescer) === 'pronto';
        if (pronto && primeiroPronto === null) primeiroPronto = tick;
        if (pronto !== tileMaduro({ tick } as GameState, tile, gameData)) divergencias += 1;
      }
      evidencia[`${tipo}@${semeadoEm}`] = { crescer, divergencias, primeiroPronto };
      expect(divergencias).toBe(0);
      expect(primeiroPronto).toBe(semeadoEm + crescer);
    }
    gravarEvidencia('BUG-W', { estagios: [...ESTAGIOS_DA_CULTURA], alfa: ALFA_DO_ESTAGIO, culturas: evidencia });
  });

  it('o recem-semeado nao se desenha maduro: semeado no tick do plantio, e os estagios so avancam', () => {
    const crescer = crescerDe('corn');
    const tile: RecursoNoTile = { tipo: 'corn', quantidade: 4, semeadoEm: 0 };
    expect(estagioDaCultura(tile, 0, crescer)).toBe('semeado');
    expect(ALFA_DO_ESTAGIO.semeado).toBeLessThan(ALFA_DO_ESTAGIO.pronto);
    const vistos: string[] = [];
    let anterior = -1;
    for (let tick = 0; tick <= crescer; tick += 1) {
      const e = estagioDaCultura(tile, tick, crescer);
      const i = ESTAGIOS_DA_CULTURA.indexOf(e as (typeof ESTAGIOS_DA_CULTURA)[number]);
      expect(i).toBeGreaterThanOrEqual(anterior);
      if (i !== anterior) vistos.push(e as string);
      anterior = i;
    }
    expect(vistos).toEqual([...ESTAGIOS_DA_CULTURA]);
  });

  it('tile do mapa (sem relogio) e esgotado nao tem estagio: a celula fica cheia', () => {
    expect(estagioDaCultura({ tipo: 'corn', quantidade: 4 }, 5, crescerDe('corn'))).toBeNull();
    expect(estagioDaCultura({ tipo: 'corn', quantidade: 0, semeadoEm: 0 }, 5, crescerDe('corn'))).toBeNull();
    expect(estagioDaCultura(undefined, 5, crescerDe('corn'))).toBeNull();
  });
});

describe('BUG-W — a partida que o roteiro carrega', () => {
  it('o roçado no tick em que o primeiro milho amadurece: os quatro estagios ao mesmo tempo', () => {
    // O roceiro semeia um tile por vez, em rodizio (F-CAMPO-a): quando o primeiro fica
    // pronto, os semeados depois dele estao em estagios anteriores, e o ultimo acabou de
    // ser semeado. E o quadro do aceite 2: recem-semeado e maduro no mesmo roçado.
    const crescer = crescerDe('corn');
    let s: GameState = cenarioDeFazenda(gameData);
    const estagios = (e: GameState): Record<string, string> => {
      const r: Record<string, string> = {};
      for (const [k, rec] of Object.entries(e.recursos)) {
        if (rec?.tipo !== 'corn') continue;
        const est = estagioDaCultura(rec, e.tick, crescer);
        if (est !== null) r[k] = est;
      }
      return r;
    };
    for (let i = 0; i < 20_000 && !Object.values(estagios(s)).includes('pronto'); i += 1) s = avancar(s, 1, gameData);
    const vistos = estagios(s);
    expect(new Set(Object.values(vistos))).toEqual(new Set(ESTAGIOS_DA_CULTURA));
    const maduro = Object.keys(vistos).find((k) => vistos[k] === 'pronto') as string;
    expect(tileMaduro(s, s.recursos[maduro] as RecursoNoTile, gameData)).toBe(true);
    const semeado = Object.keys(vistos)
      .filter((k) => vistos[k] === 'semeado')
      .sort((a, b) => (s.recursos[b]?.semeadoEm ?? 0) - (s.recursos[a]?.semeadoEm ?? 0))[0] as string;
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/BUG-W.save.txt`, salvar(s));
    writeFileSync(`${dir}/BUG-W.partida.json`, JSON.stringify({ tick: s.tick, maduro, semeado, estagios: vistos }, null, 2));
  });
});
