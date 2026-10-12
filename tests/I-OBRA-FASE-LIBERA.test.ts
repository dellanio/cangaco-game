/**
 * I-OBRA-FASE-LIBERA — a fase tranca o que ainda nao liberou (aceite no BUILD_PLAN.md, plano em
 * docs/planos/2026-10-12-campanha-jogavel.md). O aceite 4 (o menu Build com o cadeado, na tela) roda no
 * roteiro do I-TELA-MENU-DA-CAMPANHA, que e quem abre o jogo numa fase.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { criarFase, dadosDaFase, faseDaCampanha, liberadosNaFase } from '../src/sim/fase';
import { canPlace } from '../src/sim/placement';
import { motivoDaRecusaDeSoldado } from '../src/sim/quartel';
import { opcoesDoMenuBuild } from '../src/sim/selectors';
import { completarObra, createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameData } from '../src/sim/data/types';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gravarEvidencia } from './helpers/evidence';

const ID = 'fase-01-pianco';
const DADOS = dadosDaFase(ID);

/** O primeiro lote, perto da vila do jogador, onde o tipo cabe (fora a tranca da fase). */
function loteParaO(s: GameState, tipo: string, dados: GameData): { gx: number; gy: number } {
  for (let r = 0; r < 40; r++) for (let gy = 22 - r; gy <= 22 + r; gy++) for (let gx = 20 - r; gx <= 20 + r; gx++) {
    if (canPlace(s, tipo, gx, gy, dados).ok) return { gx, gy };
  }
  throw new Error(`sem lote para ${tipo}`);
}

describe('I-OBRA-FASE-LIBERA', () => {
  it('aceite 1: os liberados da fase 1 sao os sete da fase 1 mais o armazem e a escola', () => {
    const lib = liberadosNaFase(faseDaCampanha(ID, DADOS), DADOS);
    expect([...lib.predios].sort()).toEqual(['barracks', 'inn', 'quarry', 'sawmill', 'schoolhouse', 'storehouse', 'weapons_workshop', 'woodcutters'].sort());
    expect(lib.tropas.has('militia')).toBe(true);
    expect(lib.tropas.has('axe_fighter')).toBe(false);
    // a fase 2 soma a dela
    const lib2 = liberadosNaFase(faseDaCampanha('fase-02-patos', DADOS), DADOS);
    expect(lib2.predios.has('farm')).toBe(true);
    expect(lib2.predios.has('quarry')).toBe(true);
    gravarEvidencia('I-OBRA-FASE-LIBERA', { fase1: [...lib.predios], tropas1: [...lib.tropas] });
  });

  it('aceite 2: na fase 1, plantar a fazenda e recusado com fase-trancada, e a pedreira e aceita; fora da campanha nada muda', () => {
    const s0 = criarFase(ID, DADOS);
    const lote = loteParaO(s0, 'quarry', DADOS);
    expect(canPlace(s0, 'farm', lote.gx, lote.gy, DADOS)).toEqual({ ok: false, motivo: 'fase-trancada' });
    const recusada = step(s0, [{ type: 'PlaceBlueprint', buildingId: 'farm', gx: lote.gx, gy: lote.gy }], DADOS);
    expect(recusada.events.some((e) => e.type === 'command-rejected' && 'motivo' in e && e.motivo === 'fase-trancada')).toBe(true);
    expect(recusada.predios.ordem.length).toBe(s0.predios.ordem.length);
    const aceita = step(s0, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: lote.gx, gy: lote.gy }], DADOS);
    expect(aceita.predios.ordem.length).toBe(s0.predios.ordem.length + 1);
    expect(aceita.predios.porId[aceita.predios.ordem.at(-1) as string]?.tipo).toBe('quarry');
    // fora da campanha a fazenda nao e trancada (pode ser bloqueada pela arvore, mas nunca pela fase)
    const livre = createInitialState(1, gameData);
    for (let gy = 0; gy < 128; gy += 4) for (let gx = 0; gx < 128; gx += 4) {
      const r = canPlace(livre, 'farm', gx, gy, gameData);
      if (!r.ok) expect(r.motivo).not.toBe('fase-trancada');
    }
  });

  it('aceite 3: o quartel do jogador nao forma tropa trancada e forma a liberada', () => {
    const s0 = criarFase(ID, DADOS);
    // o quartel entra montado, como fixture: o lote e procurado com a arvore inteira aberta
    const lote = loteParaO({ ...s0, tiposJaConstruidos: DADOS.predios.map((d) => d.id) }, 'barracks', DADOS);
    const def = DADOS.predios.find((d) => d.id === 'barracks');
    const quartel = completarObra({ id: 'pq', lado: LADO_DO_JOGADOR, tipo: 'barracks', gx: lote.gx, gy: lote.gy, estado: 'obra', hp: def?.hp ?? 1, obra: { faltam: {}, nivelamento: 0 } }, DADOS) as PredioCompleto;
    const cheio: PredioCompleto = { ...quartel, estoque: { ...quartel.estoque, entrada: { hand_axe: 5, leather_armour: 5, sling: 5, axe: 5 } }, recrutas: 5 };
    const s = { ...s0, predios: { porId: { ...s0.predios.porId, pq: cheio }, ordem: [...s0.predios.ordem, 'pq'] } };
    expect(motivoDaRecusaDeSoldado(s, 'pq', 'axe_fighter', DADOS)).toBe('fase-trancada');
    expect(motivoDaRecusaDeSoldado(s, 'pq', 'militia', DADOS)).toBe(null);
    const depois = step(s, [{ type: 'TrainSoldier', predio: 'pq', tipo: 'axe_fighter' }], DADOS);
    expect(depois.events.some((e) => e.type === 'command-rejected' && 'motivo' in e && e.motivo === 'fase-trancada')).toBe(true);
  });

  it('o menu Build da fase 1: a fazenda com o cadeado da campanha, a pedreira liberada pela arvore', () => {
    const s0 = criarFase(ID, DADOS);
    const opcoes = opcoesDoMenuBuild(s0, DADOS);
    const farm = opcoes.find((o) => o.id === 'farm');
    const quarry = opcoes.find((o) => o.id === 'quarry');
    expect(farm).toMatchObject({ desbloqueado: false, trancadoNaCampanha: true, requer: null });
    expect(quarry).toMatchObject({ desbloqueado: true, trancadoNaCampanha: false });
    // fora da campanha ninguem tem o cadeado da campanha
    expect(opcoesDoMenuBuild(createInitialState(1, gameData), gameData).some((o) => o.trancadoNaCampanha)).toBe(false);
  });
});
