// D-PRODUCAO-03b (plano em docs/planos/2026-09-29-D-PRODUCAO-03b-painel-encomenda.md) — a
// encomenda da oficina na tela. Puro: o painel desenha os botoes, e o que eles mandam e o
// que o aviso escreve se decide aqui, onde o teste headless alcanca sem DOM.
import type { Command } from '../sim/commands';
import type { PainelDoPredio } from '../sim/selectors';
import type { GameState } from '../sim/state';
import { LADO_DO_JOGADOR } from '../sim/state';

/**
 * O `SetProductionQuota` do botao −/+ de uma saida. O comando SUBSTITUI a encomenda inteira
 * (03a), entao vai o mapa todo com so a saida mexida, grampeada em `0..maxima`. `null` quando
 * nada mudaria: − no zero, + no teto. Manda o VALOR, nunca "some 1 ao que estiver la": com a
 * tela um tick atrasada, o jogador ve e pede o numero que esta vendo.
 */
export function comandoDeEncomenda(
  predio: string, encomenda: NonNullable<PainelDoPredio['encomenda']>, mercadoria: string, delta: number,
): Command | null {
  const atual = encomenda.saidas.find((s) => s.mercadoria === mercadoria);
  if (atual === undefined) return null;
  const nova = Math.min(encomenda.maxima, Math.max(0, atual.falta + delta));
  if (nova === atual.falta) return null;
  const cota: Record<string, number> = {};
  for (const s of encomenda.saidas) cota[s.mercadoria] = s.mercadoria === mercadoria ? nova : s.falta;
  return { type: 'SetProductionQuota', predio, cota };
}

/** F24c (decisao do operador, 2026-09-29) — o salto do −/+ com Shift. O clique solto anda 1. */
export const PASSO_COM_SHIFT = 10;

/** O tanto que o −/+ anda: 1, ou `PASSO_COM_SHIFT` com Shift apertado. O sinal e do botao. */
export function passoDaEncomenda(comShift: boolean): number {
  return comShift ? PASSO_COM_SHIFT : 1;
}

/** Tudo em zero e nenhum ciclo em andamento: a oficina esta parada por escolha do jogador. */
export function semEncomenda(encomenda: NonNullable<PainelDoPredio['encomenda']>): boolean {
  return encomenda.emCurso === null && encomenda.saidas.every((s) => s.falta === 0);
}

/**
 * O texto do aviso quando uma encomenda do JOGADOR se cumpriu neste tick
 * (`production-order-completed`, 03a), ou `null`. A oficina da IA tambem cumpre encomenda, e
 * o jogador nao tem de saber.
 */
export function textoDaEncomendaCumprida(
  estado: GameState, rotulo: string, nomeDoTipo: (tipo: string) => string,
): string | null {
  for (const e of estado.events) {
    if (e.type !== 'production-order-completed') continue;
    const predio = estado.predios.porId[e.predio];
    if (predio === undefined || predio.lado !== LADO_DO_JOGADOR) continue;
    return rotulo.replace('{predio}', nomeDoTipo(predio.tipo));
  }
  return null;
}
