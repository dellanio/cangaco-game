/**
 * I-PRODUCAO-ACUDE-PREDIO — o Acude no dado, no menu e no mapa (plano docs/planos/2026-10-05-acude-e-clima.md,
 * etapa 3; as escolhas conservadoras no BUILD_PLAN.md). Pelo `step`: liberado pela Pedreira, plantado,
 * construido e completado; sem trabalhador.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { painelDoPredio } from '../src/sim/selectors';
import { trabalhadorDoTipo } from '../src/sim/ocupacao';
import { gravarEvidencia } from './helpers/evidence';

const ACUDE = { gx: 38, gy: 29 };
/** A rua da porta (a borda sul, linha 32) ate o armazem, na mesma linha da rua da Igreja (33). */
const RUA = [...Array.from({ length: 41 - 29 }, (_, i) => ({ gx: 29 + i, gy: 33 })), ...Array.from({ length: 4 }, (_, i) => ({ gx: 38 + i, gy: 32 }))];
const comPedreiraConstruida = (s: GameState): GameState => ({ ...s, tiposJaConstruidos: [...s.tiposJaConstruidos, 'quarry'] });

describe('I-PRODUCAO-ACUDE-PREDIO', () => {
  it('o dado: 4x3, sem trabalhador, liberado pela Pedreira, na sub-aba De Comer e com nome no tema', () => {
    const def = gameData.predios.find((p) => p.id === 'reservoir');
    expect(def).toMatchObject({ tamanho: [4, 3], desbloqueadoPor: 'quarry', trabalhador: null });
    expect(trabalhadorDoTipo('reservoir')).toBeNull();
    const menu = JSON.parse(readFileSync('data/menu-build.json', 'utf8')) as { grupos: { id: string; predios: string[] }[] };
    expect(menu.grupos.find((g) => g.id === 'comida')?.predios).toContain('reservoir');
    const tema = JSON.parse(readFileSync('data/theme-sertao.json', 'utf8')) as { predios: Record<string, { nome: string }> };
    expect(tema.predios['reservoir']?.nome).toBe('Açude');
  });

  it('(1) sem a Pedreira, a planta e recusada pelo desbloqueio; com ela, planta, constroi e completa pelo step', () => {
    const base = createInitialState(gameData.economia.estadoInicial.semente);
    expect(canPlace(base, 'reservoir', ACUDE.gx, ACUDE.gy)).toEqual({ ok: false, motivo: 'bloqueado' });
    let s = comPedreiraConstruida(base);
    expect(canPlace(s, 'reservoir', ACUDE.gx, ACUDE.gy)).toEqual({ ok: true });
    s = step(s, [{ type: 'PlaceRoad', tiles: RUA }, { type: 'PlaceBlueprint', buildingId: 'reservoir', ...ACUDE }]);
    const id = s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === 'reservoir')!;
    expect(id).toBeDefined();
    let t = 0;
    while (s.predios.porId[id]?.estado !== 'completo' && t < 9000) { s = step(s, []); t++; }
    expect(s.predios.porId[id]?.estado).toBe('completo');
    // (2) sem trabalhador: o painel nao oferece um, e ninguem e chamado para ocupar
    const painel = painelDoPredio(s, id);
    expect(painel).not.toBeNull();
    expect(JSON.stringify(painel)).not.toMatch(/"ocupante":"[^"]/);
    expect(s.jobs.tarefas.ordem.map((k) => s.jobs.tarefas.porId[k]).filter((x) => x?.tipo === 'ocupar' && 'destino' in x && x.destino === id)).toEqual([]);
    gravarEvidencia('I-PRODUCAO-ACUDE-PREDIO', { ticksAteCompletar: t });
  }, 60_000);
});
