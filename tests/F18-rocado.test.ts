/**
 * F18 — O ACEITE, nas duas pernas que o `BUILD_PLAN.md` escreve:
 *
 *   (a) fazenda posta onde NAO ha tile aravel ao alcance fica parada, e o teste
 *       afirma a CAUSA no alerta, nao so a parada;
 *   (b) a mesma fazenda, no mesmo mapa, com terra arada ao alcance PRODUZ; a
 *       producao PARA quando os tiles ao alcance zeram e VOLTA depois do
 *       replantio.
 *
 * "Fazenda sem campo nao produz" era, ate aqui, uma frase sem sujeito: a fazenda
 * do dado publicado produzia milho do nada, em qualquer lugar do mapa. A perna
 * (a) e o que impede o aceite de passar por acidente — ela reprova contra o
 * codigo de ontem.
 *
 * Tudo medido contra o TICK 0, e em milho ENTREGUE (o que saiu do tile e esta
 * numa gaveta), nunca contra zero absoluto.
 *
 * F-CAMPO-a (decisao do operador, 2026-09-27) — a perna (b) e o custo trocaram de
 * CENARIO, nao de assercao. Com o crescer no tile o rodizio semeia todo campo ao
 * alcance antes de colher, e a fazenda do norte alcanca catorze: o aceite ficaria
 * esperando o roceiro semear catorze. `cenarioDeFazendaDeUmTile` deixa um so, e o
 * teste prova a mesma regra — produz, para quando zera, volta apos replantio,
 * debita — sem a espera. Os marcos foram derivados de novo para o modelo (o
 * semear e viagem, e entre semear e colher ha o crescer).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState } from '../src/sim/state';
import { alertasDoEstado } from '../src/sim/selectors';
import { receitaDoTipo } from '../src/sim/producao';
import { recursoNoTile } from '../src/sim/recursos';
import { gravarEvidencia } from './helpers/evidence';
import {
  avancar, cenarioDeFazendaDeUmTile, cenarioDeFazendaSemCampo, comCustoDePlantio, comEntrada,
  entradaDe, fsmDe,
} from './helpers/producao-cenario';

const RECEITA = receitaDoTipo('farm', gameData);
if (RECEITA === null || RECEITA.colheita === null) {
  throw new Error('fixture: `farm` precisa de receita com colheita em data/production.json');
}
const GRAO = RECEITA.colheita.recurso;
const PLANTIO = gameData.recursos.tipos[GRAO]?.reposicao?.ticksDeSemear ?? 0;
const CRESCER = gameData.recursos.tipos[GRAO]?.reposicao?.ticksDeCrescer ?? 0;
const CICLO = RECEITA.ticksDoCiclo;
const RENDIMENTO = gameData.recursos.tipos[GRAO]?.rendimentoPorTile ?? 0;

/** Milho ENTREGUE: o que esta em gaveta de predio, qualquer uma. Soma as duas
 *  (`entrada` e `saida`) de proposito — se um dia um serf levar o milho ao
 *  armazem no meio da janela, a conta continua sendo a mesma. */
function entregue(estado: GameState, mercadoria: string = GRAO): number {
  let total = 0;
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (p?.estado !== 'completo') continue;
    total += (p.estoque.entrada[mercadoria] ?? 0) + (p.estoque.saida[mercadoria] ?? 0);
  }
  return total;
}

/** A serie que o aceite mede: tick -> milho entregue desde o tick 0. */
function serieDeEntrega(
  inicial: GameState, ticks: readonly number[], dados: GameData = gameData,
): Readonly<Record<number, number>> {
  const base = entregue(inicial);
  return Object.fromEntries(
    ticks.map((t) => [t, entregue(avancar(inicial, t, dados)) - base]),
  );
}

// Os marcos da perna (b), derivados do dado e nao digitados. A janela para
// ANTES de a gaveta encher (`estoqueInternoPorPredio.saida`), senao a producao
// pararia pelo motivo errado e o teste diria outra coisa do que afirma.
/**
 * F-T3 — o intervalo entre duas colheitas deixou de ser `ticksDoCiclo`: o roceiro
 * SAI da fazenda. Uma volta inteira e o tick da transicao + a IDA ate o tile + o
 * relogio do ciclo, que agora anda NO tile + a VOLTA ate a porta, onde o milho
 * entra na gaveta. As duas pernas sao deste cenario (f1 em (112,30), porta em
 * (112,33)) e estao medidas na evidencia; `CICLO`, `PLANTIO`, `CRESCER` e
 * `RENDIMENTO` continuam vindo do dado, intocados.
 *
 * F-CAMPO-a — com `alcance_tiles` 2 o tile e (110,28), trabalhado de (111,29): as
 * pernas eram 53 / 51 e sao 35 / 33, medidas por sonda em 2026-09-27. O semear
 * tambem e viagem, pela mesma ida: no tick 1 ele sai, e o tile fica semeado em
 * `IDA + PLANTIO` (o `semeadoEm`), maduro `CRESCER` depois. O replantio repete os
 * mesmos passos a partir do tick em que secou.
 */
const IDA = 35;
const VOLTA = 33;
const VOLTA_INTEIRA = 1 + IDA + CICLO + VOLTA;
const SEMEADO_EM = IDA + PLANTIO;
const MADURO = SEMEADO_EM + CRESCER;
const PRIMEIRA = MADURO + VOLTA_INTEIRA;
const SECOU = MADURO + RENDIMENTO * VOLTA_INTEIRA;
/** No meio do semear do replantio: o roceiro esta parado no tile, semeando. */
const PARADA = SECOU + 1 + IDA + Math.floor(PLANTIO / 2);
const VOLTOU = SECOU + MADURO + VOLTA_INTEIRA;

describe('F18 (a) — fazenda sem tile aravel ao alcance nao produz', () => {
  it('nao entrega um grao sequer, e o campo continua vazio', () => {
    const inicial = cenarioDeFazendaSemCampo();
    const depois = avancar(inicial, VOLTOU);
    expect(entregue(depois) - entregue(inicial)).toBe(0);
    // e nao e a fazenda estar quebrada: ela esta ocupada, ligada e esperando.
    expect(depois.predios.porId.f1?.estado).toBe('completo');
    expect(fsmDe(depois, 'roceiro')).toBe('esperando_insumo');
  });

  it('e o alerta diz POR QUE: a causa e `sem-campo`', () => {
    // A causa, nao so a parada. `sem-trabalhador` e `sem-estrada` estao
    // descartadas pelo proprio cenario, que poe ocupante e estrada.
    expect(alertasDoEstado(avancar(cenarioDeFazendaSemCampo(), VOLTOU), gameData)).toEqual([
      { predio: 'f1', tipo: 'farm', causa: 'sem-campo' },
    ]);
  });

  it('ANTES da F18 esta perna passaria por acidente: a fazenda produzia do nada', () => {
    // O que torna o aceite honesto e a receita ter `colheita`. Sem ela — que e
    // exatamente o dado de ontem — nenhum tile do mapa entra na conta e a
    // fazenda produz em qualquer lugar. A guarda e estrutural: le a receita.
    expect(RECEITA.colheita).not.toBeNull();
    expect(GRAO).toBe('corn');
  });
});

describe('F18 (b) — com terra ao alcance: produz, para, e volta', () => {
  it('a serie de entrega tem o degrau, o patamar e o degrau seguinte', () => {
    const inicial = cenarioDeFazendaDeUmTile();
    const serie = serieDeEntrega(
      inicial, [0, PLANTIO, MADURO, PRIMEIRA - 1, PRIMEIRA, SECOU, PARADA, VOLTOU - 1, VOLTOU],
    );

    // o tick 0 e a linha de base, e ela e zero: o campo nasce em pousio.
    expect(serie[0]).toBe(0);
    // durante o primeiro plantio nao ha o que colher, e nada foi entregue — nem
    // durante o crescer: no tick em que o tile amadurece ainda nao saiu nada.
    expect(serie[PLANTIO]).toBe(0);
    expect(serie[MADURO]).toBe(0);
    // PRODUZ: o primeiro milho entra na gaveta no tick EXATO em que o roceiro
    // chega de volta — um tick antes ele ainda esta na estrada, de maos cheias.
    expect(serie[PRIMEIRA - 1]).toBe(0);
    expect(serie[PRIMEIRA]).toBe(1);
    // e segue, ate o tile secar — um ciclo por colheita, o rendimento inteiro.
    expect(serie[SECOU]).toBe(RENDIMENTO);
    // PARA: com o tile zerado o roceiro replanta, e no meio do replantio o
    // acumulado e o MESMO de quando secou. E o patamar — e ele dura o crescer
    // inteiro, ate o tick anterior a volta (`VOLTOU - 1`, abaixo).
    expect(serie[PARADA]).toBe(RENDIMENTO);
    // VOLTA: replantado o campo, a colheita seguinte entrega de novo, e tambem
    // ela no tick exato da chegada.
    expect(serie[VOLTOU - 1]).toBe(RENDIMENTO);
    expect(serie[VOLTOU]).toBe(RENDIMENTO + 1);
  });

  it('o patamar e o campo vazio, e nao a gaveta cheia nem o caminho cortado', () => {
    // Um patamar por gaveta cheia ou estrada faltando contaria a mesma historia
    // na serie acima. Aqui se afirma a CAUSA do patamar: o tile esta em zero e o
    // roceiro esta plantando. F-CAMPO-a: plantar deixou de ser `trabalhando` dentro
    // do predio e virou a fase `semeando`, no tile; a afirmacao e a mesma.
    const parada = avancar(cenarioDeFazendaDeUmTile(), PARADA);
    const predio = parada.predios.porId.f1;
    if (predio?.estado !== 'completo') throw new Error('fixture: f1 deveria estar completo');
    const plantio = predio.producao?.plantio ?? null;
    expect(plantio).not.toBeNull();
    expect(recursoNoTile(parada, plantio!.tile.gx, plantio!.tile.gy)?.quantidade).toBe(0);
    expect(fsmDe(parada, 'roceiro')).toBe('semeando');
    // a gaveta ainda tem espaco, e por isso o patamar nao e dela.
    const naGaveta = Object.values(predio.estoque.saida).reduce((s, q) => s + q, 0);
    expect(naGaveta).toBeLessThan(predio.capacidade.saida ?? Infinity);
  });
});

describe('F18 — o custo do plantio sai da gaveta de entrada', () => {
  // O milho publicado custa `{}`: arar e semear nao gasta mercadoria. O ramo que
  // COBRA so ganha consumidor de verdade no Wineyard, entao aqui ele e
  // exercitado com custo INJETADO — senao entraria no jogo sem teste nenhum.
  const comCusto = comCustoDePlantio(gameData, GRAO, { timber: 1 });

  it('o milho do dado publicado nao cobra nada: a fixture e que cobra', () => {
    expect(gameData.recursos.tipos[GRAO]?.reposicao?.custo).toEqual({});
    expect(comCusto.recursos.tipos[GRAO]?.reposicao?.custo).toEqual({ timber: 1 });
  });

  it('com o insumo na gaveta, planta e DEBITA', () => {
    const inicial = comEntrada(cenarioDeFazendaDeUmTile(comCusto), 'f1', { timber: 1 });
    const depois = avancar(inicial, SEMEADO_EM, comCusto);
    expect(entradaDe(inicial, 'f1').timber).toBe(1);
    expect(entradaDe(depois, 'f1').timber).toBe(0);
    expect(entregue(avancar(inicial, PRIMEIRA, comCusto), GRAO)).toBe(1);
  });

  it('sem o insumo NAO planta: o campo fica em pousio e o roceiro espera', () => {
    const inicial = cenarioDeFazendaDeUmTile(comCusto);
    const depois = avancar(inicial, PRIMEIRA, comCusto);
    expect(entregue(depois, GRAO)).toBe(0);
    expect(fsmDe(depois, 'roceiro')).toBe('esperando_insumo');
    // e nao ficou nenhum plantio pela metade segurando tile: sem cobrar, nao
    // comeca. O `release` do caso de erro e nao ter havido claim.
    const predio = depois.predios.porId.f1;
    expect(predio?.estado === 'completo' ? predio.producao?.plantio ?? null : 'sem predio')
      .toBeNull();
  });
});

describe('F18 — evidencia', () => {
  it('grava a evidencia do aceite', () => {
    const semCampo = cenarioDeFazendaSemCampo();
    const comCampo = cenarioDeFazendaDeUmTile();
    gravarEvidencia('F18', {
      feature: 'F18-rocado-de-milho',
      aceite: 'BUILD_PLAN.md F18: fazenda sem tile aravel alcancavel nao produz',
      derivadoDoDado: {
        recurso: GRAO,
        ticksDePlantio: PLANTIO,
        ticksDeCrescer: CRESCER,
        ticksDoCiclo: CICLO,
        rendimentoPorTile: RENDIMENTO,
        alcanceEmTiles: RECEITA.colheita?.alcance ?? null,
        custoDePlantio: gameData.recursos.tipos[GRAO]?.reposicao?.custo ?? null,
      },
      a_semCampo: {
        fazenda: { gx: 33, gy: 30, nota: 'na vila, longe de toda terra arada' },
        entregueEm: VOLTOU,
        entregue: entregue(avancar(semCampo, VOLTOU)) - entregue(semCampo),
        alertas: alertasDoEstado(avancar(semCampo, VOLTOU), gameData),
      },
      b_comCampo: {
        fazenda: { gx: 112, gy: 30, nota: 'na borda do bloco aravel do nordeste, com UM tile de campo ao alcance (F-CAMPO-a)' },
        marcos: { SEMEADO_EM, MADURO, PRIMEIRA, SECOU, PARADA, VOLTOU },
        voltaInteiraFT3: {
          ticks: VOLTA_INTEIRA,
          transicao: 1,
          idaAteOTile: IDA,
          relogioNoTile: CICLO,
          voltaAtePorta: VOLTA,
          nota: 'F-T3: o roceiro sai da fazenda; o milho entra na gaveta no tick da chegada, e o intervalo entre colheitas passou de 246 para 351 ticks (F-CAMPO-a, alcance 2: 169)',
        },
        serieDeEntrega: serieDeEntrega(comCampo, [0, PLANTIO, MADURO, PRIMEIRA, SECOU, PARADA, VOLTOU]),
        alertasNoPatamar: alertasDoEstado(avancar(comCampo, PARADA), gameData),
      },
      custoDePlantioInjetado: {
        nota: 'o milho publicado custa {}; o ramo que cobra e exercitado com timber: 1',
      },
    });
    expect(true).toBe(true);
  });
});
