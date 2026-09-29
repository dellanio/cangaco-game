/**
 * LOTE3-c — o pedreiro traz 3 blocos por viagem, como no KaM (decisao do operador,
 * 2026-09-27). Ele corta a pedra no tile e trabalha ela na casa: o lote e o que
 * justifica o tempo na casa. O ciclo triplicou (fases x3), entao a TAXA DECLARADA
 * (`sai / ticksDoCiclo`) e a mesma do pedreiro de um bloco.
 *
 * O que a medicao mostrou, e o que se afirma: a taxa ENTREGUE nao e a mesma. A ida e
 * a volta sao pagas uma vez por lote, e nao uma vez por pedra — o vaivem deixa de ser
 * proporcional a producao. O pedreiro de um bloco e derivado do dado de hoje (fases /
 * lote, `sai` 1), que e exatamente o dado do LOTE3-b2; assim o teste nao carrega
 * numero proprio. Os numeros da corrida vao para `test-output/LOTE3-c-pedreiro-lote.json`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData, ReceitaDePredio } from '../src/sim/data/types';
import type { GameState } from '../src/sim/state';
import { receitaDoTipo } from '../src/sim/producao';
import { step } from '../src/sim/tick';
import { gravarEvidencia } from './helpers/evidence';
import {
  cenarioDePedreira, comEspacoNaSaida, comJazida, comRendimentoPorTile, rochaDaPedreiraDaVila,
} from './helpers/producao-cenario';

const JANELA = 12000;

function receitaDaPedreira(dados: GameData): ReceitaDePredio {
  const r = receitaDoTipo('quarry', dados);
  if (r === null || r.colheita === null) throw new Error('fixture: quarry precisa de receita com colheita');
  return r;
}

const LOTE = receitaDaPedreira(gameData).sai.stone ?? 0;

/** O pedreiro de UM bloco por viagem: cada fase dividida pelo lote, `sai` 1. E o
 *  dado do LOTE3-b2 (26 / 42 / 99, ciclo 167), derivado, nao digitado. */
function umPorViagem(dados: GameData): GameData {
  const r = receitaDaPedreira(dados);
  if (r.colheita === null) throw new Error('fixture');
  const receita: ReceitaDePredio = {
    ...r,
    ticksDoCiclo: Math.round(r.ticksDoCiclo / LOTE),
    sai: { stone: 1 },
    colheita: {
      ...r.colheita,
      ticksDeDescanso: Math.round(r.colheita.ticksDeDescanso / LOTE),
      ticksNoTile: Math.round(r.colheita.ticksNoTile / LOTE),
    },
  };
  return { ...dados, producao: { ...dados.producao, receitas: { ...dados.producao.receitas, quarry: receita } } };
}

interface Corrida { readonly entregue: number; readonly ticksAndando: number }

/** Roda a janela drenando a gaveta, e conta o que entrou e os ticks fora de casa
 *  andando (ida e volta; o tempo no tile nao e vaivem). */
function correr(inicial: GameState, dados: GameData, janela = JANELA): Corrida {
  let s = inicial;
  let entregue = 0;
  let ticksAndando = 0;
  for (let i = 0; i < janela; i += 1) {
    s = step(s, [], dados);
    for (const e of s.events) {
      if (e.type === 'goods-produced' && e.predio === 'q1') entregue += e.quantidade;
    }
    const fsm = s.unidades.porId.u1?.fsm;
    if (fsm === 'indo_colher' || fsm === 'voltando') ticksAndando += 1;
    s = comEspacoNaSaida(s, 'q1');
  }
  return { entregue, ticksAndando };
}

const um = umPorViagem(gameData);

describe('LOTE3-c — o pedreiro traz um lote por viagem', () => {
  it('o dado: lote de 3, e a taxa declarada e a do pedreiro de um bloco (+-1 tick por pedra)', () => {
    const r = receitaDaPedreira(gameData);
    const r1 = receitaDaPedreira(um);
    expect(LOTE).toBe(3);
    expect(Math.abs(r.ticksDoCiclo / LOTE - r1.ticksDoCiclo)).toBeLessThanOrEqual(1);
  });

  it('a taxa ENTREGUE sobe: a viagem e paga uma vez por lote, e a caminhada por pedra cai a um terco', () => {
    const agora = correr(cenarioDePedreira(gameData), gameData);
    const antes = correr(cenarioDePedreira(um), um);
    // o piso fica entre o medido (60 contra 46, 1,30) e o do pedreiro de um bloco
    // (1,0): com `porViagem` 1 as duas corridas sao a mesma e isto reprova
    expect(agora.entregue).toBeGreaterThanOrEqual(antes.entregue * 1.2);
    // ticks andando por pedra: a razao ideal e 1/LOTE; o piso e metade
    expect(agora.ticksAndando / agora.entregue).toBeLessThan((antes.ticksAndando / antes.entregue) / 2);
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: 0,70 s
    // isolado (2026-09-29); 5x daria menos, e o limite fica no piso, o padrao do Vitest.
  }, 5_000);

  it('evidencia: entregue, caminhada por pedra e a razao N:1 com rocha', () => {
    const agora = correr(cenarioDePedreira(gameData), gameData);
    const antes = correr(cenarioDePedreira(um), um);
    // N:1 com o dado de verdade: o tile unico (15 pedras) ESGOTA dentro da janela,
    // entao a razao mede o veio, nao o ciclo
    const rendimento = gameData.recursos.tipos.rock?.rendimentoPorTile ?? 0;
    const umTile = comJazida(gameData, 'rock', [rochaDaPedreiraDaVila()], rendimento);
    const umTileAntes = comJazida(um, 'rock', [rochaDaPedreiraDaVila()], rendimento);
    const agora1 = correr(cenarioDePedreira(umTile), umTile);
    const antes1 = correr(cenarioDePedreira(umTileAntes), umTileAntes);
    // N:1 sem esgotar: rendimento injetado grande, o tile unico nunca acaba
    const FARTO = 1500;
    const farto = comRendimentoPorTile(gameData, 'rock', FARTO);
    const farto1 = comJazida(gameData, 'rock', [rochaDaPedreiraDaVila()], FARTO);
    const agoraFartoN = correr(cenarioDePedreira(farto), farto);
    const agoraFarto1 = correr(cenarioDePedreira(farto1), farto1);
    const razao = (n: number, d: number): number | null => (d === 0 ? null : n / d);
    expect(agora.entregue).toBeGreaterThan(0);
    gravarEvidencia('LOTE3-c-pedreiro-lote', {
      _doc: 'LOTE3-c — pedreiro com 3 por viagem contra o de 1 (dado do b2, derivado). Numero da corrida; o aceite e o teste de cima.',
      janela: JANELA,
      receita: {
        agora: { ticksDoCiclo: receitaDaPedreira(gameData).ticksDoCiclo, porViagem: LOTE },
        umPorViagem: { ticksDoCiclo: receitaDaPedreira(um).ticksDoCiclo, porViagem: 1 },
      },
      entregue: { agora: agora.entregue, umPorViagem: antes.entregue, razao: razao(agora.entregue, antes.entregue) },
      ticksPorPedraEntregue: { agora: razao(JANELA, agora.entregue), umPorViagem: razao(JANELA, antes.entregue) },
      ticksAndandoPorPedra: {
        agora: razao(agora.ticksAndando, agora.entregue),
        umPorViagem: razao(antes.ticksAndando, antes.entregue),
      },
      razaoN1ComDadoReal: {
        _nota: 'um tile de 15 esgota na janela: a razao mede o veio, nao o ciclo',
        agora: { muitos: agora.entregue, um: agora1.entregue, razao: razao(agora.entregue, agora1.entregue) },
        umPorViagem: { muitos: antes.entregue, um: antes1.entregue, razao: razao(antes.entregue, antes1.entregue) },
      },
      razaoN1SemEsgotar: {
        _nota: `rendimento injetado ${FARTO} por tile: nenhum tile esgota, a razao mede so o alcance`,
        agora: { muitos: agoraFartoN.entregue, um: agoraFarto1.entregue, razao: razao(agoraFartoN.entregue, agoraFarto1.entregue) },
      },
    });
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: 1,5 s
    // isolado (2026-09-29); o limite e ~5x.
  }, 10_000);
});
