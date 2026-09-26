/**
 * A ponte entre o manifesto (dado) e o loader do Phaser (engine).
 *
 * Aqui, e so aqui, o JSON do manifesto vira `Manifesto` tipado; `manifesto.ts`
 * continua sem import nenhum e recebe tudo por parametro.
 */
import manifestoJson from '../../assets/manifest.json';
import type { Manifesto } from './manifesto';
import { chaveDeTextura } from './manifesto';
import { urlsDeSprites } from './sprites-urls';

/**
 * O `as unknown as` existe porque o TypeScript infere `number[]` para os campos
 * do JSON, e `footprint`/`tamanho`/`anchor` sao tuplas de dois. O formato de
 * verdade e conferido em teste (tests/F17f-manifesto.test.ts), que le o arquivo
 * do disco e checa campo a campo — inclusive contra o cabecalho dos PNGs.
 */
export const manifestoDoJogo = manifestoJson as unknown as Manifesto;

export interface TexturaParaCarregar {
  readonly chave: string;
  readonly url: string;
}

/** O que o `preload()` da cena tem de enfileirar: so o que o manifesto declara
 *  E o bundler resolveu. O resto fica placeholder, que e comportamento normal
 *  (§9) — e nao vira 404.
 *
 *  F-SPR: todo tipo do manifesto (predio, terreno, recurso, vegetacao, unidade),
 *  com a chave `<tipo>:<id>:<estado>` — para predio, a mesma de antes. Manifesto e
 *  URLs por parametro so para o teste provar o lado do arquivo que falta. */
export function texturasParaCarregar(
  manifesto: Manifesto = manifestoDoJogo,
  urls: Readonly<Record<string, string>> = urlsDeSprites,
): TexturaParaCarregar[] {
  const fila: TexturaParaCarregar[] = [];
  for (const entrada of manifesto.assets) {
    for (const [estado, rel] of Object.entries(entrada.estados)) {
      const url = urls[rel];
      if (!url) continue;
      fila.push({ chave: chaveDeTextura(entrada.tipo, entrada.id, estado), url });
    }
  }
  return fila;
}
