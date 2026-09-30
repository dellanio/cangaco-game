/**
 * D-PRODUCAO-01b — o insumo ESCASSO dividido entre fundicao e ferrarias.
 * Plano: docs/planos/2026-09-29-D-PRODUCAO-01b-insumo-escasso.md.
 *
 * O defeito (sonda da 01a): uma mina de carvao, tres consumidores, e a ferraria de
 * armaduras nunca recebia carvao — 39 / 7 / 0 em 12 000 ticks. As tres tarefas empatavam
 * no nivel e o custo A* dava sempre a vez a mais perto. O KaM (`KM_HandLogistics.pas`,
 * 731a8a4, `TryCalculateBidBasic` :1512-1530) ignora a distancia nesse caso; aqui a perna
 * de entrega sai do custo e desempata quem recebeu ha mais tempo (`delivery.divisaoDoEscasso`).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { criarTarefaDeInsumo, tarefasEmOrdem } from '../src/sim/jobs';
import { step } from '../src/sim/tick';
import { cenarioDaCadeiaDoFerro, comEntrada, comSaida } from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const DADOS: GameData = gameData;
const CONSUMIDORES = ['fu1', 'ws1', 'as1'] as const;

/** Teto de SEGURANCA: a sonda mediu a primeira peca de armadura no tick 2256. */
const TETO_DA_ARMADURA = 5000;

/** A janela da razao. A sonda mediu, em 6000 ticks, 11 / 6 / 5 carvoes para fundicao,
 *  armas e armaduras (menor/maior 0,45); o modelo revogado dava 0 para as armaduras. */
const JANELA = 6000;
/** Piso da razao menor/maior entre os tres: entre o revogado (0) e o medido (0,45),
 *  na metade do medido. Nao e total — o balanceamento gira o total, nao a divisao. */
const PISO_DA_DIVISAO = 0.22;

const completo = (e: GameState, id: string): PredioCompleto => {
  const p = e.predios.porId[id];
  if (p?.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
};

function comUltimaEntrega(e: GameState, id: string, ultimaEntrega: Record<string, number>): GameState {
  const p = completo(e, id);
  return { ...e, predios: { ...e.predios, porId: { ...e.predios.porId, [id]: { ...p, ultimaEntrega } } } };
}

/** Tres tarefas de carvao abertas, uma por consumidor, criadas na ordem do quadro (a
 *  fundicao primeiro): o empate de `numero` e o que favorecia a fundicao. */
function tresTarefasDeCarvao(carvaoNoArmazem: number): GameState {
  let s = comSaida(cenarioDaCadeiaDoFerro(), 'arm', { coal: carvaoNoArmazem });
  for (const id of CONSUMIDORES) s = comEntrada(s, id, { coal: 0 });
  for (const destino of CONSUMIDORES) {
    s = criarTarefaDeInsumo(s, { mercadoria: 'coal', origem: 'arm', destino, parada: true }).state;
  }
  return s;
}

const ordemDoCarvao = (s: GameState): string[] =>
  tarefasEmOrdem(s, null, DADOS)
    .flatMap((t) => (t.tipo === 'insumo-producao-parada' && t.mercadoria === 'coal' && t.origem === 'arm' ? [t.destino] : []));

describe('D-PRODUCAO-01b — a ordem das tarefas de insumo escasso', () => {
  it('escasso: a distancia nao decide, e quem recebeu ha mais tempo vem primeiro', () => {
    const s = comUltimaEntrega(comUltimaEntrega(tresTarefasDeCarvao(1), 'fu1', { coal: 50 }), 'ws1', { coal: 30 });
    // as1 nunca recebeu, ws1 recebeu no 30, fu1 no 50
    expect(ordemDoCarvao(s)).toEqual(['as1', 'ws1', 'fu1']);
  });

  it('com oferta farta a regra nao vale: volta a ordem pelo caminho', () => {
    const acima = DADOS.entrega.divisaoDoEscasso.ofertaMaxima + 1;
    const farto = comUltimaEntrega(comUltimaEntrega(tresTarefasDeCarvao(acima), 'fu1', { coal: 50 }), 'ws1', { coal: 30 });
    const semVez = tresTarefasDeCarvao(acima);
    // a vez nao muda nada: a ordem e a mesma de quem nunca recebeu nada
    expect(ordemDoCarvao(farto)).toEqual(ordemDoCarvao(semVez));
    expect(ordemDoCarvao(farto)).not.toEqual(['as1', 'ws1', 'fu1']);
  });

  it('com a gaveta do destino acima do limite, ele sai da disputa', () => {
    const cheio = DADOS.entrega.divisaoDoEscasso.gavetaMaxima + 1;
    // as1 nunca recebeu, mas ja tem carvao guardado: perde a vez para quem esta vazio
    const s = comEntrada(comUltimaEntrega(comUltimaEntrega(tresTarefasDeCarvao(1), 'fu1', { coal: 50 }), 'ws1', { coal: 30 }), 'as1', { coal: cheio });
    expect(ordemDoCarvao(s).slice(0, 2)).toEqual(['ws1', 'fu1']);
  });
});

describe('D-PRODUCAO-01b — pelo step, na cadeia do ferro', () => {
  let s = cenarioDaCadeiaDoFerro();
  const carvao: Record<string, number> = { fu1: 0, ws1: 0, as1: 0 };
  let primeiraArmadura: number | null = null;
  for (let t = 1; t <= JANELA; t += 1) {
    s = step(s, [], DADOS);
    for (const ev of s.events) {
      if (ev.type === 'task-completed' && ev.mercadoria === 'coal' && ev.destino in carvao) carvao[ev.destino] = (carvao[ev.destino] ?? 0) + 1;
      if (ev.type === 'goods-produced' && ev.predio === 'as1') primeiraArmadura ??= t;
    }
  }
  const valores = CONSUMIDORES.map((id) => carvao[id] ?? 0);
  const razao = Math.min(...valores) / Math.max(...valores);

  it('a ferraria de armaduras recebe carvao e faz peca dentro do teto', () => {
    expect(carvao.as1).toBeGreaterThan(0);
    expect(primeiraArmadura).not.toBeNull();
    expect(primeiraArmadura ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(TETO_DA_ARMADURA);
  });

  it(`nenhum dos tres fica para tras: menor/maior >= ${PISO_DA_DIVISAO}`, () => {
    gravarEvidencia('D-PRODUCAO-01b-insumo-escasso', { janela: JANELA, carvao, razao, primeiraArmadura });
    expect(razao).toBeGreaterThanOrEqual(PISO_DA_DIVISAO);
  });

  it('a vez fica gravada so em quem divide, e o quadro segue sem violacao', () => {
    for (const id of CONSUMIDORES) expect(completo(s, id).ultimaEntrega?.coal).toBeDefined();
    expect(completo(s, 'bodega').ultimaEntrega).toBeUndefined();
    expect(violacoesDeInvariantes(s, DADOS)).toEqual([]);
  });
});
