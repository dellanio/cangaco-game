/**
 * I-TRANSPORTE-OURO-SEMPRE-NA-ESCOLA — a escola fica abastecida de ouro, com ou sem fila (pedido do
 * operador, 2026-10-04). Como toda casa do KaM pede o insumo ate a cota (UpdateDemands,
 * src/houses/KM_Houses.pas:2221-2258; MAX_WARES_IN_HOUSE em src/common/KM_Defaults.pas:299), o alvo
 * de ouro da escola e `max(ouroEmEstoque, aguardando x custo)`.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState, MERCADORIA_DE_OURO } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { alvoDeOuroDaEscola, filaDaEscola, ouroNecessario, ouroQueAFilaEspera } from '../src/sim/escola';
import { alvoDeEntrada, excedenteNaEntrada } from '../src/sim/insumo';
import { armazemPorTipo, avancarAte, comOuroNaEscola, comOuroNoArmazem, escolaDoCenario, ouroNaEscola, pedir } from './helpers/escola-cenario';
import { comEstradas } from './helpers/jobs-cenario';
import { linhaHDe, naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;
const ARMAZEM = armazemPorTipo(inicial).id;
const COTA = gameData.economia.schoolhouse.ouroEmEstoque;
const ligado = (ouro: number): GameState => comOuroNoArmazem(comEstradas(inicial, linhaHDe(naVila, 0, 7, 3)), ARMAZEM, ouro);
/** Uma copia do dado com a cota e o custo trocados, para o ramo da fila acima da cota existir. */
const comDado = (cota: number, custo: number): GameData => ({
  ...gameData,
  economia: { ...gameData.economia, schoolhouse: { ...gameData.economia.schoolhouse, ouroEmEstoque: cota, custoOuroPorUnidade: custo } },
});

describe('I-TRANSPORTE-OURO-SEMPRE-NA-ESCOLA', () => {
  it('o dado e o do KaM: a cota e 5', () => {
    expect(COTA).toBe(5);
  });

  it('1. por tabela: fila vazia -> a cota; fila acima da cota -> a fila; ouroNecessario = alvo - caixa', () => {
    const casos: [string, GameData, number, number, number][] = [
      // nome, dado, pedidos na fila, ouro na caixa, alvo esperado
      ['fila vazia, caixa vazia', gameData, 0, 0, COTA],
      ['fila vazia, caixa com 2', gameData, 0, 2, COTA],
      ['3 pedidos de custo 1 (abaixo da cota)', gameData, 3, 0, COTA],
      ['3 pedidos de custo 3 (acima da cota)', comDado(5, 3), 3, 0, 9],
      ['cota zero: so a fila (a regra de antes)', comDado(0, 1), 2, 0, 2],
    ];
    for (const [nome, dados, pedidos, caixa, alvo] of casos) {
      let s = step(inicial, Array.from({ length: pedidos }, () => pedir(ESCOLA, 'serf')), dados);
      s = comOuroNaEscola(s, ESCOLA, caixa);
      expect(filaDaEscola(s, ESCOLA).filter((i) => i.estado === 'aguardando'), nome).toHaveLength(pedidos);
      expect(alvoDeOuroDaEscola(s, ESCOLA, dados), nome).toBe(alvo);
      expect(alvoDeEntrada(s, ESCOLA, MERCADORIA_DE_OURO, dados), nome).toBe(alvo);
      expect(ouroNecessario(s, ESCOLA, dados), nome).toBe(Math.max(0, alvo - caixa));
    }
    // a espera e da fila: fila vazia nao espera ouro nenhum, mesmo com a caixa enchendo
    expect(ouroQueAFilaEspera(inicial, ESCOLA)).toBe(0);
  });

  it('2. pelo step: a escola de fila vazia recebe ouro ate a cota e para; nada volta pelo nivel 7', () => {
    const cenario = ligado(20);
    const cheia = avancarAte(cenario, (e) => ouroNaEscola(e, ESCOLA) >= COTA, 3000);
    expect(ouroNaEscola(cheia, ESCOLA)).toBe(COTA);
    let s = cheia;
    let maximo = 0;
    for (let i = 0; i < 600; i++) {
      s = step(s, []);
      maximo = Math.max(maximo, ouroNaEscola(s, ESCOLA));
      expect(excedenteNaEntrada(s, ESCOLA, MERCADORIA_DE_OURO)).toBe(0);
    }
    expect(maximo).toBe(COTA);
    expect(ouroNaEscola(s, ESCOLA)).toBe(COTA);
    gravarEvidencia('I-TRANSPORTE-OURO-SEMPRE-NA-ESCOLA', { cota: COTA, tickAbastecida: cheia.tick - cenario.tick, ouroNaEscolaNoFim: ouroNaEscola(s, ESCOLA) });
  });

  it('3. pelo step: abastecida, o treino pedido comeca no mesmo tick, sem esperar entrega', () => {
    const cheia = avancarAte(ligado(20), (e) => ouroNaEscola(e, ESCOLA) >= COTA, 3000);
    const pediu = step(cheia, [pedir(ESCOLA, 'serf')]);
    expect(filaDaEscola(pediu, ESCOLA)[0]?.estado).toBe('treinando');
  });
});
