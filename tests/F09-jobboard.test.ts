import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState } from '../src/sim/state';
import { deepFreeze } from './helpers/determinism';
import { distanciaEntrePredios, distanciaPorEstrada } from '../src/sim/estradas';
import {
  disponivelNaOrigem, reservadoNaOrigem, reservadoNoDestino, vagaNoDestino,
} from '../src/sim/reservas';
import {
  criarTarefa, liberar, nivelDoTipo, reclamar, reclamarMelhor, tarefasEmOrdem,
} from '../src/sim/jobs';
import {
  armazemDoCenario, cenarioLigado, comEstradas, comObra, comPedraNaSaida, comTarefas, estradasDe,
  inicial, laborersDoCenario, linhaH, linhaV, serfsDoCenario, tarefaDe, tile,
} from './helpers/jobs-cenario';

const armazem = armazemDoCenario(inicial);
const [serf1, serf2, serf3] = serfsDoCenario(inicial);
const [laborer1] = laborersDoCenario(inicial);
if (!serf1 || !serf2 || !serf3 || !laborer1) throw new Error('fixture: o cenario deveria ter serfs e laborers');

function exigir<T>(valor: T | undefined | null, mensagem: string): T {
  if (valor === undefined || valor === null) throw new Error(mensagem);
  return valor;
}

/** Cria `n` tarefas abertas (armazem -> obra-a) pela API real; devolve o estado e os ids. */
function comNTarefas(estado: GameState, n: number, mercadoria = 'stone'): { estado: GameState; ids: string[] } {
  let atual = estado;
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const criada = criarTarefa(atual, { mercadoria, origem: armazem.id, destino: 'obra-a' });
    atual = criada.state;
    ids.push(criada.id);
  }
  return { estado: atual, ids };
}

const aceito = (r: ReturnType<typeof reclamar>): GameState => {
  if (!r.ok) throw new Error(`esperava claim aceito, veio '${r.motivo}'`);
  return r.state;
};

describe('F09 — o JobBoard no GameState', () => {
  it('o estado inicial nasce com o quadro vazio', () => {
    expect(inicial.jobs.tarefas.ordem).toEqual([]);
    expect(inicial.jobs.tarefas.porId).toEqual({});
  });

  it('um quadro com tarefas reclamadas e abertas sobrevive ao JSON de ida e volta', () => {
    const estado = comTarefas(cenarioLigado(), [
      tarefaDe({ numero: 1, estado: 'reclamada', reclamadaPor: serf1 }),
      tarefaDe({ numero: 2 }),
    ]);
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
  });
});

describe('F09 — a reserva e DERIVADA das tarefas reclamadas', () => {
  const base = comObra(inicial, 'obra-a', { gx: 0, gy: 0, faltam: { stone: 3, timber: 2 } });

  it('so a tarefa reclamada reserva; a aberta nao reserva nada', () => {
    const estado = comTarefas(base, [
      tarefaDe({ numero: 1, estado: 'reclamada', reclamadaPor: serf1 }),
      tarefaDe({ numero: 2, estado: 'reclamada', reclamadaPor: serf2 }),
      tarefaDe({ numero: 3 }),
    ]);
    expect(reservadoNaOrigem(estado, armazem.id, 'stone')).toBe(2);
    expect(reservadoNoDestino(estado, 'obra-a', 'stone')).toBe(2);
  });

  it('a reserva e por predio E por mercadoria', () => {
    const estado = comTarefas(base, [
      tarefaDe({ numero: 1, estado: 'reclamada', reclamadaPor: serf1 }),
      tarefaDe({ numero: 2, mercadoria: 'timber', estado: 'reclamada', reclamadaPor: serf2 }),
    ]);
    expect(reservadoNaOrigem(estado, armazem.id, 'stone')).toBe(1);
    expect(reservadoNaOrigem(estado, armazem.id, 'timber')).toBe(1);
    expect(reservadoNaOrigem(estado, armazem.id, 'gold')).toBe(0);
    expect(reservadoNoDestino(estado, 'obra-a', 'stone')).toBe(1);
    expect(reservadoNoDestino(estado, 'outra-obra', 'stone')).toBe(0);
  });

  it('disponivel na origem = saida - reservado; vaga no destino = faltam - reservado', () => {
    const noArmazem = armazem.estoque.saida.stone ?? 0;
    const estado = comTarefas(base, [
      tarefaDe({ numero: 1, estado: 'reclamada', reclamadaPor: serf1 }),
      tarefaDe({ numero: 2, estado: 'reclamada', reclamadaPor: serf2 }),
    ]);
    expect(disponivelNaOrigem(estado, armazem.id, 'stone')).toBe(noArmazem - 2);
    expect(vagaNoDestino(estado, 'obra-a', 'stone')).toBe(3 - 2);
    expect(disponivelNaOrigem(base, armazem.id, 'stone')).toBe(noArmazem);
    expect(vagaNoDestino(base, 'obra-a', 'stone')).toBe(3);
  });

  it('predio que nao e armazem completo nao tem disponivel; que nao e obra nao tem vaga', () => {
    expect(disponivelNaOrigem(base, 'obra-a', 'stone')).toBe(0);
    expect(vagaNoDestino(base, armazem.id, 'stone')).toBe(0);
    expect(disponivelNaOrigem(base, 'nao-existe', 'stone')).toBe(0);
    expect(vagaNoDestino(base, 'nao-existe', 'stone')).toBe(0);
  });

  it('nao ha contador para dessincronizar: tirar a tarefa tira a reserva', () => {
    const reclamada = comTarefas(base, [tarefaDe({ numero: 1, estado: 'reclamada', reclamadaPor: serf1 })]);
    expect(reservadoNaOrigem(reclamada, armazem.id, 'stone')).toBe(1);
    expect(reservadoNaOrigem(comTarefas(base, []), armazem.id, 'stone')).toBe(0);
  });
});

describe('F09 — distanciaPorEstrada: caminho a pe pela rede, nunca reta', () => {
  it('em reta pela estrada: o nº de passos', () => {
    const estradas = estradasDe([0, 1, 2, 3, 4].map((x) => tile(x, 0)));
    expect(distanciaPorEstrada(estradas, [tile(0, 0)], [tile(4, 0)])).toBe(4);
  });

  it('a volta conta inteira: dois pontos vizinhos em linha reta, longe pela estrada', () => {
    const volta = estradasDe([tile(0, 0), tile(0, 1), tile(0, 2), tile(1, 2), tile(2, 2), tile(2, 1), tile(2, 0)]);
    expect(distanciaPorEstrada(volta, [tile(0, 0)], [tile(2, 0)])).toBe(6);
    const comAtalho = estradasDe([tile(0, 0), tile(1, 0), tile(2, 0)]);
    expect(distanciaPorEstrada(comAtalho, [tile(0, 0)], [tile(2, 0)])).toBe(2);
  });

  it('null quando nao ha caminho, e quando uma das pontas nao e estrada', () => {
    const doisTrechos = estradasDe([tile(0, 0), tile(1, 0), tile(5, 0), tile(6, 0)]);
    expect(distanciaPorEstrada(doisTrechos, [tile(0, 0)], [tile(6, 0)])).toBeNull();
    expect(distanciaPorEstrada(doisTrechos, [tile(0, 0)], [tile(3, 3)])).toBeNull();
    expect(distanciaPorEstrada(doisTrechos, [tile(9, 9)], [tile(0, 0)])).toBeNull();
    expect(distanciaPorEstrada({}, [tile(0, 0)], [tile(1, 0)])).toBeNull();
  });

  it('o mesmo tile de estrada esta a distancia 0', () => {
    expect(distanciaPorEstrada(estradasDe([tile(3, 3)]), [tile(3, 3)], [tile(3, 3)])).toBe(0);
  });

  it('com varias portas de cada lado vale a menor distancia entre qualquer par', () => {
    const estradas = estradasDe([0, 1, 2, 3, 4, 5].map((x) => tile(x, 0)));
    expect(distanciaPorEstrada(estradas, [tile(0, 0), tile(2, 0)], [tile(5, 0), tile(4, 0)])).toBe(2);
  });

  it('diagonal nao e passo: dois tiles em diagonal nao se ligam', () => {
    expect(distanciaPorEstrada(estradasDe([tile(0, 0), tile(1, 1)]), [tile(0, 0)], [tile(1, 1)])).toBeNull();
  });

  it('e pura e determinista: mesma resposta em chamadas repetidas, sobre estradas congeladas', () => {
    const estradas = deepFreeze(estradasDe([0, 1, 2, 3].map((x) => tile(x, 0))));
    const a = distanciaPorEstrada(estradas, [tile(0, 0)], [tile(3, 0)]);
    const b = distanciaPorEstrada(estradas, [tile(0, 0)], [tile(3, 0)]);
    expect([a, b]).toEqual([3, 3]);
  });

  it('entre predios usa as portas (a borda sul): armazem -> obra do cenario basico', () => {
    const estado = cenarioLigado();
    const obra = exigir(estado.predios.porId['obra-a'], 'obra-a');
    expect(distanciaEntrePredios(estado, armazemDoCenario(estado), obra)).toBe(4);
  });
});

describe('F09 — criar tarefa', () => {
  it('nasce aberta, sem unidade, com id t<numero> tirado do contador compartilhado', () => {
    const estado = cenarioLigado();
    const { state, id } = criarTarefa(estado, { mercadoria: 'stone', origem: armazem.id, destino: 'obra-a' });
    expect(id).toBe(`t${estado.proximoId}`);
    expect(state.proximoId).toBe(estado.proximoId + 1);
    const t = exigir(state.jobs.tarefas.porId[id], 'tarefa criada');
    expect(t).toMatchObject({
      numero: estado.proximoId, tipo: 'material-para-obra', mercadoria: 'stone',
      origem: armazem.id, destino: 'obra-a', estado: 'aberta', reclamadaPor: null,
    });
    expect(state.jobs.tarefas.ordem).toEqual([id]);
  });

  it('nao reserva nada: uma tarefa aberta nao mexe em disponivel nem em vaga', () => {
    const estado = cenarioLigado();
    const { state } = criarTarefa(estado, { mercadoria: 'stone', origem: armazem.id, destino: 'obra-a' });
    expect(disponivelNaOrigem(state, armazem.id, 'stone')).toBe(disponivelNaOrigem(estado, armazem.id, 'stone'));
    expect(vagaNoDestino(state, 'obra-a', 'stone')).toBe(vagaNoDestino(estado, 'obra-a', 'stone'));
  });
});

describe('F09 — aceite: 1 tarefa, 2 unidades, so uma faz claim', () => {
  const { estado: base, ids } = comNTarefas(cenarioLigado(), 1);
  const tarefaId = exigir(ids[0], 'tarefa');

  it('a primeira reclama; a segunda e recusada porque a tarefa ja e de outra', () => {
    const depoisDaPrimeira = aceito(reclamar(base, tarefaId, serf1));
    const segunda = reclamar(depoisDaPrimeira, tarefaId, serf2);
    expect(segunda).toEqual({ ok: false, motivo: 'tarefa-ja-reclamada' });
    const reclamadas = depoisDaPrimeira.jobs.tarefas.ordem
      .map((id) => depoisDaPrimeira.jobs.tarefas.porId[id])
      .filter((t) => t?.estado === 'reclamada');
    expect(reclamadas).toHaveLength(1);
    expect(reclamadas[0]?.reclamadaPor).toBe(serf1);
  });

  it('depois do claim o DISPONIVEL na origem cai e o RESERVADO sobe (as duas pontas)', () => {
    const antes = { disp: disponivelNaOrigem(base, armazem.id, 'stone'), res: reservadoNaOrigem(base, armazem.id, 'stone') };
    const depois = aceito(reclamar(base, tarefaId, serf1));
    expect(disponivelNaOrigem(depois, armazem.id, 'stone')).toBe(antes.disp - 1);
    expect(reservadoNaOrigem(depois, armazem.id, 'stone')).toBe(antes.res + 1);
    // ...e a vaga no destino tambem: a reserva e dupla
    expect(vagaNoDestino(depois, 'obra-a', 'stone')).toBe(vagaNoDestino(base, 'obra-a', 'stone') - 1);
    expect(reservadoNoDestino(depois, 'obra-a', 'stone')).toBe(1);
  });

  it('release restaura EXATAMENTE o estado anterior (estado inteiro)', () => {
    const reclamada = aceito(reclamar(base, tarefaId, serf1));
    const liberada = liberar(reclamada, tarefaId, 'pedido-da-unidade');
    expect(liberada.state).toEqual(base);
    expect(JSON.stringify(liberada.state)).toBe(JSON.stringify(base));
    expect(reservadoNaOrigem(liberada.state, armazem.id, 'stone')).toBe(0);
    expect(reservadoNoDestino(liberada.state, 'obra-a', 'stone')).toBe(0);
  });
});

describe('F09 — reserva DUPLA: cada metade separadamente', () => {
  it('so a ORIGEM limita: 1 unidade em estoque, vaga de sobra -> o 2º claim falha por origem-sem-recurso', () => {
    const { estado, ids } = comNTarefas(comPedraNaSaida(cenarioLigado({ stone: 5 }), armazem.id, 1), 2);
    const [t1, t2] = [exigir(ids[0], 't1'), exigir(ids[1], 't2')];
    const depoisDoPrimeiro = aceito(reclamar(estado, t1, serf1));
    expect(disponivelNaOrigem(depoisDoPrimeiro, armazem.id, 'stone')).toBe(0);
    expect(vagaNoDestino(depoisDoPrimeiro, 'obra-a', 'stone')).toBe(4); // o destino tinha folga
    expect(reclamar(depoisDoPrimeiro, t2, serf2)).toEqual({ ok: false, motivo: 'origem-sem-recurso' });
    // atomico: a recusa nao deixou reserva no destino
    expect(reservadoNoDestino(depoisDoPrimeiro, 'obra-a', 'stone')).toBe(1);
  });

  it('so o DESTINO limita: estoque de sobra, vaga 1 -> o 2º claim falha por destino-sem-vaga', () => {
    const { estado, ids } = comNTarefas(cenarioLigado({ stone: 1 }), 2); // faltam 1, mas duas tarefas existem
    const [t1, t2] = [exigir(ids[0], 't1'), exigir(ids[1], 't2')];
    const depoisDoPrimeiro = aceito(reclamar(estado, t1, serf1));
    expect(vagaNoDestino(depoisDoPrimeiro, 'obra-a', 'stone')).toBe(0);
    expect(disponivelNaOrigem(depoisDoPrimeiro, armazem.id, 'stone')).toBeGreaterThan(20); // a origem tinha folga
    expect(reclamar(depoisDoPrimeiro, t2, serf2)).toEqual({ ok: false, motivo: 'destino-sem-vaga' });
    // atomico: a recusa nao deixou reserva na origem
    expect(reservadoNaOrigem(depoisDoPrimeiro, armazem.id, 'stone')).toBe(1);
  });

  it('a recusa e ATOMICA: o estado que volta e o mesmo objeto, nada ficou reservado', () => {
    const { estado, ids } = comNTarefas(comPedraNaSaida(cenarioLigado({ stone: 5 }), armazem.id, 1), 2);
    const depoisDoPrimeiro = aceito(reclamar(estado, exigir(ids[0], 't1'), serf1));
    const recusado = reclamar(depoisDoPrimeiro, exigir(ids[1], 't2'), serf2);
    expect(recusado.ok).toBe(false);
    // o chamador continua com `depoisDoPrimeiro`: nada mudou nele
    expect(reservadoNaOrigem(depoisDoPrimeiro, armazem.id, 'stone')).toBe(1);
    expect(reservadoNoDestino(depoisDoPrimeiro, 'obra-a', 'stone')).toBe(1);
  });
});

describe('F09 — outras recusas do claim', () => {
  const { estado, ids } = comNTarefas(cenarioLigado(), 2);
  const [t1, t2] = [exigir(ids[0], 't1'), exigir(ids[1], 't2')];

  it('tarefa que nao existe', () => {
    expect(reclamar(estado, 't999', serf1)).toEqual({ ok: false, motivo: 'tarefa-inexistente' });
  });

  it('unidade que nao existe, e unidade que nao carrega (laborer)', () => {
    expect(reclamar(estado, t1, 'u999')).toEqual({ ok: false, motivo: 'unidade-invalida' });
    expect(reclamar(estado, t1, laborer1)).toEqual({ ok: false, motivo: 'unidade-invalida' });
  });

  it('a mesma unidade nao segura duas tarefas', () => {
    const comUma = aceito(reclamar(estado, t1, serf1));
    expect(reclamar(comUma, t2, serf1)).toEqual({ ok: false, motivo: 'unidade-ocupada' });
    // outra unidade pega a segunda normalmente
    expect(reclamar(comUma, t2, serf2).ok).toBe(true);
  });

  it('sem caminho por estrada entre as portas: sem-caminho, e nada e reservado', () => {
    const semRua = { ...estado, estradas: {} };
    expect(reclamar(semRua, t1, serf1)).toEqual({ ok: false, motivo: 'sem-caminho' });
  });

  it('origem que nao e armazem completo e destino que nao e obra: recusados, sem excecao', () => {
    const tarefaPorNada = comTarefas(cenarioLigado(), [
      tarefaDe({ numero: 1, origem: 'nao-existe' }),
      tarefaDe({ numero: 2, destino: 'nao-existe' }),
    ]);
    expect(reclamar(tarefaPorNada, 't1', serf1)).toEqual({ ok: false, motivo: 'origem-sem-recurso' });
    expect(reclamar(tarefaPorNada, 't2', serf1)).toEqual({ ok: false, motivo: 'destino-sem-vaga' });
  });
});

describe('F09 — liberar', () => {
  const { estado: base, ids } = comNTarefas(cenarioLigado(), 1);
  const tarefaId = exigir(ids[0], 'tarefa');
  const reclamada = aceito(reclamar(base, tarefaId, serf1));

  it('motivo de unidade REABRE a mesma tarefa e emite o evento', () => {
    const r = liberar(reclamada, tarefaId, 'pedido-da-unidade');
    expect(r.state.jobs.tarefas.porId[tarefaId]).toEqual(base.jobs.tarefas.porId[tarefaId]);
    expect(r.events).toEqual([
      { type: 'task-released', tarefa: tarefaId, motivo: 'pedido-da-unidade', resultado: 'reaberta' },
    ]);
  });

  it('motivo de origem, caminho ou destino CANCELA: a tarefa some e as duas reservas voltam', () => {
    for (const motivo of ['caminho-cortado', 'origem-sumiu', 'origem-sem-recurso', 'destino-sumiu', 'destino-completo'] as const) {
      const r = liberar(reclamada, tarefaId, motivo);
      expect(r.state.jobs.tarefas.porId[tarefaId], motivo).toBeUndefined();
      expect(r.state.jobs.tarefas.ordem, motivo).toEqual([]);
      expect(reservadoNaOrigem(r.state, armazem.id, 'stone'), motivo).toBe(0);
      expect(reservadoNoDestino(r.state, 'obra-a', 'stone'), motivo).toBe(0);
      expect(r.events, motivo).toEqual([
        { type: 'task-released', tarefa: tarefaId, motivo, resultado: 'cancelada' },
      ]);
    }
  });

  it('liberar tarefa aberta ou inexistente e no-op: mesmo estado, sem evento', () => {
    expect(liberar(base, tarefaId, 'pedido-da-unidade')).toEqual({ state: base, events: [] });
    expect(liberar(base, 't999', 'pedido-da-unidade')).toEqual({ state: base, events: [] });
  });
});

describe('F09 — a escada de prioridade vem do dado', () => {
  it('nivelDoTipo le o nivel de delivery.json pelo id, sem numero em .ts', () => {
    const doDado = gameData.entrega.prioridades.find((p) => p.id === 'material-para-obra');
    expect(nivelDoTipo('material-para-obra')).toBe(doDado?.nivel);
  });

  it('com o dado trocado, o nivel muda; sem o id no dado, falha alto em vez de assumir', () => {
    const dados: GameData = {
      ...gameData,
      entrega: {
        ...gameData.entrega,
        prioridades: gameData.entrega.prioridades.map((p) => (p.id === 'material-para-obra' ? { ...p, nivel: 42 } : p)),
      },
    };
    expect(nivelDoTipo('material-para-obra', dados)).toBe(42);
    const semOId: GameData = { ...gameData, entrega: { ...gameData.entrega, prioridades: [] } };
    expect(() => nivelDoTipo('material-para-obra', semOId)).toThrow(/material-para-obra/);
  });
});

describe('F09 — desempate: menor caminho REAL, depois menor numero', () => {
  /**
   * O caso adversarial da distancia euclidiana. O armazem tem a porta em y=33
   * (x 29..31). A obra PERTO fica logo abaixo dele, mas a unica estrada que chega a
   * porta dela da uma volta grande; a obra LONGE fica muito mais ao sul, mas tem uma
   * estrada quase reta. Em linha reta a PERTO ganha; pelo caminho a pe, a LONGE.
   */
  function cenarioDeVolta(): GameState {
    let estado = comObra(inicial, 'perto', { gx: 29, gy: 34, faltam: { stone: 1 } }); // porta y=36, x 29..31
    estado = comObra(estado, 'longe', { gx: 28, gy: 45, faltam: { stone: 1 } }); // porta y=47, x 28..30
    const voltaGrande = [
      ...linhaH(29, 40, 33), ...linhaV(40, 34, 36), ...linhaH(31, 39, 36), // porta (31,36) so por aqui
    ];
    const retaQuase = [tile(28, 33), tile(27, 33), ...linhaV(27, 34, 47), tile(28, 47)];
    return comEstradas(estado, [...voltaGrande, ...retaQuase]);
  }

  it('prova o caso: em linha reta a obra PERTO e mais perto, pelo caminho a pe a LONGE e', () => {
    const estado = cenarioDeVolta();
    const s = armazemDoCenario(estado);
    const perto = exigir(estado.predios.porId.perto, 'perto');
    const longe = exigir(estado.predios.porId.longe, 'longe');
    const euclid = (a: { gx: number; gy: number }, b: { gx: number; gy: number }): number =>
      Math.hypot(a.gx - b.gx, a.gy - b.gy);
    expect(euclid(s, perto)).toBeLessThan(euclid(s, longe)); // a armadilha
    const dPerto = exigir(distanciaEntrePredios(estado, s, perto), 'caminho ate a perto');
    const dLonge = exigir(distanciaEntrePredios(estado, s, longe), 'caminho ate a longe');
    expect(dLonge).toBeLessThan(dPerto); // a realidade
  });

  it('reclamarMelhor escolhe a tarefa do caminho curto, nao a da reta curta', () => {
    const estado = comTarefas(cenarioDeVolta(), [
      tarefaDe({ numero: 1, destino: 'perto' }), // numero MENOR e reta menor: nada disso pode decidir
      tarefaDe({ numero: 2, destino: 'longe' }),
    ]);
    const ordem = tarefasEmOrdem(estado).map((t) => t.destino);
    expect(ordem).toEqual(['longe', 'perto']);
    const r = reclamarMelhor(estado, serf1);
    if (!r.ok) throw new Error(`esperava claim, veio '${r.motivo}'`);
    expect(r.tarefa).toBe('t2');
    expect(r.state.jobs.tarefas.porId.t2?.reclamadaPor).toBe(serf1);
  });

  it('a mesma distancia desempata pelo NUMERO da tarefa, numerico: t2 antes de t10', () => {
    // 't10' < 't2' como string; tem que ganhar o de menor NUMERO
    const estado = comTarefas(cenarioLigado(), [tarefaDe({ numero: 10 }), tarefaDe({ numero: 2 })]);
    expect(estado.jobs.tarefas.ordem).toEqual(['t10', 't2']);
    expect(tarefasEmOrdem(estado).map((t) => t.numero)).toEqual([2, 10]);
    const r1 = reclamarMelhor(estado, serf1);
    if (!r1.ok) throw new Error('claim');
    expect(r1.tarefa).toBe('t2');
    const r2 = reclamarMelhor(r1.state, serf2);
    if (!r2.ok) throw new Error('claim');
    expect(r2.tarefa).toBe('t10');
  });

  it('reclamarMelhor pula a tarefa que nao da para reclamar e pega a proxima', () => {
    // a MELHOR por caminho (a da obra 'longe') pede milho, que o armazem nao tem: nao da
    // para reclama-la; a segunda por ordem e reclamavel
    const estado = comTarefas(cenarioDeVolta(), [
      tarefaDe({ numero: 1, destino: 'longe', mercadoria: 'corn' }),
      tarefaDe({ numero: 2, destino: 'perto' }),
    ]);
    expect(reclamar(estado, 't1', serf1).ok).toBe(false);
    const r = reclamarMelhor(estado, serf1);
    if (!r.ok) throw new Error(`esperava claim, veio '${r.motivo}'`);
    expect(r.tarefa).toBe('t2');
  });

  it('sem tarefa aberta nao ha o que reclamar', () => {
    expect(reclamarMelhor(cenarioLigado(), serf1)).toEqual({ ok: false, motivo: 'sem-tarefa-aberta' });
  });

  it('tarefa sem caminho vai para o fim da fila (e nao trava a de baixo)', () => {
    const base = comObra(cenarioLigado(), 'isolada', { gx: 50, gy: 50, faltam: { stone: 1 } });
    const estado = comTarefas(base, [
      tarefaDe({ numero: 1, destino: 'isolada' }), // numero menor, mas sem estrada ate la
      tarefaDe({ numero: 2 }),
    ]);
    expect(tarefasEmOrdem(estado).map((t) => t.numero)).toEqual([2, 1]);
  });
});
