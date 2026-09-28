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
 *
 * F-CAMPO-a — REESCRITO (2026-09-27, decisao do operador que revogou o modelo).
 * O plantio SAIU do predio: o roceiro anda ate o tile, semeia la, e volta. O tile
 * recebe o rendimento cheio com `semeadoEm` e so fica maduro depois de
 * `ticksDeCrescer`, sem ninguem la. A fazenda nao replanta o MESMO tile: o tile
 * que seca volta a pousio e o rodizio (`producao.cursor`) escolhe o proximo
 * trabalho. Os tres testes que afirmavam o modelo antigo estao reescritos abaixo,
 * cada um com o que caiu e o que continua valendo ao lado.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import {
  melhorTileParaPlantio, recursoNoTile, tileMaduro, tilesReservadosParaColheita,
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
const TICKS_DE_CRESCER = gameData.recursos.tipos[COLHEITA.recurso]?.reposicao?.ticksDeCrescer ?? 0;
const TICKS_DO_CICLO = RECEITA.ticksDoCiclo;
const RENDIMENTO = gameData.recursos.tipos[COLHEITA.recurso]?.rendimentoPorTile ?? 0;
const POR_CICLO = unidadesPorCiclo(RECEITA);
const CICLOS_ATE_SECAR = RENDIMENTO / POR_CICLO;

/**
 * F-T3 — as duas pernas da viagem neste cenario (f1 em (112,30), porta (112,33)),
 * medidas. A volta inteira e o tick da transicao mais a ida, o relogio do dado e a
 * volta: e ela, e nao `ticksDoCiclo`, o intervalo entre dois degraus do tile.
 *
 * F-CAMPO-a — com `alcance_tiles` 2 o primeiro tile passou de (108,26) para
 * (110,28), trabalhado de (111,29): as pernas eram 53 / 51 e agora sao 35 / 33,
 * medidas por sonda em 2026-09-27. As mesmas duas servem a ida de semear, que vai
 * ao mesmo tile pelo mesmo vizinho.
 */
const IDA = 35;
const VOLTA = 33;
const VOLTA_INTEIRA = 1 + IDA + TICKS_DO_CICLO + VOLTA;
/** O tick em que o primeiro tile fica semeado: o da transicao, a ida, e o semear
 *  inteiro parado no vizinho do tile. */
const SEMEOU = 1 + IDA + TICKS_DE_PLANTIO;

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
    expect(TICKS_DE_CRESCER).toBeGreaterThan(0);
    expect(TICKS_DO_CICLO).toBeGreaterThan(0);
    expect(POR_CICLO).toBeGreaterThan(0);
    expect(CICLOS_ATE_SECAR).toBe(Math.round(CICLOS_ATE_SECAR));
    expect(CICLOS_ATE_SECAR).toBeGreaterThan(1);
  });

  it('semeia, espera crescer, colhe ate secar, e o tile volta a pousio', () => {
    // REESCRITO (F-CAMPO-a). Caiu: "o tile enche no fim de um plantio feito dentro
    // do predio" e "replanta o MESMO tile no tick seguinte ao secar". Continua
    // valendo, e continua afirmado: o tile nasce em pousio, recebe o rendimento do
    // dado, perde UM ciclo por entrega no tick exato da chegada, e seca com
    // RENDIMENTO na gaveta. O que entrou: entre semear e colher ha o crescer
    // inteiro, e o tile seco volta a pousio sem `semeadoEm` — quem o semeia de novo
    // e o rodizio, nao a fazenda presa a ele.
    const inicial = cenarioDeFazenda(gameData);
    const { tile } = plantioDaFazenda(avancar(inicial, 1, gameData));
    const noTick = (t: number): ReturnType<typeof recursoNoTile> =>
      recursoNoTile(avancar(inicial, t, gameData), tile.gx, tile.gy);
    const quantidadeNoTick = (t: number): number => noTick(t)?.quantidade ?? -1;

    // tick 0: pousio. O campo nasce vazio e a gaveta da fazenda tambem.
    expect(recursoNoTile(inicial, tile.gx, tile.gy))
      .toEqual({ tipo: COLHEITA.recurso, quantidade: 0 });
    expect(saidaDe(inicial, 'f1')[COLHEITA.recurso] ?? 0).toBe(0);

    // o semear dura o que o dado diz, no tile: no tick anterior ainda e pousio.
    expect(quantidadeNoTick(SEMEOU - 1)).toBe(0);
    const semeado = noTick(SEMEOU);
    expect(semeado?.quantidade).toBe(RENDIMENTO);
    if (semeado?.semeadoEm === undefined) throw new Error('fixture: o tile deveria estar semeado');
    const MADURO = semeado.semeadoEm + TICKS_DE_CRESCER;

    // cheio nao e maduro: o tile guarda o rendimento, e a primeira entrega so cai
    // uma volta inteira depois do crescer — o tile nao muda antes dela.
    expect(quantidadeNoTick(MADURO + VOLTA_INTEIRA - 1)).toBe(RENDIMENTO);

    // e cada ciclo tira do tile o que UM ciclo rende, no tick exato — o da CHEGADA
    // do roceiro na porta, que e onde o milho troca de mao.
    for (let n = 1; n <= CICLOS_ATE_SECAR; n += 1) {
      const t = MADURO + n * VOLTA_INTEIRA;
      expect(quantidadeNoTick(t - 1), `tick ${t - 1}`).toBe(RENDIMENTO - (n - 1) * POR_CICLO);
      expect(quantidadeNoTick(t), `tick ${t}`).toBe(RENDIMENTO - n * POR_CICLO);
    }

    // secou: o tile e pousio de novo — vazio e sem relogio —, e o que ja foi
    // entregue ficou na gaveta. Medido contra o tick 0, que era zero.
    const secou = MADURO + CICLOS_ATE_SECAR * VOLTA_INTEIRA;
    expect(noTick(secou)).toEqual({ tipo: COLHEITA.recurso, quantidade: 0 });
    expect(saidaDe(avancar(inicial, secou, gameData), 'f1')[COLHEITA.recurso] ?? 0)
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

  it('terminado o plantio a reserva morre junto, e ninguem reclama o tile antes de maduro', () => {
    // REESCRITO (F-CAMPO-a). Continua valendo, e continua afirmado: nenhum ramo de
    // `release` a escrever — o plantio termina e a reserva morre junto, porque ela
    // E o campo `plantio`; quem reserva o tile dali em diante e a tarefa de colher,
    // com release proprio desde a F-T2c. Caiu: "no tick seguinte a tarefa de colher
    // reserva". O tile semeado agora cresce, e o que se afirma no lugar e que ele
    // fica sem reserva e sem tarefa de colher pelo crescer inteiro, e so e
    // reclamado no passo em que `tileMaduro` vira.
    const inicial = cenarioDeFazenda(gameData);
    const { tile } = plantioDaFazenda(avancar(inicial, 1, gameData));
    const chave = chaveDeTile(tile);
    const colheitasDe = (e: GameState): readonly unknown[] =>
      Object.values(e.jobs.tarefas.porId).filter((t) => t?.tipo === 'colher');

    const antes = avancar(inicial, SEMEOU - 1, gameData);
    expect(tilesReservadosParaColheita(antes).has(chave)).toBe(true);

    let s = avancar(antes, 1, gameData);
    const predio = s.predios.porId.f1;
    if (predio?.estado !== 'completo') throw new Error('fixture: f1 deveria estar completo');
    expect(predio.producao?.plantio ?? null).toBeNull();
    const semeadoEm = recursoNoTile(s, tile.gx, tile.gy)?.semeadoEm;
    if (semeadoEm === undefined) throw new Error('fixture: o tile deveria estar semeado');
    const maduroEm = semeadoEm + TICKS_DE_CRESCER;

    // o crescer inteiro, tick a tick: sem reserva e sem tarefa de colher. E o
    // relogio e o do dado: `tileMaduro` vira exatamente em `semeadoEm + crescer`.
    while (s.tick <= maduroEm) {
      const r = recursoNoTile(s, tile.gx, tile.gy);
      if (r === null) throw new Error('fixture: o tile sumiu');
      expect(tileMaduro(s, r, gameData), `tick ${s.tick}`).toBe(s.tick >= maduroEm);
      expect(tilesReservadosParaColheita(s).has(chave), `tick ${s.tick}`).toBe(false);
      expect(colheitasDe(s), `tick ${s.tick}`).toHaveLength(0);
      s = avancar(s, 1, gameData);
    }

    // e o passo que roda com o tile ja maduro abre a tarefa, que o reserva.
    expect(colheitasDe(s)).toHaveLength(1);
    expect(tilesReservadosParaColheita(s).has(chave)).toBe(true);
  });

  it('para semear o roceiro sai, semeia parado no tile, volta, e nunca fica ocioso', () => {
    // REESCRITO (F-CAMPO-a). Caiu: "plantar e trabalho de dentro, ele nao anda um
    // tile" e "no tick seguinte ao plantio ele sai para colher". Continua valendo,
    // e continua afirmado: a fazenda nunca parece parada durante o plantio — cada
    // tick tem um rotulo de trabalho, nenhum e `ocioso` —, o semear dura o que o
    // dado diz com o roceiro PARADO, e a viagem fecha na porta de onde saiu. O que
    // entrou: ele sai no tick 1 (`indo_semear`), semeia no vizinho do tile
    // (`semeando`) e volta (`voltando`), e o proximo trabalho do rodizio e OUTRO
    // tile, porque o semeado ainda nao cresceu.
    let s = cenarioDeFazenda(gameData);
    const antes = s.unidades.porId.roceiro;
    if (antes === undefined) throw new Error('fixture: o cenario precisa do roceiro');
    const ondeEsta = (e: GameState): [number | undefined, number | undefined] => {
      const u = e.unidades.porId.roceiro;
      return [u?.gx, u?.gy];
    };
    const { tile } = plantioDaFazenda(avancar(s, 1, gameData));

    const esperado = (t: number): string => {
      if (t <= IDA) return 'indo_semear';
      if (t < SEMEOU) return 'semeando';
      if (t < SEMEOU + VOLTA) return 'voltando';
      return 'trabalhando';
    };
    let noTile: [number | undefined, number | undefined] | null = null;
    for (let t = 1; t <= SEMEOU + VOLTA; t += 1) {
      s = avancar(s, 1, gameData);
      expect(fsmDe(s, 'roceiro'), `tick ${t}`).toBe(esperado(t));
      // o semear inteiro no MESMO tile: ele chegou e nao se mexe ate acabar.
      if (esperado(t) === 'semeando') {
        noTile ??= ondeEsta(s);
        expect(ondeEsta(s), `tick ${t}`).toEqual(noTile);
      }
    }
    expect(noTile).not.toBeNull();

    // a volta fecha onde comecou, e o tile ficou semeado atras dele.
    expect(ondeEsta(s)).toEqual([antes.gx, antes.gy]);
    expect(recursoNoTile(s, tile.gx, tile.gy)?.quantidade).toBe(RENDIMENTO);

    // e o proximo trabalho e semear OUTRO tile: o primeiro ainda cresce.
    s = avancar(s, 1, gameData);
    expect(fsmDe(s, 'roceiro')).toBe('indo_semear');
    expect(plantioDaFazenda(s).tile).not.toEqual(tile);
  });

  it('so repoe o tipo que declara reposicao: pedreira nenhuma refaz lajedo', () => {
    // O gatilho e `reposicao` no DADO, nao o id do predio. Tipo sem reposicao nao
    // planta, e e isso que mantem o veio um recurso que acaba.
    expect(gameData.recursos.tipos.rock?.reposicao ?? null).toBeNull();
    // F-REPL-a (decisao do operador, 2026-09-27): a arvore passou a ter
    // `reposicao` — o lenhador replanta o toco. E o mesmo gatilho por dado; o
    // que afirma o replantio dela e `tests/F-REPL-a-toco-rebrota.test.ts`.
    expect(gameData.recursos.tipos.tree?.reposicao ?? null).not.toBeNull();
    expect(gameData.recursos.tipos[COLHEITA.recurso]?.reposicao ?? null).not.toBeNull();
  });
});
