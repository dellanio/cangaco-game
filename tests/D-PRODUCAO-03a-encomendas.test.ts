/**
 * D-PRODUCAO-03a — ENCOMENDAS DAS OFICINAS, a regra. Plano:
 * docs/planos/2026-09-29-D-PRODUCAO-03a-encomendas.md.
 *
 * Decisao do operador (2026-09-29): "a encomenda nasce em zero, so inicia ciclo com
 * encomenda > 0, desconta 1 por ciclo e avisa quando todas zeram, como no KaM"
 * (`KM_Houses.pas: PickOrder`, 731a8a4). Tudo pelo `step`, na cadeia do ferro com as
 * ferrarias SEM encomenda e ferro e carvao no armazem.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { Command } from '../src/sim/commands';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { cenarioDaCadeiaDoFerro, comSaida } from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { compararComESemSave } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';

const DADOS: GameData = gameData;
/** Ferro e carvao no armazem: sobra para as tres pecas e para a fundicao. */
const FERRO_E_CARVAO = 20;
/** Teto de SEGURANCA: medido, a encomenda de 3 pecas se cumpre no tick 1181. */
const TETO = 6000;
/** A janela sem encomenda e a de depois de cumprida: o ciclo das armas e ~375 ticks, e
 *  1500 cabem quatro. */
const JANELA = 1500;

const evidencia: Record<string, unknown> = {};

const completo = (e: GameState, id: string): PredioCompleto => {
  const p = e.predios.porId[id];
  if (p?.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
};

function inicio(): GameState {
  const s = cenarioDaCadeiaDoFerro(DADOS, 6, false);
  return comSaida(s, 'arm', { ...completo(s, 'arm').estoque.saida, iron: FERRO_E_CARVAO, coal: FERRO_E_CARVAO });
}

const encomendar = (predio: string, cota: Record<string, number>): Command => ({ type: 'SetProductionQuota', predio, cota });

interface Corrida {
  readonly estado: GameState;
  /** cada `goods-produced` de `ws1`, na ordem, com o tick */
  readonly pecas: readonly { readonly tick: number; readonly mercadoria: string }[];
  /** os ticks de `production-order-completed` de `ws1` */
  readonly avisos: readonly number[];
}

function rodar(s0: GameState, ticks: number, pare?: (c: Corrida) => boolean): Corrida {
  let s = s0;
  const pecas: { tick: number; mercadoria: string }[] = [];
  const avisos: number[] = [];
  for (let t = 0; t < ticks; t += 1) {
    s = step(s, [], DADOS);
    for (const ev of s.events) {
      if (ev.type === 'goods-produced' && ev.predio === 'ws1') pecas.push({ tick: s.tick, mercadoria: ev.mercadoria });
      if (ev.type === 'production-order-completed' && ev.predio === 'ws1') avisos.push(s.tick);
    }
    if (pare?.({ estado: s, pecas, avisos }) === true) break;
  }
  return { estado: s, pecas, avisos };
}

describe('D-PRODUCAO-03a — a oficina nasce sem encomenda', () => {
  it('encomenda zero em cada saida, e nenhum ciclo nem insumo cobrado na janela', () => {
    const s0 = inicio();
    expect(completo(s0, 'ws1').producao?.escolha?.cota).toEqual({ sword: 0, pike: 0, crossbow: 0 });
    expect(completo(s0, 'as1').producao?.escolha?.cota).toEqual({ iron_armor: 0, iron_shield: 0 });
    let s = s0;
    let produziu = 0;
    let comecou = 0;
    for (let t = 0; t < JANELA; t += 1) {
      s = step(s, [], DADOS);
      for (const ev of s.events) if (ev.type === 'goods-produced' && (ev.predio === 'ws1' || ev.predio === 'as1')) produziu += 1;
      for (const id of ['ws1', 'as1']) if ((completo(s, id).producao?.progresso ?? 0) > 0) comecou += 1;
    }
    // e o insumo chegou: a gaveta tem com o que trabalhar, so falta a encomenda
    const entrada = completo(s, 'ws1').estoque.entrada;
    evidencia['semEncomenda'] = { janela: JANELA, produziu, comecou, entradaDeWs1: entrada };
    expect(produziu).toBe(0);
    expect(comecou).toBe(0);
    expect((entrada.iron ?? 0) > 0 && (entrada.coal ?? 0) > 0).toBe(true);
  });
});

describe('D-PRODUCAO-03a — a encomenda se cumpre e para', () => {
  const s1 = step(inicio(), [encomendar('ws1', { sword: 2, crossbow: 1 })], DADOS);
  // o primeiro tick com o ciclo em andamento
  const primeiro = rodar(s1, TETO, (c) => (completo(c.estado, 'ws1').producao?.progresso ?? 0) > 0);
  const cumprida = rodar(s1, TETO, (c) => c.avisos.length > 0);
  const depois = rodar(cumprida.estado, JANELA);

  it('o comando com a encomenda e aceito', () => {
    expect(s1.events.some((e) => e.type === 'command-rejected')).toBe(false);
    expect(completo(s1, 'ws1').producao?.escolha?.cota).toEqual({ sword: 2, pike: 0, crossbow: 1 });
  });

  it('o desconto e no COMECO do ciclo: a escolhida ja caiu 1 e esta em curso', () => {
    const escolha = completo(primeiro.estado, 'ws1').producao?.escolha;
    evidencia['comecoDoPrimeiroCiclo'] = { tick: primeiro.estado.tick, escolha };
    expect(primeiro.pecas).toEqual([]);
    expect(escolha?.cota).toEqual({ sword: 1, pike: 0, crossbow: 1 });
    expect(escolha?.emCurso).toBe('sword');
  });

  it('sai exatamente o encomendado, alternando: espada, besta, espada', () => {
    expect(cumprida.pecas.map((p) => p.mercadoria)).toEqual(['sword', 'crossbow', 'sword']);
  });

  it('o aviso sai uma vez, no tick do ultimo deposito encomendado', () => {
    const ultima = cumprida.pecas[cumprida.pecas.length - 1];
    expect(cumprida.avisos).toEqual([ultima?.tick]);
    expect(completo(cumprida.estado, 'ws1').producao?.escolha?.emCurso).toBeUndefined();
  });

  it('cumprida, a oficina nao faz mais nada nem avisa de novo', () => {
    evidencia['encomendaCumprida'] = {
      encomenda: { sword: 2, crossbow: 1 }, pecas: cumprida.pecas, avisos: cumprida.avisos,
      depois: { janela: JANELA, pecas: depois.pecas, avisos: depois.avisos },
    };
    expect(depois.pecas).toEqual([]);
    expect(depois.avisos).toEqual([]);
    expect(violacoesDeInvariantes(depois.estado, DADOS)).toEqual([]);
    expect(violacoesDaFsmDoEspecialista(depois.estado, DADOS)).toEqual([]);
  });
});

describe('D-PRODUCAO-03a — encomenda zerada no meio de um ciclo', () => {
  it('o ciclo em curso termina e entrega, e nao comeca outro', () => {
    const s1 = step(inicio(), [encomendar('ws1', { pike: 3 })], DADOS);
    const emCurso = rodar(s1, TETO, (c) => (completo(c.estado, 'ws1').producao?.progresso ?? 0) > 0);
    expect(completo(emCurso.estado, 'ws1').producao?.escolha?.emCurso).toBe('pike');
    const zerado = step(emCurso.estado, [encomendar('ws1', {})], DADOS);
    // tudo zero deixou de ser recusa
    expect(zerado.events.some((e) => e.type === 'command-rejected')).toBe(false);
    expect(completo(zerado, 'ws1').producao?.escolha).toEqual({ cota: { sword: 0, pike: 0, crossbow: 0 }, proxima: 2, emCurso: 'pike' });
    const fim = rodar(zerado, JANELA * 2);
    evidencia['zeradaNoMeio'] = { pecas: fim.pecas, avisos: fim.avisos };
    expect(fim.pecas.map((p) => p.mercadoria)).toEqual(['pike']);
    expect(fim.avisos).toEqual([fim.pecas[0]?.tick]);
    expect(completo(fim.estado, 'ws1').producao?.progresso).toBe(0);
  });
});

describe('D-PRODUCAO-03a — a faixa do comando', () => {
  it('o maximo do dado vale; um acima e recusa cota-invalida, e o estado nao muda', () => {
    const s0 = inicio();
    const maxima = DADOS.producao.encomenda.maxima;
    const aceito = step(s0, [encomendar('ws1', { sword: maxima })], DADOS);
    expect(aceito.events.some((e) => e.type === 'command-rejected')).toBe(false);
    expect(completo(aceito, 'ws1').producao?.escolha?.cota.sword).toBe(maxima);
    const recusado = step(s0, [encomendar('ws1', { sword: maxima + 1 })], DADOS);
    const recusa = recusado.events.find((e) => e.type === 'command-rejected');
    expect(recusa?.type === 'command-rejected' && recusa.command === 'SetProductionQuota' ? recusa.motivo : null).toBe('cota-invalida');
    expect(completo(recusado, 'ws1').producao?.escolha).toEqual(completo(s0, 'ws1').producao?.escolha);
  });
});

describe('D-PRODUCAO-03a — determinismo', () => {
  it('save/load no meio de uma encomenda da o mesmo estado', () => {
    const s0 = inicio();
    const { direto, comSave } = compararComESemSave({
      seed: 1, totalTicks: 1200, saveAtTick: s0.tick + 500,
      antesDoStep: (e) => (e.tick === 0 ? s0 : e),
      comandosNoTick: (t) => (t === s0.tick ? [encomendar('ws1', { sword: 2, crossbow: 1 })] : []),
    });
    expect(comSave).toBe(direto);
    gravarEvidencia('D-PRODUCAO-03a-encomendas', evidencia);
  });
});
