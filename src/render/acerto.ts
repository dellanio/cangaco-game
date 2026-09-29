/**
 * F26b — o teste de ACERTO da unidade: que unidade esta desenhada sob o ponto, e quais
 * cabem numa caixa. Sem Phaser, puro, testado em Node.
 *
 * A nota herdada da F18f manda: o clique usa a MESMA posicao do desenho — o centro do
 * tile interpolado MAIS `deslocamentoDaUnidade`. Mirar o centro do tile erraria por ate
 * o raio do anel (16 px a 64 por tile), e erraria mais no tile cheio, que e onde
 * selecionar importa. Por isso a entrada e a lista que a camada DESENHOU
 * (`UnidadeRenderizada`: `gxDesenhado`/`gyDesenhado` e `deslocamentoPx`), e nao o estado.
 */
import { ESCALA_DO_MUNDO, gridToScreen, gridToScreenCentro, LADO_DA_UNIDADE_EM_TILES } from './grid';

/** O minimo do que a camada de unidades desenhou que o acerto precisa. */
export interface UnidadeDesenhada {
  readonly id: string;
  readonly gxDesenhado: number;
  readonly gyDesenhado: number;
  readonly deslocamentoPx: { readonly x: number; readonly y: number };
  /** C-TELA-04 — o corpo desenhado (a imagem do sprite), relativo ao centro desenhado; sem
   *  ele (placeholder, ou teste), vale so o quadrado. */
  readonly corpoPx?: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number } | null;
}

export interface Ponto {
  readonly x: number;
  readonly y: number;
}

/** O centro DESENHADO da unidade, em px de mundo. */
export function centroDesenhado(u: UnidadeDesenhada, tilePx: number): Ponto {
  const c = gridToScreenCentro({ gx: u.gxDesenhado, gy: u.gyDesenhado }, tilePx, ESCALA_DO_MUNDO);
  return { x: c.x + u.deslocamentoPx.x, y: c.y + u.deslocamentoPx.y };
}

/**
 * As unidades cujo quadrado desenhado (lado `tilePx x LADO_DA_UNIDADE_EM_TILES`) ou cujo
 * corpo desenhado (C-TELA-04) contem o ponto. Primeiro as do quadrado, da MAIS PERTO do
 * centro para a mais longe; depois as so do corpo, da mais a frente para tras. Duas no mesmo tile se sobrepoem
 * em parte; quem o jogador mirou e a de centro mais perto do clique. No empate, a
 * desenhada mais a frente (maior y), depois a ordem da lista.
 */
export function unidadesNoPonto(desenhadas: readonly UnidadeDesenhada[], ponto: Ponto, tilePx: number): string[] {
  const meio = (tilePx * LADO_DA_UNIDADE_EM_TILES) / 2;
  const noQuadrado = (c: Ponto): boolean => Math.abs(ponto.x - c.x) <= meio && Math.abs(ponto.y - c.y) <= meio;
  // C-TELA-04: o sprite tem o PE no centro e o corpo acima dele (64x96 a 64 por tile); o
  // quadrado cobre so o pe, e o jogador mira o corpo. Quem o quadrado acerta vem antes: e
  // a mira precisa, e o que separa duas unidades no mesmo tile (F18f).
  const noCorpo = (u: UnidadeDesenhada, c: Ponto): boolean => {
    const k = u.corpoPx;
    return k !== null && k !== undefined && ponto.x >= c.x + k.x0 && ponto.x <= c.x + k.x1 && ponto.y >= c.y + k.y0 && ponto.y <= c.y + k.y1;
  };
  return desenhadas
    .map((u, i) => ({ u, i, c: centroDesenhado(u, tilePx) }))
    .map((d) => ({ ...d, q: noQuadrado(d.c) }))
    .filter((d) => d.q || noCorpo(d.u, d.c))
    .sort((a, b) => {
      if (a.q !== b.q) return a.q ? -1 : 1;
      // so pelo corpo: vence a desenhada na frente, que e a que cobre a outra na tela
      if (!a.q && a.c.y !== b.c.y) return b.c.y - a.c.y;
      const da = Math.hypot(ponto.x - a.c.x, ponto.y - a.c.y);
      const db = Math.hypot(ponto.x - b.c.x, ponto.y - b.c.y);
      if (da !== db) return da - db;
      if (a.c.y !== b.c.y) return b.c.y - a.c.y;
      return a.i - b.i;
    })
    .map(({ u }) => u.id);
}

/**
 * As unidades cujo TILE desenhado (o tile interpolado, sem o desvio do anel) toca a caixa
 * de cantos `a` e `b` (qualquer ordem), na ordem da lista.
 *
 * C-TELA-03: a mao comeca a caixa EM CIMA do soldado da ponta. Exigir o centro deixava de
 * fora a fileira dele (15 de 18, medido), e o quadrado do clique ainda deixava: o desvio da
 * F18f poe dois vizinhos da mesma fileira ate meio tile fora de alinhamento. O anel nunca
 * tira o desenho do tile, entao o tile e o menor alvo em que "comecar em qualquer soldado
 * do canto e terminar em qualquer soldado do canto oposto" pega o bloco inteiro.
 */
export function unidadesNaCaixa(
  desenhadas: readonly UnidadeDesenhada[], a: Ponto, b: Ponto, tilePx: number,
): string[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  return desenhadas.filter((u) => {
    const canto = gridToScreen({ gx: u.gxDesenhado, gy: u.gyDesenhado }, tilePx, ESCALA_DO_MUNDO);
    const lado = tilePx * ESCALA_DO_MUNDO;
    return canto.x + lado >= x0 && canto.x <= x1 && canto.y + lado >= y0 && canto.y <= y1;
  }).map((u) => u.id);
}
