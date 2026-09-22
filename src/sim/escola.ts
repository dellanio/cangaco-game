import { gameData } from './data';
import type { GameData } from './data/types';
import type { GameState, ItemDeFila, Predio, PredioCompleto } from './state';
import { ID_DA_ESCOLA, MERCADORIA_DE_OURO } from './state';

/**
 * F13 — os derivados puros da escola: quem e escola, qual e a fila, quanto custa
 * um treino. Nenhum estado muda aqui.
 *
 * CAMADA: este modulo NAO pode importar `estradas` nem `pathfinding`.
 * `reservas.ts` o importa (a vaga de uma tarefa de ouro e a demanda da fila) e
 * `estradas.ts` importa `reservas.ts` — importar de volta fecharia o ciclo. O
 * derivado que precisa do mapa (`tileDeSaida`, onde a unidade nasce) mora em
 * `systems/escolas.ts`, que e a ponta do grafo.
 */

/** Por que um `EnqueueTraining` foi recusado. Vai no evento `command-rejected`. */
export type MotivoDeRecusaDeTreino =
  | 'predio-inexistente'
  | 'nao-e-escola'
  | 'escola-em-obra'
  | 'fila-cheia'
  | 'unidade-desconhecida';

/** Escola de pe. Uma escola ainda em obra nao enfileira nem treina. */
export function ehEscolaCompleta(predio: Predio | undefined): predio is PredioCompleto {
  return predio !== undefined && predio.estado === 'completo' && predio.tipo === ID_DA_ESCOLA;
}

/** A fila desta escola. Escola sem entrada em `treino` tem fila vazia (ver `GameState.treino`). */
export function filaDaEscola(state: GameState, predioId: string): readonly ItemDeFila[] {
  return state.treino[predioId] ?? [];
}

/**
 * Grava a fila de uma escola. Fila vazia APAGA a entrada: `{}` e `{ p2: [] }`
 * descrevem o mesmo jogo e precisam ter o mesmo JSON (`GameState.treino`).
 * Todo caminho que muda fila passa por aqui.
 */
export function comFila(
  state: GameState, predioId: string, itens: readonly ItemDeFila[],
): GameState {
  const treino: Record<string, readonly ItemDeFila[]> = { ...state.treino };
  if (itens.length === 0) {
    if (!(predioId in treino)) return state;
    delete treino[predioId];
  } else {
    treino[predioId] = itens;
  }
  return { ...state, treino };
}

/** Ouro por unidade treinada. Do dado — `economy.json:schoolhouse`. */
export function custoDeTreino(dados: GameData = gameData): number {
  return dados.economia.schoolhouse.custoOuroPorUnidade;
}

/**
 * O ouro que a fila desta escola ainda precisa RECEBER: os itens que nao
 * comecaram, vezes o custo, menos o que ja esta na gaveta `entrada`. Nunca
 * negativo. Um item em treino ja pagou e nao conta.
 *
 * E a demanda que o JobBoard converte em tarefa de entrega, e e a "vaga no
 * destino" de uma tarefa de ouro — o analogo de `faltam` numa obra.
 */
export function ouroNecessario(
  state: GameState, predioId: string, dados: GameData = gameData,
): number {
  const escola = state.predios.porId[predioId];
  if (!ehEscolaCompleta(escola)) return 0;
  const aguardando = filaDaEscola(state, predioId).filter((i) => i.estado === 'aguardando').length;
  const emCaixa = escola.estoque.entrada[MERCADORIA_DE_OURO] ?? 0;
  return Math.max(0, aguardando * custoDeTreino(dados) - emCaixa);
}

/** Se `tipo` e um civil declarado em `data/units.json`. O comando recusa o que nao e. */
export function ehCivilConhecido(tipo: string, dados: GameData = gameData): boolean {
  return dados.unidades.civis.tipos.some((civil) => civil.id === tipo);
}
