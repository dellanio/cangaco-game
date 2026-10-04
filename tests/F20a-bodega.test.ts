/**
 * F20a — A Bodega recebe comida.
 *
 * O nivel 1 da escada de `delivery.json` (`comida-para-inn`) e o unico que nunca
 * teve implementacao: o id esta no dado desde a F03 e nao havia gerador, tipo de
 * tarefa nem leitor. Estes seis `describe` sao os seis critérios do item
 * `BUILD_PLAN.md:F20a`.
 *
 * O que NAO se afirma aqui: tempo de relogio (CLAUDE.md §8). Os eixos sao tick,
 * contagem de mercadoria e ordem de `tarefasEmOrdem` — todos deterministicos.
 *
 * Todo numero vem do dado: o teto de `condition.json:inn.estoquePorTipoDeComida`,
 * a lista de comidas das chaves de `restauracaoPorComida`, o nivel e o modo de
 * `delivery.json`. Nenhum id de comida e digitado — nem `loaves`, nem `sausages`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, gavetaDeOrigem, ID_DA_BODEGA, MERCADORIA_DE_OURO, ORIGEM_ESPERADA_POR_TIPO } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import {
  comidaNecessaria, comidasConhecidas, ehBodegaCompleta, ehComida, tetoDeComidaNaBodega,
} from '../src/sim/bodega';
import { alvoDeEntrada, excedenteNaEntrada } from '../src/sim/insumo';
import {
  elegivelParaTarefa, importanciaDoTipo, modoDoTipo, tarefasEmOrdem, TIPO_QUE_CARREGA, TIPO_QUE_CONSTROI,
} from '../src/sim/jobs';
import { estoqueDosArmazens } from '../src/sim/selectors';
import {
  avancar, bodegaDoCenario, bodegaSeExistir, cenarioComBodega, ID_DA_BODEGA_NO_CENARIO,
  plantaDaBodega, rodarAberturaDaBodega, tarefasDoTipo, contarPorMercadoria,
} from './helpers/bodega-cenario';
import { armazemDoCenario, comObra, comEstradas, tile } from './helpers/jobs-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';
import { comEscolasAbastecidas } from './helpers/escola-cenario';

const COMIDAS = comidasConhecidas();
const TETO = tetoDeComidaNaBodega();
const BASE_DO_ARMAZEM = estoqueDosArmazens(createInitialState(1));
/** As comidas que a abertura tem no armazem — derivado, nunca digitado. */
const COMIDAS_DA_ABERTURA = COMIDAS.filter((c) => (BASE_DO_ARMAZEM[c] ?? 0) > 0);
/** As comidas que o jogo declara e nao produz nem estoca em lugar nenhum. */
const COMIDAS_SEM_FONTE = COMIDAS.filter((c) => (BASE_DO_ARMAZEM[c] ?? 0) === 0);

/** Soma de `mercadoria` no mundo inteiro: as duas gavetas de todo predio, mais o
 *  que estiver na mao de uma unidade. E o que a conservacao de bens compara. */
function totalNoMundo(estado: GameState, mercadoria: string): number {
  let total = 0;
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (!p || p.estado !== 'completo') continue;
    total += (p.estoque.entrada[mercadoria] ?? 0) + (p.estoque.saida[mercadoria] ?? 0);
  }
  for (const id of estado.unidades.ordem) {
    if (estado.unidades.porId[id]?.fsmData.carga === mercadoria) total += 1;
  }
  return total;
}

// A corrida do caminho real roda uma vez e serve a tres `describe`.
let corrida: ReturnType<typeof rodarAberturaDaBodega> | null = null;
const doCaminhoReal = (): ReturnType<typeof rodarAberturaDaBodega> => {
  corrida ??= rodarAberturaDaBodega(3000, TETO, COMIDAS);
  return corrida;
};

describe('F20a-1 — o tipo novo entra na escada e nas tabelas exaustivas', () => {
  it('a classe e a 2, abaixo so da escola, e o modo vem do dado', () => {
    // D-TRANSPORTE-03 T1: D2 (o ouro da escola primeiro, diHigh1 do KaM) tirou a Bodega do
    // topo; D1 a mantem acima da tropa e da obra
    expect(importanciaDoTipo('comida-para-inn')).toBe(2);
    expect(importanciaDoTipo('comida-para-inn')).toBeGreaterThan(importanciaDoTipo('ouro-para-escola'));
    expect(importanciaDoTipo('comida-para-inn')).toBeLessThan(importanciaDoTipo('comida-para-tropa'));
    expect(importanciaDoTipo('comida-para-inn')).toBeLessThan(importanciaDoTipo('material-para-obra'));
    expect(modoDoTipo('comida-para-inn')).toBe('estrada');
    // a classe nao esta digitada em `.ts`: e o que `delivery.json` publica
    const doDado = gameData.entrega.prioridades.find((p) => p.id === 'comida-para-inn');
    expect(importanciaDoTipo('comida-para-inn')).toBe(doDado?.importancia);
  });

  it('so o serf carrega comida, e a carga sai da gaveta `saida` do armazem', () => {
    expect(elegivelParaTarefa('comida-para-inn', TIPO_QUE_CARREGA)).toBe(true);
    expect(elegivelParaTarefa('comida-para-inn', TIPO_QUE_CONSTROI)).toBe(false);
    expect(gavetaDeOrigem('comida-para-inn')).toBe('saida');
    expect(ORIGEM_ESPERADA_POR_TIPO['comida-para-inn']).toBe('armazem');
  });
});

describe('F20a-2 — a demanda da Bodega e derivada do dado, nao digitada', () => {
  it('o teto e a lista de comidas vem de condition.json', () => {
    expect(COMIDAS.length).toBeGreaterThan(1);
    expect(COMIDAS).toEqual(Object.keys(gameData.condicao.restauracaoPorComida));
    expect(TETO).toBe(gameData.condicao.inn.estoquePorTipoDeComida);
    for (const comida of COMIDAS) expect(ehComida(comida)).toBe(true);
    expect(ehComida(MERCADORIA_DE_OURO)).toBe(false);
  });

  it('a Bodega vazia pede o teto de CADA comida, e zero de tudo o mais', () => {
    const estado = cenarioComBodega();
    const bodega = bodegaDoCenario(estado);
    expect(ehBodegaCompleta(bodega)).toBe(true);
    // a Bodega nao tem receita, e por isso nasce SEM teto de gaveta: o limite dela
    // nao poderia vir de `capacidade` nem se alguem quisesse.
    expect(bodega.capacidade.entrada).toBeNull();
    for (const comida of COMIDAS) {
      expect(comidaNecessaria(estado, bodega.id, comida)).toBe(TETO);
      expect(alvoDeEntrada(estado, bodega.id, comida)).toBe(TETO);
    }
    const naoComida = gameData.economia.mercadorias.filter((m) => !ehComida(m));
    expect(naoComida.length).toBeGreaterThan(0);
    for (const outra of [MERCADORIA_DE_OURO, ...naoComida]) {
      expect(comidaNecessaria(estado, bodega.id, outra)).toBe(0);
      expect(alvoDeEntrada(estado, bodega.id, outra)).toBe(0);
    }
  });

  it('cheia, a Bodega nao pede mais nada — e o que passar do teto volta ao armazem', () => {
    const estado = cenarioComBodega();
    const bodega = bodegaDoCenario(estado);
    const comida = COMIDAS_DA_ABERTURA[0] as string;
    const cheia: GameState = {
      ...estado,
      predios: {
        ...estado.predios,
        porId: {
          ...estado.predios.porId,
          [bodega.id]: { ...bodega, estoque: { ...bodega.estoque, entrada: { [comida]: TETO + 2 } } },
        },
      },
    };
    expect(comidaNecessaria(cheia, bodega.id, comida)).toBe(0);
    // o nivel 7 sai de graca do mesmo alvo: o excedente volta para o armazem
    expect(excedenteNaEntrada(cheia, bodega.id, comida)).toBe(2);
  });
});

describe('F20a-3 — o gerador do nivel 1', () => {
  it('a Bodega vazia e ligada gera TETO tarefas de cada comida QUE O ARMAZEM TEM', () => {
    const t1 = avancar(cenarioComBodega(), 1);
    const daBodega = tarefasDoTipo(t1, 'comida-para-inn');
    const esperado = Object.fromEntries(COMIDAS_DA_ABERTURA.map((c) => [c, TETO]));
    expect(contarPorMercadoria(daBodega)).toEqual(esperado);
    expect(daBodega).toHaveLength(TETO * COMIDAS_DA_ABERTURA.length);
  });

  it('comida que o jogo declara e nao produz nao gera tarefa nem espera', () => {
    // `wine` e `fish` estao em `restauracaoPorComida` e nao existem em armazem
    // nenhum: a tarefa so nasce com origem que OFEREÇA, e por isso ninguem fica
    // esperando o que nao chega.
    expect(COMIDAS_SEM_FONTE.length).toBeGreaterThan(0);
    const t1 = avancar(cenarioComBodega(), 1);
    for (const t of tarefasDoTipo(t1, 'comida-para-inn')) {
      expect(COMIDAS_SEM_FONTE).not.toContain('mercadoria' in t ? t.mercadoria : '');
    }
  });

  it('nao duplica: com as tarefas abertas no quadro, o tick seguinte nao cria mais', () => {
    const t1 = avancar(cenarioComBodega(), 1);
    const quantas = tarefasDoTipo(t1, 'comida-para-inn').length;
    const t2 = step(t1, []);
    expect(tarefasDoTipo(t2, 'comida-para-inn').length).toBeLessThanOrEqual(quantas);
  });

  it('sem estrada ate a Bodega, nenhuma tarefa nasce — e nada trava', () => {
    const semRua = avancar(cenarioComBodega({ comRua: false }), 20);
    expect(tarefasDoTipo(semRua, 'comida-para-inn')).toHaveLength(0);
    expect(violacoesDeInvariantes(semRua)).toEqual([]);
  });
});

describe('F20a-4 — pelo caminho real, do estado inicial e so por comando', () => {
  it('a Bodega sobe por PlaceBlueprint e recebe o teto de cada comida da abertura', () => {
    const r = doCaminhoReal();
    const bodega = bodegaDoCenario(r.fim);
    expect(r.tickCompleta).not.toBeNull();
    expect(COMIDAS_DA_ABERTURA.length).toBeGreaterThan(1);
    for (const comida of COMIDAS_DA_ABERTURA) {
      expect(bodega.estoque.entrada[comida]).toBe(TETO);
      // conservacao: o armazem perdeu exatamente o que a Bodega ganhou
      const noArmazem = estoqueDosArmazens(r.fim)[comida] ?? 0;
      expect((BASE_DO_ARMAZEM[comida] ?? 0) - noArmazem).toBe(TETO);
      expect(totalNoMundo(r.fim, comida)).toBe(BASE_DO_ARMAZEM[comida] ?? 0);
    }
  });

  it('e PARA: cheia, nenhuma tarefa de nivel 1 sobra aberta, e nada passa do teto', () => {
    const r = doCaminhoReal();
    expect(tarefasDoTipo(r.fim, 'comida-para-inn')).toHaveLength(0);
    const bodega = bodegaDoCenario(r.fim);
    for (const comida of COMIDAS) {
      expect(bodega.estoque.entrada[comida] ?? 0).toBeLessThanOrEqual(TETO);
    }
    expect(violacoesDeInvariantes(r.fim)).toEqual([]);
  });

  it('cada comida chegou ao teto DEPOIS de a Bodega ficar completa', () => {
    const r = doCaminhoReal();
    const completa = r.tickCompleta as number;
    for (const comida of COMIDAS_DA_ABERTURA) {
      expect(r.tickNoTeto[comida]).toBeGreaterThan(completa);
    }
  });
});

describe('F20a-5 — a prioridade 1 e obedecida', () => {
  it('com obra pedindo material e Bodega vazia, a comida vem primeiro', () => {
    // I-TRANSPORTE-OURO-SEMPRE-NA-ESCOLA: a escola inicial ja abastecida (o regime depois da cota), para o ouro (classe 1) nao passar na frente do que o teste mede
    const base = comEscolasAbastecidas(cenarioComBodega());
    const planta = plantaDaBodega(createInitialState(1));
    // uma obra nivelada pedindo material, ligada pela mesma rua
    const comObraA = comObra(base, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2, timber: 3 } });
    const ligada = comEstradas(comObraA, [tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)]);
    const t1 = avancar(ligada, 1);
    const abertas = tarefasEmOrdem(t1);
    expect(abertas.some((t) => t.tipo === 'material-para-obra')).toBe(true);
    expect(abertas[0]?.tipo).toBe('comida-para-inn');
    // e o serf ocioso pega essa: o primeiro da fila DELE e do mesmo tipo
    const serf = t1.unidades.ordem
      .map((id) => t1.unidades.porId[id])
      .find((u) => u?.tipo === TIPO_QUE_CARREGA);
    expect(tarefasEmOrdem(t1, serf?.id ?? null)[0]?.tipo).toBe('comida-para-inn');
    expect(planta.armazem).toBe(armazemDoCenario(base).id);
  });
});

describe('F20a-6 — Bodega demolida com serf em rota devolve reserva e carga', () => {
  it('a tarefa sai do quadro, as invariantes ficam limpas e nada se perde', () => {
    let estado = cenarioComBodega();
    const comida = COMIDAS_DA_ABERTURA[0] as string;
    const total = totalNoMundo(estado, comida);
    // roda ate um serf estar com comida na mao, a caminho da Bodega
    let comCarga: string | null = null;
    for (let i = 0; i < 400 && comCarga === null; i++) {
      estado = step(estado, []);
      for (const id of estado.unidades.ordem) {
        const u = estado.unidades.porId[id];
        // `indo_entregar` e o serf com a comida na mao, ANDANDO: e ai que a
        // demolicao tem de achar a carga, e nao no tick da entrega.
        if (u?.fsmData.carga === comida && u.fsm === 'indo_entregar') comCarga = id;
      }
    }
    expect(comCarga).not.toBeNull();

    estado = step(estado, [{ type: 'DemolishBuilding', predio: ID_DA_BODEGA_NO_CENARIO }]);
    expect(bodegaSeExistir(estado)).toBeUndefined();
    estado = avancar(estado, 60);
    expect(tarefasDoTipo(estado, 'comida-para-inn')).toHaveLength(0);
    expect(violacoesDeInvariantes(estado)).toEqual([]);
    // a carga voltou ao armazem: o total no mundo nao mudou
    expect(totalNoMundo(estado, comida)).toBe(total);
  });
});

describe('F20a — evidencia', () => {
  it('grava test-output/F20a.json', () => {
    const r = doCaminhoReal();
    const bodega = bodegaDoCenario(r.fim);
    const t1 = avancar(cenarioComBodega(), 1);
    const semRua = avancar(cenarioComBodega({ comRua: false }), 20);
    gravarEvidencia('F20a', {
      feature: 'F20a-bodega-recebe-comida',
      aceite: 'BUILD_PLAN.md F20a: a Bodega pede comida ao armazem pelo nivel 1 da escada',
      derivadoDoDado: {
        idDaBodega: ID_DA_BODEGA,
        importancia: importanciaDoTipo('comida-para-inn'),
        modo: modoDoTipo('comida-para-inn'),
        comidas: COMIDAS,
        tetoPorTipoDeComida: TETO,
        comidasDaAbertura: COMIDAS_DA_ABERTURA,
        comidasSemFonte: COMIDAS_SEM_FONTE,
      },
      linhaDeBaseDoTick0: { armazens: BASE_DO_ARMAZEM },
      caminhoReal: {
        planta: { gx: r.planta.gx, gy: r.planta.gy, tilesDeRua: r.planta.rua.length },
        tickDaBodegaCompleta: r.tickCompleta,
        tickNoTetoPorComida: r.tickNoTeto,
        entradaDaBodegaNoFim: bodega.estoque.entrada,
        armazensNoFim: estoqueDosArmazens(r.fim),
        tarefasDeNivel1NoFim: tarefasDoTipo(r.fim, 'comida-para-inn').length,
      },
      cenarioMontado: {
        tarefasNoTick1: contarPorMercadoria(tarefasDoTipo(t1, 'comida-para-inn')),
        semEstrada: {
          tarefasDeNivel1: tarefasDoTipo(semRua, 'comida-para-inn').length,
          violacoes: violacoesDeInvariantes(semRua).length,
        },
      },
    });
    expect(r.tickCompleta).not.toBeNull();
  });
});
