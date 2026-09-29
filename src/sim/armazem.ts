/**
 * D-TRANSPORTE-01a — o ARMAZEM que aceita ou bloqueia cada mercadoria
 * (`KM_HouseStore.pas: NotAcceptFlag`; plano em
 * docs/planos/2026-09-29-D-TRANSPORTE-01-armazem-liga-desliga.md). A regra num lugar so,
 * no molde de `reparo.ts`: o comando, o gerador dos niveis 6 e 7 e o saneamento perguntam
 * AQUI.
 *
 * Bloquear e "nao receber a sobra da vila", nao "esvaziar": tirar do armazem continua
 * valendo, e os caminhos de erro (a devolucao do serf, o reembolso da demolicao, a carga
 * de quem morre de fome) entregam mesmo assim — bloquear ali criaria espera sem fim.
 */
import type { GameState, Predio, PredioCompleto } from './state';
import { ID_DO_ARMAZEM } from './state';
import type { GameData } from './data/types';

export type MotivoDeRecusaDeAceite = 'predio-inexistente' | 'nao-e-armazem' | 'mercadoria-desconhecida';

/** `SetStorehouseAccept` so vale em armazem COMPLETO e com mercadoria do dado. */
export function motivoDaRecusaDeAceite(
  predio: Predio | undefined, mercadoria: string, dados: GameData,
): MotivoDeRecusaDeAceite | null {
  if (predio === undefined) return 'predio-inexistente';
  if (predio.estado !== 'completo' || predio.tipo !== ID_DO_ARMAZEM) return 'nao-e-armazem';
  if (!dados.economia.mercadorias.includes(mercadoria)) return 'mercadoria-desconhecida';
  return null;
}

/** O armazem recebe `mercadoria` da sobra da vila? AUSENTE aceita tudo. */
export function armazemAceita(armazem: PredioCompleto, mercadoria: string): boolean {
  return armazem.naoAceita === undefined || !armazem.naoAceita.includes(mercadoria);
}

/** O predio com `naoAceita` = `lista`, ordenada e sem repeticao; vazia apaga o campo, para
 *  o estado continuar comparavel byte a byte com o de quem nunca bloqueou. */
export function comNaoAceita(predio: PredioCompleto, lista: readonly string[]): PredioCompleto {
  const { naoAceita: _antiga, ...resto } = predio;
  const nova = [...new Set(lista)].sort();
  return nova.length === 0 ? resto : { ...resto, naoAceita: nova };
}

/**
 * O armazem que acaba de completar a obra herda o `naoAceita` do PRIMEIRO armazem completo
 * do mesmo lado, em `predios.ordem` (`TKMHouseStore.Activate`). Sem outro armazem, ou com
 * o primeiro aceitando tudo, devolve o predio intacto.
 */
export function herdarNaoAceita(state: GameState, novo: PredioCompleto): PredioCompleto {
  if (novo.tipo !== ID_DO_ARMAZEM) return novo;
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p === undefined || p.id === novo.id || p.lado !== novo.lado) continue;
    if (p.estado !== 'completo' || p.tipo !== ID_DO_ARMAZEM) continue;
    return p.naoAceita === undefined ? novo : comNaoAceita(novo, p.naoAceita);
  }
  return novo;
}
