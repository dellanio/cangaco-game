/**
 * I-CLIMA-ESTACAO e I-CLIMA-CRESCIMENTO — a estacao do ano como funcao do tick, o evento da troca, e o
 * milho e a cana crescendo no ritmo da estacao da semeadura (plano em
 * docs/planos/2026-10-05-acude-e-clima.md).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { createInitialState } from '../src/sim/state';
import type { GameState, RecursoNoTile } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { estacaoNoTick, eventoDaEstacao, fracaoDoCiclo, multiplicadorNoTick, ticksDoCiclo, ticksParaAmadurecer } from '../src/sim/clima';
import { tileMaduro } from '../src/sim/recursos';
import { validarTudo } from '../tools/data-rules.js';
import { ARQUIVOS } from '../tools/data-schema.js';
import { gravarEvidencia } from './helpers/evidence';

const ciclo = gameData.clima.ciclo;
const inicioDe = (i: number): number => ciclo.slice(0, i).reduce((s, f) => s + f.ticks, 0);
const desligado: GameData = { ...gameData, clima: { ...gameData.clima, ligado: false } };

describe('I-CLIMA-ESTACAO', () => {
  it('o ciclo do dado: inverno, transicao, seca, transicao; 5, 1, 6 e 1 min de relogio com a escala de hoje', () => {
    expect(ciclo.map((f) => f.id)).toEqual(['inverno', 'transicaoSeca', 'seca', 'transicaoChuva']);
    const min = (ticks: number) => (ticks * gameData.tempo.tickMs) / 60000;
    expect(ciclo.map((f) => min(f.ticks))).toEqual([5, 1, 6, 1]);
  });

  it('(1) tick -> estacao nas bordas de cada fase e depois de um ciclo inteiro', () => {
    const total = ticksDoCiclo();
    for (let i = 0; i < ciclo.length; i++) {
      const a = inicioDe(i);
      expect(estacaoNoTick(a), `inicio de ${ciclo[i]!.id}`).toBe(ciclo[i]!.id);
      expect(estacaoNoTick(a + ciclo[i]!.ticks - 1), `fim de ${ciclo[i]!.id}`).toBe(ciclo[i]!.id);
      expect(estacaoNoTick(a + total * 3)).toBe(ciclo[i]!.id);
    }
    expect(estacaoNoTick(total)).toBe('inverno');
    expect(fracaoDoCiclo(0)).toBe(0);
    expect(fracaoDoCiclo(total / 2)).toBeCloseTo(0.5);
    expect(multiplicadorNoTick(inicioDe(2))).toBe(0.65);
  });

  it('(2) pelo step: season-changed sai exatamente nos ticks de troca, e so neles', () => {
    let s: GameState = createInitialState(1);
    const trocas: [number, string][] = [];
    const ate = ticksDoCiclo() + 5;
    for (let i = 0; i < ate; i++) {
      s = step(s, []);
      for (const e of s.events) if (e.type === 'season-changed') trocas.push([s.tick, e.estacao]);
    }
    const total = ticksDoCiclo();
    expect(trocas).toEqual([
      [inicioDe(1), 'transicaoSeca'], [inicioDe(2), 'seca'], [inicioDe(3), 'transicaoChuva'], [total, 'inverno'],
    ]);
    gravarEvidencia('I-CLIMA-ESTACAO', { ticksDoCiclo: total, trocas });
  });

  it('(3) desligado: nenhuma estacao e nenhum evento', () => {
    expect(estacaoNoTick(inicioDe(2), desligado)).toBeNull();
    for (let i = 0; i < ciclo.length; i++) expect(eventoDaEstacao(inicioDe(i), desligado)).toBeNull();
    expect(multiplicadorNoTick(inicioDe(2), desligado)).toBe(1);
  });

  it('(4) o validador recusa o ciclo vazio, a duracao <= 0 e o multiplicador <= 0', () => {
    const dados = Object.fromEntries(ARQUIVOS.map((n: string) => [n, JSON.parse(readFileSync(`data/${n}.json`, 'utf8'))]));
    const com = (clima: unknown) => validarTudo({ ...dados, clima }).filter((e: string) => e.startsWith('clima'));
    expect(com(dados['clima'])).toEqual([]);
    expect(com({ ...dados['clima'], ciclo: [] })).toEqual(['clima: ciclo precisa ser uma lista nao vazia']);
    const fase = dados['clima'].ciclo[0];
    expect(com({ ...dados['clima'], ciclo: [{ ...fase, duracao_segundos_base: 0 }] })).toContain("clima: fase 'inverno': duracao_segundos_base precisa ser > 0");
    expect(com({ ...dados['clima'], ciclo: [{ ...fase, multiplicadorDeCrescimento: 0 }] })).toContain("clima: fase 'inverno': multiplicadorDeCrescimento precisa ser > 0");
  });
});

describe('I-CLIMA-CRESCIMENTO', () => {
  const crescerMilho = gameData.recursos.tipos['corn']!.reposicao!.ticksDeCrescer;
  const semeado = (tipo: string, semeadoEm: number): RecursoNoTile => ({ tipo, quantidade: 4, semeadoEm });
  /** O primeiro tick em que o tile semeado em `t0` esta maduro. */
  function maduroEm(tipo: string, t0: number, dados: GameData = gameData): number {
    const base = createInitialState(1);
    for (let t = t0; ; t++) if (tileMaduro({ ...base, tick: t }, semeado(tipo, t0), dados)) return t - t0;
  }

  it('(1) o mesmo tile semeado no inverno e na seca: a razao dos tempos e 1,20 / 0,65', () => {
    const noInverno = maduroEm('corn', 10);
    const naSeca = maduroEm('corn', inicioDe(2) + 10);
    expect(noInverno).toBe(Math.round(crescerMilho / 1.2));
    expect(naSeca).toBe(Math.round(crescerMilho / 0.65));
    expect(naSeca / noInverno).toBeCloseTo(1.2 / 0.65, 2);
    expect(maduroEm('grapes', inicioDe(2) + 10)).toBe(Math.round(gameData.recursos.tipos['grapes']!.reposicao!.ticksDeCrescer / 0.65));
    gravarEvidencia('I-CLIMA-CRESCIMENTO', { crescerMilho, noInverno, naSeca, razao: naSeca / noInverno });
  });

  it('(2) a arvore amadurece igual com e sem clima; (3) desligado, o milho e o de hoje', () => {
    const crescerArvore = gameData.recursos.tipos['tree']!.reposicao!.ticksDeCrescer;
    expect(maduroEm('tree', inicioDe(2) + 10)).toBe(crescerArvore);
    expect(maduroEm('corn', inicioDe(2) + 10, desligado)).toBe(crescerMilho);
    expect(ticksParaAmadurecer('corn', crescerMilho, inicioDe(2), desligado)).toBe(crescerMilho);
  });
});
