/**
 * I-TERRENO-FASE-8-MAPA-MAIOR — Santa Rita num mapa de 192x192 (aceite no BUILD_PLAN.md). Os aceites 1 a 3
 * moram aqui; o 4 (ida e volta pelo Tiled) e o teste das dez fases (`I-TERRENO-DEZ-MAPAS-DA-CAMPANHA`), que
 * cobre a fase 8 como as outras; o 5 e o roteiro de tela, e o 6 e o `tools/jogar-campanha.js`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { loadGameData } from '../src/sim/data/loader';
import { rawGameData } from '../src/sim/data/raw';
import type { RawGameData } from '../src/sim/data/raw';
import { criarFase, dadosDaFase } from '../src/sim/fase';
import { tileAndavel } from '../src/sim/pathfinding';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import type { Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { validarCampanha } from '../tools/data-rules.js';
import { gravarEvidencia } from './helpers/evidence';
import type { Fase } from '../tools/fase-formato.mjs';

const FASE_8 = 'fase-08-santa-rita';
const PADRAO = gameData.terreno.mapaPadrao;
const evidencia: Record<string, unknown> = {};

describe('I-TERRENO-FASE-8-MAPA-MAIOR', () => {
  it('aceite 1: o tamanho do mapa da fase vira o mapaPadrao da partida; as fases de 128 nao mudam', () => {
    const fase8 = rawGameData.fases.find((f) => f.id === FASE_8);
    expect(fase8).toBeDefined();
    const d8 = dadosDaFase(FASE_8);
    // o mundo da fase 8 e maior que o padrao (no mundo transladado, os dois crescem de K)
    expect(d8.terreno.mapaPadrao).toEqual({ largura: fase8?.mapa.largura, altura: fase8?.mapa.altura });
    expect(d8.terreno.mapaPadrao.largura - PADRAO.largura).toBe(64);
    expect(d8.mapa.largura).toBe(d8.terreno.mapaPadrao.largura);
    for (const f of rawGameData.fases.filter((g) => g.id !== FASE_8)) {
      expect(dadosDaFase(f.id).terreno.mapaPadrao, f.id).toEqual(PADRAO);
    }
    // a guarda do "mundo com dois tamanhos" continua no loader
    const torto = { ...rawGameData, mapa: { ...rawGameData.mapa, largura: fase8?.mapa.largura, altura: fase8?.mapa.altura, linhas: fase8?.mapa.linhas, recursos: fase8?.mapa.recursos } };
    expect(() => loadGameData(torto as unknown as RawGameData)).toThrow(/o mundo teria dois tamanhos/);
    evidencia['aceite1'] = { fase8: d8.terreno.mapaPadrao, padrao: PADRAO };
  });

  it('aceite 1b: o validador aceita fase quadrada do padrao ao dobro dele, e recusa fora disso', () => {
    const dados = { terrain: JSON.parse(readFileSync(join('data', 'terrain.json'), 'utf8')) as Record<string, unknown> };
    const base = JSON.parse(readFileSync(join('data', 'campanha', `${FASE_8}.json`), 'utf8')) as Fase;
    expect(validarCampanha(dados, { [base.id]: base }).filter((e) => /mapa precisa/.test(e))).toEqual([]);
    const comLargura = (n: number): Fase => ({ ...base, mapa: { ...base.mapa, largura: n } });
    for (const n of [PADRAO.largura - 1, 2 * PADRAO.largura + 1]) {
      expect(validarCampanha(dados, { [base.id]: comLargura(n) }).join('\n'), String(n)).toMatch(/mapa precisa ser quadrado/);
    }
  });

  it('aceite 3: tudo o que criarFase poe fica dentro do mapa, e um militar chega a um tile fora do mundo padrao', () => {
    const dados = dadosDaFase(FASE_8);
    const { largura, altura } = dados.terreno.mapaPadrao;
    let s = criarFase(FASE_8, dados);
    const dentro = (gx: number, gy: number): boolean => gx >= 0 && gy >= 0 && gx < largura && gy < altura;
    for (const id of s.unidades.ordem) {
      const u = s.unidades.porId[id] as Unidade;
      expect(dentro(u.gx, u.gy), `${id} em (${u.gx},${u.gy})`).toBe(true);
    }
    for (const id of s.predios.ordem) {
      const p = s.predios.porId[id];
      if (p !== undefined) expect(dentro(p.gx, p.gy), `${id} em (${p.gx},${p.gy})`).toBe(true);
    }
    // o batedor do jogador, mandado a um tile andavel alem do mundo padrao (gx e gy acima dele)
    const batedor = s.unidades.ordem.map((id) => s.unidades.porId[id] as Unidade)
      .find((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'scout');
    expect(batedor).toBeDefined();
    const alvo = (() => {
      for (let r = 0; r < 20; r += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            const t = { gx: PADRAO.largura + 10 + dx, gy: PADRAO.altura - 40 + dy };
            if (t.gx >= PADRAO.largura && tileAndavel(s, t, 'livre', dados)) return t;
          }
        }
      }
      return null;
    })();
    expect(alvo).not.toBeNull();
    const destino = alvo as { gx: number; gy: number };
    // a paz e a condicao cheia cobrem a corrida: o teste mede a marcha, nao a guerra
    s = { ...s, pazAteTick: s.tick + 20_000 };
    s = step(s, [{ type: 'MoveUnits', unidades: [batedor?.id as string], destino }], dados);
    let t = 0;
    for (; t < 6000 && s.unidades.porId[batedor?.id as string]?.fsm !== 'ocioso'; t += 1) s = step(s, [], dados);
    const chegou = s.unidades.porId[batedor?.id as string] as Unidade;
    evidencia['aceite3'] = { destino, chegouEm: { gx: chegou.gx, gy: chegou.gy }, ticks: t };
    expect({ gx: chegou.gx, gy: chegou.gy }).toEqual(destino);
    expect(chegou.gx).toBeGreaterThanOrEqual(PADRAO.largura);
  });

  it('grava test-output/I-TERRENO-FASE-8-MAPA-MAIOR.json', () => {
    gravarEvidencia('I-TERRENO-FASE-8-MAPA-MAIOR', evidencia);
  });
});
