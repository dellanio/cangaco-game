/**
 * F-CAL-a — a vila da CADEIA DA COMIDA sobe pela abertura.
 *
 * A F17 monta a Fase A: dois lenhadores, serraria e pedreira. Aqui a mesma vila
 * ganha Rocado, Moinho, Padaria e Bodega, os treinos que faltam e o campo que o
 * jogador desenha. Nada e injetado no estado: tudo sobe por COMANDO, os mesmos
 * que o jogador daria em cliques, e este arquivo nao afirma nada — quem afirma e
 * `tests/F-CAL-a-cenario.test.ts`.
 *
 * POR QUE ELA EXISTE: o lote da cadeia de comida foi calibrado em dois cenarios
 * que NAO passam pela abertura (`docs/calibracao-fase-b.md`). A F-CAL-b vai medir
 * na abertura, e o termo que pode mudar e a CAMINHADA. Este arquivo e o cenario
 * que ela mede; medir e trabalho dela.
 *
 * A GEOMETRIA, e por que ela e a LESTE — medido antes de escrever (sonda de
 * 2026-09-25, apagada): na linha de porta do armazem (`yRua`) nao sobra vao
 * nenhum. A oeste dela o lajedo bloqueia de x19 a x26 e a serraria e a pedreira
 * tomam o resto; entre armazem e escola sobram dois tiles, e o menor destes
 * quatro predios tem tres de largura. O unico vao que cabe e a LESTE da escola,
 * onde x37 em diante esta livre de recurso e e aravel ate a borda medida.
 *
 * Logo a rua PRECISA crescer, e isto corrige o que o plano supos antes da sonda
 * (`docs/planos/F-CAL.md` §2 dizia que ela nao precisaria). Ela cresce em linha
 * reta sobre `yRua`, um trecho por predio, e cada trecho so sai quando
 * `canPlaceRoad` aceita — `PlaceRoad` e tudo ou nada, pago A VISTA, e foi assim
 * que a F-T4b derrubou a vila inteira com um `sem-pedra` de um tile.
 *
 * NENHUMA COORDENADA E DIGITADA. A posicao de cada predio sai varrendo `yRua`
 * para leste com o proprio `canPlace` da sim; o campo sai da `colheita` do
 * Rocado em `data/production.json`, validado por `canPlowField`. O que a sim
 * recusa aqui e erro do cenario, e estoura alto em vez de virar medida errada
 * tres mil ticks depois.
 */
import { gameData } from '../../src/sim/data';
import type { GameData, PredioData } from '../../src/sim/data/types';
import type { GameState } from '../../src/sim/state';
import type { Command } from '../../src/sim/commands';
import type { TileDeGrid } from '../../src/sim/estradas';
import { canPlaceRoad, chaveDeTile, ehEstrada, ehPlanejada } from '../../src/sim/estradas';
import { canPlace } from '../../src/sim/placement';
import type { CaixaEmTiles } from '../../src/sim/footprint';
import { bordaSul, caixaDeTipo, caixasSeSobrepoem } from '../../src/sim/footprint';
import { canPlowField, ehCampoPlanejado } from '../../src/sim/campos';
import { estaDesbloqueado } from '../../src/sim/desbloqueio';
import { tileAlcancavelParaColheita } from '../../src/sim/aproximacao';
import { filaDaEscola } from '../../src/sim/escola';
import type { Abertura } from './abertura';
import { aberturaDaFaseA, comandosNoTick } from './abertura';

/**
 * Os quatro predios que a F-CAL acrescenta, na ordem da CADEIA — que e tambem a
 * ordem em que eles se desbloqueiam (`desbloqueadoPor`: o Rocado vem da
 * serraria, o Moinho do Rocado, a Padaria do Moinho; a Bodega vem do armazem e
 * poderia ser a primeira, mas entra por ultimo porque e a mais cara). Nao e
 * numero de balanceamento: e a lista que o criterio nomeia.
 */
export const TIPOS_DA_CADEIA_DA_COMIDA: readonly string[] = ['farm', 'mill', 'bakery', 'inn'];

export interface PlantaDaVila {
  readonly tipo: string;
  /** Canto superior esquerdo — a mesma convencao de `PlaceBlueprint`. */
  readonly gx: number;
  readonly gy: number;
  /** O civil que ocupa este predio, ou `null` (a bodega nao pede trabalhador). */
  readonly civil: string | null;
  readonly timber: number;
  readonly stone: number;
  /** Os tiles de rua que ESTE predio acrescenta para ter porta na rede. */
  readonly rua: readonly TileDeGrid[];
}

export interface VilaDaCalibracao {
  readonly abertura: Abertura;
  readonly plantas: readonly PlantaDaVila[];
  /** A cultura do campo, da `colheita` do Rocado — nunca um id digitado. */
  readonly cultura: string;
  readonly campo: readonly TileDeGrid[];
  /** Quantos civis de cada tipo a cadeia da comida pede. */
  readonly civisDesejados: Readonly<Record<string, number>>;
  readonly stoneDaRuaExtra: number;
  readonly stoneDasPlantas: number;
  readonly timberDasPlantas: number;
}

function defDe(tipo: string, dados: GameData): PredioData {
  const def = dados.predios.find((p) => p.id === tipo);
  if (!def) throw new Error(`cal-vila: '${tipo}' nao existe em data/buildings.json`);
  return def;
}

function caixaOuEstoura(tipo: string, gx: number, gy: number, dados: GameData): CaixaEmTiles {
  const caixa = caixaDeTipo(tipo, gx, gy, dados);
  if (caixa === null) throw new Error(`cal-vila: '${tipo}' nao tem tamanho em data/buildings.json`);
  return caixa;
}

/**
 * Cabe um predio deste tipo aqui? A pergunta e a da SIM (`canPlace`), mais o que
 * ela nao tem como saber: as caixas que ainda NAO EXISTEM — as plantas da
 * abertura e as que este mesmo derivador ja escolheu. Escrever uma segunda copia
 * de `canPlace` aqui seria a regra em dois lugares, que foi o defeito que a F-T4b
 * pagou entre o roteiro da tela e o headless.
 *
 * `'bloqueado'` NAO reprova: no tick 0 o Rocado depende de uma serraria que
 * ainda nem foi plantada, e o LUGAR dele nao muda por causa disso. Desbloqueio e
 * do TEMPO do comando, e quem o checa e `comandosDaVilaNoTick`.
 */
function cabe(
  state: GameState, tipo: string, gx: number, gy: number,
  ocupadas: readonly CaixaEmTiles[], dados: GameData,
): boolean {
  const veredito = canPlace(state, tipo, gx, gy, dados);
  if (!veredito.ok && veredito.motivo !== 'bloqueado') return false;
  const caixa = caixaOuEstoura(tipo, gx, gy, dados);
  const porta = bordaSul(caixa);
  return !ocupadas.some((c) => caixasSeSobrepoem(caixa, c)
    || caixasSeSobrepoem(porta, c)
    || caixasSeSobrepoem(caixa, bordaSul(c)));
}

/** O predio cujo CANTO e este tile, ou `null`. So o canto: e onde a planta nasce. */
function predioNoCanto(state: GameState, gx: number, gy: number): string | null {
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p && p.gx === gx && p.gy === gy) return id;
  }
  return null;
}

/**
 * Monta a vila da calibracao sobre a abertura da Fase A. Tudo derivado: a linha
 * de porta vem da abertura, largura e custo de `data/buildings.json`, o civil de
 * `trabalhador`, o campo da `colheita` do Rocado.
 */
export function vilaDaCalibracao(state: GameState, dados: GameData = gameData): VilaDaCalibracao {
  const abertura = aberturaDaFaseA(state, dados);
  const yRua = abertura.yRua;

  // Tudo que ja ocupa chao: o que esta de pe e o que a abertura vai plantar. As
  // duas listas juntas, porque para o derivador nao ha diferenca — as duas
  // estarao la quando o Rocado desbloquear.
  const ocupadas: CaixaEmTiles[] = [];
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p) ocupadas.push(caixaOuEstoura(p.tipo, p.gx, p.gy, dados));
  }
  for (const p of abertura.plantas) ocupadas.push(caixaOuEstoura(p.tipo, p.gx, p.gy, dados));

  // A ponta leste da rua da abertura: e dali que a rua nova sai. So os tiles NA
  // linha de porta contam — as pernas que sobem para o armazem e para a mata
  // estao noutras linhas e nao continuam para leste.
  const pontaDaRua = abertura.rua
    .filter((t) => t.gy === yRua)
    .reduce((maior, t) => Math.max(maior, t.gx), Number.NEGATIVE_INFINITY);
  if (!Number.isFinite(pontaDaRua)) {
    throw new Error(`cal-vila: a rua da abertura nao tem nenhum tile na linha de porta y=${yRua}`);
  }

  const larguraDoMapa = dados.terreno.mapaPadrao.largura;
  let cursorDaRua = pontaDaRua;
  const plantas: PlantaDaVila[] = [];

  for (const tipo of TIPOS_DA_CADEIA_DA_COMIDA) {
    const molde = caixaOuEstoura(tipo, 0, 0, dados);
    const gy = yRua - molde.y1;
    let escolhido: number | null = null;
    for (let gx = cursorDaRua + 1; gx + molde.x1 <= larguraDoMapa; gx += 1) {
      if (cabe(state, tipo, gx, gy, ocupadas, dados)) { escolhido = gx; break; }
    }
    if (escolhido === null) {
      throw new Error(
        `cal-vila: nao ha vao para '${tipo}' a leste de x=${cursorDaRua} na linha de porta y=${yRua}; ` +
          'quem ajusta nesse caso e o gerador de mapa, nao a vila',
      );
    }

    // A rua vai em linha reta ate a PRIMEIRA coluna da porta deste predio, e
    // segue contigua de proposito: ponte diagonal tambem ligaria, mas uma rua com
    // buraco deixaria a leitura da evidencia dependendo de uma regra a mais.
    const trecho: TileDeGrid[] = [];
    for (let gx = cursorDaRua + 1; gx <= escolhido; gx += 1) trecho.push({ gx, gy: yRua });
    for (const t of trecho) {
      const recusa = canPlaceRoad(state, [t], dados);
      if (!recusa.ok) throw new Error(`cal-vila: a rua nao passa em ${t.gx},${t.gy} por '${recusa.motivo}'`);
    }
    cursorDaRua = Math.max(cursorDaRua, escolhido);

    const def = defDe(tipo, dados);
    plantas.push({
      tipo, gx: escolhido, gy, civil: def.trabalhador,
      timber: def.timber, stone: def.stone, rua: trecho,
    });
    ocupadas.push(caixaOuEstoura(tipo, escolhido, gy, dados));
  }

  // O CAMPO: os tiles ao sul do Rocado que estao ao alcance da colheita DELE. O
  // alcance sai do dado e a moldura e a mesma conta de `tilesDeColheitaNaCaixa`
  // (`caixa.y1 - 1 + alcance`); cada tile passa por `canPlowField` antes de virar
  // comando. A propria linha `yRua` cai fora sozinha: ali e rua.
  const rocado = plantas[0];
  if (rocado === undefined) throw new Error('cal-vila: a cadeia da comida esta vazia');
  const colheita = dados.producao.receitas[rocado.tipo]?.colheita ?? null;
  if (colheita === null) {
    throw new Error(
      `cal-vila: '${rocado.tipo}' precisa declarar 'colheita' em data/production.json — ` +
        'sem ela nao ha como saber o que o jogador ara, nem onde',
    );
  }
  const caixaDoRocado = caixaOuEstoura(rocado.tipo, rocado.gx, rocado.gy, dados);
  // A rua ainda NAO EXISTE no estado quando o campo se deriva — no tick 0 nao ha
  // um tile de estrada no mapa inteiro. Sem esta lista `canPlowField` aprova a
  // propria linha de porta, e o canteiro nasce por baixo da rua que o cenario vai
  // levantar quatro ticks depois: medido, os quatro primeiros tiles do campo eram
  // `yRua`. Quem sabe onde a rua vai passar e este arquivo, nao a sim.
  const ondeARuaVaiPassar = new Set<string>([
    ...abertura.rua.map(chaveDeTile),
    ...plantas.flatMap((p) => p.rua.map(chaveDeTile)),
  ]);
  const campo: TileDeGrid[] = [];
  for (let gy = caixaDoRocado.y1; gy <= caixaDoRocado.y1 - 1 + colheita.alcance; gy += 1) {
    for (let gx = caixaDoRocado.x0; gx < caixaDoRocado.x1; gx += 1) {
      const tile = { gx, gy };
      if (ondeARuaVaiPassar.has(chaveDeTile(tile))) continue;
      if (!canPlowField(state, colheita.recurso, [tile], dados).ok) continue;
      // Tile aravel que ninguem alcanca e roceiro esperando para sempre — o mesmo
      // guarda que a abertura poe na mata do lenhador, pela mesma razao.
      if (!tileAlcancavelParaColheita(state, chaveDeTile(tile), dados)) continue;
      campo.push(tile);
    }
  }
  if (campo.length === 0) {
    throw new Error(
      `cal-vila: o Rocado em ${rocado.gx},${rocado.gy} nao tem NENHUM tile aravel e alcancavel ao ` +
        `alcance ${colheita.alcance}; sem campo o roceiro nunca colhe`,
    );
  }
  const veredito = canPlowField(state, colheita.recurso, campo, dados);
  if (!veredito.ok) throw new Error(`cal-vila: o canteiro inteiro nao passa: '${veredito.motivo}'`);

  const civisDesejados: Record<string, number> = {};
  for (const p of plantas) {
    if (p.civil !== null) civisDesejados[p.civil] = (civisDesejados[p.civil] ?? 0) + 1;
  }

  return {
    abertura, plantas, campo, cultura: colheita.recurso, civisDesejados,
    stoneDaRuaExtra: plantas.reduce((s, p) => s + p.rua.length, 0) * dados.terreno.estrada.custoStonePorTile,
    stoneDasPlantas: plantas.reduce((s, p) => s + p.stone, 0),
    timberDasPlantas: plantas.reduce((s, p) => s + p.timber, 0),
  };
}

/**
 * Quantos civis deste tipo a vila ja tem ou ja pediu: os vivos mais os que estao
 * na fila da escola. E o que torna o pedido de treino IDEMPOTENTE — sem ele o
 * cenario enfileiraria um roceiro por tick ate a fila estourar em `fila-cheia`,
 * e a recusa e justamente o que o aceite da F-CAL-a afirma nao existir.
 */
function civisContratados(state: GameState, escola: string, tipo: string): number {
  let total = 0;
  for (const id of state.unidades.ordem) {
    if (state.unidades.porId[id]?.tipo === tipo) total += 1;
  }
  for (const item of filaDaEscola(state, escola)) {
    if (item.unidade === tipo) total += 1;
  }
  return total;
}

/**
 * Os comandos DESTE tick: os da abertura, mais os da cadeia da comida. Como la,
 * a ordem reage ao ESTADO e nunca ao relogio — cada coisa sai no primeiro tick
 * em que a sim a aceita, e por isso nenhum comando e recusado.
 *
 * A ordem dentro de um predio e: rua, planta, treino. A rua vem primeiro porque
 * porta sem rede nao escoa nada; o treino vem por ultimo porque so ha para onde
 * mandar o civil depois que a planta existe, e cinco vagas de fila ocupadas cedo
 * travariam os treinos da propria abertura.
 */
export function comandosDaVilaNoTick(
  state: GameState, vila: VilaDaCalibracao, tick: number, dados: GameData = gameData,
): readonly Command[] {
  const comandos: Command[] = [...comandosNoTick(state, vila.abertura, tick, dados)];
  const escola = vila.abertura.escola;
  const slots = dados.economia.schoolhouse.slotsDeFila;

  // A abertura gasta pedra em RUA e em OBRA, e os dois comandos deste tick sao
  // validados contra o estado do COMECO dele: um `canPlaceRoad` que aprova aqui
  // pode encontrar a pedra ja reservada quando chegar a vez dele. Foi o que a
  // sonda mediu — dois `sem-pedra` no tick 1, com o estoque aparentemente
  // sobrando. Enquanto a abertura estiver gastando, a cadeia da comida espera.
  const aberturaGastaPedraNesteTick = comandos.some(
    (c) => c.type === 'PlaceRoad' || c.type === 'PlaceBlueprint',
  );

  for (const p of vila.plantas) {
    const faltamDeRua = p.rua.filter(
      (t) => !ehEstrada(state.estradas, t) && !ehPlanejada(state.estradasPlanejadas, t),
    );
    if (faltamDeRua.length > 0) {
      // Tudo ou nada e a vista: o trecho so sai quando cabe INTEIRO no estoque.
      // Recusado, ele nao ergue tile nenhum — e a vila fica com a porta no mato.
      //
      // So se o predio ja estiver DESBLOQUEADO. Este e o guarda que PAGA: medido
      // trocando-o por nada, a rua nova rouba a pedra da abertura e a vila para com
      // um lenhador em obra para sempre. O `break` e estrutural e nao redundante,
      // mas hoje ele nao e o que segura o defeito — com o dado atual o desbloqueio
      // ja serializa os trechos sozinho, e sem ele a suite continua verde. Ele esta
      // aqui porque o trecho de cada predio comeca onde o do anterior terminou:
      // pular um e ligar o seguinte deixaria buraco na rua e porta fora da rede.
      if (!aberturaGastaPedraNesteTick
        && estaDesbloqueado(state, p.tipo, dados)
        && canPlaceRoad(state, faltamDeRua, dados).ok) {
        comandos.push({ type: 'PlaceRoad', tiles: faltamDeRua });
      }
      break;
    }
    // F18g — "a rua vem primeiro" passou a significar rua DE PE, nao rua comandada.
    // Desde que a pedra viaja por tile, `canPlaceRoad` aceita o trecho sem pagador
    // e o desenha inteiro; a pedra chega tile a tile, ATRAS do material de obra na
    // escada. Sem este guarda a planta subia e ficava completa e ocupada com a porta
    // ainda no canteiro (medido: Moinho ocupado em 2993 e `ligadoAoArmazem: false`
    // no fechamento), e a F-CAL-b mediria um moinho parado por logistica de rua, nao
    // por calibracao. O trecho tem de estar assentado inteiro antes de a planta sair.
    if (p.rua.some((t) => !ehEstrada(state.estradas, t))) break;
    if (predioNoCanto(state, p.gx, p.gy) === null) {
      if (canPlace(state, p.tipo, p.gx, p.gy, dados).ok) {
        comandos.push({ type: 'PlaceBlueprint', buildingId: p.tipo, gx: p.gx, gy: p.gy });
      }
      continue;
    }
    if (p.civil !== null
      && civisContratados(state, escola, p.civil) < (vila.civisDesejados[p.civil] ?? 0)
      && filaDaEscola(state, escola).length < slots) {
      comandos.push({ type: 'EnqueueTraining', predio: escola, unidade: p.civil });
    }
  }

  // O canteiro, depois que o Rocado esta COMPLETO: arar nao cobra material, mas
  // cobra laborer — o mesmo punhado que levanta a obra. Desenhar antes so
  // atrasaria o predio de quem vai trabalhar o campo.
  const rocado = vila.plantas[0];
  if (rocado !== undefined) {
    const id = predioNoCanto(state, rocado.gx, rocado.gy);
    const predio = id === null ? null : state.predios.porId[id] ?? null;
    if (predio !== null && predio.estado === 'completo') {
      const faltamDeCampo = vila.campo.filter(
        (t) => !ehCampoPlanejado(state.camposPlanejados, t) && state.recursos[chaveDeTile(t)] === undefined,
      );
      if (faltamDeCampo.length > 0 && canPlowField(state, vila.cultura, faltamDeCampo, dados).ok) {
        comandos.push({ type: 'PlowField', recurso: vila.cultura, tiles: faltamDeCampo });
      }
    }
  }

  return comandos;
}
