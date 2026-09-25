/**
 * F14 — a FSM do especialista: sair de ocioso, andar ate o predio vago, ocupar.
 * O que se verifica aqui e o CICLO fechado pelos dois lados: o predio aponta
 * para a unidade, a unidade OCUPA, e a tarefa sumiu do quadro. O rotulo exato
 * depende do ciclo e nao e o ponto: a quarry destes cenarios nao tem estrada, e
 * desde que a D6 foi revogada (2026-09-25) ela PRODUZ sem estrada — o pedreiro
 * sai para o lajedo e passa a maior parte do tempo em `colhendo`/`voltando`, que
 * OCUPAM tanto quanto `trabalhando`. Por isso o eixo daqui e `ESTADOS_QUE_OCUPAM`
 * (producao uniao campo) e nao `ESTADOS_DE_PRODUCAO`: o que a F14 promete e a
 * OCUPACAO. Antes da revogacao o rotulo era `saida_cheia`, pelo portao que sumiu.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { predioDoOcupante, trabalhadorDoTipo } from '../src/sim/ocupacao';
import { comPredioCompletoEm, comUnidadeExtra, semAUnidade, semLaborers, semOPredio } from './helpers/jobs-cenario';
import {
  ESTADOS_DE_PRODUCAO, ESTADOS_QUE_OCUPAM, violacoesDaFsmDoEspecialista,
} from './helpers/especialista-invariantes';

const inicial = createInitialState(1);
const PEDREIRO = trabalhadorDoTipo('quarry') ?? '';
const avancar = (e: GameState, n: number): GameState =>
  Array.from({ length: n }).reduce<GameState>((atual) => step(atual, []), e);

function cenario(qtdPedreiros: number, quarries: ReadonlyArray<{ id: string; gx: number; gy: number }>) {
  let e = semLaborers(inicial);
  for (const q of quarries) e = comPredioCompletoEm(e, q.id, { tipo: 'quarry', gx: q.gx, gy: q.gy });
  for (let i = 0; i < qtdPedreiros; i++) e = comUnidadeExtra(e, `esp${i + 1}`, PEDREIRO, 30 + i, 34);
  return e;
}

describe('F14 — a FSM do especialista', () => {
  it('sai de ocioso, anda e ocupa: o predio aponta para ele e a tarefa sai do quadro', () => {
    const fim = avancar(cenario(1, [{ id: 'q1', gx: 26, gy: 36 }]), 200);
    expect(fim.predios.porId.q1?.estado === 'completo' && fim.predios.porId.q1.ocupante).toBe('esp1');
    expect(ESTADOS_QUE_OCUPAM).toContain(fim.unidades.porId.esp1?.fsm);
    // O `ocupar` saiu da MAO da unidade — era isto que `fsmData === {}` afirmava, e
    // com a D6 revogada o `{}` deixou de valer: em campo a unidade segura a tarefa de
    // COLHEITA e o caminho (F-T3). O que continua verdade, e mais estrito, e que o que
    // ela tem na mao NAO e um `ocupar`.
    const naMao = fim.unidades.porId.esp1?.fsmData.tarefa;
    expect(naMao === undefined || fim.jobs.tarefas.porId[naMao]?.tipo === 'colher').toBe(true);
    expect(fim.jobs.tarefas.ordem.filter((id) => fim.jobs.tarefas.porId[id]?.tipo === 'ocupar')).toHaveLength(0);
    expect(violacoesDaFsmDoEspecialista(fim)).toEqual([]);
  });

  it('emite building-occupied uma unica vez', () => {
    let e = cenario(1, [{ id: 'q1', gx: 26, gy: 36 }]);
    let ocupacoes = 0;
    for (let i = 0; i < 200; i++) {
      e = step(e, []);
      ocupacoes += e.events.filter((ev) => ev.type === 'building-occupied').length;
    }
    expect(ocupacoes).toBe(1);
  });

  it('dois pedreiros e UMA quarry: um ocupa, o outro fica ocioso e sem tarefa', () => {
    const fim = avancar(cenario(2, [{ id: 'q1', gx: 26, gy: 36 }]), 200);
    const ocupante = fim.predios.porId.q1?.estado === 'completo' ? fim.predios.porId.q1.ocupante : null;
    expect(ocupante).not.toBe(null);
    const sobrou = ocupante === 'esp1' ? 'esp2' : 'esp1';
    expect(fim.unidades.porId[sobrou]?.fsm).toBe('ocioso');
    expect(predioDoOcupante(fim, sobrou)).toBe(null);
    expect(violacoesDaFsmDoEspecialista(fim)).toEqual([]);
  });

  it('predio demolido no meio do caminho: volta a ocioso sem tarefa presa', () => {
    const emCaminho = avancar(cenario(1, [{ id: 'q1', gx: 26, gy: 36 }]), 3);
    expect(emCaminho.unidades.porId.esp1?.fsm).toBe('indo_ocupar');
    const depois = avancar(semOPredio(emCaminho, 'q1'), 2);
    expect(depois.unidades.porId.esp1?.fsm).toBe('ocioso');
    expect(depois.jobs.tarefas.ordem.filter((id) => depois.jobs.tarefas.porId[id]?.tipo === 'ocupar')).toHaveLength(0);
    expect(violacoesDaFsmDoEspecialista(depois)).toEqual([]);
  });

  it('predio demolido DEPOIS de ocupado: o especialista volta a ocioso', () => {
    const ocupado = avancar(cenario(1, [{ id: 'q1', gx: 26, gy: 36 }]), 200);
    expect(ESTADOS_QUE_OCUPAM).toContain(ocupado.unidades.porId.esp1?.fsm);
    const depois = avancar(semOPredio(ocupado, 'q1'), 2);
    expect(depois.unidades.porId.esp1?.fsm).toBe('ocioso');
  });

  it('ocupante que some devolve o predio a vago, e a vaga reabre', () => {
    const ocupado = avancar(cenario(1, [{ id: 'q1', gx: 26, gy: 36 }]), 200);
    const depois = step(semAUnidade(ocupado, 'esp1'), []);
    expect(depois.predios.porId.q1?.estado === 'completo' && depois.predios.porId.q1.ocupante).toBe(null);
    expect(depois.jobs.tarefas.ordem.filter((id) => depois.jobs.tarefas.porId[id]?.tipo === 'ocupar')).toHaveLength(1);
  });

  it('serf e laborer nao entram no sistema: seguem na FSM deles', () => {
    const comLaborer = avancar(comPredioCompletoEm(inicial, 'q1', { tipo: 'quarry', gx: 26, gy: 36 }), 50);
    for (const id of comLaborer.unidades.ordem) {
      const u = comLaborer.unidades.porId[id];
      if (u && (u.tipo === 'serf' || u.tipo === 'laborer')) {
        expect(u.fsm).not.toBe('indo_ocupar');
        for (const producao of ESTADOS_DE_PRODUCAO) expect(u.fsm).not.toBe(producao);
      }
    }
  });
});
