/**
 * F13b — os seletores que alimentam o painel da escola. Tudo puro: nenhum estado
 * novo, nenhum campo novo. O painel em si (DOM) nao tem teste unitario porque o
 * Vitest roda em `environment: 'node'` — quem prova a interface e o roteiro
 * `tools/shots/F13b.js`.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { predioNoTile } from '../src/sim/selectors';
import { armazemPorTipo, escolaDoCenario } from './helpers/escola-cenario';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;
const ARMAZEM = armazemPorTipo(inicial).id;

describe('F13b — predioNoTile', () => {
  it('acha o predio pelo footprint inteiro, nao so pelo canto', () => {
    const escola = escolaDoCenario(inicial);
    expect(predioNoTile(inicial, escola.gx, escola.gy)).toBe(ESCOLA);
    // um tile adiante na diagonal ainda e a escola: ela e maior que 1x1, e o
    // jogador clica no meio do predio, nao no canto.
    expect(predioNoTile(inicial, escola.gx + 1, escola.gy + 1)).toBe(ESCOLA);
  });

  it('separa predios vizinhos', () => {
    const armazem = armazemPorTipo(inicial);
    expect(predioNoTile(inicial, armazem.gx, armazem.gy)).toBe(ARMAZEM);
    expect(predioNoTile(inicial, armazem.gx, armazem.gy)).not.toBe(ESCOLA);
  });

  it('tile vazio devolve null', () => {
    expect(predioNoTile(inicial, 0, 0)).toBeNull();
    // a porta fica FORA do footprint (borda sul): clicar nela nao seleciona
    const escola = escolaDoCenario(inicial);
    const [, altura] = gameData.predios.find((p) => p.id === escola.tipo)?.tamanho ?? [];
    expect(predioNoTile(inicial, escola.gx, escola.gy + (altura ?? 0))).toBeNull();
  });

  it('nao e afetado por tick: e derivado, nao guardado', () => {
    const escola = escolaDoCenario(inicial);
    const depois = step(inicial, []);
    expect(predioNoTile(depois, escola.gx + 1, escola.gy + 1)).toBe(ESCOLA);
  });
});
