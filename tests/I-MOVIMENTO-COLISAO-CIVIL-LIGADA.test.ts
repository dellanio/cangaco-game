/**
 * I-MOVIMENTO-COLISAO-CIVIL-LIGADA — civis colidem (decisao do operador, 2026-10-04: "a colisao e
 * justamente um dos desafios do jogo"). Aceites (a) e (b), pelo `step`, com o dado como esta:
 *  (a) a invariante "um civil por tile" vale em TODO tick de 20 000 ticks, na escaramuca e no jogo
 *      livre (a vila da calibracao, a de mais trafego), fora dos estados "dentro";
 *  (b) nao trava, POR PROGRESSO (a licao da D-MOVIMENTO-01): todo civil que quer andar (caminho por
 *      andar, ou a porta por sair) avanca um tile dentro de `colisaoCivil.ticksPrazoDeProgresso`.
 *      Quem nao quer andar (trabalhando, ocioso parado) nao conta: esperar trabalho nao e travar.
 * O aceite (c), a permuta de frente no tempo de andar sozinho, esta na D-MOVIMENTO-01a.
 *
 * O teste nao afirma producao (decisao do operador, 2026-10-04): com a colisao ligada, quanto se
 * produz e o desafio do jogador, e nao assercao.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { ehCivilQueOcupa, menorProgresso } from '../src/sim/colisao';
import { posicaoDaUnidade } from '../src/sim/selectors';
import { custoDoPasso } from '../src/sim/pathfinding';
import { violacoesDaFsm } from './helpers/serf-invariantes';
import type { GameData } from '../src/sim/data/types';
import type { Unidade } from '../src/sim/state';
import { classeDaUnidade } from '../src/sim/condicao';
import { comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import { gravarEvidencia } from './helpers/evidence';
import { validarTudo } from '../tools/data-rules.js';

const TICKS = 20_000;

interface Medida {
  /** Ticks em que dois civis "fora" dividiam um tile. */
  readonly empilhados: string[];
  /** O maior numero de ticks seguidos que um civil que queria andar ficou no mesmo tile. */
  readonly maiorSemAvancar: number;
  readonly quem: string;
  /** Quantos civis andaram (trocaram de tile) ao menos uma vez: o teste nao e vacuo. */
  readonly andaram: number;
}

function correr(s0: GameState, comandos: (s: GameState, t: number) => Parameters<typeof step>[1]): Medida {
  let s = s0;
  const empilhados: string[] = [];
  const semAvancar = new Map<string, { gx: number; gy: number; ticks: number }>();
  const andaram = new Set<string>();
  let maiorSemAvancar = 0;
  let quem = '';
  for (let t = 0; t < TICKS; t += 1) {
    s = step(s, comandos(s, t), gameData);
    const porTile = new Map<string, string[]>();
    for (const id of s.unidades.ordem) {
      const u = s.unidades.porId[id];
      if (u === undefined || classeDaUnidade(u.tipo, gameData) !== 'civil') continue;
      if (ehCivilQueOcupa(u, gameData)) {
        const k = `${u.gx},${u.gy}`;
        porTile.set(k, [...(porTile.get(k) ?? []), id]);
      }
      const querAndar = (u.fsmData.caminho ?? []).length > 0 || u.saindo !== undefined;
      const antes = semAvancar.get(id);
      const mesmo = antes !== undefined && antes.gx === u.gx && antes.gy === u.gy;
      if (antes !== undefined && !mesmo) andaram.add(id);
      const ticks = querAndar && mesmo ? antes.ticks + 1 : 0;
      semAvancar.set(id, { gx: u.gx, gy: u.gy, ticks });
      if (ticks > maiorSemAvancar) { maiorSemAvancar = ticks; quem = `${id}:${u.fsm}@t${s.tick}`; }
    }
    for (const [tile, ids] of porTile) if (ids.length > 1) empilhados.push(`t${s.tick} ${tile}: ${ids.join(',')}`);
  }
  return { empilhados, maiorSemAvancar, quem, andaram: andaram.size };
}

describe('I-MOVIMENTO-COLISAO-CIVIL-LIGADA — civis colidem, pelo step', () => {
  it('a chave do dado esta ligada', () => {
    expect(gameData.movimento.colisaoCivil.ligada).toBe(true);
  });

  it('a regra de dado: o prazo de progresso cobre o trabalho mais longo num tile (semear e colheita), e reprova o que nao cobre', () => {
    const cru = (prazo: number): Record<string, unknown> => {
      const d: Record<string, unknown> = {};
      for (const n of readdirSync('data').filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))) d[n] = JSON.parse(readFileSync(`data/${n}.json`, 'utf8'));
      (d['units'] as { colisaoCivil: { prazoDeProgresso_segundos_base: number } }).colisaoCivil.prazoDeProgresso_segundos_base = prazo;
      return d;
    };
    const daRegra = (prazo: number): string[] => validarTudo(cru(prazo)).filter((e: string) => e.includes('prazoDeProgresso'));
    expect(daRegra(90)).toEqual([]);
    // o corte da arvore no tile e 66,2 s base, e o semear dela 53, na mesma escala: 66 nao cobre o
    // corte, e 52 nao cobre nenhum dos dois
    expect(daRegra(66).some((e) => e.includes("'woodcutters'"))).toBe(true);
    expect(daRegra(52).some((e) => e.includes("'tree'"))).toBe(true);
    expect(daRegra(0).length).toBeGreaterThan(0);
  });

  it('o piso do progresso: a divida de dois passos vale, abaixo dela a invariante acusa; desligada, so 0', () => {
    const DESLIGADA: GameData = { ...gameData, movimento: { ...gameData.movimento, colisaoCivil: { ...gameData.movimento.colisaoCivil, ligada: false } } };
    const s0 = createInitialState(gameData.economia.estadoInicial.semente);
    const serf = s0.unidades.ordem.map((id) => s0.unidades.porId[id] as Unidade).find((u) => u.tipo === 'serf') as Unidade;
    const comProgresso = (p: number): GameState => ({ ...s0, unidades: { ...s0.unidades, porId: { ...s0.unidades.porId,
      [serf.id]: { ...serf, fsm: 'indo_buscar', fsmData: { caminho: [{ gx: serf.gx + 1, gy: serf.gy }], progresso: p } } } } });
    const acusa = (p: number, dados: GameData): boolean => violacoesDaFsm(comProgresso(p), dados).some((v) => v.includes('progresso invalido'));
    const piso = menorProgresso(gameData);
    expect(piso).toBe(-2 * Math.max(...Object.values(gameData.movimento.ticksPorTileDiagonal.aPe)));
    expect(acusa(piso, gameData)).toBe(false);
    expect(acusa(piso - 1, gameData)).toBe(true);
    expect(menorProgresso(DESLIGADA)).toBe(0);
    expect(acusa(-1, DESLIGADA)).toBe(true);
  });

  it('o civil segurado no fim do passo e desenhado na borda do tile, e nao dentro do tile do outro', () => {
    const s0 = createInitialState(gameData.economia.estadoInicial.semente);
    const serf = s0.unidades.ordem.map((id) => s0.unidades.porId[id] as Unidade).find((u) => u.tipo === 'serf') as Unidade;
    // o tile da frente VAZIO de civil (BUG-CIVIL-RECUA-NO-DESENHO: com um civil parado nele, o desenho
    // ja para na borda andando; os serfs iniciais nascem lado a lado, e o de leste tinha um)
    const proximo = [1, -1].map((d) => ({ gx: serf.gx + d, gy: serf.gy }))
      .find((t) => !s0.unidades.ordem.some((id) => { const o = s0.unidades.porId[id] as Unidade; return o.id !== serf.id && o.gx === t.gx && o.gy === t.gy && ehCivilQueOcupa(o, gameData); })) as { gx: number; gy: number };
    expect(proximo, 'fixture: um vizinho de leste ou oeste sem civil').toBeDefined();
    const sentido = proximo.gx - serf.gx;
    const custo = custoDoPasso(s0.estradas, serf, proximo, gameData);
    const com = (bloqueado: number | undefined): Unidade => ({ ...serf, fsm: 'indo_buscar',
      fsmData: { caminho: [proximo], progresso: custo - 1, ...(bloqueado === undefined ? {} : { bloqueado }) } });
    // andando, o desenho segue o passo; segurado, para no meio (a borda entre os dois tiles)
    expect((posicaoDaUnidade(s0, com(undefined)).gx - serf.gx) * sentido).toBeGreaterThan(0.5);
    expect((posicaoDaUnidade(s0, com(3)).gx - serf.gx) * sentido).toBe(0.5);
  });

  it('(a) e (b) na escaramuca: um civil por tile em todo tick, e quem quer andar avanca dentro do prazo', () => {
    const m = correr(criarEscaramuca(gameData.economia.estadoInicial.semente), () => []);
    gravarEvidencia('I-MOVIMENTO-COLISAO-CIVIL-LIGADA-escaramuca', { ticks: TICKS, ...m, empilhados: m.empilhados.length });
    expect(m.andaram).toBeGreaterThan(0);
    expect(m.empilhados.slice(0, 5)).toEqual([]);
    expect(m.maiorSemAvancar, m.quem).toBeLessThanOrEqual(gameData.movimento.colisaoCivil.ticksPrazoDeProgresso);
  }, 120_000);

  it('(a) e (b) no jogo livre (a vila da calibracao): um civil por tile em todo tick, e quem quer andar avanca dentro do prazo', () => {
    const s0 = createInitialState(gameData.economia.estadoInicial.semente);
    const vila = vilaDaCalibracao(s0);
    const m = correr(s0, (s, t) => comandosDaVilaNoTick(s, vila, t));
    gravarEvidencia('I-MOVIMENTO-COLISAO-CIVIL-LIGADA-jogo-livre', { ticks: TICKS, ...m, empilhados: m.empilhados.length });
    expect(m.andaram).toBeGreaterThan(0);
    expect(m.empilhados.slice(0, 5)).toEqual([]);
    expect(m.maiorSemAvancar, m.quem).toBeLessThanOrEqual(gameData.movimento.colisaoCivil.ticksPrazoDeProgresso);
  }, 120_000);
});
