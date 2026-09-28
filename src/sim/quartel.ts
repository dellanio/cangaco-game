/**
 * F25a — a regra do QUARTEL num lugar so: o que ele recebe, quantos recrutas tem e
 * por que um `TrainSoldier` e recusado. O gerador, o saneamento, a entrega do serf,
 * o alistamento do recruta e o comando perguntam AQUI.
 */
import type { GameState, Predio, PredioCompleto } from './state';
import { ID_DO_QUARTEL } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';

export type MotivoDeRecusaDeSoldado =
  | 'predio-nao-e-quartel'
  | 'tipo-desconhecido'
  | 'sem-requisito'
  | 'sem-recruta'
  /** Nenhum tile da porta e andavel: o soldado nao teria onde nascer. */
  | 'porta-bloqueada';

export const ehQuartelCompleto = (p: Predio | undefined): p is PredioCompleto =>
  p !== undefined && p.estado === 'completo' && p.tipo === ID_DO_QUARTEL;

/** O que o quartel recebe: a uniao dos `requisitos` de `units.json: militares`, na
 *  ordem de `economia.mercadorias` (a ordem em que o gerador cria as tarefas). */
export function requisitosDoQuartel(dados: GameData = gameData): readonly string[] {
  const pedidos = new Set(dados.unidades.militares.tipos.flatMap((t) => t.requisitos ?? []));
  return dados.economia.mercadorias.filter((m) => pedidos.has(m));
}

export function ehRequisitoDoQuartel(mercadoria: string, dados: GameData = gameData): boolean {
  return requisitosDoQuartel(dados).includes(mercadoria);
}

/** Recrutas dentro: o campo, ou zero quando ausente. */
export function recrutasNoQuartel(p: PredioCompleto): number {
  return p.recrutas ?? 0;
}

/** O que formar `tipo` consome do quartel: cada requisito uma vez (o Anexo A lista
 *  cada peca uma vez), mais um recruta. `null` para tipo que o quartel nao forma. */
export function requisitosDoTipo(tipo: string, dados: GameData = gameData): readonly string[] | null {
  const def = dados.unidades.militares.tipos.find((t) => t.id === tipo);
  return def === undefined ? null : def.requisitos ?? [];
}

export function motivoDaRecusaDeSoldado(
  state: GameState, predioId: string, tipo: string, dados: GameData = gameData,
): MotivoDeRecusaDeSoldado | null {
  const quartel = state.predios.porId[predioId];
  if (!ehQuartelCompleto(quartel)) return 'predio-nao-e-quartel';
  const requisitos = requisitosDoTipo(tipo, dados);
  if (requisitos === null) return 'tipo-desconhecido';
  if (requisitos.some((m) => (quartel.estoque.entrada[m] ?? 0) < 1)) return 'sem-requisito';
  if (recrutasNoQuartel(quartel) < 1) return 'sem-recruta';
  return null;
}
