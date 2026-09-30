/**
 * BUG-U, causa A (o quartel sem estrada ate o armazem nao recebe arma, e ninguem avisa).
 * Diagnostico de 2026-09-30 (BUGS.md): a tarefa `arma-para-quartel` nasce no modo
 * `estrada` (`origemMaisPerto`), como no KaM (`KM_HandLogistics.pas:1216-1220`, casa->casa
 * so com estrada). O recruta chega a pe, e o alerta `sem-estrada` so valia para predio com
 * producao e para a escola. Tudo pelo `step`.
 *
 * O aceite (BUGS.md, BUG-U): quartel completo sem estrada ate o armazem acende o alerta
 * `sem-estrada`, pelo mesmo `temCausa`. E o contrario: ligado, nao acende, e a arma chega —
 * o alerta diz a mesma coisa que o gerador de tarefa.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, ID_DO_ARMAZEM, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Predio, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { buscarCaminho } from '../src/sim/pathfinding';
import { chaveDeTile, tilesDaPorta } from '../src/sim/estradas';
import { alertasDoEstado } from '../src/sim/selectors';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const QUARTEL = 'quartel';
const ARMAS = 3;
/** Teto de SEGURANCA, nao afirmacao de desempenho: a arma anda ~30 tiles. */
const TETO = 2500;

const armazemDe = (s: GameState): PredioCompleto =>
  s.predios.porId[s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === ID_DO_ARMAZEM) as string] as PredioCompleto;
const comPredio = (s: GameState, p: Predio): GameState =>
  ({ ...s, predios: { porId: { ...s.predios.porId, [p.id]: p }, ordem: s.predios.ordem.includes(p.id) ? s.predios.ordem : [...s.predios.ordem, p.id] } });

/** A vila inicial com um quartel pronto e machados no armazem; `rua` liga a porta dele ao
 *  armazem. A mesma montagem de `tests/C3-quartel.test.ts`. */
function vilaComQuartel(rua: boolean): GameState {
  let s = createInitialState(1);
  const arm = armazemDe(s);
  s = comPredio(s, { ...arm, estoque: { ...arm.estoque, saida: { ...arm.estoque.saida, hand_axe: ARMAS } } } as PredioCompleto);
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'sawmill'])] };
  let lugar: { gx: number; gy: number } | null = null;
  for (let r = 8; r < 40 && lugar === null; r += 1) {
    for (let d = -r; d <= r && lugar === null; d += 1) {
      const p = naVila(d, r);
      if (canPlace(busca, 'barracks', p.gx, p.gy, gameData).ok) lugar = p;
    }
  }
  if (lugar === null) throw new Error('fixture: o quartel nao coube');
  const q = completarObra({ lado: LADO_DO_JOGADOR, id: QUARTEL, tipo: 'barracks', ...lugar, estado: 'obra', hp: 600, obra: { faltam: {}, nivelamento: 0 } }, gameData);
  s = comPredio(s, { ...q, estoque: { ...q.estoque, entrada: {} }, recrutas: 0 });
  if (rua) {
    const porta = tilesDaPorta(q, gameData)[0] as { gx: number; gy: number };
    const caminho = buscarCaminho(s, porta, tilesDaPorta(armazemDe(s), gameData), 'livre', gameData);
    if (caminho === null) throw new Error('fixture: sem rua');
    s = { ...s, estradas: { ...s.estradas, ...Object.fromEntries([porta, ...caminho.tiles].map((t) => [chaveDeTile(t), true as const])) } };
  }
  return s;
}

const causasDoQuartel = (s: GameState): string[] =>
  alertasDoEstado(s, gameData).filter((a) => a.predio === QUARTEL).map((a) => a.causa);
const tarefasDeArma = (s: GameState): number => s.jobs.tarefas.ordem
  .filter((id) => s.jobs.tarefas.porId[id]?.tipo === 'arma-para-quartel').length;
const armasNoQuartel = (s: GameState): number =>
  (s.predios.porId[QUARTEL] as PredioCompleto).estoque.entrada['hand_axe'] ?? 0;

interface Corrida { readonly estado: GameState; readonly tarefasVistas: number; readonly alertaEmTodoTick: boolean; readonly alertaEmAlgumTick: boolean }

function rodar(s0: GameState, ticks: number): Corrida {
  let s = s0;
  let tarefasVistas = 0;
  let alertaEmTodoTick = true;
  let alertaEmAlgumTick = false;
  for (let t = 0; t < ticks; t += 1) {
    s = step(s, [], gameData);
    tarefasVistas = Math.max(tarefasVistas, tarefasDeArma(s));
    const acende = causasDoQuartel(s).includes('sem-estrada');
    alertaEmTodoTick &&= acende;
    alertaEmAlgumTick ||= acende;
  }
  return { estado: s, tarefasVistas, alertaEmTodoTick, alertaEmAlgumTick };
}

const evidencia: Record<string, unknown> = {};

describe('BUG-U causa A — o quartel sem estrada avisa', () => {
  it('sem estrada: nenhuma arma sai do armazem, e o alerta sem-estrada fica aceso o tempo todo', () => {
    const r = rodar(vilaComQuartel(false), TETO);
    expect(r.tarefasVistas).toBe(0);
    expect(armasNoQuartel(r.estado)).toBe(0);
    expect(armazemDe(r.estado).estoque.saida['hand_axe']).toBe(ARMAS);
    expect(r.alertaEmTodoTick).toBe(true);
    evidencia['semEstrada'] = { tarefasDeArma: r.tarefasVistas, noQuartel: armasNoQuartel(r.estado), causas: causasDoQuartel(r.estado) };
  });

  it('com estrada: o alerta nunca acende, e as armas chegam', () => {
    const r = rodar(vilaComQuartel(true), TETO);
    expect(r.tarefasVistas).toBeGreaterThan(0);
    expect(armasNoQuartel(r.estado)).toBe(ARMAS);
    expect(r.alertaEmAlgumTick).toBe(false);
    evidencia['comEstrada'] = { noQuartel: armasNoQuartel(r.estado), causas: causasDoQuartel(r.estado) };
  });

  it('pausado, o quartel sem estrada nao avisa (pausa deliberada nao alerta nada, F16c)', () => {
    const s0 = vilaComQuartel(false);
    const s = step(s0, [{ type: 'SetBuildingPaused', predio: QUARTEL, pausado: true }], gameData);
    expect(causasDoQuartel(s)).toEqual([]);
  });

  it('a partida do roteiro (tools/shots/BUG-U.js): o quartel sem estrada, com o aviso aceso', () => {
    const s = rodar(vilaComQuartel(false), 10).estado;
    expect(causasDoQuartel(s)).toEqual(['sem-estrada']);
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/BUG-U.save.txt`, salvar(s));
    const q = s.predios.porId[QUARTEL] as PredioCompleto;
    evidencia['partidaDoRoteiro'] = { tick: s.tick, gx: q.gx, gy: q.gy, alertas: alertasDoEstado(s, gameData) };
    gravarEvidencia('BUG-U-quartel-sem-estrada', evidencia);
  });
});
