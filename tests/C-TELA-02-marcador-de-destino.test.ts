/**
 * C-TELA-02 — o marcador de destino (plano em docs/planos/2026-09-29-C-TELA-02-marcador-de-destino.md).
 * A marca no tile do destino desbota e some em `segundosDoMarcador`; a recusa da paz a apaga.
 */
import { describe, expect, it } from 'vitest';
import { marcadorVisivel } from '../src/render/marcador-de-destino';
import { recusaDaPaz } from '../src/ui/aviso-de-ordem';
import { gameData } from '../src/sim/data';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import temaSertao from '../data/theme-sertao.json';
import { gravarEvidencia } from './helpers/evidence';

const DURACAO = temaSertao.ordem.segundosDoMarcador * 1000;
const tile = { gx: 10, gy: 12 };
const marca = { tile, desdeMs: 5000 };

describe('C-TELA-02 — o marcador de destino', () => {
  it('a duracao e ~1 s, do tema', () => {
    expect(DURACAO).toBe(1000);
  });

  it('no clique: visivel, fracao 0', () => {
    expect(marcadorVisivel(marca, 5000, DURACAO)).toEqual({ tile, fracao: 0 });
  });

  it('na metade: fracao 0,5', () => {
    expect(marcadorVisivel(marca, 5000 + DURACAO / 2, DURACAO)?.fracao).toBe(0.5);
  });

  it('no fim e depois: some', () => {
    expect(marcadorVisivel(marca, 5000 + DURACAO, DURACAO)).toBeNull();
    expect(marcadorVisivel(marca, 5000 + 10 * DURACAO, DURACAO)).toBeNull();
    expect(marcadorVisivel(null, 5000, DURACAO)).toBeNull();
  });

  it('a recusa da paz (a que apaga a marca) vem do step real; a ordem aceita nao apaga', () => {
    const s0 = criarEscaramuca(gameData.economia.estadoInicial.semente);
    const tropa = s0.unidades.ordem.filter((id) => s0.unidades.porId[id]?.lado === LADO_DO_JOGADOR && s0.unidades.porId[id]?.tipo === gameData.escaramuca.tropaDoJogador.tipo);
    const frente = (gameData.escaramuca.posicoes.find((p) => p.id === 'frente') as { ponto: { gx: number; gy: number } }).ponto;
    const u = s0.unidades.porId[tropa[0] as string];
    // C-COMBATE-02b: a marcha em paz passa, longe ou perto; a recusa da paz e a do ataque
    const alvo = s0.unidades.ordem.find((id) => s0.unidades.porId[id]?.lado !== LADO_DO_JOGADOR) as string;
    const ataque = step(s0, [{ type: 'AttackUnit', unidades: tropa, alvo }], gameData);
    const longe = step(s0, [{ type: 'MoveUnits', unidades: tropa, destino: { gx: frente.gx - 7, gy: frente.gy - 7 } }], gameData);
    const perto = step(s0, [{ type: 'MoveUnits', unidades: tropa, destino: { gx: u?.gx ?? 0, gy: (u?.gy ?? 0) + 1 } }], gameData);
    expect(recusaDaPaz(ataque.events)).toBe('em-paz');
    expect(recusaDaPaz(longe.events)).toBeNull();
    expect(recusaDaPaz(perto.events)).toBeNull();
    const semFome = { type: 'command-rejected', command: 'FeedUnits', unidade: null, motivo: 'sem-fome' } as unknown as GameEvent;
    expect(recusaDaPaz([semFome])).toBeNull();
    gravarEvidencia('C-TELA-02', { duracaoMs: DURACAO, ataque: recusaDaPaz(ataque.events), longe: recusaDaPaz(longe.events), perto: recusaDaPaz(perto.events) });
  });
});
