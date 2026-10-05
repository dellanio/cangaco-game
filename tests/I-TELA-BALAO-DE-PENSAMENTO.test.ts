/**
 * I-TELA-BALAO-DE-PENSAMENTO — o morador mostra num balao o que vai fazer (pedido do operador,
 * 2026-10-05), como o TKMUnitThought do KaM (src/common/KM_Defaults.pas:710). Regra de render,
 * pura: "estado -> pensamento" e "tick -> aceso", com a fase por unidade.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { faseDaUnidade, mercadoriaDoBalao, pensamentoAceso, pensamentoDaUnidade, pensamentoNaTela } from '../src/render/pensamento';
import type { ConfigDoPensamento } from '../src/render/pensamento';
import type { DadosDaFsm, GameState } from '../src/sim/state';
import { createInitialState } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { aberturaDaFaseA, comandosNoTick } from './helpers/abertura';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { validarInterface } from '../tools/data-rules.js';
import { gravarEvidencia } from './helpers/evidence';

const config = JSON.parse(readFileSync('data/pensamento.json', 'utf8')) as ConfigDoPensamento;
const u = (fsm: string, fsmData: DadosDaFsm = {}) => ({ fsm, fsmData });

describe('I-TELA-BALAO-DE-PENSAMENTO', () => {
  it('(1) estado -> pensamento, por tabela', () => {
    const tabela: [string, DadosDaFsm, string | null, unknown][] = [
      ['indo_buscar', { tarefa: 't1' }, 'stone', { tipo: 'mercadoria', mercadoria: 'stone' }],
      ['indo_entregar', { tarefa: 't1', carga: 'timber' }, 'timber', { tipo: 'mercadoria', mercadoria: 'timber' }],
      ['indo_comer', { tarefa: 't2' }, null, { tipo: 'comer' }],
      ['indo_a_obra', { tarefa: 't3' }, null, { tipo: 'construir' }],
      ['indo_ocupar', { tarefa: 't4' }, null, { tipo: 'casa' }],
    ];
    for (const [fsm, dados, recurso, esperado] of tabela) {
      expect(pensamentoDaUnidade(u(fsm, dados), recurso), fsm).toEqual(esperado);
    }
    expect(mercadoriaDoBalao({ tipo: 'comer' }, config)).toBe(config.iconeDeComer);
    expect(mercadoriaDoBalao({ tipo: 'construir' }, config)).toBeNull();
    expect(mercadoriaDoBalao({ tipo: 'mercadoria', mercadoria: 'coal' }, config)).toBe('coal');
  });

  it('(2) sem destino, nenhum balao: ocioso, trabalhando dentro, martelando, e o serf sem mercadoria', () => {
    for (const fsm of ['ocioso', 'trabalhando', 'martelando', 'nivelando', 'colhendo', 'entregando', 'carregando', 'comendo']) {
      expect(pensamentoDaUnidade(u(fsm, { tarefa: 't1' }), 'stone'), fsm).toBeNull();
    }
    expect(pensamentoDaUnidade(u('indo_buscar'), null)).toBeNull();
  });

  it('(1) tick -> aceso: `duracaoTicks` a cada `intervaloTicks`, numa janela so, na fase da unidade', () => {
    const ids = ['u1', 'u2', 'u3', 'serf-7', 'laborer-12', 'u100'];
    const fases = new Set<number>();
    for (const id of ids) {
      const acesos: number[] = [];
      for (let tick = 0; tick < config.intervaloTicks; tick++) if (pensamentoAceso(tick, id, config)) acesos.push(tick);
      expect(acesos.length, id).toBe(config.duracaoTicks);
      // a janela e uma so, contigua no ciclo
      const quebras = acesos.filter((t, i) => i > 0 && t !== acesos[i - 1]! + 1).length;
      expect(quebras, id).toBeLessThanOrEqual(1);
      if (quebras === 1) expect(acesos[0], id).toBe(0);
      // o ciclo se repete
      for (let tick = 0; tick < config.intervaloTicks; tick++) {
        expect(pensamentoAceso(tick + config.intervaloTicks * 3, id, config)).toBe(pensamentoAceso(tick, id, config));
      }
      expect(faseDaUnidade(id, config.intervaloTicks)).toBe(faseDaUnidade(id, config.intervaloTicks));
      fases.add(faseDaUnidade(id, config.intervaloTicks));
    }
    // nao piscam todos juntos
    expect(fases.size).toBeGreaterThan(1);
  });

  it('pelo step: na abertura, os serfs a caminho mostram a mercadoria da tarefa, de vez em quando', () => {
    let s: GameState = createInitialState(gameData.economia.estadoInicial.semente);
    const abertura = aberturaDaFaseA(s);
    const vistos: Record<string, number> = {};
    let acesos = 0;
    let aCaminho = 0;
    for (let i = 0; i < 1500; i++) {
      s = step(s, comandosNoTick(s, abertura, i));
      for (const id of s.unidades.ordem) {
        const unidade = s.unidades.porId[id]!;
        if (pensamentoDaUnidade(unidade, null) !== null || unidade.fsm === 'indo_buscar') aCaminho++;
        const p = pensamentoNaTela(s, unidade, config);
        if (p === null) continue;
        acesos++;
        const chave = p.tipo === 'mercadoria' ? p.mercadoria : p.tipo;
        vistos[chave] = (vistos[chave] ?? 0) + 1;
      }
    }
    gravarEvidencia('I-TELA-BALAO-DE-PENSAMENTO', { ticks: 1500, aCaminho, acesos, vistos });
    expect(Object.keys(vistos).length).toBeGreaterThan(0);
    // de vez em quando, e nao o caminho inteiro
    expect(acesos).toBeLessThan(aCaminho);
  });

  it('o dado: o validador reprova o balao sempre aceso e o icone de comer que nao e mercadoria', () => {
    const ler = (nomes: readonly string[]) => Object.fromEntries(nomes.map((nome) => [nome, JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'))]));
    const dados = ler(ARQUIVOS), interfaceUi = ler(ARQUIVOS_DA_INTERFACE);
    expect(validarInterface(dados, interfaceUi)).toEqual([]);
    expect(validarInterface(dados, { ...interfaceUi, pensamento: { ...config, duracaoTicks: config.intervaloTicks } }))
      .toContain('interface/pensamento: duracaoTicks precisa ser menor que intervaloTicks (o balao aparece de vez em quando)');
    expect(validarInterface(dados, { ...interfaceUi, pensamento: { ...config, iconeDeComer: 'pizza' } }))
      .toContain("interface/pensamento: iconeDeComer 'pizza' nao e mercadoria de economy.json");
  });
});
