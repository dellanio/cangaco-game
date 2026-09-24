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

/**
 * Ancoragem no cursor, em uma dimensao. Camera ortogonal, sem rotacao.
 *
 * Por que a conta mora aqui, pura, e nao em `camera.getWorldPoint` chamado duas
 * vezes: `getWorldPoint` mistura o `zoomX` NOVO com a `matrix` VELHA — a matriz
 * so e reconstruida no `preRender` do quadro seguinte (Phaser 3,
 * `cameras/2d/Camera.js`). Chamado logo depois de `setZoom`, ele devolve um
 * hibrido, e a correcao de scroll sai errada. Medido: o tile sob o cursor
 * pulava de (33,32) para (49,50) ao ir de zoom 1 a 0.5.
 *
 * A formula sai da propria `preRender`, onde a matriz e
 * `T(camera.x + origem) . S(zoom) . T(-origem)`:
 *
 *   mundo = scroll + (pontoNaTela - ancora) / zoom + origem
 *
 * com `ancora = camera.x + camera.width * camera.originX` (o pivo da matriz) e
 * `origem = camera.width * camera.originX`. Em zoom 1 ela se reduz a
 * `scroll + pontoNaTela`, que e o caso que todo roteiro anterior assumia.
 */
export function mundoSobPonto(
  scroll: number, pontoNaTela: number, ancora: number, origem: number, zoom: number,
): number {
  if (!(zoom > 0)) throw new Error(`zoom: nivel precisa ser > 0 (recebeu ${zoom}).`);
  return scroll + (pontoNaTela - ancora) / zoom + origem;
}

/**
 * O scroll que poe `mundo` de volta sob `pontoNaTela` no `zoom` dado. E a
 * inversa exata de `mundoSobPonto`, e e isso que faz o tile sob o cursor nao se
 * mexer quando a roda muda de nivel.
 */
export function scrollAncorado(
  mundo: number, pontoNaTela: number, ancora: number, origem: number, zoom: number,
): number {
  if (!(zoom > 0)) throw new Error(`zoom: nivel precisa ser > 0 (recebeu ${zoom}).`);
  return mundo - origem - (pontoNaTela - ancora) / zoom;
}
