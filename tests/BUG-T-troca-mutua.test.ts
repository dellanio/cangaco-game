/**
 * BUG-T (tropa travada) — a troca mutua. Plano: docs/planos/2026-09-30-BUG-T-tropa-travada.md,
 * secao 7 (a emenda do operador: troca na hora, como no KaM,
 * `src/units/actions/KM_UnitActionWalkTo.pas:125` e `:787`).
 *
 * Dois militares do mesmo lado, cada um querendo o tile do outro, esperavam para sempre: a
 * `vagaTomadaPor` da C-MOVIMENTO-02b exige um parado a frente de quem ocupa, e a
 * `vagaEmparedadaPor` da C-MOVIMENTO-02 exige um parado no proximo tile. Aqui os dois passam um
 * pelo outro, cada passo no tempo de sempre, sem dois militares no mesmo tile no fim de tick
 * nenhum.
 *
 * Eixos deterministicos: tick, posicao, contagem de sobreposicao e de ordem com preso.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Command } from '../src/sim/commands';
import { custoDoPasso, tileAndavel } from '../src/sim/pathfinding';
import { chaveDeTile } from '../src/sim/estradas';
import { condicaoCheiaDoTipo, classeDaUnidade } from '../src/sim/condicao';
import { criarEscaramuca } from '../src/sim/cenario';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const TIPO = gameData.escaramuca.tropaDoJogador.tipo;
/** Guarda de travamento, NAO afirmacao de tempo (CLAUDE.md §8): 400 ordens da escaramuca. */
const TIMEOUT_DA_VARREDURA = 120_000;
const evidencia: Record<string, unknown> = {};

const semUnidades = (s: GameState): GameState => ({ ...s, unidades: { porId: {}, ordem: [] } });
function soldado(id: string, lado: number, t: { gx: number; gy: number }): Unidade {
  return { lado, id, tipo: TIPO, gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(TIPO) };
}
function com(s: GameState, ...us: Unidade[]): GameState {
  const porId = { ...s.unidades.porId };
  const ordem = [...s.unidades.ordem];
  for (const u of us) { porId[u.id] = u; ordem.push(u.id); }
  return { ...s, unidades: { porId, ordem } };
}
/** Um campo aberto de 25 x 25 tiles andaveis (o molde da C5, militares colidem). */
function campo(s: GameState): { gx: number; gy: number } {
  for (let r = 8; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const c = naVila(d, r);
      let livre = true;
      for (let dy = -12; dy <= 12 && livre; dy += 1) for (let dx = -12; dx <= 12 && livre; dx += 1) livre = tileAndavel(s, { gx: c.gx + dx, gy: c.gy + dy }, 'livre', gameData);
      if (livre) return c;
    }
  }
  throw new Error('fixture: sem campo aberto');
}
/** Pares de militares no mesmo tile neste estado. */
function sobrepostos(s: GameState): string[] {
  const vistos = new Map<string, string>();
  const erros: string[] = [];
  for (const id of s.unidades.ordem) {
    const u = s.unidades.porId[id];
    if (u === undefined || classeDaUnidade(u.tipo, gameData) !== 'militar') continue;
    const k = `${u.gx},${u.gy}`;
    const outro = vistos.get(k);
    if (outro !== undefined) erros.push(`t${s.tick} ${outro}+${id}@${k}`);
    else vistos.set(k, id);
  }
  return erros;
}
const mover = (id: string, destino: { gx: number; gy: number }): Command => ({ type: 'MoveUnits', unidades: [id], destino });
const pos = (s: GameState, id: string): string => `${s.unidades.porId[id]?.gx},${s.unidades.porId[id]?.gy}`;

interface Troca {
  readonly ticks: number | null; readonly sobreposicoes: readonly string[]; readonly fim: GameState; readonly teto: number;
  /** cada passo dado: em quantos ticks a unidade avancou nele, contra o custo dele */
  readonly passos: readonly { id: string; ticks: number; custo: number }[];
}

/** `a` em `ta` e `b` em `tb`, vizinhos, cada um mandado para o tile do outro. */
function trocar(base: GameState, ta: { gx: number; gy: number }, tb: { gx: number; gy: number }, ladoB: number, ticks: number): Troca {
  const s0 = com(base, soldado('a', LADO_DO_JOGADOR, ta), soldado('b', ladoB, tb));
  const teto = Math.max(custoDoPasso(s0.estradas, ta, tb, gameData), custoDoPasso(s0.estradas, tb, ta, gameData)) + 2;
  // o tick do comando ja anda (quem planeja e larga no mesmo tick): a contagem comeca nele
  let s = s0;
  const sobreposicoes: string[] = [];
  const avancos: Record<string, number> = {};
  const passos: { id: string; ticks: number; custo: number }[] = [];
  let chegou: number | null = null;
  for (let t = 0; t <= ticks; t += 1) {
    const antes = s;
    s = step(s, t === 0 ? [mover('a', tb), mover('b', ta)] : [], gameData);
    sobreposicoes.push(...sobrepostos(s));
    // emenda 2: cada um anda uma vez por tick. Medido pelo que a chegada nao esconde: os ticks
    // em que a unidade AVANCOU (progresso subiu ou mudou de tile) somam exatamente o custo do
    // passo dela. Olhar so `pd > pa + 1` era cego: a chegada zera o progresso (avaliador, leva 3)
    for (const id of ['a', 'b']) {
      const ua = antes.unidades.porId[id];
      const ud = s.unidades.porId[id];
      if (ua === undefined || ud === undefined) continue;
      const mudou = ua.gx !== ud.gx || ua.gy !== ud.gy;
      if (mudou || (ud.fsmData.progresso ?? 0) > (ua.fsmData.progresso ?? 0)) avancos[id] = (avancos[id] ?? 0) + 1;
      if (mudou) passos.push({ id, ticks: avancos[id] ?? 0, custo: custoDoPasso(s0.estradas, noTileDe(ua), noTileDe(ud), gameData) });
    }
    if (chegou === null && pos(s, 'a') === `${tb.gx},${tb.gy}` && pos(s, 'b') === `${ta.gx},${ta.gy}`
      && s.unidades.porId['a']?.fsm === 'ocioso' && s.unidades.porId['b']?.fsm === 'ocioso') chegou = t;
  }
  return { ticks: chegou, sobreposicoes, fim: s, teto, passos };
}
const noTileDe = (u: Unidade): { gx: number; gy: number } => ({ gx: u.gx, gy: u.gy });

describe('BUG-T aceite 2 — dois do mesmo lado, cada um no tile do outro, trocam na hora', () => {
  const base = semUnidades(createInitialState(1));
  const c = campo(base);
  const ta = { gx: c.gx, gy: c.gy };
  const tb = { gx: c.gx + 1, gy: c.gy };

  it('no campo aberto: os dois param nos tiles trocados, no tempo de um passo, sem sobreposicao', () => {
    const r = trocar(base, ta, tb, LADO_DO_JOGADOR, 200);
    evidencia['aceite2'] = { ticks: r.ticks, teto: r.teto, sobreposicoes: r.sobreposicoes, passos: r.passos };
    expect(r.sobreposicoes).toEqual([]);
    expect(r.passos).toHaveLength(2);
    for (const p of r.passos) expect(p.ticks, `${p.id}: ticks do passo contra o custo`).toBe(p.custo);
    expect(r.ticks, 'a troca aconteceu').not.toBeNull();
    expect(r.ticks ?? Infinity).toBeLessThanOrEqual(r.teto);
  });

  it('com um dos tiles em estrada (custos diferentes): o mesmo, e nenhuma sobreposicao', () => {
    const comEstrada: GameState = { ...base, estradas: { ...base.estradas, [chaveDeTile(tb)]: true } };
    // guarda do cenario: os dois passos custam diferente
    expect(custoDoPasso(comEstrada.estradas, ta, tb, gameData)).not.toBe(custoDoPasso(comEstrada.estradas, tb, ta, gameData));
    for (const [nome, x, y] of [['a antes', ta, tb], ['b antes', tb, ta]] as const) {
      const r = trocar(comEstrada, x, y, LADO_DO_JOGADOR, 200);
      evidencia[`aceite2-estrada-${nome}`] = { ticks: r.ticks, teto: r.teto, sobreposicoes: r.sobreposicoes, passos: r.passos };
      expect(r.sobreposicoes, nome).toEqual([]);
      expect(r.passos, nome).toHaveLength(2);
      for (const p of r.passos) expect(p.ticks, `${nome}, ${p.id}: ticks do passo contra o custo`).toBe(p.custo);
      expect(r.ticks, nome).not.toBeNull();
      expect(r.ticks ?? Infinity, nome).toBeLessThanOrEqual(r.teto);
    }
  });
});

describe('BUG-T aceite 5 — a ordem nova no meio da troca nao se perde (achado do avaliador)', () => {
  it('o par em troca recebe, no meio do passo, uma ordem para longe: o que a recebeu chega la', () => {
    const base = semUnidades(createInitialState(1));
    const c = campo(base);
    const ta = { gx: c.gx, gy: c.gy };
    const tb = { gx: c.gx + 1, gy: c.gy };
    const longe = { gx: c.gx - 6, gy: c.gy - 6 };
    const s0 = com(base, soldado('a', LADO_DO_JOGADOR, ta), soldado('b', LADO_DO_JOGADOR, tb));
    let s = step(s0, [mover('a', tb), mover('b', ta)], gameData);
    // guarda do cenario: a ordem pega os dois NO MEIO do passo da troca
    for (let t = 0; t < 20 && (s.unidades.porId['a']?.fsmData.progresso ?? 0) < 2; t += 1) s = step(s, [], gameData);
    expect(s.unidades.porId['a']?.fsmData.progresso ?? 0).toBeGreaterThanOrEqual(2);
    expect(s.unidades.porId['a']?.fsmData.caminho?.[0]).toEqual(tb);
    s = step(s, [mover('a', longe)], gameData);
    const sob: string[] = [];
    for (let t = 0; t < 300; t += 1) { s = step(s, [], gameData); sob.push(...sobrepostos(s)); }
    evidencia['aceite5'] = { chegou: pos(s, 'a'), fsm: s.unidades.porId['a']?.fsm, sobreposicoes: sob };
    expect(sob).toEqual([]);
    expect(pos(s, 'a')).toBe(`${longe.gx},${longe.gy}`);
    expect(s.unidades.porId['a']?.fsm).toBe('ocioso');
  });
});

describe('BUG-T aceite 6 — caso 3: cada um quer o tile do outro a dois passos, com um parado no meio', () => {
  it('os dois param nas duas vagas pedidas, e o parado fica no lugar', () => {
    const base = semUnidades(createInitialState(1));
    const c = campo(base);
    const ta = { gx: c.gx - 1, gy: c.gy };
    const meio = { gx: c.gx, gy: c.gy };
    const tb = { gx: c.gx + 1, gy: c.gy };
    // o parado do meio e o centro de uma COLUNA de parados mais alta que a margem do desvio
    // (`margemDoDesvio_tiles`): ninguem contorna, e o caminho de cada um passa pelo meio, como
    // na ordem k = 37 da varredura, onde a formacao em volta fechava o contorno
    const alcance = gameData.movimento.margemDoDesvioMilitar + 2;
    const muro: Unidade[] = [];
    for (let dy = -alcance; dy <= alcance; dy += 1) if (dy !== 0) muro.push(soldado(`m${dy}`, LADO_DO_JOGADOR, { gx: c.gx, gy: c.gy + dy }));
    const s0 = com(base, soldado('a', LADO_DO_JOGADOR, ta), soldado('b', LADO_DO_JOGADOR, tb), soldado('p', LADO_DO_JOGADOR, meio), ...muro);
    let s = step(s0, [mover('a', tb), mover('b', ta)], gameData);
    // guarda do cenario: o caminho de cada um passa pelo meio, onde o parado esta
    expect(s.unidades.porId['a']?.fsmData.caminho?.[0]).toEqual(meio);
    expect(s.unidades.porId['b']?.fsmData.caminho?.[0]).toEqual(meio);
    const sob: string[] = [];
    let parou: number | null = null;
    for (let t = 1; t <= 200; t += 1) {
      s = step(s, [], gameData);
      sob.push(...sobrepostos(s));
      if (parou === null && s.unidades.porId['a']?.fsm === 'ocioso' && s.unidades.porId['b']?.fsm === 'ocioso') parou = t;
    }
    const onde = [pos(s, 'a'), pos(s, 'b')].sort();
    evidencia['aceite6'] = { parou, onde, parado: pos(s, 'p'), sobreposicoes: sob };
    expect(sob).toEqual([]);
    expect(parou, 'os dois pararam').not.toBeNull();
    expect(onde).toEqual([`${ta.gx},${ta.gy}`, `${tb.gx},${tb.gy}`].sort());
    expect(pos(s, 'p')).toBe(`${meio.gx},${meio.gy}`);
  });
});

describe('BUG-T — o ciclo de tres da ordem k = 32 (a regra da largada com parceiro)', () => {
  // P e Q estao em troca mutua (P em T0 quer T1, Q em T1 quer T0), cada um a UM passo da vaga
  // (caminho de um passo nao tem contorno, como u22/u30 na varredura). Q ja completou o passo e
  // espera P; R vem de T2 e ja comecou o passo para T1, entao REIVINDICA T1. Se a largada de P
  // contasse a reivindicacao de R, P nunca largaria, Q nunca chegaria e R nunca entraria: os tres
  // presos (medido na varredura, ordem k = 32, antes da regra). O estado e o do meio da marcha,
  // montado tile a tile como estava na varredura.
  it('P larga, a troca fecha, e R segue para o fim dele: os tres param, sem sobreposicao', () => {
    const base = semUnidades(createInitialState(1));
    const c = campo(base);
    const T0 = { gx: c.gx, gy: c.gy };
    const T1 = { gx: c.gx + 1, gy: c.gy };
    const T2 = { gx: c.gx + 2, gy: c.gy };
    const fimDeR = { gx: c.gx + 1, gy: c.gy - 1 };
    const custoQ = custoDoPasso(base.estradas, T1, T0, gameData);
    const marchando = (id: string, t: { gx: number; gy: number }, caminho: { gx: number; gy: number }[], progresso: number): Unidade => ({
      ...soldado(id, LADO_DO_JOGADOR, t), fsm: 'marchando',
      fsmData: { caminho, progresso, alvoTile: caminho[caminho.length - 1] as { gx: number; gy: number } },
    });
    let s = com(base,
      marchando('P', T0, [T1], 0),
      marchando('Q', T1, [T0], custoQ - 1),
      marchando('R', T2, [T1, fimDeR], 2));
    const sob: string[] = [...sobrepostos(s)];
    let parou: number | null = null;
    for (let t = 1; t <= 300; t += 1) {
      s = step(s, [], gameData);
      sob.push(...sobrepostos(s));
      if (parou === null && ['P', 'Q', 'R'].every((id) => s.unidades.porId[id]?.fsm === 'ocioso')) parou = t;
    }
    evidencia['cicloDeTres'] = { parou, P: pos(s, 'P'), Q: pos(s, 'Q'), R: pos(s, 'R'), sobreposicoes: sob };
    expect(sob).toEqual([]);
    expect(parou, 'os tres pararam').not.toBeNull();
    expect(pos(s, 'Q')).toBe(`${T0.gx},${T0.gy}`);
    expect(pos(s, 'P')).toBe(`${T1.gx},${T1.gy}`);
    expect(pos(s, 'R')).toBe(`${fimDeR.gx},${fimDeR.gy}`);
  });
});

describe('BUG-T aceite 3 — inimigo nao troca', () => {
  it('de lados opostos, em nenhum tick um esta no tile inicial do outro enquanto o outro esta no dele', () => {
    const base = semUnidades(createInitialState(1));
    const c = campo(base);
    const ta = { gx: c.gx, gy: c.gy };
    const tb = { gx: c.gx + 1, gy: c.gy };
    const s0 = com(base, soldado('a', LADO_DO_JOGADOR, ta), soldado('b', LADO_DA_IA, tb));
    // guarda do cenario: frente a frente no tick da ordem
    expect(Math.abs(ta.gx - tb.gx) + Math.abs(ta.gy - tb.gy)).toBe(1);
    let s = step(s0, [mover('a', tb), mover('b', ta)], gameData);
    let trocados = 0;
    for (let t = 0; t < 200; t += 1) {
      s = step(s, [], gameData);
      if (pos(s, 'a') === `${tb.gx},${tb.gy}` && pos(s, 'b') === `${ta.gx},${ta.gy}`) trocados += 1;
    }
    evidencia['aceite3'] = { ticksTrocados: trocados };
    expect(trocados).toBe(0);
  });
});

describe('BUG-T aceite 4 — a varredura das 400 ordens (receita fixada na secao 7 do plano)', () => {
  it('nenhuma ordem deixa soldado marchando, e nenhum tick tem dois militares no mesmo tile [longo]', () => {
    let x = 12345n;
    const rnd = (n: number): number => { x = (x * 1103515245n + 12345n) % 2147483648n; return Number(x % BigInt(n)); };
    let s = criarEscaramuca(gameData.economia.estadoInicial.semente);
    const tropa = s.unidades.ordem.filter((id) => s.unidades.porId[id]?.lado === LADO_DO_JOGADOR && s.unidades.porId[id]?.tipo === TIPO);
    const lider = s.unidades.porId[tropa[0] as string] as Unidade;
    const comPreso: unknown[] = [];
    const sobreposicoes: string[] = [];
    let ticks = 0;
    for (let k = 0; k < 400; k += 1) {
      const destino = { gx: lider.gx + rnd(17) - 8, gy: lider.gy + rnd(17) - 8 };
      const direcao = rnd(8);
      const colunas = 3 + rnd(7);
      s = step(s, [{ type: 'MoveUnits', unidades: tropa, destino, direcao, colunas }], gameData);
      sobreposicoes.push(...sobrepostos(s));
      const vivos = (): string[] => tropa.filter((id) => s.unidades.porId[id] !== undefined);
      let t = 0;
      for (; t < 1500 && !vivos().every((id) => s.unidades.porId[id]?.fsm === 'ocioso'); t += 1) {
        s = step(s, [], gameData);
        sobreposicoes.push(...sobrepostos(s));
      }
      ticks += t;
      const presos = vivos().filter((id) => s.unidades.porId[id]?.fsm === 'marchando');
      if (presos.length > 0) comPreso.push({ k, destino, direcao, colunas, presos });
    }
    evidencia['aceite4'] = { ordens: 400, ticks, comPreso, sobreposicoes: sobreposicoes.slice(0, 20), antesDoConserto: { ordensComPreso: 3, presos: 6, causa: 'troca mutua' } };
    // suite longa: evidencia propria, para nao sobrescrever a do `verify` com uma parte so
    gravarEvidencia('BUG-T-varredura', { aceite4: evidencia['aceite4'] });
    expect(sobreposicoes).toEqual([]);
    expect(comPreso).toEqual([]);
  }, TIMEOUT_DA_VARREDURA);
});

describe('BUG-T — evidencia', () => {
  it('grava `test-output/BUG-T.json` (a varredura, da suite longa, grava `BUG-T-varredura.json`)', () => {
    gravarEvidencia('BUG-T', evidencia);
  });
});
