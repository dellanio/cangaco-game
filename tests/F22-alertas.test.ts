/**
 * F22 — os alertas do HUD. Plano em `docs/planos/F22-alertas-do-hud.md`.
 *
 * Nenhum estado novo: as tres causas ja nasceram prontas em features
 * anteriores (`ocupante === null` na F14, `predioLigadoAoArmazem` na F08,
 * `veioEsgotado` na F15a). O que esta feature acrescenta e a DERIVACAO —
 * varrer os predios e dizer quais estao parados, sem o jogador clicar em
 * nenhum.
 *
 * A causa e id NEUTRO (`sem-trabalhador`); o texto que o jogador le mora no
 * tema e e assunto da `ui/`. `sim/` nunca le o tema (CLAUDE.md §9).
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { step } from '../src/sim/tick';
import { alertasDoEstado, CAUSAS_DE_ALERTA } from '../src/sim/selectors';
import type { Alerta, CausaDeAlerta } from '../src/sim/selectors';
import { trabalhadorDoTipo } from '../src/sim/ocupacao';
import { gravarEvidencia } from './helpers/evidence';
import {
  avancar, cenarioDePedreira, comRendimento, semAUnidade, semEstrada, semOcupante, veioDe,
} from './helpers/producao-cenario';

const pausar = (predio: string, pausado: boolean): Command => ({
  type: 'SetBuildingPaused', predio, pausado,
});

/** A pedreira da fixture SEM ninguem dentro: o ocupante sai do predio e o civil
 *  sai do mapa. Se so o ocupante saisse, o proximo `step` poderia devolve-lo
 *  pelo JobBoard e o teste passaria pelo motivo errado. */
function pedreiraVaga(dados: GameData = gameData): GameState {
  return semAUnidade(semOcupante(cenarioDePedreira(dados), 'q1'), 'u1');
}

const causasDe = (alertas: readonly Alerta[], predio: string): readonly CausaDeAlerta[] =>
  alertas.filter((a) => a.predio === predio).map((a) => a.causa);

const alertas = alertasDoEstado;

/**
 * Os cenarios do aceite, num lugar so: a evidencia grava esta lista e o guarda
 * de "nenhuma causa sem produtor" a percorre. Nao e acumulador entre testes —
 * seria ordem de execucao virando dependencia escondida, e `--shuffle` mataria
 * o guarda em silencio.
 */
function cenariosDoAceite(): Readonly<Record<string, readonly Alerta[]>> {
  const dadosCurtos = comRendimento(gameData, 'quarry', 2);
  return {
    aberturaDaVila: alertas(createInitialState(gameData.economia.estadoInicial.semente)),
    pedreiraOcupadaELigada: alertas(cenarioDePedreira()),
    pedreiraVaga: alertas(pedreiraVaga()),
    pedreiraVagaEPausada: alertas(step(pedreiraVaga(), [pausar('q1', true)])),
    pedreiraSemEstrada: alertas(semEstrada(cenarioDePedreira())),
    pedreiraComVeioEsgotado: alertas(
      avancar(cenarioDePedreira(dadosCurtos), 167 * 5, dadosCurtos), dadosCurtos,
    ),
  };
}

describe('F22 — sem-trabalhador', () => {
  it('pedreira completa e vaga alerta sem-trabalhador', () => {
    expect(alertas(pedreiraVaga())).toEqual([
      { predio: 'q1', tipo: 'quarry', causa: 'sem-trabalhador' },
    ]);
  });

  it('a mesma pedreira, ocupada e ligada, nao alerta nada', () => {
    expect(alertas(cenarioDePedreira())).toEqual([]);
  });

  it('predio que NAO pede trabalhador nunca alerta: o jogo nao abre com alerta', () => {
    // A vila inicial e so armazem e escola, e os dois tem `trabalhador: null`
    // em `data/buildings.json`. Nao e coincidencia a confirmar de olho: o teste
    // le o dado e exige a condicao.
    const estado = createInitialState(gameData.economia.estadoInicial.semente);
    for (const id of estado.predios.ordem) {
      const predio = estado.predios.porId[id];
      expect(predio, `predio '${id}' da vila inicial`).toBeDefined();
      expect(trabalhadorDoTipo(predio?.tipo ?? '')).toBeNull();
    }
    expect(alertas(estado)).toEqual([]);
    expect(alertas(avancar(estado, 30))).toEqual([]);
  });

  it('obra nao alerta: nao ha trabalhador a esperar antes de o predio existir', () => {
    const planta: Command = { type: 'PlaceBlueprint', buildingId: 'quarry', gx: 26, gy: 34 };
    const estado = step(createInitialState(1), [planta]);
    const obra = estado.predios.ordem
      .map((id) => estado.predios.porId[id])
      .find((p) => p?.tipo === 'quarry');
    // A fixture confere a si mesma: planta recusada faria o teste passar sozinho.
    expect(obra?.estado, 'a planta deveria ter virado obra').toBe('obra');
    expect(alertas(estado).filter((a) => a.tipo === 'quarry')).toEqual([]);
  });
});

describe('F22 — pausa deliberada', () => {
  it('PAUSA DELIBERADA nao alerta nada, nem o sem-trabalhador que existia antes', () => {
    const vaga = pedreiraVaga();
    expect(causasDe(alertas(vaga), 'q1')).toEqual(['sem-trabalhador']);

    // Pelo COMANDO real, nunca escrevendo `pausado` a mao — criterio da F16c.
    const pausada = step(vaga, [pausar('q1', true)]);
    expect(pausada.predios.porId['q1']?.estado === 'completo'
      && pausada.predios.porId['q1'].pausado, 'a pausa deveria ter pegado').toBe(true);
    expect(alertas(pausada)).toEqual([]);

    // E volta ao alerta quando o jogador retoma: pausa nao apaga a causa,
    // so cala o aviso.
    expect(causasDe(alertas(step(pausada, [pausar('q1', false)])), 'q1'))
      .toEqual(['sem-trabalhador']);
  });

  it('pausa cala TODAS as causas, nao so a de estar parado', () => {
    const semRede = semEstrada(pedreiraVaga());
    expect(causasDe(alertas(semRede), 'q1')).toEqual(['sem-trabalhador', 'sem-estrada']);
    expect(alertas(step(semRede, [pausar('q1', true)]))).toEqual([]);
  });
});

describe('F22 — sem-estrada', () => {
  it('pedreira sem ligacao ao armazem alerta sem-estrada; ligada, nao', () => {
    expect(alertas(semEstrada(cenarioDePedreira()))).toEqual([
      { predio: 'q1', tipo: 'quarry', causa: 'sem-estrada' },
    ]);
    expect(causasDe(alertas(cenarioDePedreira()), 'q1')).toEqual([]);
  });

  it('escola com fila VAZIA nao espera nada, e por isso nao alerta sem rede', () => {
    // A escola so precisa do armazem quando ha item na fila esperando ouro
    // (`motivoDaEspera`, F13b). Sem fila, uma escola sem estrada nao e problema.
    const estado = semEstrada(createInitialState(1));
    expect(alertas(estado)).toEqual([]);
  });
});

describe('F22 — veio-esgotado', () => {
  it('veio esgotado alerta, com o rendimento injetado pelo dado', () => {
    // Como a F15a: o rendimento vem do MESMO `GameData` com outro numero, nunca
    // de veio fabricado a mao nem de 200 unidades de espera.
    const dadosCurtos = comRendimento(gameData, 'quarry', 2);
    const inicio = cenarioDePedreira(dadosCurtos);
    expect(causasDe(alertas(inicio, dadosCurtos), 'q1')).toEqual([]);

    const esgotada = avancar(inicio, 167 * 5, dadosCurtos);
    expect(veioDe(esgotada, 'q1'), 'a fixture deveria ter esgotado o veio').toBe(0);
    expect(alertas(esgotada, dadosCurtos)).toEqual([
      { predio: 'q1', tipo: 'quarry', causa: 'veio-esgotado' },
    ]);
  });

  it('o alerta sai pelo predicado do runtime, nao por `veio === 0`', () => {
    // A quarry rende 1 por ciclo, entao os dois criterios coincidiriam nela. O
    // que separa os dois e uma receita que consome mais de uma unidade por
    // ciclo: `veioEsgotado` reprova ja em `veio < unidadesPorCiclo`, e e ai que
    // a producao para de verdade — alertar so em zero avisaria tarde.
    const dobrada: GameData = {
      ...gameData,
      producao: {
        ...gameData.producao,
        receitas: {
          ...gameData.producao.receitas,
          quarry: { ...gameData.producao.receitas['quarry']!, sai: { stone: 2 }, rendimentoDoVeio: 3 },
        },
      },
    };
    const s = avancar(cenarioDePedreira(dobrada), 167 * 3, dobrada);
    expect(veioDe(s, 'q1'), 'sobra 1 no veio, e a receita pede 2').toBe(1);
    expect(causasDe(alertas(s, dobrada), 'q1')).toEqual(['veio-esgotado']);
  });
});

describe('F22 — determinismo da lista', () => {
  it('a ordem e a de predios.ordem, e as causas em ordem fixa', () => {
    const estado = semEstrada(pedreiraVaga());
    const lista = alertas(estado);
    // As causas do MESMO predio saem na ordem de `CAUSAS_DE_ALERTA`, nunca na
    // de `Object.keys`.
    expect(lista.map((a) => a.causa))
      .toEqual(CAUSAS_DE_ALERTA.filter((c) => lista.some((a) => a.causa === c)));
    // E os predios saem na ordem do estado: a posicao de cada alerta em
    // `predios.ordem` nunca decresce.
    const posicoes = lista.map((a) => estado.predios.ordem.indexOf(a.predio));
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
    expect(posicoes.every((p) => p >= 0), 'todo alerta aponta para predio do estado').toBe(true);
  });

  it('a derivacao e pura: chamar duas vezes devolve o mesmo, e nao muta o estado', () => {
    const estado = semEstrada(pedreiraVaga());
    const antes = JSON.stringify(estado);
    expect(alertas(estado)).toEqual(alertas(estado));
    expect(JSON.stringify(estado)).toBe(antes);
  });
});

describe('F22 — nenhuma causa sem produtor', () => {
  it('fome e ataque nao existem na lista: nao ha produtor antes da F20/F28', () => {
    expect([...CAUSAS_DE_ALERTA]).toEqual(['sem-trabalhador', 'sem-estrada', 'veio-esgotado']);
  });

  it('GUARDA: toda causa declarada e PRODUZIDA por um cenario do aceite', () => {
    // Esta e a regra do `terreno` na F06, automatizada: causa que entra na lista
    // sem cenario que a produza reprova o `npm run verify`. Nao e checar texto —
    // e exigir que a lista declarada e o que os cenarios reais conseguem gerar
    // sejam o mesmo conjunto.
    const produzidas = new Set<CausaDeAlerta>();
    for (const lista of Object.values(cenariosDoAceite())) {
      for (const a of lista) produzidas.add(a.causa);
    }
    expect([...produzidas].sort()).toEqual([...CAUSAS_DE_ALERTA].sort());
  });

  it('grava a evidencia do aceite', () => {
    const cenarios = cenariosDoAceite();
    gravarEvidencia('F22', {
      feature: 'F22-alertas-do-hud',
      causas: [...CAUSAS_DE_ALERTA],
      produtorPorCausa: {
        'sem-trabalhador': 'ehPredioOcupavel + ocupante === null (F14)',
        'sem-estrada': 'predioLigadoAoArmazem (F08), via motivoDaEspera (F13b) na escola',
        'veio-esgotado': 'veioEsgotado(producao, receita) (sim/producao.ts, F15a)',
      },
      deixadasDeFora: {
        fome: 'sem produtor: nao ha consumo nem estado de fome antes da F20',
        'sendo-atacado': 'sem produtor: nao ha combate antes da F28',
      },
      cenarios,
    });
  });
});
