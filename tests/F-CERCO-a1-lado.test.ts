/**
 * F-CERCO-a1 — o dono de predio e unidade (docs/planos/2026-09-28-9-F-CERCO-a.md).
 *
 * Sem `lado` nao existe predio inimigo, e a F-CERCO-a2 (tropa ataca predio) nao tem
 * como recusar ordem contra o proprio. Aqui: quem cria poe o lado de quem mandou, a
 * unidade formada herda o da escola, e o save da versao 2 (sem lado) e migrado:
 * lado do jogador em tudo (decisao do operador, 2026-09-28).
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

  it('o lado atravessa salvar e carregar', () => {
    const alheio = comEscolaDoLado(avancar(inicial, 5), LADO_ALHEIO);
    const texto = salvar(alheio);
    const lido = carregar(texto, gameData);
    expect(ladosDe(lido)).toEqual(ladosDe(alheio));
    expect(salvar(lido)).toBe(texto);

  });

  it('o save da versao 2 carrega com o lado do jogador em tudo; o resto do estado fica igual', () => {
    // desde a F-CERCO-b a versao e 4, e a 2 passa pela 3 (o reparo) na migracao
    expect(VERSAO_DO_SAVE).toBeGreaterThanOrEqual(3);
    const partida = avancar(inicial, 5);
    const envelope = JSON.parse(salvar(partida)) as { estado: GameState } & Record<string, unknown>;
    // o save como a versao 2 gravava: sem o campo
    const semLado = <T extends object>(c: { porId: Record<string, T> }): void => {
      for (const item of Object.values(c.porId)) delete (item as { lado?: number }).lado;
    };
    semLado(envelope.estado.predios as unknown as { porId: Record<string, object> });
    semLado(envelope.estado.unidades as unknown as { porId: Record<string, object> });
    // e sem o reparo (F-CERCO-b, versao 4), que a versao 2 tambem nao conhecia
    for (const p of Object.values(envelope.estado.predios.porId)) delete (p as { reparo?: boolean }).reparo;
    const textoV2 = JSON.stringify({ ...envelope, versao: 2 });
    expect(textoV2).not.toMatch(/"lado"/);
    expect(textoV2).not.toMatch(/"reparo"/);

    const migrado = carregar(textoV2, gameData);
    const { predios, unidades } = ladosDe(migrado);
    expect(new Set([...predios, ...unidades])).toEqual(new Set([LADO_DO_JOGADOR]));
    expect(predios).toHaveLength(partida.predios.ordem.length);
    expect(unidades).toHaveLength(partida.unidades.ordem.length);
    // byte a byte: a migracao devolve exatamente a partida que a versao 3 gravaria
    expect(salvar(migrado)).toBe(salvar(partida));
    // e a partida migrada anda como a original
    expect(salvar(avancar(migrado, 20))).toBe(salvar(avancar(partida, 20)));

    gravarEvidencia('F-CERCO-a1', {
      ladoDoJogador: LADO_DO_JOGADOR,
      abertura: ladosDe(inicial),
      versaoDoSave: VERSAO_DO_SAVE,
      migracaoDaVersao2: { predios: predios.length, unidades: unidades.length, igualAVersao3: true },
    });
  });

  it('o save da versao 1 continua recusado com nome (anterior a F23b, nao ha save dela em disco)', () => {
    const antigo = JSON.stringify({ ...(JSON.parse(salvar(inicial)) as Record<string, unknown>), versao: 1 });
    expect(() => carregar(antigo, gameData)).toThrow(/versao 1/);
  });
});
