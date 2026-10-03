import type { GameData } from './data/types';
import { gameData } from './data';
import { caixaDoPredio } from './footprint';
import type { GameState } from './state';
import { LADO_DO_JOGADOR } from './state';

/**
 * F-TERRENO-NEVOA-DESCOBERTO — o que o lado do jogador ve agora e o que ja viu (GDD 6.5).
 *
 * Duas camadas, por tile:
 * - `descoberto` (no `GameState`, entra no save): ja foi visto alguma vez. MONOTONICO. 1 bit
 *   por tile, indice `gy * largura + gx`, empacotado em inteiros de 32 bits sem sinal.
 * - `visivel` (fora do estado): visto agora. DERIVADO das posicoes de quem enxerga e do raio
 *   de `data/`, entao sai identico depois do load sem ser salvo.
 *
 * So o lado do jogador: a IA ignora a nevoa (`systems/ia.ts`), e camada sem consumidor nao
 * nasce. Quem enxerga: toda unidade do lado (o raio do tipo) e todo predio COMPLETO do lado
 * (o footprint mais o raio do predio). Obra nao revela: no KaM so a casa ativada revela
 * (src/houses/KM_Houses.pas:669-694, clone 731a8a4). O disco e o do KaM, `dx*dx + dy*dy <= r*r`
 * (src/game/KM_FogOfWar.pas:176), medido do tile ao footprint: e a uniao dos discos de cada
 * tile do footprint, como o KaM revela a casa (KM_Houses.pas:690-694).
 *
 * O `visivel` NAO limpa `largura x altura` por tick (GDD 6.5, item 2). Ele e uma CONTAGEM por
 * tile — quantos olhos o veem — e cada olho guarda onde carimbou. No `step`, so o olho que
 * mudou (andou, nasceu, morreu, o predio ficou pronto ou caiu) descarimba o disco velho e
 * carimba o novo. O tile que vai de 0 a 1 e o unico que pode virar descoberto.
 *
 * A contagem vive num cache por REFERENCIA de estado (`WeakMap`), como o indice das estradas
 * (`sim/estradas.ts`): memoria derivada, fora do JSON, sem efeito no determinismo. O `step`
 * PASSA o cache do estado de entrada para o de saida (e o atualiza no lugar); quem pedir a
 * visao de um estado sem cache (um load, um estado montado a mao, um ramo que voltou atras)
 * recebe a conta inteira, que da o mesmo resultado.
 */

/** O que um olho cobre: a caixa que ele ocupa (meio-aberta) e o raio alem dela. */
interface Olho {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly raio: number;
}

export interface Visao {
  readonly dados: GameData;
  readonly largura: number;
  readonly altura: number;
  /** Quantos olhos veem cada tile. Visivel = contagem > 0. */
  readonly contagem: Uint16Array;
  /** Olho por id de entidade (unidade ou predio; os ids nao colidem). */
  readonly olhos: Map<string, Olho>;
  /** Eixo deterministico (aceite d): tiles carimbados ou descarimbados no ultimo avanco. */
  carimbados: number;
}

const BITS = 32;

const visoes = new WeakMap<GameState, Visao>();

function mesmoOlho(a: Olho, b: Olho): boolean {
  return a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1 && a.raio === b.raio;
}

/** O raio do tipo de unidade. Tipo sem raio no dado e erro de dado, nao nevoa. */
function raioDaUnidade(tipo: string, dados: GameData): number {
  const raio = dados.visao.porTipoDeUnidade[tipo];
  if (raio === undefined) throw new Error(`nevoa: o tipo de unidade '${tipo}' nao tem visao em data/units.json`);
  return raio;
}

/** Os olhos do lado do jogador neste estado, por id. */
function olhosDoEstado(state: GameState, dados: GameData): Map<string, Olho> {
  const olhos = new Map<string, Olho>();
  for (const id of state.unidades.ordem) {
    const u = state.unidades.porId[id];
    if (u === undefined || u.lado !== LADO_DO_JOGADOR) continue;
    olhos.set(id, { x0: u.gx, y0: u.gy, x1: u.gx + 1, y1: u.gy + 1, raio: raioDaUnidade(u.tipo, dados) });
  }
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p === undefined || p.lado !== LADO_DO_JOGADOR || p.estado !== 'completo') continue;
    const caixa = caixaDoPredio(p, dados);
    if (caixa === null) continue;
    olhos.set(id, { ...caixa, raio: dados.visao.porTipoDePredio[p.tipo] ?? dados.visao.predio });
  }
  return olhos;
}

/**
 * Soma `delta` a contagem de todo tile que o olho ve, e devolve quantos tocou. `aoAcender`
 * recebe o indice de cada tile que foi de 0 a 1.
 */
function carimbar(v: Visao, o: Olho, delta: 1 | -1, aoAcender: ((i: number) => void) | null): number {
  const r2 = o.raio * o.raio;
  const ya = Math.max(0, o.y0 - o.raio);
  const yb = Math.min(v.altura - 1, o.y1 - 1 + o.raio);
  const xa = Math.max(0, o.x0 - o.raio);
  const xb = Math.min(v.largura - 1, o.x1 - 1 + o.raio);
  let n = 0;
  for (let y = ya; y <= yb; y++) {
    const dy = y < o.y0 ? o.y0 - y : y >= o.y1 ? y - (o.y1 - 1) : 0;
    const dy2 = dy * dy;
    for (let x = xa; x <= xb; x++) {
      const dx = x < o.x0 ? o.x0 - x : x >= o.x1 ? x - (o.x1 - 1) : 0;
      if (dx * dx + dy2 > r2) continue;
      const i = y * v.largura + x;
      const c = (v.contagem[i] ?? 0) + delta;
      v.contagem[i] = c;
      n += 1;
      if (c === 1 && delta === 1 && aoAcender !== null) aoAcender(i);
    }
  }
  return n;
}

/** A visao inteira, do zero. */
function visaoInteira(state: GameState, dados: GameData): Visao {
  const { largura, altura } = dados.mapa;
  const v: Visao = { dados, largura, altura, contagem: new Uint16Array(largura * altura), olhos: olhosDoEstado(state, dados), carimbados: 0 };
  for (const o of v.olhos.values()) v.carimbados += carimbar(v, o, 1, null);
  return v;
}

/** A visao do lado do jogador neste estado. Do cache, se o `step` a deixou; senao, inteira. */
export function visaoDe(state: GameState, dados: GameData = gameData): Visao {
  const v = visoes.get(state);
  if (v !== undefined && v.dados === dados) return v;
  const nova = visaoInteira(state, dados);
  visoes.set(state, nova);
  return nova;
}

/** O tile esta sendo visto agora pelo lado do jogador. Fora do mapa: nao. */
export function ehVisivel(v: Visao, gx: number, gy: number): boolean {
  if (gx < 0 || gy < 0 || gx >= v.largura || gy >= v.altura) return false;
  return (v.contagem[gy * v.largura + gx] ?? 0) > 0;
}

/** O tile ja foi visto pelo `lado`. Estado sem a camada (montado a mao, save anterior a F):
 *  tudo descoberto — sem nevoa. */
export function ehDescoberto(state: GameState, lado: number, gx: number, gy: number, dados: GameData = gameData): boolean {
  const bits = state.descoberto?.[String(lado)];
  if (bits === undefined) return true;
  const { largura, altura } = dados.mapa;
  if (gx < 0 || gy < 0 || gx >= largura || gy >= altura) return false;
  const i = gy * largura + gx;
  return (((bits[Math.floor(i / BITS)] ?? 0) >>> (i % BITS)) & 1) === 1;
}

/** Quantos bits de 32 o mapa pede. */
function palavras(dados: GameData): number {
  return Math.ceil((dados.mapa.largura * dados.mapa.altura) / BITS);
}

/** Liga o bit `i` em `bits` (que o chamador ja copiou). */
function ligar(bits: number[], i: number): void {
  const w = Math.floor(i / BITS);
  bits[w] = ((bits[w] ?? 0) | (1 << (i % BITS))) >>> 0;
}

function aceso(bits: readonly number[], i: number): boolean {
  return (((bits[Math.floor(i / BITS)] ?? 0) >>> (i % BITS)) & 1) === 1;
}

/**
 * O `descoberto` de um estado que nasce agora (o tick 0 do jogo livre e da escaramuca): o
 * que o lado do jogador ve nele.
 */
export function descobertoInicial(state: GameState, dados: GameData = gameData): NonNullable<GameState['descoberto']> {
  const v = visaoDe(state, dados);
  const bits: number[] = new Array<number>(palavras(dados)).fill(0);
  for (let i = 0; i < v.contagem.length; i++) if ((v.contagem[i] ?? 0) > 0) ligar(bits, i);
  return { [String(LADO_DO_JOGADOR)]: bits };
}

/**
 * O passo da nevoa, no fim do `step`: leva a visao de `antes` para `depois` mexendo so nos
 * olhos que mudaram, e liga em `descoberto` o tile que acendeu. Estado sem a camada passa
 * igual. A referencia de `descoberto` so muda quando algum bit novo acende.
 *
 * Sem cache de `antes` (load, ramo, estado montado), a visao e inteira e TODO tile visivel e
 * conferido contra `descoberto`; com cache, `antes` saiu de um `step`, que ja ligou tudo o que
 * via, e so o tile que acendeu agora pode ser novo. As duas dao o mesmo `descoberto`.
 */
export function avancarNevoa(antes: GameState, depois: GameState, dados: GameData = gameData): GameState {
  const chave = String(LADO_DO_JOGADOR);
  const bitsAntes = depois.descoberto?.[chave];
  if (depois.descoberto === undefined || bitsAntes === undefined) return depois;

  let bits: number[] | null = null;
  const acender = (i: number): void => {
    if (aceso(bits ?? bitsAntes, i)) return;
    if (bits === null) bits = [...bitsAntes];
    ligar(bits, i);
  };

  const emCache = visoes.get(antes);
  let v: Visao;
  if (emCache !== undefined && emCache.dados === dados) {
    v = emCache;
    visoes.delete(antes);
    v.carimbados = 0;
    const novos = olhosDoEstado(depois, dados);
    for (const [id, velho] of v.olhos) {
      const novo = novos.get(id);
      if (novo !== undefined && mesmoOlho(velho, novo)) continue;
      v.carimbados += carimbar(v, velho, -1, null);
      v.olhos.delete(id);
    }
    for (const [id, novo] of novos) {
      if (v.olhos.has(id)) continue;
      v.carimbados += carimbar(v, novo, 1, acender);
      v.olhos.set(id, novo);
    }
  } else {
    v = visaoInteira(depois, dados);
    for (let i = 0; i < v.contagem.length; i++) if ((v.contagem[i] ?? 0) > 0) acender(i);
  }
  const resultado: GameState = bits === null ? depois : { ...depois, descoberto: { ...depois.descoberto, [chave]: bits } };
  visoes.set(resultado, v);
  return resultado;
}
