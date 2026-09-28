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

/** A muda do placeholder, em fracao da adulta. Decisao do operador (2026-09-28): a
 *  1/4 ela media 19 px num tile de 64 e nao lia como arvore, e a sim bloqueia a
 *  passagem desde o plantio — o jogador precisa ver o que bloqueia. Numero de TELA,
 *  nao de balanceamento: nada da sim depende dele. A arte final da muda precisa de
 *  silhueta propria, nao da adulta encolhida (PROGRESS, 2026-09-28, sessao autonoma). */
export const ESCALA_DA_MUDA = 0.4;

/** O placeholder do estado sem PNG: a adulta do tile encolhida, pe no chao, de
 *  `ESCALA_DA_MUDA` na muda ate a adulta, em passos iguais pela contagem de estados
 *  (0,4 → 0,6 → 0,8 → adulta 1). */
export function escalaDoPlaceholder(estado: EstadoDeCrescimento): number {
  const n = ESTADOS_DE_CRESCIMENTO.length;
  return ESCALA_DA_MUDA + ((1 - ESCALA_DA_MUDA) * ESTADOS_DE_CRESCIMENTO.indexOf(estado)) / n;
}

/** Os estados do manifesto que sao ESPECIE da adulta: tudo menos o crescimento. Sem
 *  este filtro, o PNG da muda entraria no sorteio da especie e apareceria como
 *  arvore adulta. */
export function especiesDaVegetacao(estados: readonly string[]): string[] {
  const crescimento: readonly string[] = ESTADOS_DE_CRESCIMENTO;
  return estados.filter((estado) => !crescimento.includes(estado));
}
