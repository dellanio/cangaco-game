/**
 * F15b-1, Tarefa 1 — `sim/insumo.ts`: o alvo da gaveta `entrada`, a demanda de
 * insumo (niveis 4 e 5) e o excedente (nivel 7). Tudo derivacao pura: nenhuma
 * tarefa, nenhum serf, nenhum tick.
 */
import { describe, expect, it } from 'vitest';
import {
  alvoDeEntrada, demandaDeInsumo, excedenteNaEntrada, insumosDoPredio, produtorParado,
} from '../src/sim/insumo';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { ID_DO_ARMAZEM, MERCADORIA_DE_OURO } from '../src/sim/state';
import { custoDeTreino, ouroNecessario } from '../src/sim/escola';
import { cenarioDePedreira, cenarioDeSerraria, comEntrada } from './helpers/producao-cenario';
import { comOuroNaEscola, escolaDoCenario, pedir } from './helpers/escola-cenario';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';

const CAPACIDADE_DA_ENTRADA = gameData.producao.estoqueInternoPorPredio.entrada;

/** Um `GameData` com uma receita de DUAS entradas, para exercitar a reparticao
 *  proporcional sem esperar a F20. O caminho e o dado de verdade com outra
 *  receita — no molde de `comRendimento`. */
function comReceita(
  dados: GameData, tipo: string, entra: Record<string, number>,
): GameData {
  const receita = dados.producao.receitas[tipo];
  if (receita === undefined) throw new Error(`fixture: '${tipo}' nao tem receita`);
  return {
    ...dados,
    producao: {
      ...dados.producao,
      receitas: { ...dados.producao.receitas, [tipo]: { ...receita, entra } },
    },
  };
}

describe('F15b — o alvo da gaveta de entrada', () => {
  it('produtor de uma entrada so quer a gaveta inteira', () => {
    const s = cenarioDeSerraria();
    expect(alvoDeEntrada(s, 's1', 'tree_trunk')).toBe(CAPACIDADE_DA_ENTRADA);
  });

  it('mercadoria que a receita nao pede tem alvo zero', () => {
    const s = cenarioDeSerraria();
    expect(alvoDeEntrada(s, 's1', 'stone')).toBe(0);
  });

  it('produtor sem entrada nenhuma (quarry) nao quer nada', () => {
    const s = cenarioDePedreira();
    expect(alvoDeEntrada(s, 'q1', 'stone')).toBe(0);
    expect(insumosDoPredio(s, 'q1')).toEqual([]);
  });

  it('duas entradas em razao 1:1 repartem a gaveta, sem perder a sobra', () => {
    const dados = comReceita(gameData, 'sawmill', { tree_trunk: 1, coal: 1 });
    const s = cenarioDeSerraria(dados);
    const a = alvoDeEntrada(s, 's1', 'tree_trunk', dados);
    const b = alvoDeEntrada(s, 's1', 'coal', dados);
    expect(a + b).toBe(CAPACIDADE_DA_ENTRADA);
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
  });

  it('a sobra da divisao vai para a mercadoria de maior `entra`', () => {
    const dados = comReceita(gameData, 'sawmill', { tree_trunk: 3, coal: 1 });
    const s = cenarioDeSerraria(dados);
    const tronco = alvoDeEntrada(s, 's1', 'tree_trunk', dados);
    const carvao = alvoDeEntrada(s, 's1', 'coal', dados);
    expect(tronco + carvao).toBe(CAPACIDADE_DA_ENTRADA);
    expect(tronco).toBeGreaterThan(carvao);
  });

  it('o armazem nao quer nada: sem receita e sem fila', () => {
    const s = createInitialState(1);
    expect(alvoDeEntrada(s, ID_DO_ARMAZEM, 'stone')).toBe(0);
    expect(alvoDeEntrada(s, ID_DO_ARMAZEM, MERCADORIA_DE_OURO)).toBe(0);
  });

  it('escola: o alvo e a demanda da FILA, nao a capacidade da gaveta', () => {
    const inicial = createInitialState(1);
    const escola = escolaDoCenario(inicial).id;
    const s = step(inicial, [pedir(escola, 'serf'), pedir(escola, 'serf')]);
    expect(alvoDeEntrada(s, escola, MERCADORIA_DE_OURO)).toBeGreaterThan(0);
    expect(alvoDeEntrada(s, escola, MERCADORIA_DE_OURO) % custoDeTreino()).toBe(0);
  });

  it('escola sem fila nao quer ouro nenhum', () => {
    const s = createInitialState(1);
    expect(alvoDeEntrada(s, escolaDoCenario(s).id, MERCADORIA_DE_OURO)).toBe(0);
  });
});

describe('F15b — demanda de insumo e excedente', () => {
  it('demanda desconta o que ja esta na gaveta', () => {
    const s = comEntrada(cenarioDeSerraria(), 's1', { tree_trunk: 2 });
    expect(demandaDeInsumo(s, 's1', 'tree_trunk')).toBe(CAPACIDADE_DA_ENTRADA - 2);
  });

  it('gaveta cheia nao tem demanda nem excedente', () => {
    const s = comEntrada(cenarioDeSerraria(), 's1', { tree_trunk: CAPACIDADE_DA_ENTRADA });
    expect(demandaDeInsumo(s, 's1', 'tree_trunk')).toBe(0);
    expect(excedenteNaEntrada(s, 's1', 'tree_trunk')).toBe(0);
  });

  it('acima do alvo vira excedente, na mesma conta com o sinal trocado', () => {
    const s = comEntrada(cenarioDeSerraria(), 's1', { tree_trunk: CAPACIDADE_DA_ENTRADA + 3 });
    expect(excedenteNaEntrada(s, 's1', 'tree_trunk')).toBe(3);
    expect(demandaDeInsumo(s, 's1', 'tree_trunk')).toBe(0);
  });

  it('demanda e excedente NUNCA sao positivos ao mesmo tempo', () => {
    for (let q = 0; q <= CAPACIDADE_DA_ENTRADA + 4; q++) {
      const s = comEntrada(cenarioDeSerraria(), 's1', { tree_trunk: q });
      const d = demandaDeInsumo(s, 's1', 'tree_trunk');
      const e = excedenteNaEntrada(s, 's1', 'tree_trunk');
      expect(Math.min(d, e)).toBe(0);
    }
  });

  it('ouro parado em escola sem fila e excedente por inteiro', () => {
    const inicial = createInitialState(1);
    const escola = escolaDoCenario(inicial).id;
    const s = comOuroNaEscola(inicial, escola, 1);
    expect(excedenteNaEntrada(s, escola, MERCADORIA_DE_OURO)).toBe(1);
    expect(demandaDeInsumo(s, escola, MERCADORIA_DE_OURO)).toBe(0);
  });

  it('a relacao com `ouroNecessario` e exata: alvo - emCaixa', () => {
    // O alvo e o que a fila quer TER; `ouroNecessario` e o que falta RECEBER.
    // Se os dois divergirem, o ouro entregue vira excedente e volta — vaivem.
    const inicial = createInitialState(1);
    const escola = escolaDoCenario(inicial).id;
    const comFila = step(inicial, [pedir(escola, 'serf'), pedir(escola, 'serf')]);
    for (const emCaixa of [0, 1, 2]) {
      const s = comOuroNaEscola(comFila, escola, emCaixa);
      expect(ouroNecessario(s, escola))
        .toBe(Math.max(0, alvoDeEntrada(s, escola, MERCADORIA_DE_OURO) - emCaixa));
    }
  });

  it('ouro em escola COM fila nao e excedente: a fila ainda o quer', () => {
    const inicial = createInitialState(1);
    const escola = escolaDoCenario(inicial).id;
    const comFila = step(inicial, [pedir(escola, 'serf')]);
    const s = comOuroNaEscola(comFila, escola, 1);
    expect(excedenteNaEntrada(s, escola, MERCADORIA_DE_OURO)).toBe(0);
  });

  it('predio que nao existe, ou em obra, nao pede nem sobra', () => {
    const s = cenarioDeSerraria();
    expect(demandaDeInsumo(s, 'nao-existe', 'tree_trunk')).toBe(0);
    expect(excedenteNaEntrada(s, 'nao-existe', 'tree_trunk')).toBe(0);
    expect(alvoDeEntrada(s, 'nao-existe', 'tree_trunk')).toBe(0);
  });
});

describe('F15b — parada (nivel 4) contra baixa (nivel 5)', () => {
  it('parada e ter ZERO do que a receita pede', () => {
    expect(produtorParado(cenarioDeSerraria(), 's1', 'tree_trunk')).toBe(true);
  });

  it('uma unidade ja tira o predio da parada', () => {
    const s = comEntrada(cenarioDeSerraria(), 's1', { tree_trunk: 1 });
    expect(produtorParado(s, 's1', 'tree_trunk')).toBe(false);
  });

  it('quem nao pede a mercadoria nunca esta parado por ela', () => {
    expect(produtorParado(cenarioDePedreira(), 'q1', 'stone')).toBe(false);
    expect(produtorParado(cenarioDeSerraria(), 's1', 'stone')).toBe(false);
  });

  it('a escola nao entra na conta de producao parada (o nivel dela e o 2)', () => {
    const s = createInitialState(1);
    expect(produtorParado(s, escolaDoCenario(s).id, MERCADORIA_DE_OURO)).toBe(false);
  });
});
