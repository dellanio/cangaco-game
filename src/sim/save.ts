import type { GameState } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';

/**
 * F23 — save e load.
 *
 * O save e TEXTO, e nao objeto: e assim que ele vai para o disco, para o
 * `localStorage` ou para um anexo de relato de bug, e e a viagem pelo texto que
 * o aceite precisa provar. Quem chama recebe uma string e devolve uma string.
 *
 * O que ele guarda alem do estado, e por que:
 *
 * - `versao`: formato do envelope. Um save de formato antigo tem de ser recusado
 *   com nome, nao lido pela metade.
 * - `mapa` e `hashDoMapa`: o terreno NAO esta no `GameState` (contrato da F-T1) —
 *   ele vive em `GameData`, vindo de `data/maps/<id>.json`. Carregar um save
 *   sobre outro mapa, ou sobre o mesmo mapa com o arquivo editado, tem de falhar
 *   AQUI. O modo de falha caro e o outro: a partida abre, parece certa, e
 *   diverge 300 ticks depois quando um serf pisa no tile que mudou.
 *
 * O que ele NAO guarda: nada de `data/`. Custo, receita e duracao sao do dado
 * publicado, e um save que os congelasse viraria um segundo lugar onde os
 * numeros moram — exatamente o que a invariante 3 proibe.
 */
export const VERSAO_DO_SAVE = 1;

export interface Save {
  readonly versao: number;
  /** id do mapa da partida (`GameData.mapa.id`). */
  readonly mapa: string;
  /** `GameData.mapa.hash`, calculado no carregamento do dado. */
  readonly hashDoMapa: string;
  readonly estado: GameState;
}

/** Monta o envelope e serializa. O estado ja e serializavel por invariante. */
export function salvar(estado: GameState, dados: GameData = gameData): string {
  const save: Save = {
    versao: VERSAO_DO_SAVE,
    mapa: dados.mapa.id,
    hashDoMapa: dados.mapa.hash,
    estado,
  };
  return JSON.stringify(save);
}

function recusar(motivo: string): never {
  throw new Error(`carregar: ${motivo}`);
}

/**
 * Le o texto e devolve o estado, ou joga. Toda recusa acontece antes de o estado
 * sair daqui: quem chamou ou tem uma partida valida, ou tem um erro com o motivo
 * escrito — nunca um estado meio carregado.
 */
export function carregar(texto: string, dados: GameData = gameData): GameState {
  let cru: unknown;
  try {
    cru = JSON.parse(texto);
  } catch {
    return recusar('o save nao e JSON valido');
  }
  if (typeof cru !== 'object' || cru === null || Array.isArray(cru)) {
    return recusar('o save nao e um objeto');
  }
  const save = cru as Partial<Record<keyof Save, unknown>>;

  if (save.versao !== VERSAO_DO_SAVE) {
    return recusar(`o save e da versao ${String(save.versao)}, e esta build le a versao ${VERSAO_DO_SAVE}`);
  }
  if (save.mapa !== dados.mapa.id) {
    return recusar(`o save e do mapa '${String(save.mapa)}' e a partida usa '${dados.mapa.id}'`);
  }
  if (save.hashDoMapa !== dados.mapa.hash) {
    return recusar(
      `o mapa '${dados.mapa.id}' mudou desde o save (hash ${String(save.hashDoMapa)}, agora ${dados.mapa.hash})`,
    );
  }
  const estado = save.estado;
  if (typeof estado !== 'object' || estado === null || Array.isArray(estado)) {
    return recusar('o save nao tem estado');
  }
  if (typeof (estado as { tick?: unknown }).tick !== 'number') {
    return recusar('o estado do save nao tem tick');
  }
  return estado as GameState;
}
