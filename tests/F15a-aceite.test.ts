/**
 * F15a — o aceite do BUILD_PLAN, ponta a ponta e pelo CAMINHO REAL: a planta da
 * pedreira sai de um `PlaceBlueprint`, a obra e levantada por laborers e serfs,
 * o pedreiro e TREINADO na escola (o ouro atravessa a estrada no ombro de um
 * serf, como na F13a), ocupa a pedreira e produz. Nenhum `PredioCompleto`
 * fabricado por fixture neste primeiro teste.
 *
 * As estradas continuam vindo de fixture: `PlaceRoad` debita pedra e amarraria o
 * aceite ao preco da estrada (mesmo combinado das F09/F13a/F14).
 *
 * As duas clausulas que precisam de dado injetado (serraria sem tronco, veio
 * curto) rodam sobre os cenarios controlados de `producao-cenario.ts` — o
 * criterio pede o caminho real para a PEDREIRA, e uma serraria exigiria
 * desbloquear Woodcutter's antes. A evidencia diz de qual dos dois cada numero
 * veio.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { trabalhadorDoTipo } from '../src/sim/ocupacao';
import { comEstradas, linhaH, tile } from './helpers/jobs-cenario';
import { escolaDoCenario, pedir } from './helpers/escola-cenario';
import {
  avancar, cenarioDePedreira, cenarioDeSerraria, comRendimento, fsmDe, progressoDe, saidaDe, veioDe,
} from './helpers/producao-cenario';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { compararComESemSave } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;
const PEDREIRO = trabalhadorDoTipo('quarry') ?? '';
const QUARRY = { gx: 26, gy: 34 } as const;
/** y=33 liga a porta do armazem a da escola; a perna em x=29 desce ate a porta
 *  da pedreira (28,36). */
const RUAS = [...linhaH(29, 36, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)];
/**
 * 1300, e nao 1000: o ciclo da quarry custa 167 ticks e o teto da gaveta e 5, ou
 * seja 835 ticks SO de producao, depois de treinar (t=179), levantar a obra
 * (t=240) e ocupar (t=281). A corrida medida deposita a 5a pedra no tick 1116, e
 * so no 1283 — quando o ciclo SEGUINTE fica pronto e nao cabe — o pedreiro passa
 * a `saida_cheia`. Ver a correcao registrada no PROGRESS.md da F15a.
 */
const TICKS = 1300;
const TETO_DA_GAVETA = gameData.producao.estoqueInternoPorPredio.saida;
const CICLO = gameData.producao.receitas.quarry?.ticksDoCiclo ?? 0;

function cenario(base: GameState = inicial): GameState {
  return comEstradas(base, RUAS);
}

const comandos = [
  { type: 'PlaceBlueprint', buildingId: 'quarry', gx: QUARRY.gx, gy: QUARRY.gy } as const,
  pedir(ESCOLA, PEDREIRO),
];

function aPedreira(e: GameState): PredioCompleto | null {
  for (const id of e.predios.ordem) {
    const p = e.predios.porId[id];
    if (p?.estado === 'completo' && p.tipo === 'quarry') return p;
  }
  return null;
}

interface Corrida {
  readonly fim: GameState;
  readonly tickDaObra: number;
  readonly tickDaOcupacao: number;
  readonly depositos: number[];
  readonly ociosoDepoisDeOcupar: number;
  readonly esperandoInsumo: number;
  readonly violacoes: { readonly tick: number; readonly texto: string }[];
}

/** Uma corrida do cenario real, guardando o tick de cada marco. */
function rodar(ticks: number): Corrida {
  let e = step(cenario(), comandos);
  let tickDaObra = 0;
  let tickDaOcupacao = 0;
  let ociosoDepoisDeOcupar = 0;
  let esperandoInsumo = 0;
  const depositos: number[] = [];
  const violacoes: { tick: number; texto: string }[] = [];
  for (let i = 0; i < ticks; i++) {
    e = step(e, []);
    for (const ev of e.events) if (ev.type === 'goods-produced') depositos.push(e.tick);
    const p = aPedreira(e);
    if (p !== null && tickDaObra === 0) tickDaObra = e.tick;
    if (p?.ocupante != null && tickDaOcupacao === 0) tickDaOcupacao = e.tick;
    if (tickDaOcupacao > 0) {
      for (const id of e.unidades.ordem) {
        const u = e.unidades.porId[id];
        if (u?.tipo !== PEDREIRO) continue;
        if (u.fsm === 'ocioso') ociosoDepoisDeOcupar += 1;
        if (u.fsm === 'esperando_insumo') esperandoInsumo += 1;
      }
    }
    for (const texto of [...violacoesDaFsmDoEspecialista(e), ...violacoesDeInvariantes(e)]) {
      violacoes.push({ tick: e.tick, texto });
    }
  }
  return { fim: e, tickDaObra, tickDaOcupacao, depositos, ociosoDepoisDeOcupar, esperandoInsumo, violacoes };
}

/** Os intervalos entre depositos consecutivos. Iguais = ritmo constante. */
const intervalos = (ticks: readonly number[]): number[] =>
  ticks.slice(1).map((t, i) => t - (ticks[i] ?? 0));

describe('F15a — aceite headless do BUILD_PLAN', () => {
  it('caminho real: a pedreira deposita em intervalos exatos e iguais, ate o teto da gaveta', () => {
    const r = rodar(TICKS);

    // 1. o caminho inteiro aconteceu: planta -> obra pronta -> pedreiro ocupando
    expect(r.tickDaObra).toBeGreaterThan(0);
    expect(r.tickDaOcupacao).toBeGreaterThan(r.tickDaObra);

    // 2. a gaveta `saida` NAO entope mais: o nivel 6 da escada (F15b) leva a
    //    pedra ao armazem. A premissa "ninguem tira da gaveta", que valia
    //    quando este aceite foi escrito, deixou de valer POR DESENHO — o teto
    //    da gaveta e `saida_cheia` continuam afirmados em
    //    `F15a-producao.test.ts`, sobre o cenario isolado, onde nada escoa.
    //    Medido: a gaveta fica em 1 e a corrida deposita 6 vezes (eram 5, com o
    //    relogio congelado desde o tick 1116).
    const quarry = aPedreira(r.fim);
    expect(quarry?.estoque.saida.stone ?? 0).toBeLessThan(TETO_DA_GAVETA);

    // 3. INTERVALOS EXATOS E IGUAIS, todos do tamanho do ciclo — e agora SEM
    //    buraco nenhum: sem o teto no caminho, o numero de depositos e
    //    exatamente o numero de ciclos completos desde a ocupacao. E a mesma
    //    afirmacao da F15a (ritmo constante), so que mais forte.
    expect(r.depositos).toHaveLength(Math.floor((TICKS - r.tickDaOcupacao) / CICLO));
    expect(intervalos(r.depositos)).toEqual(Array<number>(r.depositos.length - 1).fill(CICLO));
    expect(r.depositos[0]).toBe(r.tickDaOcupacao + CICLO);

    // 4. depois de ocupar, o pedreiro nunca volta a `ocioso` nem espera insumo
    //    (a quarry tira do veio; `ocioso` antes de ocupar e como toda unidade nasce)
    expect(r.ociosoDepoisDeOcupar).toBe(0);
    expect(r.esperandoInsumo).toBe(0);

    // 5. com a gaveta drenando, o pedreiro nunca chega a `saida_cheia`: fica em
    //    `trabalhando` com um ciclo em curso (progresso ENTRE zero e o ciclo —
    //    `CICLO` cheio seria o ciclo pronto e sem lugar, que e justamente o
    //    estado que deixou de acontecer aqui).
    const pedreiro = r.fim.unidades.ordem
      .map((id) => r.fim.unidades.porId[id])
      .find((u) => u?.tipo === PEDREIRO);
    expect(pedreiro?.fsm).toBe('trabalhando');
    expect(quarry?.producao?.progresso ?? 0).toBeLessThan(CICLO);

    // 6. as invariantes dos dois quadros, tick a tick. A UNICA excecao e o tick
    //    em que a obra vira predio: as tarefas de construir ainda apontam para
    //    ela e so sao canceladas no tick seguinte (BUG-001, `feio`, anterior a
    //    esta feature — a F14 nunca cruzou essa transicao porque montava o
    //    predio ja completo). Afirmar a forma exata do transitorio e o que
    //    impede ele de crescer sem ninguem ver.
    const transitorias = r.violacoes.filter((x) => x.tick === r.tickDaObra);
    // nada em nenhum outro tick — inclusive no SEGUINTE, onde o saneamento age
    expect(r.violacoes.filter((x) => x.tick !== r.tickDaObra)).toEqual([]);
    for (const x of transitorias) expect(x.texto).toMatch(/^t\d+: destino '\w+' nao e obra$/);

    // --- as duas clausulas de dado injetado, sobre cenarios controlados ---
    const serraria = avancar(cenarioDeSerraria(), 300);
    const dadosCurtos = comRendimento(gameData, 'quarry', 2);
    const curto = avancar(cenarioDePedreira(dadosCurtos), CICLO * 5, dadosCurtos);
    let esgotados = 0;
    let e = cenarioDePedreira(dadosCurtos);
    for (let i = 0; i < CICLO * 5; i++) {
      e = step(e, [], dadosCurtos);
      esgotados += e.events.filter((ev) => ev.type === 'vein-exhausted').length;
    }
    expect(fsmDe(serraria, 'u2')).toBe('esperando_insumo');
    expect(progressoDe(serraria, 's1')).toBe(0);
    expect(saidaDe(curto, 'q1').stone).toBe(2);
    expect(veioDe(curto, 'q1')).toBe(0);
    expect(esgotados).toBe(1);

    gravarEvidencia('F15a', {
      feature: 'F15a — Producao: o ciclo e o veio',
      aceite: 'cenario de 1300 ticks, caminho real (planta, obra concluida, especialista treinado na escola e ocupando). A pedreira ocupada e ligada por estrada deposita stone na gaveta saida em intervalos exatos e iguais, e o especialista nunca passa por ocioso depois de ocupar. CORRECAO F15b: a clausula "ate o teto da gaveta" caiu porque o nivel 6 da escada passou a escoar a saida — o teto e saida_cheia seguem afirmados em F15a-producao.test.ts, no cenario isolado. Uma serraria sem tronco fica em esperando_insumo sem gastar relogio. Com o veio curto (dado injetado), a producao para e vein-exhausted sai uma vez.',
      dado: {
        ticksDoCicloDaQuarry: CICLO,
        tetoDaGavetaDeSaida: TETO_DA_GAVETA,
        rendimentoDoVeio: gameData.producao.receitas.quarry?.rendimentoDoVeio,
        receitaDaSawmill: gameData.producao.receitas.sawmill,
      },
      caminhoReal: {
        cenario: { estradas: 'linhaH(29,36,33) + perna x=29 ate a porta (28,36)', quarry: QUARRY, escola: ESCOLA },
        comandos: ['PlaceBlueprint quarry (26,34)', `EnqueueTraining ${PEDREIRO}`],
        ticks: TICKS,
        tickDaObraConcluida: r.tickDaObra,
        tickDaOcupacao: r.tickDaOcupacao,
        ticksDeCadaDeposito: r.depositos,
        intervalosEntreDepositos: intervalos(r.depositos),
        stoneNaSaidaNoFim: quarry?.estoque.saida.stone ?? 0,
        _notaF15b: 'a gaveta nao enche mais: o nivel 6 escoa para o armazem',
        progressoNoFim: quarry?.producao?.progresso ?? 0,
        veioNoFim: quarry?.producao?.veio ?? null,
        fsmDoPedreiroNoFim: pedreiro?.fsm,
        ticksEmOciosoDepoisDeOcupar: r.ociosoDepoisDeOcupar,
        ticksEmEsperandoInsumo: r.esperandoInsumo,
      },
      cenariosControlados: {
        _nota: 'fixture, nao caminho real: a sawmill exigiria desbloquear Woodcutter\'s, e o veio curto e dado injetado pelo parametro `dados`',
        serrariaSemTronco: { ticks: 300, fsm: fsmDe(serraria, 'u2'), progresso: progressoDe(serraria, 's1') },
        veioCurto: {
          rendimento: 2, ticks: CICLO * 5, stoneNaSaida: saidaDe(curto, 'q1').stone,
          veio: veioDe(curto, 'q1'), fsm: fsmDe(curto, 'u1'), eventosDeVeioEsgotado: esgotados,
        },
      },
      violacoes: {
        foraDaTransicao: r.violacoes.filter((x) => x.tick !== r.tickDaObra),
        noTickDaObraConcluida: transitorias.map((x) => x.texto), // BUG-001 (feio)
      },
    });
  });

  it('determinismo e save/load com uma producao em curso', () => {
    const r = compararComESemSave({
      seed: 7,
      totalTicks: 600,
      saveAtTick: 500, // ja produzindo: o relogio do ciclo tem que sobreviver ao JSON
      comandosNoTick: (t) => (t === 1 ? comandos : []),
      antesDoStep: (e) => (e.tick === 0 ? cenario(e) : e),
    });
    expect(r.comSave).toBe(r.direto);
  });
});
