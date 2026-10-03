/**
 * Referencia compartilhada entre `iniciarJogo()` e a `WorldScene`. Existe
 * porque `new Phaser.Game()` volta na hora, mas `Scene.create()` roda depois,
 * de forma assincrona — a cena nao pode receber o estado por parametro de
 * metodo antes de existir. `main.ts` chama `atualizar(state)` antes do
 * primeiro frame, e a cena le `ponte.atual` quando o `create()` roda: ja
 * povoado.
 *
 * Campo mutavel simples, nao `EventEmitter`: o estado e imutavel e trocado
 * inteiro a cada chamada, entao quem le so precisa da referencia mais
 * recente. Render so LE daqui; escrever em `GameState` continua proibido
 * (CLAUDE.md §3).
 */
import type { GameState } from '../sim/state';

export interface PonteDeEstado {
  atual: GameState | null;
  readonly identidadePartida?: number;
  reiniciar?(): void;
}

export function criarPonte(): PonteDeEstado {
  let atual: GameState | null = null, identidade = 0;
  return {
    get atual() { return atual; },
    set atual(novo: GameState | null) {
      atual = novo;
    },
    get identidadePartida() { return identidade; },
    reiniciar() { identidade++; },
  };
}
