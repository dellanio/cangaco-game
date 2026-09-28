/**
 * Montagem de cenarios do JobBoard, so para teste. Constroi o estado DIRETO (sem
 * passar por `step`), de proposito: os testes de claim/release precisam de um numero
 * exato de tarefas, e o gerador (que roda no `step`) criaria as suas.
 */
import { completarObra, createInitialState, ID_DO_ARMAZEM } from '../../src/sim/state';
import { condicaoCheiaDoTipo } from '../../src/sim/condicao';
import { gameData } from '../../src/sim/data';
import type {
  GameState, PredioCompleto, PredioEmObra, Tarefa, TarefaConstruir, TarefaMaterialParaObra, Unidade,
} from '../../src/sim/state';
import { chaveDeTile, tilesDaPorta } from '../../src/sim/estradas';
import type { TileDeGrid } from '../../src/sim/estradas';
import { alvoDeNivelamento } from '../../src/sim/obra';
import { tileAndavel } from '../../src/sim/pathfinding';
import { linhaHDe, linhaVDe, naVila } from './ancoras';
import { LADO_DO_JOGADOR } from '../../src/sim/state';

export const inicial = createInitialState(1);

export const tile = (gx: number, gy: number): TileDeGrid => ({ gx, gy });

export const linhaH = (x0: number, x1: number, y: number): TileDeGrid[] =>
  Array.from({ length: x1 - x0 + 1 }, (_, i) => tile(x0 + i, y));

export const linhaV = (x: number, y0: number, y1: number): TileDeGrid[] =>
  Array.from({ length: y1 - y0 + 1 }, (_, i) => tile(x, y0 + i));

export function estradasDe(tiles: readonly TileDeGrid[]): GameState['estradas'] {
  return Object.fromEntries(tiles.map((t) => [chaveDeTile(t), true as const]));
}

/** Acrescenta tiles de estrada (sem custo, sem validar: e montagem de teste). */
export function comEstradas(estado: GameState, tiles: readonly TileDeGrid[]): GameState {
  return { ...estado, estradas: { ...estado.estradas, ...estradasDe(tiles) } };
}

/**
 * F18d-1b — o PREDIO que uma tarefa mira, ou `null`. Nem toda tarefa tem
 * `destino`: a de assentar estrada aponta para um tile (`destinoTile`), e por
 * isso `t.destino` deixou de compilar sobre `Tarefa`. Os testes que so se
 * importam com predio perguntam por aqui.
 */
export function destinoPredioDa(tarefa: Tarefa | undefined): string | null {
  return tarefa !== undefined && 'destino' in tarefa ? tarefa.destino : null;
}

/** F18d-1b — acrescenta tiles ao CANTEIRO (planejados, ninguem assentou ainda).
 *  Irma de `comEstradas`: sem custo e sem validar, e montagem de teste. */
export function comPlanejadas(estado: GameState, tiles: readonly TileDeGrid[]): GameState {
  return { ...estado, estradasPlanejadas: { ...estado.estradasPlanejadas, ...estradasDe(tiles) } };
}

export function armazemDoCenario(estado: GameState): PredioCompleto {
  const p = estado.predios.ordem.map((id) => estado.predios.porId[id]).find((x) => x?.tipo === 'storehouse');
  if (!p || p.estado !== 'completo') throw new Error('fixture: cenario sem armazem');
  return p;
}

/**
 * Acrescenta uma obra em (gx, gy), sem validar. `tipo` define o footprint e a
 * porta. `nivelamento` default = JA NIVELADA (`alvoDeNivelamento(tipo)`): o
 * universo implicito de F09/F10 (escritas antes da F11c) e uma obra que ja
 * aceita material — os testes da F11c passam `nivelamento: 0` explicitamente
 * quando querem o laborer nivelando do zero.
 */
export function comObra(
  estado: GameState,
  id: string,
  opcoes: {
    readonly gx: number; readonly gy: number; readonly tipo?: string;
    readonly faltam: Record<string, number>; readonly nivelamento?: number;
  },
): GameState {
  const tipo = opcoes.tipo ?? 'quarry';
  const obra: PredioEmObra = {
    lado: LADO_DO_JOGADOR, id, tipo, gx: opcoes.gx, gy: opcoes.gy, estado: 'obra', hp: 0,
    obra: { faltam: opcoes.faltam, nivelamento: opcoes.nivelamento ?? alvoDeNivelamento(tipo) },
  };
  return {
    ...estado,
    predios: { porId: { ...estado.predios.porId, [id]: obra }, ordem: [...estado.predios.ordem, id] },
  };
}

/** Troca a pedra da gaveta `saida` de um predio completo. */
export function comPedraNaSaida(estado: GameState, id: string, pedra: number): GameState {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  const novo: PredioCompleto = { ...p, estoque: { ...p.estoque, saida: { ...p.estoque.saida, stone: pedra } } };
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [id]: novo } } };
}

export function serfsDoCenario(estado: GameState): string[] {
  return estado.unidades.ordem.filter((id) => estado.unidades.porId[id]?.tipo === 'serf');
}

export function laborersDoCenario(estado: GameState): string[] {
  return estado.unidades.ordem.filter((id) => estado.unidades.porId[id]?.tipo === 'laborer');
}

/** F11c — tira os laborers do cenario inicial. O universo implicito das suites F09/F10
 *  (escritas antes da F11c) e o serf sozinho: sem isto, os 2 laborers passam a reclamar
 *  'construir', nivelar e martelar as obras dessas fixtures, e a obra vira `completo` ou
 *  muda de HP por conta propria no meio de um teste que so queria observar o serf. Os
 *  testes que plantam pela UI (o pipeline inteiro) mantem os laborers de proposito. */
export function semLaborers(estado: GameState): GameState {
  return laborersDoCenario(estado).reduce((e, id) => semAUnidade(e, id), estado);
}

export function tarefaDe(parcial: Partial<TarefaMaterialParaObra> & { readonly numero: number }): TarefaMaterialParaObra {
  return {
    id: `t${parcial.numero}`,
    tipo: 'material-para-obra',
    mercadoria: 'stone',
    origem: armazemDoCenario(inicial).id,
    destino: 'obra-a',
    estado: 'aberta',
    reclamadaPor: null,
    ...parcial,
  };
}

/** F11b — a irma de `tarefaDe` para tarefas de construir: sem
 *  mercadoria/origem, sem estado `'carregando'`. */
export function tarefaConstruirDe(parcial: Partial<TarefaConstruir> & { readonly numero: number }): TarefaConstruir {
  return {
    id: `t${parcial.numero}`,
    tipo: 'construir',
    destino: 'obra-a',
    estado: 'aberta',
    reclamadaPor: null,
    ...parcial,
  };
}

/** F11b: `proximoId` sobe para passar do maior `numero` dado, nunca desce. Sem isto, um
 *  `gerarTarefas` chamado depois (agora sempre cria 'construir' tambem) podia reusar um
 *  `numero` que a fixture ja escolheu a mao — dois `t<numero>` diferentes colidindo no
 *  mesmo id, um sobrescrevendo o outro em `porId` e duplicado em `ordem`. */
export function comTarefas(estado: GameState, tarefas: readonly Tarefa[]): GameState {
  const maiorNumero = tarefas.reduce((m, t) => Math.max(m, t.numero), 0);
  return {
    ...estado,
    proximoId: Math.max(estado.proximoId, maiorNumero + 1),
    jobs: {
      tarefas: {
        porId: Object.fromEntries(tarefas.map((t) => [t.id, t])),
        ordem: tarefas.map((t) => t.id),
      },
    },
  };
}

/**
 * O cenario basico: o armazem do cenario inicial (30 de pedra na saida), uma obra
 * `obra-a` (quarry) em (26,34) e uma estrada de 5 tiles ligando a porta do armazem
 * (29,33) a porta da obra (28,36). Sem nenhuma tarefa.
 */
export function cenarioLigado(faltam: Record<string, number> = { stone: 2, timber: 3 }): GameState {
  const comObraA = comObra(inicial, 'obra-a', { ...naVila(-3, 4), faltam });
  return comEstradas(comObraA, [naVila(0, 3), naVila(0, 4), naVila(0, 5), naVila(0, 6), naVila(-1, 6)]);
}

/** Um armazem completo a mais, com a pedra e a tabua dadas na saida. */
export function comArmazemCompleto(
  estado: GameState, id: string, opcoes: { readonly gx: number; readonly gy: number; readonly stone?: number; readonly timber?: number },
): GameState {
  const predio: PredioCompleto = {
    lado: LADO_DO_JOGADOR, id, tipo: 'storehouse', gx: opcoes.gx, gy: opcoes.gy, estado: 'completo', hp: 0,
    capacidade: { entrada: null, saida: null },
    estoque: { entrada: {}, saida: { stone: opcoes.stone ?? 0, timber: opcoes.timber ?? 0 } },
    ocupante: null, producao: null, pausado: false,
  };
  return {
    ...estado,
    predios: { porId: { ...estado.predios.porId, [id]: predio }, ordem: [...estado.predios.ordem, id] },
  };
}

/**
 * F14 — acrescenta um predio COMPLETO de qualquer tipo (a irma de
 * `comArmazemCompleto`, que so faz armazem). Passa pelo MESMO caminho do jogo,
 * `completarObra`: capacidade, estoque e `ocupante` nascem de la, e a fixture
 * nao pode divergir do que o jogo produz.
 */
export function comPredioCompletoEm(
  estado: GameState,
  id: string,
  opcoes: { readonly tipo: string; readonly gx: number; readonly gy: number },
): GameState {
  const def = gameData.predios.find((p) => p.id === opcoes.tipo);
  if (!def) throw new Error(`fixture: tipo '${opcoes.tipo}' nao existe em buildings.json`);
  const predio = completarObra({
    lado: LADO_DO_JOGADOR, id, tipo: opcoes.tipo, gx: opcoes.gx, gy: opcoes.gy, estado: 'obra', hp: def.hp,
    obra: { faltam: {}, nivelamento: 0 },
  });
  return {
    ...estado,
    predios: { porId: { ...estado.predios.porId, [id]: predio }, ordem: [...estado.predios.ordem, id] },
  };
}

/**
 * F18d-1a — tapa a PORTA de um predio com outro predio completo. Desde que a
 * entrega do nivel 3 anda livre, e isto que corta o caminho de uma tarefa de
 * material: um predio em cima da porta, nao a demolicao da rua.
 *
 * Confere o que promete: se a tampa nao cobrir a porta INTEIRA, lanca — uma
 * fixture que so acha que bloqueou faria o teste passar pelo motivo errado.
 */
export function comAPortaTapada(estado: GameState, id: string, tipo: string = ID_DO_ARMAZEM): GameState {
  const predio = estado.predios.porId[id];
  if (!predio) throw new Error(`fixture: predio '${id}' nao existe`);
  const portas = tilesDaPorta(predio);
  const primeira = portas[0];
  if (primeira === undefined) throw new Error(`fixture: predio '${id}' sem porta`);
  const tapado = comPredioCompletoEm(estado, `tampa-de-${id}`, { tipo, gx: primeira.gx, gy: primeira.gy });
  const aberta = portas.filter((t) => tileAndavel(tapado, t, 'livre'));
  if (aberta.length > 0) throw new Error(`fixture: a tampa de '${id}' deixou ${aberta.length} tile(s) de porta livre(s)`);
  return tapado;
}

/** Troca a pedra E a tabua da saida de um predio completo. */
export function comEstoqueNaSaida(estado: GameState, id: string, estoque: { readonly stone: number; readonly timber: number }): GameState {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  const novo: PredioCompleto = { ...p, estoque: { ...p.estoque, saida: { ...p.estoque.saida, ...estoque } } };
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [id]: novo } } };
}

/** Tira um predio do estado (demolir, no que importa aqui). */
export function semOPredio(estado: GameState, id: string): GameState {
  const porId = { ...estado.predios.porId };
  delete porId[id];
  return { ...estado, predios: { porId, ordem: estado.predios.ordem.filter((x) => x !== id) } };
}

/** Tira uma unidade do estado (a unidade morreu). */
export function semAUnidade(estado: GameState, id: string): GameState {
  const porId = { ...estado.unidades.porId };
  delete porId[id];
  return { ...estado, unidades: { porId, ordem: estado.unidades.ordem.filter((x) => x !== id) } };
}

/**
 * O caso adversarial da distancia euclidiana. O armazem tem a porta em y=33
 * (x 29..31). A obra PERTO fica logo abaixo dele, mas a unica estrada que chega a
 * porta dela da uma volta grande; a obra LONGE fica muito mais ao sul, mas tem uma
 * estrada quase reta. Em linha reta a PERTO ganha; pelo caminho a pe, a LONGE.
 */
export function cenarioDeVolta(): GameState {
  let estado = comObra(inicial, 'perto', { ...naVila(0, 4), faltam: { stone: 1 } }); // porta y=36, x 29..31
  estado = comObra(estado, 'longe', { ...naVila(-1, 15), faltam: { stone: 1 } }); // porta y=47, x 28..30
  const voltaGrande = [
    ...linhaHDe(naVila, 0, 11, 3), ...linhaVDe(naVila, 11, 4, 6), ...linhaHDe(naVila, 2, 10, 6), // porta (31,36) so por aqui
  ];
  const retaQuase = [naVila(-1, 3), naVila(-2, 3), ...linhaVDe(naVila, -2, 4, 17), naVila(-1, 17)];
  return comEstradas(estado, [...voltaGrande, ...retaQuase]);
}

/** A diagonal de `n` tiles que sai do tile dado indo para sudeste. A estrada liga
 *  em 8 direcoes desde a F18e, entao uma rua diagonal e uma rua de verdade. */
const linhaD = ({ gx, gy }: TileDeGrid, n: number): TileDeGrid[] =>
  Array.from({ length: n }, (_, i) => tile(gx + i, gy + i));

/**
 * F18d-1a — a armadilha da reta, agora na rede LIVRE. Entregar material em obra
 * anda por qualquer tile (delivery.json, nivel 3 `modo: livre`), entao a rua
 * deixou de ser a CONDICAO da escolha. Ela continua sendo a rota BARATA: andando
 * a pe, um tile de grama custa 7 ticks (9 na diagonal) e um de estrada custa 5
 * (7 na diagonal) — terrain.json/movimento.ticksPorTile.
 *
 * `perto` fica a sudoeste, mais perto em linha reta, e so tem grama pela frente.
 * `longe` fica a sudeste, mais longe, e tem uma rua diagonal ate a porta. Medido:
 * reta 35.51 x 43.14, ticks 242 x 206. Quem decide e o tick.
 *
 * E o mesmo papel que o `cenarioDeVolta` faz na rede de estradas, que segue
 * valendo para os niveis que exigem rua.
 */
export function cenarioDaRuaMaisBarata(): GameState {
  let estado = comObra(inicial, 'perto', { ...naVila(-19, 30), faltam: { stone: 1 } }); // porta y=62, x 10..12
  estado = comObra(estado, 'longe', { ...naVila(31, 30), faltam: { stone: 1 } });      // porta y=62, x 60..62
  const ruaAteALonge = [
    naVila(2, 3),               // uma porta do armazem, para a rua tambem ligar na rede de estradas
    ...linhaD(naVila(3, 4), 28),      // (32,34) ate (59,61)
    naVila(30, 32), naVila(31, 32), // entra na porta de lado: a diagonal cortaria a quina do predio (F18e)
  ];
  return comEstradas(estado, ruaAteALonge);
}

/** Poe uma unidade em (gx, gy), ociosa e sem `fsmData` (so o lugar muda). */
export function comUnidadeEm(estado: GameState, id: string, gx: number, gy: number): GameState {
  const u = estado.unidades.porId[id];
  if (!u) throw new Error(`fixture: unidade '${id}' nao existe`);
  return { ...estado, unidades: { ...estado.unidades, porId: { ...estado.unidades.porId, [id]: { ...u, gx, gy } } } };
}

/** F11b — acrescenta uma unidade nova (id `id`, tipo `tipo`), ociosa e sem
 *  `fsmData`. O cenario inicial so tem 2 laborers; testes de teto
 *  (`laborersMaximosPorObra`) precisam de mais do que isso. */
export function comUnidadeExtra(estado: GameState, id: string, tipo: string, gx: number, gy: number): GameState {
  // F20b: a fixture nasce com a condicao CHEIA do tipo, como a unidade do jogo.
  const unidade: Unidade = { lado: LADO_DO_JOGADOR, id, tipo, gx, gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tipo) };
  return {
    ...estado,
    unidades: { porId: { ...estado.unidades.porId, [id]: unidade }, ordem: [...estado.unidades.ordem, id] },
  };
}
