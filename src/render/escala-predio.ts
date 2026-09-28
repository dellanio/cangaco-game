/**
 * F-ESC — a escala do predio: altura maxima pela largura do LOTE.
 *
 * ZERO imports de runtime, como `manifesto.ts`: o manifesto, a regra e o tile chegam
 * como parametro. A regra e `altura desenhada <= k x largura do lote`, com k padrao
 * em `assets/manifest.json: regraDeAltura.k` e excecao por predio no proprio
 * manifesto (`alturaMaxPorLargura`). O footprint e dado de simulacao e nao muda para
 * caber arte (decisao do operador, 2026-09-27): quem cede e a escala do sprite.
 */

import type { EntradaDeAsset, Manifesto } from './manifesto';

export interface RegraDeAltura {
  /** Teto padrao da altura, em multiplos da largura do lote. */
  readonly k: number;
}

/** Manifesto sem `regraDeAltura`: sem teto, que e o desenho de antes da F-ESC. */
export const SEM_REGRA_DE_ALTURA: RegraDeAltura = { k: Number.POSITIVE_INFINITY };

export function regraDoManifesto(manifesto: Manifesto): RegraDeAltura {
  return manifesto.regraDeAltura ?? SEM_REGRA_DE_ALTURA;
}

/** O teto do predio: a excecao declarada, ou o k da regra. */
export function alturaMaxPorLargura(entrada: EntradaDeAsset, regra: RegraDeAltura): number {
  return entrada.alturaMaxPorLargura ?? regra.k;
}

/** C10 — a regra da LARGURA, simetrica a da altura: `largura desenhada <= k x lote`. */
export interface RegraDeLargura {
  readonly k: number;
}

/** Manifesto sem `regraDeLargura`: sem teto, o desenho de antes da C10. */
export const SEM_REGRA_DE_LARGURA: RegraDeLargura = { k: Number.POSITIVE_INFINITY };

export function regraDeLarguraDoManifesto(manifesto: Manifesto): RegraDeLargura {
  return manifesto.regraDeLargura ?? SEM_REGRA_DE_LARGURA;
}

/** C10 — o teto de largura do predio: a excecao declarada, ou o k da regra. */
export function larguraMaxPorLote(entrada: EntradaDeAsset, regra: RegraDeLargura): number {
  return entrada.larguraMaxPorLote ?? regra.k;
}

/**
 * A escala com que o sprite e desenhado num lote de `larguraDoLotePx`: a largura do
 * footprint na regua do derivado (`tilePx` por tile), limitada pela altura maxima.
 * Sprite dentro da regra sai com a escala de antes; sprite alto demais encolhe
 * inteiro, sem deformar.
 */
export function escalaDoSprite(
  entrada: EntradaDeAsset, regra: RegraDeAltura, tilePx: number, larguraDoLotePx: number,
  regraDeLargura: RegraDeLargura = SEM_REGRA_DE_LARGURA,
): number {
  const pelaLargura = larguraDoLotePx / (entrada.footprint[0] * tilePx);
  const pelaAltura = alturaMaxPorLargura(entrada, regra) * larguraDoLotePx / entrada.tamanho[1];
  // C10: nem mais largo que o teto de largura (o arquivo pode ter mais px que o lote)
  const pelaLarguraMax = larguraMaxPorLote(entrada, regraDeLargura) * larguraDoLotePx / entrada.tamanho[0];
  return Math.min(pelaLargura, pelaAltura, pelaLarguraMax);
}

export interface ViolacaoDaAltura {
  readonly id: string;
  readonly motivo: 'alto-sem-excecao' | 'excecao-morta';
}

/**
 * O manifesto contra a regra, na regua do arquivo (`tamanho[1]` contra
 * `footprint[0] x tilePx`):
 * - `alto-sem-excecao`: passa de k sem declarar excecao — o render o encolheria calado;
 * - `excecao-morta`: declara excecao e cabe em k — a excecao vira folclore.
 */
export function violacoesDaAltura(
  manifesto: Manifesto, regra: RegraDeAltura, tilePx: number,
): ViolacaoDaAltura[] {
  const saida: ViolacaoDaAltura[] = [];
  for (const e of manifesto.assets) {
    if (e.tipo !== 'predio') continue;
    const entrada = e as EntradaDeAsset;
    const razao = entrada.tamanho[1] / (entrada.footprint[0] * tilePx);
    if (entrada.alturaMaxPorLargura === undefined) {
      if (razao > regra.k) saida.push({ id: entrada.id, motivo: 'alto-sem-excecao' });
    } else if (razao <= regra.k) {
      saida.push({ id: entrada.id, motivo: 'excecao-morta' });
    }
  }
  return saida;
}

export interface ViolacaoDaLargura {
  readonly id: string;
  readonly motivo: 'largo-sem-excecao' | 'excecao-morta';
}

/**
 * C10 — o manifesto contra a regra da largura, na regua do arquivo (`tamanho[0]` contra
 * `footprint[0] x tilePx`), no molde de `violacoesDaAltura`:
 * - `largo-sem-excecao`: passa de k sem declarar excecao — o render o encolheria calado;
 * - `excecao-morta`: declara excecao e cabe em k.
 */
export function violacoesDaLargura(
  manifesto: Manifesto, regra: RegraDeLargura, tilePx: number,
): ViolacaoDaLargura[] {
  const saida: ViolacaoDaLargura[] = [];
  for (const e of manifesto.assets) {
    if (e.tipo !== 'predio') continue;
    const entrada = e as EntradaDeAsset;
    const razao = entrada.tamanho[0] / (entrada.footprint[0] * tilePx);
    if (entrada.larguraMaxPorLote === undefined) {
      if (razao > regra.k) saida.push({ id: entrada.id, motivo: 'largo-sem-excecao' });
    } else if (razao <= regra.k) {
      saida.push({ id: entrada.id, motivo: 'excecao-morta' });
    }
  }
  return saida;
}
