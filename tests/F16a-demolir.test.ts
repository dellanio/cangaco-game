/**
 * F16a — Tarefa 4: os casos da demolicao, PELO COMANDO REAL.
 *
 * O aceite escrito no BUILD_PLAN e "demole um predio com tarefa em curso pelo
 * comando real e confirma que nenhuma tarefa orfa sobrou no JobBoard e nenhum
 * serf ficou travado" — os casos 1 e 2 sao esse aceite. Os demais vem das notas
 * do item: F14 (predio ocupado devolve o especialista), decisao do operador de
 * 2026-09-23 (o estoque interno vai INTEIRO para o armazem mais proximo
 * alcancavel; sem armazem alcancavel se perde, e o teste DECLARA a perda) e a
 * conta da devolucao, que tem que seguir o dado e nao um numero digitado aqui.
 *
 * O caso da PORTA (nota da F13a) mora em `F16a-porta.test.ts`: ele foi a sonda
 * rodada ANTES de existir `DemolishBuilding` e, depois da correcao do `canPlace`,
 * virou o teste da recusa. Nao se repete aqui — um caso, um lugar.
 *
 * As invariantes (`violacoesDeInvariantes`, `violacoesDaFsm`) sao conferidas a
 * CADA tick da corrida, nao so no fim: o estado intermediario e onde uma tarefa
 * orfa apareceria e sumiria sem deixar rastro.
 */
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameEvent, GameState } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import type { GameData } from '../src/sim/data/types';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { estoqueTotal } from '../src/sim/selectors';
import { custoDoPredio } from '../src/sim/obra';
import { filaDaEscola } from '../src/sim/escola';
import { trabalhadorDoTipo } from '../src/sim/ocupacao';
import { armazemDeDestino, mercadoriasDevolvidas } from '../src/sim/systems/demolicao';
import { compararComESemSave } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsm } from './helpers/serf-invariantes';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import {
  armazemDoJogo, ate, cenarioLongo, fsmDe, liberacoes, quieto, saidaDe, serfDoJogo,
} from './helpers/serf-cenario';
import {
  comEstoqueNaSaida, comEstradas, comPredioCompletoEm, comUnidadeExtra, linhaH, semLaborers,
  serfsDoCenario,
} from './helpers/jobs-cenario';
import {
  armazemPorTipo, comOuroNoArmazem, escolaDoCenario, pedir, totalDeOuro,
} from './helpers/escola-cenario';
import { cenarioDePedreira, comSaida } from './helpers/producao-cenario';
import { validarTudo } from '../tools/data-rules.js';
import { ARQUIVOS } from '../tools/data-schema.js';

const inicial = createInitialState(1);
const ARMAZEM = armazemDoJogo.id;
const ESCOLA = escolaDoCenario(inicial).id;
const PEDREIRO = trabalhadorDoTipo('quarry') ?? '';
const FRACAO = gameData.construcao.devolucaoAoDemolir;
/** Custo da quarry e da escola, do dado: nenhum numero de balanceamento aqui. */
const defDe = (tipo: string) => {
  const def = gameData.predios.find((p) => p.id === tipo);
  if (!def) throw new Error(`fixture: tipo '${tipo}' nao existe em buildings.json`);
  return def;
};
const CUSTO_QUARRY = custoDoPredio(defDe('quarry'));
const CUSTO_ESCOLA = custoDoPredio(defDe('schoolhouse'));

const demolir = (predio: string): Command => ({ type: 'DemolishBuilding', predio });

/** O MESMO `GameData` com outra fracao de devolucao — o caminho da F08
 *  (`dadosDeEstrada`): o dado de verdade com outro numero, nunca um `data/*.json`
 *  alterado para um teste passar. */
const dadosComDevolucao = (valor: number): GameData =>
  ({ ...gameData, construcao: { ...gameData.construcao, devolucaoAoDemolir: valor } });

/**
 * A colecao de predios esta coerente: todo id de `ordem` tem entrada em `porId`, e
 * vice-versa. Nasceu de uma SONDA desta sessao: apagar o predio de `porId` sem
 * tira-lo de `ordem` passava nos 21 casos, porque quase todo laco do jogo faz
 * `if (!predio) continue`. O id orfao nao quebra nada hoje e apareceria como bug
 * de save meses depois — entao a demolicao e quem paga por conferir isso.
 */
function violacoesDaColecaoDePredios(e: GameState): string[] {
  const v: string[] = [];
  for (const id of e.predios.ordem) {
    if (e.predios.porId[id] === undefined) v.push(`predios.ordem tem '${id}' sem entrada em porId`);
  }
  for (const id of Object.keys(e.predios.porId)) {
    if (!e.predios.ordem.includes(id)) v.push(`predios.porId tem '${id}' fora de ordem`);
  }
  return v;
}

interface Corrida {
  readonly estado: GameState;
  readonly eventos: GameEvent[];
  readonly violacoes: string[];
  readonly fsms: string[];
  readonly ticks: number;
}

/** Roda a partir de `inicio` (os comandos so no primeiro tick) ate `parar` valer,
 *  guardando eventos, violacoes e a FSM do serf observado a cada tick. */
function rodar(
  inicio: GameState, comandos: readonly Command[], parar: (e: GameState) => boolean,
  observado: string = serfDoJogo, maximo = 400,
): Corrida {
  const eventos: GameEvent[] = [];
  const violacoes: string[] = [];
  const fsms: string[] = [];
  let atual = inicio;
  let ticks = 0;
  for (let i = 0; i < maximo; i++) {
    atual = step(atual, i === 0 ? comandos : []);
    ticks += 1;
    eventos.push(...atual.events);
    fsms.push(fsmDe(atual, observado));
    for (const v of [...violacoesDeInvariantes(atual), ...violacoesDaFsm(atual), ...violacoesDaColecaoDePredios(atual)]) {
      violacoes.push(`tick ${atual.tick}: ${v}`);
    }
    if (parar(atual)) break;
  }
  return { estado: atual, eventos, violacoes, fsms, ticks };
}

const demolicoes = (eventos: readonly GameEvent[]): Extract<GameEvent, { type: 'building-demolished' }>[] =>
  eventos.filter((e): e is Extract<GameEvent, { type: 'building-demolished' }> => e.type === 'building-demolished');

const tarefasDe = (e: GameState, destino: string): string[] =>
  e.jobs.tarefas.ordem.filter((id) => e.jobs.tarefas.porId[id]?.destino === destino);

const evidencia: Record<string, unknown> = {};

afterAll(() => {
  gravarEvidencia('F16a', {
    feature: 'F16a — Demolir predio (sim)',
    aceite: {
      clausula: 'demole um predio com tarefa em curso PELO COMANDO REAL; nenhuma tarefa orfa no JobBoard; nenhum serf travado',
      ...(evidencia.aceite as Record<string, unknown>),
    },
    sondasDeMutacao: {
      natureza: 'prova do MOMENTO (CLAUDE.md §8): o fonte foi mutado a mao e revertido; nao e cobertura continua — quem protege daqui para frente sao as asercoes deste arquivo',
      'devolucao desligada (devolverMercadorias -> state.predios)': '4 casos reprovaram',
      'id orfao (semOPredio sem filtrar predios.ordem)': 'os 21 casos passavam; dai nasceu violacoesDaColecaoDePredios, que agora acusa',
    },
    dado: {
      'construcao.devolucaoAoDemolir': FRACAO,
      'custo.quarry': CUSTO_QUARRY,
      'custo.schoolhouse': CUSTO_ESCOLA,
    },
    casos: {
      portaDaEscola: {
        onde: 'tests/F16a-porta.test.ts (Tarefa 1, rodada antes do comando existir)',
        evidencia: 'test-output/F16a-porta.json',
        resumo: 'a hipotese da F13a nao se confirmou; a via real era o footprint sobre a porta, e o canPlace passou a recusa-la',
      },
      ...(evidencia.casos as Record<string, unknown>),
    },
  });
});

describe('F16a — obra demolida com o serf a caminho (aceite, pelo comando real)', () => {
  const cenario = cenarioLongo(); // obra-a (quarry) em (44,34), faltam { stone: 1 }, 10 de pedra no armazem

  it('serf CARREGANDO: tarefa liberada por destino-sumiu, carga de volta no armazem, serf ocioso', () => {
    // No MEIO da viagem (x>=38 na rua y=36), nao no tick em que coletou: assim a volta
    // com a carga e uma caminhada de verdade, e nao um deposito no mesmo tile.
    const comCarga = ate(
      cenario,
      (e) => fsmDe(e) === 'indo_entregar' && (e.unidades.porId[serfDoJogo]?.gx ?? 0) >= 38,
      'o serf com a carga no meio da rua',
    );
    const pedraAntes = saidaDe(comCarga, ARMAZEM);
    expect(pedraAntes).toBe(9); // 10 menos a que esta com o serf

    const corrida = rodar(comCarga, [demolir('obra-a')], quieto);

    expect(corrida.estado.predios.porId['obra-a']).toBeUndefined();
    expect(corrida.estado.predios.ordem).not.toContain('obra-a');
    expect(liberacoes(corrida.eventos).map((e) => ({ motivo: e.motivo, resultado: e.resultado })))
      .toEqual([{ motivo: 'destino-sumiu', resultado: 'cancelada' }]);
    expect(tarefasDe(corrida.estado, 'obra-a')).toEqual([]);
    expect(corrida.fsms).toContain('devolvendo');
    expect(fsmDe(corrida.estado)).toBe('ocioso');
    expect(corrida.estado.unidades.porId[serfDoJogo]?.fsmData).toEqual({});
    expect(saidaDe(corrida.estado, ARMAZEM)).toBe(pedraAntes + 1);
    expect(corrida.violacoes).toEqual([]);

    evidencia.aceite = {
      serfCarregando: {
        ticksAteQuieto: corrida.ticks,
        liberacoes: liberacoes(corrida.eventos).map((e) => ({ tarefa: e.tarefa, motivo: e.motivo, resultado: e.resultado })),
        tarefasComDestinoNaObra: tarefasDe(corrida.estado, 'obra-a').length,
        fsmDoSerf: { passouPor: [...new Set(corrida.fsms)], fim: fsmDe(corrida.estado) },
        pedraNoArmazem: { antes: pedraAntes, depois: saidaDe(corrida.estado, ARMAZEM) },
        violacoesEmTodosOsTicks: corrida.violacoes.length,
      },
    };
  });

  it('serf ainda INDO BUSCAR: a tarefa cai sem carga nenhuma para devolver', () => {
    const indoBuscar = ate(cenario, (e) => fsmDe(e) === 'indo_buscar', 'o serf a caminho da origem');
    const pedraAntes = saidaDe(indoBuscar, ARMAZEM);
    expect(pedraAntes).toBe(10); // ainda nao coletou

    const corrida = rodar(indoBuscar, [demolir('obra-a')], quieto);

    expect(liberacoes(corrida.eventos).map((e) => e.motivo)).toEqual(['destino-sumiu']);
    expect(corrida.fsms).not.toContain('devolvendo');
    expect(fsmDe(corrida.estado)).toBe('ocioso');
    expect(saidaDe(corrida.estado, ARMAZEM)).toBe(pedraAntes);
    expect(corrida.estado.jobs.tarefas.ordem).toEqual([]);
    expect(corrida.violacoes).toEqual([]);

    evidencia.aceite = {
      ...(evidencia.aceite as Record<string, unknown>),
      serfIndoBuscar: {
        ticksAteQuieto: corrida.ticks,
        liberacoes: liberacoes(corrida.eventos).map((e) => ({ tarefa: e.tarefa, motivo: e.motivo })),
        tarefasNoQuadroNoFim: corrida.estado.jobs.tarefas.ordem.length,
        fsmDoSerf: { passouPor: [...new Set(corrida.fsms)], fim: fsmDe(corrida.estado) },
        pedraNoArmazem: { antes: pedraAntes, depois: saidaDe(corrida.estado, ARMAZEM) },
        violacoesEmTodosOsTicks: corrida.violacoes.length,
      },
    };
  });

  it('a obra demolida devolve a fracao do que JA foi entregue, ao armazem ligado', () => {
    // faltam { stone: 1 } => entregue = { timber: 3, stone: 1 }; devolve floor(x FRACAO).
    const entregue = { timber: CUSTO_QUARRY.timber, stone: CUSTO_QUARRY.stone - 1 };
    const esperado: Record<string, number> = {};
    for (const [m, n] of Object.entries(entregue)) {
      if (Math.floor(n * FRACAO) > 0) esperado[m] = Math.floor(n * FRACAO);
    }
    const obra = cenario.predios.porId['obra-a'];
    if (!obra) throw new Error('fixture: obra-a ausente');
    expect(mercadoriasDevolvidas(obra, gameData)).toEqual(esperado);

    const antes = estoqueTotal(cenario);
    const depois = estoqueTotal(step(cenario, [demolir('obra-a')]));
    for (const [m, n] of Object.entries(esperado)) {
      expect(depois[m] ?? 0).toBe((antes[m] ?? 0) + n);
    }
  });
});

describe('F16a — escola demolida com a tarefa de ouro ja reclamada (nota da revisao da F13a)', () => {
  /** A mesma rua do aceite da F13a: armazem (x 29..31) e escola (x 34..36), porta em y=33. */
  const cenarioDaEscola = comOuroNoArmazem(
    comEstradas(semLaborers(inicial), linhaH(29, 36, 33)), armazemPorTipo(inicial).id, 1,
  );

  it('o serf com o ouro na mao: destino-sumiu, fila apagada e o ouro conservado', () => {
    const pedido = step(cenarioDaEscola, [pedir(ESCOLA, 'serf')]);
    const emRota = ate(
      pedido,
      (e) => e.jobs.tarefas.ordem.some((id) => {
        const t = e.jobs.tarefas.porId[id];
        return t?.tipo === 'ouro-para-escola' && t.estado === 'carregando';
      }),
      'a tarefa de ouro carregando (o serf ja coletou)',
    );
    expect(totalDeOuro(emRota)).toBe(1); // em transito, com o serf
    expect(filaDaEscola(emRota, ESCOLA)).toHaveLength(1);

    const carregador = serfsDoCenario(emRota).find((id) => emRota.unidades.porId[id]?.fsmData.carga !== undefined);
    if (carregador === undefined) throw new Error('fixture: nenhum serf com carga');

    const corrida = rodar(
      emRota, [demolir(ESCOLA)],
      (e) => serfsDoCenario(e).every((id) => fsmDe(e, id) === 'ocioso'), carregador,
    );

    expect(corrida.estado.predios.porId[ESCOLA]).toBeUndefined();
    expect(liberacoes(corrida.eventos).map((e) => e.motivo)).toEqual(['destino-sumiu']);
    expect(tarefasDe(corrida.estado, ESCOLA)).toEqual([]);
    // `sanearFilas`: a escola sumiu, a fila dela sai do estado inteira (nao fica `{ [ESCOLA]: [] }`).
    expect(corrida.estado.treino).toEqual({});
    expect(filaDaEscola(corrida.estado, ESCOLA)).toEqual([]);
    // Conservacao: o ouro em transito volta pelo `devolvendo`, e nenhum foi cobrado.
    expect(totalDeOuro(corrida.estado)).toBe(1);
    expect(corrida.fsms).toContain('devolvendo');
    expect(corrida.violacoes).toEqual([]);

    evidencia.casos = {
      ...(evidencia.casos as Record<string, unknown>),
      escolaComOuroReclamado: {
        ramo: "motivoDoDestino: ehEscolaCompleta(destino) ? null : 'destino-sumiu' (systems/jobs.ts)",
        liberacoes: liberacoes(corrida.eventos).map((e) => ({ tarefa: e.tarefa, motivo: e.motivo, resultado: e.resultado })),
        filaDepois: corrida.estado.treino,
        ouroNoMapa: { antes: totalDeOuro(emRota), depois: totalDeOuro(corrida.estado) },
        fsmDoCarregador: [...new Set(corrida.fsms)],
        violacoesEmTodosOsTicks: corrida.violacoes.length,
      },
    };
  });

  it('a escola completa devolve a fracao do custo INTEIRO (nao tem mais faltam)', () => {
    const escola = cenarioDaEscola.predios.porId[ESCOLA];
    if (!escola) throw new Error('fixture: escola ausente');
    expect(mercadoriasDevolvidas(escola, gameData)).toEqual({
      timber: Math.floor(CUSTO_ESCOLA.timber * FRACAO),
      stone: Math.floor(CUSTO_ESCOLA.stone * FRACAO),
    });
  });
});

describe('F16a — o estoque interno vai INTEIRO para o armazem (decisao do operador)', () => {
  it('predio ocupado e com estoque: o especialista volta a ocioso e a mercadoria vai para o armazem', () => {
    const comEstoque = comSaida(cenarioDePedreira(), 'q1', { stone: 3 });
    const q1 = comEstoque.predios.porId.q1;
    if (!q1) throw new Error('fixture: q1 ausente');
    expect(q1.estado === 'completo' && q1.ocupante).toBe('u1');
    expect(armazemDeDestino(comEstoque, q1, gameData)).toBe(ARMAZEM);

    const pedraAntes = saidaDe(comEstoque, ARMAZEM);
    const tabuaAntes = (comEstoque.predios.porId[ARMAZEM]?.estado === 'completo'
      ? comEstoque.predios.porId[ARMAZEM].estoque.saida.timber ?? 0 : 0);

    const demolido = step(comEstoque, [demolir('q1')]);
    const evento = demolicoes(demolido.events)[0];
    // estoque (3 de pedra) + fracao do custo entregue (quarry: stone 2, timber 3)
    const esperado = {
      stone: 3 + Math.floor(CUSTO_QUARRY.stone * FRACAO),
      timber: Math.floor(CUSTO_QUARRY.timber * FRACAO),
    };
    expect(evento?.devolvido).toEqual(esperado);
    expect(evento?.armazem).toBe(ARMAZEM);
    expect(saidaDe(demolido, ARMAZEM)).toBe(pedraAntes + esperado.stone);
    expect(demolido.predios.porId[ARMAZEM]?.estado === 'completo'
      ? demolido.predios.porId[ARMAZEM].estoque.saida.timber : null).toBe(tabuaAntes + esperado.timber);

    expect(violacoesDaColecaoDePredios(demolido)).toEqual([]);

    const depois = step(step(demolido, []), []);
    expect(depois.unidades.porId.u1?.fsm).toBe('ocioso');
    expect(depois.unidades.porId.u1?.fsmData).toEqual({});
    expect(tarefasDe(depois, 'q1')).toEqual([]);
    expect(violacoesDaFsmDoEspecialista(depois)).toEqual([]);

    evidencia.casos = {
      ...(evidencia.casos as Record<string, unknown>),
      predioOcupadoComEstoque: {
        estoqueInterno: { stone: 3 },
        devolvido: evento?.devolvido,
        armazemDeDestino: evento?.armazem,
        ocupanteDepois: depois.unidades.porId.u1?.fsm,
        tarefasDeOcupacaoOrfas: tarefasDe(depois, 'q1').length,
      },
    };
  });

  it('sem armazem alcancavel a carga SE PERDE, e a perda e esta: 3 de pedra e o material da obra', () => {
    const ilhada = comEstoqueNaSaida(
      comPredioCompletoEm(semLaborers(inicial), 'ilhada', { tipo: 'quarry', gx: 5, gy: 5 }),
      'ilhada', { stone: 3, timber: 0 },
    );
    const predio = ilhada.predios.porId.ilhada;
    if (!predio) throw new Error('fixture: ilhada ausente');
    // Nenhuma estrada liga (5,5) ao armazem: nao ha destino.
    expect(armazemDeDestino(ilhada, predio, gameData)).toBeNull();
    // A conta da devolucao continua a mesma — o que falta e onde por.
    const seriaDevolvido = mercadoriasDevolvidas(predio, gameData);
    expect(seriaDevolvido).toEqual({
      stone: 3 + Math.floor(CUSTO_QUARRY.stone * FRACAO),
      timber: Math.floor(CUSTO_QUARRY.timber * FRACAO),
    });

    const antes = estoqueTotal(ilhada);
    const perdido = step(ilhada, [demolir('ilhada')]);
    const evento = demolicoes(perdido.events)[0];
    expect(evento?.armazem).toBeNull();
    expect(evento?.devolvido).toEqual({});
    const depois = estoqueTotal(perdido);
    // Declarado: o mapa fica com 3 de pedra A MENOS, e nada e criado em lugar nenhum.
    expect((antes.stone ?? 0) - (depois.stone ?? 0)).toBe(3);
    expect(depois.timber ?? 0).toBe(antes.timber ?? 0);
    expect(perdido.predios.porId.ilhada).toBeUndefined();
    expect(violacoesDaColecaoDePredios(perdido)).toEqual([]);

    evidencia.casos = {
      ...(evidencia.casos as Record<string, unknown>),
      semArmazemAlcancavel: {
        estoqueInterno: { stone: 3 },
        seriaDevolvidoSeHouvesseArmazem: seriaDevolvido,
        devolvido: evento?.devolvido,
        armazemDeDestino: evento?.armazem,
        perdaDeclarada: { stone: (antes.stone ?? 0) - (depois.stone ?? 0) },
      },
    };
  });
});

describe('F16a — a devolucao segue o dado, nao um numero no .ts', () => {
  const cenario = comSaida(cenarioDePedreira(), 'q1', {}); // sem estoque interno: so o material da obra

  it('fracao 0 nao devolve nada; fracao 1 devolve o custo inteiro', () => {
    const antes = estoqueTotal(cenario);
    const comZero = estoqueTotal(step(cenario, [demolir('q1')], dadosComDevolucao(0)));
    expect(comZero.stone ?? 0).toBe(antes.stone ?? 0);
    expect(comZero.timber ?? 0).toBe(antes.timber ?? 0);

    const comUm = estoqueTotal(step(cenario, [demolir('q1')], dadosComDevolucao(1)));
    expect(comUm.stone ?? 0).toBe((antes.stone ?? 0) + CUSTO_QUARRY.stone);
    expect(comUm.timber ?? 0).toBe((antes.timber ?? 0) + CUSTO_QUARRY.timber);
  });

  it('e com a fracao real do dado, a metade arredondada para baixo', () => {
    const antes = estoqueTotal(cenario);
    const depois = estoqueTotal(step(cenario, [demolir('q1')]));
    expect((depois.stone ?? 0) - (antes.stone ?? 0)).toBe(Math.floor(CUSTO_QUARRY.stone * FRACAO));
    expect((depois.timber ?? 0) - (antes.timber ?? 0)).toBe(Math.floor(CUSTO_QUARRY.timber * FRACAO));
  });
});

describe('F16a — validate:data: construcao.devolucaoAoDemolir', () => {
  function dadosReaisComDevolucao(valor: unknown): Record<string, unknown> {
    const dados: Record<string, unknown> = {};
    for (const nome of ARQUIVOS) dados[nome] = JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'));
    (dados.buildings as { construcao: { devolucaoAoDemolir: unknown } }).construcao.devolucaoAoDemolir = valor;
    return dados;
  }
  const errosDaRegra = (valor: unknown): string[] =>
    validarTudo(dadosReaisComDevolucao(valor)).filter((e) => e.startsWith('predios/construcao'));

  it('o dado real passa', () => {
    expect(validarTudo(dadosReaisComDevolucao(FRACAO))).toEqual([]);
  });

  it.each([0, 0.5, 1])('%s passa', (v) => {
    expect(errosDaRegra(v)).toEqual([]);
  });

  it.each([1.5, -0.1, '0.5', null, Number.NaN])('%s reprova', (v) => {
    expect(errosDaRegra(v)).toHaveLength(1);
  });
});

describe('F16a — o comando nunca e recusado, e o estado sobrevive ao JSON', () => {
  it('id inexistente e no-op: nem evento, nem estado diferente', () => {
    const antes = step(inicial, []);
    const depois = step(antes, [demolir('nao-existe')]);
    expect(depois.predios).toEqual(antes.predios);
    expect(demolicoes(depois.events)).toEqual([]);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
  });

  it('demolir e determinista: com save no meio, o mesmo JSON', () => {
    const { direto, comSave } = compararComESemSave({
      seed: 1,
      totalTicks: 40,
      saveAtTick: 20,
      comandosNoTick: (t) => (t === 5 ? [demolir(ESCOLA)] : []),
    });
    expect(comSave).toBe(direto);
    expect((JSON.parse(direto) as GameState).predios.porId[ESCOLA]).toBeUndefined();
  });

  it('o predio ocupado demolido nao deixa especialista apontando para ele', () => {
    const cenario = comUnidadeExtra(
      comPredioCompletoEm(semLaborers(inicial), 'q2', { tipo: 'quarry', gx: 26, gy: 36 }),
      'esp1', PEDREIRO, 30, 34,
    );
    const emCaminho = step(step(step(cenario, []), []), []);
    expect(emCaminho.unidades.porId.esp1?.fsm).toBe('indo_ocupar');
    const depois = step(step(emCaminho, [demolir('q2')]), []);
    expect(depois.unidades.porId.esp1?.fsm).toBe('ocioso');
    expect(tarefasDe(depois, 'q2')).toEqual([]);
    expect(violacoesDaFsmDoEspecialista(depois)).toEqual([]);
  });
});
