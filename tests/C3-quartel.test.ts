/**
 * C3 — os defeitos do quartel (fila do operador, item 3; plano em
 * docs/planos/2026-09-28-C3-defeitos-do-quartel.md). Aceite da sim:
 *  (a) teto: com 12 machados no armazem, o quartel fica com `estoqueInternoPorPredio.entrada`
 *      (5) e o resto fica no armazem; com 8 vindos de save antigo, volta a 5;
 *  (b) demolir, ou perder em combate, o quartel com 2 recrutas deixa 2 `recruit` do lado
 *      dele na porta;
 *  (c) porta bloqueada: o painel diz `porta-bloqueada` e o comando recusa com o mesmo motivo.
 *  O (d), a tela, e o roteiro `tools/shots/F25b.js`.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, ID_DO_ARMAZEM, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Predio, PredioCompleto, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { buscarCaminho, tileAndavel } from '../src/sim/pathfinding';
import { chaveDeTile, tilesDaPorta } from '../src/sim/estradas';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { painelDoPredio } from '../src/sim/selectors';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';
import { foraDaPorta } from './helpers/na-porta';

const TETO = gameData.producao.estoqueInternoPorPredio.entrada;
const INIMIGO = LADO_DO_JOGADOR + 1;
const armazemDe = (s: GameState): PredioCompleto =>
  s.predios.porId[s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === ID_DO_ARMAZEM) as string] as PredioCompleto;
const comPredio = (s: GameState, p: Predio): GameState =>
  ({ ...s, predios: { porId: { ...s.predios.porId, [p.id]: p }, ordem: s.predios.ordem.includes(p.id) ? s.predios.ordem : [...s.predios.ordem, p.id] } });
const quartelDe = (s: GameState): PredioCompleto => s.predios.porId['quartel'] as PredioCompleto;

function vilaComQuartel(opcoes: { lado?: number; noArmazem?: number; entrada?: Record<string, number>; recrutas?: number; rua?: boolean } = {}): GameState {
  let s = createInitialState(1);
  const arm = armazemDe(s);
  s = comPredio(s, { ...arm, estoque: { ...arm.estoque, saida: { ...arm.estoque.saida, hand_axe: opcoes.noArmazem ?? 0 } } } as PredioCompleto);
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'sawmill'])] };
  let lugar: { gx: number; gy: number } | null = null;
  for (let r = 8; r < 40 && lugar === null; r += 1) {
    for (let d = -r; d <= r && lugar === null; d += 1) {
      const p = naVila(d, r);
      if (canPlace(busca, 'barracks', p.gx, p.gy, gameData).ok) lugar = p;
    }
  }
  if (lugar === null) throw new Error('fixture: o quartel nao coube');
  const q = completarObra({ lado: opcoes.lado ?? LADO_DO_JOGADOR, id: 'quartel', tipo: 'barracks', ...lugar, estado: 'obra', hp: 600, obra: { faltam: {}, nivelamento: 0 } }, gameData);
  s = comPredio(s, { ...q, estoque: { ...q.estoque, entrada: opcoes.entrada ?? {} }, recrutas: opcoes.recrutas ?? 0 });
  if (opcoes.rua !== false) {
    const porta = tilesDaPorta(q, gameData)[0] as { gx: number; gy: number };
    const rua = buscarCaminho(s, porta, tilesDaPorta(armazemDe(s), gameData), 'livre', gameData);
    if (rua === null) throw new Error('fixture: sem rua');
    s = { ...s, estradas: { ...s.estradas, ...Object.fromEntries([porta, ...rua.tiles].map((t) => [chaveDeTile(t), true as const])) } };
  }
  return s;
}
const recrutasSoltos = (s: GameState): Unidade[] =>
  s.unidades.ordem.map((id) => s.unidades.porId[id] as Unidade).filter((u) => u.tipo === 'recruit');

describe('C3 — os defeitos do quartel', () => {
  it('(a) o quartel guarda ate 5 de cada arma; o resto fica no armazem', () => {
    let s = vilaComQuartel({ noArmazem: 12 });
    let maior = 0;
    for (let t = 0; t < 2500; t += 1) {
      s = step(s, [], gameData);
      maior = Math.max(maior, quartelDe(s).estoque.entrada['hand_axe'] ?? 0);
    }
    expect(maior).toBe(TETO); // nunca passou do teto, em tick nenhum
    expect(TETO).toBe(5);
    expect(quartelDe(s).estoque.entrada['hand_axe']).toBe(TETO);
    expect(armazemDe(s).estoque.saida['hand_axe']).toBe(12 - TETO);
    // save de antes do teto: 8 na entrada; o excedente volta ao armazem
    let v = vilaComQuartel({ noArmazem: 0, entrada: { hand_axe: 8 } });
    for (let t = 0; t < 2500; t += 1) v = step(v, [], gameData);
    expect(quartelDe(v).estoque.entrada['hand_axe']).toBe(TETO);
    expect(armazemDe(v).estoque.saida['hand_axe']).toBe(8 - TETO);
    // cheio, o quartel nao deixa tarefa de arma ABERTA para tras (o gerador respeita a vaga)
    const abertas = (x: GameState): number => x.jobs.tarefas.ordem
      .filter((id) => { const tt = x.jobs.tarefas.porId[id]; return tt?.tipo === 'arma-para-quartel' && tt.estado === 'aberta'; }).length;
    expect(abertas(s)).toBe(0);
    gravarEvidencia('C3-teto', { teto: TETO, noQuartel: TETO, noArmazem: 12 - TETO });
  });

  it('(a) tarefas de arma abertas de antes do teto (save antigo) nao passam do teto', () => {
    let s = vilaComQuartel({ noArmazem: 6, entrada: { hand_axe: TETO } });
    // cria 4 tarefas abertas como a F25a criava (demanda infinita), com o quartel ja cheio
    const arm = armazemDe(s).id;
    const tarefas = { porId: { ...s.jobs.tarefas.porId }, ordem: [...s.jobs.tarefas.ordem] };
    for (let i = 0; i < 4; i += 1) {
      const id = `velha${i}`;
      tarefas.porId[id] = { id, numero: 90000 + i, tipo: 'arma-para-quartel', mercadoria: 'hand_axe', origem: arm, destino: 'quartel', estado: 'aberta', reclamadaPor: null };
      tarefas.ordem.push(id);
    }
    s = { ...s, jobs: { ...s.jobs, tarefas } };
    // a checagem vale A CADA TICK: o que passasse do teto voltaria ao armazem pelo nivel 7
    // e o estado final se recomporia, escondendo a entrega indevida
    let maior = 0;
    for (let t = 0; t < 2000; t += 1) {
      s = step(s, [], gameData);
      maior = Math.max(maior, quartelDe(s).estoque.entrada['hand_axe'] ?? 0);
    }
    expect(maior).toBe(TETO);
    expect(quartelDe(s).estoque.entrada['hand_axe']).toBe(TETO);
    expect(armazemDe(s).estoque.saida['hand_axe']).toBe(6);
  });

  it('(b) demolir o quartel com 2 recrutas deixa 2 recrutas na porta', () => {
    const s0 = vilaComQuartel({ recrutas: 2, rua: false });
    const antes = recrutasSoltos(s0).length;
    const s = step(s0, [{ type: 'DemolishBuilding', predio: 'quartel' }], gameData);
    expect(s.predios.porId['quartel']).toBeUndefined();
    const soltos = recrutasSoltos(s).slice(antes);
    expect(soltos).toHaveLength(2);
    for (const r of soltos) expect(r.lado).toBe(LADO_DO_JOGADOR);
    // D-MOVIMENTO-01d (JobBoard e porta por estado da chave) — na porta desligada; na porta ou vizinho, sem empilhar, com a colisao ligada
    expect(foraDaPorta(tilesDaPorta(quartelDe(s0), gameData), soltos, gameData)).toEqual([]);
  });

  it('(b) o quartel inimigo derrubado em combate solta os recrutas dele, do lado dele', () => {
    let s = vilaComQuartel({ lado: INIMIGO, recrutas: 2, rua: false });
    s = comPredio(s, { ...quartelDe(s), hp: 1 });
    const porta = tilesDaPorta(quartelDe(s), gameData).find((t) => tileAndavel(s, t, 'livre', gameData)) as { gx: number; gy: number };
    const soldado: Unidade = { lado: LADO_DO_JOGADOR, id: 'sold', tipo: 'militia', ...porta, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia') };
    s = { ...s, unidades: { porId: { ...s.unidades.porId, sold: soldado }, ordem: [...s.unidades.ordem, 'sold'] } };
    s = step(s, [{ type: 'AttackBuilding', unidades: ['sold'], predio: 'quartel' }], gameData);
    let caiu = false;
    for (let t = 0; t < 200 && !caiu; t += 1) {
      s = step(s, [], gameData);
      caiu = s.events.some((e: GameEvent) => e.type === 'building-demolished' && e.predio === 'quartel');
    }
    expect(caiu).toBe(true);
    const soltos = recrutasSoltos(s).filter((u) => u.lado === INIMIGO);
    expect(soltos).toHaveLength(2);
  });

  it('(c) porta bloqueada: o painel e o comando dizem o mesmo motivo', () => {
    let s = vilaComQuartel({ entrada: { hand_axe: 1 }, recrutas: 1, rua: false });
    // tapa a porta com arvore (a arvore e obstaculo desde a F-T2b; o lajedo e andavel)
    const recursos = { ...s.recursos };
    for (const t of tilesDaPorta(quartelDe(s), gameData)) recursos[chaveDeTile(t)] = { tipo: 'tree', quantidade: 6 };
    s = { ...s, recursos };
    expect(tilesDaPorta(quartelDe(s), gameData).some((t) => tileAndavel(s, t, 'livre', gameData))).toBe(false);
    const militia = painelDoPredio(s, 'quartel', gameData)?.quartel?.tipos.find((t) => t.tipo === 'militia');
    expect(militia?.motivo).toBe('porta-bloqueada');
    const r = step(s, [{ type: 'TrainSoldier', predio: 'quartel', tipo: 'militia' }], gameData);
    expect(r.events.find((e) => e.type === 'command-rejected')).toMatchObject({ command: 'TrainSoldier', motivo: 'porta-bloqueada' });
  });

  it('grava a partida do roteiro (a mesma da F25b: 1 machado, 1 couro, 2 recrutas)', () => {
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/C3.save.txt`, salvar(vilaComQuartel({ entrada: { hand_axe: 1, leather_armor: 1 }, recrutas: 2, rua: false })));
  });
});
