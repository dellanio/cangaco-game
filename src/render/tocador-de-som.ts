/**
 * H-TELA-CAMADA-DE-SOM — o tocador de verdade, no navegador. So recebe id com arquivo
 * (`render/som.ts` filtra antes): sem arquivo, este modulo nunca cria um `Audio`, e por isso o
 * som que falta nao gera requisicao nem erro de console.
 *
 * `play()` recusado (a politica de autoplay, antes do primeiro gesto do jogador) e silencio: a
 * promessa e engolida aqui, para nao virar erro de console.
 */
import type { Tocador } from './som';
import type { TocadorDeFaixa, TocadorDeLaco } from './fundo-sonoro';
import type { TocadorDeVozes } from './som-do-trabalho';

/** BUG-SOM-BAIXA-A-CADA-TOQUE — o pedaco do Web Audio que o tocador usa, para o teste injetar um falso. */
export interface ContextoDeAudio {
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  decodeAudioData(dados: ArrayBuffer): Promise<unknown>;
  createBufferSource(): { buffer: unknown; connect(destino: unknown): unknown; start(): void };
  createGain(): { readonly gain: { value: number }; connect(destino: unknown): unknown };
}
export type BuscarArquivo = (url: string) => Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>;

/**
 * O som curto (H-TELA-CAMADA-DE-SOM), em Web Audio. BUG-SOM-BAIXA-A-CADA-TOQUE (2026-10-05): o tocador
 * de antes clonava um `Audio` a cada toque, e cada clone e um player novo que busca o arquivo; com o
 * cache desligado (o DevTools aberto) eram um download por toque, centenas numa vila grande. Agora
 * cada arquivo e buscado e decodificado UMA vez, e o toque e uma fonte sobre o buffer pronto, com o
 * ganho do volume. O toque antes de o buffer chegar e silencio, e o contexto suspenso (antes do
 * primeiro gesto, a politica de autoplay) tambem: `resume()` e tentado, sem erro de console.
 */
export function criarTocadorDeBuffers(
  urls: Readonly<Record<string, string>>, contexto: () => ContextoDeAudio | null, buscar: BuscarArquivo,
): Tocador {
  const buffers = new Map<string, unknown>();
  const pedidos = new Set<string>();
  function carregar(ctx: ContextoDeAudio, id: string, url: string): void {
    if (pedidos.has(id)) return;
    pedidos.add(id);
    buscar(url)
      .then((r) => r.arrayBuffer())
      .then((dados) => ctx.decodeAudioData(dados))
      .then((buffer) => { buffers.set(id, buffer); })
      .catch(() => undefined);
  }
  return {
    tocar(id, volume) {
      const url = urls[id];
      if (url === undefined) return;
      const ctx = contexto();
      if (ctx === null) return;
      carregar(ctx, id, url);
      if (ctx.state !== 'running') {
        ctx.resume().catch(() => undefined);
        return;
      }
      const buffer = buffers.get(id);
      if (buffer === undefined) return;
      const fonte = ctx.createBufferSource();
      fonte.buffer = buffer;
      const ganho = ctx.createGain();
      ganho.gain.value = Math.min(1, Math.max(0, volume));
      fonte.connect(ganho);
      ganho.connect(ctx.destination);
      fonte.start();
    },
  };
}

/** O tocador do jogo: um `AudioContext` so, criado no primeiro toque, e o `fetch` do navegador. */
export function criarTocadorDoNavegador(urls: Readonly<Record<string, string>>): Tocador {
  let ctx: ContextoDeAudio | null = null;
  return criarTocadorDeBuffers(urls, () => {
    if (ctx === null && typeof window.AudioContext === 'function') ctx = new window.AudioContext() as unknown as ContextoDeAudio;
    return ctx;
  }, (url) => window.fetch(url));
}

/** O elemento de audio que os lacos usam: o pedaco do `HTMLAudioElement`, para o teste injetar um falso. */
export interface AudioDeLaco {
  loop: boolean;
  volume: number;
  currentTime: number;
  readonly paused: boolean;
  addEventListener(tipo: 'ended', fn: () => void): void;
  play(): Promise<void>;
  pause(): void;
}

/**
 * Os lacos (o ambiente, a musica e as vozes de trabalho): um audio em laco por CHAVE, criado so quando
 * o id tem arquivo. O `play()` recusado antes do primeiro gesto tenta de novo, no maximo uma vez por
 * segundo. BUG-SOM-BAIXA-A-CADA-TOQUE (2026-10-05): `parar` so pausa e GUARDA o elemento, e o proximo
 * `tocar` da mesma chave o retoma. Antes, `parar` jogava o elemento fora e cada volta criava um novo,
 * que buscava o arquivo de novo (a voz da pedreira baixou 4 vezes em 60 s, medido no roteiro).
 */
export function criarLacos(
  criarAudio: (url: string) => AudioDeLaco, agora: () => number,
  /** I-TELA-TRILHA-SONORA — a faixa da trilha toca uma vez (`repetir` falso) e avisa o fim. */
  opcoes: { readonly repetir?: boolean; readonly aoTerminar?: (chave: string) => void } = {},
): {
  tocar(chave: string, url: string, volume: number): void;
  parar(chave: string): void;
  /** Para e volta ao comeco: o proximo `tocar` toca do inicio. */
  reiniciar(chave: string): void;
  /** O que cada elemento esta fazendo, para o roteiro (a ponte de depuracao). */
  inspecionar(): Record<string, { readonly tocando: boolean; readonly tempo: number; readonly volume: number }>;
} {
  const repetir = opcoes.repetir ?? true;
  const lacos = new Map<string, { readonly audio: AudioDeLaco; tentativa: number; ativo: boolean }>();
  function tentar(item: { readonly audio: AudioDeLaco; tentativa: number }): void {
    item.tentativa = agora();
    item.audio.play().catch(() => undefined);
  }
  return {
    tocar(chave, url, volume) {
      let item = lacos.get(chave);
      if (item === undefined) {
        const audio = criarAudio(url);
        audio.loop = repetir;
        const aoTerminar = opcoes.aoTerminar;
        if (aoTerminar !== undefined) audio.addEventListener('ended', () => { aoTerminar(chave); });
        item = { audio, tentativa: 0, ativo: true };
        lacos.set(chave, item);
        tentar(item);
      } else if (!item.ativo) {
        item.ativo = true;
        tentar(item);
      } else if (item.audio.paused && agora() - item.tentativa > 1000) {
        tentar(item);
      }
      item.audio.volume = Math.min(1, Math.max(0, volume));
    },
    parar(chave) {
      const item = lacos.get(chave);
      if (item === undefined || !item.ativo) return;
      item.audio.pause();
      item.ativo = false;
    },
    reiniciar(chave) {
      const item = lacos.get(chave);
      if (item === undefined) return;
      item.audio.pause();
      item.audio.currentTime = 0;
      item.ativo = false;
    },
    inspecionar() {
      const r: Record<string, { tocando: boolean; tempo: number; volume: number }> = {};
      for (const [chave, item] of lacos) r[chave] = { tocando: !item.audio.paused, tempo: item.audio.currentTime, volume: item.audio.volume };
      return r;
    },
  };
}

/**
 * I-TELA-TRILHA-SONORA — o tocador das faixas da trilha: uma faixa por id, sem laco, e o fim dela
 * avisa quem registrou em `quandoTerminar` (o fundo sonoro, que passa para a seguinte).
 */
export function criarTocadorDeFaixasDoNavegador(urls: Readonly<Record<string, string>>): TocadorDeFaixa & {
  inspecionar(): Record<string, { readonly tocando: boolean; readonly tempo: number; readonly volume: number }>;
} {
  let aoTerminar: (id: string) => void = () => undefined;
  const lacos = criarLacos(audioDoNavegador, agoraDoNavegador, { repetir: false, aoTerminar: (id) => { aoTerminar(id); } });
  return {
    tocar(id, volume) {
      const url = urls[id];
      if (url !== undefined) lacos.tocar(id, url, volume);
    },
    parar(id) { lacos.parar(id); },
    reiniciar(id) { lacos.reiniciar(id); },
    quandoTerminar(fn) { aoTerminar = fn; },
    inspecionar() { return lacos.inspecionar(); },
  };
}

const audioDoNavegador = (url: string): AudioDeLaco => new Audio(url);
const agoraDoNavegador = (): number => window.performance.now();

/**
 * H-TELA-AMBIENTE-E-MUSICA — o tocador em laco (o ambiente e a musica): um laco por id (`criarLacos`).
 */
export function criarTocadorDeLacoDoNavegador(urls: Readonly<Record<string, string>>): TocadorDeLaco {
  const lacos = criarLacos(audioDoNavegador, agoraDoNavegador);
  return {
    tocar(id, volume) {
      const url = urls[id];
      if (url !== undefined) lacos.tocar(id, url, volume);
    },
    parar(id) { lacos.parar(id); },
  };
}

/**
 * H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA — o tocador das vozes de trabalho: um laco por VOZ
 * (`build-wood:0`, `build-wood:1`), com o arquivo do id dela (`criarLacos`).
 */
export function criarTocadorDeVozesDoNavegador(urls: Readonly<Record<string, string>>): TocadorDeVozes {
  const lacos = criarLacos(audioDoNavegador, agoraDoNavegador);
  return {
    tocar(voz, id, volume) {
      const url = urls[id];
      if (url !== undefined) lacos.tocar(voz, url, volume);
    },
    parar(voz) { lacos.parar(voz); },
  };
}
