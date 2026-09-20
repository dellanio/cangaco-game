import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { GameEvent, GameState, PredioCompleto, Tarefa } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { createRng, nextInt } from '../src/sim/rng';
import { step } from '../src/sim/tick';
import { tilesDaPorta, tilesOrdenados } from '../src/sim/estradas';
import { custoDoPredio } from '../src/sim/systems/build';
import { liberar, reclamar, reclamarMelhor } from '../src/sim/jobs';
import type { MotivoDeLiberacao } from '../src/sim/jobs';
import { reservadoNaOrigem, reservadoNoDestino } from '../src/sim/reservas';
import { compararComESemSave } from './helpers/determinism';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import {
  armazemDoCenario, cenarioLigado, comArmazemCompleto, comEstoqueNaSaida, comEstradas, comObra,
  comPedraNaSaida, comTarefas, inicial, linhaH, linhaV, semAUnidade, semOPredio, serfsDoCenario, tarefaDe, tile,
} from './helpers/jobs-cenario';

const armazem = armazemDoCenario(inicial);
const serfsIniciais = serfsDoCenario(inicial);
const serfNo = (i: number): string => {
  const id = serfsIniciais[i];
  if (id === undefined) throw new Error(`fixture: o cenario deveria ter 4 serfs (faltou o ${i})`);
  return id;
};
const serf1 = serfNo(0);
const serf2 = serfNo(1);

const tarefasDe = (estado: GameState): Tarefa[] =>
  estado.jobs.tarefas.ordem.map((id) => estado.jobs.tarefas.porId[id]).filter((t): t is Tarefa => t !== undefined);

const liberacoes = (estado: GameState): Extract<GameEvent, { type: 'task-released' }>[] =>
  estado.events.filter((e): e is Extract<GameEvent, { type: 'task-released' }> => e.type === 'task-released');

/** Uma tarefa de pedra, criada pelo gerador no primeiro tick e reclamada pelo serf1. */
function comUmaTarefaReclamada(): { estado: GameState; tarefa: string } {
  const gerado = step(cenarioLigado({ stone: 1 }), []);
  const tarefa = gerado.jobs.tarefas.ordem[0];
  if (tarefa === undefined) throw new Error('fixture: o gerador deveria ter criado uma tarefa');
  const r = reclamar(gerado, tarefa, serf1);
  if (!r.ok) throw new Error(`fixture: claim recusado '${r.motivo}'`);
  return { estado: r.state, tarefa };
}

function afirmarAsDuasReservasDeVolta(depois: GameState, motivo: string): void {
  expect(reservadoNaOrigem(depois, armazem.id, 'stone'), `${motivo}: reserva na ORIGEM`).toBe(0);
  expect(reservadoNoDestino(depois, 'obra-a', 'stone'), `${motivo}: reserva no DESTINO`).toBe(0);
  expect(violacoesDeInvariantes(depois), `${motivo}: invariantes`).toEqual([]);
}

describe('F09 — release em TODO ramo de falha: um teste por ramo, as duas reservas de volta', () => {
  it('ponto de partida: a tarefa reclamada reserva as duas pontas', () => {
    const { estado } = comUmaTarefaReclamada();
    expect(reservadoNaOrigem(estado, armazem.id, 'stone')).toBe(1);
    expect(reservadoNoDestino(estado, 'obra-a', 'stone')).toBe(1);
  });

  it('1. unidade removida -> REABRE a mesma tarefa', () => {
    const { estado, tarefa } = comUmaTarefaReclamada();
    const antes = estado.jobs.tarefas.porId[tarefa];
    const depois = step(semAUnidade(estado, serf1), []);
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa, motivo: 'unidade-removida', resultado: 'reaberta' }]);
    expect(depois.jobs.tarefas.porId[tarefa]).toEqual({ ...antes, estado: 'aberta', reclamadaPor: null });
    afirmarAsDuasReservasDeVolta(depois, 'unidade-removida');
  });

  it('2. caminho cortado (estrada demolida entre as portas) -> CANCELA', () => {
    const { estado, tarefa } = comUmaTarefaReclamada();
    const demolir: Command = { type: 'DemolishRoad', tiles: [tile(29, 35)] };
    const depois = step(estado, [demolir]);
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa, motivo: 'caminho-cortado', resultado: 'cancelada' }]);
    expect(depois.jobs.tarefas.porId[tarefa]).toBeUndefined();
    expect(tarefasDe(depois)).toEqual([]); // sem caminho, o gerador nao recria
    afirmarAsDuasReservasDeVolta(depois, 'caminho-cortado');
  });

  it('3. origem sumiu (armazem removido) -> CANCELA', () => {
    const { estado, tarefa } = comUmaTarefaReclamada();
    const depois = step(semOPredio(estado, armazem.id), []);
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa, motivo: 'origem-sumiu', resultado: 'cancelada' }]);
    expect(depois.jobs.tarefas.porId[tarefa]).toBeUndefined();
    afirmarAsDuasReservasDeVolta(depois, 'origem-sumiu');
  });

  it('4. origem sem recurso (estoque abaixo do reservado) -> CANCELA', () => {
    const { estado, tarefa } = comUmaTarefaReclamada();
    const depois = step(comPedraNaSaida(estado, armazem.id, 0), []);
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa, motivo: 'origem-sem-recurso', resultado: 'cancelada' }]);
    expect(depois.jobs.tarefas.porId[tarefa]).toBeUndefined();
    expect(tarefasDe(depois)).toEqual([]); // sem pedra, o gerador nao recria
    afirmarAsDuasReservasDeVolta(depois, 'origem-sem-recurso');
  });

  it('5. destino sumiu (obra removida) -> CANCELA', () => {
    const { estado, tarefa } = comUmaTarefaReclamada();
    const depois = step(semOPredio(estado, 'obra-a'), []);
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa, motivo: 'destino-sumiu', resultado: 'cancelada' }]);
    expect(depois.jobs.tarefas.porId[tarefa]).toBeUndefined();
    expect(reservadoNaOrigem(depois, armazem.id, 'stone')).toBe(0);
    expect(violacoesDeInvariantes(depois)).toEqual([]);
  });

  it('6a. destino encheu (faltam abaixo do reservado) -> CANCELA', () => {
    const { estado, tarefa } = comUmaTarefaReclamada();
    const semFaltar = comObra(semOPredio(estado, 'obra-a'), 'obra-a', { gx: 26, gy: 34, faltam: { stone: 0 } });
    const depois = step(semFaltar, []);
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa, motivo: 'destino-completo', resultado: 'cancelada' }]);
    afirmarAsDuasReservasDeVolta(depois, 'destino-completo (faltam 0)');
  });

  it('6b. destino completou (o predio ja nao e obra) -> CANCELA', () => {
    const { estado, tarefa } = comUmaTarefaReclamada();
    const completo: PredioCompleto = {
      id: 'obra-a', tipo: 'quarry', gx: 26, gy: 34, estado: 'completo', hp: 250,
      capacidade: { entrada: 5, saida: 5 }, estoque: { entrada: {}, saida: {} },
    };
    const depois = step({ ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, 'obra-a': completo } } }, []);
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa, motivo: 'destino-completo', resultado: 'cancelada' }]);
    afirmarAsDuasReservasDeVolta(depois, 'destino-completo (virou completo)');
  });

  it('7. pedido da unidade (a FSM do serf desiste) -> REABRE, chamando liberar', () => {
    const { estado, tarefa } = comUmaTarefaReclamada();
    const r = liberar(estado, tarefa, 'pedido-da-unidade');
    expect(r.events).toEqual([{ type: 'task-released', tarefa, motivo: 'pedido-da-unidade', resultado: 'reaberta' }]);
    afirmarAsDuasReservasDeVolta(r.state, 'pedido-da-unidade');
  });

  it('claim recusado nao tem o que liberar: nada foi reservado (atomico)', () => {
    const gerado = step(cenarioLigado({ stone: 1 }), []);
    const tarefa = gerado.jobs.tarefas.ordem[0] ?? 't?';
    const semRua = { ...gerado, estradas: {} };
    expect(reclamar(semRua, tarefa, serf1).ok).toBe(false);
    expect(reservadoNaOrigem(semRua, armazem.id, 'stone')).toBe(0);
    expect(reservadoNoDestino(semRua, 'obra-a', 'stone')).toBe(0);
  });

  it('um tick sem falha nao libera nada: a reserva atravessa ticks intactos', () => {
    let { estado } = comUmaTarefaReclamada();
    for (let i = 0; i < 20; i++) estado = step(estado, []);
    expect(liberacoes(estado)).toEqual([]);
    expect(reservadoNaOrigem(estado, armazem.id, 'stone')).toBe(1);
    expect(reservadoNoDestino(estado, 'obra-a', 'stone')).toBe(1);
  });

  it('o destino "encheu" com DUAS reclamadas e faltam caindo para 1: solta so a de maior numero', () => {
    const gerado = step(cenarioLigado({ stone: 2 }), []);
    const [t1, t2] = gerado.jobs.tarefas.ordem;
    if (!t1 || !t2) throw new Error('fixture: deveria haver 2 tarefas');
    const a = reclamar(gerado, t1, serf1);
    if (!a.ok) throw new Error('claim 1');
    const b = reclamar(a.state, t2, serf2);
    if (!b.ok) throw new Error('claim 2');
    const menosUma = comObra(semOPredio(b.state, 'obra-a'), 'obra-a', { gx: 26, gy: 34, faltam: { stone: 1 } });
    const depois = step(menosUma, []);
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa: t2, motivo: 'destino-completo', resultado: 'cancelada' }]);
    expect(depois.jobs.tarefas.porId[t1]?.estado).toBe('reclamada');
    expect(violacoesDeInvariantes(depois)).toEqual([]);
  });
});

describe('F09 — o gerador de tarefas (nivel 3: material -> obra)', () => {
  it('obra sem estrada ate o armazem: nenhuma tarefa', () => {
    const semRua = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2, timber: 3 } });
    expect(tarefasDe(step(semRua, []))).toEqual([]);
  });

  it('com estrada, cria exatamente as tarefas que faltam, timber antes de stone (ordem do dado)', () => {
    const depois = step(cenarioLigado({ stone: 2, timber: 3 }), []);
    const tarefas = tarefasDe(depois);
    expect(tarefas).toHaveLength(5);
    expect(tarefas.map((t) => t.mercadoria)).toEqual(['timber', 'timber', 'timber', 'stone', 'stone']);
    for (const t of tarefas) {
      expect(t).toMatchObject({ tipo: 'material-para-obra', origem: armazem.id, destino: 'obra-a', estado: 'aberta', reclamadaPor: null });
    }
    // ids consecutivos do contador compartilhado
    expect(tarefas.map((t) => t.numero)).toEqual([0, 1, 2, 3, 4].map((i) => inicial.proximoId + i));
  });

  it('nao duplica: ticks seguidos mantem as mesmas tarefas', () => {
    let estado = step(cenarioLigado(), []);
    const ids = estado.jobs.tarefas.ordem;
    for (let i = 0; i < 10; i++) estado = step(estado, []);
    expect(estado.jobs.tarefas.ordem).toEqual(ids);
  });

  it('nunca cria mais do que a obra precisa', () => {
    const depois = step(cenarioLigado({ stone: 1 }), []);
    expect(tarefasDe(depois)).toHaveLength(1);
  });

  it('sem estoque de uma mercadoria no armazem, nao cria tarefa dela (a outra sai)', () => {
    const semPedra = comPedraNaSaida(cenarioLigado({ stone: 2, timber: 1 }), armazem.id, 0);
    expect(tarefasDe(step(semPedra, [])).map((t) => t.mercadoria)).toEqual(['timber']);
  });

  it('a tarefa surge quando a estrada e o estoque passam a existir (a obra espera, sem erro)', () => {
    let estado = step(comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 1 } }), []);
    expect(tarefasDe(estado)).toEqual([]);
    estado = comEstradas(estado, [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)]);
    expect(tarefasDe(step(estado, []))).toHaveLength(1);
  });

  it('a origem e o armazem LIGADO de menor caminho POR ESTRADA; um armazem sem ligacao nao entra', () => {
    // p1 (o do cenario) esta a 4 passos da obra-a e a 22 da obra-b; 'perto' esta a 23 da
    // obra-a e a 3 da obra-b; 'isolado' tem estoque de sobra mas nenhuma estrada.
    let estado = comObra(cenarioLigado({ stone: 1 }), 'obra-b', { gx: 48, gy: 34, faltam: { stone: 1 } });
    estado = comArmazemCompleto(estado, 'perto', { gx: 51, gy: 33, stone: 10 });
    estado = comArmazemCompleto(estado, 'isolado', { gx: 50, gy: 50, stone: 500 });
    estado = comEstradas(estado, linhaH(28, 53, 36));
    const tarefas = tarefasDe(step(estado, []));
    expect(tarefas.map((t) => [t.destino, t.origem])).toEqual([['obra-a', armazem.id], ['obra-b', 'perto']]);
  });

  it('excedente ABERTO e cancelado: duas tarefas para faltam=1 viram uma (a de menor numero fica)', () => {
    const estado = comTarefas(cenarioLigado({ stone: 1 }), [tarefaDe({ numero: 20 }), tarefaDe({ numero: 21 })]);
    const depois = step({ ...estado, proximoId: 30 }, []);
    expect(tarefasDe(depois).map((t) => t.numero)).toEqual([20]);
    expect(violacoesDeInvariantes(depois)).toEqual([]);
  });

  it('tarefa aberta sem caminho e cancelada, e volta a ser criada quando a estrada volta', () => {
    const gerado = step(cenarioLigado({ stone: 1 }), []);
    const semRua = step({ ...gerado, estradas: {} }, []);
    expect(tarefasDe(semRua)).toEqual([]);
    const comRua = step({ ...semRua, estradas: gerado.estradas }, []);
    expect(tarefasDe(comRua)).toHaveLength(1);
  });
});

// --- a propriedade estrutural: nenhuma tarefa reclamada invalida sobrevive a um tick ---

interface Cobertura {
  claims: number;
  liberacoes: Record<MotivoDeLiberacao, number>;
  acoes: number;
}

const RUA_BASE = [...linhaH(20, 42, 36), ...linhaV(29, 33, 36)];
const SLOTS_DE_OBRA = [20, 26, 32, 38];

function baseDoCaos(): GameState {
  let e = comEstradas(cenarioLigado({ stone: 3, timber: 3 }), RUA_BASE);
  e = comObra(e, 'obra-b', { gx: 32, gy: 34, faltam: { stone: 2, timber: 2 } });
  return comEstoqueNaSaida(e, armazem.id, { stone: 60, timber: 60 });
}

/** Um serf novo, clonado de um serf do cenario inicial (a unidade nasceu). */
function comUmSerfNovo(estado: GameState): GameState {
  const molde = inicial.unidades.porId[serf1];
  if (!molde) throw new Error('fixture: sem serf-molde');
  const id = `u${estado.proximoId}`;
  return {
    ...estado,
    proximoId: estado.proximoId + 1,
    unidades: { porId: { ...estado.unidades.porId, [id]: { ...molde, id } }, ordem: [...estado.unidades.ordem, id] },
  };
}

const obrasComPendencia = (estado: GameState): number =>
  estado.predios.ordem.filter((id) => {
    const p = estado.predios.porId[id];
    return p?.estado === 'obra' && Object.values(p.obra.faltam).some((n) => n > 0);
  }).length;

/**
 * O caos alterna destruicao e reposicao. As destruicoes miram, de preferencia, o que uma
 * tarefa RECLAMADA usa (sua unidade, seu armazem, sua porta, sua obra): sem isso os
 * ramos raros dependeriam de sorte de sorteio, e o mundo so se degradaria. As
 * reposicoes (rua, obra, armazem, serf, estoque) mantem a fila de claims cheia.
 */
function rodarCaos(semente: number, passos: number, cobertura: Cobertura): void {
  let rng = createRng(semente);
  const sorteio = (limite: number): number => {
    const r = nextInt(rng, 0, limite);
    rng = r.rng;
    return r.value;
  };
  let estado = baseDoCaos();

  for (let i = 0; i < passos; i++) {
    const acao = sorteio(14);
    const comandos: Command[] = [];
    const serfsVivos = serfsDoCenario(estado);
    const reclamadas = tarefasDe(estado).filter((t) => t.estado === 'reclamada');
    const alvo = reclamadas[sorteio(Math.max(reclamadas.length, 1))];
    switch (acao) {
      case 0:
      case 1:
      case 2:
      case 3: { // reclamar
        const serf = serfsVivos[sorteio(Math.max(serfsVivos.length, 1))];
        if (serf !== undefined) {
          const r = reclamarMelhor(estado, serf);
          if (r.ok) {
            estado = r.state;
            cobertura.claims += 1;
          }
        }
        break;
      }
      case 4: { // o serf desiste (a FSM da F10 fara isto)
        if (alvo !== undefined) {
          const r = liberar(estado, alvo.id, 'pedido-da-unidade');
          estado = r.state;
          cobertura.liberacoes['pedido-da-unidade'] += r.events.length;
        }
        break;
      }
      case 5: { // uma unidade morre (de preferencia, quem carrega uma tarefa)
        const morta = alvo?.reclamadaPor ?? serfsVivos[sorteio(Math.max(serfsVivos.length, 1))];
        if (morta !== undefined && serfsVivos.length > 1) estado = semAUnidade(estado, morta);
        break;
      }
      case 6: { // uma unidade nasce
        if (serfsVivos.length < 4) estado = comUmSerfNovo(estado);
        break;
      }
      case 7: { // demole estrada: a porta do armazem de origem de uma reclamada, ou um tile qualquer
        const origem = alvo && estado.predios.porId[alvo.origem];
        if (origem && sorteio(2) === 0) {
          comandos.push({ type: 'DemolishRoad', tiles: tilesDaPorta(origem) });
        } else {
          const tiles = tilesOrdenados(estado.estradas);
          const t = tiles[sorteio(Math.max(tiles.length, 1))];
          if (t !== undefined) comandos.push({ type: 'DemolishRoad', tiles: [t] });
        }
        break;
      }
      case 8: { // a rua e refeita (reposicao do ambiente)
        estado = comEstradas(estado, RUA_BASE);
        break;
      }
      case 9: { // o jogador estende a rua, por comando
        const gx = 24 + sorteio(16);
        const gy = 33 + sorteio(11);
        const tam = 1 + sorteio(5);
        comandos.push({ type: 'PlaceRoad', tiles: sorteio(2) === 0 ? linhaH(gx, gx + tam, gy) : linhaV(gx, gy, gy + tam) });
        break;
      }
      case 10: { // o jogador planta uma obra, por comando
        comandos.push({ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 20 + sorteio(24), gy: 34 + sorteio(10) });
        break;
      }
      case 11: { // um predio some: o armazem ou a obra de uma reclamada, ou um qualquer
        const escolhido = alvo ? (sorteio(2) === 0 ? alvo.origem : alvo.destino) : estado.predios.ordem[sorteio(Math.max(estado.predios.ordem.length, 1))];
        if (escolhido !== undefined) estado = semOPredio(estado, escolhido);
        break;
      }
      case 12: { // o estoque de um armazem cai (o da reclamada, de preferencia) ou e reabastecido
        const a = (alvo && estado.predios.porId[alvo.origem]) ?? estado.predios.ordem.map((p) => estado.predios.porId[p]).find((p) => p?.tipo === 'storehouse');
        if (a && a.estado === 'completo') {
          estado = comEstoqueNaSaida(estado, a.id, sorteio(2) === 0 ? { stone: sorteio(3), timber: sorteio(3) } : { stone: 60, timber: 60 });
        }
        break;
      }
      default: { // outra entrega abate uma unidade do que a obra pede (de preferencia, a de uma reclamada)
        const obra = alvo ? estado.predios.porId[alvo.destino] : undefined;
        if (alvo && obra && obra.estado === 'obra') {
          const atual = obra.obra.faltam[alvo.mercadoria] ?? 0;
          if (atual > 0) {
            estado = { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [obra.id]: { ...obra, obra: { faltam: { ...obra.obra.faltam, [alvo.mercadoria]: atual - 1 } } } } } };
          }
        }
      }
    }
    // reposicao minima do ambiente, para o caos nao morrer de esvaziamento
    if (!estado.predios.ordem.some((p) => estado.predios.porId[p]?.tipo === 'storehouse')) {
      estado = comArmazemCompleto(estado, `reposto-${i}`, { gx: 29, gy: 30, stone: 40, timber: 40 });
    }
    if (obrasComPendencia(estado) < 2) {
      const gx = SLOTS_DE_OBRA[sorteio(SLOTS_DE_OBRA.length)] ?? 20;
      const ocupado = estado.predios.ordem.some((p) => estado.predios.porId[p]?.gx === gx && estado.predios.porId[p]?.gy === 34);
      if (!ocupado) estado = comObra(estado, `obra-r${i}`, { gx, gy: 34, faltam: { stone: 2, timber: 2 } });
    }

    estado = step(estado, comandos);
    cobertura.acoes += 1;
    for (const e of liberacoes(estado)) cobertura.liberacoes[e.motivo] += 1;
    expect(violacoesDeInvariantes(estado), `semente ${semente}, passo ${i}, acao ${acao}`).toEqual([]);
  }
}

const coberturaVazia = (): Cobertura => ({
  claims: 0,
  acoes: 0,
  liberacoes: {
    'unidade-removida': 0, 'pedido-da-unidade': 0, 'caminho-cortado': 0, 'origem-sumiu': 0,
    'origem-sem-recurso': 0, 'destino-sumiu': 0, 'destino-completo': 0,
  },
});

describe('F09 — propriedade estrutural: eventos aleatorios, invariantes depois de CADA tick', () => {
  const cobertura = coberturaVazia();

  it.each([1, 2, 3])('semente %i: 200 passos sem uma unica violacao', (semente) => {
    rodarCaos(semente, 200, cobertura);
  });

  it('o caos de fato exercitou cada ramo automatico de falha e varios claims', () => {
    expect(cobertura.claims).toBeGreaterThan(0);
    for (const motivo of [
      'unidade-removida', 'pedido-da-unidade', 'caminho-cortado', 'origem-sumiu', 'origem-sem-recurso', 'destino-sumiu', 'destino-completo',
    ] as const) {
      expect(cobertura.liberacoes[motivo], `o caos nunca provocou '${motivo}'`).toBeGreaterThan(0);
    }
  });
});

// --- o cenario de carga: muitas obras, ninguem reclama (o jogo real antes da F10) ---

export const metricasDeCarga = { obras: 0, ticks: 0, tarefasGeradas: 0, maximoSimultaneo: 0, tarefasNoFim: 0 };

describe('F09 — cenario de carga: muitas obras simultaneas e ninguem reclamando', () => {
  it('gera as tarefas, mantem as invariantes e ANOTA quantas foram (sem otimizar, sem medir tempo)', () => {
    const quarry = gameData.predios.find((p) => p.id === 'quarry');
    if (!quarry) throw new Error('fixture: sem quarry no dado');
    const faltam = { ...custoDoPredio(quarry) };

    // 20 obras ao longo de uma rua (y=40), ligada a porta do armazem por uma vertical em x=31
    const xs = [...Array.from({ length: 10 }, (_, i) => i * 3), ...Array.from({ length: 10 }, (_, i) => 33 + i * 3)];
    let estado = comEstoqueNaSaida(inicial, armazem.id, { stone: 500, timber: 500 });
    estado = comEstradas(estado, [...linhaH(0, 62, 40), ...linhaV(31, 33, 40)]);
    xs.forEach((x, i) => {
      estado = comObra(estado, `obra-${i}`, { gx: x, gy: 38, faltam });
    });
    expect(xs).toHaveLength(20);

    const idsAntes = estado.proximoId;
    const TICKS = 300;
    let maximo = 0;
    for (let t = 0; t < TICKS; t++) {
      estado = step(estado, []);
      maximo = Math.max(maximo, estado.jobs.tarefas.ordem.length);
      if (t < 5 || t % 25 === 0) expect(violacoesDeInvariantes(estado), `tick ${t}`).toEqual([]);
    }
    expect(violacoesDeInvariantes(estado)).toEqual([]);

    // ninguem reclamou: tudo o que o gerador criou continua aberto, e so ele criou
    expect(tarefasDe(estado).every((t) => t.estado === 'aberta')).toBe(true);
    const esperadas = 20 * (faltam.timber + faltam.stone);
    expect(estado.jobs.tarefas.ordem).toHaveLength(esperadas);

    Object.assign(metricasDeCarga, {
      obras: 20, ticks: TICKS, tarefasGeradas: estado.proximoId - idsAntes, maximoSimultaneo: maximo,
      tarefasNoFim: estado.jobs.tarefas.ordem.length,
    });
    expect(metricasDeCarga.tarefasGeradas).toBe(esperadas); // nenhum churn: cada tarefa criada uma vez
  });
});

// --- determinismo e save/load com reserva pendente ---

describe('F09 — determinismo e save/load com reservas pendentes', () => {
  const plantarERuar = (t: number): Command[] => {
    if (t !== 0) return [];
    return [
      { type: 'PlaceBlueprint', buildingId: 'quarry', gx: 26, gy: 34 },
      { type: 'PlaceRoad', tiles: [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)] },
    ];
  };
  /** No tick 3, um serf reclama a melhor tarefa (na F10 isso sera a FSM do serf). */
  const reclamaNoTick3 = (estado: GameState): GameState => {
    if (estado.tick !== 3) return estado;
    const r = reclamarMelhor(estado, serf1);
    return r.ok ? r.state : estado;
  };

  it('compararComESemSave continua passando SEM o gancho (o helper canonico da F02)', () => {
    const { direto, comSave } = compararComESemSave({ seed: 1, totalTicks: 30, saveAtTick: 15 });
    expect(comSave).toBe(direto);
  });

  it('com uma reserva PENDENTE atravessando o save, chega ao mesmo JSON', () => {
    const { direto, comSave } = compararComESemSave({
      seed: 1, totalTicks: 14, saveAtTick: 7, comandosNoTick: plantarERuar, antesDoStep: reclamaNoTick3,
    });
    expect(comSave).toBe(direto);
    const final = JSON.parse(direto) as GameState;
    const reclamadas = tarefasDe(final).filter((t) => t.estado === 'reclamada');
    expect(reclamadas).toHaveLength(1);
    // a reserva continua la depois do save/load, por causa da tarefa
    const alvo = reclamadas[0];
    expect(alvo && reservadoNaOrigem(final, alvo.origem, alvo.mercadoria)).toBe(1);
    expect(alvo && reservadoNoDestino(final, alvo.destino, alvo.mercadoria)).toBe(1);
    expect(violacoesDeInvariantes(final)).toEqual([]);
  });

  it('o JobBoard e JSON puro: ida e volta identica, com tarefas abertas e reclamadas', () => {
    const gerado = step(cenarioLigado(), []);
    const t = gerado.jobs.tarefas.ordem[0] ?? 't?';
    const r = reclamar(gerado, t, serf2);
    const estado = r.ok ? r.state : gerado;
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
  });

  it('a mesma sequencia dá o mesmo estado, byte a byte, duas vezes', () => {
    const rodar = (): string => {
      let e = createInitialState(1);
      for (let t = 0; t < 12; t++) {
        e = step(reclamaNoTick3(e), plantarERuar(t));
      }
      return JSON.stringify(e);
    };
    expect(rodar()).toBe(rodar());
  });

  it('ids de tarefa saem do MESMO contador de predios e unidades: nenhuma colisao', () => {
    let e = createInitialState(1);
    for (let t = 0; t < 4; t++) e = step(e, plantarERuar(t));
    const todos = [...e.predios.ordem, ...e.unidades.ordem, ...e.jobs.tarefas.ordem];
    expect(new Set(todos).size).toBe(todos.length);
    expect(e.jobs.tarefas.ordem.length).toBeGreaterThan(0);
  });
});
