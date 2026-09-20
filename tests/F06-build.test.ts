import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState, Predio } from '../src/sim/state';
import type { GameData } from '../src/sim/data/types';
import { gameData } from '../src/sim/data';
import { estaDesbloqueado } from '../src/sim/desbloqueio';
import { canPlace } from '../src/sim/placement';
import { deepFreeze } from '../src/sim/freeze';

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

// --- canPlace: um caso do aceite por vez, afirmando o MOTIVO ---

function tamanhoDe(id: string): readonly [number, number] {
  const def = gameData.predios.find((p) => p.id === id);
  const [largura, altura] = def?.tamanho ?? [];
  if (largura === undefined || altura === undefined) throw new Error(`sem tamanho para '${id}'`);
  return [largura, altura];
}

function comTamanho(id: string, tamanho: readonly [number, number]): GameData {
  return {
    ...gameData,
    predios: gameData.predios.map((p) => (p.id === id ? { ...p, tamanho: [...tamanho] } : p)),
  };
}

describe('F06 — canPlace', () => {
  const inicial = createInitialState(1);
  const { largura: larguraDoMapa, altura: alturaDoMapa } = gameData.terreno.mapaPadrao;

  // o armazem do cenario inicial, lido do dado (nada digitado)
  const armazem = gameData.economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  if (!armazem) throw new Error('cenario inicial sem storehouse');
  const [, armazemA] = tamanhoDe('storehouse');
  const [pedreiraL, pedreiraA] = tamanhoDe('quarry'); // liberado no estado inicial

  it('posicao livre dentro do mapa, prédio liberado: ok', () => {
    expect(canPlace(inicial, 'quarry', 0, 0)).toEqual({ ok: true });
  });

  describe('sobreposicao', () => {
    it('em cima do armazem', () => {
      expect(canPlace(inicial, 'quarry', armazem.gx, armazem.gy)).toEqual({ ok: false, motivo: 'sobreposicao' });
    });

    it('por um unico tile', () => {
      const r = canPlace(inicial, 'quarry', armazem.gx - pedreiraL + 1, armazem.gy - pedreiraA + 1);
      expect(r).toEqual({ ok: false, motivo: 'sobreposicao' });
    });

    it('encostado (meio-aberto) pela esquerda, por cima e por baixo: ok', () => {
      expect(canPlace(inicial, 'quarry', armazem.gx - pedreiraL, armazem.gy)).toEqual({ ok: true });
      expect(canPlace(inicial, 'quarry', armazem.gx, armazem.gy - pedreiraA)).toEqual({ ok: true });
      expect(canPlace(inicial, 'quarry', armazem.gx, armazem.gy + armazemA)).toEqual({ ok: true });
    });

    it('um tile para dentro do encosto ja e sobreposicao (o limite e exato)', () => {
      expect(canPlace(inicial, 'quarry', armazem.gx - pedreiraL + 1, armazem.gy))
        .toEqual({ ok: false, motivo: 'sobreposicao' });
      expect(canPlace(inicial, 'quarry', armazem.gx, armazem.gy + armazemA - 1))
        .toEqual({ ok: false, motivo: 'sobreposicao' });
    });

    it('o tamanho vem do dado: com o armazem 1x1 injetado, o mesmo ponto passa a ser livre', () => {
      const ponto = { gx: armazem.gx + 1, gy: armazem.gy + 1 };
      expect(canPlace(inicial, 'quarry', ponto.gx, ponto.gy)).toEqual({ ok: false, motivo: 'sobreposicao' });
      expect(canPlace(inicial, 'quarry', ponto.gx, ponto.gy, comTamanho('storehouse', [1, 1]))).toEqual({ ok: true });
    });
  });

  describe('fora do mapa', () => {
    it('canto superior esquerdo negativo', () => {
      expect(canPlace(inicial, 'quarry', -1, 0)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
      expect(canPlace(inicial, 'quarry', 0, -1)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
    });

    it('footprint que passa da borda direita ou de baixo', () => {
      expect(canPlace(inicial, 'quarry', larguraDoMapa - pedreiraL + 1, 0)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
      expect(canPlace(inicial, 'quarry', 0, alturaDoMapa - pedreiraA + 1)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
    });

    it('rente a borda (ultimo tile do footprint e o ultimo do mapa): ok', () => {
      expect(canPlace(inicial, 'quarry', larguraDoMapa - pedreiraL, alturaDoMapa - pedreiraA)).toEqual({ ok: true });
    });

    it('o tamanho vem do dado: a mesma posicao muda de resultado com outro footprint', () => {
      const gx = larguraDoMapa - 1;
      expect(canPlace(inicial, 'quarry', gx, 0)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
      expect(canPlace(inicial, 'quarry', gx, 0, comTamanho('quarry', [1, 1]))).toEqual({ ok: true });
    });

    it('as dimensoes do mapa vem do dado: mapa injetado menor recusa o que o padrao aceita', () => {
      const dados: GameData = {
        ...gameData,
        terreno: { ...gameData.terreno, mapaPadrao: { largura: pedreiraL, altura: pedreiraA } },
      };
      expect(canPlace(inicial, 'quarry', 0, 0, dados)).toEqual({ ok: true });
      expect(canPlace(inicial, 'quarry', 1, 0, dados)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
    });
  });

  describe('predio nao desbloqueado', () => {
    it('sawmill no estado inicial: bloqueado', () => {
      expect(canPlace(inicial, 'sawmill', 0, 0)).toEqual({ ok: false, motivo: 'bloqueado' });
    });

    it('com o pai (woodcutters) completo, o mesmo ponto vira ok', () => {
      const comPai = comPredio(inicial, 'woodcutters', 10, 10);
      expect(canPlace(comPai, 'sawmill', 0, 0)).toEqual({ ok: true });
    });
  });

  describe('outras recusas e a ordem entre elas', () => {
    it('id que nao existe no dado: predio-desconhecido', () => {
      expect(canPlace(inicial, 'nao-existe', 0, 0)).toEqual({ ok: false, motivo: 'predio-desconhecido' });
    });

    it('bloqueado vem antes de fora-do-mapa', () => {
      expect(canPlace(inicial, 'sawmill', -5, -5)).toEqual({ ok: false, motivo: 'bloqueado' });
    });

    it('fora-do-mapa vem antes de sobreposicao', () => {
      const comFantasma = comPredio(inicial, 'quarry', -1, -1);
      expect(canPlace(comFantasma, 'quarry', -1, -1)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
    });
  });

  describe('pureza', () => {
    it('nao escreve no estado: roda sobre um GameState congelado e o resultado e estavel', () => {
      const congelado = deepFreeze(createInitialState(1));
      const antes = JSON.stringify(congelado);
      const a = canPlace(congelado, 'quarry', armazem.gx, armazem.gy);
      const b = canPlace(congelado, 'quarry', armazem.gx, armazem.gy);
      expect(a).toEqual(b);
      expect(JSON.stringify(congelado)).toBe(antes);
    });
  });
});
