/**
 * F-CERCO-a2 — a tropa ataca predio, por ordem (BUILD_PLAN, F-CERCO-a; plano em
 * docs/planos/2026-09-28-A5-F-CERCO-a2.md).
 *
 * Os cinco aceites do item, na ordem em que estao escritos:
 *  1. N soldados com a ordem tiram exatamente 2 x golpes do `hp`; o predio chega a 0 e
 *     some, e as invariantes do JobBoard continuam valendo;
 *  2. soldado encostado T ticks num predio inimigo, SEM a ordem, nao tira HP nenhum;
 *  3. obra com `hp` h cai em ceil(h/2) golpes, menos que o mesmo predio completo;
 *  4. ordem contra predio do proprio lado e recusada, e o estado fica igual;
 *  5. a mesma corrida duas vezes da o mesmo estado.
 *
 * O soldado nasce por fixture (a F25 e quem o cria em partida), e o predio inimigo e
 * de lado 1, posto pelo `completarObra`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import {
  completarObra, createInitialState, LADO_DO_JOGADOR,
} from '../src/sim/state';
import type { GameEvent, GameState, Predio, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Command } from '../src/sim/commands';
import { canPlace } from '../src/sim/placement';
import { caixaDoPredio } from '../src/sim/footprint';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { FSM_ATACANDO } from '../src/sim/systems/cerco';
import { naVila } from './helpers/ancoras';
import { cenarioDePedreira } from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const INIMIGO = LADO_DO_JOGADOR + 1;
const ALVO = 'schoolhouse'; // sem trabalhador e sem insumo com a fila vazia: nenhuma tarefa o procura
const { danoCorpoACorpo: DANO, ticksCadencia: CADENCIA } = gameData.combate.ataqueAPredio;
const HP_DO_ALVO = gameData.predios.find((p) => p.id === ALVO)?.hp as number;

function lugarLivre(s: GameState, tipo: string): { gx: number; gy: number } {
  // a busca destrava o tipo: a posicao e o que importa, nao a arvore de construcao
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'woodcutters', 'sawmill', 'quarry', 'schoolhouse'])] };
  for (let r = 4; r < 30; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const p = naVila(d, r);
      if (canPlace(busca, tipo, p.gx, p.gy, gameData).ok) return p;
    }
  }
  throw new Error(`fixture: nenhum lugar livre para '${tipo}'`);
}

function comPredioInimigo(s: GameState, id: string, estado: 'completo' | 'obra', hp: number): GameState {
  const { gx, gy } = lugarLivre(s, ALVO);
  const obra = { lado: INIMIGO, id, tipo: ALVO, gx, gy, estado: 'obra' as const, hp, obra: { faltam: {}, nivelamento: 0 } };
  const predio: Predio = estado === 'completo' ? completarObra({ ...obra, hp: HP_DO_ALVO }, gameData) : obra;
  return { ...s, predios: { porId: { ...s.predios.porId, [id]: predio }, ordem: [...s.predios.ordem, id] } };
}

/** Soldados `militia` de lado 0, em tiles andaveis a `distancia` do predio, em fila. */
function comSoldados(s: GameState, predio: string, n: number, distancia: number): GameState {
  const c = caixaDoPredio(s.predios.porId[predio] as Predio, gameData);
  if (c === null) throw new Error('fixture: predio sem caixa');
  const unidades = { porId: { ...s.unidades.porId }, ordem: [...s.unidades.ordem] };
  let colocados = 0;
  for (let gx = c.x0 - 3; gx < c.x1 + 3 && colocados < n; gx += 1) {
    const t = { gx, gy: c.y1 - 1 + distancia };
    if (!tileAndavel(s, t, 'livre', gameData)) continue;
    const u: Unidade = {
      lado: LADO_DO_JOGADOR, id: `sold${colocados + 1}`, tipo: 'militia', gx: t.gx, gy: t.gy,
      fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia'),
    };
    unidades.porId[u.id] = u;
    unidades.ordem.push(u.id);
    colocados += 1;
  }
  if (colocados < n) throw new Error(`fixture: so coube ${colocados} soldado(s)`);
  return { ...s, unidades };
}

const semCivis = (s: GameState): GameState => ({ ...s, unidades: { porId: {}, ordem: [] } });
const ordem = (unidades: readonly string[], predio: string): Command => ({ type: 'AttackBuilding', unidades, predio });
const golpesEm = (events: readonly GameEvent[], predio: string) =>
  events.filter((e): e is Extract<GameEvent, { type: 'building-attacked' }> => e.type === 'building-attacked' && e.predio === predio);

interface Corrida { readonly final: GameState; readonly golpes: number; readonly tickDaQueda: number | null; readonly violacoes: string[] }

/** Da a ordem no primeiro tick e anda ate o predio cair ou o teto. Confere, A CADA
 *  TICK, que `hp = hp0 - DANO x golpes` enquanto ele esta de pe, e as invariantes. */
function correr(inicial: GameState, soldados: readonly string[], predio: string, teto: number): Corrida {
  const hp0 = (inicial.predios.porId[predio] as Predio).hp;
  let s = step(inicial, [ordem(soldados, predio)], gameData);
  let golpes = 0;
  const violacoes: string[] = [];
  for (let t = 0; t < teto; t += 1) {
    golpes += golpesEm(s.events, predio).length;
    const p = s.predios.porId[predio];
    if (p === undefined) return { final: s, golpes, tickDaQueda: s.tick, violacoes };
    if (p.hp !== hp0 - DANO * golpes) violacoes.push(`tick ${s.tick}: hp ${p.hp}, esperado ${hp0 - DANO * golpes}`);
    violacoes.push(...violacoesDeInvariantes(s, gameData).map((v) => `tick ${s.tick}: ${v}`));
    s = step(s, [], gameData);
  }
  return { final: s, golpes, tickDaQueda: null, violacoes };
}

describe('F-CERCO-a2 — a tropa ataca predio, por ordem', () => {
  const vila = comPredioInimigo(createInitialState(1), 'inimigo', 'completo', HP_DO_ALVO);

  it('a cadencia do golpe em predio e a propria, e nao a das unidades', () => {
    // 1,2 s na escala 1,0 (derivado do KaM, combat.json), convertido UMA vez no loader
    // com a escala `combate` de time.json — o teste nao digita o numero de ticks
    expect(CADENCIA).toBeGreaterThan(0);
    expect(CADENCIA).not.toBe(gameData.combate.ticksCadenciaDeAtaque);
    expect(DANO).toBe(2);
  });

  it('(1) tres soldados tiram exatamente 2 x golpes, o predio cai e some, e o JobBoard fica sao', () => {
    const s0 = comSoldados(vila, 'inimigo', 3, 5);
    const r = correr(s0, ['sold1', 'sold2', 'sold3'], 'inimigo', 3000);
    expect(r.violacoes).toEqual([]);
    expect(r.tickDaQueda, 'o predio deveria cair').not.toBeNull();
    expect(r.golpes).toBe(Math.ceil(HP_DO_ALVO / DANO));
    expect(r.final.predios.porId['inimigo']).toBeUndefined();
    expect(r.final.predios.ordem).not.toContain('inimigo');
    // derrubado, cada soldado volta a ocioso e nao sai atras de outro alvo sozinho. Quem
    // vem ANTES do que derrubou em `unidades.ordem` percebe no tick seguinte.
    const depois = step(r.final, [], gameData);
    for (const id of ['sold1', 'sold2', 'sold3']) expect(depois.unidades.porId[id]?.fsm).toBe('ocioso');
    // o mesmo soldado golpeia de CADENCIA em CADENCIA
    let s = step(s0, [ordem(['sold1'], 'inimigo')], gameData);
    const ticks: number[] = [];
    while (ticks.length < 4 && s.tick < 400) {
      if (golpesEm(s.events, 'inimigo').length > 0) ticks.push(s.tick);
      s = step(s, [], gameData);
    }
    expect(ticks.slice(1).map((t, i) => t - (ticks[i] as number))).toEqual([CADENCIA, CADENCIA, CADENCIA]);
    gravarEvidencia('F-CERCO-a2', {
      hpDoAlvo: HP_DO_ALVO, dano: DANO, cadencia: CADENCIA, soldados: 3,
      golpes: r.golpes, tickDaQueda: r.tickDaQueda, intervaloDeUmSoldado: ticks,
    });
  });

  it('(2) encostado num predio inimigo por 600 ticks, sem a ordem, o soldado nao tira HP', () => {
    const s0 = comSoldados(vila, 'inimigo', 2, 1); // distancia 1: no anel do footprint
    let s = s0;
    for (let t = 0; t < 600; t += 1) {
      s = step(s, [], gameData);
      expect(golpesEm(s.events, 'inimigo')).toEqual([]);
    }
    expect(s.predios.porId['inimigo']?.hp).toBe(HP_DO_ALVO);
    expect(s.unidades.porId['sold1']?.fsm).toBe('ocioso');
  });

  it('(3) a obra com hp h cai em ceil(h/2) golpes, menos que o mesmo predio completo', () => {
    const h = 37;
    const base = semCivis(createInitialState(1));
    const obra = comSoldados(comPredioInimigo(base, 'inimigo', 'obra', h), 'inimigo', 1, 3);
    const completo = comSoldados(comPredioInimigo(base, 'inimigo', 'completo', HP_DO_ALVO), 'inimigo', 1, 3);
    const rObra = correr(obra, ['sold1'], 'inimigo', 1000);
    const rCompleto = correr(completo, ['sold1'], 'inimigo', 5000);
    expect(rObra.violacoes).toEqual([]);
    expect(rObra.golpes).toBe(Math.ceil(h / DANO));
    expect(rCompleto.golpes).toBe(Math.ceil(HP_DO_ALVO / DANO));
    expect(rObra.golpes).toBeLessThan(rCompleto.golpes);
    // obra de hp 0 (nada martelado): um golpe. ceil(0/2) = 0 nao e golpe (PARA REVISAO)
    const zero = correr(comSoldados(comPredioInimigo(base, 'inimigo', 'obra', 0), 'inimigo', 1, 3), ['sold1'], 'inimigo', 1000);
    expect(zero.golpes).toBe(1);
    expect(zero.final.predios.porId['inimigo']).toBeUndefined();
  });

  it('(4) ordem contra predio do proprio lado e recusada, e o estado fica igual', () => {
    const s0 = comSoldados(vila, 'inimigo', 1, 5);
    const armazem = s0.predios.ordem.find((id) => s0.predios.porId[id]?.lado === LADO_DO_JOGADOR) as string;
    const comOrdem = step(s0, [ordem(['sold1'], armazem)], gameData);
    const semOrdem = step(s0, [], gameData);
    expect(comOrdem.events).toContainEqual({
      type: 'command-rejected', command: 'AttackBuilding', predio: armazem, unidade: 'sold1', motivo: 'predio-do-proprio-lado',
    });
    // tudo menos a lista de eventos do tick e byte a byte o tick sem o comando
    expect(salvar({ ...comOrdem, events: [] })).toBe(salvar({ ...semOrdem, events: [] }));
  });

  it('(4b) as outras recusas, cada uma com o motivo, e nenhuma muda o estado', () => {
    const s0 = comSoldados(vila, 'inimigo', 1, 5);
    const civil = s0.unidades.ordem.find((id) => s0.unidades.porId[id]?.tipo === 'serf') as string;
    const arqueiro: GameState = {
      ...s0,
      unidades: { ...s0.unidades, porId: { ...s0.unidades.porId, sold1: { ...(s0.unidades.porId['sold1'] as Unidade), tipo: 'bowman' } } },
    };
    const casos: [GameState, Command, string][] = [
      [s0, ordem(['sold1'], 'nao-existe'), 'predio-inexistente'],
      [s0, ordem([], 'inimigo'), 'sem-unidades'],
      [s0, ordem(['fantasma'], 'inimigo'), 'unidade-inexistente'],
      [s0, ordem([civil], 'inimigo'), 'unidade-nao-militar'],
      [arqueiro, ordem(['sold1'], 'inimigo'), 'unidade-a-distancia'],
    ];
    for (const [s, cmd, motivo] of casos) {
      const r = step(s, [cmd], gameData);
      expect(r.events.find((e) => e.type === 'command-rejected'), motivo).toMatchObject({ command: 'AttackBuilding', motivo });
      expect(salvar({ ...r, events: [] })).toBe(salvar({ ...step(s, [], gameData), events: [] }));
    }
  });

  it('(5) a mesma corrida duas vezes da o mesmo estado', () => {
    const a = correr(comSoldados(vila, 'inimigo', 3, 5), ['sold1', 'sold2', 'sold3'], 'inimigo', 400);
    const b = correr(comSoldados(vila, 'inimigo', 3, 5), ['sold1', 'sold2', 'sold3'], 'inimigo', 400);
    expect(a.golpes).toBeGreaterThan(0);
    expect(salvar(b.final)).toBe(salvar(a.final));
  });

  it('o predio ocupado que cai solta o ocupante e larga a colheita dele pelo release', () => {
    // a pedreira da vila, ocupada e colhendo, passada para o lado 1 (predio e ocupante)
    const base = cenarioDePedreira();
    let s0: GameState = {
      ...base,
      predios: { ...base.predios, porId: { ...base.predios.porId, q1: { ...(base.predios.porId['q1'] as Predio), lado: INIMIGO } } },
      unidades: { ...base.unidades, porId: { ...base.unidades.porId, u1: { ...(base.unidades.porId['u1'] as Unidade), lado: INIMIGO } } },
    };
    for (let t = 0; t < 30; t += 1) s0 = step(s0, [], gameData); // o pedreiro reclama a colheita
    const antes = s0.jobs.tarefas.ordem.filter((id) => s0.jobs.tarefas.porId[id]?.reclamadaPor === 'u1');
    expect(antes.length, 'o pedreiro deveria segurar uma tarefa antes da queda').toBeGreaterThan(0);
    s0 = comSoldados(s0, 'q1', 3, 4);
    const r = correr(s0, ['sold1', 'sold2', 'sold3'], 'q1', 3000);
    expect(r.violacoes).toEqual([]);
    expect(r.tickDaQueda).not.toBeNull();
    const depois = step(r.final, [], gameData);
    expect(depois.unidades.porId['u1']?.fsm).toBe('ocioso');
    const presas = depois.jobs.tarefas.ordem.filter((id) => depois.jobs.tarefas.porId[id]?.reclamadaPor === 'u1');
    expect(presas).toEqual([]);
    expect(violacoesDeInvariantes(depois, gameData)).toEqual([]);
  });

  it('o soldado golpeia encostado: no golpe, ele esta no anel do footprint', () => {
    let s = step(comSoldados(vila, 'inimigo', 1, 6), [ordem(['sold1'], 'inimigo')], gameData);
    while (golpesEm(s.events, 'inimigo').length === 0 && s.tick < 500) s = step(s, [], gameData);
    const u = s.unidades.porId['sold1'] as Unidade;
    const c = caixaDoPredio(s.predios.porId['inimigo'] as Predio, gameData);
    if (c === null) throw new Error('sem caixa');
    const dx = Math.max(c.x0 - u.gx, 0, u.gx - (c.x1 - 1));
    const dy = Math.max(c.y0 - u.gy, 0, u.gy - (c.y1 - 1));
    expect(Math.max(dx, dy)).toBe(1);
    expect(u.fsm).toBe(FSM_ATACANDO);
  });
});
