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
import {
  ehTarefaDeTransporte, ID_DO_ARMAZEM, MERCADORIA_DE_OURO, ORIGEM_ESPERADA_POR_TIPO,
  origemDaTarefaVale,
} from '../state';
import type { GameData } from '../data/types';
import { gameData } from '../data';
import { armazensCompletos, distanciaEntrePredios } from '../estradas';
import {
  criarTarefa, criarTarefaDeConstrucao, criarTarefaDeInsumo, criarTarefaDeOcupacao,
  criarTarefaDeOuro, criarTarefaParaArmazem, distanciaDaTarefa, liberar, podeReclamar,
  TIPO_QUE_CARREGA,
} from '../jobs';
import type { MotivoDeLiberacao } from '../jobs';
import {
  demandaNoDestino, disponivelNaOrigem, ofertaNaOrigem, sobraNaOrigem, vagaDoDestino,
} from '../reservas';
import {
  demandaDeInsumo, excedenteNaEntrada, insumosDoPredio, produtorParado,
} from '../insumo';
import { obraNivelada } from '../obra';
import { ehEscolaCompleta, ouroNecessario } from '../escola';
import { ehPredioOcupavel, vagasDoPredio } from '../ocupacao';

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
 * construir; escola completa, para ouro (F13); predio completo, ocupavel e VAGO,
 * para ocupar (F14). `null` se vale. Quem escolhe o ramo e o TIPO da tarefa, nao
 * o predio: material apontando para escola nao passa a valer so porque o predio
 * existe.
 */
function motivoDoDestino(state: GameState, t: Tarefa, dados: GameData): MotivoDeLiberacao | null {
  const destino = state.predios.porId[t.destino];
  if (!destino) return 'destino-sumiu';
  switch (t.tipo) {
    case 'material-para-obra':
    case 'construir':
      return ehObra(destino) ? null : 'destino-completo';
    case 'ouro-para-escola':
      return ehEscolaCompleta(destino) ? null : 'destino-sumiu';
    // F15b — o destino de insumo tem que continuar CONSUMINDO a mercadoria.
    // `insumosDoPredio` e o mesmo predicado que o gerador usa.
    case 'insumo-producao-parada':
    case 'insumo-producao-baixa':
      return insumosDoPredio(state, t.destino, dados).includes(t.mercadoria) ? null : 'destino-sumiu';
    // F15b — niveis 6 e 7 entregam num armazem, e so nele.
    case 'saida-cheia-para-armazem':
    case 'excedente-para-armazem':
      return ehArmazemCompleto(destino) ? null : 'destino-sumiu';
    case 'ocupar':
      // Deixou de ser predio ocupavel (demolido e replantado, save de outra
      // versao): a tarefa nao tem mais sentido. Ja ocupado: a vaga acabou — e o
      // unico jeito de `vagaDeOcupacao` ficar negativa, e sai por aqui.
      if (!ehPredioOcupavel(destino, dados)) return 'destino-sumiu';
      return destino.ocupante === null ? null : 'destino-completo';
  }
}

/** O motivo pelo qual uma tarefa reclamada, sozinha, deixou de valer; `null` se vale. */
function motivoIndividual(state: GameState, t: Tarefa, dados: GameData): MotivoDeLiberacao | null {
  // O DESTINO vem primeiro (F14). Para `'ocupar'`, a elegibilidade e funcao do
  // predio de destino (`podeReclamar`): com o predio demolido, perguntar da
  // unidade primeiro devolveria 'unidade-removida' para uma unidade viva — o
  // rotulo da causa errada, e ainda por cima um que REABRE a tarefa. O motivo
  // do destino tambem e o mais especifico dos dois quando ambos valem.
  const motivoDeDestino = motivoDoDestino(state, t, dados);
  if (motivoDeDestino !== null) return motivoDeDestino;
  const unidade = t.reclamadaPor === null ? undefined : state.unidades.porId[t.reclamadaPor];
  if (!unidade || !podeReclamar(state, t, unidade.tipo, dados)) return 'unidade-removida';
  if (!ehTarefaDeTransporte(t)) return null; // construir/ocupar: nada alem do destino importa
  const destino = state.predios.porId[t.destino];
  const origem = state.predios.porId[t.origem];
  // F15b — a forma exigida da origem vem do TIPO (`origemDaTarefaVale`): ate o
  // nivel 5 e armazem; nos niveis 6 e 7 e o produtor que tem a sobra.
  if (!origemDaTarefaVale(state, t) || origem === undefined) return 'origem-sumiu';
  if (!destino || distanciaEntrePredios(state, origem, destino, dados) === null) return 'caminho-cortado';
  return null;
}

/**
 * O motivo pelo qual uma tarefa CARREGANDO deixou de valer; `null` se vale. So olha a
 * unidade (a carga esta com ela) e o destino: a origem e o caminho da origem ja nao
 * importam, a coleta aconteceu. O caminho do serf carregado ate a obra e da FSM, que
 * tem a posicao dele.
 */
function motivoDaCarregando(state: GameState, t: Tarefa, dados: GameData): MotivoDeLiberacao | null {
  const unidade = t.reclamadaPor === null ? undefined : state.unidades.porId[t.reclamadaPor];
  if (!unidade || unidade.tipo !== TIPO_QUE_CARREGA) return 'unidade-removida';
  return motivoDoDestino(state, t, dados);
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
  if (motivoDoDestino(state, t, dados) !== null) return false;
  if (!ehTarefaDeTransporte(t)) return true;
  // F13: o destino tambem precisa continuar PEDINDO (a fila de treino encolhe quando o
  // jogador cancela um item; `faltam` de uma obra encolhe na entrega).
  if (demandaNoDestino(state, t, dados) < 1) return false;
  if (!origemDaTarefaVale(state, t)) return false;
  // F15b — `sobraNaOrigem` generaliza `disponivelNaOrigem`: le a gaveta do tipo
  // e, no nivel 7, o EXCEDENTE em vez do estoque bruto.
  if (sobraNaOrigem(state, t, dados) < 1) return false;
  // F15b/D2 — a urgencia esta fotografada no tipo. Se ela virou, a aberta deixa
  // de valer; o gerador cria a do nivel certo no MESMO tick, de graca, porque
  // aberta nao reserva nada. Reclamada e carregando nunca passam por aqui.
  if (t.tipo === 'insumo-producao-parada' || t.tipo === 'insumo-producao-baixa') {
    if (produtorParado(state, t.destino, t.mercadoria, dados) !== (t.tipo === 'insumo-producao-parada')) return false;
  }
  return distanciaDaTarefa(state, t, dados) !== null;
}

/**
 * O TETO de tarefas que podem coexistir no grupo de `t`, e quantas ja existem
 * nele. O grupo muda de eixo com o tipo:
 *
 *  - niveis 1 a 5 agrupam por DESTINO, e o teto e a demanda de la (`faltam` da
 *    obra, a fila da escola, a gaveta do produtor);
 *  - niveis 6 e 7 agrupam por ORIGEM, e o teto e o que a gaveta dela oferece —
 *    o destino e um armazem, que nao tem teto nenhum (`demandaNoDestino`
 *    devolve infinito de proposito, e `existentes > Infinity` nunca seria
 *    verdade).
 *
 * `carregando` sai da contagem do lado da origem: a coleta ja tirou a unidade da
 * gaveta, entao ela nao disputa mais com as abertas. Do lado do destino ela
 * continua contando, porque a vaga la so e consumida na entrega.
 */
function grupoDeAbertas(
  state: GameState, t: TarefaDeTransporte, dados: GameData,
): { readonly teto: number; readonly existentes: number } {
  const mesmoTipoEMercadoria = tarefasPorNumero(state)
    .filter((o): o is TarefaDeTransporte => ehTarefaDeTransporte(o) && o.tipo === t.tipo && o.mercadoria === t.mercadoria);
  if (ORIGEM_ESPERADA_POR_TIPO[t.tipo] === 'outro-predio') {
    return {
      teto: ofertaNaOrigem(state, t, dados),
      existentes: mesmoTipoEMercadoria.filter((o) => o.origem === t.origem && o.estado !== 'carregando').length,
    };
  }
  return {
    teto: demandaNoDestino(state, t, dados),
    existentes: mesmoTipoEMercadoria.filter((o) => o.destino === t.destino).length,
  };
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
    const motivo = t.estado === 'reclamada' ? motivoIndividual(atual, t, dados) : motivoDaCarregando(atual, t, dados);
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
    // F15b — `sobraNaOrigem` e `oferta - reservado` na gaveta do tipo, o mesmo
    // que a conta antiga fazia a mao para a `saida` do armazem. Negativa =
    // reservaram mais do que a origem tem (ou do que ela ainda OFERECE: a fila
    // da escola voltou a querer o ouro que ja era excedente).
    if (t.estado === 'reclamada' && sobraNaOrigem(atual, t, dados) < 0) {
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
      const { teto, existentes } = grupoDeAbertas(atual, t, dados);
      if (existentes > teto) atual = cancelarAberta(atual, t.id);
    } else if (t.tipo === 'construir') {
      const existentes = tarefasPorNumero(atual).filter((o) => o.tipo === 'construir' && o.destino === t.destino).length;
      if (existentes > dados.construcao.laborersMaximosPorObra) atual = cancelarAberta(atual, t.id);
    } else {
      // 'ocupar' (F14): o teto e a VAGA do predio (1 vago, 0 ocupado), derivada
      // do estado — nao ha teto em dado, ver `vagasDoPredio`.
      const existentes = tarefasPorNumero(atual).filter((o) => o.tipo === 'ocupar' && o.destino === t.destino).length;
      if (existentes > vagasDoPredio(atual.predios.porId[t.destino], dados)) atual = cancelarAberta(atual, t.id);
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
 * F15b — o espelho de `origemMaisPerto` para os niveis 6 e 7: o armazem completo
 * de menor caminho por estrada a partir de `origem`. Aqui a origem e que e
 * conhecida (e o predio que tem a sobra) e quem se escolhe e o destino. Mesmo
 * desempate: menor distancia, e no empate o primeiro em `predios.ordem`.
 *
 * `null` quando nenhum armazem esta ligado — e nao e travamento: e o mesmo
 * silencio de uma obra sem estrada. A carga espera na gaveta ate haver caminho.
 */
function destinoMaisPerto(state: GameState, origem: PredioCompleto, dados: GameData): string | null {
  let melhor: { id: string; distancia: number } | null = null;
  for (const armazem of armazensCompletos(state)) {
    if (armazem.id === origem.id) continue;
    const distancia = distanciaEntrePredios(state, origem, armazem, dados);
    if (distancia === null) continue;
    if (melhor === null || distancia < melhor.distancia) melhor = { id: armazem.id, distancia };
  }
  return melhor === null ? null : melhor.id;
}

/** As mercadorias de uma gaveta com quantidade positiva, em ordem ALFABETICA —
 *  e nao a ordem das chaves do objeto, que depende de como o estoque foi montado
 *  e nao sobreviveria a um save/load como criterio de determinismo. Nao da para
 *  usar `economia.mercadorias`: `gold` nao esta la, e e justamente o ouro preso
 *  na escola que o nivel 7 existe para devolver. */
function mercadoriasDaGaveta(predio: PredioCompleto, gaveta: 'entrada' | 'saida'): string[] {
  return Object.keys(predio.estoque[gaveta]).filter((m) => (predio.estoque[gaveta][m] ?? 0) > 0).sort();
}

/**
 * F15b — niveis 4 e 5: o insumo que falta na gaveta `entrada` de cada produtor.
 * Uma tarefa por unidade que falta, limitada pelo que o armazem escolhido tem
 * livre — diferente do material de obra, que gera pelo `faltam` inteiro mesmo
 * sem estoque. A diferenca e deliberada: aqui a demanda e permanente (a gaveta
 * quer ficar cheia para sempre), e gerar tarefa sem lastro encheria o quadro de
 * aberta que ninguem pode atender.
 *
 * `parada` vem de `produtorParado` no momento da criacao — a urgencia do D2.
 */
function gerarTarefasDeInsumo(state: GameState, dados: GameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const predio = atual.predios.porId[id];
    if (!predio || predio.estado !== 'completo') continue;
    for (const mercadoria of insumosDoPredio(atual, id, dados)) {
      const querem = demandaDeInsumo(atual, id, mercadoria, dados);
      const existentes = tarefasPorNumero(atual)
        .filter((t) => ehTarefaDeTransporte(t) && t.destino === id && t.mercadoria === mercadoria
          && (t.tipo === 'insumo-producao-parada' || t.tipo === 'insumo-producao-baixa')).length;
      if (querem <= existentes) continue;
      const origem = origemMaisPerto(atual, predio, mercadoria, dados);
      if (origem === null) continue;
      const livres = disponivelNaOrigem(atual, origem, mercadoria);
      const parada = produtorParado(atual, id, mercadoria, dados);
      for (let i = existentes; i < Math.min(querem, existentes + livres); i++) {
        atual = criarTarefaDeInsumo(atual, { mercadoria, origem, destino: id, parada }).state;
      }
    }
  }
  return atual;
}

/**
 * F15b — niveis 6 e 7: o que um predio COMPLETO que nao e armazem tem para
 * devolver. Da gaveta `saida` sai tudo (nivel 6, e dispara com estoque > 0 e nao
 * com a gaveta cheia — nota D3); da `entrada` sai so o EXCEDENTE (nivel 7), o
 * que o predio nao pede mais.
 *
 * O armazem nao entra no laco: ele nunca e origem, ou passaria a mandar carga
 * para si mesmo (ou para o vizinho) sem que ninguem tivesse pedido.
 */
function gerarTarefasParaArmazem(state: GameState, dados: GameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const predio = atual.predios.porId[id];
    if (!predio || predio.estado !== 'completo' || predio.tipo === ID_DO_ARMAZEM) continue;
    const destino = destinoMaisPerto(atual, predio, dados);
    if (destino === null) continue;
    for (const excedente of [false, true]) {
      const gaveta = excedente ? 'entrada' : 'saida';
      for (const mercadoria of mercadoriasDaGaveta(predio, gaveta)) {
        const tipo = excedente ? 'excedente-para-armazem' : 'saida-cheia-para-armazem';
        const oferta = excedente
          ? excedenteNaEntrada(atual, id, mercadoria, dados)
          : (predio.estoque.saida[mercadoria] ?? 0);
        const existentes = tarefasPorNumero(atual)
          .filter((t) => ehTarefaDeTransporte(t) && t.tipo === tipo && t.origem === id
            && t.mercadoria === mercadoria && t.estado !== 'carregando').length;
        for (let i = existentes; i < oferta; i++) {
          atual = criarTarefaParaArmazem(atual, { mercadoria, origem: id, destino, excedente }).state;
        }
      }
    }
  }
  return atual;
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

/**
 * F14 — uma vaga de OCUPACAO por predio completo, vago e que pede trabalhador.
 * Cria MESMO SEM especialista daquele tipo no mapa, como `'construir'` cria sem
 * laborer (F11b): a vaga existe no quadro assim que o predio fica pronto. Quem
 * responde "este predio esta parado esperando trabalhador" e `predio.ocupante`
 * (F22), nunca a existencia da tarefa — entao o quadro nao precisa mentir.
 *
 * Nao exige estrada: o especialista anda em modo `'livre'`, como o laborer.
 */
function gerarTarefasDeOcupacao(state: GameState, dados: GameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const predio = atual.predios.porId[id];
    if (!ehPredioOcupavel(predio, dados) || predio.ocupante !== null) continue;
    const existentes = tarefasPorNumero(atual).filter((t) => t.tipo === 'ocupar' && t.destino === id).length;
    if (existentes >= vagasDoPredio(predio, dados)) continue;
    atual = criarTarefaDeOcupacao(atual, id).state;
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
  // F15b: os niveis 4 a 7, tambem sobre PREDIOS COMPLETOS. A ordem de criacao
  // nao decide prioridade nenhuma — quem decide e `nivelDoTipo` no atendimento;
  // seguir a escada aqui so deixa os ids em ordem legivel na evidencia.
  atual = gerarTarefasDeInsumo(atual, dados);
  atual = gerarTarefasParaArmazem(atual, dados);
  // F14 por ultimo, e sobre PREDIOS COMPLETOS — o laco acima so olha obra. Uma
  // obra que o laborer completou neste tick ja entra aqui e ganha a vaga de
  // ocupante no mesmo tick; o especialista a reclama no tick seguinte.
  return gerarTarefasDeOcupacao(atual, dados);
}
