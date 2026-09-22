/**
 * Montagem de cenarios da escola (F13), so para teste. Complementa
 * `jobs-cenario.ts` — o que e do JobBoard continua vindo de la.
 */
import { step } from '../../src/sim/tick';
import { ID_DA_ESCOLA, ID_DO_ARMAZEM, MERCADORIA_DE_OURO } from '../../src/sim/state';
import type { Command } from '../../src/sim/commands';
import type { GameEvent, GameState, PredioCompleto, Unidade } from '../../src/sim/state';

export function escolaDoCenario(estado: GameState): PredioCompleto {
  const p = estado.predios.ordem
    .map((id) => estado.predios.porId[id])
    .find((x) => x?.tipo === ID_DA_ESCOLA);
  if (!p || p.estado !== 'completo') throw new Error('fixture: cenario sem escola completa');
  return p;
}

export const pedir = (predio: string, unidade: string): Command =>
  ({ type: 'EnqueueTraining', predio, unidade });

export const cancelar = (predio: string, item: string): Command =>
  ({ type: 'CancelTraining', predio, item });

/** Ouro na gaveta `entrada` — onde o serf entrega e de onde a escola cobra. */
export function ouroNaEscola(estado: GameState, id: string): number {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p.estoque.entrada[MERCADORIA_DE_OURO] ?? 0;
}

/** Poe ouro DIRETO na gaveta `entrada` da escola, pulando a viagem do serf. So os
 *  testes do relogio da fila usam isto; o aceite parte do armazem, pelo caminho real. */
export function comOuroNaEscola(estado: GameState, id: string, ouro: number): GameState {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  const novo: PredioCompleto = {
    ...p, estoque: { ...p.estoque, entrada: { ...p.estoque.entrada, [MERCADORIA_DE_OURO]: ouro } },
  };
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [id]: novo } } };
}

/** Troca o ouro da gaveta `saida` do armazem (de onde o serf retira). */
export function comOuroNoArmazem(estado: GameState, id: string, ouro: number): GameState {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  const novo: PredioCompleto = {
    ...p, estoque: { ...p.estoque, saida: { ...p.estoque.saida, [MERCADORIA_DE_OURO]: ouro } },
  };
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [id]: novo } } };
}

/** Todo o ouro do mapa: gavetas de todo predio + carga de toda unidade. Serve para
 *  provar CONSERVACAO (o ouro nao some nem se multiplica num cancelamento). */
export function totalDeOuro(estado: GameState): number {
  let total = 0;
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (!p || p.estado !== 'completo') continue;
    total += (p.estoque.entrada[MERCADORIA_DE_OURO] ?? 0) + (p.estoque.saida[MERCADORIA_DE_OURO] ?? 0);
  }
  for (const id of estado.unidades.ordem) {
    if (estado.unidades.porId[id]?.fsmData.carga === MERCADORIA_DE_OURO) total += 1;
  }
  return total;
}

export function armazemPorTipo(estado: GameState): PredioCompleto {
  const p = estado.predios.ordem
    .map((id) => estado.predios.porId[id])
    .find((x) => x?.tipo === ID_DO_ARMAZEM);
  if (!p || p.estado !== 'completo') throw new Error('fixture: cenario sem armazem completo');
  return p;
}

export const avancar = (estado: GameState, ticks: number): GameState =>
  Array.from({ length: ticks }).reduce<GameState>((e) => step(e, []), estado);

/** Avanca ate `pronto` valer, no maximo `limite` ticks. Devolve o estado do tick em
 *  que ficou pronto (ou o do limite — o teste afirma o que espera). */
export function avancarAte(
  estado: GameState, pronto: (e: GameState) => boolean, limite: number,
): GameState {
  let atual = estado;
  for (let i = 0; i < limite && !pronto(atual); i++) atual = step(atual, []);
  return atual;
}

/** As unidades que existem em `depois` e nao existiam em `antes`, na ordem de criacao. */
export function novasUnidades(antes: GameState, depois: GameState): Unidade[] {
  return depois.unidades.ordem
    .filter((id) => antes.unidades.porId[id] === undefined)
    .map((id) => depois.unidades.porId[id])
    .filter((u): u is Unidade => u !== undefined);
}

export const recusasDeTreino = (estado: GameState): GameEvent[] =>
  estado.events.filter((e) => e.type === 'command-rejected' && e.command === 'EnqueueTraining');
