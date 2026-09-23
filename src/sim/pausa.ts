import type { Predio, PredioCompleto } from './state';

/**
 * F16c — os derivados puros de PAUSAR um predio. Nenhum estado muda aqui; quem
 * aplica o comando e `systems/pausa.ts`, no mesmo molde de `escola.ts` e
 * `systems/escolas.ts`.
 *
 * Este modulo nao importa `estradas` nem `data`: pausar nao depende do mapa nem
 * de numero nenhum — e uma decisao do jogador sobre um predio que existe.
 */

/** Por que um `SetBuildingPaused` foi recusado. Vai no evento `command-rejected`. */
export type MotivoDeRecusaDePausa =
  | 'predio-inexistente'
  | 'predio-em-obra';

/**
 * O motivo da recusa, ou `null` quando o comando vale.
 *
 * Obra nao pausa: o campo `pausado` so existe em `PredioCompleto`, e "parar de
 * martelar" e feature que ninguem escreveu — recusar e a leitura conservadora
 * (CLAUDE.md §14). Predio COMPLETO sem receita (armazem, escola, quartel) e
 * aceito: o campo e do predio, nao da receita, e pausa-lo simplesmente nao tem
 * leitor. Quem esconde o botao nesse caso e a tela (F16b), lendo `producao`.
 */
export function motivoDaRecusaDePausa(
  predio: Predio | undefined,
): MotivoDeRecusaDePausa | null {
  if (predio === undefined) return 'predio-inexistente';
  if (predio.estado !== 'completo') return 'predio-em-obra';
  return null;
}

/** O predio esta pausado? Falso para obra, que nao tem o campo. */
export function predioPausado(predio: Predio | undefined): predio is PredioCompleto {
  return predio !== undefined && predio.estado === 'completo' && predio.pausado;
}
