/**
 * F-TELA-NEVOA — o que a tela esconde e escurece pela nevoa do lado do jogador (GDD 6.5).
 *
 * A sim decide o que se ve (`sim/nevoa.ts`: `descoberto` no estado, `visivel` derivado); aqui so
 * se le, por seletor, e nada volta para o estado. Os dois niveis do GDD:
 * - APRESENTACAO: o terreno e o predio proprio aparecem como estao; o tile nunca descoberto fica
 *   escuro, o descoberto fora da vista esmaecido (`texturaDaNevoa`);
 * - REGRA: a unidade e o predio INIMIGOS fora da vista nao existem para o jogador — nao se
 *   desenham, nao se clicam, nao entram no painel nem no minimapa (`inimigosForaDaVista`,
 *   `prediosInimigosForaDaVista`, `predioClicavel`).
 *
 * Estado sem a camada (`descoberto` ausente: montado a mao, save de antes da F) e sem nevoa: nada
 * se esconde, nada escurece. Pura e sem Phaser: o teste roda em Node.
 *
 * So o estado ATUAL da ponte passa por aqui: a visao vive num cache por referencia de estado, e
 * pedir a de um estado velho refaria a conta inteira.
 */
import { LADO_DO_JOGADOR } from '../sim/state';
import type { GameState } from '../sim/state';
import { ehDescoberto, ehVisivel, predioNaVista, visaoDe } from '../sim/nevoa';

/** O estado tem a nevoa do jogador. */
export function temNevoa(state: GameState): boolean {
  return state.descoberto?.[String(LADO_DO_JOGADOR)] !== undefined;
}

/** As unidades de outro lado que o jogador nao ve agora. Vazio sem nevoa. */
export function inimigosForaDaVista(state: GameState): ReadonlySet<string> {
  const r = new Set<string>();
  if (!temNevoa(state)) return r;
  const v = visaoDe(state);
  for (const id of state.unidades.ordem) {
    const u = state.unidades.porId[id];
    if (u !== undefined && u.lado !== LADO_DO_JOGADOR && !ehVisivel(v, u.gx, u.gy)) r.add(id);
  }
  return r;
}

/** Os predios de outro lado que o jogador nao ve agora (nenhum tile do footprint a vista). */
export function prediosInimigosForaDaVista(state: GameState): ReadonlySet<string> {
  const r = new Set<string>();
  if (!temNevoa(state)) return r;
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p !== undefined && p.lado !== LADO_DO_JOGADOR && !predioNaVista(state, id)) r.add(id);
  }
  return r;
}

/** O predio (por id) que o clique pode pegar: o proprio sempre, o inimigo so a vista. `null` passa. */
export function predioClicavel(state: GameState, id: string | null): string | null {
  const predio = id === null ? undefined : state.predios.porId[id];
  if (id === null || predio === undefined || predio.lado === LADO_DO_JOGADOR || !temNevoa(state)) return id;
  return predioNaVista(state, id) ? id : null;
}

export interface CoresDaNevoa {
  readonly cor: string;
  readonly alfaNaoDescoberto: number;
  readonly alfaForaDaVista: number;
}

/**
 * Os pixels RGBA da textura da nevoa, um por tile do `mapa` (o `configDoMapa`) (linha a linha, `gy * largura + gx`): a cor do
 * dado com o alfa do tile. Sem nevoa, tudo transparente. `destino` e reaproveitado quando vem.
 */
export function texturaDaNevoa(
  state: GameState, cores: CoresDaNevoa, mapa: { readonly largura: number; readonly altura: number }, destino?: Uint8ClampedArray,
): Uint8ClampedArray {
  const { largura, altura } = mapa;
  const px = destino !== undefined && destino.length === largura * altura * 4 ? destino : new Uint8ClampedArray(largura * altura * 4);
  if (!temNevoa(state)) {
    px.fill(0);
    return px;
  }
  const r = Number.parseInt(cores.cor.slice(1, 3), 16);
  const g = Number.parseInt(cores.cor.slice(3, 5), 16);
  const b = Number.parseInt(cores.cor.slice(5, 7), 16);
  const escuro = Math.round(cores.alfaNaoDescoberto * 255);
  const esmaecido = Math.round(cores.alfaForaDaVista * 255);
  const v = visaoDe(state);
  for (let gy = 0; gy < altura; gy++) {
    for (let gx = 0; gx < largura; gx++) {
      const i = (gy * largura + gx) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = ehVisivel(v, gx, gy) ? 0 : ehDescoberto(state, LADO_DO_JOGADOR, gx, gy) ? esmaecido : escuro;
    }
  }
  return px;
}

/**
 * F-TELA-NEVOA — HARNESS de roteiro, como o `?aguaDesligada`: `?semNevoa` tira so a camada escura
 * (na cena e no minimapa), para o roteiro que olha terreno longe da vila (o vento, a agua) ver o
 * chao. A regra continua: o inimigo fora da vista segue sem se desenhar e sem se clicar, e a sim
 * nao muda. Nao usar em jogo.
 */
export function nevoaNaTela(busca: string): boolean {
  return !new URLSearchParams(busca).has('semNevoa');
}

/** F-TELA-NEVOA — a profundidade da nevoa: acima de todo predio, unidade e arvore (que se ordenam
 *  pelo y em px de mundo, alguns milhares) e abaixo dos nomes (900 000) e da selecao. */
export const PROFUNDIDADE_DA_NEVOA = 800_000;

/** Quantos tiles a textura deixou visiveis, esmaecidos e escuros: o que o roteiro afirma. */
export interface ResumoDaNevoa {
  readonly visiveis: number;
  readonly esmaecidos: number;
  readonly escuros: number;
}

export function resumoDaNevoa(px: Uint8ClampedArray, cores: CoresDaNevoa): ResumoDaNevoa {
  const escuro = Math.round(cores.alfaNaoDescoberto * 255);
  let visiveis = 0;
  let esmaecidos = 0;
  let escuros = 0;
  for (let i = 3; i < px.length; i += 4) {
    const a = px[i] ?? 0;
    if (a === 0) visiveis += 1;
    else if (a === escuro) escuros += 1;
    else esmaecidos += 1;
  }
  return { visiveis, esmaecidos, escuros };
}
