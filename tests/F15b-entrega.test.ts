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
import type { Tarefa, TipoDeTransporte } from '../src/sim/state';
import {
  ehTarefaDeTransporte, gavetaDeOrigem, MERCADORIA_DE_OURO,
} from '../src/sim/state';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { armazemDoCenario, comTarefas } from './helpers/jobs-cenario';
import { cenarioDePedreira, cenarioDeSerraria, comSaida } from './helpers/producao-cenario';

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
