/**
 * F15a — cenarios de PRODUCAO. O predio nasce pelo MESMO caminho do jogo
 * (`completarObra`, que semeia `capacidade`, `estoque` e `producao`); so a posse
 * e posta a mao, para nao gastar 40 ticks de `indo_ocupar` em cada teste — o
 * caminho inteiro (escola -> tarefa -> ocupar -> produzir) e o aceite da F15a.
 *
 * Os civis do cenario inicial saem: serf e laborer mexeriam no estoque por conta
 * propria e o que se mede aqui e o relogio do ciclo, sozinho.
 */
import { completarObra, createInitialState, ID_DA_BODEGA, ID_DO_ARMAZEM } from '../../src/sim/state';
import { condicaoCheiaDoTipo } from '../../src/sim/condicao';
import type { GameEvent, GameState, PredioCompleto, Producao, Unidade } from '../../src/sim/state';
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import { step } from '../../src/sim/tick';
import { chaveDeTile, predioLigadoAoArmazem, tilesDaPorta } from '../../src/sim/estradas';
import { caixaDeTipo, caixaDoPredio } from '../../src/sim/footprint';
import { canPlace } from '../../src/sim/placement';
import type { TileDeGrid } from '../../src/sim/estradas';
import { trabalhadorDoTipo } from '../../src/sim/ocupacao';
import { disponivelAoAlcance, tilesDeColheita } from '../../src/sim/recursos';
import { receitaDoTipo } from '../../src/sim/producao';
import { registrarTipoConstruido } from '../../src/sim/desbloqueio';

const tile = (gx: number, gy: number): TileDeGrid => ({ gx, gy });

function semCivis(estado: GameState): GameState {
  return { ...estado, unidades: { porId: {}, ordem: [] } };
}

function comEstradas(estado: GameState, tiles: readonly TileDeGrid[]): GameState {
  const novas = Object.fromEntries(tiles.map((t) => [chaveDeTile(t), true as const]));
  return { ...estado, estradas: { ...estado.estradas, ...novas } };
}

/**
 * Um produtor COMPLETO e ocupado, somado ao estado que veio. Exportado desde a
 * F18d-1a: o aceite dela precisa de uma pedreira viva DENTRO de um cenario que
 * ja tem civis e obra, e nao do cenario fechado de `cenarioDePedreira`.
 */
export function comProdutorOcupado(
  estado: GameState,
  opcoes: { readonly tipo: string; readonly id: string; readonly unidade: string; readonly gx: number; readonly gy: number },
  dados: GameData,
): GameState {
  const def = dados.predios.find((p) => p.id === opcoes.tipo);
  if (!def) throw new Error(`fixture: predio '${opcoes.tipo}' nao existe em buildings.json`);
  const tipoDoCivil = trabalhadorDoTipo(opcoes.tipo, dados);
  if (tipoDoCivil === null) throw new Error(`fixture: '${opcoes.tipo}' nao pede trabalhador`);
  const completo = completarObra({
    id: opcoes.id, tipo: opcoes.tipo, gx: opcoes.gx, gy: opcoes.gy, estado: 'obra', hp: def.hp,
    obra: { faltam: {}, nivelamento: 0 },
  }, dados);
  const predio: PredioCompleto = { ...completo, ocupante: opcoes.unidade };
  // na PORTA, que e onde o `indo_ocupar` da F14 larga a unidade — nao em cima do
  // footprint, que nem e andavel
  const porta = tilesDaPorta(predio, dados)[0];
  if (porta === undefined) throw new Error(`fixture: '${opcoes.id}' nao tem porta`);
  const u: Unidade = {
    id: opcoes.unidade, tipo: tipoDoCivil, gx: porta.gx, gy: porta.gy, fsm: 'trabalhando', fsmData: {},
    condicao: condicaoCheiaDoTipo(tipoDoCivil),
  };
  return {
    ...estado,
    predios: { porId: { ...estado.predios.porId, [predio.id]: predio }, ordem: [...estado.predios.ordem, predio.id] },
    // SOMA a unidade, nao substitui: os cenarios de um produtor so chamam isto
    // depois de `semCivis` (mapa vazio, resultado identico ao de antes), mas o
    // oraculo precisa de quatro produtores E dos serfs do cenario inicial.
    unidades: { porId: { ...estado.unidades.porId, [u.id]: u }, ordem: [...estado.unidades.ordem, u.id] },
  };
}

/** A fixture confere a si mesma: coordenada errada falha AQUI, com o motivo
 *  escrito, e nao tres `expect` adiante como "produziu 0". */
function exigirLigado(estado: GameState, id: string, dados: GameData): GameState {
  const p = estado.predios.porId[id];
  if (p === undefined) throw new Error(`fixture: predio '${id}' nao entrou no estado`);
  if (!predioLigadoAoArmazem(estado, p, dados)) throw new Error(`fixture: '${id}' nao ficou ligado ao armazem`);
  return estado;
}

/** Pedreira `q1` (26,34) ocupada por `u1`, ligada a porta do armazem (29,33). */
export function cenarioDePedreira(dados: GameData = gameData): GameState {
  // `dados` VAI para `createInitialState`: desde a F-T2a a camada de recurso
  // nasce com o estado, entao um cenario de dado trocado que esquecesse de
  // passa-lo abriria com a jazida do arquivo, nao com a do teste.
  let s = semCivis(createInitialState(1, dados));
  s = comProdutorOcupado(s, { tipo: 'quarry', id: 'q1', unidade: 'u1', gx: 26, gy: 34 }, dados);
  s = comEstradas(s, [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)]);
  return exigirLigado(s, 'q1', dados);
}

/**
 * F15b — o cenario ORACULO do GDD §4.5: 2 Woodcutter's : 1 Sawmill, mais a
 * pedreira, todos ocupados e ligados a MESMA rede de estrada, e COM os civis do
 * cenario inicial — sao os serfs deles que entregam. E o cenario de medicao, nao
 * de unidade: ele existe para ser rodado por milhares de ticks e observado.
 *
 * Disposicao (y=36 e a rua que passa na porta de todos; x=29 sobe ate a porta do
 * armazem, em 29,33):
 *   w2 (18,34)  w1 (22,34)  q1 (26,34)  [armazem 29..31]  s1 (32,34)
 */
export function cenarioOraculo(dados: GameData = gameData): GameState {
  let s = createInitialState(1, dados);
  s = comProdutorOcupado(s, { tipo: 'woodcutters', id: 'w2', unidade: 'lenhador-2', gx: 18, gy: 34 }, dados);
  s = comProdutorOcupado(s, { tipo: 'woodcutters', id: 'w1', unidade: 'lenhador-1', gx: 22, gy: 34 }, dados);
  s = comProdutorOcupado(s, { tipo: 'quarry', id: 'q1', unidade: 'pedreiro', gx: 26, gy: 34 }, dados);
  s = comProdutorOcupado(s, { tipo: 'sawmill', id: 's1', unidade: 'carpinteiro', gx: 32, gy: 34 }, dados);
  const rua: TileDeGrid[] = [];
  for (let x = 18; x <= 35; x++) rua.push(tile(x, 36));
  for (let y = 33; y <= 35; y++) rua.push(tile(29, y));
  s = comEstradas(s, rua);
  for (const id of ['w1', 'w2', 'q1', 's1']) exigirLigado(s, id, dados);
  return s;
}

/**
 * F18 — Fazenda `f1` (112,30) ocupada por `roceiro`, no NORTE do mapa, ao lado
 * do bloco de terra arada que o gerador emitiu, com um armazem proprio em
 * (116,34) e a rua que liga os dois.
 *
 * Longe da aldeia de proposito: a terra arada do mapa esta onde esta, e um
 * cenario que injetasse campo ao lado do armazem da abertura provaria o ciclo
 * sobre um dado que o jogo nao tem. O armazem extra nao e artificio — e o que o
 * jogador faz quando produz longe, e `predioLigadoAoArmazem` aceita qualquer
 * armazem completo.
 *
 * A fazenda NAO fica em cima do proprio campo: o footprint escolhido nao
 * encosta em tile de milho. Ver a pergunta em aberto do PROGRESS.md sobre tile
 * de recurso debaixo de predio.
 */
export function cenarioDeFazenda(dados: GameData = gameData): GameState {
  let s = semCivis(createInitialState(1, dados));
  s = comArmazemExtra(s, 'armazem-do-roçado', 116, 34, dados);
  s = comProdutorOcupado(s, { tipo: 'farm', id: 'f1', unidade: 'roceiro', gx: 112, gy: 30 }, dados);
  const rua: TileDeGrid[] = [];
  for (let gy = 33; gy <= 37; gy++) rua.push(tile(112, gy));
  for (let gx = 112; gx <= 119; gx++) rua.push(tile(gx, 37));
  s = comEstradas(s, rua);
  return exigirLigado(s, 'f1', dados);
}

/**
 * F18 — a MESMA fazenda, posta na aldeia: ligada, ocupada, e sem um unico tile
 * de campo ao alcance. E o erro que o jogador comete antes de a planta fantasma
 * da F-TP existir, e e o cenario que produz o alerta `sem-campo`.
 *
 * A fixture confere a si mesma: se o mapa um dia tiver terra arada perto da
 * aldeia, isto falha aqui com o motivo escrito, em vez de o alerta sumir
 * calado tres testes adiante.
 */
export function cenarioDeFazendaSemCampo(dados: GameData = gameData): GameState {
  let s = semCivis(createInitialState(1, dados));
  s = comProdutorOcupado(s, { tipo: 'farm', id: 'f1', unidade: 'roceiro', gx: 33, gy: 30 }, dados);
  s = comEstradas(s, [tile(29, 33), tile(30, 33), tile(31, 33), tile(32, 33), tile(33, 33)]);
  s = exigirLigado(s, 'f1', dados);
  const predio = s.predios.porId.f1;
  const colheita = receitaDoTipo('farm', dados)?.colheita ?? null;
  if (predio?.estado !== 'completo' || colheita === null) {
    throw new Error('fixture: `farm` precisa de receita com colheita');
  }
  for (const chave of tilesDeColheita(predio, colheita, dados)) {
    if (s.recursos[chave] !== undefined) {
      throw new Error(`fixture: a fazenda da aldeia alcanca o tile de recurso ${chave}`);
    }
  }
  return s;
}

/**
 * F19 — a CADEIA DO PAO na proporcao que o proprio dado publica como oraculo
 * (`production.json:proporcoesDeReferencia`, 1 fazenda : 1 moinho : 1 padaria),
 * mais o armazem por onde tudo passa e os serfs que carregam.
 *
 * Os serfs entram a MAO, e nao pelo cenario inicial: os do jogo nascem na vila,
 * a 80 tiles daqui, e gastariam o teste inteiro so chegando. Numero e posicao
 * sao do cenario, nao do balanceamento — o que se mede e se a cadeia FECHA.
 *
 * Disposicao (y=37 e a rua que passa na porta de todos):
 *   b1 (104,34)   m1 (108,34)   [f1 112,30, porta em y=33]   arm (116,34)
 */
export function cenarioDaCadeiaDoPao(
  dados: GameData = gameData, serfs: number = 4,
): GameState {
  let s = semCivis(createInitialState(1, dados));
  s = comArmazemExtra(s, 'arm', 116, 34, dados);
  s = comProdutorOcupado(s, { tipo: 'farm', id: 'f1', unidade: 'roceiro', gx: 112, gy: 30 }, dados);
  s = comProdutorOcupado(s, { tipo: 'mill', id: 'm1', unidade: 'moleiro', gx: 108, gy: 34 }, dados);
  s = comProdutorOcupado(s, { tipo: 'bakery', id: 'b1', unidade: 'forneiro', gx: 104, gy: 34 }, dados);
  const rua: TileDeGrid[] = [];
  for (let gy = 33; gy <= 37; gy++) rua.push(tile(112, gy));
  for (let gx = 104; gx <= 119; gx++) rua.push(tile(gx, 37));
  s = comEstradas(s, rua);
  for (const id of ['f1', 'm1', 'b1']) s = exigirLigado(s, id, dados);
  // F20b: a Bodega entra no cenario porque a janela dele (12 000 ticks) E uma
  // condicao cheia de civil. Ela come do proprio cuscuz que a cadeia entrega.
  s = comBodegaAbastecida(s, 'bodega', 'arm', dados);
  return comHistoricoDosPredios(comSerfs(s, serfs, 112, 37));
}

/**
 * F19b — a CADEIA DA CARNE: milho -> bode -> carne de sol, na MESMA geografia da
 * cadeia do pao (o milho do mapa esta no norte, e e de la que o milho sai), com o
 * armazem por onde tudo passa e os serfs que carregam.
 *
 * Disposicao (y=37 e a rua que passa na porta de todos):
 *   bu1 (103,34)   sf1 (107,34)   [f1 112,30, porta em y=33]   arm (116,34)
 *
 * A granja e o acougue ficam em GRAMA, ao sul da terra arada (medido no mapa:
 * `campoArado` vai de y=26 a y=30), para que nenhum footprint cubra tile de
 * plantio — o caso da nota herdada da F18, que e da F-T3 e nao deste cenario.
 */
export function cenarioDaCadeiaDaCarne(
  dados: GameData = gameData, serfs: number = 4,
): GameState {
  let s = semCivis(createInitialState(1, dados));
  s = comArmazemExtra(s, 'arm', 116, 34, dados);
  s = comProdutorOcupado(s, { tipo: 'farm', id: 'f1', unidade: 'roceiro', gx: 112, gy: 30 }, dados);
  s = comProdutorOcupado(s, { tipo: 'swine_farm', id: 'sf1', unidade: 'criador', gx: 107, gy: 34 }, dados);
  s = comProdutorOcupado(s, { tipo: 'butchers', id: 'bu1', unidade: 'carneador', gx: 103, gy: 34 }, dados);
  const rua: TileDeGrid[] = [];
  for (let gy = 33; gy <= 37; gy++) rua.push(tile(112, gy));
  for (let gx = 103; gx <= 119; gx++) rua.push(tile(gx, 37));
  s = comEstradas(s, rua);
  for (const id of ['f1', 'sf1', 'bu1']) s = exigirLigado(s, id, dados);
  // F20b: mesma razao da cadeia do pao, e aqui a janela e maior ainda (20 000
  // ticks). A carne de sol e comida em `condition.json`: a cadeia alimenta a vila.
  s = comBodegaAbastecida(s, 'bodega', 'arm', dados);
  return comHistoricoDosPredios(comSerfs(s, serfs, 112, 37));
}

/**
 * F19b — a MESMA cadeia da carne sem um elo. Tira o predio E o ocupante, e refaz
 * `tiposJaConstruidos` a partir do que sobrou: sem isso o menu Build mentiria
 * sobre a arvore, e o teste mediria a fixture.
 */
function semPredioEOcupante(estado: GameState, predio: string, unidade: string): GameState {
  const porId = { ...estado.predios.porId };
  delete porId[predio];
  const uPorId = { ...estado.unidades.porId };
  delete uPorId[unidade];
  return comHistoricoDosPredios({
    ...estado,
    predios: { porId, ordem: estado.predios.ordem.filter((i) => i !== predio) },
    unidades: { porId: uPorId, ordem: estado.unidades.ordem.filter((i) => i !== unidade) },
    tiposJaConstruidos: [],
  });
}

/** Sem a Malhada: o milho se acumula e o acougue nunca ve um bode. E o que impede
 *  o aceite de passar por um acougue que fabrique carne do nada. */
export function cenarioDaCarneSemGranja(dados: GameData = gameData): GameState {
  return semPredioEOcupante(cenarioDaCadeiaDaCarne(dados), 'sf1', 'criador');
}

/** Sem a Fazenda: a fonte da cadeia inteira desaparece, e nada e produzido. */
export function cenarioDaCarneSemFazenda(dados: GameData = gameData): GameState {
  return semPredioEOcupante(cenarioDaCadeiaDaCarne(dados), 'f1', 'roceiro');
}

/** Serfs ociosos em cima de um tile, para o cenario que precisa de carga sem
 *  esperar a caminhada da vila. Ids `serf-1..n`, para nao colidir com os `u<n>`
 *  do cenario inicial. */
export function comSerfs(
  estado: GameState, quantos: number, gx: number, gy: number,
): GameState {
  const porId = { ...estado.unidades.porId };
  const ordem = [...estado.unidades.ordem];
  for (let i = 1; i <= quantos; i++) {
    const u: Unidade = { id: `serf-${i}`, tipo: 'serf', gx, gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('serf') };
    porId[u.id] = u;
    ordem.push(u.id);
  }
  return { ...estado, unidades: { porId, ordem } };
}

/** F19 — a MESMA cadeia sem o elo do meio: a padaria e a fazenda, e nenhum
 *  moinho. E o que impede o aceite de passar por a padaria fabricar pao do nada. */
export function cenarioDaCadeiaSemMoinho(dados: GameData = gameData): GameState {
  const completa = cenarioDaCadeiaDoPao(dados);
  const porId = { ...completa.predios.porId };
  delete porId.m1;
  return comHistoricoDosPredios({
    ...completa,
    predios: { porId, ordem: completa.predios.ordem.filter((id) => id !== 'm1') },
    unidades: {
      porId: Object.fromEntries(
        Object.entries(completa.unidades.porId).filter(([id]) => id !== 'moleiro'),
      ),
      ordem: completa.unidades.ordem.filter((id) => id !== 'moleiro'),
    },
    tiposJaConstruidos: [],
  });
}

/**
 * O historico de tipos (`tiposJaConstruidos`, F12) refeito a partir dos predios
 * que EXISTEM. Cenario montado a mao nunca passou por `registrarConclusoes`, e
 * sem isto uma vila com fazenda de pe aparece no menu Build como se nunca
 * tivesse construido uma — o que faria o teste do desbloqueio medir a fixture,
 * nao a regra.
 */
function comHistoricoDosPredios(estado: GameState): GameState {
  let s = estado;
  for (const id of s.predios.ordem) {
    const p = s.predios.porId[id];
    if (p?.estado === 'completo') s = registrarTipoConstruido(s, p.tipo);
  }
  return s;
}

/** Um armazem COMPLETO a mais, sem estoque e sem ocupante (armazem nao tem
 *  trabalhador). Existe para os cenarios que produzem longe da aldeia. */
export function comArmazemExtra(
  estado: GameState, id: string, gx: number, gy: number, dados: GameData = gameData,
): GameState {
  const def = dados.predios.find((p) => p.id === 'storehouse');
  if (!def) throw new Error('fixture: storehouse nao existe em buildings.json');
  const predio = completarObra({
    id, tipo: 'storehouse', gx, gy, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 },
  }, dados);
  return {
    ...estado,
    predios: {
      porId: { ...estado.predios.porId, [id]: predio },
      ordem: [...estado.predios.ordem, id],
    },
  };
}

/**
 * F20b — uma Bodega COMPLETA a leste de um armazem do cenario, com a rua na porta
 * dela. Os cenarios LONGOS precisam dela por aritmetica do dado, nao por gosto:
 * `condicao.ticksCondicaoCheia.civil` e 12 000 ticks, que e exatamente a janela da
 * F19 (a da F19b e maior ainda), entao uma vila sem lugar para comer morre INTEIRA
 * dentro da janela que esses testes medem.
 *
 * A comida nao e semeada: ela chega pelo nivel 1 de `delivery.json`, do armazem
 * para a Bodega, pelo caminho que a F20a abriu — e o pao (ou a carne) que a
 * propria cadeia do cenario produziu. Bodega abastecida a mao provaria a
 * sobrevivencia contra um estoque que o jogo nao fez.
 *
 * O `x` nao e digitado: anda para o leste ate o primeiro em que `canPlace` — o
 * MESMO predicado que recusa a planta do jogador — diz sim, o molde de
 * `plantaDaBodega`. Lanca se nao couber, porque cenario que cala aqui mede a
 * fixture tres `expect` adiante.
 */
export function comBodegaAbastecida(
  estado: GameState, id: string, armazemId: string, dados: GameData = gameData,
): GameState {
  const armazem = estado.predios.porId[armazemId];
  if (armazem === undefined || armazem.estado !== 'completo') {
    throw new Error(`fixture: '${armazemId}' nao e armazem completo`);
  }
  const caixaDoArmazem = caixaDoPredio(armazem, dados);
  if (caixaDoArmazem === null) throw new Error(`fixture: '${armazemId}' nao tem tamanho`);
  const def = dados.predios.find((p) => p.id === ID_DA_BODEGA);
  if (!def) throw new Error(`fixture: '${ID_DA_BODEGA}' nao existe em buildings.json`);

  // na MESMA linha do armazem: a porta dos dois cai na mesma rua, que e o que liga
  // a Bodega a rede sem uma volta de estrada nova
  const gy = caixaDoArmazem.y0;
  const limite = dados.terreno.mapaPadrao.largura;
  let gx = caixaDoArmazem.x1;
  while (gx < limite && !canPlace(estado, ID_DA_BODEGA, gx, gy, dados).ok) gx += 1;
  if (gx >= limite) throw new Error('fixture: a Bodega nao cabe a leste do armazem');
  if (caixaDeTipo(ID_DA_BODEGA, gx, gy, dados) === null) throw new Error('fixture: Bodega sem tamanho');

  const predio = completarObra({
    id, tipo: ID_DA_BODEGA, gx, gy, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 },
  }, dados);
  const comBodega: GameState = {
    ...estado,
    predios: {
      porId: { ...estado.predios.porId, [id]: predio },
      ordem: [...estado.predios.ordem, id],
    },
  };
  return exigirLigado(comEstradas(comBodega, tilesDaPorta(predio, dados)), id, dados);
}

/** Serraria `s1` (32,34) ocupada por `u2`, ligada, e com a entrada VAZIA. */
export function cenarioDeSerraria(dados: GameData = gameData): GameState {
  let s = semCivis(createInitialState(1, dados));
  s = comProdutorOcupado(s, { tipo: 'sawmill', id: 's1', unidade: 'u2', gx: 32, gy: 34 }, dados);
  s = comEstradas(s, [tile(31, 33), tile(31, 34), tile(31, 35), tile(31, 36), tile(32, 36)]);
  return exigirLigado(s, 's1', dados);
}

// --- avancar o relogio ---

export function avancar(estado: GameState, ticks: number, dados: GameData = gameData): GameState {
  let s = estado;
  for (let i = 0; i < ticks; i++) s = step(s, [], dados);
  return s;
}

/** Os eventos do tick `ticks` (1-based), e so dele: `state.events` carrega o
 *  tick corrente, entao basta avancar ate la. */
export function eventosNoTick(estado: GameState, ticks: number, dados: GameData = gameData): readonly GameEvent[] {
  return avancar(estado, ticks, dados).events;
}

// --- leitura ---

function completoDe(estado: GameState, id: string): PredioCompleto {
  const p = estado.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
}

export const saidaDe = (estado: GameState, id: string): Readonly<Record<string, number>> =>
  completoDe(estado, id).estoque.saida;

export const entradaDe = (estado: GameState, id: string): Readonly<Record<string, number>> =>
  completoDe(estado, id).estoque.entrada;

function producaoDe(estado: GameState, id: string): Producao {
  const p = completoDe(estado, id).producao;
  if (p === null) throw new Error(`fixture: '${id}' nao tem producao`);
  return p;
}

export const progressoDe = (estado: GameState, id: string): number => producaoDe(estado, id).progresso;

/**
 * F-T2a: o que ANTES era `veioDe`. A pergunta continua sendo "quanto ainda ha
 * para este predio colher?", mas a resposta deixou de estar no predio: e a soma
 * do que sobrou nos tiles ao alcance dele. `null` para receita sem colheita
 * (serraria, lenhador), que e o que `veio: null` queria dizer.
 */
export function disponivelDe(estado: GameState, id: string, dados: GameData = gameData): number | null {
  const predio = completoDe(estado, id);
  const receita = receitaDoTipo(predio.tipo, dados);
  if (receita?.colheita == null) return null;
  return disponivelAoAlcance(estado, predio, receita.colheita, dados);
}

/**
 * O `fsm` desta unidade, ou `null` se ela nao esta mais no estado. Irmao FROUXO de
 * `fsmDe`, e existe por um motivo estreito: desde a F20b a unidade MORRE, e o
 * cenario a que falta um elo da cadeia nao produz comida nenhuma — quem ele
 * observa morre antes do fim da janela. Quem quer afirmar o estado de uma unidade
 * viva continua usando `fsmDe`, que lanca.
 */
export function fsmSeVivo(estado: GameState, unidadeId: string): string | null {
  return estado.unidades.porId[unidadeId]?.fsm ?? null;
}

/**
 * F20b — o acumulado que CHEGOU a um armazem, por mercadoria, contado por evento
 * `task-completed` ao longo de `ticks`.
 *
 * Por que nao o saldo das gavetas: desde que a vila COME, a comida entregue sai da
 * gaveta outra vez, e saldo passa a medir o que SOBROU, nao o que a cadeia
 * produziu — e o teto da fonte e sobre producao. O destino e filtrado por ARMAZEM
 * porque a mesma mercadoria viaja duas vezes (padaria -> armazem, armazem ->
 * Bodega, nivel 1 da F20a), e o segundo salto contaria o mesmo pao de novo.
 */
export function entregasNoArmazem(
  estado: GameState, ticks: number, mercadorias: readonly string[], dados: GameData = gameData,
): { readonly fim: GameState; readonly entregues: Readonly<Record<string, number>> } {
  const entregues: Record<string, number> = Object.fromEntries(mercadorias.map((m) => [m, 0]));
  let s = estado;
  for (let t = 0; t < ticks; t += 1) {
    s = step(s, [], dados);
    for (const ev of s.events) {
      if (ev.type !== 'task-completed') continue;
      if (entregues[ev.mercadoria] === undefined) continue;
      if (s.predios.porId[ev.destino]?.tipo !== ID_DO_ARMAZEM) continue;
      entregues[ev.mercadoria] = (entregues[ev.mercadoria] ?? 0) + 1;
    }
  }
  return { fim: s, entregues };
}

export function fsmDe(estado: GameState, unidadeId: string): string {
  const u = estado.unidades.porId[unidadeId];
  if (u === undefined) throw new Error(`fixture: unidade '${unidadeId}' nao existe`);
  return u.fsm;
}

// --- variacoes ---

function comPredio(estado: GameState, predio: PredioCompleto): GameState {
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [predio.id]: predio } } };
}

/** Tira a unidade do estado (o especialista morreu, ou nunca houve um). */
export function semAUnidade(estado: GameState, id: string): GameState {
  const porId = { ...estado.unidades.porId };
  delete porId[id];
  return { ...estado, unidades: { porId, ordem: estado.unidades.ordem.filter((x) => x !== id) } };
}

/** Tira o ocupante do predio (a unidade continua no mapa, sem predio). */
export function semOcupante(estado: GameState, id: string): GameState {
  return comPredio(estado, { ...completoDe(estado, id), ocupante: null });
}

/** Apaga a rede inteira: nenhum predio escoa. */
export function semEstrada(estado: GameState): GameState {
  return { ...estado, estradas: {} };
}

export function comEntrada(estado: GameState, id: string, entrada: Record<string, number>): GameState {
  const p = completoDe(estado, id);
  return comPredio(estado, { ...p, estoque: { ...p.estoque, entrada: { ...p.estoque.entrada, ...entrada } } });
}

export function comSaida(estado: GameState, id: string, saida: Record<string, number>): GameState {
  const p = completoDe(estado, id);
  return comPredio(estado, { ...p, estoque: { ...p.estoque, saida } });
}

/** Esvazia a gaveta de saida — o serf da F15b passando por aqui, em uma linha. */
export function comEspacoNaSaida(estado: GameState, id: string): GameState {
  return comSaida(estado, id, {});
}

/**
 * F-T2a: o que ANTES era `comRendimento(dados, 'quarry', n)`. O total deixou de
 * ser um numero do predio, entao encurtar a jazida e encurtar o MAPA: os tiles
 * de `recurso` passam a ser exatamente `tiles`, cada um valendo
 * `rendimentoPorTile`. O caminho continua sendo o dado de verdade com outro
 * numero — nao se fabrica recurso por fixture nem se mexe em `data/` para um
 * teste passar.
 *
 * Um tile de dois vale dois, e e assim que os cenarios de esgotamento da F15a e
 * da F22 continuam medindo o que mediam: `comJazida(gameData, 'rock',
 * [[25, 32]], 2)` da a mesma pedreira de duas pedras que `comRendimento(…, 2)`
 * dava — (25,32) e vizinho do footprint de `q1` em (26,34).
 */
export function comJazida(
  dados: GameData, recurso: string, tiles: readonly (readonly [number, number])[], rendimentoPorTile: number,
): GameData {
  const tipo = dados.recursos.tipos[recurso];
  if (tipo === undefined) throw new Error(`fixture: recurso '${recurso}' nao existe em resources.json`);
  return {
    ...dados,
    recursos: {
      ...dados.recursos,
      tipos: { ...dados.recursos.tipos, [recurso]: { ...tipo, rendimentoPorTile } },
    },
    mapa: { ...dados.mapa, recursos: { ...dados.mapa.recursos, [recurso]: tiles } },
  };
}

/**
 * O MESMO mapa — a geografia de verdade, tile por tile —, so que cada tile
 * valendo `rendimentoPorTile`. E o que permite rodar ate o esgotamento dentro de
 * um teste: com 1 por tile, o total de uma pedreira E a contagem de tiles ao
 * alcance dela, e 13 ciclos cabem onde 195 nao caberiam.
 */
export function comRendimentoPorTile(dados: GameData, recurso: string, rendimentoPorTile: number): GameData {
  const tipo = dados.recursos.tipos[recurso];
  if (tipo === undefined) throw new Error(`fixture: recurso '${recurso}' nao existe em resources.json`);
  return {
    ...dados,
    recursos: {
      ...dados.recursos,
      tipos: { ...dados.recursos.tipos, [recurso]: { ...tipo, rendimentoPorTile } },
    },
  };
}

/** A mesma jazida, em outro alcance: o que muda e QUANTOS tiles o predio ve. */
export function comAlcance(dados: GameData, tipo: string, alcance: number): GameData {
  const receita = dados.producao.receitas[tipo];
  if (receita?.colheita == null) throw new Error(`fixture: '${tipo}' nao colhe`);
  return {
    ...dados,
    producao: {
      ...dados.producao,
      receitas: {
        ...dados.producao.receitas,
        [tipo]: { ...receita, colheita: { ...receita.colheita, alcance } },
      },
    },
  };
}

/**
 * F18 — o mesmo dado com OUTRO custo de plantio. Existe porque o custo do milho
 * e `{}` no dado publicado (arar e semear milho nao gasta mercadoria nenhuma), e
 * o ramo que cobra so tem consumidor de verdade quando o Wineyard chegar: a
 * videira nasce com `timber: 1` por campo, numero que ficou guardado na nota do
 * `wineyard` em `production.json`.
 *
 * Sem isto, a regra de cobrar entraria no jogo sem nenhum teste a exercitar, que
 * e a mesma falha do dado sem leitor.
 */
export function comCustoDePlantio(
  dados: GameData, recurso: string, custo: Readonly<Record<string, number>>,
): GameData {
  const tipo = dados.recursos.tipos[recurso];
  if (tipo?.reposicao == null) throw new Error(`fixture: '${recurso}' nao tem reposicao`);
  return {
    ...dados,
    recursos: {
      ...dados.recursos,
      tipos: {
        ...dados.recursos.tipos,
        [recurso]: { ...tipo, reposicao: { ...tipo.reposicao, custo } },
      },
    },
  };
}
