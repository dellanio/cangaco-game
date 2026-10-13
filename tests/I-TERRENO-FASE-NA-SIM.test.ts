/**
 * I-TERRENO-FASE-NA-SIM — a fase da campanha vira estado de partida (aceite no BUILD_PLAN.md, plano em
 * docs/planos/2026-10-12-campanha-jogavel.md).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as dadosDoJogo from '../src/sim/data';
import { gameData, usarDadosDaFase } from '../src/sim/data';
import { criarFase, dadosDaFase } from '../src/sim/fase';
import { tileAndavel } from '../src/sim/pathfinding';
import { ID_DO_ARMAZEM } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gravarEvidencia } from './helpers/evidence';
import type { Fase } from '../tools/fase-formato.mjs';

const PASTA = join('data', 'campanha');
const FASES: Fase[] = readdirSync(PASTA).filter((n) => n.endsWith('.json')).sort()
  .map((n) => JSON.parse(readFileSync(join(PASTA, n), 'utf8')) as Fase);
const TEMPO = JSON.parse(readFileSync(join('data', 'time.json'), 'utf8')) as { tickHz: number; escalas: Record<string, number> };

describe('I-TERRENO-FASE-NA-SIM', () => {
  it('aceite 1: cada predio e cada unidade das dez fases nascem no lado e no lugar do dado, e o armazem tem o estoque', () => {
    const resumo: Record<string, unknown> = {};
    for (const fase of FASES) {
      const dados = dadosDaFase(fase.id);
      const s = criarFase(fase.id, dados);
      const predios = s.predios.ordem.map((id) => s.predios.porId[id]).filter((p) => p !== undefined);
      const unidades = s.unidades.ordem.map((id) => s.unidades.porId[id]).filter((u) => u !== undefined);
      for (const lado of fase.lados) {
        for (const p of lado.predios) {
          expect(predios.some((q) => q.lado === lado.lado && q.tipo === p.id && q.gx === p.gx && q.gy === p.gy && q.estado === 'completo'), `${fase.id}: ${p.id} em (${p.gx},${p.gy})`).toBe(true);
        }
        for (const u of lado.unidades) {
          const perto = unidades.filter((v) => v.lado === lado.lado && v.tipo === u.tipo && Math.max(Math.abs(v.gx - u.gx), Math.abs(v.gy - u.gy)) <= 12);
          expect(perto.length, `${fase.id}: ${u.quantidade} ${u.tipo} em volta de (${u.gx},${u.gy})`).toBeGreaterThanOrEqual(u.quantidade);
          for (const v of perto) expect(tileAndavel(s, { gx: v.gx, gy: v.gy }, 'livre', dados)).toBe(true);
        }
        const armazem = predios.find((q): q is PredioCompleto => q.lado === lado.lado && q.tipo === ID_DO_ARMAZEM && q.estado === 'completo');
        if (armazem !== undefined) for (const [mercadoria, qtd] of Object.entries(lado.estoque)) expect(armazem.estoque.saida[mercadoria], `${fase.id}: ${mercadoria}`).toBe(qtd);
      }
      const total = fase.lados.reduce((n, l) => n + l.unidades.reduce((m, u) => m + u.quantidade, 0), 0);
      expect(unidades).toHaveLength(total);
      expect(s.fase).toEqual({ id: fase.id, numero: fase.fase, inicio: 0, ondasDisparadas: 0, tropasDasOndas: [], contagem: {} });
      resumo[fase.id] = { predios: predios.length, unidades: unidades.length };
    }
    gravarEvidencia('I-TERRENO-FASE-NA-SIM', { aceite1: resumo });
  });

  it('aceite 2: criar a fase duas vezes da o mesmo estado, e 600 ticks tambem', () => {
    const dados = dadosDaFase('fase-01-pianco');
    let a: GameState = criarFase('fase-01-pianco', dados);
    let b: GameState = criarFase('fase-01-pianco', dados);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    for (let t = 0; t < 600; t++) { a = step(a, [], dados); b = step(b, [], dados); }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.fase?.id).toBe('fase-01-pianco');
  });

  it('aceite 3: gameData.campanha traz as dez fases em ordem, com o tempo das ondas em ticks pela escala combate', () => {
    expect(gameData.campanha.fases.map((f) => f.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const f1 = FASES[0] as Fase;
    const escala = TEMPO.escalas[f1.escala] as number;
    const aMao = f1.ondas.map((o) => Math.round((o.aos_segundos / escala) * TEMPO.tickHz));
    expect(gameData.campanha.fases[0]?.ondas.map((o) => o.tick)).toEqual(aMao);
    for (const f of gameData.campanha.fases) {
      for (const o of f.ondas) expect(Number.isInteger(o.tick)).toBe(true);
      for (const o of [...f.objetivos.vitoria, ...f.objetivos.derrota]) if (o.ticks !== undefined) expect(Number.isInteger(o.ticks)).toBe(true);
    }
    // o prazo da fase 2 (2400 s), pela mesma conta
    const prazo = gameData.campanha.fases[1]?.objetivos.derrota.find((o) => o.tipo === 'prazo');
    expect(prazo?.ticks).toBe(Math.round((2400 / (TEMPO.escalas.combate as number)) * TEMPO.tickHz));
    gravarEvidencia('I-TERRENO-FASE-NA-SIM-ondas', { fase1: aMao });
  });

  it('aceite 4: usarDadosDaFase troca o gameData de quem o importou, uma vez por pagina', () => {
    const antes = dadosDoJogo.gameData.mapa.id;
    expect(antes).not.toBe('fase-01-pianco');
    const dados = dadosDaFase('fase-01-pianco');
    usarDadosDaFase('fase-01-pianco', dados);
    // a ligacao viva: o namespace e o nome importado leem o mapa da fase
    expect(dadosDoJogo.gameData.mapa.id).toBe('fase-01-pianco');
    expect(gameData.mapa.id).toBe('fase-01-pianco');
    expect(gameData).toBe(dados);
    // a mesma fase de novo nao muda nada; outra fase e erro
    usarDadosDaFase('fase-01-pianco', dadosDaFase('fase-01-pianco'));
    expect(gameData).toBe(dados);
    expect(() => { usarDadosDaFase('fase-02-patos', dadosDaFase('fase-02-patos')); }).toThrow(/ja joga 'fase-01-pianco'/);
    expect(gameData.mapa.id).toBe('fase-01-pianco');
  });
});
