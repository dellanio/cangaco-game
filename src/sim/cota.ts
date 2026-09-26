import type { GameData } from './data/types';
import type { Predio } from './state';

/**
 * F24a — os derivados puros de FIXAR A COTA de uma oficina (GDD §2.3: "quantas de
 * cada arma produzir"). Quem aplica o comando e `systems/cota.ts`, no molde de
 * `pausa.ts` e `systems/pausa.ts`.
 */

/** Por que um `SetProductionQuota` foi recusado. Vai no evento `command-rejected`. */
export type MotivoDeRecusaDeCota =
  | 'predio-inexistente'
  | 'predio-em-obra'
  /** a receita do predio nao escolhe a saida: nao ha cota a fixar */
  | 'sem-escolha'
  /** a cota nomeia mercadoria que nao sai desta receita */
  | 'mercadoria-invalida'
  /** algum valor nao e inteiro >= 0 */
  | 'cota-invalida'
  /** tudo zero: parar a oficina e `SetBuildingPaused`, nao cota vazia */
  | 'cota-vazia';

/**
 * O motivo da recusa, ou `null` quando o comando vale. A cota pode OMITIR uma
 * saida — vale zero —, mas nao pode nomear o que a receita nao faz.
 */
export function motivoDaRecusaDeCota(
  predio: Predio | undefined, cota: Readonly<Record<string, number>>, dados: GameData,
): MotivoDeRecusaDeCota | null {
  if (predio === undefined) return 'predio-inexistente';
  if (predio.estado !== 'completo') return 'predio-em-obra';
  const receita = dados.producao.receitas[predio.tipo];
  if (receita === undefined || !receita.escolheSaida) return 'sem-escolha';
  let soma = 0;
  for (const [m, q] of Object.entries(cota)) {
    if (!(m in receita.sai)) return 'mercadoria-invalida';
    if (!Number.isInteger(q) || q < 0) return 'cota-invalida';
    soma += q;
  }
  return soma === 0 ? 'cota-vazia' : null;
}
