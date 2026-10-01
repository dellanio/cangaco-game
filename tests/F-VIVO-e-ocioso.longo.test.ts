/**
 * F-VIVO-e — o ocioso generico, aceite 1: a varredura de 6 000 ticks da vila da calibracao
 * (BUILD_PLAN.md "Aceite da F-VIVO-e"). Suite longa (`*.longo.test.ts`, `npm run test:longo`):
 * medido em 2026-09-30, 32 das 35 combinacoes de estado aparecem ate o tick 6 000, e a padaria so
 * entra em 5 459-5 511, entao o cenario nao encurta. Os outros aceites estao em
 * `F-VIVO-e-ocioso.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { dadosDoTrabalho } from '../src/render/predios';
import type { Manifesto } from '../src/render/manifesto';
import { quadroDeTrabalho, quadroOcioso } from '../src/render/trabalho';
import type { DadosDoTrabalho } from '../src/render/trabalho';
import { unidadesInvisiveis } from '../src/render/visibilidade';
import { comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import { gravarEvidencia } from './helpers/evidence';

const semArte = { assets: [] } as unknown as Manifesto;
const dados: DadosDoTrabalho = dadosDoTrabalho(semArte);
const evidencia: Record<string, unknown> = {};

function ocupanteDe(s: GameState, p: PredioCompleto): Unidade | null {
  return p.ocupante === null ? null : s.unidades.porId[p.ocupante] ?? null;
}

describe('F-VIVO-e — o ocioso generico, a varredura da vila', () => {
  it('aceite 1: na vila da calibracao, ocioso e trabalho nunca coincidem, e o ocioso anda com o esconder', () => {
    const TICKS = 6_000;
    let s: GameState = createInitialState(gameData.economia.estadoInicial.semente);
    const vila = vilaDaCalibracao(s, gameData);
    let trabalho = 0;
    let ocioso = 0;
    let colisoes = 0;
    let divergencias = 0;
    const ociosoPorRotulo: Record<string, number> = {};
    for (let i = 0; i < TICKS; i += 1) {
      s = step(s, comandosDaVilaNoTick(s, vila, i, gameData), gameData);
      const invisiveis = unidadesInvisiveis(s);
      for (const id of s.predios.ordem) {
        const p = s.predios.porId[id];
        if (p === undefined || p.estado !== 'completo') continue;
        const u = ocupanteDe(s, p);
        const q = quadroDeTrabalho(p, u, s.tick, dados);
        const o = quadroOcioso(p, u, s.tick, dados);
        if (q !== null) trabalho += 1;
        if (o !== null) {
          ocioso += 1;
          ociosoPorRotulo[u?.fsm ?? '-'] = (ociosoPorRotulo[u?.fsm ?? '-'] ?? 0) + 1;
          if (u === null || !invisiveis.has(u.id)) divergencias += 1;
        }
        if (q !== null && o !== null) colisoes += 1;
      }
    }
    evidencia['aceite1'] = { ticks: TICKS, trabalho, ocioso, colisoes, divergencias, ociosoPorRotulo };
    // suite longa: evidencia propria (a de `F-VIVO-e.json` e da suite do `verify`)
    gravarEvidencia('F-VIVO-e-vila', { aceite1: evidencia['aceite1'] });
    expect(trabalho).toBeGreaterThan(0);
    expect(ocioso).toBeGreaterThan(0);
    expect(colisoes).toBe(0);
    // ocioso aceso com o homem desenhado seria a casa com gente dentro e o homem na porta
    expect(divergencias).toBe(0);
  // `timeout` NAO e assercao de tempo (CLAUDE.md §8): existe para o caso travar. Sozinho ~1,4 s; na
  // suite, a disputa entre os workers do Vitest o levava ao limite padrao de 5 s (medido 2026-09-30).
  }, 20_000);
});
