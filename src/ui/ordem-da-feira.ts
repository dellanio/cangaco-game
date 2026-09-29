/**
 * C-TELA-05 — o RASCUNHO da ordem da feira: o que o jogador vai montando no painel antes
 * de mandar. Puro e sem DOM; o painel guarda um por feira, fora do redesenho (o painel
 * refaz os nos 10 vezes por segundo). O comando e o `SetTrade` da F35.
 */
import type { Command } from '../sim/commands';

export interface RascunhoDaTroca {
  readonly da: string;
  readonly para: string;
  readonly quantidade: number;
}

/** A ordem em vigor, se houver; senao as duas primeiras mercadorias, uma troca. */
export function rascunhoInicial(
  feira: { readonly da: string | null; readonly para: string | null; readonly quantidade: number },
  mercadorias: readonly string[],
): RascunhoDaTroca {
  if (feira.da !== null && feira.para !== null && feira.quantidade > 0) {
    return { da: feira.da, para: feira.para, quantidade: feira.quantidade };
  }
  return { da: mercadorias[0] ?? '', para: mercadorias[1] ?? '', quantidade: 1 };
}

/** Anda `passo` na lista circular e pula a mercadoria do OUTRO campo: A = B a sim recusa. */
export function girarMercadoria(
  r: RascunhoDaTroca, campo: 'da' | 'para', passo: 1 | -1, mercadorias: readonly string[],
): RascunhoDaTroca {
  const n = mercadorias.length;
  if (n < 2) return r;
  const outro = campo === 'da' ? r.para : r.da;
  let i = mercadorias.indexOf(r[campo]);
  do i = (i + passo + n) % n; while (mercadorias[i] === outro);
  return { ...r, [campo]: mercadorias[i] as string };
}

/** Nunca abaixo de 1: zero e o Cancelar, que tem botao proprio. */
export function mudarQuantidade(r: RascunhoDaTroca, passo: 1 | -1): RascunhoDaTroca {
  return { ...r, quantidade: Math.max(1, r.quantidade + passo) };
}

export function comandoDaTroca(predio: string, r: RascunhoDaTroca): Command {
  return { type: 'SetTrade', predio, da: r.da, para: r.para, quantidade: r.quantidade };
}

/** Quantidade 0 cancela (F35); as mercadorias nao sao olhadas. */
export function comandoDeCancelar(predio: string, r: RascunhoDaTroca): Command {
  return { type: 'SetTrade', predio, da: r.da, para: r.para, quantidade: 0 };
}
