/**
 * F18g — COMPONENTES DE ALCANCE A PE: "da para ir daqui ate ali sem carga?",
 * respondido em O(1) depois de UMA varredura do mapa.
 *
 * Por que existe: a pedra do canteiro e uma carga por tile, e um canteiro tem
 * dezenas de tiles. O saneamento pergunta a existencia de caminho de toda carga
 * aberta todo tick, e o gerador pergunta antes de abrir cada uma. Respondida por
 * A*, a pergunta custa uma busca por porta por tile — e, quando o tile e ilhado,
 * uma inundacao do mapa inteiro. Medido no caos da F09 (semente 1): 0,5 s viraram
 * 4,7 s so com isso, e uma memoizacao por par (porta, tile) ainda deixava 90
 * buscas a cada predio que nasce ou some.
 *
 * O indice e a mesma ideia do de `estradas.ts` (componentes da rede, memoizados
 * pela referencia), agora sobre o grafo do passo LIVRE: os nos sao os tiles
 * andaveis (`tileAndavel(..., 'livre')`: dentro do mapa, terreno transponivel,
 * sem recurso que bloqueia, fora de footprint) e as arestas sao os oito
 * vizinhos, com a diagonal exigindo as DUAS quinas andaveis — exatamente o
 * `andavel` + `quinaLivre` do A* de `pathfinding.ts` em modo `'livre'`, para que
 * "mesmo componente" e "o A* acha caminho" sejam a mesma resposta.
 *
 * O que NAO e igual ao A*, de proposito: o A* libera o tile de PARTIDA e os de
 * CHEGADA mesmo debaixo de footprint (uma unidade dentro de um predio pode sair
 * dele). Aqui tile fora do grafo tem componente -1 e nao alcanca nada. A unica
 * pergunta que usa isto hoje e a da pedra do canteiro (porta de armazem -> tile
 * planejado), e porta e tile de canteiro ficam fora de footprint por construcao
 * (`canPlaceRoad` recusa sobreposicao); um tile de canteiro que um predio cobriu
 * depois e tile morto, e "nao alcanca" e a resposta certa para ele.
 *
 * CACHE: `WeakMap` pelas referencias de `dados`, de `predios.ordem` (o conjunto de
 * footprints so muda quando um predio entra ou sai) e da camada de bloqueio por
 * recurso (que so troca de referencia quando a lista de tiles bloqueados muda de
 * fato). `estradas` nao entra: rua muda o custo do passo, nunca a existencia.
 * Memoria de cache, funcao pura das referencias imutaveis, fora do JSON, sem
 * efeito no determinismo — o mesmo contrato do indice de estradas.
 */
import type { GameState } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import type { TileDeGrid } from './estradas';
import { tileAndavel } from './pathfinding';
import { camadaDeBloqueio } from './recursos';

type Mundo = Pick<GameState, 'predios' | 'estradas' | 'recursos'>;

const PASSOS: readonly (readonly [number, number])[] = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1],
];

const indices = new WeakMap<GameData, WeakMap<object, WeakMap<object, Int32Array>>>();

function montar(state: Mundo, dados: GameData): Int32Array {
  const { largura, altura } = dados.terreno.mapaPadrao;
  const total = largura * altura;
  const andavel = new Uint8Array(total);
  for (let gy = 0; gy < altura; gy += 1) {
    for (let gx = 0; gx < largura; gx += 1) {
      if (tileAndavel(state, { gx, gy }, 'livre', dados)) andavel[gy * largura + gx] = 1;
    }
  }
  const componente = new Int32Array(total).fill(-1);
  const fila = new Int32Array(total);
  let proximo = 0;
  for (let raiz = 0; raiz < total; raiz += 1) {
    if (andavel[raiz] === 0 || componente[raiz] !== -1) continue;
    let inicio = 0;
    let fim = 0;
    fila[fim++] = raiz;
    componente[raiz] = proximo;
    while (inicio < fim) {
      const idx = fila[inicio++] as number;
      const x = idx % largura;
      const y = Math.floor(idx / largura);
      for (const [dx, dy] of PASSOS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= largura || ny >= altura) continue;
        const vizinho = ny * largura + nx;
        if (andavel[vizinho] === 0 || componente[vizinho] !== -1) continue;
        // a quina do passo diagonal: as duas ortogonais andaveis, como no A*
        if (dx !== 0 && dy !== 0 && !(andavel[y * largura + nx] === 1 && andavel[ny * largura + x] === 1)) continue;
        componente[vizinho] = proximo;
        fila[fim++] = vizinho;
      }
    }
    proximo += 1;
  }
  return componente;
}

function indiceDeAlcance(state: Mundo, dados: GameData): Int32Array {
  let porOrdem = indices.get(dados);
  if (porOrdem === undefined) { porOrdem = new WeakMap(); indices.set(dados, porOrdem); }
  let porCamada = porOrdem.get(state.predios.ordem);
  if (porCamada === undefined) { porCamada = new WeakMap(); porOrdem.set(state.predios.ordem, porCamada); }
  const camada = camadaDeBloqueio(state, dados);
  const existente = porCamada.get(camada);
  if (existente !== undefined) return existente;
  const criado = montar(state, dados);
  porCamada.set(camada, criado);
  return criado;
}

/** O componente de alcance a pe do tile, ou -1 se ele nao e andavel (fora do mapa,
 *  terreno, recurso que bloqueia, footprint). */
export function componenteAPe(state: Mundo, tile: TileDeGrid, dados: GameData = gameData): number {
  const { largura, altura } = dados.terreno.mapaPadrao;
  if (!(Number.isInteger(tile.gx) && Number.isInteger(tile.gy)
    && tile.gx >= 0 && tile.gy >= 0 && tile.gx < largura && tile.gy < altura)) return -1;
  return indiceDeAlcance(state, dados)[tile.gy * largura + tile.gx] as number;
}

/** Existe caminho a pe entre os dois tiles? Os dois andaveis e no mesmo componente. */
export function alcancavelAPe(state: Mundo, de: TileDeGrid, ate: TileDeGrid, dados: GameData = gameData): boolean {
  const a = componenteAPe(state, de, dados);
  return a !== -1 && a === componenteAPe(state, ate, dados);
}
