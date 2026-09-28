/**
 * F-T3, aceite 3 — SALVAR COM O PEDREIRO A CAMINHO.
 *
 * A F-T3 nao inventou campo nenhum no `GameState`: os tres estados de campo usam
 * `fsmData.caminho` e `fsmData.progresso`, que a F10 ja serializava. Mas isso e
 * argumento, e argumento nao e evidencia — quem responde e o round-trip por JSON
 * no pior tick possivel: o pedreiro FORA do predio, no meio de um passo, com um
 * caminho pela metade na mao e uma tarefa de colheita reclamada.
 *
 * Sao dois testes, e o segundo existe para o primeiro nao mentir. Salvar com ele
 * parado na porta tambem daria `iguais: true` — e nao teria exercitado nada. O
 * segundo afirma, sobre o MESMO tick, que ali ha caminho pendente, passo em
 * curso e distancia do footprint.
 *
 * Este arquivo grava tambem a evidencia consolidada da feature
 * (`test-output/F-T3.json`): os tres aceites num lugar so, medidos aqui.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState, PredioCompleto, Unidade } from '../src/sim/state';
import { ehTarefaDeColheita } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { alertasDoEstado, painelDoPredio } from '../src/sim/selectors';
import { chaveDeTile } from '../src/sim/estradas';
import { caixaDoPredio } from '../src/sim/footprint';
import { receitaDoTipo } from '../src/sim/producao';
import { cenarioDePedreira, comEspacoNaSaida, saidaDe } from './helpers/producao-cenario';
import { compararComESemSave } from './helpers/determinism';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const DADOS: GameData = gameData;

/** O cenario dos dois lados da comparacao: o mesmo que `compararComESemSave`
 *  injeta no tick 0, para que `noTick` ande a MESMA trajetoria. */
const CENARIO = (): GameState => comEspacoNaSaida(cenarioDePedreira(DADOS), 'q1');

function unidadeDe(estado: GameState, id: string): Unidade {
  const u = estado.unidades.porId[id];
  if (u === undefined) throw new Error(`fixture: a unidade '${id}' nao existe`);
  return u;
}

function predioDe(estado: GameState, id: string): PredioCompleto {
  const p = estado.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao esta completo`);
  return p;
}

/** Distancia de Chebyshev ao footprint: 0 dentro, 1 na porta, mais em campo. */
function distanciaAoPredio(estado: GameState, unidadeId: string, predioId: string): number {
  const u = unidadeDe(estado, unidadeId);
  const caixa = caixaDoPredio(predioDe(estado, predioId), DADOS);
  if (caixa === null) throw new Error('fixture: predio sem footprint');
  return Math.max(
    Math.max(caixa.x0 - u.gx, 0, u.gx - (caixa.x1 - 1)),
    Math.max(caixa.y0 - u.gy, 0, u.gy - (caixa.y1 - 1)),
  );
}

/**
 * "Em campo" no sentido forte: fora do footprint E fora da porta. A distancia 1 e
 * o anel da porta — salvar ali seria quase salvar dentro do predio, e o aceite
 * pede o meio do caminho ("nem na porta, nem no tile").
 */
const foraDoFootprint = (estado: GameState, unidadeId: string, predioId: string): boolean =>
  distanciaAoPredio(estado, unidadeId, predioId) > 1;

const noTick = (t: number): GameState => {
  let s = CENARIO();
  for (let i = 0; i < t; i += 1) s = step(s, [], DADOS);
  return s;
};

/**
 * O primeiro tick em que salvar DOI: `indo_colher`, fora do footprint, com
 * caminho pendente e um passo pela metade. Nao esta digitado — e a CONDICAO que
 * escolhe o tick, e o segundo teste reafirma a condicao sobre o numero achado.
 * O teto de 120 e seguranca (a ida inteira mede ~50 ticks), nao afirmacao de
 * desempenho: um ciclo que nunca sai da porta falha com a busca na mao.
 */
function tickEmQueEstaAndando(): number {
  let s = CENARIO();
  for (let t = 1; t <= 120; t += 1) {
    s = step(s, [], DADOS);
    const u = s.unidades.porId.u1;
    if (u !== undefined && u.fsm === 'indo_colher'
      && (u.fsmData.caminho ?? []).length > 0 && (u.fsmData.progresso ?? 0) > 0
      && foraDoFootprint(s, 'u1', 'q1')) return t;
  }
  throw new Error('fixture: o pedreiro nao chegou a andar fora do predio em 120 ticks');
}

const TICK_NO_MEIO = tickEmQueEstaAndando();

describe('F-T3, aceite 3 — determinismo com o pedreiro a caminho', () => {
  it('save e load com o pedreiro A CAMINHO dao o mesmo estado 200 ticks depois', () => {
    const { direto, comSave } = compararComESemSave({
      seed: 1,
      totalTicks: TICK_NO_MEIO + 200,
      saveAtTick: TICK_NO_MEIO,
      antesDoStep: (e) => (e.tick === 0 ? CENARIO() : e),
    });
    expect(comSave).toBe(direto);
  });

  it('e o tick escolhido e mesmo o do meio do passo: nem na porta, nem no tile', () => {
    const estado = noTick(TICK_NO_MEIO);
    const u = unidadeDe(estado, 'u1');
    expect(u.fsm).toBe('indo_colher');
    expect((u.fsmData.caminho ?? []).length).toBeGreaterThan(0);
    expect(u.fsmData.progresso ?? 0).toBeGreaterThan(0);
    expect(foraDoFootprint(estado, 'u1', 'q1')).toBe(true);
    // e o numero, nao so o booleano: mais de um tile do footprint e campo aberto,
    // fora do anel da porta. E o que separa este save de um save "na soleira".
    expect(distanciaAoPredio(estado, 'u1', 'q1')).toBeGreaterThan(1);
    // e ele leva tarefa reclamada na mao: e ela, e nao so a posicao, o que o
    // round-trip precisa reencontrar do outro lado do JSON.
    expect(u.fsmData.tarefa).toBeDefined();
  });

  it('o round-trip sozinho nao muda nada, e as invariantes valem dos dois lados', () => {
    // O contra-exemplo do teste acima: se `JSON.parse(JSON.stringify(...))` ja
    // alterasse o estado parado, a igualdade de 200 ticks seria coincidencia.
    const estado = noTick(TICK_NO_MEIO);
    const revivido = JSON.parse(JSON.stringify(estado)) as GameState;
    expect(JSON.stringify(revivido)).toBe(JSON.stringify(estado));
    expect(violacoesDaFsmDoEspecialista(revivido, DADOS)).toEqual([]);
    expect(violacoesDeInvariantes(revivido, DADOS)).toEqual([]);
    // e um tick depois os dois continuam iguais: o estado revivido nao perdeu
    // nenhuma aresta que so o primeiro step usaria.
    expect(JSON.stringify(step(revivido, [], DADOS))).toBe(JSON.stringify(step(estado, [], DADOS)));
  });
});

describe('F-T3 — a evidencia consolidada dos tres aceites', () => {
  it('grava test-output/F-T3.json', () => {
    // aceite 1: o ciclo inteiro, com o tick de cada transicao, ate a pedra cair
    // na gaveta. Medido aqui, e nao citado de outro arquivo.
    let s = CENARIO();
    const transicoes: { readonly tick: number; readonly de: string; readonly para: string }[] = [];
    const tileDaTarefa = (e: GameState): string | null => {
      const id = e.unidades.porId.u1?.fsmData.tarefa;
      const t = id === undefined ? undefined : e.jobs.tarefas.porId[id];
      return t !== undefined && ehTarefaDeColheita(t) ? chaveDeTile(t.origemTile) : null;
    };
    let anterior = unidadeDe(s, 'u1').fsm;
    let tileDoCiclo: string | null = null;
    let ticksAteODeposito = 0;
    // LOTE3-c: teto de seguranca, acompanha o ciclo do dado (a pedreira passou a 501)
    const teto = (receitaDoTipo('quarry', DADOS)?.ticksDoCiclo ?? 0) + 400;
    for (let tick = 1; tick <= teto && ticksAteODeposito === 0; tick += 1) {
      s = step(s, [], DADOS);
      const fsm = unidadeDe(s, 'u1').fsm;
      if (fsm !== anterior) transicoes.push({ tick, de: anterior, para: fsm });
      anterior = fsm;
      tileDoCiclo = tileDaTarefa(s) ?? tileDoCiclo;
      if ((saidaDe(s, 'q1').stone ?? 0) > 0) ticksAteODeposito = tick;
    }

    // aceite 2: com ele em campo, o painel e os alertas do predio.
    const emCampo = noTick(TICK_NO_MEIO);
    const causas = alertasDoEstado(emCampo, DADOS).filter((a) => a.predio === 'q1').map((a) => a.causa);
    const demolido = step(emCampo, [{ type: 'DemolishBuilding', predio: 'q1' }], DADOS);

    // aceite 3: o par salvo/direto no tick do meio do passo.
    const { direto, comSave } = compararComESemSave({
      seed: 1,
      totalTicks: TICK_NO_MEIO + 200,
      saveAtTick: TICK_NO_MEIO,
      antesDoStep: (e) => (e.tick === 0 ? CENARIO() : e),
    });

    gravarEvidencia('F-T3', {
      feature: 'F-T3 — o especialista sai do predio, lavra no tile e volta para depositar',
      aceite1_cicloCompleto: {
        transicoes,
        ticksAteODeposito,
        ticksDoCiclo: receitaDoTipo('quarry', DADOS)?.ticksDoCiclo ?? null,
        tileTrabalhado: tileDoCiclo,
        saidaNoFim: saidaDe(s, 'q1'),
        lajedoNoFim: tileDoCiclo === null ? null : s.recursos[tileDoCiclo]?.quantidade ?? null,
        nota: 'o intervalo e 1 (transicao) + ida + ticksDoCiclo + volta: a pedra troca de mao no tick da CHEGADA',
      },
      aceite2_ocupadoMasFora: {
        tick: TICK_NO_MEIO,
        fsm: unidadeDe(emCampo, 'u1').fsm,
        distanciaAoFootprint: distanciaAoPredio(emCampo, 'u1', 'q1'),
        painelOcupante: painelDoPredio(emCampo, 'q1', DADOS)?.ocupante ?? null,
        causas,
        demolidoComEleFora: {
          fsm: unidadeDe(demolido, 'u1').fsm,
          fsmDataVazio: Object.keys(unidadeDe(demolido, 'u1').fsmData).length === 0,
          onde: { gx: unidadeDe(demolido, 'u1').gx, gy: unidadeDe(demolido, 'u1').gy },
        },
      },
      aceite3_determinismo: {
        iguais: comSave === direto,
        tickDoSave: TICK_NO_MEIO,
        totalTicks: TICK_NO_MEIO + 200,
        noTickDoSave: {
          fsm: unidadeDe(emCampo, 'u1').fsm,
          passosPendentes: (unidadeDe(emCampo, 'u1').fsmData.caminho ?? []).length,
          progressoNoPasso: unidadeDe(emCampo, 'u1').fsmData.progresso ?? 0,
        },
      },
    });

    expect(ticksAteODeposito).toBeGreaterThan(0);
    expect(comSave).toBe(direto);
  });
});
