/**
 * F18a — os passos de zoom. Aritmetica pura, ZERO imports, como `grid.ts` e os
 * outros puros de `render/` (guarda estrutural em `tests/F04-grid-ortogonal.test.ts`).
 * A lista de niveis chega por parametro, vinda de `data/terrain.json` pelo funil
 * `render/mapa.ts`: este arquivo nao le dado nenhum.
 *
 * Zoom NAO e regra de jogo. Nada aqui entra em `GameState`, nada vira comando, e
 * `src/sim/` nao sabe que zoom existe.
 */

/**
 * O proximo nivel na direcao pedida (`+1` aproxima, `-1` afasta), preso nas
 * pontas: na ponta a roda do mouse nao faz nada, em vez de sair da lista.
 *
 * `atual` fora da lista cai no mais PROXIMO antes de andar. Nao e caso teorico:
 * um nivel salvo de uma lista antiga, ou um `setZoom` vindo de outro caminho,
 * travariam a roda para sempre se a busca fosse por igualdade exata.
 */
export function proximoNivel(
  niveis: readonly number[], atual: number, direcao: number,
): number {
  const primeiro = niveis[0];
  if (primeiro === undefined) {
    throw new Error('zoom: a lista de niveis nao pode ser vazia.');
  }
  let iMaisProximo = 0;
  let distanciaMinima = Math.abs(primeiro - atual);
  for (let i = 1; i < niveis.length; i++) {
    const distancia = Math.abs((niveis[i] as number) - atual);
    if (distancia < distanciaMinima) {
      iMaisProximo = i;
      distanciaMinima = distancia;
    }
  }
  const alvo = iMaisProximo + (direcao > 0 ? 1 : -1);
  if (alvo < 0 || alvo >= niveis.length) return niveis[iMaisProximo] as number;
  return niveis[alvo] as number;
}
