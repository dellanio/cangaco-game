// Entrada do Vite. Ate a F04, isto era `export {}` — o render nao existia.
// Casca minima: prova que o Phaser monta no elemento certo, sem cena real
// ainda (a WorldScene chega na Task 3 desta mesma feature, via game.ts).
import Phaser from 'phaser';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'jogo',
  width: 800,
  height: 600,
  backgroundColor: '#0a0a0a',
  scene: [],
});
