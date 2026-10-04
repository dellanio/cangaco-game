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

/** Os civis "fora" no tile, menos `quem`, na ordem de `unidades.ordem`. */
export function civisNoTile(state: GameState, tile: TileDeGrid, quem: string, dados: GameData): Unidade[] {
  const r: Unidade[] = [];
  for (const id of state.unidades.ordem) {
    if (id === quem) continue;
    const o = state.unidades.porId[id];
    if (o !== undefined && mesmoTile(o, tile) && ehCivilQueOcupa(o, dados)) r.push(o);
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

/** O desvio anda so por estrada quando o caminho que ele substitui e todo de estrada. */
function modoDoDesvio(state: GameState, u: Unidade, caminho: readonly TileDeGrid[]): ModoDeBusca {
  const naEstrada = (t: TileDeGrid): boolean => state.estradas[`${t.gx},${t.gy}`] === true;
  return naEstrada(u) && caminho.every(naEstrada) ? 'estrada' : 'livre';
}

/**
 * O desvio (AVOID do KaM): busca em largura do tile atual ao destino que trata como
 * bloqueados o tile seguinte e os civis PARADOS (quem anda nao pesa, como no
 * `PathfindingShouldAvoid`), numa caixa com `margemDoDesvio` de folga. Vizinhanca 8 em ordem
 * fixa: deterministico. Devolve o caminho sem o tile atual, ou `null`.
 */
function desvioCivil(state: GameState, u: Unidade, caminho: readonly TileDeGrid[], dados: GameData): readonly TileDeGrid[] | null {
  const destino = caminho[caminho.length - 1] as TileDeGrid;
  const chave = (t: TileDeGrid): string => `${t.gx},${t.gy}`;
  const bloqueado = new Set<string>([chave(caminho[0] as TileDeGrid)]);
  for (const id of state.unidades.ordem) {
    const o = state.unidades.porId[id];
    if (o !== undefined && id !== u.id && ehCivilQueOcupa(o, dados) && (o.fsmData.caminho ?? []).length === 0) bloqueado.add(chave(o));
  }
  bloqueado.delete(chave(destino));
  const modo = modoDoDesvio(state, u, caminho);
  const m = dados.movimento.colisaoCivil.margemDoDesvio;
  const x0 = Math.min(u.gx, destino.gx) - m;
  const x1 = Math.max(u.gx, destino.gx) + m;
  const y0 = Math.min(u.gy, destino.gy) - m;
  const y1 = Math.max(u.gy, destino.gy) + m;
  const veio = new Map<string, TileDeGrid | null>([[chave(u), null]]);
  const fila: TileDeGrid[] = [{ gx: u.gx, gy: u.gy }];
  for (let k = 0; k < fila.length; k += 1) {
    const aqui = fila[k] as TileDeGrid;
    if (mesmoTile(aqui, destino)) {
      const r: TileDeGrid[] = [];
      for (let t: TileDeGrid | null = aqui; t !== null && chave(t) !== chave(u); t = veio.get(chave(t)) ?? null) r.unshift(t);
      return r;
    }
    for (const d of VIZINHOS_8) {
      const t = { gx: aqui.gx + d.gx, gy: aqui.gy + d.gy };
      if (t.gx < x0 || t.gx > x1 || t.gy < y0 || t.gy > y1 || veio.has(chave(t)) || bloqueado.has(chave(t))) continue;
      if (!passoAndavel(state, aqui, t, modo, dados)) continue;
      veio.set(chave(t), aqui);
      fila.push(t);
    }
  }
  return null;
}

/**
 * D-MOVIMENTO-01g — a PRIORIDADE de quem ja passou da troca forcada: ninguem mais entra no
 * tile que ele quer. Sem isto, numa porta com fluxo continuo, pares novos se formavam a cada
 * vez que o anterior se desfazia, e ele esperava sem limite (medido: 24 ticks na porta de uma
 * serraria, carga 4x). Entre dois acima do teto, cede quem espera ha MENOS tempo, e no empate
 * quem vem depois em `unidades.ordem`: ordem total, entao um deles sempre anda.
 */
function cedeAQuemEspera(state: GameState, u: Unidade, tile: TileDeGrid, dados: GameData): boolean {
  const teto = dados.movimento.colisaoCivil.ticksTrocaForcada;
  const minha = u.fsmData.bloqueado ?? 0;
  const minhaOrdem = state.unidades.ordem.indexOf(u.id);
  for (let k = 0; k < state.unidades.ordem.length; k += 1) {
    const id = state.unidades.ordem[k] as string;
    if (id === u.id) continue;
    const x = state.unidades.porId[id];
    if (x === undefined) continue;
    // D-MOVIMENTO-01j — quem espera a porta ha `teto` ticks tem o tile dela: sem a saida
    // forcada, e so assim que ele sai de uma porta com fluxo continuo
    if (x.saindo !== undefined && x.saindo >= teto && mesmoTile(x, tile) && classeDaUnidade(x.tipo, dados) === 'civil') return true;
    if (!ehCivilQueOcupa(x, dados)) continue;
    const espera = x.fsmData.bloqueado ?? 0;
    const alvo = x.fsmData.caminho?.[0];
    if (espera < teto || alvo === undefined || !mesmoTile(alvo, tile)) continue;
    if (espera > minha || (espera === minha && k < minhaOrdem)) return true;
  }
  return false;
}

function semEspera(d: DadosDaFsm): DadosDaFsm {
  const { bloqueado: _b, ...resto } = d;
  void _b;
  return resto;
}

/** A unidade sem `saindo` (o campo opcional da colisao). */
function semMarcas(u: Unidade): Unidade {
  const { saindo: _s, ...resto } = u;
  void _s;
  return resto;
}

/**
 * O passo COMPLETO de um civil com a colisao ligada (o `andar` ja acumulou o progresso).
 * `custo` e o custo do passo, para segurar o passo em `custo - 1` enquanto espera.
 * D-MOVIMENTO-01j — aqui o civil so entra em tile VAZIO. A troca com quem anda e permuta, e
 * mora em `sistemaDaPermuta`, antes das FSMs, porque mexe em duas unidades.
 */
export function passoCivil(state: GameState, u: Unidade, custo: number, dados: GameData): Unidade {
  const caminho = u.fsmData.caminho ?? [];
  const proximo = caminho[0] as TileDeGrid;
  // quem espera a porta nao anda: `sistemaDaPorta` libera quando o tile vagar
  if (u.saindo !== undefined) return { ...u, fsmData: { ...u.fsmData, progresso: custo - 1 } };
  const c = dados.movimento.colisaoCivil;
  const bloqueado = (u.fsmData.bloqueado ?? 0) + 1;
  const segurar = (): Unidade => ({ ...u, fsmData: { ...u.fsmData, progresso: custo - 1, bloqueado } });
  if (cedeAQuemEspera(state, u, proximo, dados)) return segurar();
  if (civisNoTile(state, proximo, u.id, dados).length === 0) {
    return { ...semMarcas(u), gx: proximo.gx, gy: proximo.gy, fsmData: { ...semEspera(u.fsmData), caminho: caminho.slice(1), progresso: 0 } };
  }
  // o DESVIO (AVOID): em `ticksDesviar` e a cada `ticksRepetirDesvio`; o contador segue
  if (caminho.length > 1 && bloqueado >= c.ticksDesviar && (bloqueado - c.ticksDesviar) % c.ticksRepetirDesvio === 0) {
    const contorno = desvioCivil(state, u, caminho, dados);
    if (contorno !== null && contorno.length > 0) {
      return { ...u, fsmData: { ...u.fsmData, caminho: [...contorno], progresso: 0, bloqueado } };
    }
  }
  return segurar();
}

/**
 * D-MOVIMENTO-01j — a PERMUTA (IntSolutionExchange e a troca do WAITING_TIMEOUT do KaM): os
 * dois mudam de tile no mesmo tick, e nunca ha dois civis num tile. Roda antes das FSMs,
 * depois do empurrao, na ordem de `unidades.ordem`. Para o civil que anda, cujo passo vence
 * neste tick, e cujo tile seguinte tem EXATAMENTE UM civil que tambem anda:
 *  - de frente: o outro vem para o meu tile; cada um avanca o seu caminho;
 *  - forcada: chego a `ticksTrocaForcada` e o outro nao vem para ca (esta preso tambem); ele
 *    volta um passo, e o caminho dele ganha o tile de onde saiu.
 * O outro tem de poder pisar no meu tile no modo dele. Cada unidade permuta no maximo uma vez
 * por tick. A PRIORIDADE de quem passou do teto (`cedeAQuemEspera`) NAO vale aqui: ela e para
 * entrar em tile vazio. Medido (porta de 10 ticks, carga 2x): com ela bloqueando a permuta, quem
 * sai da porta e quem espera de frente para entrar ficavam presos um contra o outro, porque um
 * terceiro com mais espera queria aquele tile — e a vila parou.
 *
 * I-MOVIMENTO-COLISAO-CIVIL-LIGADA — o TEMPO da permuta e exato (`progressoDaPermuta`). De frente,
 * cada um entra no tile do outro com o progresso que tinha, menos o custo do passo, mais a espera
 * (`bloqueado`): quem estava no meio do passo entra DEVENDO o resto dele, e quem estava segurado ja
 * tinha terminado o passo, e o tempo segurado e progresso do seguinte. Menos 1, porque o `andar`
 * deste mesmo tick ainda soma. O defeito medido (2026-09-29): de frente em 20 tiles, um chegava em
 * 95 ticks, contra 100 sozinho (ganhava o resto do passo do outro e o tick do `andar`). Na forcada,
 * quem entra nao ganha o tick do `andar` e a espera nao vira progresso (foi espera de verdade); o
 * outro volta e recomeca o passo.
 */
/**
 * I-MOVIMENTO-COLISAO-CIVIL-LIGADA — o menor `progresso` valido de uma unidade: 0, e com a
 * colisao civil ligada, menos DOIS maiores passos a pe do dado: a divida de quem entrou pela
 * permuta de frente no meio do passo (`progressoDaPermuta`), que encadeia uma vez so (quem deve
 * mais que um passo nao permuta de novo). E o que as invariantes da FSM conferem.
 */
export function menorProgresso(dados: GameData): number {
  return colisaoCivilLigada(dados) ? -2 * maiorPassoAPe(dados) : 0;
}

/** O maior passo a pe do dado (a diagonal mais cara). */
function maiorPassoAPe(dados: GameData): number {
  return Math.max(...Object.values(dados.movimento.ticksPorTileDiagonal.aPe));
}

/**
 * O progresso de quem entra no tile seguinte pela permuta (ver `sistemaDaPermuta`): o que tinha,
 * menos o custo do passo (o progresso que sobra do passo, ou o que ainda deve dele), mais a espera
 * quando ela conta, menos o 1 que o `andar` deste tick soma. Teto: o passo seguinte nao vence neste
 * tick, para ninguem andar dois tiles num tick so. Quem chegou ao fim do caminho fica em 0.
 */
function progressoDaPermuta(state: GameState, u: Unidade, caminho: readonly TileDeGrid[], contaEspera: boolean, dados: GameData): number {
  const [entra, depois] = caminho;
  if (entra === undefined || depois === undefined) return 0;
  const custo = custoDoPasso(state.estradas, u, entra, dados);
  const espera = contaEspera ? (u.fsmData.bloqueado ?? 0) : 0;
  return Math.min((u.fsmData.progresso ?? 0) - custo + espera, custoDoPasso(state.estradas, entra, depois, dados) - 2);
}

export function sistemaDaPermuta(state: GameState, dados: GameData): GameState {
  if (!colisaoCivilLigada(dados)) return state;
  const teto = dados.movimento.colisaoCivil.ticksTrocaForcada;
  const permutou = new Set<string>();
  let atual = state;
  const anda = (x: Unidade): boolean => (x.fsmData.caminho ?? []).length > 0;
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || permutou.has(id) || !ehCivilQueOcupa(u, dados) || !anda(u)) continue;
    const caminho = u.fsmData.caminho as readonly TileDeGrid[];
    const proximo = caminho[0] as TileDeGrid;
    if ((u.fsmData.progresso ?? 0) + 1 < custoDoPasso(atual.estradas, u, proximo, dados)) continue;
    const ocupantes = civisNoTile(atual, proximo, u.id, dados);
    if (ocupantes.length !== 1) continue;
    const o = ocupantes[0] as Unidade;
    if (permutou.has(o.id) || !anda(o)) continue;
    const caminhoDele = o.fsmData.caminho as readonly TileDeGrid[];
    // a divida encadeia uma vez so: quem ja deve mais que um passo nao permuta de novo de frente
    // (espera pagar). Sem teto, a divida nao tinha fundo (medido: -13 na suite, dois passos); sem
    // encadear nenhuma, a coluna de frente esperava 11 ticks na rua de um tile, contra 3
    const deFrente = mesmoTile(caminhoDele[0] as TileDeGrid, u) && (o.fsmData.progresso ?? 0) >= -maiorPassoAPe(dados);
    const forcada = !deFrente && (u.fsmData.bloqueado ?? 0) + 1 >= teto;
    if (!deFrente && !forcada) continue;
    if (!passoAndavel(atual, o, u, modoDoDesvio(atual, o, caminhoDele), dados)) continue;
    const eu: Unidade = { ...u, gx: proximo.gx, gy: proximo.gy, fsmData: { ...semEspera(u.fsmData), caminho: caminho.slice(1), progresso: progressoDaPermuta(atual, u, caminho, deFrente, dados) } };
    const ele: Unidade = deFrente
      ? { ...o, gx: u.gx, gy: u.gy, fsmData: { ...semEspera(o.fsmData), caminho: caminhoDele.slice(1), progresso: progressoDaPermuta(atual, o, caminhoDele, true, dados) } }
      : { ...o, gx: u.gx, gy: u.gy, fsmData: { ...o.fsmData, caminho: [{ gx: o.gx, gy: o.gy }, ...caminhoDele], progresso: 0 } };
    atual = { ...atual, unidades: { ...atual.unidades, porId: { ...atual.unidades.porId, [eu.id]: eu, [ele.id]: ele } } };
    permutou.add(eu.id);
    permutou.add(ele.id);
  }
  return atual;
}

/** O primeiro vizinho livre de `o` (vizinhanca 8 em ordem fixa), fora de `evitar`. */
function vizinhoLivre(state: GameState, o: Unidade, evitar: TileDeGrid | null, dados: GameData): TileDeGrid | undefined {
  return VIZINHOS_8
    .map((d) => ({ gx: o.gx + d.gx, gy: o.gy + d.gy }))
    .find((t) => (evitar === null || !mesmoTile(t, evitar)) && passoAndavel(state, o, t, 'livre', dados)
      && civisNoTile(state, t, o.id, dados).length === 0);
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
  const m = dados.movimento.colisaoCivil.margemDoDesvio;
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
 * O EMPURRAO (IntSolutionPush), com duas causas, na ordem de `unidades.ordem`:
 *  1. o civil ocioso e parado no tile que um civil bloqueado ha `ticksEmpurrar` quer;
 *  2. (D-MOVIMENTO-01c, empilhamento de fora do passo) o civil ocioso e parado que divide o tile com outro civil: o
 *     empilhamento que nasce fora do passo (fixture, obra que termina, porta). Fica no tile
 *     o primeiro que nao e ocioso, ou o primeiro de todos.
 * O empurrado vai ao tile livre mais perto (`lugarLivre`). Roda antes das FSMs.
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
      const livre = lugarLivre(atual, o, w, dados);
      if (livre !== undefined) atual = empurrar(atual, o, livre);
    }
  }
  for (const id of state.unidades.ordem) {
    const o = atual.unidades.porId[id];
    if (o === undefined || o.fsm !== EMPURRAVEL || !parado(o) || !ehCivilFora(o, dados)) continue;
    const noTile: Unidade[] = [];
    for (const outroId of atual.unidades.ordem) {
      const x = atual.unidades.porId[outroId];
      if (x !== undefined && mesmoTile(x, o) && ehCivilFora(x, dados)) noTile.push(x);
    }
    if (noTile.length < 2) continue;
    const fica = noTile.find((x) => x.fsm !== EMPURRAVEL) ?? (noTile[0] as Unidade);
    if (fica.id === o.id) continue;
    const livre = lugarLivre(atual, o, null, dados);
    if (livre !== undefined) atual = empurrar(atual, o, livre);
  }
  return atual;
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
 *    tick. D-MOVIMENTO-01j: nao ha saida forcada; no teto, `ticksTrocaForcada`, ganha a
 *    prioridade do tile (`cedeAQuemEspera`) e sai quando o ocupante sair.
 */
export function sistemaDaPorta(antes: GameState, depois: GameState, dados: GameData): GameState {
  if (!colisaoCivilLigada(dados)) return depois;
  let atual = depois;
  const teto = dados.movimento.colisaoCivil.ticksTrocaForcada;
  for (const id of depois.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || classeDaUnidade(u.tipo, dados) !== 'civil') continue;
    const ocupantes = civisNoTile(atual, u, u.id, dados);
    let novo: Unidade | null = null;
    if (u.saindo !== undefined) {
      const espera = u.saindo + 1;
      // D-MOVIMENTO-01j — sem saida forcada: espera o tile vagar. No teto ganha a prioridade
      // (`cedeAQuemEspera`): ninguem mais entra ali, e o ocupante sai
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
