/**
 * BUG-Y (viagem inutil para comer) — aceite 4: na vila da calibracao, 20 000 ticks, zero chegadas
 * com a prateleira vazia e refeicoes >= a base (plano
 * `docs/planos/2026-10-01-BUG-Y-viagem-inutil-para-comer.md`, secao 5). Suite longa
 * (`*.longo.test.ts`, `npm run test:longo`; decisao do operador, 2026-10-01). Os outros aceites
 * estao em `BUG-Y-refeicao-garantida.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { comidasNaBodega, ehBodegaCompleta } from '../src/sim/bodega';
import { comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import { gravarEvidencia } from './helpers/evidence';

/** Guarda de travamento, NAO afirmacao de tempo (CLAUDE.md §8): 20 000 ticks da vila. */
const TIMEOUT_DA_CORRIDA = 60_000;
/** As refeicoes da vila da calibracao em 20 000 ticks ANTES do conserto (plano, secao 3). */
const REFEICOES_DA_BASE = 37;

describe('BUG-Y aceite 4 — a vila da calibracao, 20 000 ticks', () => {
  it('zero chegadas com a prateleira vazia, e refeicoes >= a base', () => {
    let s = createInitialState(gameData.economia.estadoInicial.semente);
    const vila = vilaDaCalibracao(s);
    let refeicoes = 0;
    let saidasSemComer = 0;
    let chegadasComPrateleiraVazia = 0;
    for (let i = 0; i < 20_000; i += 1) {
      const antes = s;
      s = step(s, comandosDaVilaNoTick(s, vila, i));
      for (const id of antes.unidades.ordem) {
        const a = antes.unidades.porId[id];
        if (a?.fsm !== 'indo_comer') continue;
        const d = s.unidades.porId[id];
        if (d?.fsm === 'indo_comer') continue;
        if (d?.fsm === 'comendo') { refeicoes += 1; continue; }
        saidasSemComer += 1;
        const t = antes.jobs.tarefas.porId[a.fsmData.tarefa ?? ''];
        const destino = t !== undefined && 'destino' in t ? t.destino : '';
        if (ehBodegaCompleta(s.predios.porId[destino]) && comidasNaBodega(s, destino).length === 0) {
          chegadasComPrateleiraVazia += 1;
        }
      }
    }
    const aceite4 = { ticks: 20_000, refeicoes, saidasSemComer, chegadasComPrateleiraVazia, refeicoesDaBase: REFEICOES_DA_BASE };
    // suite longa: evidencia propria (a de `BUG-Y.json` e da suite do `verify`)
    gravarEvidencia('BUG-Y-vila', { aceite4 });
    expect(chegadasComPrateleiraVazia).toBe(0);
    expect(refeicoes).toBeGreaterThanOrEqual(REFEICOES_DA_BASE);
  }, TIMEOUT_DA_CORRIDA);
});
