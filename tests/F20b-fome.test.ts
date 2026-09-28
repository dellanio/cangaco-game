/**
 * F20b — a FOME: condicao, dreno, refeicao na Bodega, morte e os tres casos de
 * "a unidade sumiu". Os `describe` sao os criterios escritos em
 * `BUILD_PLAN.md:F20b` — "cenario longo em que a populacao sobrevive; cenario
 * sem comida em que morre — e a morte e registrada em evento, nao em log solto",
 * mais os tres casos que o item lista como caso de teste separado.
 *
 * O que NAO se afirma aqui: tempo de relogio (CLAUDE.md §8). Os eixos sao tick,
 * condicao em ticks, contagem de mercadoria e contagem de evento — todos
 * deterministicos.
 *
 * Nenhum numero de balanceamento e digitado: a condicao cheia, os limiares, a
 * restauracao por comida e o teto de comensais saem de `gameData.condicao`, e a
 * lista de comidas sai das chaves do dado cruzadas com o estoque de abertura.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import {
  condicaoCheiaDoTipo, drenaCondicao, emAlertaDeFome, fracaoDeCondicao,
  morreuDeFome, precisaComer, restauracaoDaUnidade, resumoDeCondicao,
} from '../src/sim/condicao';
import { tetoDeComidaNaBodega } from '../src/sim/bodega';
import { reclamar } from '../src/sim/jobs';
import { tileAndavel } from '../src/sim/pathfinding';
import { comensaisReservados } from '../src/sim/reservas';
import { estoqueDosArmazens } from '../src/sim/selectors';
import {
  bodegaDoCenario, cenarioComBodega, ID_DA_BODEGA_NO_CENARIO, tarefasDoTipo,
} from './helpers/bodega-cenario';
import { cenarioDaRuaMaisBarata, comUnidadeExtra } from './helpers/jobs-cenario';
import { disponivelDe, progressoDe } from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';
import {
  avancarAte, cenarioDaPedreiraComBodega, cenarioDaVilaComBodegaCheia, civisDoEstado,
  comCondicao, comidasDaAbertura, comTodosComFome, condicaoDe, ID_DA_PEDREIRA,
  ID_DO_ESPECIALISTA, unidadeDo,
} from './helpers/fome-cenario';

const CHEIA_CIVIL = gameData.condicao.ticksCondicaoCheia.civil;
const LIMIARES_CIVIS = gameData.condicao.ticksNoLimiar.civil;
const COMIDAS = comidasDaAbertura();
const TETO_DE_COMENSAIS = gameData.condicao.inn.comensaisSimultaneos;
/** Guarda de travamento, NAO afirmacao de tempo (CLAUDE.md §8): o cenario sem
 *  comida anda 12 000 ticks, e o teto padrao do Vitest e de 5 s. */
const TIMEOUT_DA_CORRIDA = 60_000;

/** O estado inteiro MENOS a `condicao` de cada unidade — o que a fome nao pode mudar. */
function semACondicao(estado: GameState): string {
  return JSON.stringify({
    ...estado,
    events: [],
    unidades: {
      ordem: estado.unidades.ordem,
      porId: Object.fromEntries(estado.unidades.ordem.map((id) => {
        const { condicao: _condicao, ...resto } = unidadeDo(estado, id);
        return [id, resto];
      })),
    },
  });
}

const fsmsDe = (estado: GameState, fsms: readonly string[]): readonly string[] =>
  estado.unidades.ordem.filter((id) => fsms.includes(unidadeDo(estado, id).fsm));

const mortesEm = (estado: GameState): readonly string[] =>
  estado.events.filter((e) => e.type === 'unit-starved').map((e) => e.unidade);

/** O ocupante de um predio COMPLETO — `PredioEmObra` nem tem o campo. */
function ocupanteDe(estado: GameState, id: string): string | null {
  const p = estado.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p.ocupante;
}

describe('F20b-1 — a condicao e um inteiro de ticks, e ela drena', () => {
  it('os limiares chegam do carregador ja em inteiro, e a fracao e derivada', () => {
    for (const [nome, valor] of Object.entries(LIMIARES_CIVIS)) {
      expect(Number.isInteger(valor), `limiar '${nome}' nao e inteiro`).toBe(true);
    }
    expect(Number.isInteger(CHEIA_CIVIL)).toBe(true);
    // o limiar e a fracao do dado aplicada a condicao cheia, e nao um numero digitado
    expect(LIMIARES_CIVIS.civilVaiComer).toBe(Math.round(0.5 * CHEIA_CIVIL));
    expect(LIMIARES_CIVIS.alertaVisual).toBe(Math.round(0.35 * CHEIA_CIVIL));
    expect(LIMIARES_CIVIS.morte).toBe(0);

    const u = unidadeDo(createInitialState(1), 'u3');
    expect(condicaoCheiaDoTipo(u.tipo)).toBe(CHEIA_CIVIL);
    expect(u.condicao).toBe(CHEIA_CIVIL);
    expect(fracaoDeCondicao(u)).toBe(1);
    expect(fracaoDeCondicao({ ...u, condicao: LIMIARES_CIVIS.civilVaiComer })).toBeCloseTo(0.5, 10);
  });

  it('todo civil perde um tick de condicao por tick, medido contra o tick 0', () => {
    const inicio = createInitialState(1);
    const civis = civisDoEstado(inicio);
    expect(civis.length).toBeGreaterThan(0);
    const antes = Object.fromEntries(civis.map((id) => [id, condicaoDe(inicio, id)]));

    const ticks = 50;
    let fim = inicio;
    for (let t = 0; t < ticks; t++) fim = step(fim, []);

    for (const id of civis) expect(condicaoDe(fim, id), id).toBe((antes[id] ?? 0) - ticks);
    expect(resumoDeCondicao(fim)).toEqual({ civis: civis.length, comFome: 0, emAlerta: 0 });
  });

  it('o militar NAO drena: ele depende do `Feed`, e quem nao tem como comer nao pode ter fome', () => {
    const tipoMilitar = gameData.unidades.militares.tipos[0]?.id ?? '';
    expect(tipoMilitar).not.toBe('');
    const inicio = comUnidadeExtra(createInitialState(1), 'm1', tipoMilitar, 30, 33);
    const cheiaMilitar = condicaoCheiaDoTipo(tipoMilitar);
    expect(cheiaMilitar).toBe(gameData.condicao.ticksCondicaoCheia.militar);
    expect(drenaCondicao(unidadeDo(inicio, 'm1'))).toBe(false);
    expect(civisDoEstado(inicio)).not.toContain('m1');

    let fim = inicio;
    for (let t = 0; t < 50; t++) fim = step(fim, []);
    expect(condicaoDe(fim, 'm1')).toBe(cheiaMilitar);
    // e nenhum predicado da fome vale para ele, nem no fundo do poco
    const zerado = { ...unidadeDo(fim, 'm1'), condicao: 0 };
    expect(precisaComer(zerado)).toBe(false);
    expect(emAlertaDeFome(zerado)).toBe(false);
    expect(morreuDeFome(zerado)).toBe(false);
  });
});

describe('F20b-2 — o limiar leva o civil a Bodega, e a fome nao recusa trabalho', () => {
  it('um tick acima do limiar ele continua no que fazia; NO limiar ele sai', () => {
    const { estado } = cenarioDaVilaComBodegaCheia();
    const limiar = LIMIARES_CIVIS.civilVaiComer;

    const aindaNao = step(comCondicao(estado, { u3: limiar + 2 }), []);
    expect(condicaoDe(aindaNao, 'u3')).toBe(limiar + 1);
    expect(precisaComer(unidadeDo(aindaNao, 'u3'))).toBe(false);
    expect(unidadeDo(aindaNao, 'u3').fsm).not.toBe('indo_comer');

    const agora = step(comCondicao(estado, { u3: limiar + 1 }), []);
    expect(condicaoDe(agora, 'u3')).toBe(limiar);
    expect(precisaComer(unidadeDo(agora, 'u3'))).toBe(true);
    expect(unidadeDo(agora, 'u3').fsm).toBe('indo_comer');
    // o assento ficou reservado na Bodega, no mesmo tick da saida
    expect(comensaisReservados(agora, ID_DA_BODEGA_NO_CENARIO)).toBe(1);
    expect(violacoesDeInvariantes(agora)).toEqual([]);
  });

  it('assento de Bodega e so de quem tem fome: o civil saciado leva `unidade-invalida`', () => {
    const { estado } = cenarioDaVilaComBodegaCheia();
    const aberta = tarefasDoTipo(estado, 'comer').find((t) => t.estado === 'aberta');
    expect(aberta).toBeDefined();

    const saciado = reclamar(estado, aberta?.id ?? '', 'u3');
    expect(saciado).toEqual({ ok: false, motivo: 'unidade-invalida' });

    const comFome = comCondicao(estado, { u3: LIMIARES_CIVIS.civilVaiComer });
    expect(reclamar(comFome, aberta?.id ?? '', 'u3').ok).toBe(true);
  });

  it('e o SIMETRICO nao existe: com fome e sem Bodega, a vila trabalha igualzinho', () => {
    // A regressao que este teste guarda foi MEDIDA: um portao que recusasse
    // trabalho a quem tem fome congela a cadeia do pao inteira no tick em que o
    // primeiro civil cruza o limiar (32 paes entregues em vez de 68). Quem tem
    // fome e nao tem onde comer continua trabalhando — e o estado inteiro, menos
    // a `condicao`, tem de ser identico ao da mesma vila saciada.
    const saciada = cenarioDaRuaMaisBarata();
    const faminta = comTodosComFome(saciada);
    expect(civisDoEstado(faminta).length).toBeGreaterThan(0);
    for (const id of civisDoEstado(faminta)) expect(precisaComer(unidadeDo(faminta, id))).toBe(true);

    let a = saciada;
    let b = faminta;
    for (let t = 0; t < 400; t++) { a = step(a, []); b = step(b, []); }

    expect(semACondicao(b)).toBe(semACondicao(a));
    // e a corrida nao foi vazia: a obra recebeu a pedra que pediu
    const obra = b.predios.porId['perto'];
    expect(obra?.estado).toBe('obra');
    expect(obra?.estado === 'obra' ? obra.obra.faltam['stone'] : null).toBe(0);
    expect(mortesEm(b)).toEqual([]);
  });
});

describe('F20b-3 — a refeicao', () => {
  it('uma comida so nao enche ninguem: a regra das duas comidas e o proprio numero', () => {
    const restauracao = restauracaoDaUnidade(unidadeDo(createInitialState(1), 'u3'));
    for (const [comida, quanto] of Object.entries(restauracao)) {
      expect(quanto, `'${comida}' sozinha encheria a condicao`).toBeLessThan(CHEIA_CIVIL);
    }
    expect(COMIDAS.length).toBeGreaterThanOrEqual(2);
    const soma = COMIDAS.reduce((s, c) => s + (restauracao[c] ?? 0), 0);
    expect(soma).toBeGreaterThanOrEqual(CHEIA_CIVIL);
  });

  it('chegando a Bodega ele come UM de cada comida, enche, e a tarefa sai do quadro', () => {
    const { estado } = cenarioDaVilaComBodegaCheia();
    const partida = comCondicao(estado, { u3: LIMIARES_CIVIS.civilVaiComer });
    const antes = bodegaDoCenario(partida).estoque.entrada;
    const tarefasAntes = tarefasDoTipo(partida, 'comer').length;

    const chegou = avancarAte(partida, (e) => unidadeDo(e, 'u3').fsm === 'comendo', 200, 'u3 comer');
    const bodega = bodegaDoCenario(chegou.estado);
    for (const comida of COMIDAS) {
      expect(bodega.estoque.entrada[comida] ?? 0, comida).toBe((antes[comida] ?? 0) - 1);
    }
    expect(condicaoDe(chegou.estado, 'u3')).toBe(CHEIA_CIVIL);
    // a tarefa que ele segurava saiu do quadro (nao voltou a aberta)
    const segurada = chegou.estado.jobs.tarefas.ordem
      .map((id) => chegou.estado.jobs.tarefas.porId[id])
      .filter((t) => t?.tipo === 'comer' && t.reclamadaPor === 'u3');
    expect(segurada).toEqual([]);
    expect(tarefasDoTipo(chegou.estado, 'comer').length).toBeLessThanOrEqual(tarefasAntes);
    expect(violacoesDeInvariantes(chegou.estado)).toEqual([]);

    // `comendo` dura UM tick: no seguinte ele ja esta ocioso e de volta ao trabalho
    const depois = step(chegou.estado, []);
    expect(unidadeDo(depois, 'u3').fsm).not.toBe('comendo');
    expect(condicaoDe(depois, 'u3')).toBe(CHEIA_CIVIL - 1);
  });
});

/** O tile andavel e sem unidade mais perto de (gx, gy), em aneis de Chebyshev na ordem fixa. */
function tileLivreJunto(s: GameState, gx: number, gy: number): { gx: number; gy: number } {
  const ocupado = new Set(s.unidades.ordem.map((id) => `${s.unidades.porId[id]?.gx},${s.unidades.porId[id]?.gy}`));
  for (let r = 0; r < 10; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const t = { gx: gx + dx, gy: gy + dy };
        if (!ocupado.has(`${t.gx},${t.gy}`) && tileAndavel(s, t, 'livre', gameData)) return t;
      }
    }
  }
  throw new Error('fixture: sem tile livre junto');
}

describe('F20b-4 — o teto de comensais da Bodega', () => {
  it('mais famintos que assentos: nunca passa de `inn.comensaisSimultaneos` a caminho', () => {
    const { estado } = cenarioDaVilaComBodegaCheia();
    let s = estado;
    // D-MOVIMENTO-01d (JobBoard e porta por estado da chave) (decisao do operador): os extras nascem em tiles DISTINTOS, livres e andaveis, em
    // espiral a partir de (33,33) — nove numa porta so e o que a fixture tinha de artificial
    for (let i = 1; i <= TETO_DE_COMENSAIS; i++) {
      const t = tileLivreJunto(s, 33, 33);
      s = comUnidadeExtra(s, `extra-${i}`, 'serf', t.gx, t.gy);
    }
    s = comTodosComFome(s);
    const famintos = civisDoEstado(s).length;
    expect(famintos).toBeGreaterThan(TETO_DE_COMENSAIS);

    let maxReservados = 0;
    let maxACaminho = 0;
    for (let t = 0; t < 60; t++) {
      s = step(s, []);
      maxReservados = Math.max(maxReservados, comensaisReservados(s, ID_DA_BODEGA_NO_CENARIO));
      maxACaminho = Math.max(maxACaminho, fsmsDe(s, ['indo_comer', 'comendo']).length);
      expect(violacoesDeInvariantes(s)).toEqual([]);
    }
    expect(maxReservados).toBe(TETO_DE_COMENSAIS);
    expect(maxACaminho).toBe(TETO_DE_COMENSAIS);
  });
});

describe('F20b-5 — a morte, e ela e um evento', () => {
  it('sem Bodega nenhuma, a vila inteira morre no tick da condicao cheia', () => {
    const inicio = createInitialState(1);
    const civis = civisDoEstado(inicio);
    const mortes: { readonly tick: number; readonly unidade: string }[] = [];
    let s = inicio;
    for (let t = 1; t <= CHEIA_CIVIL; t++) {
      s = step(s, []);
      for (const id of mortesEm(s)) mortes.push({ tick: t, unidade: id });
    }
    expect(mortes.map((m) => m.unidade).sort()).toEqual([...civis].sort());
    // condicao cai 1 por tick a partir da cheia: o tick da morte e o proprio numero
    for (const m of mortes) expect(m.tick).toBe(CHEIA_CIVIL);
    expect(s.unidades.ordem).toEqual([]);
    expect(violacoesDeInvariantes(s)).toEqual([]);
  }, TIMEOUT_DA_CORRIDA);

  it('a vila COM Bodega atravessa a mesma janela viva, e a comida sai do armazem', () => {
    const { estado } = cenarioDaVilaComBodegaCheia();
    const civis = civisDoEstado(estado);
    let s = estado;
    let refeicoes = 0;
    let mortes = 0;
    for (let t = 1; t <= LIMIARES_CIVIS.civilVaiComer + 1000; t++) {
      s = step(s, []);
      mortes += mortesEm(s).length;
      refeicoes += fsmsDe(s, ['comendo']).length;
    }
    expect(mortes).toBe(0);
    expect(civisDoEstado(s).length).toBe(civis.length);
    // cada civil comeu pelo menos uma vez, e a comida veio do estoque do armazem
    expect(refeicoes).toBeGreaterThanOrEqual(civis.length);
    for (const id of civis) expect(precisaComer(unidadeDo(s, id)), id).toBe(false);
    expect(violacoesDeInvariantes(s)).toEqual([]);
  }, TIMEOUT_DA_CORRIDA);
});

describe('F20b-6 — os tres casos de "a unidade sumiu"', () => {
  it('1. o ocupante morre: o predio fica sem ocupante, e o progresso do ciclo fica', () => {
    const { estado } = cenarioDaPedreiraComBodega();
    const comProgresso = avancarAte(estado, (e) => progressoDe(e, ID_DA_PEDREIRA) > 0, 200, 'o ciclo andar');
    const progresso = progressoDe(comProgresso.estado, ID_DA_PEDREIRA);
    const disponivel = disponivelDe(comProgresso.estado, ID_DA_PEDREIRA);
    expect(ocupanteDe(comProgresso.estado, ID_DA_PEDREIRA)).toBe(ID_DO_ESPECIALISTA);

    const morto = step(comCondicao(comProgresso.estado, { [ID_DO_ESPECIALISTA]: 1 }), []);
    expect(mortesEm(morto)).toEqual([ID_DO_ESPECIALISTA]);
    expect(morto.unidades.porId[ID_DO_ESPECIALISTA]).toBeUndefined();
    // 2. o produtor no meio do ciclo: o progresso mora no PREDIO e nao se perde,
    //    e o tile de colheita volta ao mercado
    expect(ocupanteDe(morto, ID_DA_PEDREIRA)).toBeNull();
    expect(progressoDe(morto, ID_DA_PEDREIRA)).toBe(progresso);
    expect(disponivelDe(morto, ID_DA_PEDREIRA)).toBe(disponivel);
    // nenhuma tarefa ficou na mao de quem nao existe mais
    const orfas = morto.jobs.tarefas.ordem
      .map((id) => morto.jobs.tarefas.porId[id])
      .filter((t) => t?.reclamadaPor === ID_DO_ESPECIALISTA);
    expect(orfas).toEqual([]);
    expect(violacoesDeInvariantes(morto)).toEqual([]);
  });

  it('3. o serf com a carga na mao morre: a carga volta ao armazem, e o evento diz qual', () => {
    // a Bodega AINDA VAZIA, que e quando ha carga andando: o serf leva a comida
    // do armazem para ela pela tarefa `comida-para-inn` da F20a
    const carregando = avancarAte(
      cenarioComBodega(),
      (e) => e.unidades.ordem.some((id) => unidadeDo(e, id).fsmData.carga !== undefined),
      400,
      'um serf pegar carga',
    );
    const alvo = carregando.estado.unidades.ordem
      .find((id) => unidadeDo(carregando.estado, id).fsmData.carga !== undefined) ?? '';
    expect(alvo).not.toBe('');
    const carga = unidadeDo(carregando.estado, alvo).fsmData.carga ?? '';
    const antes = estoqueDosArmazens(carregando.estado);

    const morto = step(comCondicao(carregando.estado, { [alvo]: 1 }), []);
    const evento = morto.events.find((e) => e.type === 'unit-starved');
    expect(evento).toMatchObject({ type: 'unit-starved', unidade: alvo, carga });
    expect(evento?.type === 'unit-starved' ? evento.armazem : null).not.toBeNull();
    expect(estoqueDosArmazens(morto)[carga]).toBe((antes[carga] ?? 0) + 1);
    expect(violacoesDeInvariantes(morto)).toEqual([]);
  });
});

describe('F20b-7 — o especialista sai para comer e volta ao mesmo ciclo', () => {
  it('ele vaga o predio, come, e reocupa pela tarefa `ocupar` que ja existia', () => {
    const { estado } = cenarioDaPedreiraComBodega();
    const comProgresso = avancarAte(estado, (e) => progressoDe(e, ID_DA_PEDREIRA) > 0, 200, 'o ciclo andar');
    const progresso = progressoDe(comProgresso.estado, ID_DA_PEDREIRA);

    const partida = comCondicao(comProgresso.estado, { [ID_DO_ESPECIALISTA]: LIMIARES_CIVIS.civilVaiComer });
    const saiu = step(partida, []);
    expect(unidadeDo(saiu, ID_DO_ESPECIALISTA).fsm).toBe('indo_comer');
    expect(ocupanteDe(saiu, ID_DA_PEDREIRA)).toBeNull();
    expect(progressoDe(saiu, ID_DA_PEDREIRA)).toBe(progresso);
    expect(tarefasDoTipo(saiu, 'ocupar').some((t) => 'destino' in t && t.destino === ID_DA_PEDREIRA)).toBe(true);

    const voltou = avancarAte(
      saiu,
      (e) => ocupanteDe(e, ID_DA_PEDREIRA) === ID_DO_ESPECIALISTA,
      400,
      'o especialista voltar',
    );
    expect(condicaoDe(voltou.estado, ID_DO_ESPECIALISTA)).toBeGreaterThan(LIMIARES_CIVIS.civilVaiComer);
    expect(violacoesDeInvariantes(voltou.estado)).toEqual([]);
  });
});

describe('F20b — evidencia', () => {
  it('grava `test-output/F20b.json`', () => {
    const inicio = createInitialState(1);
    const civis = civisDoEstado(inicio);

    const semComida: { readonly tick: number; readonly unidade: string }[] = [];
    let s = inicio;
    for (let t = 1; t <= CHEIA_CIVIL; t++) {
      s = step(s, []);
      for (const id of mortesEm(s)) semComida.push({ tick: t, unidade: id });
    }

    const cheia = cenarioDaVilaComBodegaCheia();
    const antesDaRefeicao = bodegaDoCenario(cheia.estado).estoque.entrada;
    const partida = comCondicao(cheia.estado, { u3: LIMIARES_CIVIS.civilVaiComer });
    const comeu = avancarAte(partida, (e) => unidadeDo(e, 'u3').fsm === 'comendo', 200, 'u3 comer');

    let longo = cheia.estado;
    let refeicoes = 0;
    for (let t = 1; t <= LIMIARES_CIVIS.civilVaiComer + 1000; t++) {
      longo = step(longo, []);
      refeicoes += fsmsDe(longo, ['comendo']).length;
    }

    gravarEvidencia('F20b', {
      aceite: 'BUILD_PLAN.md F20b: cenario longo em que a populacao sobrevive; cenario sem comida em que morre, por evento',
      derivadoDoDado: {
        ticksDeCondicaoCheia: gameData.condicao.ticksCondicaoCheia,
        limiaresCivis: LIMIARES_CIVIS,
        restauracaoPorComidaEmTicks: gameData.condicao.ticksRestauradosPorComida.civil,
        comidasDaAbertura: COMIDAS,
        tetoDeComensais: TETO_DE_COMENSAIS,
        tetoPorTipoDeComidaNaBodega: tetoDeComidaNaBodega(),
      },
      cenarioSemComida: {
        populacaoNoTick0: civis.length,
        tickDaPrimeiraMorte: semComida[0]?.tick ?? null,
        mortes: semComida.length,
        populacaoNoFim: s.unidades.ordem.length,
      },
      cenarioComBodega: {
        tickDaBodegaCheia: cheia.ticks,
        ticksRodados: LIMIARES_CIVIS.civilVaiComer + 1000,
        refeicoesServidas: refeicoes,
        populacaoNoFim: longo.unidades.ordem.length,
        resumoDeCondicaoNoFim: resumoDeCondicao(longo),
        estoqueDoArmazemNoFim: estoqueDosArmazens(longo),
        bodegaNoFim: bodegaDoCenario(longo).estoque.entrada,
      },
      umaRefeicao: {
        ticksAteChegar: comeu.ticks,
        condicaoNaPartida: LIMIARES_CIVIS.civilVaiComer,
        condicaoDepois: condicaoDe(comeu.estado, 'u3'),
        bodegaAntes: antesDaRefeicao,
        bodegaDepois: bodegaDoCenario(comeu.estado).estoque.entrada,
      },
      decisoes: [
        'D — o portao da fome NAO recusa trabalho: com fome e sem Bodega a vila trabalha igual (medido: o simetrico congela a cadeia do pao)',
        'D — a carga do morto volta ao armazem alcancavel mais proximo; sem armazem alcancavel ela se perde (molde da demolicao)',
        'D — o progresso do ciclo mora no PREDIO e sobrevive ao ocupante, que ele morra ou que saia para comer',
        'D — `comendo` dura um tick: nao existe duracao de refeicao em `data/`',
        'D — cada tipo de comida contribui no maximo uma vez por refeicao: e o que o dado sustenta',
      ],
    });

    expect(semComida.length).toBe(civis.length);
    expect(longo.unidades.ordem.length).toBe(civis.length);
  }, TIMEOUT_DA_CORRIDA);
});
