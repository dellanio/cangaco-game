/**
 * As reservas do JobBoard, DERIVADAS das tarefas `reclamada` (ver `Tarefa` em
 * state.ts). Nao ha contador: a reserva existe enquanto a tarefa esta reclamada e
 * deixa de existir com ela — por isso "release restaura exatamente o estado
 * anterior" e estrutural, e a reserva sobrevive ao save/load de graca.
 *
 * Este modulo so depende de tipos do estado (nao de `estradas`): o debito de pedra
 * da estrada (F08) precisa do `disponivel`, e `jobs.ts` precisa de `estradas` —
 * separar aqui evita o ciclo.
 *
 * F-T2c — a reserva de TILE de colheita nao mora aqui, e sim em
 * `tilesReservadosParaColheita` (`sim/recursos.ts`), pela regra do paragrafo
 * acima: a chave de tile vem de `estradas.ts`, e importa-la aqui fecharia o
 * ciclo que este arquivo existe para evitar. Ela tambem nao e uma QUANTIDADE
 * como tudo que esta abaixo — e o tile inteiro, ocupado ou livre.
 *
 * Custo: cada consulta e O(nº de tarefas). Nao medido; ver o cenario de carga em
 * `test-output/F09.json` e a nota da F10 no BUILD_PLAN. Se pedir indice, e otimizacao
 * (por predio e mercadoria), nao mudanca de contrato.
 */
import type { Gaveta, GameState, TarefaComidaParaTropa, TarefaDeTransporte, TarefaDoSerf, TarefaPedraParaCanteiro } from './state';
import {
  ehTarefaDeComidaParaTropa, ehTarefaDePedraParaCanteiro, ehTarefaDeTransporte, ehTarefaDoSerf, gavetaDeOrigem, ID_DO_ARMAZEM,
  origemDaTarefaVale,
} from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { ouroNecessario } from './escola';
import { comidaNecessaria } from './bodega';
import { ehQuartelCompleto, ehRequisitoDoQuartel } from './quartel';
import { demandaDeInsumo, excedenteNaEntrada } from './insumo';
import { vagasDoPredio } from './ocupacao';

/**
 * Unidades de `mercadoria` reservadas na ORIGEM `predioId`: so tarefas `reclamada` — a
 * `carregando` ja consumiu a reserva da origem na coleta (F10). Vale para todo tipo
 * de transporte (F13: material e ouro saem do mesmo armazem e disputam o estoque).
 *
 * F15b — a conta e POR GAVETA, porque desde o nivel 7 dois tipos de tarefa podem
 * sair do MESMO predio com a MESMA mercadoria e gavetas diferentes. Somar as duas
 * juntas faria uma reservar a unidade da outra, e `disponivelNaOrigem` cairia
 * abaixo de zero sem que nada estivesse errado. A gaveta vem do TIPO da tarefa
 * (`gavetaDeOrigem`), nunca de um campo.
 *
 * F18g — a pedra do canteiro (`pedra-para-canteiro`) conta aqui como qualquer
 * carga: uma unidade, so enquanto `reclamada`. O caso especial da F18d-1b — a
 * tarefa de assentar reservando `custoStonePorTile` desde `'aberta'`, sem
 * carregar nada — deixou de existir com ela: quem reserva e quem carrega.
 * `dados` fica na assinatura por compatibilidade de chamada; nada aqui o le.
 */
export function reservadoNaOrigem(
  state: GameState, predioId: string, mercadoria: string, gaveta: Gaveta = 'saida',
  _dados: GameData = gameData,
): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t === undefined || !ehTarefaDoSerf(t) || t.estado !== 'reclamada') continue;
    if (t.origem === predioId && t.mercadoria === mercadoria && gavetaDeOrigem(t.tipo) === gaveta) soma += 1;
  }
  return soma;
}

/**
 * F18g — a pedra ja RESERVADA para um tile do canteiro: as tarefas de pedra dele
 * que nao estao abertas (reclamada ou carregando), uma unidade cada. Irma de
 * `reservadoNoDestino`, com o tile no lugar do predio.
 */
export function pedraReservadaParaOTile(state: GameState, chaveDoTile: string): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && ehTarefaDePedraParaCanteiro(t) && t.estado !== 'aberta' && chaveDoTile === chaveDe(t)) soma += 1;
  }
  return soma;
}

/** A chave `"gx,gy"` do tile de destino — escrita aqui, e nao importada de
 *  `estradas.ts`, pelo ciclo que o cabecalho deste arquivo explica. E a mesma
 *  forma de `chaveDeTile`; a propriedade de igualdade esta em `tests/`. */
function chaveDe(t: TarefaPedraParaCanteiro): string {
  return `${t.destinoTile.gx},${t.destinoTile.gy}`;
}

/**
 * F18g — quanto um tile do canteiro ainda PEDE de pedra, antes de descontar
 * reserva: `custoStonePorTile − entregue`. Zero para tile fora do canteiro (o
 * mesmo silencio de `demandaNoDestino` para obra que virou predio). Nunca
 * negativa: pedra alem do custo num tile nao e caso de jogo (a vaga barra), e
 * se um save trouxer, a demanda e zero e a borracha devolve o excesso.
 */
/**
 * C-COMIDA-01b (fome militar com o Feed) — o que o militar pede: 1 enquanto existe e
 * tem `pedidoDeComida`, senao 0. A comida enche a condicao inteira, entao uma so basta.
 */
export function demandaDaTropa(state: GameState, tarefa: TarefaComidaParaTropa): number {
  const alvo = state.unidades.porId[tarefa.destinoUnidade];
  return alvo !== undefined && alvo.pedidoDeComida === true ? 1 : 0;
}

/**
 * C-COMIDA-01b — a vaga da tropa: a demanda menos as tarefas JA reclamadas ou
 * carregando para o mesmo militar (a propria incluida, se nao for aberta). No claim
 * (a tarefa e aberta) da 1 ou 0; no saneamento em grupo, negativa = comida demais a
 * caminho, e o excedente sai. Nunca duas comidas a caminho do mesmo militar.
 */
export function vagaDaTropa(state: GameState, tarefa: TarefaComidaParaTropa): number {
  let aCaminho = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && ehTarefaDeComidaParaTropa(t) && t.estado !== 'aberta' && t.destinoUnidade === tarefa.destinoUnidade) aCaminho++;
  }
  return demandaDaTropa(state, tarefa) - aCaminho;
}

export function demandaDoTile(
  state: GameState, tarefa: TarefaPedraParaCanteiro, dados: GameData = gameData,
): number {
  const chave = chaveDe(tarefa);
  if (state.estradasPlanejadas[chave] !== true) return 0;
  return Math.max(0, dados.terreno.estrada.custoStonePorTile - (state.pedraNoCanteiro[chave] ?? 0));
}

/** F18g — a vaga ainda reservavel no tile: `demanda − reservado`. Negativa quando
 *  o tile deixou de pedir debaixo de uma reserva — o sinal que `sanearTarefas` usa,
 *  como em `vagaDoDestino`. */
export function vagaNoTile(
  state: GameState, tarefa: TarefaPedraParaCanteiro, dados: GameData = gameData,
): number {
  return demandaDoTile(state, tarefa, dados) - pedraReservadaParaOTile(state, chaveDe(tarefa));
}

/** Vagas de `mercadoria` reservadas no DESTINO `predioId`: tarefas reclamadas E
 *  carregando (F10). Entre a coleta e a entrega a tarefa mantem so esta reserva. */
export function reservadoNoDestino(state: GameState, predioId: string, mercadoria: string): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && ehTarefaDeTransporte(t) && t.estado !== 'aberta' && t.destino === predioId && t.mercadoria === mercadoria) soma += 1;
  }
  return soma;
}

/**
 * O que um serf ainda pode reservar na origem: `gaveta - reservado`, num predio
 * completo qualquer.
 *
 * O padrao `'saida'` e o universo ate a F13: e de la que o serf retira (decisao
 * da F05a) e a origem era sempre armazem. A F15b acrescenta duas coisas: a
 * origem passa a poder ser o proprio produtor (nivel 6) e, no nivel 7, a carga
 * sai da gaveta `entrada` — que e justamente onde a mercadoria fica presa.
 */
export function disponivelNaOrigem(
  state: GameState, predioId: string, mercadoria: string, gaveta: Gaveta = 'saida',
): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'completo') return 0;
  return (predio.estoque[gaveta][mercadoria] ?? 0)
    - reservadoNaOrigem(state, predioId, mercadoria, gaveta);
}

/** A vaga que ainda pode ser reservada no destino: `faltam - reservado`. So obra. */
export function vagaNoDestino(state: GameState, predioId: string, mercadoria: string): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'obra') return 0;
  return (predio.obra.faltam[mercadoria] ?? 0) - reservadoNoDestino(state, predioId, mercadoria);
}

/**
 * F13 — quanto o destino de uma tarefa de transporte ainda PEDE, antes de descontar
 * reserva: obra -> `faltam[mercadoria]`; escola -> a demanda da fila de treino. O
 * ramo e escolhido pelo TIPO da tarefa (exaustivo), nao pelo estado do predio: uma
 * tarefa de material apontando para escola, ou de ouro para obra, pede zero — e o
 * que faz `sanearTarefas` cancelar a tarefa em vez de entregar no lugar errado.
 *
 * F15b — o `switch` virou exaustivo de verdade (era um `else` que mandava tudo
 * que nao fosse material para `ouroNecessario`). Com seis tipos, o `else` teria
 * respondido "demanda de ouro da escola" para uma tarefa de tronco.
 */
export function demandaNoDestino(
  state: GameState, tarefa: TarefaDeTransporte, dados: GameData = gameData,
): number {
  switch (tarefa.tipo) {
    case 'material-para-obra': {
      const predio = state.predios.porId[tarefa.destino];
      if (!predio || predio.estado !== 'obra') return 0;
      return predio.obra.faltam[tarefa.mercadoria] ?? 0;
    }
    // F20a — nivel 1: o teto por tipo de comida, menos o que ja esta na gaveta.
    // `comidaNecessaria` (sim/bodega.ts) e o MESMO predicado que o gerador usa.
    case 'comida-para-inn':
      return comidaNecessaria(state, tarefa.destino, tarefa.mercadoria, dados);
    case 'ouro-para-escola':
      return ouroNecessario(state, tarefa.destino, dados);
    // C3 — o quartel quer ate o teto de cada requisito (`alvoDeEntrada`, a gaveta de
    // entrada de qualquer produtor), menos o que ja tem: a MESMA conta do insumo. Antes era
    // infinito, e o quartel esvaziava o armazem de armas (F25a; pedido do operador).
    case 'arma-para-quartel':
      return ehQuartelCompleto(state.predios.porId[tarefa.destino]) && ehRequisitoDoQuartel(tarefa.mercadoria, dados)
        ? demandaDeInsumo(state, tarefa.destino, tarefa.mercadoria, dados) : 0;
    case 'insumo-producao-parada':
    case 'insumo-producao-baixa':
      return demandaDeInsumo(state, tarefa.destino, tarefa.mercadoria, dados);
    case 'saida-cheia-para-armazem':
    case 'excedente-para-armazem': {
      // O armazem nao tem teto de gaveta (`capacidade.entrada === null`), entao
      // a demanda dele e infinita de proposito — nao um numero grande escolhido
      // a mao, que seria balanceamento escondido em `.ts`. Quem limita estas
      // tarefas e a ORIGEM: so existe tarefa para o que esta la, e
      // `disponivelNaOrigem` ja desconta o reservado.
      const destino = state.predios.porId[tarefa.destino];
      const ehArmazem = destino !== undefined && destino.estado === 'completo'
        && destino.tipo === ID_DO_ARMAZEM;
      return ehArmazem ? Number.POSITIVE_INFINITY : 0;
    }
  }
}

/**
 * F15b — quanto a ORIGEM de uma tarefa de transporte OFERECE, antes de descontar
 * reserva. A irma de `demandaNoDestino` do outro lado da viagem.
 *
 * Ate o nivel 6 e simplesmente o que esta na gaveta do tipo. No nivel 7 e o
 * EXCEDENTE, nao o estoque: o ouro que a fila da escola ainda quer esta na
 * gaveta `entrada` e nao pode ser oferecido de volta ao armazem — seria o
 * vaivem que `alvoDeEntrada` existe para impedir.
 */
export function ofertaNaOrigem(
  state: GameState, tarefa: TarefaDoSerf, dados: GameData = gameData,
): number {
  if (!origemDaTarefaVale(state, tarefa)) return 0;
  if (tarefa.tipo === 'excedente-para-armazem') {
    return excedenteNaEntrada(state, tarefa.origem, tarefa.mercadoria, dados);
  }
  const origem = state.predios.porId[tarefa.origem];
  if (origem === undefined || origem.estado !== 'completo') return 0;
  return origem.estoque[gavetaDeOrigem(tarefa.tipo)][tarefa.mercadoria] ?? 0;
}

/**
 * F15b — o que ainda pode ser reservado na origem: `oferta - reservado`. A irma
 * de `vagaDoDestino`. Pode ficar NEGATIVA quando a oferta encolhe debaixo de uma
 * reserva (a fila da escola volta a querer o ouro que ja era excedente, com o
 * serf a caminho) — e esse sinal que `sanearTarefas` usa.
 */
export function sobraNaOrigem(
  state: GameState, tarefa: TarefaDoSerf, dados: GameData = gameData,
): number {
  return ofertaNaOrigem(state, tarefa, dados)
    - reservadoNaOrigem(state, tarefa.origem, tarefa.mercadoria, gavetaDeOrigem(tarefa.tipo));
}

/**
 * A vaga que ainda pode ser reservada no destino de uma tarefa de transporte:
 * `demanda - reservado`. Pode ficar NEGATIVA quando a demanda encolhe debaixo de uma
 * reserva (item de fila cancelado com o serf a caminho) — e esse sinal que
 * `sanearTarefas` usa para desfazer o excesso.
 */
export function vagaDoDestino(
  state: GameState, tarefa: TarefaDeTransporte, dados: GameData = gameData,
): number {
  return demandaNoDestino(state, tarefa, dados)
    - reservadoNoDestino(state, tarefa.destino, tarefa.mercadoria);
}

/** Vagas de CONSTRUCAO (F11b) reservadas na obra `predioId`: tarefas
 *  `'construir'` que nao estao abertas — so `'reclamada'` existe para esse
 *  tipo (sem `'carregando'`, o laborer nao carrega nada). */
export function laborersReservados(state: GameState, predioId: string): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && t.tipo === 'construir' && t.estado !== 'aberta' && t.destino === predioId) soma += 1;
  }
  return soma;
}

/** A vaga de laborer ainda reservavel na obra: teto (dado) - reservado. So
 *  obra. O teto nunca encolhe em runtime (e constante do dado), diferente de
 *  `faltam` — por isso nao ha checagem de grupo equivalente em
 *  `sanearTarefas` para este tipo (ver o comentario la). */
export function vagaDeConstrucao(state: GameState, predioId: string, dados: GameData = gameData): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'obra') return 0;
  return dados.construcao.laborersMaximosPorObra - laborersReservados(state, predioId);
}

/** F14 — vagas de OCUPACAO reservadas no predio `predioId`: tarefas `'ocupar'`
 *  que nao estao abertas — so `'reclamada'` existe para esse tipo. Irma de
 *  `laborersReservados`. */
export function ocupantesReservados(state: GameState, predioId: string): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && t.tipo === 'ocupar' && t.estado !== 'aberta' && t.destino === predioId) soma += 1;
  }
  return soma;
}

/**
 * A vaga de ocupante ainda reservavel: `vagasDoPredio - reservado`. Nunca fica
 * negativa por disputa: com uma vaga so, um claim ja zera a conta, e a chegada
 * troca reserva por posse no mesmo tick. O caso "ocupado por outro caminho"
 * (save adulterado, demolir e replantar) e pego no ramo INDIVIDUAL de
 * `sanearTarefas` (`motivoDoDestino` -> `destino-completo`), nao aqui.
 */
export function vagaDeOcupacao(
  state: GameState, predioId: string, dados: GameData = gameData,
): number {
  return vagasDoPredio(state.predios.porId[predioId], dados) - ocupantesReservados(state, predioId);
}

/** F20b — assentos de refeicao reservados na Bodega `predioId`: tarefas `'comer'`
 *  que nao estao abertas. Irma exata de `ocupantesReservados`. */
export function comensaisReservados(state: GameState, predioId: string): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && t.tipo === 'comer' && t.estado !== 'aberta' && t.destino === predioId) soma += 1;
  }
  return soma;
}
