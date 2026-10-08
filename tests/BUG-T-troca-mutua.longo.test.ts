/**
 * BUG-T (tropa travada) — aceite 4, a varredura das 400 ordens (receita fixada na secao 7 do plano
 * `docs/planos/2026-09-30-BUG-T-tropa-travada.md`). Suite longa (`*.longo.test.ts`,
 * `npm run test:longo`; decisao do operador, 2026-10-01). Os outros aceites, inclusive o caso 3
 * isolado, que a varredura nao exercita mais, estao em `BUG-T-troca-mutua.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import type { Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { TROPA_DOS_TESTES_DE_FORMACAO } from './helpers/escaramuca-paz';
import { criarEscaramuca } from '../src/sim/cenario';
import { gravarEvidencia } from './helpers/evidence';
import { sobrepostos } from './helpers/militares';

const TIPO = gameData.escaramuca.tropaDoJogador.tipo;
/** Guarda de travamento, NAO afirmacao de tempo (CLAUDE.md §8): 400 ordens da escaramuca. */
const TIMEOUT_DA_VARREDURA = 120_000;

describe('BUG-T aceite 4 — a varredura das 400 ordens (receita fixada na secao 7 do plano)', () => {
  it.each([TROPA_DOS_TESTES_DE_FORMACAO, 24])('com %i soldados nenhuma ordem deixa preso ou sobreposicao', (quantidade) => {
    let x = 12345n;
    const rnd = (n: number): number => { x = (x * 1103515245n + 12345n) % 2147483648n; return Number(x % BigInt(n)); };
    const horizonte = 400 * 1501;
    // Fixture de movimento: condicao suficiente para o prazo inteiro, sem comida
    // nem ataque da IA retirarem soldados da verificacao de congestionamento.
    const dados = { ...gameData,
      escaramuca: { ...gameData.escaramuca, tropaDoJogador: { ...gameData.escaramuca.tropaDoJogador, quantidade } },
      condicao: { ...gameData.condicao, ticksCondicaoCheia: { ...gameData.condicao.ticksCondicaoCheia, militar: horizonte + 1 } },
    };
    let s = criarEscaramuca(gameData.economia.estadoInicial.semente, dados);
    // Isolar marcha: a IA nao pode eliminar os soldados depois da ordem 400.
    // A ordem 13 reproduz o defeito durante a paz original; preserva-se esse cenario.
    s = { ...s, pazAteTick: s.tick + horizonte };
    const tropa = s.unidades.ordem.filter((id) => s.unidades.porId[id]?.lado === LADO_DO_JOGADOR && s.unidades.porId[id]?.tipo === TIPO);
    const lider = s.unidades.porId[tropa[0] as string] as Unidade;
    const comPreso: unknown[] = [];
    const sobreposicoes: string[] = [];
    let ticks = 0;
    for (let k = 0; k < 400; k += 1) {
      const destino = { gx: lider.gx + rnd(17) - 8, gy: lider.gy + rnd(17) - 8 };
      const direcao = rnd(8);
      const colunas = 3 + rnd(7);
      s = step(s, [{ type: 'MoveUnits', unidades: tropa, destino, direcao, colunas }], dados);
      sobreposicoes.push(...sobrepostos(s));
      const vivos = (): string[] => tropa.filter((id) => s.unidades.porId[id] !== undefined);
      let t = 0;
      for (; t < 1500 && !vivos().every((id) => s.unidades.porId[id]?.fsm === 'ocioso'); t += 1) {
        s = step(s, [], dados);
        sobreposicoes.push(...sobrepostos(s));
      }
      ticks += t;
      const presos = vivos().filter((id) => s.unidades.porId[id]?.fsm === 'marchando');
      if (presos.length > 0) comPreso.push({ k, destino, direcao, colunas, presos });
      gravarEvidencia(`BUG-T-diagnostico-${quantidade}`, { k, tick: s.tick, comPreso,
        unidades: tropa.map(id => s.unidades.porId[id]), eventos: s.events });
      expect(vivos(), `ordem ${k}, tick ${s.tick}`).toHaveLength(quantidade);
      expect(presos, `ordem ${k}`).toEqual([]);
    }
    const aceite4 = { ordens: 400, ticks, comPreso, sobreposicoes: sobreposicoes.slice(0, 20), antesDoConserto: { ordensComPreso: 3, presos: 6, causa: 'troca mutua' } };
    // suite longa: evidencia propria, para nao sobrescrever a do `verify` com uma parte so
    gravarEvidencia(`BUG-T-varredura-${quantidade}`, { quantidade, aceite4 });
    expect(sobreposicoes).toEqual([]);
    expect(comPreso).toEqual([]);
  }, TIMEOUT_DA_VARREDURA);
});
