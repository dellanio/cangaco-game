/**
 * F28b — a Torre de Pedra atira. A cada tick, cada torre completa, OCUPADA pelo recruta,
 * com pedra e com a recarga em zero, mira o inimigo mais perto no alcance
 * (`sim/torre.ts`) e gasta UMA pedra. A pedra cai no tile do alvo e mata a primeira
 * unidade com HP daquele tile em `unidades.ordem` — do proprio lado inclusive (fogo
 * amigo, decisao do operador). NUNCA erra (`combat.json: watchtower`): por isso pedras
 * gastas = mortos. Sem sorteio: o RNG nao e tocado.
 *
 * A recarga e `ticksCadenciaDeAtaque`: o dado nao tem cadencia de torre (PARA REVISAO).
 */
import type { GameEvent, GameState, PredioCompleto, Unidade } from '../state';
import type { GameData } from '../data/types';
import { hpDaUnidade, hpMaximoDoTipo } from '../vida';
import { alvoDaTorre, ehTorreCompleta, MUNICAO_DA_TORRE, pedrasNaTorre, porQueNaoAtira } from '../torre';
import { comPredio, comUnidade } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

function semAUnidade(state: GameState, id: string): GameState {
  const porId = { ...state.unidades.porId };
  delete porId[id];
  return { ...state, unidades: { porId, ordem: state.unidades.ordem.filter((i) => i !== id) } };
}

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
    const atirou: PredioCompleto = {
      ...torre, estoque: { ...torre.estoque, entrada: municao }, recarga: dados.combate.ticksCadenciaDeAtaque,
    };
    atual = comPredio(atual, atirou);
    events.push({ type: 'stone-thrown', predio: torre.id, alvo: { gx: alvo.gx, gy: alvo.gy }, vitima: vitima.id });
    const hp = dados.combate.watchtower.mataEmUmGolpe ? 0 : (hpDaUnidade(vitima, dados) ?? 1) - 1;
    if (hp > 0) {
      atual = comUnidade(atual, { ...vitima, hp });
      continue;
    }
    atual = semAUnidade(atual, vitima.id);
    events.push({ type: 'unit-killed', unidade: vitima.id, tipo: vitima.tipo, lado: vitima.lado, por: torre.id });
  }
  return { state: atual, events };
}
