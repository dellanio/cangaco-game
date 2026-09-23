/**
 * F15a — o estado de producao: o relogio do ciclo e o veio.
 *
 * O campo `PredioCompleto.producao` nasce em `completarObra` e em `criarPredios`,
 * os dois unicos lugares onde um predio completo passa a existir. `null` quando
 * o tipo nao tem receita: "nao produz" nao pode ser representavel como "produz,
 * parado".
 */
import { describe, expect, it } from 'vitest';
import { completarObra, createInitialState } from '../src/sim/state';
import type { PredioEmObra } from '../src/sim/state';
import { gameData } from '../src/sim/data';

function obraDe(tipo: string): PredioEmObra {
  const def = gameData.predios.find((p) => p.id === tipo);
  if (!def) throw new Error(`fixture: predio '${tipo}' nao existe em buildings.json`);
  return {
    id: 'obra1', tipo, gx: 5, gy: 5, estado: 'obra', hp: def.hp,
    obra: { faltam: {}, nivelamento: 0 },
  };
}

describe('F15a — PredioCompleto.producao', () => {
  it('produtor nasce com relogio zerado e o veio semeado do dado', () => {
    const quarry = completarObra(obraDe('quarry'));
    expect(quarry.producao).toEqual({
      progresso: 0,
      veio: gameData.producao.receitas.quarry?.rendimentoDoVeio,
    });
    expect(quarry.producao?.veio).toBeGreaterThan(0);
  });

  it('produtor sem veio no dado nasce renovavel (`veio: null`)', () => {
    expect(completarObra(obraDe('sawmill')).producao).toEqual({ progresso: 0, veio: null });
    expect(completarObra(obraDe('woodcutters')).producao).toEqual({ progresso: 0, veio: null });
  });

  it('predio sem receita nasce com `producao: null`', () => {
    expect(completarObra(obraDe('storehouse')).producao).toBeNull();
    expect(completarObra(obraDe('schoolhouse')).producao).toBeNull();
  });

  it('os predios do estado inicial tambem passam pelo mesmo semeador', () => {
    const estado = createInitialState(1);
    for (const id of estado.predios.ordem) {
      const p = estado.predios.porId[id];
      if (p?.estado !== 'completo') continue;
      const receita = gameData.producao.receitas[p.tipo];
      if (receita === undefined) expect(p.producao, p.tipo).toBeNull();
      else expect(p.producao, p.tipo).toEqual({ progresso: 0, veio: receita.rendimentoDoVeio });
    }
  });

  it('`producao` e `null`, nunca `undefined` — o estado tem que sobreviver ao JSON', () => {
    const ida = createInitialState(1);
    expect(JSON.parse(JSON.stringify(ida))).toEqual(ida);
  });
});
