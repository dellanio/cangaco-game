/**
 * C-IA-03b (cenario de escaramuca: peacetime e tropas) — o que o teste da regra e o da partida
 * inteira (`*.longo.test.ts`, suite longa) dividem. Movido de `tests/C-IA-03b-peacetime-e-tropas.test.ts`
 * sem mudar nada, quando a partida inteira foi para a suite longa (decisao do operador, 2026-10-01).
 */
import { gameData } from '../../src/sim/data';
import { ID_DA_ESCOLA, ID_DO_ARMAZEM, ID_DO_QUARTEL, LADO_DA_IA, LADO_DO_JOGADOR } from '../../src/sim/state';
import type { GameEvent, GameState } from '../../src/sim/state';
import { step } from '../../src/sim/tick';
import { emPaz } from '../../src/sim/paz';
import { classeDaUnidade } from '../../src/sim/condicao';
import { criarEscaramuca } from '../../src/sim/cenario';

export const SEMENTE = gameData.economia.estadoInicial.semente;
export const PAZ = gameData.escaramuca.ticksDePaz;
export const doLado = (s: GameState, lado: number): string[] => s.unidades.ordem.filter((id) => s.unidades.porId[id]?.lado === lado);
export const prediosDaIA = (s: GameState): string[] => s.predios.ordem.filter((id) => s.predios.porId[id]?.lado === LADO_DA_IA);
/** C-IA-02a — a vila da IA tem producao: a F34 so pede os tres que seguram o lado */
const QUE_SEGURAM = [ID_DO_ARMAZEM, ID_DA_ESCOLA, ID_DO_QUARTEL] as readonly string[];
export const osTresDaIA = (s: GameState): string[] => prediosDaIA(s).filter((id) => QUE_SEGURAM.includes(s.predios.porId[id]?.tipo ?? ''));
/** C-IA-02a — a tropa da IA, sem os civis da vila dela */
export const militaresDaIA = (s: GameState): string[] => doLado(s, LADO_DA_IA).filter((id) => classeDaUnidade(s.unidades.porId[id]?.tipo ?? '', gameData) === 'militar');
export const tropaDoJogador = (s: GameState): string[] =>
  doLado(s, LADO_DO_JOGADOR).filter((id) => s.unidades.porId[id]?.tipo === gameData.escaramuca.tropaDoJogador.tipo);

/** Avanca ate o fim da paz, de uma vez (sem comandos). */
export function ateOFimDaPaz(s0: GameState): { s: GameState; eventos: GameEvent[] } {
  let s = s0;
  const eventos: GameEvent[] = [];
  while (emPaz(s)) {
    s = step(s, [], gameData);
    eventos.push(...s.events);
  }
  return { s, eventos };
}

/**
 * I-COMBATE-ESCARAMUCA-GANHAVEL — a escaramuca com a tropa do jogador de `n` cabras. A tropa do
 * cenario (`escaramuca.tropaDoJogador.quantidade`) e dado do cenario e muda quando ele muda
 * (subiu de 18 para 24 para a escaramuca de teste ser ganhavel com a nevoa). Os testes de
 * MECANISMO da tropa (formacao, caixa, vaga tomada) foram medidos com 18 e afirmam casos que
 * dependem dessa forma (duas fileiras de 9): eles fixam a tropa aqui, e nao no dado do cenario.
 */
export const TROPA_DOS_TESTES_DE_FORMACAO = 18;
export function escaramucaComTropaDe(n: number, semente: number = SEMENTE): GameState {
  const tj = { ...gameData.escaramuca.tropaDoJogador, quantidade: n };
  return criarEscaramuca(semente, { ...gameData, escaramuca: { ...gameData.escaramuca, tropaDoJogador: tj } });
}
