/**
 * C-TELA-04 — botao direito sobre um militar inimigo, com a tropa na mao, e `AttackUnit`
 * (plano em docs/planos/2026-09-29-C-TELA-04-atacar-unidade.md). A decisao e de
 * `ui/ordem-militar.ts`; a prova passa pelo `step` real da escaramuca depois da paz.
 */
import { describe, expect, it } from 'vitest';
import { ordemDoBotaoDireito } from '../src/ui/ordem-militar';
import { centroDesenhado, unidadesNoPonto } from '../src/render/acerto';
import type { UnidadeDesenhada } from '../src/render/acerto';
import { gameData } from '../src/sim/data';
import { LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { FSM_INDO_LUTAR } from '../src/sim/systems/combate';
import { gravarEvidencia } from './helpers/evidence';
import { comOlheiro } from './helpers/vista';

const s0 = criarEscaramuca(gameData.economia.estadoInicial.semente);
const unidades = (s: GameState, f: (u: Unidade) => boolean): Unidade[] =>
  s.unidades.ordem.map((id) => s.unidades.porId[id] as Unidade).filter(f);
const tropa = unidades(s0, (u) => u.lado === LADO_DO_JOGADOR && u.tipo === gameData.escaramuca.tropaDoJogador.tipo).map((u) => u.id);
const inimigo = unidades(s0, (u) => u.lado === LADO_DA_IA && u.tipo === 'militia')[0] as Unidade;
/** A mesma partida, sem a paz: a ordem de ataque em paz e recusada (C-IA-03b), e aqui se
 *  prova o que a ordem FAZ, nao a cerca. F-COMBATE-ALVO-NA-VISTA: com um olheiro do jogador
 *  perto do inimigo, que nasceu longe da vila — sem vista, a ordem e recusada. */
const semPaz: GameState = comOlheiro({ ...s0, pazAteTick: 0 }, inimigo);
const tileDo = (u: Unidade) => ({ gx: u.gx, gy: u.gy });

describe('C-TELA-04 — atacar unidade pelo mouse', () => {
  it('militar inimigo sob o ponteiro: AttackUnit com a tropa inteira, e a sim a aceita', () => {
    const ordem = ordemDoBotaoDireito(semPaz, gameData, LADO_DO_JOGADOR, tropa, tileDo(inimigo), [inimigo.id]);
    expect(ordem.comandos).toEqual([{ type: 'AttackUnit', unidades: tropa, alvo: inimigo.id }]);
    expect(ordem.marcarDestino).toBeNull();
    const s1 = step(semPaz, ordem.comandos, gameData);
    expect(s1.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    const indo = tropa.filter((id) => s1.unidades.porId[id]?.fsm === FSM_INDO_LUTAR && s1.unidades.porId[id]?.fsmData.alvoUnidade === inimigo.id);
    expect(indo).toHaveLength(tropa.length);
    gravarEvidencia('C-TELA-04', { alvo: inimigo.id, tropa: tropa.length, indoLutar: indo.length });
  });

  it('a unidade vence o predio do tile, e o proprio soldado sob o ponteiro nao e alvo', () => {
    const quartel = s0.predios.ordem.map((id) => s0.predios.porId[id]!).find((p) => p.lado === LADO_DA_IA)!;
    const noPredio = { gx: quartel.gx, gy: quartel.gy };
    expect(ordemDoBotaoDireito(semPaz, gameData, LADO_DO_JOGADOR, tropa, noPredio, [inimigo.id]).comandos[0]?.type).toBe('AttackUnit');
    expect(ordemDoBotaoDireito(semPaz, gameData, LADO_DO_JOGADOR, tropa, noPredio, []).comandos[0]?.type).toBe('AttackBuilding');
    const meu = s0.unidades.porId[tropa[0] as string] as Unidade;
    const sobreOMeu = ordemDoBotaoDireito(semPaz, gameData, LADO_DO_JOGADOR, tropa, tileDo(meu), [meu.id]);
    expect(sobreOMeu.comandos).toEqual([{ type: 'MoveUnits', unidades: tropa, destino: tileDo(meu) }]);
    expect(sobreOMeu.marcarDestino).toEqual(tileDo(meu));
  });

  it('grupo com arqueiro: o corpo a corpo ataca, o arqueiro marcha ao tile (a sim o recusaria no AttackUnit)', () => {
    const arqueiro: Unidade = { ...(s0.unidades.porId[tropa[0] as string] as Unidade), id: 'arq1', tipo: 'bowman', gx: 1, gy: 1 };
    const comArqueiro: GameState = {
      ...semPaz,
      unidades: { porId: { ...semPaz.unidades.porId, arq1: arqueiro }, ordem: [...semPaz.unidades.ordem, 'arq1'] },
    };
    const grupo = [...tropa, 'arq1'];
    const ordem = ordemDoBotaoDireito(comArqueiro, gameData, LADO_DO_JOGADOR, grupo, tileDo(inimigo), [inimigo.id]);
    expect(ordem.comandos).toEqual([
      { type: 'AttackUnit', unidades: tropa, alvo: inimigo.id },
      { type: 'MoveUnits', unidades: ['arq1'], destino: tileDo(inimigo) },
    ]);
    const tudoNoAttack = step(comArqueiro, [{ type: 'AttackUnit', unidades: grupo, alvo: inimigo.id }], gameData);
    expect(tudoNoAttack.events.some((e) => e.type === 'command-rejected')).toBe(true);
  });

  it('o ponteiro no CORPO do sprite acerta a unidade; o quadrado do pe continua vencendo', () => {
    const TILE = gameData.terreno.tilePx;
    // o cabra: 64x96 ancorado no pe (0.5, 1), como o manifesto
    const corpoPx = { x0: -TILE / 2, y0: -1.5 * TILE, x1: TILE / 2, y1: 0 };
    const alvo: UnidadeDesenhada = { id: 'alvo', gxDesenhado: 5, gyDesenhado: 5, deslocamentoPx: { x: 0, y: 0 }, corpoPx };
    const semCorpo: UnidadeDesenhada = { ...alvo, corpoPx: null };
    const c = centroDesenhado(alvo, TILE);
    const peito = { x: c.x, y: c.y - 0.75 * TILE };
    expect(unidadesNoPonto([alvo], peito, TILE)).toEqual(['alvo']);
    expect(unidadesNoPonto([semCorpo], peito, TILE)).toEqual([]);
    // o de tras (tile de cima) tem o PE sob o ponteiro: o quadrado vence o corpo do da frente
    const deTras: UnidadeDesenhada = { id: 'tras', gxDesenhado: 5, gyDesenhado: 4, deslocamentoPx: { x: 0, y: 0 }, corpoPx };
    expect(unidadesNoPonto([alvo, deTras], centroDesenhado(deTras, TILE), TILE)).toEqual(['tras', 'alvo']);
    // so corpos (acima do quadrado do de tras, que vai ate -1,25 tile): vence o da frente
    const cabeca = { x: c.x, y: c.y - 1.4 * TILE };
    expect(unidadesNoPonto([deTras, alvo], cabeca, TILE)[0]).toBe('alvo');
  });

  it('sem tropa na mao, nada', () => {
    expect(ordemDoBotaoDireito(semPaz, gameData, LADO_DO_JOGADOR, [], tileDo(inimigo), [inimigo.id]).comandos).toEqual([]);
  });
});
