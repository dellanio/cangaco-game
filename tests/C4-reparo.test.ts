/**
 * C4 — o botao de reparo (fila do operador, item 4; plano em
 * docs/planos/2026-09-28-C4-botao-de-reparo.md). Aceite (a), headless: o seletor do painel
 * da o reparo desligado no predio completo e `null` na obra; ligado pelo comando, com o
 * predio danificado e um laborer reclamando, `emCurso` conta. Grava a partida do roteiro
 * `tools/shots/C4.js` (aceite b).
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { createInitialState, ID_DA_ESCOLA } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { painelDoPredio } from '../src/sim/selectors';
import { salvar } from '../src/sim/save';

const escolaDe = (s: GameState): PredioCompleto =>
  s.predios.porId[s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === ID_DA_ESCOLA) as string] as PredioCompleto;
/** A vila da abertura com a escola danificada (metade do HP) e o reparo desligado. */
function vilaComEscolaDanificada(): GameState {
  const s = createInitialState(1);
  const e = escolaDe(s);
  return { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [e.id]: { ...e, hp: Math.floor(e.hp / 2) } } } };
}

describe('C4 — o reparo no painel', () => {
  it('(a) desligado no completo, null na obra; ligado, danificado e com obreiro em curso', () => {
    let s = vilaComEscolaDanificada();
    const e = escolaDe(s);
    expect(painelDoPredio(s, e.id, gameData)?.reparo).toEqual({ ligado: false, danificado: true, emCurso: 0 });
    const comObra = step(createInitialState(1), [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 0, gy: 0 }], gameData);
    const obra = comObra.predios.ordem.find((id) => comObra.predios.porId[id]?.estado === 'obra');
    if (obra !== undefined) expect(painelDoPredio(comObra, obra, gameData)?.reparo).toBeNull();
    s = step(s, [{ type: 'SetBuildingRepair', predio: e.id, ligado: true }], gameData);
    expect(painelDoPredio(s, e.id, gameData)?.reparo?.ligado).toBe(true);
    let emCurso = 0;
    const hp0 = escolaDe(s).hp;
    for (let t = 0; t < 600 && emCurso === 0; t += 1) {
      s = step(s, [], gameData);
      emCurso = painelDoPredio(s, e.id, gameData)?.reparo?.emCurso ?? 0;
    }
    expect(emCurso).toBeGreaterThan(0);
    for (let t = 0; t < 600; t += 1) s = step(s, [], gameData);
    expect(escolaDe(s).hp).toBeGreaterThan(hp0); // o reparo de fato acontece
  });

  it('grava a partida do roteiro: a escola pela metade, reparo desligado', () => {
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/C4.save.txt`, salvar(vilaComEscolaDanificada()));
  });
});
