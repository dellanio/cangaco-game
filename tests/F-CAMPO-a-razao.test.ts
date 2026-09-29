/**
 * F-CAMPO-a — O ACEITE do operador (`docs/planos/F-CAMPO-a.md`), reescrito por ele
 * em 2026-09-27: com N tiles ao alcance a producao e MAIOR que com 1 tile, por uma
 * margem medida. O criterio antigo ("~24 milhos em 6 000 ticks") era do modelo em
 * que o plantio corria dentro do predio, e nao cabe com o campo crescendo no tile.
 *
 * O que se afirma e a RAZAO, e nao um total: o total muda a cada giro de
 * balanceamento, a razao e o que o modelo promete. Com o crescer no tile, um tile
 * so deixa o roceiro parado enquanto o milho cresce; com varios, ele colhe um
 * enquanto os outros crescem.
 *
 * Medido por sonda (apagada) em 2026-09-27, milho produzido pela fazenda do norte,
 * gaveta esvaziada a cada tick:
 *
 *   | tiles | 6 000 | 12 000 |
 *   |-------|-------|--------|
 *   | 1     | 8     | 16     |
 *   | 4     | 16    | 32     |
 *   | 14    | 18    | 46     |  <- 2,9x um tile em 12 000
 *
 * O Canavial dava so 1,5x (15 contra 10 em 12 000): o ciclo dele e 600 ticks
 * (`wineyard.sai.wine` 0,5), a colheita domina a volta do canavieiro e ele satura
 * com 2 a 4 tiles. A fazenda e o cenario de margem clara, e e ela que fica aqui.
 *
 * A janela e 12 000 porque o cenario nao tem comida: sem repor a condicao, a
 * producao para entre 12 000 e 20 000 (medido; com a condicao reposta, segue). A
 * fome e outra cadeia, e esta janela a deixa fora sem mexer na unidade.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import { receitaDoTipo } from '../src/sim/producao';
import { tilesDeColheita } from '../src/sim/recursos';
import { step } from '../src/sim/tick';
import { gravarEvidencia } from './helpers/evidence';
import {
  cenarioDeFazenda, cenarioDeFazendaDeUmTile, comEspacoNaSaida,
} from './helpers/producao-cenario';

const RECEITA = receitaDoTipo('farm', gameData);
if (RECEITA === null || RECEITA.colheita === null) {
  throw new Error('fixture: `farm` precisa de receita com colheita em data/production.json');
}
const COLHEITA = RECEITA.colheita;

const JANELA = 12000;
/** O piso da razao. Medido 2,9 (46 / 16); o modelo antigo, com 12 tiles, dava
 *  1,04 (BUILD_PLAN, F-CAMPO, tabela do crescer). O piso separa os dois com folga
 *  dos dois lados. */
const PISO_DA_RAZAO = 2;

interface Corrida {
  readonly tilesAoAlcance: number;
  readonly produzido: number;
  readonly tilesColhidos: number;
  readonly primeiroMilho: number | null;
}

/** Anda a janela contando `goods-produced` da f1 e os tiles cuja quantidade caiu.
 *  A gaveta de saida e esvaziada a cada tick: o cenario nao tem serf, e com ela
 *  cheia a fazenda pararia pelo motivo errado. */
function correr(inicial: GameState): Corrida {
  const predio = inicial.predios.porId.f1;
  if (predio?.estado !== 'completo') throw new Error('fixture: f1 nao esta completa');
  const tiles = tilesDeColheita(inicial, predio, COLHEITA, gameData);
  let s = inicial;
  let produzido = 0;
  let primeiroMilho: number | null = null;
  const colhidos = new Set<string>();
  for (let i = 0; i < JANELA; i += 1) {
    const antes = s.recursos;
    s = comEspacoNaSaida(step(s, [], gameData), 'f1');
    for (const e of s.events) {
      if (e.type !== 'goods-produced' || e.predio !== 'f1') continue;
      produzido += e.quantidade;
      primeiroMilho ??= s.tick;
    }
    for (const k of tiles) {
      const q0 = antes[k]?.quantidade ?? 0;
      const q1 = s.recursos[k]?.quantidade ?? 0;
      if (q1 < q0) colhidos.add(k);
    }
  }
  return { tilesAoAlcance: tiles.length, produzido, tilesColhidos: colhidos.size, primeiroMilho };
}

describe('F-CAMPO-a — varios tiles ao alcance rendem mais que um', () => {
  it(`com a fazenda cheia, a producao em ${JANELA} ticks e >= ${PISO_DA_RAZAO}x a de um tile`, () => {
    const um = correr(cenarioDeFazendaDeUmTile());
    const cheia = correr(cenarioDeFazenda());

    // o PONTO DE PARTIDA, afirmado: um cenario tem 1 tile, o outro mais.
    expect(um.tilesAoAlcance).toBe(1);
    expect(cheia.tilesAoAlcance).toBeGreaterThan(1);
    expect(um.produzido, 'um tile produz').toBeGreaterThan(0);

    // "mais de um tile produz": o roceiro gira pelos tiles, nao fica preso no primeiro.
    expect(cheia.tilesColhidos).toBeGreaterThan(1);
    // a RAZAO, que e o aceite.
    expect(cheia.produzido).toBeGreaterThanOrEqual(PISO_DA_RAZAO * um.produzido);

    gravarEvidencia('F-CAMPO-a', {
      _doc: 'F-CAMPO-a — razao da producao, N tiles contra 1. Numeros da corrida, nao asseridos alem do piso.',
      janela: JANELA,
      pisoDaRazao: PISO_DA_RAZAO,
      umTile: um,
      fazendaCheia: cheia,
      razao: um.produzido === 0 ? null : cheia.produzido / um.produzido,
    });
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: 0,90 / 0,98 s
    // isolado (2026-09-29); 5x daria menos, e o limite fica no piso, o padrao do Vitest.
  }, 5_000);
});
