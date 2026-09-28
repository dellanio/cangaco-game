/**
 * LOTE3-b1 — o Canavial em FASES, como o KaM (`docs/planos/LOTE3-fases-de-colheita.md`):
 * o canavieiro fica `colheita.ticksNoTile` no tile e o resto do ciclo DENTRO da casa
 * (a prensa), com a tarefa do tile na mao ate o deposito, como a mina `aDistancia`.
 *
 * O b1 ALINHA o modelo com a referencia e NAO melhora a razao 12 : 1 do Canavial
 * (BUILD_PLAN, LOTE3): o total do ciclo e o de antes, e o gargalo e o tempo total do
 * canavieiro. Por isso o que se afirma aqui e a VAZAO IGUAL ao modelo de antes, e a
 * razao vai so como numero da corrida (`test-output/LOTE3-fases.json`).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData, ReceitaDePredio } from '../src/sim/data/types';
import type { Command } from '../src/sim/commands';
import type { GameState } from '../src/sim/state';
import { ehTarefaDeColheita } from '../src/sim/state';
import { receitaDoTipo } from '../src/sim/producao';
import { step } from '../src/sim/tick';
import { gravarEvidencia } from './helpers/evidence';
import { cenarioDeCanavial, comEspacoNaSaida } from './helpers/producao-cenario';

const RECEITA = receitaDoTipo('wineyard', gameData);
if (RECEITA === null || RECEITA.colheita === null) {
  throw new Error('fixture: `wineyard` precisa de receita com colheita em data/production.json');
}
const RECEITA_OK: ReceitaDePredio = RECEITA;
const NO_TILE = RECEITA.colheita.ticksNoTile;
const CICLO = RECEITA.ticksDoCiclo;
const JANELA = 12000;

const colheitasDe = (s: GameState): string[] => s.jobs.tarefas.ordem.filter((id) => {
  const t = s.jobs.tarefas.porId[id];
  return t !== undefined && ehTarefaDeColheita(t) && t.destino === 'c1';
});

const progressoDe = (s: GameState): number | null => {
  const p = s.predios.porId.c1;
  return p?.estado === 'completo' ? p.producao?.progresso ?? null : null;
};

const produziu = (s: GameState): boolean =>
  s.events.some((e) => e.type === 'goods-produced' && e.predio === 'c1');

/** O modelo de ANTES: o ciclo inteiro no tile. So o dado muda; o codigo e o mesmo. */
function modeloDeAntes(dados: GameData): GameData {
  const colheita = RECEITA_OK.colheita;
  if (colheita === null) throw new Error('fixture');
  const receita: ReceitaDePredio = { ...RECEITA_OK, colheita: { ...colheita, ticksNoTile: CICLO } };
  return {
    ...dados,
    producao: { ...dados.producao, receitas: { ...dados.producao.receitas, wineyard: receita } },
  };
}

/** Anda ate o canavieiro ENTRAR na casa com a tarefa na mao: o primeiro `trabalhando`
 *  depois de um `voltando` que segurava uma colheita. */
function ateAFaseDaCasa(): GameState {
  let s = cenarioDeCanavial(gameData, 12);
  let voltandoComTarefa = false;
  for (let i = 0; i < 8000; i += 1) {
    s = comEspacoNaSaida(step(s, [], gameData), 'c1');
    const fsm = s.unidades.porId.canavieiro?.fsm;
    if (fsm === 'voltando' && colheitasDe(s).length > 0) voltandoComTarefa = true;
    if (voltandoComTarefa && fsm === 'trabalhando') return s;
  }
  throw new Error('fixture: o canavieiro nunca entrou na casa com a tarefa');
}

function produzido(inicial: GameState, dados: GameData): number {
  let s = inicial;
  let total = 0;
  for (let i = 0; i < JANELA; i += 1) {
    s = comEspacoNaSaida(step(s, [], dados), 'c1');
    for (const e of s.events) {
      if (e.type === 'goods-produced' && e.predio === 'c1') total += e.quantidade;
    }
  }
  return total;
}

describe('LOTE3-b1 — o canavieiro colhe no tile e trabalha na casa', () => {
  it('o dado declara as fases: ciclo = tile + casa + descanso, uma cachaca por viagem', () => {
    expect(NO_TILE).toBeGreaterThan(0);
    expect(NO_TILE).toBeLessThan(CICLO);
    expect(RECEITA.sai).toEqual({ wine: 1 });
  });

  it('um ciclo: ticksNoTile em `colhendo`, o resto em `trabalhando`, deposito no fim', () => {
    let s = cenarioDeCanavial(gameData, 12);
    let colhendo = 0;
    let dentro = 0;
    let voltou = false;
    for (let i = 0; i < 8000; i += 1) {
      s = comEspacoNaSaida(step(s, [], gameData), 'c1');
      const fsm = s.unidades.porId.canavieiro?.fsm;
      if (fsm === 'colhendo') colhendo += 1;
      if (fsm === 'voltando' && colheitasDe(s).length > 0) voltou = true;
      if (voltou && fsm === 'trabalhando') dentro += 1;
      if (produziu(s)) break;
    }
    expect(produziu(s), 'o ciclo terminou em cachaca').toBe(true);
    expect(colhendo).toBe(NO_TILE);
    // o tick da CHEGADA e gasto entrando (o relogio anda a partir do seguinte), e o
    // do deposito conta como dentro: 1 tick a mais por ciclo que o modelo de antes,
    // em que a chegada ja era o deposito
    expect(dentro).toBe(CICLO - NO_TILE + 1);
  }, 60000);

  it('dentro da casa ele segura a MESMA tarefa e nao consome tile ate o deposito', () => {
    let s = ateAFaseDaCasa();
    const tarefas = colheitasDe(s);
    const recursos = JSON.stringify(s.recursos);
    expect(tarefas).toHaveLength(1);
    while (!produziu(s)) {
      expect(colheitasDe(s)).toEqual(tarefas);
      expect(JSON.stringify(s.recursos)).toBe(recursos);
      s = comEspacoNaSaida(step(s, [], gameData), 'c1');
    }
    expect(JSON.stringify(s.recursos)).not.toBe(recursos);
  }, 60000);

  it('pausado na casa: o relogio congela e, despausado, ele termina consumindo UM tile', () => {
    let s = ateAFaseDaCasa();
    const cana = (e: GameState): number => Object.values(e.recursos)
      .reduce((soma, r) => soma + (r.tipo === RECEITA_OK.colheita?.recurso ? r.quantidade : 0), 0);
    const canaAntes = cana(s);
    const pausar: Command = { type: 'SetBuildingPaused', predio: 'c1', pausado: true };
    s = step(s, [pausar], gameData);
    const congelado = progressoDe(s);
    for (let i = 0; i < 50; i += 1) s = comEspacoNaSaida(step(s, [], gameData), 'c1');
    expect(progressoDe(s)).toBe(congelado);
    expect(s.unidades.porId.canavieiro?.fsm).toBe('trabalhando');
    // a F16c cancela a colheita do predio pausado (`motivoDoDestino`), com ele no
    // campo ou na casa: o tile nao fica reservado por quem nao trabalha
    expect(colheitasDe(s)).toEqual([]);
    const despausar: Command = { type: 'SetBuildingPaused', predio: 'c1', pausado: false };
    s = step(s, [despausar], gameData);
    let depositou = false;
    for (let i = 0; i < CICLO && !depositou; i += 1) {
      s = comEspacoNaSaida(step(s, [], gameData), 'c1');
      depositou = produziu(s);
      expect(colheitasDe(s).length).toBeLessThanOrEqual(1);
      expect(s.unidades.porId.canavieiro?.fsm).not.toBe('indo_colher');
    }
    expect(depositou).toBe(true);
    // o relogio nao zerou: ele termina o ciclo da casa, reclamando um tile para o
    // deposito, e o mapa perde exatamente o que virou cachaca
    expect(canaAntes - cana(s)).toBe(RECEITA_OK.sai.wine);
  }, 60000);

  it('demolido com ele na casa: a colheita sai do quadro', () => {
    let s = ateAFaseDaCasa();
    expect(colheitasDe(s)).toHaveLength(1);
    const demolir: Command = { type: 'DemolishBuilding', predio: 'c1' };
    s = step(s, [demolir], gameData);
    s = step(s, [], gameData);
    expect(colheitasDe(s)).toEqual([]);
  }, 60000);

  it('saida cheia no fim da casa: o ciclo fica pronto e espera, sem voltar ao tile', () => {
    let s = ateAFaseDaCasa();
    const cheia = { wine: gameData.producao.estoqueInternoPorPredio.saida };
    const c1 = s.predios.porId.c1;
    if (c1?.estado !== 'completo') throw new Error('fixture');
    s = { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, c1: { ...c1, estoque: { ...c1.estoque, saida: cheia } } } } };
    for (let i = 0; i < CICLO; i += 1) {
      s = step(s, [], gameData);
      expect(s.unidades.porId.canavieiro?.fsm).not.toBe('indo_colher');
    }
    expect(s.unidades.porId.canavieiro?.fsm).toBe('saida_cheia');
    expect(progressoDe(s)).toBe(CICLO);
    expect(colheitasDe(s)).toHaveLength(1);
  }, 60000);

  it(`a vazao em ${JANELA} ticks e a do modelo de antes (+-1), e a razao 12:1 vai para a evidencia`, () => {
    const antes = modeloDeAntes(gameData);
    const agora12 = produzido(cenarioDeCanavial(gameData, 12), gameData);
    const antes12 = produzido(cenarioDeCanavial(antes, 12), antes);
    const agora1 = produzido(cenarioDeCanavial(gameData, 1), gameData);
    const antes1 = produzido(cenarioDeCanavial(antes, 1), antes);
    expect(Math.abs(agora12 - antes12)).toBeLessThanOrEqual(1);
    expect(Math.abs(agora1 - antes1)).toBeLessThanOrEqual(1);
    gravarEvidencia('LOTE3-fases', {
      _doc: 'LOTE3-b1 — Canavial em fases. A razao 12:1 NAO e aceite: o b1 alinha o modelo e nao move a razao (BUILD_PLAN, LOTE3).',
      janela: JANELA,
      ticksNoTile: NO_TILE,
      ticksDoCiclo: CICLO,
      agora: { umTile: agora1, dozeTiles: agora12, razao: agora1 === 0 ? null : agora12 / agora1 },
      modeloDeAntes: { umTile: antes1, dozeTiles: antes12, razao: antes1 === 0 ? null : antes12 / antes1 },
    });
  }, 600000);
});
