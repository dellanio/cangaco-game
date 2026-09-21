/**
 * F10 — o desempate passa a medir o caminho A* a partir da POSICAO DO SERF: a perna livre
 * (unidade -> porta do armazem de origem) + a perna pela estrada (porta -> porta da obra),
 * em ticks. O aceite "nunca euclidiana" da F09 continua valendo: os testes da F09
 * (`cenarioDeVolta`, `t2` x `t10`) seguem intocados em `F09-jobboard.test.ts`; aqui entra o
 * caso novo, o da perna do serf.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import { chaveDeTile } from '../src/sim/estradas';
import { buscarCaminho } from '../src/sim/pathfinding';
import { custoDaTarefa, planoDaTarefa, reclamar, reclamarMelhor, tarefasEmOrdem } from '../src/sim/jobs';
import { cenarioDoMuro, SERF_DO_LADO_DE_A as serfX, SERF_DO_LADO_DE_B as serfY } from './helpers/serf-cenario';
import {
  armazemDoCenario, cenarioLigado, comArmazemCompleto, comEstradas, comObra, comTarefas, comUnidadeEm, inicial, linhaH,
  linhaV, tarefaDe, tile,
} from './helpers/jobs-cenario';

describe('F10 — a perna do serf: unidade -> origem por A*, nunca pela reta', () => {
  const estado = cenarioDoMuro();
  const tarefaA = estado.jobs.tarefas.porId.t1;
  const tarefaB = estado.jobs.tarefas.porId.t2;
  if (!tarefaA || !tarefaB) throw new Error('fixture: faltam as tarefas t1 e t2');

  it('PREMISSAS do cenario: a reta prefere A, o caminho a pe prefere B, e a entrega e igual', () => {
    const euclid = (a: { gx: number; gy: number }, b: { gx: number; gy: number }): number => Math.hypot(a.gx - b.gx, a.gy - b.gy);
    const y = { gx: 20, gy: 20 };
    expect(euclid(y, { gx: 20, gy: 13 })).toBeLessThan(euclid(y, { gx: 20, gy: 33 })); // a armadilha
    const planoA = planoDaTarefa(estado, tarefaA, serfY);
    const planoB = planoDaTarefa(estado, tarefaB, serfY);
    if (!planoA || !planoB) throw new Error('fixture: as duas tarefas deveriam ter plano');
    expect(planoA.ateAOrigem.custo).toBeGreaterThan(planoB.ateAOrigem.custo); // a realidade: o muro
    expect(planoA.deEntrega.custo).toBe(planoB.deEntrega.custo); // simetria: so a perna do serf desempata
  });

  it('o serf do outro lado do muro (Y) escolhe B; o serf do lado de A (X) escolhe A — o mesmo quadro, ordens diferentes', () => {
    expect(tarefasEmOrdem(estado, serfY).map((t) => t.id)).toEqual(['t2', 't1']);
    expect(tarefasEmOrdem(estado, serfX).map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('sem unidade, so a entrega conta: as duas empatam e o NUMERO decide (t1 primeiro)', () => {
    expect(tarefasEmOrdem(estado).map((t) => t.id)).toEqual(['t1', 't2']);
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
    expect(plano.deEntrega.custo).toBe(38 * gameData.movimento.ticksPorTile.aPe.estrada);
    // e a perna livre e mesmo o A* do serf ate a porta:
    expect(buscarCaminho(estado, tile(20, 20), [tile(20, 33)], 'livre')?.custo).toBe(plano.ateAOrigem.custo);
  });

  it('a perna da entrega parte da PORTA em que o serf chegou, e so pisa em estrada', () => {
    const plano = planoDaTarefa(estado, tarefaB, serfY);
    if (!plano) throw new Error('fixture: sem plano');
    for (const t of plano.deEntrega.tiles) expect(estado.estradas[chaveDeTile(t)]).toBe(true);
    const ultimaDaPernaLivre = plano.ateAOrigem.tiles[plano.ateAOrigem.tiles.length - 1] ?? tile(20, 20);
    expect(ultimaDaPernaLivre).toEqual(tile(20, 33));
  });
});

describe('F10 — as portas de coleta: so as que estao na rede da obra', () => {
  it('uma porta que e estrada mas esta numa ilha desligada da obra nao serve', () => {
    let estado = comArmazemCompleto(inicial, 'a', { gx: 18, gy: 10, stone: 5 });
    estado = comObra(estado, 'dest', { gx: 30, gy: 20, faltam: { stone: 1 } });
    // porta de 'a' = (18..20, 13). (18,13) e uma ilhota; (20,13) liga a obra (porta em (30..32, 22)).
    estado = comEstradas(estado, [tile(18, 13), ...linhaH(20, 31, 13), ...linhaV(31, 13, 22)]);
    estado = comUnidadeEm(estado, serfY, 17, 13); // colado na ilhota
    const tarefa = tarefaDe({ numero: 1, origem: 'a', destino: 'dest' });
    const plano = planoDaTarefa(comTarefas(estado, [tarefa]), tarefa, serfY);
    expect(plano).not.toBeNull();
    const chegada = plano?.ateAOrigem.tiles[plano.ateAOrigem.tiles.length - 1];
    expect(chegada).toEqual(tile(20, 13)); // nao a ilhota (18,13), que esta mais perto do serf
  });

  it('sem nenhuma porta ligada a obra: nao ha plano', () => {
    let estado = comArmazemCompleto(inicial, 'a', { gx: 18, gy: 10, stone: 5 });
    estado = comObra(estado, 'dest', { gx: 30, gy: 20, faltam: { stone: 1 } });
    const tarefa = tarefaDe({ numero: 1, origem: 'a', destino: 'dest' });
    expect(planoDaTarefa(comTarefas(estado, [tarefa]), tarefa, serfY)).toBeNull();
    expect(custoDaTarefa(comTarefas(estado, [tarefa]), tarefa, null)).toBeNull();
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
