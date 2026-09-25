// Os icones da interface, resolvidos a partir do manifesto (CLAUDE.md §9).
//
// ZERO imports, como `render/manifesto.ts`: o trecho `icones` do manifesto e
// o mapa de URLs que o bundler resolveu chegam por parametro (quem os junta e
// `main.ts`, a raiz de composicao). Assim `ui/` continua sem falar com o
// bundler e sem parsear nome de arquivo: quem diz qual PNG e o icone de qual
// predio e o manifesto, nunca uma convencao de caminho.
//
// Icone que nao existe resolve `null`, e o menu desenha a miniatura do
// footprint — placeholder e comportamento normal, nao falha (§9).

export interface IconeDoManifesto {
  /** Caminho relativo a `assets/`, como o manifesto escreve. */
  readonly arquivo: string;
  readonly tamanho: readonly [number, number];
}

export interface IconesDoManifesto {
  /** Por id NEUTRO de predio. */
  readonly predios?: Readonly<Record<string, IconeDoManifesto | undefined>>;
  /** Por campo do HUD (`gold`, `timber`, ...). So documentacao e teste: o CSS
   *  e quem os desenha, por `url()`. */
  readonly hud?: Readonly<Record<string, IconeDoManifesto | undefined>>;
}

export type ResolvedorDeIcone = (predio: string) => string | null;

/** A URL servida do icone de um predio, ou `null`. `urls` e o mapa
 *  `caminho-do-manifesto -> URL` que o bundler resolveu (`render/sprites-urls.ts`):
 *  icone declarado que o bundler nao resolveu tambem e `null`, e nunca um 404. */
export function urlDoIconeDePredio(
  icones: IconesDoManifesto | undefined, urls: Readonly<Record<string, string>>, predio: string,
): string | null {
  const entrada = icones?.predios?.[predio];
  if (entrada === undefined) return null;
  return urls[entrada.arquivo] ?? null;
}

export function resolvedorDeIcones(
  icones: IconesDoManifesto | undefined, urls: Readonly<Record<string, string>>,
): ResolvedorDeIcone {
  return (predio) => urlDoIconeDePredio(icones, urls, predio);
}
