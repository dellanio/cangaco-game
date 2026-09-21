/**
 * F10 — A* em grid, vizinhanca 8, custo em ticks inteiros, cache por par.
 *
 * A prova principal e um ORACULO independente: um relaxamento em fila (Bellman-Ford,
 * sem heap e sem heuristica) com as mesmas regras e as mesmas tabelas de custo. Se o A*
 * usasse uma heuristica inadmissivel ou tivesse um erro de vizinhanca, o custo divergiria
 * do oraculo em algum dos mapas sorteados.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState } from '../src/sim/state';
import { chaveDeTile, ehEstrada, isConnected } from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import { caixaDoPredio } from '../src/sim/footprint';
import { buscarCaminho, estatisticasDeBusca, zerarEstatisticasDeBusca } from '../src/sim/pathfinding';
import type { ModoDeBusca } from '../src/sim/pathfinding';
import { createRng, nextInt } from '../src/sim/rng';
import type { RngState } from '../src/sim/rng';
import { deepFreeze } from './helpers/determinism';
import {
  armazemDoCenario, comArmazemCompleto, comEstradas, comObra, comPedraNaSaida, inicial, linhaH, linhaV, tile,
} from './helpers/jobs-cenario';

const { largura, altura } = gameData.terreno.mapaPadrao;
const VIZINHOS: readonly (readonly [number, number])[] = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1],
];

// --- o oraculo: o mesmo problema, resolvido de outro jeito -------------------------

function bloqueadosDe(estado: GameState, dados: GameData): Set<string> {
  const bloqueados = new Set<string>();
  for (const id of estado.predios.ordem) {
    const predio = estado.predios.porId[id];
    const caixa = predio ? caixaDoPredio(predio, dados) : null;
    if (!caixa) continue;
    for (let gy = caixa.y0; gy < caixa.y1; gy++) {
      for (let gx = caixa.x0; gx < caixa.x1; gx++) bloqueados.add(chaveDeTile({ gx, gy }));
    }
  }
  return bloqueados;
}

function custoDoOraculo(
  estado: GameState, de: TileDeGrid, alvos: readonly TileDeGrid[], modo: ModoDeBusca, dados: GameData = gameData,
): number | null {
  const bloqueados = bloqueadosDe(estado, dados);
  const andavel = (t: TileDeGrid): boolean => {
    if (t.gx < 0 || t.gy < 0 || t.gx >= largura || t.gy >= altura) return false;
    return modo === 'estrada' ? ehEstrada(estado.estradas, t) : !bloqueados.has(chaveDeTile(t));
  };
  const custoDoPasso = (para: TileDeGrid, diagonal: boolean): number => {
    const terreno = ehEstrada(estado.estradas, para) ? 'estrada' : 'grama';
    return diagonal ? dados.movimento.ticksPorTileDiagonal.aPe[terreno] : dados.movimento.ticksPorTile.aPe[terreno];
  };
  if (modo === 'estrada' && !andavel(de)) return null;
  const melhor = new Map<string, number>([[chaveDeTile(de), 0]]);
  const fila: TileDeGrid[] = [de];
  while (fila.length > 0) {
    const atual = fila.shift() as TileDeGrid;
    const custoAtual = melhor.get(chaveDeTile(atual)) as number;
    for (const [dx, dy] of VIZINHOS) {
      const vizinho = { gx: atual.gx + dx, gy: atual.gy + dy };
      if (!andavel(vizinho)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && !(andavel({ gx: atual.gx + dx, gy: atual.gy }) && andavel({ gx: atual.gx, gy: atual.gy + dy }))) continue;
      const novo = custoAtual + custoDoPasso(vizinho, diagonal);
      const chave = chaveDeTile(vizinho);
      const antigo = melhor.get(chave);
      if (antigo === undefined || novo < antigo) {
        melhor.set(chave, novo);
        fila.push(vizinho);
      }
    }
  }
  let resultado: number | null = null;
  for (const alvo of alvos) {
    const c = melhor.get(chaveDeTile(alvo));
    if (c !== undefined && (resultado === null || c < resultado)) resultado = c;
  }
  return resultado;
}

// --- mapas sorteados ---------------------------------------------------------------

function sorteador(semente: number): (limite: number) => number {
  let rng: RngState = createRng(semente);
  return (limite) => {
    const r = nextInt(rng, 0, limite);
    rng = r.rng;
    return r.value;
  };
}

/** Um mapa com predios aleatorios (obras de pedreira soltas) e estradas em segmentos. */
function mapaSorteado(sorteio: (n: number) => number, opcoes: { readonly predios: number; readonly segmentos: number }): GameState {
  let estado = inicial;
  for (let i = 0; i < opcoes.predios; i++) {
    estado = comObra(estado, `o${i}`, { gx: 4 + sorteio(52), gy: 4 + sorteio(52), faltam: { stone: 1 } });
  }
  const tiles: TileDeGrid[] = [];
  for (let i = 0; i < opcoes.segmentos; i++) {
    const x = 2 + sorteio(58);
    const y = 2 + sorteio(58);
    const tam = 3 + sorteio(14);
    tiles.push(...(sorteio(2) === 0 ? linhaH(x, Math.min(x + tam, largura - 1), y) : linhaV(x, y, Math.min(y + tam, altura - 1))));
  }
  return comEstradas(estado, tiles);
}

const tileLivre = (estado: GameState, t: TileDeGrid): boolean => !bloqueadosDe(estado, gameData).has(chaveDeTile(t));

function tileLivreSorteado(estado: GameState, sorteio: (n: number) => number): TileDeGrid {
  for (let tentativa = 0; tentativa < 200; tentativa++) {
    const t = { gx: sorteio(largura), gy: sorteio(altura) };
    if (tileLivre(estado, t)) return t;
  }
  throw new Error('fixture: mapa sem tile livre');
}

function tileDeEstradaSorteado(estado: GameState, sorteio: (n: number) => number): TileDeGrid | null {
  const chaves = Object.keys(estado.estradas).sort();
  const chave = chaves[sorteio(Math.max(chaves.length, 1))];
  if (chave === undefined) return null;
  const [gx, gy] = chave.split(',').map(Number) as [number, number];
  return { gx, gy };
}

const soma = (estado: GameState, de: TileDeGrid, tiles: readonly TileDeGrid[]): number => {
  let atual = de;
  let total = 0;
  for (const proximo of tiles) {
    const diagonal = proximo.gx !== atual.gx && proximo.gy !== atual.gy;
    const terreno = ehEstrada(estado.estradas, proximo) ? 'estrada' : 'grama';
    total += diagonal ? gameData.movimento.ticksPorTileDiagonal.aPe[terreno] : gameData.movimento.ticksPorTile.aPe[terreno];
    atual = proximo;
  }
  return total;
};

/** Um estado com referencia NOVA de `estradas`: o cache e por referencia, e `inicial` e
 *  compartilhado entre os testes — sem isto um teste herdaria o cache de outro. */
const fresco = (): GameState => comEstradas(inicial, []);

beforeEach(() => zerarEstatisticasDeBusca());

describe('F10 — A*: o custo e o do oraculo independente (propriedade, RNG semeado)', () => {
  it.each([1, 2, 3, 4])('modo livre, semente %i: 40 mapas com predios e estradas, custo igual ao oraculo', (semente) => {
    const sorteio = sorteador(semente);
    let comCaminho = 0;
    for (let i = 0; i < 40; i++) {
      const estado = mapaSorteado(sorteio, { predios: 6 + sorteio(8), segmentos: sorteio(8) });
      const de = tileLivreSorteado(estado, sorteio);
      const alvos = Array.from({ length: 1 + sorteio(3) }, () => tileLivreSorteado(estado, sorteio));
      const esperado = custoDoOraculo(estado, de, alvos, 'livre');
      const achado = buscarCaminho(estado, de, alvos, 'livre');
      expect(achado?.custo ?? null, `semente ${semente}, caso ${i}`).toBe(esperado);
      if (achado) comCaminho += 1;
    }
    expect(comCaminho, 'o sorteio quase nunca achou caminho: a propriedade seria vacua').toBeGreaterThan(30);
  });

  it('modo estrada, 4 sementes x 60 redes sorteadas: custo igual ao oraculo (e null quando nao liga)', () => {
    let comCaminho = 0;
    let semCaminho = 0;
    for (const semente of [101, 102, 103, 104]) {
      const sorteio = sorteador(semente);
      for (let i = 0; i < 60; i++) {
        const estado = mapaSorteado(sorteio, { predios: sorteio(4), segmentos: 6 + sorteio(10) });
        const de = tileDeEstradaSorteado(estado, sorteio);
        const alvo = tileDeEstradaSorteado(estado, sorteio);
        if (de === null || alvo === null) continue;
        const esperado = custoDoOraculo(estado, de, [alvo], 'estrada');
        const achado = buscarCaminho(estado, de, [alvo], 'estrada');
        expect(achado?.custo ?? null, `semente ${semente}, caso ${i}`).toBe(esperado);
        if (achado) comCaminho += 1;
        else semCaminho += 1;
      }
    }
    // sem os dois lados a propriedade nao testaria o caminho, ou nao testaria o null
    expect(comCaminho).toBeGreaterThan(20);
    expect(semCaminho).toBeGreaterThan(20);
  });

  it('a EQUIVALENCIA com a F08: por estrada, o A* acha caminho se e somente se `isConnected` acha', () => {
    // vizinhanca 8 + "sem cortar quina" nao pode ligar o que a rede de 4 direcoes desliga
    const sorteio = sorteador(7);
    let ligados = 0;
    let desligados = 0;
    for (let i = 0; i < 500; i++) {
      const estado = mapaSorteado(sorteio, { predios: 0, segmentos: 8 + sorteio(12) });
      const de = tileDeEstradaSorteado(estado, sorteio);
      const alvo = tileDeEstradaSorteado(estado, sorteio);
      if (de === null || alvo === null) continue;
      const aStar = buscarCaminho(estado, de, [alvo], 'estrada') !== null;
      const f08 = isConnected(estado, de, alvo);
      expect(aStar, `caso ${i}`).toBe(f08);
      if (f08) ligados += 1;
      else desligados += 1;
    }
    expect(ligados).toBeGreaterThan(20);
    expect(desligados).toBeGreaterThan(20);
  });
});

describe('F10 — A*: o caminho devolvido e valido', () => {
  it.each([1, 2, 3])('semente %i: contiguo, andavel, sem cortar quina, termina num alvo e a soma dos passos e o custo', (semente) => {
    const sorteio = sorteador(300 + semente);
    for (let i = 0; i < 30; i++) {
      const estado = mapaSorteado(sorteio, { predios: 8, segmentos: 6 });
      const bloqueados = bloqueadosDe(estado, gameData);
      const de = tileLivreSorteado(estado, sorteio);
      const alvos = [tileLivreSorteado(estado, sorteio), tileLivreSorteado(estado, sorteio)];
      const achado = buscarCaminho(estado, de, alvos, 'livre');
      if (!achado) continue;
      let atual = de;
      for (const proximo of achado.tiles) {
        const dx = proximo.gx - atual.gx;
        const dy = proximo.gy - atual.gy;
        expect(Math.max(Math.abs(dx), Math.abs(dy)), 'passo maior que 1 tile').toBe(1);
        expect(bloqueados.has(chaveDeTile(proximo)), 'pisou em predio').toBe(false);
        if (dx !== 0 && dy !== 0) {
          expect(bloqueados.has(chaveDeTile({ gx: atual.gx + dx, gy: atual.gy })), 'cortou a quina').toBe(false);
          expect(bloqueados.has(chaveDeTile({ gx: atual.gx, gy: atual.gy + dy })), 'cortou a quina').toBe(false);
        }
        atual = proximo;
      }
      const ultimo = achado.tiles[achado.tiles.length - 1] ?? de;
      expect(alvos.some((a) => a.gx === ultimo.gx && a.gy === ultimo.gy)).toBe(true);
      expect(soma(estado, de, achado.tiles)).toBe(achado.custo);
    }
  });

  it('na estrada, todo tile do caminho e estrada, inclusive o que se pisa primeiro', () => {
    const estado = comEstradas(inicial, [...linhaH(10, 20, 40), ...linhaV(20, 40, 46)]);
    const achado = buscarCaminho(estado, tile(10, 40), [tile(20, 46)], 'estrada');
    expect(achado).not.toBeNull();
    for (const t of achado?.tiles ?? []) expect(ehEstrada(estado.estradas, t)).toBe(true);
    expect(achado?.custo).toBe(gameData.movimento.ticksPorTile.aPe.estrada * 16);
  });
});

describe('F10 — A*: casos que se leem', () => {
  it('ja no alvo: custo 0 e caminho vazio', () => {
    expect(buscarCaminho(inicial, tile(5, 5), [tile(5, 5)], 'livre')).toEqual({ custo: 0, tiles: [] });
  });

  it('em campo aberto o passo e diagonal quando ajuda: 3 na diagonal custam 3 diagonais', () => {
    const achado = buscarCaminho(inicial, tile(2, 2), [tile(5, 5)], 'livre');
    expect(achado?.custo).toBe(3 * gameData.movimento.ticksPorTileDiagonal.aPe.grama);
    expect(achado?.tiles).toHaveLength(3);
  });

  it('a estrada e preferida: um corredor de estrada vence a mesma distancia na grama', () => {
    const estado = comEstradas(inicial, linhaH(2, 12, 2));
    const achado = buscarCaminho(estado, tile(2, 2), [tile(12, 2)], 'livre');
    expect(achado?.custo).toBe(10 * gameData.movimento.ticksPorTile.aPe.estrada);
    for (const t of achado?.tiles ?? []) expect(ehEstrada(estado.estradas, t)).toBe(true);
  });

  it('predio bloqueia: o caminho dá a volta e custa mais que a reta', () => {
    // a obra de pedreira em (10,10) ocupa 3x2 tiles; o alvo esta atras dela
    const estado = comObra(inicial, 'muro', { gx: 10, gy: 10, faltam: { stone: 1 } });
    const semMuro = buscarCaminho(inicial, tile(11, 8), [tile(11, 13)], 'livre');
    const comMuro = buscarCaminho(estado, tile(11, 8), [tile(11, 13)], 'livre');
    expect(comMuro).not.toBeNull();
    expect(comMuro?.custo).toBeGreaterThan(semMuro?.custo ?? Number.POSITIVE_INFINITY);
    expect(comMuro?.custo).toBe(custoDoOraculo(estado, tile(11, 8), [tile(11, 13)], 'livre'));
  });

  it('nao corta a quina de um predio: passar na diagonal rente ao canto e proibido', () => {
    // obra 3x2 em (10,10): tiles x 10..12, y 10..11. de (9,9) para (13,12) a reta passa colada ao canto.
    const estado = comObra(inicial, 'canto', { gx: 10, gy: 10, faltam: { stone: 1 } });
    const achado = buscarCaminho(estado, tile(9, 9), [tile(13, 12)], 'livre');
    expect(achado).not.toBeNull();
    let atual = tile(9, 9);
    const bloqueados = bloqueadosDe(estado, gameData);
    for (const p of achado?.tiles ?? []) {
      if (p.gx !== atual.gx && p.gy !== atual.gy) {
        expect(bloqueados.has(chaveDeTile({ gx: p.gx, gy: atual.gy }))).toBe(false);
        expect(bloqueados.has(chaveDeTile({ gx: atual.gx, gy: p.gy }))).toBe(false);
      }
      atual = p;
    }
  });

  it('na estrada, dois tiles so em diagonal NAO se ligam (igual a F08)', () => {
    const estado = comEstradas(inicial, [tile(5, 5), tile(6, 6)]);
    expect(buscarCaminho(estado, tile(5, 5), [tile(6, 6)], 'estrada')).toBeNull();
    expect(isConnected(estado, tile(5, 5), tile(6, 6))).toBe(false);
  });

  it('na estrada, sair de um tile que nao e estrada nao existe: null', () => {
    const estado = comEstradas(inicial, linhaH(10, 14, 40));
    expect(buscarCaminho(estado, tile(9, 40), [tile(14, 40)], 'estrada')).toBeNull();
  });

  it('alvo dentro de um predio nao se alcanca; alvo fora do mapa tambem nao', () => {
    const estado = comObra(inicial, 'muro', { gx: 10, gy: 10, faltam: { stone: 1 } });
    expect(buscarCaminho(estado, tile(5, 5), [tile(11, 10)], 'livre')).toBeNull();
    expect(buscarCaminho(estado, tile(5, 5), [tile(largura + 3, 5)], 'livre')).toBeNull();
  });

  it('um serf DENTRO do footprint de um predio recem-plantado sai (civis nao colidem)', () => {
    // o armazem do cenario (29,30) e 3x3; o tile do meio nao tem nenhum vizinho livre
    const armazem = armazemDoCenario(inicial);
    const centro = tile(armazem.gx + 1, armazem.gy + 1);
    const achado = buscarCaminho(inicial, centro, [tile(armazem.gx + 1, armazem.gy + 4)], 'livre');
    expect(achado).not.toBeNull();
    expect(achado?.custo).toBeGreaterThan(0);
  });

  it('varios alvos: escolhe o de menor custo', () => {
    const achado = buscarCaminho(inicial, tile(2, 2), [tile(20, 2), tile(4, 2)], 'livre');
    const ultimo = achado?.tiles[achado.tiles.length - 1];
    expect(ultimo).toEqual(tile(4, 2));
  });

  it('a ordem dos alvos nao muda a resposta (determinismo)', () => {
    const alvos = [tile(20, 9), tile(3, 9), tile(11, 2)];
    const a = buscarCaminho(inicial, tile(11, 9), alvos, 'livre');
    const b = buscarCaminho(inicial, tile(11, 9), [...alvos].reverse(), 'livre');
    expect(b).toEqual(a);
  });

  it('empates de custo resolvem sempre igual: 20 chamadas, mesmo caminho', () => {
    const estado = comEstradas(inicial, [...linhaH(10, 14, 40), ...linhaH(10, 14, 41), ...linhaV(10, 40, 41), ...linhaV(14, 40, 41)]);
    const primeira = buscarCaminho(estado, tile(10, 40), [tile(14, 41)], 'estrada');
    for (let i = 0; i < 20; i++) expect(buscarCaminho(estado, tile(10, 40), [tile(14, 41)], 'estrada')).toEqual(primeira);
  });

  it('funciona sobre um estado congelado em profundidade', () => {
    const congelado = deepFreeze(comEstradas(inicial, linhaH(10, 14, 40)));
    expect(buscarCaminho(congelado, tile(10, 40), [tile(14, 40)], 'estrada')?.custo).toBe(4 * gameData.movimento.ticksPorTile.aPe.estrada);
  });

  it('um dado diferente muda o custo (nada de numero fixo no A*)', () => {
    // grama 20 no passo reto e 28 (= round(20 x sqrt2)) no diagonal: os DOIS, senao a diagonal
    // ficaria mais barata que a reta e o zigue-zague venceria — com razao.
    const lento: GameData = { ...gameData, movimento: {
      ticksPorTile: { ...gameData.movimento.ticksPorTile, aPe: { ...gameData.movimento.ticksPorTile.aPe, grama: 20 } },
      ticksPorTileDiagonal: { ...gameData.movimento.ticksPorTileDiagonal, aPe: { ...gameData.movimento.ticksPorTileDiagonal.aPe, grama: 28 } },
    } };
    const alvo = tile(2, 8);
    expect(buscarCaminho(inicial, tile(2, 2), [alvo], 'livre', lento)?.custo).toBe(6 * 20);
    expect(buscarCaminho(inicial, tile(2, 2), [alvo], 'livre')?.custo).toBe(6 * gameData.movimento.ticksPorTile.aPe.grama);
  });
});

describe('F10 — A*: cache por par origem-destino', () => {
  it('a mesma pergunta devolve o MESMO objeto e conta como acerto', () => {
    const estado = comEstradas(inicial, linhaH(10, 14, 40));
    const a = buscarCaminho(estado, tile(10, 40), [tile(14, 40)], 'estrada');
    const b = buscarCaminho(estado, tile(10, 40), [tile(14, 40)], 'estrada');
    expect(b).toBe(a);
    expect(estatisticasDeBusca()).toEqual({ execucoes: 1, acertos: 1 });
  });

  it('a ordem dos alvos nao gera outra entrada de cache', () => {
    const alvos = [tile(20, 9), tile(3, 9)];
    const estado = fresco();
    buscarCaminho(estado, tile(11, 9), alvos, 'livre');
    buscarCaminho(estado, tile(11, 9), [...alvos].reverse(), 'livre');
    expect(estatisticasDeBusca()).toEqual({ execucoes: 1, acertos: 1 });
  });

  it('a ausencia de caminho tambem e cacheada', () => {
    const estado = comEstradas(inicial, [tile(5, 5), tile(6, 6)]);
    expect(buscarCaminho(estado, tile(5, 5), [tile(6, 6)], 'estrada')).toBeNull();
    expect(buscarCaminho(estado, tile(5, 5), [tile(6, 6)], 'estrada')).toBeNull();
    expect(estatisticasDeBusca()).toEqual({ execucoes: 1, acertos: 1 });
  });

  it('modos diferentes nao se misturam: livre e estrada sao entradas separadas', () => {
    const estado = comEstradas(inicial, linhaH(10, 14, 40));
    const livre = buscarCaminho(estado, tile(10, 40), [tile(14, 40)], 'livre');
    const estrada = buscarCaminho(estado, tile(10, 40), [tile(14, 40)], 'estrada');
    expect(estatisticasDeBusca().execucoes).toBe(2);
    expect(livre?.custo).toBe(estrada?.custo); // aqui os dois pisam na mesma rua, mas sao consultas distintas
  });

  it('uma referencia nova de `estradas` invalida (mesmo com o mesmo conteudo)', () => {
    const estado = comEstradas(inicial, linhaH(10, 14, 40));
    buscarCaminho(estado, tile(10, 40), [tile(14, 40)], 'estrada');
    const mesmoConteudo = { ...estado, estradas: { ...estado.estradas } };
    buscarCaminho(mesmoConteudo, tile(10, 40), [tile(14, 40)], 'estrada');
    expect(estatisticasDeBusca()).toEqual({ execucoes: 2, acertos: 0 });
  });

  it('predio novo (`predios.ordem` nova) invalida, e o caminho muda de fato', () => {
    const base = fresco();
    const antes = buscarCaminho(base, tile(11, 8), [tile(11, 13)], 'livre');
    const estado = comObra(base, 'muro', { gx: 10, gy: 10, faltam: { stone: 1 } });
    const depois = buscarCaminho(estado, tile(11, 8), [tile(11, 13)], 'livre');
    expect(depois).not.toBe(antes);
    expect(depois?.custo).toBeGreaterThan(antes?.custo ?? Number.POSITIVE_INFINITY);
    expect(estatisticasDeBusca().execucoes).toBe(2);
  });

  it('trocar so o ESTOQUE de um predio NAO invalida (coleta e entrega nao esvaziam o cache)', () => {
    const armazem = armazemDoCenario(inicial);
    const estado = comEstradas(inicial, linhaH(10, 14, 40));
    buscarCaminho(estado, tile(10, 40), [tile(14, 40)], 'estrada');
    const comOutroEstoque = comPedraNaSaida(estado, armazem.id, 3);
    expect(comOutroEstoque.predios).not.toBe(estado.predios); // a referencia de `predios` MUDOU...
    expect(comOutroEstoque.predios.ordem).toBe(estado.predios.ordem); // ...a de `ordem`, nao
    buscarCaminho(comOutroEstoque, tile(10, 40), [tile(14, 40)], 'estrada');
    expect(estatisticasDeBusca()).toEqual({ execucoes: 1, acertos: 1 });
  });

  it('um armazem completo a mais e um predio novo: invalida', () => {
    const estado = comEstradas(inicial, linhaH(10, 14, 40));
    buscarCaminho(estado, tile(10, 40), [tile(14, 40)], 'livre');
    buscarCaminho(comArmazemCompleto(estado, 'a2', { gx: 40, gy: 10, stone: 1 }), tile(10, 40), [tile(14, 40)], 'livre');
    expect(estatisticasDeBusca().execucoes).toBe(2);
  });

  it('dados diferentes nao compartilham cache', () => {
    const outro: GameData = { ...gameData };
    const estado = fresco();
    buscarCaminho(estado, tile(2, 2), [tile(5, 5)], 'livre');
    buscarCaminho(estado, tile(2, 2), [tile(5, 5)], 'livre', outro);
    expect(estatisticasDeBusca()).toEqual({ execucoes: 2, acertos: 0 });
  });
});
