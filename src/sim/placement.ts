import type { GameState } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { estaDesbloqueado } from './desbloqueio';
import { bordaSul, caixaDeTipo, caixaDoPredio, caixasSeSobrepoem } from './footprint';
import { ehEstrada, ehPlanejada } from './estradas';
import { ehTransponivel } from './mapa';
import { recursoBloqueiaConstrucao, recursoNoTile } from './recursos';

export type MotivoDeRecusa =
  | 'predio-desconhecido'
  | 'bloqueado'
  | 'fora-do-mapa'
  | 'sobreposicao'
  // Ha estrada (F08) ou canteiro de estrada (F18d-1b) sobre o footprint: predio nao
  // se constroi em cima de estrada.
  //
  // O canteiro conta porque ele e o pedido: `canPlaceRoad` ja recusa estrada sobre
  // predio, e sem a recusa simetrica o laborer assentaria o tile DEBAIXO do predio
  // plantado depois — o mesmo tile ocupado pelos dois, que e o que o motivo existe
  // para impedir.
  | 'estrada'
  // A borda sul — a porta (GDD §5.1) — precisa estar NO MAPA e LIVRE, dos dois
  // lados: nem o candidato nasce com a propria porta fora do mapa ou coberta,
  // nem tapa a porta de quem ja esta de pe. Achado da F16a que corrige a F06,
  // que so checava footprint contra footprint: pela porta entra todo material,
  // entao predio sem porta nunca recebe entrega e nunca funciona, e escola com a
  // porta tapada segura para sempre um treino ja pago (`systems/escolas.ts`).
  | 'porta-sem-saida'
  // F-T1: ALCANCAVEL desde que existe camada de terreno. Algum tile do
  // footprint e intransponivel (`terrain.intransponivel`: agua, rocha,
  // montanha). Declarado desde a F06 e inalcancavel ate aqui — o tipo
  // antecipava, a implementacao nao fingia.
  //
  // Nao cobre a PORTA: prédio inteiro em terra firme com a borda sul na agua
  // recusa por `'porta-sem-saida'`, que e o que de fato esta errado ali (por ela
  // entra todo material, e material nao atravessa o lago). Um rotulo por causa.
  | 'terreno'
  // BUG-F: ha recurso natural EM PE sob o footprint, e o tipo dele reprova
  // construcao (`resources.tipos.<t>.bloqueiaConstrucao`). Medido antes de
  // existir: sem esta recusa a pedreira aceitava ser posta sobre o lajedo e
  // lavrava a rocha debaixo das proprias paredes, entregando o mesmo que uma
  // pedreira ao lado — o recurso nao sumia, nao ficava inacessivel, era colhido
  // atraves do predio.
  //
  // Motivo PROPRIO, e nao `'terreno'`: sao causas com conserto diferente, como
  // `canPlaceRoad` ja separava. Terreno nao se remove; rocha e arvore o jogador
  // pode ir colher primeiro e construir depois no mesmo tile.
  //
  // NAO e "todo recurso": a bandeira e por tipo, em dado. Milho nao reprova,
  // porque tile de milho e tile que o jogador plantou e pousio e recurso com
  // quantidade zero — recusar ali proibiria construir onde ele ja plantou uma vez.
  | 'recurso';

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
 * fora-do-mapa, terreno (F-T1), recurso (BUG-F), sobreposicao, estrada,
 * porta-sem-saida. Footprint meio-aberto:
 * encostar nao e sobrepor — mas encostar NA PORTA e tapa-la, e isso se recusa.
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

  // F-T1, logo depois de `fora-do-mapa` e antes de `sobreposicao`: as duas
  // primeiras sao sobre o CHAO, e o chao e o que existe antes de qualquer
  // prédio. Uma obra sobre agua nao e "lugar ocupado", e outro tipo de nao.
  for (let gy = candidato.y0; gy < candidato.y1; gy++) {
    for (let gx = candidato.x0; gx < candidato.x1; gx++) {
      if (!ehTransponivel(gx, gy, dados)) return recusa('terreno');
    }
  }

  // BUG-F, junto com o terreno e antes de `sobreposicao`, pela mesma razao que o
  // comentario acima da: as duas primeiras sao sobre o CHAO. Rocha sob a obra nao
  // e "lugar ocupado", e outro tipo de nao. A PORTA nao entra: ela só precisa ser
  // pisavel, e rocha e pisavel — a borda sul sobre o lajedo nao cria defeito
  // nenhum, e recusar ali seria recusar mais do que o medido.
  for (let gy = candidato.y0; gy < candidato.y1; gy++) {
    for (let gx = candidato.x0; gx < candidato.x1; gx++) {
      if (recursoBloqueiaConstrucao(recursoNoTile(state, gx, gy), dados)) return recusa('recurso');
    }
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
      if (ehPlanejada(state.estradasPlanejadas, { gx, gy })) return recusa('estrada');
    }
  }

  // A porta, por ultimo e em passada propria: sobreposicao continua ganhando o
  // motivo quando os dois valem, e a ordem das checagens segue fixada por teste.
  const porta = bordaSul(candidato);
  if (porta.y1 > altura) return recusa('porta-sem-saida');
  // F-T1: porta na agua e porta sem saida. O footprint ja passou pelo terreno
  // acima; o que se checa aqui e a faixa de fora.
  for (let gx = porta.x0; gx < porta.x1; gx++) {
    if (!ehTransponivel(gx, porta.y0, dados)) return recusa('porta-sem-saida');
  }
  for (const id of state.predios.ordem) {
    const existente = state.predios.porId[id];
    if (!existente) continue;
    const caixa = caixaDoPredio(existente, dados);
    if (caixa === null) continue;
    if (caixasSeSobrepoem(porta, caixa)) return recusa('porta-sem-saida');
    if (caixasSeSobrepoem(candidato, bordaSul(caixa))) return recusa('porta-sem-saida');
  }

  return { ok: true };
}
