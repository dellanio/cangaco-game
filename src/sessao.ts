/**
 * O "laco externo" (CLAUDE.md §5): dono do `GameState` E da fila de comandos.
 * TypeScript puro, sem DOM nem Phaser — testavel headless.
 *
 * Quem faz o que:
 *  - `input/` PRODUZ comandos e os entrega por um callback (`enviar`);
 *  - a fila mora aqui, dentro da Sessao — nao no `GameState` (que so tem o que a
 *    sim decide), nem em `render/` ou `ui/`, que nunca a tocam;
 *  - `sim/` so RECEBE a lista, como parametro de `step()`.
 *
 * `enviar` so enfileira; quem roda o tempo e `passo()`: drena a fila, roda UM
 * `step` e avisa quem ouve. Assim, quando o relogio de 10 Hz chegar (F11), a
 * mudanca e SO quem chama `passo()` — um timer de `TICK_MS` em vez do clique —
 * e nem a fila nem a Sessao mudam.
 *
 * Provisorio ate la (BUILD_PLAN, notas da F07 e da F11): `main.ts` chama
 * `passo()` logo apos cada `enviar`, entao o `tick` avanca 1 por comando. Nenhum
 * sistema consome tempo antes da F09, entao e inocuo — mas nao dependa desse tick.
 */
import type { Command } from './sim/commands';
import type { GameState } from './sim/state';
import { step } from './sim/tick';

export type OuvinteDaSessao = (estado: GameState) => void;

export interface Sessao {
  readonly estado: GameState;
  /** Enfileira. NAO roda nada. */
  enviar(comando: Command): void;
  /** Drena a fila, roda um `step` e devolve (e publica) o estado novo. Se o
   *  `step` lancar (comando fora da uniao), a fila ja foi drenada e o estado nao
   *  muda: comando invalido e bug, nao algo a reenfileirar. */
  passo(): GameState;
  /** Devolve o desinscrever. */
  aoMudar(ouvinte: OuvinteDaSessao): () => void;
}

export function criarSessao(estadoInicial: GameState): Sessao {
  let estado = estadoInicial;
  const fila: Command[] = [];
  const ouvintes = new Set<OuvinteDaSessao>();

  return {
    get estado() {
      return estado;
    },
    enviar(comando) {
      fila.push(comando);
    },
    passo() {
      const comandos = fila.splice(0, fila.length);
      estado = step(estado, comandos);
      for (const ouvinte of ouvintes) ouvinte(estado);
      return estado;
    },
    aoMudar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
  };
}
