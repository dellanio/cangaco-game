/**
 * C-IA-02c — tirar o andaime L8 (plano em docs/planos/2026-09-29-C-IA-02c-tirar-o-andaime-L8.md).
 * `condicao.iaDrena` e true: a tropa da IA sente fome e come da producao dela pelo
 * `comida-para-tropa`. A IA alimenta a posicao (C-IA-01) e a SOBRA, os militares fora de
 * posicao, como um grupo so (o KaM alimenta todo grupo: `TKMGeneral.CheckArmy`).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DA_IA } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { classeDaUnidade, condicaoCheiaDoTipo } from '../src/sim/condicao';
import { posicaoDoMembro } from '../src/sim/ia';
import { salvar } from '../src/sim/save';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
const LIMIAR = gameData.condicao.ticksNoLimiar.militar.civilVaiComer;
const CHEIA = condicaoCheiaDoTipo('militia');
/** A tropa da IA comeca faminta, abaixo do limiar: sem comida, morre no tick FOME_INICIAL.
 *  Encurta a corrida (a partida cheia, 24000 ticks, disputava CPU com a suite paralela e
 *  derrubava testes alheios por timeout); o mecanismo e o mesmo. */
const FOME_INICIAL = Math.round(CHEIA / 4);
/** Passa, com folga, do tick em que o militar faminto sem comida morre. */
const TICKS = FOME_INICIAL + 1500;

const militaresDaIA = (s: GameState): Unidade[] => s.unidades.ordem
  .map((id) => s.unidades.porId[id])
  .filter((u): u is Unidade => u !== undefined && u.lado === LADO_DA_IA && classeDaUnidade(u.tipo, gameData) === 'militar');
/** A escaramuca com a tropa inteira da IA em FOME_INICIAL. */
function escaramucaFaminta(): GameState {
  const s0 = criarEscaramuca(SEMENTE);
  const famintos = Object.fromEntries(militaresDaIA(s0).map((u) => [u.id, { ...u, condicao: FOME_INICIAL }]));
  return { ...s0, unidades: { ...s0.unidades, porId: { ...s0.unidades.porId, ...famintos } } };
}

describe('C-IA-02c — a tropa da IA sente fome e come da producao', () => {
  it('o dado tirou o andaime: iaDrena e true', () => {
    expect(gameData.condicao.iaDrena).toBe(true);
  });

  it(`a escaramuca sem comando, com a tropa da IA faminta, ${TICKS} ticks: ninguem morre de fome, e posicao e sobra comem`, () => {
    let s = escaramucaFaminta();
    expect(FOME_INICIAL).toBeLessThan(LIMIAR);
    const noInicio = militaresDaIA(s).length;
    const ia = s.ia?.[String(LADO_DA_IA)];
    if (ia === undefined) throw new Error('a escaramuca deveria ter IA');
    const daPosicao = new Set(militaresDaIA(s).filter((u) => posicaoDoMembro(ia.posicoes, u.id) !== null).map((u) => u.id));
    expect(daPosicao.size).toBeGreaterThan(0);
    expect(daPosicao.size, 'a escaramuca deveria ter sobra (os atacantes da C-IA-04)').toBeLessThan(noInicio);
    let mortosDeFome = 0;
    const entregas = { posicao: new Set<string>(), sobra: new Set<string>() };
    for (let t = 1; t <= TICKS; t++) {
      const antes = new Map(militaresDaIA(s).map((u) => [u.id, u.condicao]));
      s = step(s, [], gameData);
      const agora = new Set(militaresDaIA(s).map((u) => u.id));
      for (const [id, c] of antes) if (!agora.has(id) && c <= 1) mortosDeFome++;
      for (const id of s.jobs.tarefas.ordem) {
        const k = s.jobs.tarefas.porId[id];
        if (k?.tipo !== 'comida-para-tropa' || k.estado !== 'carregando') continue;
        (daPosicao.has(k.destinoUnidade) ? entregas.posicao : entregas.sobra).add(id);
      }
    }
    expect(mortosDeFome).toBe(0);
    expect(militaresDaIA(s)).toHaveLength(noInicio);
    expect(entregas.posicao.size, 'o serf da IA deveria levar comida a posicao').toBeGreaterThan(0);
    expect(entregas.sobra.size, 'o serf da IA deveria levar comida a sobra').toBeGreaterThan(0);
    gravarEvidencia('C-IA-02c-fome-da-ia', {
      ticks: TICKS, militaresNoInicio: noInicio, militaresNoFim: militaresDaIA(s).length, mortosDeFome,
      entregasAPosicao: entregas.posicao.size, entregasASobra: entregas.sobra.size, fomeInicial: FOME_INICIAL, limiar: LIMIAR,
    });
  }, 120_000); // caso trave

  it('a sobra com fome, fora de posicao, recebe o FeedUnits da IA', () => {
    const s0 = createInitialState(1);
    // a vila inicial virada para a IA, e tres cabras dela sem posicao, abaixo do limiar
    const predios = Object.fromEntries(Object.entries(s0.predios.porId).map(([id, p]) => [id, { ...p, lado: LADO_DA_IA }]));
    const civis = Object.fromEntries(Object.entries(s0.unidades.porId).map(([id, u]) => [id, { ...u, lado: LADO_DA_IA }]));
    const ids = ['s1', 's2', 's3'];
    const tropa = ids.map((id, i): Unidade => ({ lado: LADO_DA_IA, id, tipo: 'militia', gx: 30 + i, gy: 40, fsm: 'ocioso', fsmData: {}, condicao: LIMIAR - 1 }));
    const s: GameState = {
      ...s0,
      predios: { ...s0.predios, porId: predios },
      unidades: { porId: { ...civis, ...Object.fromEntries(tropa.map((u) => [u.id, u])) }, ordem: [...s0.unidades.ordem, ...ids] },
      ia: { [String(LADO_DA_IA)]: { posicoes: [] } },
    };
    const depois = step(s, [], gameData);
    expect(ids.filter((id) => depois.unidades.porId[id]?.pedidoDeComida === true)).toEqual(ids);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
  });

  it('determinismo: duas corridas de 1500 ticks com a tropa faminta dao o mesmo JSON', () => {
    const correr = (): GameState => {
      let s = escaramucaFaminta();
      for (let t = 0; t < 1500; t++) s = step(s, [], gameData);
      return s;
    };
    const a = correr();
    expect(a.tick).toBe(1500);
    expect(salvar(a)).toBe(salvar(correr()));
  }, 20_000); // caso trave
});
