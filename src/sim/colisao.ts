/**
 * D1 — a colisao civil (GDD §6.4, revisto em 2026-09-28; plano em
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
 * ocupa. `fora` ocupa o tile. Esquecer um estado aqui e travamento, e por isso o teste do D1a
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

/** Civil que ocupa tile: quem a colisao civil ve. */
export function ehCivilQueOcupa(u: Unidade, dados: GameData): boolean {
  return classeDaUnidade(u.tipo, dados) === 'civil' && ocupaTile(u);
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

function semEspera(d: DadosDaFsm): DadosDaFsm {
  const { bloqueado: _b, trocaCom: _t, ...resto } = d;
  void _b;
  void _t;
  return resto;
}

/**
 * O passo COMPLETO de um civil com a colisao ligada (o `andar` ja acumulou o progresso).
 * `custo` e o custo do passo, para segurar o passo em `custo - 1` enquanto espera.
 */
export function passoCivil(state: GameState, u: Unidade, custo: number, dados: GameData): Unidade {
  const caminho = u.fsmData.caminho ?? [];
  const proximo = caminho[0] as TileDeGrid;
  const entrar = (trocaCom: string | null, d: DadosDaFsm = u.fsmData): Unidade => ({
    ...u, gx: proximo.gx, gy: proximo.gy,
    fsmData: { ...semEspera(d), caminho: caminho.slice(1), progresso: 0, ...(trocaCom === null ? {} : { trocaCom }) },
  });
  const ocupantes = civisNoTile(state, proximo, u.id, dados);
  if (ocupantes.length === 0) return entrar(null);
  // a TROCA de frente (IntSolutionExchange, espera 0): todos os ocupantes vem para o meu tile
  if (ocupantes.every((o) => { const p = o.fsmData.caminho?.[0]; return p !== undefined && mesmoTile(p, u); })) {
    return entrar((ocupantes[0] as Unidade).id);
  }
  const c = dados.movimento.colisaoCivil;
  const bloqueado = (u.fsmData.bloqueado ?? 0) + 1;
  // a troca FORCADA (WAITING_TIMEOUT): o teto da espera
  if (bloqueado >= c.ticksTrocaForcada) return entrar((ocupantes[0] as Unidade).id);
  // o DESVIO (AVOID): em `ticksDesviar` e a cada `ticksRepetirDesvio`; o contador segue
  if (caminho.length > 1 && bloqueado >= c.ticksDesviar && (bloqueado - c.ticksDesviar) % c.ticksRepetirDesvio === 0) {
    const contorno = desvioCivil(state, u, caminho, dados);
    if (contorno !== null && contorno.length > 0) {
      return { ...u, fsmData: { ...u.fsmData, caminho: [...contorno], progresso: 0, bloqueado } };
    }
  }
  return { ...u, fsmData: { ...u.fsmData, progresso: custo - 1, bloqueado } };
}

/**
 * O EMPURRAO (IntSolutionPush): o civil ocioso e parado no tile que um civil bloqueado ha
 * `ticksEmpurrar` quer vai ao primeiro vizinho livre (vizinhanca 8 em ordem fixa, unidades na
 * ordem de `unidades.ordem`). Roda antes das FSMs. Sem vizinho livre, fica: a troca forcada
 * de quem espera resolve.
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
      if (o.fsm !== EMPURRAVEL || (o.fsmData.caminho ?? []).length > 0) continue;
      const livre = VIZINHOS_8
        .map((d) => ({ gx: o.gx + d.gx, gy: o.gy + d.gy }))
        .find((t) => !mesmoTile(t, w) && passoAndavel(atual, o, t, 'livre', dados) && civisNoTile(atual, t, o.id, dados).length === 0);
      if (livre === undefined) continue;
      atual = { ...atual, unidades: { ...atual.unidades, porId: { ...atual.unidades.porId, [o.id]: { ...o, gx: livre.gx, gy: livre.gy } } } };
    }
  }
  return atual;
}
