/**
 * BUG-Y (viagem inutil para comer) — a Bodega GARANTE a refeicao de quem sai para ela.
 *
 * Emenda da D5 da F20b (fome e morte), opcao (A) aprovada pelo operador: a D5 reservava
 * o assento; passa a garantir uma refeicao via `refeicoesGarantidas`. A D7 (cada tipo no
 * maximo uma vez por refeicao) faz de `max(quantidade de cada tipo)` um piso de refeicoes
 * que a prateleira serve, qualquer que seja a mistura. O gerador nao abre mais assentos
 * que esse piso, e o `claim` recusa quando os comensais a caminho ja o cobrem.
 *
 * Os aceites sao os do plano `docs/planos/2026-10-01-BUG-Y-viagem-inutil-para-comer.md`,
 * secao 5. O aceite 1 (a sonda que separa as causas) rodou antes do codigo: 13 de 13
 * viagens perdidas eram prateleira vazia na chegada (PROGRESS, 2026-09-30).
 *
 * Eixos deterministicos: contagem de tarefa reclamada, de transicao de FSM e de refeicao.
 */
import { describe, expect, it, vi } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import * as bodegaReal from '../src/sim/bodega';
import { comidasNaBodega, ehBodegaCompleta, refeicoesGarantidas } from '../src/sim/bodega';
import { precisaComer } from '../src/sim/condicao';
import { gerarTarefas } from '../src/sim/systems/jobs';
import { reclamar } from '../src/sim/jobs';
import { tileAndavel } from '../src/sim/pathfinding';
import { comensaisReservados } from '../src/sim/reservas';
import { bodegaDoCenario, ID_DA_BODEGA_NO_CENARIO, tarefasDoTipo } from './helpers/bodega-cenario';
import { comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import {
  cenarioDaPedreiraComBodega, cenarioDaVilaComBodegaCheia, civisDoEstado, comCondicao,
  comidasDaAbertura, comTodosComFome, ID_DA_PEDREIRA, ID_DO_ESPECIALISTA, unidadeDo,
} from './helpers/fome-cenario';
import { comUnidadeExtra } from './helpers/jobs-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { comProdutorOcupado, pedreiraDaVila } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

/**
 * Aceite 5, a guarda ESTRUTURAL: o gerador e o claim leem o MESMO `refeicoesGarantidas`
 * de `sim/bodega`. O modulo e trocado por um que devolve o original, a menos que o teste
 * force um valor; forcado 0 com comida na gaveta, quem nao importasse a funcao abriria
 * assento ou aprovaria o claim, e o teste acusa.
 */
const forcado = vi.hoisted(() => ({ valor: null as number | null }));
vi.mock('../src/sim/bodega', async (importOriginal) => {
  const original = await importOriginal<typeof bodegaReal>();
  return {
    ...original,
    refeicoesGarantidas: (...args: Parameters<typeof original.refeicoesGarantidas>) =>
      forcado.valor ?? original.refeicoesGarantidas(...args),
  };
});

const ASSENTOS = gameData.condicao.inn.comensaisSimultaneos;
const LIMIAR = gameData.condicao.ticksNoLimiar.civil.civilVaiComer;
const COMIDAS = comidasDaAbertura();
/** Guarda de travamento, NAO afirmacao de tempo (CLAUDE.md §8): 20 000 ticks da vila. */
const TIMEOUT_DA_CORRIDA = 60_000;
/** As refeicoes da vila da calibracao em 20 000 ticks ANTES do conserto (plano, secao 3). */
const REFEICOES_DA_BASE = 37;

/** A gaveta de comida da Bodega do cenario trocada por `gaveta` (o resto zera). */
function comGaveta(estado: GameState, gaveta: Readonly<Record<string, number>>): GameState {
  const bodega = bodegaDoCenario(estado);
  const entrada: Record<string, number> = { ...bodega.estoque.entrada };
  for (const c of COMIDAS) entrada[c] = gaveta[c] ?? 0;
  const nova: PredioCompleto = { ...bodega, estoque: { ...bodega.estoque, entrada } };
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [bodega.id]: nova } } };
}

function ocupanteDe(estado: GameState, id: string): string | null {
  const p = estado.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p.ocupante;
}

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

const evidencia: Record<string, unknown> = {};

describe('BUG-Y — refeicoesGarantidas', () => {
  it('e o maximo por tipo da gaveta, e zero para Bodega vazia', () => {
    expect(COMIDAS.length).toBeGreaterThanOrEqual(2);
    const [a, b] = COMIDAS as [string, string];
    const { estado } = cenarioDaVilaComBodegaCheia();
    expect(refeicoesGarantidas(comGaveta(estado, { [a]: 3, [b]: 1 }), ID_DA_BODEGA_NO_CENARIO)).toBe(3);
    expect(refeicoesGarantidas(comGaveta(estado, { [a]: 1 }), ID_DA_BODEGA_NO_CENARIO)).toBe(1);
    expect(refeicoesGarantidas(comGaveta(estado, {}), ID_DA_BODEGA_NO_CENARIO)).toBe(0);
  });
});

describe('BUG-Y aceite 2 — uma broa, dois especialistas com fome: so um sai', () => {
  it('o segundo continua ocupante, e quem saiu come ao chegar', () => {
    const { estado } = cenarioDaPedreiraComBodega();
    const OUTRA = { gx: pedreiraDaVila().gx - 4, gy: pedreiraDaVila().gy }; // colada a oeste da q1, relativa
    let s = comProdutorOcupado(estado, { tipo: 'quarry', id: 'q2', unidade: 'esp2', ...OUTRA }, gameData);
    s = comGaveta(s, { [COMIDAS[0] as string]: 1 });
    s = comCondicao(s, { [ID_DO_ESPECIALISTA]: LIMIAR + 1, esp2: LIMIAR + 1 });

    // guarda do cenario: os dois cruzam o limiar NO MESMO tick
    const pedem = step(s, []);
    expect(precisaComer(unidadeDo(pedem, ID_DO_ESPECIALISTA), gameData)).toBe(true);
    expect(precisaComer(unidadeDo(pedem, 'esp2'), gameData)).toBe(true);

    const saiam = [ID_DO_ESPECIALISTA, 'esp2'].filter((id) => unidadeDo(pedem, id).fsm === 'indo_comer');
    expect(saiam).toHaveLength(1);
    const ficou = [ID_DO_ESPECIALISTA, 'esp2'].find((id) => !saiam.includes(id)) as string;
    const casaDoQueFicou = ficou === ID_DO_ESPECIALISTA ? ID_DA_PEDREIRA : 'q2';
    expect(ocupanteDe(pedem, casaDoQueFicou)).toBe(ficou);
    expect(comensaisReservados(pedem, ID_DA_BODEGA_NO_CENARIO)).toBe(1);

    // quem saiu chega e COME: a viagem nao foi inutil
    let atual = pedem;
    let comeu = false;
    for (let t = 0; t < 400 && !comeu; t += 1) {
      atual = step(atual, []);
      expect(violacoesDeInvariantes(atual)).toEqual([]);
      comeu = unidadeDo(atual, saiam[0] as string).fsm === 'comendo';
      if (!comeu) expect(unidadeDo(atual, saiam[0] as string).fsm).toBe('indo_comer');
    }
    expect(comeu).toBe(true);
    evidencia['aceite2'] = { saiu: saiam[0], ficou, ocupanteMantido: casaDoQueFicou };
  });
});

describe('BUG-Y aceite 3 — o piso da D7', () => {
  it('3 de uma comida e 1 de outra aceitam 3 comensais a caminho, nao 4 nem 2', () => {
    const [a, b] = COMIDAS as [string, string];
    const { estado } = cenarioDaVilaComBodegaCheia();
    let s = comGaveta(estado, { [a]: 3, [b]: 1 });
    for (let i = 1; i <= 4; i += 1) {
      const t = tileLivreJunto(s, bodegaDoCenario(s).gx, bodegaDoCenario(s).gy);
      s = comUnidadeExtra(s, `extra-${i}`, 'serf', t.gx, t.gy);
    }
    s = comTodosComFome(s);
    expect(civisDoEstado(s).length).toBeGreaterThan(4);
    expect(ASSENTOS).toBeGreaterThan(4); // o assento nao e o que limita aqui

    let maxReservados = 0;
    for (let t = 0; t < 30; t += 1) {
      s = step(s, []);
      maxReservados = Math.max(maxReservados, comensaisReservados(s, ID_DA_BODEGA_NO_CENARIO));
      expect(comensaisReservados(s, ID_DA_BODEGA_NO_CENARIO))
        .toBeLessThanOrEqual(Math.max(0, refeicoesGarantidas(s, ID_DA_BODEGA_NO_CENARIO)));
      expect(violacoesDeInvariantes(s)).toEqual([]);
    }
    expect(maxReservados).toBe(3);
    evidencia['aceite3'] = { gaveta: { [a]: 3, [b]: 1 }, maxReservados };
  });
});

describe('BUG-Y aceite 4 — a vila da calibracao, 20 000 ticks', () => {
  it('zero chegadas com a prateleira vazia, e refeicoes >= a base', () => {
    let s = createInitialState(gameData.economia.estadoInicial.semente);
    const vila = vilaDaCalibracao(s);
    let refeicoes = 0;
    let saidasSemComer = 0;
    let chegadasComPrateleiraVazia = 0;
    for (let i = 0; i < 20_000; i += 1) {
      const antes = s;
      s = step(s, comandosDaVilaNoTick(s, vila, i));
      for (const id of antes.unidades.ordem) {
        const a = antes.unidades.porId[id];
        if (a?.fsm !== 'indo_comer') continue;
        const d = s.unidades.porId[id];
        if (d?.fsm === 'indo_comer') continue;
        if (d?.fsm === 'comendo') { refeicoes += 1; continue; }
        saidasSemComer += 1;
        const t = antes.jobs.tarefas.porId[a.fsmData.tarefa ?? ''];
        const destino = t !== undefined && 'destino' in t ? t.destino : '';
        if (ehBodegaCompleta(s.predios.porId[destino]) && comidasNaBodega(s, destino).length === 0) {
          chegadasComPrateleiraVazia += 1;
        }
      }
    }
    evidencia['aceite4'] = { ticks: 20_000, refeicoes, saidasSemComer, chegadasComPrateleiraVazia, refeicoesDaBase: REFEICOES_DA_BASE };
    expect(chegadasComPrateleiraVazia).toBe(0);
    expect(refeicoes).toBeGreaterThanOrEqual(REFEICOES_DA_BASE);
  }, TIMEOUT_DA_CORRIDA);
});

describe('BUG-Y aceite 5 — o gerador e o claim leem o mesmo refeicoesGarantidas', () => {
  it('forcado a 0 com comida na gaveta: o gerador nao abre assento, e o claim recusa', () => {
    const { estado } = cenarioDaVilaComBodegaCheia();
    expect(comidasNaBodega(estado, ID_DA_BODEGA_NO_CENARIO).length).toBeGreaterThan(0);
    const semTarefas: GameState = {
      ...estado,
      jobs: {
        ...estado.jobs,
        tarefas: {
          porId: Object.fromEntries(Object.entries(estado.jobs.tarefas.porId).filter(([, t]) => t.tipo !== 'comer')),
          ordem: estado.jobs.tarefas.ordem.filter((id) => estado.jobs.tarefas.porId[id]?.tipo !== 'comer'),
        },
      },
    };
    const comFome = comTodosComFome(semTarefas);
    const faminto = civisDoEstado(comFome)[0] as string;

    // sem forcar: o gerador abre assentos, e o claim aprova
    const livre = gerarTarefas(comFome);
    const aberta = tarefasDoTipo(livre, 'comer')[0];
    expect(aberta).toBeDefined();
    expect(reclamar(livre, aberta?.id ?? '', faminto).ok).toBe(true);

    forcado.valor = 0;
    try {
      expect(tarefasDoTipo(gerarTarefas(comFome), 'comer')).toHaveLength(0);
      const r = reclamar(livre, aberta?.id ?? '', faminto);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toBe('destino-sem-trabalho');
    } finally {
      forcado.valor = null;
    }
  });
});

describe('BUG-Y — evidencia', () => {
  it('grava `test-output/BUG-Y.json`', () => {
    gravarEvidencia('BUG-Y', { assentos: ASSENTOS, ...evidencia });
  });
});
