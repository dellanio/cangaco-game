/**
 * F14 — a posse mora no predio, e quem ocupa o que vem do dado.
 */
import { describe, expect, it } from 'vitest';
import { completarObra, createInitialState, ehTarefaDeTransporte } from '../src/sim/state';
import type { GameState, PredioEmObra } from '../src/sim/state';
import {
  caminhoAtePredioCompleto, criarTarefaDeOcupacao, elegivelParaTarefa, podeReclamar,
  reclamar, reclamarMelhorOcupacao, tarefasDeOcupacaoEmOrdem,
} from '../src/sim/jobs';
import { ocupantesReservados, vagaDeOcupacao } from '../src/sim/reservas';
import { gerarTarefas, sanearTarefas } from '../src/sim/systems/jobs';
import { gameData } from '../src/sim/data';
import {
  ehPredioOcupavel, predioAceita, predioDoOcupante, tiposQueOcupam,
  trabalhadorDoTipo, vagasDoPredio,
} from '../src/sim/ocupacao';
import {
  armazemDoCenario, comPredioCompletoEm, comUnidadeExtra, semLaborers, semOPredio, serfsDoCenario,
} from './helpers/jobs-cenario';

const inicial = createInitialState(1);

describe('F14 — a posse mora no predio', () => {
  it('todo predio completo do cenario inicial nasce sem ocupante', () => {
    const completos = inicial.predios.ordem
      .map((id) => inicial.predios.porId[id])
      .filter((p) => p?.estado === 'completo');
    expect(completos).not.toHaveLength(0);
    expect(completos.every((p) => p?.estado === 'completo' && p.ocupante === null)).toBe(true);
  });

  it('obra que completa nasce vaga: completarObra devolve ocupante null', () => {
    const def = gameData.predios.find((p) => p.id === 'quarry');
    const obra: PredioEmObra = {
      id: 'o1', tipo: 'quarry', gx: 26, gy: 36, estado: 'obra', hp: def?.hp ?? 0,
      obra: { faltam: {}, nivelamento: 0 },
    };
    expect(completarObra(obra).ocupante).toBe(null);
  });
});

describe('F14 — quem ocupa o que vem do dado', () => {
  // Estrutural, nao textual: compara com o proprio dado, nunca com um id de
  // profissao digitado aqui. Mexer em buildings.json move os dois lados juntos.
  it('trabalhadorDoTipo devolve o que buildings.json declara', () => {
    for (const def of gameData.predios) {
      expect(trabalhadorDoTipo(def.id)).toBe(def.trabalhador);
    }
    expect(trabalhadorDoTipo('tipo-que-nao-existe')).toBe(null);
  });

  it('predio sem trabalhador no dado nao e ocupavel e nao tem vaga', () => {
    expect(gameData.predios.filter((p) => p.trabalhador === null)).not.toHaveLength(0);
    const armazem = armazemDoCenario(inicial);
    expect(trabalhadorDoTipo(armazem.tipo)).toBe(null);
    expect(ehPredioOcupavel(armazem)).toBe(false);
    expect(vagasDoPredio(armazem)).toBe(0);
  });

  it('predio ocupavel: 1 vaga vago, 0 ocupado; inexistente nunca e ocupavel', () => {
    const com = comPredioCompletoEm(inicial, 'q1', { tipo: 'quarry', gx: 26, gy: 36 });
    const vago = com.predios.porId.q1;
    expect(ehPredioOcupavel(vago)).toBe(true);
    expect(vagasDoPredio(vago)).toBe(1);

    const ocupado = vago?.estado === 'completo' ? { ...vago, ocupante: 'u9' } : vago;
    expect(vagasDoPredio(ocupado)).toBe(0);
    expect(ehPredioOcupavel(undefined)).toBe(false);
  });

  it('obra nunca e ocupavel, nem do tipo que pede trabalhador', () => {
    const obra: PredioEmObra = {
      id: 'o2', tipo: 'quarry', gx: 26, gy: 36, estado: 'obra', hp: 10,
      obra: { faltam: {}, nivelamento: 0 },
    };
    expect(trabalhadorDoTipo(obra.tipo)).not.toBe(null);
    expect(ehPredioOcupavel(obra)).toBe(false);
    expect(vagasDoPredio(obra)).toBe(0);
  });

  it('predioAceita compara o tipo do civil com o do dado', () => {
    const com = comPredioCompletoEm(inicial, 'q1', { tipo: 'quarry', gx: 26, gy: 36 });
    const quarry = com.predios.porId.q1;
    expect(predioAceita(quarry, trabalhadorDoTipo('quarry') ?? '')).toBe(true);
    expect(predioAceita(quarry, 'serf')).toBe(false);
    expect(predioAceita(quarry, 'laborer')).toBe(false);
  });

  it('predioDoOcupante acha o predio pela posse, e so por ela', () => {
    const com = comPredioCompletoEm(inicial, 'q1', { tipo: 'quarry', gx: 26, gy: 36 });
    expect(predioDoOcupante(com, 'u9')).toBe(null);
    const q = com.predios.porId.q1;
    const posse = q?.estado === 'completo'
      ? { ...com, predios: { ...com.predios, porId: { ...com.predios.porId, q1: { ...q, ocupante: 'u9' } } } }
      : com;
    expect(predioDoOcupante(posse, 'u9')?.id).toBe('q1');
  });

  it('serf e laborer nao ocupam predio nenhum', () => {
    const ocupam = tiposQueOcupam();
    expect(ocupam.has('serf')).toBe(false);
    expect(ocupam.has('laborer')).toBe(false);
    expect(ocupam.has(trabalhadorDoTipo('quarry') ?? '')).toBe(true);
  });
});

const PEDREIRO = trabalhadorDoTipo('quarry') ?? '';

/** Uma quarry completa em (26,36) e um pedreiro parado no spawn, sem laborers
 *  (que so poluiriam o quadro com tarefas de construcao). */
function cenarioDeOcupacao(): GameState {
  const com = comPredioCompletoEm(semLaborers(inicial), 'q1', { tipo: 'quarry', gx: 26, gy: 36 });
  return comUnidadeExtra(com, 'esp1', PEDREIRO, 30, 34);
}

describe('F14 — a tarefa de ocupar no quadro', () => {
  it('nao e tarefa de transporte: nao tem mercadoria nem origem', () => {
    const { state, id } = criarTarefaDeOcupacao(cenarioDeOcupacao(), 'q1');
    const t = state.jobs.tarefas.porId[id];
    expect(t?.tipo).toBe('ocupar');
    expect(t && ehTarefaDeTransporte(t)).toBe(false);
    expect(t && 'origem' in t).toBe(false);
  });

  it('a elegibilidade vem do DESTINO, nao do tipo da tarefa', () => {
    const { state, id } = criarTarefaDeOcupacao(cenarioDeOcupacao(), 'q1');
    const t = state.jobs.tarefas.porId[id];
    if (!t) throw new Error('tarefa criada');
    expect(podeReclamar(state, t, PEDREIRO)).toBe(true);
    expect(podeReclamar(state, t, 'serf')).toBe(false);
    expect(podeReclamar(state, t, 'laborer')).toBe(false);
    // o mapa por tipo de tarefa, sozinho, nunca autoriza uma ocupacao
    expect(elegivelParaTarefa('ocupar', PEDREIRO)).toBe(false);
  });

  it('o claim reserva a unica vaga: o segundo pedreiro e recusado', () => {
    const base = comUnidadeExtra(cenarioDeOcupacao(), 'esp2', PEDREIRO, 31, 34);
    const { state, id } = criarTarefaDeOcupacao(base, 'q1');
    expect(vagaDeOcupacao(state, 'q1')).toBe(1);

    const r = reclamar(state, id, 'esp1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(ocupantesReservados(r.state, 'q1')).toBe(1);
    expect(vagaDeOcupacao(r.state, 'q1')).toBe(0);

    const { state: comSegunda, id: id2 } = criarTarefaDeOcupacao(r.state, 'q1');
    expect(reclamar(comSegunda, id2, 'esp2')).toEqual({ ok: false, motivo: 'destino-sem-vaga' });
  });

  it('serf nao reclama uma vaga de ocupante', () => {
    const { state, id } = criarTarefaDeOcupacao(cenarioDeOcupacao(), 'q1');
    const serf = serfsDoCenario(state)[0] ?? '';
    expect(reclamar(state, id, serf)).toEqual({ ok: false, motivo: 'unidade-invalida' });
  });

  it('sem caminho ate a porta, nao ha claim', () => {
    const base = comUnidadeExtra(cenarioDeOcupacao(), 'ilhado', PEDREIRO, 0, 0);
    const u = base.unidades.porId.ilhado;
    if (!u) throw new Error('fixture');
    const semRota: GameState = {
      ...base,
      unidades: { ...base.unidades, porId: { ...base.unidades.porId, ilhado: { ...u, gx: -1, gy: -1 } } },
    };
    expect(caminhoAtePredioCompleto(semRota, 'q1', 'ilhado')).toBe(null);
    const { state, id } = criarTarefaDeOcupacao(semRota, 'q1');
    expect(reclamar(state, id, 'ilhado')).toEqual({ ok: false, motivo: 'sem-caminho' });
  });

  it('reclamarMelhorOcupacao escolhe pelo caminho mais curto, e desempata pelo numero', () => {
    let e = comPredioCompletoEm(cenarioDeOcupacao(), 'q2', { tipo: 'quarry', gx: 40, gy: 44 });
    e = criarTarefaDeOcupacao(e, 'q2').state; // longe, criada primeiro
    e = criarTarefaDeOcupacao(e, 'q1').state; // perto
    const r = reclamarMelhorOcupacao(e, 'esp1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.jobs.tarefas.porId[r.tarefa]?.destino).toBe('q1');
  });

  it('a ordenacao nao oferece a vaga a quem o predio nao aceita', () => {
    const { state } = criarTarefaDeOcupacao(cenarioDeOcupacao(), 'q1');
    const comLenhador = comUnidadeExtra(state, 'lenha1', 'woodcutter', 30, 34);
    expect(tarefasDeOcupacaoEmOrdem(comLenhador, 'lenha1')).toHaveLength(0);
    expect(tarefasDeOcupacaoEmOrdem(comLenhador, 'esp1')).toHaveLength(1);
  });
});

const ocuparPara = (estado: GameState, destino: string): string[] =>
  estado.jobs.tarefas.ordem.filter((id) => {
    const t = estado.jobs.tarefas.porId[id];
    return t?.tipo === 'ocupar' && t.destino === destino;
  });

const comOcupante = (estado: GameState, id: string, ocupante: string | null): GameState => {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [id]: { ...p, ocupante } } } };
};

describe('F14 — o gerador e o saneamento', () => {
  it('predio completo e vago que pede trabalhador ganha UMA vaga, e so uma', () => {
    const gerado = gerarTarefas(cenarioDeOcupacao());
    expect(ocuparPara(gerado, 'q1')).toHaveLength(1);
    // idempotente: rodar de novo nao duplica
    expect(ocuparPara(gerarTarefas(gerado), 'q1')).toHaveLength(1);
  });

  it('armazem e escola nunca ganham vaga de ocupante', () => {
    const gerado = gerarTarefas(cenarioDeOcupacao());
    const semTrabalhador = gerado.predios.ordem.filter((id) => {
      const p = gerado.predios.porId[id];
      return p !== undefined && trabalhadorDoTipo(p.tipo) === null;
    });
    expect(semTrabalhador.length).toBeGreaterThan(0);
    for (const id of semTrabalhador) expect(ocuparPara(gerado, id)).toHaveLength(0);
  });

  it('predio ja ocupado nao ganha vaga nova', () => {
    const ocupado = comOcupante(cenarioDeOcupacao(), 'q1', 'esp1');
    expect(ocuparPara(gerarTarefas(ocupado), 'q1')).toHaveLength(0);
  });

  it('a vaga aberta some quando o predio deixa de existir', () => {
    const gerado = gerarTarefas(cenarioDeOcupacao());
    const saneado = sanearTarefas(semOPredio(gerado, 'q1')).state;
    expect(ocuparPara(saneado, 'q1')).toHaveLength(0);
  });

  it('a vaga RECLAMADA e liberada quando o predio some', () => {
    const gerado = gerarTarefas(cenarioDeOcupacao());
    const id = ocuparPara(gerado, 'q1')[0] ?? '';
    const r = reclamar(gerado, id, 'esp1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const saneado = sanearTarefas(semOPredio(r.state, 'q1'));
    expect(saneado.state.jobs.tarefas.porId[id]).toBeUndefined();
    expect(saneado.events.some((e) => e.type === 'task-released' && e.motivo === 'destino-sumiu')).toBe(true);
  });

  it('a vaga reclamada e cancelada se o predio ganhou ocupante por outro caminho', () => {
    const gerado = gerarTarefas(cenarioDeOcupacao());
    const id = ocuparPara(gerado, 'q1')[0] ?? '';
    const r = reclamar(gerado, id, 'esp1');
    if (!r.ok) throw new Error('claim');
    const saneado = sanearTarefas(comOcupante(r.state, 'q1', 'outro'));
    expect(saneado.state.jobs.tarefas.porId[id]).toBeUndefined();
    expect(saneado.events.some((e) => e.type === 'task-released' && e.motivo === 'destino-completo')).toBe(true);
  });

  it('a vaga reclamada por quem o predio nao aceita e liberada', () => {
    const gerado = gerarTarefas(cenarioDeOcupacao());
    const id = ocuparPara(gerado, 'q1')[0] ?? '';
    const r = reclamar(gerado, id, 'esp1');
    if (!r.ok) throw new Error('claim');
    const u = r.state.unidades.porId.esp1;
    if (!u) throw new Error('fixture');
    const virouOutroCivil: GameState = {
      ...r.state,
      unidades: { ...r.state.unidades, porId: { ...r.state.unidades.porId, esp1: { ...u, tipo: 'woodcutter' } } },
    };
    const saneado = sanearTarefas(virouOutroCivil);
    expect(saneado.events.some((e) => e.type === 'task-released' && e.motivo === 'unidade-removida')).toBe(true);
  });
});
