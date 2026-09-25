/**
 * F17 — A abertura da Fase A como DADO, mais o medidor que a acompanha.
 *
 * Aqui nao ha assercao nenhuma: este arquivo so monta a geometria (derivada de
 * `data/*.json`, nunca digitada), emite os comandos do jogador e ANOTA o que
 * aconteceu. Quem afirma e `tests/F17-aceite.test.ts`; quem repete os mesmos
 * cliques na tela e `tools/shots/F17.js`.
 *
 * A GEOMETRIA nao e escrita aqui: vem de `tools/geometria-da-abertura.mjs`, o
 * MESMO modulo que o roteiro da tela usa. Este arquivo so liga os predicados da
 * SIM nele (tamanho, recurso que bloqueia, tile de mata) e afirma o que a sim
 * sabe e o modulo nao: que a mata escolhida e ALCANCAVEL de verdade.
 *
 * A REGRA da posicao (F-T4b, 2026-09-25, decisao do operador): "vila de verdade
 * nasce em volta do armazem, com a pedreira na pedra e o lenhador virado para o
 * mato". Ate ali os quatro predios nasciam em UMA fila na linha de porta do
 * armazem — conveniencia do cenario, nao desenho — e o par de lenhadores ficava
 * a 14 tiles da arvore mais proxima. Com `colheita` declarada na receita isso
 * deixou de ser detalhe: o lenhador saia, nao achava mata e a cadeia da tabua
 * parava. Agora sao dois grupos:
 *  - a pedra (serraria + pedreira) a oeste, na linha de porta do armazem, com o
 *    comeco RECUANDO ate caber sem pisar em recurso que bloqueia (BUG-F, pelo
 *    mesmo predicado da sim, `recursoBloqueiaConstrucao`, nunca por x digitado);
 *  - a mata (duas casas de lenhador) na linha ACIMA do armazem, na posicao de
 *    MAIOR MINIMO de arvores ao alcance da propria `colheita` do lenhador.
 * A regra da porta (F16a) segue respeitada por construcao: dentro de cada grupo
 * nenhum predio fica ABAIXO de outro.
 *
 * A RUA e mínima de proposito: o que liga um predio e UMA porta dele ser estrada
 * no componente do armazem, e o comando `PlaceRoad` e tudo ou nada, pago A VISTA
 * no tick 0. A primeira versao da rua em L custou 31 de pedra contra 30 no
 * armazem: o comando saiu `sem-pedra`, nenhum tile foi erguido e a vila inteira
 * ficou parada com os quatro predios completos e desligados. O orcamento agora e
 * do modulo, e ele estoura se a rua nao couber.
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
import { recursoBloqueiaConstrucao, recursoNoTile, tilesDeColheitaNaCaixa } from '../../src/sim/recursos';
import { tileAlcancavelParaColheita } from '../../src/sim/aproximacao';
import { caixaDeTipo } from '../../src/sim/footprint';
import { estoqueDosArmazens } from '../../src/sim/selectors';
import { estaDesbloqueado } from '../../src/sim/desbloqueio';
import type { CaixaDePredio } from '../../tools/geometria-da-abertura.d.mts';
import { GRUPO_DA_MATA, TIPOS_DA_ABERTURA, geometriaDaAbertura } from '../../tools/geometria-da-abertura.mjs';

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
  // O alcance da mata sai do DADO (a `colheita` que a F-T4b declarou para o
  // lenhador), nunca de um numero aqui: e o mesmo alcance que a sim usa para
  // mandar o ocupante ao tile, e a vila nasce medindo por ele.
  const tipoDoLenhador = GRUPO_DA_MATA[0];
  if (tipoDoLenhador === undefined) throw new Error('abertura: o grupo da mata esta vazio');
  const colheitaDoLenhador = dados.producao.receitas[tipoDoLenhador]?.colheita ?? null;
  if (colheitaDoLenhador === null) {
    throw new Error(
      `abertura: '${tipoDoLenhador}' precisa declarar 'colheita' em data/production.json — ` +
        'sem ela a vila nasceria sem saber onde ha mata, que foi o defeito da F-T4b',
    );
  }
  const geo = geometriaDaAbertura({
    armazem: caixaDeEntrada(armazem, dados),
    escola: caixaDeEntrada(escola, dados),
    tamanhoDe: (tipo: string) => tamanhoDe(tipo, dados),
    bloqueia: (gx: number, gy: number) => recursoBloqueiaConstrucao(recursoNoTile(state, gx, gy), dados),
    temArvore: (gx: number, gy: number) => recursoNoTile(state, gx, gy)?.tipo === colheitaDoLenhador.recurso,
    alcanceDaMata: colheitaDoLenhador.alcance,
    // A rua se paga A VISTA no tick 0 e o comando e tudo ou nada: o modulo
    // precisa do orcamento para nao tracar uma rua que a vila nao tem como
    // comprar (medido na F-T4b: 31 tiles contra 30 de pedra, `sem-pedra`).
    stoneDe: (tipo: string) => defDe(tipo, dados).stone,
    estoqueInicialDeStone: dados.economia.estadoInicial.estoque['stone'] ?? 0,
    custoStonePorTile: dados.terreno.estrada.custoStonePorTile,
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

  // O modulo conta mata BRUTA: `temArvore` e o unico predicado que o roteiro
  // consegue fornecer, porque na tela nao ha API de sim ao alcance. Quem afirma
  // ALCANCAVEL e aqui, com a sim — mata que e so miolo cercado nao da trabalho a
  // ninguem, e o lenhador esperaria por um tile que nunca fica livre. Fixture
  // tem de estourar alto, nao morrer de fome em silencio.
  for (const p of plantas) {
    if (p.tipo !== tipoDoLenhador) continue;
    const caixa = caixaDeTipo(p.tipo, p.gx, p.gy, dados);
    if (caixa === null) throw new Error(`abertura: '${p.tipo}' nao tem tamanho`);
    const alcancaveis = tilesDeColheitaNaCaixa(state, caixa, colheitaDoLenhador, dados).filter((k) =>
      tileAlcancavelParaColheita(state, k, dados),
    );
    if (alcancaveis.length === 0) {
      throw new Error(
        `abertura: o lenhador em ${p.gx},${p.gy} nao tem NENHUMA arvore ALCANCAVEL ao alcance ` +
          `${colheitaDoLenhador.alcance}; quem ajusta nesse caso e o gerador de mapa, nao a vila`,
      );
    }
  }

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
 *
 * TEMPO DE ASSENTAMENTO — cuidado de MEDICAO, nao de implementacao (segunda vez
 * que quase deu resposta errada, 2026-09-25): `PlaceRoad` deixa a rua PLANEJADA,
 * e quem a levanta e o laborer, tile por tile (F18d-1b). Perguntar
 * `predioLigadoAoArmazem` no tick 1 devolve `false` para TUDO e parece resposta:
 * na sonda da folga de pedra os dois predios so ligaram nos ticks 96 e 168. Toda
 * medida de ligacao roda ticks ate a condicao acontecer — nunca le logo depois do
 * comando. O mesmo vale para o canteiro do prédio: planta nao e prédio completo.
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
    // Por TIPO, nao pela ultima posicao da fila: a abertura deixou de terminar
    // na serraria quando o BUG-F a reordenou, e agora nem fila unica ha mais.
    const iSawmill = abertura.plantas.findIndex((p) => p.tipo === 'sawmill');
    if (iSawmill >= 0 && daAbertura[iSawmill]) marcar('sawmill-plantada', tick);
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
