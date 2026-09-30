/**
 * F24c — A CASA DO GIBAO POR ENCOMENDA, com um insumo por peca. Plano:
 * docs/planos/2026-09-29-F24c-casa-do-gibao-por-encomenda.md.
 *
 * Decisao do operador (2026-09-29): a receita confere com o KaM (`WARFARE_COSTS`,
 * KM_ResWares.pas:73-75: gibao = 1 couro, escudo = 1 madeira), e a Casa do Gibao segue a
 * regra de encomenda da D-PRODUCAO-03, como todas as oficinas de guerra. O `PickOrder` do
 * KaM (KM_Houses.pas:1585-1600) pula a peca encomendada sem insumo. Tudo pelo `step`.
 *
 * A fixture e a cadeia do couro SEM o Curtume e sem madeira no armazem: o insumo da Casa do
 * Gibao e so o que o teste poe na entrada dela.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { Command } from '../src/sim/commands';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { salvar } from '../src/sim/save';
import { receitaDoTipo } from '../src/sim/producao';
import { alvoDeEntrada } from '../src/sim/insumo';
import { cenarioDoCouroSemCurtume, comEntrada, comSaida } from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { gravarEvidencia } from './helpers/evidence';
import { validarTudo } from '../tools/data-rules.js';

const DADOS: GameData = gameData;
const CASA = 'aw1';
/** Teto de SEGURANCA, nao afirmacao de desempenho: um ciclo da Casa do Gibao e ~300 ticks. */
const TETO = 3000;
/** A janela sem encomenda: cabem varios ciclos. */
const JANELA = 1500;

const evidencia: Record<string, unknown> = {};

const completo = (e: GameState, id: string): PredioCompleto => {
  const p = e.predios.porId[id];
  if (p?.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
};

/** O que a fixture poe de cada insumo. Fica DENTRO do alvo da gaveta (`alvoDeEntrada`),
 *  senao a sobra volta ao armazem pelo nivel 7 e a conta do teste mistura as duas regras. */
const INSUMO = 2;

/** A Casa do Gibao com `entrada` e nada mais chegando: sem Curtume, sem madeira no armazem. */
function casaCom(entrada: Record<string, number>): GameState {
  let s = cenarioDoCouroSemCurtume(DADOS);
  s = comSaida(s, 'arm', { ...completo(s, 'arm').estoque.saida, timber: 0, leather: 0 });
  s = comEntrada(s, CASA, entrada);
  for (const [bem, q] of Object.entries(entrada)) {
    if (q > alvoDeEntrada(s, CASA, bem, DADOS)) throw new Error(`fixture: ${bem}=${q} passa do alvo da gaveta`);
  }
  return s;
}

const encomendar = (cota: Record<string, number>): Command => ({ type: 'SetProductionQuota', predio: CASA, cota });

interface Corrida {
  readonly estado: GameState;
  readonly pecas: readonly { readonly tick: number; readonly mercadoria: string }[];
  readonly avisos: readonly number[];
}

function rodar(s0: GameState, comandos: readonly Command[], ticks: number, pare?: (c: Corrida) => boolean): Corrida {
  let s = s0;
  const pecas: { tick: number; mercadoria: string }[] = [];
  const avisos: number[] = [];
  for (let t = 0; t < ticks; t += 1) {
    s = step(s, t === 0 ? comandos : [], DADOS);
    for (const ev of s.events) {
      if (ev.type === 'goods-produced' && ev.predio === CASA) pecas.push({ tick: s.tick, mercadoria: ev.mercadoria });
      if (ev.type === 'production-order-completed' && ev.predio === CASA) avisos.push(s.tick);
    }
    if (pare?.({ estado: s, pecas, avisos }) === true) break;
  }
  return { estado: s, pecas, avisos };
}

/** O insumo da Casa do Gibao: o que ficou na entrada mais o que foi cobrado do ciclo em curso. */
const naEntrada = (e: GameState, bem: string): number => completo(e, CASA).estoque.entrada[bem] ?? 0;

describe('F24c — um insumo por peca, como no KaM', () => {
  it('reprova antes da correcao: so couro, gibao encomendado -> sai o gibao, o couro desce 1, madeira nenhuma', () => {
    const s0 = casaCom({ leather: INSUMO });
    const r = rodar(s0, [encomendar({ leather_armor: 1 })], TETO, (c) => c.pecas.length > 0);
    expect(r.pecas.map((p) => p.mercadoria)).toEqual(['leather_armor']);
    expect(naEntrada(r.estado, 'leather')).toBe(INSUMO - 1);
    expect(naEntrada(r.estado, 'timber')).toBe(0);
    evidencia['soCouro'] = { tick: r.pecas[0]?.tick, entrada: completo(r.estado, CASA).estoque.entrada };
  });

  it('o contrario: so madeira, escudo encomendado -> sai o escudo, a madeira desce 1, o couro intacto', () => {
    const s0 = casaCom({ timber: INSUMO });
    const r = rodar(s0, [encomendar({ wooden_shield: 1 })], TETO, (c) => c.pecas.length > 0);
    expect(r.pecas.map((p) => p.mercadoria)).toEqual(['wooden_shield']);
    expect(naEntrada(r.estado, 'timber')).toBe(INSUMO - 1);
    expect(naEntrada(r.estado, 'leather')).toBe(0);
    evidencia['soMadeira'] = { tick: r.pecas[0]?.tick, entrada: completo(r.estado, CASA).estoque.entrada };
  });

  it('a receita carregada: cada peca come o seu insumo, e so ele', () => {
    const receita = receitaDoTipo('armory_workshop', DADOS);
    expect(receita?.escolheSaida).toBe(true);
    expect(receita?.entraPorSaida).toEqual({ leather_armor: { leather: 1 }, wooden_shield: { timber: 1 } });
  });
});

describe('F24c — a regra de encomenda da D-PRODUCAO-03', () => {
  it('nasce parada: couro e madeira na entrada, encomenda zero, nenhum ciclo na janela', () => {
    const s0 = casaCom({ leather: INSUMO, timber: INSUMO });
    expect(completo(s0, CASA).producao?.escolha?.cota).toEqual({ leather_armor: 0, wooden_shield: 0 });
    let comecou = 0;
    const r = rodar(s0, [], JANELA, (c) => {
      if ((completo(c.estado, CASA).producao?.progresso ?? 0) > 0) comecou += 1;
      return false;
    });
    expect(r.pecas).toEqual([]);
    expect(comecou).toBe(0);
    expect(completo(r.estado, CASA).estoque.entrada).toMatchObject({ leather: INSUMO, timber: INSUMO });
  });

  it('o PickOrder: gibao e escudo encomendados, so madeira -> o escudo sai, e o gibao continua devendo 1', () => {
    const s0 = casaCom({ timber: INSUMO });
    const r = rodar(s0, [encomendar({ leather_armor: 1, wooden_shield: 1 })], TETO, (c) => c.pecas.length > 0);
    expect(r.pecas.map((p) => p.mercadoria)).toEqual(['wooden_shield']);
    expect(completo(r.estado, CASA).producao?.escolha?.cota).toEqual({ leather_armor: 1, wooden_shield: 0 });
    expect(r.avisos).toEqual([]);
    evidencia['pickOrder'] = { tick: r.pecas[0]?.tick, cota: completo(r.estado, CASA).producao?.escolha?.cota };
  });

  it('cumprida, o aviso sai uma vez, e o prazo depois dele nao faz peca nenhuma', () => {
    const s0 = casaCom({ leather: INSUMO, timber: INSUMO });
    const r = rodar(s0, [encomendar({ leather_armor: 1, wooden_shield: 1 })], TETO, (c) => c.avisos.length > 0);
    expect(r.pecas.map((p) => p.mercadoria).sort()).toEqual(['leather_armor', 'wooden_shield']);
    expect(completo(r.estado, CASA).estoque.entrada).toMatchObject({ leather: INSUMO - 1, timber: INSUMO - 1 });
    const depois = rodar(r.estado, [], JANELA);
    expect(depois.pecas).toEqual([]);
    expect(depois.avisos).toEqual([]);
    expect(violacoesDeInvariantes(depois.estado, DADOS)).toEqual([]);
    expect(violacoesDaFsmDoEspecialista(depois.estado, DADOS)).toEqual([]);
    evidencia['cumprida'] = { pecas: r.pecas, aviso: r.avisos };
  });

  it('a partida do roteiro (tools/shots/F24c.js): a Casa do Gibao parada, com couro e madeira', () => {
    const s = rodar(casaCom({ leather: INSUMO, timber: INSUMO }), [], 10).estado;
    expect(completo(s, CASA).producao?.escolha?.cota).toEqual({ leather_armor: 0, wooden_shield: 0 });
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F24c.save.txt`, salvar(s));
    const aw = completo(s, CASA);
    evidencia['partidaDoRoteiro'] = { tick: s.tick, gx: aw.gx, gy: aw.gy };
  });
});

describe('F24c — todas as oficinas de guerra escolhem a saida', () => {
  /** Requisito de soldado: o que o quartel pede para formar alguem (`units.json`). */
  const DE_GUERRA = new Set<string>(DADOS.unidades.militares.tipos.flatMap((m) => [...m.requisitos]));

  it('no dado real: toda receita com duas saidas ou mais, alguma de guerra, escolhe a saida', () => {
    const oficinas = Object.entries(DADOS.producao.receitas)
      .filter(([, r]) => Object.keys(r.sai).length >= 2 && Object.keys(r.sai).some((m) => DE_GUERRA.has(m)));
    expect(oficinas.map(([id]) => id).sort()).toEqual(['armor_smithy', 'armory_workshop', 'weapon_smithy', 'weapons_workshop']);
    for (const [id, r] of oficinas) expect(r.escolheSaida, id).toBe(true);
  });

  it('a regra do validate:data acusa a oficina de guerra sem escolha', () => {
    const d: Record<string, unknown> = {};
    for (const n of readdirSync('data').filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))) {
      d[n] = JSON.parse(readFileSync(`data/${n}.json`, 'utf8'));
    }
    expect(validarTudo(d).filter((e: string) => e.startsWith('producao/'))).toEqual([]);
    const aw = (d as { production: { predios: Record<string, Record<string, unknown>> } }).production.predios['armory_workshop'] ?? {};
    delete aw['escolheSaida'];
    delete aw['entraPorSaida'];
    const erros: string[] = validarTudo(d);
    expect(erros.some((e) => e.startsWith('producao/oficina-de-guerra-sem-encomenda'))).toBe(true);
    gravarEvidencia('F24c-casa-do-gibao-por-encomenda', evidencia);
  });
});
