/**
 * D-TRANSPORTE-03 (logistica do KaM), passo T2 (oferta x demanda) — aceite 2, o cenario longo:
 * D1 e D2 do operador, na vila da calibracao, em 16 000, 20 000 e 30 000 ticks. Suite longa
 * (`*.longo.test.ts`, `npm run test:longo`; decisao do operador, 2026-10-01). Os outros aceites
 * estao em `D-TRANSPORTE-03-T2-oferta-demanda.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import { gravarEvidencia } from './helpers/evidence';

/**
 * Aceite 2 (D1 e D2 do operador), a LINHA DE BASE: a vila da calibracao sem o T2, medida por
 * sonda na arvore 8929ba3 (a `main` com o BUG-Y, antes do merge). Numero da corrida, nao dado
 * de jogo: e o "base" das duas regras, e so muda se a base for remedida.
 * - D2: producao por cadeia (soma de `goods-produced`) >= floor(base x 0,98) em cada janela, e
 *   o deficit (base - T2) em 30 000 nao passa do deficit em 16 000.
 * - D1: parada = ticks com o ocupante em `esperando_insumo` ou `saida_cheia`, somados por tipo,
 *   <= base x 1,05 em cada janela.
 */
const JANELAS_LONGAS = [16_000, 20_000, 30_000] as const;
const BASE_LONGA: Readonly<Record<number, { producao: Readonly<Record<string, number>>; parada: Readonly<Record<string, number>> }>> = {
  16_000: {
    producao: { tree_trunk: 41, stone: 78, timber: 78, corn: 48, flour: 44, loaves: 80 },
    parada: { sawmill: 2929, mill: 725, bakery: 496 },
  },
  20_000: {
    producao: { tree_trunk: 50, stone: 99, timber: 98, corn: 64, flour: 58, loaves: 112 },
    parada: { sawmill: 3862, mill: 1028, bakery: 496 },
  },
  30_000: {
    producao: { tree_trunk: 78, stone: 153, timber: 154, corn: 99, flour: 96, loaves: 190 },
    parada: { sawmill: 5825, mill: 1718, bakery: 987 },
  },
};
/** Guarda de travamento, NAO afirmacao de tempo (CLAUDE.md §8): 30 000 ticks da vila. */
const TIMEOUT_DA_CORRIDA_LONGA = 120_000;

interface Janela { readonly producao: Record<string, number>; readonly parada: Record<string, number> }

/** A vila da calibracao ate a ultima janela, com a producao e a parada acumuladas em cada uma. */
function correrLongo(): Record<number, Janela> {
  let s = createInitialState(gameData.economia.estadoInicial.semente);
  const vila = vilaDaCalibracao(s);
  const producao: Record<string, number> = {};
  const parada: Record<string, number> = {};
  const tiposParados = Object.keys(BASE_LONGA[16_000]?.parada ?? {});
  const janelas: Record<number, Janela> = {};
  const ultima = JANELAS_LONGAS[JANELAS_LONGAS.length - 1] ?? 0;
  for (let t = 0; t < ultima; t += 1) {
    s = step(s, comandosDaVilaNoTick(s, vila, t));
    for (const ev of s.events) {
      if (ev.type === 'goods-produced') producao[ev.mercadoria] = (producao[ev.mercadoria] ?? 0) + ev.quantidade;
    }
    for (const id of s.predios.ordem) {
      const p = s.predios.porId[id];
      if (p?.estado !== 'completo' || !tiposParados.includes(p.tipo) || p.ocupante === null) continue;
      const fsm = s.unidades.porId[p.ocupante]?.fsm;
      if (fsm === 'esperando_insumo' || fsm === 'saida_cheia') parada[p.tipo] = (parada[p.tipo] ?? 0) + 1;
    }
    if ((JANELAS_LONGAS as readonly number[]).includes(s.tick)) janelas[s.tick] = { producao: { ...producao }, parada: { ...parada } };
  }
  return janelas;
}

describe('D-TRANSPORTE-03 T2 — o cenario longo', () => {
  it('2: cenario longo — producao por cadeia >= floor(base x 0,98), deficit que nao cresce, parada <= base x 1,05', () => {
    const t2 = correrLongo();
    gravarEvidencia('D-TRANSPORTE-03-T2-longo', { base: BASE_LONGA, t2 });
    const deficit = (janela: number, cadeia: string): number =>
      (BASE_LONGA[janela]?.producao[cadeia] ?? 0) - (t2[janela]?.producao[cadeia] ?? 0);
    for (const janela of JANELAS_LONGAS) {
      const base = BASE_LONGA[janela];
      const medido = t2[janela];
      expect(medido, `janela ${janela}`).toBeDefined();
      for (const [cadeia, n] of Object.entries(base?.producao ?? {})) {
        expect(medido?.producao[cadeia] ?? 0, `${cadeia} em ${janela}`).toBeGreaterThanOrEqual(Math.floor(n * 0.98));
      }
      for (const [tipo, n] of Object.entries(base?.parada ?? {})) {
        expect(medido?.parada[tipo] ?? 0, `parada ${tipo} em ${janela}`).toBeLessThanOrEqual(n * 1.05);
      }
    }
    for (const cadeia of Object.keys(BASE_LONGA[16_000]?.producao ?? {})) {
      expect(deficit(30_000, cadeia), `deficit de ${cadeia}, 16 000 -> 30 000`).toBeLessThanOrEqual(deficit(16_000, cadeia));
    }
  }, TIMEOUT_DA_CORRIDA_LONGA);
});
