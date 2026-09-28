/**
 * F25b — o painel do quartel (plano em docs/planos/2026-09-28-B1-F25b-painel-do-quartel.md).
 * O BUILD_PLAN nao tinha aceite; este foi escrito na sessao (PARA REVISAO):
 *  (a) o seletor traz os 9 tipos; com 1 hand_axe e 1 recruta so o militia cabe; sem
 *      recruta todos dao sem-recruta; `faltam` bate com a gaveta;
 *  (b) o motivo do seletor e o motivo com que o TrainSoldier daquele tipo e recusado (ou
 *      null quando e aceito), em todo estado de um conjunto de fixtures;
 *  (c) e a tela (roteiro tools/shots/F25b.js).
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { painelDoPredio } from '../src/sim/selectors';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';

const TIPOS = gameData.unidades.militares.tipos.map((t) => t.id);

/** A vila da abertura mais um quartel COMPLETO do jogador com `entrada` e `recrutas`. */
function vilaComQuartel(entrada: Record<string, number>, recrutas: number): GameState {
  const s = createInitialState(1);
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'sawmill'])] };
  for (let r = 6; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const p = naVila(d, r);
      if (!canPlace(busca, 'barracks', p.gx, p.gy, gameData).ok) continue;
      const q = completarObra({ lado: LADO_DO_JOGADOR, id: 'quartel', tipo: 'barracks', ...p, estado: 'obra', hp: 600, obra: { faltam: {}, nivelamento: 0 } }, gameData);
      const quartel: PredioCompleto = { ...q, estoque: { ...q.estoque, entrada }, recrutas };
      return { ...s, predios: { porId: { ...s.predios.porId, quartel }, ordem: [...s.predios.ordem, 'quartel'] } };
    }
  }
  throw new Error('fixture: o quartel nao coube');
}
const painel = (s: GameState) => {
  const p = painelDoPredio(s, 'quartel', gameData)?.quartel;
  if (p == null) throw new Error('sem painel do quartel');
  return p;
};

describe('F25b — o painel do quartel', () => {
  it('(a) nove tipos; com 1 machado e 1 recruta so o militia cabe', () => {
    const p = painel(vilaComQuartel({ hand_axe: 1 }, 1));
    expect(p.recrutas).toBe(1);
    expect(p.tipos.map((t) => t.tipo)).toEqual(TIPOS);
    expect(p.tipos.filter((t) => t.motivo === null).map((t) => t.tipo)).toEqual(['militia']);
    const gibao = p.tipos.find((t) => t.tipo === 'axe_fighter');
    expect(gibao).toMatchObject({ motivo: 'sem-requisito', faltam: ['leather_armor', 'wooden_shield'] });
    const semRecruta = painel(vilaComQuartel({ hand_axe: 5, leather_armor: 5, wooden_shield: 5 }, 0));
    expect(new Set(semRecruta.tipos.map((t) => t.motivo))).toEqual(new Set(['sem-requisito', 'sem-recruta']));
    expect(semRecruta.tipos.filter((t) => t.motivo === 'sem-recruta').map((t) => t.tipo)).toEqual(['militia', 'axe_fighter']);
  });

  it('fora do quartel completo, `quartel` e null', () => {
    const s = vilaComQuartel({}, 0);
    const outro = s.predios.ordem.find((id) => id !== 'quartel') as string;
    expect(painelDoPredio(s, outro, gameData)?.quartel).toBeNull();
  });

  it('(b) o motivo do painel e o motivo do comando, tipo a tipo, em varias gavetas', () => {
    const gavetas: [Record<string, number>, number][] = [
      [{}, 0], [{}, 3], [{ hand_axe: 1 }, 1], [{ hand_axe: 1 }, 0],
      [{ hand_axe: 2, leather_armor: 1, wooden_shield: 1, horses: 1 }, 2],
      [{ sword: 1, iron_armor: 1, iron_shield: 1, horses: 1, crossbow: 1, pike: 1, lance: 1, longbow: 1, leather_armor: 1 }, 1],
    ];
    let comparados = 0;
    for (const [entrada, recrutas] of gavetas) {
      const s = vilaComQuartel(entrada, recrutas);
      for (const t of painel(s).tipos) {
        const r = step(s, [{ type: 'TrainSoldier', predio: 'quartel', tipo: t.tipo }], gameData);
        const recusa = r.events.find((e) => e.type === 'command-rejected') as { motivo: string } | undefined;
        expect(recusa?.motivo ?? null, `${t.tipo} com ${JSON.stringify(entrada)} / ${recrutas}`).toBe(t.motivo);
        if (t.motivo === null) expect(r.events.some((e) => e.type === 'unit-trained')).toBe(true);
        comparados += 1;
      }
    }
    expect(comparados).toBe(gavetas.length * TIPOS.length);
  });

  it('grava a partida do roteiro: 1 machado, 1 couro e 2 recrutas', () => {
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F25b.save.txt`, salvar(vilaComQuartel({ hand_axe: 1, leather_armor: 1 }, 2)));
  });
});
