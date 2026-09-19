// Config do Phaser.Game. Unico lugar que monta a engine — main.ts so chama
// iniciarJogo(). Nao decide nada de jogo (§10): so tamanho de tela e a lista
// de cenas.
import Phaser from 'phaser';
import { WorldScene } from './scenes/WorldScene';

export function iniciarJogo(): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'jogo',
    backgroundColor: '#0a0a0a',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    scene: [WorldScene],
  });
}
