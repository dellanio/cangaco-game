/**
 * F09 x F08: a estrada so conta o DISPONIVEL (saida - reservado), nunca a pedra que uma
 * tarefa reclamada reservou na origem. Sem isto, uma estrada comeria a pedra de um serf
 * que ja "reservou" a unidade, e a reserva ficaria sem lastro (o `sanearTarefas` a
 * cancelaria como `origem-sem-recurso`, mas a estrada teria vencido a corrida por acaso
 * da ordem, nao por regra).
 *
 * F18d-1b mudou O QUE a estrada faz com essa pedra: em vez de debitar no comando, ela
 * RESERVA (uma tarefa de assentamento por tile) e debita quando o laborer assenta. A
 * regra deste arquivo sobreviveu inteira — as duas reservas dividem o mesmo disponivel,
 * e nenhuma come a da outra —, e por isso o que os testes medem passou de "quanto caiu
 * da gaveta" para "quanto ficou comprometido".
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
/** Quanto do que este comando pediu ficou comprometido: uma tarefa de assentamento por
 *  tile, cada uma reservando `custoStonePorTile` na `saida` do armazem que a paga. */
const comprometidaNaEstrada = (estado: GameState): number =>
  estado.jobs.tarefas.ordem.filter((id) => estado.jobs.tarefas.porId[id]?.tipo === 'assentar-estrada').length
  * custoPorTile;
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
    expect(comprometidaNaEstrada(depois)).toBe(4);
    expect(estoqueDe(depois, armazem.id, 'saida')).toBe(5); // F18d-1b: so o assentamento debita
    expect(pedraDisponivel(depois)).toBe(1); // 5 - 4 comprometidas
  });

  it('uma estrada que cabe no disponivel passa e NAO deixa reserva sem lastro', () => {
    const estado = comDuasReclamadas(5);
    const depois = step(estado, [{ type: 'PlaceRoad', tiles: rua(3 / custoPorTile) }]);
    expect(rejeicoes(depois)).toEqual([]);
    expect(comprometidaNaEstrada(depois)).toBe(3);
    expect(estoqueDe(depois, armazem.id, 'saida')).toBe(5); // nada saiu: 2 de carga + 3 de estrada
    expect(pedraDisponivel(depois)).toBe(0); // e as 5 estao todas faladas
    expect(reservadoNaOrigem(depois, armazem.id, 'stone')).toBe(2 + 3); // 2 de carga, 3 de estrada
    expect(liberacoes(depois)).toEqual([]); // ninguem foi cancelado por falta de pedra
    // F11b: 'construir' (ate o teto, sem relacao com pedra de estrada) fica fora desta leitura
    const materiais = depois.jobs.tarefas.ordem.filter((id) => depois.jobs.tarefas.porId[id]?.tipo === 'material-para-obra');
    expect(materiais.map((id) => depois.jobs.tarefas.porId[id]?.estado)).toEqual(['reclamada', 'reclamada']);
    expect(violacoesDeInvariantes(depois)).toEqual([]);
  });

  it('F18d-1b: a gaveta ENTRADA nao paga estrada — nao e reservavel, entao nao e disponivel', () => {
    // Ate a F18d-1b o comando debitava, e debitar da `entrada` era possivel. Agora o
    // custo e uma RESERVA, e so a `saida` se reserva: contar a `entrada` no disponivel
    // aceitaria um comando que nenhum armazem consegue pagar, e o tile ficaria
    // desenhado esperando para sempre uma tarefa que nao nasce.
    // (No jogo a `entrada` de um armazem nunca recebe pedra — e fixture de teste.)
    const estado = comPedraNaEntrada(comDuasReclamadas(2), armazem.id, 3);
    expect(pedraDisponivel(estado)).toBe(0); // 2 na saida, as 2 reservadas pelas cargas
    const depois = step(estado, [{ type: 'PlaceRoad', tiles: rua(3 / custoPorTile) }]);
    expect(rejeicoes(depois)).toMatchObject([{ command: 'PlaceRoad', motivo: 'sem-pedra' }]);
    expect(estoqueDe(depois, armazem.id, 'saida')).toBe(2);
    expect(estoqueDe(depois, armazem.id, 'entrada')).toBe(3); // intocada
    expect(violacoesDeInvariantes(depois)).toEqual([]);
  });

  it('um armazem com a saida toda reservada e pulado: quem paga a estrada e o proximo', () => {
    const estado = comArmazemCompleto(comDuasReclamadas(2), 'segundo', { gx: 40, gy: 20, stone: 10 });
    const depois = step(estado, [{ type: 'PlaceRoad', tiles: rua(3 / custoPorTile) }]);
    expect(rejeicoes(depois)).toEqual([]);
    expect(reservadoNaOrigem(depois, armazem.id, 'stone')).toBe(2);  // so as duas cargas
    expect(reservadoNaOrigem(depois, 'segundo', 'stone')).toBe(3);   // o canteiro inteiro
    expect(estoqueDe(depois, armazem.id, 'saida')).toBe(2);
    expect(estoqueDe(depois, 'segundo', 'saida')).toBe(10);
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
