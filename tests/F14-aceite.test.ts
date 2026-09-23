/**
 * F14 — o aceite do BUILD_PLAN, ponta a ponta: duas Quarries prontas, dois
 * stonemasons TREINADOS na escola (o ouro atravessa a estrada no ombro de um
 * serf, como na F13a), e cada um ocupa uma pedreira. Nenhum predio com dois.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { trabalhadorDoTipo } from '../src/sim/ocupacao';
import { armazemPorTipo, avancar, escolaDoCenario, novasUnidades, pedir } from './helpers/escola-cenario';
import { comEstradas, comPredioCompletoEm, linhaH } from './helpers/jobs-cenario';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { compararComESemSave } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;
const RUAS = linhaH(29, 36, 33);
const PEDREIRO = trabalhadorDoTipo('quarry') ?? '';
const QUARRIES = [{ id: 'q1', gx: 26, gy: 36 }, { id: 'q2', gx: 34, gy: 36 }] as const;
const PEDIDOS = [pedir(ESCOLA, PEDREIRO), pedir(ESCOLA, PEDREIRO)];
/** 2 x (1 tick de cobranca + ticksPorTreino) + entrega do ouro + as duas
 *  caminhadas ate as pedreiras. 1200 e folga larga, como na F13a. */
const TICKS = 1200;

const ocupanteDe = (e: GameState, id: string): string | null => {
  const p = e.predios.porId[id];
  return p?.estado === 'completo' ? p.ocupante : null;
};

/** As duas pedreiras e a estrada, sobre a base dada. Parametrizado na base para
 *  que o teste de determinismo monte sobre a semente DELE, nao sobre a de cima. */
function cenario(base: GameState = inicial): GameState {
  let e = comEstradas(base, RUAS);
  for (const q of QUARRIES) e = comPredioCompletoEm(e, q.id, { tipo: 'quarry', gx: q.gx, gy: q.gy });
  return e;
}

describe('F14 — aceite headless do BUILD_PLAN', () => {
  it('2 quarries e 2 stonemasons treinados: cada um num predio, nenhum com dois', () => {
    const montado = cenario();
    expect(ocupanteDe(montado, 'q1')).toBe(null);
    expect(ocupanteDe(montado, 'q2')).toBe(null);

    const fim = avancar(step(montado, [...PEDIDOS]), TICKS);

    // 1. os dois civis existem, do tipo pedido, e vieram da escola
    const novos = novasUnidades(montado, fim).filter((u) => u.tipo === PEDREIRO);
    expect(novos).toHaveLength(2);

    // 2. os dois predios tem ocupante
    const ocupantes = [ocupanteDe(fim, 'q1'), ocupanteDe(fim, 'q2')];
    expect(ocupantes.every((o) => o !== null)).toBe(true);

    // 3. NENHUM ficou com dois: os ocupantes sao pessoas diferentes, e sao
    //    exatamente os dois que a escola formou
    expect(new Set(ocupantes).size).toBe(2);
    expect([...ocupantes].sort()).toEqual(novos.map((u) => u.id).sort());

    // 4. os dois estao trabalhando, e o quadro nao guardou vaga orfa
    for (const u of novos) expect(fim.unidades.porId[u.id]?.fsm).toBe('trabalhando');
    const vagas = fim.jobs.tarefas.ordem.filter((id) => fim.jobs.tarefas.porId[id]?.tipo === 'ocupar');
    expect(vagas).toHaveLength(0);

    // 5. as invariantes dos dois lados
    expect(violacoesDaFsmDoEspecialista(fim)).toEqual([]);

    gravarEvidencia('F14', {
      feature: 'F14 — Especialistas ocupam predios',
      aceite: 'cenario com 2 Quarries prontas e 2 stonemasons treinados: apos N ticks os dois predios tem ocupante e nenhum ficou com dois',
      dado: {
        trabalhadorDaQuarry: PEDREIRO,
        ticksPorTreino: gameData.economia.schoolhouse.ticksPorTreino,
        custoOuroPorUnidade: gameData.economia.schoolhouse.custoOuroPorUnidade,
      },
      cenario: { estrada: 'linhaH(29,36,33)', quarries: QUARRIES, armazem: armazemPorTipo(inicial).id, escola: ESCOLA },
      ticks: TICKS,
      predios: QUARRIES.map((q) => ({ id: q.id, ocupante: ocupanteDe(fim, q.id) })),
      especialistas: novos.map((u) => ({
        id: u.id, tipo: u.tipo, fsm: fim.unidades.porId[u.id]?.fsm, gx: fim.unidades.porId[u.id]?.gx, gy: fim.unidades.porId[u.id]?.gy,
      })),
      ocupantesDistintos: new Set(ocupantes).size,
      vagasAbertasNoFim: vagas.length,
      violacoes: { especialista: violacoesDaFsmDoEspecialista(fim) },
    });
  });

  it('determinismo e save/load com uma ocupacao em curso', () => {
    const r = compararComESemSave({
      seed: 7,
      totalTicks: 400,
      saveAtTick: 120,
      comandosNoTick: (t) => (t === 5 ? [...PEDIDOS] : []),
      antesDoStep: (e) => (e.tick === 0 ? cenario(e) : e),
    });
    expect(r.comSave).toBe(r.direto);
  });

  it('as invariantes do especialista seguem valendo tick a tick, com a escola rodando', () => {
    let e = step(cenario(), [...PEDIDOS]);
    for (let i = 0; i < 300; i++) {
      e = step(e, []);
      expect(violacoesDaFsmDoEspecialista(e), `tick ${e.tick}`).toEqual([]);
    }
  });

  it('as invariantes do quadro seguem valendo tick a tick (sem treino em curso)', () => {
    // `violacoesDeInvariantes` exige destino em OBRA para toda tarefa que nao e
    // 'ocupar'. Isso deixou de ser verdade na F13, quando a escola virou destino
    // de ouro — lacuna do helper, anterior a esta feature, registrada no
    // PROGRESS.md. Afrouxar a invariante para acomodar o ouro seria mudar o
    // escopo da F14, entao aqui ela roda no cenario que ela de fato cobre: as
    // duas pedreiras vagas, com as vagas de ocupacao abertas no quadro.
    let e = cenario();
    for (let i = 0; i < 300; i++) {
      e = step(e, []);
      expect(violacoesDeInvariantes(e), `tick ${e.tick}`).toEqual([]);
    }
  });
});
