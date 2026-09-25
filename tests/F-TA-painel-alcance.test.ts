/**
 * F-TA — O PAINEL DIZ QUANTO RESTA AO ALCANCE.
 *
 * Pedido do operador: *"sem ela não sei se a pedreira vai durar mais cinco
 * minutos ou mais uma hora."* O número existe desde a F-T2a; o que faltava era
 * chegar à tela.
 *
 * O que se prova aqui, e nesta ordem de importancia:
 *
 *   1. o painel e a PREVIA da planta fantasma (F-TP) dizem o mesmo par no mesmo
 *      tile — a perna que impede a segunda copia da regra, que faria a tela
 *      prometer o que a pedreira nao entrega;
 *   2. e regra da CLASSE: um tipo FABRICADO, que nao existe em `data/` nenhum,
 *      ganha a linha sem uma linha de codigo. Nenhum id de predio e nenhum id de
 *      recurso e digitado no codigo novo, e este teste acusa sem varrer o fonte
 *      atras de nome;
 *   3. a linha acompanha o esgotamento, e veio SECO mostra zero em vez de
 *      desaparecer — era justamente o estado que o operador nao tinha como ver.
 *
 * O DOM do painel nao tem teste unitario (Vitest roda em `environment: 'node'`,
 * como o cabecalho da F16b registra): quem prova a linha na tela e
 * `tools/shots/F-TA.js`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { ColheitaDeRecurso, GameData, PredioData, ReceitaDePredio } from '../src/sim/data/types';
import { createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { painelDoPredio } from '../src/sim/selectors';
import type { ColheitaDoPainel } from '../src/sim/selectors';
import { receitaDoTipo } from '../src/sim/producao';
import { disponivelAoAlcance } from '../src/sim/recursos';
import { previaDeAlcance } from '../src/render/alcance-de-colheita';
import { rotuloDoAlcance } from '../src/render/rotulo-de-alcance';
import { cenarioDePedreira, comJazida } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

/** A colheita de um tipo, do DADO. Nunca `{ recurso: 'rock', alcance: 6 }`
 *  escrito aqui, que passaria mesmo se o dado mudasse. */
function colheitaDe(tipo: string, dados: GameData): ColheitaDeRecurso {
  const colheita = receitaDoTipo(tipo, dados)?.colheita ?? null;
  if (colheita === null) throw new Error(`fixture: '${tipo}' nao tem colheita no dado`);
  return colheita;
}

/** O painel de um predio, exigindo que ele exista. */
function painel(estado: GameState, id: string, dados: GameData = gameData) {
  const p = painelDoPredio(estado, id, dados);
  if (p === null) throw new Error(`fixture: predio '${id}' nao esta no estado`);
  return p;
}

const colheitaDoPainel = (estado: GameState, id: string, dados = gameData): ColheitaDoPainel | null =>
  painel(estado, id, dados).colheita;

/**
 * Um tipo de predio que NAO existe em `data/` nenhum, com `colheita` na receita.
 * Copia deliberada da fixture de `tests/F-TP-alcance-previa.test.ts`: a prova da
 * regra da classe vale para cada lado que afirma segui-la, e um helper
 * compartilhado faria os dois testes falharem ou passarem juntos por um motivo
 * que nao e o deles.
 */
function comPredioFicticio(
  dados: GameData, id: string, tamanho: readonly [number, number], colheita: ColheitaDeRecurso,
): GameData {
  const molde = dados.predios.find((p) => p.id === 'quarry');
  if (molde === undefined) throw new Error('fixture: quarry sumiu de buildings.json');
  const receitaMolde = receitaDoTipo('quarry', dados);
  if (receitaMolde === null) throw new Error('fixture: quarry sumiu de production.json');
  const def: PredioData = { ...molde, id, nome: id, tamanho: [tamanho[0], tamanho[1]] };
  const receita: ReceitaDePredio = { ...receitaMolde, colheita };
  return {
    ...dados,
    predios: [...dados.predios, def],
    producao: { ...dados.producao, receitas: { ...dados.producao.receitas, [id]: receita } },
  };
}

/** Um predio COMPLETO posto no estado a mao, sem obra e sem estrada: o alcance
 *  le tipo, gx e gy, e nada mais. */
function comPredio(estado: GameState, predio: PredioCompleto): GameState {
  return {
    ...estado,
    predios: {
      porId: { ...estado.predios.porId, [predio.id]: predio },
      ordem: [...estado.predios.ordem, predio.id],
    },
  };
}

function predioEm(id: string, tipo: string, gx: number, gy: number): PredioCompleto {
  return {
    id, tipo, gx, gy, hp: 1, estado: 'completo',
    capacidade: { entrada: null, saida: null }, estoque: { entrada: {}, saida: {} },
    ocupante: null, producao: null, pausado: false,
  };
}

/** Um tile da camada com quantidade trocada, sem passar pela colheita: e como se
 *  mede o esgotamento sem rodar mil ticks. */
function comTile(estado: GameState, chave: string, tipo: string, quantidade: number): GameState {
  return { ...estado, recursos: { ...estado.recursos, [chave]: { tipo, quantidade } } };
}

const pedreira = cenarioDePedreira();
const PEDREIRA = 'q1';
const ARMAZEM = pedreira.predios.ordem.find((id) => pedreira.predios.porId[id]?.tipo === 'storehouse');

describe('F-TA — o painel do extrator', () => {
  it('a pedreira traz recurso, tiles e unidades; o recurso e o id NEUTRO do dado', () => {
    const c = colheitaDoPainel(pedreira, PEDREIRA);
    expect(c).not.toBeNull();
    expect(c!.recurso).toBe(colheitaDe('quarry', gameData).recurso);
    expect(c!.tiles).toBeGreaterThan(0);
    expect(c!.unidades).toBeGreaterThan(0);
  });

  it('o painel e a PREVIA da planta fantasma dizem o mesmo par no mesmo tile', () => {
    const q = pedreira.predios.porId[PEDREIRA];
    expect(q).toBeDefined();
    const previa = previaDeAlcance(pedreira, 'quarry', q!.gx, q!.gy);
    expect(previa).not.toBeNull();
    expect(colheitaDoPainel(pedreira, PEDREIRA))
      .toEqual({ recurso: previa!.recurso, tiles: previa!.tiles, unidades: previa!.unidades });
  });

  it('e o mesmo total que a simulacao usa para se declarar esgotada', () => {
    const q = pedreira.predios.porId[PEDREIRA] as PredioCompleto;
    expect(colheitaDoPainel(pedreira, PEDREIRA)!.unidades)
      .toBe(disponivelAoAlcance(pedreira, q, colheitaDe('quarry', gameData)));
  });

  it('a frase do jogador sai do molde do tema, com os numeros do painel', () => {
    const c = colheitaDoPainel(pedreira, PEDREIRA)!;
    const q = pedreira.predios.porId[PEDREIRA];
    const previa = previaDeAlcance(pedreira, 'quarry', q!.gx, q!.gy);
    expect(rotuloDoAlcance(c.recurso, c.tiles, c.unidades)).toBe(previa!.rotulo);
  });

  it('colher muda a linha: tile secado sai da CONTAGEM e nao da soma', () => {
    const DADOS = comJazida(gameData, 'rock', [[24, 30], [25, 30], [26, 30]], 15);
    const cheio = comPredio(createInitialState(1, DADOS), predioEm('p-teste', 'quarry', 22, 34));
    expect(colheitaDoPainel(cheio, 'p-teste', DADOS)).toEqual({ recurso: 'rock', tiles: 3, unidades: 45 });

    const meio = comTile(cheio, '25,30', 'rock', 0);
    expect(colheitaDoPainel(meio, 'p-teste', DADOS)).toEqual({ recurso: 'rock', tiles: 2, unidades: 30 });
  });

  it('veio SECO mostra zero, nao desaparece — e a frase tem molde proprio', () => {
    const DADOS = comJazida(gameData, 'rock', [[24, 30]], 15);
    const cheio = comPredio(createInitialState(1, DADOS), predioEm('p-teste', 'quarry', 22, 34));
    const seco = comTile(cheio, '24,30', 'rock', 0);
    const c = colheitaDoPainel(seco, 'p-teste', DADOS);
    expect(c).toEqual({ recurso: 'rock', tiles: 0, unidades: 0 });
    expect(rotuloDoAlcance(c!.recurso, c!.tiles, c!.unidades))
      .not.toContain('0'); // "nenhum ao alcance": numero solto nao diz nada ao jogador
  });

  it('longe da rocha e zero, e o painel continua existindo', () => {
    const DADOS = comJazida(gameData, 'rock', [[24, 30]], 15);
    const longe = comPredio(createInitialState(1, DADOS), predioEm('p-longe', 'quarry', 60, 60));
    expect(colheitaDoPainel(longe, 'p-longe', DADOS)).toEqual({ recurso: 'rock', tiles: 0, unidades: 0 });
  });

  it('tipo que NAO colhe tile nao tem linha: a serraria tira o insumo da gaveta', () => {
    expect(ARMAZEM).toBeDefined();
    expect(colheitaDoPainel(pedreira, ARMAZEM as string)).toBeNull();
    const semColheita = gameData.predios
      .filter((p) => (receitaDoTipo(p.id)?.colheita ?? null) === null)
      .map((p) => p.id);
    expect(semColheita).toContain('sawmill');
    for (const tipo of semColheita) {
      const estado = comPredio(createInitialState(1), predioEm(`p-${tipo}`, tipo, 22, 34));
      expect(colheitaDoPainel(estado, `p-${tipo}`), `${tipo} nao colhe tile`).toBeNull();
    }
  });

  it('obra nao tem linha: quem colhe e o predio de pe', () => {
    const comObra = step(createInitialState(1), [
      { type: 'PlaceBlueprint', buildingId: 'quarry', gx: 38, gy: 31 },
    ], gameData);
    const obra = comObra.predios.ordem[comObra.predios.ordem.length - 1] as string;
    expect(comObra.predios.porId[obra]?.estado).toBe('obra');
    expect(painel(comObra, obra).colheita).toBeNull();
  });

  it('tipo FABRICADO com colheita ganha a linha sem uma linha de codigo', () => {
    const colheita: ColheitaDeRecurso = { ...colheitaDe('quarry', gameData), alcance: 2 };
    const DADOS = comJazida(
      comPredioFicticio(gameData, 'extrator-ficticio', [2, 2], colheita),
      'rock', [[24, 30], [25, 30]], 7,
    );
    const estado = comPredio(
      createInitialState(1, DADOS), predioEm('p-fic', 'extrator-ficticio', 24, 32),
    );
    expect(colheitaDoPainel(estado, 'p-fic', DADOS))
      .toEqual({ recurso: 'rock', tiles: 2, unidades: 14 });
  });

  it('tipo fora do dado: o painel INTEIRO e null, muito antes da linha', () => {
    // Medido ao escrever este teste: `painelDoPredio` ja devolve `null` para tipo
    // que nao esta em `buildings.json` (save de outra versao), entao nao existe o
    // caso "painel de pe com colheita duvidosa". A guarda de caixa em
    // `colheitaDoPainel` e inalcancavel POR AQUI e fica escrita como tal.
    const estado = comPredio(createInitialState(1), predioEm('p-nada', 'nao-existe', 22, 34));
    expect(painelDoPredio(estado, 'p-nada')).toBeNull();
  });
});

describe('F-TA — evidencia', () => {
  it('grava o que o painel da pedreira do cenario publica', () => {
    const q = pedreira.predios.porId[PEDREIRA];
    const previa = previaDeAlcance(pedreira, 'quarry', q!.gx, q!.gy);
    const c = colheitaDoPainel(pedreira, PEDREIRA)!;
    gravarEvidencia('F-TA', {
      feature: 'F-TA-painel-alcance',
      aceite: 'BUILD_PLAN.md F-TA: o painel do extrator mostra o que resta ao alcance',
      pedreiraDoCenario: { predio: PEDREIRA, gx: q!.gx, gy: q!.gy },
      painel: c,
      frase: rotuloDoAlcance(c.recurso, c.tiles, c.unidades),
      mesmoParDaPrevia: previa !== null
        && previa.tiles === c.tiles && previa.unidades === c.unidades
        && previa.recurso === c.recurso,
      semLinha: {
        armazem: colheitaDoPainel(pedreira, ARMAZEM as string),
        obra: null,
      },
    });
    expect(true).toBe(true);
  });
});
