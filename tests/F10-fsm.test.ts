/**
 * F10 — a FSM do serf, ciclo feliz: ocioso -> indo_buscar -> carregando -> indo_entregar ->
 * entregando -> ocioso (GDD §6.2). As falhas e o `devolvendo` sao do arquivo seguinte.
 *
 * O aceite escrito no BUILD_PLAN: armazem com 10 stone e uma obra pedindo 2 stone; apos N
 * ticks a obra recebeu 2 e o armazem tem 8.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { Command } from '../src/sim/commands';
import { createInitialState } from '../src/sim/state';
import type { GameEvent, GameState, PredioCompleto, PredioEmObra } from '../src/sim/state';
import { buscarCaminho, custoDoPasso } from '../src/sim/pathfinding';
import { posicaoDaUnidade } from '../src/sim/selectors';
import { disponivelNaOrigem, reservadoNaOrigem, reservadoNoDestino } from '../src/sim/reservas';
import { step } from '../src/sim/tick';
import { compararComESemSave, deepFreeze } from './helpers/determinism';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { bensPorMercadoria, violacoesDaFsm } from './helpers/serf-invariantes';
import {
  armazemDoCenario, cenarioLigado, comEstradas, comObra, comPedraNaSaida, inicial, linhaH, linhaV, semAUnidade,
  serfsDoCenario, tile,
} from './helpers/jobs-cenario';

const armazem = armazemDoCenario(inicial);
const serfs = serfsDoCenario(inicial);
const serfNo = (i: number): string => {
  const id = serfs[i];
  if (id === undefined) throw new Error(`fixture: o cenario deveria ter o serf ${i}`);
  return id;
};
const serfA = serfNo(0);

/** So o primeiro serf: os outros tres saem do estado. */
const soUmSerf = (estado: GameState): GameState => serfs.slice(1).reduce((e, id) => semAUnidade(e, id), estado);

/** O cenario do aceite: o armazem com 10 de pedra na saida, uma obra pedindo 2, rua ligando os dois. */
const cenarioDoAceite = (): GameState => comPedraNaSaida(cenarioLigado({ stone: 2 }), armazem.id, 10);

const saidaDoArmazem = (estado: GameState, m: string): number => {
  const p = estado.predios.porId[armazem.id] as PredioCompleto;
  return p.estoque.saida[m] ?? 0;
};
const faltamDaObra = (estado: GameState, m: string): number => ((estado.predios.porId['obra-a'] as PredioEmObra).obra.faltam[m] ?? 0);
const fsmDe = (estado: GameState, id: string): string => estado.unidades.porId[id]?.fsm ?? 'sumiu';
const tarefasDe = (estado: GameState) => estado.jobs.tarefas.ordem.map((id) => estado.jobs.tarefas.porId[id]);

interface Registro { readonly estado: GameState; readonly eventos: readonly GameEvent[] }

/** Roda ate `parar(estado)` ou `maximo` ticks; guarda o estado de cada tick e todos os eventos. */
function rodar(inicio: GameState, parar: (e: GameState) => boolean, maximo = 600): { passos: Registro[]; ticks: number; eventos: GameEvent[] } {
  const passos: Registro[] = [{ estado: inicio, eventos: [] }];
  const eventos: GameEvent[] = [];
  let atual = inicio;
  for (let i = 0; i < maximo && !parar(atual); i++) {
    atual = step(atual, []);
    passos.push({ estado: atual, eventos: atual.events });
    eventos.push(...atual.events);
  }
  return { passos, ticks: passos.length - 1, eventos };
}

const quieto = (e: GameState): boolean =>
  e.tick > 2 && e.jobs.tarefas.ordem.length === 0 && serfsDoCenario(e).every((id) => fsmDe(e, id) === 'ocioso');

describe('F10 — aceite: 10 stone no armazem, obra pedindo 2 -> obra recebe 2, armazem fica com 8', () => {
  const inicioDoAceite = cenarioDoAceite();
  const { passos, ticks, eventos } = rodar(inicioDoAceite, quieto);
  const fim = passos[passos.length - 1]?.estado as GameState;

  it('a obra recebeu os 2 (faltam.stone 0) e o armazem tem 8 na saida', () => {
    expect(saidaDoArmazem(inicioDoAceite, 'stone')).toBe(10);
    expect(faltamDaObra(inicioDoAceite, 'stone')).toBe(2);
    expect(faltamDaObra(fim, 'stone')).toBe(0);
    expect(saidaDoArmazem(fim, 'stone')).toBe(8);
  });

  it('terminou por si, em poucos ticks (nao estourou o limite), e ninguem ficou carregando nem com tarefa', () => {
    expect(quieto(fim)).toBe(true);
    expect(ticks).toBeGreaterThan(10);
    expect(ticks).toBeLessThan(200);
    for (const id of serfsDoCenario(fim)) expect(fim.unidades.porId[id]?.fsmData).toEqual({});
    expect(tarefasDe(fim)).toEqual([]);
  });

  it('duas entregas, dois eventos `task-completed`, nenhum `task-released` (nada falhou)', () => {
    expect(eventos.filter((e) => e.type === 'task-completed')).toHaveLength(2);
    expect(eventos.filter((e) => e.type === 'task-completed').every((e) => e.type === 'task-completed' && e.obra === 'obra-a' && e.mercadoria === 'stone')).toBe(true);
    expect(eventos.filter((e) => e.type === 'task-released')).toEqual([]);
  });

  it('os bens se conservam do comeco ao fim: 2 sairam do armazem, 2 entraram na obra', () => {
    expect(bensPorMercadoria(fim).stone).toBe(bensPorMercadoria(inicioDoAceite).stone);
  });

  it('um serf so tambem chega la, em duas viagens seguidas', () => {
    const sozinho = rodar(soUmSerf(cenarioDoAceite()), quieto);
    const f = sozinho.passos[sozinho.passos.length - 1]?.estado as GameState;
    expect(faltamDaObra(f, 'stone')).toBe(0);
    expect(saidaDoArmazem(f, 'stone')).toBe(8);
    expect(sozinho.eventos.filter((e) => e.type === 'task-completed')).toHaveLength(2);
    expect(sozinho.ticks).toBeGreaterThan(ticks); // um serf e mais lento que quatro
  });
});

describe('F10 — a sequencia de estados de um serf sozinho, numa viagem so', () => {
  const inicio = soUmSerf(comPedraNaSaida(cenarioLigado({ stone: 1 }), armazem.id, 10));
  const { passos } = rodar(inicio, quieto);

  it('e exatamente a do GDD §6.2, sem estado novo e sem pular nenhum', () => {
    const vistos = passos.map((p) => fsmDe(p.estado, serfA));
    const distintos = vistos.filter((f, i) => i === 0 || f !== vistos[i - 1]);
    expect(distintos).toEqual(['ocioso', 'indo_buscar', 'carregando', 'indo_entregar', 'entregando', 'ocioso']);
  });

  it('`carregando` e `entregando` duram UM tick cada (nao ha tempo de manuseio no dado)', () => {
    const vistos = passos.map((p) => fsmDe(p.estado, serfA));
    expect(vistos.filter((f) => f === 'carregando')).toHaveLength(1);
    expect(vistos.filter((f) => f === 'entregando')).toHaveLength(1);
  });

  it('em cada fase a tarefa e as reservas sao as do contrato', () => {
    const primeiro = (f: string): GameState => (passos.find((p) => fsmDe(p.estado, serfA) === f) as Registro).estado;

    const buscando = primeiro('indo_buscar');
    expect(tarefasDe(buscando).map((t) => t?.estado)).toEqual(['reclamada']);
    expect(reservadoNaOrigem(buscando, armazem.id, 'stone')).toBe(1);
    expect(reservadoNoDestino(buscando, 'obra-a', 'stone')).toBe(1);
    expect(saidaDoArmazem(buscando, 'stone')).toBe(10); // ainda nada saiu

    const carregando = primeiro('carregando');
    expect(tarefasDe(carregando).map((t) => t?.estado)).toEqual(['reclamada']); // a coleta e no PROXIMO tick

    const entregando = primeiro('indo_entregar');
    expect(tarefasDe(entregando).map((t) => t?.estado)).toEqual(['carregando']);
    expect(reservadoNaOrigem(entregando, armazem.id, 'stone')).toBe(0); // a reserva da origem foi consumida...
    expect(reservadoNoDestino(entregando, 'obra-a', 'stone')).toBe(1); // ...a do destino continua
    expect(saidaDoArmazem(entregando, 'stone')).toBe(9); // o material SAIU do armazem
    expect(disponivelNaOrigem(entregando, armazem.id, 'stone')).toBe(9);
    expect(entregando.unidades.porId[serfA]?.fsmData.carga).toBe('stone');
    expect(faltamDaObra(entregando, 'stone')).toBe(1); // e a obra ainda nao recebeu

    const entregue = primeiro('entregando');
    expect(faltamDaObra(entregue, 'stone')).toBe(1); // a entrega e no tick seguinte

    const fim = passos[passos.length - 1]?.estado as GameState;
    expect(faltamDaObra(fim, 'stone')).toBe(0);
    expect(tarefasDe(fim)).toEqual([]);
  });

  it('o material sai do armazem NO tick exato em que a tarefa passa a carregando (e nao antes)', () => {
    const i = passos.findIndex((p) => fsmDe(p.estado, serfA) === 'indo_entregar');
    const antes = passos[i - 1]?.estado as GameState;
    const depois = passos[i]?.estado as GameState;
    expect(saidaDoArmazem(antes, 'stone')).toBe(10);
    expect(saidaDoArmazem(depois, 'stone')).toBe(9);
    expect(antes.jobs.tarefas.porId[depois.unidades.porId[serfA]?.fsmData.tarefa ?? '']?.estado).toBe('reclamada');
    expect(depois.jobs.tarefas.porId[depois.unidades.porId[serfA]?.fsmData.tarefa ?? '']?.estado).toBe('carregando');
  });
});

describe('F10 — o movimento: um passo custa o que o dado diz, e a posicao nunca teleporta', () => {
  /** Uma rua longa: do armazem (porta em (29,33)) ate uma obra a leste, 18 passos de estrada. */
  const cenarioLongo = (): GameState => soUmSerf(comEstradas(
    comObra(comPedraNaSaida(inicial, armazem.id, 10), 'obra-a', { gx: 44, gy: 34, faltam: { stone: 1 } }),
    [...linhaV(29, 33, 36), ...linhaH(29, 46, 36)],
  ));
  const inicioLongo = cenarioLongo();
  const passosDaEntrega = buscarCaminho(inicioLongo, tile(29, 33), [tile(44, 36), tile(45, 36), tile(46, 36)], 'estrada')?.tiles.length ?? 0;
  const { passos: passosLongos } = rodar(inicioLongo, quieto);

  // o cenario curto (5 tiles de rua) para os testes de posicao
  const inicio = soUmSerf(comPedraNaSaida(cenarioLigado({ stone: 1 }), armazem.id, 10));
  const { passos } = rodar(inicio, quieto);

  it('cada passo dura exatamente `ticksPorTile` (reto) ou `ticksPorTileDiagonal`, pelo terreno do tile de destino', () => {
    let ultimoTile = { gx: inicioLongo.unidades.porId[serfA]?.gx ?? -1, gy: inicioLongo.unidades.porId[serfA]?.gy ?? -1 };
    let tickDaChegadaAnterior = 0;
    let passosPuros = 0;
    let primeiroPasso = true;
    for (const { estado } of passosLongos) {
      const u = estado.unidades.porId[serfA];
      if (!u) continue;
      if (u.gx !== ultimoTile.gx || u.gy !== ultimoTile.gy) {
        if (!primeiroPasso) {
          const esperado = custoDoPasso(estado.estradas, ultimoTile, { gx: u.gx, gy: u.gy }, gameData);
          const gasto = estado.tick - tickDaChegadaAnterior;
          // nunca MENOS que o dado manda; passos que incluem uma parada (coleta, entrega) gastam mais
          expect(gasto, `passo (${ultimoTile.gx},${ultimoTile.gy}) -> (${u.gx},${u.gy}) no tick ${estado.tick}`).toBeGreaterThanOrEqual(esperado);
          if (gasto === esperado) passosPuros += 1;
        }
        primeiroPasso = false;
        ultimoTile = { gx: u.gx, gy: u.gy };
        tickDaChegadaAnterior = estado.tick;
      }
    }
    // a viagem carregada tem `passosDaEntrega` passos e so o primeiro inclui o tick da coleta
    expect(passosDaEntrega).toBeGreaterThan(10);
    expect(passosPuros).toBeGreaterThanOrEqual(passosDaEntrega - 1);
  });

  it('na estrada o serf anda `ticksPorTile.aPe.estrada` ticks por tile', () => {
    const indoEntregar = passos.filter((p) => fsmDe(p.estado, serfA) === 'indo_entregar');
    const tiles = indoEntregar.map((p) => `${p.estado.unidades.porId[serfA]?.gx},${p.estado.unidades.porId[serfA]?.gy}`);
    // ticks consecutivos em cada tile da rua (menos o primeiro e o ultimo, onde ha borda de estado)
    const corridas: number[] = [];
    let n = 1;
    for (let i = 1; i < tiles.length; i++) {
      if (tiles[i] === tiles[i - 1]) n += 1;
      else { corridas.push(n); n = 1; }
    }
    const meio = corridas.slice(1);
    expect(meio.length).toBeGreaterThan(0);
    for (const c of meio) expect(c).toBe(gameData.movimento.ticksPorTile.aPe.estrada);
  });

  it('a posicao visivel e continua: nunca anda mais que o passo maximo por tick, e para quando nao se move', () => {
    const { aPe } = gameData.movimento.ticksPorTile;
    const { aPe: diag } = gameData.movimento.ticksPorTileDiagonal;
    const maximoPorTick = Math.max(...Object.values(aPe).map((c) => 1 / c), ...Object.values(diag).map((c) => Math.SQRT2 / c));
    let anterior = posicaoDaUnidade(passos[0]?.estado as GameState, (passos[0]?.estado as GameState).unidades.porId[serfA] as never, gameData);
    let parados = 0;
    let andando = 0;
    for (const { estado } of passos.slice(1)) {
      const u = estado.unidades.porId[serfA];
      if (!u) continue;
      const pos = posicaoDaUnidade(estado, u, gameData);
      const d = Math.hypot(pos.gx - anterior.gx, pos.gy - anterior.gy);
      expect(d, `tick ${estado.tick}`).toBeLessThanOrEqual(maximoPorTick + 1e-9);
      if (d === 0) parados += 1;
      else andando += 1;
      anterior = pos;
    }
    expect(andando).toBeGreaterThan(10);
    expect(parados).toBeGreaterThan(0); // o tick de `carregando` e o de `entregando`
  });

  it('a posicao e o tile quando ha progresso 0 e fica ENTRE o tile e o proximo quando ha progresso', () => {
    let comFracao = 0;
    for (const { estado } of passos) {
      const u = estado.unidades.porId[serfA];
      if (!u) continue;
      const pos = posicaoDaUnidade(estado, u, gameData);
      const proximo = u.fsmData.caminho?.[0];
      const progresso = u.fsmData.progresso ?? 0;
      if (!proximo || progresso === 0) {
        expect(pos).toEqual({ gx: u.gx, gy: u.gy });
      } else {
        comFracao += 1;
        expect(pos.gx).toBeGreaterThanOrEqual(Math.min(u.gx, proximo.gx));
        expect(pos.gx).toBeLessThanOrEqual(Math.max(u.gx, proximo.gx));
        expect(pos.gy).toBeGreaterThanOrEqual(Math.min(u.gy, proximo.gy));
        expect(pos.gy).toBeLessThanOrEqual(Math.max(u.gy, proximo.gy));
        expect(pos).not.toEqual({ gx: u.gx, gy: u.gy });
      }
    }
    expect(comFracao).toBeGreaterThan(5);
  });
});

describe('F10 — quatro serfs trabalhando ao mesmo tempo, a cada tick sob as invariantes', () => {
  const inicioParalelo = comPedraNaSaida(cenarioLigado({ stone: 2, timber: 3 }), armazem.id, 10);
  const { passos } = rodar(inicioParalelo, quieto);
  const fim = passos[passos.length - 1]?.estado as GameState;

  it('a obra recebeu tudo e o armazem perdeu exatamente isso', () => {
    expect(faltamDaObra(fim, 'stone')).toBe(0);
    expect(faltamDaObra(fim, 'timber')).toBe(0);
    expect(saidaDoArmazem(fim, 'stone')).toBe(saidaDoArmazem(inicioParalelo, 'stone') - 2);
    expect(saidaDoArmazem(fim, 'timber')).toBe(saidaDoArmazem(inicioParalelo, 'timber') - 3);
  });

  it('houve paralelismo de verdade: em algum tick, 2 ou mais serfs estavam ocupados', () => {
    const maxOcupados = Math.max(...passos.map((p) => serfsDoCenario(p.estado).filter((id) => fsmDe(p.estado, id) !== 'ocioso').length));
    expect(maxOcupados).toBeGreaterThanOrEqual(2);
  });

  it('em NENHUM tick: invariantes do quadro, da FSM e conservacao de bens', () => {
    const bensAntes = bensPorMercadoria(inicioParalelo);
    for (const { estado } of passos) {
      expect(violacoesDeInvariantes(estado), `quadro, tick ${estado.tick}`).toEqual([]);
      expect(violacoesDaFsm(estado), `FSM, tick ${estado.tick}`).toEqual([]);
      expect(bensPorMercadoria(estado), `bens, tick ${estado.tick}`).toEqual(bensAntes);
    }
  });

  it('duas tarefas nunca foram para o mesmo serf nem o mesmo serf pegou duas', () => {
    for (const { estado } of passos) {
      const donos = tarefasDe(estado).map((t) => t?.reclamadaPor).filter((x): x is string => x !== null && x !== undefined);
      expect(new Set(donos).size).toBe(donos.length);
    }
  });
});

describe('F10 — determinismo, save/load no meio da viagem e imutabilidade', () => {
  const plantarERuar = (t: number): Command[] => (t !== 0 ? [] : [
    { type: 'PlaceBlueprint', buildingId: 'quarry', gx: 26, gy: 34 },
    { type: 'PlaceRoad', tiles: [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)] },
  ]);

  function ticksComSerfCarregando(): number[] {
    let e = createInitialState(1);
    const ticks: number[] = [];
    for (let t = 0; t < 80; t++) {
      e = step(e, plantarERuar(t));
      if (serfsDoCenario(e).some((id) => e.unidades.porId[id]?.fsmData.carga !== undefined)) ticks.push(e.tick);
    }
    return ticks;
  }

  it('o cenario planta uma obra, liga por estrada e chega a ter serf CARREGANDO (senao o teste de save seria vacuo)', () => {
    expect(ticksComSerfCarregando().length).toBeGreaterThan(5);
  });

  it('com o save atravessando uma viagem CARREGADA, o JSON final e igual byte a byte', () => {
    const carregando = ticksComSerfCarregando();
    const saveAtTick = carregando[Math.floor(carregando.length / 2)] as number;
    const { direto, comSave } = compararComESemSave({ seed: 1, totalTicks: 80, saveAtTick, comandosNoTick: plantarERuar });
    expect(comSave).toBe(direto);
    const final = JSON.parse(direto) as GameState;
    expect(final.tick).toBe(80);
    expect(violacoesDaFsm(final)).toEqual([]);
  });

  it('o estado no instante do save ja tem carga em `fsmData` (e ela sobrevive ao JSON)', () => {
    const carregando = ticksComSerfCarregando();
    const alvo = carregando[Math.floor(carregando.length / 2)] as number;
    let e = createInitialState(1);
    for (let t = 0; t < alvo; t++) e = step(e, plantarERuar(t));
    const comCarga = serfsDoCenario(e).filter((id) => e.unidades.porId[id]?.fsmData.carga !== undefined);
    expect(comCarga.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
  });

  it('a mesma sequencia de comandos da o mesmo estado duas vezes', () => {
    const rodarUma = (): string => {
      let e = createInitialState(1);
      for (let t = 0; t < 60; t++) e = step(e, plantarERuar(t));
      return JSON.stringify(e);
    };
    expect(rodarUma()).toBe(rodarUma());
  });

  it('`step` nao muta o estado que recebe: 40 ticks sobre estados congelados em profundidade', () => {
    let e = deepFreeze(comPedraNaSaida(cenarioLigado({ stone: 2, timber: 3 }), armazem.id, 10));
    for (let t = 0; t < 40; t++) e = deepFreeze(step(e, []));
    expect(e.tick).toBe(40);
  });
});

describe('F10 — quem nao e serf, e o serf sem trabalho, nao se mexem', () => {
  it('sem obra nenhuma, 50 ticks: todos os serfs ociosos, no mesmo tile, e os laborers intocados', () => {
    let e = createInitialState(1);
    const antes = JSON.stringify(e.unidades);
    for (let t = 0; t < 50; t++) e = step(e, []);
    expect(JSON.stringify(e.unidades)).toBe(antes);
  });

  it('um estado de FSM que o GDD nao conhece e recusado alto (save corrompido), nao ignorado', () => {
    const base = comPedraNaSaida(cenarioLigado({ stone: 1 }), armazem.id, 10);
    const u = base.unidades.porId[serfA];
    if (!u) throw new Error('fixture');
    const corrompido: GameState = { ...base, unidades: { ...base.unidades, porId: { ...base.unidades.porId, [serfA]: { ...u, fsm: 'dancando' } } } };
    expect(() => step(corrompido, [])).toThrow(/dancando/);
  });
});
