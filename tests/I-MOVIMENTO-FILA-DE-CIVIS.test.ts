/**
 * I-MOVIMENTO-FILA-DE-CIVIS — civis em fila, um por tile, sem empurrar (decisao do operador,
 * 2026-10-04). O civil reserva o tile seguinte no INICIO do passo (o `Walk` do KaM,
 * `src/units/actions/KM_UnitActionWalkTo.pas:1312`) e espera no proprio tile; quem vem de frente cruza
 * (a largada em ciclo); o ocioso no caminho da um passo de lado, andando. O desvio e a troca forcada
 * sairam. Os casos de mecanismo (fila, de frente, ciclo, ocioso) estao em
 * `D-MOVIMENTO-01a-colisao-civil.test.ts`; aqui, a vila inteira pelo `step` (aceites 1, 5, 6 e 7).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { carregar, salvar } from '../src/sim/save';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import type { GameState, Unidade } from '../src/sim/state';
import { createInitialState } from '../src/sim/state';
import { ehCivilQueOcupa, tileOcupado } from '../src/sim/colisao';
import { posicaoDaUnidade } from '../src/sim/selectors';
import { criarEscaramuca } from '../src/sim/cenario';
import { comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import { gravarEvidencia } from './helpers/evidence';

interface Medida {
  /** Civis que mudaram de tile para o proximo do proprio caminho. */
  passoNormal: number;
  /** Civis que mudaram de tile para outro lugar: empurrao, contorno ou teleporte. */
  foraDoCaminho: number;
  /** Ticks com dois civis no mesmo tile, na ocupacao logica. */
  empilhados: number;
  progressoNegativo: number;
  /** Ticks de quem esperava e nao estava no centro do proprio tile. */
  esperaForaDoCentro: number;
  maiorSemAvancar: number;
  quem: string;
  exemplos: string[];
}

function medir(inicio: GameState, ticks: number, comandos: (s: GameState, t: number) => ReturnType<typeof comandosDaVilaNoTick>): { m: Medida; fim: GameState } {
  let s = inicio;
  const m: Medida = { passoNormal: 0, foraDoCaminho: 0, empilhados: 0, progressoNegativo: 0, esperaForaDoCentro: 0, maiorSemAvancar: 0, quem: '', exemplos: [] };
  const ant: Record<string, Unidade> = {};
  const desde: Record<string, number> = {};
  for (let t = 0; t < ticks; t++) {
    s = step(s, comandos(s, t), gameData);
    const vistos = new Set<string>();
    for (const id of s.unidades.ordem) {
      const u = s.unidades.porId[id] as Unidade;
      if (!ehCivilQueOcupa(u, gameData)) { delete ant[id]; delete desde[id]; continue; }
      const o = tileOcupado(u);
      const k = `${o.gx},${o.gy}`;
      if (vistos.has(k)) { m.empilhados++; if (m.exemplos.length < 5) m.exemplos.push(`t${s.tick} empilhado em ${k}: ${id}`); }
      vistos.add(k);
      if ((u.fsmData.progresso ?? 0) < 0) m.progressoNegativo++;
      if ((u.fsmData.bloqueado ?? 0) > 0) {
        const p = posicaoDaUnidade(s, u, gameData);
        if (p.gx !== u.gx || p.gy !== u.gy) m.esperaForaDoCentro++;
      }
      const a = ant[id];
      if (a !== undefined && (a.gx !== u.gx || a.gy !== u.gy)) {
        const q = a.fsmData.caminho?.[0];
        if (q !== undefined && q.gx === u.gx && q.gy === u.gy) m.passoNormal++;
        else { m.foraDoCaminho++; if (m.exemplos.length < 5) m.exemplos.push(`t${s.tick} ${id} de ${a.gx},${a.gy} para ${u.gx},${u.gy}`); }
      }
      // o "nao trava" por progresso: quem quer andar avanca um tile dentro do prazo
      const quer = (u.fsmData.caminho ?? []).length > 0;
      if (!quer || a === undefined || a.gx !== u.gx || a.gy !== u.gy) desde[id] = s.tick;
      else if (s.tick - (desde[id] ?? s.tick) > m.maiorSemAvancar) { m.maiorSemAvancar = s.tick - (desde[id] ?? s.tick); m.quem = `${id} ${u.fsm} em ${u.gx},${u.gy}`; }
      ant[id] = u;
    }
  }
  return { m, fim: s };
}

const prazo = gameData.movimento.colisaoCivil.ticksPrazoDeProgresso;
const s0 = (): GameState => createInitialState(gameData.economia.estadoInicial.semente);

describe('I-MOVIMENTO-FILA-DE-CIVIS — a vila inteira, pelo step', () => {
  const vila = medir(carregar(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8'), gameData), 3000, () => []);
  const inicio = s0();
  const v = vilaDaCalibracao(inicio);
  const livre = medir(inicio, 8000, (s, t) => comandosDaVilaNoTick(s, v, t));
  const escaramuca = medir(criarEscaramuca(gameData.economia.estadoInicial.semente), 8000, () => []);
  gravarEvidencia('I-MOVIMENTO-FILA-DE-CIVIS', {
    antes: { foraDoCaminhoNoJogoLivre: 15 + 89, ticksSeguradosNoFimDoPasso: 1874 },
    vilaPronta: { ...vila.m }, jogoLivre: { ...livre.m }, escaramuca: { ...escaramuca.m }, prazo,
  });

  it.each([['vila pronta', vila.m], ['jogo livre', livre.m], ['escaramuca', escaramuca.m]] as const)(
    '5. %s: ninguem sai do proprio caminho, nunca dois no tile, nenhum progresso negativo', (_nome, m) => {
      expect(m.passoNormal).toBeGreaterThan(1000); // a vila andou de verdade
      expect(m.foraDoCaminho, m.exemplos.join(' | ')).toBe(0);
      expect(m.empilhados, m.exemplos.join(' | ')).toBe(0);
      expect(m.progressoNegativo).toBe(0);
    });

  it.each([['vila pronta', vila.m], ['jogo livre', livre.m], ['escaramuca', escaramuca.m]] as const)(
    '1. %s: quem espera esta no centro do proprio tile', (_nome, m) => {
      expect(m.esperaForaDoCentro).toBe(0);
    });

  it.each([['jogo livre', livre.m], ['escaramuca', escaramuca.m]] as const)(
    '6. %s: quem quer andar avanca dentro do prazo do dado', (_nome, m) => {
      expect(m.maiorSemAvancar, m.quem).toBeLessThanOrEqual(prazo);
    });

  // `timeout` nao e assercao de tempo (CLAUDE.md §8): existe para o caso travar
  it('7. a mesma corrida duas vezes da o mesmo estado', () => {
    const correr = (): GameState => { const i = s0(); const vv = vilaDaCalibracao(i); return medir(i, 2000, (s, t) => comandosDaVilaNoTick(s, vv, t)).fim; };
    expect(salvar(correr())).toBe(salvar(correr()));
  }, 60_000);
});
