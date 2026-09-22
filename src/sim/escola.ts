import { gameData } from './data';
import type { GameData } from './data/types';
import type { GameState, ItemDeFila, Predio, PredioCompleto } from './state';
import { ID_DA_ESCOLA } from './state';

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

/** Se `tipo` e um civil declarado em `data/units.json`. O comando recusa o que nao e. */
export function ehCivilConhecido(tipo: string, dados: GameData = gameData): boolean {
  return dados.unidades.civis.tipos.some((civil) => civil.id === tipo);
}
