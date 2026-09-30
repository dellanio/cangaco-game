/**
 * F-VIVO-h — a escola anima enquanto ha recruta em treino (BUILD_PLAN.md, "Aceite da
 * F-VIVO-h"). O laco `treino` sai de `quadroDaEscola` (`src/render/trabalho.ts`), que le a
 * fila de `state.treino` sem mudar a sim.
 *
 * O cenario e o do aceite da F13a, com UM pedido e o ouro no ARMAZEM: a escola passa pela
 * espera da mercadoria (`aguardando`), treina e solta o recruta. Tudo pelo `step`, tick a
 * tick, comparando o laco com a fila do mesmo tick.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInitialState } from '../src/sim/state';
import type { GameState, Predio } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { salvar } from '../src/sim/save';
import { filaDaEscola } from '../src/sim/escola';
import { quadroDaEscola } from '../src/render/trabalho';
import { LACOS_DA_ESCOLA, LACO_DA_ESCOLA, violacoesDaCamadaViva, violacoesDasAncoras } from '../src/render/manifesto-camadas';
import type { EntradaDeAsset, EntradaDeCamada } from '../src/render/manifesto';
import { contextoDasCamadas } from '../src/render/predios';
import { armazemPorTipo, comOuroNoArmazem, escolaDoCenario, pedir } from './helpers/escola-cenario';
import { comEstradas } from './helpers/jobs-cenario';
import { linhaHDe, naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;
const ARMAZEM = armazemPorTipo(inicial).id;
const TICKS = gameData.economia.schoolhouse.ticksPorTreino;
const QUADROS = LACOS_DA_ESCOLA[LACO_DA_ESCOLA] ?? 0;
/** A linha de porta dos dois predios, como na F13a. */
const RUAS = linhaHDe(naVila, 0, 7, 3);

const predio = (s: GameState, id: string): Predio => {
  const p = s.predios.porId[id];
  if (p === undefined) throw new Error(`fixture: sem ${id}`);
  return p;
};
const treinando = (s: GameState): boolean => filaDaEscola(s, ESCOLA).some((i) => i.estado === 'treinando');
const laco = (s: GameState): number | null => quadroDaEscola(predio(s, ESCOLA), s.treino[ESCOLA], s.tick);

describe('F-VIVO-h — a escola anima enquanto treina', () => {
  it('escola sem fila nao anima', () => {
    expect(inicial.treino[ESCOLA]).toBeUndefined();
    expect(laco(inicial)).toBeNull();
    expect(laco(step(inicial, []))).toBeNull();
  });

  it('o laco vai do primeiro ao ultimo tick do treino, some no tick em que o recruta sai; esperando o ouro, nada', () => {
    let s = step(comOuroNoArmazem(comEstradas(inicial, RUAS), ARMAZEM, 1), [pedir(ESCOLA, 'serf')]);
    let aguardando = 0;
    let comeca: number | null = null;
    let sai: number | null = null;
    const animados: number[] = [];
    let partida: GameState | null = null;
    const historico: GameState[] = [];
    for (let i = 0; i < 2_000 && sai === null; i++) {
      historico.push(s);
      if (historico.length > 40) historico.shift();
      s = step(s, []);
      const q = laco(s);
      const fila = filaDaEscola(s, ESCOLA);
      if (fila[0]?.estado === 'aguardando') { aguardando += 1; expect(q, `aguardando no tick ${s.tick}`).toBeNull(); }
      expect(q !== null, `tick ${s.tick}: laco contra fila treinando`).toBe(treinando(s));
      if (q !== null) {
        if (comeca === null) { comeca = s.tick; partida = historico[0] ?? null; }
        expect(q).toBe((s.tick % QUADROS) + 1);
        animados.push(s.tick);
      }
      if (s.events.some((e) => e.type === 'unit-trained')) {
        sai = s.tick;
        expect(q, 'no tick em que o recruta sai').toBeNull();
        expect(fila).toEqual([]);
      }
    }
    // o cenario aconteceu: a escola esperou o ouro, treinou e soltou o recruta
    expect(aguardando).toBeGreaterThan(0);
    if (comeca === null || sai === null || partida === null) throw new Error('fixture: o treino nao aconteceu');
    // sem buraco: do tick da cobranca (restam cheio) ao ultimo com restam 1
    expect(animados).toHaveLength(TICKS);
    expect(animados[animados.length - 1]).toBe(sai - 1);
    expect(sai - comeca).toBe(TICKS);
    expect(laco(step(s, []))).toBeNull();

    // a partida do roteiro: 40 ticks antes de a escola comecar a treinar
    const dir = 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F-VIVO-h.save.txt`, salvar(partida));
    const escola = predio(partida, ESCOLA);
    writeFileSync(`${dir}/F-VIVO-h.partida.json`, JSON.stringify({
      tick: partida.tick, predio: ESCOLA, comeca, sai, centro: { gx: escola.gx + 1.5, gy: escola.gy + 1.5 },
    }, null, 2));
    gravarEvidencia('F-VIVO-h', { ticksPorTreino: TICKS, aguardando, comeca, sai, animados: animados.length, partida: partida.tick });
  });

  it('so a escola anima com fila: outro predio com a mesma fila nao', () => {
    const fila = [{ id: 'f1', unidade: 'serf', estado: 'treinando', restam: 3 }] as const;
    expect(quadroDaEscola(predio(inicial, ESCOLA), fila, 7)).toBe((7 % QUADROS) + 1);
    expect(quadroDaEscola(predio(inicial, ARMAZEM), fila, 7)).toBeNull();
    expect(quadroDaEscola(predio(inicial, ESCOLA), [{ id: 'f1', unidade: 'serf', estado: 'aguardando' }], 7)).toBeNull();
  });
});

describe('F-VIVO-h — o manifesto aceita a escola por excecao nomeada', () => {
  const camada = (id: string, estados: string[]): EntradaDeCamada => ({
    id, tipo: 'trabalho', footprint: [1, 1], tamanho: [16, 16], anchor: [0.5, 1],
    estados: Object.fromEntries(estados.map((k) => [k, `sprites/${id}/${id}_${k}.png`])),
    licenca: 'sintetica, so no teste', origem: { base: `base/${id}/${id}.png`, semente: null },
  });
  const quadros = (nome: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${nome}_${i + 1}`);
  const comArea = (id: string): EntradaDeAsset => ({
    id, tipo: 'predio', footprint: [3, 3], tamanho: [192, 128], anchor: [0.5, 1],
    estados: { completo: `sprites/${id}/completo.png` },
    licenca: 'sintetica, so no teste', origem: { base: `base/${id}/${id}.png`, semente: null },
    ancoras: { trabalho: { area: [0.3, 0.35, 0.7, 0.75] } },
  });

  it('schoolhouse com treino_1..8 passa; outro predio sem receita reprova', () => {
    expect(violacoesDaCamadaViva(camada('schoolhouse', quadros('treino', 8)), contextoDasCamadas)).toEqual([]);
    expect(violacoesDaCamadaViva(camada('barracks', quadros('treino', 8)), contextoDasCamadas).join(' | '))
      .toMatch(/barracks.*nao e predio com receita/);
    expect(violacoesDaCamadaViva(camada('schoolhouse', quadros('treino', 6)), contextoDasCamadas).join(' | '))
      .toMatch(/treino.*6 de 8/);
    expect(violacoesDaCamadaViva(camada('schoolhouse', quadros('laco1', 8)), contextoDasCamadas).join(' | '))
      .toMatch(/laco1_1/);
  });

  it('trabalho.area na escola passa; em outro predio sem receita reprova', () => {
    expect(violacoesDasAncoras(comArea('schoolhouse'), contextoDasCamadas)).toEqual([]);
    expect(violacoesDasAncoras(comArea('barracks'), contextoDasCamadas).join(' | '))
      .toMatch(/trabalho.area em predio sem animacao dentro/);
  });
});
