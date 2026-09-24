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
  avancar, cenarioDeFazenda, cenarioDeFazendaSemCampo, comCustoDePlantio, comEntrada, entradaDe,
  fsmDe,
} from './helpers/producao-cenario';

const RECEITA = receitaDoTipo('farm', gameData);
if (RECEITA === null || RECEITA.colheita === null) {
  throw new Error('fixture: `farm` precisa de receita com colheita em data/production.json');
}
const GRAO = RECEITA.colheita.recurso;
const PLANTIO = gameData.recursos.tipos[GRAO]?.reposicao?.ticks ?? 0;
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
const PRIMEIRA = PLANTIO + CICLO;
const SECOU = PLANTIO + RENDIMENTO * CICLO;
const PARADA = SECOU + Math.floor(PLANTIO / 2);
const VOLTOU = SECOU + PLANTIO + CICLO;

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
    const inicial = cenarioDeFazenda();
    const serie = serieDeEntrega(inicial, [0, PLANTIO, PRIMEIRA, SECOU, PARADA, VOLTOU]);

    // o tick 0 e a linha de base, e ela e zero: o campo nasce em pousio.
    expect(serie[0]).toBe(0);
    // durante o primeiro plantio nao ha o que colher, e nada foi entregue.
    expect(serie[PLANTIO]).toBe(0);
    // PRODUZ: o primeiro ciclo fecha um ciclo depois de a terra ficar pronta.
    expect(serie[PRIMEIRA]).toBe(1);
    // e segue, ate o tile secar — um ciclo por colheita, o rendimento inteiro.
    expect(serie[SECOU]).toBe(RENDIMENTO);
    // PARA: com o tile zerado o roceiro replanta, e no meio do replantio o
    // acumulado e o MESMO de quando secou. E o patamar.
    expect(serie[PARADA]).toBe(RENDIMENTO);
    // VOLTA: replantado o campo, a colheita seguinte entrega de novo.
    expect(serie[VOLTOU]).toBe(RENDIMENTO + 1);
  });

  it('o patamar e o campo vazio, e nao a gaveta cheia nem o caminho cortado', () => {
    // Um patamar por gaveta cheia ou estrada faltando contaria a mesma historia
    // na serie acima. Aqui se afirma a CAUSA do patamar: o tile esta em zero e o
    // roceiro esta plantando.
    const parada = avancar(cenarioDeFazenda(), PARADA);
    const predio = parada.predios.porId.f1;
    if (predio?.estado !== 'completo') throw new Error('fixture: f1 deveria estar completo');
    const plantio = predio.producao?.plantio ?? null;
    expect(plantio).not.toBeNull();
    expect(recursoNoTile(parada, plantio!.tile.gx, plantio!.tile.gy)?.quantidade).toBe(0);
    expect(fsmDe(parada, 'roceiro')).toBe('trabalhando');
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
    const inicial = comEntrada(cenarioDeFazenda(comCusto), 'f1', { timber: 1 });
    const depois = avancar(inicial, PLANTIO, comCusto);
    expect(entradaDe(inicial, 'f1').timber).toBe(1);
    expect(entradaDe(depois, 'f1').timber).toBe(0);
    expect(entregue(avancar(inicial, PRIMEIRA, comCusto), GRAO)).toBe(1);
  });

  it('sem o insumo NAO planta: o campo fica em pousio e o roceiro espera', () => {
    const inicial = cenarioDeFazenda(comCusto);
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
    const comCampo = cenarioDeFazenda();
    gravarEvidencia('F18', {
      feature: 'F18-rocado-de-milho',
      aceite: 'BUILD_PLAN.md F18: fazenda sem tile aravel alcancavel nao produz',
      derivadoDoDado: {
        recurso: GRAO,
        ticksDePlantio: PLANTIO,
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
        fazenda: { gx: 112, gy: 30, nota: 'na borda do bloco aravel do nordeste' },
        marcos: { PLANTIO, PRIMEIRA, SECOU, PARADA, VOLTOU },
        serieDeEntrega: serieDeEntrega(comCampo, [0, PLANTIO, PRIMEIRA, SECOU, PARADA, VOLTOU]),
        alertasNoPatamar: alertasDoEstado(avancar(comCampo, PARADA), gameData),
      },
      custoDePlantioInjetado: {
        nota: 'o milho publicado custa {}; o ramo que cobra e exercitado com timber: 1',
      },
    });
    expect(true).toBe(true);
  });
});
