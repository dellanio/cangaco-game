/**
 * D-MOVIMENTO-01 — a colisao civil (GDD §6.4, revisto em 2026-09-28; plano em
 * docs/planos/2026-09-28-D1-colisao-civil.md). O mecanismo e o do `WalkTo` do kam_remake:
 * a colisao se resolve NO PASSO, nao no A*. Quem vem de frente PERMUTA de tile com o outro;
 * o ocioso no caminho e empurrado; passada uma espera, o bloqueado contorna os parados;
 * passada a espera longa, permuta com quem anda e o prende. D-MOVIMENTO-01j: nunca ha dois
 * civis num tile — a troca e sempre permuta, como no KaM.
 *
 * Tudo aqui so age com `colisaoCivil.ligada`. Desligada, nenhum campo novo nasce e o
 * estado fica igual, byte a byte.
 */
import type { GameData } from './data/types';
import type { DadosDaFsm, GameState, Unidade } from './state';
import type { TileDeGrid } from './estradas';
import { custoDoPasso, passoAndavel } from './pathfinding';
import type { ModoDeBusca } from './pathfinding';
import { classeDaUnidade } from './condicao';

/**
 * Onde a unidade esta, para a colisao, em CADA estado de FSM do jogo. `dentro` e quem esta
 * dentro do predio ou do canteiro (no KaM, dentro da casa): fica no tile da porta mas nao o
 * ocupa. `fora` ocupa o tile. Esquecer um estado aqui e travamento, e por isso o teste do D-MOVIMENTO-01a (mecanismo da colisao civil)
 * varre `src/sim` atras de todo estado escrito ou comparado e reprova o que faltar.
 *
 * `carregando` e `entregando` sao `fora` de proposito: e a fila na porta do KaM (`GoInOut`
 * ocupa a porta), a fonte de engarrafamento que sobra depois da troca de frente.
 */
export const POSICAO_DO_ESTADO: Readonly<Record<string, 'dentro' | 'fora'>> = {
  // todos
  ocioso: 'fora',
  // serf (GDD §6.2)
  indo_buscar: 'fora',
  carregando: 'fora',
  indo_entregar: 'fora',
  entregando: 'fora',
  devolvendo: 'fora',
  // laborer (GDD §6.3): no canteiro, dentro
  indo_a_obra: 'fora',
  nivelando: 'dentro',
  esperando_material: 'dentro',
  martelando: 'dentro',
  // especialista: produzindo, dentro; em campo, fora
  indo_ocupar: 'fora',
  indo_alistar: 'fora',
  trabalhando: 'dentro',
  esperando_insumo: 'dentro',
  saida_cheia: 'dentro',
  indo_colher: 'fora',
  colhendo: 'fora',
  voltando: 'fora',
  indo_semear: 'fora',
  semeando: 'fora',
  // fome (F20b)
  indo_comer: 'fora',
  comendo: 'dentro',
  // militar (a C5 cuida dele; classificado para a lista ser completa)
  marchando: 'fora',
  em_carga: 'fora',
  indo_lutar: 'fora',
  lutando: 'fora',
  atirando: 'fora',
  indo_atacar: 'fora',
  atacando: 'fora',
};

/** O unico estado que se empurra: quem nao tem tarefa nem lugar. */
const EMPURRAVEL = 'ocioso';

export function colisaoCivilLigada(dados: GameData): boolean {
  return dados.movimento.colisaoCivil.ligada;
}

/** A unidade ocupa o tile? Lanca para estado sem classificacao, como o `default` das FSMs. */
export function ocupaTile(u: Unidade): boolean {
  const posicao = POSICAO_DO_ESTADO[u.fsm];
  if (posicao === undefined) throw new Error(`colisao: estado de FSM sem classificacao '${u.fsm}' na unidade ${u.id}`);
  return posicao === 'fora';
}

/** Civil "fora", esteja ou nao esperando a porta. */
function ehCivilFora(u: Unidade, dados: GameData): boolean {
  return classeDaUnidade(u.tipo, dados) === 'civil' && ocupaTile(u);
}

/** Civil que ocupa tile: quem a colisao civil ve. Quem espera a porta (`saindo`) ainda esta
 *  "dentro", para os outros. */
export function ehCivilQueOcupa(u: Unidade, dados: GameData): boolean {
  return u.saindo === undefined && ehCivilFora(u, dados);
}

const mesmoTile = (a: TileDeGrid, b: TileDeGrid): boolean => a.gx === b.gx && a.gy === b.gy;

/**
 * I-MOVIMENTO-FILA-DE-CIVIS — a OCUPACAO LOGICA: o tile que a unidade ocupa e o dela, e com o passo
 * comecado (`progresso` > 0) e o seguinte, como o `Walk` do KaM, que muda o dono do tile no inicio
 * do passo (`TKMTerrain.UnitWalk`, `src/terrain/KM_Terrain.pas:4266-4279`).
 */
export function tileOcupado(u: Unidade): TileDeGrid {
  const indo = u.fsmData.caminho?.[0];
  return indo !== undefined && (u.fsmData.progresso ?? 0) > 0 ? indo : { gx: u.gx, gy: u.gy };
}

/** Os civis "fora" que ocupam o tile (ocupacao logica), menos `quem`, na ordem de `unidades.ordem`. */
export function civisNoTile(state: GameState, tile: TileDeGrid, quem: string, dados: GameData): Unidade[] {
  const r: Unidade[] = [];
  for (const id of state.unidades.ordem) {
    if (id === quem) continue;
    const o = state.unidades.porId[id];
    if (o !== undefined && ehCivilQueOcupa(o, dados) && mesmoTile(tileOcupado(o), tile)) r.push(o);
  }
  return r;
}

const VIZINHOS_8: readonly TileDeGrid[] = [
  { gx: 0, gy: -1 }, { gx: 1, gy: -1 }, { gx: 1, gy: 0 }, { gx: 1, gy: 1 },
  { gx: 0, gy: 1 }, { gx: -1, gy: 1 }, { gx: -1, gy: 0 }, { gx: -1, gy: -1 },
];

/**
 * D-MOVIMENTO-01h — o custo de unidade na rota que o serf PLANEJA (o AVOID_UNIT_PENALTY do
 * KaM, `KM_PathFinding.pas:278-306`): cada tile com outro civil "fora" custa
 * `ticksPorUnidadeNaRota` a mais, uma vez por tile, como o `IsUnit` de la. Por estrada conta
 * qualquer um, andando ou parado; a pe, so quem esta parado (`PathfindingShouldAvoid`). E o que
 * faz a rua cheia perder para a paralela: o KaM nao sorteia nem alterna rota.
 * `undefined` com a chave desligada: a busca segue no cache, como sempre.
 */
export function custoDeUnidadesNaRota(
  state: GameState, quem: string, modo: ModoDeBusca, dados: GameData,
): ReadonlyMap<number, number> | undefined {
  if (!colisaoCivilLigada(dados)) return undefined;
  const { largura } = dados.terreno.mapaPadrao;
  const extra = dados.movimento.colisaoCivil.ticksPorUnidadeNaRota;
  const custo = new Map<number, number>();
  for (const id of state.unidades.ordem) {
    if (id === quem) continue;
    const o = state.unidades.porId[id];
    if (o === undefined || !ehCivilQueOcupa(o, dados)) continue;
    if (modo === 'livre' && (o.fsmData.caminho ?? []).length > 0) continue;
    custo.set(o.gy * largura + o.gx, extra);
  }
  return custo;
}

/**
 * I-MOVIMENTO-FILA-DE-CIVIS — a prioridade da PORTA: quem espera ha `ticksPrioridadeDaPorta` para
 * sair de casa no `tile` tem o tile dele, e ninguem mais larga para ali (D-MOVIMENTO-01j). Sem isto,
 * numa rua de fluxo continuo quem sai de casa esperava sem limite.
 */
function portaTemPrioridade(state: GameState, u: Unidade, tile: TileDeGrid, dados: GameData): boolean {
  const teto = dados.movimento.colisaoCivil.ticksPrioridadeDaPorta;
  for (const id of state.unidades.ordem) {
    if (id === u.id) continue;
    const x = state.unidades.porId[id];
    if (x !== undefined && x.saindo !== undefined && x.saindo >= teto && mesmoTile(x, tile) && classeDaUnidade(x.tipo, dados) === 'civil') return true;
  }
  return false;
}

function semEspera(d: DadosDaFsm): DadosDaFsm {
  const { bloqueado: _b, largada: _l, ...resto } = d;
  void _b;
  void _l;
  return resto;
}

/** A unidade sem `saindo` (o campo opcional da colisao). */
function semMarcas(u: Unidade): Unidade {
  const { saindo: _s, ...resto } = u;
  void _s;
  return resto;
}

/**
 * I-MOVIMENTO-FILA-DE-CIVIS — a LARGADA do civil, com a colisao ligada (o `Walk` do KaM reserva o
 * tile seguinte no INICIO do passo, `KM_UnitActionWalkTo.pas:1312`). Com `progresso` 0, o civil so
 * comeca o passo se o tile seguinte esta livre na ocupacao logica (`civisNoTile`), ou se a largada
 * em ciclo o marcou (`largada`, `sistemaDaLargadaEmCiclo`). Senao espera NO PROPRIO TILE, com o
 * progresso em 0, e conta a espera (`bloqueado`). Devolve a unidade esperando, ou `null` se larga.
 * Quem espera a porta (`saindo`) nao larga: `sistemaDaPorta` o libera.
 */
export function largadaCivil(state: GameState, u: Unidade, dados: GameData): Unidade | null {
  const proximo = u.fsmData.caminho?.[0];
  if (proximo === undefined) return null;
  const esperar = (): Unidade => ({ ...u, fsmData: { ...u.fsmData, progresso: 0, bloqueado: (u.fsmData.bloqueado ?? 0) + 1 } });
  if (u.saindo !== undefined) return { ...u, fsmData: { ...u.fsmData, progresso: 0 } };
  if (u.fsmData.largada === true) return null;
  if (portaTemPrioridade(state, u, proximo, dados)) return esperar();
  if (reservadoPorCiclo(state, u, proximo, dados)) return esperar();
  return civisNoTile(state, proximo, u.id, dados).length === 0 ? null : esperar();
}

/**
 * I-MOVIMENTO-FILA-DE-CIVIS — o tile para onde um civil do ciclo vai largar neste tick (`largada`)
 * ja e dele. Sem isto, quem esta atras de um do ciclo, processado entre os dois, via o tile vago por
 * um instante e largava junto (medido: dois no tile na vila pronta, tick 114).
 */
function reservadoPorCiclo(state: GameState, u: Unidade, tile: TileDeGrid, dados: GameData): boolean {
  for (const id of state.unidades.ordem) {
    if (id === u.id) continue;
    const x = state.unidades.porId[id];
    if (x === undefined || x.fsmData.largada !== true || !ehCivilQueOcupa(x, dados)) continue;
    const alvo = x.fsmData.caminho?.[0];
    if (alvo !== undefined && mesmoTile(alvo, tile)) return true;
  }
  return false;
}

/** I-MOVIMENTO-FILA-DE-CIVIS — os campos da espera saem quando o passo comeca. */
export function largou(d: DadosDaFsm): DadosDaFsm {
  return semEspera(d);
}

/**
 * I-MOVIMENTO-FILA-DE-CIVIS — o menor `progresso` valido: 0. A reserva do tile no inicio do passo
 * acabou com a divida da permuta (o progresso negativo de antes). E o que as invariantes conferem.
 */
export function menorProgresso(_dados: GameData): number {
  return 0;
}

/**
 * I-MOVIMENTO-FILA-DE-CIVIS — a LARGADA EM CICLO. Roda antes das FSMs. Para o civil parado na
 * largada (`progresso` 0, com caminho) cujo tile seguinte tem um civil tambem parado na largada,
 * segue a cadeia "quem ocupa o meu tile seguinte". Se ela volta a ele, e um ciclo (dois: de frente;
 * tres ou mais: a rotacao), e todos os do ciclo ganham `largada` e comecam o passo neste tick, cada
 * um com o passo inteiro: ninguem anda para tras, e ninguem ganha nem perde tempo. A cadeia que
 * termina num tile livre, num civil que ja anda ou num parado nao e ciclo: a fila espera. O
 * comprimento da cadeia e limitado pelo numero de unidades (cada passo visita uma nova).
 */
export function sistemaDaLargadaEmCiclo(state: GameState, dados: GameData): GameState {
  if (!colisaoCivilLigada(dados)) return state;
  let atual = state;
  const naLargada = (x: Unidade): boolean => (x.fsmData.caminho ?? []).length > 0 && (x.fsmData.progresso ?? 0) === 0
    && x.saindo === undefined && ehCivilQueOcupa(x, dados);
  const marcados = new Set<string>();
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || marcados.has(id) || !naLargada(u)) continue;
    const ciclo: Unidade[] = [u];
    const vistos = new Set<string>([u.id]);
    let cur = u;
    let fechou = false;
    for (;;) {
      const alvo = cur.fsmData.caminho?.[0] as TileDeGrid;
      const ocupantes = civisNoTile(atual, alvo, cur.id, dados);
      if (ocupantes.length !== 1) break;
      const o = ocupantes[0] as Unidade;
      if (o.id === u.id) { fechou = true; break; }
      if (vistos.has(o.id) || marcados.has(o.id) || !naLargada(o)) break;
      vistos.add(o.id);
      ciclo.push(o);
      cur = o;
    }
    if (!fechou || ciclo.length < 2) continue;
    const porId = { ...atual.unidades.porId };
    for (const x of ciclo) {
      porId[x.id] = { ...x, fsmData: { ...x.fsmData, largada: true } };
      marcados.add(x.id);
    }
    atual = { ...atual, unidades: { ...atual.unidades, porId } };
  }
  return atual;
}

/** O primeiro vizinho livre de `o` (vizinhanca 8 em ordem fixa), fora de `evitar`, na ocupacao logica. */
function vizinhoLivre(state: GameState, o: Unidade, evitar: TileDeGrid | null, dados: GameData): TileDeGrid | undefined {
  return VIZINHOS_8
    .map((d) => ({ gx: o.gx + d.gx, gy: o.gy + d.gy }))
    .find((t) => (evitar === null || !mesmoTile(t, evitar)) && passoAndavel(state, o, t, 'livre', dados)
      && civisNoTile(state, t, o.id, dados).length === 0 && !reservadoPorCiclo(state, o, t, dados));
}

/**
 * D-MOVIMENTO-01g — para onde vai o empurrado: o primeiro vizinho livre; sem vizinho livre,
 * o tile livre MAIS PERTO por busca em largura, na caixa de `margemDoDesvio` em volta dele
 * (o mesmo limite do desvio). A busca atravessa tile ocupado, mas nao para nele. Caso real
 * que a pede: na vila inicial, seis ociosos cercam a porta da escola, e o recem-treinado
 * ficava empilhado para sempre (PROGRESS, D-MOVIMENTO-01d).
 */
function lugarLivre(state: GameState, o: Unidade, evitar: TileDeGrid | null, dados: GameData): TileDeGrid | undefined {
  const perto = vizinhoLivre(state, o, evitar, dados);
  if (perto !== undefined) return perto;
  const m = dados.movimento.colisaoCivil.margemDoEmpurrao;
  const chave = (t: TileDeGrid): string => `${t.gx},${t.gy}`;
  const visto = new Set<string>([chave(o)]);
  const fila: TileDeGrid[] = [{ gx: o.gx, gy: o.gy }];
  for (let k = 0; k < fila.length; k += 1) {
    const aqui = fila[k] as TileDeGrid;
    for (const d of VIZINHOS_8) {
      const t = { gx: aqui.gx + d.gx, gy: aqui.gy + d.gy };
      if (Math.abs(t.gx - o.gx) > m || Math.abs(t.gy - o.gy) > m || visto.has(chave(t))) continue;
      visto.add(chave(t));
      if (!passoAndavel(state, aqui, t, 'livre', dados)) continue;
      if ((evitar === null || !mesmoTile(t, evitar)) && civisNoTile(state, t, o.id, dados).length === 0) return t;
      fila.push(t);
    }
  }
  return undefined;
}

function empurrar(state: GameState, o: Unidade, para: TileDeGrid): GameState {
  const movido: Unidade = { ...semMarcas(o), gx: para.gx, gy: para.gy };
  return { ...state, unidades: { ...state.unidades, porId: { ...state.unidades.porId, [o.id]: movido } } };
}

const parado = (u: Unidade): boolean => (u.fsmData.caminho ?? []).length === 0;

/**
 * I-MOVIMENTO-FILA-DE-CIVIS — o `fsmData` de um ocioso e vazio, ou e o PASSO DE LADO: um caminho de
 * no maximo um tile, o progresso dele e a espera da largada. E o predicado que as invariantes das
 * FSMs usam para o ocioso (o mesmo da sim, nao uma copia).
 */
export function ehPassoDeLado(d: DadosDaFsm): boolean {
  const permitidas = new Set(['caminho', 'progresso', 'bloqueado', 'largada']);
  return Object.keys(d).every((k) => permitidas.has(k)) && (d.caminho ?? []).length <= 1;
}

/** I-MOVIMENTO-FILA-DE-CIVIS — o passo de lado do ocioso: um caminho de UM tile, que ele anda pelo
 *  `andar` da FSM dele (`passoDeLado`, `units/movimento.ts`). Nunca teletransporte. */
function darPassoDeLado(state: GameState, o: Unidade, para: TileDeGrid, largada = false): GameState {
  const movido: Unidade = { ...semMarcas(o), fsmData: { ...o.fsmData, caminho: [para], progresso: 0, ...(largada ? { largada: true } : {}) } };
  return { ...state, unidades: { ...state.unidades, porId: { ...state.unidades.porId, [o.id]: movido } } };
}

/**
 * O EMPURRAO (o PUSH do KaM, `IntSolutionPush`, `KM_UnitActionWalkTo.pas:713`), so para o OCIOSO
 * parado, e andando. Na ordem de `unidades.ordem`, antes das FSMs:
 *  1. o ocioso parado no tile que um civil espera ha `ticksEmpurrar` ganha um passo de lado ate o
 *     vizinho livre (fora do tile de quem espera);
 *  2. o ocioso parado que divide o tile com outro civil (o empilhamento de fora do passo: a vila
 *     inicial nasce no spawn, fixture) vai ao tile livre mais perto NA HORA, como antes: e um estado
 *     que nao devia existir, e nao alguem andando. Fica no tile o primeiro que nao e ocioso, ou o
 *     primeiro de todos.
 * Sem vizinho livre no caso 1, o ocioso e quem espera trocam de lugar, andando (a largada dos dois).
 */
export function sistemaDoEmpurrao(state: GameState, dados: GameData): GameState {
  if (!colisaoCivilLigada(dados)) return state;
  let atual = state;
  for (const id of state.unidades.ordem) {
    const w = atual.unidades.porId[id];
    if (w === undefined || !ehCivilQueOcupa(w, dados) || (w.fsmData.bloqueado ?? 0) < dados.movimento.colisaoCivil.ticksEmpurrar) continue;
    const alvo = w.fsmData.caminho?.[0];
    if (alvo === undefined) continue;
    for (const o of civisNoTile(atual, alvo, w.id, dados)) {
      if (o.fsm !== EMPURRAVEL || !parado(o)) continue;
      const livre = vizinhoLivre(atual, o, w, dados);
      if (livre !== undefined) { atual = darPassoDeLado(atual, o, livre); continue; }
      // sem vizinho livre (a porta cercada): o ocioso e quem espera TROCAM de lugar, os dois andando,
      // como a troca de frente (medido: um serf esperou 1 000 ticks o ocioso parado na porta)
      if ((w.fsmData.progresso ?? 0) !== 0 || !passoAndavel(atual, o, w, 'livre', dados)) continue;
      const ocioso: Unidade = { ...semMarcas(o), fsmData: { ...o.fsmData, caminho: [{ gx: w.gx, gy: w.gy }], progresso: 0, largada: true } };
      const quemEspera: Unidade = { ...w, fsmData: { ...w.fsmData, largada: true } };
      atual = { ...atual, unidades: { ...atual.unidades, porId: { ...atual.unidades.porId, [o.id]: ocioso, [w.id]: quemEspera } } };
    }
  }
  return sistemaDoEmpilhamento(atual, dados);
}

/**
 * I-MOVIMENTO-FILA-DE-CIVIS — o caso 2 do empurrao, sozinho: o ocioso parado que divide o tile (na
 * ocupacao logica) com outro civil. Roda no empurrao, antes das FSMs (o estado montado entre dois
 * ticks), e de novo no FIM do tick, depois da porta: o par que se forma dentro do tick se desfaz antes
 * de o estado ser observado.
 */
export function sistemaDoEmpilhamento(state: GameState, dados: GameData, depoisDasFsms = false): GameState {
  if (!colisaoCivilLigada(dados)) return state;
  let atual = state;
  for (const id of state.unidades.ordem) {
    const o = atual.unidades.porId[id];
    if (o === undefined || o.fsm !== EMPURRAVEL || !parado(o) || !ehCivilFora(o, dados)) continue;
    // conta quem espera a porta (`saindo`) no tile, como antes: o ocioso parado na porta de quem quer
    // sair e o que trancava (medido: dois obreiros na porta do lenhador, 400 ticks)
    const noTile: Unidade[] = [];
    for (const outroId of atual.unidades.ordem) {
      const x = atual.unidades.porId[outroId];
      // a ocupacao LOGICA (`tileOcupado`): quem esta entrando no tile ja o tem (medido: serf injetado no
      // tile que outro reservou, no caos do F09)
      // quem ja tem a largada marcada esta saindo do tile neste tick: nao conta (medido: dois obreiros
      // que sairam da obra juntos, e o segundo era teleportado)
      if (x !== undefined && ehCivilFora(x, dados) && mesmoTile(tileOcupado(x), o) && x.fsmData.largada !== true) noTile.push(x);
    }
    if (noTile.length < 2) continue;
    // na porta de quem quer sair (`saindo`), quem sai tem o tile: o ocioso parado ali da um passo de
    // lado ANDANDO (medido: tres recem-treinados presos 1 000 ticks atras do ocioso na porta da escola)
    // o ocioso que saiu de dentro para a porta ocupada (`saindo`) nao tem o que esperar: sai do caminho
    const naPorta = o.saindo !== undefined || noTile.some((x) => x.saindo !== undefined);
    if (naPorta) {
      // depois das FSMs, quem espera a porta fica com o `sistemaDaPorta`: o passo de lado so comeca
      // na FSM, e marcado aqui ele ocuparia a porta no estado observado
      if (depoisDasFsms) continue;
      const lado = vizinhoLivre(atual, o, null, dados);
      // quem esperava a porta LARGA o passo de lado ja reservado (`largada`): sem isso voltava a
      // ocupar o tile da porta, que outro ja reservou (medido: o jogo livre travou no tick 82)
      if (lado !== undefined) { atual = darPassoDeLado(atual, o, lado, o.saindo !== undefined); continue; }
      // a porta cercada de ociosos, sem vizinho livre: o ultimo recurso de antes, o tile livre mais
      // perto (sem ele, quem sai nao sai nunca)
      const longe = lugarLivre(atual, o, null, dados);
      if (longe !== undefined) atual = empurrar(atual, o, longe);
      continue;
    }
    // o empilhado por NASCIMENTO (fixture, a vila inicial no spawn) se separa na hora, como antes:
    // nao e alguem andando na rua, e um estado que nao devia existir
    const fica = noTile.find((x) => x.fsm !== EMPURRAVEL) ?? (noTile[0] as Unidade);
    if (fica.id === o.id) continue;
    const livre = lugarLivre(atual, o, null, dados);
    if (livre !== undefined) atual = empurrar(atual, o, livre);
  }
  return atual;
}

/**
 * I-MOVIMENTO-FILA-DE-CIVIS — o PASSO COMECADO TERMINA (o KaM nao abandona o passo no meio:
 * `CanAbandonInternal`, `KM_UnitActionWalkTo.pas:334`). Roda depois das FSMs, comparando com `antes`.
 * O civil que estava no meio de um passo para T (e por isso ja ocupava T) e que a FSM tirou do passo
 * sem chegar (tarefa cancelada, replanejamento, ocioso) voltaria a ocupar o tile de onde saiu, que
 * outro ja pode ter reservado: o empilhamento medido. Aqui ele termina o passo ate T, com o progresso
 * que tinha, e o caminho novo da FSM segue de T: igual, se ja passava por T; direto, se o primeiro
 * tile dele e vizinho de T; senao, voltando pelo tile de onde saiu (raro: so o replanejamento que
 * vira a direcao no meio do passo).
 */
export function sistemaDoPassoComecado(antes: GameState, depois: GameState, dados: GameData): GameState {
  if (!colisaoCivilLigada(dados)) return depois;
  let atual = depois;
  for (const id of depois.unidades.ordem) {
    const a = antes.unidades.porId[id];
    if (a !== undefined) atual = comPassoComecadoTerminado(atual, a, dados);
  }
  return atual;
}

/**
 * O mesmo, para UMA unidade, logo depois do passo da FSM dela (`sistemaDosSerfs` e os irmaos), antes
 * da unidade seguinte: senao quem vem depois ve o tile que ela soltou e larga para la, e o passo
 * restaurado no fim do tick a poe junto dele (medido no caos do F09). `antes` e a unidade antes do
 * passo da FSM.
 */
export function comPassoComecadoTerminado(state: GameState, antes: Unidade, dados: GameData): GameState {
  if (!colisaoCivilLigada(dados)) return state;
  const u = state.unidades.porId[antes.id];
  if (u === undefined || !ehCivilQueOcupa(antes, dados) || !ehCivilQueOcupa(u, dados)) return state;
  const t = antes.fsmData.caminho?.[0];
  const progresso = antes.fsmData.progresso ?? 0;
  if (t === undefined || progresso <= 0 || mesmoTile(u, t) || !mesmoTile(u, antes) || mesmoTile(tileOcupado(u), t)) return state;
  const vizinho = (a: TileDeGrid, b: TileDeGrid): boolean => Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy)) === 1;
  const novo = u.fsmData.caminho ?? [];
  const resto = novo.length === 0 ? []
    : mesmoTile(novo[0] as TileDeGrid, t) ? novo.slice(1)
      : vizinho(novo[0] as TileDeGrid, t) ? novo
        : [{ gx: u.gx, gy: u.gy }, ...novo];
  // o custo do passo pode ter mudado (estrada assentada no meio dele): o progresso fica abaixo dele
  const teto = custoDoPasso(state.estradas, u, t, dados) - 1;
  const termina: Unidade = { ...u, fsmData: { ...u.fsmData, caminho: [t, ...resto], progresso: Math.max(1, Math.min(progresso, teto)) } };
  return { ...state, unidades: { ...state.unidades, porId: { ...state.unidades.porId, [u.id]: termina } } };
}

/** D-MOVIMENTO-01c (empilhamento de fora do passo) — contadores da porta, FORA do estado (o molde de `estatisticasDeBusca` do A*):
 *  medida da sessao, nunca regra. `saidas` e quem ganhou `saindo`; `somaDeEspera` e
 *  `maiorEspera` em ticks; `noTeto` e quem esperou ate o teto (e ganhou a prioridade). */
const porta = { saidas: 0, somaDeEspera: 0, maiorEspera: 0, noTeto: 0 };
export function estatisticasDaPorta(): Readonly<typeof porta> {
  return { ...porta };
}
export function zerarEstatisticasDaPorta(): void {
  porta.saidas = 0;
  porta.somaDeEspera = 0;
  porta.maiorEspera = 0;
  porta.noTeto = 0;
}

/**
 * D-MOVIMENTO-01c (empilhamento de fora do passo) — a PORTA (o `GoInOut` do KaM: quem sai de casa espera a porta vagar). Roda depois
 * das FSMs e das escolas, comparando com `antes` (o estado de entrada das FSMs):
 *  - o civil que NASCEU neste tick, ou passou de "dentro" para "fora", num tile com outro
 *    civil que ocupa, ganha `saindo: 0`;
 *  - quem ja estava `saindo`: com o tile livre, sai (o campo some); senao conta mais um
 *    tick. D-MOVIMENTO-01j: nao ha saida forcada; no teto, `ticksPrioridadeDaPorta`, ganha a
 *    prioridade do tile (`portaTemPrioridade`) e sai quando o ocupante sair.
 */
export function sistemaDaPorta(antes: GameState, depois: GameState, dados: GameData): GameState {
  if (!colisaoCivilLigada(dados)) return depois;
  let atual = depois;
  const teto = dados.movimento.colisaoCivil.ticksPrioridadeDaPorta;
  for (const id of depois.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || classeDaUnidade(u.tipo, dados) !== 'civil') continue;
    const ocupantes = civisNoTile(atual, u, u.id, dados);
    let novo: Unidade | null = null;
    if (u.saindo !== undefined) {
      const espera = u.saindo + 1;
      // D-MOVIMENTO-01j — sem saida forcada: espera o tile vagar. No teto ganha a prioridade
      // (`portaTemPrioridade`): ninguem mais larga para ali, e o ocupante sai
      if (ocupantes.length === 0) {
        porta.somaDeEspera += u.saindo;
        porta.maiorEspera = Math.max(porta.maiorEspera, u.saindo);
        if (u.saindo >= teto) porta.noTeto += 1;
        novo = semMarcas(u);
      } else novo = { ...u, saindo: espera };
    } else {
      const eraAntes = antes.unidades.porId[id];
      const saiu = eraAntes === undefined || (POSICAO_DO_ESTADO[eraAntes.fsm] === 'dentro' && ocupaTile(u));
      if (saiu && ocupaTile(u) && ocupantes.length > 0) {
        porta.saidas += 1;
        novo = { ...u, saindo: 0 };
      }
    }
    if (novo !== null) atual = { ...atual, unidades: { ...atual.unidades, porId: { ...atual.unidades.porId, [id]: novo } } };
  }
  return atual;
}
