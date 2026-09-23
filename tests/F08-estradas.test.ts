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
import { compararComESemSave, deepFreeze } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';
import { validarTudo } from '../tools/data-rules.js';
import { ARQUIVOS } from '../tools/data-schema.js';

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
    id, tipo: 'storehouse', gx: 50, gy: 50, estado: 'completo', hp: 0,
    capacidade: { entrada: null, saida: null },
    estoque: { entrada: { stone: entrada }, saida: { stone: saida } },
    ocupante: null, producao: null,
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

describe('F08 — aceite: estrada em L conecta e remover um tile do meio desconecta', () => {
  const L = [...linhaH(10, 14, 40), ...linhaV(14, 41, 44)]; // (10,40) -> (14,40) -> (14,44)
  const A = tile(10, 40);
  const B = tile(14, 44);

  it('depois de desenhar o L, isConnected(A, B) e verdadeiro', () => {
    const depois = step(inicial, [construir(L)]);
    expect(L.every((t) => ehEstrada(depois.estradas, t))).toBe(true);
    expect(isConnected(depois, A, B)).toBe(true);
    expect(isConnected(depois, B, A)).toBe(true);
  });

  it('removido um tile do meio, isConnected(A, B) e falso', () => {
    const desenhado = step(inicial, [construir(L)]);
    const partido = step(desenhado, [demolir([tile(12, 40)])]);
    expect(ehEstrada(partido.estradas, tile(12, 40))).toBe(false);
    expect(isConnected(partido, A, B)).toBe(false);
    // os dois pedacos seguem conectados por dentro
    expect(isConnected(partido, tile(10, 40), tile(11, 40))).toBe(true);
    expect(isConnected(partido, tile(13, 40), B)).toBe(true);
  });
});

describe('F08 — o custo em pedra sai NO COMANDO, do armazem', () => {
  const L = [...linhaH(10, 14, 40), ...linhaV(14, 41, 44)];

  it('a pedra cai exatamente novos x custoStonePorTile do dado; mais nada cai', () => {
    const depois = step(inicial, [construir(L)]);
    expect(pedraTotal(inicial) - pedraTotal(depois)).toBe(L.length * CUSTO);
    const semPedra = (e: GameState): Record<string, number> => {
      const { stone: _stone, ...resto } = estoqueTotal(e);
      void _stone;
      return resto;
    };
    expect(semPedra(depois)).toEqual(semPedra(inicial));
  });

  it('o custo vem do dado: com outro custoStonePorTile injetado, o debito muda', () => {
    const depois = step(inicial, [construir(L)], dadosDeEstrada({ custoStonePorTile: 3 }));
    expect(pedraTotal(inicial) - pedraTotal(depois)).toBe(L.length * 3);
  });

  it('tile que ja e estrada nao custa: repetir o mesmo trecho e no-op (mesma referencia, sem evento)', () => {
    const uma = step(inicial, [construir(L)]);
    const duas = step(uma, [construir(L)]);
    expect(duas.estradas).toBe(uma.estradas);
    expect(pedraTotal(duas)).toBe(pedraTotal(uma));
    expect(rejeicoes(duas)).toEqual([]);
  });

  it('estender um trecho existente cobra so os tiles novos', () => {
    const uma = step(inicial, [construir(linhaH(10, 12, 40))]);
    const estendida = step(uma, [construir(linhaH(10, 15, 40))]);
    expect(pedraTotal(uma) - pedraTotal(estendida)).toBe(3 * CUSTO);
  });

  it('tiles repetidos dentro da mesma lista contam uma vez', () => {
    const depois = step(inicial, [construir([tile(10, 40), tile(10, 40), tile(11, 40)])]);
    expect(pedraTotal(inicial) - pedraTotal(depois)).toBe(2 * CUSTO);
  });

  it('debita gaveta saida antes de entrada e um armazem depois do outro, em predios.ordem', () => {
    const primeiro = armazens(inicial)[0];
    if (!primeiro) throw new Error('fixture: cenario sem armazem');
    const base = comPedraNoPredio(inicial, primeiro.id, 2, 2);
    const { estado, id: segundo } = comArmazemExtra(base, 10, 0);
    // 5 tiles: primeiro armazem (saida 2, entrada 2) esgota, o segundo cede 1
    const depois = step(estado, [construir(linhaH(10, 14, 40))], dadosDeEstrada({ custoStonePorTile: 1 }));
    expect(gaveta(depois, primeiro.id, 'saida')).toBe(0);
    expect(gaveta(depois, primeiro.id, 'entrada')).toBe(0);
    expect(gaveta(depois, segundo, 'saida')).toBe(9);
  });

  it('so armazem paga: pedra na saida de outro tipo de predio nao conta', () => {
    const semArmazem = (() => {
      const outro: PredioCompleto = {
        id: 'pedreira', tipo: 'quarry', gx: 0, gy: 0, estado: 'completo', hp: 0,
        capacidade: { entrada: 5, saida: 5 },
        estoque: { entrada: {}, saida: { stone: 100 } },
        ocupante: null, producao: { progresso: 0, veio: null },
      };
      return { ...inicial, predios: { porId: { pedreira: outro }, ordem: ['pedreira'] } } as GameState;
    })();
    const depois = step(semArmazem, [construir([tile(10, 40)])]);
    expect(depois.estradas).toBe(semArmazem.estradas);
    expect(rejeicoes(depois)).toMatchObject([{ command: 'PlaceRoad', motivo: 'sem-pedra' }]);
  });

  it('sem pedra suficiente o comando inteiro e recusado: nenhuma estrada parcial', () => {
    const primeiro = armazens(inicial)[0];
    if (!primeiro) throw new Error('fixture: cenario sem armazem');
    const pobre = comPedraNoPredio(inicial, primeiro.id, 4 * CUSTO, 0);
    const depois = step(pobre, [construir(linhaH(10, 14, 40))]); // 5 tiles, so cobre 4
    expect(depois.estradas).toBe(pobre.estradas);
    expect(pedraTotal(depois)).toBe(pedraTotal(pobre));
    expect(rejeicoes(depois)).toEqual([
      { type: 'command-rejected', command: 'PlaceRoad', motivo: 'sem-pedra', tile: null },
    ]);
  });

  it('fronteira exata: pedra igual ao custo aceita; uma a menos recusa', () => {
    const primeiro = armazens(inicial)[0];
    if (!primeiro) throw new Error('fixture: cenario sem armazem');
    const justo = comPedraNoPredio(inicial, primeiro.id, 5 * CUSTO, 0);
    const aceito = step(justo, [construir(linhaH(10, 14, 40))]);
    expect(Object.keys(aceito.estradas)).toHaveLength(5);
    expect(pedraTotal(aceito)).toBe(0);
    const curto = comPedraNoPredio(inicial, primeiro.id, 5 * CUSTO - 1, 0);
    expect(rejeicoes(step(curto, [construir(linhaH(10, 14, 40))]))).toHaveLength(1);
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
    const comEstrada = step(inicial, [construir(linhaH(0, 5, 0))]);
    expect(canPlace(comEstrada, 'quarry', 0, 0)).toEqual({ ok: false, motivo: 'estrada' });
    expect(canPlace(comEstrada, 'quarry', 5, 0)).toEqual({ ok: false, motivo: 'estrada' }); // pega o ultimo tile
    expect(canPlace(comEstrada, 'quarry', 0, 1)).toEqual({ ok: true }); // encostado por baixo
    const depois = step(comEstrada, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 2, gy: 0 }]);
    expect(rejeicoes(depois)).toMatchObject([{ command: 'PlaceBlueprint', motivo: 'estrada' }]);
  });
});

describe('F08 — conectividade: 4 direcoes, sobre o que esta de pe', () => {
  it('diagonal NAO liga', () => {
    const depois = step(inicial, [construir([tile(10, 40), tile(11, 41)])]);
    expect(isConnected(depois, tile(10, 40), tile(11, 41))).toBe(false);
  });

  it('dois trechos separados nao ligam; o tile que falta os une', () => {
    const dois = step(inicial, [construir(linhaH(10, 12, 40)), construir(linhaH(14, 16, 40))]);
    expect(isConnected(dois, tile(10, 40), tile(16, 40))).toBe(false);
    const unidos = step(dois, [construir([tile(13, 40)])]);
    expect(isConnected(unidos, tile(10, 40), tile(16, 40))).toBe(true);
  });

  it('tile que nao e estrada nunca esta conectado; o mesmo tile de estrada esta', () => {
    const depois = step(inicial, [construir(linhaH(10, 12, 40))]);
    expect(isConnected(depois, tile(10, 40), tile(10, 41))).toBe(false);
    expect(isConnected(depois, tile(20, 20), tile(20, 20))).toBe(false);
    expect(isConnected(depois, tile(10, 40), tile(10, 40))).toBe(true);
  });

  it('o indice de componentes depende so do CONJUNTO de tiles, nao da ordem em que vieram', () => {
    const trecho = [tile(10, 40), tile(11, 40), tile(12, 40), tile(12, 41)];
    const a = step(inicial, [construir(trecho)]);
    const b = step(inicial, [construir([...trecho].reverse())]);
    expect(indiceDeEstradas(a.estradas).componentes).toEqual(indiceDeEstradas(b.estradas).componentes);
  });
});

describe('F08 — consulta O(1) entre mudancas (estrutural, sem teste de tempo)', () => {
  it('o indice e construido uma vez por referencia de estradas', () => {
    const estado = step(inicial, [construir(linhaH(10, 14, 40))]);
    expect(indiceDeEstradas(estado.estradas)).toBe(indiceDeEstradas(estado.estradas));
  });

  it('step sem comando de estrada carrega a MESMA referencia, entao o indice e reaproveitado entre ticks', () => {
    let estado = step(inicial, [construir(linhaH(10, 14, 40))]);
    const antes = estado.estradas;
    const indice = indiceDeEstradas(antes);
    estado = step(estado, []);
    estado = step(estado, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 0, gy: 0 }]);
    for (let i = 0; i < 20; i++) estado = step(estado, []);
    expect(estado.estradas).toBe(antes);
    expect(indiceDeEstradas(estado.estradas)).toBe(indice);
  });

  it('um comando de estrada que muda algo troca a referencia (e o indice)', () => {
    const uma = step(inicial, [construir(linhaH(10, 14, 40))]);
    const duas = step(uma, [construir([tile(15, 40)])]);
    expect(duas.estradas).not.toBe(uma.estradas);
    expect(indiceDeEstradas(duas.estradas)).not.toBe(indiceDeEstradas(uma.estradas));
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
    const comRua = step(inicial, [construir(rua)]);
    expect(predioLigadoAoArmazem(comRua, armazem, gameData)).toBe(true);
    expect(predioLigadoAoArmazem(comRua, escola, gameData)).toBe(true);
  });

  it('sem estrada nenhum esta ligado', () => {
    expect(predioLigadoAoArmazem(inicial, escola, gameData)).toBe(false);
    expect(predioLigadoAoArmazem(inicial, armazem, gameData)).toBe(false);
  });

  it('demolir um trecho do meio desliga a escola — e o predio segue IDENTICO, sem campo novo', () => {
    const comRua = step(inicial, [construir(rua)]);
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
    const refeita = step(partida, [construir(meio)]);
    expect(predioLigadoAoArmazem(refeita, escola, gameData)).toBe(true);
  });

  it('estrada so num lado que nao e o sul nao liga', () => {
    const comObra = step(inicial, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 0, gy: 0 }]);
    const obra = comObra.predios.porId[comObra.predios.ordem[comObra.predios.ordem.length - 1] ?? ''];
    if (!obra) throw new Error('fixture: obra ausente');
    const aoLado = step(comObra, [construir(linhaV(3, 0, 1))]); // a direita do footprint, nao ao sul
    expect(predioLigadoAoArmazem(aoLado, obra, gameData)).toBe(false);
  });
});

describe('F08 — demolir devolve pedra (decisao do operador): floor(removidos x devolucaoAoDemolir)', () => {
  const trecho = linhaH(10, 15, 40); // 6 tiles

  it('2 tiles demolidos devolvem 1 pedra; o valor vem do dado', () => {
    expect(FRACAO).toBe(0.5);
    const desenhado = step(inicial, [construir(trecho)]);
    const demolido = step(desenhado, [demolir([tile(11, 40), tile(12, 40)])]);
    expect(pedraTotal(demolido) - pedraTotal(desenhado)).toBe(Math.floor(2 * FRACAO));
    expect(pedraTotal(demolido) - pedraTotal(desenhado)).toBe(1);
  });

  it('1 tile devolve 0: o arredondamento e por comando', () => {
    const desenhado = step(inicial, [construir(trecho)]);
    const demolido = step(desenhado, [demolir([tile(11, 40)])]);
    expect(pedraTotal(demolido)).toBe(pedraTotal(desenhado));
    expect(ehEstrada(demolido.estradas, tile(11, 40))).toBe(false);
  });

  it('com outra fracao injetada, a devolucao muda (0 nada, 1 tudo)', () => {
    const desenhado = step(inicial, [construir(trecho)]);
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
    const desenhado = step(estado, [construir(trecho)]);
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

  it('construir e demolir o mesmo trecho custa novos - floor(novos x fracao)', () => {
    const desenhado = step(inicial, [construir(trecho)]);
    const desfeito = step(desenhado, [demolir(trecho)]);
    expect(pedraTotal(inicial) - pedraTotal(desfeito))
      .toBe(trecho.length * CUSTO - Math.floor(trecho.length * FRACAO));
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
    expect(Object.keys((JSON.parse(direto) as GameState).estradas).length).toBeGreaterThan(0);
  });

  it('step nao muta a lista de comandos nem o estado congelados', () => {
    const comandos = deepFreeze([construir(L), demolir([tile(12, 40)])]);
    expect(() => step(deepFreeze(createInitialState(1)), comandos)).not.toThrow();
  });

  it('o estado com estradas sobrevive ao JSON', () => {
    const estado = step(inicial, [construir(L)]);
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
  const desenhado = step(inicial, [construir(L)]);
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
  const comRua = step(inicial, [construir(rua)]);
  const meio = rua.filter((p) => p.gx > armazem.gx + 2 && p.gx < escola.gx);
  const desligada = step(comRua, [demolir(meio)]);

  // devolucao: 2 tiles demolidos
  const dois = step(desenhado, [demolir([tile(11, 40), tile(12, 40)])]);

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
    // O custo SAI no comando (desvio provisorio da regra "sai na entrega"; BUILD_PLAN, nota da F08).
    custo: {
      custoStonePorTileNoDado: CUSTO,
      tiles: L.length,
      pedraAntes: pedraTotal(inicial),
      pedraDepois: pedraTotal(desenhado),
      debitado: pedraTotal(inicial) - pedraTotal(desenhado),
      debitadoIgualATilesVezesCusto: pedraTotal(inicial) - pedraTotal(desenhado) === L.length * CUSTO,
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
      indiceReaproveitadoParaAMesmaReferencia: indiceDeEstradas(desenhado.estradas) === indiceDeEstradas(desenhado.estradas),
      referenciaDeEstradasMantidaSemComandoDeEstrada: estadoParado.estradas === desenhado.estradas,
    },
    conectividade: 'quatro direcoes (diagonal nao liga) — GDD nao responde; interpretacao conservadora',
    // Verificacao visual e separada, fora do npm run verify (CLAUDE.md §8).
    verificacaoVisual: 'fora deste arquivo: npm run shot -- F08 (test-output/F08-shot.json)',
  });
});
