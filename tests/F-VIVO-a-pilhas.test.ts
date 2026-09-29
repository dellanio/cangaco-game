/**
 * F-VIVO-a — a pilha (BUILD_PLAN.md, "Aceite da F-VIVO-a").
 *
 * `pilhasDoPredio` e pura: o teste monta o predio a mao, com a forma do `GameState`,
 * e afirma a lista. O dado e o do funil (`dadosDasPilhas`), o mesmo que a cena le.
 * O teste do pisca roda a vila da calibracao, que e o cenario longo real.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { GameState, Predio, PredioCompleto, PredioEmObra } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { dadosDasPilhas } from '../src/render/predios';
import type { Manifesto } from '../src/render/manifesto';
import {
  materialNaObra, mercadoriasDoEstoque, pilhasDoPredio, posicoesNaPilha, TETO_DA_PILHA,
} from '../src/render/pilhas';
import { comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import { gravarEvidencia } from './helpers/evidence';
import { LADO_DO_JOGADOR } from '../src/sim/state';

const semArte: Manifesto = { assets: [] } as unknown as Manifesto;
const dados = dadosDasPilhas(semArte);
const hpPor = gameData.construcao.hpPorMaterialEntregue;

function completo(tipo: string, entrada: Record<string, number>, saida: Record<string, number>): PredioCompleto {
  return {
    lado: LADO_DO_JOGADOR, id: 'p1', tipo, gx: 0, gy: 0, hp: 1, estado: 'completo',
    capacidade: { entrada: null, saida: null }, estoque: { entrada, saida },
    ocupante: null, producao: null, pausado: false, reparo: false,
  };
}

function obra(tipo: string, faltam: Record<string, number>, hp: number): PredioEmObra {
  return { lado: LADO_DO_JOGADOR, id: 'p1', tipo, gx: 0, gy: 0, hp, estado: 'obra', obra: { faltam, nivelamento: 0 } };
}

const resumo = (p: Predio, d = dados): [string, string, number][] =>
  pilhasDoPredio(p, d).map((x) => [x.gaveta, x.mercadoria, x.n]);

const tabela: Record<string, unknown> = {};

describe('F-VIVO-a — pilhasDoPredio', () => {
  it('predio com receita: entrada e saida na ordem da receita', () => {
    const r = dados.contexto.receitas['swine_farm'];
    expect(r).toBeDefined();
    // A criacao sai com dois produtos: a ordem e a de `sai` do dado.
    const p = completo('swine_farm', { corn: 2 }, { pigs: 1, skins: 3 });
    const esperado: [string, string, number][] = [
      ...(r?.entra ?? []).map((m): [string, string, number] => ['entrada', m, m === 'corn' ? 2 : 0]),
      ...(r?.sai ?? []).map((m): [string, string, number] => ['saida', m, m === 'pigs' ? 1 : m === 'skins' ? 3 : 0]),
    ].filter(([, , n]) => n > 0);
    expect(resumo(p)).toEqual(esperado);
    tabela['swine_farm'] = resumo(p);
  });

  it('os dois lados do teto de 5', () => {
    expect(TETO_DA_PILHA).toBe(5);
    const n = (q: number): number | undefined => pilhasDoPredio(completo('quarry', {}, { stone: q }), dados)[0]?.n;
    expect(n(0)).toBeUndefined();
    expect(n(4)).toBe(4);
    expect(n(5)).toBe(5);
    expect(n(6)).toBe(5);
    expect(n(60)).toBe(5);
    tabela['quarry'] = { 4: n(4), 5: n(5), 6: n(6) };
  });

  it('armazem: as quatro maiores, somando as duas gavetas, com desempate pela ordem de mercadorias', () => {
    // Sem a entrada de pedra: timber 9, corn 7 e fish 7 (corn antes, pela lista),
    // loaves 6; stone 4 fica de fora.
    const p = completo('storehouse', { corn: 7, gold: 1 }, { timber: 9, stone: 4, fish: 7, loaves: 6 });
    const ordem = gameData.economia.mercadorias;
    expect(ordem.indexOf('stone')).toBeLessThan(ordem.indexOf('corn'));
    expect(ordem.indexOf('corn')).toBeLessThan(ordem.indexOf('fish'));
    const armazem = completo('storehouse', { corn: 7, gold: 1, stone: 3 }, { timber: 9, stone: 4, fish: 7, loaves: 6 });
    // stone 3 + 4 = 7 empata com corn e fish; loaves (6) fica de fora.
    expect(resumo(armazem)).toEqual([
      ['entrada', 'timber', 5], ['entrada', 'stone', 5], ['entrada', 'corn', 5], ['entrada', 'fish', 5],
    ]);
    // Sem o `stone: 3` da entrada, stone (4) cai abaixo de loaves (6).
    expect(resumo(p).map(([, m]) => m)).toEqual(['timber', 'corn', 'fish', 'loaves']);
    // Os quatro pontos sao do PREDIO: com uma mercadoria so, ela ocupa o primeiro.
    const um = pilhasDoPredio(completo('storehouse', {}, { gold: 2 }), dados);
    const cheio = pilhasDoPredio(armazem, dados);
    expect(um[0]?.ponto).toEqual(cheio[0]?.ponto);
    tabela['storehouse'] = resumo(armazem);
  });

  it('Bodega: as quatro comidas, na ordem do grupo', () => {
    const p = completo('inn', { wine: 2, loaves: 8, fish: 1 }, {});
    const esperado = gameData.economia.grupos.comida
      .map((m): [string, string, number] => ['entrada', m, Math.min({ wine: 2, loaves: 8, fish: 1 }[m as 'wine'] ?? 0, 5)])
      .filter(([, , n]) => n > 0);
    expect(resumo(p)).toEqual(esperado);
    expect(pilhasDoPredio(p, dados)).toHaveLength(3);
    tabela['inn'] = resumo(p);
  });

  it('obra: nada entregue, entregue sem martelada, tabua primeiro e tudo pregado', () => {
    const def = gameData.predios.find((p) => p.id === 'quarry');
    if (!def) throw new Error('quarry sumiu do dado');
    const { timber, stone } = def;
    expect(def.hp).toBe((timber + stone) * hpPor);

    const nada = obra('quarry', { timber, stone }, 0);
    const semMartelada = obra('quarry', { timber: 0, stone: 0 }, 0);
    // A primeira martelada tira a unidade da pilha: hp 1 ja consome uma tabua.
    const umGolpe = obra('quarry', { timber: 0, stone: 0 }, 1);
    // Toda a tabua pregada e mais um golpe: a pedra comeca a sair.
    const naPedra = obra('quarry', { timber: 0, stone: 0 }, timber * hpPor + 1);
    // So a pedra chegou: a sim deixa martelar o que foi entregue, e o que se prega
    // sai da tabua primeiro — ela nao chegou, entao sai da pedra.
    const soPedra = obra('quarry', { timber, stone: 0 }, hpPor);
    const tudo = obra('quarry', { timber: 0, stone: 0 }, def.hp);

    expect(resumo(nada)).toEqual([]);
    expect(resumo(semMartelada)).toEqual([['obra', 'timber', timber], ['obra', 'stone', stone]]);
    expect(resumo(umGolpe)).toEqual([['obra', 'timber', timber - 1], ['obra', 'stone', stone]]);
    expect(resumo(naPedra)).toEqual([['obra', 'stone', stone - 1]]);
    expect(resumo(soPedra)).toEqual([['obra', 'stone', stone - 1]]);
    expect(resumo(tudo)).toEqual([]);
    expect(materialNaObra(tudo, { timber, stone }, hpPor)).toEqual([['timber', 0], ['stone', 0]]);
    tabela['obra-quarry'] = {
      nada: resumo(nada), semMartelada: resumo(semMartelada), umGolpe: resumo(umGolpe),
      naPedra: resumo(naPedra), soPedra: resumo(soPedra), tudo: resumo(tudo),
    };
  });

  it('as ancoras do manifesto valem sobre as padrao', () => {
    const comAncoras = {
      assets: [{
        id: 'quarry', tipo: 'predio', footprint: [3, 2], tamanho: [192, 128], anchor: [0.5, 1],
        estados: {}, licenca: 'x', origem: { base: 'x', semente: null },
        ancoras: { estoque: { entrada: [], saida: [[0.7, 0.8]] }, obra: { timber: [0.1, 0.9], stone: [0.3, 0.9] } },
      }],
    } as unknown as Manifesto;
    const d = dadosDasPilhas(comAncoras);
    expect(pilhasDoPredio(completo('quarry', {}, { stone: 2 }), d)[0]?.ponto).toEqual([0.7, 0.8]);
    expect(pilhasDoPredio(obra('quarry', { timber: 0, stone: 0 }, 0), d).map((x) => x.ponto))
      .toEqual([[0.1, 0.9], [0.3, 0.9]]);
    // Sem ancoras, o padrao: tudo dentro de [0, 1].
    for (const x of pilhasDoPredio(completo('storehouse', {}, { timber: 1, stone: 1, gold: 1, corn: 1 }), dados)) {
      expect(x.ponto.every((v) => v >= 0 && v <= 1)).toBe(true);
    }
  });

  it('tres embaixo e dois em cima', () => {
    expect(posicoesNaPilha(1)).toEqual([[0, 0]]);
    expect(posicoesNaPilha(3)).toEqual([[-1, 0], [0, 0], [1, 0]]);
    expect(posicoesNaPilha(5)).toEqual([[-1, 0], [0, 0], [1, 0], [-0.5, -1], [0.5, -1]]);
    expect(posicoesNaPilha(9)).toHaveLength(5);
  });
});

/**
 * O pisca (nota do operador): o conjunto das quatro do armazem, na vila da
 * calibracao, por 6 000 ticks. Troca = o conjunto ORDENADO de mercadorias mudou de
 * um tick para o outro, em qualquer armazem. Mais de uma troca por 100 ticks em
 * media e o sinal para parar e reportar.
 */
describe('F-VIVO-a — o armazem nao pisca', () => {
  it('menos de uma troca por 100 ticks na vila da calibracao', () => {
    const TICKS = 6000;
    let s: GameState = createInitialState(gameData.economia.estadoInicial.semente);
    const vila = vilaDaCalibracao(s);
    const anterior = new Map<string, string>();
    let trocas = 0;
    const trocasEm: number[] = [];
    for (let i = 0; i < TICKS; i += 1) {
      s = step(s, comandosDaVilaNoTick(s, vila, i));
      for (const id of s.predios.ordem) {
        const p = s.predios.porId[id];
        if (!p || p.tipo !== dados.contexto.idDoArmazem) continue;
        const chave = mercadoriasDoEstoque(p, dados.contexto).entrada.map(([m]) => m).join(',');
        const antes = anterior.get(id);
        if (antes !== undefined && antes !== chave) {
          trocas += 1;
          if (trocasEm.length < 200) trocasEm.push(s.tick);
        }
        anterior.set(id, chave);
      }
    }
    const porCem = (trocas * 100) / TICKS;
    gravarEvidencia('F-VIVO-a', {
      tabela,
      pisca: { ticks: TICKS, trocas, trocasPor100Ticks: porCem, primeirasTrocasNoTick: trocasEm, limite: 1 },
    });
    expect(porCem).toBeLessThanOrEqual(1);
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: 1,5 / 1,6 s
    // isolado (2026-09-29); o limite e ~5x.
  }, 10_000);
});
