/**
 * F20a — a geometria da Bodega e os dois cenarios que os testes usam, derivados
 * do dado e do MESMO predicado que a sim usa para recusar planta (`canPlace`).
 * Nenhuma coordenada de prédio digitada: a Bodega anda para o leste na linha de
 * porta do armazem ate o primeiro x em que o jogo a aceitaria. O molde e
 * `aberturaDaFaseA`, e o motivo de andar em vez de fixar x e o BUG-F (recurso
 * debaixo do footprint recusa construcao).
 *
 * Aqui nao ha assercao de aceite: so montagem. Quem afirma e `tests/F20a-bodega.test.ts`.
 */
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import type { Command } from '../../src/sim/commands';
import { createInitialState, ID_DA_BODEGA } from '../../src/sim/state';
import type { GameState, Predio, PredioCompleto, Tarefa } from '../../src/sim/state';
import { caixaDeTipo, caixaDoPredio } from '../../src/sim/footprint';
import { armazensCompletos, canPlaceRoad } from '../../src/sim/estradas';
import type { TileDeGrid } from '../../src/sim/estradas';
import { canPlace } from '../../src/sim/placement';
import { step } from '../../src/sim/tick';
import { comEstradas, comPredioCompletoEm } from './jobs-cenario';

/** O id da Bodega nos cenarios montados. No caminho real quem da o id e a sim. */
export const ID_DA_BODEGA_NO_CENARIO = 'bodega';

export interface PlantaDaBodega {
  /** Canto superior esquerdo — a convencao de `PlaceBlueprint`. */
  readonly gx: number;
  readonly gy: number;
  /** A reta na linha de porta, do armazem ate passar pela porta da Bodega. */
  readonly rua: readonly TileDeGrid[];
  readonly armazem: string;
  readonly yRua: number;
  readonly timber: number;
  readonly stone: number;
}

function defDaBodega(dados: GameData) {
  const def = dados.predios.find((p) => p.id === ID_DA_BODEGA);
  if (!def) throw new Error(`bodega-cenario: '${ID_DA_BODEGA}' nao existe em data/buildings.json`);
  return def;
}

/** A linha de porta de um predio: a primeira linha ABAIXO do footprint. */
function linhaDaPorta(predio: PredioCompleto, dados: GameData): number {
  const caixa = caixaDoPredio(predio, dados);
  if (caixa === null) throw new Error(`bodega-cenario: '${predio.tipo}' nao tem tamanho`);
  return caixa.y1;
}

/**
 * Onde a Bodega cabe: na linha de porta do armazem, o primeiro x a LESTE dele em
 * que `canPlace` — o predicado do jogo, com recurso, sobreposicao e porta — diz
 * sim. Lanca se nao couber; escolher um x qualquer faria o teste passar pelo
 * motivo errado.
 */
export function plantaDaBodega(state: GameState, dados: GameData = gameData): PlantaDaBodega {
  const armazem = armazensCompletos(state)[0];
  if (!armazem) throw new Error('bodega-cenario: o cenario precisa de um armazem completo');
  const caixaDoArmazem = caixaDoPredio(armazem, dados);
  if (caixaDoArmazem === null) throw new Error('bodega-cenario: armazem sem tamanho');
  const caixa = caixaDeTipo(ID_DA_BODEGA, 0, 0, dados);
  if (caixa === null) throw new Error('bodega-cenario: a Bodega nao tem tamanho em buildings.json');
  const altura = caixa.y1;

  const yRua = linhaDaPorta(armazem, dados);
  const gy = yRua - altura;
  const limite = dados.terreno.mapaPadrao.largura;
  let gx = caixaDoArmazem.x1 + 1;
  while (gx < limite && !canPlace(state, ID_DA_BODEGA, gx, gy, dados).ok) gx += 1;
  if (gx >= limite) {
    throw new Error('bodega-cenario: a Bodega nao cabe na linha de porta do armazem, a leste dele');
  }

  // A reta na linha da porta, da porta do armazem ate o fim do footprint da
  // Bodega. Onde a reta cai em recurso que a estrada recusa, desce UM tile e
  // volta — o mesmo desvio da abertura da Fase A, e pelo mesmo motivo: buraco na
  // reta partiria a rede em dois componentes.
  const rua: TileDeGrid[] = [];
  const caixaDaBodega = caixaDeTipo(ID_DA_BODEGA, gx, gy, dados);
  if (caixaDaBodega === null) throw new Error('bodega-cenario: a Bodega nao tem tamanho');
  for (let x = caixaDoArmazem.x0; x < caixaDaBodega.x1; x++) {
    const reto: TileDeGrid = { gx: x, gy: yRua };
    const recusa = canPlaceRoad(state, [reto], dados);
    if (recusa.ok) { rua.push(reto); continue; }
    if (recusa.motivo !== 'recurso') {
      throw new Error(`bodega-cenario: a rua nao passa em ${x},${yRua} por '${recusa.motivo}'`);
    }
    rua.push({ gx: x, gy: yRua + 1 });
  }

  const def = defDaBodega(dados);
  return { gx, gy, rua, armazem: armazem.id, yRua, timber: def.timber, stone: def.stone };
}

/** A Bodega deste estado. Lanca se nao houver: o teste que a procura precisa dela. */
export function bodegaDoCenario(estado: GameState): PredioCompleto {
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (p && p.tipo === ID_DA_BODEGA && p.estado === 'completo') return p;
  }
  throw new Error('bodega-cenario: nenhuma Bodega COMPLETA no estado');
}

/** A Bodega deste estado, obra ou completa; `undefined` se o jogador nao a plantou. */
export function bodegaSeExistir(estado: GameState): Predio | undefined {
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (p && p.tipo === ID_DA_BODEGA) return p;
  }
  return undefined;
}

/**
 * O cenario MONTADO: a vila inicial com uma Bodega ja completa no lugar que
 * `plantaDaBodega` derivou, ligada ao armazem pela rua (sem custo: e fixture).
 * `comRua: false` monta a mesma Bodega SEM estrada — o cenario do "nada trava".
 */
export function cenarioComBodega(
  opcoes: { readonly comRua?: boolean; readonly semente?: number } = {},
): GameState {
  const base = createInitialState(opcoes.semente ?? 1);
  const planta = plantaDaBodega(base);
  // `comPredioCompletoEm` passa pelo MESMO `completarObra` do jogo: capacidade,
  // estoque e `ocupante` nascem de la, e a fixture nao pode divergir do jogo.
  const comBodega = comPredioCompletoEm(base, ID_DA_BODEGA_NO_CENARIO, {
    tipo: ID_DA_BODEGA, gx: planta.gx, gy: planta.gy,
  });
  return opcoes.comRua === false ? comBodega : comEstradas(comBodega, planta.rua);
}

/** As tarefas de um tipo, em ordem de numero. */
export function tarefasDoTipo(estado: GameState, tipo: string): readonly Tarefa[] {
  return estado.jobs.tarefas.ordem
    .map((id) => estado.jobs.tarefas.porId[id])
    .filter((t): t is Tarefa => t !== undefined && t.tipo === tipo)
    .sort((a, b) => a.numero - b.numero);
}

/** Quantas tarefas por mercadoria, para comparar com o teto do dado. */
export function contarPorMercadoria(tarefas: readonly Tarefa[]): Record<string, number> {
  const conta: Record<string, number> = {};
  for (const t of tarefas) {
    if (!('mercadoria' in t)) continue;
    conta[t.mercadoria] = (conta[t.mercadoria] ?? 0) + 1;
  }
  return conta;
}

export const avancar = (estado: GameState, ticks: number): GameState => {
  let atual = estado;
  for (let i = 0; i < ticks; i++) atual = step(atual, []);
  return atual;
};

/**
 * O CAMINHO REAL: do estado inicial, so por comando. No tick 0 o jogador puxa a
 * rua e planta a Bodega — nada mais. Os laborers a constroem com o timber e a
 * pedra da abertura, e os serfs levam a comida.
 */
export function comandosDaBodega(planta: PlantaDaBodega, tick: number): readonly Command[] {
  if (tick !== 0) return [];
  return [
    { type: 'PlaceRoad', tiles: planta.rua },
    { type: 'PlaceBlueprint', buildingId: ID_DA_BODEGA, gx: planta.gx, gy: planta.gy },
  ];
}

export interface CorridaDaBodega {
  readonly fim: GameState;
  readonly planta: PlantaDaBodega;
  /** Tick em que a Bodega virou `completo`; `null` se nao virou. */
  readonly tickCompleta: number | null;
  /** Por comida, o tick em que a gaveta `entrada` da Bodega chegou ao teto. */
  readonly tickNoTeto: Record<string, number>;
}

export function rodarAberturaDaBodega(
  ticks: number, teto: number, comidas: readonly string[], dados: GameData = gameData,
): CorridaDaBodega {
  const base = createInitialState(1, dados);
  const planta = plantaDaBodega(base, dados);
  let atual = base;
  let tickCompleta: number | null = null;
  const tickNoTeto: Record<string, number> = {};
  for (let tick = 0; tick < ticks; tick++) {
    atual = step(atual, comandosDaBodega(planta, tick), dados);
    const bodega = bodegaSeExistir(atual);
    if (bodega === undefined) continue;
    if (tickCompleta === null && bodega.estado === 'completo') tickCompleta = tick;
    if (bodega.estado !== 'completo') continue;
    for (const comida of comidas) {
      if (tickNoTeto[comida] === undefined && (bodega.estoque.entrada[comida] ?? 0) >= teto) {
        tickNoTeto[comida] = tick;
      }
    }
  }
  return { fim: atual, planta, tickCompleta, tickNoTeto };
}
