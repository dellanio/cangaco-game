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

/** A muda do placeholder, em fracao da adulta. Numero de TELA (decisao do operador,
 *  2026-09-28): a 1/4 ela media 19 px num tile de 64 e nao se lia como arvore, e a sim
 *  bloqueia passagem desde o plantio. A arte final precisa de silhueta propria. */
export const ESCALA_DA_MUDA = 0.4;

/** O placeholder do estado sem PNG: a adulta do tile encolhida numa rampa linear que
 *  comeca em `ESCALA_DA_MUDA` e anda ate a adulta (0,4 / 0,6 / 0,8), pe no chao. */
export function escalaDoPlaceholder(estado: EstadoDeCrescimento): number {
  const i = ESTADOS_DE_CRESCIMENTO.indexOf(estado);
  return ESCALA_DA_MUDA + ((1 - ESCALA_DA_MUDA) * i) / ESTADOS_DE_CRESCIMENTO.length;
}

/** Os estados do manifesto que sao ESPECIE da adulta: tudo menos o crescimento. Sem
 *  este filtro, o PNG da muda entraria no sorteio da especie e apareceria como
 *  arvore adulta. */
export function especiesDaVegetacao(estados: readonly string[]): string[] {
  const crescimento: readonly string[] = ESTADOS_DE_CRESCIMENTO;
  return estados.filter((estado) => !crescimento.includes(estado));
}

/**
 * BUG-W — os estagios de uma CULTURA (milho, uva), na ordem. A cultura nao vira sprite
 * em pe como a arvore: e marcador (ou textura) na tira de recurso, e o estagio muda o
 * desenho da celula. O KaM tem 7 estagios de milho e 4 de uva (`KM_ResMapElements.pas`);
 * aqui sao tres de crescimento e o `pronto`, que comeca no MESMO tick em que a sim diz
 * `tileMaduro` (`tests/BUG-W-estagio-da-cultura.test.ts` afirma tick a tick).
 */
export const ESTAGIOS_DA_CULTURA = ['semeado', 'muda', 'verde', 'pronto'] as const;
export type EstagioDaCultura = (typeof ESTAGIOS_DA_CULTURA)[number];

/** `null` e "sem relogio": esgotado, ou tile que nasceu do mapa (maduro desde sempre). */
export function estagioDaCultura(
  recurso: RecursoNoTile | undefined, tick: number, ticksDeCrescer: number,
): EstagioDaCultura | null {
  if (recurso === undefined || recurso.quantidade <= 0 || recurso.semeadoEm === undefined) return null;
  const passado = tick - recurso.semeadoEm;
  if (passado >= ticksDeCrescer) return 'pronto';
  const n = ESTAGIOS_DA_CULTURA.length - 1;
  const i = Math.floor((n * Math.max(0, passado)) / ticksDeCrescer);
  return ESTAGIOS_DA_CULTURA[Math.min(i, n - 1)] ?? null;
}

/** O placeholder do estagio sem arte (§9): a opacidade do marcador. Numero de TELA, como
 *  `ESCALA_DA_MUDA`: o semeado mal se ve, o pronto e o marcador cheio de sempre. Arte de
 *  estagio e decisao humana. */
export const ALFA_DO_ESTAGIO: Readonly<Record<EstagioDaCultura, number>> = {
  semeado: 0.2, muda: 0.4, verde: 0.6, pronto: 1,
};
