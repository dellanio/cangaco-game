/**
 * LOTE3-b2 — pedreiro, lenhador, fazendeiro e pescador em FASES, pelo caminho do
 * Canavial (`docs/planos/LOTE3-fases-de-colheita.md`). Decisao do operador
 * (2026-09-27): a PROPORCAO vem do KaM (BALANCE_LOG), o TOTAL e o de antes, e so o
 * pedreiro e o vinhateiro trabalham dentro da casa — os outros tres voltam e depositam.
 *
 * O ciclo, na ordem: descanso dentro do predio (o do KaM vem depois da entrega; aqui
 * abre o ciclo seguinte), `colhendo` no tile, a volta e — so no pedreiro — o trabalho
 * na casa. O que se afirma: cada fase dura o que o dado diz, e a VAZAO e a do modelo
 * de antes (+-1), porque o total nao mudou.
 *
 * LOTE3-c (2026-09-27): o pedreiro traz 3 blocos por viagem, e o ciclo triplicou para
 * manter a taxa declarada. O "modelo de antes" aqui e so o de SEM FASES com o mesmo
 * lote; a comparacao com o pedreiro de um bloco por viagem esta em
 * `LOTE3-c-pedreiro-lote.test.ts`. A vazao por predio vai para a evidencia
 * (`test-output/LOTE3-fases-quatro.json`); girar o total e decisao do operador.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData, ReceitaDePredio } from '../src/sim/data/types';
import type { GameState } from '../src/sim/state';
import { receitaDoTipo } from '../src/sim/producao';
import { step } from '../src/sim/tick';
import { gravarEvidencia } from './helpers/evidence';
import {
  cenarioDeFazenda, cenarioDeFazendaDeUmTile, cenarioDePedreira, cenarioDePescador,
  cenarioDePescadorDeUmCardume, cenarioOraculo, comEspacoNaSaida,
} from './helpers/producao-cenario';

interface Caso {
  readonly tipo: string;
  readonly predio: string;
  readonly unidade: string;
  readonly cenario: (dados: GameData) => GameState;
  /** so pedreiro (e vinhateiro, no outro arquivo) trabalham na casa */
  readonly trabalhaNaCasa: boolean;
  /** LOTE3-c: o pedreiro traz 3 blocos por viagem, como no KaM; os outros, 1 */
  readonly porViagem: number;
}

const CASOS: readonly Caso[] = [
  { tipo: 'quarry', predio: 'q1', unidade: 'u1', cenario: cenarioDePedreira, trabalhaNaCasa: true, porViagem: 3 },
  { tipo: 'woodcutters', predio: 'w1', unidade: 'lenhador-1', cenario: cenarioOraculo, trabalhaNaCasa: false, porViagem: 1 },
  { tipo: 'farm', predio: 'f1', unidade: 'roceiro', cenario: cenarioDeFazenda, trabalhaNaCasa: false, porViagem: 1 },
  { tipo: 'fishermans', predio: 'pesc1', unidade: 'pescador', cenario: cenarioDePescador, trabalhaNaCasa: false, porViagem: 1 },
];

const JANELA = 6000;

function receitaDe(tipo: string): ReceitaDePredio {
  const r = receitaDoTipo(tipo, gameData);
  if (r === null || r.colheita === null) throw new Error(`fixture: '${tipo}' precisa de receita com colheita`);
  return r;
}

/** O modelo de ANTES: sem descanso, o ciclo inteiro no tile. So o dado muda. */
function modeloDeAntes(tipo: string, dados: GameData): GameData {
  const r = receitaDe(tipo);
  if (r.colheita === null) throw new Error('fixture');
  const receita: ReceitaDePredio = {
    ...r, colheita: { ...r.colheita, ticksDeDescanso: 0, ticksNoTile: r.ticksDoCiclo },
  };
  return { ...dados, producao: { ...dados.producao, receitas: { ...dados.producao.receitas, [tipo]: receita } } };
}

const produziu = (s: GameState, predio: string): number => s.events.reduce(
  (n, e) => n + (e.type === 'goods-produced' && e.predio === predio ? e.quantidade : 0), 0);

function produzido(inicial: GameState, dados: GameData, predio: string, janela = JANELA): number {
  let s = inicial;
  let total = 0;
  for (let i = 0; i < janela; i += 1) {
    s = comEspacoNaSaida(step(s, [], dados), predio);
    total += produziu(s, predio);
  }
  return total;
}

interface Fases { readonly descanso: number; readonly noTile: number; readonly dentroDepois: number }

/** Um ciclo LIMPO de colheita, de um deposito ao seguinte: a trilha colapsada tem de
 *  ser exatamente descanso, ida, tile, volta, deposito (a fazenda semeia entre um e
 *  outro; o ciclo de semear nao conta). Devolve quanto durou cada trecho de dentro. */
function umCicloLimpo(c: Caso): Fases {
  let s = c.cenario(gameData);
  let trecho: string[] = [];
  let depositos = 0;
  for (let i = 0; i < 20000; i += 1) {
    s = comEspacoNaSaida(step(s, [], gameData), c.predio);
    trecho.push(s.unidades.porId[c.unidade]?.fsm ?? '');
    if (produziu(s, c.predio) === 0) continue;
    depositos += 1;
    const colapsado = trecho.filter((f, j) => j === 0 || f !== trecho[j - 1]);
    const limpo = colapsado.join(',') === 'trabalhando,indo_colher,colhendo,voltando,trabalhando';
    if (depositos > 1 && limpo) {
      const primeiraIda = trecho.indexOf('indo_colher');
      const ultimaVolta = trecho.lastIndexOf('voltando');
      return {
        descanso: primeiraIda,
        noTile: trecho.filter((f) => f === 'colhendo').length,
        dentroDepois: trecho.length - 1 - ultimaVolta,
      };
    }
    trecho = [];
  }
  throw new Error(`fixture: '${c.tipo}' nao fechou um ciclo limpo`);
}

describe('LOTE3-b2 — os quatro colhem em fases', () => {
  for (const c of CASOS) {
    const r = receitaDe(c.tipo);
    const colheita = r.colheita;
    if (colheita === null) throw new Error('fixture');
    const naCasa = r.ticksDoCiclo - colheita.ticksDeDescanso - colheita.ticksNoTile;

    it(`${c.tipo}: o dado declara fases, ${c.porViagem} por viagem, casa so no pedreiro`, () => {
      expect(colheita.ticksDeDescanso).toBeGreaterThan(0);
      expect(colheita.ticksNoTile).toBeGreaterThan(0);
      expect(Object.values(r.sai)).toEqual([c.porViagem]);
      expect(naCasa > 0).toBe(c.trabalhaNaCasa);
    });

    it(`${c.tipo}: descanso dentro, ticksNoTile no tile, e dentro depois da volta so o que e da casa`, () => {
      const f = umCicloLimpo(c);
      expect(f.descanso).toBe(colheita.ticksDeDescanso);
      expect(f.noTile).toBe(colheita.ticksNoTile);
      // o tick da chegada: sem trabalho na casa ele JA e o deposito (1); com, ele e
      // gasto entrando e o relogio anda a partir do seguinte (naCasa + 1)
      expect(f.dentroDepois).toBe(naCasa + 1);
    }, 120000);

    it(`${c.tipo}: a vazao em ${JANELA} ticks e a do modelo de antes (+-1)`, () => {
      const antes = modeloDeAntes(c.tipo, gameData);
      const agora = produzido(c.cenario(gameData), gameData, c.predio);
      const deAntes = produzido(c.cenario(antes), antes, c.predio);
      expect(agora).toBeGreaterThan(0);
      expect(Math.abs(agora - deAntes)).toBeLessThanOrEqual(1);
    }, 300000);
  }

  it('evidencia: fases, vazao e a razao N:1 onde ha cenario de um tile', () => {
    const JANELA_LONGA = 12000;
    const razao = (muitos: number, um: number): number | null => (um === 0 ? null : muitos / um);
    const deUmTile: Record<string, { cenario: (d: GameData) => GameState; muitos: (d: GameData) => GameState }> = {
      farm: { cenario: cenarioDeFazendaDeUmTile, muitos: cenarioDeFazenda },
      fishermans: { cenario: cenarioDePescadorDeUmCardume, muitos: cenarioDePescador },
    };
    const porPredio: Record<string, unknown> = {};
    for (const c of CASOS) {
      const r = receitaDe(c.tipo);
      const antes = modeloDeAntes(c.tipo, gameData);
      const um = deUmTile[c.tipo];
      const linha: Record<string, unknown> = {
        ticksDoCiclo: r.ticksDoCiclo,
        descanso: r.colheita?.ticksDeDescanso,
        noTile: r.colheita?.ticksNoTile,
        naCasa: r.ticksDoCiclo - (r.colheita?.ticksDeDescanso ?? 0) - (r.colheita?.ticksNoTile ?? 0),
        vazao: {
          agora: produzido(c.cenario(gameData), gameData, c.predio, JANELA_LONGA),
          modeloDeAntes: produzido(c.cenario(antes), antes, c.predio, JANELA_LONGA),
        },
      };
      if (um !== undefined) {
        const agoraN = produzido(um.muitos(gameData), gameData, c.predio, JANELA_LONGA);
        const agora1 = produzido(um.cenario(gameData), gameData, c.predio, JANELA_LONGA);
        const antesN = produzido(um.muitos(antes), antes, c.predio, JANELA_LONGA);
        const antes1 = produzido(um.cenario(antes), antes, c.predio, JANELA_LONGA);
        linha.razaoN1 = {
          agora: { muitos: agoraN, um: agora1, razao: razao(agoraN, agora1) },
          modeloDeAntes: { muitos: antesN, um: antes1, razao: razao(antesN, antes1) },
        };
      }
      porPredio[c.tipo] = linha;
    }
    expect(Object.keys(porPredio)).toHaveLength(CASOS.length);
    gravarEvidencia('LOTE3-fases-quatro', {
      _doc: 'LOTE3-b2 — os quatro em fases, total de antes. Numero da corrida, nao aceite: girar o total e decisao do operador.',
      janela: JANELA_LONGA,
      porPredio,
    });
  }, 600000);
});
