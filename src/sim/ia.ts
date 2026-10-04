/**
 * F28-IA — as perguntas puras da IA de defesa: de que tipo de grupo e uma tropa, quem e
 * membro de que posicao, e quem esta no raio. O sistema (`systems/ia.ts`) so compoe.
 */
import type { GameState, PosicaoDeDefesa, TipoDeGrupo, Unidade } from './state';
import type { GameData, NumerosDaIA } from './data/types';
import { gameData } from './data';
import { defDaTropa, distanciaEmTiles } from './combate';

/** O tipo de grupo, DERIVADO do dado da tropa (sem campo novo): montado, a distancia,
 *  anti-cavalo (`attackVsCavalo > 0`), ou corpo a corpo. `null` para quem nao luta. */
export function tipoDeGrupo(tipo: string, dados: GameData = gameData): TipoDeGrupo | null {
  const def = defDaTropa(tipo, dados);
  if (def === null) return null;
  if (def.montado) return 'montado';
  if ('aDistancia' in def && def.aDistancia === true) return 'distancia';
  if (def.attackVsCavalo > 0) return 'antiCavalo';
  return 'corpoACorpo';
}

/** A posicao de que `unidadeId` e membro, ou `null`. */
export function posicaoDoMembro(posicoes: readonly PosicaoDeDefesa[], unidadeId: string): PosicaoDeDefesa | null {
  return posicoes.find((p) => p.membros.includes(unidadeId)) ?? null;
}

/** Os inimigos (outro lado, com HP) a ate `raio` do ponto, do mais perto ao mais longe;
 *  no empate, a ordem da lista. */
export function intrusos(state: GameState, posicao: PosicaoDeDefesa, lado: number, temHp: (u: Unidade) => boolean): Unidade[] {
  return state.unidades.ordem
    .map((id) => state.unidades.porId[id])
    .filter((u): u is Unidade => u !== undefined && u.lado !== lado && temHp(u)
      && distanciaEmTiles(posicao.ponto, u) <= posicao.raio)
    .map((u, i) => ({ u, i, d: distanciaEmTiles(posicao.ponto, u) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map(({ u }) => u);
}

/** F-IA-DIFICULDADE — o nivel que vale quando o estado nao diz nenhum. */
export const NIVEL_PADRAO = 'normal';

/**
 * F-IA-DIFICULDADE — os numeros que a IA do `lado` le, pelo nivel guardado no estado (ausente,
 * `normal`, o jogo de hoje). Nivel que o dado nao tem e erro: o configurar partida so oferece
 * os do dado, e o save guarda um deles.
 */
export function numerosDaIA(state: GameState, lado: number, dados: GameData = gameData): NumerosDaIA {
  const nivel = state.ia?.[String(lado)]?.nivel ?? NIVEL_PADRAO;
  const numeros = dados.combate.niveisDaIA[nivel];
  if (numeros === undefined) throw new Error(`ia: o nivel '${nivel}' nao esta em combat.json ia.niveis`);
  return numeros;
}
