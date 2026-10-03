/**
 * H-TELA-CAMADA-DE-SOM — o tocador de verdade, no navegador. So recebe id com arquivo
 * (`render/som.ts` filtra antes): sem arquivo, este modulo nunca cria um `Audio`, e por isso o
 * som que falta nao gera requisicao nem erro de console.
 *
 * `play()` recusado (a politica de autoplay, antes do primeiro gesto do jogador) e silencio: a
 * promessa e engolida aqui, para nao virar erro de console.
 */
import type { Tocador } from './som';
import type { TocadorDeLaco } from './fundo-sonoro';

export function criarTocadorDoNavegador(urls: Readonly<Record<string, string>>): Tocador {
  const modelos = new Map<string, HTMLAudioElement>();
  return {
    tocar(id, volume) {
      const url = urls[id];
      if (url === undefined) return;
      let modelo = modelos.get(id);
      if (modelo === undefined) {
        modelo = new Audio(url);
        modelo.preload = 'auto';
        modelos.set(id, modelo);
      }
      const copia = modelo.cloneNode() as HTMLAudioElement;
      copia.volume = Math.min(1, Math.max(0, volume));
      copia.play().catch(() => undefined);
    },
  };
}

/**
 * H-TELA-AMBIENTE-E-MUSICA — o tocador em laco (o ambiente e a musica). Um `Audio` por id, criado
 * so quando o id tem arquivo. Antes do primeiro gesto do jogador o navegador recusa o `play()`: o
 * elemento fica, e a proxima chamada tenta de novo, no maximo uma vez por segundo.
 */
export function criarTocadorDeLacoDoNavegador(urls: Readonly<Record<string, string>>): TocadorDeLaco {
  const tocando = new Map<string, { readonly audio: HTMLAudioElement; tentativa: number }>();
  function tentar(item: { readonly audio: HTMLAudioElement; tentativa: number }): void {
    item.tentativa = window.performance.now();
    item.audio.play().catch(() => undefined);
  }
  return {
    tocar(id, volume) {
      const url = urls[id];
      if (url === undefined) return;
      let item = tocando.get(id);
      if (item === undefined) {
        const audio = new Audio(url);
        audio.loop = true;
        item = { audio, tentativa: 0 };
        tocando.set(id, item);
        tentar(item);
      } else if (item.audio.paused && window.performance.now() - item.tentativa > 1000) {
        tentar(item);
      }
      item.audio.volume = Math.min(1, Math.max(0, volume));
    },
    parar(id) {
      const item = tocando.get(id);
      if (item === undefined) return;
      item.audio.pause();
      tocando.delete(id);
    },
  };
}
