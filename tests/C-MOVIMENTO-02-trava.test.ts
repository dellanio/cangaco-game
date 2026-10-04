/**
 * C-MOVIMENTO-02 — a tropa ainda travava ao andar (plano em
 * docs/planos/2026-09-29-C-MOVIMENTO-02-a-tropa-trava.md). Duas causas medidas na escaramuca:
 *  1. a vaga EMPAREDADA: a formacao encheu as vagas de fora antes das de dentro, e quem ia
 *     para a de dentro esperava para sempre (2 de 18 nunca chegavam, 2774 ticks parados);
 *  2. a ordem NO MEIO DO PASSO zerava o `progresso`: o desenho saltava para tras (11 saltos
 *     numa reordenacao da tropa de 18).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { escaramucaComTropaDe, TROPA_DOS_TESTES_DE_FORMACAO } from './helpers/escaramuca-paz';
import { posicaoDaUnidade } from '../src/sim/selectors';
import { gravarEvidencia } from './helpers/evidence';

// a tropa fixa de 18: o mecanismo foi medido com ela (I-COMBATE-ESCARAMUCA-GANHAVEL)
const s0 = escaramucaComTropaDe(TROPA_DOS_TESTES_DE_FORMACAO, gameData.economia.estadoInicial.semente);
const tropa = s0.unidades.ordem.filter((id) => s0.unidades.porId[id]?.lado === LADO_DO_JOGADOR && s0.unidades.porId[id]?.tipo === gameData.escaramuca.tropaDoJogador.tipo);
const lider = s0.unidades.porId[tropa[0] as string] as Unidade;
const mover = (destino: { gx: number; gy: number }): Command => ({ type: 'MoveUnits', unidades: tropa, destino });
const chave = (t: { gx: number; gy: number }): string => `${t.gx},${t.gy}`;
const marchando = (s: GameState): number => tropa.filter((id) => s.unidades.porId[id]?.fsm === 'marchando').length;

describe('C-MOVIMENTO-02 — a tropa nao trava', () => {
  it('1. a vaga de dentro da formacao nao fica emparedada: os 18 chegam, nas 18 vagas', () => {
    const destino = { gx: lider.gx, gy: lider.gy + 20 };
    let s = step(s0, [mover(destino)], gameData);
    // as vagas que a ordem distribuiu: a troca permuta quem fica em qual, nao o conjunto
    const vagas = tropa.map((id) => chave(s.unidades.porId[id]?.fsmData.alvoTile as { gx: number; gy: number })).sort();
    let t = 1;
    for (; t < 1500 && marchando(s) > 0; t += 1) s = step(s, [], gameData);
    const onde = tropa.map((id) => chave(s.unidades.porId[id] as Unidade)).sort();
    gravarEvidencia('C-MOVIMENTO-02-emparedada', { destino, ticks: t, marchando: marchando(s), onde, vagas, fora: tropa.map((id) => s.unidades.porId[id] as Unidade).filter((u) => u.fsmData.alvoTile !== undefined && chave(u.fsmData.alvoTile) !== chave(u)).map((u) => [u.id, chave(u), u.fsm, u.fsmData]) });
    expect(marchando(s)).toBe(0);
    expect(onde).toEqual(vagas);
  });

  it('2. a ordem no meio do passo termina o passo: nenhum salto desenhado para tras', () => {
    let s = step(s0, [mover({ gx: lider.gx + 20, gy: lider.gy + 10 })], gameData);
    let saltos = 0;
    let noMeio = 0;
    for (let t = 1; t < 400; t += 1) {
      const antes = s;
      // a segunda ordem, para tras, com a tropa andando
      s = step(s, t === 60 ? [mover({ gx: lider.gx - 5, gy: lider.gy + 20 })] : [], gameData);
      for (const id of tropa) {
        const a = antes.unidades.porId[id] as Unidade;
        const b = s.unidades.porId[id] as Unidade;
        const pa = posicaoDaUnidade(antes, a);
        const pb = posicaoDaUnidade(s, b);
        if (t === 60 && (a.fsmData.progresso ?? 0) > 0) noMeio += 1;
        // no mesmo tile, o desenho so anda para a frente: meio tile de uma vez e o salto
        if (a.gx === b.gx && a.gy === b.gy && Math.hypot(pb.gx - pa.gx, pb.gy - pa.gy) > 0.5) saltos += 1;
      }
    }
    gravarEvidencia('C-MOVIMENTO-02-reordem', { noMeioDoPassoNaOrdem: noMeio, saltos, marchando: marchando(s) });
    // o caso vale: a ordem pegou gente no meio do passo
    expect(noMeio).toBeGreaterThan(0);
    expect(saltos).toBe(0);
    expect(marchando(s)).toBe(0);
  });

  it('3. a mesma corrida duas vezes da o mesmo estado', () => {
    const correr = (): GameState => {
      let s = step(s0, [mover({ gx: lider.gx, gy: lider.gy + 20 })], gameData);
      for (let t = 0; t < 300; t += 1) s = step(s, t === 40 ? [mover({ gx: lider.gx + 8, gy: lider.gy + 12 })] : [], gameData);
      return s;
    };
    expect(JSON.stringify(correr())).toBe(JSON.stringify(correr()));
  });
});
