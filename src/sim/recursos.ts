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
import { chaveDeTile } from './estradas';
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
 */
export function recursosIniciais(dados: GameData = gameData): Readonly<Record<string, RecursoNoTile>> {
  const recursos: Record<string, RecursoNoTile> = {};
  for (const [tipo, tiles] of Object.entries(dados.mapa.recursos)) {
    const def = dados.recursos.tipos[tipo];
    if (def === undefined) continue; // o carregador ja reprovou; aqui so estreita o tipo
    for (const [gx, gy] of tiles) {
      recursos[chave(gx, gy)] = { tipo, quantidade: def.rendimentoPorTile };
    }
  }
  return recursos;
}

/**
 * Os tiles que ESTE predio pode colher, segundo o MAPA — nao segundo o estado.
 * Lista estatica: o mapa nao muda durante a partida, entao ela e memoizada por
 * `GameData` e por (tipo de recurso, alcance, retangulo do predio). Sem isto o
 * predicado "ainda ha recurso?" varreria 200 tiles POR TICK, por predio.
 *
 * Ordem: linha a linha, oeste para leste. E arbitraria, mas tem de ser FIXA —
 * e ela que decide qual tile esvazia primeiro, e o teste de determinismo compara
 * byte a byte.
 */
export function tilesDeColheita(
  predio: PredioCompleto, colheita: ColheitaDeRecurso, dados: GameData = gameData,
): readonly string[] {
  const memoKey = `${colheita.recurso}:${colheita.alcance}:${predio.tipo}:${predio.gx},${predio.gy}`;
  const memo = memoPorDados(dados);
  const existente = memo.get(memoKey);
  if (existente !== undefined) return existente;

  // A distancia e de Chebyshev a partir do FOOTPRINT, nao do canto: uma pedreira
  // de 3x2 alcanca o mesmo tanto para os dois lados, e girar o predio um dia nao
  // muda o alcance.
  const caixa = caixaDoPredio(predio, dados);
  const alcance = colheita.alcance;
  const naCamada = camadaDoTipo(dados, colheita.recurso);
  const tiles: string[] = [];
  if (caixa === null) return tiles; // tipo fora do dado (save de outra versao)
  // `caixa.x1`/`y1` sao a BORDA, nao o ultimo tile (`footprint.ts`): o ultimo
  // tile ocupado e `x1 - 1`, e e dele que se contam os `alcance` passos.
  for (let gy = caixa.y0 - alcance; gy <= caixa.y1 - 1 + alcance; gy += 1) {
    for (let gx = caixa.x0 - alcance; gx <= caixa.x1 - 1 + alcance; gx += 1) {
      if (gx < 0 || gy < 0) continue;
      const k = chave(gx, gy);
      if (naCamada.has(k)) tiles.push(k);
    }
  }
  memo.set(memoKey, tiles);
  return tiles;
}

/** Quanto ainda ha, somado, nos tiles ao alcance. */
export function disponivelAoAlcance(
  state: GameState, predio: PredioCompleto, colheita: ColheitaDeRecurso, dados: GameData = gameData,
): number {
  let total = 0;
  for (const chave of tilesDeColheita(predio, colheita, dados)) {
    total += state.recursos[chave]?.quantidade ?? 0;
  }
  return total;
}

/**
 * Colhe `quantidade` unidades dos tiles ao alcance, na ordem de
 * `tilesDeColheita`, e aplica o regime de cada tile que zerar. Pressupoe que ha
 * o bastante (quem chama ja perguntou por `disponivelAoAlcance`): colher a
 * descoberto e bug de quem chamou, como em `consumirInsumos`.
 *
 * Devolve o MESMO objeto quando nao ha o que colher, para que um tick sem
 * colheita nao realoque a camada inteira.
 */
export function colher(
  state: GameState, predio: PredioCompleto, colheita: ColheitaDeRecurso, quantidade: number,
  dados: GameData = gameData,
): Readonly<Record<string, RecursoNoTile>> {
  if (quantidade <= 0) return state.recursos;
  let falta = quantidade;
  const recursos: Record<string, RecursoNoTile> = { ...state.recursos };
  for (const chave of tilesDeColheita(predio, colheita, dados)) {
    if (falta === 0) break;
    const atual = recursos[chave];
    if (atual === undefined || atual.quantidade === 0) continue;
    const tirado = Math.min(atual.quantidade, falta);
    falta -= tirado;
    const restante = atual.quantidade - tirado;
    if (restante === 0 && regimeDoTipo(atual.tipo, dados) === 'nunca') delete recursos[chave];
    else recursos[chave] = { tipo: atual.tipo, quantidade: restante };
  }
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

// --- memoizacao: derivada do MAPA, que nao muda durante a partida ------------

const memoPorGameData = new WeakMap<GameData, Map<string, readonly string[]>>();
const camadaPorGameData = new WeakMap<GameData, Map<string, ReadonlySet<string>>>();
const porTempoPorGameData = new WeakMap<GameData, Map<string, number>>();

function memoPorDados(dados: GameData): Map<string, readonly string[]> {
  let memo = memoPorGameData.get(dados);
  if (memo === undefined) { memo = new Map(); memoPorGameData.set(dados, memo); }
  return memo;
}

/** Os tiles de UM tipo, como conjunto, para o teste de pertinencia do scan. */
function camadaDoTipo(dados: GameData, tipo: string): ReadonlySet<string> {
  let porTipo = camadaPorGameData.get(dados);
  if (porTipo === undefined) { porTipo = new Map(); camadaPorGameData.set(dados, porTipo); }
  const existente = porTipo.get(tipo);
  if (existente !== undefined) return existente;
  const conjunto = new Set<string>();
  for (const [gx, gy] of dados.mapa.recursos[tipo] ?? []) conjunto.add(chave(gx, gy));
  porTipo.set(tipo, conjunto);
  return conjunto;
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
const camadaDeBloqueioPorGameData = new WeakMap<GameData, WeakMap<object, CamadaDeBloqueio>>();
const ultimaCamadaPorGameData = new WeakMap<GameData, Map<number, CamadaDeBloqueio>>();
