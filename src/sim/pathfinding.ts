/**
 * A* em grid ortogonal, vizinhanca 8, com cache por par origem-destino (GDD §6.4,
 * `terrain.pathfinding`). Puro e determinista: so inteiros, ordem de vizinhos fixa e
 * desempate total na fila (f, h, indice do tile).
 *
 * O CUSTO e em ticks e e exatamente o que o serf gasta: o passo reto e o diagonal vem de
 * `movimento.ticksPorTile` e `movimento.ticksPorTileDiagonal` (convertidos no
 * carregamento, F03/F10), pelo terreno do tile de DESTINO — estrada se ha estrada, grama
 * se nao (o mapa nao tem terreno variado). "Custo do caminho" = "tempo da viagem".
 *
 * Dois modos:
 *  - `livre`: qualquer tile dentro do mapa e fora do footprint de qualquer predio (obra
 *    inclusive). O tile de partida e sempre permitido (civis nao colidem, GDD §6.4): se ele
 *    esta dentro de um footprint (uma obra plantada sobre o serf), a caixa inteira fica
 *    andavel nesta busca, para o serf poder sair.
 *  - `estrada`: so tiles de estrada, partida inclusive. E a perna CARREGADA
 *    (`terrain.estrada.obrigatoriaParaEntrega`).
 *
 * Diagonal so se as DUAS ortogonais forem andaveis (nao corta quina). Consequencia que o
 * teste prova por propriedade: por estrada, o A* acha caminho se e somente se `isConnected`
 * (F08, 4 direcoes) acha — as duas nocoes de "ligado" nao divergem.
 *
 * CACHE: `WeakMap` aninhado pelas referencias de `dados`, de `predios.ordem` e de
 * `estradas`. `ordem` (e nao `predios`) porque `predios` troca de referencia a cada
 * coleta e entrega de mercadoria, e so o CONJUNTO de footprints importa: `ordem` so muda
 * quando um predio entra ou sai. Mesmo molde do indice de estradas da F08: memoria de
 * cache, funcao pura das referencias imutaveis, fora do JSON, sem efeito no determinismo.
 * (Assume que ninguem muta `estradas` nem troca o footprint de um predio no lugar.)
 */
import type { GameState } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { caixaDoPredio } from './footprint';
import type { CaixaEmTiles } from './footprint';
import { chaveDeTile } from './estradas';
import type { TileDeGrid } from './estradas';

export type ModoDeBusca = 'livre' | 'estrada';

export interface Caminho {
  /** Ticks para andar o caminho inteiro. */
  readonly custo: number;
  /** Os tiles a pisar, em ordem, SEM o tile de partida. Vazio se ja esta no alvo. */
  readonly tiles: readonly TileDeGrid[];
}

export interface EstatisticasDeBusca {
  readonly execucoes: number;
  readonly acertos: number;
}

// Ordem fixa: a do desempate. Norte, leste, sul, oeste, e as quatro diagonais.
const PASSOS: readonly (readonly [number, number])[] = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1],
];

interface EntradaDeCache {
  readonly estrada: Uint8Array;
  readonly resultados: Map<string, Caminho | null>;
}

interface FootprintsEmCache {
  readonly bloqueado: Uint8Array;
  readonly caixas: readonly CaixaEmTiles[];
}

const cachePorEstradas = new WeakMap<object, WeakMap<object, WeakMap<object, EntradaDeCache>>>();
const footprintsPorOrdem = new WeakMap<object, WeakMap<object, FootprintsEmCache>>();

let execucoes = 0;
let acertos = 0;

/**
 * F17c — RASCUNHO REAPROVEITADO.
 *
 * Antes, cada busca alocava `Float64Array(largura*altura)` e
 * `Int32Array(largura*altura)` e preenchia os dois: 48 KB por chamada num mapa
 * 64x64, 768 KB num 256x256. O custo era da AREA DO MAPA e nao do caminho — a
 * mesma caminhada de 3 tiles custava 7,6x mais no mapa grande (medido antes
 * desta feature: 40 / 94 / 303 us).
 *
 * Agora os vetores vivem aqui, e `marca[i] === geracaoAtual` diz se `g[i]` e
 * `pai[i]` valem para ESTA busca. Marca velha le como "nao visitado", que era o
 * papel do `+Infinity` e do `-1`. Zerar deixa de ser necessario.
 *
 * O rascunho CRESCE E NUNCA ENCOLHE: depois de um mapa grande o pequeno
 * reaproveita o mesmo vetor, porque o indice e `y * largura + x` e cabe sempre.
 */
let rascunhoCapacidade = 0;
let rascunhoG = new Float64Array(0);
let rascunhoPai = new Int32Array(0);
let rascunhoMarca = new Int32Array(0);
let geracaoAtual = 0;
let alocacoesDeRascunho = 0;
let rascunhoEmUso = false;

/** Limite de representacao de `Int32Array`, nao numero de balanceamento. */
const GERACAO_MAXIMA = 0x7fffffff;

export interface EstatisticasDoRascunho {
  /** Quantas vezes o rascunho foi CRIADO — nao por busca: por tamanho novo. */
  readonly alocacoes: number;
  /** Em celulas: a area do maior mapa ja visto. */
  readonly capacidade: number;
}

/** Contadores de busca (execucoes reais e acertos de cache) — so para teste e evidencia. */
export function estatisticasDeBusca(): EstatisticasDeBusca {
  return { execucoes, acertos };
}

/**
 * F17c — instrumentacao do rascunho. Fica FORA de `estatisticasDeBusca()` de
 * proposito: execucoes e acertos sao sobre busca e cache, isto e sobre memoria.
 * (E `EstatisticasDeBusca` tem assercoes `toEqual` sobre o objeto inteiro na
 * F10, que um campo a mais reprovaria.)
 */
export function estatisticasDoRascunho(): EstatisticasDoRascunho {
  return { alocacoes: alocacoesDeRascunho, capacidade: rascunhoCapacidade };
}

export function zerarEstatisticasDeBusca(): void {
  execucoes = 0;
  acertos = 0;
  alocacoesDeRascunho = 0; // F17c — contador de instrumentacao, como os outros dois
}

function ocuparRascunho(total: number): void {
  // O A* NAO e reentrante: duas buscas ao mesmo tempo dividiriam este rascunho e
  // uma sobrescreveria a outra em silencio. Nenhum caminho do codigo faz isso
  // hoje (a busca nao aceita callback, e a unica chamada externa dela,
  // `footprintsDe`, so alcanca `footprint.ts`, que importa apenas tipos). A
  // guarda existe para o dia em que alguem tentar.
  if (rascunhoEmUso) {
    throw new Error('pathfinding.ts: busca de A* reentrante — o rascunho e unico e nao aguenta duas buscas ao mesmo tempo.');
  }
  rascunhoEmUso = true;
  if (total > rascunhoCapacidade) {
    rascunhoG = new Float64Array(total);
    rascunhoPai = new Int32Array(total);
    rascunhoMarca = new Int32Array(total);
    rascunhoCapacidade = total;
    geracaoAtual = 0; // vetor novo vem zerado: nenhuma geracao anterior vale
    alocacoesDeRascunho += 1;
  }
  if (geracaoAtual >= GERACAO_MAXIMA) {
    rascunhoMarca.fill(0);
    geracaoAtual = 0;
  }
  geracaoAtual += 1;
}

function liberarRascunho(): void {
  rascunhoEmUso = false;
}

function footprintsDe(state: Pick<GameState, 'predios'>, dados: GameData): FootprintsEmCache {
  const { largura, altura } = dados.terreno.mapaPadrao;
  let porOrdem = footprintsPorOrdem.get(dados);
  if (!porOrdem) {
    porOrdem = new WeakMap();
    footprintsPorOrdem.set(dados, porOrdem);
  }
  const existente = porOrdem.get(state.predios.ordem);
  if (existente) return existente;

  const bloqueado = new Uint8Array(largura * altura);
  const caixas: CaixaEmTiles[] = [];
  for (const id of state.predios.ordem) {
    const predio = state.predios.porId[id];
    const caixa = predio ? caixaDoPredio(predio, dados) : null;
    if (!caixa) continue;
    caixas.push(caixa);
    for (let gy = Math.max(caixa.y0, 0); gy < Math.min(caixa.y1, altura); gy++) {
      for (let gx = Math.max(caixa.x0, 0); gx < Math.min(caixa.x1, largura); gx++) bloqueado[gy * largura + gx] = 1;
    }
  }
  const criado = { bloqueado, caixas };
  porOrdem.set(state.predios.ordem, criado);
  return criado;
}

function entradaDeCache(state: Pick<GameState, 'predios' | 'estradas'>, dados: GameData): EntradaDeCache {
  const { largura, altura } = dados.terreno.mapaPadrao;
  let porOrdem = cachePorEstradas.get(dados);
  if (!porOrdem) {
    porOrdem = new WeakMap();
    cachePorEstradas.set(dados, porOrdem);
  }
  let porEstradas = porOrdem.get(state.predios.ordem);
  if (!porEstradas) {
    porEstradas = new WeakMap();
    porOrdem.set(state.predios.ordem, porEstradas);
  }
  const existente = porEstradas.get(state.estradas);
  if (existente) return existente;

  const estrada = new Uint8Array(largura * altura);
  for (const chave of Object.keys(state.estradas)) {
    const virgula = chave.indexOf(',');
    const gx = Number(chave.slice(0, virgula));
    const gy = Number(chave.slice(virgula + 1));
    if (Number.isInteger(gx) && Number.isInteger(gy) && gx >= 0 && gy >= 0 && gx < largura && gy < altura) estrada[gy * largura + gx] = 1;
  }
  const criada = { estrada, resultados: new Map<string, Caminho | null>() };
  porEstradas.set(state.estradas, criada);
  return criada;
}

/**
 * Ticks de UM passo de `de` para `para` (tiles vizinhos), a pe: o terreno do tile de
 * DESTINO (estrada ou grama) e reto ou diagonal. E a mesma conta que o A* soma, entao
 * "custo do caminho" = "tempo da viagem". O serf a usa para andar e o selector de posicao
 * para interpolar dentro do passo.
 */
export function custoDoPasso(
  estradas: GameState['estradas'], de: TileDeGrid, para: TileDeGrid, dados: GameData = gameData,
): number {
  const terreno = estradas[chaveDeTile(para)] === true ? 'estrada' : 'grama';
  const diagonal = de.gx !== para.gx && de.gy !== para.gy;
  return diagonal ? dados.movimento.ticksPorTileDiagonal.aPe[terreno] : dados.movimento.ticksPorTile.aPe[terreno];
}

/** Um unico tile e andavel neste modo? (Dentro do mapa; `livre`: fora de footprint;
 *  `estrada`: e estrada.) O serf pergunta antes de pisar no proximo tile do caminho. */
export function tileAndavel(
  state: Pick<GameState, 'predios' | 'estradas'>, tile: TileDeGrid, modo: ModoDeBusca, dados: GameData = gameData,
): boolean {
  const { largura, altura } = dados.terreno.mapaPadrao;
  if (!(Number.isInteger(tile.gx) && Number.isInteger(tile.gy) && tile.gx >= 0 && tile.gy >= 0 && tile.gx < largura && tile.gy < altura)) return false;
  if (modo === 'estrada') return state.estradas[chaveDeTile(tile)] === true;
  return footprintsDe(state, dados).bloqueado[tile.gy * largura + tile.gx] === 0;
}

/**
 * O menor caminho de `de` ate o alvo mais barato de `alvos`, ou `null` se nenhum se
 * alcanca. `de` e `alvos` sao tiles inteiros; um alvo fora do mapa ou inandavel e
 * simplesmente inalcancavel.
 */
export function buscarCaminho(
  state: Pick<GameState, 'predios' | 'estradas'>,
  de: TileDeGrid,
  alvos: readonly TileDeGrid[],
  modo: ModoDeBusca,
  dados: GameData = gameData,
): Caminho | null {
  const { largura, altura } = dados.terreno.mapaPadrao;
  const emMapa = (t: TileDeGrid): boolean => Number.isInteger(t.gx) && Number.isInteger(t.gy)
    && t.gx >= 0 && t.gy >= 0 && t.gx < largura && t.gy < altura;

  const indicesDosAlvos = [...new Set(alvos.filter(emMapa).map((t) => t.gy * largura + t.gx))].sort((a, b) => a - b);
  const chave = `${modo}|${de.gx},${de.gy}|${indicesDosAlvos.join(',')}`;
  const entrada = entradaDeCache(state, dados);
  if (entrada.resultados.has(chave)) {
    acertos += 1;
    return entrada.resultados.get(chave) ?? null;
  }
  execucoes += 1;
  const resultado = executar(state, entrada.estrada, de, indicesDosAlvos, modo, dados);
  entrada.resultados.set(chave, resultado);
  return resultado;
}

/**
 * F17c — ocupa o rascunho unico e garante a devolucao em qualquer saida,
 * inclusive por excecao. Envolve a funcao INTEIRA, e nao so o laco: assim a
 * guarda de reentrancia tambem cobre `footprintsDe` e a leitura de `dados`.
 */
function executar(
  state: Pick<GameState, 'predios'>, estrada: Uint8Array, de: TileDeGrid, alvos: readonly number[],
  modo: ModoDeBusca, dados: GameData,
): Caminho | null {
  const { largura, altura } = dados.terreno.mapaPadrao;
  ocuparRascunho(largura * altura);
  try {
    return executarComRascunho(state, estrada, de, alvos, modo, dados);
  } finally {
    liberarRascunho();
  }
}

function executarComRascunho(
  state: Pick<GameState, 'predios'>, estrada: Uint8Array, de: TileDeGrid, alvos: readonly number[],
  modo: ModoDeBusca, dados: GameData,
): Caminho | null {
  const { largura, altura } = dados.terreno.mapaPadrao;
  if (!(Number.isInteger(de.gx) && Number.isInteger(de.gy) && de.gx >= 0 && de.gy >= 0 && de.gx < largura && de.gy < altura)) return null;
  if (alvos.length === 0) return null;
  const inicio = de.gy * largura + de.gx;
  if (modo === 'estrada' && estrada[inicio] !== 1) return null;
  if (alvos.includes(inicio)) return { custo: 0, tiles: [] };

  const { bloqueado, caixas } = footprintsDe(state, dados);
  // civis nao colidem: quem esta dentro de um footprint (obra plantada em cima) pode sair
  const liberados = new Set<number>();
  if (modo === 'livre' && bloqueado[inicio] === 1) {
    for (const c of caixas) {
      if (de.gx >= c.x0 && de.gx < c.x1 && de.gy >= c.y0 && de.gy < c.y1) {
        for (let gy = c.y0; gy < c.y1; gy++) for (let gx = c.x0; gx < c.x1; gx++) liberados.add(gy * largura + gx);
      }
    }
  }
  const andavel = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= largura || y >= altura) return false;
    const i = y * largura + x;
    return modo === 'estrada' ? estrada[i] === 1 : bloqueado[i] === 0 || liberados.has(i);
  };

  const { aPe } = dados.movimento.ticksPorTile;
  const { aPe: aPeDiagonal } = dados.movimento.ticksPorTileDiagonal;
  const retoDoTerreno = (i: number): number => (estrada[i] === 1 ? aPe.estrada : aPe.grama);
  const diagonalDoTerreno = (i: number): number => (estrada[i] === 1 ? aPeDiagonal.estrada : aPeDiagonal.grama);

  // Heuristica octil com o MENOR custo de cada tipo de passo: admissivel (nenhum passo
  // real custa menos) e consistente. `min(diagonal, 2 * reto)` cobre um dado em que a
  // diagonal custasse mais que dois retos.
  const menorReto = Math.min(...Object.values(aPe));
  const menorDiagonal = Math.min(Math.min(...Object.values(aPeDiagonal)), 2 * menorReto);
  const heuristica = (x: number, y: number): number => {
    let melhor = Number.POSITIVE_INFINITY;
    for (const alvo of alvos) {
      const dx = Math.abs(x - (alvo % largura));
      const dy = Math.abs(y - Math.floor(alvo / largura));
      const menor = Math.min(dx, dy);
      const h = menorReto * (Math.max(dx, dy) - menor) + menorDiagonal * menor;
      if (h < melhor) melhor = h;
    }
    return melhor;
  };
  const ehAlvo = new Set(alvos);

  // F17c — o rascunho ja foi ocupado e a geracao ja foi virada pelo involucro.
  // `marca[i] !== geracao` e o que antes era `g[i] === +Infinity`.
  const g = rascunhoG;
  const pai = rascunhoPai;
  const marca = rascunhoMarca;
  const geracao = geracaoAtual;
  const gDe = (i: number): number => (marca[i] === geracao ? (g[i] as number) : Number.POSITIVE_INFINITY);

  // fila binaria em vetores paralelos; ordem total (f, h, indice do tile)
  const hIdx: number[] = [];
  const hF: number[] = [];
  const hH: number[] = [];
  const hG: number[] = [];
  const menor = (a: number, b: number): boolean => {
    if (hF[a] !== hF[b]) return (hF[a] as number) < (hF[b] as number);
    if (hH[a] !== hH[b]) return (hH[a] as number) < (hH[b] as number);
    return (hIdx[a] as number) < (hIdx[b] as number);
  };
  const trocar = (a: number, b: number): void => {
    [hIdx[a], hIdx[b]] = [hIdx[b] as number, hIdx[a] as number];
    [hF[a], hF[b]] = [hF[b] as number, hF[a] as number];
    [hH[a], hH[b]] = [hH[b] as number, hH[a] as number];
    [hG[a], hG[b]] = [hG[b] as number, hG[a] as number];
  };
  const empurrar = (idx: number, gv: number, h: number): void => {
    hIdx.push(idx); hF.push(gv + h); hH.push(h); hG.push(gv);
    let i = hIdx.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!menor(i, p)) break;
      trocar(i, p);
      i = p;
    }
  };
  const tirar = (): { idx: number; g: number } => {
    const topo = { idx: hIdx[0] as number, g: hG[0] as number };
    const ultimo = hIdx.length - 1;
    trocar(0, ultimo);
    hIdx.pop(); hF.pop(); hH.pop(); hG.pop();
    let i = 0;
    for (;;) {
      const e = 2 * i + 1;
      const d = e + 1;
      let m = i;
      if (e < hIdx.length && menor(e, m)) m = e;
      if (d < hIdx.length && menor(d, m)) m = d;
      if (m === i) break;
      trocar(i, m);
      i = m;
    }
    return topo;
  };

  marca[inicio] = geracao;
  g[inicio] = 0;
  empurrar(inicio, 0, heuristica(de.gx, de.gy));
  while (hIdx.length > 0) {
    const { idx, g: gAtual } = tirar();
    if (gAtual !== gDe(idx)) continue; // entrada velha: ja se achou coisa melhor
    if (ehAlvo.has(idx)) {
      const tiles: TileDeGrid[] = [];
      for (let atual = idx; atual !== inicio; atual = pai[atual] as number) {
        tiles.push({ gx: atual % largura, gy: Math.floor(atual / largura) });
      }
      return { custo: gAtual, tiles: tiles.reverse() };
    }
    const x = idx % largura;
    const y = Math.floor(idx / largura);
    for (const [dx, dy] of PASSOS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!andavel(nx, ny)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && !(andavel(nx, y) && andavel(x, ny))) continue;
      const vizinho = ny * largura + nx;
      const novo = gAtual + (diagonal ? diagonalDoTerreno(vizinho) : retoDoTerreno(vizinho));
      if (novo < gDe(vizinho)) {
        marca[vizinho] = geracao;
        g[vizinho] = novo;
        pai[vizinho] = idx;
        empurrar(vizinho, novo, heuristica(nx, ny));
      }
    }
  }
  return null;
}
