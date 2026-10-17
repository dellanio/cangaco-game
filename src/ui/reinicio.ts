// I-TELA-PARTIDA-NAS-OPCOES — o Reiniciar fase (pedido do operador, 2026-10-17): a pagina que recomeca a MESMA partida
// do zero, e a confirmacao em dois cliques. Puro: o teste prova por tabela; quem navega e o laco externo (`main.ts`).
import type { GameState } from '../sim/state';

/** A busca da pagina que recomeca a partida: a fase da campanha, a escaramuca ou o jogo livre. */
export function buscaDoReinicio(estado: Pick<GameState, 'fase' | 'pazAteTick'>): string {
  if (estado.fase !== undefined) return `?campanha=${estado.fase.id}`;
  return estado.pazAteTick === undefined ? '?livre' : '?escaramuca';
}

/** O clique no Reiniciar: o primeiro arma (o botao pede a confirmacao), o segundo dispara e desarma. */
export function cliqueNoReinicio(armado: boolean): { readonly armado: boolean; readonly disparar: boolean } {
  return armado ? { armado: false, disparar: true } : { armado: true, disparar: false };
}
