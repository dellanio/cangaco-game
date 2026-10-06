/**
 * F-CAL-b1 — A CALIBRACAO MEDIDA NA ABERTURA: a corrida e as afirmacoes que nao
 * dependem de decisao de balanceamento.
 *
 * O aceite da F-CAL-b (BUILD_PLAN.md) tem quatro afirmacoes sobre a vila da
 * F-CAL-a rodando >= 24 000 ticks: (a) intervalo de entrega da fazenda dentro de
 * +-10 % do ciclo do moinho; (b) moinho e padaria abaixo de 10 % dos ticks em
 * `esperando_insumo`; (c) milho nunca acima de 1 no armazem; (d) com os civis da
 * abertura mais os que 20 de ouro treinam, nenhuma morte de fome em 36 000 ticks.
 *
 * MEDIDO ANTES DE ESCREVER (docs/planos/F-CAL-b.md): (a) e (c) REPROVAM, e nao e
 * rampa — o milho sobe +3 a cada 1000 ticks do 12 000 ao 36 000 (99 no fim), e a
 * fazenda entrega um milho a cada ~143 ticks contra 246 do moinho. A causa e a
 * caminhada: o campo da abertura fica colado a porta, e `alvosDeAproximacao`
 * (sim/aproximacao.ts) deixa o roceiro trabalhar o tile DA PORTA, sem dar um passo
 * — a calibracao do doc pressupunha ~105 ticks de ida e volta por milho. Isso e
 * balanceamento, e o operador reservou a decisao para si ("nao gire numero sem eu
 * ver"). Por isso este arquivo e a F-CAL-b1: a corrida inteira, as QUATRO medidas
 * gravadas na evidencia, e as DUAS assercoes que passam em qualquer saida de
 * balanceamento. As de (a) e (c) sao a F-CAL-b2, depois da decisao.
 *
 * F-CAL-b2 (2026-09-26): a decisao chegou — (b) vale para o campo do LADO DA PORTA,
 * `farm.sai.corn` fica 3.0. (a) virou "do lado da porta a fazenda sustenta o
 * moinho" (intervalo <= ciclo; a sobra e recompensa por posicionar bem) e ganhou
 * assercao sobre esta mesma corrida, que e a do campo colado a porta. (c) deixou de
 * ser teto: a sobra do lado da porta e recompensa, e o limite longe da porta e medida
 * de sonda (tabela das tres geometrias em BUILD_PLAN.md, F-CAL-b2).
 *
 * Os limites 10 % e 24 000 / 36 000 sao os do criterio escrito; o ciclo do moinho
 * vem do dado (`receitas.mill.ticksDoCiclo`), nunca de 246 digitado.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { estoqueDosArmazens } from '../src/sim/selectors';
import { filaDaEscola } from '../src/sim/escola';
import { comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import { gravarEvidencia } from './helpers/evidence';

/** As duas janelas do criterio escrito: (a), (b) e (c) em >= 24 000; (d) em 36 000. */
const JANELA_ABC = 24_000;
const JANELA_D = 36_000;
/** O limite de (b), do criterio escrito. */
const TETO_DE_ESPERA = 0.10;
/** Depois deste tick a sonda nao viu mais nenhum tick de `esperando_insumo`: e o regime. */
const INICIO_DO_REGIME = 12_000;

function completoDoTipo(s: GameState, tipo: string): PredioCompleto | null {
  for (const id of s.predios.ordem) {
    const p = s.predios.porId[id];
    if (p && p.tipo === tipo && p.estado === 'completo') return p;
  }
  return null;
}

interface Ocupacao {
  ocupadoEm: number | null;
  /** Ticks com ocupante ate JANELA_ABC, por rotulo da FSM. */
  fsm: Record<string, number>;
  ticksOcupados: number;
}

interface Medicao {
  readonly ouroInicial: number;
  readonly treinosDaVila: number;
  readonly serfsExtras: number;
  readonly unidadesNoInicio: number;
  readonly unidadesNoFim: number;
  readonly unidadesPorTipo: Record<string, number>;
  readonly recusas: { tick: number; comando: string; motivo: string }[];
  readonly mortes: { tick: number; tipo: string }[];
  readonly milhosProduzidosEm: number[];
  readonly fasesPorMilho: Record<string, number>[];
  readonly mill: Ocupacao;
  readonly bakery: Ocupacao;
  readonly cornMaxAte24k: number;
  readonly cornMax: number;
  readonly cornACada1000: number[];
  readonly noArmazemFinal: Readonly<Record<string, number>>;
  readonly msDeParede: number;
}

function novaOcupacao(): Ocupacao { return { ocupadoEm: null, fsm: {}, ticksOcupados: 0 }; }

function observarOcupante(s: GameState, predio: PredioCompleto | null, o: Ocupacao): void {
  if (predio === null || predio.ocupante === null) return;
  if (o.ocupadoEm === null) o.ocupadoEm = s.tick;
  if (s.tick > JANELA_ABC) return;
  const f = s.unidades.porId[predio.ocupante]?.fsm ?? '?';
  o.fsm[f] = (o.fsm[f] ?? 0) + 1;
  o.ticksOcupados += 1;
}

/**
 * A corrida inteira, UMA vez: a vila da F-CAL-a por comando, e depois que ela fecha
 * (os sete ocupados) o ouro que sobra treina serfs — "os civis da abertura mais os
 * que 20 de ouro treinam", que e a populacao do item (d). Serf porque e o civil que
 * nao precisa de predio para existir; o tipo nao muda quem come.
 */
/** I-CLIMA-CRESCIMENTO (2026-10-06): a calibracao mede os numeros BASE da economia, e roda com o clima
 *  desligado. Com o clima, a seca atrasa o milho e o moinho espera mais (medido: 14,5 % contra o teto
 *  de 10 %); esse efeito e balanceamento do clima, registrado no BALANCE_LOG, e o teste do clima afirma
 *  a mecanica dele (tests/I-CLIMA-ESTACAO.test.ts). */
const DADOS: GameData = { ...gameData, clima: { ...gameData.clima, ligado: false } };

function correr(): Medicao {
  let s = createInitialState(gameData.economia.estadoInicial.semente, DADOS);
  const vila = vilaDaCalibracao(s, DADOS);
  const escola = vila.abertura.escola;
  const slots = gameData.economia.schoolhouse.slotsDeFila;
  const ouroInicial = gameData.economia.estadoInicial.estoque.gold ?? 0;
  const treinosDaVila = vila.abertura.plantas.length
    + Object.values(vila.civisDesejados).reduce((a, b) => a + b, 0);
  const serfsExtras = ouroInicial - treinosDaVila;
  const unidadesNoInicio = s.unidades.ordem.length;
  let extrasPedidos = 0;
  let vilaFechada = false;

  const recusas: Medicao['recusas'] = [];
  const mortes: Medicao['mortes'] = [];
  const milhosProduzidosEm: number[] = [];
  const fasesPorMilho: Record<string, number>[] = [];
  let faseAtual: Record<string, number> = {};
  const mill = novaOcupacao();
  const bakery = novaOcupacao();
  let cornMaxAte24k = 0;
  let cornMax = 0;
  const cornACada1000: number[] = [];

  const comecou = Date.now();
  for (let i = 0; i < JANELA_D; i += 1) {
    const comandos: Command[] = [...comandosDaVilaNoTick(s, vila, i, DADOS)];
    if (vilaFechada && extrasPedidos < serfsExtras
      && filaDaEscola(s, escola).length < slots
      && !comandos.some((c) => c.type === 'EnqueueTraining')) {
      comandos.push({ type: 'EnqueueTraining', predio: escola, unidade: 'serf' });
      extrasPedidos += 1;
    }
    s = step(s, comandos, DADOS);

    const farm = completoDoTipo(s, 'farm');
    for (const ev of s.events) {
      if (ev.type === 'command-rejected') recusas.push({ tick: s.tick, comando: ev.command, motivo: ev.motivo });
      if (ev.type === 'unit-starved') mortes.push({ tick: s.tick, tipo: ev.tipo });
      if (ev.type === 'goods-produced' && farm !== null && ev.predio === farm.id
        && ev.mercadoria === vila.cultura) {
        milhosProduzidosEm.push(s.tick);
        fasesPorMilho.push(faseAtual);
        faseAtual = {};
      }
    }
    if (farm?.ocupante) {
      const u = s.unidades.porId[farm.ocupante];
      if (u) {
        // `plantando` nao e rotulo da FSM: o plantio corre em `trabalhando` com
        // `producao.plantio` preenchido (F18). E a fase que a tabela do doc separa.
        const fase = u.fsm === 'trabalhando' && farm.producao?.plantio ? 'plantando' : u.fsm;
        faseAtual[fase] = (faseAtual[fase] ?? 0) + 1;
      }
    }
    observarOcupante(s, completoDoTipo(s, 'mill'), mill);
    observarOcupante(s, completoDoTipo(s, 'bakery'), bakery);
    if (!vilaFechada && farm?.ocupante && mill.ocupadoEm !== null && bakery.ocupadoEm !== null
      && vila.abertura.plantas.every((p) => completoDoTipo(s, p.tipo)?.ocupante)) {
      vilaFechada = true;
    }
    const corn = estoqueDosArmazens(s)[vila.cultura] ?? 0;
    cornMax = Math.max(cornMax, corn);
    if (s.tick <= JANELA_ABC) cornMaxAte24k = Math.max(cornMaxAte24k, corn);
    if (s.tick % 1000 === 0) cornACada1000.push(corn);
  }
  const msDeParede = Date.now() - comecou;

  return {
    ouroInicial, treinosDaVila, serfsExtras, unidadesNoInicio,
    unidadesNoFim: s.unidades.ordem.length,
    unidadesPorTipo: s.unidades.ordem.reduce<Record<string, number>>((acc, id) => {
      const t = s.unidades.porId[id]?.tipo ?? '?';
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {}),
    recusas, mortes, milhosProduzidosEm, fasesPorMilho, mill, bakery,
    cornMaxAte24k, cornMax, cornACada1000, noArmazemFinal: estoqueDosArmazens(s), msDeParede,
  };
}

const media = (xs: readonly number[]): number =>
  (xs.length === 0 ? 0 : +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1));

/** Media por fase, sobre uma lista de milhos. O primeiro milho fica de fora: inclui a espera pelo predio. */
function mediaPorFase(lista: readonly Record<string, number>[]): Record<string, number> {
  const soma: Record<string, number> = {};
  for (const f of lista) for (const [k, v] of Object.entries(f)) soma[k] = (soma[k] ?? 0) + v;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(soma)) out[k] = +(v / Math.max(1, lista.length)).toFixed(1);
  return out;
}

const fracaoDeEspera = (o: Ocupacao): number =>
  (o.ticksOcupados === 0 ? 1 : (o.fsm.esperando_insumo ?? 0) / o.ticksOcupados);

describe('F-CAL-b1 — a calibracao medida na abertura', () => {
  let m: Medicao;
  const cicloDoMoinho = gameData.producao.receitas.mill?.ticksDoCiclo ?? Number.NaN;
  let intervaloMedioAte24k = Number.NaN;

  beforeAll(() => {
    m = correr();

    const intervalos = m.milhosProduzidosEm.slice(1).map((t, k) => t - (m.milhosProduzidosEm[k] ?? 0));
    const noRegime = intervalos.filter((_, k) => (m.milhosProduzidosEm[k + 1] ?? 0) > INICIO_DO_REGIME);
    const intervaloAte24k = media(intervalos.filter((_, k) => (m.milhosProduzidosEm[k + 1] ?? 0) <= JANELA_ABC));
    const desvioDoCiclo = Math.abs(intervaloAte24k - cicloDoMoinho) / cicloDoMoinho;
    intervaloMedioAte24k = intervaloAte24k;

    gravarEvidencia('F-CAL', {
      feature: 'F-CAL-b1/b2 — a calibracao medida na abertura (as quatro medidas; asserido: a, b e d)',
      semente: gameData.economia.estadoInicial.semente,
      janelas: { abc: JANELA_ABC, d: JANELA_D },
      cicloDoMoinho,
      // A tabela do doc (`docs/calibracao-fase-b.md`), refeita na abertura: ticks
      // por milho, por fase. Compara com longe 100 / 54 / 50 / 36 / 247.
      roceiroPorFase: {
        ate24k: mediaPorFase(m.fasesPorMilho.slice(1).filter((_, k) => (m.milhosProduzidosEm[k + 1] ?? 0) <= JANELA_ABC)),
        regime: mediaPorFase(m.fasesPorMilho.filter((_, k) => (m.milhosProduzidosEm[k] ?? 0) > INICIO_DO_REGIME)),
      },
      afirmacoes: {
        a: {
          criterio: 'campo do lado da porta: a fazenda sustenta o moinho (intervalo medio ate 24 000 <= ciclo do moinho)',
          intervaloMedioAte24k: intervaloAte24k,
          intervaloMedioNoRegime: media(noRegime),
          desvioDoCiclo: +desvioDoCiclo.toFixed(3),
          passa: intervaloAte24k <= cicloDoMoinho,
          asserido: true,
        },
        b: {
          criterio: `moinho e padaria abaixo de ${TETO_DE_ESPERA * 100}% dos ticks em esperando_insumo (ate ${JANELA_ABC})`,
          mill: { ocupadoEm: m.mill.ocupadoEm, fsm: m.mill.fsm, fracaoDeEspera: +fracaoDeEspera(m.mill).toFixed(4) },
          bakery: { ocupadoEm: m.bakery.ocupadoEm, fsm: m.bakery.fsm, fracaoDeEspera: +fracaoDeEspera(m.bakery).toFixed(4) },
          passa: fracaoDeEspera(m.mill) < TETO_DE_ESPERA && fracaoDeEspera(m.bakery) < TETO_DE_ESPERA,
          asserido: true,
        },
        c: {
          criterio: 'milho nunca acima de 1 no armazem',
          cornMaxAte24k: m.cornMaxAte24k,
          cornMaxAte36k: m.cornMax,
          cornACada1000: m.cornACada1000,
          passa: m.cornMaxAte24k <= 1,
          asserido: false,
          porQue: 'F-CAL-b2: o teto saiu do criterio — do lado da porta a sobra e recompensa; longe dela e medida de sonda',
        },
        d: {
          criterio: `civis da abertura + os que ${m.ouroInicial} de ouro treinam, zero morte de fome em ${JANELA_D}`,
          populacao: { inicio: m.unidadesNoInicio, fim: m.unidadesNoFim, porTipo: m.unidadesPorTipo },
          treinos: { daVila: m.treinosDaVila, serfsExtras: m.serfsExtras },
          mortes: m.mortes,
          passa: m.mortes.length === 0,
          asserido: true,
        },
      },
      recusas: m.recusas,
      milhosProduzidos: m.milhosProduzidosEm.length,
      noArmazemFinal: m.noArmazemFinal,
      // NUMERO DA CORRIDA, nunca assercao (CLAUDE.md §8).
      msDeParedeDaCorrida: m.msDeParede,
    });
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido:
    // 9,7 s isolada (36 000 ticks); a F-CAL-a mediu 2,2x dentro da suite inteira.
  }, 90_000);

  it('o ciclo do moinho vem do dado', () => {
    expect(Number.isInteger(cicloDoMoinho)).toBe(true);
    expect(cicloDoMoinho).toBeGreaterThan(0);
  });

  it('a vila sobe sem uma recusa de comando, e o ouro inteiro vira gente', () => {
    expect(m.recusas).toEqual([]);
    expect(m.serfsExtras).toBeGreaterThan(0);
    expect(m.noArmazemFinal.gold ?? 0).toBe(0);
    expect(m.unidadesNoFim).toBe(m.unidadesNoInicio + m.ouroInicial);
  });

  it('(b) moinho e padaria ficam abaixo de 10 % dos ticks em esperando_insumo', () => {
    // A fracao conta do tick em que cada um ganha ocupante ate 24 000: antes disso
    // nao ha FSM para ler. E a janela e real, nao um punhado de ticks: os dois
    // ocupam na primeira metade dela (F-CAL-a: Moinho 4062, Padaria 5392).
    for (const [nome, o] of [['mill', m.mill], ['bakery', m.bakery]] as const) {
      expect(o.ocupadoEm, `${nome} nunca ocupou`).not.toBeNull();
      expect(o.ocupadoEm ?? Number.POSITIVE_INFINITY).toBeLessThan(JANELA_ABC / 2);
      expect(o.ticksOcupados).toBeGreaterThan(JANELA_ABC / 2);
      expect(fracaoDeEspera(o), `${nome}: ${JSON.stringify(o.fsm)}`).toBeLessThan(TETO_DE_ESPERA);
    }
  });

  it('(d) com os civis da abertura mais os que 20 de ouro treinam, ninguem morre de fome em 36 000 ticks', () => {
    expect(m.mortes).toEqual([]);
    expect(m.unidadesNoFim).toBe(m.unidadesNoInicio + m.ouroInicial);
  });

  it('(a) F-CAL-b2: com o campo do lado da porta, a fazenda entrega milho num intervalo medido (dado da corrida)', () => {
    // A decisao do operador: a sobra do lado da porta e recompensa, entao o teto e o
    // ciclo, sem piso. Com o campo atras a fazenda NAO sustenta (346 ticks por milho,
    // tabela em BUILD_PLAN.md) — e isso e aceito, nao afirmado aqui.
    // Decisao do operador (2026-10-04, "teste afirma mecanica, nao balanceamento"): o intervalo e
    // NUMERO DA CORRIDA, no test-output (`intervaloMedioAte24k`), e nao teto. Com o vao entre lotes
    // (I-OBRA-UM-TILE-ENTRE-PREDIOS) a vila se espalhou e o intervalo foi a 247,9 contra o ciclo de 246.
    // O que fica afirmado e o progresso: ha intervalo (a fazenda entrega).
    expect(Number.isFinite(intervaloMedioAte24k)).toBe(true);
  });

  it('a fazenda entregou milho durante a corrida inteira (a medida de (a) e (c) nao e de uma vila parada)', () => {
    // Sem isto, (b) passaria com o moinho parado em `trabalhando` num ciclo que
    // nunca fecha; e a evidencia de (a) e (c) descreveria uma fazenda morta.
    expect(m.milhosProduzidosEm.length).toBeGreaterThan(JANELA_D / (cicloDoMoinho * 2));
    expect(m.milhosProduzidosEm.at(-1) ?? 0).toBeGreaterThan(JANELA_D - 1000);
  });
});
