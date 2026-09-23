/**
 * F15a — cenarios de PRODUCAO. O predio nasce pelo MESMO caminho do jogo
 * (`completarObra`, que semeia `capacidade`, `estoque` e `producao`); so a posse
 * e posta a mao, para nao gastar 40 ticks de `indo_ocupar` em cada teste — o
 * caminho inteiro (escola -> tarefa -> ocupar -> produzir) e o aceite da F15a.
 *
 * Os civis do cenario inicial saem: serf e laborer mexeriam no estoque por conta
 * propria e o que se mede aqui e o relogio do ciclo, sozinho.
 */
import { completarObra, createInitialState } from '../../src/sim/state';
import type { GameEvent, GameState, PredioCompleto, Producao, Unidade } from '../../src/sim/state';
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import { step } from '../../src/sim/tick';
import { chaveDeTile, predioLigadoAoArmazem, tilesDaPorta } from '../../src/sim/estradas';
import type { TileDeGrid } from '../../src/sim/estradas';
import { trabalhadorDoTipo } from '../../src/sim/ocupacao';

const tile = (gx: number, gy: number): TileDeGrid => ({ gx, gy });

function semCivis(estado: GameState): GameState {
  return { ...estado, unidades: { porId: {}, ordem: [] } };
}

function comEstradas(estado: GameState, tiles: readonly TileDeGrid[]): GameState {
  const novas = Object.fromEntries(tiles.map((t) => [chaveDeTile(t), true as const]));
  return { ...estado, estradas: { ...estado.estradas, ...novas } };
}

function comProdutorOcupado(
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
  };
  return {
    ...estado,
    predios: { porId: { ...estado.predios.porId, [predio.id]: predio }, ordem: [...estado.predios.ordem, predio.id] },
    unidades: { porId: { [u.id]: u }, ordem: [u.id] },
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
  let s = semCivis(createInitialState(1));
  s = comProdutorOcupado(s, { tipo: 'quarry', id: 'q1', unidade: 'u1', gx: 26, gy: 34 }, dados);
  s = comEstradas(s, [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)]);
  return exigirLigado(s, 'q1', dados);
}

/** Serraria `s1` (32,34) ocupada por `u2`, ligada, e com a entrada VAZIA. */
export function cenarioDeSerraria(dados: GameData = gameData): GameState {
  let s = semCivis(createInitialState(1));
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
export const veioDe = (estado: GameState, id: string): number | null => producaoDe(estado, id).veio;

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
 * O MESMO `GameData`, com outro rendimento de veio para um tipo. O caminho e o
 * dado de verdade com outro numero — nao se fabrica veio por fixture nem se
 * mexe em `data/production.json` para um teste passar.
 */
export function comRendimento(dados: GameData, tipo: string, rendimento: number): GameData {
  const receita = dados.producao.receitas[tipo];
  if (receita === undefined) throw new Error(`fixture: '${tipo}' nao tem receita`);
  return {
    ...dados,
    producao: {
      ...dados.producao,
      receitas: { ...dados.producao.receitas, [tipo]: { ...receita, rendimentoDoVeio: rendimento } },
    },
  };
}
