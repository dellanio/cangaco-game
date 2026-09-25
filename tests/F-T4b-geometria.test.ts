/**
 * F-T4b — O GUARDA DAS DUAS PONTAS.
 *
 * A abertura da Fase A e plantada por dois caminhos independentes: o headless
 * (`tests/helpers/abertura.ts`, que deriva da SIM) e o roteiro do Playwright
 * (`tools/shots/F17.js`, que deriva dos JSON crus, porque na tela nao ha sim ao
 * alcance — `window.__cangaco` expoe leitura de render, nao API de simulacao).
 *
 * Ate a F-T4b a derivacao estava ESCRITA A MAO nos dois arquivos. Enquanto a
 * abertura era uma fila reta, manter as copias iguais a olho funcionava; com
 * dois grupos e rua em L, nao funcionaria — e o defeito apareceria como o
 * roteiro clicando num tile e o headless plantando noutro, sem teste nenhum
 * reprovando. Agora ha um algoritmo so (`tools/geometria-da-abertura.mjs`) e
 * este teste afirma que os dois conjuntos de PREDICADOS — os da sim e os do
 * JSON — levam ao mesmo lugar, tile a tile.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { geometriaDaAbertura } from '../tools/geometria-da-abertura.mjs';
import type { CaixaDePredio } from '../tools/geometria-da-abertura.d.mts';
import { aberturaDaFaseA } from './helpers/abertura';
import { createInitialState } from '../src/sim/state';
import { gameData } from '../src/sim/data';

interface PredioNoJson {
  readonly id: string;
  readonly tamanho: readonly [number, number];
}
interface PredioInicialNoJson {
  readonly id: string;
  readonly gx: number;
  readonly gy: number;
}
interface TipoDeRecursoNoJson {
  readonly bloqueiaConstrucao?: boolean;
}

function lerJson<T>(caminho: string): T {
  return JSON.parse(readFileSync(new URL(caminho, import.meta.url), 'utf-8')) as T;
}

/**
 * Os predicados COMO O ROTEIRO OS MONTA: so JSON, nenhuma funcao da sim. As
 * leituras abaixo sao as mesmas de `tools/shots/F17.js` e `tools/shots/_recursos.js`.
 */
function predicadosDoRoteiro(): {
  armazem: CaixaDePredio;
  escola: CaixaDePredio;
  tamanhoDe: (tipo: string) => { largura: number; altura: number };
  bloqueia: (gx: number, gy: number) => boolean;
} {
  const { predios } = lerJson<{ predios: readonly PredioNoJson[] }>('../data/buildings.json');
  const economia = lerJson<{ estadoInicial: { predios: readonly PredioInicialNoJson[] } }>(
    '../data/economy.json',
  );
  const { tipos } = lerJson<{ tipos: Readonly<Record<string, TipoDeRecursoNoJson>> }>(
    '../data/resources.json',
  );
  const mapa = lerJson<{ recursos: Readonly<Record<string, readonly (readonly [number, number])[]>> }>(
    '../data/maps/sertao-128.json',
  );

  const bloqueados = new Set(
    Object.entries(tipos)
      .filter(([, def]) => def.bloqueiaConstrucao === true)
      .flatMap(([tipo]) => (mapa.recursos[tipo] ?? []).map(([gx, gy]) => `${gx},${gy}`)),
  );
  const tamanhoDe = (tipo: string): { largura: number; altura: number } => {
    const def = predios.find((p) => p.id === tipo);
    if (!def) throw new Error(`sem '${tipo}' em data/buildings.json`);
    return { largura: def.tamanho[0], altura: def.tamanho[1] };
  };
  const caixaDe = (id: string): CaixaDePredio => {
    const p = economia.estadoInicial.predios.find((q) => q.id === id);
    if (!p) throw new Error(`sem '${id}' em data/economy.json`);
    return { gx: p.gx, gy: p.gy, ...tamanhoDe(id) };
  };

  return {
    armazem: caixaDe('storehouse'),
    escola: caixaDe('schoolhouse'),
    tamanhoDe,
    bloqueia: (gx, gy) => bloqueados.has(`${gx},${gy}`),
  };
}

describe('F-T4b: a geometria da abertura e UMA so', () => {
  const estado = createInitialState(gameData.economia.estadoInicial.semente);
  const pelaSim = aberturaDaFaseA(estado);
  const peloJson = geometriaDaAbertura(predicadosDoRoteiro());

  it('as plantas do headless e as do roteiro caem nos MESMOS tiles', () => {
    expect(peloJson.plantas.map((p) => ({ tipo: p.tipo, gx: p.gx, gy: p.gy }))).toEqual(
      pelaSim.plantas.map((p) => ({ tipo: p.tipo, gx: p.gx, gy: p.gy })),
    );
  });

  it('a rua do headless e a do roteiro sao a MESMA lista de tiles', () => {
    expect(peloJson.rua.map((t) => ({ gx: t.gx, gy: t.gy }))).toEqual(
      pelaSim.rua.map((t) => ({ gx: t.gx, gy: t.gy })),
    );
    expect(peloJson.yRua).toBe(pelaSim.yRua);
  });

  it('o guarda ACUSA: mudar um predicado de um lado so muda a geometria', () => {
    // Um guarda que nunca reprova nao e guarda. Aqui o predicado de recurso e
    // desligado — e exatamente o que aconteceria se um dos dois lados deixasse
    // de ler `bloqueiaConstrucao` — e a abertura tem de sair de outro lugar,
    // porque foi a rocha do lajedo que empurrou a fila para oeste (BUG-F).
    const cego = geometriaDaAbertura({ ...predicadosDoRoteiro(), bloqueia: () => false });
    expect(cego.plantas.map((p) => p.gx)).not.toEqual(pelaSim.plantas.map((p) => p.gx));
  });
});
