/**
 * D-TRANSPORTE-01a — o armazem que aceita ou bloqueia cada mercadoria (plano em
 * docs/planos/2026-09-29-D-TRANSPORTE-01-armazem-liga-desliga.md). O comando
 * `SetStorehouseAccept`, o roteamento dos niveis 6 e 7 por mercadoria, o saneamento da tarefa
 * que ia ao armazem que passou a bloquear e a heranca do armazem novo (`Activate` do KaM).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, ID_DO_ARMAZEM, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, PredioCompleto, PredioEmObra, TarefaDeTransporte, Unidade } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { tileAndavel } from '../src/sim/pathfinding';
import { chaveDeTile, predioLigadoAoArmazem } from '../src/sim/estradas';
import { alvoDeNivelamento, hpTotalDoTipo } from '../src/sim/obra';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { gerarTarefas, sanearTarefas } from '../src/sim/systems/jobs';
import { aplicarSetStorehouseAccept } from '../src/sim/systems/armazem';
import { herdarNaoAceita } from '../src/sim/armazem';
import { comArmazemExtra, comProdutorOcupado, comSaida } from './helpers/producao-cenario';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const TIPO_DA_SAIDA = 'saida-cheia-para-armazem';

const aceite = (predio: string, mercadoria: string, aceita: boolean): Command =>
  ({ type: 'SetStorehouseAccept', predio, mercadoria, aceita });
const aplicar = (s: GameState, predio: string, mercadoria: string, aceita: boolean) =>
  aplicarSetStorehouseAccept(s, { type: 'SetStorehouseAccept', predio, mercadoria, aceita }, gameData);
const completo = (s: GameState, id: string): PredioCompleto => {
  const p = s.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`'${id}' deveria ser predio completo`);
  return p;
};
const armazensDoLado = (s: GameState): string[] => s.predios.ordem.filter((id) => {
  const p = s.predios.porId[id];
  return p?.estado === 'completo' && p.tipo === ID_DO_ARMAZEM && p.lado === LADO_DO_JOGADOR;
});
const tarefasDaSaida = (s: GameState): TarefaDeTransporte[] => s.jobs.tarefas.ordem
  .map((id) => s.jobs.tarefas.porId[id])
  .filter((t): t is TarefaDeTransporte => t !== undefined && t.tipo === TIPO_DA_SAIDA);

/** O canto de uma area aberta de `largura` x `altura`, andavel inteira, varrendo a partir da vila. */
function areaAberta(s: GameState, largura: number, altura: number): { gx: number; gy: number } {
  for (let r = 6; r < 50; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const c = naVila(d, r);
      let livre = true;
      for (let dy = 0; dy < altura && livre; dy += 1) {
        for (let dx = 0; dx < largura && livre; dx += 1) livre = tileAndavel(s, { gx: c.gx + dx, gy: c.gy + dy }, 'livre', gameData);
      }
      if (livre) return c;
    }
  }
  throw new Error('fixture: sem area aberta');
}

/**
 * Dois armazens na mesma rua, e uma serraria entre eles, bem mais perto do primeiro:
 *   [perto 3x3]  serraria  . . . . . . . . . .  [longe 3x3]
 * As portas numa linha de rua so. Sem unidade nenhuma: a geracao e o saneamento se medem sem
 * FSM; o teste de fim a fim poe o serf.
 */
function cenarioDosDoisArmazens(): GameState {
  let s: GameState = { ...createInitialState(1), unidades: { porId: {}, ordem: [] } };
  const o = areaAberta(s, 26, 6);
  const x0 = o.gx + 1;
  const yPorta = o.gy + 3; // borda sul do armazem 3x3 em (x0, o.gy)
  s = comArmazemExtra(s, 'perto', x0, o.gy);
  s = comProdutorOcupado(s, { tipo: 'sawmill', id: 'serraria', unidade: 'carpinteiro', gx: x0 + 5, gy: yPorta - 2 }, gameData);
  s = comArmazemExtra(s, 'longe', x0 + 20, o.gy);
  const rua = [];
  for (let x = x0 + 1; x <= x0 + 21; x += 1) rua.push({ gx: x, gy: yPorta });
  s = { ...s, estradas: { ...s.estradas, ...Object.fromEntries(rua.map((t) => [chaveDeTile(t), true as const])) } };
  for (const id of ['perto', 'serraria', 'longe']) {
    if (!predioLigadoAoArmazem(s, completo(s, id), gameData)) throw new Error(`fixture: '${id}' nao ligado`);
  }
  return s;
}

describe('D-TRANSPORTE-01a — o comando SetStorehouseAccept', () => {
  const s0 = createInitialState(1);
  const [armazem] = armazensDoLado(s0);
  if (armazem === undefined) throw new Error('a vila inicial deveria ter armazem');

  it('bloqueia e libera; a lista sai ordenada; o mesmo valor devolve o mesmo estado; tudo aceito apaga o campo', () => {
    expect(completo(s0, armazem).naoAceita).toBeUndefined();
    const s1 = step(s0, [aceite(armazem, 'timber', false), aceite(armazem, 'stone', false)], gameData);
    expect(completo(s1, armazem).naoAceita).toEqual(['stone', 'timber']);
    expect(aplicar(s1, armazem, 'timber', false).state).toBe(s1);
    expect(aplicar(s1, armazem, 'corn', true).state).toBe(s1);
    const s2 = step(s1, [aceite(armazem, 'timber', true), aceite(armazem, 'stone', true)], gameData);
    expect('naoAceita' in completo(s2, armazem)).toBe(false);
    expect(s2.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
  });

  it('recusa predio que nao existe, predio que nao e armazem e mercadoria fora do dado, sem mudar o estado', () => {
    const escola = s0.predios.ordem.find((id) => s0.predios.porId[id]?.tipo !== ID_DO_ARMAZEM);
    if (escola === undefined) throw new Error('a vila inicial deveria ter um predio que nao e armazem');
    const casos: [string, string, string][] = [
      ['nao-ha', 'timber', 'predio-inexistente'],
      [escola, 'timber', 'nao-e-armazem'],
      [armazem, 'banana', 'mercadoria-desconhecida'],
    ];
    for (const [predio, mercadoria, motivo] of casos) {
      const r = aplicar(s0, predio, mercadoria, false);
      expect(r.state).toBe(s0);
      expect(r.events).toEqual([{ type: 'command-rejected', command: 'SetStorehouseAccept', predio, mercadoria, motivo }]);
    }
  });
});

describe('D-TRANSPORTE-01a — a sobra vai ao armazem mais perto que ACEITA', () => {
  const base = comSaida(cenarioDosDoisArmazens(), 'serraria', { timber: 2 });

  it('sem bloqueio, a madeira vai ao perto', () => {
    const t = tarefasDaSaida(gerarTarefas(base));
    expect(t.map((x) => x.destino)).toEqual(['perto', 'perto']);
  });

  it('o perto bloqueia timber: a madeira vai ao longe, e a mercadoria que ele aceita continua indo ao perto', () => {
    const comDuas = comSaida(aplicar(base, 'perto', 'timber', false).state, 'serraria', { timber: 2, stone: 1 });
    const t = tarefasDaSaida(gerarTarefas(comDuas));
    expect(t.filter((x) => x.mercadoria === 'timber').map((x) => x.destino)).toEqual(['longe', 'longe']);
    expect(t.filter((x) => x.mercadoria === 'stone').map((x) => x.destino)).toEqual(['perto']);
  });

  it('todos os armazens do lado bloqueiam: nao nasce tarefa, e a madeira fica na gaveta', () => {
    let s = base;
    for (const id of armazensDoLado(s)) s = aplicar(s, id, 'timber', false).state;
    const depois = gerarTarefas(s);
    expect(tarefasDaSaida(depois)).toEqual([]);
    expect(completo(depois, 'serraria').estoque.saida['timber']).toBe(2);
  });

  it('a tarefa aberta para o perto sai no saneamento quando ele bloqueia, e renasce para o longe', () => {
    const comAbertas = gerarTarefas(base);
    expect(tarefasDaSaida(comAbertas).map((t) => t.destino)).toEqual(['perto', 'perto']);
    const bloqueado = aplicar(comAbertas, 'perto', 'timber', false).state;
    const saneado = sanearTarefas(bloqueado).state;
    expect(tarefasDaSaida(saneado)).toEqual([]);
    expect(tarefasDaSaida(gerarTarefas(saneado)).map((t) => t.destino)).toEqual(['longe', 'longe']);
  });

  it('a tarefa em carregando termina a entrega no perto (PARA REVISAO: o KaM abandona)', () => {
    const comAbertas = gerarTarefas(base);
    const [primeira] = tarefasDaSaida(comAbertas);
    if (primeira === undefined) throw new Error('deveria haver tarefa');
    const serf: Unidade = {
      lado: LADO_DO_JOGADOR, id: 'serf-carregado', tipo: 'serf', gx: 0, gy: 0,
      fsm: 'carregando', fsmData: {}, condicao: condicaoCheiaDoTipo('serf'),
    };
    const carregando: TarefaDeTransporte = { ...primeira, estado: 'carregando', reclamadaPor: serf.id };
    const s: GameState = {
      ...comAbertas,
      unidades: { porId: { ...comAbertas.unidades.porId, [serf.id]: serf }, ordem: [...comAbertas.unidades.ordem, serf.id] },
      jobs: { tarefas: { ...comAbertas.jobs.tarefas, porId: { ...comAbertas.jobs.tarefas.porId, [primeira.id]: carregando } } },
    };
    const saneado = sanearTarefas(aplicar(s, 'perto', 'timber', false).state).state;
    expect(saneado.jobs.tarefas.porId[primeira.id]).toEqual(carregando);
  });

  it('de fim a fim: com o perto bloqueando timber, o serf entrega a madeira no longe', () => {
    // na rua, na porta da serraria (a serraria fica duas linhas acima da rua)
    const serraria = completo(base, 'serraria');
    const serf: Unidade = {
      lado: LADO_DO_JOGADOR, id: 'serf-1', tipo: 'serf', gx: serraria.gx, gy: serraria.gy + 2,
      fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('serf'),
    };
    let s: GameState = { ...base, unidades: { porId: { ...base.unidades.porId, [serf.id]: serf }, ordem: [...base.unidades.ordem, serf.id] } };
    s = step(s, [aceite('perto', 'timber', false)], gameData);
    const entregas: Record<string, number> = {};
    for (let t = 0; t < 3000 && (entregas['longe'] ?? 0) < 2; t += 1) {
      s = step(s, [], gameData);
      for (const ev of s.events) {
        if (ev.type === 'task-completed' && ev.mercadoria === 'timber') entregas[ev.destino] = (entregas[ev.destino] ?? 0) + 1;
      }
    }
    expect(entregas).toEqual({ longe: 2 });
    gravarEvidencia('D-TRANSPORTE-01a-armazem-aceita', { entregasDeMadeira: entregas, tick: s.tick });
  });
});

describe('D-TRANSPORTE-01a — o armazem novo herda o que o primeiro bloqueia', () => {
  it('a obra de armazem que completa copia o naoAceita do primeiro armazem do lado', () => {
    const s0 = createInitialState(1);
    const [primeiro] = armazensDoLado(s0);
    if (primeiro === undefined) throw new Error('a vila inicial deveria ter armazem');
    // a obra com todo o material e o nivelamento feitos, a uma martelada do fim, numa area
    // aberta (o armazem so se planta depois da serraria; aqui a obra e posta a mao)
    const lugar = areaAberta(s0, 3, 4);
    const novoId = 'armazem-novo';
    const quasePronta: PredioEmObra = {
      lado: LADO_DO_JOGADOR, id: novoId, tipo: ID_DO_ARMAZEM, ...lugar, estado: 'obra',
      hp: hpTotalDoTipo(ID_DO_ARMAZEM) - 1, obra: { faltam: {}, nivelamento: alvoDeNivelamento(ID_DO_ARMAZEM) },
    };
    let s: GameState = { ...s0, predios: { porId: { ...s0.predios.porId, [novoId]: quasePronta }, ordem: [...s0.predios.ordem, novoId] } };
    s = step(s, [aceite(primeiro, 'timber', false), aceite(primeiro, 'corn', false)], gameData);
    expect(s.predios.porId[novoId]?.estado).toBe('obra');
    for (let t = 0; t < 3000 && s.predios.porId[novoId]?.estado !== 'completo'; t++) s = step(s, [], gameData);
    expect(completo(s, novoId).naoAceita).toEqual(['corn', 'timber']);
  });

  it('com o primeiro aceitando tudo, o novo fica intacto, sem o campo', () => {
    const s = comArmazemExtra(createInitialState(1), 'extra', 0, 0);
    const extra = completo(s, 'extra');
    expect(herdarNaoAceita(s, extra)).toBe(extra);
    expect('naoAceita' in extra).toBe(false);
  });
});

describe('D-TRANSPORTE-01a — determinismo', () => {
  it('a mesma lista de comandos da o mesmo estado nas duas corridas', () => {
    const correr = (): GameState => {
      let s = comSaida(cenarioDosDoisArmazens(), 'serraria', { timber: 3 });
      s = step(s, [aceite('perto', 'timber', false)], gameData);
      for (let t = 0; t < 50; t++) s = step(s, t === 20 ? [aceite('perto', 'timber', true)] : [], gameData);
      return s;
    };
    expect(JSON.stringify(correr())).toBe(JSON.stringify(correr()));
  });
});
