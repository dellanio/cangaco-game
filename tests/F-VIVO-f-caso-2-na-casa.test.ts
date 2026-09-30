/**
 * F-VIVO-f — o caso 2 so na fase da casa (BUILD_PLAN.md "Aceite da F-VIVO-f",
 * docs/planos/2026-09-30-F-VIVO-e-em-diante.md).
 *
 * Na receita com colheita, `quadroDeTrabalho` so devolve quadro em
 * `[ticksDeDescanso + ticksNoTile, ticksDoCiclo)`, como o KaM (`hstEmpty` no tile,
 * `KM_UnitTaskMining.pas:247-251`). No descanso vale o ocioso (F-VIVO-e); no tile, nada.
 * As fases vem do dado carregado (`gameData.producao.receitas`), nunca de literal.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { GameState, PredioCompleto, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { canPlace } from '../src/sim/placement';
import { salvar } from '../src/sim/save';
import { dadosDoTrabalho } from '../src/render/predios';
import type { Manifesto } from '../src/render/manifesto';
import { quadroDeTrabalho, quadroOcioso } from '../src/render/trabalho';
import type { DadosDoTrabalho, QuadroDeTrabalho } from '../src/render/trabalho';
import { cenarioDeCanavial, cenarioDePedreira, comProdutorOcupado, pedreiraDaVila } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const semArte = { assets: [] } as unknown as Manifesto;
const dados: DadosDoTrabalho = dadosDoTrabalho(semArte);
const evidencia: Record<string, unknown> = {};

/** As fases do dado carregado, pela sim: a conta que o teste compara com o render. */
function fasesDe(tipo: string): { readonly descanso: number; readonly casa: number; readonly ciclo: number } {
  const r = gameData.producao.receitas[tipo];
  if (r === undefined || r.colheita === null) throw new Error(`fixture: '${tipo}' sem colheita`);
  return {
    descanso: r.colheita.ticksDeDescanso,
    casa: r.colheita.ticksDeDescanso + r.colheita.ticksNoTile,
    ciclo: r.ticksDoCiclo,
  };
}
function completoDe(s: GameState, id: string): PredioCompleto {
  const p = s.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
}
function ocupanteDe(s: GameState, p: PredioCompleto): Unidade | null {
  return p.ocupante === null ? null : s.unidades.porId[p.ocupante] ?? null;
}

describe('F-VIVO-f — o caso 2 so na fase da casa', () => {
  it.each(['quarry', 'wineyard'])('aceite 1 e 3: %s, tick a tick num ciclo, nulo antes da casa e inicio-meio-fim nela', (tipo) => {
    const { casa, ciclo } = fasesDe(tipo);
    // aceite 3: o render le as fases do MESMO dado carregado
    expect((dados.ticksDeDescanso[tipo] ?? 0) + (dados.ticksNoTile[tipo] ?? 0)).toBe(casa);
    expect(dados.ticksDoCiclo[tipo]).toBe(ciclo);
    expect(casa).toBeGreaterThan(0);
    expect(ciclo).toBeGreaterThan(casa);

    const s = cenarioDePedreira();
    const p = completoDe(s, 'q1');
    const u = { ...(ocupanteDe(s, p) as Unidade), fsm: 'trabalhando' } as Unidade;
    const producao = p.producao;
    if (producao === null) throw new Error('fixture: pedreira sem producao');
    const quadros: (QuadroDeTrabalho | null)[] = Array.from({ length: ciclo }, (_, progresso) =>
      quadroDeTrabalho({ ...p, tipo, producao: { ...producao, progresso } }, u, progresso, dados));
    expect(quadros.slice(0, casa).every((q) => q === null)).toBe(true);
    const naCasa = quadros.slice(casa);
    expect(naCasa.every((q) => q !== null)).toBe(true);
    const corridas: string[] = [];
    for (const q of naCasa) if (q !== null && corridas[corridas.length - 1] !== q.laco) corridas.push(q.laco);
    expect(corridas).toEqual(['inicio', 'meio', 'fim']);
    expect(naCasa[0]).toEqual({ laco: 'inicio', n: 1 });
    expect(naCasa[naCasa.length - 1]).toEqual({ laco: 'fim', n: 8 });
    evidencia[tipo] = { inicioDaCasa: casa, ticksDoCiclo: ciclo, faseDaCasa: ciclo - casa, corridas };
  });

  it('aceite 2, pelo step: descanso so ocioso, no tile nada, na casa so trabalho (pedreira e canavial)', () => {
    const medir = (inicial: GameState, id: string, tipo: string): Record<string, number> => {
      const { descanso, casa } = fasesDe(tipo);
      const conta: Record<string, number> = { descansoOcioso: 0, tileNada: 0, casaTrabalho: 0, erros: 0 };
      let s = inicial;
      for (let i = 0; i < 3_000; i += 1) {
        s = step(s, [], gameData);
        const p = completoDe(s, id);
        const u = ocupanteDe(s, p);
        if (u === null || p.producao === null) continue;
        const { progresso } = p.producao;
        const q = quadroDeTrabalho(p, u, s.tick, dados);
        const o = quadroOcioso(p, u, s.tick, dados);
        if (u.fsm === 'trabalhando' && progresso < descanso) {
          if (q === null && o !== null) conta['descansoOcioso'] = (conta['descansoOcioso'] ?? 0) + 1;
          else conta['erros'] = (conta['erros'] ?? 0) + 1;
        }
        if (u.fsm === 'colhendo') {
          if (q === null && o === null) conta['tileNada'] = (conta['tileNada'] ?? 0) + 1;
          else conta['erros'] = (conta['erros'] ?? 0) + 1;
        }
        if (u.fsm === 'trabalhando' && progresso >= casa) {
          if (q !== null && o === null) conta['casaTrabalho'] = (conta['casaTrabalho'] ?? 0) + 1;
          else conta['erros'] = (conta['erros'] ?? 0) + 1;
        }
      }
      return conta;
    };
    const pedreira = medir(cenarioDePedreira(), 'q1', 'quarry');
    const canavial = medir(cenarioDeCanavial(), 'c1', 'wineyard');
    evidencia['peloStep'] = { pedreira, canavial };
    for (const c of [pedreira, canavial]) {
      expect(c['erros']).toBe(0);
      expect(c['descansoOcioso']).toBeGreaterThan(0);
      expect(c['tileNada']).toBeGreaterThan(0);
      expect(c['casaTrabalho']).toBeGreaterThan(0);
    }
  });

  it('aceite 4 (partida do roteiro): pedreira com o canteiro no tile ao lado de pedreira com ele na casa', () => {
    const { casa, ciclo } = fasesDe('quarry');
    const OUTRA = { gx: pedreiraDaVila().gx - 4, gy: pedreiraDaVila().gy }; // colada a oeste da q1, relativa
    // a q1 comeca sozinha; a q2 entra quando a q1 chega a casa, e fica defasada meio ciclo
    let s = cenarioDePedreira();
    for (let i = 0; i < 2_000 && (completoDe(s, 'q1').producao?.progresso ?? 0) < casa; i += 1) s = step(s, [], gameData);
    expect(completoDe(s, 'q1').producao?.progresso).toBe(casa);
    expect(canPlace(s, 'quarry', OUTRA.gx, OUTRA.gy).ok).toBe(true);
    s = comProdutorOcupado(s, { tipo: 'quarry', id: 'q2', unidade: 'u9', ...OUTRA }, gameData);
    const achou = (e: GameState): boolean => {
      const q1 = completoDe(e, 'q1');
      const q2 = completoDe(e, 'q2');
      const u1 = ocupanteDe(e, q1);
      const u2 = ocupanteDe(e, q2);
      return u2?.fsm === 'colhendo' && quadroDeTrabalho(q1, u1, e.tick, dados) !== null
        && (q1.producao?.progresso ?? 0) < ciclo - 60;
    };
    for (let i = 0; i < 1_000 && !achou(s); i += 1) s = step(s, [], gameData);
    expect(achou(s)).toBe(true);
    const q2 = completoDe(s, 'q2');
    expect(quadroDeTrabalho(q2, ocupanteDe(s, q2), s.tick, dados)).toBeNull();
    expect(quadroOcioso(q2, ocupanteDe(s, q2), s.tick, dados)).toBeNull();
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F-VIVO-f.save.txt`, salvar(s));
    const q1 = completoDe(s, 'q1');
    const partida = {
      tick: s.tick, naCasa: 'q1', noTile: 'q2', canteiroNoTile: 'u9',
      centro: { gx: (OUTRA.gx + q1.gx + 3) / 2, gy: q1.gy + 1 },
    };
    writeFileSync(`${dir}/F-VIVO-f.partida.json`, JSON.stringify(partida, null, 2));
    evidencia['partida'] = partida;
    gravarEvidencia('F-VIVO-f', evidencia);
  });
});
