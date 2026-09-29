/**
 * F-T4d — O PESCADOR SAI PARA A AGUA, EM PARTIDA.
 *
 * A F-T4a provou o pescador em FIXTURE (cabana injetada e ocupada a mao). Aqui ele
 * e exercitado como o jogador o exercita: a abertura da Fase A por comando, a Casa
 * do Pescador plantada quando desbloqueia, o pescador treinado na escola, o peixe
 * saindo pela rua ate o armazem — e o lago secando.
 *
 * O que a medicao desta feature achou (docs/planos/F-T4d.md): secos os cardumes COM
 * MARGEM, sobravam 12 tiles de interior de agua ao alcance, que ninguem alcanca, e a
 * pergunta do esgotamento (`semRecursoAoAlcance`) os contava — o pescador parava em
 * `esperando_insumo` sem `vein-exhausted` e sem `veio-esgotado`. A escolha do tile
 * ja filtrava por `tileAlcancavelParaColheita`; a pergunta do esgotamento nao. Este
 * arquivo e o guarda da correcao: os dois lados fazem a mesma pergunta, e o caminho
 * do lago seco e o MESMO da mina seca (F21b).
 *
 * A POSICAO da cabana NAO e digitada: varredura por `canPlace` das caixas com porta
 * na rua da abertura, escolhendo a de mais cardume alcancavel. O RENDIMENTO do peixe
 * e sobrescrito para 1 por tile (`comRendimentoPorTile`, o andaime da F-T4a): com os
 * 20 do dado, secar o lago levaria ~170 mil ticks. O teste PARA logo depois do
 * esgotamento, antes dos 12 000 ticks em que a abertura sem Bodega perde os seis
 * civis iniciais de fome (F20b) — a fome e o cenario da F-CAL, nao deste.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { alertasDoEstado, estoqueDosArmazens } from '../src/sim/selectors';
import { canPlace } from '../src/sim/placement';
import { estaDesbloqueado } from '../src/sim/desbloqueio';
import { canPlaceRoad, chaveDeTile, ehEstrada, predioLigadoAoArmazem, tileDeChave } from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import { bordaSul, caixaDeTipo } from '../src/sim/footprint';
import { receitaDoTipo, semRecursoAoAlcance, unidadesPorCiclo } from '../src/sim/producao';
import { melhorTileDeColheita, recursoNoTile, tilesDeColheita, tilesDeColheitaNaCaixa } from '../src/sim/recursos';
import { tileAlcancavelParaColheita } from '../src/sim/aproximacao';
import { tileAndavel } from '../src/sim/pathfinding';
import { filaDaEscola } from '../src/sim/escola';
import { aberturaDaFaseA, comandosNoTick } from './helpers/abertura';
import { avancar, cenarioDaCadeiaDoOuro, comRendimentoPorTile } from './helpers/producao-cenario';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const TIPO = 'fishermans';
const CIVIL = 'fisherman';
/** Sonda de 2026-09-25: seco no tick 10745; a abertura perde os civis no 12 000. */
const TETO = 11_800;
const chebyshev = (a: TileDeGrid, b: TileDeGrid): number =>
  Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy));

function cabanaDe(s: GameState): PredioCompleto | null {
  for (const id of s.predios.ordem) {
    const p = s.predios.porId[id];
    if (p && p.tipo === TIPO && p.estado === 'completo') return p;
  }
  return null;
}

/**
 * D-PRODUCAO-02 — a rua da porta da cabana ate a rua da abertura, como o jogador a
 * traca: busca em largura, 4-vizinhos, por tiles que aceitam estrada e fora da caixa
 * da propria cabana. Vazia se a porta ja esta na rua; null se nao ha ligacao.
 */
function ruaAtePorta(s: GameState, caixa: { x0: number; y0: number; x1: number; y1: number }, porta: { x0: number; x1: number; y0: number }, dados: GameData, limite = Infinity): TileDeGrid[] | null {
  const naCaixa = (t: TileDeGrid): boolean => t.gx >= caixa.x0 && t.gx < caixa.x1 && t.gy >= caixa.y0 && t.gy < caixa.y1;
  const veio = new Map<string, string | null>();
  // profundidade por tile: a busca nao passa de `limite` (a rua do melhor candidato ate aqui)
  const fundo = new Map<string, number>();
  const fila: TileDeGrid[] = [];
  for (let x = porta.x0; x < porta.x1; x += 1) {
    const t = { gx: x, gy: porta.y0 };
    if (ehEstrada(s.estradas, t)) return [];
    if (!canPlaceRoad(s, [t], dados).ok) continue;
    veio.set(chaveDeTile(t), null);
    fundo.set(chaveDeTile(t), 1);
    fila.push(t);
  }
  for (let k = 0; k < fila.length; k += 1) {
    const aqui = fila[k] as TileDeGrid;
    const n = fundo.get(chaveDeTile(aqui)) ?? 0;
    if (n > limite) continue;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
      const t = { gx: aqui.gx + dx, gy: aqui.gy + dy };
      const chave = chaveDeTile(t);
      if (veio.has(chave) || naCaixa(t)) continue;
      if (ehEstrada(s.estradas, t)) {
        const rua: TileDeGrid[] = [];
        for (let c: string | null = chaveDeTile(aqui); c !== null; c = veio.get(c) ?? null) rua.push(tileDeChave(c));
        return rua;
      }
      if (!canPlaceRoad(s, [t], dados).ok) continue;
      veio.set(chave, chaveDeTile(aqui));
      fundo.set(chave, n + 1);
      fila.push(t);
    }
  }
  return null;
}

/**
 * Onde a cabana cabe, com cardume ALCANCAVEL ao alcance — pela sim, nunca por
 * coordenada — e a rua mais CURTA que liga a porta a rua da abertura (zero, com a porta
 * na rua). Empate: mais cardume alcancavel, depois mais perto do armazem, depois a
 * primeira em varredura.
 *
 * D-PRODUCAO-02: a porta tinha de cair NA rua da abertura. Com o alcance do lenhador
 * dobrado a abertura pos a mata 5 tiles a oeste, na beira do lago, e a rua deixou de
 * passar por algum lugar com peixe ao alcance. O jogador faria o que isto faz: a rua.
 */
function posicaoDaCabana(s: GameState, dados: GameData): { gx: number; gy: number; cardumes: number; alcancaveis: number; rua: TileDeGrid[] } {
  const colheita = receitaDoTipo(TIPO, dados)?.colheita ?? null;
  if (colheita === null) throw new Error(`fixture: '${TIPO}' sem colheita em production.json`);
  const armazem = s.predios.porId[s.predios.ordem[0] ?? ''];
  const { largura, altura } = dados.terreno.mapaPadrao;
  let melhor: { gx: number; gy: number; cardumes: number; alcancaveis: number; dist: number; rua: TileDeGrid[] } | null = null;
  for (let gy = 0; gy < altura; gy += 1) {
    for (let gx = 0; gx < largura; gx += 1) {
      if (!canPlace(s, TIPO, gx, gy, dados).ok) continue;
      const caixa = caixaDeTipo(TIPO, gx, gy, dados);
      if (caixa === null) continue;
      const tiles = tilesDeColheitaNaCaixa(s, caixa, colheita, dados);
      const alcancaveis = tiles.filter((k) => tileAlcancavelParaColheita(s, k, dados)).length;
      if (alcancaveis === 0) continue;
      const rua = ruaAtePorta(s, caixa, bordaSul(caixa), dados, melhor === null ? Infinity : melhor.rua.length);
      if (rua === null || (melhor !== null && rua.length > melhor.rua.length)) continue;
      const dist = armazem ? Math.abs(gx - armazem.gx) + Math.abs(gy - armazem.gy) : 0;
      if (melhor === null || rua.length < melhor.rua.length || alcancaveis > melhor.alcancaveis
        || (alcancaveis === melhor.alcancaveis && dist < melhor.dist)) {
        melhor = { gx, gy, cardumes: tiles.length, alcancaveis, dist, rua };
      }
    }
  }
  if (melhor === null) throw new Error('fixture: nenhuma posicao com porta na rua e cardume alcancavel');
  return melhor;
}

interface Corrida {
  readonly dados: GameData;
  readonly fim: GameState;
  readonly marcos: Record<string, number | null>;
  readonly posicao: ReturnType<typeof posicaoDaCabana> | null;
  readonly cabanaId: string | null;
  readonly pescadorId: string | null;
  readonly pescas: { tick: number; onde: TileDeGrid; cardume: TileDeGrid; chebyshev: number; andavel: boolean; sobreAgua: boolean }[];
  readonly peixesProduzidos: number;
  readonly eventosDeVeio: { tick: number; predio: string }[];
  readonly aoAlcanceNoInicio: readonly string[];
  readonly semMargemNoInicio: readonly string[];
  readonly divergencias: { tick: number; semRecurso: boolean; escolha: string | null }[];
  readonly recusas: unknown[];
}

function correr(): Corrida {
  const dados = comRendimentoPorTile(gameData, 'fish', 1);
  let s = createInitialState(gameData.economia.estadoInicial.semente, dados);
  const abertura = aberturaDaFaseA(s, dados);
  const receita = receitaDoTipo(TIPO, dados);
  const colheita = receita?.colheita ?? null;
  if (receita === null || colheita === null) throw new Error(`fixture: '${TIPO}' sem colheita`);
  const marcos: Record<string, number | null> = {
    desbloqueada: null, plantada: null, completa: null, ligada: null, ocupada: null,
    primeiraSaida: null, primeiroPeixeProduzido: null, primeiroPeixeNoArmazem: null,
    ultimoPeixeProduzido: null, semRecursoAlcancavel: null, veioEsgotado: null, alertaVeioEsgotado: null,
  };
  const marcar = (n: string, t: number): void => { if (marcos[n] === null) marcos[n] = t; };
  let posicao: Corrida['posicao'] = null;
  let cabanaId: string | null = null;
  let pescadorId: string | null = null;
  let treinoPedido = false;
  const pescas: Corrida['pescas'] = [];
  const eventosDeVeio: Corrida['eventosDeVeio'] = [];
  const divergencias: Corrida['divergencias'] = [];
  const recusas: unknown[] = [];
  let peixesProduzidos = 0;
  let aoAlcanceNoInicio: readonly string[] = [];
  let semMargemNoInicio: readonly string[] = [];
  let ultimoFsm = '';

  for (let i = 0; i < TETO; i += 1) {
    const comandos: Command[] = [...comandosNoTick(s, abertura, i, dados)];
    if (estaDesbloqueado(s, TIPO, dados)) {
      marcar('desbloqueada', i);
      const plantada = s.predios.ordem.some((id) => s.predios.porId[id]?.tipo === TIPO);
      if (!plantada && !comandos.some((c) => c.type === 'PlaceBlueprint')) {
        posicao = posicaoDaCabana(s, dados);
        comandos.push({ type: 'PlaceBlueprint', buildingId: TIPO, gx: posicao.gx, gy: posicao.gy });
        if (posicao.rua.length > 0) comandos.push({ type: 'PlaceRoad', tiles: posicao.rua });
        marcar('plantada', i);
      }
    }
    const cabana = cabanaDe(s);
    if (cabana !== null && !treinoPedido && filaDaEscola(s, abertura.escola).length < dados.economia.schoolhouse.slotsDeFila) {
      comandos.push({ type: 'EnqueueTraining', predio: abertura.escola, unidade: CIVIL });
      treinoPedido = true;
    }
    s = step(s, comandos, dados);
    for (const ev of s.events) {
      if (ev.type === 'command-rejected') recusas.push({ tick: s.tick, ev });
      if (ev.type === 'goods-produced' && ev.mercadoria === colheita.recurso) {
        peixesProduzidos += ev.quantidade;
        marcar('primeiroPeixeProduzido', s.tick);
        marcos['ultimoPeixeProduzido'] = s.tick;
      }
      if (ev.type === 'vein-exhausted') eventosDeVeio.push({ tick: s.tick, predio: ev.predio });
    }
    if ((estoqueDosArmazens(s)[colheita.recurso] ?? 0) > 0) marcar('primeiroPeixeNoArmazem', s.tick);

    const c = cabanaDe(s);
    if (c === null) continue;
    cabanaId = c.id;
    marcar('completa', s.tick);
    if (predioLigadoAoArmazem(s, c, dados)) marcar('ligada', s.tick);
    if (c.ocupante === null) continue;
    if (marcos['ocupada'] === null) {
      marcar('ocupada', s.tick);
      pescadorId = c.ocupante;
      aoAlcanceNoInicio = tilesDeColheita(s, c, colheita, dados);
      semMargemNoInicio = aoAlcanceNoInicio.filter((k) => !tileAlcancavelParaColheita(s, k, dados));
    }
    // (d) os dois lados da mesma pergunta, em todo tick com ocupante
    const semRecurso = semRecursoAoAlcance(s, c, receita, dados);
    const escolha = melhorTileDeColheita(
      s, c, colheita, unidadesPorCiclo(receita), undefined, dados, (k) => tileAlcancavelParaColheita(s, k, dados),
    );
    if (semRecurso !== (escolha === null)) divergencias.push({ tick: s.tick, semRecurso, escolha });
    if (semRecurso) marcar('semRecursoAlcancavel', s.tick);
    if (eventosDeVeio.some((e) => e.predio === c.id)) marcar('veioEsgotado', s.tick);
    if (alertasDoEstado(s, dados).some((a) => a.predio === c.id && a.causa === 'veio-esgotado')) marcar('alertaVeioEsgotado', s.tick);

    const u = s.unidades.porId[c.ocupante];
    if (u === undefined) continue;
    if (u.fsm !== 'trabalhando' && u.fsm !== 'esperando_insumo' && u.fsm !== 'saida_cheia') marcar('primeiraSaida', s.tick);
    if (u.fsm === 'colhendo' && ultimoFsm !== 'colhendo') {
      const t = u.fsmData.tarefa === undefined ? undefined : s.jobs.tarefas.porId[u.fsmData.tarefa];
      if (t !== undefined && t.tipo === 'colher') {
        const onde = { gx: u.gx, gy: u.gy };
        pescas.push({
          tick: s.tick, onde, cardume: t.origemTile, chebyshev: chebyshev(onde, t.origemTile),
          andavel: tileAndavel(s, onde, 'livre', dados),
          sobreAgua: recursoNoTile(s, u.gx, u.gy)?.tipo === colheita.recurso,
        });
      }
    }
    ultimoFsm = u.fsm;
    // para logo depois do esgotamento, antes de a fome da abertura levar alguem
    if (marcos['semRecursoAlcancavel'] !== null && s.tick > (marcos['semRecursoAlcancavel'] ?? 0) + 200) break;
  }
  return {
    dados, fim: s, marcos, posicao, cabanaId, pescadorId, pescas, peixesProduzidos, eventosDeVeio,
    aoAlcanceNoInicio, semMargemNoInicio, divergencias, recusas,
  };
}

describe('F-T4d — o pescador em partida', () => {
  let c: Corrida;
  // `timeout` NAO e assercao de tempo (CLAUDE.md §8): existe para o caso travar. A
  // corrida da sonda (20 000 ticks) levou ~5 s; esta para em ~11 000.
  beforeAll(() => {
    c = correr();
    gravarEvidencia('F-T4d', {
      feature: 'F-T4d — o pescador sai para a agua, em partida',
      pergunta: 'anda ate a margem? colhe? o cardume esgota? e o predio, quando o ultimo cardume alcancavel seca?',
      rendimentoPorTileUsado: 1,
      posicaoDaCabana: c.posicao, marcos: c.marcos, recusas: c.recusas,
      cardumes: { aoAlcanceNoInicio: c.aoAlcanceNoInicio.length, semMargemNoInicio: c.semMargemNoInicio.length },
      peixesProduzidos: c.peixesProduzidos, primeirasPescas: c.pescas.slice(0, 5),
      eventosDeVeio: c.eventosDeVeio, divergencias: c.divergencias,
      fsmDoPescadorNoFim: c.pescadorId === null ? null : c.fim.unidades.porId[c.pescadorId]?.fsm ?? null,
      alertasDaCabanaNoFim: c.cabanaId === null ? null : alertasDoEstado(c.fim, c.dados).filter((a) => a.predio === c.cabanaId),
      ticksRodados: c.fim.tick,
    });
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: ~3,8 s
    // isolado, 79% dos 4,8 s do arquivo (2026-09-29); o limite e ~5x.
  }, 20_000);

  it('a cabana sobe por comando, com a porta na rua, e o pescador a ocupa antes da fome da abertura', () => {
    expect(c.recusas).toEqual([]);
    expect(c.posicao?.alcancaveis ?? 0).toBeGreaterThan(0);
    expect(c.marcos['ocupada']).not.toBeNull();
    expect(c.marcos['ocupada'] ?? Number.POSITIVE_INFINITY).toBeLessThan(TETO);
    expect(c.aoAlcanceNoInicio.length).toBeGreaterThan(c.semMargemNoInicio.length);
    // o cenario tem interior de verdade — senao a pergunta desta feature seria de vacuo
    expect(c.semMargemNoInicio.length).toBeGreaterThan(0);
  });

  it('(a) ele pesca DA MARGEM — a um passo do cardume, em tile andavel, nunca sobre a agua — e o peixe chega ao armazem', () => {
    expect(c.pescas.length).toBeGreaterThan(0);
    for (const p of c.pescas) {
      expect(p.chebyshev, `pesca no tick ${p.tick}`).toBe(1);
      expect(p.andavel, `pesca no tick ${p.tick}`).toBe(true);
      expect(p.sobreAgua, `pesca no tick ${p.tick}`).toBe(false);
    }
    expect(c.marcos['primeiroPeixeProduzido']).not.toBeNull();
    expect(c.marcos['primeiroPeixeNoArmazem']).not.toBeNull();
    expect(c.marcos['primeiroPeixeNoArmazem'] ?? 0).toBeGreaterThan(c.marcos['primeiroPeixeProduzido'] ?? 0);
  });

  it('(b) os cardumes com margem secam e SAEM do estado; os de interior ficam, intocados', () => {
    if (c.cabanaId === null) throw new Error('fixture: cabana nao existe no fim');
    const receita = receitaDoTipo(TIPO, c.dados);
    const colheita = receita?.colheita ?? null;
    if (receita === null || colheita === null) throw new Error('fixture');
    const cabana = c.fim.predios.porId[c.cabanaId];
    if (cabana === undefined || cabana.estado !== 'completo') throw new Error('fixture: cabana nao esta completa');
    // um peixe por cardume alcancavel: o que tinha margem foi pescado e sumiu
    expect(c.peixesProduzidos).toBe(c.aoAlcanceNoInicio.length - c.semMargemNoInicio.length);
    const restantes = tilesDeColheita(c.fim, cabana, colheita, c.dados);
    expect([...restantes].sort()).toEqual([...c.semMargemNoInicio].sort());
    for (const k of restantes) {
      const t = tileDeChave(k);
      expect(recursoNoTile(c.fim, t.gx, t.gy)?.quantidade, k).toBe(1);
      expect(tileAlcancavelParaColheita(c.fim, k, c.dados), k).toBe(false);
    }
    for (const k of c.aoAlcanceNoInicio) {
      if (c.semMargemNoInicio.includes(k)) continue;
      const t = tileDeChave(k);
      expect(recursoNoTile(c.fim, t.gx, t.gy), k).toBeNull();
    }
    expect(c.fim.recursos[chaveDeTile(c.pescas[0]?.cardume ?? { gx: -1, gy: -1 })]).toBeUndefined();
  });

  it('(c) o lago seco e o MESMO caminho da mina seca: `vein-exhausted` uma vez, `veio-esgotado`, e a mesma espera da F21b', () => {
    if (c.cabanaId === null || c.pescadorId === null) throw new Error('fixture');
    expect(c.marcos['semRecursoAlcancavel']).not.toBeNull();
    expect(c.eventosDeVeio.filter((e) => e.predio === c.cabanaId)).toHaveLength(1);
    expect(c.marcos['veioEsgotado']).toBe(c.marcos['semRecursoAlcancavel']);
    expect(c.marcos['alertaVeioEsgotado']).toBe(c.marcos['semRecursoAlcancavel']);
    expect(alertasDoEstado(c.fim, c.dados).filter((a) => a.predio === c.cabanaId))
      .toEqual([{ predio: c.cabanaId, tipo: TIPO, causa: 'veio-esgotado' }]);
    // nada reclamado para a cabana, fsmData limpo
    const colher = c.fim.jobs.tarefas.ordem.filter((id) => {
      const t = c.fim.jobs.tarefas.porId[id];
      return t?.tipo === 'colher' && t.destino === c.cabanaId;
    });
    expect(colher).toEqual([]);
    const pescador = c.fim.unidades.porId[c.pescadorId];
    expect(pescador?.fsmData).toEqual({});
    // ESTRUTURAL: o mesmo estado em que o mineiro da F21b espera com a mina seca —
    // o cenario dela, rodado ate secar, e nao o rotulo digitado
    const mina = cenarioDaMinaSeca(c.dados);
    expect(pescador?.fsm).toBe(mina.fsmDoMineiro);
    expect(violacoesDaFsmDoEspecialista(c.fim, c.dados)).toEqual([]);
    expect(violacoesDeInvariantes(c.fim, c.dados)).toEqual([]);
  });

  it('(d) em todo tick, "sem recurso ao alcance" e "a escolha nao acha tile" sao a MESMA resposta', () => {
    // Era o defeito: com 12 tiles de interior sobrando, a escolha devolvia `null` e o
    // esgotamento dizia "ha recurso". Provado que acusa: trocar o `elegivel` de
    // `semRecursoAoAlcance` pelo neutro reprova aqui, no tick do ultimo peixe.
    expect(c.divergencias).toEqual([]);
    // no MESMO tick do ultimo peixe: o deposito tira o ultimo cardume com margem do
    // mapa, e a pergunta do esgotamento — feita no fim do mesmo ciclo — ja diz sim
    expect(c.marcos['semRecursoAlcancavel']).toBe(c.marcos['ultimoPeixeProduzido']);
  });
});

/**
 * A mina de carvao da F21b, rodada ate o veio secar, com o MESMO rendimento por tile
 * desta corrida. E o "estado de espera de quem esgotou" contra o qual (c) compara —
 * o mesmo molde da F-T4a, que comparou com a serraria de gaveta vazia.
 */
function cenarioDaMinaSeca(dados: GameData): { fsmDoMineiro: string | null } {
  const d = comRendimentoPorTile(dados, 'coal', 1);
  let s = cenarioDaCadeiaDoOuro(d);
  const mina = s.predios.ordem.map((id) => s.predios.porId[id]).find((p) => p?.tipo === 'coal_mine');
  if (mina === undefined || mina.estado !== 'completo' || mina.ocupante === null) throw new Error('fixture: F21b sem mina ocupada');
  const receita = receitaDoTipo('coal_mine', d);
  if (receita === null) throw new Error('fixture');
  for (let i = 0; i < 20_000; i += 1) {
    s = avancar(s, 50, d);
    const atual = s.predios.porId[mina.id];
    if (atual?.estado === 'completo' && semRecursoAoAlcance(s, atual, receita, d)) break;
  }
  s = avancar(s, 20, d);
  return { fsmDoMineiro: s.unidades.porId[mina.ocupante]?.fsm ?? null };
}
