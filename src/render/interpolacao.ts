/**
 * Interpolacao de render ENTRE ticks (F11a). Aritmetica pura, sem nenhum `import`: a posicao
 * de cada tick continua sendo `posicaoDaUnidade` (`sim/selectors.ts`, a fracao DENTRO do tick
 * pelo `progresso`), e o que este arquivo acrescenta por cima e a fracao ENTRE ticks — o
 * `alfa` do laco (`src/laco.ts`). O render mostra sempre entre o tick anterior e o atual, ou
 * seja, um tick atras da simulacao: e o preco de um movimento continuo a 10 Hz.
 *
 * Nada aqui e estado de jogo. `criarMemoriaDePosicoes` guarda a posicao do tick anterior de
 * cada unidade e e memoria de RENDER, do mesmo tipo do `Map` de containers de `unidades.ts`:
 * some com a pagina e nunca entra no `GameState`.
 */

export interface PontoEmTiles {
  readonly gx: number;
  readonly gy: number;
}

/**
 * `anterior` -> `atual` por `alfa` (fixado em [0, 1]). Se a distancia entre os dois passa de
 * `saltoMaximo` tiles (medida em 2D), nao interpola: assenta em `atual`. Uma unidade que
 * reaparece longe do que se viu, ou um passo de varios ticks, nao deve deslizar pelo mapa.
 */
export function interpolarPosicao(
  anterior: PontoEmTiles,
  atual: PontoEmTiles,
  alfa: number,
  saltoMaximo: number,
): PontoEmTiles {
  if (Math.hypot(atual.gx - anterior.gx, atual.gy - anterior.gy) > saltoMaximo) return atual;
  // NaN vira 1: um relogio quebrado mostra o tick atual em vez de expulsar a unidade do mapa
  const t = Number.isNaN(alfa) ? 1 : Math.min(1, Math.max(0, alfa));
  return {
    gx: anterior.gx + (atual.gx - anterior.gx) * t,
    gy: anterior.gy + (atual.gy - anterior.gy) * t,
  };
}

export interface MemoriaDePosicoes {
  /**
   * Registra a posicao de `id` no `tick` e devolve a posicao do tick ANTERIOR que se viu. No
   * mesmo tick devolve sempre o mesmo anterior (quadros diferentes nao andam a memoria). Sem
   * registro, ou com o tick voltando para tras (estado carregado), devolve a propria posicao.
   */
  observar(id: string, tick: number, posicao: PontoEmTiles): PontoEmTiles;
  esquecer(id: string): void;
}

interface Registro {
  tick: number;
  anterior: PontoEmTiles;
  atual: PontoEmTiles;
}

export function criarMemoriaDePosicoes(): MemoriaDePosicoes {
  const registros = new Map<string, Registro>();
  return {
    observar(id, tick, posicao) {
      const r = registros.get(id);
      if (r === undefined || tick < r.tick) {
        registros.set(id, { tick, anterior: posicao, atual: posicao });
        return posicao;
      }
      if (tick > r.tick) {
        r.anterior = r.atual;
        r.atual = posicao;
        r.tick = tick;
      }
      return r.anterior;
    },
    esquecer(id) {
      registros.delete(id);
    },
  };
}
