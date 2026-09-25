/**
 * F-T2a — A CAMADA DE RECURSO NATURAL, e a unica porta de leitura dela.
 *
 * A divisao e a mesma do terreno (`sim/mapa.ts`), com uma diferenca que e o
 * ponto inteiro da feature:
 *
 *   - ONDE ha recurso e dado imutavel: vem do arquivo de mapa, mora em
 *     `GameData.mapa.recursos` e nunca muda durante a partida.
 *   - QUANTO ainda ha e ESTADO: mora em `state.recursos`, esparso, com a mesma
 *     forma e a mesma chave de `state.estradas`.
 *
 * Por isso demolir e reconstruir a pedreira nao renova coisa nenhuma: o que
 * sobrou esta no TILE, nao no predio. Enquanto o total era `producao.veio`, o
 * predio novo nascia com o veio cheio — era o exploit da F16a, e ele morre aqui.
 *
 * UM MECANISMO, TRES REGIMES (`data/resources.json`):
 *   `nunca`    ao zerar, a entrada SAI do estado: o tile volta a ser so terreno.
 *   `porAcao`  ao zerar, a entrada FICA com `quantidade: 0` — tile CORTADO nao e
 *              tile que nunca teve nada, e e essa diferenca que o replantio do
 *              Woodcutter's e o campo arado da F18 vao ler.
 *   `porTempo` sobe sozinho ate o teto do tipo.
 */
import type { ColheitaDeRecurso, GameData, RegimeDeRecurso } from './data/types';
import { gameData } from './data';
import type { GameState, PredioCompleto, RecursoNoTile } from './state';
import { ehTarefaDeColheita } from './state';
import { chaveDeTile } from './estradas';
import type { CaixaEmTiles } from './footprint';
import { caixaDoPredio } from './footprint';

/** `chaveDeTile` por coordenada solta — a mesma chave de `state.estradas`. */
const chave = (gx: number, gy: number): string => chaveDeTile({ gx, gy });

/** O que `state.recursos` tem num tile, ou `null`. A porta de leitura: ninguem
 *  indexa `state.recursos` por conta propria. */
export function recursoNoTile(state: GameState, gx: number, gy: number): RecursoNoTile | null {
  return state.recursos[chave(gx, gy)] ?? null;
}

/** O regime de um tipo — `null` para tipo que o dado nao conhece (save de outra
 *  versao), pelo mesmo contrato de `receitaDoTipo`. */
export function regimeDoTipo(tipo: string, dados: GameData = gameData): RegimeDeRecurso | null {
  return dados.recursos.tipos[tipo]?.regime ?? null;
}

/**
 * O estado inicial da camada: o mapa diz onde, `resources.json` diz quanto.
 * A ordem de insercao e a do arquivo de mapa (tipo por tipo, tile por tile) —
 * dois estados iguais precisam ter o mesmo JSON, e chave com virgula nao e
 * chave-inteira, entao o JS preserva a ordem de insercao.
 *
 * F18 — `quantidadeInicial` e o que separa o lajedo do roçado: a rocha nasce
 * cheia, o campo arado nasce em POUSIO (zero). Um campo que nascesse maduro
 * daria a primeira safra de graca e esconderia o ciclo inteiro do roceiro.
 */
export function recursosIniciais(dados: GameData = gameData): Readonly<Record<string, RecursoNoTile>> {
  const recursos: Record<string, RecursoNoTile> = {};
  for (const [tipo, tiles] of Object.entries(dados.mapa.recursos)) {
    const def = dados.recursos.tipos[tipo];
    if (def === undefined) continue; // o carregador ja reprovou; aqui so estreita o tipo
    for (const [gx, gy] of tiles) {
      recursos[chave(gx, gy)] = { tipo, quantidade: def.quantidadeInicial ?? def.rendimentoPorTile };
    }
  }
  return recursos;
}

/**
 * Os tiles que ESTE predio pode colher, segundo o ESTADO.
 *
 * F18h — era "segundo o MAPA", e a lista era estatica e memoizada inteira. Nao
 * pode mais ser: a partir da F18h o jogador ARA, e um tile arado durante a
 * partida nasce em `state.recursos` sem nunca ter estado em `dados.mapa`. A
 * camada derivada do mapa era o retrato de `state.recursos` no tick 0, e usa-la
 * como filtro fazia a fazenda nao ver o campo que o jogador acabara de abrir —
 * medido: o tile virava milho e o alerta `sem-campo` ficava na tela.
 *
 * O que continua memoizado e a MOLDURA (`tilesDaMoldura`), que e do mapa e nao
 * muda; o que passou a ser por chamada e o filtro por tipo, que e do estado. O
 * custo por chamada deixou de ser O(1) e passou a ser O(tiles da moldura) — uma
 * consulta de objeto por tile da moldura, sem realocar a moldura.
 *
 * Ordem: linha a linha, oeste para leste. E arbitraria, mas tem de ser FIXA —
 * e ela que decide qual tile esvazia primeiro, e o teste de determinismo compara
 * byte a byte.
 *
 * A distancia e de Chebyshev a partir do FOOTPRINT, nao do canto: uma pedreira
 * de 3x2 alcanca o mesmo tanto para os dois lados, e girar o predio um dia nao
 * muda o alcance. Quem faz a conta e `tilesDeColheitaNaCaixa`, logo abaixo.
 */
export function tilesDeColheita(
  state: GameState, predio: PredioCompleto, colheita: ColheitaDeRecurso,
  dados: GameData = gameData,
): readonly string[] {
  const caixa = caixaDoPredio(predio, dados);
  if (caixa === null) return SEM_TILES; // tipo fora do dado (save de outra versao)
  return tilesDeColheitaNaCaixa(state, caixa, colheita, dados);
}

/** A lista vazia, uma vez so: tipo fora do dado nao aloca array por chamada. */
const SEM_TILES: readonly string[] = Object.freeze([]);

/**
 * F-TP — o mesmo alcance, a partir de uma CAIXA em vez de um predio.
 *
 * A planta fantasma nao e predio: nao tem id, nao esta em `state.predios` e
 * fabricar um predio falso no render para poder perguntar seria o render
 * inventando estado de jogo. A caixa e o que os dois lados tem — `caixaDeTipo`
 * produz a da fantasma e `caixaDoPredio` a do predio de pe, e e a MESMA conta
 * daqui para baixo. Uma segunda copia da regra no render faria a previa
 * prometer o que o predio nao entrega.
 */
export function tilesDeColheitaNaCaixa(
  state: GameState, caixa: CaixaEmTiles, colheita: ColheitaDeRecurso,
  dados: GameData = gameData,
): readonly string[] {
  const moldura = tilesDaMoldura(caixa, colheita.alcance, dados);
  const tiles: string[] = [];
  for (const k of moldura) {
    if (state.recursos[k]?.tipo === colheita.recurso) tiles.push(k);
  }
  return tiles;
}

/**
 * A MOLDURA: todos os tiles a `alcance` passos da caixa, em ordem canonica.
 *
 * Isto e do MAPA e nao muda durante a partida — a caixa vem do footprint e o
 * alcance da receita —, e por isso e o que fica memoizado por `GameData`. Nao
 * depende do tipo de recurso: duas receitas com o mesmo alcance sobre a mesma
 * caixa olham a mesma moldura, e e o filtro de quem chama que separa milho de
 * pedra.
 */
function tilesDaMoldura(
  caixa: CaixaEmTiles, alcance: number, dados: GameData,
): readonly string[] {
  const memoKey = `${alcance}:${caixa.x0},${caixa.y0},${caixa.x1},${caixa.y1}`;
  const memo = memoPorDados(dados);
  const existente = memo.get(memoKey);
  if (existente !== undefined) return existente;

  const tiles: string[] = [];
  // `caixa.x1`/`y1` sao a BORDA, nao o ultimo tile (`footprint.ts`): o ultimo
  // tile ocupado e `x1 - 1`, e e dele que se contam os `alcance` passos.
  for (let gy = caixa.y0 - alcance; gy <= caixa.y1 - 1 + alcance; gy += 1) {
    for (let gx = caixa.x0 - alcance; gx <= caixa.x1 - 1 + alcance; gx += 1) {
      if (gx < 0 || gy < 0) continue;
      tiles.push(chave(gx, gy));
    }
  }
  memo.set(memoKey, tiles);
  return tiles;
}

/**
 * F-TP — O QUE HA ao alcance de uma caixa: quantos tiles ainda tem o que colher
 * e quanto isso da somado.
 *
 * UMA funcao para os dois lados. A previa da planta fantasma e o predio de pe
 * tem de dizer o mesmo numero, senao a tela promete o que a pedreira nao
 * entrega — e a previa nasceu justamente para o jogador nao plantar no escuro.
 *
 * `tiles` conta o que DA TRABALHO (`tileTrabalhavel`), nao o tamanho da lista:
 * tile de regime `porAcao` FICA na camada com zero (ver o cabecalho deste
 * arquivo), e dizer "8 lajedos ao alcance" sobre mancha seca seria a tela
 * mentindo. `unidades` soma tudo, e tile zerado soma zero — por isso
 * `disponivelAoAlcance` nao muda de resultado ao passar por aqui.
 *
 * F18 — e por ser o MESMO predicado que a previa da planta fantasma conta terra
 * arada em pousio como "130 ao alcance (0)": zero milho hoje, e trabalho para o
 * roceiro, que e o que o jogador precisa saber antes de plantar a fazenda. Para
 * a pedreira a resposta nao mudou em caso nenhum.
 */
export interface ColheitaAoAlcance {
  readonly tiles: number;
  readonly unidades: number;
}

export function colheitaAoAlcanceDaCaixa(
  state: GameState, caixa: CaixaEmTiles, colheita: ColheitaDeRecurso, dados: GameData = gameData,
): ColheitaAoAlcance {
  let tiles = 0;
  let unidades = 0;
  for (const chave of tilesDeColheitaNaCaixa(state, caixa, colheita, dados)) {
    // `minimo` 1: a pergunta da contagem e "ha trabalho neste tile", nao "cabe
    // um ciclo inteiro" — quem exige o ciclo e quem vai ABRIR o ciclo.
    if (tileTrabalhavel(state, chave, colheita, 1, dados)) tiles += 1;
    unidades += state.recursos[chave]?.quantidade ?? 0;
  }
  return { tiles, unidades };
}

/** Quanto ainda ha, somado, nos tiles ao alcance. */
export function disponivelAoAlcance(
  state: GameState, predio: PredioCompleto, colheita: ColheitaDeRecurso, dados: GameData = gameData,
): number {
  const caixa = caixaDoPredio(predio, dados);
  return caixa === null ? 0 : colheitaAoAlcanceDaCaixa(state, caixa, colheita, dados).unidades;
}

/**
 * F18 — ESTE TILE DA TRABALHO A ESTE PREDIO?
 *
 * Um predicado so, usado pelos dois lados da mesma pergunta: quem escolhe o
 * tile (`melhorTileDeColheita`), quem conta o que ha ao alcance
 * (`colheitaAoAlcanceDaCaixa`, de onde sai a previa da planta fantasma) e quem
 * decide que o predio nao tem mais o que fazer (`semRecursoAoAlcance`). Dois
 * predicados diferentes aqui e o defeito classico: o predio nao se declara
 * esgotado, nao gera tarefa, e a unidade espera o que nunca chega.
 *
 * Trabalhavel e:
 *   - ter ENTRADA daquele recurso no tile (a diferenca entre cortado e
 *     inexistente, que o regime `porAcao` preserva); e
 *   - ter o ciclo inteiro AGORA, ou o tipo ter `reposicao` — isto e, este
 *     predio poder repor o tile com as proprias maos.
 *
 * A segunda perna e a fazenda. Terra arada em pousio tem zero milho e continua
 * sendo trabalho: e o roceiro que planta. Para a rocha nada muda — lajedo nao
 * tem `reposicao`, entao trabalhavel continua sendo "tem pedra bastante".
 */
export function tileTrabalhavel(
  state: GameState, chaveDoTile: string, colheita: ColheitaDeRecurso, minimo: number,
  dados: GameData = gameData,
): boolean {
  if (tileColhivelAgora(state, chaveDoTile, colheita, minimo)) return true;
  return tilePlantavel(state, chaveDoTile, colheita, dados);
}

/** DA para colher deste tile agora: ha entrada daquele recurso e ela tem o
 *  bastante. E a pergunta de quem vai ABRIR o ciclo — colher a descoberto seria
 *  mercadoria vinda do nada. Era o corpo de `melhorTileDeColheita` ate a F18, e
 *  continua sendo a resposta dele, palavra por palavra, para a pedreira. */
export function tileColhivelAgora(
  state: GameState, chaveDoTile: string, colheita: ColheitaDeRecurso, minimo: number,
): boolean {
  const atual = state.recursos[chaveDoTile];
  return atual !== undefined && atual.tipo === colheita.recurso && atual.quantidade >= minimo;
}

/** DA para plantar neste tile: a entrada existe, esta ZERADA e o tipo se repoe
 *  por acao de predio. Zerada e nao "abaixo do ciclo": repor um tile que ainda
 *  tem dois pes de milho daria dois pes de graca, e recurso que nasce do nada e
 *  o que a camada de tile existe para impedir. Tile sem entrada nenhuma nao e
 *  campo em pousio — e chao que nunca foi arado, e arar e a F-T3. */
export function tilePlantavel(
  state: GameState, chaveDoTile: string, colheita: ColheitaDeRecurso, dados: GameData = gameData,
): boolean {
  const atual = state.recursos[chaveDoTile];
  if (atual === undefined || atual.tipo !== colheita.recurso || atual.quantidade > 0) return false;
  return (dados.recursos.tipos[atual.tipo]?.reposicao ?? null) !== null;
}

/**
 * F-T3 — o predicado de POSICAO entra por PARAMETRO, como `reservados`: quem
 * escolhe o tile nao conhece pathfinding (importar daqui seria ciclo — veja o
 * cabecalho de `sim/aproximacao.ts`), e quem conhece passa a pergunta pronta.
 * `SEMPRE` mantem a resposta de antes para o chamador a quem posicao nao
 * importa — a previa da planta fantasma conta o que ha no chao, nao o que da
 * para pisar.
 */
export type TileElegivel = (chaveDoTile: string) => boolean;

/** O predicado neutro, uma vez so: nao aloca closure por chamada. */
const SEMPRE: TileElegivel = () => true;

/**
 * F-T2c — O TILE que este predio deve colher agora: o primeiro de
 * `tilesDeColheita` (oeste para leste) que tem `minimo` unidades e que NINGUEM
 * reservou. E a varredura da F-T2a, intacta na ordem — o que mudou e que ela
 * deixou de ser feita dentro do sistema de producao e passou a ser o CANDIDATO
 * que a tarefa do JobBoard reserva.
 *
 * Pura: `reservados` entra por parametro (`tilesReservadosParaColheita`) em vez
 * de ser lido daqui, e e isso que permite perguntar "e se ninguem tivesse
 * reservado" — que e a pergunta do esgotamento (`semRecursoAoAlcance`).
 */
export function melhorTileDeColheita(
  state: GameState, predio: PredioCompleto, colheita: ColheitaDeRecurso, minimo: number,
  reservados: ReadonlySet<string> = SEM_RESERVA, dados: GameData = gameData,
  elegivel: TileElegivel = SEMPRE,
): string | null {
  for (const chaveDoTile of tilesDeColheita(state, predio, colheita, dados)) {
    if (reservados.has(chaveDoTile)) continue;
    if (!elegivel(chaveDoTile)) continue;
    // ESTRITO de proposito: quem escolhe onde COLHER nao pode aceitar terra em
    // pousio. O predicado largo (`tileTrabalhavel`) responde outra pergunta —
    // "este predio ainda tem o que fazer" —, e confundir as duas seria a
    // fazenda abrindo ciclo sobre um tile vazio.
    if (tileColhivelAgora(state, chaveDoTile, colheita, minimo)) return chaveDoTile;
  }
  return null;
}

/** O conjunto vazio, uma vez so: perguntar pelo MAPA e perguntar sem reservas. */
const SEM_RESERVA: ReadonlySet<string> = new Set<string>();

/**
 * F18 — sobrou ALGUM tile com trabalho ao alcance? A varredura de
 * `melhorTileDeColheita`, com o predicado LARGO no lugar do estrito: terra em
 * pousio conta, porque plantar e trabalho.
 *
 * A diferenca entre esta pergunta e a do ciclo dura exatamente o plantio. Se o
 * alerta usasse a estrita, toda fazenda apareceria parada enquanto o roceiro
 * semeia — que e metade do tempo dela.
 *
 * Ignora reservas pelo mesmo motivo que `semRecursoAoAlcance`: "a vizinha esta
 * usando o tile" e outra coisa, e se resolve sozinha.
 */
export function algumTileTrabalhavel(
  state: GameState, predio: PredioCompleto, colheita: ColheitaDeRecurso, minimo: number,
  dados: GameData = gameData,
): boolean {
  for (const chaveDoTile of tilesDeColheita(state, predio, colheita, dados)) {
    if (tileTrabalhavel(state, chaveDoTile, colheita, minimo, dados)) return true;
  }
  return false;
}

/**
 * F18 — O TILE que este predio deve REPOR agora: o primeiro de `tilesDeColheita`
 * (a mesma ordem oeste-leste da colheita) que esta em pousio e que ninguem
 * reservou. Mesma varredura, mesma ordem, outro predicado.
 *
 * A ordem ser a MESMA da colheita nao e detalhe: e ela que faz o roceiro
 * replantar o tile que acabou de secar antes de ir ao seguinte, em vez de
 * espalhar pousio por todo o alcance.
 */
export function melhorTileParaPlantio(
  state: GameState, predio: PredioCompleto, colheita: ColheitaDeRecurso,
  reservados: ReadonlySet<string> = SEM_RESERVA, dados: GameData = gameData,
  elegivel: TileElegivel = SEMPRE,
): string | null {
  for (const chaveDoTile of tilesDeColheita(state, predio, colheita, dados)) {
    if (reservados.has(chaveDoTile)) continue;
    if (!elegivel(chaveDoTile)) continue;
    if (tilePlantavel(state, chaveDoTile, colheita, dados)) return chaveDoTile;
  }
  return null;
}

/**
 * F18 — o fim de um plantio: o tile volta ao rendimento cheio do TIPO. O oposto
 * exato de `colherDoTile`, e pela mesma porta: o quanto e do dado, nao do
 * predio que plantou, entao demolir a fazenda no tick seguinte nao desfaz a
 * safra — ela esta no chao.
 *
 * Devolve o MESMO objeto quando nao ha o que repor, pela razao de sempre: tick
 * sem mudanca nao realoca a camada inteira.
 */
export function reporNoTile(
  state: GameState, chaveDoTile: string, dados: GameData = gameData,
): Readonly<Record<string, RecursoNoTile>> {
  const atual = state.recursos[chaveDoTile];
  if (atual === undefined) return state.recursos;
  const cheio = dados.recursos.tipos[atual.tipo]?.rendimentoPorTile;
  if (cheio === undefined || atual.quantidade >= cheio) return state.recursos;
  return { ...state.recursos, [chaveDoTile]: { tipo: atual.tipo, quantidade: cheio } };
}

/**
 * F-T2c — os tiles de recurso que ja tem dono. A reserva de colheita nao e uma
 * QUANTIDADE como as de `sim/reservas.ts`: e o tile INTEIRO, ocupado ou livre.
 * Duas pedreiras cavando o mesmo lajedo, uma unidade cada, seria estado valido
 * numa conta de quantidade — e e exatamente o que o aceite da F-T2c proibe.
 *
 * Conta desde `'aberta'`, como a tarefa de assentar estrada e pelo mesmo motivo:
 * e a criacao que compromete o tile (ver `TarefaColher`, state.ts).
 *
 * Mora AQUI, e nao em `reservas.ts`, porque a chave de tile vem de `estradas.ts`
 * e aquele arquivo se proibe de importa-lo para nao fechar ciclo. Esta e a porta
 * de leitura da camada de recurso; a reserva de um tile e leitura dela.
 *
 * `excetoTarefa` existe para o CLAIM: ao reconferir a propria tarefa, ela nao
 * pode se ver como concorrente.
 */
export function tilesReservadosParaColheita(
  state: GameState, excetoTarefa: string | null = null,
): ReadonlySet<string> {
  const reservados = new Set<string>();
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t === undefined || !ehTarefaDeColheita(t) || t.id === excetoTarefa) continue;
    reservados.add(chaveDeTile(t.origemTile));
  }
  // F18 — a UNIAO. O tile em plantio esta ocupado tanto quanto o tile de uma
  // tarefa reclamada: a fazenda vizinha nao pode colher o que este roceiro
  // acabou de semear, nem semear por cima. A reserva mora no predio (ver
  // `Plantio`, state.ts), mas a pergunta e uma so, e e feita aqui.
  for (const idDoPredio of state.predios.ordem) {
    const predio = state.predios.porId[idDoPredio];
    if (predio === undefined || predio.estado !== 'completo') continue;
    const plantio = predio.producao?.plantio ?? null;
    if (plantio !== null) reservados.add(chaveDeTile(plantio.tile));
  }
  return reservados;
}

/**
 * Colhe `quantidade` unidades de UM tile — o que a tarefa do JobBoard reservou —
 * e aplica o regime se ele zerar. Pressupoe que ha o bastante (quem chama ja
 * perguntou, e o claim reconferiu): colher a descoberto e bug de quem chamou,
 * como em `consumirInsumos`.
 *
 * Ate a F-T2c quem colhia era `colher(state, predio, colheita, quantidade)`, que
 * varria o alcance e podia tirar de varios tiles. Com a reserva exclusiva um
 * ciclo sai de um tile so, e a varredura virou a ESCOLHA (`melhorTileDeColheita`),
 * feita uma vez, na criacao da tarefa — e nao a cada deposito.
 *
 * Devolve o MESMO objeto quando nao ha o que colher, para que um tick sem
 * colheita nao realoque a camada inteira.
 */
export function colherDoTile(
  state: GameState, chaveDoTile: string, quantidade: number, dados: GameData = gameData,
): Readonly<Record<string, RecursoNoTile>> {
  const atual = state.recursos[chaveDoTile];
  if (quantidade <= 0 || atual === undefined || atual.quantidade === 0) return state.recursos;
  const recursos: Record<string, RecursoNoTile> = { ...state.recursos };
  const restante = atual.quantidade - Math.min(atual.quantidade, quantidade);
  if (restante === 0 && regimeDoTipo(atual.tipo, dados) === 'nunca') delete recursos[chaveDoTile];
  else recursos[chaveDoTile] = { tipo: atual.tipo, quantidade: restante };
  return recursos;
}

/**
 * O regime `porTempo`, um tick. Sem relogio por tile: a reposicao acontece nos
 * ticks multiplos de `ticksPorUnidadeRegenerada`, o que da o mesmo resultado em
 * qualquer maquina sem gastar um campo de estado por tile.
 *
 * Nenhum tipo de hoje usa o regime (o cardume e `nunca`, decisao do operador),
 * entao o caminho normal custa uma comparacao e sai — a varredura so acontece
 * se `data/resources.json` passar a declarar um tipo `porTempo`.
 */
export function regenerar(
  atuais: Readonly<Record<string, RecursoNoTile>>, tick: number, dados: GameData = gameData,
): Readonly<Record<string, RecursoNoTile>> {
  // O `tick` vem por parametro, e nao de `state.tick`, porque quem chama e o
  // `step` DEPOIS de os sistemas rodarem: `atual.tick` ainda e o do tick
  // anterior, e a reposicao tem de cair no tick que esta sendo devolvido.
  const periodo = dados.recursos.ticksPorUnidadeRegenerada;
  if (tick === 0 || tick % periodo !== 0) return atuais;
  const porTempo = tiposPorTempo(dados);
  if (porTempo.size === 0) return atuais;
  let mudou = false;
  const recursos: Record<string, RecursoNoTile> = { ...atuais };
  for (const [chave, recurso] of Object.entries(recursos)) {
    const teto = porTempo.get(recurso.tipo);
    if (teto === undefined || recurso.quantidade >= teto) continue;
    recursos[chave] = { tipo: recurso.tipo, quantidade: recurso.quantidade + 1 };
    mudou = true;
  }
  return mudou ? recursos : atuais;
}

// --- memoizacao: so o que e derivado do MAPA, que nao muda durante a partida
// (F18h: a camada de recurso SAIU daqui — ela e do estado, ver `tilesDeColheita`)

const memoPorGameData = new WeakMap<GameData, Map<string, readonly string[]>>();
const porTempoPorGameData = new WeakMap<GameData, Map<string, number>>();

function memoPorDados(dados: GameData): Map<string, readonly string[]> {
  let memo = memoPorGameData.get(dados);
  if (memo === undefined) { memo = new Map(); memoPorGameData.set(dados, memo); }
  return memo;
}

/** Tipo `porTempo` -> teto. Vazio no dado de hoje. */
function tiposPorTempo(dados: GameData): ReadonlyMap<string, number> {
  const existente = porTempoPorGameData.get(dados);
  if (existente !== undefined) return existente;
  const tipos = new Map<string, number>();
  for (const [id, def] of Object.entries(dados.recursos.tipos)) {
    if (def.regime === 'porTempo') tipos.set(id, def.rendimentoPorTile);
  }
  porTempoPorGameData.set(dados, tipos);
  return tipos;
}

// --- F-T2b: a camada de OBSTACULO -------------------------------------------

/** Os tipos que reprovam o passo, do DADO. Ninguem digita `'tree'` em `.ts`. */
function tiposQueBloqueiam(dados: GameData): ReadonlySet<string> {
  const existente = bloqueadoresPorGameData.get(dados);
  if (existente !== undefined) return existente;
  const tipos = new Set<string>();
  for (const [id, def] of Object.entries(dados.recursos.tipos)) {
    if (def.bloqueiaPasso) tipos.add(id);
  }
  bloqueadoresPorGameData.set(dados, tipos);
  return tipos;
}

/**
 * O recurso deste tile reprova o passo? So o que esta EM PE: tile cortado
 * (`quantidade: 0`, entrada que o regime `porAcao` deixa ficar) deixa passar.
 * E a mesma diferenca entre cortado e inexistente que a perna 3 do aceite
 * distingue, lida pela mesma porta.
 */
export function recursoBloqueiaPasso(
  recurso: RecursoNoTile | null, dados: GameData = gameData,
): boolean {
  if (recurso === null || recurso.quantidade <= 0) return false;
  return tiposQueBloqueiam(dados).has(recurso.tipo);
}

/** Os tipos que reprovam CONSTRUCAO, do DADO. Conjunto proprio, e nao um `if`
 *  dentro do de passo: rocha reprova construcao e deixa passar, arvore reprova
 *  as duas, milho nenhuma das duas. Nao ha como derivar um do outro. */
function tiposQueBloqueiamConstrucao(dados: GameData): ReadonlySet<string> {
  const existente = bloqueadoresDeConstrucaoPorGameData.get(dados);
  if (existente !== undefined) return existente;
  const tipos = new Set<string>();
  for (const [id, def] of Object.entries(dados.recursos.tipos)) {
    if (def.bloqueiaConstrucao) tipos.add(id);
  }
  bloqueadoresDeConstrucaoPorGameData.set(dados, tipos);
  return tipos;
}

/**
 * BUG-F — este tile aceita predio ou estrada em cima?
 *
 * So o que esta EM PE reprova, e a leitura de `quantidade <= 0` e a MESMA de
 * `recursoBloqueiaPasso` de proposito: tile de arvore cortada e tile de campo em
 * pousio sao "recurso que ficou com zero", e nenhum dos dois pode impedir o
 * jogador de construir ali. O veio esgotado de rocha nao chega aqui — o regime
 * `nunca` apaga a entrada do estado quando ela zera.
 */
export function recursoBloqueiaConstrucao(
  recurso: RecursoNoTile | null, dados: GameData = gameData,
): boolean {
  if (recurso === null || recurso.quantidade <= 0) return false;
  return tiposQueBloqueiamConstrucao(dados).has(recurso.tipo);
}

/**
 * A grade de obstaculo por recurso, derivada de `state.recursos`.
 *
 * A IDENTIDADE dela e o ponto, e nao a grade: o cache de caminho do A* e por
 * referencia, e `state.recursos` troca de referencia a cada tick em que a
 * pedreira colhe. Chavear o cache no `recursos` cru esvaziaria a memoria de
 * caminho inteira toda vez que alguem picasse pedra — defeito de desempenho
 * criado pela feature, nao herdado.
 *
 * Por isso, quando a grade nova sai IGUAL a ultima, devolvemos o objeto
 * ANTERIOR. Colher rocha muda `recursos` e nao muda obstaculo nenhum, entao o
 * cache sobrevive. Trocar objeto por outro de conteudo identico nunca muda
 * resposta; e a mesma ideia do `predios.ordem` no topo deste arquivo de cache.
 */
export interface CamadaDeBloqueio {
  /** 1 onde o recurso em pe reprova o passo. Indexada por `gy * largura + gx`. */
  readonly grade: Uint8Array;
  readonly largura: number;
  readonly altura: number;
  /** Quantos tiles bloqueiam — so para evidencia e teste. */
  readonly bloqueados: number;
}

export function camadaDeBloqueio(
  state: Pick<GameState, 'recursos'>, dados: GameData = gameData,
): CamadaDeBloqueio {
  let porRecursos = camadaDeBloqueioPorGameData.get(dados);
  if (porRecursos === undefined) {
    porRecursos = new WeakMap();
    camadaDeBloqueioPorGameData.set(dados, porRecursos);
  }
  const existente = porRecursos.get(state.recursos);
  if (existente !== undefined) return existente;

  const { largura, altura } = dados.terreno.mapaPadrao;
  const grade = new Uint8Array(largura * altura);
  const bloqueadores = tiposQueBloqueiam(dados);
  let bloqueados = 0;
  if (bloqueadores.size > 0) {
    for (const [chaveDoTile, recurso] of Object.entries(state.recursos)) {
      if (recurso.quantidade <= 0 || !bloqueadores.has(recurso.tipo)) continue;
      const virgula = chaveDoTile.indexOf(',');
      const gx = Number(chaveDoTile.slice(0, virgula));
      const gy = Number(chaveDoTile.slice(virgula + 1));
      // Fora da grade DESTE `dados` nao entra: teste que redeclara o tamanho do
      // mundo (F17c, F10) usa a camada de recurso do mapa de 128.
      if (!(gx >= 0 && gy >= 0 && gx < largura && gy < altura)) continue;
      grade[gy * largura + gx] = 1;
      bloqueados += 1;
    }
  }
  // A candidata a reuso e indexada pela CONTAGEM de bloqueados, e nao guardada
  // num slot unico: com um slot so, dois estados alternando (o mundo de
  // verdade e um mundo sem recurso, que e o par que todo teste de medicao usa)
  // derrubam um ao outro e o reuso nunca acontece. Grades de contagem
  // diferente nunca sao iguais, entao o indice nao perde caso nenhum; duas
  // grades de mesma contagem e conteudo diferente ainda se revezam, e o preco
  // disso e so um acerto de cache perdido — nunca uma resposta errada.
  let ultimas = ultimaCamadaPorGameData.get(dados);
  if (ultimas === undefined) {
    ultimas = new Map();
    ultimaCamadaPorGameData.set(dados, ultimas);
  }
  const anterior = ultimas.get(bloqueados);
  const reaproveitavel = anterior !== undefined
    && anterior.grade.length === grade.length
    && mesmaGrade(anterior.grade, grade);
  const camada: CamadaDeBloqueio = reaproveitavel
    ? (anterior as CamadaDeBloqueio)
    : { grade, largura, altura, bloqueados };
  if (!reaproveitavel) ultimas.set(bloqueados, camada);
  porRecursos.set(state.recursos, camada);
  return camada;
}

function mesmaGrade(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** O tile reprova o passo por RECURSO? A porta unica: nem o A*, nem a rede de
 *  estradas indexam `state.recursos` por conta propria. */
export function bloqueadoPorRecurso(
  camada: CamadaDeBloqueio, gx: number, gy: number,
): boolean {
  if (gx < 0 || gy < 0 || gx >= camada.largura || gy >= camada.altura) return false;
  return camada.grade[gy * camada.largura + gx] === 1;
}

const bloqueadoresPorGameData = new WeakMap<GameData, ReadonlySet<string>>();
const bloqueadoresDeConstrucaoPorGameData = new WeakMap<GameData, ReadonlySet<string>>();
const camadaDeBloqueioPorGameData = new WeakMap<GameData, WeakMap<object, CamadaDeBloqueio>>();
const ultimaCamadaPorGameData = new WeakMap<GameData, Map<number, CamadaDeBloqueio>>();
