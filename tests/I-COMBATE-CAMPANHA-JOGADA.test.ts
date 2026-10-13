/**
 * I-COMBATE-CAMPANHA-JOGADA — as fases jogadas sem tela (aceite no BUILD_PLAN.md). So mecanica, em
 * horizonte curto: os alvos de desenho (A a E) ficam na evidencia de `tools/jogar-campanha.js`, nao aqui.
 * Junto, as duas correcoes que a campanha jogada achou: BUG-ONDA-PARA-DEPOIS-DA-LUTA e
 * BUG-CAPTURADO-MORRE-NA-LUTA-AUTOMATICA.
 */
import { describe, expect, it } from 'vitest';
import { criarFase, dadosDaFase } from '../src/sim/fase';
import { rawGameData } from '../src/sim/data/raw';
import { FSM_INDO_ATACAR } from '../src/sim/systems/cerco';
import type { GameState, Unidade } from '../src/sim/state';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import { classeDaUnidade, condicaoCheiaDoTipo } from '../src/sim/condicao';
import { step } from '../src/sim/tick';
import { jogar, ordensDoAtaque } from './helpers/jogador-da-campanha';
import { gravarEvidencia } from './helpers/evidence';

const HORIZONTE = 600;
const IDS = rawGameData.fases.map((f) => f.id);

const semUnidades = (s: GameState, quer: (u: Unidade) => boolean): GameState => {
  const ordem = s.unidades.ordem.filter((id) => { const u = s.unidades.porId[id]; return u !== undefined && !quer(u); });
  return { ...s, unidades: { porId: Object.fromEntries(ordem.map((id) => [id, s.unidades.porId[id]])), ordem } } as GameState;
};

describe('I-COMBATE-CAMPANHA-JOGADA', () => {
  const evidencia: Record<string, unknown> = {};

  it.each(IDS)('aceite 3: %s — o ataque so da ordens aceitas, repete o estado, e o passivo nao vence', (id) => {
    const dados = dadosDaFase(id);
    const a = jogar(criarFase(id, dados), 'ataque', HORIZONTE, dados);
    const b = jogar(criarFase(id, dados), 'ataque', HORIZONTE, dados);
    const p = jogar(criarFase(id, dados), 'passivo', HORIZONTE, dados);
    evidencia[id] = { ataque: a.corrida, passivo: p.corrida };
    expect(a.corrida.recusas).toEqual({});
    expect(a.corrida.ordens).toBeGreaterThan(0);
    expect(JSON.stringify(b.estado)).toBe(JSON.stringify(a.estado));
    expect(p.corrida.resultado).not.toBe('vitoria');
  }, 60_000);

  it('BUG-ONDA-PARA-DEPOIS-DA-LUTA: a tropa da onda que fica ociosa volta a atacar a vila', () => {
    const id = 'fase-04-boqueirao';
    const dados = dadosDaFase(id);
    const s0 = criarFase(id, dados);
    const u: Unidade = { id: 'u-onda', lado: 1, tipo: 'militia', gx: 64, gy: 120, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia', dados) };
    const fase = s0.fase;
    if (fase === undefined) throw new Error('sem fase');
    const s = { ...s0, unidades: { porId: { ...s0.unidades.porId, [u.id]: u }, ordem: [...s0.unidades.ordem, u.id] }, fase: { ...fase, tropasDasOndas: [u.id] } };
    const depois = step(s, [], dados).unidades.porId[u.id];
    expect(depois?.fsm).toBe(FSM_INDO_ATACAR);
    const alvo = depois?.fsmData.alvo;
    expect(typeof alvo === 'string' ? s.predios.porId[alvo]?.lado : null).toBe(LADO_DO_JOGADOR);
  });

  it('BUG-CAPTURADO-MORRE-NA-LUTA-AUTOMATICA: encostado no Vicente sem escolta, ele vive e a captura conta ate vencer', () => {
    const id = 'fase-07-itabaiana';
    const dados = dadosDaFase(id);
    let s = criarFase(id, dados);
    const vicente = s.unidades.ordem.map((i) => s.unidades.porId[i]).find((u) => u?.lado === 1 && u.tipo === 'knight');
    if (vicente === undefined) throw new Error('sem o Vicente');
    // sem escolta, e um militar so do jogador, encostado nele
    s = semUnidades(s, (u) => u.id !== vicente.id && classeDaUnidade(u.tipo, dados) === 'militar' && (u.lado === 1 || u.tipo !== 'militia'));
    const meus = s.unidades.ordem.map((i) => s.unidades.porId[i]).filter((u): u is Unidade => u?.lado === LADO_DO_JOGADOR);
    const guarda = meus[0];
    if (guarda === undefined) throw new Error('sem militar do jogador');
    s = semUnidades(s, (u) => u.lado === LADO_DO_JOGADOR && u.id !== guarda.id);
    s = { ...s, unidades: { ...s.unidades, porId: { ...s.unidades.porId, [guarda.id]: { ...guarda, gx: vicente.gx + 1, gy: vicente.gy } } } };

    // a ordem de ataca-lo e recusada
    const recusa = step(s, [{ type: 'AttackUnit', unidades: [guarda.id], alvo: vicente.id }], dados).events
      .find((e) => e.type === 'command-rejected' && e.command === 'AttackUnit');
    expect(recusa).toMatchObject({ motivo: 'alvo-de-captura' });

    const ticks = dados.campanha.captura.ticks;
    for (let i = 0; i < ticks + 5 && s.partida === undefined; i++) s = step(s, [], dados);
    expect(s.unidades.porId[vicente.id]).toBeDefined();
    expect(s.partida?.fim).toBe('vitoria');
  });

  it('o ataque nunca manda atacar o capturado (fase 7)', () => {
    const id = 'fase-07-itabaiana';
    const dados = dadosDaFase(id);
    let s = criarFase(id, dados);
    const vicente = s.unidades.ordem.find((i) => s.unidades.porId[i]?.tipo === 'knight' && s.unidades.porId[i]?.lado === 1);
    for (let i = 0; i < HORIZONTE; i++) {
      const cmds = ordensDoAtaque(s, dados);
      for (const c of cmds) if (c.type === 'AttackUnit') expect(c.alvo).not.toBe(vicente);
      s = step(s, cmds, dados);
    }
    gravarEvidencia('I-COMBATE-CAMPANHA-JOGADA-teste', { horizonte: HORIZONTE, fases: evidencia });
  }, 60_000);
});
