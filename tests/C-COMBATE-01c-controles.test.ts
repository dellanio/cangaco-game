/**
 * C-COMBATE-01c — os controles de formacao (plano em
 * docs/planos/2026-09-29-C-COMBATE-01c-controles-de-formacao.md). O que a tela MANDA, puro, e
 * o gesto do botao direito; o roteiro `tools/shots/C-COMBATE-01c.js` prova a tela.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { escaramucaComTropaDe, TROPA_DOS_TESTES_DE_FORMACAO } from './helpers/escaramuca-paz';
import { FSM_EM_CARGA } from '../src/sim/carga';
import { colunasDaFormacao } from '../src/sim/systems/marcha';
import { colunasAjustadas, colunasAtuais, direcaoDoArrasto, ordemDeFormacao, podeCarregar } from '../src/ui/formacao';
import { ordemDoBotaoDireito } from '../src/ui/ordem-militar';
import { textoDaRecusa } from '../src/ui/aviso-de-ordem';
import { criarEntradaDoMapa, LIMIAR_DA_CAIXA_PX } from '../src/input/colocar';
import type { GestosMilitares } from '../src/input/colocar';
import { criarFerramenta } from '../src/input/ferramenta';
import temaSertao from '../data/theme-sertao.json';
import { gravarEvidencia } from './helpers/evidence';

// a tropa fixa de 18: o mecanismo foi medido com ela (I-COMBATE-ESCARAMUCA-GANHAVEL)
const comPaz = escaramucaComTropaDe(TROPA_DOS_TESTES_DE_FORMACAO, gameData.economia.estadoInicial.semente);
const { pazAteTick: _paz, ...semPaz } = comPaz;
void _paz;
const s0: GameState = semPaz;
const tropa = s0.unidades.ordem.filter((id) => s0.unidades.porId[id]?.lado === LADO_DO_JOGADOR && s0.unidades.porId[id]?.tipo === gameData.escaramuca.tropaDoJogador.tipo);
const n = tropa.length;
const { colunasMin } = gameData.combate.formacao;

function ate(s: GameState, fim: (s: GameState) => boolean, teto = 1200): GameState {
  let atual = s;
  for (let t = 0; t < teto && !fim(atual); t += 1) atual = step(atual, [], gameData);
  return atual;
}
const parados = (s: GameState): boolean => tropa.every((id) => s.unidades.porId[id]?.fsm === 'ocioso');

describe('C-COMBATE-01c — os controles de formacao', () => {
  it('1. o arrasto do direito da o octante; abaixo do limiar, nenhum', () => {
    const o = { x: 100, y: 100 };
    const d = 3 * LIMIAR_DA_CAIXA_PX;
    const vetores: [number, number, number][] = [
      [0, -d, 0], [d, -d, 1], [d, 0, 2], [d, d, 3], [0, d, 4], [-d, d, 5], [-d, 0, 6], [-d, -d, 7],
    ];
    for (const [dx, dy, esperado] of vetores) expect(direcaoDoArrasto(o, { x: o.x + dx, y: o.y + dy })).toBe(esperado);
    expect(direcaoDoArrasto(o, { x: o.x + LIMIAR_DA_CAIXA_PX - 1, y: o.y })).toBeNull();
    expect(direcaoDoArrasto(o, null)).toBeNull();
  });

  it('2. +/− colunas anda 1 a partir da padrao da sim e prende em [colunasMin, n]', () => {
    const padrao = colunasDaFormacao(undefined, n, gameData);
    expect(colunasAtuais(null, n, gameData)).toBe(padrao);
    expect(colunasAjustadas(null, 1, n, gameData)).toBe(padrao + 1);
    expect(colunasAjustadas(null, -1, n, gameData)).toBe(padrao - 1);
    expect(colunasAjustadas(n, 1, n, gameData)).toBe(n);
    expect(colunasAjustadas(colunasMin, -1, n, gameData)).toBe(colunasMin);
  });

  it('3. refazer a formacao no lugar: destino no lider, a direcao dele, e os 18 param em fileiras de N', () => {
    const lider = s0.unidades.porId[tropa[0] as string] as Unidade;
    const colunas = colunasAjustadas(null, 2, n, gameData);
    const comando = ordemDeFormacao(s0, tropa, colunas, gameData);
    expect(comando).toEqual({ type: 'MoveUnits', unidades: tropa, destino: { gx: lider.gx, gy: lider.gy }, direcao: lider.direcao ?? 4, colunas });
    const s = ate(step(s0, [comando as NonNullable<typeof comando>], gameData), parados);
    const us = tropa.map((id) => s.unidades.porId[id] as Unidade);
    // a tropa olha para o sul: a fileira e uma linha de gy, com `colunas` homens
    const porFileira = new Map<number, number>();
    for (const u of us) porFileira.set(u.gy, (porFileira.get(u.gy) ?? 0) + 1);
    gravarEvidencia('C-COMBATE-01c-colunas', { colunas, fileiras: Object.fromEntries(porFileira) });
    expect(Math.max(...porFileira.values())).toBe(colunas);
    expect(porFileira.size).toBe(Math.ceil(n / colunas));
  });

  it('4. o botao direito leva direcao e colunas so na marcha, e deixa de fora quem carrega', () => {
    const destino = { gx: 30, gy: 30 };
    const marcha = ordemDoBotaoDireito(s0, gameData, LADO_DO_JOGADOR, tropa, destino, [], { direcao: 2, colunas: 6 });
    expect(marcha.comandos).toEqual([{ type: 'MoveUnits', unidades: tropa, destino, direcao: 2, colunas: 6 }]);
    const semFormacao = ordemDoBotaoDireito(s0, gameData, LADO_DO_JOGADOR, tropa, destino, []);
    expect(semFormacao.comandos).toEqual([{ type: 'MoveUnits', unidades: tropa, destino }]);

    const emCarga = step(s0, [{ type: 'StormAttack', unidades: [tropa[9] as string] }], gameData);
    expect(emCarga.unidades.porId[tropa[9] as string]?.fsm).toBe(FSM_EM_CARGA);
    const ordem = ordemDoBotaoDireito(emCarga, gameData, LADO_DO_JOGADOR, tropa, destino, []);
    expect(ordem.comandos).toEqual([{ type: 'MoveUnits', unidades: tropa.filter((id) => id !== tropa[9]), destino }]);
    const soQuemCarrega = ordemDoBotaoDireito(emCarga, gameData, LADO_DO_JOGADOR, [tropa[9] as string], destino, []);
    expect(soQuemCarrega).toEqual({ comandos: [], marcarDestino: null });
    expect(ordemDeFormacao(emCarga, [tropa[9] as string], 5, gameData)).toBeNull();
    expect(podeCarregar(emCarga, [tropa[9] as string], gameData)).toBe(false);
    expect(podeCarregar(s0, tropa, gameData)).toBe(true);
  });

  it('5. o gesto: a ordem sai ao soltar o direito, com o ponto de soltura; sair do mapa cancela', () => {
    const log: string[] = [];
    const gestos: GestosMilitares = {
      aoClicarVazio: () => log.push('clique'),
      aoCaixa: () => log.push('caixa'),
      aoOrdenar: (t, p, fim) => log.push(`ordem ${t.gx},${t.gy} ${p?.x},${p?.y} -> ${fim === null ? 'null' : `${fim.x},${fim.y}`}`),
    };
    const ferramenta = criarFerramenta();
    const entrada = criarEntradaDoMapa(ferramenta, () => log.push('comando'), undefined, gestos);
    expect(entrada.aoClicarDireito({ gx: 5, gy: 6 }, { x: 10, y: 20 })).toBe(false);
    expect(log).toEqual([]);
    entrada.aoSoltarDireito({ x: 90, y: 20 });
    expect(log).toEqual(['ordem 5,6 10,20 -> 90,20']);
    entrada.aoSoltarDireito({ x: 90, y: 20 });
    expect(log).toHaveLength(1);
    entrada.aoClicarDireito({ gx: 5, gy: 6 }, { x: 10, y: 20 });
    entrada.aoSairDoMapa();
    entrada.aoSoltarDireito({ x: 90, y: 20 });
    expect(log).toHaveLength(1);
    ferramenta.selecionar('storehouse');
    expect(entrada.aoClicarDireito({ gx: 5, gy: 6 }, { x: 10, y: 20 })).toBe(true);
    entrada.aoSoltarDireito({ x: 90, y: 20 });
    expect(log).toHaveLength(1);
  });

  it('6. o aviso: a investida em paz da o texto da paz; os tres motivos novos, o do tema', () => {
    const emPaz = step(comPaz, [{ type: 'StormAttack', unidades: tropa }], gameData);
    expect(textoDaRecusa(emPaz.events, 60)).toBe(temaSertao.ordem.emPaz.replace('{tempo}', '1:00'));
    const recusa = (command: 'StormAttack' | 'MoveUnits', motivo: string): GameEvent[] =>
      [{ type: 'command-rejected', command, unidade: null, motivo } as GameEvent];
    expect(textoDaRecusa(recusa('StormAttack', 'sem-infantaria-corpo-a-corpo'), 0)).toBe(temaSertao.ordem.semInfantaria);
    expect(textoDaRecusa(recusa('MoveUnits', 'direcao-invalida'), 0)).toBe(temaSertao.ordem.direcaoInvalida);
    expect(textoDaRecusa(recusa('MoveUnits', 'colunas-invalidas'), 0)).toBe(temaSertao.ordem.colunasInvalidas);
    expect(textoDaRecusa(recusa('MoveUnits', 'sem-unidades'), 0)).toBeNull();
  });
});
