/**
 * D-PRODUCAO-03b — ENCOMENDAS DAS OFICINAS, o painel. Plano:
 * docs/planos/2026-09-29-D-PRODUCAO-03b-painel-encomenda.md.
 *
 * O seletor (`painelDoPredio.encomenda`) e as funcoes puras da tela (`ui/encomenda.ts`),
 * levadas ao `step`: o comando que o botao monta e o que a sim aplica, e o aviso le o evento
 * que a sim emite. Na cadeia do ferro com as ferrarias SEM encomenda (como a 03a).
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { Command } from '../src/sim/commands';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { painelDoPredio } from '../src/sim/selectors';
import type { PainelDoPredio } from '../src/sim/selectors';
import { salvar } from '../src/sim/save';
import { comandoDeEncomenda, semEncomenda, textoDaEncomendaCumprida } from '../src/ui/encomenda';
import { cenarioDaCadeiaDoFerro, comSaida } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const DADOS: GameData = gameData;
const FERRO_E_CARVAO = 20;
/** Teto de SEGURANCA: a 03a mediu o deposito de uma peca encomendada perto do tick 430. */
const TETO = 6000;
/** Ticks antes do deposito em que a partida do roteiro e gravada: 3 s de jogo a 10 Hz. */
const ANTES_DO_DEPOSITO = 30;
const ROTULO = 'Cumprida: {predio}';

const evidencia: Record<string, unknown> = {};

const completo = (e: GameState, id: string): PredioCompleto => {
  const p = e.predios.porId[id];
  if (p?.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
};

function inicio(): GameState {
  const s = cenarioDaCadeiaDoFerro(DADOS, 6, false);
  return comSaida(s, 'arm', { ...completo(s, 'arm').estoque.saida, iron: FERRO_E_CARVAO, coal: FERRO_E_CARVAO });
}

function encomendaDe(e: GameState, id: string): NonNullable<PainelDoPredio['encomenda']> {
  const enc = painelDoPredio(e, id, DADOS)?.encomenda;
  if (enc === null || enc === undefined) throw new Error(`'${id}' deveria ter encomenda no painel`);
  return enc;
}

const faltas = (enc: NonNullable<PainelDoPredio['encomenda']>): Record<string, number> =>
  Object.fromEntries(enc.saidas.map((s) => [s.mercadoria, s.falta]));

function aplicar(e: GameState, comando: Command | null): GameState {
  if (comando === null) throw new Error('o botao deveria montar um comando');
  const r = step(e, [comando], DADOS);
  expect(r.events.some((ev) => ev.type === 'command-rejected')).toBe(false);
  return r;
}

describe('D-PRODUCAO-03b — o seletor da encomenda', () => {
  it('a oficina recem-nascida: as tres saidas em zero, nada em curso, "sem encomenda"', () => {
    const enc = encomendaDe(inicio(), 'ws1');
    expect(enc.saidas.map((s) => s.mercadoria)).toEqual(['sword', 'pike', 'crossbow']);
    expect(faltas(enc)).toEqual({ sword: 0, pike: 0, crossbow: 0 });
    expect(enc.emCurso).toBeNull();
    expect(enc.maxima).toBe(DADOS.producao.encomenda.maxima);
    expect(semEncomenda(enc)).toBe(true);
    // e a ordem e a de `economia.mercadorias`, nao a da receita
    const ordem = enc.saidas.map((s) => DADOS.economia.mercadorias.indexOf(s.mercadoria));
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  });

  it('quem nao escolhe saida nao tem encomenda: a fundicao e o armazem', () => {
    const s = inicio();
    expect(painelDoPredio(s, 'fu1', DADOS)?.encomenda).toBeNull();
    expect(painelDoPredio(s, 'arm', DADOS)?.encomenda).toBeNull();
    expect(encomendaDe(s, 'as1').saidas.map((x) => x.mercadoria).sort()).toEqual(['iron_armor', 'iron_shield']);
  });
});

describe('D-PRODUCAO-03b — o botao −/+ levado ao step', () => {
  it('+ sobe a falta da saida em 1 e mantem as outras', () => {
    let s = inicio();
    s = aplicar(s, comandoDeEncomenda('ws1', encomendaDe(s, 'ws1'), 'pike', 1));
    expect(faltas(encomendaDe(s, 'ws1'))).toEqual({ sword: 0, pike: 1, crossbow: 0 });
    s = aplicar(s, comandoDeEncomenda('ws1', encomendaDe(s, 'ws1'), 'sword', 1));
    // o ciclo pode ja ter comecado e descontado a lanca: a conta e falta + em curso
    const enc = encomendaDe(s, 'ws1');
    const pedidas = { ...faltas(enc) };
    if (enc.emCurso !== null) pedidas[enc.emCurso] = (pedidas[enc.emCurso] ?? 0) + 1;
    expect(pedidas).toEqual({ sword: 1, pike: 1, crossbow: 0 });
  });

  it('− no zero e + no teto nao montam comando', () => {
    const s = inicio();
    const enc = encomendaDe(s, 'ws1');
    expect(comandoDeEncomenda('ws1', enc, 'sword', -1)).toBeNull();
    const cheia = aplicar(s, comandoDeEncomenda('ws1', enc, 'sword', enc.maxima));
    const encCheia = encomendaDe(cheia, 'ws1');
    expect(encCheia.saidas.find((x) => x.mercadoria === 'sword')?.falta).toBe(enc.maxima);
    expect(comandoDeEncomenda('ws1', encCheia, 'sword', 1)).toBeNull();
    // o comando grampeia: um salto maior que o teto manda o teto, e a sim aceita
    const grampeado = comandoDeEncomenda('ws1', enc, 'pike', enc.maxima + 5);
    expect(grampeado?.type === 'SetProductionQuota' ? grampeado.cota['pike'] : null).toBe(enc.maxima);
  });

  it('mercadoria que nao e saida da oficina nao monta comando', () => {
    expect(comandoDeEncomenda('ws1', encomendaDe(inicio(), 'ws1'), 'iron_armor', 1)).toBeNull();
  });
});

describe('D-PRODUCAO-03b — o ciclo e o aviso', () => {
  const s1 = aplicar(inicio(), comandoDeEncomenda('ws1', encomendaDe(inicio(), 'ws1'), 'sword', 1));
  let s = s1;
  let comeco: GameState | null = null;
  let deposito: GameState | null = null;
  for (let t = 0; t < TETO && deposito === null; t += 1) {
    s = step(s, [], DADOS);
    if (comeco === null && (completo(s, 'ws1').producao?.progresso ?? 0) > 0) comeco = s;
    if (s.events.some((e) => e.type === 'production-order-completed' && e.predio === 'ws1')) deposito = s;
  }

  it('com o ciclo em andamento, o seletor diz a espada em curso e a falta ja descontada', () => {
    expect(comeco).not.toBeNull();
    const enc = encomendaDe(comeco as GameState, 'ws1');
    evidencia['comecoDoCiclo'] = { tick: comeco?.tick, encomenda: enc };
    expect(enc.emCurso).toBe('sword');
    expect(faltas(enc)).toEqual({ sword: 0, pike: 0, crossbow: 0 });
    expect(semEncomenda(enc)).toBe(false);
  });

  it('no tick do evento o aviso tem o nome do predio; nos outros ticks, nada', () => {
    expect(deposito).not.toBeNull();
    const d = deposito as GameState;
    const texto = textoDaEncomendaCumprida(d, ROTULO, (tipo) => `<${tipo}>`);
    evidencia['aviso'] = { tick: d.tick, texto };
    expect(texto).toBe(`Cumprida: <${completo(d, 'ws1').tipo}>`);
    expect(textoDaEncomendaCumprida(comeco as GameState, ROTULO, (tipo) => tipo)).toBeNull();
    expect(textoDaEncomendaCumprida(step(d, [], DADOS), ROTULO, (tipo) => tipo)).toBeNull();
    // depois de cumprida, o painel volta a dizer "sem encomenda"
    expect(semEncomenda(encomendaDe(d, 'ws1'))).toBe(true);
  });

  it('a encomenda cumprida de uma oficina da IA nao vira aviso para o jogador', () => {
    const d = deposito as GameState;
    const daIa: GameState = {
      ...d,
      predios: { ...d.predios, porId: { ...d.predios.porId, ws1: { ...completo(d, 'ws1'), lado: LADO_DO_JOGADOR + 1 } } },
    };
    expect(textoDaEncomendaCumprida(daIa, ROTULO, (tipo) => tipo)).toBeNull();
  });

  it('grava a partida do roteiro: a espada em curso, a encomenda em zero, perto do deposito', () => {
    expect(deposito).not.toBeNull();
    const alvo = (deposito as GameState).tick - ANTES_DO_DEPOSITO;
    let r = s1;
    while (r.tick < alvo) r = step(r, [], DADOS);
    const enc = encomendaDe(r, 'ws1');
    expect(enc.emCurso).toBe('sword');
    expect(semEncomenda(enc)).toBe(false);
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/D-PRODUCAO-03b.save.txt`, salvar(r));
    evidencia['partidaDoRoteiro'] = { tick: r.tick, depositoNoTick: (deposito as GameState).tick, encomenda: enc };
    gravarEvidencia('D-PRODUCAO-03b-painel-encomenda', evidencia);
  });
});
