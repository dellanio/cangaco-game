/**
 * F20b — os cenarios da FOME.
 *
 * Tudo aqui e MONTADO com peca ja provada: `cenarioComBodega` (F20a) da a vila
 * com a Bodega completa e ligada, `comProdutorOcupado` (F13) poe o especialista
 * dentro do predio. A comida que a Bodega serve NAO e semeada a mao em lugar
 * nenhum: sao os serfs do proprio cenario que a levam do armazem pela tarefa
 * `comida-para-inn`, e `cenarioDaVilaComBodegaCheia` apenas anda ticks ate a
 * gaveta `entrada` chegar ao teto do dado. Bodega abastecida por fixture
 * provaria a refeicao contra um estoque que o jogo nao fez.
 *
 * Nenhum id de comida e digitado: a lista sai do estoque de abertura do armazem
 * cruzado com `comidasConhecidas`, o mesmo molde da F20a.
 */
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import { createInitialState } from '../../src/sim/state';
import type { GameState, PredioCompleto, Unidade } from '../../src/sim/state';
import { step } from '../../src/sim/tick';
import { comidasConhecidas, tetoDeComidaNaBodega } from '../../src/sim/bodega';
import { drenaCondicao, limiaresDaUnidade } from '../../src/sim/condicao';
import { predioLigadoAoArmazem } from '../../src/sim/estradas';
import { estoqueDosArmazens } from '../../src/sim/selectors';
import { bodegaDoCenario, cenarioComBodega, ID_DA_BODEGA_NO_CENARIO } from './bodega-cenario';
import { comEstradas, tile } from './jobs-cenario';
import { comProdutorOcupado } from './producao-cenario';

/** A pedreira montada por `cenarioDaPedreiraComBodega`, e quem a ocupa. */
export const ID_DA_PEDREIRA = 'q1';
export const ID_DO_ESPECIALISTA = 'esp';

/** As comidas que o armazem de abertura REALMENTE tem — as unicas que podem chegar
 *  a Bodega sem uma cadeia de producao rodando. */
export function comidasDaAbertura(dados: GameData = gameData): readonly string[] {
  const estoque = estoqueDosArmazens(createInitialState(1, dados));
  return comidasConhecidas(dados).filter((c) => (estoque[c] ?? 0) > 0);
}

/** A unidade, ou o erro com o id — fixture que cala mede o nada tres `expect` adiante. */
export function unidadeDo(estado: GameState, id: string): Unidade {
  const u = estado.unidades.porId[id];
  if (u === undefined) throw new Error(`fixture: unidade '${id}' nao existe no estado`);
  return u;
}

export const condicaoDe = (estado: GameState, id: string): number => unidadeDo(estado, id).condicao;

/** Semeia `condicao` em unidades nomeadas (o resto do estado nao muda). */
export function comCondicao(estado: GameState, condicoes: Readonly<Record<string, number>>): GameState {
  const porId = { ...estado.unidades.porId };
  for (const [id, condicao] of Object.entries(condicoes)) {
    porId[id] = { ...unidadeDo(estado, id), condicao };
  }
  return { ...estado, unidades: { ...estado.unidades, porId } };
}

/** Os ids de quem drena condicao — o predicado da simulacao, nao uma lista de tipos. */
export function civisDoEstado(estado: GameState, dados: GameData = gameData): readonly string[] {
  return estado.unidades.ordem.filter((id) => {
    const u = estado.unidades.porId[id];
    return u !== undefined && drenaCondicao(u, dados);
  });
}

/** Todo civil do estado EXATAMENTE no limiar de sair para comer. */
export function comTodosComFome(estado: GameState, dados: GameData = gameData): GameState {
  const condicoes: Record<string, number> = {};
  for (const id of civisDoEstado(estado, dados)) {
    condicoes[id] = limiaresDaUnidade(unidadeDo(estado, id), dados).civilVaiComer;
  }
  return comCondicao(estado, condicoes);
}

/** A gaveta `entrada` da Bodega chegou ao teto em toda comida que o armazem tinha? */
export function bodegaNoTeto(bodega: PredioCompleto, dados: GameData = gameData): boolean {
  const teto = tetoDeComidaNaBodega(dados);
  return comidasDaAbertura(dados).every((c) => (bodega.estoque.entrada[c] ?? 0) >= teto);
}

/** Anda ticks ate `pronto` valer, ou lanca no limite — cenario que nunca chega ao
 *  ponto de partida tem de falhar dizendo isso, e nao virar teste vazio. */
export function avancarAte(
  estado: GameState,
  pronto: (e: GameState) => boolean,
  limite: number,
  motivo: string,
  dados: GameData = gameData,
): { readonly estado: GameState; readonly ticks: number } {
  let atual = estado;
  for (let t = 1; t <= limite; t++) {
    atual = step(atual, [], dados);
    if (pronto(atual)) return { estado: atual, ticks: t };
  }
  throw new Error(`fixture: ${motivo} nao aconteceu em ${limite} ticks`);
}

/** A vila da F20a com a Bodega ja cheia pelo caminho real (os serfs a encheram). */
export function cenarioDaVilaComBodegaCheia(
  dados: GameData = gameData,
): { readonly estado: GameState; readonly ticks: number } {
  return avancarAte(
    cenarioComBodega(),
    (e) => bodegaNoTeto(bodegaDoCenario(e), dados),
    1000,
    'a Bodega encher',
    dados,
  );
}

/**
 * A mesma vila MAIS uma pedreira ocupada e ligada ao armazem: o cenario do
 * especialista que sai para comer. As coordenadas e a rua sao as de
 * `cenarioDePedreira` (F13); a checagem de ligacao e a mesma, feita aqui porque
 * `exigirLigado` e privado la.
 */
export function cenarioDaPedreiraComBodega(
  dados: GameData = gameData,
): { readonly estado: GameState; readonly ticks: number } {
  let s = cenarioComBodega();
  s = comProdutorOcupado(
    s, { tipo: 'quarry', id: ID_DA_PEDREIRA, unidade: ID_DO_ESPECIALISTA, gx: 26, gy: 34 }, dados,
  );
  s = comEstradas(s, [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)]);
  for (const id of [ID_DA_PEDREIRA, ID_DA_BODEGA_NO_CENARIO]) {
    const p = s.predios.porId[id];
    if (p === undefined || !predioLigadoAoArmazem(s, p, dados)) {
      throw new Error(`fixture: '${id}' nao ficou ligado ao armazem`);
    }
  }
  return avancarAte(
    s,
    (e) => bodegaNoTeto(bodegaDoCenario(e), dados),
    1000,
    'a Bodega encher',
    dados,
  );
}
