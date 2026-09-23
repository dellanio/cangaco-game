/**
 * F15a — o estado de producao: o relogio do ciclo e o veio.
 *
 * O campo `PredioCompleto.producao` nasce em `completarObra` e em `criarPredios`,
 * os dois unicos lugares onde um predio completo passa a existir. `null` quando
 * o tipo nao tem receita: "nao produz" nao pode ser representavel como "produz,
 * parado".
 *
 * A segunda metade cobre `sim/producao.ts`: as derivacoes puras do ciclo
 * (receita, insumo, gaveta, veio), sem tick e sem FSM. Quem as usa e a Tarefa 5.
 */
import { describe, expect, it } from 'vitest';
import { completarObra, createInitialState } from '../src/sim/state';
import type { PredioCompleto, PredioEmObra } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import type { ReceitaDePredio } from '../src/sim/data/types';
import {
  cabeNaSaida, consumirInsumos, ehPredioProdutivo, receitaDoTipo, temInsumo, unidadesPorCiclo, veioEsgotado,
} from '../src/sim/producao';

function obraDe(tipo: string): PredioEmObra {
  const def = gameData.predios.find((p) => p.id === tipo);
  if (!def) throw new Error(`fixture: predio '${tipo}' nao existe em buildings.json`);
  return {
    id: 'obra1', tipo, gx: 5, gy: 5, estado: 'obra', hp: def.hp,
    obra: { faltam: {}, nivelamento: 0 },
  };
}

describe('F15a — PredioCompleto.producao', () => {
  it('produtor nasce com relogio zerado e o veio semeado do dado', () => {
    const quarry = completarObra(obraDe('quarry'));
    expect(quarry.producao).toEqual({
      progresso: 0,
      veio: gameData.producao.receitas.quarry?.rendimentoDoVeio,
    });
    expect(quarry.producao?.veio).toBeGreaterThan(0);
  });

  it('produtor sem veio no dado nasce renovavel (`veio: null`)', () => {
    expect(completarObra(obraDe('sawmill')).producao).toEqual({ progresso: 0, veio: null });
    expect(completarObra(obraDe('woodcutters')).producao).toEqual({ progresso: 0, veio: null });
  });

  it('predio sem receita nasce com `producao: null`', () => {
    expect(completarObra(obraDe('storehouse')).producao).toBeNull();
    expect(completarObra(obraDe('schoolhouse')).producao).toBeNull();
  });

  it('os predios do estado inicial tambem passam pelo mesmo semeador', () => {
    const estado = createInitialState(1);
    for (const id of estado.predios.ordem) {
      const p = estado.predios.porId[id];
      if (p?.estado !== 'completo') continue;
      const receita = gameData.producao.receitas[p.tipo];
      if (receita === undefined) expect(p.producao, p.tipo).toBeNull();
      else expect(p.producao, p.tipo).toEqual({ progresso: 0, veio: receita.rendimentoDoVeio });
    }
  });

  it('`producao` e `null`, nunca `undefined` — o estado tem que sobreviver ao JSON', () => {
    const ida = createInitialState(1);
    expect(JSON.parse(JSON.stringify(ida))).toEqual(ida);
  });
});

/** Um produtor completo (mesmo caminho do jogo), com as gavetas que o caso pede. */
function produtor(
  tipo: string,
  estoque: { entrada?: Record<string, number>; saida?: Record<string, number> } = {},
): PredioCompleto {
  const p = completarObra(obraDe(tipo));
  return { ...p, estoque: { entrada: estoque.entrada ?? {}, saida: estoque.saida ?? {} } };
}

function receita(tipo: string): ReceitaDePredio {
  const r = gameData.producao.receitas[tipo];
  if (!r) throw new Error(`fixture: '${tipo}' nao tem receita em production.json`);
  return r;
}

describe('F15a — sim/producao.ts, as derivacoes puras', () => {
  it('receitaDoTipo devolve null para quem nao produz — nunca undefined', () => {
    expect(receitaDoTipo('storehouse')).toBeNull();
    expect(receitaDoTipo('tipo-que-nao-existe')).toBeNull();
    expect(receitaDoTipo('quarry')?.ticksDoCiclo).toBeGreaterThan(0);
  });

  it('ehPredioProdutivo: obra nao produz, armazem completo nao produz', () => {
    expect(ehPredioProdutivo(undefined)).toBe(false);
    expect(ehPredioProdutivo(obraDe('quarry'))).toBe(false);
    expect(ehPredioProdutivo(produtor('storehouse'))).toBe(false);
    expect(ehPredioProdutivo(produtor('quarry'))).toBe(true);
  });

  it('temInsumo exige TODAS as mercadorias da receita, nao uma', () => {
    const m = produtor('metallurgists', { entrada: { gold_ore: 1 } });
    expect(temInsumo(m, receita('metallurgists'))).toBe(false); // falta coal
    const completo = produtor('metallurgists', { entrada: { gold_ore: 1, coal: 1 } });
    expect(temInsumo(completo, receita('metallurgists'))).toBe(true);
  });

  it('temInsumo e verdade de vacuo para receita sem entrada (a quarry tira do veio)', () => {
    expect(temInsumo(produtor('quarry'), receita('quarry'))).toBe(true);
  });

  it('consumirInsumos debita so o que o ciclo pede e nao toca na saida', () => {
    const s = consumirInsumos(produtor('sawmill', { entrada: { tree_trunk: 3 } }), receita('sawmill'));
    expect(s.estoque.entrada.tree_trunk).toBe(2);
    expect(s.estoque.saida).toEqual({});
  });

  it('cabeNaSaida respeita a capacidade da GAVETA, nao o total do predio', () => {
    // capacidade.saida = 5 (estoqueInternoPorPredio); o ciclo da sawmill rende 2
    expect(cabeNaSaida(produtor('sawmill', { saida: { timber: 4 } }), receita('sawmill'))).toBe(false);
    expect(cabeNaSaida(produtor('sawmill', { saida: { timber: 3 } }), receita('sawmill'))).toBe(true);
  });

  it('cabeNaSaida conta a gaveta INTEIRA, somando mercadorias diferentes', () => {
    const p = produtor('swine_farm', { saida: { pigs: 2, skins: 2 } }); // 4 ocupados, ciclo rende 2
    expect(cabeNaSaida(p, receita('swine_farm'))).toBe(false);
  });

  it('unidadesPorCiclo soma as mercadorias de saida', () => {
    expect(unidadesPorCiclo(receita('quarry'))).toBe(1);
    expect(unidadesPorCiclo(receita('sawmill'))).toBe(2);
    expect(unidadesPorCiclo(receita('swine_farm'))).toBe(2); // 1 pig + 1 skin
  });

  it('veioEsgotado e falso para receita renovavel, mesmo com o relogio cheio', () => {
    expect(veioEsgotado({ progresso: 999, veio: null }, receita('sawmill'))).toBe(false);
  });

  it('veioEsgotado ja e verdade quando o veio nao rende um CICLO inteiro', () => {
    const r: ReceitaDePredio = { ...receita('quarry'), sai: { stone: 2 } };
    expect(veioEsgotado({ progresso: 0, veio: 1 }, r)).toBe(true);
    expect(veioEsgotado({ progresso: 0, veio: 2 }, r)).toBe(false);
  });
});
