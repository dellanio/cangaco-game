/**
 * F36 — a regra da PREFEITURA num lugar so: o ouro que ela quer ter, o custo de cada
 * mercenario e por que um `HireMercenary` e recusado. O gerador de insumo, o comando e o
 * painel perguntam AQUI.
 */
import type { GameState, Predio, PredioCompleto } from './state';
import { MERCADORIA_DE_OURO } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';

export const ID_DA_PREFEITURA = 'town_hall';

export type MotivoDeRecusaDeMercenario =
  | 'predio-nao-e-prefeitura'
  | 'tipo-desconhecido'
  | 'sem-ouro'
  /** Nenhum tile da porta e andavel: o mercenario nao teria onde nascer. */
  | 'porta-bloqueada'
  /** BUG-S — a partida esta em peacetime (`sim/paz.ts`): no KaM, equipar na prefeitura e bloqueado. */
  | 'em-paz';

export const ehPrefeituraCompleta = (p: Predio | undefined): p is PredioCompleto =>
  p !== undefined && p.estado === 'completo' && p.tipo === ID_DA_PREFEITURA;

/** O ouro que a Prefeitura quer TER na entrada: o custo do mercenario mais caro, lido do
 *  dado (decisao do operador, 2026-09-27). Com ele, qualquer tipo cabe. */
export function alvoDeOuroDaPrefeitura(dados: GameData = gameData): number {
  return Math.max(0, ...dados.unidades.mercenarios.tipos.map((t) => t.custoOuro));
}

/** O `custoOuro` do tipo, ou `null` para quem nao e mercenario. */
export function custoDoMercenario(tipo: string, dados: GameData = gameData): number | null {
  return dados.unidades.mercenarios.tipos.find((t) => t.id === tipo)?.custoOuro ?? null;
}

export function ouroNaPrefeitura(p: PredioCompleto): number {
  return p.estoque.entrada[MERCADORIA_DE_OURO] ?? 0;
}

export function motivoDaRecusaDeMercenario(
  state: GameState, predioId: string, tipo: string, dados: GameData = gameData,
): MotivoDeRecusaDeMercenario | null {
  const prefeitura = state.predios.porId[predioId];
  if (!ehPrefeituraCompleta(prefeitura)) return 'predio-nao-e-prefeitura';
  const custo = custoDoMercenario(tipo, dados);
  if (custo === null) return 'tipo-desconhecido';
  if (ouroNaPrefeitura(prefeitura) < custo) return 'sem-ouro';
  return null;
}
