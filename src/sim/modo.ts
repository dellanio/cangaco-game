import { gameData } from './data';
import type { GameData } from './data/types';
import type { Predio, PredioCompleto } from './state';

/**
 * F-REPL-b — os derivados puros do MODO de trabalho de um predio (o lenhador:
 * `cortar` ou `cortar_e_plantar`, decisao do operador, 2026-09-27). Quem aplica o
 * comando e `systems/modo.ts`, no molde de `pausa.ts` e `cota.ts`.
 *
 * O codigo le o que o modo FAZ (`ModoDeTrabalho.planta`), nunca o nome: nenhum
 * `'cortar'` esta digitado em `sim/`.
 */

/** Por que um `SetBuildingMode` foi recusado. Vai no evento `command-rejected`. */
export type MotivoDeRecusaDeModo =
  | 'predio-inexistente'
  | 'predio-em-obra'
  | 'sem-modos'
  | 'modo-invalido';

/** O motivo da recusa, ou `null` quando o comando vale. Obra recusa como na pausa:
 *  `Producao` so existe no predio completo. */
export function motivoDaRecusaDeModo(
  predio: Predio | undefined, modo: string, dados: GameData = gameData,
): MotivoDeRecusaDeModo | null {
  if (predio === undefined) return 'predio-inexistente';
  if (predio.estado !== 'completo') return 'predio-em-obra';
  const modos = dados.producao.receitas[predio.tipo]?.modos ?? null;
  if (modos === null || predio.producao === null) return 'sem-modos';
  if (!Object.hasOwn(modos.porModo, modo)) return 'modo-invalido';
  return null;
}

/**
 * O predio REPOE o tile que corta? E a pergunta dos dois lados: o rodizio (quem
 * escolhe) e o `tileTrabalhavel` (quem conta trabalho para o alerta e o painel).
 * Um lado so seria o lenhador em `cortar` parado diante de tocos que o alerta
 * conta como trabalho.
 *
 * Quem nao declara `modos` (o roçado, o canavial) faz o de sempre: sim. O tipo sem
 * `reposicao` (a rocha) nao se replanta de todo jeito, e quem responde isso e o
 * `tilePlantavel`, nao o modo. Modo desconhecido (save corrompido) vale o padrao.
 */
export function plantaNoModo(predio: PredioCompleto, dados: GameData = gameData): boolean {
  const modos = dados.producao.receitas[predio.tipo]?.modos ?? null;
  if (modos === null) return true;
  const modo = predio.producao?.modo ?? modos.padrao;
  return (modos.porModo[modo] ?? modos.porModo[modos.padrao])?.planta ?? true;
}
