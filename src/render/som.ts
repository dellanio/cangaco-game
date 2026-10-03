/**
 * H-TELA-CAMADA-DE-SOM — o render toca os eventos da sim.
 *
 * O fluxo e o do resto do render (CLAUDE.md §3): a sim emite `state.events` em cada `step`, e
 * aqui so se le. A tabela evento -> id de som e `data/som.json`, que a sim nunca le. Tres
 * filtros, nesta ordem:
 * - o evento de fora da vista do jogador (a nevoa da F) nao toca. Evento sem lugar (o fim da
 *   paz, o fim da partida) toca sempre; a recusa de comando so toca no tick que consumiu um
 *   comando do JOGADOR (a IA tambem tem comando recusado, e esse nao e da conta do jogador);
 * - o teto por quadro: o mesmo id pedido varias vezes no mesmo quadro toca no maximo
 *   `tetoPorQuadro` vezes. A 3x o quadro junta 3 ticks e o teto vale para o quadro, nao para o
 *   tick: a velocidade de jogo nao entra em nenhuma conta daqui, e o som toca no mesmo ritmo;
 * - o id sem arquivo no manifesto e silencio, sem erro: nada e carregado nem tocado por ele.
 *
 * Puro e sem Phaser nem DOM: quem toca de verdade e o `Tocador` injetado
 * (`render/tocador-de-som.ts`). O teste roda em Node.
 */
import { LADO_DO_JOGADOR } from '../sim/state';
import type { GameEvent, GameState } from '../sim/state';
import { ehVisivel, predioNaVista, visaoDe } from '../sim/nevoa';
import { temNevoa } from './nevoa';

/** Uma linha de `eventos`: o id direto, ou o id escolhido pelo valor de um campo do evento. */
export type LinhaDoEvento = string | { readonly campo: string; readonly por: Readonly<Record<string, string>> };

export interface TabelaDeSom {
  readonly planta: string;
  readonly eventos: Readonly<Record<string, LinhaDoEvento | string>>;
  readonly sons: Readonly<Record<string, { readonly tetoPorQuadro: number; readonly canal?: string }>>;
}

/** O id de som do evento pela tabela, ou `null` (evento sem linha, ou valor do campo sem id). */
export function idDoSom(evento: GameEvent, tabela: TabelaDeSom): string | null {
  const linha = tabela.eventos[evento.type];
  if (linha === undefined) return null;
  if (typeof linha === 'string') return linha;
  const valor = (evento as unknown as Record<string, unknown>)[linha.campo];
  return linha.por[String(valor)] ?? null;
}

/** Onde o evento acontece: uma unidade, um predio ou um tile. `null` = sem lugar (toca sempre). */
type Lugar = { readonly unidade: string } | { readonly predio: string } | { readonly gx: number; readonly gy: number } | null;

function lugarDoEvento(e: GameEvent): Lugar {
  switch (e.type) {
    case 'building-completed':
    case 'goods-produced':
    case 'stone-thrown':
    case 'building-attacked':
      return { predio: e.predio };
    case 'unit-trained':
    case 'unit-killed':
      return { unidade: e.unidade };
    case 'unit-struck':
      return { unidade: e.alvo };
    case 'projectile-fired':
      return { unidade: e.de };
    case 'command-rejected':
    case 'peace-ended':
    case 'match-ended':
      return null;
    default:
      return null;
  }
}

/**
 * O lugar esta na vista do jogador AGORA (no estado `depois`). A unidade que morreu neste tick ja
 * nao esta em `depois`: o tile dela vem de `antes`. O mesmo para o predio que caiu. O `de` do
 * projetil pode ser uma torre (predio). Sem nevoa, tudo esta na vista.
 */
function naVista(lugar: Lugar, depois: GameState, antes: GameState | null): boolean {
  if (lugar === null || !temNevoa(depois)) return true;
  const v = visaoDe(depois);
  if ('gx' in lugar) return ehVisivel(v, lugar.gx, lugar.gy);
  const id = 'unidade' in lugar ? lugar.unidade : lugar.predio;
  const u = depois.unidades.porId[id] ?? antes?.unidades.porId[id];
  if (u !== undefined) return u.lado === LADO_DO_JOGADOR || ehVisivel(v, u.gx, u.gy);
  if (depois.predios.porId[id] !== undefined) return predioNaVista(depois, id);
  const p = antes?.predios.porId[id];
  return p !== undefined && ehVisivel(v, p.gx, p.gy);
}

/**
 * Os ids de som de UM tick, ja sem o que esta fora da vista. `comandosDoJogador` e quantos
 * comandos do jogador este tick consumiu: sem nenhum, a recusa nao e dele e nao toca.
 */
export function sonsDoTick(
  depois: GameState, antes: GameState | null, tabela: TabelaDeSom, comandosDoJogador: number,
): string[] {
  const ids: string[] = [];
  for (const e of depois.events) {
    const id = idDoSom(e, tabela);
    if (id === null) continue;
    if (e.type === 'command-rejected' && comandosDoJogador === 0) continue;
    if (!naVista(lugarDoEvento(e), depois, antes)) continue;
    ids.push(id);
  }
  return ids;
}

export interface SonsDoQuadro {
  /** Os ids a tocar agora, com repeticao ate o teto, na ordem do primeiro pedido. */
  readonly tocar: readonly string[];
  /** Os pedidos (ja com o teto) cujo id nao tem arquivo: silencio. */
  readonly silencio: readonly string[];
}

/**
 * O que um quadro toca, dos ids pedidos desde o quadro anterior. Id fora de `tabela.sons` tem teto
 * 0 (nao toca: e erro de dado, e o `validate:data` o recusa). `disponiveis` sao os ids com arquivo.
 */
export function sonsDoQuadro(pedidos: readonly string[], tabela: TabelaDeSom, disponiveis: ReadonlySet<string>): SonsDoQuadro {
  const vezes = new Map<string, number>();
  const tocar: string[] = [];
  const silencio: string[] = [];
  for (const id of pedidos) {
    const n = vezes.get(id) ?? 0;
    if (n >= (tabela.sons[id]?.tetoPorQuadro ?? 0)) continue;
    vezes.set(id, n + 1);
    (disponiveis.has(id) ? tocar : silencio).push(id);
  }
  return { tocar, silencio };
}

/** Quem toca de verdade. Recebe so id que tem arquivo, com o volume (0 a 1) que vale agora. */
export interface Tocador {
  tocar(id: string, volume: number): void;
}

export interface ContadoresDeSom {
  /** Sons pedidos depois da vista e do teto (com e sem arquivo). E o que o roteiro mede. */
  readonly pedidos: number;
  readonly tocados: number;
  readonly emSilencio: number;
  readonly porId: Readonly<Record<string, number>>;
}

export interface CamadaDeSom {
  /** Um `step` rodou: junta os sons dele ao quadro. */
  aoPasso(estado: GameState, comandosDoJogador: number): void;
  /** Um som que vem do input, sem evento (a planta posicionada). */
  pedir(id: string): void;
  /** O som da planta posicionada (`tabela.planta`). */
  pedirPlanta(): void;
  /** Fim do quadro: aplica o teto e toca. */
  quadro(): void;
  /** A partida foi trocada (load): o estado anterior nao serve de `antes`. */
  reiniciar(): void;
  contadores(): ContadoresDeSom;
}

/**
 * `volume` diz o volume efetivo de um id agora (H-TELA-OPCOES-E-VOLUME: geral x canal, o mudo
 * zera). Id com volume 0 nao toca e conta como silencio.
 */
export function criarCamadaDeSom(
  tabela: TabelaDeSom, disponiveis: ReadonlySet<string>, tocador: Tocador, volume: (id: string) => number = () => 1,
): CamadaDeSom {
  let antes: GameState | null = null;
  let pendentes: string[] = [];
  let pedidos = 0;
  let tocados = 0;
  let emSilencio = 0;
  const porId: Record<string, number> = {};
  return {
    aoPasso(estado, comandosDoJogador) {
      pendentes.push(...sonsDoTick(estado, antes, tabela, comandosDoJogador));
      antes = estado;
    },
    pedir(id) {
      pendentes.push(id);
    },
    pedirPlanta() {
      pendentes.push(tabela.planta);
    },
    quadro() {
      if (pendentes.length === 0) return;
      const r = sonsDoQuadro(pendentes, tabela, disponiveis);
      pendentes = [];
      for (const id of [...r.tocar, ...r.silencio]) porId[id] = (porId[id] ?? 0) + 1;
      pedidos += r.tocar.length + r.silencio.length;
      emSilencio += r.silencio.length;
      for (const id of r.tocar) {
        const v = volume(id);
        if (v <= 0) {
          emSilencio += 1;
          continue;
        }
        tocados += 1;
        tocador.tocar(id, v);
      }
    },
    reiniciar() {
      antes = null;
      pendentes = [];
    },
    contadores() {
      return { pedidos, tocados, emSilencio, porId: { ...porId } };
    },
  };
}

/** A secao `sons` do `assets/manifest.json`: o arquivo de cada id aprovado (H-ARTE-SONS-APROVADOS). */
export type SonsDoManifesto = Readonly<Record<string, { readonly arquivo: string }>>;

/**
 * A URL de cada id que tem arquivo: o manifesto diz o caminho (`sons/x.ogg`), o bundler diz a URL.
 * Id do manifesto cujo arquivo o bundler nao achou fica de fora (silencio, sem 404).
 */
export function urlsDosSons(manifesto: SonsDoManifesto | undefined, urls: Readonly<Record<string, string>>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [id, som] of Object.entries(manifesto ?? {})) {
    if (id.startsWith('_')) continue;
    const url = urls[som.arquivo];
    if (url !== undefined) r[id] = url;
  }
  return r;
}
