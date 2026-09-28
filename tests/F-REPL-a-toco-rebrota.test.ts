/**
 * F-REPL-a — o toco rebrota (decisao do operador, 2026-09-27). O lenhador replanta
 * ONDE CORTOU, pelo mesmo rodizio do campo: o gatilho e `tree.reposicao` no dado,
 * e nenhum codigo sabe que o predio e lenhador. Tile virgem nao vira mata.
 *
 * A regra nova de codigo e uma so: toco sob estrada (assentada ou no canteiro) nao
 * rebrota (`tilePlantavel`). A sonda da Tarefa 1 mediu o defeito sem ela: a estrada
 * passava por cima do toco, a arvore nascia no meio dela e dois serfs parados na
 * rua ficavam dentro do tronco por milhares de ticks.
 *
 * A mata curta e feita no ESTADO, depois do cenario montado: encurtar no dado
 * (`comJazida`) muda onde a abertura poe o lenhador. `w2` fica pausado pelo
 * comando, para nao dividir os tiles de `w1`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { Command } from '../src/sim/commands';
import type { GameState } from '../src/sim/state';
import { buscarCaminho } from '../src/sim/pathfinding';
import { tileDeChave } from '../src/sim/estradas';
import { step } from '../src/sim/tick';
import { gravarEvidencia } from './helpers/evidence';
import { cenarioOraculo, comEspacoNaSaida } from './helpers/producao-cenario';
import { type Corrida, correr as correrComFinal, mataCurta, semReposicao, tilesDeW1 } from './helpers/mata-curta';

const JANELA = 12000;
const RENDIMENTO = gameData.recursos.tipos.tree?.rendimentoPorTile ?? 0;

/** A corrida sem o estado final: e o que vai para a evidencia. */
function correr(inicial: GameState, tiles: readonly string[], dados: GameData): Corrida {
  const { final: _final, ...r } = correrComFinal(inicial, tiles, dados, JANELA);
  return r;
}

/**
 * Anda ate existir um toco ao alcance de `w1`, na mata de 2 tiles. Na mata inteira
 * o rodizio corta adulta antes de plantar e, em 12000 ticks, nao replanta nenhum
 * toco (evidencia: `mataInteiraComReposicao`) — ali o contraste "sem estrada ele
 * rebrota" nao aconteceria.
 */
function ateOPrimeiroToco(dados: GameData): { s: GameState; toco: string } {
  const curta = mataCurta(dados, 2);
  const tiles = curta.tiles;
  let s = curta.s;
  for (let i = 0; i < 20000; i += 1) {
    s = comEspacoNaSaida(step(s, [], dados), 'w1');
    const toco = tiles.find((k) => s.recursos[k]?.quantidade === 0);
    if (toco !== undefined) return { s, toco };
  }
  throw new Error('fixture: w1 nunca cortou uma arvore');
}

describe('F-REPL-a — o toco rebrota', () => {
  it('a mata de 2 tiles da mais que 2 x rendimento, e sem `reposicao` da exatamente isso', () => {
    const agora = mataCurta(gameData, 2);
    const antes = mataCurta(semReposicao(gameData), 2);
    expect(agora.tiles).toHaveLength(2);
    const r = correr(agora.s, agora.tiles, gameData);
    const r0 = correr(antes.s, antes.tiles, semReposicao(gameData));
    const teto = agora.tiles.length * RENDIMENTO;
    // prova de que acusa, na mesma corrida: sem reposicao a mata acaba no teto
    expect(r0.troncos).toBe(teto);
    expect(r0.replantios).toBe(0);
    expect(r0.depois).toBe(0);
    // com reposicao: acabou a adulta, e mesmo assim veio tronco depois
    expect(r.semAdulta).not.toBeNull();
    expect(r.depois).toBeGreaterThan(0);
    expect(r.troncos).toBeGreaterThan(teto);
    expect(r.replantios).toBeGreaterThan(0);
    expect(r.dentroDaArvore).toBe(0);
  }, 120000);

  it('toco sob estrada nao rebrota; o mesmo toco, sem estrada, rebrota', () => {
    const { s: s0, toco } = ateOPrimeiroToco(gameData);
    const estrada: Command = { type: 'PlaceRoad', tiles: [tileDeChave(toco)] };
    let comEstrada = step(s0, [estrada], gameData);
    expect(comEstrada.estradasPlanejadas[toco]).toBe(true);
    let semEstrada = s0;
    let assentou = false;
    let rebrotouSemEstrada = false;
    let dentro = 0;
    for (let i = 0; i < JANELA; i += 1) {
      comEstrada = comEspacoNaSaida(step(comEstrada, [], gameData), 'w1');
      semEstrada = comEspacoNaSaida(step(semEstrada, [], gameData), 'w1');
      if (comEstrada.estradas[toco] === true) assentou = true;
      expect(comEstrada.recursos[toco]?.quantidade).toBe(0);
      if ((semEstrada.recursos[toco]?.quantidade ?? 0) > 0) rebrotouSemEstrada = true;
      for (const u of Object.values(comEstrada.unidades.porId)) {
        const r = comEstrada.recursos[`${u.gx},${u.gy}`];
        if (r !== undefined && r.tipo === 'tree' && r.quantidade > 0) dentro += 1;
      }
    }
    expect({ assentou, rebrotouSemEstrada }).toEqual({ assentou: true, rebrotouSemEstrada: true });
    expect(dentro).toBe(0);
  }, 120000);

  it('quem estiver dentro de uma arvore que nasceu sai: o A* nao confere o tile de partida', () => {
    const { s } = mataCurta(gameData, 2);
    const arvore = Object.entries(s.recursos).find(([, r]) => r.tipo === 'tree' && r.quantidade > 0);
    if (arvore === undefined) throw new Error('fixture');
    const de = tileDeChave(arvore[0]);
    const vizinhos = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ gx: de.gx + (dx ?? 0), gy: de.gy + (dy ?? 0) }));
    const fora = buscarCaminho(s, de, vizinhos, 'livre', gameData);
    expect(fora).not.toBeNull();
  });

  it('evidencia: mata curta, e a razao N:1 do lenhador (numero da corrida, nao aceite)', () => {
    const r2 = correr(mataCurta(gameData, 2).s, mataCurta(gameData, 2).tiles, gameData);
    const um = mataCurta(gameData, 1);
    const r1 = correr(um.s, um.tiles, gameData);
    const todos = tilesDeW1(cenarioOraculo(gameData), gameData);
    const n = mataCurta(gameData, todos.length);
    const rN = correr(n.s, n.tiles, gameData);
    const n0 = mataCurta(semReposicao(gameData), todos.length);
    const rN0 = correr(n0.s, n0.tiles, semReposicao(gameData));
    const tree = gameData.recursos.tipos.tree?.reposicao;
    expect(rN.troncos).toBeGreaterThan(0);
    gravarEvidencia('F-REPL-a', {
      _doc: 'F-REPL-a — o toco rebrota. w1 do cenarioOraculo, w2 pausado, gaveta esvaziada. Numeros da corrida; o aceite e o teste de cima. A razao N:1 NAO e aceite: o total nao gira (operador, 2026-09-27).',
      janela: JANELA,
      reposicao: { ticksDeSemear: tree?.ticksDeSemear, ticksDeCrescer: tree?.ticksDeCrescer },
      mataDe2: r2,
      razaoN1: {
        tilesAoAlcance: todos.length,
        muitos: rN.troncos, um: r1.troncos, razao: r1.troncos === 0 ? null : rN.troncos / r1.troncos,
      },
      mataInteiraSemReposicao: rN0,
      mataInteiraComReposicao: rN,
    });
  }, 600000);
});
