/**
 * BUG-CIVIL-RECUA-NO-DESENHO — decisao do operador (2026-10-04): "o serf precisa esperar ou ficar
 * parado se houver fila nas ruas". O civil que o tile da frente segura no ultimo instante PARA ONDE
 * ESTA; antes o desenho voltava ate a borda do tile (`posicaoDaUnidade` limita o segurado a meio
 * passo), e era o "indo pra frente e pra tras".
 *
 * A regra: dentro do MESMO passo (o tile da unidade e o proximo do caminho), a fracao desenhada nunca
 * cai. Trocou o passo, a memoria recomeca com a fracao nova. Aritmetica pura, sem `import` de Phaser;
 * a memoria e de RENDER, como a da interpolacao (`interpolacao.ts`): some com a pagina e nunca entra
 * no `GameState`. A sim ja espera; so o desenho muda.
 */

export interface PontoEmTiles {
  readonly gx: number;
  readonly gy: number;
}

/** O que a regra le de uma unidade: o tile dela e o proximo do caminho. */
export interface PassoDaUnidade {
  readonly gx: number;
  readonly gy: number;
  readonly proximo: PontoEmTiles | undefined;
}

export interface MemoriaDaEspera {
  /** A posicao a desenhar: `posicao`, ou a guardada se `posicao` recua dentro do mesmo passo. */
  semRecuo(id: string, passo: PassoDaUnidade, posicao: PontoEmTiles): PontoEmTiles;
  esquecer(id: string): void;
}

interface Registro {
  readonly chave: string;
  readonly fracao: number;
  readonly posicao: PontoEmTiles;
}

/** A fracao da `posicao` ao longo do passo de `passo` (0 no tile, 1 no proximo). */
export function fracaoNoPasso(passo: PassoDaUnidade, posicao: PontoEmTiles): number {
  const p = passo.proximo;
  if (p === undefined) return 0;
  const dx = p.gx - passo.gx;
  const dy = p.gy - passo.gy;
  const d2 = dx * dx + dy * dy;
  return d2 === 0 ? 0 : ((posicao.gx - passo.gx) * dx + (posicao.gy - passo.gy) * dy) / d2;
}

export function criarMemoriaDaEspera(): MemoriaDaEspera {
  const registros = new Map<string, Registro>();
  return {
    semRecuo(id, passo, posicao) {
      if (passo.proximo === undefined) {
        registros.delete(id);
        return posicao;
      }
      const chave = `${passo.gx},${passo.gy}>${passo.proximo.gx},${passo.proximo.gy}`;
      const fracao = fracaoNoPasso(passo, posicao);
      const r = registros.get(id);
      if (r !== undefined && r.chave === chave && fracao < r.fracao) return r.posicao;
      registros.set(id, { chave, fracao, posicao });
      return posicao;
    },
    esquecer(id) {
      registros.delete(id);
    },
  };
}
