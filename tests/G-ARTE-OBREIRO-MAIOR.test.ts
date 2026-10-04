/**
 * G-ARTE-OBREIRO-MAIOR — o obreiro 10% maior que o de antes (pedido do operador, 2026-10-04: "ele esta
 * pequeno em relacao ao serf"). A altura e a caixa dos pixels opacos do `parado` sul no atlas. O obreiro
 * de antes media 74 px (o personagem de 76 px do PixelLab, `laborer_76_fase_g` no ids.json), como o serf.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { caixaOpaca, lerPng } from './helpers/png';

const ALTURA_DE_ANTES = 74;
const PE = 90;
function altura(tipo: string, quadro: string): { altura: number; pe: number } {
  const atlas = JSON.parse(readFileSync(`assets/sprites/units/${tipo}/${tipo}.json`, 'utf8')) as { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> };
  const c = caixaOpaca(lerPng(`assets/sprites/units/${tipo}/${tipo}.png`), atlas.frames[quadro]!.frame)!;
  return { altura: c.y1 - c.y0 + 1, pe: c.y1 };
}

describe('G-ARTE-OBREIRO-MAIOR', () => {
  it('o obreiro tem de 1,07 a 1,13 vez a altura de antes, com o pe na linha 90', () => {
    const o = altura('laborer', 'laborer/parado/s/0000');
    expect(o.altura / ALTURA_DE_ANTES).toBeGreaterThanOrEqual(1.07);
    expect(o.altura / ALTURA_DE_ANTES).toBeLessThanOrEqual(1.13);
    expect(o.pe).toBe(PE);
  });
  it('o serf continua com a altura de antes (a regua da comparacao)', () => {
    expect(altura('serf', 'serf/parado/s/0000').altura).toBe(ALTURA_DE_ANTES);
  });
  it('o obreiro tem os gestos da tarefa no atlas', () => {
    const m = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets: { id: string; tipo: string; animacoes?: Record<string, unknown> }[] };
    const animacoes = Object.keys(m.assets.find((a) => a.id === 'laborer' && a.tipo === 'unidade')!.animacoes ?? {});
    expect(animacoes).toEqual(expect.arrayContaining(['martelar', 'assentar', 'arar', 'andar', 'morrer']));
  });
});
