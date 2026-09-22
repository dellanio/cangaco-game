/**
 * F13a — o aceite do BUILD_PLAN, ponta a ponta e sem fixture de ouro na escola:
 * o ouro sai da gaveta `saida` do armazem, atravessa a estrada no ombro de um serf,
 * entra na gaveta `entrada` da escola e e cobrado pelo treino. Nada aqui poe ouro na
 * escola a mao — se o produtor do nivel 2 da escada nao funcionar, este teste para.
 *
 * A estrada vem de fixture (e nao de `PlaceRoad`) pelo mesmo motivo da F12: o comando
 * debita pedra e amarraria o aceite ao preco da estrada, que nao e assunto desta feature.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState, MERCADORIA_DE_OURO } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { filaDaEscola } from '../src/sim/escola';
import { tilesDaPorta } from '../src/sim/estradas';
import {
  armazemPorTipo, avancar, comOuroNoArmazem, escolaDoCenario, novasUnidades,
  ouroNaEscola, pedir, recusasDeTreino, totalDeOuro,
} from './helpers/escola-cenario';
import { comEstradas, linhaH } from './helpers/jobs-cenario';
import { compararComESemSave } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;
const ARMAZEM = armazemPorTipo(inicial).id;
const TICKS = gameData.economia.schoolhouse.ticksPorTreino;
const SLOTS = gameData.economia.schoolhouse.slotsDeFila;
/** A linha de porta dos dois predios: armazem em x 29..31, escola em x 34..36, y=33. */
const RUAS = linhaH(29, 36, 33);
const TRES = ['stonemason', 'woodcutter', 'serf'] as const;
const PEDIDOS = TRES.map((tipo) => pedir(ESCOLA, tipo));

const ouroNoArmazem = (estado: GameState): number => {
  const p = estado.predios.porId[ARMAZEM];
  return p?.estado === 'completo' ? p.estoque.saida[MERCADORIA_DE_OURO] ?? 0 : -1;
};

/** O tick de cada evento `unit-trained`, rodando do zero e observando tick a tick. */
function ticksDeNascimento(inicio: GameState, ticks: number): { readonly fim: GameState; readonly ticks: number[] } {
  let atual = inicio;
  const marcas: number[] = [];
  for (let i = 0; i < ticks; i++) {
    atual = step(atual, []);
    if (atual.events.some((e) => e.type === 'unit-trained')) marcas.push(atual.tick);
  }
  return { fim: atual, ticks: marcas };
}

describe('F13a — aceite headless do BUILD_PLAN', () => {
  it('3 pedidos com 3 de ouro viram 3 civis na porta; o 4o espera sem ouro e sem gasto', () => {
    // 3 de ouro no armazem: exatamente o que os 3 treinos custam, nem uma moeda a mais.
    const cenario = comOuroNoArmazem(comEstradas(inicial, RUAS), ARMAZEM, 3);
    expect(totalDeOuro(cenario)).toBe(3);

    const enfileirado = step(cenario, [...PEDIDOS]);
    expect(filaDaEscola(enfileirado, ESCOLA).map((i) => i.estado))
      .toEqual(['aguardando', 'aguardando', 'aguardando']);
    expect(ouroNoArmazem(enfileirado)).toBe(3); // enfileirar nao cobra nada

    // 3 x (1 tick de cobranca + ticksPorTreino) + as viagens do serf. 1200 e folga.
    const corrida = ticksDeNascimento(enfileirado, 1200);
    const fim = corrida.fim;

    // 1. o ouro saiu do armazem e foi consumido pela escola: zero nos dois predios.
    expect(ouroNoArmazem(fim)).toBe(0);
    expect(ouroNaEscola(fim, ESCOLA)).toBe(0);
    expect(totalDeOuro(fim)).toBe(0);
    expect(filaDaEscola(fim, ESCOLA)).toEqual([]);

    // 2. as tres unidades existem, do tipo pedido e na ordem pedida.
    const novas = novasUnidades(inicial, fim);
    expect(novas.map((u) => u.tipo)).toEqual([...TRES]);

    // 3. nascidas na PORTA DA ESCOLA (D1), nao no `spawnDeUnidades` do cenario inicial.
    const portas = tilesDaPorta(escolaDoCenario(fim)).map((t) => `${t.gx},${t.gy}`);
    const onde = novas.map((u) => `${u.gx},${u.gy}`);
    expect(onde.every((p) => portas.includes(p))).toBe(true);
    const spawn = gameData.economia.estadoInicial.spawnDeUnidades;
    expect(onde).not.toContain(`${spawn.gx},${spawn.gy}`);

    // 4. uma por `ticksPorTreino` — o numero vem do dado, nunca digitado aqui.
    expect(corrida.ticks).toHaveLength(3);
    expect(corrida.ticks[1]! - corrida.ticks[0]!).toBeGreaterThanOrEqual(TICKS);
    expect(corrida.ticks[2]! - corrida.ticks[1]!).toBeGreaterThanOrEqual(TICKS);

    // 5. o quarto pedido, sem ouro no mapa: fica `aguardando` e nunca sai de la.
    const quarto = step(fim, [pedir(ESCOLA, 'baker')]);
    const depois = avancar(quarto, 400);
    expect(filaDaEscola(depois, ESCOLA).map((i) => i.estado)).toEqual(['aguardando']);
    expect(novasUnidades(fim, depois)).toEqual([]);
    expect(totalDeOuro(depois)).toBe(0);

    // 6. recusa de comando de verdade: o teto de slots do dado.
    const estourado = step(depois, Array.from({ length: SLOTS }, () => pedir(ESCOLA, 'serf')));
    const motivos = recusasDeTreino(estourado)
      .map((e) => (e.type === 'command-rejected' ? e.motivo : ''));
    expect(motivos).toContain('fila-cheia');
    expect(filaDaEscola(estourado, ESCOLA)).toHaveLength(SLOTS);

    gravarEvidencia('F13a', {
      feature: 'F13a — Schoolhouse: fila de treino (simulacao)',
      dado: { ticksPorTreino: TICKS, custoOuroPorUnidade: gameData.economia.schoolhouse.custoOuroPorUnidade, slotsDeFila: SLOTS },
      cenario: { estrada: 'linhaH(29,36,33)', ouroNoArmazemNoInicio: 3, pedidos: TRES },
      ouro: {
        armazemNoInicio: ouroNoArmazem(cenario), armazemDepoisDeEnfileirar: ouroNoArmazem(enfileirado),
        armazemNoFim: ouroNoArmazem(fim), escolaNoFim: ouroNaEscola(fim, ESCOLA), totalNoMapaNoFim: totalDeOuro(fim),
      },
      nascimentos: {
        ticks: corrida.ticks,
        intervalos: [corrida.ticks[1]! - corrida.ticks[0]!, corrida.ticks[2]! - corrida.ticks[1]!],
        unidades: novas.map((u) => ({ id: u.id, tipo: u.tipo, gx: u.gx, gy: u.gy, fsm: u.fsm })),
        portasDaEscola: portas,
      },
      quartoPedidoSemOuro: {
        ticksEsperando: 400,
        fila: filaDaEscola(depois, ESCOLA).map((i) => ({ unidade: i.unidade, estado: i.estado })),
        unidadesNovas: novasUnidades(fim, depois).length, ouroGasto: totalDeOuro(fim) - totalDeOuro(depois),
      },
      recusaDeComando: { motivos, filaNoTeto: filaDaEscola(estourado, ESCOLA).length },
    });
  });

  it('determinismo e save/load com a fila em curso', () => {
    const r = compararComESemSave({
      seed: 7,
      totalTicks: 400,
      saveAtTick: 120,
      comandosNoTick: (t) => (t === 5 ? [...PEDIDOS] : []),
      antesDoStep: (e) => (e.tick === 0 ? comOuroNoArmazem(comEstradas(e, RUAS), ARMAZEM, 3) : e),
    });
    expect(r.comSave).toBe(r.direto);
  });

  // Sem isto o teste acima seria vazio: dois estados parados tambem batem byte a byte.
  // Este reproduz o mesmo cenario e mostra que no tick do save (120) ha fila EM CURSO.
  it('no tick do save a fila esta mesmo em curso', () => {
    const montado = comOuroNoArmazem(comEstradas(createInitialState(7), RUAS), ARMAZEM, 3);
    const antes = avancar(montado, 5);
    const noSave = avancar(step(antes, [...PEDIDOS]), 120 - 6);

    expect(noSave.tick).toBe(120);
    expect(filaDaEscola(noSave, ESCOLA).some((i) => i.estado === 'treinando')).toBe(true);
  });
});
