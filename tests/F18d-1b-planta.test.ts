/**
 * F18d-1b — o CANTEIRO de estrada no estado.
 *
 * `estradasPlanejadas` e o traçado que o jogador desenhou e que o laborer ainda
 * nao assentou. Ele mora ao lado de `estradas` (as que estao DE PE) e a regra
 * inteira desta feature depende de uma coisa so: tile planejado **nao liga
 * nada** — nao entra no indice da rede, nao junta componente, nao faz predio
 * ficar ligado ao armazem. Quem liga e o assentamento.
 */
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { TileDeGrid } from '../src/sim/estradas';
import {
  ehEstrada, ehPlanejada, indiceDeEstradas, isConnected, predioLigadoAoArmazem,
} from '../src/sim/estradas';
import { comPlanejadas } from './helpers/jobs-cenario';

const tile = (gx: number, gy: number): TileDeGrid => ({ gx, gy });
const linhaH = (x0: number, x1: number, y: number): TileDeGrid[] =>
  Array.from({ length: x1 - x0 + 1 }, (_, i) => tile(x0 + i, y));

describe('F18d-1b — `estradasPlanejadas` existe no estado, e e inerte', () => {
  const inicial = createInitialState(1);

  it('nasce vazio, e o estado com canteiro sobrevive ao JSON de ida e volta', () => {
    expect(inicial.estradasPlanejadas).toEqual({});
    const comCanteiro = comPlanejadas(inicial, linhaH(29, 33, 36));
    expect(JSON.parse(JSON.stringify(comCanteiro))).toEqual(comCanteiro);
  });

  it('`ehPlanejada` responde pelo tile, e planejado nao e estrada', () => {
    const comCanteiro = comPlanejadas(inicial, [tile(29, 33)]);
    expect(ehPlanejada(comCanteiro.estradasPlanejadas, tile(29, 33))).toBe(true);
    expect(ehPlanejada(comCanteiro.estradasPlanejadas, tile(29, 34))).toBe(false);
    // e o lado que importa: o canteiro NAO conta como estrada de pe
    expect(ehEstrada(comCanteiro.estradas, tile(29, 33))).toBe(false);
  });

  it('um canteiro inteiro nao liga nada: nem componente, nem predio ao armazem', () => {
    const armazem = inicial.predios.porId[inicial.predios.ordem[0] ?? ''];
    if (armazem === undefined) throw new Error('fixture: cenario sem predio');
    // uma rua completa, da porta do armazem ate longe — so que PLANEJADA
    const tracado = [...linhaH(29, 40, 33)];
    const comCanteiro = comPlanejadas(inicial, tracado);

    expect(isConnected(comCanteiro, tile(29, 33), tile(40, 33))).toBe(false);
    expect(predioLigadoAoArmazem(comCanteiro, armazem)).toBe(
      predioLigadoAoArmazem(inicial, armazem),
    );
    // e o indice e literalmente o mesmo objeto: o canteiro nem o invalida
    expect(indiceDeEstradas(comCanteiro)).toBe(indiceDeEstradas(inicial));
  });
});
