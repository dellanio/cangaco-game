/**
 * F-CANA-b — a mancha de cana da vila (BUG-L, decisao do operador).
 *
 * A F-CANA deixou `grapes` sem tile de mapa: so existia o que o jogador ara, e
 * um Canavial posto na abertura nao tinha o que plantar. O conserto e o do
 * rocado da F18h — o gerador semeia um partido perto da vila. Aceite (a) do
 * `BUILD_PLAN.md`: ha cana ao alcance de um Canavial posto perto da vila, e ele
 * planta ali sem o jogador arar antes.
 *
 * A mancha e comparada com o `disco` e o centro que o PROPRIO gerador exporta:
 * se `por()` recusar um tile calado (folga, tile ocupado), a mancha encolhe e
 * isto acusa, em vez de o numero 13 morar digitado aqui.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import { receitaDoTipo } from '../src/sim/producao';
import { tilesDeColheita } from '../src/sim/recursos';
import { tipoDoTile } from '../src/sim/mapa';
import { step } from '../src/sim/tick';
import { avancar, cenarioDeCanavialDaVila, saidaDe } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

// `createRequire` pelo mesmo motivo do F-D3-geografia: o gerador e CommonJS.
const requireCjs = createRequire(import.meta.url);
const gerador = requireCjs('../tools/gerar-mapa.js') as {
  CANAVIAL_DA_VILA: { gx: number; gy: number; raio: number };
  disco: (gx: number, gy: number, raio: number) => [number, number][];
  naReserva: (gx: number, gy: number) => boolean;
};

const RECEITA = receitaDoTipo('wineyard', gameData);
if (RECEITA === null || RECEITA.colheita === null) {
  throw new Error('fixture: `wineyard` precisa de receita com colheita em data/production.json');
}
const COLHEITA = RECEITA.colheita;
const RENDIMENTO = gameData.recursos.tipos[COLHEITA.recurso]?.rendimentoPorTile ?? 0;

// A FORMA, e nao a posicao: `CANAVIAL_DA_VILA` e literal do gerador, na
// coordenada do mundo publicado, e o `test:transladado` desloca o mundo em +K
// (ate o `readFileSync` do dado vem transladado). Onde a mancha cai relativo a
// vila quem prova e o cenario (a), que poe o Canavial por deslocamento da
// ancora. Aqui: a cana do mapa, normalizada ao proprio canto, e o disco inteiro.
const { gx, gy, raio } = gerador.CANAVIAL_DA_VILA;
const DISCO = gerador.disco(gx, gy, raio);

/** Os tiles, deslocados para o canto da propria caixa, em ordem estavel. */
function forma(tiles: readonly (readonly [number, number])[]): string[] {
  const x0 = Math.min(...tiles.map(([x]) => x));
  const y0 = Math.min(...tiles.map(([, y]) => y));
  return tiles.map(([x, y]) => `${x - x0},${y - y0}`).sort();
}

function canaDoMapa(estado: GameState): string[] {
  return Object.entries(estado.recursos)
    .filter(([, v]) => v.tipo === COLHEITA.recurso).map(([k]) => k).sort();
}

function partidoDe(estado: GameState): Record<string, number> {
  const c1 = estado.predios.porId['c1'];
  if (c1?.estado !== 'completo') throw new Error('fixture: c1 deveria estar completo');
  const r: Record<string, number> = {};
  for (const k of tilesDeColheita(estado, c1, COLHEITA, gameData)) r[k] = estado.recursos[k]?.quantidade ?? 0;
  return r;
}

/** Roda ate o primeiro tile do partido encher (o plantio terminou), e segue
 *  ate a primeira cachaca na gaveta. Limite e so contra travar. */
function ateSemearEColher(inicial: GameState, limite = 3000): {
  semeouEm: number; primeiraCachacaEm: number; fim: GameState;
} {
  let estado = inicial;
  let semeouEm = -1;
  for (let tick = 1; tick <= limite; tick += 1) {
    estado = step(estado, [], gameData);
    if (semeouEm < 0 && Object.values(partidoDe(estado)).some((q) => q > 0)) semeouEm = tick;
    if ((saidaDe(estado, 'c1')['wine'] ?? 0) > 0) return { semeouEm, primeiraCachacaEm: tick, fim: estado };
  }
  throw new Error(`o Canavial da vila nao fez cachaca em ${limite} ticks`);
}

describe('F-CANA-b — o mapa tem a mancha de cana da vila', () => {
  const inicial = cenarioDeCanavialDaVila();

  it('a cana do mapa e o disco inteiro do gerador, sem tile recusado', () => {
    const cana = canaDoMapa(inicial).map((k) => k.split(',').map(Number) as [number, number]);
    expect(DISCO.length).toBeGreaterThan(0);
    expect(forma(cana)).toEqual(forma(DISCO));
  });

  it('em grama, fora da folga, e em pousio: mancha e terreno, nao estoque', () => {
    for (const k of canaDoMapa(inicial)) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      expect(tipoDoTile(x, y, gameData), k).toBe('grama');
      // a folga do gerador e derivada do `economy.json`, que vem transladado
      // junto: ela e a mesma vila do estado, nos dois mundos.
      expect(gerador.naReserva(x, y), k).toBe(false);
      expect(inicial.recursos[k]?.quantidade, k).toBe(0);
    }
  });
});

describe('F-CANA-b (a) — o Canavial da vila planta sem o jogador arar', () => {
  const inicial = cenarioDeCanavialDaVila();
  const partidoNoInicio = partidoDe(inicial);
  const { semeouEm, primeiraCachacaEm, fim } = ateSemearEColher(inicial);

  it('ha cana do mapa ao alcance, e nenhum campo planejado pelo jogador', () => {
    expect(Object.keys(partidoNoInicio).length).toBeGreaterThan(0);
    for (const k of Object.keys(partidoNoInicio)) expect(canaDoMapa(inicial), k).toContain(k);
    expect(inicial.camposPlanejados).toEqual({});
  });

  it('planta um tile da mancha e faz cachaca dele', () => {
    expect(semeouEm).toBeGreaterThan(0);
    expect(semeouEm).toBeLessThan(primeiraCachacaEm);
    const soma = Object.values(partidoDe(fim)).reduce((a, b) => a + b, 0);
    expect(soma).toBeGreaterThan(0);
    expect(soma).toBeLessThan(RENDIMENTO);
    expect(fim.camposPlanejados).toEqual({});
  });

  it('grava a evidencia', () => {
    gravarEvidencia('F-CANA-b', {
      feature: 'F-CANA-b-mancha-de-cana-da-vila',
      aceite: 'BUILD_PLAN.md F-CANA-b (a): cana ao alcance de um Canavial perto da vila, que planta sem arar',
      mancha: { centroNoGerador: { gx, gy }, raio, tiles: DISCO.length, noMapa: canaDoMapa(inicial).length },
      canavial: { id: 'c1', gx: inicial.predios.porId['c1']?.gx, gy: inicial.predios.porId['c1']?.gy },
      partidoNoInicio,
      semeouNoTick: semeouEm,
      primeiraCachacaNoTick: primeiraCachacaEm,
      partidoNaPrimeiraCachaca: partidoDe(fim),
      cachaca: saidaDe(fim, 'c1')['wine'],
      depoisDe3000Ticks: saidaDe(avancar(inicial, 3000), 'c1'),
    });
  });
});
