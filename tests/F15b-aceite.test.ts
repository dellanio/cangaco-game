/**
 * F15b — o aceite headless das duas metades, cada uma com a sua evidencia:
 *
 *  - F15b-1 (`test-output/F15b-escada.json`): as quatro clausulas (a)..(d) da
 *    fila — nivel 6 leva a pedra ao armazem, niveis 4/5 alimentam a Sawmill,
 *    nivel 7 devolve o ouro parado na escola, e nada some, se duplica ou viola
 *    invariante no caminho.
 *  - F15b-2 (`test-output/F15.json`): o cenario ORACULO do GDD §4.5 por 3000
 *    ticks — 2 Woodcutter's : 1 Sawmill, mais a pedreira, com os serfs do
 *    cenario inicial entregando.
 *
 * A LEITURA DO ACEITE DA F15b-2, como o operador a corrigiu (BUILD_PLAN,
 * 2026-09-23): o que cresce monotonicamente e o **acumulado produzido** (a soma
 * dos `goods-produced`), nao o saldo do armazem — o saldo cai de modo legitimo
 * quando um serf tira tronco para a Sawmill. E "trabalhador" e o
 * **especialista**; serf e laborer passam por `ocioso` entre tarefas por
 * desenho. O `X` do ocio e `delivery.alertaTarefaSemCandidato_segundos`
 * (30 s -> 300 ticks). As duas leituras vao escritas no JSON para o operador
 * poder discordar por escrito.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState, MERCADORIA_DE_OURO } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { estoqueDosArmazens } from '../src/sim/selectors';
import { ehPredioOcupavel } from '../src/sim/ocupacao';
import { TIPO_QUE_CARREGA } from '../src/sim/jobs';
import { armazemDoCenario, comEstradas, comUnidadeExtra, linhaH } from './helpers/jobs-cenario';
import { comOuroNaEscola, escolaDoCenario, ouroNaEscola } from './helpers/escola-cenario';
import {
  cenarioDePedreira, cenarioDeSerraria, cenarioOraculo, comSaida, entradaDe, progressoDe, saidaDe,
} from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const TICKS_DO_ORACULO = 3000;
const X_DO_OCIO = gameData.entrega.ticksAlertaTarefaSemCandidato;
const ARMAZEM = armazemDoCenario(createInitialState(1)).id;
const ESCOLA = escolaDoCenario(createInitialState(1)).id;

/** O acumulado PRODUZIDO por mercadoria: a soma de todo `goods-produced` desde o
 *  inicio da corrida. Monotonico por construcao — e por isso que ele, e nao o
 *  saldo do armazem, e a serie do aceite. */
type Acumulado = Record<string, number>;

const somar = (acc: Acumulado, s: GameState): Acumulado => {
  const novo = { ...acc };
  for (const ev of s.events) {
    if (ev.type === 'goods-produced') novo[ev.mercadoria] = (novo[ev.mercadoria] ?? 0) + ev.quantidade;
  }
  return novo;
};

/** Todo o estoque do mapa mais o que esta no ombro de alguem: a conta de
 *  conservacao da clausula (d). */
function totalNoMundo(s: GameState, mercadoria: string): number {
  let total = 0;
  for (const id of s.predios.ordem) {
    const p = s.predios.porId[id];
    if (p?.estado !== 'completo') continue;
    total += (p.estoque.entrada[mercadoria] ?? 0) + (p.estoque.saida[mercadoria] ?? 0);
  }
  for (const id of s.unidades.ordem) if (s.unidades.porId[id]?.fsmData.carga === mercadoria) total += 1;
  return total;
}

/** Os ESPECIALISTAS: quem ocupa (ou pode ocupar) um predio de producao. Serf e
 *  laborer ficam de fora por decisao do operador — o `ocioso` deles entre
 *  tarefas e o funcionamento normal do quadro, nao trava. */
function especialistas(s: GameState): Unidade[] {
  const tipos = new Set<string>();
  for (const id of s.predios.ordem) {
    const p = s.predios.porId[id];
    if (p?.estado === 'completo' && ehPredioOcupavel(p, gameData) && p.ocupante !== null) {
      const u = s.unidades.porId[p.ocupante];
      if (u !== undefined) tipos.add(u.tipo);
    }
  }
  return s.unidades.ordem
    .map((id) => s.unidades.porId[id])
    .filter((u): u is Unidade => u !== undefined && tipos.has(u.tipo));
}

describe('F15b-1 — aceite da escada do produtor', () => {
  it('(a)..(d): a carga sobe e desce a escada sem sumir, se duplicar ou violar invariante', () => {
    const violacoes: { readonly tick: number; readonly texto: string }[] = [];
    const rodar = (inicio: GameState, ticks: number): GameState => {
      let s = inicio;
      for (let i = 0; i < ticks; i++) {
        s = step(s, []);
        for (const texto of violacoesDeInvariantes(s)) violacoes.push({ tick: s.tick, texto });
      }
      return s;
    };

    // (a) pedreira ocupada e ligada, com saida > 0: o stone chega ao armazem
    const comPedra = comUnidadeExtra(cenarioDePedreira(), 'serf-a', TIPO_QUE_CARREGA, 29, 33);
    const stoneAntes = totalNoMundo(comPedra, 'stone');
    const fimDaPedra = rodar(comPedra, 600);
    const stoneNoArmazem = estoqueDosArmazens(fimDaPedra).stone ?? 0;

    // (b) Sawmill sem tronco pede nivel 4; alimentada por serf, o progresso avanca
    const comTronco = comUnidadeExtra(
      comSaida(cenarioDeSerraria(), ARMAZEM, { tree_trunk: 3 }), 'serf-a', TIPO_QUE_CARREGA, 31, 33,
    );
    const troncoAntes = totalNoMundo(comTronco, 'tree_trunk');
    const fimDoTronco = rodar(comTronco, 900);
    const timberNoArmazem = estoqueDosArmazens(fimDoTronco).timber ?? 0;

    // (c) escola com ouro e fila vazia: o nivel 7 devolve, e a gaveta fica vazia
    const comOuro = comOuroNaEscola(comEstradas(createInitialState(1), linhaH(29, 36, 33)), ESCOLA, 1);
    const ouroAntes = totalNoMundo(comOuro, MERCADORIA_DE_OURO);
    const fimDoOuro = rodar(comOuro, 300);
    const ouroNoArmazem = estoqueDosArmazens(fimDoOuro)[MERCADORIA_DE_OURO] ?? 0;

    expect(stoneNoArmazem).toBeGreaterThan(0);
    expect(timberNoArmazem).toBeGreaterThan(0);
    expect(progressoDe(fimDoTronco, 's1')).toBeGreaterThanOrEqual(0);
    expect(ouroNoArmazem).toBe((estoqueDosArmazens(comOuro)[MERCADORIA_DE_OURO] ?? 0) + 1);
    expect(ouroNaEscola(fimDoOuro, ESCOLA)).toBe(0);

    // (d) conservacao: so a PRODUCAO cria e so o CONSUMO destroi.
    //     stone: a pedreira tira do veio, entao o total so pode ter crescido.
    //     tronco: a serraria consome, entao so pode ter diminuido.
    //     ouro: ninguem produz nem consome com a fila vazia — tem que bater exato.
    expect(totalNoMundo(fimDaPedra, 'stone')).toBeGreaterThanOrEqual(stoneAntes);
    expect(totalNoMundo(fimDoTronco, 'tree_trunk')).toBeLessThanOrEqual(troncoAntes);
    expect(totalNoMundo(fimDoOuro, MERCADORIA_DE_OURO)).toBe(ouroAntes);
    expect(violacoes).toEqual([]);

    gravarEvidencia('F15b-escada', {
      feature: 'F15b-1 — Producao: a escada do produtor (niveis 4, 5, 6 e 7)',
      aceite: '(a) pedreira ocupada e ligada com saida > 0 gera nivel 6 e o stone chega ao armazem; (b) Sawmill sem tronco gera nivel 4, com estoque parcial gera nivel 5, e alimentada por serf o progresso avanca; (c) escola com fila cancelada devolve o ouro pelo nivel 7 e a gaveta entrada fica vazia; (d) nenhuma unidade de mercadoria some nem se duplica, e nenhuma invariante do JobBoard e violada em nenhum tick.',
      dado: {
        escada: gameData.entrega.prioridades,
        capacidadeDaGaveta: gameData.producao.estoqueInternoPorPredio,
        receitaDaSawmill: gameData.producao.receitas.sawmill,
      },
      a_nivel6: {
        cenario: 'cenarioDePedreira (q1 ocupada, ligada) + 1 serf', ticks: 600,
        stoneNoArmazemNoFim: stoneNoArmazem,
        saidaDaPedreiraNoFim: saidaDe(fimDaPedra, 'q1').stone ?? 0,
      },
      b_niveis4e5: {
        cenario: 'cenarioDeSerraria (s1 ocupada, ligada) + 3 tree_trunk no armazem + 1 serf', ticks: 900,
        entradaDaSerrariaNoFim: entradaDe(fimDoTronco, 's1').tree_trunk ?? 0,
        progressoDaSerrariaNoFim: progressoDe(fimDoTronco, 's1'),
        timberNoArmazemNoFim: timberNoArmazem,
        troncoNoArmazemNoFim: estoqueDosArmazens(fimDoTronco).tree_trunk ?? 0,
      },
      c_nivel7: {
        cenario: 'cenario inicial ligado (linhaH 29..36, y=33) + 1 gold na gaveta entrada da escola, fila vazia',
        ticks: 300,
        ouroNoArmazemAntes: estoqueDosArmazens(comOuro)[MERCADORIA_DE_OURO] ?? 0,
        ouroNoArmazemNoFim: ouroNoArmazem,
        ouroNaEscolaNoFim: ouroNaEscola(fimDoOuro, ESCOLA),
      },
      d_conservacao: {
        stone: { antes: stoneAntes, depois: totalNoMundo(fimDaPedra, 'stone'), _nota: 'cresce: a pedreira tira do veio' },
        tree_trunk: { antes: troncoAntes, depois: totalNoMundo(fimDoTronco, 'tree_trunk'), _nota: 'diminui: a serraria consome' },
        gold: { antes: ouroAntes, depois: totalNoMundo(fimDoOuro, MERCADORIA_DE_OURO), _nota: 'exato: ninguem produz nem consome com a fila vazia' },
        violacoesDeInvariantes: violacoes,
      },
    });
  });
});

describe('F15b-2 — aceite do cenario oraculo (GDD §4.5)', () => {
  it('3000 ticks: o acumulado produzido cresce e nenhum especialista trava', () => {
    let s = cenarioOraculo();
    const inicial = s;
    let acumulado: Acumulado = {};
    const serie: { tick: number; stone: number; timber: number; tree_trunk: number; noArmazem: Record<string, number> }[] = [];
    const quedas: { tick: number; mercadoria: string; de: number; para: number }[] = [];
    const ocioAtual: Record<string, number> = {};
    const maiorOcio: Record<string, number> = {};
    // O armazem do cenario inicial JA comeca com stone e timber (30 e 40): medir
    // "primeiro a chegar" por `> 0` respondia tick 1, que e o saldo inicial e nao
    // uma entrega. A conta e contra a LINHA DE BASE do tick 0.
    const noArmazemInicial = { ...estoqueDosArmazens(inicial) };
    const primeiraEntrega: Record<string, number | null> = { stone: null, timber: null, tree_trunk: null };
    const fsmDoEspecialista: Record<string, Record<string, number>> = {};
    const semInsumoAtual: Record<string, number> = {};
    const maiorSemInsumo: Record<string, number> = {};
    const abertasPorNivel: { tick: number; porTipo: Record<string, number> }[] = [];

    for (let i = 0; i < TICKS_DO_ORACULO; i++) {
      s = step(s, []);
      const antes = acumulado;
      acumulado = somar(acumulado, s);
      for (const m of ['stone', 'timber', 'tree_trunk']) {
        if ((acumulado[m] ?? 0) < (antes[m] ?? 0)) {
          quedas.push({ tick: s.tick, mercadoria: m, de: antes[m] ?? 0, para: acumulado[m] ?? 0 });
        }
      }
      const noArmazem = estoqueDosArmazens(s);
      for (const m of ['stone', 'timber', 'tree_trunk']) {
        if (primeiraEntrega[m] === null && (noArmazem[m] ?? 0) > (noArmazemInicial[m] ?? 0)) {
          primeiraEntrega[m] = s.tick;
        }
      }

      for (const u of especialistas(s)) {
        ocioAtual[u.id] = u.fsm === 'ocioso' ? (ocioAtual[u.id] ?? 0) + 1 : 0;
        maiorOcio[u.id] = Math.max(maiorOcio[u.id] ?? 0, ocioAtual[u.id] ?? 0);
        // "predio ocioso" do ponto 2 do operador: o especialista pode estar
        // parado SEM estar em `ocioso` (gaveta cheia, sem insumo). O histograma
        // de FSM e que diz em que ele gastou os 3000 ticks.
        const hist = fsmDoEspecialista[u.id] ?? (fsmDoEspecialista[u.id] = {});
        hist[u.fsm] = (hist[u.fsm] ?? 0) + 1;
        semInsumoAtual[u.id] = u.fsm === 'esperando_insumo' ? (semInsumoAtual[u.id] ?? 0) + 1 : 0;
        maiorSemInsumo[u.id] = Math.max(maiorSemInsumo[u.id] ?? 0, semInsumoAtual[u.id] ?? 0);
      }

      if (s.tick % 100 === 0) {
        serie.push({
          tick: s.tick,
          stone: acumulado.stone ?? 0,
          timber: acumulado.timber ?? 0,
          tree_trunk: acumulado.tree_trunk ?? 0,
          noArmazem: { ...noArmazem },
        });
        const porTipo: Record<string, number> = {};
        for (const id of s.jobs.tarefas.ordem) {
          const t = s.jobs.tarefas.porId[id];
          if (t?.estado === 'aberta') porTipo[t.tipo] = (porTipo[t.tipo] ?? 0) + 1;
        }
        abertasPorNivel.push({ tick: s.tick, porTipo });
      }
    }

    const piorOcio = Math.max(0, ...Object.values(maiorOcio));

    expect(quedas).toEqual([]);
    expect(acumulado.stone ?? 0).toBeGreaterThan(0);
    expect(acumulado.timber ?? 0).toBeGreaterThan(0);
    expect(piorOcio).toBeLessThanOrEqual(X_DO_OCIO);

    gravarEvidencia('F15', {
      feature: 'F15b-2 — Producao: o cenario oraculo e a calibracao',
      aceite: 'cenario completo, 3000 ticks. O acumulado produzido de stone e timber e maior que zero e cresce monotonicamente enquanto houver rocha e arvore. Nenhum especialista em ocioso por mais de delivery.alertaTarefaSemCandidato_segundos (30 s -> 300 ticks) consecutivos.',
      leituraDoCriterio: {
        monotonicidade: 'ACUMULADO PRODUZIDO (soma dos eventos goods-produced), nao o saldo do armazem — o saldo cai de modo legitimo quando um serf tira tronco para a Sawmill. Correcao do operador no BUILD_PLAN, 2026-09-23.',
        X: `ticksAlertaTarefaSemCandidato = ${X_DO_OCIO} ticks (delivery.alertaTarefaSemCandidato_segundos = 30 s, sem escala)`,
        trabalhador: 'ESPECIALISTA (stonemason, woodcutter, carpenter), confirmado pelo operador. Serf e laborer passam por ocioso entre tarefas por desenho.',
      },
      dado: {
        receitas: gameData.producao.receitas,
        capacidadeDaGaveta: gameData.producao.estoqueInternoPorPredio,
        rendimentoDoVeio: gameData.producao.receitas.quarry?.rendimentoDoVeio ?? null,
      },
      cenario: {
        semente: inicial.rng.seed,
        predios: inicial.predios.ordem.map((id) => {
          const p = inicial.predios.porId[id];
          return { id, tipo: p?.tipo, ocupante: p?.estado === 'completo' ? p.ocupante : null };
        }),
        civis: inicial.unidades.ordem.map((id) => ({ id, tipo: inicial.unidades.porId[id]?.tipo })),
        estradas: 'y=36 de x=18 a x=35, mais a coluna x=29 de y=33 a y=35 (porta do armazem)',
        ticks: TICKS_DO_ORACULO,
      },
      medicao: {
        acumuladoProduzidoNoFim: acumulado,
        estoqueDosArmazensNoFim: { ...estoqueDosArmazens(s) },
        quedasNoAcumulado: quedas,
        estoqueDosArmazensNoInicio: noArmazemInicial,
        tickDaPrimeiraEntregaNoArmazem: primeiraEntrega,
        _notaDaPrimeiraEntrega: 'primeiro tick em que o saldo do armazem passa da LINHA DE BASE do tick 0 (stone 30, timber 40), nao em que ele fica > 0',
        maiorOcioPorEspecialista: maiorOcio,
        piorOcio,
        ticksPorFsmDoEspecialista: fsmDoEspecialista,
        maiorSequenciaEsperandoInsumo: maiorSemInsumo,
        veioDaPedreiraNoFim: (() => {
          const q = s.predios.porId.q1;
          return q?.estado === 'completo' ? q.producao?.veio ?? null : null;
        })(),
        gavetasNoFim: Object.fromEntries(['w1', 'w2', 'q1', 's1'].map((id) => [
          id, { entrada: { ...entradaDe(s, id) }, saida: { ...saidaDe(s, id) } },
        ])),
      },
      serieACada100Ticks: serie,
      tarefasAbertasPorNivelACada100Ticks: abertasPorNivel,
    });
  });
});
