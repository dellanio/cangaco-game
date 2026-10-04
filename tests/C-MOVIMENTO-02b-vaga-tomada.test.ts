/**
 * C-MOVIMENTO-02b — a vaga tomada por quem marcha (plano em
 * docs/planos/2026-09-29-C-MOVIMENTO-02b-vaga-tomada-por-quem-marcha.md). Achado pelo roteiro
 * da C-COMBATE-01c: a tropa em fileiras de 7, mandada ao leste, deixava 3 de 18 marchando para
 * sempre, cada um esperando o outro sair da vaga.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { escaramucaComTropaDe, TROPA_DOS_TESTES_DE_FORMACAO } from './helpers/escaramuca-paz';
import { direcaoDe } from '../src/sim/combate';
import { tilesDaFormacao, vagaTomadaPor } from '../src/sim/systems/marcha';
import { gravarEvidencia } from './helpers/evidence';

// a tropa fixa de 18: o mecanismo foi medido com ela (I-COMBATE-ESCARAMUCA-GANHAVEL)
const s0 = escaramucaComTropaDe(TROPA_DOS_TESTES_DE_FORMACAO, gameData.economia.estadoInicial.semente);
const tropa = s0.unidades.ordem.filter((id) => s0.unidades.porId[id]?.lado === LADO_DO_JOGADOR && s0.unidades.porId[id]?.tipo === gameData.escaramuca.tropaDoJogador.tipo);
const parados = (s: GameState): boolean => tropa.every((id) => s.unidades.porId[id]?.fsm === 'ocioso');
const LESTE = 2;
const COLUNAS = 7;
/** o destino da sonda, relativo ao lider (vale na corrida transladada): 4 a leste, 3 ao norte */
const lider0 = s0.unidades.porId[tropa[0] as string] as Unidade;
const DESTINO = { gx: lider0.gx + 4, gy: lider0.gy - 3 };

/** refaz a formacao no lugar (destino no lider, a direcao dele), como o "+" do painel */
function noLugar(s: GameState, colunas: number): Command {
  const lider = s.unidades.porId[tropa[0] as string] as Unidade;
  return { type: 'MoveUnits', unidades: tropa, destino: { gx: lider.gx, gy: lider.gy }, direcao: direcaoDe(lider), colunas };
}

/** o cenario da sonda: 6 colunas, 7 colunas, espera parar, e a marcha ao leste com 7 */
function correr(): { final: GameState; ordem: GameState; ticks: number; trocas: number } {
  let s = step(s0, [noLugar(s0, COLUNAS - 1)], gameData);
  s = step(s, [noLugar(s, COLUNAS)], gameData);
  for (let t = 0; t < 1200 && !parados(s); t += 1) s = step(s, [], gameData);
  const ordem = s;
  s = step(s, [{ type: 'MoveUnits', unidades: tropa, destino: DESTINO, direcao: LESTE, colunas: COLUNAS }], gameData);
  let trocas = 0;
  let t = 0;
  for (; t < 1200 && !parados(s); t += 1) {
    for (const id of tropa) {
      const u = s.unidades.porId[id] as Unidade;
      if (u.fsm === 'marchando' && vagaTomadaPor(s, u, gameData) !== null) trocas += 1;
    }
    s = step(s, [], gameData);
  }
  return { final: s, ordem, ticks: t, trocas };
}

describe('C-MOVIMENTO-02b — a vaga tomada por quem marcha', () => {
  const { final, ordem, ticks, trocas } = correr();

  it('1. os 18 param, e cada um numa vaga da formacao ao leste', () => {
    const vagas = tilesDaFormacao(ordem, DESTINO, tropa.length, LESTE, COLUNAS, gameData).map((t) => `${t.gx},${t.gy}`).sort();
    const onde = tropa.map((id) => { const u = final.unidades.porId[id] as Unidade; return `${u.gx},${u.gy}`; }).sort();
    const presos = tropa.filter((id) => final.unidades.porId[id]?.fsm !== 'ocioso');
    const virados = tropa.filter((id) => final.unidades.porId[id]?.direcao === LESTE).length;
    gravarEvidencia('C-MOVIMENTO-02b-leste', { ticks, trocas, presos, virados, vagas, onde });
    expect(presos).toEqual([]);
    expect(onde).toEqual(vagas);
    expect(new Set(onde).size).toBe(tropa.length);
    expect(virados).toBe(tropa.length);
  });

  it('2. o caso aconteceu: vagaTomadaPor disparou nesta corrida', () => {
    expect(trocas).toBeGreaterThan(0);
  });

  it('3. deterministico: duas corridas dao o mesmo estado', () => {
    expect(JSON.stringify(correr().final)).toBe(JSON.stringify(final));
  });
});
