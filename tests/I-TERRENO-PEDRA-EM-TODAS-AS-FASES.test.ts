/**
 * I-TERRENO-PEDRA-EM-TODAS-AS-FASES — pedra a vista em toda fase de construir, minerio pela liberacao e o
 * estoque inicial. Analise em `docs/planos/2026-10-15-pedra-e-estoque-das-fases.md`.
 */
import { describe, expect, it } from 'vitest';
import { rawGameData } from '../src/sim/data/raw';
import { criarFase, dadosDaFase } from '../src/sim/fase';
import { ehDescoberto } from '../src/sim/nevoa';
import { buscarCaminho, tileAndavel } from '../src/sim/pathfinding';
import type { TileDeGrid } from '../src/sim/estradas';
import { gravarEvidencia } from './helpers/evidence';

const FASES = rawGameData.fases;
const MIN_PEDRA_A_VISTA = 6;
const MAX_DISTANCIA_DO_LAJEDO = 12;
const MIN_DISTANCIA_DO_MINERIO = 25;
const FASE_DO_OURO_E_CARVAO = 3;
const FASE_DO_FERRO = 6;
/** §4 do plano: o estoque de pedra e madeira por fase de construir. */
const ESTOQUE: Record<number, { stone: number; timber: number }> = {
  1: { stone: 20, timber: 25 }, 2: { stone: 25, timber: 30 }, 3: { stone: 30, timber: 30 }, 4: { stone: 30, timber: 30 },
  5: { stone: 30, timber: 35 }, 6: { stone: 30, timber: 35 }, 8: { stone: 25, timber: 35 },
};

type Tile = readonly number[];
const tiles = (fase: (typeof FASES)[number], tipo: string): readonly Tile[] =>
  ((fase.mapa.recursos as Record<string, readonly Tile[] | undefined>)[tipo] ?? []);
const armazem = (fase: (typeof FASES)[number]) => fase.lados[0]?.predios.find((p) => p.id === 'storehouse');
const construir = FASES.filter((f) => f.modo === 'construir');

describe('I-TERRENO-PEDRA-EM-TODAS-AS-FASES', () => {
  it('(1) toda fase tem pedra no mapa, as de lutar inclusive', () => {
    for (const f of FASES) expect(tiles(f, 'rock').length, f.id).toBeGreaterThan(0);
  });

  it('(2) toda fase de construir tem o lajedo da vila: pedra descoberta no tick 0, perto do armazem e alcancavel', () => {
    const medido: Record<string, unknown> = {};
    for (const f of construir) {
      const dados = dadosDaFase(f.id);
      const s = criarFase(f.id, dados);
      const arm = armazem(f);
      if (arm === undefined) throw new Error(`${f.id}: sem armazem`);
      const pedra = tiles(f, 'rock');
      const vistos = pedra.filter(([x, y]) => ehDescoberto(s, 0, x as number, y as number, dados));
      const centro = { gx: arm.gx + 1, gy: arm.gy + 1 };
      const perto = Math.min(...pedra.map(([x, y]) => Math.hypot((x as number) - centro.gx, (y as number) - centro.gy)));
      const vizinhos: TileDeGrid[] = vistos.flatMap(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ gx: (x as number) + (dx as number), gy: (y as number) + (dy as number) })))
        .filter((t) => tileAndavel(s, t, 'livre', dados));
      const porta = { gx: arm.gx + 1, gy: arm.gy + 3 };
      const caminho = vizinhos.length === 0 ? null : buscarCaminho(s, porta, vizinhos, 'livre', dados);
      medido[f.id] = { vistos: vistos.length, maisPerto: Math.round(perto * 10) / 10, caminho: caminho?.custo ?? null };
      expect(vistos.length, `${f.id}: pedra a vista no inicio`).toBeGreaterThanOrEqual(MIN_PEDRA_A_VISTA);
      expect(perto, `${f.id}: a pedra mais perto do armazem`).toBeLessThanOrEqual(MAX_DISTANCIA_DO_LAJEDO);
      expect(caminho, `${f.id}: caminho do armazem ao lajedo`).not.toBeNull();
    }
    gravarEvidencia('I-TERRENO-PEDRA-EM-TODAS-AS-FASES', { lajedoDaVila: medido });
  });

  it('(3) minerio pela liberacao: nada antes da fase 3; ouro e carvao da 3 em diante; ferro da 6 em diante; sempre longe', () => {
    for (const f of construir) {
      const arm = armazem(f);
      if (arm === undefined) throw new Error(`${f.id}: sem armazem`);
      for (const tipo of ['gold_ore', 'coal', 'iron_ore']) {
        const t = tiles(f, tipo);
        const deve = tipo === 'iron_ore' ? f.fase >= FASE_DO_FERRO : f.fase >= FASE_DO_OURO_E_CARVAO;
        expect(t.length > 0, `${f.id}: ${tipo}`).toBe(deve);
        for (const [x, y] of t) expect(Math.hypot((x as number) - arm.gx, (y as number) - arm.gy), `${f.id}: ${tipo} em ${x},${y}`).toBeGreaterThanOrEqual(MIN_DISTANCIA_DO_MINERIO);
      }
    }
  });

  it('(4) o estoque inicial: a tabela de pedra e madeira, e uma refeicao por unidade', () => {
    for (const f of construir) {
      const lado = f.lados[0];
      if (lado === undefined) throw new Error(`${f.id}: sem jogador`);
      const e = lado.estoque as Record<string, number | undefined>;
      expect({ stone: e['stone'], timber: e['timber'] }, f.id).toEqual(ESTOQUE[f.fase]);
      const comida = (e['loaves'] ?? 0) + (e['sausages'] ?? 0);
      const unidades = lado.unidades.reduce((n, u) => n + u.quantidade, 0);
      expect(comida, `${f.id}: comida para ${unidades} unidades`).toBeGreaterThanOrEqual(unidades);
    }
  });
});
