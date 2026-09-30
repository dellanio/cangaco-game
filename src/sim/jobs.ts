/**
 * O JobBoard (CLAUDE.md §5): criacao, `reclamar` (claim), `liberar` (release) e a
 * reserva dupla — a unidade de recurso na origem e a vaga no destino. Tudo puro:
 * recebe o estado, devolve o estado novo.
 *
 * Quem usa: o `step()` (gerar e sanear tarefas, `systems/jobs.ts`) e, na F10, a FSM
 * do serf. Nada aqui e `Command`: o jogador nao manda serf (CLAUDE.md §1).
 *
 * A RESERVA nao e um campo: e derivada das tarefas `reclamada` (`reservas.ts`).
 * Por isso `reclamar` e atomico por construcao (uma unica atribuicao de estado, so
 * depois de todas as checagens) e `liberar` devolve as DUAS reservas de uma vez.
 */
import type {
  TarefaComidaParaTropa,
  GameEvent, GameState, Predio, Tarefa, TarefaConstruir,
  TarefaExcedenteParaArmazem, TarefaInsumoProducaoBaixa, TarefaInsumoProducaoParada,
  TarefaComidaParaInn, TarefaMaterialParaObra, TarefaOcupar, TarefaOuroParaEscola,
  TarefaArar, TarefaAssentarEstrada, TarefaColher, TarefaComer, TarefaDeLaborer, TarefaSaidaCheiaParaArmazem,
  TarefaDoSerf, TarefaPedraParaCanteiro, TarefaReparar, TarefaArmaParaQuartel, TarefaAlistar,
  TipoComOrigem, TipoDeTarefa,
  TipoNaEscada,
} from './state';
import {
  ehTarefaDeAradura, ehTarefaDeAssentamento, ehTarefaDeColheita, ehTarefaDeLaborer, ehTarefaDePedraParaCanteiro, ehTarefaDeComidaParaTropa,
  ehTarefaDeReparo, ehTarefaDeTile, ehTarefaDoSerf, ID_DO_RECRUTA, MERCADORIA_DE_OURO,
} from './state';
import { ehQuartelCompleto } from './quartel';
import { ehFeiraCompleta, serfsNaFeira } from './feira';
import { predioReparavel } from './reparo';
import type { GameData } from './data/types';
import { gameData } from './data';
// F20b — `condicao.ts` nao importa valor de ninguem (so `import type`), entao
// entrar aqui nao fecha ciclo.
import { ehCivil, precisaComer } from './condicao';
import {
  chaveDeTile, componenteDe, distanciaEntrePredios, ehEstrada,
  MERCADORIA_DA_ESTRADA, tileDeEstradaTrabalhavel, tilesDaPorta,
} from './estradas';
import type { TileDeGrid } from './estradas';
import { ehCampoPlanejado } from './campos';
import { obraTrabalhavel } from './obra';
import { alvosDeAproximacao } from './aproximacao';
import { alcancavelAPe } from './alcance';
import { buscarCaminho } from './pathfinding';
import type { Caminho, ModoDeBusca } from './pathfinding';
import {
  comensaisReservados, sobraNaOrigem, vagaDeConstrucao, vagaDeOcupacao, vagaDeRefeicao, vagaDaTropa, vagaDoDestino, vagaNoTile,
} from './reservas';
import { predioAceita } from './ocupacao';
import { refeicoesGarantidas } from './bodega';
import { tileMaduro, tilesReservadosParaColheita } from './recursos';

/**
 * Por que uma tarefa reclamada foi liberada. Cada motivo devolve as DUAS reservas
 * (e a reserva e derivada da tarefa, entao nao ha como devolver so uma).
 *
 *  - reabrem a MESMA tarefa (falha so da unidade): `unidade-removida`,
 *    `pedido-da-unidade`;
 *  - CANCELAM a tarefa (origem, caminho ou destino ja nao valem; o gerador cria outra
 *    com a origem certa): `caminho-cortado`, `origem-sumiu`, `origem-sem-recurso`,
 *    `destino-sumiu`, `destino-completo`.
 */
export type MotivoDeLiberacao =
  | 'unidade-removida'
  | 'pedido-da-unidade'
  | 'caminho-cortado'
  | 'origem-sumiu'
  | 'origem-sem-recurso'
  | 'destino-sumiu'
  | 'destino-completo';

const MOTIVOS_QUE_REABREM: readonly MotivoDeLiberacao[] = ['unidade-removida', 'pedido-da-unidade'];

export type MotivoDeRecusaDoClaim =
  | 'tarefa-inexistente'
  | 'tarefa-ja-reclamada'
  | 'unidade-invalida'
  | 'unidade-ocupada'
  | 'origem-sem-recurso'
  | 'destino-sem-vaga'
  | 'sem-caminho'
  | 'destino-sem-trabalho';

export type ResultadoDoClaim =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly motivo: MotivoDeRecusaDoClaim };

export type ResultadoDoClaimMelhor =
  | { readonly ok: true; readonly state: GameState; readonly tarefa: string }
  | { readonly ok: false; readonly motivo: MotivoDeRecusaDoClaim | 'sem-tarefa-aberta' };

/** So o serf carrega mercadoria. Id estrutural, como `ID_DO_ARMAZEM`. */
export const TIPO_QUE_CARREGA = 'serf';

/** So o laborer constroi. Id estrutural, como `TIPO_QUE_CARREGA`. */
export const TIPO_QUE_CONSTROI = 'laborer';

const UNIDADE_ELEGIVEL_POR_TIPO: Readonly<Record<TipoDeTarefa, string | null>> = {
  // F20a: comida e carga como qualquer outra — o que muda e o nivel (1, o mais
  // alto de todos) e a gaveta de destino (`entrada` da Bodega).
  'comida-para-inn': TIPO_QUE_CARREGA,
  'material-para-obra': TIPO_QUE_CARREGA,
  // F13: ouro tambem e carga — mesmo serf, mesma FSM, mesmo claim.
  'ouro-para-escola': TIPO_QUE_CARREGA,
  // F15b: os quatro niveis do produtor sao carga como qualquer outra — mesmo
  // serf, mesma FSM, mesmo claim. O que muda e a gaveta de onde a carga sai
  // (`gavetaDeOrigem`) e onde ela entra na chegada.
  'insumo-producao-parada': TIPO_QUE_CARREGA,
  'insumo-producao-baixa': TIPO_QUE_CARREGA,
  'saida-cheia-para-armazem': TIPO_QUE_CARREGA,
  'excedente-para-armazem': TIPO_QUE_CARREGA,
  construir: TIPO_QUE_CONSTROI,
  // F18d-1b: assentar tile planejado e trabalho de canteiro — mesmo laborer,
  // mesma FSM (`indo_a_obra` -> `martelando`), mesmo claim. F18g: a pedra
  // chega ao tile pela carga abaixo; ele a consome do chao.
  'assentar-estrada': TIPO_QUE_CONSTROI,
  // F18g: a pedra do canteiro e carga como qualquer outra — mesmo serf, mesma
  // FSM, mesmo claim. O que muda e a ponta: a entrega e num tile, nao em gaveta.
  'pedra-para-canteiro': TIPO_QUE_CARREGA,
  // C-COMIDA-01b (fome militar com o Feed): a comida da tropa e carga como qualquer outra
  'comida-para-tropa': TIPO_QUE_CARREGA,
  // F14: 'ocupar' nao tem UM tipo elegivel — quem pode ocupar depende do PREDIO
  // de destino. `null` aqui significa "esta pergunta nao se responde so com o
  // tipo da tarefa", e por isso `elegivelParaTarefa` NUNCA autoriza uma
  // ocupacao: quem responde e `podeReclamar`.
  ocupar: null,
  // F-T2c: 'colher' depende do destino pelo mesmo motivo que 'ocupar' — quem
  // colhe numa `quarry` e o civil que o dado declara para `quarry` —, e ainda
  // mais: so o OCUPANTE daquele predio. A segunda metade e do `reclamar`, que e
  // quem tem a unidade na mao.
  colher: null,
  // F20b: 'comer' nao tem UM tipo elegivel porque QUALQUER civil come — a lista
  // de civis esta em `units.json`, nao aqui, e por isso a resposta vem de
  // `podeReclamar` (via `ehCivil`) e nunca de `elegivelParaTarefa`. A segunda
  // metade da pergunta — "esta unidade esta com fome?" — precisa da UNIDADE e
  // mora no `reclamar`.
  comer: null,
  // F18h: arar tile planejado e trabalho de canteiro, como a estrada — mesmo
  // laborer, mesma FSM, mesmo claim. Sem material a carregar: o milho nao custa
  // nada, e quando a cana cobrar, ela sai do armazem no fim, como a pedra.
  arar: TIPO_QUE_CONSTROI,
  // F-CERCO-b: reparar e martelar predio completo — mesmo laborer, mesma FSM
  // (`indo_a_obra` -> `martelando`), mesmo claim. Sem material: no KaM tambem nao.
  reparar: TIPO_QUE_CONSTROI,
  // F25a: a arma e carga como o ouro — mesmo serf, mesma FSM, mesmo claim.
  'arma-para-quartel': TIPO_QUE_CARREGA,
  // F25a: so o recruta se alista, e qualquer recruta ocioso serve (sem destino
  // especifico de tipo, ao contrario de 'ocupar').
  alistar: ID_DO_RECRUTA,
};

/** Generaliza a checagem "a unidade e serf": cada tipo de tarefa tem UM tipo
 *  de unidade elegivel — serf e laborer nao disputam tarefa (decisao do
 *  operador, F11b). */
export function elegivelParaTarefa(tipoDaTarefa: TipoDeTarefa, tipoDaUnidade: string): boolean {
  return UNIDADE_ELEGIVEL_POR_TIPO[tipoDaTarefa] === tipoDaUnidade;
}

/**
 * F14 — a pergunta completa: esta unidade pode reclamar ESTA tarefa? Para tudo
 * que nao e `'ocupar'` e exatamente `elegivelParaTarefa` (o tipo basta). Para
 * `'ocupar'`, a resposta vem do DESTINO — o `trabalhador` que o tipo de predio
 * declara no dado.
 *
 * Toda checagem de elegibilidade passa por aqui: `reclamar`, `sanearTarefas` e
 * as invariantes de teste. `elegivelParaTarefa` continua publica porque a F11b
 * prende o par serf/laborer nela.
 */
export function podeReclamar(
  state: GameState, tarefa: Tarefa, tipoDaUnidade: string, dados: GameData = gameData,
): boolean {
  // F-T2c — 'colher' entra aqui pelo mesmo caminho de 'ocupar': o tipo de civil
  // vem do predio. "E o ocupante DESTE predio" nao cabe nesta pergunta (ela nao
  // recebe a unidade, so o tipo dela) e mora no `reclamar`.
  // F20b — 'comer' e a primeira tarefa cujo elegivel e uma CLASSE de unidade e
  // nao um tipo: todo civil come. O dado que responde e `units.json:civis.tipos`,
  // lido por `ehCivil`. O militar come pelo Feed (C-COMIDA-01b) e nunca vai a Bodega.
  if (tarefa.tipo === 'comer') return ehCivil(tipoDaUnidade, dados);
  if (tarefa.tipo !== 'ocupar' && tarefa.tipo !== 'colher') {
    return elegivelParaTarefa(tarefa.tipo, tipoDaUnidade);
  }
  return predioAceita(state.predios.porId[tarefa.destino], tipoDaUnidade, dados);
}

/**
 * D-TRANSPORTE-03 T1 — a CLASSE de importancia do tipo em `delivery.json`, lida pelo
 * `id`: nunca um numero em `.ts`. Menor = mais urgente; dentro da classe decide o custo
 * (`ordenarTarefasDoSerf`). Falha alto se o dado nao tem o id ou se a linha e do laborer
 * (`importancia: null`, que nao e entrega): assumir uma classe escondida seria pior.
 */
export function importanciaDoTipo(tipo: TipoComOrigem, dados: GameData = gameData): number {
  const linha = dados.entrega.prioridades.find((p) => p.id === tipo);
  if (linha === undefined) {
    throw new Error(`importanciaDoTipo: '${tipo}' nao esta em delivery.json (prioridades[].id)`);
  }
  if (linha.importancia === null) {
    throw new Error(`importanciaDoTipo: '${tipo}' tem importancia null em delivery.json (so as do laborer)`);
  }
  return linha.importancia;
}

/**
 * F18d-1a — a vizinhanca que a perna de ENTREGA daquele tipo usa, lida do mesmo
 * lugar que a importancia (`delivery.json: prioridades[].modo`). Nenhum sistema digita
 * `'estrada'` ou `'livre'` para tarefa de transporte: o criterio e o destino
 * (canteiro -> livre, porta de predio pronto -> estrada) e ele mora no dado.
 *
 * Falha alto pelas duas vias — id fora da escada e modo que nao existe — porque
 * um padrao assumido aqui viraria a regra do jogo escondida num `??`.
 */
export function modoDoTipo(tipo: TipoNaEscada, dados: GameData = gameData): ModoDeBusca {
  const linha = dados.entrega.prioridades.find((p) => p.id === tipo);
  if (linha === undefined) {
    throw new Error(`modoDoTipo: '${tipo}' nao esta na escada de delivery.json (prioridades[].id)`);
  }
  if (linha.modo !== 'livre' && linha.modo !== 'estrada') {
    throw new Error(`modoDoTipo: modo '${linha.modo}' de '${tipo}' nao e 'livre' nem 'estrada'`);
  }
  return linha.modo;
}

function inserirTarefa(state: GameState, tarefa: Tarefa): { readonly state: GameState; readonly id: string } {
  return {
    id: tarefa.id,
    state: {
      ...state,
      proximoId: tarefa.numero + 1,
      jobs: {
        tarefas: {
          porId: { ...state.jobs.tarefas.porId, [tarefa.id]: tarefa },
          ordem: [...state.jobs.tarefas.ordem, tarefa.id],
        },
      },
    },
  };
}

/** Cria uma tarefa de material ABERTA (nao reserva nada). O id e o numero vem
 *  do contador `proximoId`, compartilhado com predios e unidades. */
export function criarTarefa(
  state: GameState,
  campos: { readonly mercadoria: string; readonly origem: string; readonly destino: string },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaMaterialParaObra = {
    id: `t${numero}`, numero, tipo: 'material-para-obra', mercadoria: campos.mercadoria,
    origem: campos.origem, destino: campos.destino, estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/**
 * F20a — cria uma tarefa de COMIDA aberta, do armazem `origem` ate a Bodega
 * `destino`. Irma de `criarTarefaDeOuro`; a mercadoria e parametro porque a Bodega
 * quer VARIAS comidas, uma gaveta de cada, e nao uma mercadoria so.
 */
export function criarTarefaDeComida(
  state: GameState,
  campos: { readonly mercadoria: string; readonly origem: string; readonly destino: string },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaComidaParaInn = {
    id: `t${numero}`, numero, tipo: 'comida-para-inn', mercadoria: campos.mercadoria,
    origem: campos.origem, destino: campos.destino, estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/** F13 — cria uma tarefa de OURO aberta, do armazem `origem` ate a escola
 *  `destino`. Irma de `criarTarefa`: so a mercadoria e o tipo (e com ele o nivel
 *  na escada) mudam. */
export function criarTarefaDeOuro(
  state: GameState,
  campos: { readonly origem: string; readonly destino: string },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaOuroParaEscola = {
    id: `t${numero}`, numero, tipo: 'ouro-para-escola', mercadoria: MERCADORIA_DE_OURO,
    origem: campos.origem, destino: campos.destino, estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/**
 * F15b — niveis 4 e 5: uma unidade de insumo do armazem `origem` ate a gaveta
 * `entrada` do produtor `destino`. `parada` escolhe o TIPO, e com ele o nivel
 * na escada — `true` quando o produtor esta com zero da mercadoria.
 *
 * A urgencia e decidida AQUI e nunca revista depois (ver `TarefaInsumoProducaoParada`).
 */
export function criarTarefaDeInsumo(
  state: GameState,
  campos: {
    readonly mercadoria: string; readonly origem: string;
    readonly destino: string; readonly parada: boolean;
  },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaInsumoProducaoParada | TarefaInsumoProducaoBaixa = {
    id: `t${numero}`, numero,
    tipo: campos.parada ? 'insumo-producao-parada' : 'insumo-producao-baixa',
    mercadoria: campos.mercadoria, origem: campos.origem, destino: campos.destino,
    estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/**
 * F15b — niveis 6 e 7: uma unidade do predio `origem` de volta ao armazem
 * `destino`. `excedente` escolhe o nivel E, com ele, a gaveta de onde a carga
 * sai: `entrada` no nivel 7 (mercadoria parada num predio que nao a pede mais),
 * `saida` no nivel 6 (o que o produtor acabou de fazer). Ver `gavetaDeOrigem`.
 */
export function criarTarefaParaArmazem(
  state: GameState,
  campos: {
    readonly mercadoria: string; readonly origem: string;
    readonly destino: string; readonly excedente: boolean;
  },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaSaidaCheiaParaArmazem | TarefaExcedenteParaArmazem = {
    id: `t${numero}`, numero,
    tipo: campos.excedente ? 'excedente-para-armazem' : 'saida-cheia-para-armazem',
    mercadoria: campos.mercadoria, origem: campos.origem, destino: campos.destino,
    estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/** F11b — cria uma vaga de construcao ABERTA na obra `destino`. Sem
 *  mercadoria/origem: o laborer nao carrega material. */
export function criarTarefaDeConstrucao(
  state: GameState, destino: string,
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaConstruir = { id: `t${numero}`, numero, tipo: 'construir', destino, estado: 'aberta', reclamadaPor: null };
  return inserirTarefa(state, tarefa);
}

/** F25a — uma unidade de requisito do armazem `origem` ate o quartel `destino`. */
export function criarTarefaDeArma(
  state: GameState,
  campos: { readonly mercadoria: string; readonly origem: string; readonly destino: string },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaArmaParaQuartel = {
    id: `t${numero}`, numero, tipo: 'arma-para-quartel', mercadoria: campos.mercadoria,
    origem: campos.origem, destino: campos.destino, estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/** F25a — a vaga de ALISTAMENTO aberta no quartel completo `destino`. */
export function criarTarefaDeAlistamento(
  state: GameState, destino: string,
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaAlistar = { id: `t${numero}`, numero, tipo: 'alistar', destino, estado: 'aberta', reclamadaPor: null };
  return inserirTarefa(state, tarefa);
}

/** F25a — reclama, para o recruta `unidadeId`, a `'alistar'` aberta de caminho mais
 *  curto ate a porta (`(custo, numero)`), a que DER para reclamar. */
export function reclamarMelhorAlistamento(
  state: GameState, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaimMelhor {
  const custos = new Map<string, number>();
  const candidatas = state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is TarefaAlistar => t !== undefined && t.tipo === 'alistar' && t.estado === 'aberta');
  for (const t of candidatas) {
    custos.set(t.id, caminhoAtePredioCompleto(state, t.destino, unidadeId, dados)?.custo ?? Number.POSITIVE_INFINITY);
  }
  const ordem = [...candidatas].sort((a, b) => {
    const ca = custos.get(a.id) ?? Number.POSITIVE_INFINITY;
    const cb = custos.get(b.id) ?? Number.POSITIVE_INFINITY;
    return ca !== cb ? (ca < cb ? -1 : 1) : a.numero - b.numero;
  });
  let primeiraRecusa: MotivoDeRecusaDoClaim | null = null;
  for (const tarefa of ordem) {
    const r = reclamar(state, tarefa.id, unidadeId, dados);
    if (r.ok) return { ok: true, state: r.state, tarefa: tarefa.id };
    primeiraRecusa ??= r.motivo;
  }
  return { ok: false, motivo: primeiraRecusa ?? 'sem-tarefa-aberta' };
}

/** F-CERCO-b — cria uma vaga de REPARO aberta no predio completo `destino`. Irma de
 *  `criarTarefaDeConstrucao`. */
export function criarTarefaDeReparo(
  state: GameState, destino: string,
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaReparar = { id: `t${numero}`, numero, tipo: 'reparar', destino, estado: 'aberta', reclamadaPor: null };
  return inserirTarefa(state, tarefa);
}

/** F14 — cria uma vaga de OCUPANTE aberta no predio completo `destino`. Irma de
 *  `criarTarefaDeConstrucao`. */
export function criarTarefaDeOcupacao(
  state: GameState, destino: string,
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaOcupar = { id: `t${numero}`, numero, tipo: 'ocupar', destino, estado: 'aberta', reclamadaPor: null };
  return inserirTarefa(state, tarefa);
}

/**
 * F20b — cria um ASSENTO de refeicao aberto na Bodega completa `destino`. Irma de
 * `criarTarefaDeOcupacao`: sem mercadoria e sem origem, porque a comida nao viaja
 * com ninguem — ela ja esta na gaveta `entrada` da Bodega, posta la pelo nivel 1 da
 * escada (F20a), e sai dela no tick da chegada.
 */
export function criarTarefaComer(
  state: GameState, destino: string,
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaComer = { id: `t${numero}`, numero, tipo: 'comer', destino, estado: 'aberta', reclamadaPor: null };
  return inserirTarefa(state, tarefa);
}

/**
 * F18d-1b — cria a tarefa de assentar o tile PLANEJADO `tile`, aberta.
 *
 * F18g — sem pagador e sem `null`: a tarefa nao reserva mais nada (a pedra viaja
 * pela carga abaixo), entao nao ha armazem a procurar. Ela nasce para todo tile
 * do canteiro, como a de arar; quem decide se o laborer VAI e o claim, que exige
 * pedra no tile ou a caminho (`tileDeEstradaTrabalhavel`).
 */
export function criarTarefaDeAssentamento(
  state: GameState, tile: TileDeGrid,
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaAssentarEstrada = {
    id: `t${numero}`, numero, tipo: 'assentar-estrada', destinoTile: tile, estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/**
 * F18g — cria a carga de UMA pedra do armazem `origem` ate o tile planejado
 * `tile`, aberta. Aberta nao reserva nada (como toda carga); a reserva na origem
 * nasce no claim e a vaga do tile (`vagaNoTile`) e derivada das tarefas dele.
 * Quem a cria e `gerarTarefas`, so ate onde a pedra livre do armazem chega.
 */
export function criarTarefaDePedraParaCanteiro(
  state: GameState, campos: { readonly origem: string; readonly tile: TileDeGrid },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaPedraParaCanteiro = {
    id: `t${numero}`, numero, tipo: 'pedra-para-canteiro', mercadoria: MERCADORIA_DA_ESTRADA,
    origem: campos.origem, destinoTile: campos.tile, estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/**
 * C-COMIDA-01b (fome militar com o Feed) — cria a carga de UMA comida do armazem
 * `origem` ate o militar `destinoUnidade`, aberta. O destino e a UNIDADE, nao um
 * tile: ela anda, e o serf mira onde ela esta quando pega a carga e de novo ao
 * chegar (`passoEntregando`). Aberta nao reserva nada; a vaga e `vagaDaTropa`.
 */
export function criarTarefaComidaParaTropa(
  state: GameState, campos: { readonly mercadoria: string; readonly origem: string; readonly destinoUnidade: string },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaComidaParaTropa = {
    id: `t${numero}`, numero, tipo: 'comida-para-tropa', mercadoria: campos.mercadoria,
    origem: campos.origem, destinoUnidade: campos.destinoUnidade, estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/**
 * F18h — cria a tarefa de arar o tile do canteiro do campo, aberta. Irma da de
 * assentamento acima, com UMA diferenca, e ela e a que importa: nao ha material a
 * reservar, entao nao ha pagador a procurar e nao ha `null` a devolver. O milho
 * nao custa nada (GDD 5.4); no dia em que a cana custar, esta funcao ganha a
 * busca do armazem e o `null` de volta, exatamente como a de cima.
 *
 * A cultura vem do canteiro e e FOTOGRAFADA aqui, como `TarefaColher.recurso`:
 * o que vale e o que o jogador mandou plantar quando mandou.
 */
export function criarTarefaDeAradura(
  state: GameState, tile: TileDeGrid, recurso: string,
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaArar = {
    id: `t${numero}`, numero, tipo: 'arar',
    destinoTile: tile, recurso, estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/**
 * F-T2c — cria a tarefa de colher `origemTile` para o predio `destino`, aberta,
 * e com ela a reserva do tile inteiro. Irma de `criarTarefaDeAssentamento`: a
 * reserva vale ja em `'aberta'`, entao e ESTA funcao que compromete o tile, e
 * nao o `reclamar` (ver `TarefaColher`, state.ts).
 *
 * Quem escolhe o tile e `melhorTileDeColheita` (sim/recursos.ts), a varredura
 * pura herdada da F-T2a; aqui ele ja vem escolhido.
 */
export function criarTarefaDeColheita(
  state: GameState,
  campos: {
    readonly destino: string; readonly origemTile: TileDeGrid;
    readonly recurso: string; readonly quantidade: number;
  },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaColher = {
    id: `t${numero}`, numero, tipo: 'colher', destino: campos.destino,
    origemTile: campos.origemTile, recurso: campos.recurso, quantidade: campos.quantidade,
    estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/** F-T2c — a tarefa de colheita deste predio, se existe. E por ela, e nao por um
 *  id guardado em `fsmData`, que o ocupante acha a sua: o rotulo da FSM do
 *  especialista e recalculado todo tick e `comFsm` zera `fsmData`. */
export function tarefaDeColheitaDoPredio(state: GameState, predioId: string): TarefaColher | null {
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t !== undefined && ehTarefaDeColheita(t) && t.destino === predioId) return t;
  }
  return null;
}

/**
 * A tarefa que esta unidade SEGURA (`reclamada` ou `carregando`), ou `null`. Uma
 * unidade nunca segura duas — `reclamar` recusa quem ja tem — entao a primeira e a
 * unica.
 *
 * F20b: a morte precisa dela para liberar explicitamente no mesmo tick (CLAUDE.md
 * secao 5: "toda tarefa reclamada precisa ter caminho de volta"), e nao esperar a
 * rede do `sanearTarefas` no tick seguinte.
 */
export function tarefaReclamadaPor(state: GameState, unidadeId: string): Tarefa | null {
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t !== undefined && t.estado !== 'aberta' && t.reclamadaPor === unidadeId) return t;
  }
  return null;
}

function unidadeJaTemTarefa(state: GameState, unidadeId: string): boolean {
  return tarefaReclamadaPor(state, unidadeId) !== null;
}

/**
 * A ligacao entre as portas de dois predios NO MODO dado (F18d-1a), ou `null` se
 * nao ha caminho.
 *
 * Em `'estrada'` e a distancia em PASSOS do BFS da rede (8 direcoes, sem cortar
 * quina de predio — F18e), memoizada. Em `'livre'` e o menor custo A* em TICKS,
 * pela porta mais barata de `a`: nao ha rede a consultar, quem responde e o
 * terreno.
 *
 * As duas unidades nunca se comparam entre si, e nao podem: a comparacao
 * acontece sempre dentro de um nivel da escada, e um nivel tem um modo so.
 */
export function ligacaoEntrePredios(
  state: GameState, a: Predio, b: Predio, modo: ModoDeBusca, dados: GameData = gameData,
): number | null {
  if (modo === 'estrada') return distanciaEntrePredios(state, a, b, dados);
  const alvos = tilesDaPorta(b, dados);
  let melhor: number | null = null;
  for (const porta of tilesDaPorta(a, dados)) {
    const caminho = buscarCaminho(state, porta, alvos, 'livre', dados);
    if (caminho !== null && (melhor === null || caminho.custo < melhor)) melhor = caminho.custo;
  }
  return melhor;
}

/** A ligacao da origem ate o destino DESTA tarefa, no modo do nivel dela; `null` se
 *  algum dos dois nao existe ou nao ha caminho.
 *  E a pergunta de EXISTENCIA ("da para entregar?"), que nao depende de serf: e o que o
 *  gerador, o saneamento e o verificador usam. A ORDEM de escolha do serf usa o custo A*
 *  em ticks de `custoDaTarefa`, que parte da posicao dele. */
export function distanciaDaTarefa(state: GameState, tarefa: TarefaDoSerf, dados: GameData = gameData): number | null {
  const origem = state.predios.porId[tarefa.origem];
  if (!origem) return null;
  // F18g: a ponta de entrega da pedra do canteiro e um TILE — a ligacao e da porta
  // do armazem ate ele, no modo do nivel (`livre`: canteiro nao tem rua).
  if (ehTarefaDePedraParaCanteiro(tarefa)) {
    return ligacaoEntrePredioETile(state, origem, tarefa.destinoTile, modoDoTipo(tarefa.tipo, dados), dados);
  }
  // C-COMIDA-01b — a ponta de entrega e o tile onde o militar ESTA agora
  if (ehTarefaDeComidaParaTropa(tarefa)) {
    const alvo = state.unidades.porId[tarefa.destinoUnidade];
    return alvo === undefined ? null : ligacaoEntrePredioETile(state, origem, { gx: alvo.gx, gy: alvo.gy }, modoDoTipo(tarefa.tipo, dados), dados);
  }
  const destino = state.predios.porId[tarefa.destino];
  if (!destino) return null;
  return ligacaoEntrePredios(state, origem, destino, modoDoTipo(tarefa.tipo, dados), dados);
}

/**
 * F18g — a ligacao entre UM tile e as portas de um predio, no modo dado: o menor
 * custo A* em ticks ate a porta mais barata, ou `null` sem caminho. Irma de
 * `ligacaoEntrePredios` com a ponta trocada; e a pergunta que o gerador faz ao
 * escolher de qual armazem a pedra sai, e nao depende de serf.
 *
 * UMA busca, do tile para o CONJUNTO das portas (o A* aceita varios alvos), e nao
 * uma por porta como `ligacaoEntrePredios` faz: o gerador chama isto por carga
 * criada, e um canteiro cria dezenas. Medido no caos da F09: a versao por porta
 * pesava 589 mil nos expandidos em 200 passos. O custo no sentido inverso pode
 * diferir do sentido serf->tile em UM passo (o custo e do tile em que se pisa), e
 * isso so pode mudar o desempate entre dois armazens quase equidistantes —
 * deterministico do mesmo jeito, e a ordem de `predios.ordem` continua o
 * desempate final.
 */
export function ligacaoEntrePredioETile(
  state: GameState, a: Predio, tile: TileDeGrid, modo: ModoDeBusca, dados: GameData = gameData,
): number | null {
  return buscarCaminho(state, tile, tilesDaPorta(a, dados), modo, dados)?.custo ?? null;
}

/**
 * F18g — a EXISTENCIA de caminho a pe de alguma porta de `a` ate `tile`.
 *
 * E a pergunta que `sanearTarefas` faz de TODA carga de pedra aberta, todo tick —
 * e um canteiro tem dezenas de tiles. Respondida por A*, custava uma busca por
 * porta por tile (medido no caos da F09, semente 1: 0,5 s viraram 4,7 s; e uma
 * memoizacao por par ainda refazia 90 buscas a cada predio que nascia). A resposta
 * vem do indice de componentes de `alcance.ts`: O(1) por consulta, uma varredura
 * do mapa por mudanca de footprint ou de recurso que bloqueia.
 *
 * O modo vem do dado (nunca digitado): o indice so vale para `'livre'`, cuja
 * existencia nao depende da rede. Se um dia o dado puser a pedra do canteiro em
 * `'estrada'`, a pergunta passa a depender de `estradas` e cai para o A* direto.
 */
export function tileAlcancavelDaPorta(
  state: GameState, a: Predio, tile: TileDeGrid, dados: GameData = gameData,
  tipo: 'pedra-para-canteiro' | 'comida-para-tropa' = 'pedra-para-canteiro',
): boolean {
  // C-COMIDA-01b — a comida da tropa faz a mesma pergunta, com a ponta no tile do militar
  const modo = modoDoTipo(tipo, dados);
  if (modo !== 'livre') return ligacaoEntrePredioETile(state, a, tile, modo, dados) !== null;
  return tilesDaPorta(a, dados).some((porta) => alcancavelAPe(state, porta, tile, dados));
}

/** As duas pernas da viagem de uma unidade para uma tarefa, em ticks (F10). */
export interface PlanoDaTarefa {
  /** A pe, por qualquer tile livre, da posicao do serf ate a porta de coleta do armazem. */
  readonly ateAOrigem: Caminho;
  /** Carregado, da porta de coleta ate a porta do destino, no modo do nivel
   *  (`modoDoTipo`): por estrada nos niveis de coleta, livre no de construcao. */
  readonly deEntrega: Caminho;
  /** `ateAOrigem.custo + deEntrega.custo`. */
  readonly custo: number;
}

/**
 * Os tiles de porta por onde a carga daquele MODO entra e sai (F18d-1a).
 *
 * Em `'estrada'` sao so os tiles de porta que sao estrada — a rede e o unico
 * caminho da carga. Em `'livre'` e a borda sul INTEIRA, a mesma porta que
 * `caminhoAteAObra` ja dava ao laborer: quem entrega num canteiro chega antes de
 * existir rua.
 */
export function portasDaTarefa(
  state: GameState, predioId: string, modo: ModoDeBusca, dados: GameData = gameData,
): TileDeGrid[] {
  const predio = state.predios.porId[predioId];
  if (!predio) return [];
  const portas = tilesDaPorta(predio, dados);
  return modo === 'estrada' ? portas.filter((t) => ehEstrada(state.estradas, t)) : portas;
}

/**
 * F18g — onde a carga DESTA tarefa e entregue: as portas do predio de destino
 * (`portasDaTarefa`) ou, para a pedra do canteiro, o proprio tile — quem entrega
 * no canteiro pisa no tile que vai virar rua, como o laborer que o assenta. E a
 * unica pergunta em que os dois membros de `TarefaDoSerf` divergem; a FSM do serf
 * e o plano passam por aqui para nao divergirem entre si.
 */
export function alvosDeEntrega(
  state: GameState, tarefa: TarefaDoSerf, modo: ModoDeBusca, dados: GameData = gameData,
): TileDeGrid[] {
  if (ehTarefaDePedraParaCanteiro(tarefa)) return [{ gx: tarefa.destinoTile.gx, gy: tarefa.destinoTile.gy }];
  // C-COMIDA-01b — o tile do militar agora; se ele se mover, o serf recalcula na chegada
  if (ehTarefaDeComidaParaTropa(tarefa)) {
    const alvo = state.unidades.porId[tarefa.destinoUnidade];
    return alvo === undefined ? [] : [{ gx: alvo.gx, gy: alvo.gy }];
  }
  return portasDaTarefa(state, tarefa.destino, modo, dados);
}

/** As portas de COLETA e de ENTREGA da tarefa, no modo do nivel dela. Em
 *  `'estrada'` a coleta ainda se filtra ao componente da entrega — sem isso a
 *  perna carregada nao teria como existir. Em `'livre'` nao ha componente: a
 *  existencia do caminho quem responde e o A*, tile a tile. */
function portasDeColeta(state: GameState, tarefa: TarefaDoSerf, dados: GameData): { coleta: TileDeGrid[]; entrega: TileDeGrid[] } {
  const modo = modoDoTipo(tarefa.tipo, dados);
  const entrega = alvosDeEntrega(state, tarefa, modo, dados);
  if (modo === 'livre') return { coleta: portasDaTarefa(state, tarefa.origem, modo, dados), entrega };
  const componentesDaEntrega = new Set(entrega.map((t) => componenteDe(state, t, dados)));
  const coleta = portasDaTarefa(state, tarefa.origem, modo, dados).filter((t) => componentesDaEntrega.has(componenteDe(state, t, dados)));
  return { coleta, entrega };
}

/**
 * O plano de `unidadeId` para `tarefa`: a perna livre (A*, vizinhanca 8, custo de terreno,
 * a partir de ONDE O SERF ESTA) ate a porta de coleta mais barata, mais a perna de entrega
 * (A* no modo do nivel, `modoDoTipo`) dessa porta ate a do destino. `null` se algo nao existe, ou se alguma
 * das pernas nao tem caminho. Nunca euclidiana.
 *
 * A porta de coleta e a de menor perna livre (guloso: nao minimiza a soma das duas
 * pernas; empate: a primeira de `tilesDaPorta`, por `gx`).
 */
export function planoDaTarefa(
  state: GameState, tarefa: TarefaDoSerf, unidadeId: string, dados: GameData = gameData,
): PlanoDaTarefa | null {
  const unidade = state.unidades.porId[unidadeId];
  if (!unidade) return null;
  const { coleta, entrega } = portasDeColeta(state, tarefa, dados);
  if (coleta.length === 0 || entrega.length === 0) return null;
  const ateAOrigem = buscarCaminho(state, { gx: unidade.gx, gy: unidade.gy }, coleta, 'livre', dados);
  if (ateAOrigem === null) return null;
  const porta = ateAOrigem.tiles[ateAOrigem.tiles.length - 1] ?? { gx: unidade.gx, gy: unidade.gy };
  const deEntrega = buscarCaminho(state, porta, entrega, modoDoTipo(tarefa.tipo, dados), dados);
  if (deEntrega === null) return null;
  return { ateAOrigem, deEntrega, custo: ateAOrigem.custo + deEntrega.custo };
}

/** O caminho do laborer (a pe, `'livre'` — nao precisa de estrada) da posicao dele
 *  ate a obra `predioId`: qualquer tile da PORTA INTEIRA (`tilesDaPorta`, a borda sul
 *  toda, nao so a que e estrada — o laborer chega ANTES de existir estrada ou material,
 *  GDD §5.1: ele nivela primeiro). `null` se a obra nao existe ou nao ha caminho. */
export function caminhoAteAObra(
  state: GameState, predioId: string, unidadeId: string, dados: GameData = gameData,
): Caminho | null {
  const predio = state.predios.porId[predioId];
  const unidade = state.unidades.porId[unidadeId];
  if (!predio || predio.estado !== 'obra' || !unidade) return null;
  return buscarCaminho(state, { gx: unidade.gx, gy: unidade.gy }, tilesDaPorta(predio, dados), 'livre', dados);
}

/** F14 — o caminho a pe do especialista ate a porta do predio COMPLETO. Irmao de
 *  `caminhoAteAObra`: mesma vizinhanca `'livre'` e a porta inteira
 *  (`tilesDaPorta`), porque o especialista nao carrega nada e nao depende de
 *  estrada — a mesma regra do laborer. So o estado exigido do predio muda. */
export function caminhoAtePredioCompleto(
  state: GameState, predioId: string, unidadeId: string, dados: GameData = gameData,
): Caminho | null {
  const predio = state.predios.porId[predioId];
  const unidade = state.unidades.porId[unidadeId];
  if (!predio || predio.estado !== 'completo' || !unidade) return null;
  return buscarCaminho(state, { gx: unidade.gx, gy: unidade.gy }, tilesDaPorta(predio, dados), 'livre', dados);
}

/**
 * F18d-1b — o caminho do laborer ate O TILE do canteiro. O alvo e o proprio tile, e
 * nao uma porta: quem assenta fica EM CIMA do tile que vai virar estrada.
 *
 * O modo sai de `modoDoTipo`, nunca digitado aqui: e a linha da escada
 * (`delivery.json`) que diz se a tarefa depende de estrada — e esta, que constroi a
 * rede, obviamente nao pode depender dela.
 */
export function caminhoAteOTile(
  state: GameState, tile: TileDeGrid, unidadeId: string, dados: GameData = gameData,
): Caminho | null {
  const unidade = state.unidades.porId[unidadeId];
  if (!unidade) return null;
  return buscarCaminho(
    state, { gx: unidade.gx, gy: unidade.gy }, [tile], modoDoTipo('assentar-estrada', dados), dados,
  );
}

/**
 * F-T3 — o caminho do especialista ate UMA APROXIMACAO do tile de trabalho.
 *
 * Irmao de `caminhoAteOTile`, com dois desvios: o alvo e o CONJUNTO de
 * aproximacoes (`alvosDeAproximacao`, que inclui o proprio tile quando da para
 * pisar nele e so os vizinhos quando nao da — arvore em pe), e o modo e `'livre'`,
 * como todo deslocamento de especialista: ele nao carrega mercadoria e o campo
 * nao tem rua.
 *
 * `null` quer dizer uma de duas coisas, e as duas sao "nao va": a unidade nao
 * existe mais, ou nenhuma aproximacao se alcanca.
 */
export function caminhoAteAproximacaoDoTile(
  state: GameState, tile: TileDeGrid, unidadeId: string, dados: GameData = gameData,
): Caminho | null {
  const unidade = state.unidades.porId[unidadeId];
  if (unidade === undefined) return null;
  const alvos = alvosDeAproximacao(state, tile, dados);
  if (alvos.length === 0) return null;
  return buscarCaminho(state, { gx: unidade.gx, gy: unidade.gy }, alvos, 'livre', dados);
}

/** O caminho de UMA tarefa de laborer, qualquer que seja o tipo dela: porta da obra
 *  para `'construir'`, o tile para `'assentar-estrada'` e para `'arar'`. Quem ordena e
 *  quem anda usam esta, para que a escolha e a viagem nunca midam coisas diferentes.
 *  A pergunta e de FORMA (`ehTarefaDeTile`) e nao de tipo: as duas tarefas de tile
 *  fazem a mesma viagem, e e so isso que esta funcao decide. */
export function caminhoDoLaborer(
  state: GameState, tarefa: TarefaDeLaborer, unidadeId: string, dados: GameData = gameData,
): Caminho | null {
  if (ehTarefaDeTile(tarefa)) return caminhoAteOTile(state, tarefa.destinoTile, unidadeId, dados);
  // F-CERCO-b: o reparo e na PORTA do predio completo, a mesma do especialista
  if (ehTarefaDeReparo(tarefa)) return caminhoAtePredioCompleto(state, tarefa.destino, unidadeId, dados);
  return caminhoAteAObra(state, tarefa.destino, unidadeId, dados);
}

/**
 * O custo, em ticks, que ordena as tarefas. Com `unidadeId`: o plano inteiro (as duas
 * pernas). Sem unidade (`null`): so a perna de entrega, da melhor porta de coleta —
 * unica coisa que existe sem um serf em campo. `null` se nao ha caminho.
 */
export function custoDaTarefa(
  state: GameState, tarefa: TarefaDoSerf, unidadeId: string | null, dados: GameData = gameData,
): number | null {
  if (unidadeId !== null) return planoDaTarefa(state, tarefa, unidadeId, dados)?.custo ?? null;
  const { coleta, entrega } = portasDeColeta(state, tarefa, dados);
  let melhor: number | null = null;
  const modo = modoDoTipo(tarefa.tipo, dados);
  for (const porta of coleta) {
    const perna = buscarCaminho(state, porta, entrega, modo, dados);
    if (perna !== null && (melhor === null || perna.custo < melhor)) melhor = perna.custo;
  }
  return melhor;
}

/**
 * O claim: reserva, ao mesmo tempo, a unidade de recurso na origem e a vaga no
 * destino, ou nao reserva nada. ATOMICO: todas as checagens vem antes da unica
 * atribuicao de estado; uma recusa devolve so o motivo, e o estado do chamador nao foi
 * tocado.
 *
 * Ordem das checagens (fixada por teste): tarefa existe, esta aberta, unidade valida
 * (existe e e `serf`), unidade livre, origem com disponivel, destino com vaga, caminho
 * (F10: o plano inteiro — a perna do serf ate a origem tambem tem que existir, senao um
 * serf preso reclamaria e soltaria a mesma tarefa a cada tick).
 */
/**
 * D-MOVIMENTO-01d (JobBoard e porta por estado da chave) — as recusas do claim que NAO precisam do A*: tudo o que `reclamar` confere antes
 * do caminho, para a tarefa aberta. E a MESMA regra que `reclamar` aplica (ele chama esta
 * funcao), e existe separada para `reclamarMelhor` descartar a tarefa recusada ANTES de
 * orde-la por custo de caminho: ordenar por A* a tarefa que o claim vai recusar pelo teto da
 * feira era o custo medido na F35(b) (plano da D-MOVIMENTO-01, colisao civil, secao 8). `null` = nada recusa sem caminho.
 */
function recusaSemCaminho(
  state: GameState, tarefa: Tarefa, unidadeId: string, dados: GameData,
): MotivoDeRecusaDoClaim | null {
  const unidade = state.unidades.porId[unidadeId];
  if (!unidade || !podeReclamar(state, tarefa, unidade.tipo, dados)) return 'unidade-invalida';
  if (unidadeJaTemTarefa(state, unidadeId)) return 'unidade-ocupada';

  // C7 (BUG-N1) — ninguem trabalha para o outro lado: todo predio que a tarefa toca
  // (origem e destino) tem de ser do lado da unidade. Cobre serf, laborer, recruta,
  // especialista e quem vai comer de uma vez. Tile sem predio (estrada, campo) nao tem
  // lado no estado e nao entra aqui (PARA REVISAO).
  for (const ponta of [('origem' in tarefa ? tarefa.origem : undefined), ('destino' in tarefa ? tarefa.destino : undefined)]) {
    const predio = ponta === undefined ? undefined : state.predios.porId[ponta];
    if (predio !== undefined && predio.lado !== unidade.lado) return 'unidade-invalida';
  }

  // F20b — assento de Bodega e so de quem esta com fome: para quem nao esta, a
  // unidade nao e elegivel a ESTA tarefa, que e o que 'unidade-invalida' quer
  // dizer aqui. Nenhuma FSM de familia muda: o `passoOcioso` de cada uma continua
  // pedindo, e simplesmente nao reclama assento.
  //
  // O SIMETRICO NAO EXISTE, e isso foi medido (probe da cadeia do pao, 2026-09-25):
  // com um portao que recusasse trabalho a quem tem fome, a vila SEM Bodega congela
  // inteira no tick em que o primeiro civil cruza `civilVaiComer` — serf ocioso para
  // sempre, tarefa aberta para sempre, 32 paes entregues em vez de 68. Unidade
  // esperando o que nunca chega e travamento de regra, nao balanceamento. Quem da
  // prioridade a refeicao e a ORDEM do tick: `sistemaDaFome` roda ANTES das tres
  // familias, entao o civil ocioso e com fome sai para comer antes de o
  // `passoOcioso` dele pedir trabalho. Sem Bodega alcancavel ele trabalha ate
  // morrer — que e o que o GDD manda acontecer.
  if (tarefa.tipo === 'comer' && !precisaComer(unidade, dados)) {
    return 'unidade-invalida';
  }

  // F35 — no maximo `economy.marketplace.maxSerfs` tarefas EM CURSO com a feira como
  // origem ou destino (GDD §4.4, "maximo de 10 serfs negociando"). A proxima fica
  // aberta ate uma fechar. Vale para qualquer carga: o A que chega e o B que sai.
  for (const ponta of [('origem' in tarefa ? tarefa.origem : undefined), ('destino' in tarefa ? tarefa.destino : undefined)]) {
    if (ponta === undefined || !ehFeiraCompleta(state.predios.porId[ponta])) continue;
    if (serfsNaFeira(state, ponta) >= dados.economia.marketplace.maxSerfs) return 'destino-sem-vaga';
  }

  if (ehTarefaDoSerf(tarefa)) {
    // F15b — a oferta da origem depende do TIPO: a gaveta muda (nivel 7 tira da
    // `entrada`) e no nivel 7 o que se pode levar e o EXCEDENTE, nao o estoque
    // bruto. `sobraNaOrigem` e a mesma conta que `sanearTarefas` usa; perguntar
    // aqui por `disponivelNaOrigem` da gaveta `saida` deixava o serf recusar
    // para sempre uma tarefa que o quadro insistia em criar.
    if (sobraNaOrigem(state, tarefa, dados) < 1) {
      return 'origem-sem-recurso';
    }
    // A vaga depende do TIPO: `faltam` numa obra, a demanda da fila numa escola
    // (F13) — e, F18g, o que o TILE ainda pede de pedra (`vagaNoTile`).
    // C-COMIDA-01b — a comida so vai a militar do MESMO lado do serf. O C7 confere o lado
    // dos PREDIOS; o destino aqui e uma unidade, e a conferencia e desta tarefa.
    if (ehTarefaDeComidaParaTropa(tarefa)) {
      const alvo = state.unidades.porId[tarefa.destinoUnidade];
      if (alvo === undefined) return 'destino-sem-vaga';
      if (alvo.lado !== unidade.lado) return 'unidade-invalida';
    }
    const vaga = ehTarefaDePedraParaCanteiro(tarefa)
      ? vagaNoTile(state, tarefa, dados)
      : ehTarefaDeComidaParaTropa(tarefa) ? vagaDaTropa(state, tarefa) : vagaDoDestino(state, tarefa, dados);
    if (vaga < 1) return 'destino-sem-vaga';
  }
  return null;
}

export function reclamar(
  state: GameState, tarefaId: string, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaim {
  const tarefa = state.jobs.tarefas.porId[tarefaId];
  if (!tarefa) return { ok: false, motivo: 'tarefa-inexistente' };
  if (tarefa.estado !== 'aberta') return { ok: false, motivo: 'tarefa-ja-reclamada' };
  const recusa = recusaSemCaminho(state, tarefa, unidadeId, dados);
  if (recusa !== null) return { ok: false, motivo: recusa };

  if (ehTarefaDoSerf(tarefa)) {
    if (custoDaTarefa(state, tarefa, unidadeId, dados) === null) return { ok: false, motivo: 'sem-caminho' };
  } else if (tarefa.tipo === 'ocupar') {
    // F14: UMA vaga por predio; o tipo certo de civil ja foi checado em
    // `podeReclamar`. Sem estrada exigida, como a de construir.
    if (vagaDeOcupacao(state, tarefa.destino, dados) < 1) return { ok: false, motivo: 'destino-sem-vaga' };
    if (caminhoAtePredioCompleto(state, tarefa.destino, unidadeId, dados) === null) {
      return { ok: false, motivo: 'sem-caminho' };
    }
  } else if (tarefa.tipo === 'comer') {
    // F20b — o assento (`inn.comensaisSimultaneos`), a comida e o caminho. BUG-Y (emenda
    // da D5): a comida conta por REFEICAO GARANTIDA, e os comensais ja a caminho gastam
    // dela — com uma broa na gaveta, o segundo faminto e recusado aqui e continua no
    // predio, em vez de andar ate a Bodega e acha-la vazia. Recusa tambem a Bodega
    // VAZIA, e nao so no gerador: entre a criacao da tarefa e o claim, outro comensal
    // pode ter levado a ultima broa. 'destino-sem-trabalho' e o mesmo motivo que o tile
    // ja assentado e a pedreira sem ocupante usam — "nao ha o que fazer no destino" — e
    // ele NAO reabre a tarefa.
    if (vagaDeRefeicao(state, tarefa.destino, dados) < 1) return { ok: false, motivo: 'destino-sem-vaga' };
    if (comensaisReservados(state, tarefa.destino) >= refeicoesGarantidas(state, tarefa.destino, dados)) {
      return { ok: false, motivo: 'destino-sem-trabalho' };
    }
    if (caminhoAtePredioCompleto(state, tarefa.destino, unidadeId, dados) === null) {
      return { ok: false, motivo: 'sem-caminho' };
    }
  } else if (tarefa.tipo === 'assentar-estrada') {
    // F18d-1b: o tile tem de continuar no CANTEIRO. Se ja foi assentado ou
    // demolido entre a criacao e o claim, nao ha o que fazer la. F18g: e tem de
    // haver pedra nele ou a caminho (`tileDeEstradaTrabalhavel`, o espelho de
    // `obraTrabalhavel`): sem isto o laborer reclamaria, iria e esperaria para
    // sempre num tile que nenhum serf vai abastecer. O portao vive AQUI e na
    // ordenacao (`tarefasDoLaborerEmOrdem`), como o da obra, para que ele nao
    // reclame, largue e reclame o mesmo tile a cada tick.
    if (!tileDeEstradaTrabalhavel(state, tarefa.destinoTile, dados)) {
      return { ok: false, motivo: 'destino-sem-trabalho' };
    }
    // O laborer tem de CHEGAR no tile — mesma exigencia que `'construir'` faz da
    // porta da obra. Sem isto ele reclamaria um tile ilhado e largaria no tick
    // seguinte.
    if (caminhoAteOTile(state, tarefa.destinoTile, unidadeId, dados) === null) {
      return { ok: false, motivo: 'sem-caminho' };
    }
  } else if (ehTarefaDeAradura(tarefa)) {
    // F18h: o tile tem de continuar no canteiro do campo, pelo mesmo motivo que o
    // da estrada logo acima — entre a criacao e o claim ele pode ter sido arado por
    // outro ou ter saido do canteiro. E o mesmo `'destino-sem-trabalho'`, que NAO
    // reabre a tarefa.
    if (!ehCampoPlanejado(state.camposPlanejados, tarefa.destinoTile)) {
      return { ok: false, motivo: 'destino-sem-trabalho' };
    }
    if (caminhoAteOTile(state, tarefa.destinoTile, unidadeId, dados) === null) {
      return { ok: false, motivo: 'sem-caminho' };
    }
  } else if (ehTarefaDeColheita(tarefa)) {
    // F-T2c: quem colhe e o OCUPANTE daquele predio, e so ele. `podeReclamar` ja
    // conferiu o TIPO de civil; a identidade e aqui, que e onde ha unidade.
    const predio = state.predios.porId[tarefa.destino];
    if (!predio || predio.estado !== 'completo' || predio.ocupante !== unidadeId) {
      return { ok: false, motivo: 'destino-sem-trabalho' };
    }
    // O tile tem de continuar valendo o ciclo inteiro, e continuar SO desta
    // tarefa. A criacao ja reservou (a reserva vale desde 'aberta'), mas o claim
    // nao confia na criacao: entre um tick e outro o tile pode ter secado, e um
    // save de outra versao pode trazer duas tarefas no mesmo tile.
    const chave = chaveDeTile(tarefa.origemTile);
    const recurso = state.recursos[chave];
    if ((recurso?.quantidade ?? 0) < tarefa.quantidade) {
      return { ok: false, motivo: 'origem-sem-recurso' };
    }
    // F-CAMPO-a: tile semeado tem a quantidade cheia desde o semear, mas nao se
    // colhe antes de crescer — o mesmo `tileMaduro` que a escolha do tile usa.
    if (recurso !== undefined && !tileMaduro(state, recurso, dados)) {
      return { ok: false, motivo: 'origem-sem-recurso' };
    }
    if (tilesReservadosParaColheita(state, tarefa.id).has(chave)) {
      return { ok: false, motivo: 'origem-sem-recurso' };
    }
    // F-T3: o especialista SAI do predio para colher, entao o claim confere o
    // caminho, como o de `'assentar-estrada'` confere. Sem isto ele reclamaria um
    // tile ilhado e largaria no tick seguinte, reservando o lajedo a cada volta.
    // O outro lado da mesma regra e `tileAlcancavelParaColheita`, que a escolha do
    // tile usa: os dois lados recusam o mesmo tile, senao a tarefa nasce e morre
    // todo tick e o predio fica esperando o que nunca chega.
    if (caminhoAteAproximacaoDoTile(state, tarefa.origemTile, unidadeId, dados) === null) {
      return { ok: false, motivo: 'sem-caminho' };
    }
  } else if (tarefa.tipo === 'alistar') {
    // F25a: o quartel tem de continuar de pe, e o recruta tem de chegar a porta
    if (!ehQuartelCompleto(state.predios.porId[tarefa.destino])) return { ok: false, motivo: 'destino-sem-trabalho' };
    if (caminhoAtePredioCompleto(state, tarefa.destino, unidadeId, dados) === null) {
      return { ok: false, motivo: 'sem-caminho' };
    }
  } else if (ehTarefaDeReparo(tarefa)) {
    // F-CERCO-b: o predio tem de continuar pedindo reparo (ligado e abaixo do total)
    // e o laborer tem de chegar a porta. O gerador cria so ate o teto de laborers,
    // entao cada tarefa ja e uma vaga: nao ha conta de vaga aqui.
    if (!predioReparavel(state, tarefa.destino, dados)) return { ok: false, motivo: 'destino-sem-trabalho' };
    if (caminhoAtePredioCompleto(state, tarefa.destino, unidadeId, dados) === null) {
      return { ok: false, motivo: 'sem-caminho' };
    }
  } else {
    // 'construir': sem mercadoria/origem (o laborer nao carrega nada).
    if (vagaDeConstrucao(state, tarefa.destino, dados) < 1) return { ok: false, motivo: 'destino-sem-vaga' };
    // F11c: agora HA consumidor (sistemaDosLaborers), entao o claim checa caminho —
    // como o F10 fez para o serf. Modo 'livre': o laborer nao carrega nada e precisa
    // chegar ANTES de existir estrada (GDD §5.1: ele nivela primeiro).
    if (caminhoAteAObra(state, tarefa.destino, unidadeId, dados) === null) return { ok: false, motivo: 'sem-caminho' };
    // O portao vive AQUI, e nao so na ordenacao (`tarefasDoLaborerEmOrdem`), para
    // que o laborer nao reclame, largue e reclame a mesma obra sem trabalho a cada tick.
    if (!obraTrabalhavel(state, tarefa.destino, dados)) return { ok: false, motivo: 'destino-sem-trabalho' };
  }

  const reclamada: Tarefa = { ...tarefa, estado: 'reclamada', reclamadaPor: unidadeId };
  return {
    ok: true,
    state: {
      ...state,
      jobs: { tarefas: { porId: { ...state.jobs.tarefas.porId, [tarefaId]: reclamada }, ordem: state.jobs.tarefas.ordem } },
    },
  };
}

/** A coleta: a tarefa `reclamada` passa a `carregando` (a reserva da origem foi consumida
 *  pela saida do material do estoque, que quem chama faz no mesmo tick). So o quadro.
 *  So MATERIAL tem `'carregando'` (F11b: 'construir' nao carrega nada, nunca chega aqui). */
export function marcarCarregando(state: GameState, tarefaId: string): GameState {
  const tarefa = state.jobs.tarefas.porId[tarefaId];
  if (!tarefa || !ehTarefaDoSerf(tarefa) || tarefa.estado !== 'reclamada') {
    throw new Error(`marcarCarregando: '${tarefaId}' nao esta reclamada (ou nao e tarefa do serf)`);
  }
  const carregando: TarefaDoSerf = { ...tarefa, estado: 'carregando' };
  return { ...state, jobs: { tarefas: { porId: { ...state.jobs.tarefas.porId, [tarefaId]: carregando }, ordem: state.jobs.tarefas.ordem } } };
}

/** A entrega concluiu a tarefa: ela sai do quadro. Nao emite evento (quem entrega o emite). */
export function removerTarefa(state: GameState, tarefaId: string): GameState {
  const porId = { ...state.jobs.tarefas.porId };
  delete porId[tarefaId];
  return { ...state, jobs: { tarefas: { porId, ordem: state.jobs.tarefas.ordem.filter((id) => id !== tarefaId) } } };
}

/**
 * BUG-001 — a obra que acabou de virar predio leva junto TODAS as tarefas de
 * `construir` que ainda apontam para ela: a do concluinte ja saiu por
 * `removerTarefa`, mas as dos outros laborers (reclamadas) e as abertas do teto
 * de `laborersMaximosPorObra` ficavam ate `sanearTarefas` do tick SEGUINTE.
 *
 * Era um residuo de um tick que se curava sozinho — e uma janela em que o
 * quadro afirmava algo falso ("ha obra para construir aqui"). Cancelar no
 * mesmo tick faz a invariante "tarefa de construir tem destino em obra" valer
 * em TODO tick, sem tolerancia no verificador.
 *
 * Cancela, nao reabre: `'destino-completo'` nao esta em `MOTIVOS_QUE_REABREM`,
 * e o caminho e o mesmo que `sanearTarefas` usaria. A unidade que segurava a
 * tarefa larga o id na propria FSM (`tarefaDoLaborer` -> `null` -> ocioso).
 */
export function cancelarConstrucoesDe(
  state: GameState, predioId: string,
  // F-CERCO-b: o reparo que chega ao teto derruba as irmas do mesmo jeito
  tipo: 'construir' | 'reparar' = 'construir',
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let atual = state;
  const events: GameEvent[] = [];
  for (const id of [...state.jobs.tarefas.ordem]) {
    const t = atual.jobs.tarefas.porId[id];
    if (!t || t.tipo !== tipo || t.destino !== predioId) continue;
    if (t.estado === 'aberta') {
      atual = removerTarefa(atual, id); // aberta nao reserva nada: nada a liberar, nada a emitir
      continue;
    }
    const r = liberar(atual, id, 'destino-completo');
    atual = r.state;
    events.push(...r.events);
  }
  return { state: atual, events };
}

/**
 * O release: tira a tarefa de `reclamada` (ou `carregando`), e com isso devolve o que
 * ela reservava (as DUAS pontas, ou so o destino). Numa `reclamada`, motivo de UNIDADE
 * reabre a mesma tarefa; motivo de origem, caminho ou destino a CANCELA (o gerador cria
 * outra, com a origem certa). Numa `carregando`, sempre cancela. Tarefa aberta ou
 * inexistente: no-op. Devolve os eventos para quem chama juntar aos do tick.
 */
export function liberar(
  state: GameState, tarefaId: string, motivo: MotivoDeLiberacao,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const tarefa = state.jobs.tarefas.porId[tarefaId];
  if (!tarefa || tarefa.estado === 'aberta') return { state, events: [] };

  // `carregando` (F10) SEMPRE cancela: a reserva da origem ja foi consumida na coleta, a
  // carga volta a um armazem que pode nao ser o de origem, e o gerador recria a tarefa
  // com a origem certa. Reabrir deixaria uma tarefa aberta cuja origem nao tem a unidade.
  if (tarefa.estado === 'reclamada' && MOTIVOS_QUE_REABREM.includes(motivo)) {
    const reaberta: Tarefa = { ...tarefa, estado: 'aberta', reclamadaPor: null };
    return {
      state: {
        ...state,
        jobs: { tarefas: { porId: { ...state.jobs.tarefas.porId, [tarefaId]: reaberta }, ordem: state.jobs.tarefas.ordem } },
      },
      events: [{ type: 'task-released', tarefa: tarefaId, motivo, resultado: 'reaberta' }],
    };
  }

  const porId = { ...state.jobs.tarefas.porId };
  delete porId[tarefaId];
  return {
    state: {
      ...state,
      jobs: { tarefas: { porId, ordem: state.jobs.tarefas.ordem.filter((id) => id !== tarefaId) } },
    },
    events: [{ type: 'task-released', tarefa: tarefaId, motivo, resultado: 'cancelada' }],
  };
}

/**
 * As tarefas de TRANSPORTE abertas na ordem de escolha: `(nivel, custo A* em
 * ticks, numero)`. `numero` numerico, nao a string do id ('t10' < 't2').
 * A classe vem de `delivery.json` pelo id do tipo (`importanciaDoTipo`; D-TRANSPORTE-03:
 * escola > Inn > tropa > obra e canteiro > o resto) — nunca de um numero digitado aqui.
 * Com `unidadeId` o custo parte da posicao do serf (as duas pernas); sem, so
 * a perna de entrega. Custo `null` (sem caminho) vai para o fim.
 *
 * `'construir'` fica fora — nao esta na escada de `delivery.json` (decisao
 * do operador, F11b: serf e laborer nao disputam tarefa). Com `unidadeId`
 * filtra tambem por elegibilidade antes de ordenar (hoje isso so importa
 * para serf; a F11c decide como o laborer ordena as `'construir'`).
 */
export function tarefasEmOrdem(
  state: GameState, unidadeId: string | null = null, dados: GameData = gameData,
): TarefaDoSerf[] {
  return ordenarTarefasDoSerf(state, tarefasDoSerfAbertas(state, unidadeId), unidadeId, dados);
}

/** As tarefas do serf abertas e elegiveis para `unidadeId`, na ordem do quadro. */
function tarefasDoSerfAbertas(state: GameState, unidadeId: string | null): TarefaDoSerf[] {
  const unidade = unidadeId === null ? null : state.unidades.porId[unidadeId];
  // F18g: `ehTarefaDoSerf`, e nao `ehTarefaDeTransporte` — a pedra do canteiro
  // disputa a mesma escada, pelo nivel dela em `delivery.json`.
  return state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is TarefaDoSerf => t !== undefined && ehTarefaDoSerf(t) && t.estado === 'aberta')
    .filter((t) => unidade == null || elegivelParaTarefa(t.tipo, unidade.tipo));
}

/**
 * D-PRODUCAO-01b — a VEZ do destino na disputa pelo insumo escasso, ou `null` se a
 * tarefa nao disputa. Disputa a tarefa de insumo para um tipo de
 * `delivery.divisaoDoEscasso`, com a origem oferecendo ate `ofertaMaxima` e o destino com
 * ate `gavetaMaxima` na entrada — o `TryCalculateBidBasic` do KaM. A vez e o tick da
 * ultima entrega daquela mercadoria ali; quem nunca recebeu vem antes de todos.
 */
function vezNoEscasso(state: GameState, t: TarefaDoSerf, dados: GameData): number | null {
  if (t.tipo !== 'insumo-producao-parada' && t.tipo !== 'insumo-producao-baixa') return null;
  const divisao = dados.entrega.divisaoDoEscasso;
  const destino = state.predios.porId[t.destino];
  if (destino?.estado !== 'completo' || !divisao.tipos.includes(destino.tipo)) return null;
  if (sobraNaOrigem(state, t, dados) > divisao.ofertaMaxima) return null;
  if ((destino.estoque.entrada[t.mercadoria] ?? 0) > divisao.gavetaMaxima) return null;
  return destino.ultimaEntrega?.[t.mercadoria] ?? Number.NEGATIVE_INFINITY;
}

/** O custo da tarefa que disputa o escasso: so a perna ate a origem, porque a de entrega
 *  e o que o KaM ignora ("even if one is closer"). O caminho inteiro ainda tem de existir. */
function custoSemAEntrega(
  state: GameState, t: TarefaDoSerf, unidadeId: string | null, dados: GameData,
): number | null {
  if (unidadeId !== null) return planoDaTarefa(state, t, unidadeId, dados)?.ateAOrigem.custo ?? null;
  return custoDaTarefa(state, t, null, dados) === null ? null : 0;
}

/** A ordem de escolha: `(importancia, custo do caminho, vez no escasso, numero)`. O custo e o
 *  A*; na tarefa que disputa o escasso (D-PRODUCAO-01b) ele perde a perna de entrega, e a
 *  vez so desempata duas que disputam. */
function ordenarTarefasDoSerf(
  state: GameState, candidatas: readonly TarefaDoSerf[], unidadeId: string | null, dados: GameData,
): TarefaDoSerf[] {
  const chaves = new Map(candidatas.map((t) => {
    const vez = vezNoEscasso(state, t, dados);
    const custo = vez === null ? custoDaTarefa(state, t, unidadeId, dados) : custoSemAEntrega(state, t, unidadeId, dados);
    return [t.id, { importancia: importanciaDoTipo(t.tipo, dados), custo: custo ?? Number.POSITIVE_INFINITY, vez }];
  }));
  return [...candidatas].sort((a, b) => {
    const ca = chaves.get(a.id);
    const cb = chaves.get(b.id);
    if (!ca || !cb) return 0;
    if (ca.importancia !== cb.importancia) return ca.importancia - cb.importancia;
    if (ca.custo !== cb.custo) return ca.custo < cb.custo ? -1 : 1;
    if (ca.vez !== null && cb.vez !== null && ca.vez !== cb.vez) return ca.vez < cb.vez ? -1 : 1;
    return a.numero - b.numero;
  });
}

/** Reclama, para `unidadeId`, a melhor tarefa aberta QUE DER para reclamar (a melhor
 *  por ordem pode nao dar: sem estoque, sem vaga, sem caminho). */
export function reclamarMelhor(
  state: GameState, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaimMelhor {
  const abertas = tarefasDoSerfAbertas(state, unidadeId);
  if (abertas.length === 0) return { ok: false, motivo: 'sem-tarefa-aberta' };
  // D-MOVIMENTO-01d (JobBoard e porta por estado da chave) — a tarefa que o claim recusa SEM caminho (teto da feira, sem vaga, sem
  // recurso...) sai antes da ordenacao, que custa um A* por tarefa. A ordem total entre as
  // que sobram e a mesma, entao a tarefa reclamada e a mesma. O que muda e o motivo da
  // falha quando todas sao recusadas: o da primeira recusada NA ORDEM DO QUADRO, e nao na
  // de custo. A sim nao le esse motivo (`serfs.ts` so pergunta `r.ok`).
  let recusaSemCaminhoPrimeira: MotivoDeRecusaDoClaim | null = null;
  const vivas: TarefaDoSerf[] = [];
  for (const t of abertas) {
    const recusa = recusaSemCaminho(state, t, unidadeId, dados);
    if (recusa === null) vivas.push(t);
    else recusaSemCaminhoPrimeira ??= recusa;
  }
  let primeiraRecusa: MotivoDeRecusaDoClaim | null = null;
  for (const tarefa of ordenarTarefasDoSerf(state, vivas, unidadeId, dados)) {
    const r = reclamar(state, tarefa.id, unidadeId, dados);
    if (r.ok) return { ok: true, state: r.state, tarefa: tarefa.id };
    primeiraRecusa ??= r.motivo;
  }
  return { ok: false, motivo: primeiraRecusa ?? recusaSemCaminhoPrimeira ?? 'sem-tarefa-aberta' };
}

/**
 * As tarefas do laborer abertas, na ordem em que ele escolhe: `(custo do caminho A* a
 * pe ate o destino, numero)`. SEM nivel — `'construir'` nao esta na escada de
 * `delivery.json` (decisao do operador, F11b: serf e laborer nao disputam tarefa).
 *
 * PULA obra nao trabalhavel (`obraTrabalhavel`, obra.ts): nao adianta o laborer ir para
 * onde nao ha nada a fazer — e a mesma regra que `reclamar` aplica, aqui so para nao
 * nem oferecer a obra morta na ordenacao.
 *
 * F18d-1b — lista TAMBEM `'assentar-estrada'`, na MESMA ordenacao. Ela tem nivel na
 * escada (por causa do `modo`), e o nivel nao entra aqui: as duas sao do laborer, e
 * entre elas vale a mesma pergunta de sempre — o que esta mais perto sai primeiro.
 * O `obraTrabalhavel` da linha acima vira `ehPlanejada` para ela: e o equivalente
 * exato, "ainda ha o que fazer no destino".
 */
export function tarefasDoLaborerEmOrdem(
  state: GameState, unidadeId: string | null = null, dados: GameData = gameData,
): TarefaDeLaborer[] {
  const unidade = unidadeId === null ? null : state.unidades.porId[unidadeId];
  const candidatas = state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is TarefaDeLaborer => t !== undefined && ehTarefaDeLaborer(t) && t.estado === 'aberta')
    .filter((t) => unidade == null || elegivelParaTarefa(t.tipo, unidade.tipo))
    .filter((t) => {
      // O tile ja pode ter saido do canteiro entre a criacao e agora — e cada
      // tarefa de tile olha o SEU canteiro. F18h: o do campo e outro objeto.
      // F18g: o de estrada exige tambem pedra no tile ou a caminho — o mesmo
      // portao de `reclamar`, aqui so para nem oferecer o tile vazio.
      if (ehTarefaDeAssentamento(t)) return tileDeEstradaTrabalhavel(state, t.destinoTile, dados);
      if (ehTarefaDeAradura(t)) return ehCampoPlanejado(state.camposPlanejados, t.destinoTile);
      if (ehTarefaDeReparo(t)) return predioReparavel(state, t.destino, dados);
      return obraTrabalhavel(state, t.destino, dados);
    });
  const chaves = new Map(candidatas.map((t) => [
    t.id,
    unidadeId === null ? 0 : caminhoDoLaborer(state, t, unidadeId, dados)?.custo ?? Number.POSITIVE_INFINITY,
  ]));
  return [...candidatas].sort((a, b) => {
    const ca = chaves.get(a.id) ?? Number.POSITIVE_INFINITY;
    const cb = chaves.get(b.id) ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.numero - b.numero;
  });
}

/** Reclama, para o laborer `unidadeId`, a melhor `'construir'` aberta QUE DER para
 *  reclamar — irma de `reclamarMelhor`, que so serve `'material-para-obra'`. */
export function reclamarMelhorDoLaborer(
  state: GameState, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaimMelhor {
  const candidatas = tarefasDoLaborerEmOrdem(state, unidadeId, dados);
  const primeira = candidatas[0];
  if (primeira === undefined) return { ok: false, motivo: 'sem-tarefa-aberta' };
  let primeiraRecusa: MotivoDeRecusaDoClaim | null = null;
  for (const tarefa of candidatas) {
    const r = reclamar(state, tarefa.id, unidadeId, dados);
    if (r.ok) return { ok: true, state: r.state, tarefa: tarefa.id };
    primeiraRecusa ??= r.motivo;
  }
  return { ok: false, motivo: primeiraRecusa ?? 'sem-tarefa-aberta' };
}

/**
 * As `'ocupar'` abertas na ordem de escolha do especialista: `(custo do caminho
 * A* a pe ate a porta, numero)`. SEM nivel — `'ocupar'` nao esta na escada de
 * `delivery.json`, como `'construir'` nao esta. Filtra por `podeReclamar`: um
 * lenhador nunca ve a vaga da pedreira.
 */
export function tarefasDeOcupacaoEmOrdem(
  state: GameState, unidadeId: string | null = null, dados: GameData = gameData,
): TarefaOcupar[] {
  const unidade = unidadeId === null ? null : state.unidades.porId[unidadeId];
  const candidatas = state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is TarefaOcupar => t !== undefined && t.tipo === 'ocupar' && t.estado === 'aberta')
    .filter((t) => unidade == null || podeReclamar(state, t, unidade.tipo, dados));
  const chaves = new Map(candidatas.map((t) => [
    t.id,
    unidadeId === null ? 0 : caminhoAtePredioCompleto(state, t.destino, unidadeId, dados)?.custo ?? Number.POSITIVE_INFINITY,
  ]));
  return [...candidatas].sort((a, b) => {
    const ca = chaves.get(a.id) ?? Number.POSITIVE_INFINITY;
    const cb = chaves.get(b.id) ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.numero - b.numero;
  });
}

/** F14 — reclama, para o especialista `unidadeId`, a melhor `'ocupar'` aberta QUE
 *  DER para reclamar. Irma de `reclamarMelhorDoLaborer`. */
export function reclamarMelhorOcupacao(
  state: GameState, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaimMelhor {
  const candidatas = tarefasDeOcupacaoEmOrdem(state, unidadeId, dados);
  const primeira = candidatas[0];
  if (primeira === undefined) return { ok: false, motivo: 'sem-tarefa-aberta' };
  let primeiraRecusa: MotivoDeRecusaDoClaim | null = null;
  for (const tarefa of candidatas) {
    const r = reclamar(state, tarefa.id, unidadeId, dados);
    if (r.ok) return { ok: true, state: r.state, tarefa: tarefa.id };
    primeiraRecusa ??= r.motivo;
  }
  return { ok: false, motivo: primeiraRecusa ?? 'sem-tarefa-aberta' };
}

/**
 * F20b — os assentos abertos na ordem de escolha do civil com fome: `(custo do
 * caminho A* a pe ate a porta, numero)`. SEM nivel — `'comer'` nao esta na escada de
 * `delivery.json`, como `'ocupar'` e `'construir'` nao estao: quem vai comer nao
 * disputa carga com serf nenhum.
 *
 * Copia deliberada de `tarefasDeOcupacaoEmOrdem`, inclusive no filtro por
 * `podeReclamar` — que aqui responde "e civil?" (o militar depende do `Feed`, F17+).
 */
export function tarefasDeComerEmOrdem(
  state: GameState, unidadeId: string | null = null, dados: GameData = gameData,
): TarefaComer[] {
  const unidade = unidadeId === null ? null : state.unidades.porId[unidadeId];
  const candidatas = state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is TarefaComer => t !== undefined && t.tipo === 'comer' && t.estado === 'aberta')
    .filter((t) => unidade == null || podeReclamar(state, t, unidade.tipo, dados));
  const chaves = new Map(candidatas.map((t) => [
    t.id,
    unidadeId === null ? 0 : caminhoAtePredioCompleto(state, t.destino, unidadeId, dados)?.custo ?? Number.POSITIVE_INFINITY,
  ]));
  return [...candidatas].sort((a, b) => {
    const ca = chaves.get(a.id) ?? Number.POSITIVE_INFINITY;
    const cb = chaves.get(b.id) ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.numero - b.numero;
  });
}

/** F20b — reclama, para o civil com fome `unidadeId`, o melhor assento aberto QUE
 *  DER para reclamar. Irma de `reclamarMelhorOcupacao`. */
export function reclamarMelhorComer(
  state: GameState, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaimMelhor {
  const candidatas = tarefasDeComerEmOrdem(state, unidadeId, dados);
  const primeira = candidatas[0];
  if (primeira === undefined) return { ok: false, motivo: 'sem-tarefa-aberta' };
  let primeiraRecusa: MotivoDeRecusaDoClaim | null = null;
  for (const tarefa of candidatas) {
    const r = reclamar(state, tarefa.id, unidadeId, dados);
    if (r.ok) return { ok: true, state: r.state, tarefa: tarefa.id };
    primeiraRecusa ??= r.motivo;
  }
  return { ok: false, motivo: primeiraRecusa ?? 'sem-tarefa-aberta' };
}
