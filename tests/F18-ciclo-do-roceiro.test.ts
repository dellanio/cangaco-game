/**
 * F18, tarefa 4 — O CICLO DO ROCEIRO: ara, semeia, espera, colhe, e recomeca.
 *
 * A fazenda tem a forma da pedreira — colhe um recurso de tile ao alcance — com
 * a diferenca que e a feature inteira: o milho nao esta no chao esperando. Terra
 * arada nasce em POUSIO, e quem a enche e o proprio roceiro.
 *
 * O que se afirma aqui e a SEQUENCIA do tile, tick a tick: 0 -> (plantio) -> 4
 * -> 3 -> 2 -> 1 -> 0 -> (plantio) -> 4. Cada degrau tem tick exato, porque as
 * duas duracoes vem do dado e viraram tick inteiro no carregamento.
 *
 * F-T3 — o roceiro PASSOU a sair do predio, e a sequencia do tile e a mesma: o que
 * mudou e QUANDO cada degrau cai. Entre duas colheitas ha agora a ida ao tile, o
 * relogio do ciclo la, e a volta ate a porta — o milho sai do tile no tick da
 * CHEGADA, junto com o deposito, e nao no tick em que o relogio fecha. O plantio
 * continua sendo trabalho de dentro: e a unica parte do ciclo em que ele nao anda,
 * e isto tambem esta afirmado abaixo.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import {
  melhorTileParaPlantio, recursoNoTile, tilesReservadosParaColheita,
} from '../src/sim/recursos';
import { receitaDoTipo, unidadesPorCiclo } from '../src/sim/producao';
import { chaveDeTile, type TileDeGrid } from '../src/sim/estradas';
import { avancar, cenarioDeFazenda, fsmDe, saidaDe } from './helpers/producao-cenario';

const RECEITA = receitaDoTipo('farm', gameData);
if (RECEITA === null || RECEITA.colheita === null) {
  throw new Error('fixture: `farm` precisa de receita com colheita em data/production.json');
}
const COLHEITA = RECEITA.colheita;
const TICKS_DE_PLANTIO = gameData.recursos.tipos[COLHEITA.recurso]?.reposicao?.ticksDeSemear ?? 0;
const TICKS_DO_CICLO = RECEITA.ticksDoCiclo;
const RENDIMENTO = gameData.recursos.tipos[COLHEITA.recurso]?.rendimentoPorTile ?? 0;
const POR_CICLO = unidadesPorCiclo(RECEITA);
const CICLOS_ATE_SECAR = RENDIMENTO / POR_CICLO;

/**
 * F-T3 — as duas pernas da viagem neste cenario (f1 em (112,30), porta (112,33),
 * tile (108,26) trabalhado de (109,27)), medidas. A volta inteira e o tick da
 * transicao mais a ida, o relogio do dado e a volta: e ela, e nao `ticksDoCiclo`,
 * o intervalo entre dois degraus do tile.
 */
const IDA = 53;
const VOLTA = 51;
const VOLTA_INTEIRA = 1 + IDA + TICKS_DO_CICLO + VOLTA;

/** O plantio que a fazenda `f1` do cenario abre no primeiro tick. Descoberto
 *  pelo ESTADO, nao digitado: a posicao vem do mapa versionado, e mudar o mapa
 *  nao pode quebrar o teste por uma coordenada escrita a mao. */
function plantioDaFazenda(estado: GameState): { readonly tile: TileDeGrid } {
  const predio = estado.predios.porId.f1;
  const plantio = predio?.estado === 'completo' ? predio.producao?.plantio ?? null : null;
  if (plantio === null) throw new Error('fixture: a fazenda nao abriu plantio nenhum');
  return plantio;
}

describe('F18 — o ciclo do roceiro, tick a tick', () => {
  it('as duracoes do cenario vem do dado, e nenhuma e zero', () => {
    // Sem isto, um dado zerado faria todo degrau abaixo cair no mesmo tick e o
    // teste passaria afirmando nada.
    expect(TICKS_DE_PLANTIO).toBeGreaterThan(0);
    expect(TICKS_DO_CICLO).toBeGreaterThan(0);
    expect(POR_CICLO).toBeGreaterThan(0);
    expect(CICLOS_ATE_SECAR).toBe(Math.round(CICLOS_ATE_SECAR));
    expect(CICLOS_ATE_SECAR).toBeGreaterThan(1);
  });

  it('planta, colhe ate secar, replanta o MESMO tile e volta a colher', () => {
    const inicial = cenarioDeFazenda(gameData);
    const { tile } = plantioDaFazenda(avancar(inicial, 1, gameData));
    const quantidadeNoTick = (t: number): number =>
      recursoNoTile(avancar(inicial, t, gameData), tile.gx, tile.gy)?.quantidade ?? -1;

    // tick 0: pousio. O campo nasce vazio e a gaveta da fazenda tambem.
    expect(recursoNoTile(inicial, tile.gx, tile.gy))
      .toEqual({ tipo: COLHEITA.recurso, quantidade: 0 });
    expect(saidaDe(inicial, 'f1')[COLHEITA.recurso] ?? 0).toBe(0);

    // o plantio dura o que o dado diz: no tick anterior ainda e pousio.
    expect(quantidadeNoTick(TICKS_DE_PLANTIO - 1)).toBe(0);
    expect(quantidadeNoTick(TICKS_DE_PLANTIO)).toBe(RENDIMENTO);

    // e cada ciclo tira do tile o que UM ciclo rende, no tick exato — o da CHEGADA
    // do roceiro na porta, que e onde o milho troca de mao.
    for (let n = 1; n <= CICLOS_ATE_SECAR; n += 1) {
      const t = TICKS_DE_PLANTIO + n * VOLTA_INTEIRA;
      expect(quantidadeNoTick(t - 1), `tick ${t - 1}`).toBe(RENDIMENTO - (n - 1) * POR_CICLO);
      expect(quantidadeNoTick(t), `tick ${t}`).toBe(RENDIMENTO - n * POR_CICLO);
    }

    // secou: o replantio abre no tick SEGUINTE e leva o mesmo tempo. O tile e o
    // MESMO, porque a varredura do plantio tem a ordem da varredura da colheita.
    const secou = TICKS_DE_PLANTIO + CICLOS_ATE_SECAR * VOLTA_INTEIRA;
    const replantado = secou + TICKS_DE_PLANTIO;
    expect(plantioDaFazenda(avancar(inicial, secou + 1, gameData)).tile).toEqual(tile);
    expect(quantidadeNoTick(replantado - 1)).toBe(0);
    expect(quantidadeNoTick(replantado)).toBe(RENDIMENTO);

    // e o que ja foi entregue nao volta atras: a safra saiu do tile e ficou na
    // gaveta. Medido contra o tick 0, que era zero.
    expect(saidaDe(avancar(inicial, replantado, gameData), 'f1')[COLHEITA.recurso] ?? 0)
      .toBe(RENDIMENTO);
  });

  it('o tile em plantio fica reservado, e o plantio seguinte escolhe outro', () => {
    // A reserva mora no predio (`producao.plantio`), mas a pergunta e a mesma que
    // a F-T2c respondeu para a tarefa de colheita — e a resposta e a UNIAO.
    const emPlantio = avancar(cenarioDeFazenda(gameData), 1, gameData);
    const { tile } = plantioDaFazenda(emPlantio);
    const reservados = tilesReservadosParaColheita(emPlantio);
    expect(reservados.has(chaveDeTile(tile))).toBe(true);

    // e e a reserva que faz o vizinho desviar: com ela, a busca devolve outro
    // tile; sem ela, devolveria este mesmo.
    const predio = emPlantio.predios.porId.f1;
    if (predio?.estado !== 'completo') throw new Error('fixture: f1 deveria estar completo');
    expect(melhorTileParaPlantio(emPlantio, predio, COLHEITA, new Set(), gameData))
      .toBe(chaveDeTile(tile));
    expect(melhorTileParaPlantio(emPlantio, predio, COLHEITA, reservados, gameData))
      .not.toBe(chaveDeTile(tile));
  });

  it('terminado o plantio o predio LARGA, e no tick seguinte a tarefa reserva', () => {
    // Nenhum ramo de `release` a escrever: o plantio termina e a reserva morre
    // junto, porque ela E o campo `plantio`. Quem reserva o tile dali em diante e
    // a tarefa de colher, que ja tem release proprio desde a F-T2c.
    //
    // No tick da virada nao ha reserva nenhuma: a terra fica um tick a descoberto
    // entre semear e abrir a colheita. E de proposito, e nao e propriedade — o
    // tile plantado e do mapa, como a rocha, e quem reclamar primeiro colhe.
    const inicial = cenarioDeFazenda(gameData);
    const { tile } = plantioDaFazenda(avancar(inicial, 1, gameData));
    const chave = chaveDeTile(tile);
    const colheitasDe = (s: GameState): readonly unknown[] =>
      Object.values(s.jobs.tarefas.porId).filter((t) => t?.tipo === 'colher');

    const naVirada = avancar(inicial, TICKS_DE_PLANTIO, gameData);
    const predio = naVirada.predios.porId.f1;
    if (predio?.estado !== 'completo') throw new Error('fixture: f1 deveria estar completo');
    expect(predio.producao?.plantio ?? null).toBeNull();
    expect(colheitasDe(naVirada)).toHaveLength(0);
    expect(tilesReservadosParaColheita(naVirada).has(chave)).toBe(false);

    const seguinte = avancar(naVirada, 1, gameData);
    expect(colheitasDe(seguinte)).toHaveLength(1);
    expect(tilesReservadosParaColheita(seguinte).has(chave)).toBe(true);
  });

  it('durante o PLANTIO o roceiro nao sai nem fica ocioso, e depois dele sai', () => {
    // O rotulo e `trabalhando` do primeiro tick ao ultimo do plantio: plantar E
    // trabalho de dentro, e o jogador nao pode ver a fazenda parecendo parada pelo
    // plantio inteiro. Ele nao anda um tile nesse trecho.
    let s = cenarioDeFazenda(gameData);
    const antes = s.unidades.porId.roceiro;
    if (antes === undefined) throw new Error('fixture: o cenario precisa do roceiro');
    const naPorta = (e: GameState): [number | undefined, number | undefined] => {
      const u = e.unidades.porId.roceiro;
      return [u?.gx, u?.gy];
    };
    for (let t = 0; t < TICKS_DE_PLANTIO; t += 1) {
      s = avancar(s, 1, gameData);
      expect(fsmDe(s, 'roceiro'), `tick ${t + 1}`).toBe('trabalhando');
      expect(naPorta(s), `tick ${t + 1}`).toEqual([antes.gx, antes.gy]);
    }

    // e no tick SEGUINTE ao plantio ele sai — e a F-T3, e o teste diz o tick.
    s = avancar(s, 1, gameData);
    expect(fsmDe(s, 'roceiro')).toBe('indo_colher');

    // a volta fecha onde comecou: no fim de uma volta inteira ele esta de novo na
    // porta, em `trabalhando`, e o milho ja entrou na gaveta.
    s = avancar(s, VOLTA_INTEIRA - 1, gameData);
    expect(fsmDe(s, 'roceiro')).toBe('trabalhando');
    expect(naPorta(s)).toEqual([antes.gx, antes.gy]);
    expect(saidaDe(s, 'f1')[COLHEITA.recurso] ?? 0).toBe(POR_CICLO);
  });

  it('so repoe o tipo que declara reposicao: pedreira nenhuma refaz lajedo', () => {
    // O gatilho e `reposicao` no DADO, nao o id do predio. Tipo sem reposicao nao
    // planta, e e isso que mantem o veio um recurso que acaba.
    expect(gameData.recursos.tipos.rock?.reposicao ?? null).toBeNull();
    expect(gameData.recursos.tipos.tree?.reposicao ?? null).toBeNull();
    expect(gameData.recursos.tipos[COLHEITA.recurso]?.reposicao ?? null).not.toBeNull();
  });
});
