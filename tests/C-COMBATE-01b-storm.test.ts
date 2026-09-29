/**
 * C-COMBATE-01b — o storm attack (plano em docs/planos/2026-09-29-C-COMBATE-01b-storm-attack.md).
 * A tropa de 18 da escaramuca, com a paz tirada do estado (a paz tem teste proprio abaixo).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Unidade } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { passoDaDirecao } from '../src/sim/combate';
import { FSM_EM_CARGA } from '../src/sim/carga';
import { passoAndavel } from '../src/sim/pathfinding';
import { militarOcupa, noTile } from '../src/sim/units/movimento';
import { gravarEvidencia } from './helpers/evidence';

const storm = gameData.combate.stormAttack;
const comPaz = criarEscaramuca(gameData.economia.estadoInicial.semente);
const { pazAteTick: _paz, ...semPaz } = comPaz;
void _paz;
const s0: GameState = semPaz;
const tropa = s0.unidades.ordem.filter((id) => s0.unidades.porId[id]?.lado === LADO_DO_JOGADOR && s0.unidades.porId[id]?.tipo === gameData.escaramuca.tropaDoJogador.tipo);
const lider = s0.unidades.porId[tropa[0] as string] as Unidade;
/** o homem da fileira da frente (na direcao do lider): sozinho, ele tem o tile da frente livre */
const [fdx, fdy] = passoDaDirecao(lider.direcao ?? 4);
const ponta = tropa.map((id) => s0.unidades.porId[id] as Unidade).reduce((a, b) => (b.gx * fdx + b.gy * fdy > a.gx * fdx + a.gy * fdy ? b : a));
const carga = (unidades: readonly string[] = tropa): Command => ({ type: 'StormAttack', unidades });
const emCarga = (s: GameState): number => tropa.filter((id) => s.unidades.porId[id]?.fsm === FSM_EM_CARGA).length;
const rejeicoes = (events: readonly GameEvent[]): string[] => events.flatMap((e) => (e.type === 'command-rejected' && e.command === 'StormAttack' ? [e.motivo] : []));

function ate(s: GameState, fim: (s: GameState) => boolean, teto = 800): GameState {
  let atual = s;
  for (let t = 0; t < teto && !fim(atual); t += 1) atual = step(atual, [], gameData);
  return atual;
}

describe('C-COMBATE-01b — storm attack', () => {
  it('1. a tropa carrega em linha reta para a frente do lider, de min a max tiles, e para ociosa', () => {
    const [dx, dy] = passoDaDirecao(lider.direcao ?? 4);
    const s1 = step(s0, [carga()], gameData);
    expect(emCarga(s1)).toBe(tropa.length);
    const s = ate(s1, (x) => emCarga(x) === 0);
    const andados = tropa.map((id) => {
      const a = s0.unidades.porId[id] as Unidade;
      const b = s.unidades.porId[id] as Unidade;
      // na linha: o deslocamento e k vezes o passo da direcao
      const k = dx !== 0 ? (b.gx - a.gx) / dx : (b.gy - a.gy) / dy;
      const frente = { gx: b.gx + dx, gy: b.gy + dy };
      const fechado = !passoAndavel(s, noTile(b), frente, 'livre', gameData) || militarOcupa(s, frente, id, gameData);
      return { id, k, naLinha: b.gx - a.gx === k * dx && b.gy - a.gy === k * dy, fsm: b.fsm, fechado };
    });
    gravarEvidencia('C-COMBATE-01b-linha', { direcao: lider.direcao ?? 4, distancia: storm.distancia_tiles, andados });
    for (const a of andados) {
      expect(a.naLinha).toBe(true);
      // abaixo do min, so quem parou com a frente fechada (terreno, ou o da frente que parou)
      if (a.k < storm.distancia_tiles.min) expect(a.fechado).toBe(true);
      else expect(a.k).toBeGreaterThanOrEqual(storm.distancia_tiles.min);
      expect(a.k).toBeLessThanOrEqual(storm.distancia_tiles.max);
    }
    expect(andados.filter((a) => a.k >= storm.distancia_tiles.min).length).toBeGreaterThan(tropa.length / 2);
    for (const a of andados) {
      expect(a.fsm).toBe('ocioso');
    }
  });

  it('2. o passo da carga e o da marcha dividido por multiplicadorVelocidade', () => {
    const [dx, dy] = passoDaDirecao(ponta.direcao ?? 4);
    /** ticks entre a 1a e a 4a troca de tile do ponta */
    const ticksPor3 = (primeiro: Command): number => {
      let s = step(s0, [primeiro], gameData);
      const trocas: number[] = [];
      let onde = `${ponta.gx},${ponta.gy}`;
      for (let t = 1; t < 400 && trocas.length < 4; t += 1) {
        s = step(s, [], gameData);
        const u = s.unidades.porId[ponta.id] as Unidade;
        if (`${u.gx},${u.gy}` !== onde) { trocas.push(t); onde = `${u.gx},${u.gy}`; }
      }
      return (trocas[3] as number) - (trocas[0] as number);
    };
    const marcha = ticksPor3({ type: 'MoveUnits', unidades: [ponta.id], destino: { gx: ponta.gx + 10 * dx, gy: ponta.gy + 10 * dy } });
    const naCarga = ticksPor3(carga([ponta.id]));
    gravarEvidencia('C-COMBATE-01b-passo', { marcha3Tiles: marcha, carga3Tiles: naCarga, razao: marcha / naCarga, multiplicador: storm.multiplicadorVelocidade });
    expect(naCarga).toBeLessThan(marcha);
    // arredondamento por passo: a razao fica a menos de meio tick por passo do multiplicador
    expect(Math.abs(marcha / storm.multiplicadorVelocidade - naCarga)).toBeLessThanOrEqual(3 * 0.5);
  });

  it('3. em carga a ordem nao pega: MoveUnits deixa quem carrega como esta', () => {
    let s = step(s0, [carga()], gameData);
    s = step(s, [], gameData);
    const antes = s;
    s = step(s, [{ type: 'MoveUnits', unidades: tropa, destino: { gx: lider.gx - 10, gy: lider.gy } }], gameData);
    expect(emCarga(s)).toBe(tropa.length);
    for (const id of tropa) expect(s.unidades.porId[id]?.fsmData.cargaDirecao).toBe(antes.unidades.porId[id]?.fsmData.cargaDirecao);
  });

  it('4. so a infantaria corpo a corpo carrega; so atiradores e recusado', () => {
    const arqueiro = tropa[0] as string;
    const comArqueiro: GameState = {
      ...s0, unidades: { ...s0.unidades, porId: { ...s0.unidades.porId, [arqueiro]: { ...(s0.unidades.porId[arqueiro] as Unidade), tipo: 'bowman' } } },
    };
    const misto = step(comArqueiro, [carga([ponta.id, arqueiro])], gameData);
    expect(misto.unidades.porId[ponta.id]?.fsm).toBe(FSM_EM_CARGA);
    expect(misto.unidades.porId[arqueiro]?.fsm).not.toBe(FSM_EM_CARGA);
    const soArqueiro = step(comArqueiro, [carga([arqueiro])], gameData);
    expect(rejeicoes(soArqueiro.events)).toEqual(['sem-infantaria-corpo-a-corpo']);
    expect(rejeicoes(step(s0, [carga([])], gameData).events)).toEqual(['sem-unidades']);
  });

  it('5. encostado num inimigo no caminho, quem carrega passa a lutar', () => {
    // a ponta sai 6 tiles ao norte da fileira da frente da IA, uma coluna a oeste, e carrega para
    // o sul: passa rente ao canto da formacao, e ao chegar no tile encostado ja luta (sem parar
    // ocioso antes; com a coluna do inimigo, quem vem receber fecha o tile e a carga para antes)
    const inimigos = s0.unidades.ordem.map((id) => s0.unidades.porId[id] as Unidade).filter((u) => u.lado !== LADO_DO_JOGADOR && u.tipo === 'militia');
    const alvo = inimigos.reduce((a, b) => (b.gy < a.gy ? b : a));
    const noNorte = { ...ponta, gx: alvo.gx - 1, gy: alvo.gy - 6, direcao: 4 };
    const comPonta: GameState = { ...s0, unidades: { ...s0.unidades, porId: { ...s0.unidades.porId, [ponta.id]: noNorte } } };
    let s = step(comPonta, [carga([ponta.id])], gameData);
    s = ate(s, (x) => x.unidades.porId[ponta.id]?.fsm !== FSM_EM_CARGA);
    const u = s.unidades.porId[ponta.id] as Unidade;
    const contra = s.unidades.porId[u.fsmData.alvoUnidade ?? ''];
    gravarEvidencia('C-COMBATE-01b-contato', { partida: [noNorte.gx, noNorte.gy], ponta: [u.gx, u.gy, u.fsm], alvo: contra === undefined ? null : [contra.id, contra.gx, contra.gy] });
    expect(u.fsm).toBe('lutando');
    expect(contra?.lado).not.toBe(LADO_DO_JOGADOR);
    expect(Math.max(Math.abs((contra?.gx ?? 0) - u.gx), Math.abs((contra?.gy ?? 0) - u.gy))).toBe(1);
  });

  it('6. em paz, a carga e recusada com em-paz', () => {
    const s = step(comPaz, [carga()], gameData);
    expect(rejeicoes(s.events)).toEqual(['em-paz']);
    expect(emCarga(s)).toBe(0);
  });

  it('7. a distancia sai do RNG do estado: o rng anda, e duas corridas dao o mesmo estado', () => {
    const s1 = step(s0, [carga()], gameData);
    expect(s1.rng).not.toEqual(step(s0, [], gameData).rng);
    const correr = (): string => JSON.stringify(ate(step(s0, [carga()], gameData), (x) => emCarga(x) === 0));
    expect(correr()).toBe(correr());
  });
});
