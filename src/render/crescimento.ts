/**
 * F-REPL-e — o estado de crescimento de um tile de vegetacao replantado.
 *
 * A sim so guarda QUANDO o tile foi plantado (`RecursoNoTile.semeadoEm`) e deriva
 * "maduro" dele (`tileMaduro`, `sim/recursos.ts`). O render faz o mesmo: a fracao
 * do tempo de crescer escolhe o quadro, sem estado novo e sem contador. A adulta
 * comeca no mesmo tick em que a sim diz maduro — `tests/F-REPL-e-arvore.test.ts`
 * afirma a equivalencia tick a tick.
 *
 * Nenhum tipo esta digitado: vale para todo recurso com `semeadoEm`. A rocha nunca
 * tem relogio; o milho e a uva nao sao vegetacao e nao passam por aqui.
 */
import type { RecursoNoTile } from '../sim/state';

/** Os estados antes da adulta, na ordem (docs/BRIEF-ARTE.md, entrada `arvore`). Sao
 *  tambem os nomes do estado no manifesto: `vegetacao/<id>/<estado>`. */
export const ESTADOS_DE_CRESCIMENTO = ['muda', 'crescendo_1', 'crescendo_2'] as const;
export type EstadoDeCrescimento = (typeof ESTADOS_DE_CRESCIMENTO)[number];

/** `null` e "nao esta crescendo": toco, tile sem relogio ou ja maduro. */
export function estadoDeCrescimento(
  recurso: RecursoNoTile | undefined, tick: number, ticksDeCrescer: number,
): EstadoDeCrescimento | null {
  if (recurso === undefined || recurso.quantidade <= 0 || recurso.semeadoEm === undefined) return null;
  const passado = tick - recurso.semeadoEm;
  if (ticksDeCrescer <= 0 || passado >= ticksDeCrescer) return null;
  const n = ESTADOS_DE_CRESCIMENTO.length;
  const i = Math.floor((n * Math.max(0, passado)) / ticksDeCrescer);
  return ESTADOS_DE_CRESCIMENTO[Math.min(i, n - 1)] ?? null;
}

/** O placeholder do estado sem PNG: a adulta do tile encolhida a `(i+1)/(n+1)`, pe
 *  no chao. Numero de TELA, derivado da contagem de estados: a muda sai com 1/4 e
 *  cabe na metade de baixo do tile, como o brief pede. */
export function escalaDoPlaceholder(estado: EstadoDeCrescimento): number {
  return (ESTADOS_DE_CRESCIMENTO.indexOf(estado) + 1) / (ESTADOS_DE_CRESCIMENTO.length + 1);
}

/** Os estados do manifesto que sao ESPECIE da adulta: tudo menos o crescimento. Sem
 *  este filtro, o PNG da muda entraria no sorteio da especie e apareceria como
 *  arvore adulta. */
export function especiesDaVegetacao(estados: readonly string[]): string[] {
  const crescimento: readonly string[] = ESTADOS_DE_CRESCIMENTO;
  return estados.filter((estado) => !crescimento.includes(estado));
}
