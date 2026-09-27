/**
 * F18d-1a — o modo de busca de cada nivel da escada de entrega vem do DADO
 * (`delivery.json: prioridades[].modo`), nao de um literal digitado em `.ts`.
 *
 * A regra tem dois lados (decisao do operador, 2026-09-23): entregar material
 * NUMA CONSTRUCAO anda livre, por qualquer tile — e assim que a primeira casa
 * sobe sem rua; COLETAR DE PRODUCAO exige estrada — sem rua o material fica
 * parado na gaveta. O criterio que separa os dois e o DESTINO.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState, Predio, TarefaSaidaCheiaParaArmazem } from '../src/sim/state';
import {
  custoDaTarefa, elegivelParaTarefa, ligacaoEntrePredios, modoDoTipo, planoDaTarefa, portasDaTarefa,
  TIPO_QUE_CARREGA,
} from '../src/sim/jobs';
import { tilesDaPorta } from '../src/sim/estradas';
import { buscarCaminho } from '../src/sim/pathfinding';
import { step } from '../src/sim/tick';
import {
  armazemDoCenario, cenarioLigado, comAPortaTapada, comArmazemCompleto, comEstradas, comObra, comPedraNaSaida,
  comPredioCompletoEm, comTarefas, inicial, semLaborers, serfsDoCenario, tarefaDe,
} from './helpers/jobs-cenario';
import { comProdutorOcupado, disponivelDe } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { linhaHDe, linhaVDe, naVila } from './helpers/ancoras';

const obraDe = (estado: GameState, id: string): Predio => {
  const predio = estado.predios.porId[id];
  if (predio === undefined) throw new Error(`fixture: predio '${id}' nao existe`);
  return predio;
};

describe('F18d-1a — o modo mora no dado, lido pelo id do nivel', () => {
  it('nivel 3 (material para obra) e livre; os outros tipos QUE EXISTEM sao estrada', () => {
    expect(modoDoTipo('material-para-obra')).toBe('livre');
    // F20a: `comida-para-inn` passou a ser tipo de tarefa e entra na lista. A
    // assercao fica mais ESTRITA que a de antes — `modoDoTipo` agora e chamada
    // com o tipo de tarefa, nao so com o id da escada.
    for (const tipo of ['comida-para-inn', 'ouro-para-escola', 'insumo-producao-parada',
      'insumo-producao-baixa', 'saida-cheia-para-armazem', 'excedente-para-armazem'] as const) {
      expect(modoDoTipo(tipo)).toBe('estrada');
      expect(elegivelParaTarefa(tipo, TIPO_QUE_CARREGA)).toBe(true);
    }
  });

  it('toda linha da escada publica um modo — a lista do teste e a do dado, nao uma copia', () => {
    const daEscada = gameData.entrega.prioridades.map((p) => [p.id, p.modo]);
    expect(daEscada).toEqual([
      ['comida-para-inn', 'estrada'],
      ['ouro-para-escola', 'estrada'],
      ['material-para-obra', 'livre'],
      ['insumo-producao-parada', 'estrada'],
      ['insumo-producao-baixa', 'estrada'],
      // F18g: a pedra do canteiro e carga de serf, 'livre' pelo MESMO criterio do
      // nivel 3 — o canteiro nao tem rua por onde chegar. Sexta desde o lote 2.
      ['pedra-para-canteiro', 'livre'],
      ['saida-cheia-para-armazem', 'estrada'],
      ['excedente-para-armazem', 'estrada'],
      // F18d-1b: o (entao) oitavo nivel entrou no fim, e e 'livre' pelo MESMO
      // criterio do nivel 3 — tile planejado nao tem rua por onde se chegar nele.
      ['assentar-estrada', 'livre'],
      // F18h: o nono, e 'livre' pelo MESMO criterio — nao ha rua ate a roca que
      // ainda nao existe.
      ['arar', 'livre'],
    ]);
  });

  it('id fora da escada e modo invalido falham alto, em vez de assumir um padrao', () => {
    // 'construir' e 'ocupar' estao FORA da escada de proposito (nao sao transporte)
    expect(() => modoDoTipo('construir' as never)).toThrow(/nao esta na escada/);
    const torto: GameData = {
      ...gameData,
      entrega: {
        ...gameData.entrega,
        prioridades: gameData.entrega.prioridades.map(
          (p) => (p.id === 'material-para-obra' ? { ...p, modo: 'a-cavalo' } : p),
        ),
      },
    };
    expect(() => modoDoTipo('material-para-obra', torto)).toThrow(/modo/);
  });
});

describe('F18d-1a — as portas e a perna de entrega seguem o modo do nivel', () => {
  const semRua = comObra(semLaborers(inicial), 'obra-a', { ...naVila(-3, 4), faltam: { stone: 1 } });
  const serf = serfsDoCenario(semRua)[0] ?? '';

  it('sem nenhuma estrada, o nivel 3 tem plano; a perna de entrega e o A* LIVRE entre as portas', () => {
    const estado = comTarefas(semRua, [tarefaDe({ numero: 1 })]);
    const plano = planoDaTarefa(estado, tarefaDe({ numero: 1 }), serf);
    if (plano === null) throw new Error('esperava plano: a entrega em obra anda livre');
    // o numero nao e digitado: sai do mesmo A* que a sim usa, da porta de coleta
    // escolhida (ultimo tile da perna livre) ate a porta INTEIRA da obra
    const porta = plano.ateAOrigem.tiles[plano.ateAOrigem.tiles.length - 1];
    if (porta === undefined) throw new Error('perna ate a origem sem tiles');
    const esperado = buscarCaminho(estado, porta, tilesDaPorta(obraDe(estado, 'obra-a')), 'livre');
    expect(plano.deEntrega.custo).toBe(esperado?.custo);
  });

  it('a porta de entrega do nivel 3 e a borda sul INTEIRA, nao so o tile que e estrada', () => {
    const estado = comTarefas(semRua, [tarefaDe({ numero: 1 })]);
    const portas = portasDaTarefa(estado, 'obra-a', 'livre');
    expect(portas).toEqual(tilesDaPorta(obraDe(estado, 'obra-a')));
    expect(portasDaTarefa(estado, 'obra-a', 'estrada')).toEqual([]);
  });

  it('o verificador ACUSA a tarefa sem caminho, e diz em que modo a busca falhou', () => {
    // prova do guarda: sem isto, "nenhuma violacao" poderia ser verdade so porque o
    // verificador ficou cego depois que o nivel 3 trocou de modo.
    const tapado = comAPortaTapada(comTarefas(semRua, [tarefaDe({ numero: 1 })]), 'obra-a', 'quarry');
    expect(violacoesDeInvariantes(tapado)).toEqual([`t1: sem caminho no modo 'livre'`]);
    expect(violacoesDeInvariantes(comTarefas(semRua, [tarefaDe({ numero: 1 })]))).toEqual([]);
  });

  it('no mesmo cenario um nivel 6 (coleta de producao) continua sem plano', () => {
    const comPedreira = comPredioCompletoEm(semRua, 'pedreira', { tipo: 'quarry', ...naVila(11, 4) });
    const tarefa: TarefaSaidaCheiaParaArmazem = {
      id: 't9', numero: 9, tipo: 'saida-cheia-para-armazem', mercadoria: 'stone',
      origem: 'pedreira', destino: armazemDoCenario(inicial).id, estado: 'aberta', reclamadaPor: null,
    };
    const estado = comTarefas(comPedreira, [tarefa]);
    expect(planoDaTarefa(estado, tarefa, serf)).toBeNull();
    expect(custoDaTarefa(estado, tarefa, null)).toBeNull();
  });
});

/**
 * O ACEITE escrito no BUILD_PLAN, num cenario so e sem uma unica estrada no mapa:
 * a primeira casa sobe (serf entrega andando livre) e, no MESMO cenario, a pedreira
 * pronta nao escoa — a gaveta so esvazia depois que a rua existe.
 *
 * O ROTULO do pedreiro sem rua mudou com a revogacao da D6 (decisao do operador,
 * 2026-09-25): era `saida_cheia` pelo PORTAO ("predio desligado nao produz"), que
 * deixou de existir. Agora ele e `esperando_insumo`, e isso e mais verdadeiro para
 * esta fixture — a pedreira esta em (36,34), no descampado, com ZERO rocha ao
 * alcance, e e disso que ele espera. O aceite em si nao mudou: o que ele afirma e
 * que sem rua a gaveta NAO escoa, e ela continua nao escoando.
 */
function medirOAceite(): {
  readonly semRua: Record<string, unknown>; readonly comRua: Record<string, unknown>;
} {
  const saidaDe = (estado: GameState, id: string): Record<string, number> => {
    const p = estado.predios.porId[id];
    return p !== undefined && p.estado === 'completo' ? p.estoque.saida : {};
  };
  const inicioDaObra = comObra(inicial, 'obra-a', { ...naVila(-3, 4), faltam: { stone: 2, timber: 3 }, nivelamento: 0 });
  const comPedreira = comProdutorOcupado(
    inicioDaObra, { tipo: 'quarry', id: 'pedreira', unidade: 'pedreiro', ...naVila(7, 4) }, gameData,
  );
  const partida = comPedraNaSaida(comPedreira, 'pedreira', 5); // gaveta CHEIA: capacidade 5
  const armazem = armazemDoCenario(partida).id;

  let atual = partida;
  let prontaNoTick: number | null = null;
  for (let i = 1; i <= 400; i += 1) {
    atual = step(atual, []);
    if (prontaNoTick === null && atual.predios.porId['obra-a']?.estado === 'completo') prontaNoTick = i;
  }
  const semRua = {
    estradasNoMapa: Object.keys(atual.estradas).length,
    obraCompletaNoTick: prontaNoTick,
    pedreiro: atual.unidades.porId['pedreiro']?.fsm,
    rochaAoAlcanceDaPedreira: disponivelDe(atual, 'pedreira'),
    pedraNaGavetaDaPedreira: saidaDe(atual, 'pedreira').stone,
    tarefasDeColeta: atual.jobs.tarefas.ordem
      .filter((id) => atual.jobs.tarefas.porId[id]?.tipo === 'saida-cheia-para-armazem').length,
    pedraNoArmazem: { antes: saidaDe(partida, armazem).stone, depois: saidaDe(atual, armazem).stone },
  };

  // a rua chega: porta da pedreira (y=36) ate a porta do armazem (29,33)
  let comRuaAgora = comEstradas(atual, [...linhaHDe(naVila, 0, 9, 6), ...linhaVDe(naVila, 0, 3, 5)]);
  let escoouNoTick: number | null = null;
  for (let i = 1; i <= 400; i += 1) {
    comRuaAgora = step(comRuaAgora, []);
    if (escoouNoTick === null && (saidaDe(comRuaAgora, 'pedreira').stone ?? 0) < 5) escoouNoTick = i;
  }
  const comRua = {
    escoouNoTick,
    pedreiro: comRuaAgora.unidades.porId['pedreiro']?.fsm,
    pedraNaGavetaDaPedreira: saidaDe(comRuaAgora, 'pedreira').stone ?? 0,
    pedraNoArmazem: saidaDe(comRuaAgora, armazem).stone,
    // F-T2a: o PORQUE de o pedreiro nao voltar a produzir depois de a gaveta
    // esvaziar. Sem este campo o `esperando_insumo` abaixo seria so um numero
    // trocado; com ele, a assercao diz de que falta se trata.
    rochaAoAlcanceDaPedreira: disponivelDe(comRuaAgora, 'pedreira'),
  };
  return { semRua, comRua };
}

/** A linha de base do armazem vem do dado, nunca digitada. */
const STONE_INICIAL = gameData.economia.estadoInicial.estoque['stone'] ?? 0;

describe('F18d-1a — o aceite do BUILD_PLAN', () => {
  it('sem nenhuma estrada a obra fica completa; a pedreira nao escoa ate a rua existir', () => {
    const { semRua, comRua } = medirOAceite();
    expect(semRua).toEqual({
      estradasNoMapa: 0, // o mapa inteiro sem uma rua, do primeiro ao ultimo tick
      obraCompletaNoTick: 247, // a casa subiu: serf entregou andando livre
      // revogacao da D6 (2026-09-25): sem o portao o rotulo vem da FALTA, e a falta
      // desta fixture e rocha — `rochaAoAlcanceDaPedreira` abaixo e o que faz este
      // rotulo ser uma causa e nao um numero trocado
      pedreiro: 'esperando_insumo',
      rochaAoAlcanceDaPedreira: 0, // (36,34) e descampado: nao ha o que colher ali
      pedraNaGavetaDaPedreira: 5, // a gaveta continua cheia (capacidade 5)
      tarefasDeColeta: 0, // nenhuma tarefa de nivel 6 nasceu
      // F-T4b (2026-09-25): o estoque inicial subiu de 30 para 34 por decisao do
      // operador, e estes tres numeros eram o literal 30 copiado do dado. O que o
      // aceite afirma e o DELTA (-2 na obra, +5 quando a gaveta escoa), nao o saldo:
      // a linha de base vem de `data/economy.json` e girar o numero nao reprova aqui.
      pedraNoArmazem: { antes: STONE_INICIAL, depois: STONE_INICIAL - 2 },
    });
    // F-T2a: a pedreira deste cenario esta em (36,34), no descampado — e desde
    // que a fonte passou a ser o TILE, ali nao ha o que cortar. O que o aceite
    // afirma (a rua faz a gaveta escoar) esta intacto; o que mudou e o que vem
    // DEPOIS de escoar: antes o pedreiro voltava a produzir do veio que nascia
    // com o predio, agora ele fica esperando uma rocha que nao existe no lugar
    // onde a fixture o pos. O campo `rochaAoAlcanceDaPedreira` fixa a causa.
    expect(comRua).toEqual({
      escoouNoTick: 43, // a rua existe: a tarefa de coleta nasce e o serf vem
      pedreiro: 'esperando_insumo', // sem rocha ao alcance, nao ha ciclo novo
      pedraNaGavetaDaPedreira: 0,
      pedraNoArmazem: STONE_INICIAL - 2 + 5, // e nada mais: nao houve producao nova
      rochaAoAlcanceDaPedreira: 0,
    });
  });
});

afterAll(() => {
  const { semRua, comRua } = medirOAceite();

  // a origem do nivel 3 sai da distancia A PE, e nao da rede de estradas: o armazem
  // 'vizinho' nao encosta na rua, e mesmo assim ganha do que esta ligado
  let escolha = cenarioLigado({ stone: 1 }); // `obra-a` ligada a porta do armazem do cenario
  escolha = comArmazemCompleto(escolha, 'vizinho', { ...naVila(-6, 2), stone: 10 });
  escolha = comEstradas(escolha, linhaHDe(naVila, -1, 24, 6));
  const predioDe = (id: string): Predio => {
    const p = escolha.predios.porId[id];
    if (p === undefined) throw new Error(`evidencia: predio '${id}' nao existe`);
    return p;
  };
  const ate = (de: string): Record<string, number | null> => ({
    aPeEmTicks: ligacaoEntrePredios(escolha, predioDe(de), predioDe('obra-a'), 'livre'),
    porEstradaEmPassos: ligacaoEntrePredios(escolha, predioDe(de), predioDe('obra-a'), 'estrada'),
  });
  const depoisDeUmTick = step(escolha, []);
  const primeiraTarefa = depoisDeUmTick.jobs.tarefas.ordem
    .map((id) => depoisDeUmTick.jobs.tarefas.porId[id])
    .find((t) => t?.tipo === 'material-para-obra');

  gravarEvidencia('F18d-1a', {
    feature: 'F18d-1a-modo-por-nivel',
    // VERIFICADO por teste headless: o aceite escrito no BUILD_PLAN.md.
    aceite: {
      aPrimeiraCasaSobeSemEstrada: semRua,
      aProducaoSoEscoaComEstrada: comRua,
      modoPorNivel: gameData.entrega.prioridades.map((p) => [p.id, p.modo]),
      origemDoNivel3PorDistanciaAPe: {
        vizinhoForaDaRede: ate('vizinho'),
        armazemLigado: ate(armazemDoCenario(escolha).id),
        origemEscolhida: primeiraTarefa?.origem ?? null,
      },
    },
    // MEDIDO nesta sessao (2 corridas mornas de `npx vitest run` cada, mesma maquina,
    // a de "antes" com a arvore em `git stash`): o A* livre por par armazem x obra
    // custa ~5%, longe do teto de 2x que o plano mandava parar.
    tempoDaSuiteEmMs: { antes: [21562, 22392], depois: [22748, 23087] },
  });
});
