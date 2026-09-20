import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState, Predio } from '../src/sim/state';
import type { GameData } from '../src/sim/data/types';
import { gameData } from '../src/sim/data';
import { estaDesbloqueado } from '../src/sim/desbloqueio';

// --- montagem de estados e de dados injetados (so teste; nada disto entra em sim/) ---

function semPredios(estado: GameState): GameState {
  return { ...estado, predios: { porId: {}, ordem: [] } };
}

/** Acrescenta um predio completo, como o cenario inicial faz. */
function comPredio(estado: GameState, tipo: string, gx: number, gy: number): GameState {
  const id = `teste-${estado.predios.ordem.length}-${tipo}`;
  const predio: Predio = {
    id, tipo, gx, gy, estado: 'completo', hp: 0,
    capacidade: { entrada: null, saida: null },
    estoque: { entrada: {}, saida: {} },
  };
  return {
    ...estado,
    predios: {
      porId: { ...estado.predios.porId, [id]: predio },
      ordem: [...estado.predios.ordem, id],
    },
  };
}

function dadosSemMenuInicial(): GameData {
  return {
    ...gameData,
    economia: {
      ...gameData.economia,
      estadoInicial: { ...gameData.economia.estadoInicial, menuBuildInicial: [] },
    },
  };
}

describe('F06 — desbloqueio derivado de menuBuildInicial e da arvore', () => {
  const inicial = createInitialState(1);

  it('todo id de menuBuildInicial esta desbloqueado no estado inicial', () => {
    for (const id of gameData.economia.estadoInicial.menuBuildInicial) {
      expect(estaDesbloqueado(inicial, id)).toBe(true);
    }
  });

  it('para cada aresta desbloqueadoPor: sem o pai completo bloqueia, com o pai completo libera', () => {
    const dados = dadosSemMenuInicial();
    const arestas = gameData.predios.filter((p) => p.desbloqueadoPor !== null);
    expect(arestas.length).toBeGreaterThan(0);
    for (const filho of arestas) {
      const pai = filho.desbloqueadoPor as string;
      const vazio = semPredios(inicial);
      expect(estaDesbloqueado(vazio, filho.id, dados), `${filho.id} sem ${pai}`).toBe(false);
      expect(estaDesbloqueado(comPredio(vazio, pai, 0, 0), filho.id, dados), `${filho.id} com ${pai}`).toBe(true);
    }
  });

  it('um pai completo de OUTRO tipo nao libera o filho', () => {
    const dados = dadosSemMenuInicial();
    // quarry depende de schoolhouse; um storehouse completo nao basta
    const soArmazem = comPredio(semPredios(inicial), 'storehouse', 0, 0);
    expect(estaDesbloqueado(soArmazem, 'quarry', dados)).toBe(false);
  });

  it('desbloqueadoPor null fora do menu inicial continua bloqueado, mesmo com o predio no mapa', () => {
    const dados = dadosSemMenuInicial();
    const raiz = gameData.predios.filter((p) => p.desbloqueadoPor === null);
    expect(raiz.length).toBeGreaterThan(0);
    for (const p of raiz) {
      expect(estaDesbloqueado(comPredio(semPredios(inicial), p.id, 0, 0), p.id, dados)).toBe(false);
    }
  });

  it('id que nao existe no dado esta bloqueado', () => {
    expect(estaDesbloqueado(inicial, 'nao-existe')).toBe(false);
  });

  it('a lista vem do dado: menuBuildInicial injetado com sawmill libera sawmill sem nenhum pai', () => {
    const dados: GameData = {
      ...gameData,
      economia: {
        ...gameData.economia,
        estadoInicial: { ...gameData.economia.estadoInicial, menuBuildInicial: ['sawmill'] },
      },
    };
    expect(estaDesbloqueado(semPredios(inicial), 'sawmill', dados)).toBe(true);
  });
});
