/**
 * A ponte entre o manifesto (dado) e o loader do Phaser (engine).
 *
 * Aqui, e so aqui, o JSON do manifesto vira `Manifesto` tipado; `manifesto.ts`
 * continua sem import nenhum e recebe tudo por parametro.
 */
import manifestoJson from '../../assets/manifest.json';
import type { Manifesto } from './manifesto';
import { chaveDaTextura } from './manifesto';
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
 *  (§9) — e nao vira 404. */
export function texturasParaCarregar(): TexturaParaCarregar[] {
  const fila: TexturaParaCarregar[] = [];
  for (const entrada of manifestoDoJogo.assets) {
    for (const [estagio, rel] of Object.entries(entrada.estados)) {
      const url = urlsDeSprites[rel];
      if (!url) continue;
      fila.push({ chave: chaveDaTextura(entrada.id, estagio), url });
    }
  }
  return fila;
}
