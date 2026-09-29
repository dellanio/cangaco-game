/**
 * F-CERCO-a2 — a tropa ataca predio, POR ORDEM (`AttackBuilding`).
 *
 * Regras do KaM que o operador mandou usar (BUILD_PLAN, F-CERCO-a):
 * - corpo a corpo tira `combate.ataqueAPredio.danoCorpoACorpo` por golpe, SEM
 *   sorteio: attack e defence nao entram (`KM_UnitTaskAttackHouse.pas:191-192`);
 * - a cadencia e a PROPRIA do golpe em predio (`ataqueAPredio.ticksCadencia`), nunca a
 *   `ticksCadenciaDeAtaque` das unidades, que e dobrada para compensar o HP dobrado
 *   delas — o predio nao tem HP dobrado;
 * - obra inacabada cai mais rapido de graca: o `hp` da obra JA e o HP martelado, e o
 *   golpe subtrai dele (vida = progresso - dano, `KM_Houses.pas:1175`);
 * - a ordem e explicita. Nenhum ramo daqui escolhe alvo: soldado ocioso encostado em
 *   predio inimigo nao faz nada (`KM_UnitWarrior.pas:940-962`).
 *
 * A tropa recebe ordem DIRETA (CLAUDE.md §1): nao passa pelo JobBoard, nao reclama nem
 * reserva nada. O predio que chega a zero sai pelo mesmo caminho da demolicao
 * (`semOPredio`); o saneamento do MESMO tick libera tarefas e ocupante, porque este
 * sistema roda antes dele (`tick.ts`).
 */
import type { Command } from '../commands';
import type { GameEvent, GameState, MotivoDeRecusaDeAtaque, Predio, Unidade } from '../state';
import type { GameData } from '../data/types';
import type { TileDeGrid } from '../estradas';
import { classeDaUnidade } from '../condicao';
import { cadenciaDoTiro, distanciaEmTiles, ehADistancia } from '../combate';
import { semRetomar } from './combate';
import { caixaDoPredio } from '../footprint';
import { buscarCaminho, passoAndavel, tileAndavel } from '../pathfinding';
import { andar, comPredio, comUnidade, noTile, ocioso } from '../units/movimento';
import { semOPredio } from './demolicao';
import { soltarRecrutas } from './quartel';
import type { ResultadoDeSistema } from './jobs';

export type AttackBuilding = Extract<Command, { readonly type: 'AttackBuilding' }>;

export const FSM_INDO_ATACAR = 'indo_atacar';
export const FSM_ATACANDO = 'atacando';

const semEventos = (state: GameState): ResultadoDeSistema => ({ state, events: [] });

/** F28d — a distancia (euclidiana, em tiles) da unidade ao tile mais perto do footprint. */
function distanciaAoPredio(u: TileDeGrid, predio: Predio, dados: GameData): number | null {
  const c = caixaDoPredio(predio, dados);
  if (c === null) return null;
  const gx = Math.min(Math.max(u.gx, c.x0), c.x1 - 1);
  const gy = Math.min(Math.max(u.gy, c.y0), c.y1 - 1);
  return distanciaEmTiles(u, { gx, gy });
}

/** De onde esta unidade golpeia o predio: encostada (corpo a corpo) ou, F28d, no
 *  alcance do tiro (de `aDistancia.alcanceMinimo_tiles` a `alcanceMaximo_tiles`). */
function emPosicaoDeAtaque(u: Unidade, predio: Predio, dados: GameData): boolean {
  if (!ehADistancia(u.tipo, dados)) return encostado(u, predio, dados);
  const d = distanciaAoPredio(u, predio, dados);
  const { alcanceMinimo_tiles: min, alcanceMaximo_tiles: max } = dados.combate.aDistancia;
  return d !== null && d >= min && d <= max;
}

/** A primeira recusa do comando, ou `null`. A ordem das perguntas e a do texto do
 *  comando: predio, lista, e cada unidade em ordem. */
export function motivoDaRecusaDeAtaque(
  state: GameState, comando: AttackBuilding, dados: GameData,
): { readonly motivo: MotivoDeRecusaDeAtaque; readonly unidade: string | null } | null {
  const predio = state.predios.porId[comando.predio];
  if (predio === undefined) return { motivo: 'predio-inexistente', unidade: null };
  if (comando.unidades.length === 0) return { motivo: 'sem-unidades', unidade: null };
  for (const id of comando.unidades) {
    const u = state.unidades.porId[id];
    if (u === undefined) return { motivo: 'unidade-inexistente', unidade: id };
    if (classeDaUnidade(u.tipo, dados) !== 'militar') return { motivo: 'unidade-nao-militar', unidade: id };
    if (u.lado === predio.lado) return { motivo: 'predio-do-proprio-lado', unidade: id };
  }
  return null;
}

export function aplicarAttackBuilding(
  state: GameState, comando: AttackBuilding, dados: GameData,
): ResultadoDeSistema {
  const recusa = motivoDaRecusaDeAtaque(state, comando, dados);
  if (recusa !== null) {
    return {
      state,
      events: [{
        type: 'command-rejected', command: 'AttackBuilding', predio: comando.predio,
        unidade: recusa.unidade, motivo: recusa.motivo,
      }],
    };
  }
  let atual = state;
  // `new Set`: a mesma unidade duas vezes na lista e UMA ordem, nao duas
  for (const id of new Set(comando.unidades)) {
    const u = atual.unidades.porId[id];
    if (u === undefined) continue;
    // o caminho e planejado no primeiro tick do sistema, de onde a unidade estiver
    atual = comUnidade(atual, { ...semRetomar(u), fsm: FSM_INDO_ATACAR, fsmData: { alvo: comando.predio } });
  }
  return semEventos(atual);
}

/** O anel de tiles em volta do footprint (distancia de Chebyshev 1), andaveis, em
 *  varredura de linha: de onde se golpeia o predio. F28d: para quem atira, a coroa de
 *  tiles andaveis no alcance do tiro. */
function anelDeAtaque(state: GameState, predio: Predio, dados: GameData, aDistancia = false): readonly TileDeGrid[] {
  const c = caixaDoPredio(predio, dados);
  if (c === null) return [];
  if (aDistancia) {
    const { alcanceMinimo_tiles: min, alcanceMaximo_tiles: max } = dados.combate.aDistancia;
    const raio = Math.ceil(max);
    const coroa: TileDeGrid[] = [];
    for (let gy = c.y0 - raio; gy < c.y1 + raio; gy += 1) {
      for (let gx = c.x0 - raio; gx < c.x1 + raio; gx += 1) {
        const d = distanciaAoPredio({ gx, gy }, predio, dados);
        if (d !== null && d >= min && d <= max && tileAndavel(state, { gx, gy }, 'livre', dados)) coroa.push({ gx, gy });
      }
    }
    return coroa;
  }
  const anel: TileDeGrid[] = [];
  for (let gy = c.y0 - 1; gy <= c.y1; gy += 1) {
    for (let gx = c.x0 - 1; gx <= c.x1; gx += 1) {
      const dentro = gx >= c.x0 && gx < c.x1 && gy >= c.y0 && gy < c.y1;
      if (!dentro && tileAndavel(state, { gx, gy }, 'livre', dados)) anel.push({ gx, gy });
    }
  }
  return anel;
}

function encostado(u: Unidade, predio: Predio, dados: GameData): boolean {
  const c = caixaDoPredio(predio, dados);
  if (c === null) return false;
  const dx = u.gx < c.x0 ? c.x0 - u.gx : u.gx >= c.x1 ? u.gx - (c.x1 - 1) : 0;
  const dy = u.gy < c.y0 ? c.y0 - u.gy : u.gy >= c.y1 ? u.gy - (c.y1 - 1) : 0;
  return Math.max(dx, dy) === 1;
}

/** O alvo da ordem, se ainda vale: existe e e de outro lado. */
function alvoDaOrdem(state: GameState, u: Unidade): Predio | null {
  const id = u.fsmData.alvo;
  const predio = id === undefined ? undefined : state.predios.porId[id];
  return predio === undefined || predio.lado === u.lado ? null : predio;
}

/** A recarga do proximo golpe em predio: a do golpe (`ataqueAPredio`) para quem luta de
 *  perto; a do projetil (C1: recarga + mira + sorteio no RNG) para quem atira. */
function recargaContraPredio(state: GameState, u: Unidade, dados: GameData): { readonly ticks: number; readonly state: GameState } {
  if (!ehADistancia(u.tipo, dados)) return { ticks: dados.combate.ataqueAPredio.ticksCadencia, state };
  const c = cadenciaDoTiro(u.tipo, state.rng, dados);
  return { ticks: c.ticks, state: { ...state, rng: c.rng } };
}

function comecarAGolpear(state: GameState, u: Unidade, dados: GameData): GameState {
  const r = recargaContraPredio(state, u, dados);
  return comUnidade(r.state, {
    ...u, fsm: FSM_ATACANDO,
    fsmData: { alvo: u.fsmData.alvo as string, recarga: r.ticks },
  });
}

/** BUG-Q — alguma OUTRA unidade parada (sem caminho a andar) ocupa o tile? */
function paradoNoTile(state: GameState, tile: TileDeGrid, quem: string): boolean {
  for (const id of state.unidades.ordem) {
    if (id === quem) continue;
    const o = state.unidades.porId[id];
    if (o !== undefined && o.gx === tile.gx && o.gy === tile.gy && (o.fsmData.caminho ?? []).length === 0) return true;
  }
  return false;
}

function passoIndoAtacar(state: GameState, u: Unidade, dados: GameData): ResultadoDeSistema {
  const alvo = alvoDaOrdem(state, u);
  if (alvo === null) return semEventos(comUnidade(state, ocioso(u)));
  if (emPosicaoDeAtaque(u, alvo, dados)) return semEventos(comecarAGolpear(state, u, dados));

  let atual = u;
  const caminho = u.fsmData.caminho;
  const proximo = caminho?.[0];
  const bloqueado = proximo !== undefined && !passoAndavel(state, noTile(u), proximo, 'livre', dados);
  // BUG-Q: o tile do anel que ele mira foi tomado por um colega que chegou antes e parou:
  // replaneja para um que siga livre, em vez de esperar atras dele para sempre
  const destino = caminho?.[caminho.length - 1];
  const destinoTomado = destino !== undefined && paradoNoTile(state, destino, u.id);
  if (caminho === undefined || caminho.length === 0 || bloqueado || destinoTomado) {
    // BUG-Q: o A* ignora unidades, entao o anel inteiro devolveria o tile que um colega ja
    // ocupa golpeando, e a colisao militar (C5) segura este soldado ali perto para sempre.
    // Mira so os tiles do anel sem ninguem PARADO; com o anel todo tomado, mira o anel inteiro
    // e espera, como antes.
    const anel = anelDeAtaque(state, alvo, dados, ehADistancia(u.tipo, dados));
    const livres = anel.filter((t) => !paradoNoTile(state, t, u.id));
    const rota = buscarCaminho(state, noTile(u), livres.length > 0 ? livres : anel, 'livre', dados);
    if (rota === null) return semEventos(comUnidade(state, ocioso(u)));
    atual = { ...u, fsmData: { alvo: alvo.id, caminho: rota.tiles, progresso: 0 } };
    if (rota.tiles.length === 0) return semEventos(comecarAGolpear(state, atual, dados));
  }
  const andou = andar(state, atual, dados);
  if (emPosicaoDeAtaque(andou, alvo, dados)) {
    return semEventos(comecarAGolpear(state, andou, dados));
  }
  return semEventos(comUnidade(state, andou));
}

function passoAtacando(state: GameState, u: Unidade, dados: GameData): ResultadoDeSistema {
  const alvo = alvoDaOrdem(state, u);
  if (alvo === null) return semEventos(comUnidade(state, ocioso(u)));
  if (!emPosicaoDeAtaque(u, alvo, dados)) {
    return semEventos(comUnidade(state, { ...u, fsm: FSM_INDO_ATACAR, fsmData: { alvo: alvo.id } }));
  }
  // F28d: a flecha tira `danoProjetil` (1), sem sorteio, como o golpe (`rolagem: false`)
  const { danoCorpoACorpo, danoProjetil, ticksCadencia } = dados.combate.ataqueAPredio;
  const dano = ehADistancia(u.tipo, dados) ? danoProjetil : danoCorpoACorpo;
  const recarga = (u.fsmData.recarga ?? ticksCadencia) - 1;
  if (recarga > 0) return semEventos(comUnidade(state, { ...u, fsmData: { alvo: alvo.id, recarga } }));

  const hp = Math.max(0, alvo.hp - dano);
  const golpe: GameEvent = { type: 'building-attacked', predio: alvo.id, unidade: u.id, dano: alvo.hp - hp, hp };
  if (hp > 0) {
    const r = recargaContraPredio(comPredio(state, { ...alvo, hp }), u, dados);
    return { state: comUnidade(r.state, { ...u, fsmData: { alvo: alvo.id, recarga: r.ticks } }), events: [golpe] };
  }
  // hp zero: o predio sai pelo caminho da demolicao, SEM devolucao (PARA REVISAO:
  // no KaM a casa destruida se perde). O evento e o mesmo da demolicao, com a perda
  // declarada (`armazem: null`), para quem ouve nao precisar de um segundo canal.
  // C3: os recrutas de dentro do quartel voltam ao mapa, nao se perdem
  const solto = soltarRecrutas(state, alvo, dados);
  const s = { ...solto, predios: semOPredio(solto.predios, alvo.id) };
  return {
    state: comUnidade(s, ocioso(u)),
    events: [golpe, { type: 'building-demolished', predio: alvo.id, tipo: alvo.tipo, devolvido: {}, armazem: null }],
  };
}

/**
 * Um tick da tropa com ordem de ataque, em `unidades.ordem`. So toca em unidade nos
 * dois estados da ordem; o resto (ocioso inclusive) passa intocado — e isso que faz
 * "sem ordem, nenhum golpe" ser verdade por construcao.
 */
export function sistemaDoCerco(state: GameState, dados: GameData): ResultadoDeSistema {
  let atual = state;
  const events: GameEvent[] = [];
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined) continue;
    let passo: ResultadoDeSistema | null = null;
    if (u.fsm === FSM_INDO_ATACAR) passo = passoIndoAtacar(atual, u, dados);
    else if (u.fsm === FSM_ATACANDO) passo = passoAtacando(atual, u, dados);
    if (passo === null) continue;
    atual = passo.state;
    events.push(...passo.events);
  }
  return { state: atual, events };
}
