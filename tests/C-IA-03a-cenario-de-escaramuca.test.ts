/**
 * C-IA-03a (cenario de escaramuca: o cenario na sim; plano em
 * docs/planos/2026-09-29-C-IA-03-cenario-de-escaramuca.md). Aceite:
 *  - duas vilas, dois lados, no mapa que ja existe: os predios da IA passam no `canPlace`,
 *    um depois do outro, e os pontos e spawns da tropa sao andaveis;
 *  - a IA guarnece e fica: 300 ticks, os 18 vivos e dentro do raio da posicao, sem tocar
 *    na vila do jogador, e a partida nao acaba sozinha;
 *  - o menu do jogador nao ganha o que a IA tem, e o HUD, os avisos e o centro da camera
 *    sao os do jogo livre (nada da IA vaza);
 *  - derrubada a IA, vitoria; derrubado o jogador, derrota;
 *  - save byte a byte; determinismo; o jogo livre continua sem IA.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { canPlace } from '../src/sim/placement';
import { tileAndavel } from '../src/sim/pathfinding';
import { estaDesbloqueado, registrarConclusoes } from '../src/sim/desbloqueio';
import { alertasDoEstado, centroDaVila, comidaTotal, estoqueDosArmazens, populacaoPorGrupo } from '../src/sim/selectors';
import { distanciaEmTiles } from '../src/sim/combate';
import { carregar, salvar } from '../src/sim/save';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
const cenario = gameData.escaramuca;
const doLado = (s: GameState, lado: number, oque: 'predios' | 'unidades'): string[] =>
  s[oque].ordem.filter((id) => s[oque].porId[id]?.lado === lado);
const sem = (s: GameState, ids: readonly string[]): GameState => {
  const fora = new Set(ids);
  const predios = { ...s.predios.porId };
  const unidades = { ...s.unidades.porId };
  for (const id of fora) {
    delete predios[id];
    delete unidades[id];
  }
  return {
    ...s,
    predios: { porId: predios, ordem: s.predios.ordem.filter((id) => !fora.has(id)) },
    unidades: { porId: unidades, ordem: s.unidades.ordem.filter((id) => !fora.has(id)) },
  };
};

describe('C-IA-03a — o cenario de escaramuca na sim', () => {
  const livre = createInitialState(SEMENTE);
  const s0 = criarEscaramuca(SEMENTE);

  it('duas vilas, dois lados: a do jogador e a do jogo livre; a da IA e a do dado', () => {
    expect(livre.ia).toBeUndefined();
    expect(doLado(s0, LADO_DO_JOGADOR, 'predios')).toEqual(livre.predios.ordem);
    expect(doLado(s0, LADO_DO_JOGADOR, 'unidades')).toEqual(livre.unidades.ordem);
    const daIA = doLado(s0, LADO_DA_IA, 'predios').map((id) => s0.predios.porId[id]);
    expect(daIA.map((p) => [p?.tipo, p?.gx, p?.gy, p?.estado])).toEqual(cenario.predios.map((p) => [p.id, p.gx, p.gy, 'completo']));
    const tropa = cenario.posicoes.reduce((n, p) => n + p.tropa.quantidade, 0);
    expect(doLado(s0, LADO_DA_IA, 'unidades')).toHaveLength(tropa);
    const posicoes = s0.ia?.[String(LADO_DA_IA)]?.posicoes ?? [];
    expect(posicoes.map((p) => [p.id, p.membros.length])).toEqual(cenario.posicoes.map((p) => [p.id, p.tropa.quantidade]));
    // o contador unico continua valendo: nenhum id repetido, proximoId acima de todos
    const ids = [...s0.predios.ordem, ...s0.unidades.ordem].map((id) => Number(id.slice(1)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.max(...ids)).toBeLessThan(s0.proximoId);
  });

  it('a vila da IA cabe no mapa: cada predio passa no canPlace com os anteriores ja de pe', () => {
    // o desbloqueio nao e a pergunta aqui (o menu e do jogador): libera tudo e pergunta so
    // terreno, recurso e sobreposicao
    let s: GameState = { ...livre, tiposJaConstruidos: gameData.predios.map((p) => p.id) };
    for (const id of doLado(s0, LADO_DA_IA, 'predios')) {
      const p = s0.predios.porId[id];
      if (p === undefined) throw new Error(id);
      expect(canPlace(s, p.tipo, p.gx, p.gy, gameData), `${p.tipo} em ${p.gx},${p.gy}`).toEqual({ ok: true });
      s = { ...s, predios: { porId: { ...s.predios.porId, [id]: p }, ordem: [...s.predios.ordem, id] } };
    }
    for (const pos of cenario.posicoes) {
      expect(tileAndavel(s, pos.ponto, 'livre', gameData), `ponto de ${pos.id}`).toBe(true);
      for (let i = 0; i < pos.tropa.quantidade; i++) {
        expect(tileAndavel(s, { gx: pos.spawn.gx + i, gy: pos.spawn.gy }, 'livre', gameData), `spawn ${i} de ${pos.id}`).toBe(true);
      }
    }
  });

  it('nada da IA vaza para o jogador: menu, estoque, comida, populacao, avisos e camera', () => {
    expect(s0.tiposJaConstruidos).toEqual(livre.tiposJaConstruidos);
    for (const p of gameData.predios) expect(estaDesbloqueado(s0, p.id), p.id).toBe(estaDesbloqueado(livre, p.id));
    // um predio da IA completando nao libera nada no menu do jogador
    const quartel = doLado(s0, LADO_DA_IA, 'predios').find((id) => s0.predios.porId[id]?.tipo === 'barracks') as string;
    const conclusao: GameEvent = { type: 'building-completed', predio: quartel, tipo: 'barracks' };
    expect(registrarConclusoes(s0, [conclusao])).toBe(s0);
    expect(estoqueDosArmazens(s0)).toEqual(estoqueDosArmazens(livre));
    expect(comidaTotal(s0)).toBe(comidaTotal(livre));
    expect(populacaoPorGrupo(s0)).toEqual(populacaoPorGrupo(livre));
    expect(alertasDoEstado(s0)).toEqual(alertasDoEstado(livre));
    // uma pedreira da IA sem trabalhador alertaria; o aviso e do jogador, e ela nao entra
    const pedreira = completarObra({ id: 'pedreira-ia', lado: LADO_DA_IA, tipo: 'quarry', gx: 80, gy: 75, estado: 'obra', hp: 250, obra: { faltam: {}, nivelamento: 0 } }, gameData);
    const comPedreira: GameState = { ...s0, predios: { porId: { ...s0.predios.porId, [pedreira.id]: pedreira }, ordem: [...s0.predios.ordem, pedreira.id] } };
    expect(alertasDoEstado(comPedreira, gameData, LADO_DA_IA).some((a) => a.predio === 'pedreira-ia')).toBe(true);
    expect(alertasDoEstado(comPedreira)).toEqual(alertasDoEstado(livre));
    expect(centroDaVila(s0)).toEqual(centroDaVila(livre));
    // e o lado da IA continua respondendo pelo parametro
    expect(populacaoPorGrupo(s0, gameData, LADO_DA_IA).militar).toBe(doLado(s0, LADO_DA_IA, 'unidades').length);
  });

  it('a IA guarnece e fica: 300 ticks, todos vivos no raio, a vila do jogador intacta', () => {
    let s = s0;
    const violacoes: string[] = [];
    for (let t = 0; t < 300; t++) {
      s = step(s, [], gameData);
      violacoes.push(...violacoesDeInvariantes(s, gameData).map((v) => `t${t}: ${v}`));
    }
    expect(violacoes).toEqual([]);
    expect(s.partida).toBeUndefined();
    const posicoes = s.ia?.[String(LADO_DA_IA)]?.posicoes ?? [];
    const longe: string[] = [];
    for (const p of posicoes) {
      expect(p.membros).toHaveLength(cenario.posicoes.find((c) => c.id === p.id)?.tropa.quantidade ?? -1);
      for (const id of p.membros) {
        const u = s.unidades.porId[id];
        if (u === undefined || distanciaEmTiles(u, p.ponto) > p.raio) longe.push(id);
      }
    }
    expect(longe).toEqual([]);
    for (const id of doLado(s0, LADO_DO_JOGADOR, 'predios')) expect(s.predios.porId[id]?.hp).toBe(s0.predios.porId[id]?.hp);
    gravarEvidencia('C-IA-03a-cenario', {
      tick: s.tick,
      ia: posicoes.map((p) => ({ id: p.id, ponto: p.ponto, membros: p.membros.length,
        tiles: p.membros.map((id) => `${s.unidades.porId[id]?.gx},${s.unidades.porId[id]?.gy}`) })),
      prediosDaIA: doLado(s, LADO_DA_IA, 'predios').map((id) => s.predios.porId[id]?.tipo),
    });
  });

  it('derrubada a IA, vitoria; derrubado o jogador, derrota', () => {
    const semIA = sem(s0, [...doLado(s0, LADO_DA_IA, 'predios'), ...doLado(s0, LADO_DA_IA, 'unidades')]);
    expect(step(semIA, [], gameData).partida?.fim).toBe('vitoria');
    const semJogador = sem(s0, [...doLado(s0, LADO_DO_JOGADOR, 'predios'), ...doLado(s0, LADO_DO_JOGADOR, 'unidades')]);
    expect(step(semJogador, [], gameData).partida?.fim).toBe('derrota');
  });

  it('save byte a byte e determinismo', () => {
    let a = s0;
    let b = criarEscaramuca(SEMENTE);
    for (let t = 0; t < 150; t++) {
      a = step(a, [], gameData);
      b = step(b, [], gameData);
    }
    expect(salvar(a)).toBe(salvar(b));
    expect(salvar(carregar(salvar(a)))).toBe(salvar(a));
  });
});
