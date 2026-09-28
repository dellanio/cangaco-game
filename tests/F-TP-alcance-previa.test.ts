/**
 * F-TP — A PLANTA FANTASMA NAO PROMETE O QUE O PREDIO NAO ENTREGA.
 *
 * O item pede que a previa mostre o alcance de colheita e quantos tiles do
 * recurso caem dentro dele ANTES do clique, e que isso seja regra da CLASSE —
 * de toda receita com `colheita`, nao da Quarry. As duas coisas se provam aqui,
 * estruturalmente:
 *
 *   - a previa e o predio PLANTADO naquele mesmo tile devolvem o mesmo numero,
 *     porque e a mesma funcao (a perna que impede a segunda copia da regra);
 *   - um tipo de predio FABRICADO, que nao existe em `data/` nenhum, ganha a
 *     previa sem uma linha de codigo. Se algum id estivesse digitado em `.ts`,
 *     e este teste que acusaria — e ele nao varre o fonte atras de nome.
 *
 * O desenho em si (retangulo, texto, cor na tela) e do roteiro `tools/shots/F-TP.js`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData, PredioData, ReceitaDePredio } from '../src/sim/data/types';
import type { ColheitaDeRecurso } from '../src/sim/data/types';
import { createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { caixaDeTipo } from '../src/sim/footprint';
import { receitaDoTipo } from '../src/sim/producao';
import {
  colheitaAoAlcanceDaCaixa, disponivelAoAlcance, tilesDeColheita, tilesDeColheitaNaCaixa,
} from '../src/sim/recursos';
import { corDoRecurso, nomeDoRecurso, previaDeAlcance, rotuloDoAlcance } from '../src/render/alcance-de-colheita';
import { comJazida } from './helpers/producao-cenario';
import { LADO_DO_JOGADOR } from '../src/sim/state';

/** A colheita da pedreira, do DADO — nunca `{ recurso: 'rock', alcance: 6 }`
 *  digitado aqui, que faria o teste passar mesmo se o dado mudasse. */
function colheitaDe(tipo: string, dados: GameData): ColheitaDeRecurso {
  const colheita = receitaDoTipo(tipo, dados)?.colheita ?? null;
  if (colheita === null) throw new Error(`fixture: '${tipo}' nao tem colheita no dado`);
  return colheita;
}

const estadoCom = (dados: GameData): GameState => createInitialState(1, dados);

/** Um predio COMPLETO solto, so para perguntar o alcance dele. Nao entra em
 *  `state.predios`: `tilesDeColheita` le tipo, gx e gy e mais nada, e plantar de
 *  verdade exigiria estrada ate o armazem — que nao e o assunto aqui. */
function predioEm(tipo: string, gx: number, gy: number): PredioCompleto {
  return {
    lado: LADO_DO_JOGADOR, id: `p-${gx}-${gy}`, tipo, gx, gy, hp: 1, estado: 'completo',
    capacidade: { entrada: null, saida: null }, estoque: { entrada: {}, saida: {} },
    ocupante: null, producao: null, pausado: false, reparo: false,
  };
}

/** Um tipo de predio que NAO existe em `data/` nenhum, com `colheita` na
 *  receita. E a prova da regra da classe. */
function comPredioFicticio(
  dados: GameData, id: string, tamanho: readonly [number, number],
  // LOTE3 — sem as fases: descanso 0 e o ciclo inteiro no tile, o de receita sem `fases`
  colheita: Omit<ColheitaDeRecurso, 'ticksNoTile' | 'ticksDeDescanso'>,
): GameData {
  const molde = dados.predios.find((p) => p.id === 'quarry');
  if (molde === undefined) throw new Error('fixture: quarry sumiu de buildings.json');
  const receitaMolde = receitaDoTipo('quarry', dados);
  if (receitaMolde === null) throw new Error('fixture: quarry sumiu de production.json');
  const def: PredioData = { ...molde, id, nome: id, tamanho: [tamanho[0], tamanho[1]] };
  const receita: ReceitaDePredio = {
    ...receitaMolde, colheita: { ...colheita, ticksDeDescanso: 0, ticksNoTile: receitaMolde.ticksDoCiclo },
  };
  return {
    ...dados,
    predios: [...dados.predios, def],
    producao: { ...dados.producao, receitas: { ...dados.producao.receitas, [id]: receita } },
  };
}

describe('F-TP — o nucleo por caixa', () => {
  const DADOS = comJazida(gameData, 'rock', [[24, 30], [25, 30], [26, 30]], 15);
  const COLHEITA = colheitaDe('quarry', DADOS);

  it('devolve os mesmos tiles que a assinatura de predio, na mesma ordem', () => {
    const estado = estadoCom(DADOS);
    const caixa = caixaDeTipo('quarry', 22, 34, DADOS);
    expect(caixa).not.toBeNull();
    expect(tilesDeColheitaNaCaixa(estado, caixa!, COLHEITA, DADOS))
      .toEqual(tilesDeColheita(estado, predioEm('quarry', 22, 34), COLHEITA, DADOS));
  });

  it('tipo fora do dado nao tem caixa, e a lista sai vazia', () => {
    expect(caixaDeTipo('nao-existe', 22, 34, DADOS)).toBeNull();
    expect(tilesDeColheita(estadoCom(DADOS), predioEm('nao-existe', 22, 34), COLHEITA, DADOS))
      .toEqual([]);
  });

  it('tiles conta o que ainda tem recurso, e unidades e a soma', () => {
    const caixa = caixaDeTipo('quarry', 22, 34, DADOS)!;
    const cheio = estadoCom(DADOS);
    expect(colheitaAoAlcanceDaCaixa(cheio, caixa, COLHEITA, DADOS)).toEqual({ tiles: 3, unidades: 45 });

    // Tile de regime `porAcao` fica na camada com quantidade 0 (ver o cabecalho
    // de sim/recursos.ts). Ele sai da CONTAGEM e continua somando zero.
    const seco: GameState = {
      ...cheio,
      recursos: { ...cheio.recursos, '25,30': { tipo: 'rock', quantidade: 0 } },
    };
    expect(colheitaAoAlcanceDaCaixa(seco, caixa, COLHEITA, DADOS)).toEqual({ tiles: 2, unidades: 30 });
  });

  it('disponivelAoAlcance nao mudou de resultado ao passar pela caixa', () => {
    const cheio = estadoCom(DADOS);
    expect(disponivelAoAlcance(cheio, predioEm('quarry', 22, 34), COLHEITA, DADOS)).toBe(45);
    expect(disponivelAoAlcance(cheio, predioEm('nao-existe', 22, 34), COLHEITA, DADOS)).toBe(0);
  });
});

describe('F-TP — a previa da planta fantasma', () => {
  const DADOS = comJazida(gameData, 'rock', [[24, 30], [25, 30], [26, 30], [27, 30]], 15);
  const COLHEITA = colheitaDe('quarry', DADOS);

  it('sai para a pedreira, com recurso, moldura e numeros do dado', () => {
    const previa = previaDeAlcance(estadoCom(DADOS), 'quarry', 22, 34, DADOS);
    expect(previa).not.toBeNull();
    expect(previa!.recurso).toBe(COLHEITA.recurso);
    expect(previa!.tiles).toBe(4);
    expect(previa!.unidades).toBe(60);
    // A moldura e a caixa do predio expandida pelo alcance, meio-aberta: uma
    // pedreira 3x2 em (22,34) com alcance 6 vai de (16,28) a (31,42).
    const caixa = caixaDeTipo('quarry', 22, 34, DADOS)!;
    expect(previa!.moldura).toEqual({
      x0: caixa.x0 - COLHEITA.alcance, y0: caixa.y0 - COLHEITA.alcance,
      x1: caixa.x1 + COLHEITA.alcance, y1: caixa.y1 + COLHEITA.alcance,
    });
  });

  it('longe da rocha diz ZERO, e continua sendo previa e nao recusa', () => {
    // Nenhum tile de rocha ao alcance: a previa existe, com zero. Quem recusa e
    // `canPlace`, e ele nao foi tocado nesta feature.
    const previa = previaDeAlcance(estadoCom(DADOS), 'quarry', 60, 60, DADOS);
    expect(previa).not.toBeNull();
    expect(previa!.tiles).toBe(0);
    expect(previa!.unidades).toBe(0);
    expect(previa!.rotulo).toContain(nomeDoRecurso('rock'));
  });

  it('a previa aparece exatamente para as receitas com colheita', () => {
    const estado = estadoCom(gameData);
    for (const predio of gameData.predios) {
      const temColheita = (receitaDoTipo(predio.id, gameData)?.colheita ?? null) !== null;
      const previa = previaDeAlcance(estado, predio.id, 20, 20, gameData);
      expect(previa !== null, `previa de '${predio.id}'`).toBe(temColheita);
    }
  });

  it('predio FABRICADO com colheita ganha a previa sem uma linha de codigo', () => {
    const dados = comPredioFicticio(
      comJazida(gameData, 'rock', [[30, 30]], 7), 'inventado', [2, 2], { recurso: 'rock', alcance: 4, aDistancia: false },
    );
    const previa = previaDeAlcance(estadoCom(dados), 'inventado', 29, 29, dados);
    expect(previa).not.toBeNull();
    expect(previa!.recurso).toBe('rock');
    expect(previa!.tiles).toBe(1);
    expect(previa!.unidades).toBe(7);
    // E o alcance e o DELE, nao o da pedreira: a moldura mede 2 + 2*4 = 10 tiles.
    expect(previa!.moldura.x1 - previa!.moldura.x0).toBe(10);
  });

  it('a fantasma e o predio plantado concordam, tile a tile', () => {
    const estado = estadoCom(DADOS);
    for (let gx = 18; gx <= 30; gx += 1) {
      for (let gy = 26; gy <= 36; gy += 1) {
        const previa = previaDeAlcance(estado, 'quarry', gx, gy, DADOS);
        const doPredio = tilesDeColheita(estado, predioEm('quarry', gx, gy), COLHEITA, DADOS);
        const comRecurso = doPredio.filter((k) => (estado.recursos[k]?.quantidade ?? 0) > 0);
        expect(previa!.tiles, `(${gx},${gy}) contra a lista filtrada`).toBe(comRecurso.length);
        // Mapa novo: nenhum tile zerado, entao a lista filtrada e a lista inteira.
        // As duas afirmacoes juntas sao o que o item pede, sem afrouxar nenhuma.
        expect(previa!.tiles, `(${gx},${gy}) contra tilesDeColheita`).toBe(doPredio.length);
      }
    }
  });
});

describe('F-TP — o texto e a cor sao do tema, o id e neutro', () => {
  it('o rotulo monta do molde do tema, com nome, contagem e soma', () => {
    const rotulo = rotuloDoAlcance('rock', 4, 60);
    expect(rotulo).toContain(nomeDoRecurso('rock'));
    expect(rotulo).toContain('4');
    expect(rotulo).toContain('60');
    expect(rotulo).not.toContain('rock');
  });

  it('zero ao alcance tem frase propria, sem numero solto', () => {
    const rotulo = rotuloDoAlcance('rock', 0, 0);
    expect(rotulo).toContain(nomeDoRecurso('rock'));
    expect(rotulo).not.toContain('0');
  });

  it('todo recurso do dado tem nome e cor no tema', () => {
    // Mesmo guarda da cor em `render/mapa.ts`, e pela mesma razao: previa com o
    // nome de OUTRO recurso e pior que previa nenhuma.
    for (const recurso of Object.keys(gameData.recursos.tipos)) {
      expect(() => nomeDoRecurso(recurso), recurso).not.toThrow();
      expect(corDoRecurso(recurso), recurso).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('recurso que nao existe reprova em vez de sair com a cor de outro', () => {
    expect(() => nomeDoRecurso('nao-existe')).toThrow();
    expect(() => corDoRecurso('nao-existe')).toThrow();
  });
});
