/**
 * O contrato de DESTINO por tipo de tarefa, em `tests/helpers/jobs-invariantes.ts`.
 *
 * Por que este teste existe: a invariante nasceu na F09, quando todo destino
 * era obra, e a F13 a deixou desatualizada sem que ninguem percebesse — a
 * escola virou destino de ouro e o helper continuou exigindo obra. Toda a
 * suite so a chamava sobre estados SADIOS, o que prova que ela nao acusa falso
 * positivo, mas nunca que ela acusa. Aqui se prova o outro sentido, um caso por
 * tipo: destino da especie errada TEM que aparecer na lista.
 *
 * O caso "tipo novo sem contrato" nao precisa de teste: o `switch` de
 * `violacoesDoDestino` e exaustivo e um membro novo de `Tarefa` reprova o
 * `npm run typecheck`.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState, Predio, Tarefa } from '../src/sim/state';
import { trabalhadorDoTipo } from '../src/sim/ocupacao';
import { armazemDoCenario, cenarioLigado, comPredioCompletoEm, comTarefas } from './helpers/jobs-cenario';
import { escolaDoCenario } from './helpers/escola-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';

const inicial = createInitialState(1);
const ARMAZEM = armazemDoCenario(inicial).id;
const ESCOLA = escolaDoCenario(inicial).id;

/** Cenario com uma obra (`obra-a`) LIGADA ao armazem por estrada — a tarefa de
 *  material tem outra invariante, a de caminho, que nao e o assunto aqui — e uma
 *  quarry completa e vaga (`q1`). */
const mundo = comPredioCompletoEm(cenarioLigado(), 'q1', { tipo: 'quarry', gx: 26, gy: 38 });

const comA = (t: Tarefa): string[] => violacoesDeInvariantes(comTarefas(mundo, [t]));

const material = (destino: string): Tarefa => ({
  id: 't99', numero: 99, tipo: 'material-para-obra', mercadoria: 'stone',
  origem: ARMAZEM, destino, estado: 'aberta', reclamadaPor: null,
});
const ouro = (destino: string): Tarefa => ({
  id: 't99', numero: 99, tipo: 'ouro-para-escola', mercadoria: 'gold',
  origem: ARMAZEM, destino, estado: 'aberta', reclamadaPor: null,
});
const construir = (destino: string): Tarefa =>
  ({ id: 't99', numero: 99, tipo: 'construir', destino, estado: 'aberta', reclamadaPor: null });
const ocupar = (destino: string): Tarefa =>
  ({ id: 't99', numero: 99, tipo: 'ocupar', destino, estado: 'aberta', reclamadaPor: null });

describe('o destino tem que ser coerente com o TIPO da tarefa', () => {
  it('material-para-obra: obra passa, predio completo e acusado', () => {
    expect(comA(material('obra-a'))).toEqual([]);
    expect(comA(material(ESCOLA))).toContain(`t99: destino '${ESCOLA}' nao e obra`);
  });

  it('construir: obra passa, predio completo e acusado', () => {
    expect(comA(construir('obra-a'))).toEqual([]);
    expect(comA(construir('q1'))).toContain("t99: destino 'q1' nao e obra");
  });

  it('ouro-para-escola: escola passa, armazem e obra sao acusados (regressao da F13)', () => {
    expect(comA(ouro(ESCOLA))).toEqual([]);
    expect(comA(ouro(ARMAZEM))).toContain(`t99: destino '${ARMAZEM}' nao e escola completa`);
    expect(comA(ouro('obra-a'))).toContain("t99: destino 'obra-a' nao e escola completa");
  });

  it('ocupar: quarry vaga passa, armazem e obra sao acusados', () => {
    expect(trabalhadorDoTipo('quarry')).not.toBe(null); // a quarry pede trabalhador
    expect(comA(ocupar('q1'))).toEqual([]);
    expect(comA(ocupar(ARMAZEM))).toContain(`t99: destino '${ARMAZEM}' nao e predio ocupavel`);
    expect(comA(ocupar('obra-a'))).toContain("t99: destino 'obra-a' nao e predio ocupavel");
  });

  it('ocupar: predio ocupavel que JA tem ocupante e acusado', () => {
    const q1 = mundo.predios.porId.q1;
    if (q1 === undefined || q1.estado !== 'completo') throw new Error('fixture: q1 deveria estar completo');
    const ocupado: Predio = { ...q1, ocupante: 'u1' };
    const e: GameState = { ...mundo, predios: { ...mundo.predios, porId: { ...mundo.predios.porId, q1: ocupado } } };
    expect(violacoesDeInvariantes(comTarefas(e, [ocupar('q1')])))
      .toContain("t99: destino 'q1' ja tem ocupante");
  });
});
