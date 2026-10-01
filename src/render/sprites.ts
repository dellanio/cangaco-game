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
import { chaveDoIcone, entradasDosIcones } from './icone-da-mercadoria';
import type { IconesDeMercadoria } from './icone-da-mercadoria';

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
  prediosSemArte: ReadonlySet<string> = new Set(),
): TexturaParaCarregar[] {
  const fila: TexturaParaCarregar[] = [];
  for (const entrada of manifesto.assets) {
    if (entrada.tipo === 'predio' && prediosSemArte.has(entrada.id)) continue;
    for (const [estado, rel] of Object.entries(entrada.estados)) {
      const url = urls[rel];
      if (!url) continue;
      fila.push({ chave: chaveDeTextura(entrada.tipo, entrada.id, estado), url });
    }
  }
  return fila;
}

/**
 * `?semArte=<id>[,<id>]` na URL: os predios cuja arte o loader NAO traz, e que por
 * isso caem no placeholder do §9 — o retangulo e os seis estagios da obra. Existe
 * para o roteiro (F17e, F17f) exercitar o fallback sem depender de qual predio o
 * manifesto deixou sem arte: a arte nova deu PNG aos 28, e os dois roteiros
 * quebraram duas vezes por isso. Como o `?pausado`, nao e superficie de jogador.
 */
export function prediosSemArteDaBusca(busca: string): ReadonlySet<string> {
  const valor = new URLSearchParams(busca).get('semArte') ?? '';
  return new Set(valor.split(',').map((id) => id.trim()).filter((id) => id !== ''));
}

/** D-ARTE-01 — os icones de mercadoria do mesmo manifesto (`icones.mercadorias`). */
export const iconesDoJogo: IconesDeMercadoria | undefined =
  (manifestoJson as unknown as { icones?: { mercadorias?: IconesDeMercadoria } }).icones?.mercadorias;

/** D-TELA-03a — os icones que o `preload()` enfileira, na chave `icone:<mercadoria>:mercadoria`.
 *  Como em `texturasParaCarregar`, so o que o bundler resolveu: o resto fica no texto ou no
 *  quadrado, que e o comportamento normal (§9). */
export function texturasDosIcones(
  icones: IconesDeMercadoria | undefined = iconesDoJogo,
  urls: Readonly<Record<string, string>> = urlsDeSprites,
): TexturaParaCarregar[] {
  return entradasDosIcones(icones).flatMap(([id, icone]) => {
    const url = urls[icone.arquivo];
    return url ? [{ chave: chaveDoIcone(id), url }] : [];
  });
}
