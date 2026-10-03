/**
 * H-TELA-CAMADA-DE-SOM — o tocador de verdade, no navegador. So recebe id com arquivo
 * (`render/som.ts` filtra antes): sem arquivo, este modulo nunca cria um `Audio`, e por isso o
 * som que falta nao gera requisicao nem erro de console.
 *
 * `play()` recusado (a politica de autoplay, antes do primeiro gesto do jogador) e silencio: a
 * promessa e engolida aqui, para nao virar erro de console.
 */
import type { Tocador } from './som';

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
