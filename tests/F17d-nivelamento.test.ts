/**
 * F17d — a aritmetica do canteiro de uma obra. Plano em
 * `docs/planos/F17d-nivelamento-canteiro.md`.
 *
 * `nivelamento-obra.ts` e aritmetica pura SEM IMPORT NENHUM, como
 * `estagio-obra.ts` (F11c) e `medidor-obra.ts` (F17b): e o que o deixa fora da
 * regra dos funis de `render/` — so `mapa.ts` e `predios.ts` podem falar com
 * `sim/data` (guarda em `tests/F04-grid-ortogonal.test.ts`). Alvo e footprint
 * chegam por parametro, nunca lidos de dentro.
 *
 * Todo numero esperado e DERIVADO do dado (`alvoDeNivelamento`, `def.tamanho`).
 * Literal digitado aqui passaria a valer sozinho se `buildings.json` mudasse.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { alvoDeNivelamento } from '../src/sim/obra';
import { canteiroDaObra, chaveDoCanteiro } from '../src/render/nivelamento-obra';
import { aparenciaDoPredio } from '../src/render/predios';
import { gravarEvidencia } from './helpers/evidence';

function tilesDoTipo(tipo: string): number {
  const def = gameData.predios.find((p) => p.id === tipo);
  if (def === undefined) throw new Error(`tipo '${tipo}' nao existe em buildings.json`);
  const [largura, altura] = def.tamanho;
  return (largura ?? 0) * (altura ?? 0);
}

// Os dois footprints que o aceite do BUILD_PLAN nomeia: o menor (2 tiles) e um
// grande (16). Os valores saem do dado, nao de literal.
const MINA = {
  tipo: 'gold_mine',
  tiles: tilesDoTipo('gold_mine'),
  alvo: alvoDeNivelamento('gold_mine', gameData),
};
const QUARTEL = {
  tipo: 'barracks',
  tiles: tilesDoTipo('barracks'),
  alvo: alvoDeNivelamento('barracks', gameData),
};

describe('F17d — a aritmetica do canteiro', () => {
  it('os dois footprints do aceite sao mesmo 2 e 16 tiles no dado de hoje', () => {
    // GUARDA DO PROPRIO TESTE: se alguem mudar o tamanho desses predios, os
    // casos abaixo deixam de exercer "pequeno" e "grande" e este caso avisa.
    expect(MINA.tiles).toBe(2);
    expect(QUARTEL.tiles).toBe(16);
  });

  it('nivelamento 0: nenhum tile pronto, nada de fracao, nao nivelada', () => {
    for (const p of [MINA, QUARTEL]) {
      expect(canteiroDaObra(0, p.alvo, p.tiles), p.tipo).toEqual({
        tilesProntos: 0, tilesTotais: p.tiles, oitavosDoTileEmCurso: 0, nivelada: false,
      });
    }
  });

  it('nivelamento = alvo: TODOS os tiles prontos e nivelada', () => {
    for (const p of [MINA, QUARTEL]) {
      expect(canteiroDaObra(p.alvo, p.alvo, p.tiles), p.tipo).toEqual({
        tilesProntos: p.tiles, tilesTotais: p.tiles, oitavosDoTileEmCurso: 0, nivelada: true,
      });
    }
  });

  it('um tile inteiro de nivelamento vale um tile pronto, sem fracao sobrando', () => {
    const ticksPorTile = MINA.alvo / MINA.tiles;
    expect(canteiroDaObra(ticksPorTile, MINA.alvo, MINA.tiles)).toEqual({
      tilesProntos: 1, tilesTotais: MINA.tiles, oitavosDoTileEmCurso: 0, nivelada: false,
    });
  });

  it('meio tile vira 4 oitavos, e o tile em curso ainda nao conta como pronto', () => {
    const ticksPorTile = QUARTEL.alvo / QUARTEL.tiles;
    const c = canteiroDaObra(ticksPorTile * 2.5, QUARTEL.alvo, QUARTEL.tiles);
    expect(c.tilesProntos).toBe(2);
    expect(c.oitavosDoTileEmCurso).toBe(4);
    expect(c.nivelada).toBe(false);
  });

  it('a fracao nunca chega a 8 oitavos: 8/8 e o tile SEGUINTE pronto', () => {
    for (let n = 0; n <= QUARTEL.alvo; n++) {
      const c = canteiroDaObra(n, QUARTEL.alvo, QUARTEL.tiles);
      expect(c.oitavosDoTileEmCurso, `n=${n}`).toBeGreaterThanOrEqual(0);
      expect(c.oitavosDoTileEmCurso, `n=${n}`).toBeLessThanOrEqual(7);
      expect(c.tilesProntos, `n=${n}`).toBeLessThanOrEqual(QUARTEL.tiles);
    }
  });

  it('nivelamento acima do alvo nao passa do footprint (o estado tem teto, o desenho tambem)', () => {
    expect(canteiroDaObra(MINA.alvo * 3, MINA.alvo, MINA.tiles)).toEqual({
      tilesProntos: MINA.tiles, tilesTotais: MINA.tiles, oitavosDoTileEmCurso: 0, nivelada: true,
    });
  });

  it('nivelamento negativo nao produz tile negativo', () => {
    expect(canteiroDaObra(-5, MINA.alvo, MINA.tiles).tilesProntos).toBe(0);
  });

  it('footprint ou alvo zerado (tipo desconhecido, placeholder do §9) nao quebra: nasce nivelada', () => {
    expect(canteiroDaObra(0, 0, 0)).toEqual({
      tilesProntos: 0, tilesTotais: 0, oitavosDoTileEmCurso: 0, nivelada: true,
    });
  });

  it('o canteiro enche monotonicamente: tile pronto nunca volta atras', () => {
    let anterior = -1;
    for (let n = 0; n <= QUARTEL.alvo; n++) {
      const prontos = canteiroDaObra(n, QUARTEL.alvo, QUARTEL.tiles).tilesProntos;
      expect(prontos, `n=${n}`).toBeGreaterThanOrEqual(anterior);
      anterior = prontos;
    }
    expect(anterior).toBe(QUARTEL.tiles);
  });
});

describe('F17d — a chave do diff (a armadilha medida na F17b)', () => {
  it('predio completo nao tem canteiro, e a chave e vazia', () => {
    expect(chaveDoCanteiro(null)).toBe('');
  });

  it('a chave muda a cada oitavo e SO a cada oitavo', () => {
    // Isto e o que faz a cena redesenhar: `atualizarPredios` pula o redesenho
    // quando a chave nao muda, e nivelar nao mexe em `estado` nem em `estagio`.
    const chaves = new Set<string>();
    for (let n = 0; n <= QUARTEL.alvo; n++) {
      chaves.add(chaveDoCanteiro(canteiroDaObra(n, QUARTEL.alvo, QUARTEL.tiles)));
    }
    // por tile: min(8, ticksPorTile) leituras distintas — com 10 ticks por tile
    // dois ticks caem no mesmo oitavo. Mais 1 para o estado final nivelado.
    // Derivado do dado; fixar 129 aqui passaria a valer sozinho.
    const ticksPorTile = QUARTEL.alvo / QUARTEL.tiles;
    expect(chaves.size).toBe(QUARTEL.tiles * Math.min(8, ticksPorTile) + 1);
  });

  it('mesma chave implica mesmo desenho: a chave carrega os campos que a cena usa', () => {
    // GUARDA ESTRUTURAL: a cena desenha a fracao QUANTIZADA. Se ela desenhasse a
    // fracao continua, existiria mudanca visivel que a chave nao ve — e o
    // canteiro congelaria na tela sem nenhum teste reprovar.
    for (let n = 0; n < QUARTEL.alvo; n++) {
      const a = canteiroDaObra(n, QUARTEL.alvo, QUARTEL.tiles);
      const b = canteiroDaObra(n + 1, QUARTEL.alvo, QUARTEL.tiles);
      if (chaveDoCanteiro(a) === chaveDoCanteiro(b)) expect(a, `n=${n}`).toEqual(b);
      else expect(a, `n=${n}`).not.toEqual(b);
    }
  });
});

describe('F17d — o funil entrega o alvo do dado', () => {
  it('a aparencia traz o MESMO alvo que a sim usa para nivelar', () => {
    for (const tipo of ['gold_mine', 'barracks', 'quarry', 'woodcutters', 'storehouse']) {
      // igualdade contra a funcao da sim, nunca contra literal: e o unico jeito
      // de o mapa e a simulacao nao divergirem quando `buildings.json` mudar
      expect(aparenciaDoPredio(tipo).alvoDeNivelamento, tipo)
        .toBe(alvoDeNivelamento(tipo, gameData));
    }
  });

  it('tipo desconhecido cai no placeholder do §9: alvo 0, e o jogo nao quebra', () => {
    // `alvoDeNivelamento` da sim LANCA para tipo inexistente; o funil nao pode
    // lancar, porque placeholder e comportamento normal (CLAUDE.md §9).
    expect(() => alvoDeNivelamento('nao-existe', gameData)).toThrow();
    expect(aparenciaDoPredio('nao-existe').alvoDeNivelamento).toBe(0);
  });

  it('o canteiro de uma obra recem-posta, pelo funil, e o footprint inteiro por aplainar', () => {
    const a = aparenciaDoPredio('woodcutters');
    expect(canteiroDaObra(0, a.alvoDeNivelamento, a.largura * a.altura)).toEqual({
      tilesProntos: 0,
      tilesTotais: a.largura * a.altura,
      oitavosDoTileEmCurso: 0,
      nivelada: false,
    });
    gravarEvidencia('F17d', {
      feature: 'F17d-nivelamento-canteiro',
      ticksNivelamentoPorTile: gameData.construcao.ticksNivelamentoPorTile,
      porTipo: ['gold_mine', 'barracks', 'woodcutters'].map((tipo) => {
        const ap = aparenciaDoPredio(tipo);
        const tiles = ap.largura * ap.altura;
        return {
          tipo,
          tiles,
          alvo: ap.alvoDeNivelamento,
          recemPosta: canteiroDaObra(0, ap.alvoDeNivelamento, tiles),
          nivelada: canteiroDaObra(ap.alvoDeNivelamento, ap.alvoDeNivelamento, tiles),
        };
      }),
    });
  });
});

describe('F17d — guarda estrutural do arquivo puro', () => {
  it('src/render/nivelamento-obra.ts nao importa nada', () => {
    const fonte = readFileSync('src/render/nivelamento-obra.ts', 'utf-8');
    expect(/^\s*import\b/m.test(fonte)).toBe(false);
  });
});
