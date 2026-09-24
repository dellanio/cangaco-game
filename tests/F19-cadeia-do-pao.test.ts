/**
 * F19 — A CADEIA DO PAO: milho -> fubá -> cuscuz, sem uma linha de codigo nova.
 *
 * O item da fila mandou MEDIR antes de implementar, e a medicao respondeu que a
 * cadeia ja fecha: a producao e generica desde a F15a, as tarefas de insumo
 * entre predios existem desde a F15b, e `mill`/`bakery` estao em
 * `data/production.json` desde sempre. O que faltava era PROVA — sonda prova o
 * momento, teste prova o amanha (CLAUDE.md §8).
 *
 * O cenario e a proporcao que o proprio dado publica como oraculo
 * (`proporcoesDeReferencia`): 1 fazenda : 1 moinho : 1 padaria.
 *
 * Tudo medido contra o TICK 0 — o armazem da vila ja abre com cuscuz no estoque
 * inicial, e contra zero absoluto este teste mediria o dado de abertura.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import { receitaDoTipo, unidadesPorCiclo } from '../src/sim/producao';
import { opcoesDoMenuBuild } from '../src/sim/selectors';
import { gravarEvidencia } from './helpers/evidence';
import {
  avancar, cenarioDaCadeiaDoPao, cenarioDaCadeiaSemMoinho, fsmDe,
} from './helpers/producao-cenario';

const FAZENDA = receitaDoTipo('farm', gameData);
const MOINHO = receitaDoTipo('mill', gameData);
const PADARIA = receitaDoTipo('bakery', gameData);
if (FAZENDA?.colheita == null || MOINHO === null || PADARIA === null) {
  throw new Error('fixture: farm, mill e bakery precisam de receita em data/production.json');
}

const GRAO = FAZENDA.colheita.recurso;
const FARINHA = Object.keys(MOINHO.sai)[0] ?? '';
const PAO = Object.keys(PADARIA.sai)[0] ?? '';

const PLANTIO = gameData.recursos.tipos[GRAO]?.reposicao?.ticks ?? 0;
const RENDIMENTO = gameData.recursos.tipos[GRAO]?.rendimentoPorTile ?? 0;

/** O que a FONTE permite: um tile de milho custa um plantio mais os ciclos que
 *  ele rende, e e isso — e nao o relogio do moinho — que limita a cadeia. */
const TICKS_POR_GRAO = (PLANTIO + RENDIMENTO * FAZENDA.ticksDoCiclo) / RENDIMENTO;
/** Quantos paes cada grao vira, seguindo a cadeia elo a elo. Derivado, nao
 *  digitado: se o moinho um dia consumir dois milhos por ciclo, isto acompanha. */
const PAES_POR_GRAO = unidadesPorCiclo(PADARIA) / (MOINHO.entra[GRAO] ?? 1);
/** A latencia minima da cadeia: plantar, colher, moer, assar. Nenhum transporte
 *  cabe aqui — e por isso que ela e um piso que nada pode furar. */
const ARRANQUE = PLANTIO + FAZENDA.ticksDoCiclo + MOINHO.ticksDoCiclo + PADARIA.ticksDoCiclo;

const JANELA = 12000;

/**
 * O oraculo de calibracao vive em `production.json` e NAO passa pelo carregador:
 * nenhum sistema o le, e nao deve ler — e numero de referencia para medir, nao
 * regra de jogo. Quem o le e este teste, que e o cenario de medicao. Sem isto a
 * proporcao do cenario seria so uma escolha minha.
 */
const PROPORCOES = (JSON.parse(readFileSync('data/production.json', 'utf8')) as {
  readonly proporcoesDeReferencia: Readonly<Record<string, number>>;
}).proporcoesDeReferencia;

/**
 * Tolerancia de TRANSPORTE, nao de balanceamento: o serf leva a carga de um
 * predio ao armazem e do armazem ao seguinte, e isso nao e de graca. A medicao
 * que originou o numero deu 99,6 % do teto com 4 serfs; 85 % deixa folga para o
 * caminho crescer sem o teste virar oraculo de desempenho.
 */
const PISO_DA_VAZAO = 0.85;

/** Mercadoria ENTREGUE: o que esta em gaveta de predio, qualquer uma, somando as
 *  duas — a carga na mao de um serf no meio da viagem nao conta nem duas vezes
 *  nem nenhuma, porque ela saiu de uma gaveta e vai entrar em outra. */
function entregue(estado: GameState, mercadoria: string): number {
  let total = 0;
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (p?.estado !== 'completo') continue;
    total += (p.estoque.entrada[mercadoria] ?? 0) + (p.estoque.saida[mercadoria] ?? 0);
  }
  return total;
}

/** O acumulado desde o tick 0 — a unica leitura honesta num mapa que abre com
 *  estoque no armazem. */
function desdeOInicio(inicial: GameState, fim: GameState, mercadoria: string): number {
  return entregue(fim, mercadoria) - entregue(inicial, mercadoria);
}

function tetoDaFonte(ticks: number): number {
  return (PAES_POR_GRAO * (ticks - ARRANQUE)) / TICKS_POR_GRAO;
}

describe('F19 — a cadeia fecha: milho vira fubá, fubá vira cuscuz', () => {
  it('os tres elos sao mesmo uma cadeia no dado, e nao tres receitas soltas', () => {
    // A guarda e estrutural: se alguem trocar a saida do moinho, os marcos
    // abaixo deixam de descrever a cadeia e este teste cai antes deles.
    expect(MOINHO.entra[GRAO]).toBeGreaterThan(0);
    expect(MOINHO.sai[FARINHA]).toBeGreaterThan(0);
    expect(PADARIA.entra[FARINHA]).toBeGreaterThan(0);
    expect(PADARIA.sai[PAO]).toBeGreaterThan(0);
    expect([GRAO, FARINHA, PAO]).toEqual(['corn', 'flour', 'loaves']);
  });

  it('o cuscuz aparece, e nunca antes do que a cadeia inteira permite', () => {
    const inicial = cenarioDaCadeiaDoPao();
    expect(desdeOInicio(inicial, avancar(inicial, ARRANQUE - 1), PAO)).toBe(0);
    expect(desdeOInicio(inicial, avancar(inicial, JANELA), PAO)).toBeGreaterThan(0);
  });

  it('e cada elo chega na sua vez: milho, depois fubá, depois cuscuz', () => {
    // A ordem e o que separa uma cadeia de tres prédios que produzem sozinhos.
    const inicial = cenarioDaCadeiaDoPao();
    const primeiro: Record<string, number> = {};
    let s = inicial;
    for (let t = 1; t <= JANELA && Object.keys(primeiro).length < 3; t += 1) {
      s = avancar(s, 1);
      for (const m of [GRAO, FARINHA, PAO]) {
        if (primeiro[m] === undefined && desdeOInicio(inicial, s, m) > 0) primeiro[m] = t;
      }
    }
    expect(primeiro[GRAO]).toBe(PLANTIO + FAZENDA.ticksDoCiclo);
    expect(primeiro[FARINHA]).toBeGreaterThan(primeiro[GRAO] ?? 0);
    expect(primeiro[PAO]).toBeGreaterThan(primeiro[FARINHA] ?? 0);
  });
});

describe('F19 — o elo do meio e real', () => {
  it('sem moinho a mesma vila nao faz um cuscuz, e a padaria fica esperando', () => {
    // Sem esta perna, o teste acima passaria com uma padaria que fabricasse pao
    // do nada — o mesmo defeito que a F18 encontrou na fazenda.
    const inicial = cenarioDaCadeiaSemMoinho();
    const fim = avancar(inicial, JANELA);
    expect(desdeOInicio(inicial, fim, PAO)).toBe(0);
    expect(desdeOInicio(inicial, fim, FARINHA)).toBe(0);
    expect(fsmDe(fim, 'forneiro')).toBe('esperando_insumo');
    // e a fazenda continua produzindo: o que parou foi a cadeia, nao o mapa —
    // o milho se acumula sem ninguem para moe-lo.
    expect(desdeOInicio(inicial, fim, GRAO)).toBeGreaterThan(0);
    expect(fsmDe(fim, 'roceiro')).toBe('trabalhando');
  });
});

describe('F19 — a vazao e limitada pela FONTE, e nada se acumula', () => {
  it('o cuscuz entregue cabe no teto do milho, e chega perto dele', () => {
    const inicial = cenarioDaCadeiaDoPao();
    const paes = desdeOInicio(inicial, avancar(inicial, JANELA), PAO);
    // TETO: dois paes por milho, e o milho e o que a fazenda consegue tirar do
    // tile. Passar disso seria mercadoria nascendo do nada.
    expect(paes).toBeLessThanOrEqual(tetoDaFonte(JANELA));
    // PISO: o transporte custa, mas nao pode ser o gargalo.
    expect(paes).toBeGreaterThanOrEqual(PISO_DA_VAZAO * tetoDaFonte(JANELA));
  });

  it('o cenario E a proporcao que o dado publica: 1 fazenda : 1 moinho : 1 padaria', () => {
    // A medicao so vale contra o oraculo se for o oraculo que ela monta.
    const conta = (tipo: string): number => Object.values(cenarioDaCadeiaDoPao().predios.porId)
      .filter((p) => p?.estado === 'completo' && p.tipo === tipo).length;
    expect(PROPORCOES.farm_por_mill).toBe(conta('farm') / conta('mill'));
    expect(PROPORCOES.mill_por_bakery).toBe(conta('mill') / conta('bakery'));
  });

  it('nenhuma gaveta fica represada no fim — o oraculo do dado pede isso', () => {
    // `production.json:proporcoesDeReferencia._doc`: um cenario que respeite as
    // proporcoes "nao pode acumular fila infinita". As gavetas dos tres estao
    // abaixo do teto, e o intermediario nao ficou parado no armazem.
    const fim = avancar(cenarioDaCadeiaDoPao(), JANELA);
    for (const id of ['f1', 'm1', 'b1']) {
      const p = fim.predios.porId[id];
      if (p?.estado !== 'completo') throw new Error(`fixture: '${id}' deveria estar completo`);
      const soma = (g: Readonly<Record<string, number>>): number =>
        Object.values(g).reduce((a, q) => a + q, 0);
      expect(soma(p.estoque.entrada), `${id} entrada`).toBeLessThan(p.capacidade.entrada ?? Infinity);
      expect(soma(p.estoque.saida), `${id} saida`).toBeLessThan(p.capacidade.saida ?? Infinity);
    }
  });
});

describe('F19 — o jogador alcanca a cadeia', () => {
  it('a fazenda libera o moinho, e o moinho libera a padaria', () => {
    // A corrente vem de `buildings.json:desbloqueadoPor`. Sem ela a cadeia
    // existiria so dentro de teste, que e onde ela NAO pode existir.
    const daVila = new Map(opcoesDoMenuBuild(avancar(cenarioDaCadeiaDoPao(), 0))
      .map((o) => [o.id, o]));
    expect(daVila.get('mill')?.desbloqueado).toBe(true);
    expect(daVila.get('bakery')?.desbloqueado).toBe(true);

    const semCadeia = cenarioDaCadeiaSemMoinho();
    const semMoinho = new Map(opcoesDoMenuBuild(semCadeia).map((o) => [o.id, o]));
    expect(semMoinho.get('mill')?.desbloqueado).toBe(true);
    expect(semMoinho.get('bakery')?.desbloqueado).toBe(false);
    expect(semMoinho.get('bakery')?.requer).toBe('mill');
  });
});

describe('F19 — evidencia', () => {
  it('grava a serie medida', () => {
    const inicial = cenarioDaCadeiaDoPao();
    const serie: Record<number, Record<string, number>> = {};
    let s = inicial;
    let esperandoInsumo = { m1: 0, b1: 0, f1: 0 };
    for (let t = 1; t <= JANELA; t += 1) {
      s = avancar(s, 1);
      for (const [predio, unidade] of [['m1', 'moleiro'], ['b1', 'forneiro'], ['f1', 'roceiro']] as const) {
        if (fsmDe(s, unidade) === 'esperando_insumo') {
          esperandoInsumo = { ...esperandoInsumo, [predio]: esperandoInsumo[predio] + 1 };
        }
      }
      if (t % (JANELA / 4) === 0) {
        serie[t] = Object.fromEntries([GRAO, FARINHA, PAO].map((m) => [m, desdeOInicio(inicial, s, m)]));
      }
    }
    gravarEvidencia('F19', {
      feature: 'F19-moinho-e-padaria',
      aceite: 'BUILD_PLAN.md F19: medir a cadeia corn -> flour -> loaves antes de implementar',
      medicao: 'a cadeia fecha sem codigo novo; o escopo virou prova, evidencia e o que ela expos',
      derivadoDoDado: {
        elos: { GRAO, FARINHA, PAO },
        ticksDoCiclo: {
          farm: FAZENDA.ticksDoCiclo, mill: MOINHO.ticksDoCiclo, bakery: PADARIA.ticksDoCiclo,
        },
        ticksDePlantio: PLANTIO,
        ticksPorGrao: TICKS_POR_GRAO,
        paesPorGrao: PAES_POR_GRAO,
        arranqueMinimo: ARRANQUE,
        proporcaoDeReferencia: {
          farm_por_mill: PROPORCOES.farm_por_mill,
          mill_por_bakery: PROPORCOES.mill_por_bakery,
          nota: 'lido do JSON cru: o oraculo nao passa pelo carregador, e nenhum sistema o le',
        },
      },
      cadeiaCompleta: {
        janela: JANELA,
        serieDeEntrega: serie,
        tetoDaFonte: Number(tetoDaFonte(JANELA).toFixed(1)),
        ticksEsperandoInsumo: esperandoInsumo,
        fracaoOciosa: Object.fromEntries(
          Object.entries(esperandoInsumo).map(([k, v]) => [k, Number((v / JANELA).toFixed(3))]),
        ),
      },
      semOMoinho: {
        janela: JANELA,
        paesEntregues: desdeOInicio(
          cenarioDaCadeiaSemMoinho(), avancar(cenarioDaCadeiaSemMoinho(), JANELA), PAO,
        ),
      },
    });
    expect(true).toBe(true);
  });
});
