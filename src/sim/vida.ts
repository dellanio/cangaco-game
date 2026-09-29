/**
 * F28c — o HP da unidade que luta, lido do dado num lugar so.
 *
 * `units.json` da `hp` (golpes ate morrer) a militar e a mercenario, nunca a civil. O
 * teto e esse numero vezes `combat.json: multiplicadorHP.valor` (hoje 2): o golpe
 * continua tirando 1, e o tempo ate a morte fica o do KaM com metade da variancia.
 */
import type { Unidade } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';

/** O HP cheio do tipo, ou `null` para quem nao luta (civil, tipo desconhecido). */
export function hpMaximoDoTipo(tipo: string, dados: GameData = gameData): number | null {
  const hp = hpBasePorTipo(dados.unidades).get(tipo);
  return hp === undefined ? null : hp * dados.combate.multiplicadorHP.valor;
}

/** C-IA-02a — o `hp` do dado por tipo, indexado uma vez por `dados.unidades` (o combate
 *  pergunta por par de unidades). Militar antes de mercenario, como o `find` de antes. */
const hpPorUnidades = new WeakMap<GameData['unidades'], ReadonlyMap<string, number>>();
function hpBasePorTipo(unidades: GameData['unidades']): ReadonlyMap<string, number> {
  const pronto = hpPorUnidades.get(unidades);
  if (pronto !== undefined) return pronto;
  const indice = new Map<string, number>();
  for (const t of [...unidades.militares.tipos, ...unidades.mercenarios.tipos]) if (!indice.has(t.id)) indice.set(t.id, t.hp);
  hpPorUnidades.set(unidades, indice);
  return indice;
}

/** O HP de agora: o campo, ou o cheio quando ele esta ausente. `null` para civil. */
export function hpDaUnidade(u: Unidade, dados: GameData = gameData): number | null {
  const maximo = hpMaximoDoTipo(u.tipo, dados);
  return maximo === null ? null : u.hp ?? maximo;
}
