/**
 * F28b — a Torre de Pedra atira. A cada tick, cada torre completa, OCUPADA pelo recruta,
 * com pedra e com a recarga em zero, mira o inimigo mais perto no alcance
 * (`sim/torre.ts`) e gasta UMA pedra. NUNCA erra (`combat.json: watchtower`): por isso
 * pedras gastas = mortos. Sem sorteio: o RNG nao e tocado.
 *
 * C2: a pedra VOA (`sim/projeteis.ts`). Ela persegue o alvo marcado e, na chegada, mata a
 * primeira unidade com HP do tile dele — do proprio lado inclusive (fogo amigo, decisao do
 * operador). O `stone-thrown` sai no lancamento; o `unit-killed`, na chegada.
 *
 * A recarga e a PROPRIA da torre (C1): `watchtower.ticksRecarga`, 2,3 s na escala 1,0 (o
 * `TKMTaskThrowRock` do kam_remake: 2 + 1 + 20 ticks), mais o voo (C2).
 */
import type { GameEvent, GameState, PredioCompleto, Unidade } from '../state';
import type { GameData } from '../data/types';
import { hpMaximoDoTipo } from '../vida';
import { alvoDaTorre, distanciaDaTorre, ehTorreCompleta, MUNICAO_DA_TORRE, pedrasNaTorre, porQueNaoAtira } from '../torre';
import { comProjetil, PROJETIL_DA_TORRE } from '../projeteis';
import { comPredio } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

export function sistemaDaTorre(state: GameState, dados: GameData): ResultadoDeSistema {
  let atual = state;
  const events: GameEvent[] = [];
  const temHp = (u: Unidade): boolean => hpMaximoDoTipo(u.tipo, dados) !== null;
  for (const id of state.predios.ordem) {
    const torre = atual.predios.porId[id];
    if (!ehTorreCompleta(torre)) continue;
    if ((torre.recarga ?? 0) > 0) {
      atual = comPredio(atual, { ...torre, recarga: (torre.recarga ?? 0) - 1 });
      continue;
    }
    if (porQueNaoAtira(torre) !== null) continue;
    const alvo = alvoDaTorre(atual, torre, temHp, dados);
    if (alvo === null) continue;
    // a pedra cai no tile do alvo: morre a primeira unidade com HP que estiver ALI
    const vitima = atual.unidades.ordem
      .map((u) => atual.unidades.porId[u])
      .find((u): u is Unidade => u !== undefined && u.gx === alvo.gx && u.gy === alvo.gy && temHp(u)) ?? alvo;
    const municao = { ...torre.estoque.entrada, [MUNICAO_DA_TORRE]: pedrasNaTorre(torre) - 1 };
    // C2: a pedra VOA; quem morre e decidido na chegada (`systems/projeteis.ts`). O recruta
    // "olha a pedra ir" (TKMTaskThrowRock), entao a recarga soma o voo.
    // `recarga` = ticks de ESPERA ate o proximo tiro; o tiro sai no tick seguinte ao ultimo
    // de espera, entao o intervalo entre pedras e exatamente `ticksRecarga + voo` (C1: antes
    // era +1)
    const alvoTile = { gx: alvo.gx, gy: alvo.gy };
    const voo = Math.max(1, Math.round((distanciaDaTorre(torre, alvoTile) * (dados.combate.milesimosDeTickPorTile[PROJETIL_DA_TORRE] ?? 0)) / 1000));
    const atirou: PredioCompleto = {
      ...torre, estoque: { ...torre.estoque, entrada: municao }, recarga: dados.combate.watchtower.ticksRecarga + voo - 1,
    };
    atual = comProjetil(comPredio(atual, atirou), {
      projetil: PROJETIL_DA_TORRE,
      de: { id: torre.id, tipo: torre.tipo, lado: torre.lado, gx: torre.gx, gy: torre.gy },
      origem: { gx: torre.gx, gy: torre.gy }, alvoTile, alvoUnidade: alvo.id, predio: torre.id, voo, restantes: voo,
    });
    events.push(
      { type: 'stone-thrown', predio: torre.id, alvo: alvoTile, vitima: vitima.id },
      { type: 'projectile-fired', projetil: PROJETIL_DA_TORRE, de: torre.id, alvo: alvoTile, voo },
    );
  }
  return { state: atual, events };
}
