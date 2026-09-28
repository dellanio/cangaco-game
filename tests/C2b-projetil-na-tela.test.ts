/**
 * C2b — o projetil no ar, na tela (plano em docs/planos/2026-09-28-C2b-projetil-na-tela.md).
 * Aceite (a), headless: a fracao vai de 0 no lancamento a 1 na chegada; o meio fica na
 * metade da reta, com a altura maxima; as pontas tem altura 0; o `alfa` avanca dentro do
 * tick. Grava a partida do roteiro `tools/shots/C2.js` (aceite b).
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Projetil, Unidade } from '../src/sim/state';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { ALTURA_DO_ARCO, posicaoDoProjetil } from '../src/render/projeteis';
import { naVila } from './helpers/ancoras';

const flecha = (voo: number, restantes: number): Projetil => ({
  projetil: 'flecha', de: { id: 'a', tipo: 'bowman', lado: 0, gx: 10, gy: 20 },
  origem: { gx: 10, gy: 20 }, alvoTile: { gx: 10, gy: 14 }, voo, restantes,
});

describe('C2b — o projetil no ar, na tela', () => {
  it('(a) fracao 0 no lancamento, 1 na chegada; o meio na metade da reta e no alto do arco', () => {
    const lancado = posicaoDoProjetil(flecha(6, 6), 0);
    expect(lancado).toMatchObject({ fracao: 0, gx: 10.5, gy: 20.5, altura: 0 });
    const chegando = posicaoDoProjetil(flecha(6, 1), 1);
    expect(chegando.fracao).toBe(1);
    expect(chegando.gy).toBeCloseTo(14.5, 10);
    expect(chegando.altura).toBeCloseTo(0, 10);
    const meio = posicaoDoProjetil(flecha(6, 3), 0);
    expect(meio.fracao).toBe(0.5);
    expect(meio.gy).toBeCloseTo(17.5, 10);
    expect(meio.altura).toBeCloseTo(ALTURA_DO_ARCO * 6, 10);
  });

  it('o alfa avanca dentro do tick, e a fracao nunca sai de [0, 1]', () => {
    const a = posicaoDoProjetil(flecha(6, 4), 0);
    const b = posicaoDoProjetil(flecha(6, 4), 0.5);
    expect(b.fracao).toBeGreaterThan(a.fracao);
    expect(posicaoDoProjetil(flecha(6, 0), 1).fracao).toBe(1);
    expect(posicaoDoProjetil(flecha(6, 7), 0).fracao).toBe(0);
  });

  it('a pedra sai do centro que a tela passa (o meio do lote da torre)', () => {
    const p = posicaoDoProjetil({ ...flecha(4, 4), projetil: 'pedraDaTorre' }, 0, { gx: 11, gy: 21 });
    expect(p).toMatchObject({ gx: 11, gy: 21 });
  });

  it('grava o duelo do roteiro: arqueiro olhando ao norte, alvo a 6 tiles, sem civis', () => {
    const base: GameState = { ...createInitialState(1), unidades: { porId: {}, ordem: [] } };
    let c: { gx: number; gy: number } | null = null;
    for (let r = 6; r < 40 && c === null; r += 1) {
      for (let d = -r; d <= r && c === null; d += 1) {
        const t = naVila(d, r);
        if ([0, 1, 2, 3, 4, 5, 6].every((k) => tileAndavel(base, { gx: t.gx, gy: t.gy - k }, 'livre', gameData))) c = t;
      }
    }
    if (c === null) throw new Error('fixture: sem campo');
    const u = (id: string, tipo: string, lado: number, t: { gx: number; gy: number }, extra: Partial<Unidade> = {}): Unidade =>
      ({ lado, id, tipo, gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tipo), ...extra });
    const duelo: GameState = {
      ...base,
      unidades: {
        porId: { arq: u('arq', 'bowman', LADO_DO_JOGADOR, c, { direcao: 0 }), alvo: u('alvo', 'militia', LADO_DO_JOGADOR + 1, { gx: c.gx, gy: c.gy - 6 }, { hp: 9999 }) },
        ordem: ['arq', 'alvo'],
      },
    };
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/C2.save.txt`, salvar(duelo));
  });
});
