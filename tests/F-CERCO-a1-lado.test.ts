/**
 * F-CERCO-a1 — o dono de predio e unidade (docs/planos/2026-09-28-9-F-CERCO-a.md).
 *
 * Sem `lado` nao existe predio inimigo, e a F-CERCO-a2 (tropa ataca predio) nao tem
 * como recusar ordem contra o proprio. Aqui: quem cria poe o lado de quem mandou, a
 * unidade formada herda o da escola, e o save de formato antigo e recusado.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { carregar, salvar, VERSAO_DO_SAVE } from '../src/sim/save';
import { avancar, comOuroNaEscola, escolaDoCenario, novasUnidades, pedir } from './helpers/escola-cenario';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const LADO_ALHEIO = LADO_DO_JOGADOR + 1;
const { custoOuroPorUnidade: CUSTO, ticksPorTreino: TICKS } = gameData.economia.schoolhouse;

const ladosDe = (s: GameState): { predios: number[]; unidades: number[] } => ({
  predios: s.predios.ordem.map((id) => s.predios.porId[id]?.lado as number),
  unidades: s.unidades.ordem.map((id) => s.unidades.porId[id]?.lado as number),
});

/** A escola do cenario, passada para outro lado — o que prova HERANCA, e nao constante. */
function comEscolaDoLado(s: GameState, lado: number): GameState {
  const escola = escolaDoCenario(s);
  return { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [escola.id]: { ...escola, lado } } } };
}

function primeiraPosicaoLivre(s: GameState, tipo: string): { gx: number; gy: number } {
  for (let r = 3; r < 30; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const p = naVila(d, r);
      if (canPlace(s, tipo, p.gx, p.gy, gameData).ok) return p;
    }
  }
  throw new Error(`nenhum lugar livre para '${tipo}' perto da vila`);
}

describe('F-CERCO-a1 — o lado de predio e unidade', () => {
  const inicial = createInitialState(1);

  it('na abertura, todo predio e toda unidade sao do jogador', () => {
    const { predios, unidades } = ladosDe(inicial);
    expect(predios.length).toBeGreaterThan(0);
    expect(unidades.length).toBeGreaterThan(0);
    expect(new Set([...predios, ...unidades])).toEqual(new Set([LADO_DO_JOGADOR]));
  });

  it('a obra posta pelo jogador e dele, e continua dele ao ficar pronta', () => {
    const lugar = primeiraPosicaoLivre(inicial, 'quarry');
    const depois = step(inicial, [{ type: 'PlaceBlueprint', buildingId: 'quarry', ...lugar }], gameData);
    const nova = depois.predios.ordem.find((id) => inicial.predios.porId[id] === undefined);
    expect(nova, 'o comando deveria criar a obra').toBeDefined();
    expect(depois.predios.porId[nova as string]?.lado).toBe(LADO_DO_JOGADOR);
  });

  it('a unidade formada herda o lado da escola que a formou', () => {
    const escola = escolaDoCenario(inicial).id;
    for (const lado of [LADO_DO_JOGADOR, LADO_ALHEIO]) {
      const base = comOuroNaEscola(step(comEscolaDoLado(inicial, lado), [pedir(escola, 'stonemason')]), escola, CUSTO);
      const novas = novasUnidades(inicial, avancar(base, TICKS + 1));
      expect(novas).toHaveLength(1);
      expect(novas[0]?.lado).toBe(lado);
    }
  });

  it('o lado atravessa salvar e carregar; o save da versao anterior e recusado com nome', () => {
    const alheio = comEscolaDoLado(avancar(inicial, 5), LADO_ALHEIO);
    const texto = salvar(alheio);
    const lido = carregar(texto, gameData);
    expect(ladosDe(lido)).toEqual(ladosDe(alheio));
    expect(salvar(lido)).toBe(texto);

    expect(VERSAO_DO_SAVE).toBe(3);
    const antigo = JSON.stringify({ ...(JSON.parse(texto) as Record<string, unknown>), versao: 2 });
    expect(() => carregar(antigo, gameData)).toThrow(/versao 2/);

    gravarEvidencia('F-CERCO-a1', {
      ladoDoJogador: LADO_DO_JOGADOR,
      abertura: ladosDe(inicial),
      versaoDoSave: VERSAO_DO_SAVE,
      ladosAposCarregar: ladosDe(lido),
    });
  });
});
