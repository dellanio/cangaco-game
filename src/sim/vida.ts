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
  const def = dados.unidades.militares.tipos.find((t) => t.id === tipo)
    ?? dados.unidades.mercenarios.tipos.find((t) => t.id === tipo);
  return def === undefined ? null : def.hp * dados.combate.multiplicadorHP.valor;
}

/** O HP de agora: o campo, ou o cheio quando ele esta ausente. `null` para civil. */
export function hpDaUnidade(u: Unidade, dados: GameData = gameData): number | null {
  const maximo = hpMaximoDoTipo(u.tipo, dados);
  return maximo === null ? null : u.hp ?? maximo;
}
