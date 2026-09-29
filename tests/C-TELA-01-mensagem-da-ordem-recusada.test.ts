/**
 * C-TELA-01 — a mensagem da ordem recusada (plano em
 * docs/planos/2026-09-29-C-TELA-01-mensagem-da-ordem-recusada.md). O operador: "'Longe demais
 * na paz' e diferente de 'Em paz — faltam mm:ss'". Os eventos vem de `step` de verdade na
 * escaramuca, nao de evento montado a mao.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { segundosDePazRestantes } from '../src/sim/paz';
import { textoDaRecusa } from '../src/ui/aviso-de-ordem';
import temaSertao from '../data/theme-sertao.json';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
const FRENTE = (gameData.escaramuca.posicoes.find((p) => p.id === 'frente') as { ponto: { gx: number; gy: number } }).ponto;
const LONGE = { gx: FRENTE.gx - 7, gy: FRENTE.gy - 7 };

const s0 = criarEscaramuca(SEMENTE);
const tropa = s0.unidades.ordem.filter((id) => s0.unidades.porId[id]?.lado === LADO_DO_JOGADOR && s0.unidades.porId[id]?.tipo === gameData.escaramuca.tropaDoJogador.tipo);
const armazemDaIA = s0.predios.ordem.find((id) => s0.predios.porId[id]?.lado === LADO_DA_IA && s0.predios.porId[id]?.tipo === 'storehouse') as string;
const texto = (s: GameState): string | null => textoDaRecusa(s.events, segundosDePazRestantes(s));
const passo = (c: Command): GameState => step(s0, [c], gameData);

describe('C-TELA-01 — a mensagem da ordem recusada', () => {
  it('marcha fora da cerca, em paz: "Longe demais na paz"', () => {
    expect(texto(passo({ type: 'MoveUnits', unidades: tropa, destino: LONGE }))).toBe(temaSertao.ordem.longeNaPaz);
    expect(temaSertao.ordem.longeNaPaz).toBe('Longe demais na paz');
  });

  it('ataque em paz: "Em paz — faltam mm:ss", com o tempo que falta', () => {
    const s = passo({ type: 'AttackBuilding', unidades: tropa, predio: armazemDaIA });
    const t = texto(s);
    const seg = segundosDePazRestantes(s);
    expect(seg).toBeGreaterThan(0);
    expect(t).toBe(`Em paz — faltam ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`);
    gravarEvidencia('C-TELA-01', { longe: texto(passo({ type: 'MoveUnits', unidades: tropa, destino: LONGE })), emPaz: t });
  });

  it('as duas mensagens sao diferentes', () => {
    const longe = texto(passo({ type: 'MoveUnits', unidades: tropa, destino: LONGE }));
    const ataque = texto(passo({ type: 'AttackBuilding', unidades: tropa, predio: armazemDaIA }));
    expect(longe).not.toBeNull();
    expect(ataque).not.toBeNull();
    expect(longe).not.toBe(ataque);
  });

  it('ordem aceita, tick sem recusa e recusa de outro comando: nada', () => {
    expect(texto(step(s0, [], gameData))).toBeNull();
    const semFome: GameEvent = { type: 'command-rejected', command: 'FeedUnits', unidade: null, motivo: 'sem-fome' } as unknown as GameEvent;
    expect(textoDaRecusa([semFome], 600)).toBeNull();
  });

  it('dois motivos no mesmo tick: o ultimo vence', () => {
    const s = step(s0, [
      { type: 'AttackBuilding', unidades: tropa, predio: armazemDaIA },
      { type: 'MoveUnits', unidades: tropa, destino: LONGE },
    ], gameData);
    expect(s.events.filter((e) => e.type === 'command-rejected')).toHaveLength(2);
    expect(texto(s)).toBe(temaSertao.ordem.longeNaPaz);
  });
});
