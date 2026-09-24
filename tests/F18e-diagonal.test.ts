/**
 * F18e — a estrada liga em 8 direcoes, sem cortar quina de predio.
 *
 * As duas metades tem de dizer a MESMA coisa: o A* em modo `'estrada'`
 * (`sim/pathfinding.ts`) e o indice de componentes (`sim/estradas.ts`). A
 * equivalencia entre elas continua provada por propriedade em
 * `tests/F10-astar.test.ts`; aqui estao os casos nomeados e a REMEDICAO do ponto
 * de virada que promoveu esta feature do `IDEIAS.md` (Nota do item no
 * BUILD_PLAN: a conta antiga era aritmetica de papel, esta e o A* rodando).
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import { componenteDe, isConnected, pontesDiagonais } from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import { buscarCaminho } from '../src/sim/pathfinding';
import { tilesEntre } from '../src/input/arrasto';
import { comEstradas, comObra, inicial, tile } from './helpers/jobs-cenario';
import { gravarEvidencia } from './helpers/evidence';

const RETO = gameData.movimento.ticksPorTile.aPe;
const DIAGONAL = gameData.movimento.ticksPorTileDiagonal.aPe;

/** Longe do cenario inicial (armazem em (29,30), 3x3) e longe da borda. */
const A = tile(10, 40);
const B = tile(11, 41);

describe('F18e — o passo diagonal existe na estrada', () => {
  it('dois tiles so em diagonal: o A* de modo estrada anda de um ao outro, por um passo diagonal', () => {
    const estado = comEstradas(inicial, [A, B]);
    const achado = buscarCaminho(estado, A, [B], 'estrada');
    expect(achado?.tiles).toEqual([B]);
    expect(achado?.custo).toBe(DIAGONAL.estrada);
  });

  it('dois tiles so em diagonal estao no MESMO componente', () => {
    const estado = comEstradas(inicial, [A, B]);
    expect(isConnected(estado, A, B)).toBe(true);
    expect(isConnected(estado, B, A)).toBe(true);
    expect(componenteDe(estado, A)).toBe(componenteDe(estado, B));
  });

  it('UMA quina com predio ja corta a ligacao: nem o A* passa, nem o componente une', () => {
    // obra 3x2 em (11,39) ocupa x 11..13, y 39..40 — cobre a quina (11,40) e
    // nenhum dos dois tiles de estrada.
    const estado = comObra(comEstradas(inicial, [A, B]), 'quina-norte', { gx: 11, gy: 39, faltam: { stone: 1 } });
    expect(buscarCaminho(estado, A, [B], 'estrada')).toBeNull();
    expect(isConnected(estado, A, B)).toBe(false);
    expect(componenteDe(estado, A)).not.toBe(componenteDe(estado, B));
  });

  it('as DUAS quinas com predio tambem cortam (o caso escrito no aceite)', () => {
    // a segunda obra, 3x2 em (8,41), ocupa x 8..10, y 41..42 — cobre a quina (10,41).
    const estado = comObra(
      comObra(comEstradas(inicial, [A, B]), 'quina-norte', { gx: 11, gy: 39, faltam: { stone: 1 } }),
      'quina-sul', { gx: 8, gy: 41, faltam: { stone: 1 } },
    );
    expect(buscarCaminho(estado, A, [B], 'estrada')).toBeNull();
    expect(isConnected(estado, A, B)).toBe(false);
  });

  it('a quina e regra de LIGACAO, nao de passagem: o mesmo par continua ligado pelo contorno', () => {
    // com o tile ortogonal (10,41) de estrada, a rua da a volta e liga de novo,
    // mesmo com a quina norte tapada.
    const estado = comObra(
      comEstradas(inicial, [A, B, tile(10, 41)]), 'quina-norte', { gx: 11, gy: 39, faltam: { stone: 1 } },
    );
    expect(isConnected(estado, A, B)).toBe(true);
    expect(buscarCaminho(estado, A, [B], 'estrada')?.custo).toBe(2 * RETO.estrada);
  });

  it('a linha que o arrasto desenha e uma rua inteira para o A*: sem buraco em nenhum angulo', () => {
    for (let dy = 0; dy <= 12; dy++) {
      const de = tile(10, 20);
      const para = tile(22, 20 + dy);
      const estado = comEstradas(inicial, tilesEntre(de, para));
      const achado = buscarCaminho(estado, de, [para], 'estrada');
      expect(achado, `dy=${dy}`).not.toBeNull();
      expect(isConnected(estado, de, para), `dy=${dy}`).toBe(true);
    }
  });
});

describe('F18e — as pontes que o render desenha saem da MESMA regra', () => {
  const chave = (t: TileDeGrid): string => `${t.gx},${t.gy}`;

  it('o par em diagonal vira uma ponte, e o predio na quina a desfaz', () => {
    const estado = comEstradas(inicial, [A, B]);
    expect(pontesDiagonais(estado).map(([a, b]) => `${chave(a)}->${chave(b)}`)).toEqual(['10,40->11,41']);
    const tapada = comObra(estado, 'quina-norte', { gx: 11, gy: 39, faltam: { stone: 1 } });
    expect(pontesDiagonais(tapada)).toEqual([]);
  });

  it('a lista e a da REGRA, nao a do desenho: o par que ja se toca por um tile tambem entra', () => {
    // T deitado: (10,40)-(11,40)-(12,40) e o pe (11,41). Os dois pares em diagonal
    // ligam de verdade (quina sem predio), entao saem na lista — a ponte deles cai
    // dentro de rua ja pintada, e isso e desperdicio de pixel, nao regra errada.
    const t = comEstradas(inicial, [tile(10, 40), tile(11, 40), tile(12, 40), tile(11, 41)]);
    expect(pontesDiagonais(t).map(([a, b]) => `${chave(a)}->${chave(b)}`))
      .toEqual(['10,40->11,41', '11,41->12,40']);
  });

  it('cada ponte E um passo do A*, e todo passo diagonal da rua E uma ponte', () => {
    // a rua do arrasto em angulo raso: reta e diagonal misturadas
    const rua = tilesEntre(tile(10, 20), tile(20, 24));
    const estado = comEstradas(inicial, rua);
    const pontes = new Set(pontesDiagonais(estado).map(([a, b]) => `${chave(a)}|${chave(b)}`));
    let diagonais = 0;
    for (let i = 1; i < rua.length; i++) {
      const a = rua[i - 1] as TileDeGrid;
      const b = rua[i] as TileDeGrid;
      if (a.gx === b.gx || a.gy === b.gy) continue;
      diagonais += 1;
      // o passo existe para a sim...
      expect(buscarCaminho(estado, a, [b], 'estrada')?.custo, chave(b)).toBe(DIAGONAL.estrada);
      // ...entao o render tem de ter recebido a ponte (o par sai sempre com o vizinho a leste)
      const oeste = a.gx < b.gx ? a : b;
      const leste = a.gx < b.gx ? b : a;
      expect(pontes.has(`${chave(oeste)}|${chave(leste)}`), chave(b)).toBe(true);
    }
    expect(diagonais).toBeGreaterThan(0);
    expect(pontes.size).toBe(diagonais);
  });
});

describe('F18e — a remedicao do ponto de virada (Nota do item no BUILD_PLAN)', () => {
  /**
   * A medicao que promoveu a feature dizia: sem diagonal, a estrada custa
   * `5dx + 5dy` contra `7dx + 2dy` da grama, e PERDE acima de `dy/dx = 2/3`
   * (~34°). Com a diagonal ligada a previsao era `5dx + 2dy`, ganhando em todo
   * angulo. Aqui a conta nao e de papel: os dois lados sao o A* rodando, com o
   * custo vindo de `gameData`.
   */
  const dx = 12;
  const de = tile(10, 20);

  const medir = (dy: number): { estrada: number; grama: number } => {
    const para = tile(de.gx + dx, de.gy + dy);
    const rua: readonly TileDeGrid[] = tilesEntre(de, para);
    const comRua = buscarCaminho(comEstradas(inicial, rua), de, [para], 'estrada');
    const semRua = buscarCaminho(inicial, de, [para], 'livre');
    if (comRua === null || semRua === null) throw new Error(`F18e: sem caminho em dy=${dy}`);
    return { estrada: comRua.custo, grama: semRua.custo };
  };

  it('a estrada ganha da grama em TODO angulo de 0 a 45 graus', () => {
    for (let dy = 0; dy <= dx; dy++) {
      const { estrada, grama } = medir(dy);
      expect(estrada, `dy/dx = ${dy}/${dx}`).toBeLessThan(grama);
    }
  });

  it('o angulo que antes empatava (dy/dx = 2/3) agora tem a estrada na frente, e a formula fecha', () => {
    const dy = 8; // 8/12 = 2/3, o empate medido antes da diagonal
    const { estrada, grama } = medir(dy);
    // com diagonal: estrada = reto*(dx-dy) + diagonal*dy; grama, o mesmo com as tabelas dela
    expect(estrada).toBe(RETO.estrada * (dx - dy) + DIAGONAL.estrada * dy);
    expect(grama).toBe(RETO.grama * (dx - dy) + DIAGONAL.grama * dy);
    expect(grama - estrada).toBeGreaterThan(0);
  });

  it('no pior caso para a rua (45 graus) ela ainda ganha — era onde a grama vencia', () => {
    const { estrada, grama } = medir(dx);
    expect(estrada).toBe(DIAGONAL.estrada * dx);
    expect(grama).toBe(DIAGONAL.grama * dx);
  });

  it('grava a tabela medida (CLAUDE.md §8: evidencia em test-output/F18e.json)', () => {
    const tabela = [];
    for (let dy = 0; dy <= dx; dy++) {
      const { estrada, grama } = medir(dy);
      tabela.push({ dy, grausAprox: Math.round((Math.atan2(dy, dx) * 180) / Math.PI), estrada, grama, ganhoDaEstrada: grama - estrada });
    }
    const pior = tabela.reduce((a, b) => (b.ganhoDaEstrada < a.ganhoDaEstrada ? b : a));
    expect(pior.ganhoDaEstrada).toBeGreaterThan(0);
    gravarEvidencia('F18e', {
      feature: 'F18e-estrada-diagonal',
      oQueMudou: 'a estrada liga em 8 direcoes; a quina so corta quando ha PREDIO nela',
      custosEmTicks: { reto: RETO, diagonal: DIAGONAL },
      remedicaoDoPontoDeVirada: {
        medicaoAntiga: 'sem diagonal a estrada custava 5dx + 5dy e PERDIA da grama acima de dy/dx = 2/3 (~34 graus)',
        dx,
        linhas: tabela,
        piorAngulo: pior,
        conclusao: 'com a diagonal ligada a estrada ganha em TODO angulo de 0 a 45 graus; nao ha mais ponto de virada',
      },
    });
  });
});
