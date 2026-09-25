/**
 * F18d-1b — o laborer assenta um tile do canteiro.
 *
 * D1 do plano: tile planejado e obra, e por isso a FSM NAO ganha estado novo. O
 * laborer reclama, caminha (`indo_a_obra`), martela um ciclo (`martelando`) e
 * volta a `ocioso`.
 *
 * F18g INVERTEU a frase "esperando_material nao acontece": agora a pedra VIAJA na
 * mao de um serf, e o laborer que chega antes dela espera NO TILE — o mesmo estado,
 * pela mesma razao, que ele usa na obra. E o claim so o manda ao tile que tem pedra
 * ou pedra a caminho (`tileDeEstradaTrabalhavel`), senao ele esperaria para sempre.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { criarTarefaDeAssentamento } from '../src/sim/jobs';
import { chaveDeTile, ehEstrada, ehPlanejada, MERCADORIA_DA_ESTRADA, pedraNoTile } from '../src/sim/estradas';
import { disponivelNaOrigem, reservadoNaOrigem } from '../src/sim/reservas';
import { ehTarefaDePedraParaCanteiro } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { comPedraNaSaida, comPlanejadas, inicial, laborersDoCenario, tile } from './helpers/jobs-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { ESTADOS_DO_LABORER, violacoesDaFsmDoLaborer } from './helpers/laborer-invariantes';
import { bensPorMercadoria, violacoesDaFsm } from './helpers/serf-invariantes';
import { ate, fsmDe } from './helpers/serf-cenario';

/** Colado no laborer u7 (34,34): a viagem dele e curta de proposito, e por isso ele
 *  chega ANTES da pedra, que vem do armazem (29,30) na mao de um serf. */
const CANTEIRO = tile(34, 33);
const ARMAZEM = 'p1';

function comOCanteiro(): { readonly estado: GameState; readonly tarefa: string } {
  const criada = criarTarefaDeAssentamento(comPlanejadas(inicial, [CANTEIRO]), CANTEIRO);
  return { estado: criada.state, tarefa: criada.id };
}

const assentado = (e: GameState): boolean => ehEstrada(e.estradas, CANTEIRO);
const saidaDoArmazem = (e: GameState): number => {
  const p = e.predios.porId[ARMAZEM];
  if (!p || p.estado !== 'completo') throw new Error('fixture: sem armazem');
  return p.estoque.saida[MERCADORIA_DA_ESTRADA] ?? 0;
};
const cargasDePedra = (e: GameState): number => e.jobs.tarefas.ordem
  .filter((id) => { const t = e.jobs.tarefas.porId[id]; return t !== undefined && ehTarefaDePedraParaCanteiro(t); }).length;

describe('F18d-1b + F18g — o ciclo do assentamento', () => {
  it('o laborer chega, ESPERA a pedra no tile, assenta quando ela chega, e a FSM continua com cinco estados', () => {
    const { estado } = comOCanteiro();
    expect(ehPlanejada(estado.estradasPlanejadas, CANTEIRO)).toBe(true);
    expect(ehEstrada(estado.estradas, CANTEIRO)).toBe(false);

    const laborer = laborersDoCenario(estado)[0];
    if (laborer === undefined) throw new Error('fixture: cenario sem laborer');
    // tick 1: a carga de pedra nasce no fim do tick (`gerarTarefas`); o laborer ainda
    // nao tem por que ir — o tile nao tem pedra nem pedra a caminho.
    const t1 = step(estado, []);
    expect(fsmDe(t1, laborer)).toBe('ocioso');
    expect(cargasDePedra(t1)).toBe(gameData.terreno.estrada.custoStonePorTile);
    // tick 2: com a carga aberta o tile passou a ser trabalhavel, e ele sai.
    const t2 = step(t1, []);
    expect(fsmDe(t2, laborer)).toBe('indo_a_obra');

    const estados: string[] = [];
    const pronto = ate(t2, (e) => {
      const f = fsmDe(e, laborer);
      if (estados[estados.length - 1] !== f) estados.push(f);
      return assentado(e);
    }, 'o tile planejado vira estrada de pe');
    // a metade (b) do aceite da F18g: ele esperou NO tile antes de martelar
    expect(estados).toEqual(['indo_a_obra', 'esperando_material', 'martelando', 'ocioso']);
    expect(pronto.unidades.porId[laborer]).toMatchObject({ gx: CANTEIRO.gx, gy: CANTEIRO.gy });
    expect(ehPlanejada(pronto.estradasPlanejadas, CANTEIRO)).toBe(false);
    expect(Object.keys(pronto.estradas)).toEqual([chaveDeTile(CANTEIRO)]);
    expect(pedraNoTile(pronto, CANTEIRO)).toBe(0);
    // e o laborer volta ao comeco, sem tarefa pendurada, e o quadro nao guarda nada da rua
    const depois = step(pronto, []);
    expect(fsmDe(depois, laborer)).toBe('ocioso');
    expect(depois.jobs.tarefas.ordem).toEqual([]);

    expect(ESTADOS_DO_LABORER).toHaveLength(5);
  });

  it('a pedra sai do armazem UMA vez, na COLETA do serf — nao no comando, nem no assentamento', () => {
    // INVERTEU: era "o assentamento debita EXATAMENTE uma pedra". A metade (c) do
    // aceite da F18g: o debito acontece na entrega da carga, e o assentamento so
    // transforma a pedra do chao em rua.
    const { estado } = comOCanteiro();
    const custo = gameData.terreno.estrada.custoStonePorTile;
    const bensAntes = bensPorMercadoria(estado).stone ?? 0;
    const saidaAntes = saidaDoArmazem(estado);
    expect(reservadoNaOrigem(estado, ARMAZEM, MERCADORIA_DA_ESTRADA)).toBe(0); // assentar nao reserva

    let atual = estado;
    let tickDaColeta: number | null = null;
    let tickDaEntrega: number | null = null;
    let tickDoAssentamento: number | null = null;
    for (let i = 0; i < 200 && !assentado(atual); i += 1) {
      const antes = atual;
      atual = step(atual, []);
      if (saidaDoArmazem(atual) !== saidaAntes && tickDaColeta === null) tickDaColeta = atual.tick;
      if (pedraNoTile(atual, CANTEIRO) > 0 && tickDaEntrega === null) tickDaEntrega = atual.tick;
      if (assentado(atual)) tickDoAssentamento = atual.tick;
      // conservacao tick a tick: armazem + mao do serf + tile = constante ate a rua nascer
      if (!assentado(atual)) expect(bensPorMercadoria(atual).stone).toBe(bensAntes);
      // e a gaveta do armazem so cai UMA vez, de exatamente `custo`
      expect(saidaAntes - saidaDoArmazem(atual)).toBeLessThanOrEqual(custo);
      void antes;
    }
    expect(tickDaColeta).not.toBeNull();
    expect(tickDaEntrega).not.toBeNull();
    expect(tickDoAssentamento).not.toBeNull();
    expect(tickDaColeta ?? 0).toBeGreaterThan(estado.tick);          // nao no comando
    expect(tickDaColeta ?? 0).toBeLessThan(tickDaEntrega ?? 0);      // a pedra viaja
    expect(tickDaEntrega ?? 0).toBeLessThan(tickDoAssentamento ?? 0); // e descansa no tile antes
    expect(saidaDoArmazem(atual)).toBe(saidaAntes - custo);
    expect(bensPorMercadoria(atual).stone).toBe(bensAntes - custo); // virou rua
    expect(disponivelNaOrigem(atual, ARMAZEM, MERCADORIA_DA_ESTRADA)).toBe(saidaAntes - custo);
  });

  it('a invariante da FSM continua ACUSANDO: assentando sem a tarefa na mao', () => {
    const { estado, tarefa: tarefaId } = comOCanteiro();
    const laborer = laborersDoCenario(estado)[0];
    if (laborer === undefined) throw new Error('fixture: cenario sem laborer');
    const martelando = ate(estado, (e) => fsmDe(e, laborer) === 'martelando', 'a pedra chega e o laborer martela');
    const u = martelando.unidades.porId[laborer];
    if (u === undefined) throw new Error('fixture: o laborer sumiu');
    const orfao: GameState = {
      ...martelando,
      unidades: { ...martelando.unidades, porId: { ...martelando.unidades.porId, [laborer]: { ...u, fsmData: {} } } },
    };
    expect(violacoesDaFsmDoLaborer(orfao)).toEqual([
      `${laborer}: martelando sem tarefa de laborer reclamada por ele`,
      `${tarefaId}: o laborer ${laborer} nao a reconhece (fsmData.tarefa='undefined')`,
    ]);
  });

  it('as invariantes ficam vazias em TODO tick da corrida, das tres familias', () => {
    let atual = comOCanteiro().estado;
    for (let i = 0; i < 80; i += 1) {
      atual = step(atual, []);
      expect(violacoesDeInvariantes(atual)).toEqual([]);
      expect(violacoesDaFsmDoLaborer(atual)).toEqual([]);
      expect(violacoesDaFsm(atual)).toEqual([]);
    }
    expect(assentado(atual)).toBe(true);
  });
});

describe('F18d-1b + F18g — os ramos de falha', () => {
  it('o tile sai do canteiro no meio da viagem: o laborer volta a ocioso, a carga cai e a reserva volta', () => {
    const { estado, tarefa } = comOCanteiro();
    const laborer = laborersDoCenario(estado)[0];
    if (laborer === undefined) throw new Error('fixture: cenario sem laborer');
    const andando = step(step(estado, []), []);
    expect(fsmDe(andando, laborer)).toBe('indo_a_obra');

    const semCanteiro = step({ ...andando, estradasPlanejadas: {} }, []);
    expect(semCanteiro.jobs.tarefas.porId[tarefa]).toBeUndefined();
    expect(cargasDePedra(semCanteiro)).toBe(0);
    expect(reservadoNaOrigem(semCanteiro, ARMAZEM, MERCADORIA_DA_ESTRADA)).toBe(0);
    expect(fsmDe(semCanteiro, laborer)).toBe('ocioso');
    expect(violacoesDaFsmDoLaborer(semCanteiro)).toEqual([]);
  });

  it('sem pedra em armazem nenhum o laborer NAO vai esperar num tile que ninguem abastece', () => {
    // O espelho de `obraTrabalhavel`: o tile sem pedra e sem carga nao e trabalho.
    // Era o travamento que a Opcao A abria — 2 de pedra, 30 tiles, laborers
    // esperando onde a pedra nunca chega — e este teste e o guarda dele.
    const seco = comPedraNaSaida(comOCanteiro().estado, ARMAZEM, 0);
    const laborer = laborersDoCenario(seco)[0];
    if (laborer === undefined) throw new Error('fixture: cenario sem laborer');
    let atual = seco;
    for (let i = 0; i < 30; i += 1) {
      atual = step(atual, []);
      expect(fsmDe(atual, laborer)).toBe('ocioso');
      expect(cargasDePedra(atual)).toBe(0);
    }
    expect(ehPlanejada(atual.estradasPlanejadas, CANTEIRO)).toBe(true);
    expect(violacoesDeInvariantes(atual)).toEqual([]);

    // a pedra chega ao armazem (a pedreira produziu): a carga nasce, ele vai, e assenta
    const comPedra = comPedraNaSaida(atual, ARMAZEM, 3);
    const pronto = ate(comPedra, assentado, 'com pedra no armazem o tile e assentado');
    expect(fsmDe(step(pronto, []), laborer)).toBe('ocioso');
  });
});
