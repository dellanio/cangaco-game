import type { GameState } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { estaDesbloqueado } from './desbloqueio';
import { caixaDeTipo, caixaDoPredio, caixasSeSobrepoem } from './footprint';
import { ehEstrada } from './estradas';

export type MotivoDeRecusa =
  | 'predio-desconhecido'
  | 'bloqueado'
  | 'fora-do-mapa'
  | 'sobreposicao'
  // Ha estrada (F08) sobre o footprint: predio nao se constroi em cima de estrada.
  | 'estrada'
  // DECLARADO, INALCANCAVEL HOJE: o mapa nao tem terreno variado nem feature
  // que o produza (BUILD_PLAN, nota da F06). `canPlace` ganha esta recusa
  // quando existir terreno — o GDD ja a exige: Fisherman's precisa de lago,
  // mina precisa de veio na montanha, estrada precisa de solo transponivel.
  // O tipo antecipa; a implementacao nao finge.
  | 'terreno';

export type ResultadoDePosicionamento =
  | { readonly ok: true }
  | { readonly ok: false; readonly motivo: MotivoDeRecusa };

function recusa(motivo: MotivoDeRecusa): ResultadoDePosicionamento {
  return { ok: false, motivo };
}

/**
 * Pode-se por um predio do tipo `buildingId` com o canto superior esquerdo em
 * (gx, gy)? Pura: nao escreve em `state`, nao le tema, nao conhece nenhum id.
 * Devolve o MOTIVO da recusa, nao so um boolean — sem ele um teste de
 * "sobreposicao" passaria mesmo se a funcao recusasse pela razao errada, e a
 * F07 precisa do vocabulario para rejeitar o segundo comando na mesma posicao.
 *
 * Ordem das checagens (fixada por teste): desconhecido, bloqueado,
 * fora-do-mapa, sobreposicao, estrada. Footprint meio-aberto: encostar nao e sobrepor.
 *
 * Fora daqui, de proposito: custo/estoque (F07: o custo nao sai no clique) e
 * obra pendente (F07 a cria; hoje so existe predio `'completo'`).
 */
export function canPlace(
  state: GameState, buildingId: string, gx: number, gy: number,
  dados: GameData = gameData,
): ResultadoDePosicionamento {
  const candidato = caixaDeTipo(buildingId, gx, gy, dados);
  if (candidato === null) return recusa('predio-desconhecido');

  if (!estaDesbloqueado(state, buildingId, dados)) return recusa('bloqueado');

  const { largura, altura } = dados.terreno.mapaPadrao;
  if (candidato.x0 < 0 || candidato.y0 < 0 || candidato.x1 > largura || candidato.y1 > altura) {
    return recusa('fora-do-mapa');
  }

  for (const id of state.predios.ordem) {
    const existente = state.predios.porId[id];
    if (!existente) continue;
    const caixa = caixaDoPredio(existente, dados);
    if (caixa !== null && caixasSeSobrepoem(candidato, caixa)) return recusa('sobreposicao');
  }

  for (let gy = candidato.y0; gy < candidato.y1; gy++) {
    for (let gx = candidato.x0; gx < candidato.x1; gx++) {
      if (ehEstrada(state.estradas, { gx, gy })) return recusa('estrada');
    }
  }

  return { ok: true };
}
