import { readFileSync } from 'node:fs';
import { describe, it, expect, afterAll } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameEvent, GameState, PredioCompleto } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import type { GameData } from '../src/sim/data/types';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { estoqueTotal } from '../src/sim/selectors';
import { canPlace } from '../src/sim/placement';
import {
  ehEstrada, indiceDeEstradas, isConnected, predioLigadoAoArmazem, tilesDaPorta,
} from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import { reservadoNaOrigem } from '../src/sim/reservas';
import { comEstradas } from './helpers/jobs-cenario';
import { compararComESemSave, deepFreeze } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';
import { validarTudo } from '../tools/data-rules.js';
import { ARQUIVOS } from '../tools/data-schema.js';
import { LADO_DO_JOGADOR } from '../src/sim/state';

// --- montagem (so teste) ---

const inicial = createInitialState(1);
const CUSTO = gameData.terreno.estrada.custoStonePorTile;
const FRACAO = gameData.terreno.estrada.devolucaoAoDemolir;

const tile = (gx: number, gy: number): TileDeGrid => ({ gx, gy });
const linhaH = (x0: number, x1: number, y: number): TileDeGrid[] =>
  Array.from({ length: x1 - x0 + 1 }, (_, i) => tile(x0 + i, y));
const linhaV = (x: number, y0: number, y1: number): TileDeGrid[] =>
  Array.from({ length: y1 - y0 + 1 }, (_, i) => tile(x, y0 + i));

const construir = (tiles: readonly TileDeGrid[]): Command => ({ type: 'PlaceRoad', tiles });
const demolir = (tiles: readonly TileDeGrid[]): Command => ({ type: 'DemolishRoad', tiles });

function pedraTotal(estado: GameState): number {
  return estoqueTotal(estado).stone ?? 0;
}

function armazens(estado: GameState): PredioCompleto[] {
  return estado.predios.ordem.flatMap((id) => {
    const p = estado.predios.porId[id];
    return p && p.estado === 'completo' && p.tipo === 'storehouse' ? [p] : [];
  });
}

function gaveta(estado: GameState, id: string, nome: 'saida' | 'entrada'): number {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p.estoque[nome].stone ?? 0;
}

/** Substitui o estoque de pedra das duas gavetas de um predio completo. */
function comPedraNoPredio(estado: GameState, id: string, saida: number, entrada: number): GameState {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  const novo: PredioCompleto = { ...p, estoque: { entrada: { stone: entrada }, saida: { stone: saida } } };
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [id]: novo } } };
}

/** Um segundo armazem completo, longe do cenario, com a pedra dada. */
function comArmazemExtra(estado: GameState, saida: number, entrada: number): { estado: GameState; id: string } {
  const id = `extra-${estado.predios.ordem.length}`;
  const predio: PredioCompleto = {
    lado: LADO_DO_JOGADOR, id, tipo: 'storehouse', gx: 50, gy: 50, estado: 'completo', hp: 0,
    capacidade: { entrada: null, saida: null },
    estoque: { entrada: { stone: entrada }, saida: { stone: saida } },
    ocupante: null, producao: null, pausado: false, reparo: false,
  };
  return {
    id,
    estado: {
      ...estado,
      predios: {
        porId: { ...estado.predios.porId, [id]: predio },
        ordem: [...estado.predios.ordem, id],
      },
    },
  };
}

function dadosDeEstrada(alteracao: Partial<GameData['terreno']['estrada']>): GameData {
  return { ...gameData, terreno: { ...gameData.terreno, estrada: { ...gameData.terreno.estrada, ...alteracao } } };
}

function rejeicoes(estado: GameState): GameEvent[] {
  return estado.events.filter((e) => e.type === 'command-rejected');
}

const semEstradas = (estado: GameState): GameState => ({ ...estado, estradas: {} });

/**
 * F18d-1b — a rua JA DE PE, montada direto no estado. `PlaceRoad` deixou de levantar
 * estrada: ele desenha o CANTEIRO e o laborer assenta tile a tile. Quem afirma coisa
 * sobre a REDE (conectar, indice, demolir, placement) monta a rua por aqui; quem
 * afirma coisa sobre o COMANDO segue emitindo `construir`.
 */
const dePe = (estado: GameState, tiles: readonly TileDeGrid[]): GameState => comEstradas(estado, tiles);

/** A pedra que o canteiro COMPROMETEU, somada nos armazens. Vale como medida do
 *  comando no tick em que ele foi dado: nesse tick nenhuma tarefa de carga esta
 *  reclamada ainda, entao toda reserva de pedra e do canteiro. */
const comprometida = (estado: GameState, dados: GameData = gameData): number =>
  armazens(estado).reduce((soma, a) => soma + reservadoNaOrigem(estado, a.id, 'stone', 'saida', dados), 0);

const planejados = (estado: GameState): number => Object.keys(estado.estradasPlanejadas).length;
const assentamentos = (estado: GameState): number =>
  estado.jobs.tarefas.ordem.filter((id) => estado.jobs.tarefas.porId[id]?.tipo === 'assentar-estrada').length;
/** F18g — as cargas de pedra para o canteiro que o quadro abriu (em qualquer estado):
 *  e o que "comprometido" passou a significar, porque a reserva no armazem so nasce
 *  quando um serf reclama, e nunca no comando. Uma por unidade que os tiles pedem,
 *  limitada ao que os armazens tem livre. */
const pedras = (estado: GameState): number =>
  estado.jobs.tarefas.ordem.filter((id) => estado.jobs.tarefas.porId[id]?.tipo === 'pedra-para-canteiro').length;
const origensDasPedras = (estado: GameState): Record<string, number> => {
  const porOrigem: Record<string, number> = {};
  for (const id of estado.jobs.tarefas.ordem) {
    const t = estado.jobs.tarefas.porId[id];
    if (t?.tipo === 'pedra-para-canteiro') porOrigem[t.origem] = (porOrigem[t.origem] ?? 0) + 1;
  }
  return porOrigem;
};

describe('F08 — aceite: estrada em L conecta e remover um tile do meio desconecta', () => {
  const L = [...linhaH(10, 14, 40), ...linhaV(14, 41, 44)]; // (10,40) -> (14,40) -> (14,44)
  const A = tile(10, 40);
  const B = tile(14, 44);

  it('depois de desenhar o L, isConnected(A, B) e verdadeiro', () => {
    const depois = dePe(inicial, L);
    expect(L.every((t) => ehEstrada(depois.estradas, t))).toBe(true);
    expect(isConnected(depois, A, B)).toBe(true);
    expect(isConnected(depois, B, A)).toBe(true);
  });

  it('removido um tile do meio, isConnected(A, B) e falso', () => {
    const desenhado = dePe(inicial, L);
    const partido = step(desenhado, [demolir([tile(12, 40)])]);
    expect(ehEstrada(partido.estradas, tile(12, 40))).toBe(false);
    expect(isConnected(partido, A, B)).toBe(false);
    // os dois pedacos seguem conectados por dentro
    expect(isConnected(partido, tile(10, 40), tile(11, 40))).toBe(true);
    expect(isConnected(partido, tile(13, 40), B)).toBe(true);
  });
});

/**
 * F18d-1b — FIM do desvio escrito na Nota da F08 ("o custo sai no comando"). O comando
 * deixou de debitar: o debito sai quando o laborer assenta o tile.
 *
 * F18g — e deixou tambem de COMPROMETER: a pedra viaja por tile, numa carga de serf
 * (`pedra-para-canteiro`) que so reserva ao ser reclamada, e o comando nao exige
 * pagador — `'sem-pedra'` nao existe mais. O que este bloco guarda e o que nao mudou
 * (quanto custa, de onde sai, tile repetido nao custa) e o que INVERTEU por definicao:
 * comando sem pedra e ACEITO, o canteiro se desenha inteiro, e as cargas nascem so ate
 * onde a pedra livre chega (`pedras`), no tick do comando e nas remendas do gerador.
 */
describe('F08 + F18g — o custo em pedra e PEDIDO no comando e pago tile a tile', () => {
  const L = [...linhaH(10, 14, 40), ...linhaV(14, 41, 44)];

  it('cada tile novo pede exatamente custoStonePorTile do dado em cargas; do estoque nao sai nada, e nada e reservado', () => {
    const depois = step(inicial, [construir(L)]);
    expect(pedras(depois)).toBe(L.length * CUSTO);
    expect(assentamentos(depois)).toBe(L.length);
    expect(comprometida(depois)).toBe(0);             // aberta nao reserva; so o claim do serf
    expect(pedraTotal(depois)).toBe(pedraTotal(inicial)); // quem tira do armazem e a coleta
    const semPedra = (e: GameState): Record<string, number> => {
      const { stone: _stone, ...resto } = estoqueTotal(e);
      void _stone;
      return resto;
    };
    expect(semPedra(depois)).toEqual(semPedra(inicial));
  });

  it('o custo vem do dado: com outro custoStonePorTile injetado, o numero de cargas por tile muda', () => {
    const dados = dadosDeEstrada({ custoStonePorTile: 3 });
    const depois = step(inicial, [construir(L)], dados);
    expect(pedras(depois)).toBe(L.length * 3);
  });

  it('tile que ja esta no canteiro nao custa: repetir o mesmo trecho e no-op (sem tarefa nova, sem evento)', () => {
    const uma = step(inicial, [construir(L)]);
    const duas = step(uma, [construir(L)]);
    // ninguem chegou perto de (10,40) em um tick: o canteiro esta igual, tile a tile
    expect(duas.estradasPlanejadas).toEqual(uma.estradasPlanejadas);
    expect(assentamentos(duas)).toBe(assentamentos(uma));
    expect(pedraTotal(duas)).toBe(pedraTotal(uma));
    expect(rejeicoes(duas)).toEqual([]);
  });

  it('estender um trecho ja desenhado compromete so os tiles novos', () => {
    const uma = step(inicial, [construir(linhaH(10, 12, 40))]);
    const estendida = step(uma, [construir(linhaH(10, 15, 40))]);
    expect(assentamentos(estendida) - assentamentos(uma)).toBe(3);
    expect(planejados(estendida) - planejados(uma)).toBe(3);
  });

  it('tiles repetidos dentro da mesma lista contam uma vez', () => {
    const depois = step(inicial, [construir([tile(10, 40), tile(10, 40), tile(11, 40)])]);
    expect(pedras(depois)).toBe(2 * CUSTO);
    expect(planejados(depois)).toBe(2);
  });

  it('cada carga sai de um armazem com pedra LIVRE na saida; a gaveta entrada nao paga', () => {
    const primeiro = armazens(inicial)[0];
    if (!primeiro) throw new Error('fixture: cenario sem armazem');
    const base = comPedraNoPredio(inicial, primeiro.id, 2, 2);
    const { estado, id: segundo } = comArmazemExtra(base, 10, 0);
    const dados = dadosDeEstrada({ custoStonePorTile: 1 });
    // 5 tiles, 5 cargas: no maximo 2 saem do primeiro (so a SAIDA dele conta — as 2 da
    // `entrada` nao sao reservaveis, F18d-1b) e o resto sai do segundo. Qual dos dois
    // paga cada tile e distancia (`armazemMaisPertoDoTile`), nao ordem de `predios.ordem`.
    const depois = step(estado, [construir(linhaH(10, 14, 40))], dados);
    const porOrigem = origensDasPedras(depois);
    expect(pedras(depois)).toBe(5);
    expect(porOrigem[primeiro.id] ?? 0).toBeLessThanOrEqual(2);
    expect((porOrigem[primeiro.id] ?? 0) + (porOrigem[segundo] ?? 0)).toBe(5);
    expect(gaveta(depois, primeiro.id, 'saida')).toBe(2);   // nada saiu no comando
    expect(gaveta(depois, primeiro.id, 'entrada')).toBe(2); // intocada
    expect(gaveta(depois, segundo, 'saida')).toBe(10);
  });

  it('so armazem paga: pedra na saida de outro tipo de predio nao conta', () => {
    const semArmazem = (() => {
      const outro: PredioCompleto = {
        lado: LADO_DO_JOGADOR, id: 'pedreira', tipo: 'quarry', gx: 0, gy: 0, estado: 'completo', hp: 0,
        capacidade: { entrada: 5, saida: 5 },
        estoque: { entrada: {}, saida: { stone: 100 } },
        ocupante: null, producao: { progresso: 0, plantio: null }, pausado: false, reparo: false,
      };
      return { ...inicial, predios: { porId: { pedreira: outro }, ordem: ['pedreira'] } } as GameState;
    })();
    // F18g: o canteiro se desenha mesmo assim — o feedback e o tile esperando —, so
    // nao nasce carga nenhuma, porque so armazem e origem de pedra.
    const depois = step(semArmazem, [construir([tile(10, 40)])]);
    expect(depois.estradas).toBe(semArmazem.estradas);
    expect(planejados(depois)).toBe(1);
    expect(pedras(depois)).toBe(0);
    expect(rejeicoes(depois)).toEqual([]);
  });

  it('sem pedra para o trecho inteiro o comando e ACEITO (F18g): o canteiro sai inteiro e as cargas param no estoque', () => {
    // Ate a F18d-1b este caso era `sem-pedra` e "nenhuma estrada parcial". Inverteu
    // por decisao do operador (Opcao A da F18g): a reserva e por tile, e o que o
    // estoque limita e quantas cargas nascem AGORA — o resto o gerador remenda quando
    // a pedreira produzir. Nada sai do estoque no comando.
    const primeiro = armazens(inicial)[0];
    if (!primeiro) throw new Error('fixture: cenario sem armazem');
    const pobre = comPedraNoPredio(inicial, primeiro.id, 4 * CUSTO, 0);
    const depois = step(pobre, [construir(linhaH(10, 14, 40))]); // 5 tiles, estoque cobre 4
    expect(depois.estradas).toBe(pobre.estradas);
    expect(planejados(depois)).toBe(5);
    expect(assentamentos(depois)).toBe(5);
    expect(pedras(depois)).toBe(4 * CUSTO);
    expect(pedraTotal(depois)).toBe(pedraTotal(pobre));
    expect(rejeicoes(depois)).toEqual([]);
  });

  it('fronteira exata: pedra igual ao custo abre uma carga por tile; uma a menos deixa um tile sem carga', () => {
    const primeiro = armazens(inicial)[0];
    if (!primeiro) throw new Error('fixture: cenario sem armazem');
    const justo = comPedraNoPredio(inicial, primeiro.id, 5 * CUSTO, 0);
    const aceito = step(justo, [construir(linhaH(10, 14, 40))]);
    expect(planejados(aceito)).toBe(5);
    expect(pedras(aceito)).toBe(5 * CUSTO);
    expect(pedraTotal(aceito)).toBe(5 * CUSTO);   // ainda no armazem: nada saiu no comando
    const curto = comPedraNoPredio(inicial, primeiro.id, 5 * CUSTO - 1, 0);
    const quaseCabe = step(curto, [construir(linhaH(10, 14, 40))]);
    expect(rejeicoes(quaseCabe)).toEqual([]);
    expect(planejados(quaseCabe)).toBe(5);
    expect(pedras(quaseCabe)).toBe(5 * CUSTO - 1);
  });
});

describe('F08 — recusas sao atomicas e dizem por que', () => {
  it('tile fora do mapa: fora-do-mapa, com o tile culpado', () => {
    const { largura } = gameData.terreno.mapaPadrao;
    for (const t of [tile(-1, 5), tile(5, -1), tile(largura, 5), tile(2.5, 5)]) {
      const depois = step(inicial, [construir([t])]);
      expect(depois.estradas).toBe(inicial.estradas);
      expect(rejeicoes(depois)).toEqual([
        { type: 'command-rejected', command: 'PlaceRoad', motivo: 'fora-do-mapa', tile: t },
      ]);
    }
  });

  it('tile sobre um predio: sobreposicao', () => {
    const armazem = armazens(inicial)[0];
    if (!armazem) throw new Error('fixture: cenario sem armazem');
    const depois = step(inicial, [construir([tile(armazem.gx + 1, armazem.gy + 1)])]);
    expect(rejeicoes(depois)).toMatchObject([{ command: 'PlaceRoad', motivo: 'sobreposicao' }]);
  });

  it('tile sobre uma OBRA: sobreposicao', () => {
    const comObra = step(inicial, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 0, gy: 0 }]);
    const depois = step(comObra, [construir([tile(1, 1)])]);
    expect(depois.estradas).toBe(comObra.estradas);
    expect(rejeicoes(depois)).toMatchObject([{ command: 'PlaceRoad', motivo: 'sobreposicao' }]);
  });

  it('um tile ruim no meio nao deixa nenhum tile: e tudo ou nada', () => {
    const armazem = armazens(inicial)[0];
    if (!armazem) throw new Error('fixture: cenario sem armazem');
    const depois = step(inicial, [construir([tile(10, 40), tile(armazem.gx, armazem.gy), tile(11, 40)])]);
    expect(depois.estradas).toBe(inicial.estradas);
    expect(pedraTotal(depois)).toBe(pedraTotal(inicial));
  });

  it('lista vazia: aceita sem custo e sem evento', () => {
    const depois = step(inicial, [construir([])]);
    expect(depois.estradas).toBe(inicial.estradas);
    expect(rejeicoes(depois)).toEqual([]);
  });

  it('predio sobre estrada e recusado por canPlace com o motivo estrada; ao lado, aceito', () => {
    const comEstrada = dePe(inicial, linhaH(0, 5, 0));
    expect(canPlace(comEstrada, 'quarry', 0, 0)).toEqual({ ok: false, motivo: 'estrada' });
    expect(canPlace(comEstrada, 'quarry', 5, 0)).toEqual({ ok: false, motivo: 'estrada' }); // pega o ultimo tile
    expect(canPlace(comEstrada, 'quarry', 0, 1)).toEqual({ ok: true }); // encostado por baixo
    const depois = step(comEstrada, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 2, gy: 0 }]);
    expect(rejeicoes(depois)).toMatchObject([{ command: 'PlaceBlueprint', motivo: 'estrada' }]);
  });

  it('F18d-1b: o CANTEIRO recusa igual — predio sobre tile so desenhado tambem e estrada', () => {
    const comCanteiro = step(inicial, [construir(linhaH(0, 5, 0))]);
    expect(Object.keys(comCanteiro.estradas)).toEqual([]); // ainda nao ha rua nenhuma de pe
    expect(canPlace(comCanteiro, 'quarry', 0, 0)).toEqual({ ok: false, motivo: 'estrada' });
    expect(canPlace(comCanteiro, 'quarry', 0, 1)).toEqual({ ok: true });
  });
});

describe('F08 — conectividade: 8 direcoes sem cortar quina (F18e), sobre o que esta de pe', () => {
  // Ate a F18e a regra escrita aqui era "diagonal NAO liga", interpretacao
  // conservadora da F08 porque o GDD nao respondia. O operador respondeu
  // (jogo original): a diagonal LIGA, e o que nao pode e cortar a quina de um
  // predio. O teste afirma a regra nova nos dois sentidos — o que liga e o que
  // deixa de ligar — e nao so o que mudou.
  it('diagonal liga; a quina de predio corta', () => {
    const depois = dePe(inicial, [tile(10, 40), tile(11, 41)]);
    expect(isConnected(depois, tile(10, 40), tile(11, 41))).toBe(true);

    // obra 3x2 em (11,39): ocupa x 11..13, y 39..40 — tapa a quina (11,40) e
    // nenhum dos dois tiles de estrada.
    const comQuina = step(depois, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 11, gy: 39 }]);
    expect(rejeicoes(comQuina)).toEqual([]);
    expect(isConnected(comQuina, tile(10, 40), tile(11, 41))).toBe(false);

    // e a quina e regra de LIGACAO, nao de passagem: pelo contorno liga de novo.
    const contornando = dePe(comQuina, [tile(10, 41)]);
    expect(isConnected(contornando, tile(10, 40), tile(11, 41))).toBe(true);
  });

  it('dois trechos separados nao ligam; o tile que falta os une', () => {
    const dois = dePe(dePe(inicial, linhaH(10, 12, 40)), linhaH(14, 16, 40));
    expect(isConnected(dois, tile(10, 40), tile(16, 40))).toBe(false);
    const unidos = dePe(dois, [tile(13, 40)]);
    expect(isConnected(unidos, tile(10, 40), tile(16, 40))).toBe(true);
  });

  it('tile que nao e estrada nunca esta conectado; o mesmo tile de estrada esta', () => {
    const depois = dePe(inicial, linhaH(10, 12, 40));
    expect(isConnected(depois, tile(10, 40), tile(10, 41))).toBe(false);
    expect(isConnected(depois, tile(20, 20), tile(20, 20))).toBe(false);
    expect(isConnected(depois, tile(10, 40), tile(10, 40))).toBe(true);
  });

  it('o indice de componentes depende so do CONJUNTO de tiles, nao da ordem em que vieram', () => {
    const trecho = [tile(10, 40), tile(11, 40), tile(12, 40), tile(12, 41)];
    const a = dePe(inicial, trecho);
    const b = dePe(inicial, [...trecho].reverse());
    expect(indiceDeEstradas(a).componentes).toEqual(indiceDeEstradas(b).componentes);
  });
});

describe('F08 — consulta O(1) entre mudancas (estrutural, sem teste de tempo)', () => {
  it('o indice e construido uma vez por par (estradas, predios)', () => {
    const estado = dePe(inicial, linhaH(10, 14, 40));
    expect(indiceDeEstradas(estado)).toBe(indiceDeEstradas(estado));
  });

  it('step sem comando de estrada nem predio novo reaproveita o indice entre ticks', () => {
    let estado = dePe(inicial, linhaH(10, 14, 40));
    const antes = estado.estradas;
    const indice = indiceDeEstradas(estado);
    for (let i = 0; i < 20; i++) estado = step(estado, []);
    expect(estado.estradas).toBe(antes);
    // a obra do cenario progride e `predios.porId` muda; `predios.ordem` nao, e
    // e ele a chave — senao o indice seria reconstruido a cada tick.
    expect(indiceDeEstradas(estado)).toBe(indice);
  });

  it('um tile assentado troca a referencia (e o indice)', () => {
    const uma = dePe(inicial, linhaH(10, 14, 40));
    const duas = dePe(uma, [tile(15, 40)]);
    expect(duas.estradas).not.toBe(uma.estradas);
    expect(indiceDeEstradas(duas)).not.toBe(indiceDeEstradas(uma));
  });

  it('predio novo tambem troca o indice: desde a F18e a quina faz a ligacao depender de predio', () => {
    const uma = dePe(inicial, linhaH(10, 14, 40));
    const comPredio = step(uma, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 0, gy: 0 }]);
    expect(comPredio.estradas).toBe(uma.estradas);
    expect(indiceDeEstradas(comPredio)).not.toBe(indiceDeEstradas(uma));
  });
});

describe('F08 — ponto 4: predio que fica sem ligacao nao muda; a ligacao e derivada', () => {
  const armazem = armazens(inicial)[0];
  const escola = inicial.predios.ordem
    .map((id) => inicial.predios.porId[id])
    .find((p) => p?.tipo === 'schoolhouse');
  if (!armazem || !escola || escola.estado !== 'completo') throw new Error('fixture: cenario sem armazem/escola');
  // a borda sul de cada um e a "porta": uma linha de estrada ao longo das duas
  const yPorta = armazem.gy + 3; // footprint 3x3 no cenario; conferido abaixo contra tilesDaPorta
  const todasAsPortas = [...tilesDaPorta(armazem, gameData), ...tilesDaPorta(escola, gameData)];
  const xs = todasAsPortas.map((t) => t.gx);
  const rua = linhaH(Math.min(...xs), Math.max(...xs), yPorta);

  it('tilesDaPorta e a borda sul inteira do footprint, derivada do dado', () => {
    const [largura] = gameData.predios.find((p) => p.id === 'storehouse')?.tamanho ?? [];
    expect(tilesDaPorta(armazem, gameData)).toHaveLength(largura ?? -1);
    expect(tilesDaPorta(armazem, gameData).every((t) => t.gy === yPorta)).toBe(true);
  });

  it('com a rua ao longo das duas bordas sul, os dois estao ligados ao armazem', () => {
    const comRua = dePe(inicial, rua);
    expect(predioLigadoAoArmazem(comRua, armazem, gameData)).toBe(true);
    expect(predioLigadoAoArmazem(comRua, escola, gameData)).toBe(true);
  });

  it('sem estrada nenhum esta ligado', () => {
    expect(predioLigadoAoArmazem(inicial, escola, gameData)).toBe(false);
    expect(predioLigadoAoArmazem(inicial, armazem, gameData)).toBe(false);
  });

  it('demolir um trecho do meio desliga a escola — e o predio segue IDENTICO, sem campo novo', () => {
    const comRua = dePe(inicial, rua);
    const meio = rua.filter((t) => t.gx > armazem.gx + 2 && t.gx < escola.gx);
    expect(meio.length).toBeGreaterThan(0);
    const partida = step(comRua, [demolir(meio)]);
    expect(predioLigadoAoArmazem(partida, escola, gameData)).toBe(false);
    expect(predioLigadoAoArmazem(partida, armazem, gameData)).toBe(true); // a propria porta segue de pe
    // nada aconteceu com o predio: mesmo objeto, mesmo estado, mesmo estoque
    expect(partida.predios.porId[escola.id]).toBe(comRua.predios.porId[escola.id]);
    expect(partida.predios.ordem).toEqual(comRua.predios.ordem);
    // "desligado" nao e um campo: as chaves do estado sao as mesmas
    expect(Object.keys(partida).sort()).toEqual(Object.keys(comRua).sort());
    // redesenhar reconecta
    const refeita = dePe(partida, meio);
    expect(predioLigadoAoArmazem(refeita, escola, gameData)).toBe(true);
  });

  it('estrada so num lado que nao e o sul nao liga', () => {
    const comObra = step(inicial, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 0, gy: 0 }]);
    const obra = comObra.predios.porId[comObra.predios.ordem[comObra.predios.ordem.length - 1] ?? ''];
    if (!obra) throw new Error('fixture: obra ausente');
    const aoLado = dePe(comObra, linhaV(3, 0, 1)); // a direita do footprint, nao ao sul
    expect(predioLigadoAoArmazem(aoLado, obra, gameData)).toBe(false);
  });
});

describe('F08 — demolir devolve pedra (decisao do operador): floor(removidos x devolucaoAoDemolir)', () => {
  const trecho = linhaH(10, 15, 40); // 6 tiles

  it('2 tiles demolidos devolvem 1 pedra; o valor vem do dado', () => {
    expect(FRACAO).toBe(0.5);
    const desenhado = dePe(inicial, trecho);
    const demolido = step(desenhado, [demolir([tile(11, 40), tile(12, 40)])]);
    expect(pedraTotal(demolido) - pedraTotal(desenhado)).toBe(Math.floor(2 * FRACAO));
    expect(pedraTotal(demolido) - pedraTotal(desenhado)).toBe(1);
  });

  it('1 tile devolve 0: o arredondamento e por comando', () => {
    const desenhado = dePe(inicial, trecho);
    const demolido = step(desenhado, [demolir([tile(11, 40)])]);
    expect(pedraTotal(demolido)).toBe(pedraTotal(desenhado));
    expect(ehEstrada(demolido.estradas, tile(11, 40))).toBe(false);
  });

  it('com outra fracao injetada, a devolucao muda (0 nada, 1 tudo)', () => {
    const desenhado = dePe(inicial, trecho);
    const tiles = [tile(11, 40), tile(12, 40), tile(13, 40)];
    expect(pedraTotal(step(desenhado, [demolir(tiles)], dadosDeEstrada({ devolucaoAoDemolir: 0 }))))
      .toBe(pedraTotal(desenhado));
    expect(pedraTotal(step(desenhado, [demolir(tiles)], dadosDeEstrada({ devolucaoAoDemolir: 1 }))))
      .toBe(pedraTotal(desenhado) + 3);
  });

  it('a pedra volta ao MESMO armazem de onde sairia o debito: o primeiro completo, gaveta saida', () => {
    const primeiro = armazens(inicial)[0];
    if (!primeiro) throw new Error('fixture: cenario sem armazem');
    const { estado, id: segundo } = comArmazemExtra(inicial, 7, 0);
    const desenhado = dePe(estado, trecho);
    const saidaAntes = gaveta(desenhado, primeiro.id, 'saida');
    const segundoAntes = gaveta(desenhado, segundo, 'saida');
    const demolido = step(desenhado, [demolir([tile(11, 40), tile(12, 40)])]);
    expect(gaveta(demolido, primeiro.id, 'saida')).toBe(saidaAntes + 1);
    expect(gaveta(demolido, segundo, 'saida')).toBe(segundoAntes);
  });

  it('sem armazem completo, nada e devolvido (a pedra se perde) e a estrada sai mesmo assim', () => {
    const sem: GameState = {
      ...inicial,
      predios: { porId: {}, ordem: [] },
      estradas: { '10,40': true, '11,40': true },
    };
    const depois = step(sem, [demolir([tile(10, 40), tile(11, 40)])]);
    expect(Object.keys(depois.estradas)).toEqual([]);
    expect(pedraTotal(depois)).toBe(0);
  });

  it('demolir tile que nao e estrada e idempotente: mesma referencia, sem evento', () => {
    const depois = step(inicial, [demolir([tile(10, 40)])]);
    expect(depois.estradas).toBe(inicial.estradas);
    expect(rejeicoes(depois)).toEqual([]);
  });

  it('demolir a rua inteira devolve floor(novos x fracao) — a outra metade do saldo e do assentamento', () => {
    // F18d-1b: o saldo do ciclo inteiro (levantar E demolir) passou a depender do
    // laborer, e e medido de ponta a ponta em `tests/F18d-1b-aceite.test.ts`. Aqui
    // fica so a metade que o comando ainda resolve sozinho: a devolucao.
    const desenhado = dePe(inicial, trecho);
    const desfeito = step(desenhado, [demolir(trecho)]);
    expect(pedraTotal(desfeito) - pedraTotal(desenhado)).toBe(Math.floor(trecho.length * FRACAO));
    expect(Object.keys(desfeito.estradas)).toEqual([]);
  });
});

describe('F08 — determinismo e pureza com os comandos de estrada', () => {
  const L = [...linhaH(10, 14, 40), ...linhaV(14, 41, 44)];

  it('a mesma lista de comandos da o mesmo estado, byte a byte', () => {
    const lista = [construir(L), demolir([tile(12, 40)])];
    expect(JSON.stringify(step(inicial, lista))).toBe(JSON.stringify(step(inicial, lista)));
  });

  it('com save/load no meio chega ao mesmo JSON, estradas incluidas', () => {
    const { direto, comSave } = compararComESemSave({
      seed: 1,
      totalTicks: 12,
      saveAtTick: 6,
      comandosNoTick: (t) => {
        if (t === 0) return [construir(L)];
        if (t === 8) return [demolir([tile(12, 40), tile(13, 40)])];
        return [];
      },
    });
    expect(comSave).toBe(direto);
    // F18d-1b: em 12 ticks o laborer ainda nao chegou ao trecho; o que atravessa o save
    // e o CANTEIRO (e as tarefas dele), e e isso que o teste precisa nao ver vazio.
    const noFim = JSON.parse(direto) as GameState;
    expect(Object.keys(noFim.estradasPlanejadas).length + Object.keys(noFim.estradas).length)
      .toBeGreaterThan(0);
  });

  it('step nao muta a lista de comandos nem o estado congelados', () => {
    const comandos = deepFreeze([construir(L), demolir([tile(12, 40)])]);
    expect(() => step(deepFreeze(createInitialState(1)), comandos)).not.toThrow();
  });

  it('o estado com estradas sobrevive ao JSON', () => {
    const estado = dePe(inicial, L);
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
    expect(semEstradas(estado).estradas).toEqual({});
  });
});

describe('F08 — validate:data: estrada.devolucaoAoDemolir', () => {
  function dadosReaisComDevolucao(valor: unknown): Record<string, unknown> {
    const dados: Record<string, unknown> = {};
    for (const nome of ARQUIVOS) dados[nome] = JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'));
    (dados.terrain as { estrada: { devolucaoAoDemolir: unknown } }).estrada.devolucaoAoDemolir = valor;
    return dados;
  }
  const errosDaRegra = (valor: unknown): string[] =>
    validarTudo(dadosReaisComDevolucao(valor)).filter((e) => e.startsWith('terreno/estrada'));

  it('o dado real passa', () => {
    expect(validarTudo(dadosReaisComDevolucao(FRACAO))).toEqual([]);
  });

  it.each([0, 0.5, 1])('%s passa', (v) => {
    expect(errosDaRegra(v)).toEqual([]);
  });

  it.each([1.5, -0.1, '0.5', null, Number.NaN])('%s reprova', (v) => {
    expect(errosDaRegra(v)).toHaveLength(1);
  });
});

afterAll(() => {
  const L = [...linhaH(10, 14, 40), ...linhaV(14, 41, 44)];
  const A = tile(10, 40);
  const B = tile(14, 44);
  const desenhado = dePe(inicial, L);
  const partido = step(desenhado, [demolir([tile(12, 40)])]);

  // ponto 4: rua ao longo da borda sul do armazem e da escola
  const armazem = armazens(inicial)[0];
  const escola = inicial.predios.ordem
    .map((id) => inicial.predios.porId[id])
    .find((p) => p?.tipo === 'schoolhouse');
  if (!armazem || !escola || escola.estado !== 'completo') throw new Error('fixture: cenario sem armazem/escola');
  const portas = [...tilesDaPorta(armazem, gameData), ...tilesDaPorta(escola, gameData)];
  const xs = portas.map((p) => p.gx);
  const yRua = armazem.gy + 3;
  const rua = linhaH(Math.min(...xs), Math.max(...xs), yRua);
  const comRua = dePe(inicial, rua);
  const meio = rua.filter((p) => p.gx > armazem.gx + 2 && p.gx < escola.gx);
  const desligada = step(comRua, [demolir(meio)]);

  // devolucao: 2 tiles demolidos
  const dois = step(desenhado, [demolir([tile(11, 40), tile(12, 40)])]);
  const comprometido = step(inicial, [construir(L)]);

  const estadoParado = step(desenhado, []);

  gravarEvidencia('F08', {
    feature: 'F08-estradas',
    // VERIFICADO por teste headless: o aceite escrito no BUILD_PLAN.md.
    aceite: {
      estradaEmL: {
        tiles: L.length,
        isConnectedDeAParaB: isConnected(desenhado, A, B),
      },
      depoisDeRemoverUmTileDoMeio: {
        tileRemovido: tile(12, 40),
        isConnectedDeAParaB: isConnected(partido, A, B),
      },
    },
    // F18d-1b encerrou o desvio da F08: o comando COMPROMETE a pedra (uma tarefa de
    // assentamento por tile, reservando na origem) e o debito sai quando o laborer
    // assenta. O saldo de ponta a ponta esta em test-output/F18d-1b.json.
    custo: {
      custoStonePorTileNoDado: CUSTO,
      tiles: L.length,
      pedraAntes: pedraTotal(inicial),
      pedraDepoisDoComando: pedraTotal(comprometido),
      comprometidoPeloComando: comprometida(comprometido),
      comprometidoIgualATilesVezesCusto: comprometida(comprometido) === L.length * CUSTO,
      saiuDoEstoqueNoComando: pedraTotal(inicial) - pedraTotal(comprometido),
    },
    // Decisao do operador: demolir devolve floor(removidos x fracao); 2 tiles -> 1.
    demolicao: {
      devolucaoAoDemolirNoDado: FRACAO,
      tilesDemolidos: 2,
      pedraDevolvida: pedraTotal(dois) - pedraTotal(desenhado),
      esperado: Math.floor(2 * FRACAO),
    },
    // Ponto 4: o predio que fica sem ligacao nao muda; "desligado" e derivado.
    prediosSemLigacao: {
      escolaLigadaAntesDeDemolir: predioLigadoAoArmazem(comRua, escola, gameData),
      escolaLigadaDepoisDeDemolirTrechoDoMeio: predioLigadoAoArmazem(desligada, escola, gameData),
      predioIdenticoDepoisDeDemolir: desligada.predios.porId[escola.id] === comRua.predios.porId[escola.id],
      chavesDoEstadoIguais: JSON.stringify(Object.keys(desligada).sort()) === JSON.stringify(Object.keys(comRua).sort()),
    },
    // Consulta O(1) entre mudancas: estrutural, sem teste de tempo.
    consultaEntreMudancas: {
      indiceReaproveitadoParaAMesmaReferencia: indiceDeEstradas(desenhado) === indiceDeEstradas(desenhado),
      referenciaDeEstradasMantidaSemComandoDeEstrada: estadoParado.estradas === desenhado.estradas,
    },
    conectividade: 'oito direcoes, sem cortar quina de predio (F18e substituiu a interpretacao conservadora da F08)',
    // Verificacao visual e separada, fora do npm run verify (CLAUDE.md §8).
    verificacaoVisual: 'fora deste arquivo: npm run shot -- F08 (test-output/F08-shot.json)',
  });
});
