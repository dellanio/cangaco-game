/**
 * A rede de estradas: o conjunto de tiles de `GameState.estradas`, o grafo de
 * conectividade sobre ele e as consultas que F09 (JobBoard), F10 (serf) e F15
 * (producao) fazem. Ver o contrato herdado em `GameState.estradas` (state.ts).
 *
 * Tudo aqui e puro. O unico "estado" e o `WeakMap` do indice, que e MEMOIZACAO de
 * uma funcao pura sobre um objeto imutavel — nao e estado de jogo, nao entra no
 * JSON e nao muda o resultado de nada.
 */
import type { GameState, Predio, PredioCompleto } from './state';
import { ID_DO_ARMAZEM } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { bordaSul, caixaDoPredio } from './footprint';
import { disponivelNaOrigem } from './reservas';

/** Um tile de grid, sempre em coordenada inteira quando valido. Mesma forma do
 *  `Tile` de `render/grid.ts`, sem importa-lo: `sim/` nao depende de `render/`. */
export interface TileDeGrid {
  readonly gx: number;
  readonly gy: number;
}

export type MotivoDeRecusaDeEstrada = 'fora-do-mapa' | 'sobreposicao' | 'sem-pedra';

/** A mercadoria que a estrada custa ("1 stone por tile", terrain.json). E um id
 *  estrutural, como `ID_DO_ARMAZEM` — o NUMERO vem do dado. */
export const MERCADORIA_DA_ESTRADA = 'stone';

// --- chaves e consulta de tile: O(1) ---

export function chaveDeTile(tile: TileDeGrid): string {
  return `${tile.gx},${tile.gy}`;
}

export function tileDeChave(chave: string): TileDeGrid {
  const virgula = chave.indexOf(',');
  return { gx: Number(chave.slice(0, virgula)), gy: Number(chave.slice(virgula + 1)) };
}

/** E um tile de estrada? O(1). E o que o A* do serf pergunta a cada passo. */
export function ehEstrada(estradas: GameState['estradas'], tile: TileDeGrid): boolean {
  return estradas[chaveDeTile(tile)] === true;
}

/** Os tiles em ordem canonica (por `gy`, depois `gx`), independente da ordem de
 *  insercao no objeto: e daqui que qualquer iteracao deterministica deve partir. */
export function tilesOrdenados(estradas: GameState['estradas']): TileDeGrid[] {
  return Object.keys(estradas).map(tileDeChave).sort((a, b) => a.gy - b.gy || a.gx - b.gx);
}

// --- conectividade: indice de componentes, memoizado pela referencia ---

/** Vizinhanca de 4 direcoes. O GDD nao responde sobre diagonal; a estrada
 *  arrastada e 4-conectada, e diagonal seria um atalho por dentro de dois cantos. */
const VIZINHOS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export interface IndiceDeEstradas {
  /** `"gx,gy"` -> id do componente conexo. Tile ausente = nao e estrada. */
  readonly componentes: Readonly<Record<string, number>>;
  readonly quantidade: number;
}

function construirIndice(estradas: GameState['estradas']): IndiceDeEstradas {
  const componentes: Record<string, number> = {};
  let quantidade = 0;
  // Varredura na ordem canonica: o id do componente depende so do CONJUNTO de
  // tiles, nao do historico de insercao.
  for (const inicio of tilesOrdenados(estradas)) {
    if (componentes[chaveDeTile(inicio)] !== undefined) continue;
    const id = quantidade;
    quantidade += 1;
    componentes[chaveDeTile(inicio)] = id;
    const fila: TileDeGrid[] = [inicio];
    for (let i = 0; i < fila.length; i++) {
      const atual = fila[i];
      if (!atual) continue;
      for (const [dx, dy] of VIZINHOS) {
        const vizinho = { gx: atual.gx + dx, gy: atual.gy + dy };
        const chave = chaveDeTile(vizinho);
        if (estradas[chave] === true && componentes[chave] === undefined) {
          componentes[chave] = id;
          fila.push(vizinho);
        }
      }
    }
  }
  return { componentes, quantidade };
}

const indices = new WeakMap<object, IndiceDeEstradas>();

/**
 * O indice de componentes conexos. Construido UMA vez por referencia de `estradas`
 * (O(N log N), so quando alguem constroi ou demole estrada, ou depois de um load) e
 * reaproveitado por todas as consultas ate a referencia mudar. `step()` carrega a
 * mesma referencia enquanto nenhum comando de estrada altera algo — entao os
 * milhares de perguntas de um tick custam um lookup, nao uma busca.
 */
export function indiceDeEstradas(estradas: GameState['estradas']): IndiceDeEstradas {
  let indice = indices.get(estradas);
  if (indice === undefined) {
    indice = construirIndice(estradas);
    indices.set(estradas, indice);
  }
  return indice;
}

/** O id do componente do tile, ou `null` se o tile nao e estrada. */
export function componenteDe(estradas: GameState['estradas'], tile: TileDeGrid): number | null {
  return indiceDeEstradas(estradas).componentes[chaveDeTile(tile)] ?? null;
}

/** Existe caminho de estrada de `from` ate `to`? `false` se algum dos dois nao e
 *  estrada; o mesmo tile de estrada esta conectado a si mesmo. */
export function isConnected(state: GameState, from: TileDeGrid, to: TileDeGrid): boolean {
  const a = componenteDe(state.estradas, from);
  return a !== null && a === componenteDe(state.estradas, to);
}

// --- distancia por estrada (F09) ---

const distancias = new WeakMap<object, Map<string, number | null>>();

/**
 * Distancia de CAMINHO A PE pela rede: o menor numero de passos, so por tiles de
 * estrada e em 4 direcoes, de uma das portas de `de` ate uma das de `para`; `null`
 * se nao ha caminho ou se nenhuma ponta e estrada. Nunca euclidiana nem de Manhattan
 * (erro conhecido do Remake: o trabalhador escolhia alvo do outro lado da montanha).
 *
 * PROVISORIA, e mede so a perna da ENTREGA (origem -> destino): unidade -> origem
 * pede A* com `custoDeMovimento`, vizinhanca 8 e cache, que e a F10, e as unidades
 * nascem fora da estrada. A F10 substitui a funcao de distancia do desempate; a
 * interface do comparador nao muda (nota no item F10 do BUILD_PLAN).
 *
 * Busca em largura multi-origem; o resultado e memoizado pela REFERENCIA de
 * `estradas` (mesmo molde do indice de componentes), entao so recalcula quando a
 * rede muda.
 */
export function distanciaPorEstrada(
  estradas: GameState['estradas'], de: readonly TileDeGrid[], para: readonly TileDeGrid[],
): number | null {
  const chave = `${de.map(chaveDeTile).join(';')}|${para.map(chaveDeTile).join(';')}`;
  let memo = distancias.get(estradas);
  if (memo === undefined) {
    memo = new Map();
    distancias.set(estradas, memo);
  }
  const guardada = memo.get(chave);
  if (guardada !== undefined) return guardada;

  const resultado = buscarDistancia(estradas, de, para);
  memo.set(chave, resultado);
  return resultado;
}

function buscarDistancia(
  estradas: GameState['estradas'], de: readonly TileDeGrid[], para: readonly TileDeGrid[],
): number | null {
  const alvos = new Set(para.filter((t) => ehEstrada(estradas, t)).map(chaveDeTile));
  if (alvos.size === 0) return null;
  const visto = new Map<string, number>();
  let fronteira: TileDeGrid[] = [];
  for (const inicio of de) {
    const chaveInicio = chaveDeTile(inicio);
    if (ehEstrada(estradas, inicio) && !visto.has(chaveInicio)) {
      visto.set(chaveInicio, 0);
      fronteira.push(inicio);
    }
  }
  for (let passos = 0; fronteira.length > 0; passos++) {
    if (fronteira.some((t) => alvos.has(chaveDeTile(t)))) return passos;
    const proxima: TileDeGrid[] = [];
    for (const atual of fronteira) {
      for (const [dx, dy] of VIZINHOS) {
        const vizinho = { gx: atual.gx + dx, gy: atual.gy + dy };
        const chaveVizinho = chaveDeTile(vizinho);
        if (estradas[chaveVizinho] === true && !visto.has(chaveVizinho)) {
          visto.set(chaveVizinho, passos + 1);
          proxima.push(vizinho);
        }
      }
    }
    fronteira = proxima;
  }
  return null;
}

/** Distancia por estrada entre as PORTAS de dois predios (a borda sul de cada um). */
export function distanciaEntrePredios(
  state: GameState, a: Predio, b: Predio, dados: GameData = gameData,
): number | null {
  return distanciaPorEstrada(state.estradas, tilesDaPorta(a, dados), tilesDaPorta(b, dados));
}

// --- predios na rede ---

export function armazensCompletos(state: GameState): PredioCompleto[] {
  return state.predios.ordem.flatMap((id) => {
    const predio = state.predios.porId[id];
    return predio && predio.estado === 'completo' && predio.tipo === ID_DO_ARMAZEM ? [predio] : [];
  });
}

/**
 * A "porta ao sul" (GDD §5.1): os tiles imediatamente ao sul do footprint. Uso a
 * borda sul INTEIRA em vez de escolher uma coluna — o GDD nao diz qual, e escolher
 * seria inventar; qual tile o serf usa e da F10.
 */
export function tilesDaPorta(predio: Predio, dados: GameData = gameData): TileDeGrid[] {
  const caixa = caixaDoPredio(predio, dados);
  if (caixa === null) return [];
  // Mesma `bordaSul` que o `canPlace` usa para recusar porta tapada: uma
  // definicao so, senao as duas divergem e a recusa passa a proteger outra linha.
  const porta = bordaSul(caixa);
  const tiles: TileDeGrid[] = [];
  for (let gx = porta.x0; gx < porta.x1; gx++) tiles.push({ gx, gy: porta.y0 });
  return tiles;
}

/**
 * O predio esta ligado a um armazem pela rede? Alguma porta dele e estrada e esta no
 * mesmo componente de alguma porta de algum armazem completo. DERIVADO na hora:
 * "desligado" nao e um campo do predio, entao demolir estrada nao muda predio nenhum
 * — quem reage e quem consome (F09 nao cria tarefa para destino sem ligacao; F10
 * solta a reserva quando o caminho some).
 */
export function predioLigadoAoArmazem(
  state: GameState, predio: Predio, dados: GameData = gameData,
): boolean {
  const { componentes } = indiceDeEstradas(state.estradas);
  const doArmazem = new Set<number>();
  for (const armazem of armazensCompletos(state)) {
    for (const porta of tilesDaPorta(armazem, dados)) {
      const c = componentes[chaveDeTile(porta)];
      if (c !== undefined) doArmazem.add(c);
    }
  }
  return tilesDaPorta(predio, dados).some((porta) => {
    const c = componentes[chaveDeTile(porta)];
    return c !== undefined && doArmazem.has(c);
  });
}

// --- pode construir estrada? (pura; o render pergunta, nao decide) ---

/** Pedra que os armazens completos tem para gastar. So armazem: pedra na saida de uma
 *  Quarry esta esperando o serf, nao e estoque gastavel. Na `saida` conta so o que
 *  NAO esta reservado por uma tarefa (JobBoard, F09): a unidade que um serf ja
 *  reservou e dele. A `entrada` nao e reservavel. */
export function pedraDisponivel(state: GameState): number {
  let soma = 0;
  for (const armazem of armazensCompletos(state)) {
    soma += disponivelNaOrigem(state, armazem.id, MERCADORIA_DA_ESTRADA) + (armazem.estoque.entrada[MERCADORIA_DA_ESTRADA] ?? 0);
  }
  return soma;
}

function tileEmPredio(state: GameState, tile: TileDeGrid, dados: GameData): boolean {
  for (const id of state.predios.ordem) {
    const predio = state.predios.porId[id];
    const caixa = predio ? caixaDoPredio(predio, dados) : null;
    if (caixa && tile.gx >= caixa.x0 && tile.gx < caixa.x1 && tile.gy >= caixa.y0 && tile.gy < caixa.y1) return true;
  }
  return false;
}

export type ResultadoDeEstrada =
  | { readonly ok: true; readonly novos: readonly TileDeGrid[]; readonly custoEmPedra: number }
  | { readonly ok: false; readonly motivo: MotivoDeRecusaDeEstrada; readonly tile: TileDeGrid | null };

/**
 * Pode-se construir estrada sobre `tiles`? Pura. Devolve os tiles NOVOS (os que ainda
 * nao sao estrada, sem repeticao, na ordem em que vieram) e o custo em pedra deles, ou
 * o motivo e o primeiro tile culpado. Tudo ou nada: um tile invalido recusa o trecho.
 *
 * Ordem: cada tile (mapa, depois predio — obra incluida), e so entao a pedra.
 * `terreno` nao existe como motivo: o mapa nao tem terreno variado (IDEIAS.md).
 */
export function canPlaceRoad(
  state: GameState, tiles: readonly TileDeGrid[], dados: GameData = gameData,
): ResultadoDeEstrada {
  const { largura, altura } = dados.terreno.mapaPadrao;
  const vistos = new Set<string>();
  const novos: TileDeGrid[] = [];
  for (const tile of tiles) {
    const dentro = Number.isInteger(tile.gx) && Number.isInteger(tile.gy)
      && tile.gx >= 0 && tile.gy >= 0 && tile.gx < largura && tile.gy < altura;
    if (!dentro) return { ok: false, motivo: 'fora-do-mapa', tile };
    if (tileEmPredio(state, tile, dados)) return { ok: false, motivo: 'sobreposicao', tile };
    const chave = chaveDeTile(tile);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    if (!ehEstrada(state.estradas, tile)) novos.push(tile);
  }
  const custoEmPedra = novos.length * dados.terreno.estrada.custoStonePorTile;
  if (custoEmPedra > pedraDisponivel(state)) return { ok: false, motivo: 'sem-pedra', tile: null };
  return { ok: true, novos, custoEmPedra };
}
