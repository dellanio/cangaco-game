/**
 * I-COMIDA-AVISO-DA-TROPA-COM-FOME — a tropa com fome avisa o dono, como o UpdateHungerMessage do
 * KaM (src/units/KM_UnitGroup.pas:1975-2005): o evento `troop-hungry` no tick em que a contagem de
 * militares em alerta de um lado vai de 0 a mais de 0, e o lembrete no multiplo enquanto dura.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { condicaoCheiaDoTipo, emAlertaDeFome } from '../src/sim/condicao';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { validarTudo } from '../tools/data-rules.js';
import { gravarEvidencia } from './helpers/evidence';
import { idDoSom } from '../src/render/som';
import type { TabelaDeSom } from '../src/render/som';

const LIMIAR = gameData.condicao.ticksNoLimiar.militar.alertaVisual;
const LEMBRETE = gameData.condicao.ticksDoLembreteDaTropaComFome;
const LADO_DA_IA = LADO_DO_JOGADOR + 1;

function tropa(id: string, condicao: number, lado = LADO_DO_JOGADOR, tipo = 'militia', gx = 30, gy = 40): Unidade {
  return { lado, id, tipo, gx, gy, fsm: 'ocioso', fsmData: {}, condicao };
}
function com(...us: Unidade[]): GameState {
  const s = createInitialState(1);
  return { ...s, unidades: { porId: { ...s.unidades.porId, ...Object.fromEntries(us.map((u) => [u.id, u])) }, ordem: [...s.unidades.ordem, ...us.map((u) => u.id)] } };
}
/** Os avisos de cada tick, com o tick. */
function rodar(s0: GameState, n: number, dados: GameData = gameData): { s: GameState; avisos: { tick: number; e: GameEvent }[] } {
  let s = s0;
  const avisos: { tick: number; e: GameEvent }[] = [];
  for (let i = 0; i < n; i++) {
    s = step(s, [], dados);
    for (const e of s.events) if (e.type === 'troop-hungry') avisos.push({ tick: s.tick, e });
  }
  return { s, avisos };
}

describe('I-COMIDA-AVISO-DA-TROPA-COM-FOME', () => {
  it('(1) o aviso sai NO TICK em que a tropa do jogador entra em alerta, com a contagem', () => {
    const { s, avisos } = rodar(com(tropa('a', LIMIAR + 3), tropa('b', condicaoCheiaDoTipo('militia'))), 10);
    expect(avisos).toHaveLength(1);
    const { tick, e } = avisos[0]!;
    expect(e).toEqual({ type: 'troop-hungry', lado: LADO_DO_JOGADOR, unidades: 1 });
    // o tick do aviso e o primeiro em que `a` esta em alerta
    expect(tick).toBe(3);
    expect(emAlertaDeFome(s.unidades.porId['a']!)).toBe(true);
  });

  it('(2) o lembrete sai no multiplo enquanto a fome dura, e nao sai entre dois multiplos', () => {
    // a condicao alta o bastante para durar dois lembretes sem morrer
    const inicio = createInitialState(1);
    const ate = LEMBRETE * 2 + 10 - inicio.tick;
    const { avisos } = rodar(com(tropa('a', LIMIAR + 1)), ate);
    const ticks = avisos.map((a) => a.tick);
    expect(ticks[0]).toBe(1); // a entrada em alerta
    expect(ticks.slice(1)).toEqual([LEMBRETE, LEMBRETE * 2]);
    gravarEvidencia('I-COMIDA-AVISO-DA-TROPA-COM-FOME', { limiar: LIMIAR, lembreteTicks: LEMBRETE, ticksDosAvisos: ticks });
  });

  it('(3) alimentada, nenhum aviso; o civil com fome nao dispara', () => {
    expect(rodar(com(tropa('a', condicaoCheiaDoTipo('militia'))), 50).avisos).toEqual([]);
    const civil: Unidade = { ...tropa('c', 1), tipo: 'serf' };
    expect(rodar(com(civil), 5).avisos).toEqual([]);
  });

  it('(4) a tropa da IA dispara com o lado da IA, e os lados saem em ordem', () => {
    const s0 = com(tropa('ia', LIMIAR + 2, LADO_DA_IA, 'militia', 60, 60), tropa('eu', LIMIAR + 2));
    const comIa: GameState = { ...s0, ia: { ...s0.ia, [String(LADO_DA_IA)]: { posicoes: [] } } };
    const { avisos } = rodar(comIa, 5);
    expect(avisos.map((a) => a.e)).toEqual([
      { type: 'troop-hungry', lado: LADO_DO_JOGADOR, unidades: 1 },
      { type: 'troop-hungry', lado: LADO_DA_IA, unidades: 1 },
    ]);
  });

  it('(5) determinismo: a mesma corrida da os mesmos avisos', () => {
    const corrida = () => JSON.stringify(rodar(com(tropa('a', LIMIAR + 5), tropa('b', LIMIAR + 40)), 80).avisos);
    expect(corrida()).toBe(corrida());
  });

  it('(5) a sim nao le o som.json (guarda pelo import)', () => {
    for (const arquivo of ['src/sim/condicao.ts', 'src/sim/tick.ts']) {
      expect(readFileSync(arquivo, 'utf8')).not.toMatch(/som\.json|from ['"].*render/);
    }
  });

  it('o som: o aviso do jogador toca `troop-hungry`, o da IA e silencio', () => {
    const tabela = JSON.parse(readFileSync('data/som.json', 'utf8')) as TabelaDeSom;
    expect(idDoSom({ type: 'troop-hungry', lado: LADO_DO_JOGADOR, unidades: 2 }, tabela)).toBe('troop-hungry');
    expect(idDoSom({ type: 'troop-hungry', lado: LADO_DA_IA, unidades: 2 }, tabela)).toBeNull();
  });

  it('(6) o validate:data recusa o lembrete <= 0', () => {
    const ler = (nomes: readonly string[]) => Object.fromEntries(nomes.map((nome) => [nome, JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'))]));
    const dados = ler(ARQUIVOS);
    void ARQUIVOS_DA_INTERFACE;
    expect(validarTudo(dados)).toEqual([]);
    const ruim = { ...dados, condition: { ...dados['condition'], avisoDaTropaComFome: { lembrete_segundos_base: 0 } } };
    expect(validarTudo(ruim).join('\n')).toMatch(/avisoDaTropaComFome\.lembrete_segundos_base/);
  });
});
