/**
 * F15b-1, Tarefa 2 — os quatro tipos novos da escada (niveis 4, 5, 6 e 7), a
 * gaveta de origem por tipo e o contrato de destino que o helper de invariantes
 * passa a cobrar. Nenhum gerador ainda: aqui so a FORMA da tarefa.
 */
import { describe, expect, it } from 'vitest';
import {
  criarTarefaDeInsumo, criarTarefaParaArmazem, elegivelParaTarefa, nivelDoTipo,
  TIPO_QUE_CARREGA, TIPO_QUE_CONSTROI,
} from '../src/sim/jobs';
import type { GameState, Tarefa, TarefaDeTransporte, TipoDeTransporte } from '../src/sim/state';
import {
  ehTarefaDeTransporte, gavetaDeOrigem, MERCADORIA_DE_OURO,
} from '../src/sim/state';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { armazemDoCenario, comTarefas, comUnidadeExtra } from './helpers/jobs-cenario';
import { demandaNoDestino, disponivelNaOrigem, reservadoNaOrigem } from '../src/sim/reservas';
import { demandaDeInsumo } from '../src/sim/insumo';
import { cenarioDePedreira, cenarioDeSerraria, comEntrada, comSaida } from './helpers/producao-cenario';

/** Serraria (`s1`, consome `tree_trunk`) e pedreira (`q1`, sem receita): os dois
 *  lados do contrato de destino. Os dois cenarios usam o mesmo armazem inicial. */
const base = cenarioDeSerraria();
const pedreira = cenarioDePedreira();
const armazem = armazemDoCenario(base).id;

/** Uma tarefa crua, sem passar pelos criadores: e assim que se monta um estado
 *  DELIBERADAMENTE torto para provar que o helper de invariantes ACUSA. */
const crua = (t: Tarefa): Tarefa => t;

describe('F15b — os quatro tipos entram na escada', () => {
  it('cada tipo novo tem nivel em delivery.json, na ordem certa', () => {
    expect(nivelDoTipo('insumo-producao-parada')).toBe(4);
    expect(nivelDoTipo('insumo-producao-baixa')).toBe(5);
    expect(nivelDoTipo('saida-cheia-para-armazem')).toBe(6);
    expect(nivelDoTipo('excedente-para-armazem')).toBe(7);
    expect(nivelDoTipo('insumo-producao-parada'))
      .toBeLessThan(nivelDoTipo('insumo-producao-baixa'));
    expect(nivelDoTipo('material-para-obra'))
      .toBeLessThan(nivelDoTipo('insumo-producao-parada'));
  });

  it('os quatro sao tarefas de TRANSPORTE pela forma', () => {
    const { state, id } = criarTarefaParaArmazem(base, {
      mercadoria: MERCADORIA_DE_OURO, origem: 's1', destino: armazem, excedente: true,
    });
    expect(ehTarefaDeTransporte(state.jobs.tarefas.porId[id]!)).toBe(true);
    const insumo = criarTarefaDeInsumo(base, {
      mercadoria: 'tree_trunk', origem: armazem, destino: 's1', parada: true,
    });
    expect(ehTarefaDeTransporte(insumo.state.jobs.tarefas.porId[insumo.id]!)).toBe(true);
  });

  it('a flag escolhe o tipo, e o tipo fica fotografado na criacao', () => {
    const parada = criarTarefaDeInsumo(base, {
      mercadoria: 'tree_trunk', origem: armazem, destino: 's1', parada: true,
    });
    expect(parada.state.jobs.tarefas.porId[parada.id]!.tipo).toBe('insumo-producao-parada');
    const baixa = criarTarefaDeInsumo(base, {
      mercadoria: 'tree_trunk', origem: armazem, destino: 's1', parada: false,
    });
    expect(baixa.state.jobs.tarefas.porId[baixa.id]!.tipo).toBe('insumo-producao-baixa');
    const cheia = criarTarefaParaArmazem(pedreira, {
      mercadoria: 'stone', origem: 'q1', destino: armazem, excedente: false,
    });
    expect(cheia.state.jobs.tarefas.porId[cheia.id]!.tipo).toBe('saida-cheia-para-armazem');
  });

  it('a tarefa nova nasce aberta, sem unidade, e o contador anda', () => {
    const { state, id } = criarTarefaDeInsumo(base, {
      mercadoria: 'tree_trunk', origem: armazem, destino: 's1', parada: true,
    });
    const t = state.jobs.tarefas.porId[id]!;
    expect(t.estado).toBe('aberta');
    expect(t.reclamadaPor).toBeNull();
    expect(state.proximoId).toBe(base.proximoId + 1);
    expect(state.jobs.tarefas.ordem).toContain(id);
  });

  it('a gaveta de origem e `saida` para 1-6 e `entrada` so para o nivel 7', () => {
    expect(gavetaDeOrigem('material-para-obra')).toBe('saida');
    expect(gavetaDeOrigem('ouro-para-escola')).toBe('saida');
    expect(gavetaDeOrigem('insumo-producao-parada')).toBe('saida');
    expect(gavetaDeOrigem('insumo-producao-baixa')).toBe('saida');
    expect(gavetaDeOrigem('saida-cheia-para-armazem')).toBe('saida');
    expect(gavetaDeOrigem('excedente-para-armazem')).toBe('entrada');
  });

  it('so o serf e elegivel para os quatro', () => {
    const tipos: readonly TipoDeTransporte[] = [
      'insumo-producao-parada', 'insumo-producao-baixa',
      'saida-cheia-para-armazem', 'excedente-para-armazem',
    ];
    for (const t of tipos) {
      expect(elegivelParaTarefa(t, TIPO_QUE_CARREGA)).toBe(true);
      expect(elegivelParaTarefa(t, TIPO_QUE_CONSTROI)).toBe(false);
    }
  });
});

describe('F15b — o helper de invariantes ACUSA (D8)', () => {
  it('reclama de tarefa de nivel 6 cujo destino nao e armazem', () => {
    const torto = comTarefas(comSaida(base, 's1', { timber: 1 }), [crua({
      id: 't99', numero: 99, tipo: 'saida-cheia-para-armazem', mercadoria: 'timber',
      origem: 's1', destino: 's1', estado: 'aberta', reclamadaPor: null,
    })]);
    expect(violacoesDeInvariantes(torto)).not.toEqual([]);
  });

  it('reclama de tarefa de nivel 6 cuja ORIGEM e o proprio armazem', () => {
    const torto = comTarefas(base, [crua({
      id: 't99', numero: 99, tipo: 'saida-cheia-para-armazem', mercadoria: 'stone',
      origem: armazem, destino: armazem, estado: 'aberta', reclamadaPor: null,
    })]);
    expect(violacoesDeInvariantes(torto)).not.toEqual([]);
  });

  it('reclama de tarefa de nivel 4 cujo destino nao pede a mercadoria', () => {
    const torto = comTarefas(base, [crua({
      id: 't98', numero: 98, tipo: 'insumo-producao-parada', mercadoria: 'tree_trunk',
      origem: armazem, destino: armazem, estado: 'aberta', reclamadaPor: null,
    })]);
    expect(violacoesDeInvariantes(torto)).not.toEqual([]);
  });

  it('reclama de tarefa de nivel 5 levando mercadoria que a receita nao pede', () => {
    const torto = comTarefas(base, [crua({
      id: 't98', numero: 98, tipo: 'insumo-producao-baixa', mercadoria: 'stone',
      origem: armazem, destino: 's1', estado: 'aberta', reclamadaPor: null,
    })]);
    expect(violacoesDeInvariantes(torto)).not.toEqual([]);
  });

  it('reclama de tarefa de nivel 7 cujo destino nao e armazem', () => {
    const torto = comTarefas(base, [crua({
      id: 't97', numero: 97, tipo: 'excedente-para-armazem', mercadoria: 'tree_trunk',
      origem: 's1', destino: 's1', estado: 'aberta', reclamadaPor: null,
    })]);
    expect(violacoesDeInvariantes(torto)).not.toEqual([]);
  });

  it('nao reclama do estado certo — nivel 6 da pedreira ao armazem', () => {
    const certo = comTarefas(comSaida(pedreira, 'q1', { stone: 1 }), [crua({
      id: 't97', numero: 97, tipo: 'saida-cheia-para-armazem', mercadoria: 'stone',
      origem: 'q1', destino: armazem, estado: 'aberta', reclamadaPor: null,
    })]);
    expect(violacoesDeInvariantes(certo)).toEqual([]);
  });

  it('nao reclama do estado certo — nivel 4 do armazem a serraria', () => {
    const certo = comTarefas(base, [crua({
      id: 't96', numero: 96, tipo: 'insumo-producao-parada', mercadoria: 'tree_trunk',
      origem: armazem, destino: 's1', estado: 'aberta', reclamadaPor: null,
    })]);
    expect(violacoesDeInvariantes(certo)).toEqual([]);
  });

  it('nao reclama do estado certo — nivel 7 da serraria ao armazem', () => {
    const certo = comTarefas(base, [crua({
      id: 't96', numero: 96, tipo: 'excedente-para-armazem', mercadoria: 'stone',
      origem: 's1', destino: armazem, estado: 'aberta', reclamadaPor: null,
    })]);
    expect(violacoesDeInvariantes(certo)).toEqual([]);
  });

  it('a pedreira sem receita nunca e destino valido de insumo', () => {
    const torto = comTarefas(pedreira, [crua({
      id: 't95', numero: 95, tipo: 'insumo-producao-baixa', mercadoria: 'stone',
      origem: armazem, destino: 'q1', estado: 'aberta', reclamadaPor: null,
    })]);
    expect(violacoesDeInvariantes(torto)).not.toEqual([]);
  });
});

describe('F15b — reserva por gaveta', () => {
  /** `s1` com 1 timber na gaveta `saida` e 1 na `entrada`, e duas tarefas
   *  RECLAMADAS: uma de nivel 6 (tira da `saida`) e uma de nivel 7 (tira da
   *  `entrada`). Mesma mercadoria, mesmo predio — o caso em que uma reserva
   *  poderia comer a unidade da outra. */
  function comAsDuasGavetasReservadas(): GameState {
    let s = comSaida(comEntrada(base, 's1', { timber: 1 }), 's1', { timber: 1 });
    s = comUnidadeExtra(s, 'serf-a', TIPO_QUE_CARREGA, 30, 33);
    s = comUnidadeExtra(s, 'serf-b', TIPO_QUE_CARREGA, 30, 34);
    return comTarefas(s, [
      crua({
        id: 't90', numero: 90, tipo: 'saida-cheia-para-armazem', mercadoria: 'timber',
        origem: 's1', destino: armazem, estado: 'reclamada', reclamadaPor: 'serf-a',
      }),
      crua({
        id: 't91', numero: 91, tipo: 'excedente-para-armazem', mercadoria: 'timber',
        origem: 's1', destino: armazem, estado: 'reclamada', reclamadaPor: 'serf-b',
      }),
    ]);
  }

  it('reserva na origem conta so a MESMA gaveta', () => {
    const s = comAsDuasGavetasReservadas();
    expect(reservadoNaOrigem(s, 's1', 'timber', 'saida')).toBe(1);
    expect(reservadoNaOrigem(s, 's1', 'timber', 'entrada')).toBe(1);
  });

  it('e por isso as duas unidades continuam disponiveis, uma em cada gaveta', () => {
    const s = comAsDuasGavetasReservadas();
    expect(disponivelNaOrigem(s, 's1', 'timber', 'saida')).toBe(0);
    expect(disponivelNaOrigem(s, 's1', 'timber', 'entrada')).toBe(0);
    // sem a gaveta, cada uma contaria a reserva da outra e daria -1 (reserva orfa)
    expect(disponivelNaOrigem(s, 's1', 'timber', 'saida')).toBeGreaterThanOrEqual(0);
  });

  it('disponivel de nivel 6 le a gaveta `saida` do PRODUTOR, nao do armazem', () => {
    const s = comSaida(pedreira, 'q1', { stone: 3 });
    expect(disponivelNaOrigem(s, 'q1', 'stone', 'saida')).toBe(3);
  });

  it('disponivel de nivel 7 le a gaveta `entrada`', () => {
    const s = comEntrada(base, 's1', { tree_trunk: 1 });
    expect(disponivelNaOrigem(s, 's1', 'tree_trunk', 'entrada')).toBe(1);
    expect(disponivelNaOrigem(s, 's1', 'tree_trunk', 'saida')).toBe(0);
  });

  it('a chamada antiga, sem gaveta, continua lendo `saida`', () => {
    const s = comEntrada(comSaida(base, 's1', { timber: 4 }), 's1', { timber: 9 });
    expect(disponivelNaOrigem(s, 's1', 'timber')).toBe(4);
    expect(reservadoNaOrigem(s, 's1', 'timber')).toBe(0);
  });

  it('destino armazem nao tem teto: a origem e que limita', () => {
    const nivel6 = crua({
      id: 't90', numero: 90, tipo: 'saida-cheia-para-armazem', mercadoria: 'stone',
      origem: 'q1', destino: armazem, estado: 'aberta', reclamadaPor: null,
    }) as TarefaDeTransporte;
    const nivel7 = crua({
      id: 't91', numero: 91, tipo: 'excedente-para-armazem', mercadoria: MERCADORIA_DE_OURO,
      origem: 's1', destino: armazem, estado: 'aberta', reclamadaPor: null,
    }) as TarefaDeTransporte;
    expect(demandaNoDestino(base, nivel6)).toBe(Number.POSITIVE_INFINITY);
    expect(demandaNoDestino(base, nivel7)).toBe(Number.POSITIVE_INFINITY);
  });

  it('destino produtor pede exatamente a demanda de insumo', () => {
    const s = comEntrada(base, 's1', { tree_trunk: 2 });
    const t = crua({
      id: 't92', numero: 92, tipo: 'insumo-producao-baixa', mercadoria: 'tree_trunk',
      origem: armazem, destino: 's1', estado: 'aberta', reclamadaPor: null,
    }) as TarefaDeTransporte;
    expect(demandaNoDestino(s, t)).toBe(demandaDeInsumo(s, 's1', 'tree_trunk'));
    expect(demandaNoDestino(s, t)).toBeGreaterThan(0);
  });

  it('tarefa de insumo apontando para o armazem pede zero (sanear cancela)', () => {
    const t = crua({
      id: 't93', numero: 93, tipo: 'insumo-producao-parada', mercadoria: 'tree_trunk',
      origem: armazem, destino: armazem, estado: 'aberta', reclamadaPor: null,
    }) as TarefaDeTransporte;
    expect(demandaNoDestino(base, t)).toBe(0);
  });

  it('tarefa para armazem apontando para produtor pede zero (sanear cancela)', () => {
    const t = crua({
      id: 't94', numero: 94, tipo: 'saida-cheia-para-armazem', mercadoria: 'timber',
      origem: 'q1', destino: 's1', estado: 'aberta', reclamadaPor: null,
    }) as TarefaDeTransporte;
    expect(demandaNoDestino(base, t)).toBe(0);
  });
});
