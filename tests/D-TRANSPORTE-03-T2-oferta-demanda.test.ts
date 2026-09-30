/**
 * D-TRANSPORTE-03 (logistica do KaM), passo T2: casamento oferta x demanda, multa do armazem e
 * +20 por unidade na entrada. Plano: docs/planos/2026-09-30-D-TRANSPORTE-03-T2-oferta-demanda.md.
 * Aceites do T2 escritos aqui: 2 (o cenario longo, D1 e D2 do operador, 30 000 ticks), 3, 4, 5,
 * 6, 8 e 10 (o 9 e o teste da F-CAL-a). Tudo pelo `step`, na vila da calibracao (lenhador ->
 * serraria); os aceites de 3 a 10 em 8 000 ticks.
 *
 * KaM (clone 731a8a4, `HL` = `KM_HandLogistics.pas`): toda oferta casa com toda demanda; o
 * armazem paga +1000 no lance (`HL:1587-1590`), o destino paga +20 por unidade que ja tem
 * (`HL:1612-1618`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData, loadGameData, rawGameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data';
import { createInitialState, ID_DO_ARMAZEM } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import type { GameState, Predio, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { nosExpandidos, zerarEstatisticasDeBusca } from '../src/sim/pathfinding';
import { validarTudo } from '../tools/data-rules.js';
import { ARQUIVOS } from '../tools/data-schema.js';
import { comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const TORA = 'tree_trunk';
const SERRARIA = 'sawmill';
const LENHADOR = 'woodcutters';
/** Janela do cenario: a primeira tora sai perto do tick 1 200 e ate aqui saem ~17. */
const TICKS = 8000;
/**
 * Aceite 6, o VELHO: viagens de serf com tora por tora entregue na serraria, medido por sonda
 * na arvore a1dbb5c (T1), mesma vila e mesma janela: 32 viagens, 16 entregues (a tora ia ao
 * armazem e voltava). Numero da corrida da sonda, nao dado de jogo.
 */
const VIAGENS_POR_TORA_NO_T1 = 32 / 16;
/**
 * Aceite 10, teto de nos do A* nesta vila e janela. Sonda 2026-09-30: T1 (a1dbb5c) 22 141, T2
 * 22 935. Remedido no merge (2026-09-30, T2 rebaseado sobre o BUG-Y, viagem inutil para comer):
 * 22 470, e o teto leva ~10 % de folga. Eixo deterministico, nao relogio (CLAUDE.md §8).
 */
const TETO_DE_NOS = 24700;

/**
 * Aceite 2 (D1 e D2 do operador), a LINHA DE BASE: a vila da calibracao sem o T2, medida por
 * sonda na arvore 8929ba3 (a `main` com o BUG-Y, antes do merge). Numero da corrida, nao dado
 * de jogo: e o "base" das duas regras, e so muda se a base for remedida.
 * - D2: producao por cadeia (soma de `goods-produced`) >= floor(base x 0,98) em cada janela, e
 *   o deficit (base - T2) em 30 000 nao passa do deficit em 16 000.
 * - D1: parada = ticks com o ocupante em `esperando_insumo` ou `saida_cheia`, somados por tipo,
 *   <= base x 1,05 em cada janela.
 */
const JANELAS_LONGAS = [16_000, 20_000, 30_000] as const;
const BASE_LONGA: Readonly<Record<number, { producao: Readonly<Record<string, number>>; parada: Readonly<Record<string, number>> }>> = {
  16_000: {
    producao: { tree_trunk: 41, stone: 78, timber: 78, corn: 48, flour: 44, loaves: 80 },
    parada: { sawmill: 2929, mill: 725, bakery: 496 },
  },
  20_000: {
    producao: { tree_trunk: 50, stone: 99, timber: 98, corn: 64, flour: 58, loaves: 112 },
    parada: { sawmill: 3862, mill: 1028, bakery: 496 },
  },
  30_000: {
    producao: { tree_trunk: 78, stone: 153, timber: 154, corn: 99, flour: 96, loaves: 190 },
    parada: { sawmill: 5825, mill: 1718, bakery: 987 },
  },
};
/** Guarda de travamento, NAO afirmacao de tempo (CLAUDE.md §8): 30 000 ticks da vila. */
const TIMEOUT_DA_CORRIDA_LONGA = 120_000;

interface Janela { readonly producao: Record<string, number>; readonly parada: Record<string, number> }

/** A vila da calibracao ate a ultima janela, com a producao e a parada acumuladas em cada uma. */
function correrLongo(): Record<number, Janela> {
  let s = createInitialState(gameData.economia.estadoInicial.semente);
  const vila = vilaDaCalibracao(s);
  const producao: Record<string, number> = {};
  const parada: Record<string, number> = {};
  const tiposParados = Object.keys(BASE_LONGA[16_000]?.parada ?? {});
  const janelas: Record<number, Janela> = {};
  const ultima = JANELAS_LONGAS[JANELAS_LONGAS.length - 1] ?? 0;
  for (let t = 0; t < ultima; t += 1) {
    s = step(s, comandosDaVilaNoTick(s, vila, t));
    for (const ev of s.events) {
      if (ev.type === 'goods-produced') producao[ev.mercadoria] = (producao[ev.mercadoria] ?? 0) + ev.quantidade;
    }
    for (const id of s.predios.ordem) {
      const p = s.predios.porId[id];
      if (p?.estado !== 'completo' || !tiposParados.includes(p.tipo) || p.ocupante === null) continue;
      const fsm = s.unidades.porId[p.ocupante]?.fsm;
      if (fsm === 'esperando_insumo' || fsm === 'saida_cheia') parada[p.tipo] = (parada[p.tipo] ?? 0) + 1;
    }
    if ((JANELAS_LONGAS as readonly number[]).includes(s.tick)) janelas[s.tick] = { producao: { ...producao }, parada: { ...parada } };
  }
  return janelas;
}

type Variante = 'real' | 'serraria-cheia' | 'sem-lenhador';

interface Corrida {
  readonly viagensDeTora: number;
  readonly entreguesNaSerraria: number;
  readonly daCasaParaSerraria: number;
  readonly doArmazemParaSerraria: number;
  readonly aoArmazem: number;
  /** Tora entregue ao armazem num tick em que a serraria completa tinha vaga na entrada. */
  readonly aoArmazemComVaga: number;
  readonly nos: number;
  readonly violacoes: readonly string[];
  readonly estado: GameState;
}

const comPredio = (s: GameState, p: Predio): GameState =>
  ({ ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [p.id]: p } } });
const completosDo = (s: GameState, tipo: string): PredioCompleto[] => s.predios.ordem.map((id) => s.predios.porId[id])
  .filter((p): p is PredioCompleto => p?.tipo === tipo && p.estado === 'completo');

function correr(variante: Variante, dados: GameData = gameData, ticks: number = TICKS, invariantes = false): Corrida {
  let s = createInitialState(dados.economia.estadoInicial.semente);
  const vila = vilaDaCalibracao(s, dados);
  if (variante === 'sem-lenhador') {
    // o armazem com tora e nenhum lenhador: a unica oferta e a do armazem. A serraria e
    // desbloqueada pelo lenhador; sem ele, o desbloqueio vem marcado, como o T1 faz
    s = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, LENHADOR])] };
    const arm = completosDo(s, ID_DO_ARMAZEM)[0];
    if (arm === undefined) throw new Error('fixture: sem armazem');
    s = comPredio(s, { ...arm, estoque: { ...arm.estoque, saida: { ...arm.estoque.saida, [TORA]: 10 } } });
  }
  let viagensDeTora = 0;
  let entreguesNaSerraria = 0;
  let daCasaParaSerraria = 0;
  let doArmazemParaSerraria = 0;
  let aoArmazem = 0;
  let aoArmazemComVaga = 0;
  const violacoes: string[] = [];
  zerarEstatisticasDeBusca();
  for (let t = 0; t < ticks; t += 1) {
    let comandos: Command[] = [...comandosDaVilaNoTick(s, vila, t, dados)];
    if (variante === 'sem-lenhador') comandos = comandos.filter((c) => !(c.type === 'PlaceBlueprint' && c.buildingId === LENHADOR));
    if (variante === 'serraria-cheia') {
      // a serraria sem demanda: a entrada reposta cheia a cada tick
      for (const p of completosDo(s, SERRARIA)) {
        s = comPredio(s, { ...p, estoque: { ...p.estoque, entrada: { ...p.estoque.entrada, [TORA]: p.capacidade.entrada ?? 0 } } });
      }
    }
    const antes = s;
    s = step(s, comandos, dados);
    for (const ev of s.events) {
      if (ev.type !== 'task-completed' || ev.mercadoria !== TORA) continue;
      const tarefa = antes.jobs.tarefas.porId[ev.tarefa];
      const origem = tarefa !== undefined && 'origem' in tarefa ? antes.predios.porId[tarefa.origem] : undefined;
      const destino = s.predios.porId[ev.destino];
      viagensDeTora += 1;
      if (destino?.tipo === ID_DO_ARMAZEM) {
        aoArmazem += 1;
        if (completosDo(antes, SERRARIA).some((p) => (p.estoque.entrada[TORA] ?? 0) < (p.capacidade.entrada ?? 0))) aoArmazemComVaga += 1;
      }
      if (destino?.tipo === SERRARIA) {
        entreguesNaSerraria += 1;
        if (origem?.tipo === ID_DO_ARMAZEM) doArmazemParaSerraria += 1;
        else daCasaParaSerraria += 1;
      }
    }
    if (invariantes && t % 100 === 0) violacoes.push(...violacoesDeInvariantes(s, dados).map((v) => `t${t}: ${v}`));
  }
  return {
    viagensDeTora, entreguesNaSerraria, daCasaParaSerraria, doArmazemParaSerraria, aoArmazem, aoArmazemComVaga,
    nos: nosExpandidos(), violacoes, estado: s,
  };
}

const semEstado = (c: Corrida): Omit<Corrida, 'estado'> => { const { estado: _e, ...resto } = c; return resto; };

describe('D-TRANSPORTE-03 T2 — oferta x demanda, multa do armazem, +20 por unidade', () => {
  const real = correr('real', gameData, TICKS, true);
  const cheia = correr('serraria-cheia');
  const semLenhador = correr('sem-lenhador');
  const raw = JSON.parse(JSON.stringify(rawGameData)) as { delivery: { lance: { multaDoArmazem_tiles: number } } };
  raw.delivery.lance.multaDoArmazem_tiles = 0;
  const semMulta = correr('real', loadGameData(raw as typeof rawGameData));

  gravarEvidencia('D-TRANSPORTE-03-T2', {
    ticks: TICKS, real: semEstado(real), serrariaCheia: semEstado(cheia), semLenhador: semEstado(semLenhador),
    semMulta: semEstado(semMulta), viagensPorToraNoT1: VIAGENS_POR_TORA_NO_T1, tetoDeNos: TETO_DE_NOS,
  });

  it('3: a tora vai do lenhador direto a serraria; o armazem nao recebe tora enquanto a serraria tem vaga', () => {
    expect(real.daCasaParaSerraria).toBeGreaterThan(0);
    expect(real.aoArmazemComVaga).toBe(0);
  });

  it('4: serraria cheia (sem demanda), a tora vai ao armazem', () => {
    expect(cheia.aoArmazem).toBeGreaterThan(0);
    expect(cheia.entreguesNaSerraria).toBe(0);
  });

  it('5: sem lenhador e com tora no armazem, a tora sai do armazem para a serraria', () => {
    expect(semLenhador.doArmazemParaSerraria).toBeGreaterThan(0);
    expect(semLenhador.daCasaParaSerraria).toBe(0);
  });

  it('6: viagens de serf por tora entregue na serraria caem contra o T1', () => {
    expect(real.entreguesNaSerraria).toBeGreaterThan(0);
    const novo = real.viagensDeTora / real.entreguesNaSerraria;
    // piso entre os dois: o velho gasta pelo menos 1,5 vez o novo (sonda: 2,00 contra 1,06)
    expect(VIAGENS_POR_TORA_NO_T1 / novo).toBeGreaterThanOrEqual(1.5);
  });

  it('8: a multa vem do dado — a copia com multa 0 muda a escolha; negativa reprova no validate:data', () => {
    // sem a multa, o armazem vence a casa pela distancia e recebe tora com a serraria com vaga
    expect(semMulta.aoArmazemComVaga).toBeGreaterThan(0);
    const errosCom = (campo: string, valor: number): string[] => {
      const dados: Record<string, unknown> = {};
      for (const nome of ARQUIVOS) dados[nome] = JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'));
      const delivery = dados['delivery'] as { lance: Record<string, number> };
      delivery.lance[campo] = valor;
      return validarTudo(dados).filter((e) => e.startsWith('entrega/lance'));
    };
    expect(errosCom('multaDoArmazem_tiles', 1000)).toEqual([]);
    expect(errosCom('multaDoArmazem_tiles', -1).length).toBeGreaterThan(0);
    expect(errosCom('porUnidadeNaEntrada_tiles', -1).length).toBeGreaterThan(0);
  });

  it('2: cenario longo — producao por cadeia >= floor(base x 0,98), deficit que nao cresce, parada <= base x 1,05', () => {
    const t2 = correrLongo();
    gravarEvidencia('D-TRANSPORTE-03-T2-longo', { base: BASE_LONGA, t2 });
    const deficit = (janela: number, cadeia: string): number =>
      (BASE_LONGA[janela]?.producao[cadeia] ?? 0) - (t2[janela]?.producao[cadeia] ?? 0);
    for (const janela of JANELAS_LONGAS) {
      const base = BASE_LONGA[janela];
      const medido = t2[janela];
      expect(medido, `janela ${janela}`).toBeDefined();
      for (const [cadeia, n] of Object.entries(base?.producao ?? {})) {
        expect(medido?.producao[cadeia] ?? 0, `${cadeia} em ${janela}`).toBeGreaterThanOrEqual(Math.floor(n * 0.98));
      }
      for (const [tipo, n] of Object.entries(base?.parada ?? {})) {
        expect(medido?.parada[tipo] ?? 0, `parada ${tipo} em ${janela}`).toBeLessThanOrEqual(n * 1.05);
      }
    }
    for (const cadeia of Object.keys(BASE_LONGA[16_000]?.producao ?? {})) {
      expect(deficit(30_000, cadeia), `deficit de ${cadeia}, 16 000 -> 30 000`).toBeLessThanOrEqual(deficit(16_000, cadeia));
    }
  }, TIMEOUT_DA_CORRIDA_LONGA);

  it('10: invariantes do quadro, determinismo e nos do A* sob o teto medido', () => {
    expect(real.violacoes).toEqual([]);
    const a = correr('real', gameData, 3000);
    const b = correr('real', gameData, 3000);
    expect(JSON.stringify(a.estado)).toBe(JSON.stringify(b.estado));
    expect(real.nos).toBeLessThanOrEqual(TETO_DE_NOS);
  });
});
