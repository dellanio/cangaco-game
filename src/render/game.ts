// Config do Phaser.Game. Unico lugar que monta a engine — main.ts so chama
// iniciarJogo(). Nao decide nada de jogo (§10): so tamanho de tela e a lista
// de cenas.
import Phaser from 'phaser';
import type { GameState } from '../sim/state';
import { WorldScene } from './scenes/WorldScene';
import { criarPonte } from './ponte';
import type { Ferramenta } from '../input/ferramenta';
import type { EntradaDoMapa } from '../input/colocar';
import type { RelogioVisivel } from './debug';
import type { Navegacao } from '../input/navegacao';
import type { SelecaoMilitar } from '../input/selecao-militar';

export interface JogoLigado {
  readonly jogo: Phaser.Game;
  /** Entrega o estado mais recente para a cena desenhar. Nao guarda
   *  referencia aqui: so escreve na ponte (render/ponte.ts). */
  atualizar(estado: GameState): void;
  /** F26b — as unidades DESENHADAS sob o ponto de mundo (a mais perto primeiro). E
   *  leitura do desenho, nao decisao: quem decide o que o clique faz e o `main.ts`. */
  unidadesNoPonto(ponto: { readonly x: number; readonly y: number }): string[];
  /** F26b — as unidades desenhadas dentro da caixa. */
  unidadesNaCaixa(a: { readonly x: number; readonly y: number }, b: { readonly x: number; readonly y: number }): string[];
}

export function iniciarJogo(
  ferramenta: Ferramenta, entrada: EntradaDoMapa,
  /** O relogio (F11a): a cena o le para interpolar e o publica em `window.__cangaco`. */
  relogio: RelogioVisivel,
  /** F-D2 — a navegacao por teclado, ligada no `main.ts` como os outros
   *  ouvintes de `input/`. A cena so pergunta. */
  navegacao: Navegacao,
  /** F26b — o grupo militar na mao do jogador, que a cena desenha. */
  selecaoMilitar: SelecaoMilitar,
): JogoLigado {
  const ponte = criarPonte();
  const cena = new WorldScene(ponte, ferramenta, entrada, relogio, navegacao, selecaoMilitar);
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
    unidadesNoPonto(ponto) {
      return cena.unidadesNoPonto(ponto);
    },
    unidadesNaCaixa(a, b) {
      return cena.unidadesNaCaixa(a, b);
    },
  };
}
