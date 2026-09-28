/**
 * F35 — a Feira (BUILD_PLAN F35; plano em docs/planos/2026-09-28-A17-F35-feira.md).
 * Taxa 2 para 1 (decisao do operador). Os quatro aceites do item:
 *  (a) com a ordem "B por A" e A no armazem, B chega ao armazem; o A debitado e `taxa x`
 *      o B creditado, na corrida inteira;
 *  (b) nunca mais de `maxSerfs` tarefas da feira reclamadas no mesmo tick, com 20 serfs;
 *  (c) sem A no armazem a troca espera, nenhum B aparece, e o motivo e o do painel;
 *  (d) cancelar a ordem com A a caminho nao perde A: a soma de A no mundo (armazem,
 *      gavetas, serfs) mais `taxa x` as trocas fica igual. A tarefa em curso termina na
 *      feira e o A volta como excedente (aceite corrigido pelo operador, 2026-09-28).
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, ID_DO_ARMAZEM, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, PredioCompleto, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Command } from '../src/sim/commands';
import { canPlace } from '../src/sim/placement';
import { buscarCaminho, tileAndavel } from '../src/sim/pathfinding';
import { chaveDeTile, predioLigadoAoArmazem, tilesDaPorta } from '../src/sim/estradas';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { porQueNaoTroca, serfsNaFeira } from '../src/sim/feira';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const TAXA = gameData.economia.marketplace.taxa;
const MAX = gameData.economia.marketplace.maxSerfs;
const A = 'timber';
const B = 'gold';

const armazemDe = (s: GameState): PredioCompleto =>
  s.predios.porId[s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === ID_DO_ARMAZEM) as string] as PredioCompleto;
const feiraDe = (s: GameState): PredioCompleto => s.predios.porId['feira'] as PredioCompleto;

/** A vila da abertura mais uma feira COMPLETA ligada ao armazem pela rua que o A* traca;
 *  `a` de A e `b` de B no armazem; `serfsExtras` serfs a mais, ociosos, na porta dele. */
function vilaComFeira(a: number, b: number, serfsExtras = 0): GameState {
  let s = createInitialState(1);
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'sawmill'])] };
  let lugar: { gx: number; gy: number } | null = null;
  for (let r = 4; r < 30 && lugar === null; r += 1) {
    for (let d = -r; d <= r && lugar === null; d += 1) {
      const p = naVila(d, r);
      if (canPlace(busca, 'marketplace', p.gx, p.gy, gameData).ok) lugar = p;
    }
  }
  if (lugar === null) throw new Error('fixture: a feira nao coube');
  const feira = completarObra({ lado: LADO_DO_JOGADOR, id: 'feira', tipo: 'marketplace', ...lugar, estado: 'obra', hp: 550, obra: { faltam: {}, nivelamento: 0 } }, gameData);
  s = { ...s, predios: { porId: { ...s.predios.porId, feira }, ordem: [...s.predios.ordem, 'feira'] } };
  const armazem = armazemDe(s);
  const porta = tilesDaPorta(feira, gameData)[0] as { gx: number; gy: number };
  const rua = buscarCaminho(s, porta, tilesDaPorta(armazem, gameData), 'livre', gameData);
  if (rua === null) throw new Error('fixture: sem rua');
  s = { ...s, estradas: { ...s.estradas, ...Object.fromEntries([porta, ...rua.tiles].map((t) => [chaveDeTile(t), true as const])) } };
  if (!predioLigadoAoArmazem(s, feira, gameData)) throw new Error('fixture: feira nao ligada');
  const comEstoque: PredioCompleto = { ...armazem, estoque: { ...armazem.estoque, saida: { ...armazem.estoque.saida, [A]: a, [B]: b } } };
  s = { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [armazem.id]: comEstoque } } };
  const unidades = { porId: { ...s.unidades.porId }, ordem: [...s.unidades.ordem] };
  const portaDoArmazem = tilesDaPorta(armazem, gameData).find((t) => tileAndavel(s, t, 'livre', gameData)) as { gx: number; gy: number };
  for (let i = 0; i < serfsExtras; i += 1) {
    const u: Unidade = { lado: LADO_DO_JOGADOR, id: `serf-extra${i}`, tipo: 'serf', ...portaDoArmazem, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('serf') };
    unidades.porId[u.id] = u;
    unidades.ordem.push(u.id);
  }
  return { ...s, unidades };
}

const ordem = (quantidade: number, da = A, para = B): Command => ({ type: 'SetTrade', predio: 'feira', da, para, quantidade });

/** A no mundo: saida do armazem, as duas gavetas da feira e as maos dos serfs. */
function aNoMundo(s: GameState): number {
  const arm = armazemDe(s);
  const f = feiraDe(s);
  const nasMaos = s.unidades.ordem.filter((id) => s.unidades.porId[id]?.fsmData.carga === A).length;
  return (arm.estoque.saida[A] ?? 0) + (arm.estoque.entrada[A] ?? 0) + (f.estoque.entrada[A] ?? 0) + (f.estoque.saida[A] ?? 0) + nasMaos;
}
/** B no mundo: saida do armazem, a gaveta de saida da feira e as maos dos serfs. */
function bNoMundo(s: GameState): number {
  const nasMaos = s.unidades.ordem.filter((id) => s.unidades.porId[id]?.fsmData.carga === B).length;
  return (armazemDe(s).estoque.saida[B] ?? 0) + (armazemDe(s).estoque.entrada[B] ?? 0) + (feiraDe(s).estoque.saida[B] ?? 0) + nasMaos;
}
const feitas = (s: GameState): number => feiraDe(s).troca?.feitas ?? 0;

describe('F35 — a Feira', () => {
  it('o dado: taxa 2 para 1, no maximo 10 serfs', () => {
    expect([TAXA, MAX]).toEqual([2, 10]);
  });

  it('(a) B chega ao armazem, e o A debitado e taxa x o B creditado', () => {
    let s = step(vilaComFeira(20, 0), [ordem(3)], gameData);
    const a0 = aNoMundo(s);
    const violacoes: string[] = [];
    for (let t = 0; t < 3000 && (armazemDe(s).estoque.saida[B] ?? 0) < 3; t += 1) {
      s = step(s, [], gameData);
      violacoes.push(...violacoesDeInvariantes(s, gameData));
      expect(aNoMundo(s) + TAXA * feitas(s)).toBe(a0);
    }
    expect(violacoes).toEqual([]);
    expect(armazemDe(s).estoque.saida[B]).toBe(3);
    expect(feitas(s)).toBe(3);
    expect(a0 - aNoMundo(s)).toBe(TAXA * 3);
    expect(porQueNaoTroca(feiraDe(s))).toBe('ordem-cumprida');
    gravarEvidencia('F35-troca', { taxa: TAXA, bNoArmazem: 3, aDebitado: a0 - aNoMundo(s), tick: s.tick });
  });

  it('(b) nunca mais de maxSerfs tarefas da feira em curso, com 20 serfs ociosos', () => {
    let s = step(vilaComFeira(60, 0, 20), [ordem(30)], gameData);
    let maior = 0;
    for (let t = 0; t < 1500; t += 1) {
      s = step(s, [], gameData);
      const n = serfsNaFeira(s, 'feira');
      expect(n).toBeLessThanOrEqual(MAX);
      maior = Math.max(maior, n);
    }
    expect(maior).toBe(MAX); // o teto chegou a morder
    gravarEvidencia('F35-teto', { maxSerfs: MAX, maiorNoMesmoTick: maior });
  });

  it('(c) sem A no armazem, nada acontece, e o motivo e o do painel', () => {
    let s = step(vilaComFeira(0, 0), [ordem(3)], gameData);
    for (let t = 0; t < 500; t += 1) s = step(s, [], gameData);
    expect(feitas(s)).toBe(0);
    expect(armazemDe(s).estoque.saida[B] ?? 0).toBe(0);
    expect(porQueNaoTroca(feiraDe(s))).toBe('sem-mercadoria');
  });

  it('(d) cancelar com A a caminho nao perde A: tudo volta ao armazem', () => {
    let s = step(vilaComFeira(20, 0), [ordem(8)], gameData);
    const a0 = aNoMundo(s);
    // anda ate haver A nos dois lugares que o cancelamento pode perder: na gaveta de
    // entrada da feira (menos que a taxa, a troca ainda nao fechou) e na mao de um serf
    const naMao = (x: GameState): boolean => x.unidades.ordem.some((id) => x.unidades.porId[id]?.fsmData.carga === A);
    const naGaveta = (x: GameState): number => feiraDe(x).estoque.entrada[A] ?? 0;
    for (let t = 0; t < 1500 && !(naMao(s) && naGaveta(s) > 0); t += 1) s = step(s, [], gameData);
    expect([naMao(s), naGaveta(s) > 0]).toEqual([true, true]);
    s = step(s, [ordem(0)], gameData);
    expect(feiraDe(s).troca).toBeUndefined();
    // B comeca em zero, entao B no mundo = trocas feitas: A + taxa x B e constante a cada tick
    expect(aNoMundo(s) + TAXA * bNoMundo(s)).toBe(a0);
    for (let t = 0; t < 2000; t += 1) {
      s = step(s, [], gameData);
      expect(aNoMundo(s) + TAXA * bNoMundo(s)).toBe(a0);
    }
    // nada em maos nem na feira: todo o A que nao virou troca voltou ao armazem
    expect(feiraDe(s).estoque.entrada[A] ?? 0).toBe(0);
    expect(s.unidades.ordem.some((id) => s.unidades.porId[id]?.fsmData.carga === A)).toBe(false);
    expect(armazemDe(s).estoque.saida[A]).toBe(a0 - TAXA * bNoMundo(s));
  });

  it('recusas com motivo, e o estado fica igual', () => {
    const s0 = vilaComFeira(10, 0);
    const armazem = armazemDe(s0).id;
    const casos: [Command, string][] = [
      [{ type: 'SetTrade', predio: armazem, da: A, para: B, quantidade: 1 }, 'predio-nao-e-feira'],
      [ordem(1, A, A), 'mesma-mercadoria'],
      [ordem(1, 'ouro-de-tolo', B), 'mercadoria-desconhecida'],
      [ordem(-1), 'quantidade-invalida'],
      [ordem(1.5), 'quantidade-invalida'],
    ];
    for (const [cmd, motivo] of casos) {
      const r = step(s0, [cmd], gameData);
      expect(r.events.find((e) => e.type === 'command-rejected'), motivo).toMatchObject({ command: 'SetTrade', motivo });
      expect(salvar({ ...r, events: [] })).toBe(salvar({ ...step(s0, [], gameData), events: [] }));
    }
  });

  it('a mesma corrida duas vezes da o mesmo estado; e grava a partida do roteiro', () => {
    const correr = (): GameState => {
      let s = step(vilaComFeira(20, 0), [ordem(3)], gameData);
      for (let t = 0; t < 600; t += 1) s = step(s, [], gameData);
      return s;
    };
    expect(salvar(correr())).toBe(salvar(correr()));
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F35.save.txt`, salvar(step(vilaComFeira(0, 0), [ordem(3)], gameData)));
  });
});
