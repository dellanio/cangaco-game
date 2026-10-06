/**
 * I-TELA-CHAO-DA-ROCA-DO-MILHO — o rocado de milho e de cana do jogador com o chao desenhado, sem o losango
 * (pedido do operador, 2026-10-06). A regra do chao por cultura, e a partida do roteiro: o rocado arado
 * pelo `step` (o `PlowField` de verdade), metade semeada.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { GameState, RecursoNoTile } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlowField } from '../src/sim/campos';
import { semearNoTile } from '../src/sim/recursos';
import { salvar } from '../src/sim/save';
import { CHAO_DA_CANA, CHAO_DO_MILHO, CHAOS_DA_ROCA, chaoDaRoca, indiceDoChao } from '../src/render/chao-da-roca';
import { codigoDoRecurso, recursosDeRender } from '../src/render/mapa';
import { gravarEvidencia } from './helpers/evidence';

describe('I-TELA-CHAO-DA-ROCA-DO-MILHO', () => {
  it.each([
    ['milho plantado', { tipo: 'corn', quantidade: 3 }, CHAO_DO_MILHO],
    ['milho em pousio', { tipo: 'corn', quantidade: 0 }, CHAO_DO_MILHO],
    ['cana plantada', { tipo: 'grapes', quantidade: 3 }, CHAO_DA_CANA],
    ['cana em pousio', { tipo: 'grapes', quantidade: 0 }, CHAO_DA_CANA],
    ['arvore', { tipo: 'tree', quantidade: 2 }, null],
    ['vazio', undefined, null],
  ] as const)('(1) %s', (_c, recurso, esperado) => {
    expect(chaoDaRoca(recurso as RecursoNoTile | undefined)).toBe(esperado);
  });

  it('(1) cada chao tem o seu bloco de 4 variantes na tira, sem encostar no outro', () => {
    const cana = new Set<number>(), milho = new Set<number>();
    for (let gx = 0; gx < 16; gx++) for (let gy = 0; gy < 16; gy++) {
      cana.add(indiceDoChao(CHAO_DA_CANA, gx, gy));
      milho.add(indiceDoChao(CHAO_DO_MILHO, gx, gy));
    }
    expect([...cana].sort()).toEqual([1, 2, 3, 4]);
    expect([...milho].sort()).toEqual([5, 6, 7, 8]);
    expect(CHAOS_DA_ROCA).toHaveLength(2);
  });

  it('grava a partida do roteiro: o rocado do jogador arado pelo step (pousio), metade semeada', () => {
    let s: GameState = createInitialState(gameData.economia.estadoInicial.semente);
    const livres = (rec: string, x0: number, y0: number) => {
      const out: { gx: number; gy: number }[] = [];
      for (let gy = y0; gy < y0 + 8 && out.length < 6; gy++) for (let gx = x0; gx < x0 + 8 && out.length < 6; gx++) if (canPlowField(s, rec, [{ gx, gy }]).ok) out.push({ gx, gy });
      return out;
    };
    const milho = livres('corn', 26, 36), cana = livres('grapes', 36, 36);
    expect(milho).toHaveLength(6);
    expect(cana).toHaveLength(6);
    s = step(s, [{ type: 'PlowField', recurso: 'corn', tiles: milho }, { type: 'PlowField', recurso: 'grapes', tiles: cana }]);
    const todos = [...milho, ...cana].map(({ gx, gy }) => `${gx},${gy}`);
    for (let t = 0; t < 2000 && !todos.every((k) => s.recursos[k] !== undefined); t++) s = step(s, []);
    // arado pelo jogador e pousio: o codigo que desenhava o losango
    expect(todos.map((k) => codigoDoRecurso(s.recursos[k]))).toEqual(todos.map(() => recursosDeRender.codigoEmPousio));
    // metade semeada (o estagio `semeado` de cada cultura)
    for (const k of [...todos.slice(0, 3), ...todos.slice(6, 9)]) s = { ...s, recursos: semearNoTile(s, k) };
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/I-TELA-CHAO-DA-ROCA-DO-MILHO.save.txt`, salvar(s));
    gravarEvidencia('I-TELA-CHAO-DA-ROCA-DO-MILHO', { milho, cana, tick: s.tick });
  }, 30_000);
});
