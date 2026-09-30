/**
 * D-TRANSPORTE-02a — o menu de distribuicao na sim (plano em
 * docs/planos/2026-09-29-D-TRANSPORTE-02-menu-de-distribuicao.md). O comando
 * `SetWareDistribution`, o limite que ele poe na demanda de insumo, o excedente que NAO
 * volta ao armazem e o saneamento da aberta alem do limite.
 *
 * O limite entra pelo COMANDO REAL, nunca escrito a mao no estado.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { comPredio } from '../src/sim/units/movimento';
import { demandaDeInsumo, excedenteNaEntrada } from '../src/sim/insumo';
import { gerarTarefas, sanearTarefas } from '../src/sim/systems/jobs';
import { aplicarSetWareDistribution } from '../src/sim/systems/distribuicao';
import { limiteDeDistribuicao } from '../src/sim/distribuicao';
import { validarTudo } from '../tools/data-rules.js';
import { cenarioDaCadeiaDoPao, comSaida } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const MAXIMO = gameData.entrega.distribuicao.maximo;
const PADRAO_DO_MOINHO = gameData.entrega.distribuicao.padrao['corn']?.['mill'];

const distribuir = (quantidade: number, mercadoria = 'corn', tipo = 'mill'): Command =>
  ({ type: 'SetWareDistribution', mercadoria, tipo, quantidade });
const comando = (s: GameState, c: Command): GameState => {
  if (c.type !== 'SetWareDistribution') throw new Error('so SetWareDistribution');
  return aplicarSetWareDistribution(s, c, gameData).state;
};

function completo(s: GameState, id: string): PredioCompleto {
  const p = s.predios.porId[id];
  if (p?.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
}

/** A cadeia do pao (moinho `m1`, armazem `arm`) com milho de sobra no armazem. */
function cadeiaComMilho(): GameState {
  const s = cenarioDaCadeiaDoPao(gameData, 0);
  return comSaida(s, 'arm', { ...completo(s, 'arm').estoque.saida, corn: 20 });
}

const insumoDeMilhoParaOMoinho = (s: GameState): number => s.jobs.tarefas.ordem
  .map((id) => s.jobs.tarefas.porId[id])
  .filter((t) => t !== undefined && 'mercadoria' in t && t.mercadoria === 'corn' && 'destino' in t && t.destino === 'm1'
    && (t.tipo === 'insumo-producao-parada' || t.tipo === 'insumo-producao-baixa')).length;

describe('D-TRANSPORTE-02a — o comando', () => {
  const inicial = createInitialState(1);

  it('grava so a diferenca do padrao; o padrao apaga a chave; o mesmo valor devolve o mesmo estado', () => {
    expect(PADRAO_DO_MOINHO).toBe(MAXIMO);
    const dois = comando(inicial, distribuir(2));
    expect(dois.distribuicao).toEqual({ [String(LADO_DO_JOGADOR)]: { corn: { mill: 2 } } });
    expect(comando(dois, distribuir(2))).toBe(dois);
    const outro = comando(dois, distribuir(1, 'coal', 'iron_smithy'));
    expect(outro.distribuicao).toEqual({ [String(LADO_DO_JOGADOR)]: { corn: { mill: 2 }, coal: { iron_smithy: 1 } } });
    const devolvido = comando(comando(outro, distribuir(MAXIMO)), distribuir(MAXIMO, 'coal', 'iron_smithy'));
    expect('distribuicao' in devolvido).toBe(false);
    expect(JSON.stringify(devolvido)).toBe(JSON.stringify(inicial));
    expect(comando(inicial, distribuir(MAXIMO))).toBe(inicial);
  });

  it('recusa par fora do dado e quantidade fora da faixa, com o estado intacto', () => {
    const casos: [Command, string][] = [
      [distribuir(3, 'corn', 'bakery'), 'par-desconhecido'],
      [distribuir(3, 'flour', 'bakery'), 'par-desconhecido'],
      [distribuir(-1), 'fora-da-faixa'],
      [distribuir(MAXIMO + 1), 'fora-da-faixa'],
      [distribuir(2.5), 'fora-da-faixa'],
    ];
    for (const [c, motivo] of casos) {
      if (c.type !== 'SetWareDistribution') throw new Error('so SetWareDistribution');
      const r = aplicarSetWareDistribution(inicial, c, gameData);
      expect(r.state).toBe(inicial);
      expect(r.events).toEqual([{ type: 'command-rejected', command: 'SetWareDistribution', mercadoria: c.mercadoria, tipo: c.tipo, motivo }]);
    }
  });

  it('o comando do jogador nao mexe no lado da IA', () => {
    const s = comando(inicial, distribuir(0));
    expect(limiteDeDistribuicao(s, LADO_DO_JOGADOR, 'mill', 'corn', gameData)).toBe(0);
    expect(limiteDeDistribuicao(s, LADO_DO_JOGADOR + 1, 'mill', 'corn', gameData)).toBe(PADRAO_DO_MOINHO);
    // o par que nao e disputado nao tem limite
    expect(limiteDeDistribuicao(s, LADO_DO_JOGADOR, 'bakery', 'flour', gameData)).toBeNull();
  });
});

describe('D-TRANSPORTE-02a — o limite na demanda', () => {
  const base = cadeiaComMilho();

  it('o moinho vazio pede o alvo no padrao, o limite abaixo dele e nada com zero', () => {
    const alvo = demandaDeInsumo(base, 'm1', 'corn', gameData);
    expect(alvo).toBe(gameData.producao.estoqueInternoPorPredio.entrada);
    expect(demandaDeInsumo(comando(base, distribuir(2)), 'm1', 'corn', gameData)).toBe(2);
    expect(demandaDeInsumo(comando(base, distribuir(0)), 'm1', 'corn', gameData)).toBe(0);
  });

  it('o gerador: com o moinho em 0 nenhum milho sai para ele; de volta ao padrao, a tarefa nasce', () => {
    const noPadrao = insumoDeMilhoParaOMoinho(gerarTarefas(base, gameData));
    const emZero = insumoDeMilhoParaOMoinho(gerarTarefas(comando(base, distribuir(0)), gameData));
    const emDois = insumoDeMilhoParaOMoinho(gerarTarefas(comando(base, distribuir(2)), gameData));
    const devolta = insumoDeMilhoParaOMoinho(gerarTarefas(comando(comando(base, distribuir(0)), distribuir(MAXIMO)), gameData));
    expect(noPadrao).toBe(gameData.producao.estoqueInternoPorPredio.entrada);
    expect(emZero).toBe(0);
    expect(emDois).toBe(2);
    expect(devolta).toBe(noPadrao);
    gravarEvidencia('D-TRANSPORTE-02a-distribuicao', { tarefasDeMilhoParaOMoinho: { noPadrao, emDois, emZero, devolta } });
  });

  it('baixar o limite com a gaveta cheia nao devolve nada ao armazem', () => {
    const m1 = completo(base, 'm1');
    const cheio = comPredio(base, { ...m1, estoque: { ...m1.estoque, entrada: { corn: gameData.producao.estoqueInternoPorPredio.entrada } } });
    const limitado = comando(cheio, distribuir(1));
    expect(excedenteNaEntrada(limitado, 'm1', 'corn', gameData)).toBe(0);
    expect(demandaDeInsumo(limitado, 'm1', 'corn', gameData)).toBe(0);
    const tarefas = gerarTarefas(limitado, gameData);
    const devolvendo = tarefas.jobs.tarefas.ordem.map((id) => tarefas.jobs.tarefas.porId[id])
      .filter((t) => t !== undefined && t.tipo === 'excedente-para-armazem' && 'origem' in t && t.origem === 'm1');
    expect(devolvendo).toHaveLength(0);
  });

  it('a aberta alem do limite novo cai no saneamento do mesmo tick', () => {
    const comAbertas = gerarTarefas(base, gameData);
    expect(insumoDeMilhoParaOMoinho(comAbertas)).toBe(gameData.producao.estoqueInternoPorPredio.entrada);
    const saneado = sanearTarefas(comando(comAbertas, distribuir(2)), gameData).state;
    expect(insumoDeMilhoParaOMoinho(saneado)).toBe(2);
    expect(insumoDeMilhoParaOMoinho(sanearTarefas(comando(comAbertas, distribuir(0)), gameData).state)).toBe(0);
  });

  it('determinismo: a mesma lista de comandos da o mesmo estado nas duas corridas', () => {
    const correr = (): string => {
      let s = cenarioDaCadeiaDoPao(gameData, 2);
      for (let t = 0; t < 300; t++) s = step(s, t === 5 ? [distribuir(1)] : [], gameData);
      return JSON.stringify(s);
    };
    expect(correr()).toBe(correr());
  });
});

describe('D-TRANSPORTE-02a — a regra de dado', () => {
  const cru = (mexer: (d: { delivery: { distribuicao: { maximo: number; padrao: Record<string, Record<string, number>> } } }) => void): string[] => {
    const d: Record<string, unknown> = {};
    for (const n of readdirSync('data').filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))) {
      d[n] = JSON.parse(readFileSync(`data/${n}.json`, 'utf8'));
    }
    mexer(d as unknown as Parameters<typeof mexer>[0]);
    return validarTudo(d).filter((e: string) => e.startsWith('entrega/distribuicao'));
  };

  it('passa no dado de verdade e acusa par falso, valor fora da faixa e consumidor faltando', () => {
    expect(cru(() => undefined)).toEqual([]);
    expect(cru((d) => { (d.delivery.distribuicao.padrao['corn'] ?? {})['bakery'] = 5; })).toHaveLength(1);
    expect(cru((d) => { (d.delivery.distribuicao.padrao['corn'] ?? {})['mill'] = MAXIMO + 1; })).toHaveLength(1);
    expect(cru((d) => { delete (d.delivery.distribuicao.padrao['corn'] ?? {})['stables']; })).toHaveLength(1);
    expect(cru((d) => { delete d.delivery.distribuicao.padrao['iron']; })).toHaveLength(2);
  });
});
