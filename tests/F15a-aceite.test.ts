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
import { colisaoCivilLigada } from '../src/sim/colisao';
import { trabalhadorDoTipo } from '../src/sim/ocupacao';
import { comEstradas } from './helpers/jobs-cenario';
import { escolaDoCenario, pedir } from './helpers/escola-cenario';
import {
  avancar, cenarioDePedreira, cenarioDeSerraria, comJazida, comSaida, disponivelDe, fsmDe, progressoDe, saidaDe,
  pedreiraDaVila, rochaDaPedreiraDaVila,
} from './helpers/producao-cenario';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { compararComESemSave } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';
import { linhaHDe, naVila } from './helpers/ancoras';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;
const PEDREIRO = trabalhadorDoTipo('quarry') ?? '';
const QUARRY = pedreiraDaVila(); // (26,34) hoje, ao lado do lajedo
/** y=33 liga a porta do armazem a da escola; a perna em x=29 desce ate a porta
 *  da pedreira (28,36). */
const RUAS = [...linhaHDe(naVila, 0, 7, 3), naVila(0, 4), naVila(0, 5), naVila(0, 6), naVila(-1, 6)];
/**
 * 1300, e nao 1000: o ciclo da quarry custa 167 ticks e o teto da gaveta e 5, ou
 * seja 835 ticks SO de producao, depois de treinar (t=179), levantar a obra
 * (t=240) e ocupar (t=281). A corrida medida deposita a 5a pedra no tick 1116, e
 * so no 1283 — quando o ciclo SEGUINTE fica pronto e nao cabe — o pedreiro passa
 * a `saida_cheia`. Ver a correcao registrada no PROGRESS.md da F15a.
 */
const TICKS = 1300;
const TETO_DA_GAVETA = gameData.producao.estoqueInternoPorPredio.saida;
/** D1a-2 — o valor esperado POR ESTADO DA CHAVE da colisao civil (decisao do operador,
 *  2026-09-28): ligada, a primeira pedra atravessa a vila com fila e chega 4 ticks depois
 *  (medido). NAO e faixa: a faixa foi recusada porque aceitaria deriva futura sem avisar. */
const ATRASO_DA_COLISAO = colisaoCivilLigada(gameData) ? 4 : 0;
const CICLO = gameData.producao.receitas.quarry?.ticksDoCiclo ?? 0;
/**
 * F-T3 — entre um deposito e o seguinte ha agora a IDA ao tile e a VOLTA. O
 * `CICLO` vem do dado; as pernas vem do MAPA, e por isso sao constantes escritas
 * AQUI, no teste: sao propriedade deste cenario, nao numero de balanceamento.
 *
 * O PRIMEIRO ciclo e quatro ticks mais longo que os seguintes, e o motivo esta na
 * trilha: `indo_ocupar` larga o pedreiro na porta (28,36), e a volta do campo o
 * traz para (26,36) — quatro tiles mais perto do tile (25,30) de onde ele colhe.
 * Todos os ciclos seguintes partem de (26,36), e e por isso que sao iguais entre
 * si. O `1 +` de cada soma e o tick da transicao, em que ele ainda esta na porta.
 */
const IDA_DA_PORTA_DA_OCUPACAO = 54;
const IDA = 49;
const VOLTA = 49;
const PRIMEIRO_CICLO = 1 + IDA_DA_PORTA_DA_OCUPACAO + CICLO + VOLTA;
const INTERVALO = 1 + IDA + CICLO + VOLTA;

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
  readonly saidaCheia: number;
  readonly violacoes: { readonly tick: number; readonly texto: string }[];
}

/** Uma corrida do cenario real, guardando o tick de cada marco. */
function rodar(ticks: number): Corrida {
  let e = step(cenario(), comandos);
  let tickDaObra = 0;
  let tickDaOcupacao = 0;
  let ociosoDepoisDeOcupar = 0;
  let esperandoInsumo = 0;
  let saidaCheia = 0;
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
        if (u.fsm === 'saida_cheia') saidaCheia += 1;
      }
    }
    for (const texto of [...violacoesDaFsmDoEspecialista(e), ...violacoesDeInvariantes(e)]) {
      violacoes.push({ tick: e.tick, texto });
    }
  }
  return {
    fim: e, tickDaObra, tickDaOcupacao, depositos, ociosoDepoisDeOcupar, esperandoInsumo, saidaCheia, violacoes,
  };
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
    //    F-T3: o intervalo e `INTERVALO`, nao `CICLO` — a pedra agora atravessa o
    //    mapa duas vezes por ciclo. O RITMO e o que este aceite afirma, e ele
    //    continua exato: intervalos todos iguais, e o primeiro deposito no tick
    //    exato (o `+ 1` e o tick da chegada do pedreiro, em que ele ainda ocupa e
    //    nao produz — o mesmo tick que o aceite sempre contou a parte).
    const primeiro = r.tickDaOcupacao + PRIMEIRO_CICLO;
    expect(r.depositos).toHaveLength(1 + Math.floor((TICKS - primeiro) / INTERVALO));
    expect(intervalos(r.depositos)).toEqual(Array<number>(r.depositos.length - 1).fill(INTERVALO));
    expect(r.depositos[0]).toBe(primeiro + ATRASO_DA_COLISAO);

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
    //    F-T3: no tick 1300 ele esta VOLTANDO do tile com o ciclo pronto na mao —
    //    dai o progresso ser `CICLO` cheio sem que isso seja `saida_cheia`. A
    //    clausula ficou mais estrita de duas maneiras: o estado final e afirmado
    //    EXATO (era "trabalhando", uma entre seis possibilidades hoje) e o
    //    `saida_cheia` passou a ser contado em TODOS os ticks, que e o que a
    //    clausula sempre quis dizer e o `progresso < CICLO` so insinuava.
    // LOTE3-b2: o pedreiro trabalha DENTRO da casa depois do tile (as fases do KaM).
    // Os depositos nao mudaram (549, 815, 1081, medido), e no tick 1300 ele esta na
    // fase da casa: `trabalhando`, com o relogio ja depois do descanso e do tile e
    // antes do ciclo pronto (medido: 121 de 167).
    const colheita = gameData.producao.receitas.quarry?.colheita;
    const fimDoTile = (colheita?.ticksDeDescanso ?? 0) + (colheita?.ticksNoTile ?? 0);
    expect(pedreiro?.fsm).toBe('trabalhando');
    expect(quarry?.producao?.progresso ?? 0).toBeGreaterThan(fimDoTile);
    expect(quarry?.producao?.progresso ?? 0).toBeLessThan(CICLO);
    expect(r.saidaCheia).toBe(0);

    // 6. as invariantes dos dois quadros, tick a tick — agora SEM excecao
    //    nenhuma. Ate a F15b este teste tolerava tres violacoes no tick em que a
    //    obra vira predio (BUG-001, `feio`): as tarefas de construir irmas so
    //    caiam no tick seguinte. O BUG-001 foi corrigido nesta sessao
    //    (`cancelarConstrucoesDe`), entao a tolerancia saiu junto — e o bug
    //    saindo, nao o aceite mudando: o que se exige aqui so aumentou. Medido:
    //    `violacoes.noTickDaObraConcluida` passou de 3 entradas para zero.
    expect(r.violacoes).toEqual([]);
    const transitorias = r.violacoes.filter((x) => x.tick === r.tickDaObra);

    // --- as duas clausulas de dado injetado, sobre cenarios controlados ---
    const serraria = avancar(cenarioDeSerraria(), 300);
    // LOTE3-c: dois lotes de 3 no tile, e a gaveta de 5 so aceita um lote — esvazia a
    // cada tick (o cenario isolado nao tem serf) e soma o que saiu
    const porViagem = gameData.producao.receitas.quarry?.sai.stone ?? 0;
    const dadosCurtos = comJazida(gameData, 'rock', [rochaDaPedreiraDaVila()], 2 * porViagem);
    let esgotados = 0;
    let colhido = 0;
    let e = cenarioDePedreira(dadosCurtos);
    for (let i = 0; i < CICLO * 5; i++) {
      e = step(e, [], dadosCurtos);
      esgotados += e.events.filter((ev) => ev.type === 'vein-exhausted').length;
      colhido += saidaDe(e, 'q1').stone ?? 0;
      e = comSaida(e, 'q1', {});
    }
    const curto = e;
    expect(fsmDe(serraria, 'u2')).toBe('esperando_insumo');
    expect(progressoDe(serraria, 's1')).toBe(0);
    expect(colhido).toBe(2 * porViagem);
    expect(disponivelDe(curto, 'q1', dadosCurtos)).toBe(0);
    expect(esgotados).toBe(1);

    gravarEvidencia('F15a', {
      feature: 'F15a — Producao: o ciclo e o veio',
      aceite: 'cenario de 1300 ticks, caminho real (planta, obra concluida, especialista treinado na escola e ocupando). A pedreira ocupada e ligada por estrada deposita stone na gaveta saida em intervalos exatos e iguais, e o especialista nunca passa por ocioso depois de ocupar. CORRECAO F15b: a clausula "ate o teto da gaveta" caiu porque o nivel 6 da escada passou a escoar a saida — o teto e saida_cheia seguem afirmados em F15a-producao.test.ts, no cenario isolado. Uma serraria sem tronco fica em esperando_insumo sem gastar relogio. Com o veio curto (dado injetado), a producao para e vein-exhausted sai uma vez.',
      dado: {
        ticksDoCicloDaQuarry: CICLO,
        tetoDaGavetaDeSaida: TETO_DA_GAVETA,
        colheitaDaQuarry: gameData.producao.receitas.quarry?.colheita,
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
        _notaFT3: 'desde a F-T3 o pedreiro vai ao tile e volta: o intervalo e 1 + ida + ticksDoCiclo + volta',
        ticksDoCicloMaisViagem: INTERVALO,
        ticksDoPrimeiroCiclo: PRIMEIRO_CICLO,
        ticksEmSaidaCheia: r.saidaCheia,
        stoneNaSaidaNoFim: quarry?.estoque.saida.stone ?? 0,
        _notaF15b: 'a gaveta nao enche mais: o nivel 6 escoa para o armazem',
        progressoNoFim: quarry?.producao?.progresso ?? 0,
        disponivelNoFimAoAlcanceDaQuarry: quarry === null ? null : disponivelDe(r.fim, quarry.id),
        fsmDoPedreiroNoFim: pedreiro?.fsm,
        ticksEmOciosoDepoisDeOcupar: r.ociosoDepoisDeOcupar,
        ticksEmEsperandoInsumo: r.esperandoInsumo,
      },
      cenariosControlados: {
        _nota: 'fixture, nao caminho real: a sawmill exigiria desbloquear Woodcutter\'s, e o veio curto e dado injetado pelo parametro `dados`',
        serrariaSemTronco: { ticks: 300, fsm: fsmDe(serraria, 'u2'), progresso: progressoDe(serraria, 's1') },
        veioCurto: {
          rendimento: 2 * porViagem, ticks: CICLO * 5, colhido,
          disponivel: disponivelDe(curto, 'q1', dadosCurtos), fsm: fsmDe(curto, 'u1'), eventosDeVeioEsgotado: esgotados,
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
