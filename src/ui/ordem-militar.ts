/**
 * C-TELA-04 — o que o botao direito de mao vazia MANDA, com a tropa na mao (GDD §2.1).
 * Puro: le o estado, devolve comandos; quem envia e o `main.ts`. A ordem de decisao:
 *
 *  1. unidade INIMIGA com HP sob o ponteiro (militar ou mercenario): os de corpo a corpo
 *     recebem `AttackUnit`. O arqueiro a sim recusa no `AttackUnit` (e recusaria o grupo
 *     INTEIRO), entao ele segue como antes desta feature: marcha ate o tile do alvo;
 *  2. predio de outro lado no tile: `AttackBuilding` (F26b);
 *  3. o resto: `MoveUnits` ao tile.
 *
 * A unidade vence o predio pela mesma razao do clique esquerdo: o jogador mirou o boneco.
 *
 * C-COMBATE-01c: quem esta em carga sai do grupo (a ordem nao pega nele); a `formacao` (a
 * direcao do arrasto, as colunas guardadas) vai so no `MoveUnits` do passo 3.
 */
import type { Command } from '../sim/commands';
import type { GameData } from '../sim/data/types';
import type { GameState } from '../sim/state';
import { predioNoTile } from '../sim/selectors';
import { predioClicavel } from '../render/nevoa';
import { hpMaximoDoTipo } from '../sim/vida';
import { ehADistancia } from '../sim/combate';
import { quemAceitaOrdem } from './formacao';

/** C-COMBATE-01c — os campos de formacao que a tela manda na marcha; ausente, os da sim. */
export interface FormacaoDaOrdem {
  readonly direcao?: number;
  readonly colunas?: number;
}

export interface OrdemDoBotaoDireito {
  readonly comandos: readonly Command[];
  /** O tile a marcar (C-TELA-02) quando alguem MARCHA; `null` quando so ha ataque. */
  readonly marcarDestino: { readonly gx: number; readonly gy: number } | null;
}

/** O primeiro id sob o ponteiro que e de OUTRO lado e tem HP; `null` se nenhum. */
export function inimigoSobOPonteiro(
  estado: GameState, dados: GameData, lado: number, idsNoPonto: readonly string[],
): string | null {
  for (const id of idsNoPonto) {
    const u = estado.unidades.porId[id];
    if (u !== undefined && u.lado !== lado && hpMaximoDoTipo(u.tipo, dados) !== null) return id;
  }
  return null;
}

export function ordemDoBotaoDireito(
  estado: GameState, dados: GameData, lado: number,
  todos: readonly string[], tile: { readonly gx: number; readonly gy: number }, idsNoPonto: readonly string[],
  formacao: FormacaoDaOrdem = {},
): OrdemDoBotaoDireito {
  const grupo = quemAceitaOrdem(estado, todos, dados);
  if (grupo.length === 0) return { comandos: [], marcarDestino: null };
  const destino = { gx: tile.gx, gy: tile.gy };

  const alvo = inimigoSobOPonteiro(estado, dados, lado, idsNoPonto);
  if (alvo !== null) {
    const tipo = (id: string): string => estado.unidades.porId[id]?.tipo ?? '';
    const corpoACorpo = grupo.filter((id) => !ehADistancia(tipo(id), dados));
    const aDistancia = grupo.filter((id) => ehADistancia(tipo(id), dados));
    const comandos: Command[] = [];
    if (corpoACorpo.length > 0) comandos.push({ type: 'AttackUnit', unidades: corpoACorpo, alvo });
    if (aDistancia.length > 0) comandos.push({ type: 'MoveUnits', unidades: aDistancia, destino });
    return { comandos, marcarDestino: aDistancia.length > 0 ? destino : null };
  }

  // F-TELA-NEVOA: o predio inimigo fora da vista nao e alvo — o clique no tile dele e marcha ate la
  const idDoPredio = predioClicavel(estado, predioNoTile(estado, tile.gx, tile.gy));
  const predio = idDoPredio === null ? undefined : estado.predios.porId[idDoPredio];
  if (predio !== undefined && predio.lado !== lado) {
    return { comandos: [{ type: 'AttackBuilding', unidades: grupo, predio: predio.id }], marcarDestino: null };
  }
  return { comandos: [{ type: 'MoveUnits', unidades: grupo, destino, ...formacao }], marcarDestino: destino };
}
