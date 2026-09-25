/**
 * F17 — A abertura da Fase A como DADO, mais o medidor que a acompanha.
 *
 * Aqui nao ha assercao nenhuma: este arquivo so monta a geometria (derivada de
 * `data/*.json`, nunca digitada), emite os comandos do jogador e ANOTA o que
 * aconteceu. Quem afirma e `tests/F17-aceite.test.ts`; quem repete os mesmos
 * cliques na tela e `tools/shots/F17.js`.
 *
 * A GEOMETRIA (D1 do plano): os quatro predios em UMA fila, na linha de porta do
 * armazem, encostados na horizontal, o mais a leste que a fila couber. A regra da
 * porta (F16a) e respeitada por construcao: nenhum predio fica ABAIXO de outro.
 *
 * BUG-F (2026-09-24) mudou duas premissas desta fila, e as duas por MEDICAO:
 *   - ela nao termina mais encostada no armazem. Encostada, a pedreira caia em
 *     cima do lajedo da vila (rocha em 22..26 x 29..33, medido), e rocha passou a
 *     recusar construcao — era este cenario, o do aceite, que mais exibia o
 *     defeito: a pedreira lavrando a rocha debaixo das proprias paredes. O comeco
 *     da fila agora RECUA ate caber sem pisar em recurso que bloqueia, pelo mesmo
 *     predicado que a sim usa (`recursoBloqueiaConstrucao`), e nao por x digitado.
 *   - a pedreira passou a ser a ULTIMA, e a serraria a penultima. O motivo antigo
 *     da serraria por ultimo era trafego de tronco e tabua; com a fila recuada,
 *     ela esta a 8 tiles do armazem de qualquer jeito, e o que a ordem decide
 *     agora e quanta rocha a pedreira alcanca: pedreira por ultimo (colada no
 *     lajedo) alcanca os 13 tiles do lajedo, como antes; pedreira no meio da fila
 *     alcanca 4. Medido nesta sessao, `alcance_tiles: 6` a partir do footprint.
 *
 * A rua e uma reta na linha da porta, com DESVIO de um tile para o sul onde a reta
 * cai em rocha (o tile 24,33 do lajedo) — a estrada tambem recusa recurso que
 * bloqueia construcao, e um buraco na reta partiria a rede em dois componentes.
 *
 * A ORDEM DOS COMANDOS reage ao ESTADO, nao ao relogio: a serraria so pode ser
 * plantada depois que uma casa de lenhador CHEGA a `completo`
 * (`sawmill.desbloqueadoPor = woodcutters`, e `estaDesbloqueado` le
 * `tiposJaConstruidos`, que e historico de `building-completed`).
 */
import { gameData } from '../../src/sim/data';
import type { GameData, PredioData } from '../../src/sim/data/types';
import { ID_DA_ESCOLA } from '../../src/sim/state';
import type { GameState, PredioCompleto } from '../../src/sim/state';
import type { Command } from '../../src/sim/commands';
import type { TileDeGrid } from '../../src/sim/estradas';
import { armazensCompletos, ehEstrada } from '../../src/sim/estradas';
import { canPlaceRoad } from '../../src/sim/estradas';
import { recursoBloqueiaConstrucao, recursoNoTile } from '../../src/sim/recursos';
import { caixaDeTipo } from '../../src/sim/footprint';
import { estoqueDosArmazens } from '../../src/sim/selectors';
import { estaDesbloqueado } from '../../src/sim/desbloqueio';
import type { CaixaDePredio } from '../../tools/geometria-da-abertura.d.mts';
import { TIPOS_DA_ABERTURA, geometriaDaAbertura } from '../../tools/geometria-da-abertura.mjs';

/**
 * Os quatro predios do aceite (BUILD_PLAN F17, GDD §1.3), na ordem em que entram
 * na fila — que e tambem a ordem espacial, da esquerda para a direita. Nao e
 * numero de balanceamento: e a lista que o criterio nomeia.
 */
export { TIPOS_DA_ABERTURA };

export interface PlantaDaAbertura {
  readonly tipo: string;
  /** Canto superior esquerdo — a mesma convencao de `PlaceBlueprint`. */
  readonly gx: number;
  readonly gy: number;
  /** O civil que ocupa este predio (`buildings.trabalhador`). */
  readonly civil: string;
  readonly timber: number;
  readonly stone: number;
}

export interface Abertura {
  readonly plantas: readonly PlantaDaAbertura[];
  readonly rua: readonly TileDeGrid[];
  readonly armazem: string;
  readonly escola: string;
  readonly yRua: number;
  readonly stoneDaRua: number;
  readonly stoneDasPlantas: number;
  readonly timberDasPlantas: number;
}

function defDe(tipo: string, dados: GameData): PredioData {
  const def = dados.predios.find((p) => p.id === tipo);
  if (!def) throw new Error(`abertura: '${tipo}' nao existe em data/buildings.json`);
  return def;
}

/** Largura e altura em tiles, pelo MESMO caminho que a sim usa (`caixaDeTipo`) —
 *  ler `tamanho[0]` aqui seria uma segunda leitura do mesmo dado. */
function tamanhoDe(tipo: string, dados: GameData): { largura: number; altura: number } {
  const caixa = caixaDeTipo(tipo, 0, 0, dados);
  if (caixa === null) throw new Error(`abertura: '${tipo}' nao tem tamanho em data/buildings.json`);
  return { largura: caixa.x1, altura: caixa.y1 };
}

/** A caixa de um predio no formato que o modulo de geometria pede. */
function caixaDeEntrada(predio: PredioCompleto, dados: GameData): CaixaDePredio {
  const { largura, altura } = tamanhoDe(predio.tipo, dados);
  return { gx: predio.gx, gy: predio.gy, largura, altura };
}

function predioCompletoDoTipo(state: GameState, tipo: string): PredioCompleto {
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p && p.tipo === tipo && p.estado === 'completo') return p;
  }
  throw new Error(`abertura: o cenario precisa de um '${tipo}' completo`);
}

/** O predio cujo CANTO e este tile, ou null. So o canto: e onde a planta nasce. */
function predioNoCanto(state: GameState, gx: number, gy: number): string | null {
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p && p.gx === gx && p.gy === gy) return id;
  }
  return null;
}

/**
 * Monta a abertura a partir do estado inicial. Tudo derivado: largura e altura de
 * `tamanho`, custo de `timber`/`stone`, civil de `trabalhador`, linha da porta da
 * altura do armazem.
 */
export function aberturaDaFaseA(state: GameState, dados: GameData = gameData): Abertura {
  const armazem = armazensCompletos(state)[0];
  if (!armazem) throw new Error('abertura: o cenario precisa de um armazem completo');
  const escola = predioCompletoDoTipo(state, ID_DA_ESCOLA);

  // A GEOMETRIA vem do modulo compartilhado com o roteiro da F17
  // (`tools/geometria-da-abertura.mjs`). Ate a F-T4b esta derivacao estava
  // escrita a mao aqui E la, e manter duas copias identicas a olho nao
  // sobrevive a uma geometria com mais de uma reta: o roteiro clicaria num tile
  // e o headless plantaria noutro.
  const geo = geometriaDaAbertura({
    armazem: caixaDeEntrada(armazem, dados),
    escola: caixaDeEntrada(escola, dados),
    tamanhoDe: (tipo: string) => tamanhoDe(tipo, dados),
    bloqueia: (gx: number, gy: number) => recursoBloqueiaConstrucao(recursoNoTile(state, gx, gy), dados),
  });
  const yRua = geo.yRua;

  const plantas: PlantaDaAbertura[] = geo.plantas.map((p) => {
    const def = defDe(p.tipo, dados);
    const civil = def.trabalhador;
    if (civil === null) {
      throw new Error(`abertura: '${p.tipo}' nao pede trabalhador; sem isso "ocupados" nao e provavel`);
    }
    return { tipo: p.tipo, gx: p.gx, gy: p.gy, civil, timber: def.timber, stone: def.stone };
  });

  // O modulo desvia a rua pelo MESMO predicado de recurso que a sim usa, mas
  // quem recusa estrada e `canPlaceRoad`, que sabe de mais coisa. Conferir aqui
  // mantem o guarda que a fila tinha antes: recusa por outro motivo estoura o
  // fixture, em vez de entregar uma rede partida em dois componentes.
  const rua: TileDeGrid[] = geo.rua.map((t) => ({ gx: t.gx, gy: t.gy }));
  for (const t of rua) {
    const recusa = canPlaceRoad(state, [t], dados);
    if (!recusa.ok) {
      throw new Error(`abertura: a rua nao passa em ${t.gx},${t.gy} por '${recusa.motivo}'`);
    }
  }

  return {
    plantas,
    rua,
    armazem: armazem.id,
    escola: escola.id,
    yRua,
    stoneDaRua: rua.length * dados.terreno.estrada.custoStonePorTile,
    stoneDasPlantas: plantas.reduce((s, p) => s + p.stone, 0),
    timberDasPlantas: plantas.reduce((s, p) => s + p.timber, 0),
  };
}

/**
 * Os comandos DESTE tick. No tick 0 puxa a rua inteira e enfileira os quatro
 * treinos; a cada tick, planta toda casa que ainda nao existe e ja esta
 * desbloqueada — e assim a serraria sai sozinha no primeiro tick em que pode.
 * Nenhum comando fora desta lista: e o mesmo que o jogador clicaria.
 */
export function comandosNoTick(
  state: GameState, abertura: Abertura, tick: number, dados: GameData = gameData,
): readonly Command[] {
  const comandos: Command[] = [];
  if (tick === 0) {
    comandos.push({ type: 'PlaceRoad', tiles: abertura.rua });
    for (const p of abertura.plantas) {
      comandos.push({ type: 'EnqueueTraining', predio: abertura.escola, unidade: p.civil });
    }
  }
  for (const p of abertura.plantas) {
    if (predioNoCanto(state, p.gx, p.gy) !== null) continue;
    if (!estaDesbloqueado(state, p.tipo, dados)) continue;
    comandos.push({ type: 'PlaceBlueprint', buildingId: p.tipo, gx: p.gx, gy: p.gy });
  }
  return comandos;
}

export interface AmostraDaAbertura {
  readonly tick: number;
  /** Laborers reclamados por OBRA (tarefa `construir`), por id de predio. */
  readonly laborersPorObra: Readonly<Record<string, number>>;
  readonly noArmazem: Readonly<Record<string, number>>;
  readonly tarefasAbertasPorTipo: Readonly<Record<string, number>>;
}

export interface MedicaoDaAbertura {
  /** Primeiro tick em que cada coisa passou a valer; `null` = nunca aconteceu. */
  readonly marcos: Readonly<Record<string, number | null>>;
  readonly amostras: readonly AmostraDaAbertura[];
  /** Acumulado ENTREGUE ao armazem, por soma dos deltas POSITIVOS do saldo. */
  readonly entregueAoArmazem: Readonly<Record<string, number>>;
  /** Acumulado entregue contado por EVENTO (`task-completed` com destino no armazem). */
  readonly entregasPorEvento: Readonly<Record<string, number>>;
  /** Acumulado PRODUZIDO (`goods-produced`) — a mesma serie que a F15b usa. */
  readonly produzido: Readonly<Record<string, number>>;
  readonly noArmazemInicial: Readonly<Record<string, number>>;
  readonly menorNoArmazem: Readonly<Record<string, { readonly valor: number; readonly tick: number }>>;
  readonly recusas: readonly { readonly tick: number; readonly comando: string; readonly motivo: string }[];
  readonly ordemDeConclusao: readonly { readonly tick: number; readonly predio: string; readonly tipo: string }[];
  readonly ticks: number;
}

export interface Medidor {
  /** Chamar uma vez por tick, DEPOIS do `step`. */
  observar(state: GameState): void;
  resultado(): MedicaoDaAbertura;
}

const MERCADORIAS_OBSERVADAS: readonly string[] = ['stone', 'timber', 'tree_trunk'];
const PASSO_DA_AMOSTRA = 50;

/**
 * O medidor. Guarda serie, nao so o fim: "em que tick" e a pergunta que a F17
 * existe para responder, e um estado final nao diz em que ordem se chegou nele.
 *
 * SALDO e ACUMULADO sao perguntas diferentes, e o medidor responde as duas em
 * campos separados de proposito: `noArmazem` (saldo, que sobe e DESCE, porque a
 * rua e as obras gastam) e `entregueAoArmazem` (acumulado, que so sobe). Medir
 * "a vila produziu?" pelo saldo confunde producao com o que ja havia — foi o que
 * derrubou o monotonico da F15b.
 */
export function criarMedidor(
  estadoInicial: GameState, abertura: Abertura, dados: GameData = gameData,
): Medidor {
  const marcos: Record<string, number | null> = {};
  const amostras: AmostraDaAbertura[] = [];
  const entregueAoArmazem: Record<string, number> = {};
  const entregasPorEvento: Record<string, number> = {};
  const produzido: Record<string, number> = {};
  const recusas: { tick: number; comando: string; motivo: string }[] = [];
  const ordemDeConclusao: { tick: number; predio: string; tipo: string }[] = [];
  const noArmazemInicial = { ...estoqueDosArmazens(estadoInicial) };
  const menorNoArmazem: Record<string, { valor: number; tick: number }> = {};
  let anterior = noArmazemInicial;
  let ticks = 0;

  const marcar = (nome: string, tick: number): void => {
    if (marcos[nome] === undefined || marcos[nome] === null) marcos[nome] = tick;
  };
  // Todo marco nasce declarado como `null`: um marco que some do JSON e
  // indistinguivel de um que nunca aconteceu, e e justamente o segundo caso que
  // importa ler.
  for (const nome of [
    'rua-pronta', 'primeira-planta', 'sawmill-desbloqueada', 'sawmill-plantada',
    'treino-comecou', 'primeiro-civil-treinado', 'primeira-obra-completa',
    'primeira-ocupacao', 'todos-completos', 'todos-ocupados',
    'timber-acima-do-inicial', 'criterio-fechado',
  ]) marcos[nome] = null;
  for (const m of MERCADORIAS_OBSERVADAS) marcos[`primeira-entrega:${m}`] = null;
  for (const p of abertura.plantas) {
    marcos[`completo:${p.tipo}@${p.gx}`] = null;
    marcos[`ocupado:${p.tipo}@${p.gx}`] = null;
  }

  function observar(state: GameState): void {
    const tick = state.tick;
    ticks = tick;
    const noArmazem = estoqueDosArmazens(state);

    for (const m of MERCADORIAS_OBSERVADAS) {
      const agora = noArmazem[m] ?? 0;
      const antes = anterior[m] ?? 0;
      if (agora > antes) entregueAoArmazem[m] = (entregueAoArmazem[m] ?? 0) + (agora - antes);
      const menor = menorNoArmazem[m];
      if (menor === undefined || agora < menor.valor) menorNoArmazem[m] = { valor: agora, tick };
      // "Primeira entrega" e o primeiro DELTA POSITIVO, nao o primeiro tick em
      // que o saldo passa a linha de base do tick 0. A F15b media contra a linha
      // de base porque la o saldo so subia; aqui a pedra e GASTA em rua e obra e
      // nunca volta aos 30 iniciais — medido assim, a primeira pedra da vila
      // responderia `null` com 17 pedras entregues. Saldo e acumulado sao
      // perguntas diferentes, e esta e a do acumulado.
      if (agora > antes) marcar(`primeira-entrega:${m}`, tick);
    }
    anterior = { ...noArmazem };

    for (const ev of state.events) {
      if (ev.type === 'goods-produced') {
        produzido[ev.mercadoria] = (produzido[ev.mercadoria] ?? 0) + ev.quantidade;
      } else if (ev.type === 'task-completed' && ev.destino === abertura.armazem) {
        entregasPorEvento[ev.mercadoria] = (entregasPorEvento[ev.mercadoria] ?? 0) + 1;
      } else if (ev.type === 'command-rejected') {
        if (recusas.length < 40) recusas.push({ tick, comando: ev.command, motivo: ev.motivo });
      } else if (ev.type === 'unit-trained') {
        marcar('primeiro-civil-treinado', tick);
      } else if (ev.type === 'building-completed') {
        marcar('primeira-obra-completa', tick);
        ordemDeConclusao.push({ tick, predio: ev.predio, tipo: ev.tipo });
      } else if (ev.type === 'building-occupied') {
        marcar('primeira-ocupacao', tick);
        const alvo = abertura.plantas.find((p) => state.predios.porId[ev.predio]?.gx === p.gx);
        if (alvo) marcar(`ocupado:${alvo.tipo}@${alvo.gx}`, tick);
      }
    }

    if (abertura.rua.every((t) => ehEstrada(state.estradas, t))) marcar('rua-pronta', tick);
    if (estaDesbloqueado(state, 'sawmill', dados)) marcar('sawmill-desbloqueada', tick);

    const daAbertura = abertura.plantas.map((p) => {
      const id = predioNoCanto(state, p.gx, p.gy);
      return id === null ? null : state.predios.porId[id] ?? null;
    });
    if (daAbertura.some((p) => p !== null)) marcar('primeira-planta', tick);
    const sawmill = daAbertura[abertura.plantas.length - 1];
    if (sawmill) marcar('sawmill-plantada', tick);
    daAbertura.forEach((p, i) => {
      const planta = abertura.plantas[i] as PlantaDaAbertura;
      if (p && p.estado === 'completo') marcar(`completo:${planta.tipo}@${planta.gx}`, tick);
    });
    const completos = daAbertura.filter((p) => p !== null && p.estado === 'completo');
    if (completos.length === abertura.plantas.length) marcar('todos-completos', tick);
    const ocupados = completos.filter((p) => p !== null && p.estado === 'completo' && p.ocupante !== null);
    if (ocupados.length === abertura.plantas.length) marcar('todos-ocupados', tick);

    for (const id of state.predios.ordem) {
      const p = state.predios.porId[id];
      if (p && p.estado === 'completo' && p.tipo === ID_DA_ESCOLA) {
        const fila = state.treino[id] ?? [];
        if (fila.some((item) => item.estado === 'treinando')) marcar('treino-comecou', tick);
      }
    }

    const timberInicial = noArmazemInicial['timber'] ?? 0;
    if ((noArmazem['timber'] ?? 0) > timberInicial) marcar('timber-acima-do-inicial', tick);
    if (marcos['todos-ocupados'] !== null && (noArmazem['timber'] ?? 0) > timberInicial) {
      marcar('criterio-fechado', tick);
    }

    if (tick % PASSO_DA_AMOSTRA === 0) {
      const laborersPorObra: Record<string, number> = {};
      const tarefasAbertasPorTipo: Record<string, number> = {};
      for (const id of state.jobs.tarefas.ordem) {
        const t = state.jobs.tarefas.porId[id];
        if (!t) continue;
        if (t.estado === 'aberta') {
          tarefasAbertasPorTipo[t.tipo] = (tarefasAbertasPorTipo[t.tipo] ?? 0) + 1;
        }
        if (t.tipo === 'construir' && t.reclamadaPor !== null) {
          laborersPorObra[t.destino] = (laborersPorObra[t.destino] ?? 0) + 1;
        }
      }
      amostras.push({ tick, laborersPorObra, noArmazem: { ...noArmazem }, tarefasAbertasPorTipo });
    }
  }

  return {
    observar,
    resultado: () => ({
      marcos,
      amostras,
      entregueAoArmazem,
      entregasPorEvento,
      produzido,
      noArmazemInicial,
      menorNoArmazem,
      recusas,
      ordemDeConclusao,
      ticks,
    }),
  };
}
