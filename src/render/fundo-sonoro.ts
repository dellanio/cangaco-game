/**
 * H-TELA-AMBIENTE-E-MUSICA — o sertao de fundo: o ambiente em laco, o sino da Bodega e a musica.
 *
 * Tudo le o estado e a camera; nada volta para o estado (CLAUDE.md §3). Os numeros sao de
 * `data/som.json` (`ambiente`, `musica`). Tres partes:
 * - o AMBIENTE (vento seco, cigarra) toca em laco o tempo todo em jogo, sem lugar: segue a camera.
 *   No menu o jogo nao existe, e nada daqui roda;
 * - o SINO da Bodega e pedido a camada de efeitos (`render/som.ts`) quando uma Bodega do jogador
 *   entra na vista da camera, e de novo a cada `intervaloSegundos` enquanto ela estiver la;
 * - a MUSICA: a faixa sai do estado (`faixaDaMusica`) e a troca e uma passagem (`misturar`): a que
 *   sai desce enquanto a que entra sobe, em `transicaoSegundos`, sem corte.
 * Sem arquivo, o id e silencio, e o tocador nunca e chamado por ele. Puro e sem Phaser nem DOM.
 */
import { LADO_DO_JOGADOR } from '../sim/state';
import type { GameEvent, GameState } from '../sim/state';

export type Faixa = 'paz' | 'combate';
export const FAIXAS: readonly Faixa[] = ['paz', 'combate'];

export interface DadosDoFundo {
  readonly ambiente: {
    readonly lacos: readonly string[];
    readonly sino: { readonly som: string; readonly predio: string; readonly intervaloSegundos: number };
  };
  readonly musica: {
    readonly paz: string;
    /** I-TELA-TRILHA-SONORA — as faixas da trilha, na ordem; presente e nao vazia, ela e a camada da
     *  paz no lugar de `paz`. */
    readonly playlist?: readonly string[];
    readonly combate: string;
    readonly raioDoCombateTiles: number;
    readonly segundosDeCombateDepoisDaLuta: number;
    readonly transicaoSegundos: number;
  };
}

type Tile = { readonly gx: number; readonly gy: number };

/** Onde houve luta neste tick: o golpe (no alvo), o ataque a predio, o tiro e a pedra (no alvo). */
function tilesDaLuta(e: GameEvent, depois: GameState, antes: GameState | null): Tile | null {
  switch (e.type) {
    case 'unit-struck': {
      const u = depois.unidades.porId[e.alvo] ?? antes?.unidades.porId[e.alvo];
      return u === undefined ? null : { gx: u.gx, gy: u.gy };
    }
    case 'building-attacked': {
      const p = depois.predios.porId[e.predio] ?? antes?.predios.porId[e.predio];
      return p === undefined ? null : { gx: p.gx, gy: p.gy };
    }
    case 'projectile-fired':
    case 'stone-thrown':
      return e.alvo;
    default:
      return null;
  }
}

/** Houve luta neste tick a ate `raio` tiles (distancia de Chebyshev) de um predio do jogador. */
export function houveLutaPertoDaVila(depois: GameState, antes: GameState | null, raio: number): boolean {
  const lutas: Tile[] = [];
  for (const e of depois.events) {
    const t = tilesDaLuta(e, depois, antes);
    if (t !== null) lutas.push(t);
  }
  if (lutas.length === 0) return false;
  for (const id of depois.predios.ordem) {
    const p = depois.predios.porId[id];
    if (p === undefined || p.lado !== LADO_DO_JOGADOR) continue;
    for (const t of lutas) if (Math.max(Math.abs(t.gx - p.gx), Math.abs(t.gy - p.gy)) <= raio) return true;
  }
  return false;
}

/**
 * A faixa que o estado pede. `ultimaLutaPerto` e o tick da ultima luta perto da vila (ou `null`);
 * `ticksDeCombate` e quanto o combate dura depois dela. Depois do fim da partida, nenhuma.
 */
export function faixaDaMusica(estado: GameState, ultimaLutaPerto: number | null, ticksDeCombate: number): Faixa | null {
  if (estado.partida !== undefined) return null;
  if (ultimaLutaPerto !== null && estado.tick - ultimaLutaPerto <= ticksDeCombate) return 'combate';
  return 'paz';
}

export type Niveis = Readonly<Record<Faixa, number>>;
export const SILENCIO: Niveis = { paz: 0, combate: 0 };

/**
 * Um passo da passagem: cada faixa anda para 1 (a pedida) ou 0 (as outras) no maximo `dtMs /
 * duracaoMs` por chamada. Nunca pula: a troca nao corta no meio. `duracaoMs` 0 troca na hora.
 */
export function misturar(niveis: Niveis, alvo: Faixa | null, dtMs: number, duracaoMs: number): Niveis {
  const passo = duracaoMs <= 0 ? 1 : Math.max(0, dtMs) / duracaoMs;
  const andar = (atual: number, destino: number): number =>
    atual < destino ? Math.min(destino, atual + passo) : Math.max(destino, atual - passo);
  return { paz: andar(niveis.paz, alvo === 'paz' ? 1 : 0), combate: andar(niveis.combate, alvo === 'combate' ? 1 : 0) };
}

/** A caixa de tiles que a camera mostra (inclusiva). */
export interface VistaEmTiles {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** O tile de uma Bodega do jogador (o tipo do dado) que esta dentro da vista, ou `null`. */
export function bodegaNaVistaEm(estado: GameState, tipo: string, vista: VistaEmTiles | null): Tile | null {
  if (vista === null) return null;
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (p === undefined || p.tipo !== tipo || p.lado !== LADO_DO_JOGADOR) continue;
    if (p.gx >= vista.x0 && p.gx <= vista.x1 && p.gy >= vista.y0 && p.gy <= vista.y1) return { gx: p.gx, gy: p.gy };
  }
  return null;
}

/** Uma Bodega do jogador (o tipo do dado) tem o tile de origem dentro da vista. */
export function bodegaNaVista(estado: GameState, tipo: string, vista: VistaEmTiles | null): boolean {
  return bodegaNaVistaEm(estado, tipo, vista) !== null;
}

/** Quem toca o som em laco: `tocar` liga (ou so ajusta o volume do que ja toca); `parar` desliga. */
export interface TocadorDeLaco {
  tocar(id: string, volume: number): void;
  parar(id: string): void;
}

/** I-TELA-TRILHA-SONORA — quem toca as faixas da trilha: sem laco; `parar` guarda o ponto, `reiniciar`
 *  volta ao comeco, e o fim de uma faixa chama `quandoTerminar`. */
export interface TocadorDeFaixa extends TocadorDeLaco {
  reiniciar(id: string): void;
  quandoTerminar(fn: (id: string) => void): void;
}

/** I-TELA-TRILHA-SONORA — o player: a faixa da vez (o indice na playlist) e a pausa do jogador. */
export interface EstadoDaTrilha {
  readonly indice: number;
  readonly pausada: boolean;
}

/** A faixa depois da `indice`, numa playlist de `n`: da ultima volta a primeira. */
export function proximaFaixa(indice: number, n: number): number {
  return n <= 0 ? 0 : (indice + 1) % n;
}

/** Passar: a proxima faixa, e a pausa como estava. */
export function passarFaixa(estado: EstadoDaTrilha, n: number): EstadoDaTrilha {
  return { indice: proximaFaixa(estado.indice, n), pausada: estado.pausada };
}

/** O comeco da partida: a primeira faixa (a padrao), tocando. */
export const TRILHA_INICIAL: EstadoDaTrilha = { indice: 0, pausada: false };

export interface ContadoresDoFundo {
  /** Os lacos de ambiente ligados (com e sem arquivo): o que o roteiro mede. */
  readonly ambienteLigado: readonly string[];
  /** Quantos quadros o ambiente passou ligado. */
  readonly quadrosComAmbiente: number;
  readonly faixa: Faixa | null;
  readonly niveis: Niveis;
  readonly sinos: number;
  /** I-TELA-TRILHA-SONORA — a faixa da vez e a pausa do jogador; `null` sem playlist. */
  readonly trilha: (EstadoDaTrilha & { readonly faixa: string }) | null;
}

export interface FundoSonoro {
  /** Um `step` rodou: guarda a luta perto da vila, se houve (a de todo tick, nao so a do quadro). */
  aoPasso(depois: GameState, antes: GameState | null): void;
  /** Fim do quadro: o ambiente, o sino e a musica. */
  quadro(agoraMs: number, estado: GameState, vista: VistaEmTiles | null): void;
  /** A partida foi trocada (load): sem luta lembrada, a musica volta a pedir do zero. */
  reiniciar(): void;
  contadores(): ContadoresDoFundo;
  /** I-TELA-TRILHA-SONORA — os controles do jogador: passar a faixa, e pausar ou continuar a trilha. */
  passarFaixa(): void;
  alternarPausaDaTrilha(): void;
}

export function criarFundoSonoro(opcoes: {
  readonly dados: DadosDoFundo;
  readonly disponiveis: ReadonlySet<string>;
  readonly tocador: TocadorDeLaco;
  /** O volume efetivo do id agora (geral x canal, o mudo zera). */
  readonly volume: (id: string) => number;
  /** O sino vai para a camada de efeitos, com o lugar da Bodega (H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA). */
  readonly pedir: (id: string, tile: Tile) => void;
  /** `gameData.tempo.tickMs`: os segundos de combate depois da luta sao de jogo. */
  readonly tickMs: number;
  /** I-TELA-TRILHA-SONORA — quem toca as faixas da playlist (sem ele, a playlist e silencio). */
  readonly tocadorDaTrilha?: TocadorDeFaixa;
}): FundoSonoro {
  const { dados, disponiveis, tocador, volume, pedir, tickMs } = opcoes;
  const faixas = dados.musica.playlist ?? [];
  const tocadorDaTrilha = opcoes.tocadorDaTrilha ?? null;
  const comTrilha = faixas.length > 0 && tocadorDaTrilha !== null;
  let trilha: EstadoDaTrilha = TRILHA_INICIAL;
  const faixaDaVez = (): string => faixas[trilha.indice] ?? dados.musica.paz;
  const tocandoTrilha = new Set<string>();
  /** Passa para a proxima: a de agora para e volta ao comeco (para tocar do inicio quando voltar). */
  function avancar(): void {
    const atual = faixaDaVez();
    tocandoTrilha.delete(atual);
    tocadorDaTrilha?.reiniciar(atual);
    trilha = passarFaixa(trilha, faixas.length);
  }
  // o fim de uma faixa (sem laco) passa para a seguinte
  tocadorDaTrilha?.quandoTerminar((id) => { if (id === faixaDaVez()) avancar(); });
  const ticksDeCombate = Math.round((dados.musica.segundosDeCombateDepoisDaLuta * 1000) / tickMs);
  const idDaFaixa: Readonly<Record<Faixa, string>> = { paz: dados.musica.paz, combate: dados.musica.combate };
  let ultimaLutaPerto: number | null = null;
  let niveis: Niveis = SILENCIO;
  let faixa: Faixa | null = null;
  let ultimoQuadroMs: number | null = null;
  let proximoSinoMs: number | null = null;
  let quadrosComAmbiente = 0;
  let sinos = 0;
  const tocando = new Set<string>();

  function soar(id: string, v: number): void {
    if (!disponiveis.has(id) || v <= 0) {
      if (tocando.delete(id)) tocador.parar(id);
      return;
    }
    tocando.add(id);
    tocador.tocar(id, v);
  }

  return {
    aoPasso(depois, antes) {
      if (houveLutaPertoDaVila(depois, antes, dados.musica.raioDoCombateTiles)) ultimaLutaPerto = depois.tick;
    },
    quadro(agoraMs, estado, vista) {
      const dt = ultimoQuadroMs === null ? 0 : agoraMs - ultimoQuadroMs;
      ultimoQuadroMs = agoraMs;
      quadrosComAmbiente += 1;
      for (const id of dados.ambiente.lacos) soar(id, volume(id));

      const bodega = bodegaNaVistaEm(estado, dados.ambiente.sino.predio, vista);
      if (bodega !== null) {
        if (proximoSinoMs === null || agoraMs >= proximoSinoMs) {
          pedir(dados.ambiente.sino.som, bodega);
          sinos += 1;
          proximoSinoMs = agoraMs + dados.ambiente.sino.intervaloSegundos * 1000;
        }
      } else {
        proximoSinoMs = null;
      }

      faixa = faixaDaMusica(estado, ultimaLutaPerto, ticksDeCombate);
      niveis = misturar(niveis, faixa, dt, dados.musica.transicaoSegundos * 1000);
      soar(idDaFaixa.combate, niveis.combate * volume(idDaFaixa.combate));
      if (!comTrilha) {
        soar(idDaFaixa.paz, niveis.paz * volume(idDaFaixa.paz));
      } else {
        // I-TELA-TRILHA-SONORA: a camada da paz e a faixa da vez; a pausa do jogador a cala (e guarda o ponto)
        const id = faixaDaVez();
        const v = trilha.pausada ? 0 : niveis.paz * volume(id);
        if (!disponiveis.has(id) || v <= 0) {
          if (tocandoTrilha.delete(id)) tocadorDaTrilha!.parar(id);
        } else {
          tocandoTrilha.add(id);
          tocadorDaTrilha!.tocar(id, v);
        }
      }
    },
    reiniciar() {
      ultimaLutaPerto = null;
    },
    contadores() {
      return {
        ambienteLigado: [...dados.ambiente.lacos], quadrosComAmbiente, faixa, niveis, sinos,
        trilha: comTrilha ? { ...trilha, faixa: faixaDaVez() } : null,
      };
    },
    passarFaixa() {
      if (comTrilha) avancar();
    },
    alternarPausaDaTrilha() {
      if (comTrilha) trilha = { ...trilha, pausada: !trilha.pausada };
    },
  };
}
