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

/**
 * I-PREDIO-IGREJA (2026-10-06) — o predio que contrata o tipo pago em ouro: o `predioQueTreina` do
 * dado (o padre, na Igreja), ou a Prefeitura, que e o padrao de todo mercenario.
 */
export function predioQueContrata(tipo: string, dados: GameData = gameData): string | null {
  const t = dados.unidades.mercenarios.tipos.find((m) => m.id === tipo);
  if (t === undefined) return null;
  return 'predioQueTreina' in t && typeof t.predioQueTreina === 'string' ? t.predioQueTreina : ID_DA_PREFEITURA;
}

/** Os tipos que o predio `tipoDoPredio` contrata, na ordem do dado. */
export function tiposContratadosEm(tipoDoPredio: string, dados: GameData = gameData) {
  return dados.unidades.mercenarios.tipos.filter((t) => predioQueContrata(t.id, dados) === tipoDoPredio);
}

/** O predio completo que contrata alguem por ouro (a Prefeitura, a Igreja). */
export function ehPredioDeContratoCompleto(p: Predio | undefined, dados: GameData = gameData): p is PredioCompleto {
  return p !== undefined && p.estado === 'completo' && tiposContratadosEm(p.tipo, dados).length > 0;
}

export const ehPrefeituraCompleta = (p: Predio | undefined): p is PredioCompleto =>
  p !== undefined && p.estado === 'completo' && p.tipo === ID_DA_PREFEITURA;

/** O ouro que o predio de contrato quer TER na entrada: o custo do mais caro que ele contrata, lido
 *  do dado (decisao do operador, 2026-09-27, para a Prefeitura). Com ele, qualquer tipo cabe. */
export function alvoDeOuroDoContrato(tipoDoPredio: string, dados: GameData = gameData): number {
  return Math.max(0, ...tiposContratadosEm(tipoDoPredio, dados).map((t) => t.custoOuro));
}

/** O ouro que a Prefeitura quer TER na entrada (o alvo do contrato dela). */
export function alvoDeOuroDaPrefeitura(dados: GameData = gameData): number {
  return alvoDeOuroDoContrato(ID_DA_PREFEITURA, dados);
}

/** O `custoOuro` do tipo, ou `null` para quem nao e contratado por ouro. */
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
  if (!ehPredioDeContratoCompleto(prefeitura, dados)) return 'predio-nao-e-prefeitura';
  const custo = custoDoMercenario(tipo, dados);
  // I-PREDIO-IGREJA: cada tipo so no predio que o contrata (o padre na Igreja, o mercenario na Prefeitura)
  if (custo === null || predioQueContrata(tipo, dados) !== prefeitura.tipo) return 'tipo-desconhecido';
  if (ouroNaPrefeitura(prefeitura) < custo) return 'sem-ouro';
  return null;
}
