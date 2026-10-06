/**
 * I-COMBATE-PADRE-SEM-INVESTIDA — o padre nao investe; o golpe dele e a conversao (pedido do operador,
 * 2026-10-06). A sim (o StormAttack pula o padre) e as regras puras do painel e do clique do Converter.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { carregaNaInvestida, FSM_EM_CARGA } from '../src/sim/carga';
import { podeCarregar } from '../src/ui/formacao';
import { ordemDeConversao, padresDoGrupo } from '../src/ui/ordem-militar';
import { gravarEvidencia } from './helpers/evidence';

const IA = LADO_DO_JOGADOR + 1;
const un = (id: string, tipo: string, gx: number, gy: number, lado = LADO_DO_JOGADOR): Unidade =>
  ({ id, lado, tipo, gx, gy, fsm: 'ocioso', fsmData: {}, condicao: 100000 });
function com(...us: Unidade[]): GameState {
  const s = createInitialState(1);
  return { ...s, unidades: { porId: { ...s.unidades.porId, ...Object.fromEntries(us.map((u) => [u.id, u])) }, ordem: [...s.unidades.ordem, ...us.map((u) => u.id)] } } as GameState;
}

describe('I-COMBATE-PADRE-SEM-INVESTIDA', () => {
  it('(1) pelo step: o StormAttack com o padre e um cabra poe so o cabra em carga', () => {
    expect(carregaNaInvestida('priest')).toBe(false);
    expect(carregaNaInvestida('militia')).toBe(true);
    const s = step(com(un('p', 'priest', 40, 40), un('c', 'militia', 41, 40)), [{ type: 'StormAttack', unidades: ['p', 'c'] }]);
    expect(s.unidades.porId['c']?.fsm).toBe(FSM_EM_CARGA);
    expect(s.unidades.porId['p']?.fsm).not.toBe(FSM_EM_CARGA);
    gravarEvidencia('I-COMBATE-PADRE-SEM-INVESTIDA', { padre: s.unidades.porId['p']?.fsm, cabra: s.unidades.porId['c']?.fsm });
  });

  it('(2) o painel: grupo so de padre nao investe e converte; o de cabras investe e nao converte', () => {
    const s = com(un('p', 'priest', 40, 40), un('c', 'militia', 41, 40));
    expect(podeCarregar(s, ['p'], gameData)).toBe(false);
    expect(padresDoGrupo(s, ['p'], gameData)).toEqual(['p']);
    expect(podeCarregar(s, ['c'], gameData)).toBe(true);
    expect(padresDoGrupo(s, ['c'], gameData)).toEqual([]);
  });

  it('o clique do Converter: inimigo sob o ponteiro, um ConvertUnit por padre; fora de inimigo, nada', () => {
    const s = com(un('p1', 'priest', 40, 40), un('p2', 'priest', 40, 41), un('c', 'militia', 41, 40), un('alvo', 'militia', 45, 40, IA));
    expect(ordemDeConversao(s, gameData, LADO_DO_JOGADOR, ['p1', 'p2', 'c'], ['alvo'])).toEqual([
      { type: 'ConvertUnit', padre: 'p1', alvo: 'alvo' },
      { type: 'ConvertUnit', padre: 'p2', alvo: 'alvo' },
    ]);
    expect(ordemDeConversao(s, gameData, LADO_DO_JOGADOR, ['p1'], ['c'])).toEqual([]);
    expect(ordemDeConversao(s, gameData, LADO_DO_JOGADOR, ['p1'], [])).toEqual([]);
    expect(ordemDeConversao(s, gameData, LADO_DO_JOGADOR, ['c'], ['alvo'])).toEqual([]);
  });
});
