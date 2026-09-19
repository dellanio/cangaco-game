import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createInitialState } from '../src/sim/state';
import type { GameState, Predio } from '../src/sim/state';
import { estoqueTotal, contagemPorTipo, resumoDoEstado } from '../src/sim/selectors';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { compararComESemSave, reviverPorJson } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';

/** Varre o estado atras de qualquer coisa que o JSON nao carrega — mesma
 *  checagem da F02 (tests/F02-tick-determinista.test.ts), repetida aqui
 *  porque agora o estado carrega entidade, e e exatamente isso que pode
 *  introduzir uma referencia que o JSON perde. */
function acharNaoSerializavel(valor: unknown, caminho = 'state'): string[] {
  const problemas: string[] = [];
  const visitar = (v: unknown, p: string, ancestrais: Set<object>): void => {
    if (typeof v === 'function') { problemas.push(`${p}: funcao`); return; }
    if (typeof v === 'undefined') { problemas.push(`${p}: undefined`); return; }
    if (v instanceof Map) { problemas.push(`${p}: Map`); return; }
    if (v instanceof Set) { problemas.push(`${p}: Set`); return; }
    if (v instanceof Date) { problemas.push(`${p}: Date`); return; }
    if (v === null || typeof v !== 'object') return;
    if (ancestrais.has(v)) { problemas.push(`${p}: referencia circular`); return; }
    if (Object.getPrototypeOf(v) !== Object.prototype && !Array.isArray(v)) {
      problemas.push(`${p}: prototipo nao-plano (classe?)`);
      return;
    }
    const proximos = new Set(ancestrais).add(v);
    for (const [k, filho] of Object.entries(v)) visitar(filho, `${p}.${k}`, proximos);
  };
  visitar(valor, caminho, new Set());
  return problemas;
}

function predioPorTipo(state: GameState, tipo: string): Predio {
  const id = state.predios.ordem.find((i) => state.predios.porId[i]?.tipo === tipo);
  const predio = id ? state.predios.porId[id] : undefined;
  if (!predio) throw new Error(`nenhum predio do tipo '${tipo}' no estado`);
  return predio;
}

describe('F05a — estado inicial bate com a tabela', () => {
  const state = createInitialState(2026);
  const { estadoInicial } = gameData.economia;

  it('estoqueTotal(state) e igual a estadoInicial.estoque, sem numero digitado aqui', () => {
    expect(estoqueTotal(state)).toEqual(estadoInicial.estoque);
  });

  it('contagemPorTipo(state) e igual a estadoInicial.unidades', () => {
    expect(contagemPorTipo(state)).toEqual(estadoInicial.unidades);
  });

  it('cada predio nasce na posicao e no estado que o JSON declara', () => {
    for (const p of estadoInicial.predios) {
      const instancia = predioPorTipo(state, p.id);
      expect({ gx: instancia.gx, gy: instancia.gy, estado: instancia.estado }).toEqual({
        gx: p.gx, gy: p.gy, estado: p.estado,
      });
    }
  });

  it('o hp de cada predio vem de data/buildings.json, nao de um numero em .ts', () => {
    for (const p of estadoInicial.predios) {
      const def = gameData.predios.find((d) => d.id === p.id);
      expect(def).toBeDefined();
      expect(predioPorTipo(state, p.id).hp).toBe(def?.hp);
    }
  });

  it('a capacidade do armazem e null nas duas gavetas, vinda de economy.storehouse', () => {
    const armazem = predioPorTipo(state, 'storehouse');
    expect(armazem.capacidade).toEqual({
      entrada: gameData.economia.storehouse.capacidade,
      saida: gameData.economia.storehouse.capacidade,
    });
  });

  it('o estoque inicial inteiro entra em saida; entrada nasce vazia', () => {
    const armazem = predioPorTipo(state, 'storehouse');
    expect(armazem.estoque.entrada).toEqual({});
    expect(armazem.estoque.saida).toEqual(estadoInicial.estoque);
    // O total so bate com a tabela porque estoqueTotal soma as duas gavetas —
    // confirmado separadamente do teste acima, que olha so o agregado.
    expect(estoqueTotal(state)).toEqual({ ...armazem.estoque.entrada, ...armazem.estoque.saida });
  });

  it('a schoolhouse nasce sem estoque e sem limite (nao e armazem nem producao)', () => {
    const schoolhouse = predioPorTipo(state, 'schoolhouse');
    expect(schoolhouse.estoque).toEqual({ entrada: {}, saida: {} });
    expect(schoolhouse.capacidade).toEqual({ entrada: null, saida: null });
  });
});

describe('F05a — round-trip por JSON', () => {
  it('reviverPorJson devolve um estado equivalente', () => {
    const state = createInitialState(2026);
    expect(reviverPorJson(state)).toEqual(state);
  });

  it('JSON.stringify e identico antes e depois do round-trip', () => {
    const state = createInitialState(2026);
    expect(JSON.stringify(reviverPorJson(state))).toBe(JSON.stringify(state));
  });

  it('nada no estado escapa do JSON (funcao, Map, Set, undefined, circular)', () => {
    expect(acharNaoSerializavel(createInitialState(2026))).toEqual([]);
  });
});

describe('F05a — compararComESemSave com o estado povoado', () => {
  it('o cenario tem de fato 2 predios e 6 unidades — nao roda vazio', () => {
    const state = createInitialState(2026);
    expect(state.predios.ordem.length).toBe(2);
    expect(state.unidades.ordem.length).toBe(6);
  });

  it('salvar no meio e recarregar da o mesmo resultado que rodar direto', () => {
    const { direto, comSave } = compararComESemSave({ seed: 2026, totalTicks: 1000, saveAtTick: 500 });
    expect(comSave).toBe(direto);
  });
});

describe('F05a — determinismo e formato da colecao', () => {
  it('duas chamadas com a mesma semente dao o mesmo JSON', () => {
    expect(JSON.stringify(createInitialState(42))).toBe(JSON.stringify(createInitialState(42)));
  });

  it('todo id de predio e de unidade e nao numerico', () => {
    const state = createInitialState(1);
    for (const id of [...state.predios.ordem, ...state.unidades.ordem]) {
      expect(id).not.toMatch(/^\d+$/);
      expect(Number.isNaN(Number(id))).toBe(true);
    }
  });

  it('ordem bate exatamente com Object.keys(porId), nos dois lados', () => {
    const state = createInitialState(1);
    expect(state.predios.ordem).toEqual(Object.keys(state.predios.porId));
    expect(state.unidades.ordem).toEqual(Object.keys(state.unidades.porId));
  });
});

describe('F05a — os valores vem do dado, nao de .ts', () => {
  it('mudar economy.estadoInicial.estoque no dado muda o estado junto', () => {
    // Prova de verdade do ponto 1 do operador: se createInitialState tivesse
    // um numero de balanceamento escondido em .ts, este teste reprovaria,
    // porque o estado nao acompanharia a mudanca no dado injetado.
    const dadosVariante: GameData = {
      ...gameData,
      economia: {
        ...gameData.economia,
        estadoInicial: {
          ...gameData.economia.estadoInicial,
          estoque: { ...gameData.economia.estadoInicial.estoque, gold: 999999 },
        },
      },
    };
    const state = createInitialState(1, dadosVariante);
    expect(estoqueTotal(state).gold).toBe(999999);
    expect(estoqueTotal(state).gold).not.toBe(gameData.economia.estadoInicial.estoque.gold);
  });
});

describe('F05a — npm run sim, ponta a ponta', () => {
  it('npm run sim -- inicial --ticks 0 imprime os valores da tabela e sai 0', () => {
    // shell: true e necessario no Windows para resolver npm.cmd; os
    // argumentos sao literais fixos desta chamada, nunca entrada do usuario.
    const saida = execFileSync('npm', ['run', 'sim', '--', 'inicial', '--ticks', '0'], {
      encoding: 'utf-8',
      shell: true,
      timeout: 30_000,
    });
    const { estadoInicial } = gameData.economia;
    for (const p of estadoInicial.predios) {
      expect(saida).toContain(p.id);
      expect(saida).toContain(`${p.gx},${p.gy}`);
    }
    for (const [mercadoria, quantidade] of Object.entries(estadoInicial.estoque)) {
      expect(saida).toContain(`${mercadoria}: ${quantidade}`);
    }
    for (const [tipo, quantidade] of Object.entries(estadoInicial.unidades)) {
      expect(saida).toContain(`${tipo}: ${quantidade}`);
    }
  }, 30_000);
});

// --- sim/ nao le o tema (ponto 3 do operador) ---
//
// Checagem manual, feita uma vez nesta sessao (nao recomputada a cada `npm
// run test`, no mesmo espirito da prova de vazamento da F04): um arquivo de
// prova temporario em src/sim/ importando data/theme-sertao.json foi
// reprovado pelo ESLint (no-restricted-imports, regra ja existente desde a
// F03) e apagado em seguida. A regra em si (eslint.config.mjs, bloco
// src/sim/**/*.ts) continua de pe e vale para todo arquivo novo desta
// feature, nao so para o arquivo de prova.
const PROVA_SEM_TEMA_EM_SIM = {
  arquivoDeProva: 'src/sim/__prova_tema_f05a.ts',
  importTestado: '../../data/theme-sertao.json',
  erros: 1,
  regra: 'no-restricted-imports',
  apagadoAposAChecagem: true,
};

describe('F05a — resumoDoEstado', () => {
  it('e a mesma forma que npm run sim imprime', () => {
    const resumo = resumoDoEstado(createInitialState(2026));
    expect(resumo.predios).toHaveLength(2);
    expect(resumo.estoqueTotal).toEqual(gameData.economia.estadoInicial.estoque);
    expect(resumo.unidadesPorTipo).toEqual(gameData.economia.estadoInicial.unidades);
  });
});

afterAll(() => {
  const state = createInitialState(2026);
  gravarEvidencia('F05a', {
    feature: 'F05a-estado-inicial',
    resumo: resumoDoEstado(state),
    roundTrip: {
      identicoAposJson: JSON.stringify(reviverPorJson(state)) === JSON.stringify(state),
      naoSerializavel: acharNaoSerializavel(state),
    },
    determinismo: {
      compararComESemSave: (() => {
        const { direto, comSave } = compararComESemSave({ seed: 2026, totalTicks: 1000, saveAtTick: 500 });
        return direto === comSave;
      })(),
      predios: state.predios.ordem.length,
      unidades: state.unidades.ordem.length,
    },
    semTemaEmSim: PROVA_SEM_TEMA_EM_SIM,
  });
});
