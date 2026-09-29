/**
 * C-COMBATE-01a — formação e virar (docs/planos/2026-09-29-C-COMBATE-01a-formacao-e-virar.md).
 * `MoveUnits` com `colunas` e `direcao`: fileiras de frente para a direcao, o lider no meio
 * da primeira, e todos virados ao chegar. "Virar sem mover" e o mesmo comando no tile do lider.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { direcaoAproximada } from '../src/sim/combate';
import { colunasDaFormacao, tilesDaFormacao, vagasPorProximidade } from '../src/sim/systems/marcha';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const NORTE = 0;
const LESTE = 2;
const SUL = 4;
const OESTE = 6;

const base: GameState = { ...createInitialState(1), unidades: { porId: {}, ordem: [] } };
const destino = naVila(8, 12);

function comSoldados(s: GameState, n: number, perto: { gx: number; gy: number }): { s: GameState; ids: string[] } {
  const porId: Record<string, Unidade> = { ...s.unidades.porId };
  const ordem = [...s.unidades.ordem];
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const id = `sold${i}`;
    porId[id] = {
      lado: LADO_DO_JOGADOR, id, tipo: 'militia', gx: perto.gx - 6 + i, gy: perto.gy - 6,
      fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia'),
    };
    ordem.push(id);
    ids.push(id);
  }
  return { s: { ...s, unidades: { porId, ordem } }, ids };
}

const mover = (unidades: readonly string[], d: { gx: number; gy: number }, extra: Partial<Command> = {}): Command =>
  ({ type: 'MoveUnits', unidades, destino: d, ...extra }) as Command;

function andarAteParar(s0: GameState, ids: readonly string[], limite = 600): GameState {
  let s = s0;
  for (let i = 0; i < limite; i += 1) {
    s = step(s, [], gameData);
    if (ids.every((id) => s.unidades.porId[id]?.fsm === 'ocioso')) return s;
  }
  return s;
}

const chave = (t: { gx: number; gy: number }): string => `${t.gx},${t.gy}`;
/** As vagas como conjunto: quem vai para qual e por proximidade (`vagasPorProximidade`). */
const conjunto = (ts: readonly { gx: number; gy: number }[]): string[] => ts.map(chave).sort();

describe('C-COMBATE-01a — o desenho da formacao', () => {
  it('6 homens em 3 colunas: duas fileiras, a da frente centrada no destino, o lider no meio', () => {
    const d = destino;
    // pre-condicao: o quadrado 5x5 em volta do destino anda (senao o desenho desvia)
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
      expect(tileAndavel(base, { gx: d.gx + dx, gy: d.gy + dy }, 'livre', gameData)).toBe(true);
    }
    const sul = tilesDaFormacao(base, d, 6, SUL, 3, gameData).map((t) => [t.gx - d.gx, t.gy - d.gy]);
    // de frente para o sul, a direita de quem olha e o oeste; a fileira de tras fica ao norte
    expect(sul).toEqual([[0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]]);
    const leste = tilesDaFormacao(base, d, 6, LESTE, 3, gameData).map((t) => [t.gx - d.gx, t.gy - d.gy]);
    expect(leste).toEqual([[0, 0], [0, 1], [0, -1], [-1, 0], [-1, 1], [-1, -1]]);
    // fileira incompleta: 5 em 3 colunas, os 2 de tras do meio para fora
    const cinco = tilesDaFormacao(base, d, 5, NORTE, 3, gameData).map((t) => [t.gx - d.gx, t.gy - d.gy]);
    expect(cinco).toEqual([[0, 0], [1, 0], [-1, 0], [0, 1], [1, 1]]);
    gravarEvidencia('C-COMBATE-01a-desenho', { sul, leste, cinco });
  });

  it('colunas se prende a [colunasMin, n]; ausente, a raiz de n para cima', () => {
    expect(colunasDaFormacao(0, 5, gameData)).toBe(gameData.combate.formacao.colunasMin);
    expect(colunasDaFormacao(99, 5, gameData)).toBe(5);
    expect(colunasDaFormacao(undefined, 9, gameData)).toBe(3);
    expect(colunasDaFormacao(undefined, 10, gameData)).toBe(4);
    const fila = tilesDaFormacao(base, destino, 3, SUL, colunasDaFormacao(0, 3, gameData), gameData);
    expect(fila.map((t) => [t.gx - destino.gx, t.gy - destino.gy])).toEqual([[0, 0], [0, -1], [0, -2]]);
  });

  it('a direcao padrao e o octante mais proximo, nao so o sinal', () => {
    expect(direcaoAproximada({ gx: 0, gy: 0 }, { gx: 16, gy: 1 })).toBe(LESTE);
    expect(direcaoAproximada({ gx: 0, gy: 0 }, { gx: 5, gy: 5 })).toBe(3);
    expect(direcaoAproximada({ gx: 0, gy: 0 }, { gx: -1, gy: -9 })).toBe(NORTE);
    expect(direcaoAproximada({ gx: 3, gy: 3 }, { gx: 3, gy: 3 })).toBeNull();
  });
});

describe('C-COMBATE-01a — pelo step', () => {
  it('recusa direcao fora de 0..7 e colunas nao inteiras, sem mudar o estado', () => {
    const { s, ids } = comSoldados(base, 3, destino);
    for (const [extra, motivo] of [
      [{ direcao: 8 }, 'direcao-invalida'], [{ direcao: 1.5 }, 'direcao-invalida'],
      [{ colunas: 1.5 }, 'colunas-invalidas'], [{ colunas: Number.NaN }, 'colunas-invalidas'],
    ] as const) {
      const depois = step(s, [mover(ids, destino, extra)], gameData);
      expect(depois.events).toContainEqual(expect.objectContaining({ type: 'command-rejected', command: 'MoveUnits', motivo }));
      expect(ids.every((id) => depois.unidades.porId[id]?.fsm === 'ocioso')).toBe(true);
    }
  });

  it('6 soldados marcham em 3 colunas para o leste, param no desenho e viram para o leste', () => {
    const { s: s0, ids } = comSoldados(base, 6, destino);
    const esperado = tilesDaFormacao(s0, destino, 6, LESTE, 3, gameData);
    const s = andarAteParar(step(s0, [mover(ids, destino, { colunas: 3, direcao: LESTE })], gameData), ids);
    const us = ids.map((id) => s.unidades.porId[id] as Unidade);
    expect(us.map((u) => u.fsm)).toEqual(ids.map(() => 'ocioso'));
    expect(conjunto(us)).toEqual(conjunto(esperado));
    expect(chave(us[0] as Unidade)).toBe(chave(destino)); // o lider no meio da frente
    expect(new Set(us.map(chave)).size).toBe(6);
    expect(us.map((u) => u.direcao)).toEqual(ids.map(() => LESTE));

    // virar sem mover: o destino no lider, direcao oeste
    const lider = us[0] as Unidade;
    const virar = step(s, [mover(ids, lider, { colunas: 3, direcao: OESTE })], gameData);
    const lido = virar.unidades.porId[ids[0] as string] as Unidade;
    expect(chave(lido)).toBe(chave(lider));
    const v = andarAteParar(virar, ids);
    const virados = ids.map((id) => v.unidades.porId[id] as Unidade);
    expect(chave(virados[0] as Unidade)).toBe(chave(lider));
    expect(virados.map((u) => u.direcao)).toEqual(ids.map(() => OESTE));
    expect(conjunto(virados)).toEqual(conjunto(tilesDaFormacao(s, lider, 6, OESTE, 3, gameData)));
    gravarEvidencia('C-COMBATE-01a', {
      destino, leste: us.map((u) => [u.gx, u.gy, u.direcao]), tickLeste: s.tick,
      virouParaOeste: virados.map((u) => [u.gx, u.gy, u.direcao]), tickVirou: v.tick,
    });
  });

  it('sem os campos: a formacao vira para onde o lider anda, em ⌈√n⌉ colunas', () => {
    const { s: s0, ids } = comSoldados(base, 4, destino);
    const lider = s0.unidades.porId[ids[0] as string] as Unidade;
    const direcao = direcaoAproximada(lider, destino) as number;
    const s = andarAteParar(step(s0, [mover(ids, destino)], gameData), ids);
    const us = ids.map((id) => s.unidades.porId[id] as Unidade);
    expect(conjunto(us)).toEqual(conjunto(tilesDaFormacao(s0, destino, 4, direcao, 2, gameData)));
    expect(us.map((u) => u.direcao)).toEqual(ids.map(() => direcao));
  });

  it('tile do desenho sem andar: ninguem fica nele, ninguem empilha, todos param', () => {
    const { s: s0, ids } = comSoldados(base, 6, destino);
    // uma arvore no tile do homem 1 (a direita do lider, virado para o sul)
    const bloqueado = { gx: destino.gx - 1, gy: destino.gy };
    const comArvore: GameState = { ...s0, recursos: { ...s0.recursos, [chave(bloqueado)]: { tipo: 'tree', quantidade: 5 } } };
    expect(tileAndavel(comArvore, bloqueado, 'livre', gameData)).toBe(false);
    const s = andarAteParar(step(comArvore, [mover(ids, destino, { colunas: 3, direcao: SUL })], gameData), ids);
    const us = ids.map((id) => s.unidades.porId[id] as Unidade);
    expect(us.map((u) => u.fsm)).toEqual(ids.map(() => 'ocioso'));
    expect(us.map(chave)).not.toContain(chave(bloqueado));
    expect(new Set(us.map(chave)).size).toBe(6);
  });
});

describe('C-COMBATE-01a — as vagas por proximidade', () => {
  it('o lider fica com a vaga 0; virar 180 graus nao troca os homens de lado', () => {
    const vagas = [{ gx: 0, gy: 0 }, { gx: 0, gy: -1 }, { gx: 0, gy: 1 }];
    // o homem 1 esta ao sul: por indice iria ao norte, atravessando o lider
    expect(vagasPorProximidade([{ gx: 0, gy: 0 }, { gx: 0, gy: 1 }, { gx: 0, gy: -1 }], vagas))
      .toEqual([{ gx: 0, gy: 0 }, { gx: 0, gy: 1 }, { gx: 0, gy: -1 }]);
    // o lider longe continua com a vaga 0
    expect(vagasPorProximidade([{ gx: 9, gy: 9 }, { gx: 0, gy: 0 }], vagas.slice(0, 2))[0]).toEqual({ gx: 0, gy: 0 });
  });
});
