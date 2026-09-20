/**
 * F09 x F08: o debito de pedra da estrada tira so do DISPONIVEL (saida - reservado),
 * nunca da pedra que uma tarefa reclamada reservou na origem. Sem isto, uma estrada
 * comeria a pedra de um serf que ja "reservou" a unidade, e a reserva ficaria sem
 * lastro (o `sanearTarefas` a cancelaria como `origem-sem-recurso`, mas a estrada
 * teria vencido a corrida por acaso da ordem, nao por regra).
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameEvent, GameState, PredioCompleto } from '../src/sim/state';
import { pedraDisponivel } from '../src/sim/estradas';
import { liberar, reclamar } from '../src/sim/jobs';
import { reservadoNaOrigem } from '../src/sim/reservas';
import { step } from '../src/sim/tick';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import {
  armazemDoCenario, cenarioLigado, comArmazemCompleto, comPedraNaSaida, inicial, linhaH, serfsDoCenario,
} from './helpers/jobs-cenario';

const armazem = armazemDoCenario(inicial);
const [serf1, serf2] = serfsDoCenario(inicial);
const custoPorTile = gameData.terreno.estrada.custoStonePorTile;

/** O cenario ligado (obra pedindo 2 de pedra), as DUAS tarefas reclamadas (2 de pedra
 *  reservadas no armazem) e `saida` de pedra na gaveta do armazem. */
function comDuasReclamadas(saida: number): GameState {
  if (serf1 === undefined || serf2 === undefined) throw new Error('fixture: faltam serfs');
  let estado = step(cenarioLigado({ stone: 2 }), []);
  const [t1, t2] = estado.jobs.tarefas.ordem;
  if (t1 === undefined || t2 === undefined) throw new Error('fixture: deveria haver 2 tarefas');
  for (const [tarefa, serf] of [[t1, serf1], [t2, serf2]] as const) {
    const r = reclamar(estado, tarefa, serf);
    if (!r.ok) throw new Error(`fixture: claim recusado '${r.motivo}'`);
    estado = r.state;
  }
  return comPedraNaSaida(estado, armazem.id, saida);
}

function comPedraNaEntrada(estado: GameState, id: string, pedra: number): GameState {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  const novo: PredioCompleto = { ...p, estoque: { ...p.estoque, entrada: { ...p.estoque.entrada, stone: pedra } } };
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [id]: novo } } };
}

const estoqueDe = (estado: GameState, id: string, gaveta: 'entrada' | 'saida'): number => {
  const p = estado.predios.porId[id];
  return p && p.estado === 'completo' ? p.estoque[gaveta].stone ?? 0 : Number.NaN;
};

const rua = (tiles: number) => linhaH(0, tiles - 1, 45);
const rejeicoes = (estado: GameState): Extract<GameEvent, { type: 'command-rejected' }>[] =>
  estado.events.filter((e): e is Extract<GameEvent, { type: 'command-rejected' }> => e.type === 'command-rejected');
const liberacoes = (estado: GameState): GameEvent[] => estado.events.filter((e) => e.type === 'task-released');

describe('F09 — a estrada so tira pedra do disponivel (nao da reservada)', () => {
  it('ponto de partida: 5 na saida, 2 reservadas -> 3 disponiveis', () => {
    const estado = comDuasReclamadas(5);
    expect(reservadoNaOrigem(estado, armazem.id, 'stone')).toBe(2);
    expect(pedraDisponivel(estado)).toBe(3);
  });

  it('uma estrada que so cabe CONTANDO a pedra reservada e recusada com sem-pedra', () => {
    const estado = comDuasReclamadas(5);
    const depois = step(estado, [{ type: 'PlaceRoad', tiles: rua(4 / custoPorTile) }]);
    expect(rejeicoes(depois)).toMatchObject([{ command: 'PlaceRoad', motivo: 'sem-pedra' }]);
    expect(depois.estradas).toEqual(estado.estradas);
    expect(estoqueDe(depois, armazem.id, 'saida')).toBe(5);
  });

  it('a mesma estrada e aceita quando nada esta reservado (a reserva e o que muda o resultado)', () => {
    const semReserva = comPedraNaSaida(cenarioLigado({ stone: 2 }), armazem.id, 5);
    const depois = step(semReserva, [{ type: 'PlaceRoad', tiles: rua(4 / custoPorTile) }]);
    expect(rejeicoes(depois)).toEqual([]);
    expect(estoqueDe(depois, armazem.id, 'saida')).toBe(1);
  });

  it('uma estrada que cabe no disponivel passa e NAO deixa reserva sem lastro', () => {
    const estado = comDuasReclamadas(5);
    const depois = step(estado, [{ type: 'PlaceRoad', tiles: rua(3 / custoPorTile) }]);
    expect(rejeicoes(depois)).toEqual([]);
    expect(estoqueDe(depois, armazem.id, 'saida')).toBe(2); // exatamente a pedra reservada
    expect(reservadoNaOrigem(depois, armazem.id, 'stone')).toBe(2);
    expect(liberacoes(depois)).toEqual([]); // ninguem foi cancelado por falta de pedra
    expect(depois.jobs.tarefas.ordem.map((id) => depois.jobs.tarefas.porId[id]?.estado)).toEqual(['reclamada', 'reclamada']);
    expect(violacoesDeInvariantes(depois)).toEqual([]);
  });

  it('esgotado o disponivel da saida, o debito vai para a ENTRADA (que nao e reservavel)', () => {
    const estado = comPedraNaEntrada(comDuasReclamadas(2), armazem.id, 3);
    expect(pedraDisponivel(estado)).toBe(3);
    const depois = step(estado, [{ type: 'PlaceRoad', tiles: rua(3 / custoPorTile) }]);
    expect(rejeicoes(depois)).toEqual([]);
    expect(estoqueDe(depois, armazem.id, 'saida')).toBe(2); // a reservada, intacta
    expect(estoqueDe(depois, armazem.id, 'entrada')).toBe(0);
    expect(violacoesDeInvariantes(depois)).toEqual([]);
  });

  it('um armazem com a saida toda reservada e pulado: o debito sai do proximo', () => {
    const estado = comArmazemCompleto(comDuasReclamadas(2), 'segundo', { gx: 40, gy: 20, stone: 10 });
    const depois = step(estado, [{ type: 'PlaceRoad', tiles: rua(3 / custoPorTile) }]);
    expect(rejeicoes(depois)).toEqual([]);
    expect(estoqueDe(depois, armazem.id, 'saida')).toBe(2);
    expect(estoqueDe(depois, 'segundo', 'saida')).toBe(7);
    expect(violacoesDeInvariantes(depois)).toEqual([]);
  });

  it('soltar a reserva devolve a pedra ao disponivel', () => {
    const estado = comDuasReclamadas(5);
    const [t1, t2] = estado.jobs.tarefas.ordem;
    if (t1 === undefined || t2 === undefined) throw new Error('fixture');
    const solto = liberar(liberar(estado, t1, 'pedido-da-unidade').state, t2, 'pedido-da-unidade').state;
    expect(pedraDisponivel(solto)).toBe(5);
  });
});
