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
import { ehTarefaDePedraParaCanteiro, ID_DO_ARMAZEM } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { bordaSul, caixaDoPredio } from './footprint';
import { ehTransponivel } from './mapa';
import { bloqueadoPorRecurso, camadaDeBloqueio, recursoBloqueiaConstrucao, recursoBloqueiaPasso } from './recursos';
import type { CamadaDeBloqueio } from './recursos';
import { disponivelNaOrigem } from './reservas';

/** Um tile de grid, sempre em coordenada inteira quando valido. Mesma forma do
 *  `Tile` de `render/grid.ts`, sem importa-lo: `sim/` nao depende de `render/`. */
export interface TileDeGrid {
  readonly gx: number;
  readonly gy: number;
}

// F-T1: `'terreno'` entra com a camada de terreno base — estrada nao se assenta
// sobre agua, rocha ou montanha (`terrain.intransponivel`). Ate ela o comentario
// de `canPlaceRoad` dizia, com razao, que o motivo nao existia.
export type MotivoDeRecusaDeEstrada =
  | 'fora-do-mapa'
  | 'terreno'
  // F-T2b — recurso EM PE que reprova o passo (hoje so a arvore). Motivo
  // separado de `'terreno'` de proposito: sao causas diferentes com conserto
  // diferente — terreno nao se remove, arvore se corta. Rotulo unico para as
  // duas esconderia justamente a diferenca que o jogador precisa ler.
  | 'recurso'
  | 'sobreposicao';
// F18g — `'sem-pedra'` SAIU: o comando deixou de exigir a pedra do trecho inteiro
// no instante do clique (decisao do operador, Opcao A do item F18g). A pedra
// viaja por tile, e um tile sem pagador fica desenhado esperando — o canteiro e o
// feedback. Um motivo sem produtor seria folclore no tipo.

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

/** F18d-1b — o tile esta no CANTEIRO (desenhado, ainda nao assentado)? Irma de
 *  `ehEstrada`, e de proposito separada: quem pergunta uma coisa nao responde a
 *  outra, e nenhuma consulta de rede olha aqui. */
export function ehPlanejada(
  planejadas: GameState['estradasPlanejadas'], tile: TileDeGrid,
): boolean {
  return planejadas[chaveDeTile(tile)] === true;
}

/** Os tiles em ordem canonica (por `gy`, depois `gx`), independente da ordem de
 *  insercao no objeto: e daqui que qualquer iteracao deterministica deve partir. */
export function tilesOrdenados(estradas: GameState['estradas']): TileDeGrid[] {
  return Object.keys(estradas).map(tileDeChave).sort((a, b) => a.gy - b.gy || a.gx - b.gx);
}

// --- conectividade: indice de componentes, memoizado pela referencia ---

/**
 * Vizinhanca de 8 direcoes (F18e). A diagonal LIGA — e o que o jogo original faz,
 * e sem ela a rua perdia para a grama acima de ~34 graus. O que ela NAO faz e
 * cortar quina: o passo diagonal exige as duas quinas livres de predio, a mesma
 * regra que o A* de `pathfinding.ts` aplica em `quinaLivre`. As duas metades tem
 * de dizer a mesma coisa; a propriedade da equivalencia (F10-astar) reprova se
 * divergirem.
 */
const VIZINHOS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** O que a rede precisa saber do estado: os tiles de estrada e os predios, que
 *  sao o que tapa quina. Menos que `GameState` para o teste poder montar caso. */
export type EstadoDaRede = Pick<GameState, 'estradas' | 'predios' | 'recursos'>;

/** Os tiles cobertos por footprint de predio. Montado UMA vez por indice — o
 *  `tileEmPredio` de baixo e O(predios) por tile e serve a consulta avulsa. */
function tilesDePredios(state: EstadoDaRede, dados: GameData): Set<string> {
  const tiles = new Set<string>();
  for (const id of state.predios.ordem) {
    const predio = state.predios.porId[id];
    const caixa = predio ? caixaDoPredio(predio, dados) : null;
    if (caixa === null) continue;
    for (let gy = caixa.y0; gy < caixa.y1; gy++) {
      for (let gx = caixa.x0; gx < caixa.x1; gx++) tiles.add(`${gx},${gy}`);
    }
  }
  return tiles;
}

/** O passo de `atual` na direcao (dx, dy) e permitido? Reto sempre; diagonal so
 *  com as duas quinas livres de predio, de terreno intransponivel (F-T1) E de
 *  recurso que bloqueia (F-T2b).
 *  Unico ponto onde a regra da quina mora deste lado — o indice e a distancia
 *  chamam o mesmo, e o `quinaLivre` do A* diz exatamente isto do outro lado
 *  (propriedade da equivalencia, tests/F10-astar.test.ts). A arvore entrou nos
 *  DOIS lados no mesmo commit, de proposito: mudar so um e o jeito de fazer a
 *  equivalencia quebrar sem que nenhuma regra de jogo tenha mudado. */
function passoPermitido(
  atual: TileDeGrid, dx: number, dy: number, bloqueados: ReadonlySet<string>,
  recursos: CamadaDeBloqueio, dados: GameData,
): boolean {
  if (dx === 0 || dy === 0) return true;
  const quina = (gx: number, gy: number): boolean => !bloqueados.has(`${gx},${gy}`)
    && ehTransponivel(gx, gy, dados) && !bloqueadoPorRecurso(recursos, gx, gy);
  return quina(atual.gx + dx, atual.gy) && quina(atual.gx, atual.gy + dy);
}

/** Os pares de tiles de estrada ligados em DIAGONAL, cada par uma vez so (o
 *  vizinho e sempre a leste). O render desenha uma ponte no canto compartilhado:
 *  dois quadrados que se tocam por um ponto parecem rua cortada, e a sim diz que
 *  nao esta. Existe para o desenho NAO reimplementar a regra da quina — quem
 *  responde e o mesmo `passoPermitido` do indice e da distancia. */
export function pontesDiagonais(
  state: EstadoDaRede, dados: GameData = gameData,
): readonly (readonly [TileDeGrid, TileDeGrid])[] {
  const bloqueados = tilesDePredios(state, dados);
  const recursos = camadaDeBloqueio(state, dados);
  const pontes: (readonly [TileDeGrid, TileDeGrid])[] = [];
  for (const tile of tilesOrdenados(state.estradas)) {
    for (const [dx, dy] of [[1, 1], [1, -1]] as const) {
      const vizinho = { gx: tile.gx + dx, gy: tile.gy + dy };
      if (!ehEstrada(state.estradas, vizinho)) continue;
      if (!passoPermitido(tile, dx, dy, bloqueados, recursos, dados)) continue;
      pontes.push([tile, vizinho]);
    }
  }
  return pontes;
}

export interface IndiceDeEstradas {
  /** `"gx,gy"` -> id do componente conexo. Tile ausente = nao e estrada. */
  readonly componentes: Readonly<Record<string, number>>;
  readonly quantidade: number;
}

function construirIndice(state: EstadoDaRede, dados: GameData): IndiceDeEstradas {
  const { estradas } = state;
  const bloqueados = tilesDePredios(state, dados);
  const recursos = camadaDeBloqueio(state, dados);
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
        if (!passoPermitido(atual, dx, dy, bloqueados, recursos, dados)) continue;
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

// `dados` -> `estradas` -> `predios.ordem`. A quina faz a conectividade depender
// de predio, entao a chave nao pode ser so a rede: e o mesmo par de chaves que
// `footprintsDe` de `pathfinding.ts` usa, e `predios.ordem` so muda quando um
// predio nasce ou morre — nao a cada tick de obra.
const indices = new WeakMap<object, WeakMap<object, WeakMap<object, WeakMap<object, IndiceDeEstradas>>>>();

// F-T2b: a camada de bloqueio entra na chave porque a arvore agora tapa quina.
// Entra a CAMADA e nao `state.recursos`: a camada so troca de identidade quando
// o conjunto de tiles bloqueados muda, entao colher pedra — que troca
// `state.recursos` todo tick — nao invalida indice nenhum.
function memoDoIndice(
  state: EstadoDaRede, recursos: CamadaDeBloqueio, dados: GameData,
): WeakMap<object, IndiceDeEstradas> {
  let porEstradas = indices.get(dados);
  if (porEstradas === undefined) {
    porEstradas = new WeakMap();
    indices.set(dados, porEstradas);
  }
  let porRecursos = porEstradas.get(state.estradas);
  if (porRecursos === undefined) {
    porRecursos = new WeakMap();
    porEstradas.set(state.estradas, porRecursos);
  }
  let porOrdem = porRecursos.get(recursos);
  if (porOrdem === undefined) {
    porOrdem = new WeakMap();
    porRecursos.set(recursos, porOrdem);
  }
  return porOrdem;
}

/**
 * O indice de componentes conexos. Construido UMA vez por referencia de `estradas`
 * (O(N log N), so quando alguem constroi ou demole estrada, ou depois de um load) e
 * reaproveitado por todas as consultas ate a referencia mudar. `step()` carrega a
 * mesma referencia enquanto nenhum comando de estrada altera algo — entao os
 * milhares de perguntas de um tick custam um lookup, nao uma busca.
 */
export function indiceDeEstradas(state: EstadoDaRede, dados: GameData = gameData): IndiceDeEstradas {
  const memo = memoDoIndice(state, camadaDeBloqueio(state, dados), dados);
  let indice = memo.get(state.predios.ordem);
  if (indice === undefined) {
    indice = construirIndice(state, dados);
    memo.set(state.predios.ordem, indice);
  }
  return indice;
}

/** O id do componente do tile, ou `null` se o tile nao e estrada. */
export function componenteDe(
  state: EstadoDaRede, tile: TileDeGrid, dados: GameData = gameData,
): number | null {
  return indiceDeEstradas(state, dados).componentes[chaveDeTile(tile)] ?? null;
}

/** Existe caminho de estrada de `from` ate `to`? `false` se algum dos dois nao e
 *  estrada; o mesmo tile de estrada esta conectado a si mesmo. */
export function isConnected(
  state: EstadoDaRede, from: TileDeGrid, to: TileDeGrid, dados: GameData = gameData,
): boolean {
  const indice = indiceDeEstradas(state, dados);
  const a = indice.componentes[chaveDeTile(from)];
  return a !== undefined && a === indice.componentes[chaveDeTile(to)];
}

// --- distancia por estrada (F09) ---

// Chaveado pelo OBJETO do indice: ele ja e unico por (dados, estradas,
// predios.ordem), entao a distancia herda a invalidacao de graca.
const distancias = new WeakMap<IndiceDeEstradas, Map<string, number | null>>();

/**
 * Distancia de CAMINHO A PE pela rede: o menor numero de passos, so por tiles de
 * estrada e em 8 direcoes sem cortar quina (F18e; o passo diagonal conta 1, como
 * qualquer outro), de uma das portas de `de` ate uma das de `para`; `null`
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
  state: EstadoDaRede, de: readonly TileDeGrid[], para: readonly TileDeGrid[],
  dados: GameData = gameData,
): number | null {
  const chave = `${de.map(chaveDeTile).join(';')}|${para.map(chaveDeTile).join(';')}`;
  const indice = indiceDeEstradas(state, dados);
  let memo = distancias.get(indice);
  if (memo === undefined) {
    memo = new Map();
    distancias.set(indice, memo);
  }
  const guardada = memo.get(chave);
  if (guardada !== undefined) return guardada;

  const resultado = buscarDistancia(state, de, para, dados);
  memo.set(chave, resultado);
  return resultado;
}

function buscarDistancia(
  state: EstadoDaRede, de: readonly TileDeGrid[], para: readonly TileDeGrid[], dados: GameData,
): number | null {
  const { estradas } = state;
  const bloqueados = tilesDePredios(state, dados);
  const recursos = camadaDeBloqueio(state, dados);
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
        if (!passoPermitido(atual, dx, dy, bloqueados, recursos, dados)) continue;
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
  return distanciaPorEstrada(state, tilesDaPorta(a, dados), tilesDaPorta(b, dados), dados);
}

// --- predios na rede ---

/** Os armazens completos, em `predios.ordem`. C7: com `lado`, so os daquele lado — quem
 *  escolhe origem, destino, devolucao ou ligacao passa o lado do predio ou da unidade,
 *  e nenhuma carga cruza de um lado para o outro. Sem `lado`, todos (o que so a medida
 *  global da previa de estrada ainda usa). */
export function armazensCompletos(state: GameState, lado?: number): PredioCompleto[] {
  return state.predios.ordem.flatMap((id) => {
    const predio = state.predios.porId[id];
    return predio && predio.estado === 'completo' && predio.tipo === ID_DO_ARMAZEM
      && (lado === undefined || predio.lado === lado) ? [predio] : [];
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
  const { componentes } = indiceDeEstradas(state, dados);
  const doArmazem = new Set<number>();
  // C7: ligado ao armazem do PROPRIO lado
  for (const armazem of armazensCompletos(state, predio.lado)) {
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

// --- F18g: a pedra parada no canteiro ---

/** F18g — quanta pedra ja foi entregue neste tile do canteiro e ainda nao virou rua. */
export function pedraNoTile(state: GameState, tile: TileDeGrid): number {
  return state.pedraNoCanteiro[chaveDeTile(tile)] ?? 0;
}

/** F18g — `pedraNoCanteiro` com `delta` somado no tile; a entrada some ao chegar a
 *  zero, para que "so tiles com pedra estao aqui" seja verdade por construcao. */
export function comPedraNoTile(
  state: GameState, tile: TileDeGrid, delta: number,
): GameState['pedraNoCanteiro'] {
  const chave = chaveDeTile(tile);
  const total = (state.pedraNoCanteiro[chave] ?? 0) + delta;
  if (total < 0) throw new Error(`comPedraNoTile: a pedra do tile ${chave} ficaria negativa (${total})`);
  const proximo: Record<string, number> = { ...state.pedraNoCanteiro };
  if (total === 0) delete proximo[chave];
  else proximo[chave] = total;
  return proximo;
}

/** F18g — existe tarefa de pedra (em qualquer estado) mirando este tile? E o espelho
 *  exato de `existeTarefaDeMaterial` (obra.ts): tarefa aberta so nasce com pedra
 *  livre num armazem, entao "existe tarefa" e "a pedra vem". */
export function existeTarefaDePedraParaOTile(state: GameState, tile: TileDeGrid): boolean {
  const chave = chaveDeTile(tile);
  return state.jobs.tarefas.ordem.some((id) => {
    const t = state.jobs.tarefas.porId[id];
    return t !== undefined && ehTarefaDePedraParaCanteiro(t) && chaveDeTile(t.destinoTile) === chave;
  });
}

/**
 * F18g — ha algo que um laborer possa fazer neste tile do canteiro agora? O espelho
 * de `obraTrabalhavel` (obra.ts), e pelo mesmo motivo: sem esta regra, com 2 de
 * pedra e 30 tiles desenhados, dois laborers iriam aos dois tiles mais perto DELES
 * e esperariam para sempre a pedra que os serfs levaram aos dois tiles mais perto
 * DELES — espera indefinida e travamento de regra, nao balanceamento.
 *
 * Duas clausulas: a pedra ja esta no tile (da para assentar), ou esta a caminho
 * (da para esperar). Sem nenhuma, nao ha nada que o laborer possa fazer ali, e o
 * claim recusa com `'destino-sem-trabalho'`.
 */
export function tileDeEstradaTrabalhavel(
  state: GameState, tile: TileDeGrid, dados: GameData = gameData,
): boolean {
  if (!ehPlanejada(state.estradasPlanejadas, tile)) return false;
  if (pedraNoTile(state, tile) >= dados.terreno.estrada.custoStonePorTile) return true;
  return existeTarefaDePedraParaOTile(state, tile);
}

/**
 * F18d-1b, refeito na F18g — o tile planejado vira estrada DE PE, consumindo
 * `custoStonePorTile` da PEDRA PARADA NO TILE (`pedraNoCanteiro`). `null` quando
 * ela nao esta la: sem pedra nao nasce estrada, e quem chama libera a tarefa.
 *
 * Ate a F18g o debito era do ARMAZEM gravado na tarefa (`origemId`), e a pedra
 * nunca saia de la antes do assentamento. Agora ela ja saiu — na coleta pelo
 * serf — e o que este passo faz e transformar pedra do chao em rua, sem tocar em
 * predio nenhum.
 */
export function comOTileAssentado(
  state: GameState, tile: TileDeGrid, dados: GameData = gameData,
): GameState | null {
  const custo = dados.terreno.estrada.custoStonePorTile;
  if (pedraNoTile(state, tile) < custo) return null;

  const chave = chaveDeTile(tile);
  const planejadas = { ...state.estradasPlanejadas };
  delete planejadas[chave];
  return {
    ...state,
    estradas: { ...state.estradas, [chave]: true },
    estradasPlanejadas: planejadas,
    pedraNoCanteiro: comPedraNoTile(state, tile, -custo),
  };
}

/**
 * A pedra que os armazens completos tem para gastar em estrada: so a gaveta `saida`,
 * so o que nenhuma tarefa reservou, e so em multiplos do custo de um tile.
 *
 * F18d-1b — as tres restricoes sao o MESMO predicado do pagador, escrito uma vez:
 *  - a gaveta `entrada` saiu da conta. Ate aqui ela entrava porque o `debitarPedra` do
 *    comando podia esvazia-la; agora o custo e uma RESERVA, e so `saida` e reservavel.
 *    (No jogo a `entrada` de um armazem nunca recebe pedra — `estoqueParaTipo` nasce
 *    vazia e o deposito do serf cai na `saida`; ela so existia em fixture de teste.)
 *  - o piso por armazem impede contar o que ninguem consegue pagar: dois armazens com
 *    1 de pedra cada, custo 2, somam 2 e nao levantam um tile sequer.
 *
 * F18g — deixou de ser PORTAO: `canPlaceRoad` nao a consulta mais. Continua sendo a
 * MEDIDA de "quantos tiles a vila consegue pagar agora" — e o que a previa do render
 * e os testes da F09 leem —, e a tarefa de pedra nasce so ate onde ela chega.
 */
export function pedraDisponivel(state: GameState, dados: GameData = gameData): number {
  const custo = dados.terreno.estrada.custoStonePorTile;
  let soma = 0;
  for (const armazem of armazensCompletos(state)) {
    const livre = disponivelNaOrigem(state, armazem.id, MERCADORIA_DA_ESTRADA);
    soma += custo > 0 ? Math.floor(livre / custo) * custo : livre;
  }
  return soma;
}

export function tileEmPredio(state: GameState, tile: TileDeGrid, dados: GameData): boolean {
  for (const id of state.predios.ordem) {
    const predio = state.predios.porId[id];
    const caixa = predio ? caixaDoPredio(predio, dados) : null;
    if (caixa && tile.gx >= caixa.x0 && tile.gx < caixa.x1 && tile.gy >= caixa.y0 && tile.gy < caixa.y1) return true;
  }
  return false;
}

export type ResultadoDeEstrada =
  | { readonly ok: true; readonly novos: readonly TileDeGrid[]; readonly custoEmPedra: number }
  | { readonly ok: false; readonly motivo: MotivoDeRecusaDeEstrada; readonly tile: TileDeGrid };

/**
 * Pode-se construir estrada sobre `tiles`? Pura. Devolve os tiles NOVOS (os que ainda
 * nao sao estrada, sem repeticao, na ordem em que vieram) e o custo em pedra deles, ou
 * o motivo e o primeiro tile culpado. Tudo ou nada: um tile invalido recusa o trecho.
 *
 * Ordem: cada tile (mapa, depois terreno, depois recurso, depois predio — obra
 * incluida). A PEDRA NAO ENTRA (F18g): ate a F18d-1b o trecho era recusado com
 * `'sem-pedra'` quando `custoEmPedra > pedraDisponivel`, e era ESSE portao — nao o
 * debito — que apertava a abertura (31 tiles contra 30 de pedra derrubaram a vila
 * inteira na F-T4b). Agora o canteiro se desenha sem pagador e a pedra chega por
 * tile, quando houver; `custoEmPedra` continua na resposta porque a previa do
 * render mostra ao jogador quanto o trecho vai custar.
 *
 * F-T2b — a estrada NAO se assenta sobre recurso que bloqueia o PASSO, e nao e
 * enfeite: sem esta recusa existe o tile passavel no modo `estrada` e bloqueado no
 * modo `livre`, ou seja, o serf carregado atravessa a arvore e o serf vazio nao. O
 * terreno nunca produziu esse par porque estrada sobre terreno intransponivel ja
 * era recusada; o recurso produziria.
 *
 * BUG-F (2026-09-24) — e tambem nao se assenta sobre recurso que bloqueia
 * CONSTRUCAO, que e o caso da rocha: ela deixa passar e nao aceita obra em cima.
 * O paragrafo anterior deste comentario dizia que "predio sobre recurso continua
 * permitido, e e o que a pedreira sobre o lajedo faz desde o BUG-C"; era falso e
 * foi medido — a pedreira posta no lajedo lavrava a rocha debaixo das proprias
 * paredes. O `canPlace` passou a recusar, e a estrada acompanha por decisao do
 * operador: o motivo `'recurso'` ja estava de pe aqui, entao o que mudou foi o
 * predicado, nao o vocabulario. Se o tracado ficar sofrido no playtest, e ele que
 * revisa — a rocha da vila e 13 tiles.
 *
 * Os dois predicados somam em vez de um derivar do outro: arvore reprova pelos
 * dois, rocha so pela construcao, milho por nenhum.
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
    if (!ehTransponivel(tile.gx, tile.gy, dados)) return { ok: false, motivo: 'terreno', tile };
    const recursoDoTile = state.recursos[chaveDeTile(tile)] ?? null;
    if (recursoBloqueiaPasso(recursoDoTile, dados)
      || recursoBloqueiaConstrucao(recursoDoTile, dados)) {
      return { ok: false, motivo: 'recurso', tile };
    }
    if (tileEmPredio(state, tile, dados)) return { ok: false, motivo: 'sobreposicao', tile };
    const chave = chaveDeTile(tile);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    // F18d-1b: ja planejado tambem nao e novo — a pedra dele ja esta reservada e a
    // tarefa dele ja existe. Redesenhar por cima do proprio canteiro nao custa nada.
    if (!ehEstrada(state.estradas, tile) && !ehPlanejada(state.estradasPlanejadas, tile)) novos.push(tile);
  }
  const custoEmPedra = novos.length * dados.terreno.estrada.custoStonePorTile;
  return { ok: true, novos, custoEmPedra };
}
