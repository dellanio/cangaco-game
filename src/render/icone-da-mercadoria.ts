/**
 * D-ARTE-01 — o icone de cada mercadoria (`assets/manifest.json` > `icones.mercadorias`).
 *
 * So aponta arquivo que ja existe: o mesmo PNG do HUD (`timber`, `stone`, `gold`) ou do recurso
 * do mapa (`corn`, `fish`, `coal`, `iron_ore`, `gold_ore`). A chave e o id NEUTRO da mercadoria,
 * nunca o nome do tema (CLAUDE.md §9).
 *
 * Sem import de `phaser`, de `sim/data` nem do tema: o manifesto, a lista de mercadorias e a
 * leitura do cabecalho do PNG chegam por parametro, para o teste exercitar cada regra com um
 * manifesto escrito nele.
 */
import type { OrigemDoAsset } from './manifesto';

export interface IconeDeMercadoria {
  /** Caminho relativo a `assets/`. */
  readonly arquivo: string;
  /** Em px, o que o arquivo tem. */
  readonly tamanho: readonly [number, number];
  readonly licenca: string;
  readonly origem: OrigemDoAsset;
}

/** O trecho `icones.mercadorias`, com o `_doc` que todo bloco do manifesto tem. */
export type IconesDeMercadoria = Readonly<Record<string, IconeDeMercadoria | string | undefined>>;

/** As entradas de verdade: tira as chaves `_` (comentario do dado). */
export function entradasDosIcones(icones: IconesDeMercadoria | undefined): [string, IconeDeMercadoria][] {
  if (icones === undefined) return [];
  return Object.entries(icones)
    .filter((par): par is [string, IconeDeMercadoria] => !par[0].startsWith('_') && typeof par[1] === 'object');
}

/**
 * As regras do bloco. `dimensao` devolve `[largura, altura]` do PNG em `assets/<arquivo>`, ou
 * `null` quando o arquivo nao existe. Lista vazia = valido.
 */
export function errosDosIconesDeMercadoria(
  icones: IconesDeMercadoria | undefined,
  mercadorias: readonly string[],
  dimensao: (arquivo: string) => readonly [number, number] | null,
): string[] {
  const erros: string[] = [];
  const conhecidas = new Set(mercadorias);
  for (const [id, icone] of entradasDosIcones(icones)) {
    if (!conhecidas.has(id)) erros.push(`icones.mercadorias.${id}: nao e mercadoria de economia.mercadorias`);
    const real = dimensao(icone.arquivo);
    if (real === null) {
      erros.push(`icones.mercadorias.${id}: o arquivo ${icone.arquivo} nao existe`);
    } else if (real[0] !== icone.tamanho[0] || real[1] !== icone.tamanho[1]) {
      erros.push(`icones.mercadorias.${id}: tamanho declarado ${JSON.stringify(icone.tamanho)}, o arquivo tem ${JSON.stringify(real)}`);
    }
  }
  return erros;
}
