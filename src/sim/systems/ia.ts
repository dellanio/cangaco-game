/**
 * F28-IA, pontos 1 a 3 — a DEFESA da IA (plano em docs/planos/2026-09-28-A12-F28-IA-defesa.md).
 *
 * A cada tick, para cada lado com IA (`state.ia`), na ordem das chaves ordenadas:
 *  1. GUARNECER — o militar ocioso sem posicao entra na primeira posicao do tipo dele
 *     com vaga (frente antes de tras), ate `combate.ia.tamanhoDoGrupo` (9);
 *  2. VOLTAR AO PONTO — o membro ocioso fora do seu tile (o i-esimo de `tilesDoGrupo`)
 *     marcha ate ele;
 *  3. DEFENDER E RETALIAR — alvo e, primeiro, quem esta atacando um membro (retaliar,
 *     mesmo fora do raio); senao, o inimigo mais perto do ponto DENTRO do raio. Os
 *     membros corpo a corpo que nao estao lutando saem para ele; o atirador se vira para
 *     ele e atira sozinho (`systems/combate.ts`). Inimigo fora do raio, que nao ataca
 *     ninguem, nao tira ninguem do lugar; o membro que persegue quem saiu do raio (e nao
 *     o ataca) larga e volta.
 *
 * C-IA-01 (IA alimentar tropas; e a C-COMIDA-01e, antes F28-IA ponto 5) — depois de
 * defender, para cada posicao: se NINGUEM dela esta lutando e o mais faminto esta abaixo
 * do limiar do CIVIL (`limiares.civilVaiComer`, decisao do operador 2026-09-29, e nao os
 * 6/45 do KaM `KM_AIGeneral.pas:316-327`), a IA da `FeedUnits` aos membros. So quando
 * algum membro de fato pediria (`vaiPedirComida`): sem isso, seria um `sem-fome` por tick.
 * C-IA-02c: a SOBRA (os militares do lado fora de posicao) e alimentada do mesmo jeito, como
 * um grupo so. O KaM alimenta todo grupo da IA, nao so o da posicao (`TKMGeneral.CheckArmy`,
 * KM_AIGeneral.pas:306-327). O andaime L8 saiu: `condicao.iaDrena` e true desde a C-IA-02c.
 *
 * C-IA-02b (prefeito minimo) — depois de alimentar, no tick da revisao, e tambem em paz
 * (o KaM treina em paz): os pedidos de `pedidosDoPrefeito` (`sim/prefeito.ts`) viram o
 * mesmo `EnqueueTraining` do jogador, dado pela IA.
 *
 * A IA ignora a nevoa (decisao do operador; KM_HandsCollection.pas:523-567). Ela da as
 * mesmas ordens que o jogador daria — o estado da unidade e o mesmo de `MoveUnits` e
 * `AttackUnit` —, so que sem comando: e a IA, nao o jogador, quem as emite.
 */
import type { GameEvent, GameState, IADoLado, PosicaoDeDefesa, Unidade } from '../state';
import { ehQuartelCompleto } from '../quartel';
import { caixaDoPredio } from '../footprint';
import { FSM_INDO_ATACAR } from './cerco';
import { aplicarTrainSoldier, motivoParaFormar } from './quartel';
import type { ResultadoDeSistema } from './jobs';
import type { GameData } from '../data/types';
import { classeDaUnidade } from '../condicao';
import { aplicarFeedUnits, vaiPedirComida } from './alimentar';
import { emPaz } from '../paz';
import { direcaoEntre, distanciaEmTiles } from '../combate';
import { hpMaximoDoTipo } from '../vida';
import { intrusos, posicaoDoMembro, tipoDeGrupo } from '../ia';
import { comUnidade } from '../units/movimento';
import { FSM_MARCHANDO, tilesDoGrupo } from './marcha';
import { FSM_ATIRANDO, FSM_INDO_LUTAR, FSM_LUTANDO } from './combate';
import { aplicarEnqueueTraining } from './escolas';
import { ehTickDaRevisao, pedidosDoPrefeito } from '../prefeito';

const lutando = (u: Unidade): boolean => u.fsm === FSM_INDO_LUTAR || u.fsm === FSM_LUTANDO || u.fsm === FSM_ATIRANDO;

function comIA(state: GameState, lado: string, ia: IADoLado): GameState {
  return { ...state, ia: { ...state.ia, [lado]: ia } };
}

/** C-IA-01 — alimentar um grupo (a posicao ou, C-IA-02c, a sobra): ninguem lutando, o mais
 *  faminto abaixo do limiar do civil (em ticks do militar) e alguem que pediria. Os membros
 *  sao os VIVOS entre `ids`. */
function alimentarGrupo(state: GameState, ids: readonly string[], dados: GameData): ResultadoDeSistema {
  const membros = ids.map((id) => state.unidades.porId[id]).filter((u): u is Unidade => u !== undefined);
  if (membros.length === 0 || membros.some(lutando)) return { state, events: [] };
  const limiar = dados.condicao.ticksNoLimiar.militar.civilVaiComer;
  if (Math.min(...membros.map((u) => u.condicao)) >= limiar) return { state, events: [] };
  if (!membros.some((u) => vaiPedirComida(u, dados))) return { state, events: [] };
  return aplicarFeedUnits(state, { type: 'FeedUnits', unidades: membros.map((u) => u.id) }, dados);
}

/** 1. guarnecer: as posicoes na ordem frente -> tras, e dentro da linha a da lista. */
function guarnecer(state: GameState, lado: number, ia: IADoLado, dados: GameData): IADoLado {
  const tamanho = dados.combate.ia.tamanhoDoGrupo;
  const posicoes = ia.posicoes.map((p) => ({ ...p, membros: p.membros.filter((id) => state.unidades.porId[id] !== undefined) }));
  const ordem = [...posicoes.keys()].sort((a, b) => {
    const la = posicoes[a]?.linha === 'frente' ? 0 : 1;
    const lb = posicoes[b]?.linha === 'frente' ? 0 : 1;
    return la - lb || a - b;
  });
  for (const id of state.unidades.ordem) {
    const u = state.unidades.porId[id];
    if (u === undefined || u.lado !== lado || u.fsm !== 'ocioso' || classeDaUnidade(u.tipo, dados) !== 'militar') continue;
    if (posicaoDoMembro(posicoes, id) !== null) continue;
    const tipo = tipoDeGrupo(u.tipo, dados);
    const i = ordem.find((k) => {
      const p = posicoes[k];
      return p !== undefined && p.tipoDeGrupo === tipo && p.membros.length < tamanho;
    });
    const p = i === undefined ? undefined : posicoes[i];
    if (i !== undefined && p !== undefined) posicoes[i] = { ...p, membros: [...p.membros, id] };
  }
  return { posicoes };
}

/** O alvo da posicao: quem ataca um membro (retaliar), senao o intruso mais perto do ponto. */
function alvoDaPosicao(state: GameState, p: PosicaoDeDefesa, lado: number, dados: GameData): Unidade | null {
  const temHp = (u: Unidade): boolean => hpMaximoDoTipo(u.tipo, dados) !== null;
  const membros = new Set(p.membros);
  for (const id of state.unidades.ordem) {
    const u = state.unidades.porId[id];
    if (u === undefined || u.lado === lado || !temHp(u)) continue;
    const alvo = u.fsmData.alvoUnidade;
    if (alvo !== undefined && membros.has(alvo) && lutando(u)) return u;
  }
  return intrusos(state, p, lado, temHp)[0] ?? null;
}

function defenderEPosicionar(state: GameState, p: PosicaoDeDefesa, lado: number, dados: GameData): GameState {
  let atual = state;
  const alvo = alvoDaPosicao(atual, p, lado, dados);
  const tiles = tilesDoGrupo(atual, p.ponto, dados.combate.ia.tamanhoDoGrupo, dados);
  p.membros.forEach((id, i) => {
    const u = atual.unidades.porId[id];
    if (u === undefined) return;
    if (alvo !== null) {
      if (tipoDeGrupo(u.tipo, dados) === 'distancia') {
        // o atirador se vira para o alvo (a IA posiciona e vira) e atira sozinho
        const direcao = direcaoEntre(u, alvo);
        if (direcao !== null && direcao !== u.direcao && !lutando(u)) atual = comUnidade(atual, { ...u, direcao });
        return;
      }
      if (!lutando(u)) {
        atual = comUnidade(atual, { ...u, fsm: FSM_INDO_LUTAR, fsmData: { alvoUnidade: alvo.id } });
      }
      return;
    }
    // sem alvo: quem persegue alguem que saiu do raio larga; quem esta ocioso volta
    if (u.fsm === FSM_INDO_LUTAR || u.fsm === FSM_LUTANDO) {
      const perseguido = u.fsmData.alvoUnidade === undefined ? undefined : atual.unidades.porId[u.fsmData.alvoUnidade];
      if (perseguido === undefined || distanciaEmTiles(p.ponto, perseguido) > p.raio) {
        atual = comUnidade(atual, { ...u, fsm: 'ocioso', fsmData: {} });
      }
      return;
    }
    const meu = tiles[Math.min(i, tiles.length - 1)];
    if (u.fsm === 'ocioso' && meu !== undefined && (u.gx !== meu.gx || u.gy !== meu.gy)) {
      atual = comUnidade(atual, { ...u, fsm: FSM_MARCHANDO, fsmData: { caminho: [], progresso: 0, alvoTile: meu } });
    }
  });
  return atual;
}

/**
 * F28-IA, ponto 4 — REPOR pelo quartel: a posicao com menos de `tamanhoDoGrupo` membros
 * pede UM soldado por tick ao primeiro quartel completo do lado. O tipo e o mais forte que
 * o quartel consegue formar agora (C8: `combat.json: ia.ordemDeTreino`, a ordem do KaM). E o mesmo `TrainSoldier` do
 * jogador, dado pela IA; o soldado novo nasce ocioso e o `guarnecer` do tick seguinte o
 * poe na posicao. Sem quartel, sem requisito ou sem recruta, a posicao espera.
 */
function reporPeloQuartel(
  state: GameState, lado: number, ia: IADoLado, dados: GameData,
): ResultadoDeSistema {
  const quartel = state.predios.ordem
    .map((id) => state.predios.porId[id])
    .find((p) => ehQuartelCompleto(p) && p.lado === lado);
  if (quartel === undefined) return { state, events: [] };
  let atual = state;
  const events: GameEvent[] = [];
  for (const p of ia.posicoes) {
    if (p.membros.length >= dados.combate.ia.tamanhoDoGrupo) continue;
    // C8: o mais forte que o quartel consegue formar agora, na ordem do KaM
    // (`combat.json: ia.ordemDeTreino`, o AI_TROOP_TRAIN_ORDER), pela MESMA regra do comando
    const ordem: readonly string[] = (dados.combate.ia.ordemDeTreino as Readonly<Record<string, readonly string[]>>)[p.tipoDeGrupo] ?? [];
    const tipo = ordem.find((t) => tipoDeGrupo(t, dados) === p.tipoDeGrupo && motivoParaFormar(atual, quartel.id, t, dados) === null);
    if (tipo === undefined) continue;
    const r = aplicarTrainSoldier(atual, { type: 'TrainSoldier', predio: quartel.id, tipo }, dados);
    atual = r.state;
    events.push(...r.events);
  }
  return { state: atual, events };
}

/**
 * F28-IA, ponto 6 — o ATAQUE repetido. Os militares ociosos do lado que NAO sao membros
 * de posicao (a sobra depois do `guarnecer`) sao a forca de ataque. Com
 * `tamanhoDoGrupo` (9) ou mais deles, todos recebem a mesma ordem de ataque ao predio
 * de OUTRO lado mais perto do centro deles (distancia euclidiana ao tile mais perto do
 * footprint; no empate, a ordem de `predios.ordem`). E o estado do `AttackBuilding` do
 * jogador, dado pela IA. Caido o predio, eles voltam a ociosos, e no tick seguinte,
 * se ainda forem 9, atacam o proximo: e isso o "repetido".
 */
function atacarComASobra(state: GameState, lado: number, ia: IADoLado, dados: GameData): GameState {
  const livres = state.unidades.ordem
    .map((id) => state.unidades.porId[id])
    .filter((u): u is Unidade => u !== undefined && u.lado === lado && u.fsm === 'ocioso'
      && classeDaUnidade(u.tipo, dados) === 'militar' && posicaoDoMembro(ia.posicoes, u.id) === null);
  if (livres.length < dados.combate.ia.tamanhoDoGrupo) return state;
  const centro = {
    gx: Math.round(livres.reduce((s, u) => s + u.gx, 0) / livres.length),
    gy: Math.round(livres.reduce((s, u) => s + u.gy, 0) / livres.length),
  };
  // C8: o mais perto entre os PRIORITARIOS (a IA nova do KaM: quartel, armazem, escola,
  // prefeitura); sem nenhum de pe, qualquer predio de outro lado
  const prioritarios = new Set<string>(dados.combate.ia.alvosPrioritarios);
  const maisPerto = (serve: (tipo: string) => boolean): { id: string; d: number } | null => {
    let melhor: { id: string; d: number } | null = null;
    for (const id of state.predios.ordem) {
      const p = state.predios.porId[id];
      if (p === undefined || p.lado === lado || !serve(p.tipo)) continue;
      const c = caixaDoPredio(p, dados);
      if (c === null) continue;
      const perto = { gx: Math.min(Math.max(centro.gx, c.x0), c.x1 - 1), gy: Math.min(Math.max(centro.gy, c.y0), c.y1 - 1) };
      const d = distanciaEmTiles(centro, perto);
      if (melhor === null || d < melhor.d) melhor = { id, d };
    }
    return melhor;
  };
  const alvo = maisPerto((t) => prioritarios.has(t)) ?? maisPerto(() => true);
  if (alvo === null) return state;
  let atual = state;
  for (const u of livres) atual = comUnidade(atual, { ...u, fsm: FSM_INDO_ATACAR, fsmData: { alvo: alvo.id } });
  return atual;
}

/** `tick` e o numero do tick que este `step` produz (o `state.tick` ainda e o anterior). */
export function sistemaDaIA(state: GameState, dados: GameData, tick: number): ResultadoDeSistema {
  if (state.ia === undefined) return { state, events: [] };
  let atual = state;
  const events: GameEvent[] = [];
  for (const chave of Object.keys(state.ia).sort()) {
    const ia = atual.ia?.[chave];
    if (ia === undefined) continue;
    const lado = Number(chave);
    const guarnecida = guarnecer(atual, lado, ia, dados);
    atual = comIA(atual, chave, guarnecida);
    // C-IA-03b: em paz a IA nao defende, nao repoe e nao ataca (KaM: KM_AIGeneral.pas:218,
    // 331, 395). Guarnecer e alimentar continuam: nao sao ordem de combate.
    const paz = emPaz(atual);
    if (!paz) for (const p of guarnecida.posicoes) atual = defenderEPosicionar(atual, p, lado, dados);
    const sobra = atual.unidades.ordem.filter((id) => {
      const u = atual.unidades.porId[id];
      return u !== undefined && u.lado === lado && classeDaUnidade(u.tipo, dados) === 'militar'
        && posicaoDoMembro(guarnecida.posicoes, id) === null;
    });
    for (const grupo of [...guarnecida.posicoes.map((p) => p.membros), sobra]) {
      const alimentada = alimentarGrupo(atual, grupo, dados);
      atual = alimentada.state;
      events.push(...alimentada.events);
    }
    if (ehTickDaRevisao(tick, dados)) {
      for (const pedido of pedidosDoPrefeito(atual, lado, dados)) {
        const r = aplicarEnqueueTraining(atual, { type: 'EnqueueTraining', ...pedido }, dados);
        atual = r.state;
        events.push(...r.events);
      }
    }
    if (paz) continue;
    const reposto = reporPeloQuartel(atual, lado, guarnecida, dados);
    atual = reposto.state;
    events.push(...reposto.events);
    atual = atacarComASobra(atual, lado, guarnecida, dados);
  }
  return { state: atual, events };
}
