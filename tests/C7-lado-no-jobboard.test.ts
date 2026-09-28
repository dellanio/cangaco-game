/**
 * C7 — o lado filtrando o JobBoard (fila do operador, item 7; BUG-N1 do avaliador:
 * "o recruta do lado 0 se alista no quartel do lado 1 e o armazem do jogador manda armas
 * para la"). Plano em docs/planos/2026-09-28-C7-lado-no-jobboard.md. Aceite:
 *  (a) o caso do avaliador: quartel inimigo ligado a vila nao recebe recruta nem arma do
 *      jogador; com o MESMO quartel do lado do jogador, recebe (a fixture funciona);
 *  (b) obra inimiga nao e martelada pelos laborers do jogador; a mesma obra do jogador e;
 *  (c) em todo tick de (a) e (b), nenhuma tarefa reclamada toca predio de outro lado que
 *      o de quem a reclamou, e nenhuma tarefa (nem aberta) liga origem e destino de lados
 *      diferentes;
 *  (d) a carga devolvida vai ao armazem do lado de quem carrega, mesmo com o de outro lado
 *      mais perto;
 *  (e) a mesma corrida duas vezes da o mesmo estado.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, ID_DO_ARMAZEM, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Predio, PredioCompleto, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { buscarCaminho, tileAndavel } from '../src/sim/pathfinding';
import { chaveDeTile, tilesDaPorta } from '../src/sim/estradas';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { armazemMaisProximo } from '../src/sim/deposito';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const INIMIGO = LADO_DO_JOGADOR + 1;
const armazemDe = (s: GameState): PredioCompleto =>
  s.predios.porId[s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === ID_DO_ARMAZEM) as string] as PredioCompleto;

function lugar(s: GameState, tipo: string, desde = 6): { gx: number; gy: number } {
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'sawmill', 'quarry'])] };
  for (let r = desde; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const p = naVila(d, r);
      if (canPlace(busca, tipo, p.gx, p.gy, gameData).ok) return p;
    }
  }
  throw new Error(`fixture: '${tipo}' nao coube`);
}
function comPredio(s: GameState, p: Predio): GameState {
  return { ...s, predios: { porId: { ...s.predios.porId, [p.id]: p }, ordem: [...s.predios.ordem, p.id] } };
}
/** Liga a porta de `id` a porta do armazem do jogador pela rua que o A* traca. */
function comRua(s: GameState, id: string): GameState {
  const p = s.predios.porId[id] as Predio;
  const porta = tilesDaPorta(p, gameData)[0] as { gx: number; gy: number };
  const rua = buscarCaminho(s, porta, tilesDaPorta(armazemDe(s), gameData), 'livre', gameData);
  if (rua === null) throw new Error('fixture: sem rua');
  return { ...s, estradas: { ...s.estradas, ...Object.fromEntries([porta, ...rua.tiles].map((t) => [chaveDeTile(t), true as const])) } };
}
function comUnidade(s: GameState, u: Unidade): GameState {
  return { ...s, unidades: { porId: { ...s.unidades.porId, [u.id]: u }, ordem: [...s.unidades.ordem, u.id] } };
}

/** A vila, com hand_axe no armazem, um recruta ocioso na porta dele e um quartel COMPLETO
 *  do `lado` dado, ligado ao armazem pela rua. */
function vilaComQuartel(lado: number): GameState {
  let s = createInitialState(1);
  const arm = armazemDe(s);
  s = comPredio(s, { ...arm, estoque: { ...arm.estoque, saida: { ...arm.estoque.saida, hand_axe: 3 } } } as PredioCompleto);
  s = { ...s, predios: { ...s.predios, ordem: s.predios.ordem.filter((i, k, a) => a.indexOf(i) === k) } };
  const q = completarObra({ lado, id: 'quartel', tipo: 'barracks', ...lugar(s, 'barracks', 8), estado: 'obra', hp: 600, obra: { faltam: {}, nivelamento: 0 } }, gameData);
  s = comRua(comPredio(s, q), 'quartel');
  const porta = tilesDaPorta(armazemDe(s), gameData).find((t) => tileAndavel(s, t, 'livre', gameData)) as { gx: number; gy: number };
  return comUnidade(s, { lado: LADO_DO_JOGADOR, id: 'recruta', tipo: 'recruit', ...porta, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('recruit') });
}

/** Toda tarefa reclamada toca so predios do lado de quem a reclamou. */
function cruzamentos(s: GameState): string[] {
  const erros: string[] = [];
  for (const id of s.jobs.tarefas.ordem) {
    const t = s.jobs.tarefas.porId[id];
    if (t === undefined) continue;
    // nenhuma tarefa, nem ABERTA, liga origem e destino de lados diferentes: o gerador nao
    // a cria (sem isto ela ficaria aberta para sempre, sem ninguem que possa reclama-la)
    const o = 'origem' in t ? s.predios.porId[t.origem] : undefined;
    const d = 'destino' in t ? s.predios.porId[t.destino] : undefined;
    if (o !== undefined && d !== undefined && o.lado !== d.lado) erros.push(`t${t.numero} ${t.tipo} (${t.estado}): ${o.id}(${o.lado}) -> ${d.id}(${d.lado})`);
    if (t.reclamadaPor === null) continue;
    const u = s.unidades.porId[t.reclamadaPor];
    for (const ponta of [('origem' in t ? t.origem : undefined), ('destino' in t ? t.destino : undefined)]) {
      const p = ponta === undefined ? undefined : s.predios.porId[ponta];
      if (u !== undefined && p !== undefined && p.lado !== u.lado) erros.push(`t${t.numero} ${t.tipo}: ${u.id}(${u.lado}) -> ${p.id}(${p.lado})`);
    }
  }
  return erros;
}

function correr(s0: GameState, ticks: number): { s: GameState; cruzou: string[] } {
  let s = s0;
  const cruzou: string[] = [];
  for (let t = 0; t < ticks; t += 1) {
    s = step(s, [], gameData);
    cruzou.push(...cruzamentos(s));
  }
  return { s, cruzou };
}

describe('C7 — o lado filtra o JobBoard', () => {
  it('(a) quartel inimigo nao recebe recruta nem arma do jogador; o do jogador recebe', () => {
    const inimigo = correr(vilaComQuartel(INIMIGO), 1500);
    const q1 = inimigo.s.predios.porId['quartel'] as PredioCompleto;
    expect(q1.recrutas ?? 0).toBe(0);
    expect(q1.estoque.entrada['hand_axe'] ?? 0).toBe(0);
    expect(inimigo.cruzou).toEqual([]);
    const meu = correr(vilaComQuartel(LADO_DO_JOGADOR), 1500);
    const q0 = meu.s.predios.porId['quartel'] as PredioCompleto;
    expect(q0.recrutas ?? 0).toBe(1);
    expect(q0.estoque.entrada['hand_axe'] ?? 0).toBeGreaterThan(0);
    gravarEvidencia('C7-quartel', {
      inimigo: { recrutas: q1.recrutas ?? 0, armas: q1.estoque.entrada },
      doJogador: { recrutas: q0.recrutas ?? 0, armas: q0.estoque.entrada },
    });
  });

  it('(b) obra inimiga nao e martelada; a mesma obra do jogador e', () => {
    const obra = (lado: number): GameState => {
      const s = createInitialState(1);
      return comPredio(s, { lado, id: 'obra', tipo: 'quarry', ...lugar(s, 'quarry'), estado: 'obra', hp: 0, obra: { faltam: {}, nivelamento: 0 } });
    };
    const inimiga = correr(obra(INIMIGO), 1500);
    expect(inimiga.s.predios.porId['obra']?.hp).toBe(0);
    expect(inimiga.cruzou).toEqual([]);
    const minha = correr(obra(LADO_DO_JOGADOR), 1500);
    expect(minha.s.predios.porId['obra']?.hp ?? 0).toBeGreaterThan(0);
  });

  it('(d) a carga volta ao armazem do lado de quem carrega', () => {
    let s = createInitialState(1);
    const meu = armazemDe(s);
    const outro = completarObra({ lado: INIMIGO, id: 'arm-ia', tipo: ID_DO_ARMAZEM, ...lugar(s, ID_DO_ARMAZEM, 8), estado: 'obra', hp: 400, obra: { faltam: {}, nivelamento: 0 } }, gameData);
    s = comPredio(s, outro);
    const colado = tilesDaPorta(outro, gameData).find((t) => tileAndavel(s, t, 'livre', gameData)) as { gx: number; gy: number };
    expect(armazemMaisProximo(s, colado, INIMIGO, gameData)?.id).toBe('arm-ia');
    expect(armazemMaisProximo(s, colado, LADO_DO_JOGADOR, gameData)?.id).toBe(meu.id);
  });

  it('(e) a mesma corrida duas vezes da o mesmo estado', () => {
    expect(salvar(correr(vilaComQuartel(INIMIGO), 400).s)).toBe(salvar(correr(vilaComQuartel(INIMIGO), 400).s));
  });
});
