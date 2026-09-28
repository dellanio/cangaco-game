/**
 * F28b — a Torre de Pedra (BUILD_PLAN F28b; plano em docs/planos/2026-09-28-A11-F28b-torre.md).
 *
 * Aceite do item, com as decisoes do operador (alcance 7, pedra que nunca erra, fogo
 * amigo):
 *  (a) a torre abastecida mata inimigos DENTRO do alcance ate a pedra acabar, e nao atira
 *      fora dele; pedras gastas = inimigos mortos + amigos mortos;
 *  (b) fogo amigo: o soldado do lado da torre no tile do alvo morre junto — a pedra que
 *      o acerta conta;
 *  (c) sem pedra (ou sem recruta) a torre nao atira, e o motivo e o que o painel le;
 *  (d) a pedra chega pelo JobBoard, como a de qualquer consumidor, ate o teto do dado;
 *  (e) a mesma corrida duas vezes da o mesmo estado.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { createInitialState, ID_DO_ARMAZEM, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, PredioCompleto, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { tileAndavel, buscarCaminho } from '../src/sim/pathfinding';
import { chaveDeTile, tilesDaPorta } from '../src/sim/estradas';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { distanciaDaTorre, pedrasNaTorre, porQueNaoAtira } from '../src/sim/torre';
import { salvar } from '../src/sim/save';
import { comEntrada, comProdutorOcupado } from './helpers/producao-cenario';
import { naVila } from './helpers/ancoras';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const INIMIGO = LADO_DO_JOGADOR + 1;
const ALCANCE = gameData.combate.watchtower.alcance_tiles;
const MAX = gameData.combate.watchtower.municao_stone_max;

function comTorre(s: GameState, pedras: number): { s: GameState; torre: PredioCompleto } {
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'quarry'])] };
  for (let r = 10; r < 30; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const p = naVila(d, r);
      if (!canPlace(busca, 'watchtower', p.gx, p.gy, gameData).ok) continue;
      let comTorre = comProdutorOcupado(s, { tipo: 'watchtower', id: 'torre', unidade: 'vigia', ...p }, gameData);
      if (pedras > 0) comTorre = comEntrada(comTorre, 'torre', { stone: pedras });
      return { s: comTorre, torre: comTorre.predios.porId['torre'] as PredioCompleto };
    }
  }
  throw new Error('fixture: a torre nao coube');
}

function soldado(id: string, lado: number, t: { gx: number; gy: number }): Unidade {
  return { lado, id, tipo: 'militia', gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia') };
}
function com(s: GameState, ...us: Unidade[]): GameState {
  const porId = { ...s.unidades.porId };
  const ordem = [...s.unidades.ordem];
  for (const u of us) {
    porId[u.id] = u;
    ordem.push(u.id);
  }
  return { ...s, unidades: { porId, ordem } };
}
/** Tiles andaveis a exatamente `d` (arredondado) da torre, espalhados (2 tiles entre si). */
function tilesA(s: GameState, torre: PredioCompleto, dMin: number, dMax: number, n: number): { gx: number; gy: number }[] {
  const achados: { gx: number; gy: number }[] = [];
  for (let gy = torre.gy - 14; gy <= torre.gy + 16 && achados.length < n; gy += 2) {
    for (let gx = torre.gx - 14; gx <= torre.gx + 16 && achados.length < n; gx += 2) {
      const d = distanciaDaTorre(torre, { gx, gy });
      if (d >= dMin && d <= dMax && tileAndavel(s, { gx, gy }, 'livre', gameData)
        && achados.every((a) => Math.max(Math.abs(a.gx - gx), Math.abs(a.gy - gy)) >= 3)) achados.push({ gx, gy });
    }
  }
  if (achados.length < n) throw new Error(`fixture: so ${achados.length} tiles entre ${dMin} e ${dMax}`);
  return achados;
}
const doTick = (events: readonly GameEvent[], tipo: string) => events.filter((e) => e.type === tipo);
const semCivis = (s: GameState): GameState => ({ ...s, unidades: { porId: {}, ordem: [] } });

function correr(s0: GameState, ticks: number): { s: GameState; pedras: GameEvent[]; mortos: GameEvent[] } {
  let s = s0;
  const pedras: GameEvent[] = [];
  const mortos: GameEvent[] = [];
  for (let t = 0; t < ticks; t += 1) {
    s = step(s, [], gameData);
    pedras.push(...doTick(s.events, 'stone-thrown'));
    mortos.push(...doTick(s.events, 'unit-killed').filter((e) => (e as { por: string }).por === 'torre'));
  }
  return { s, pedras, mortos };
}

describe('F28b — a Torre de Pedra', () => {
  it('o dado: alcance 7 (decisao do operador), 5 pedras, mata num golpe', () => {
    expect(ALCANCE).toBe(7);
    expect(MAX).toBe(5);
    expect(gameData.combate.watchtower.mataEmUmGolpe).toBe(true);
  });

  it('(a) mata dentro do alcance ate a pedra acabar, nao atira fora; pedras = mortos', () => {
    const { s: s0, torre } = comTorre(semCivis(createInitialState(1)), MAX);
    const dentro = tilesA(s0, torre, 2, ALCANCE, 7);
    const fora = tilesA(s0, torre, ALCANCE + 1, ALCANCE + 4, 2);
    const inimigos = [...dentro.map((t, i) => soldado(`in${i}`, INIMIGO, t)), ...fora.map((t, i) => soldado(`fora${i}`, INIMIGO, t))];
    const r = correr(com(s0, ...inimigos), 300);
    expect(r.pedras.length).toBe(MAX); // 7 no alcance e 5 pedras: a pedra acaba
    expect(r.mortos.length).toBe(r.pedras.length);
    expect(pedrasNaTorre(r.s.predios.porId['torre'] as PredioCompleto)).toBe(0);
    for (const t of fora) {
      // quem esta fora do alcance nunca foi alvo
      expect(r.pedras.some((e) => (e as { alvo: { gx: number; gy: number } }).alvo.gx === t.gx && (e as { alvo: { gx: number; gy: number } }).alvo.gy === t.gy)).toBe(false);
    }
    expect(r.s.unidades.porId['fora0']).toBeDefined();
    expect(r.s.unidades.porId['fora1']).toBeDefined();
    expect(porQueNaoAtira(r.s.predios.porId['torre'] as PredioCompleto)).toBe('sem-pedra');
    // SO inimigos fora do alcance, com pedra na torre: nenhum tiro
    const soFora = correr(com(s0, ...fora.map((t, i) => soldado(`fora${i}`, INIMIGO, t))), 300);
    expect(soFora.pedras).toEqual([]);
    gravarEvidencia('F28b-alcance', { pedras: r.pedras.length, mortos: r.mortos.length, dentro: dentro.length, fora: fora.length });
  });

  it('(b) fogo amigo: o soldado da torre no tile do alvo, antes na lista, morre; a pedra conta', () => {
    const { s: s0, torre } = comTorre(semCivis(createInitialState(1)), 2);
    const [t] = tilesA(s0, torre, 3, 5, 1);
    if (t === undefined) throw new Error('fixture');
    const r = correr(com(s0, soldado('amigo', LADO_DO_JOGADOR, t), soldado('inimigo', INIMIGO, t)), 100);
    expect(r.pedras.map((e) => (e as { vitima: string }).vitima)).toEqual(['amigo', 'inimigo']);
    expect(r.mortos.map((e) => (e as { unidade: string }).unidade)).toEqual(['amigo', 'inimigo']);
    expect(r.pedras.length).toBe(r.mortos.length); // pedras gastas = inimigos + amigos mortos
    gravarEvidencia('F28b-fogo-amigo', { vitimas: ['amigo', 'inimigo'] });
  });

  it('(c) sem pedra ou sem recruta, nao atira, e o motivo e o do painel', () => {
    const base = semCivis(createInitialState(1));
    const { s: semPedra, torre } = comTorre(base, 0);
    const [t] = tilesA(semPedra, torre, 3, 5, 1);
    if (t === undefined) throw new Error('fixture');
    expect(porQueNaoAtira(torre)).toBe('sem-pedra');
    expect(correr(com(semPedra, soldado('x', INIMIGO, t)), 100).pedras).toEqual([]);
    const semRecruta = { ...semPedra, predios: { ...semPedra.predios, porId: { ...semPedra.predios.porId, torre: { ...torre, ocupante: null, estoque: { ...torre.estoque, entrada: { stone: 5 } } } } } };
    expect(porQueNaoAtira(semRecruta.predios.porId['torre'] as PredioCompleto)).toBe('sem-recruta');
    const r = correr(com({ ...semRecruta, unidades: { porId: {}, ordem: [] } }, soldado('x', INIMIGO, t)), 100);
    expect(r.pedras).toEqual([]);
  });

  it('(d) a pedra chega pelo JobBoard ate o teto do dado, com as invariantes', () => {
    const montada = comTorre(createInitialState(1), 0);
    const torre = montada.torre;
    let s = montada.s;
    const armazem = s.predios.porId[s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === ID_DO_ARMAZEM) as string] as PredioCompleto;
    const porta = tilesDaPorta(torre, gameData)[0] as { gx: number; gy: number };
    const rua = buscarCaminho(s, porta, tilesDaPorta(armazem, gameData), 'livre', gameData);
    if (rua === null) throw new Error('fixture: sem rua');
    s = { ...s, estradas: { ...s.estradas, ...Object.fromEntries([porta, ...rua.tiles].map((t) => [chaveDeTile(t), true as const])) } };
    const violacoes: string[] = [];
    for (let t = 0; t < 2000 && pedrasNaTorre(s.predios.porId['torre'] as PredioCompleto) < MAX; t += 1) {
      s = step(s, [], gameData);
      violacoes.push(...violacoesDeInvariantes(s, gameData));
    }
    expect(violacoes).toEqual([]);
    expect(pedrasNaTorre(s.predios.porId['torre'] as PredioCompleto)).toBe(MAX);
    for (let t = 0; t < 300; t += 1) s = step(s, [], gameData);
    expect(pedrasNaTorre(s.predios.porId['torre'] as PredioCompleto)).toBe(MAX); // e nao passa do teto
  });

  it('(e) a mesma corrida duas vezes da o mesmo estado; e grava a partida do roteiro', () => {
    const montar = (): GameState => {
      const { s, torre } = comTorre(createInitialState(1), 2);
      const alvos = tilesA(s, torre, 3, ALCANCE, 3);
      return com(s, soldado('amigo', LADO_DO_JOGADOR, alvos[0] as { gx: number; gy: number }),
        ...alvos.map((t, i) => soldado(`inimigo${i + 1}`, INIMIGO, t)));
    };
    expect(salvar(correr(montar(), 200).s)).toBe(salvar(correr(montar(), 200).s));
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F28b.save.txt`, salvar(montar()));
  });
});
