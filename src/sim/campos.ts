/**
 * F18h — O CANTEIRO DO CAMPO: onde o jogador mandou arar e o que isso vira.
 *
 * Ate a F18 a terra aravel era do MAPA: `resources.json: corn.terreno` dizia
 * `campoArado` e o carregador derivava a camada de milho do terreno. Medido em
 * 2026-09-25, no mapa publicado nenhuma posicao a menos de 37 tiles do armazem
 * tinha tile aravel ao alcance — a fazenda da abertura nao produzia em lugar
 * nenhum perto da vila, e o jogo dizia o motivo sem oferecer acao. O operador
 * reverteu a premissa: o campo passa a ser DESENHADO.
 *
 * As manchas do mapa FICAM (decisao dele, mesma data): terra ja arada e razao
 * para explorar, e o jogador escolhe entre aproveitar uma ou abrir a propria.
 * Por isso este arquivo nao substitui a derivacao do terreno — ele soma.
 *
 * O molde e a estrada, peca por peca: `canPlowField` e irma de `canPlaceRoad`,
 * `comOTileArado` e irma de `comOTileAssentado`, e a tarefa `'arar'` e irma da
 * `'assentar-estrada'`. A diferenca que importa esta no material: a estrada
 * reserva e debita pedra num armazem, e o milho nao custa nada (GDD 5.4). O dia
 * em que a cana cobrar 1 timber por tile, quem paga e o laborer que ara, no
 * mesmo movimento — decisao do operador, 2026-09-25 — e o caminho ja esta
 * escrito ao lado, em `comOTileAssentado`.
 */
import type { GameState } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import type { TileDeGrid } from './estradas';
import { chaveDeTile, ehEstrada, ehPlanejada, tileDeChave, tileEmPredio } from './estradas';
import { tipoDoTile } from './mapa';

/**
 * Por que um trecho de aradura foi recusado.
 *
 *  - `'cultura-desconhecida'`: o recurso pedido nao existe no dado ou nao tem
 *    bloco `aradura`. Nao e o mesmo que `'terreno'`: ali a cultura vale e o chao
 *    nao serve; aqui nao ha cultura nenhuma para plantar.
 *  - `'terreno'`: o chao nao esta em `aradura.terrenoPermitido`. Cobre agua,
 *    rocha e montanha sem uma segunda regra dizendo o mesmo — o intransponivel
 *    nunca entra na lista de terreno aravel.
 *  - `'recurso'`: ja ha recurso no tile. Inclui o campo em POUSIO, que e campo
 *    feito e nao chao livre — arar de novo seria apagar o ciclo do roceiro.
 *  - `'estrada'`: rua de pe ou desenhada. O tile e um so; quem quer roca ali
 *    demole a rua primeiro, como faria para plantar um predio.
 */
export type MotivoDeRecusaDeCampo =
  | 'fora-do-mapa'
  | 'cultura-desconhecida'
  | 'terreno'
  | 'recurso'
  | 'sobreposicao'
  | 'estrada';

export type ResultadoDeAradura =
  | { readonly ok: true; readonly novos: readonly TileDeGrid[] }
  | { readonly ok: false; readonly motivo: MotivoDeRecusaDeCampo; readonly tile: TileDeGrid | null };

/** O tile esta no canteiro do campo? Irma de `ehPlanejada`, e separada pelo
 *  mesmo motivo: quem pergunta uma coisa nao responde a outra. */
export function ehCampoPlanejado(
  planejados: GameState['camposPlanejados'], tile: TileDeGrid,
): boolean {
  return planejados[chaveDeTile(tile)] !== undefined;
}

/** Os tiles do canteiro em ordem canonica (por `gy`, depois `gx`) com a cultura
 *  de cada um. Irma de `tilesOrdenados`, e pelo mesmo motivo: dois saves com o
 *  mesmo canteiro tem de gerar os mesmos ids na mesma ordem. */
export function tilesPlanejadosParaArar(
  planejados: GameState['camposPlanejados'],
): { readonly tile: TileDeGrid; readonly recurso: string }[] {
  return Object.entries(planejados)
    .map(([chave, recurso]) => ({ tile: tileDeChave(chave), recurso }))
    .sort((a, b) => a.tile.gy - b.tile.gy || a.tile.gx - b.tile.gx);
}

/** O tipo de recurso pode ser desenhado pelo jogador? E a presenca do bloco
 *  `aradura` que responde — nao uma lista em `.ts`. E ela tambem que a tela le
 *  para saber quantas ferramentas de terra existem. */
export function culturasAraveis(dados: GameData = gameData): readonly string[] {
  return Object.keys(dados.recursos.tipos).filter((id) => dados.recursos.tipos[id]?.aradura != null);
}

/**
 * Pode-se arar `tiles` para a cultura `recurso`? Pura. Devolve os tiles NOVOS
 * (os que ainda nao sao campo nem canteiro, sem repeticao, na ordem em que
 * vieram) ou o motivo e o primeiro tile culpado. Tudo ou nada, como a estrada:
 * um tile invalido recusa o trecho.
 *
 * Ordem das perguntas: a cultura (uma vez), depois cada tile — mapa, terreno,
 * recurso, estrada, predio. Nao ha pergunta de CUSTO no fim, ao contrario de
 * `canPlaceRoad`: o milho nao cobra material, e por isso nao ha recusa por falta
 * dele nem reserva a fazer. Quando a cana entrar, e aqui que entra a conta.
 *
 * Tile ja no canteiro nao e novo e nao recusa nada — redesenhar por cima do
 * proprio rascunho nao custa, exatamente como na estrada. Vale mesmo quando a
 * cultura desenhada antes era outra: quem chegou primeiro fica, e o jogador ve o
 * canteiro que ja esta na tela.
 */
export function canPlowField(
  state: GameState, recurso: string, tiles: readonly TileDeGrid[], dados: GameData = gameData,
): ResultadoDeAradura {
  const def = dados.recursos.tipos[recurso];
  const aradura = def?.aradura ?? null;
  if (aradura === null) return { ok: false, motivo: 'cultura-desconhecida', tile: null };

  const { largura, altura } = dados.terreno.mapaPadrao;
  const vistos = new Set<string>();
  const novos: TileDeGrid[] = [];
  for (const tile of tiles) {
    const dentro = Number.isInteger(tile.gx) && Number.isInteger(tile.gy)
      && tile.gx >= 0 && tile.gy >= 0 && tile.gx < largura && tile.gy < altura;
    if (!dentro) return { ok: false, motivo: 'fora-do-mapa', tile };
    const terreno = tipoDoTile(tile.gx, tile.gy, dados);
    if (terreno === null || !aradura.terrenoPermitido.includes(terreno)) {
      return { ok: false, motivo: 'terreno', tile };
    }
    if (state.recursos[chaveDeTile(tile)] !== undefined) return { ok: false, motivo: 'recurso', tile };
    if (ehEstrada(state.estradas, tile) || ehPlanejada(state.estradasPlanejadas, tile)) {
      return { ok: false, motivo: 'estrada', tile };
    }
    if (tileEmPredio(state, tile, dados)) return { ok: false, motivo: 'sobreposicao', tile };
    const chave = chaveDeTile(tile);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    if (!ehCampoPlanejado(state.camposPlanejados, tile)) novos.push(tile);
  }
  return { ok: true, novos };
}

/**
 * F18h — o tile sai do canteiro e vira CAMPO: uma entrada em `state.recursos`
 * com a quantidade inicial do tipo, que para o milho e ZERO — terra arada e por
 * semear (`corn.quantidadeInicial`, F18). Daqui em diante quem trabalha o tile e
 * o roceiro, pelo ciclo que ja existe.
 *
 * `null` quando o tile ja nao esta no canteiro ou a cultura sumiu do dado (save
 * de outra versao): quem chama libera a tarefa em vez de escrever recurso
 * fantasma. E o mesmo contrato de `comOTileAssentado`.
 *
 * A quantidade inicial resolve pelo mesmo `?? rendimentoPorTile` de
 * `recursosIniciais`: um tile arado pelo jogador e um tile de campo como
 * qualquer outro, e nao uma segunda regra de quanto ele rende.
 */
export function comOTileArado(
  state: GameState, tile: TileDeGrid, dados: GameData = gameData,
): GameState | null {
  const chave = chaveDeTile(tile);
  const recurso = state.camposPlanejados[chave];
  if (recurso === undefined) return null;
  const def = dados.recursos.tipos[recurso];
  if (def === undefined) return null;

  const planejados = { ...state.camposPlanejados };
  delete planejados[chave];
  return {
    ...state,
    camposPlanejados: planejados,
    recursos: {
      ...state.recursos,
      [chave]: { tipo: recurso, quantidade: def.quantidadeInicial ?? def.rendimentoPorTile },
    },
  };
}
