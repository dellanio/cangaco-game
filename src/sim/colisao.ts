/**
 * D-MOVIMENTO-01 — a colisao civil (GDD §6.4, revisto em 2026-09-28; plano em
 * docs/planos/2026-09-28-D1-colisao-civil.md). O mecanismo e o do `WalkTo` do kam_remake:
 * a colisao se resolve NO PASSO, nao no A*. Quem vem de frente troca de lugar; o ocioso no
 * caminho e empurrado; passada uma espera, o bloqueado contorna os parados; passada a espera
 * longa, entra no tile ocupado. Ninguem espera alem de `ticksTrocaForcada`.
 *
 * Tudo aqui so age com `colisaoCivil.ligada`. Desligada, nenhum campo novo nasce e o
 * estado fica igual, byte a byte.
 */
import type { GameData } from './data/types';
import type { DadosDaFsm, GameState, Unidade } from './state';
import type { TileDeGrid } from './estradas';
import { passoAndavel } from './pathfinding';
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
 * D-MOVIMENTO-01g — o teto da espera que a invariante confere: a troca forcada mais o maior
 * passo do dado. A troca e de DUAS unidades, entao quem chega ao teto com um par no tile
 * espera o par se desfazer, e o par dura no maximo um passo (o parceiro que sai completa o
 * passo dele). Derivado do dado, nunca digitado.
 */
export function tetoDaEspera(dados: GameData): number {
  return dados.movimento.colisaoCivil.ticksTrocaForcada + Math.max(...Object.values(dados.movimento.ticksPorTileDiagonal.aPe));
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
    if (x === undefined || !ehCivilQueOcupa(x, dados)) continue;
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

/** A unidade sem `trocaCom` e sem `saindo` (os dois campos opcionais da colisao). */
function semMarcas(u: Unidade): Unidade {
  const { trocaCom: _t, saindo: _s, ...resto } = u;
  void _t;
  void _s;
  return resto;
}

/**
 * O passo COMPLETO de um civil com a colisao ligada (o `andar` ja acumulou o progresso).
 * `custo` e o custo do passo, para segurar o passo em `custo - 1` enquanto espera.
 */
export function passoCivil(state: GameState, u: Unidade, custo: number, dados: GameData): Unidade {
  const caminho = u.fsmData.caminho ?? [];
  const proximo = caminho[0] as TileDeGrid;
  // D-MOVIMENTO-01c (empilhamento de fora do passo) — quem espera a porta nao anda: `sistemaDaPorta` libera quando o tile vagar
  if (u.saindo !== undefined) return { ...u, fsmData: { ...u.fsmData, progresso: custo - 1 } };
  const entrar = (trocaCom: string | null): Unidade => ({
    ...semMarcas(u), gx: proximo.gx, gy: proximo.gy,
    fsmData: { ...semEspera(u.fsmData), caminho: caminho.slice(1), progresso: 0 },
    ...(trocaCom === null ? {} : { trocaCom }),
  });
  const c = dados.movimento.colisaoCivil;
  const segurar = (): Unidade => ({ ...u, fsmData: { ...u.fsmData, progresso: custo - 1, bloqueado: (u.fsmData.bloqueado ?? 0) + 1 } });
  if (cedeAQuemEspera(state, u, proximo, dados)) return segurar();
  const ocupantes = civisNoTile(state, proximo, u.id, dados);
  if (ocupantes.length === 0) return entrar(null);
  // D-MOVIMENTO-01g — a troca e entre DUAS unidades, como no KaM (uma por tile): so com
  // exatamente um ocupante. Com dois (um par ja em troca), espera: entrar faria tres num
  // tile, e o `trocaCom` do terceiro apontaria para quem sai primeiro.
  const unico = ocupantes.length === 1 ? (ocupantes[0] as Unidade) : null;
  // a TROCA de frente (IntSolutionExchange, espera 0): o ocupante vem para o meu tile
  const vemPraCa = (o: Unidade): boolean => { const p = o.fsmData.caminho?.[0]; return p !== undefined && mesmoTile(p, u); };
  if (unico !== null && vemPraCa(unico)) return entrar(unico.id);
  const bloqueado = (u.fsmData.bloqueado ?? 0) + 1;
  // a troca FORCADA (WAITING_TIMEOUT): o teto da espera, tambem so com um ocupante
  if (unico !== null && bloqueado >= c.ticksTrocaForcada) return entrar(unico.id);
  // o DESVIO (AVOID): em `ticksDesviar` e a cada `ticksRepetirDesvio`; o contador segue
  if (caminho.length > 1 && bloqueado >= c.ticksDesviar && (bloqueado - c.ticksDesviar) % c.ticksRepetirDesvio === 0) {
    const contorno = desvioCivil(state, u, caminho, dados);
    if (contorno !== null && contorno.length > 0) {
      return { ...u, fsmData: { ...u.fsmData, caminho: [...contorno], progresso: 0, bloqueado } };
    }
  }
  return { ...u, fsmData: { ...u.fsmData, progresso: custo - 1, bloqueado } };
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
 *  2. (D-MOVIMENTO-01c, empilhamento de fora do passo) o civil ocioso e parado que divide o tile com outro civil fora de troca: o
 *     empilhamento que nasce fora do passo (fixture, obra que termina, porta). Fica no tile
 *     o primeiro que nao e ocioso, ou o primeiro de todos.
 * O empurrado vai ao primeiro vizinho livre. Sem vizinho livre, fica: a troca forcada de
 * quem espera resolve. Roda antes das FSMs.
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
    // D-MOVIMENTO-01g — o `trocaCom` NAO protege o ocioso: ele nao tem por que dividir tile
    const livre = lugarLivre(atual, o, null, dados);
    if (livre !== undefined) atual = empurrar(atual, o, livre);
  }
  return atual;
}

/** D-MOVIMENTO-01c (empilhamento de fora do passo) — contadores da porta, FORA do estado (o molde de `estatisticasDeBusca` do A*):
 *  medida da sessao, nunca regra. `saidas` e quem ganhou `saindo`; `somaDeEspera` e
 *  `maiorEspera` em ticks; `noTeto` e quem saiu pela troca forcada. */
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
 *    tick; no teto, `ticksTrocaForcada`, sai em troca com o ocupante, como todo bloqueado.
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
      if (ocupantes.length === 0 || (espera >= teto && ocupantes.length === 1)) {
        porta.somaDeEspera += u.saindo;
        porta.maiorEspera = Math.max(porta.maiorEspera, u.saindo);
        if (ocupantes.length > 0) porta.noTeto += 1;
      }
      if (ocupantes.length === 0) novo = semMarcas(u);
      // D-MOVIMENTO-01g — sai em troca so com UM ocupante; com um par na porta, segue esperando
      else if (espera >= teto && ocupantes.length === 1) novo = { ...semMarcas(u), trocaCom: (ocupantes[0] as Unidade).id };
      else novo = { ...u, saindo: espera };
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
