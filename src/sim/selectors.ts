import type { GameState } from './state';

/**
 * Agregados puros sobre o `GameState`. Vivem aqui, e nao em `ui/`, porque
 * `ui/` so pode ler estado e emitir comando — nao varrer prédios por conta
 * propria (CLAUDE.md secao 3). Se o HUD precisar de outro agregado, ele
 * nasce ao lado, neste mesmo arquivo.
 */

/** Soma as duas gavetas (`entrada` + `saida`) de todo predio. E o numero que
 *  o jogador ve na barra de recursos — o jogo internamente sabe a diferenca
 *  entre as duas, o jogador nao precisa saber. */
export function estoqueTotal(state: GameState): Readonly<Record<string, number>> {
  const total: Record<string, number> = {};
  for (const id of state.predios.ordem) {
    const predio = state.predios.porId[id];
    if (!predio) continue;
    for (const gaveta of [predio.estoque.entrada, predio.estoque.saida]) {
      for (const [mercadoria, quantidade] of Object.entries(gaveta)) {
        total[mercadoria] = (total[mercadoria] ?? 0) + quantidade;
      }
    }
  }
  return total;
}

/** Quantas unidades existem de cada tipo (`serf`, `laborer`, ...). */
export function contagemPorTipo(state: GameState): Readonly<Record<string, number>> {
  const contagem: Record<string, number> = {};
  for (const id of state.unidades.ordem) {
    const unidade = state.unidades.porId[id];
    if (!unidade) continue;
    contagem[unidade.tipo] = (contagem[unidade.tipo] ?? 0) + 1;
  }
  return contagem;
}

/** Visao simples e serializavel do estado, para `npm run sim` imprimir e
 *  para qualquer teste que precise do "resumo" em vez do estado bruto. */
export interface ResumoDoEstado {
  readonly tick: number;
  readonly predios: ReadonlyArray<{
    readonly id: string;
    readonly tipo: string;
    readonly gx: number;
    readonly gy: number;
    readonly estado: string;
    readonly hp: number;
  }>;
  readonly estoqueTotal: Readonly<Record<string, number>>;
  readonly unidadesPorTipo: Readonly<Record<string, number>>;
}

export function resumoDoEstado(state: GameState): ResumoDoEstado {
  const predios = state.predios.ordem
    .map((id) => state.predios.porId[id])
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => ({
      id: p.id, tipo: p.tipo, gx: p.gx, gy: p.gy, estado: p.estado, hp: p.hp,
    }));
  return {
    tick: state.tick,
    predios,
    estoqueTotal: estoqueTotal(state),
    unidadesPorTipo: contagemPorTipo(state),
  };
}
