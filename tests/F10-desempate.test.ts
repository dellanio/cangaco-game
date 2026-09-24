/**
 * F10 — o desempate passa a medir o caminho A* a partir da POSICAO DO SERF: a perna livre
 * (unidade -> porta do armazem de origem) + a perna pela estrada (porta -> porta da obra),
 * em ticks. O aceite "nunca euclidiana" da F09 continua valendo: os testes da F09
 * (`cenarioDeVolta`, `t2` x `t10`) seguem intocados em `F09-jobboard.test.ts`; aqui entra o
 * caso novo, o da perna do serf.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState, TarefaSaidaCheiaParaArmazem } from '../src/sim/state';
import { chaveDeTile, tilesDaPorta } from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import { buscarCaminho } from '../src/sim/pathfinding';
import { custoDaTarefa, planoDaTarefa, reclamar, reclamarMelhor, tarefasEmOrdem } from '../src/sim/jobs';
import { cenarioDoMuro, SERF_DO_LADO_DE_A as serfX, SERF_DO_LADO_DE_B as serfY } from './helpers/serf-cenario';
import {
  armazemDoCenario, cenarioLigado, comArmazemCompleto, comEstradas, comObra, comPedraNaSaida, comPredioCompletoEm,
  comTarefas, comUnidadeEm, inicial, linhaH,
  linhaV, tarefaDe, tile,
} from './helpers/jobs-cenario';

/** A obra de destino do cenario do muro, exigida (os testes daqui morrem sem ela). */
const destDoMuro = (estado: GameState) => {
  const dest = estado.predios.porId.dest;
  if (dest === undefined) throw new Error('fixture: o cenario do muro deveria ter a obra dest');
  return dest;
};

describe('F10 — a perna do serf: unidade -> origem por A*, nunca pela reta', () => {
  const estado = cenarioDoMuro();
  const tarefaA = estado.jobs.tarefas.porId.t1;
  const tarefaB = estado.jobs.tarefas.porId.t2;
  if (!tarefaA || tarefaA.tipo !== 'material-para-obra' || !tarefaB || tarefaB.tipo !== 'material-para-obra') {
    throw new Error('fixture: faltam as tarefas de material t1 e t2');
  }

  it('PREMISSAS do cenario: a reta prefere A, o caminho a pe prefere B, e a perna do serf DOMINA a da entrega', () => {
    const euclid = (a: { gx: number; gy: number }, b: { gx: number; gy: number }): number => Math.hypot(a.gx - b.gx, a.gy - b.gy);
    const y = { gx: 20, gy: 20 };
    expect(euclid(y, { gx: 20, gy: 13 })).toBeLessThan(euclid(y, { gx: 20, gy: 33 })); // a armadilha
    const planoA = planoDaTarefa(estado, tarefaA, serfY);
    const planoB = planoDaTarefa(estado, tarefaB, serfY);
    if (!planoA || !planoB) throw new Error('fixture: as duas tarefas deveriam ter plano');
    expect([planoA.ateAOrigem.custo, planoB.ateAOrigem.custo]).toEqual([197, 96]); // a realidade: o muro
    // F18d-1a: a entrega do nivel 3 anda livre, e as duas pernas de entrega deixaram de ser
    // iguais — cada uma corta a grama do seu jeito. A premissa que o cenario precisa nao e
    // a simetria: e a DOMINANCIA. A diferenca das pernas do serf (101 ticks) e maior do que
    // a das pernas de entrega (18), entao ainda e a posicao do serf que decide.
    expect([planoA.deEntrega.custo, planoB.deEntrega.custo]).toEqual([190, 172]);
    expect(planoA.ateAOrigem.custo - planoB.ateAOrigem.custo)
      .toBeGreaterThan(Math.abs(planoA.deEntrega.custo - planoB.deEntrega.custo));
  });

  it('o serf do outro lado do muro (Y) escolhe B; o serf do lado de A (X) escolhe A — o mesmo quadro, ordens diferentes', () => {
    expect(tarefasEmOrdem(estado, serfY).map((t) => t.id)).toEqual(['t2', 't1']);
    expect(tarefasEmOrdem(estado, serfX).map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('sem unidade, so a entrega conta: 172 de t2 contra 178 de t1, e o numero MENOR nao salva t1', () => {
    // Ate a F18d-1a as duas entregas custavam o mesmo (as duas so pisavam em estrada) e o
    // desempate caia no numero. Andando livre elas divergem, e o criterio de cima (custo)
    // resolve antes: t2 vem primeiro apesar do numero maior. O desempate POR NUMERO tem
    // teste proprio, com custo igual de verdade, em F09-jobboard ('t2 antes de t10').
    expect([custoDaTarefa(estado, tarefaA, null), custoDaTarefa(estado, tarefaB, null)]).toEqual([178, 172]);
    expect(tarefasEmOrdem(estado).map((t) => t.id)).toEqual(['t2', 't1']);
  });

  it('reclamarMelhor entrega a cada serf a tarefa do seu caminho curto', () => {
    const y = reclamarMelhor(estado, serfY);
    const x = reclamarMelhor(estado, serfX);
    if (!y.ok || !x.ok) throw new Error('esperava claims');
    expect(y.tarefa).toBe('t2');
    expect(x.tarefa).toBe('t1');
  });

  it('o custo total e a soma das duas pernas, em ticks, e cada perna e o A* de fato', () => {
    const plano = planoDaTarefa(estado, tarefaB, serfY);
    if (!plano) throw new Error('fixture: sem plano');
    expect(plano.custo).toBe(plano.ateAOrigem.custo + plano.deEntrega.custo);
    expect(custoDaTarefa(estado, tarefaB, serfY)).toBe(plano.custo);
    // derivado a mao: o footprint de 'b' (18..20, 30..32) bloqueia a coluna x=20, entao o
    // serf desce pela x=21 — 1 diagonal na grama, 11 retos na grama — e entra na porta (20,33)
    // pela rua da fileira y=33: 2 retos de estrada. (Uma reta de 13 tiles NAO e possivel.)
    const { grama, estrada } = gameData.movimento.ticksPorTile.aPe;
    expect(plano.ateAOrigem.custo).toBe(gameData.movimento.ticksPorTileDiagonal.aPe.grama + 11 * grama + 2 * estrada);
    expect(plano.ateAOrigem.custo).toBeGreaterThan(13 * estrada);
    // F18d-1a: a perna de entrega deixou de ser a conta da rua. Ela e o A* LIVRE da porta em
    // que o serf chegou ate a porta da obra — 172 ticks, contra os 187 que a volta pelo L de
    // estrada custava (36 retos + 1 diagonal, a conta que este teste fazia ate a F18e). A rua
    // segue no caminho onde ajuda; 10 dos 28 tiles sao grama, atalho que a regra velha proibia.
    const { aPe: reto } = gameData.movimento.ticksPorTile;
    const { aPe: diagonal } = gameData.movimento.ticksPorTileDiagonal;
    expect(plano.deEntrega.custo).toBe(172);
    expect(plano.deEntrega.custo).toBeLessThan(36 * reto.estrada + diagonal.estrada);
    expect(buscarCaminho(estado, tile(20, 33), tilesDaPorta(destDoMuro(estado)), 'livre')?.custo)
      .toBe(plano.deEntrega.custo);
    // e a perna livre e mesmo o A* do serf ate a porta:
    expect(buscarCaminho(estado, tile(20, 20), [tile(20, 33)], 'livre')?.custo).toBe(plano.ateAOrigem.custo);
  });

  it('a perna da entrega parte da PORTA em que o serf chegou, acaba na porta da obra, e corta a grama', () => {
    const plano = planoDaTarefa(estado, tarefaB, serfY);
    if (!plano) throw new Error('fixture: sem plano');
    const ultimaDaPernaLivre = plano.ateAOrigem.tiles[plano.ateAOrigem.tiles.length - 1] ?? tile(20, 20);
    expect(ultimaDaPernaLivre).toEqual(tile(20, 33));
    expect(plano.deEntrega.tiles[plano.deEntrega.tiles.length - 1])
      .toEqual(tilesDaPorta(destDoMuro(estado))[0]); // acaba numa porta da obra
    // F18d-1a: 10 dos 28 tiles estao FORA da rua. A regra velha exigia os 28 em estrada.
    const foraDaRua = plano.deEntrega.tiles.filter((t) => estado.estradas[chaveDeTile(t)] !== true);
    expect([foraDaRua.length, plano.deEntrega.tiles.length]).toEqual([10, 28]);
  });
});

describe('F10 — as portas de coleta: so as que estao na rede do DESTINO (nivel 6, que exige rua)', () => {
  // F18d-1a: os dois casos abaixo nasceram quando toda entrega exigia estrada, com uma obra
  // no destino. O nivel 3 (material para obra) passou a andar livre, entao o caso mudou de
  // NIVEL em vez de sumir: quem ainda depende da rua e a coleta de producao (nivel 6,
  // `saida-cheia-para-armazem`, delivery.json). O serf anda livre ate a porta de coleta; e a
  // porta que precisa estar na mesma rede de estradas da porta de entrega.
  const tarefa: TarefaSaidaCheiaParaArmazem = {
    id: 't1', numero: 1, tipo: 'saida-cheia-para-armazem', mercadoria: 'stone',
    origem: 'pedreira', destino: 'arm', estado: 'aberta', reclamadaPor: null,
  };
  /** Pedreira com pedra na saida (porta em (18..20, 12)) e armazem a sudeste (porta em
   *  (30..32, 23)). O serf fica colado na porta a oeste, que e a ilhota. */
  const cenario = (ruas: readonly TileDeGrid[]): GameState => {
    let estado = comPredioCompletoEm(inicial, 'pedreira', { tipo: 'quarry', gx: 18, gy: 10 });
    estado = comPedraNaSaida(estado, 'pedreira', 5);
    estado = comArmazemCompleto(estado, 'arm', { gx: 30, gy: 20, stone: 0 });
    estado = comUnidadeEm(comEstradas(estado, ruas), serfY, 17, 13);
    return comTarefas(estado, [tarefa]);
  };

  it('uma porta que e estrada mas esta numa ilha desligada do armazem nao serve', () => {
    // (18,12) e uma ilhota colada no serf; (20,12) e a porta que liga ao armazem.
    const estado = cenario([tile(18, 12), ...linhaH(20, 31, 12), ...linhaV(31, 12, 23)]);
    const plano = planoDaTarefa(estado, tarefa, serfY);
    expect(plano).not.toBeNull();
    expect(plano?.ateAOrigem.tiles[plano.ateAOrigem.tiles.length - 1]).toEqual(tile(20, 12));
  });

  it('sem nenhuma estrada: coleta de producao nao tem plano (o nivel 3, no mesmo lugar, teria)', () => {
    const estado = cenario([]);
    expect(planoDaTarefa(estado, tarefa, serfY)).toBeNull();
    expect(custoDaTarefa(estado, tarefa, null)).toBeNull();
    // o contraste que da sentido ao caso: a mesma geometria, no nivel 3, anda livre
    const material = tarefaDe({ numero: 2, origem: 'arm', destino: 'obra-x' });
    const comObraNoLugar = comTarefas(comObra(estado, 'obra-x', { gx: 18, gy: 10 + 20, faltam: { stone: 1 } }), [material]);
    expect(planoDaTarefa(comObraNoLugar, material, serfY)).not.toBeNull();
  });
});

describe('F10 — o claim recusa `sem-caminho` quando o serf nao consegue chegar a origem (sem laco reclama/libera)', () => {
  /** O serf em (0,0), com duas obras de pedreira fechando (1,0), (0,1) e (1,1). */
  function serfEncurralado(): GameState {
    let estado = comObra(cenarioLigado({ stone: 2 }), 'cerca1', { gx: 1, gy: 0, faltam: {} });
    estado = comObra(estado, 'cerca2', { gx: 0, gy: 1, faltam: {} });
    estado = comUnidadeEm(estado, serfY, 0, 0);
    return comTarefas(estado, [tarefaDe({ numero: 1, origem: armazemDoCenario(inicial).id, destino: 'obra-a' })]);
  }

  it('um serf preso nao reclama, e o motivo e `sem-caminho`', () => {
    expect(reclamar(serfEncurralado(), 't1', serfY)).toEqual({ ok: false, motivo: 'sem-caminho' });
  });

  it('e outro serf, livre, reclama a mesma tarefa', () => {
    expect(reclamar(serfEncurralado(), 't1', serfX).ok).toBe(true);
  });

  it('reclamarMelhor de um serf preso devolve o motivo, sem reservar nada', () => {
    const r = reclamarMelhor(serfEncurralado(), serfY);
    expect(r).toEqual({ ok: false, motivo: 'sem-caminho' });
  });

  it('uma tarefa SEM plano vai para o fim da fila, mesmo com numero menor (e nao trava a de baixo)', () => {
    // t1 vai para uma obra que nenhuma estrada alcanca; t2 vai para a obra ligada
    const base = comObra(cenarioLigado({ stone: 2 }), 'ilhada', { gx: 50, gy: 50, faltam: { stone: 1 } });
    const estado = comTarefas(base, [
      tarefaDe({ numero: 1, origem: armazemDoCenario(inicial).id, destino: 'ilhada' }),
      tarefaDe({ numero: 2, origem: armazemDoCenario(inicial).id, destino: 'obra-a' }),
    ]);
    expect(tarefasEmOrdem(estado, serfX).map((t) => t.id)).toEqual(['t2', 't1']);
    const r = reclamarMelhor(estado, serfX);
    if (!r.ok) throw new Error(`esperava claim, veio '${r.motivo}'`);
    expect(r.tarefa).toBe('t2');
  });
});
