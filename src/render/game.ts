// Config do Phaser.Game. Unico lugar que monta a engine — main.ts so chama
// iniciarJogo(). Nao decide nada de jogo (§10): so tamanho de tela e a lista
// de cenas.
import Phaser from 'phaser';
import type { GameState } from '../sim/state';
import { WorldScene } from './scenes/WorldScene';
import { criarPonte } from './ponte';
import type { Ferramenta } from '../input/ferramenta';
import type { EntradaDoMapa } from '../input/colocar';

export interface JogoLigado {
  readonly jogo: Phaser.Game;
  /** Entrega o estado mais recente para a cena desenhar. Nao guarda
   *  referencia aqui: so escreve na ponte (render/ponte.ts). */
  atualizar(estado: GameState): void;
}

export function iniciarJogo(
  ferramenta: Ferramenta, entrada: EntradaDoMapa,
  /** PONTE DE HARNESS DA F10: so repassada a cena, que a publica em `window.__cangaco`. */
  avancar: (passos: number) => void,
): JogoLigado {
  const ponte = criarPonte();
  const cena = new WorldScene(ponte, ferramenta, entrada, avancar);
  const jogo = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'jogo',
    backgroundColor: '#0a0a0a',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    scene: [cena],
  });
  return {
    jogo,
    atualizar(estado) {
      ponte.atual = estado;
    },
  };
}
