/**
 * Os dois sistemas do JobBoard que rodam TODO tick, depois dos comandos e nesta ordem:
 * `sanearTarefas` (revalida o que ja existe) e `gerarTarefas` (cria o que falta).
 *
 * `sanearTarefas` e o que garante o `release` em todo ramo de falha (CLAUDE.md §5:
 * "se `release` nao for chamado em algum ramo de erro, e bug"): em vez de sete `if`
 * espalhados que alguem precisa lembrar de chamar, toda tarefa reclamada e revalidada
 * contra o estado a cada tick, e o que deixou de valer passa por `liberar`. O ramo
 * "pedido da unidade" (a FSM do serf desiste) e o unico que nao e detectavel daqui:
 * quem o chama e a F10.
 *
 * Ordem fixa: tarefas por `numero` (o excedente sai do maior para o menor). Mesma
 * entrada, mesmo estado.
 */
import type {
  GameEvent, GameState, Predio, PredioCompleto, PredioEmObra, Tarefa, TarefaDeTransporte,
} from '../state';
import { ehTarefaDeTransporte, ID_DO_ARMAZEM, MERCADORIA_DE_OURO } from '../state';
import type { GameData } from '../data/types';
import { gameData } from '../data';
import { armazensCompletos, distanciaEntrePredios } from '../estradas';
import {
  criarTarefa, criarTarefaDeConstrucao, criarTarefaDeOuro, distanciaDaTarefa, elegivelParaTarefa,
  liberar, TIPO_QUE_CARREGA,
} from '../jobs';
import type { MotivoDeLiberacao } from '../jobs';
import { demandaNoDestino, disponivelNaOrigem, reservadoNaOrigem, vagaDoDestino } from '../reservas';
import { obraNivelada } from '../obra';
import { ehEscolaCompleta, ouroNecessario } from '../escola';

export interface ResultadoDeSistema {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

function tarefasPorNumero(state: GameState): Tarefa[] {
  return state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is Tarefa => t !== undefined)
    .sort((a, b) => a.numero - b.numero);
}

const ehArmazemCompleto = (p: Predio | undefined): p is PredioCompleto =>
  p !== undefined && p.estado === 'completo' && p.tipo === ID_DO_ARMAZEM;

const ehObra = (p: Predio | undefined): p is PredioEmObra => p !== undefined && p.estado === 'obra';

/**
 * O destino de `t` ainda e do tipo que a tarefa pressupoe? Obra, para material e
 * construir; escola completa, para ouro (F13). `null` se vale. Quem escolhe o ramo e
 * o TIPO da tarefa, nao o predio: material apontando para escola nao passa a valer
 * so porque o predio existe.
 */
function motivoDoDestino(state: GameState, t: Tarefa): MotivoDeLiberacao | null {
  const destino = state.predios.porId[t.destino];
  if (!destino) return 'destino-sumiu';
  if (t.tipo === 'ouro-para-escola') return ehEscolaCompleta(destino) ? null : 'destino-sumiu';
  return ehObra(destino) ? null : 'destino-completo';
}

/** O motivo pelo qual uma tarefa reclamada, sozinha, deixou de valer; `null` se vale. */
function motivoIndividual(state: GameState, t: Tarefa, dados: GameData): MotivoDeLiberacao | null {
  const unidade = t.reclamadaPor === null ? undefined : state.unidades.porId[t.reclamadaPor];
  if (!unidade || !elegivelParaTarefa(t.tipo, unidade.tipo)) return 'unidade-removida';
  const motivoDeDestino = motivoDoDestino(state, t);
  if (motivoDeDestino !== null) return motivoDeDestino;
  if (!ehTarefaDeTransporte(t)) return null; // construir: nada alem do destino importa
  const destino = state.predios.porId[t.destino];
  const origem = state.predios.porId[t.origem];
  if (!ehArmazemCompleto(origem)) return 'origem-sumiu';
  if (!destino || distanciaEntrePredios(state, origem, destino, dados) === null) return 'caminho-cortado';
  return null;
}

/**
 * O motivo pelo qual uma tarefa CARREGANDO deixou de valer; `null` se vale. So olha a
 * unidade (a carga esta com ela) e o destino: a origem e o caminho da origem ja nao
 * importam, a coleta aconteceu. O caminho do serf carregado ate a obra e da FSM, que
 * tem a posicao dele.
 */
function motivoDaCarregando(state: GameState, t: Tarefa): MotivoDeLiberacao | null {
  const unidade = t.reclamadaPor === null ? undefined : state.unidades.porId[t.reclamadaPor];
  if (!unidade || unidade.tipo !== TIPO_QUE_CARREGA) return 'unidade-removida';
  return motivoDoDestino(state, t);
}

/** Tira uma tarefa ABERTA do quadro. Nao ha o que liberar (uma aberta nao reserva nada),
 *  entao nao emite `task-released`. */
function cancelarAberta(state: GameState, tarefaId: string): GameState {
  const porId = { ...state.jobs.tarefas.porId };
  delete porId[tarefaId];
  return { ...state, jobs: { tarefas: { porId, ordem: state.jobs.tarefas.ordem.filter((id) => id !== tarefaId) } } };
}

/** Uma aberta vale enquanto o destino e obra; material tambem precisa de origem
 *  com algo livre e caminho. Se a origem esvaziou, cancela: o gerador refaz a
 *  tarefa com outra origem. Construir: so o destino importa (o laborer nao
 *  carrega material, nao ha origem nem caminho a checar). */
function abertaVale(state: GameState, t: Tarefa, dados: GameData): boolean {
  if (motivoDoDestino(state, t) !== null) return false;
  if (!ehTarefaDeTransporte(t)) return true;
  // F13: o destino tambem precisa continuar PEDINDO (a fila de treino encolhe quando o
  // jogador cancela um item; `faltam` de uma obra encolhe na entrega).
  if (demandaNoDestino(state, t, dados) < 1) return false;
  if (!ehArmazemCompleto(state.predios.porId[t.origem])) return false;
  if (disponivelNaOrigem(state, t.origem, t.mercadoria) < 1) return false;
  return distanciaDaTarefa(state, t, dados) !== null;
}

export function sanearTarefas(state: GameState, dados: GameData = gameData): ResultadoDeSistema {
  let atual = state;
  const events: GameEvent[] = [];
  const liberarComMotivo = (id: string, motivo: MotivoDeLiberacao): void => {
    const r = liberar(atual, id, motivo);
    atual = r.state;
    events.push(...r.events);
  };

  // 1. cada tarefa em curso, sozinha. Reclamada: unidade, origem, destino, caminho.
  //    Carregando: so unidade e destino (a coleta ja aconteceu).
  for (const t of tarefasPorNumero(state)) {
    if (t.estado === 'aberta') continue;
    const motivo = t.estado === 'reclamada' ? motivoIndividual(atual, t, dados) : motivoDaCarregando(atual, t);
    if (motivo !== null) liberarComMotivo(t.id, motivo);
  }

  // 2. em grupo: o reservado nao pode passar do que a origem tem (so reclamadas reservam
  //    a origem) nem do que a obra ainda pede (reclamadas e carregando). A ordem de soltar
  //    e fixa: as RECLAMADAS antes (ninguem tem carga na mao), e dentro de cada estado do
  //    maior numero para o menor, ate caber. So MATERIAL: o teto de 'construir'
  //    (`laborersMaximosPorObra`) e constante do dado, nunca encolhe em runtime como
  //    `faltam` encolhe — uma 'construir' reclamada nunca fica retroativamente invalida
  //    por essa via (ver `vagaDeConstrucao`, reservas.ts).
  const emGrupo = tarefasPorNumero(atual)
    .filter((t): t is TarefaDeTransporte => ehTarefaDeTransporte(t) && t.estado !== 'aberta')
    .reverse();
  const ordemDeSoltar = [...emGrupo.filter((t) => t.estado === 'reclamada'), ...emGrupo.filter((t) => t.estado === 'carregando')];
  for (const t of ordemDeSoltar) {
    const origem = atual.predios.porId[t.origem];
    if (
      t.estado === 'reclamada' && ehArmazemCompleto(origem)
      && (origem.estoque.saida[t.mercadoria] ?? 0) < reservadoNaOrigem(atual, t.origem, t.mercadoria)
    ) {
      liberarComMotivo(t.id, 'origem-sem-recurso');
    } else if (vagaDoDestino(atual, t, dados) < 0) {
      // A demanda caiu abaixo do reservado: obra que recebeu, ou fila de treino que
      // encolheu (F13). O excedente sai, do maior numero para o menor.
      liberarComMotivo(t.id, 'destino-completo');
    }
  }

  // 3. abertas que nao valem mais
  for (const t of tarefasPorNumero(atual)) {
    if (t.estado === 'aberta' && !abertaVale(atual, t, dados)) atual = cancelarAberta(atual, t.id);
  }

  // 4. abertas em excesso: nunca mais tarefas (abertas + reclamadas, por obra e — so
  //    material — por mercadoria) do que o teto pede. Material: teto = faltam[mercadoria]
  //    (encolhe com a entrega). Construir: teto = laborersMaximosPorObra (constante).
  for (const t of tarefasPorNumero(atual).reverse()) {
    if (t.estado !== 'aberta') continue;
    if (ehTarefaDeTransporte(t)) {
      const teto = demandaNoDestino(atual, t, dados);
      const existentes = tarefasPorNumero(atual)
        .filter((o) => o.tipo === t.tipo && o.destino === t.destino && ehTarefaDeTransporte(o) && o.mercadoria === t.mercadoria).length;
      if (existentes > teto) atual = cancelarAberta(atual, t.id);
    } else {
      const existentes = tarefasPorNumero(atual).filter((o) => o.tipo === 'construir' && o.destino === t.destino).length;
      if (existentes > dados.construcao.laborersMaximosPorObra) atual = cancelarAberta(atual, t.id);
    }
  }

  return { state: atual, events };
}

/** O armazem completo de menor caminho por estrada ate `obra` que tem `mercadoria`
 *  livre; empate: o primeiro em `predios.ordem`. `null` se nenhum serve. */
function origemMaisPerto(state: GameState, destino: Predio, mercadoria: string, dados: GameData): string | null {
  let melhor: { id: string; distancia: number } | null = null;
  for (const armazem of armazensCompletos(state)) {
    if (disponivelNaOrigem(state, armazem.id, mercadoria) < 1) continue;
    const distancia = distanciaEntrePredios(state, armazem, destino, dados);
    if (distancia === null) continue;
    if (melhor === null || distancia < melhor.distancia) melhor = { id: armazem.id, distancia };
  }
  return melhor === null ? null : melhor.id;
}

/**
 * Cria as tarefas de nivel "material para obra": para cada obra e cada mercadoria de
 * `faltam` (na ordem de `economia.mercadorias`), tantas tarefas quantas faltam menos as
 * que ja existem. Sem armazem ligado e com estoque, nao cria: a obra espera, e a
 * tarefa surge quando a estrada e o estoque existirem.
 *
 * "Obra ja nivelada" (GDD): o portao so vale para MATERIAL — o laborer nivela sem
 * carregar nada, e tarefa de construir e o que faz o nivelamento acontecer. Pos o
 * portao tambem no laco de construir seria deadlock (F11c, Task 6).
 */
/**
 * F13 — as tarefas de nivel "ouro para escola": para cada escola completa, tantas
 * quantas a fila de treino ainda pede (`ouroNecessario`) menos as que ja existem.
 * Sem armazem ligado e com ouro livre, nao cria: a fila espera, e a tarefa surge
 * quando a estrada e o ouro existirem — mesma regra do material.
 *
 * Roda ANTES do laco das obras so para espelhar a escada de `delivery.json` (ouro e
 * nivel 2, material e 3) na leitura do quadro; a ORDEM de escolha do serf continua
 * vindo de `tarefasEmOrdem`, nao da ordem de criacao.
 */
function gerarTarefasDeOuro(state: GameState, dados: GameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const escola = atual.predios.porId[id];
    if (!ehEscolaCompleta(escola)) continue;
    const querem = ouroNecessario(atual, id, dados);
    const existentes = tarefasPorNumero(atual)
      .filter((t) => t.tipo === 'ouro-para-escola' && t.destino === id).length;
    if (querem <= existentes) continue;
    const origem = origemMaisPerto(atual, escola, MERCADORIA_DE_OURO, dados);
    if (origem === null) continue;
    for (let i = existentes; i < querem; i++) {
      atual = criarTarefaDeOuro(atual, { origem, destino: id }).state;
    }
  }
  return atual;
}

export function gerarTarefas(state: GameState, dados: GameData = gameData): GameState {
  let atual = gerarTarefasDeOuro(state, dados);
  for (const id of state.predios.ordem) {
    const obra = atual.predios.porId[id];
    if (!ehObra(obra)) continue;
    if (obraNivelada(obra, dados)) {
      for (const mercadoria of dados.economia.mercadorias) {
        const faltam = obra.obra.faltam[mercadoria] ?? 0;
        const existentes = tarefasPorNumero(atual)
          .filter((t) => t.tipo === 'material-para-obra' && t.destino === obra.id && t.mercadoria === mercadoria).length;
        if (faltam <= existentes) continue;
        const origem = origemMaisPerto(atual, obra, mercadoria, dados);
        if (origem === null) continue;
        for (let i = existentes; i < faltam; i++) {
          atual = criarTarefa(atual, { mercadoria, origem, destino: obra.id }).state;
        }
      }
    }

    // 'construir' (F11b): ate o teto do dado, sem checar armazem/estrada — o
    // laborer nivela/martela sem carregar material (decisao do operador).
    const existentesConstruir = tarefasPorNumero(atual).filter((t) => t.tipo === 'construir' && t.destino === obra.id).length;
    for (let i = existentesConstruir; i < dados.construcao.laborersMaximosPorObra; i++) {
      atual = criarTarefaDeConstrucao(atual, obra.id).state;
    }
  }
  return atual;
}
