/**
 * F-CANA — o dado dos casos 2 e 4 do predio vivo (docs/BRIEF-ARTE.md §4a),
 * corrigido no dado e nao nos casos (operador, 2026-09-26).
 *
 * Caso 2: o Canavial (`wineyard`) produzia cachaca do nada. Passa a colher
 * `grapes` do tile — e `grapes` e CANA, cultura que o jogador ara, como o milho.
 * O que se afirma: o Canavial planta e colhe do partido arado, e SO dele (o milho
 * do mapa ao alcance nao e dele); sem partido, espera, e nao produz do nada.
 *
 * Caso 4: a mina colhe sem sair (`colheita.aDistancia`). Esta parte esta afirmada
 * em tests/F21b-mina-esgota.test.ts (8), onde a fixture da mina ja mora; aqui fica
 * so a prova de que a bandeira e regra de CLASSE e nao da mina: nenhuma receita
 * que anda a declara, e o carregador le a ausencia como `false`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import { culturasAraveis } from '../src/sim/campos';
import { receitaDoTipo, unidadesPorCiclo } from '../src/sim/producao';
import { tilesDeColheita } from '../src/sim/recursos';
import { avancar, cenarioDeCanavial, saidaDe } from './helpers/producao-cenario';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { step } from '../src/sim/tick';
import { gravarEvidencia } from './helpers/evidence';

const RECEITA = receitaDoTipo('wineyard', gameData);
if (RECEITA === null || RECEITA.colheita === null) {
  throw new Error('fixture: `wineyard` precisa de receita com colheita em data/production.json');
}
const COLHEITA = RECEITA.colheita;

/** Os tiles de um tipo no estado, com a quantidade — a fotografia do partido. */
function tilesDo(estado: GameState, tipo: string): Record<string, number> {
  const r: Record<string, number> = {};
  for (const [k, v] of Object.entries(estado.recursos)) if (v.tipo === tipo) r[k] = v.quantidade;
  return r;
}

/** O PARTIDO do `c1`: a cana ao alcance dele, e so ela. F-CANA-b — o mapa passou
 *  a ter a mancha de cana da vila, e `tilesDo` a contaria junto; o sujeito aqui
 *  e o partido que a fixture arou, nao toda cana do mundo. */
function partidoDe(estado: GameState): Record<string, number> {
  const c1 = estado.predios.porId['c1'];
  if (c1?.estado !== 'completo') throw new Error('fixture: c1 deveria estar completo');
  const r: Record<string, number> = {};
  for (const k of tilesDeColheita(estado, c1, COLHEITA, gameData)) r[k] = estado.recursos[k]?.quantidade ?? 0;
  return r;
}

/** Roda ate a primeira cachaca na gaveta, guardando as fases da FSM. */
function ateAPrimeiraCachaca(inicial: GameState, limite = 3000): {
  fim: GameState; ticks: number; fases: string[];
} {
  let estado = inicial;
  const fases: string[] = [];
  for (let tick = 1; tick <= limite; tick += 1) {
    estado = step(estado, [], gameData);
    const fsm = estado.unidades.porId['canavieiro']?.fsm ?? '(sumiu)';
    if (fases[fases.length - 1] !== fsm) fases.push(fsm);
    expect(violacoesDaFsmDoEspecialista(estado, gameData), `tick ${tick}`).toEqual([]);
    expect(violacoesDeInvariantes(estado, gameData), `tick ${tick}`).toEqual([]);
    if ((saidaDe(estado, 'c1')['wine'] ?? 0) > 0) return { fim: estado, ticks: tick, fases };
  }
  throw new Error(`o Canavial nao fez cachaca em ${limite} ticks`);
}

describe('F-CANA — o dado', () => {
  it('o Canavial colhe `grapes`, que o jogador ara e que nao tem terreno de mapa', () => {
    expect(COLHEITA.recurso).toBe('grapes');
    expect(COLHEITA.aDistancia).toBe(false);
    expect(culturasAraveis(gameData)).toContain('grapes');
    expect(gameData.recursos.tipos['grapes']?.terreno ?? null).toBeNull();
  });

  it('`aDistancia` e so das tres minas; quem anda nao a declara', () => {
    const comBandeira = Object.entries(gameData.producao.receitas)
      .filter(([, r]) => r?.colheita?.aDistancia === true).map(([id]) => id).sort();
    expect(comBandeira).toEqual(['coal_mine', 'gold_mine', 'iron_mine']);
  });
});

describe('F-CANA — o Canavial planta e colhe do partido arado', () => {
  const inicial = cenarioDeCanavial(gameData, 2);
  const partidoNoInicio = partidoDe(inicial);
  const milhoNoInicio = tilesDo(inicial, 'corn');
  const { fim, ticks, fases } = ateAPrimeiraCachaca(inicial);
  const partidoNoFim = partidoDe(fim);

  it('a fixture abre com dois partidos em pousio e milho do mapa ao alcance', () => {
    expect(Object.values(partidoNoInicio)).toEqual([0, 0]);
    // sem milho por perto, "so colhe cana" passaria sem ter o que recusar
    expect(Object.keys(milhoNoInicio).length).toBeGreaterThan(0);
  });

  it('planta, sai para colher e volta — a regra da fazenda, sem `aDistancia`', () => {
    expect(fases).toContain('indo_colher');
    expect(fases).toContain('colhendo');
    expect(fases).toContain('voltando');
  });

  it('a cachaca sai do partido: ele foi semeado e perdeu um ciclo', () => {
    const rendimento = gameData.recursos.tipos['grapes']?.rendimentoPorTile ?? 0;
    const somaNoFim = Object.values(partidoNoFim).reduce((a, b) => a + b, 0);
    // um tile semeado (rendimento) menos o que o ciclo levou
    expect(somaNoFim).toBe(rendimento - unidadesPorCiclo(RECEITA));
    expect(saidaDe(fim, 'c1')['wine']).toBe(unidadesPorCiclo(RECEITA));
  });

  it('e o milho do mapa ficou intocado', () => {
    expect(tilesDo(fim, 'corn')).toEqual(milhoNoInicio);
  });

  it('sem partido, o Canavial espera e nao faz cachaca do nada', () => {
    const semPartido = avancar(cenarioDeCanavial(gameData, 0), ticks + 200, gameData);
    expect(saidaDe(semPartido, 'c1')['wine'] ?? 0).toBe(0);
    expect(semPartido.unidades.porId['canavieiro']?.fsm).toBe('esperando_insumo');
  });

  it('grava a evidencia', () => {
    gravarEvidencia('F-CANA', {
      feature: 'F-CANA-canavial-e-mina',
      colheitaDoCanavial: COLHEITA,
      ticksAtePrimeiraCachaca: ticks,
      fasesDoCanavieiro: fases,
      partidoNoInicio, partidoNoFim,
      minasComADistancia: Object.entries(gameData.producao.receitas)
        .filter(([, r]) => r?.colheita?.aDistancia === true).map(([id]) => id),
    });
  });
});
