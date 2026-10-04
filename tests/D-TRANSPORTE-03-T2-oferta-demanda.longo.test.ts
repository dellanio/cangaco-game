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
 * Aceite 2 (D1 e D2 do operador). Ate 2026-10-04 ele comparava a producao por cadeia e a parada
 * com uma LINHA DE BASE medida sem a colisao civil (>= base x 0,98; parada <= base x 1,05; deficit
 * que nao cresce). I-MOVIMENTO-COLISAO-CIVIL-LIGADA: com a colisao ligada o pao cai ate 25 %, e
 * por decisao do operador (2026-10-04) producao nao e assercao ("nao podemos correlacionar os
 * itens"): a comparacao com a base SAIU. Fica a mecanica que ela protegia: a vila nao para, toda
 * cadeia produz e continua produzindo de janela em janela. Os numeros vao para a evidencia.
 */
const JANELAS_LONGAS = [16_000, 20_000, 30_000] as const;
/** As cadeias e os predios que a linha de base acompanhava (a lista, sem os numeros). */
const CADEIAS = ['tree_trunk', 'stone', 'timber', 'corn', 'flour', 'loaves'] as const;
const TIPOS_PARADOS = ['sawmill', 'mill', 'bakery'] as const;
/** Guarda de travamento, NAO afirmacao de tempo (CLAUDE.md §8): 30 000 ticks da vila. */
const TIMEOUT_DA_CORRIDA_LONGA = 120_000;

interface Janela { readonly producao: Record<string, number>; readonly parada: Record<string, number> }

/** A vila da calibracao ate a ultima janela, com a producao e a parada acumuladas em cada uma. */
function correrLongo(): Record<number, Janela> {
  let s = createInitialState(gameData.economia.estadoInicial.semente);
  const vila = vilaDaCalibracao(s);
  const producao: Record<string, number> = {};
  const parada: Record<string, number> = {};
  const tiposParados: readonly string[] = TIPOS_PARADOS;
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
  it('2: cenario longo — a vila nao para: toda cadeia produz, e produz mais a cada janela', () => {
    const t2 = correrLongo();
    gravarEvidencia('D-TRANSPORTE-03-T2-longo', { t2 });
    let anterior: Readonly<Record<string, number>> = {};
    for (const janela of JANELAS_LONGAS) {
      const medido = t2[janela];
      expect(medido, `janela ${janela}`).toBeDefined();
      for (const cadeia of CADEIAS) {
        expect(medido?.producao[cadeia] ?? 0, `${cadeia} em ${janela}`).toBeGreaterThan(anterior[cadeia] ?? 0);
      }
      anterior = medido?.producao ?? {};
    }
  }, TIMEOUT_DA_CORRIDA_LONGA);
});
