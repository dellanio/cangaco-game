/**
 * I-OBRA-RUA-TRES-BATIDAS — o tile de rua tem tempo proprio, de pelo menos tres ciclos da animacao de trabalho
 * do obreiro. Aceite no BUILD_PLAN.md.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { chaveDeTile, tilesDaPorta } from '../src/sim/estradas';
import { inicial, tile } from './helpers/jobs-cenario';
import { gravarEvidencia } from './helpers/evidence';

const TETO = 600;
const BATIDAS_MINIMAS = 3;

const armazem = (() => {
  const p = inicial.predios.ordem.map((id) => inicial.predios.porId[id]).find((x) => x?.tipo === 'storehouse');
  if (!p) throw new Error('fixture: cenario sem armazem');
  return p;
})();
const porta = tilesDaPorta(armazem, gameData)[0];
if (porta === undefined) throw new Error('fixture: armazem sem porta');
/** Um tile so, logo abaixo da porta do armazem. */
const ALVO = tile(porta.gx, porta.gy + 1);

/** O obreiro que assenta o ALVO, se houver. */
function quemAssenta(e: GameState): string | null {
  for (const id of e.unidades.ordem) {
    const u = e.unidades.porId[id];
    if (u?.tipo !== 'laborer' || u.fsm !== 'martelando' || u.fsmData.tarefa === undefined) continue;
    const t = e.jobs.tarefas.porId[u.fsmData.tarefa];
    if (t?.tipo === 'assentar-estrada' && chaveDeTile(t.destinoTile) === chaveDeTile(ALVO)) return id;
  }
  return null;
}

describe('I-OBRA-RUA-TRES-BATIDAS', () => {
  it('(1) o carregador converte o tempo do tile de rua uma vez, na escala de construcao', () => {
    const raw = JSON.parse(readFileSync('data/buildings.json', 'utf8')) as { construcao: { segundosAssentarEstradaPorTile_base: number; escala: string } };
    const tempo = JSON.parse(readFileSync('data/time.json', 'utf8')) as { tickHz: number; escalas: Record<string, number> };
    const escala = tempo.escalas[raw.construcao.escala] ?? Number.NaN;
    expect(gameData.construcao.ticksAssentarEstradaPorTile).toBe(Math.round((raw.construcao.segundosAssentarEstradaPorTile_base / escala) * tempo.tickHz));
  });

  it('(2) pelo step: o obreiro assenta o tile em exatamente ticksAssentarEstradaPorTile, e a obra de predio nao muda', () => {
    const n = gameData.construcao.ticksAssentarEstradaPorTile;
    let e = step(inicial, [{ type: 'PlaceRoad', tiles: [ALVO] }]);
    expect(e.events.filter((ev) => ev.type === 'command-rejected')).toEqual([]);
    let comeco: number | null = null;
    let fim: number | null = null;
    for (let i = 0; i < TETO && fim === null; i += 1) {
      e = step(e, []);
      if (comeco === null && quemAssenta(e) !== null) comeco = e.tick;
      if (e.estradas[chaveDeTile(ALVO)] === true) fim = e.tick;
    }
    expect(comeco, 'o obreiro comecou a martelar o tile').not.toBeNull();
    expect(fim, 'o tile entrou na rede').not.toBeNull();
    gravarEvidencia('I-OBRA-RUA-TRES-BATIDAS', { ticksAssentarEstradaPorTile: n, ticksPorMartelada: gameData.construcao.ticksPorMartelada, comeco, fim });
    expect((fim as number) - (comeco as number)).toBe(n);
    expect(n).toBeGreaterThan(gameData.construcao.ticksPorMartelada);
  });

  it('(3) o tile dura pelo menos tres ciclos da animacao de trabalho do obreiro', () => {
    const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as {
      assets: { id: string; animacoes?: Record<string, { quadros: number; fps?: number }> }[];
    };
    const obreiro = manifesto.assets.find((a) => a.id === 'laborer');
    const anim = obreiro?.animacoes?.['trabalhar'];
    if (anim === undefined || anim.fps === undefined) throw new Error('manifesto: o obreiro sem a animacao trabalhar');
    const segundosDoTile = gameData.construcao.ticksAssentarEstradaPorTile / gameData.tempo.tickHz;
    const segundosDoCiclo = anim.quadros / anim.fps;
    expect(segundosDoTile / segundosDoCiclo).toBeGreaterThanOrEqual(BATIDAS_MINIMAS);
  });
});
