/**
 * F13a — `ouro-para-escola`: o nivel 2 da escada ganha produtor. A tarefa nova no
 * quadro (nivel, elegibilidade, demanda, reserva), o gerador, o saneamento e a
 * entrega do serf na gaveta da escola.
 *
 * I-TRANSPORTE-OURO-SEMPRE-NA-ESCOLA: a demanda passou a ser `max(cota, fila) - caixa`, com a cota
 * (`ouroEmEstoque`) mesmo de fila vazia. Com o dado de hoje a fila nunca passa da cota (5 slots de 1
 * de ouro), entao as asserções abaixo falam da cota; o ramo da fila acima dela e coberto por tabela
 * no teste da I-TRANSPORTE-OURO-SEMPRE-NA-ESCOLA.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState, MERCADORIA_DE_OURO } from '../src/sim/state';
import type { GameState, ItemDeFila, TarefaDeTransporte } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { criarTarefaDeOuro, elegivelParaTarefa, importanciaDoTipo, reclamar, tarefasEmOrdem } from '../src/sim/jobs';
import { custoDeTreino, filaDaEscola, ouroNecessario } from '../src/sim/escola';
import { vagaDoDestino } from '../src/sim/reservas';
import {
  armazemPorTipo, avancarAte, cancelar, comOuroNaEscola, comOuroNoArmazem, escolaDoCenario,
  ouroNaEscola, pedir, totalDeOuro,
} from './helpers/escola-cenario';
import { comEstradas, comObra, serfsDoCenario } from './helpers/jobs-cenario';
import { linhaHDe, naVila } from './helpers/ancoras';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;
const ARMAZEM = armazemPorTipo(inicial).id;
const CUSTO = custoDeTreino();
/** A cota de ouro da escola, de fila vazia ou nao (I-TRANSPORTE-OURO-SEMPRE-NA-ESCOLA). */
const COTA = gameData.economia.schoolhouse.ouroEmEstoque;
/** A linha de porta dos dois predios do cenario (armazem em 29..31, escola em 34..36). */
const RUAS = linhaHDe(naVila, 0, 7, 3);
const SERF = serfsDoCenario(inicial)[0] as string;

const tresPedidos = [pedir(ESCOLA, 'serf'), pedir(ESCOLA, 'serf'), pedir(ESCOLA, 'serf')];

const tarefasDe = (estado: GameState, tipo: string): TarefaDeTransporte[] =>
  estado.jobs.tarefas.ordem
    .map((id) => estado.jobs.tarefas.porId[id])
    .filter((t): t is TarefaDeTransporte => t !== undefined && t.tipo === tipo);

/** Cenario ligado: estrada entre os dois predios e `ouro` na gaveta de saida do armazem. */
const ligado = (ouro: number, estado: GameState = inicial): GameState =>
  comOuroNoArmazem(comEstradas(estado, RUAS), ARMAZEM, ouro);

describe('F13a — a tarefa de ouro no quadro', () => {
  it('a classe vem do dado, e ouro ganha de material', () => {
    // D-TRANSPORTE-03 T1 (D2): o ouro da escola e a classe 1, diHigh1 do KaM
    expect(importanciaDoTipo('ouro-para-escola')).toBe(1);
    expect(importanciaDoTipo('ouro-para-escola')).toBeLessThan(importanciaDoTipo('material-para-obra'));
  });

  it('so o serf e elegivel', () => {
    expect(elegivelParaTarefa('ouro-para-escola', 'serf')).toBe(true);
    expect(elegivelParaTarefa('ouro-para-escola', 'laborer')).toBe(false);
  });

  it('a demanda e max(cota, itens aguardando x custo) menos o ouro que a escola ja tem', () => {
    const tres = step(inicial, tresPedidos);
    expect(3 * CUSTO).toBeLessThanOrEqual(COTA); // com o dado de hoje, a cota cobre a fila
    expect(ouroNecessario(tres, ESCOLA)).toBe(COTA);
    expect(ouroNecessario(comOuroNaEscola(tres, ESCOLA, CUSTO), ESCOLA)).toBe(COTA - CUSTO);
    expect(ouroNecessario(inicial, ESCOLA)).toBe(COTA); // fila vazia tambem pede
  });

  it('item que JA comecou nao pede ouro de novo — ele pagou', () => {
    const comecou = step(comOuroNaEscola(step(inicial, tresPedidos), ESCOLA, CUSTO), []);
    expect(filaDaEscola(comecou, ESCOLA)[0]?.estado).toBe('treinando');
    // o item em treino pagou e saiu da conta; o que sobra pedir e a cota, de caixa vazia
    expect(ouroNecessario(comecou, ESCOLA)).toBe(COTA);
  });

  it('a vaga desconta a reserva, e a reserva e derivada da tarefa', () => {
    const tres = ligado(3, step(inicial, tresPedidos));
    const { state: comTarefa, id } = criarTarefaDeOuro(tres, { origem: ARMAZEM, destino: ESCOLA });
    const tarefa = comTarefa.jobs.tarefas.porId[id] as TarefaDeTransporte;
    expect(vagaDoDestino(comTarefa, tarefa)).toBe(COTA); // aberta nao reserva

    const r = reclamar(comTarefa, id, SERF);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(vagaDoDestino(r.state, tarefa)).toBe(COTA - 1);
  });

  it('claim recusado quando a escola nao pede nada (cota cheia)', () => {
    const semFila = comOuroNaEscola(ligado(3), ESCOLA, COTA);
    const { state, id } = criarTarefaDeOuro(semFila, { origem: ARMAZEM, destino: ESCOLA });
    expect(reclamar(state, id, SERF)).toEqual({ ok: false, motivo: 'destino-sem-vaga' });
  });
});

describe('F13a — o gerador e o saneamento', () => {
  it('a fila com demanda faz nascer tarefa de ouro do armazem ligado', () => {
    const depois = step(ligado(3, step(inicial, tresPedidos)), []);
    const ouro = tarefasDe(depois, 'ouro-para-escola');
    expect(ouro).toHaveLength(COTA); // a demanda inteira, como a obra (o armazem tem 3; o resto espera)
    expect(ouro.every((t) => t.origem === ARMAZEM && t.destino === ESCOLA && t.mercadoria === MERCADORIA_DE_OURO))
      .toBe(true);
  });

  it('sem estrada ate a escola nao nasce tarefa: a fila espera', () => {
    const semRua = comOuroNoArmazem(step(inicial, tresPedidos), ARMAZEM, 3);
    expect(tarefasDe(step(semRua, []), 'ouro-para-escola')).toHaveLength(0);
  });

  it('nunca mais tarefas do que a demanda, e o excedente e cancelado quando ela encolhe', () => {
    const um = ligado(3, step(inicial, [pedir(ESCOLA, 'serf')]));
    const comTarefa = step(um, []);
    expect(tarefasDe(comTarefa, 'ouro-para-escola')).toHaveLength(COTA);

    // cancelar a fila nao encolhe a demanda: a cota continua (I-TRANSPORTE-OURO-SEMPRE-NA-ESCOLA)
    const item = filaDaEscola(comTarefa, ESCOLA)[0] as ItemDeFila;
    const cancelado = step(comTarefa, [cancelar(ESCOLA, item.id)]);
    expect(tarefasDe(cancelado, 'ouro-para-escola').length).toBeLessThanOrEqual(COTA);
    // a caixa cheia encolhe: as abertas que sobram sao canceladas
    const cheia = step(comOuroNaEscola(cancelado, ESCOLA, COTA), []);
    expect(tarefasDe(cheia, 'ouro-para-escola').filter((t) => t.estado === 'aberta')).toHaveLength(0);
  });

  it('ouro na frente de material: quem ordena e a escada, nao a ordem de criacao', () => {
    // Uma obra pedindo pedra e uma fila pedindo ouro, ambas ligadas ao mesmo armazem.
    // A obra fica em (26,34), porta em (28,36); os tiles abaixo ligam a rua do armazem
    // ate essa porta (o mesmo desvio de `cenarioLigado`).
    const ateAObra = [naVila(0, 4), naVila(0, 5), naVila(0, 6), naVila(-1, 6)];
    const comAmbos = step(
      comEstradas(
        comObra(ligado(5, step(inicial, [pedir(ESCOLA, 'serf')])), 'obra1', {
          ...naVila(-3, 4), faltam: { stone: 2 },
        }),
        ateAObra,
      ),
      [],
    );
    const ordem = tarefasEmOrdem(comAmbos, SERF).map((t) => t.tipo);
    expect(ordem).toContain('material-para-obra');
    expect(ordem[0]).toBe('ouro-para-escola');
  });
});

describe('F13a — o serf entrega na escola', () => {
  it('leva o ouro do armazem ate a gaveta `entrada` da escola, e o treino comeca com ele', () => {
    const cenario = ligado(1, step(inicial, [pedir(ESCOLA, 'serf')]));
    const entregue = avancarAte(
      cenario,
      (e) => e.events.some((ev) => ev.type === 'task-completed' && ev.destino === ESCOLA),
      300,
    );
    const armazem = entregue.predios.porId[ARMAZEM];

    expect(armazem?.estado === 'completo' ? armazem.estoque.saida[MERCADORIA_DE_OURO] ?? 0 : -1).toBe(0);
    expect(entregue.events).toContainEqual({
      type: 'task-completed', tarefa: expect.any(String), destino: ESCOLA, mercadoria: MERCADORIA_DE_OURO,
    });
    expect(tarefasDe(entregue, 'ouro-para-escola')).toHaveLength(0);

    // A gaveta `entrada` ja esta em 0 NESTE tick: a escola roda depois dos serfs
    // (ordem de `step`) e cobra o ouro no mesmo tick em que ele chega. Quem prova que
    // o ouro passou pela gaveta e o item ter saido de `aguardando` — a cobranca le
    // `entrada`, e so ela. O ouro nao se duplicou no caminho (conservacao).
    expect(ouroNaEscola(entregue, ESCOLA)).toBe(0);
    expect(filaDaEscola(entregue, ESCOLA)[0]?.estado).toBe('treinando');
    expect(totalDeOuro(entregue)).toBe(totalDeOuro(cenario) - CUSTO);
  });

  it('fila cancelada com o serf carregado: ele entrega na escola mesmo assim (a cota pede), sem sumico de ouro', () => {
    const cenario = ligado(1, step(inicial, [pedir(ESCOLA, 'serf')]));
    const carregando = avancarAte(
      cenario,
      (e) => tarefasDe(e, 'ouro-para-escola').some((t) => t.estado === 'carregando'),
      300,
    );
    const carregador = carregando.unidades.ordem
      .map((id) => carregando.unidades.porId[id])
      .find((u) => u?.fsmData.carga === MERCADORIA_DE_OURO);
    expect(carregador).toBeDefined();

    const item = filaDaEscola(carregando, ESCOLA)[0] as ItemDeFila;
    const cancelado = step(carregando, [cancelar(ESCOLA, item.id)]);
    // antes da cota ele devolvia ao armazem; agora a escola ainda quer o ouro, e ele segue
    expect(cancelado.unidades.porId[carregador?.id ?? '']?.fsm).toBe('indo_entregar');

    const fim = avancarAte(cancelado, (e) => e.unidades.porId[carregador?.id ?? '']?.fsm === 'ocioso', 300);
    expect(totalDeOuro(fim)).toBe(totalDeOuro(cenario)); // conservacao: nada sumiu, nada nasceu
    expect(ouroNaEscola(fim, ESCOLA)).toBe(1);
  });
});
