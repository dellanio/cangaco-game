/**
 * C-IA-02b — o prefeito minimo (plano em docs/planos/2026-09-29-C-IA-02b-prefeito-minimo.md).
 * O `CheckUnitCount` do KaM sem AutoBuild: a IA pede a escola dela o especialista que falta
 * e serfs ate 1 por predio, so com ouro, a cada revisao.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { ID_DA_ESCOLA, ID_DO_ARMAZEM, LADO_DA_IA, MERCADORIA_DE_OURO } from '../src/sim/state';
import type { GameState, Predio } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { filaDaEscola } from '../src/sim/escola';
import { pedidosDoPrefeito } from '../src/sim/prefeito';
import { comUnidade } from '../src/sim/units/movimento';
import { TIPO_QUE_CARREGA } from '../src/sim/jobs';
import { salvar } from '../src/sim/save';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
const pf = gameData.economia.prefeito;
const REVISAO = pf.ticksDaRevisao;
const FARMER = 'farmer';
/** O terceiro serf nasce no tick ~1139 (sonda de 2026-09-29); ate 2000 afirma que para ali. */
const TICKS_DOS_SERFS = 2000;
const BAKER = 'baker';

const doLado = (s: GameState, tipo: string): string[] =>
  s.unidades.ordem.filter((id) => { const u = s.unidades.porId[id]; return u?.lado === LADO_DA_IA && u.tipo === tipo; });
const predioDaIA = (s: GameState, tipo: string): Predio => {
  const p = s.predios.ordem.map((id) => s.predios.porId[id] as Predio).find((q) => q.lado === LADO_DA_IA && q.tipo === tipo);
  if (p === undefined) throw new Error(`a IA deveria ter ${tipo}`);
  return p;
};
const escolaDaIA = (s: GameState): string => predioDaIA(s, ID_DA_ESCOLA).id;
const fila = (s: GameState, tipo?: string): number =>
  filaDaEscola(s, escolaDaIA(s)).filter((i) => tipo === undefined || i.unidade === tipo).length;
const prediosCompletosDaIA = (s: GameState): number =>
  s.predios.ordem.filter((id) => { const p = s.predios.porId[id]; return p?.lado === LADO_DA_IA && p.estado === 'completo'; }).length;

/** Mata pela fome (o caminho real da morte, com as liberacoes dela): condicao 0 e um tick. */
function matar(s: GameState, ids: readonly string[]): GameState {
  let atual = s;
  for (const id of ids) {
    const u = atual.unidades.porId[id];
    if (u === undefined) throw new Error(`${id} deveria existir`);
    atual = comUnidade(atual, { ...u, condicao: 0 });
  }
  atual = step(atual, [], gameData);
  for (const id of ids) expect(atual.unidades.porId[id], `${id} deveria ter morrido`).toBeUndefined();
  return atual;
}

/** O ouro nos armazens da IA passa a `quanto`. */
function comOuroDaIA(s: GameState, quanto: number): GameState {
  const armazem = predioDaIA(s, ID_DO_ARMAZEM);
  if (armazem.estado !== 'completo') throw new Error('o armazem da IA deveria estar completo');
  const saida = { ...armazem.estoque.saida, [MERCADORIA_DE_OURO]: quanto };
  const entrada = { ...armazem.estoque.entrada, [MERCADORIA_DE_OURO]: 0 };
  return {
    ...s,
    predios: { ...s.predios, porId: { ...s.predios.porId, [armazem.id]: { ...armazem, estoque: { ...armazem.estoque, saida, entrada } } } },
  };
}

function rodar(s: GameState, ticks: number, aCada?: (s: GameState) => void): GameState {
  let atual = s;
  for (let t = 0; t < ticks; t++) {
    atual = step(atual, [], gameData);
    aCada?.(atual);
  }
  return atual;
}

describe('C-IA-02b — o prefeito minimo', () => {
  it('a escaramuca sem mudanca: nenhum pedido (os civis do dado cobrem, e o ouro esta no limiar)', () => {
    const s = criarEscaramuca(SEMENTE);
    expect(pedidosDoPrefeito(s, LADO_DA_IA, gameData)).toEqual([]);
    const fim = rodar(s, REVISAO * 3);
    expect(fim.treino[escolaDaIA(fim)]).toBeUndefined();
  });

  it('o fazendeiro morto: a escola da IA enfileira um farmer, e ele nasce do lado da IA', () => {
    const s0 = criarEscaramuca(SEMENTE);
    let s = matar(s0, doLado(s0, FARMER));
    let enfileirouNoTick: number | null = null;
    s = rodar(s, REVISAO * 2, (a) => { if (enfileirouNoTick === null && fila(a, FARMER) > 0) enfileirouNoTick = a.tick; });
    expect(enfileirouNoTick, 'o farmer deveria entrar na fila na revisao').not.toBeNull();
    expect((enfileirouNoTick ?? 1) % REVISAO, 'so no tick da revisao').toBe(0);
    let nasceu: number | null = null;
    s = rodar(s, 3000, (a) => { if (nasceu === null && doLado(a, FARMER).length === 1) nasceu = a.tick; });
    expect(nasceu, 'o farmer treinado deveria nascer').not.toBeNull();
    expect(doLado(s, FARMER)).toHaveLength(1);
    gravarEvidencia('C-IA-02b-especialista', { enfileirouNoTick, nasceu, farmers: doLado(s, FARMER).length });
  });

  it('um pedido por falta: os dois padeiros mortos dao, entre vivos e fila, no maximo dois', () => {
    const s0 = criarEscaramuca(SEMENTE);
    let maximo = 0;
    rodar(matar(s0, doLado(s0, BAKER)), REVISAO * 12, (a) => { maximo = Math.max(maximo, doLado(a, BAKER).length + fila(a, BAKER)); });
    expect(maximo).toBe(2);
  });

  it('serfs: com ouro acima do limiar a fila recebe serfs ate 1 por predio, e para ali', () => {
    let s = comOuroDaIA(criarEscaramuca(SEMENTE), pf.ouroMinimoParaSerf * 2);
    const alvo = Math.round(pf.serfsPorPredio * prediosCompletosDaIA(s));
    expect(doLado(s, TIPO_QUE_CARREGA).length, 'a escaramuca comeca com deficit de serf').toBeLessThan(alvo);
    let maximo = 0;
    let maiorFila = 0;
    s = rodar(s, TICKS_DOS_SERFS, (a) => {
      maximo = Math.max(maximo, doLado(a, TIPO_QUE_CARREGA).length + fila(a, TIPO_QUE_CARREGA));
      maiorFila = Math.max(maiorFila, fila(a));
    });
    expect(maximo).toBe(alvo);
    expect(maiorFila).toBeLessThanOrEqual(pf.filaAlvo);
    expect(doLado(s, TIPO_QUE_CARREGA)).toHaveLength(alvo);
    gravarEvidencia('C-IA-02b-serfs', { alvo, serfsNoFim: doLado(s, TIPO_QUE_CARREGA).length, maiorFila, tick: s.tick });
  }, 20_000); // caso trave: isolado leva ~1,5 s, na suite paralela passou de 5 s

  it('serf so com ouro de sobra: com o ouro no limiar, nenhum serf vai para a fila', () => {
    const s = comOuroDaIA(criarEscaramuca(SEMENTE), pf.ouroMinimoParaSerf);
    let serfsNaFila = 0;
    rodar(s, REVISAO * 4, (a) => { serfsNaFila = Math.max(serfsNaFila, fila(a, TIPO_QUE_CARREGA)); });
    expect(serfsNaFila).toBe(0);
    // e um acima do limiar ja pede: a regra acusa
    expect(pedidosDoPrefeito(comOuroDaIA(s, pf.ouroMinimoParaSerf + 1), LADO_DA_IA, gameData).some((p) => p.unidade === TIPO_QUE_CARREGA)).toBe(true);
  });

  it('sem ouro para o treino, o especialista que falta nao entra na fila', () => {
    let s = criarEscaramuca(SEMENTE);
    s = comOuroDaIA(matar(s, doLado(s, FARMER)), 0);
    expect(pedidosDoPrefeito(s, LADO_DA_IA, gameData)).toEqual([]);
    expect(pedidosDoPrefeito(comOuroDaIA(s, 1), LADO_DA_IA, gameData)).toEqual([{ predio: escolaDaIA(s), unidade: FARMER }]);
  });

  it('determinismo: duas corridas com o fazendeiro morto e ouro de sobra dao o mesmo JSON', () => {
    const correr = (): GameState => {
      const s0 = comOuroDaIA(criarEscaramuca(SEMENTE), pf.ouroMinimoParaSerf * 2);
      return rodar(matar(s0, doLado(s0, FARMER)), 1500);
    };
    const a = correr();
    const b = correr();
    expect(a.tick).toBe(1501);
    expect(salvar(a)).toBe(salvar(b));
  }, 20_000); // caso trave
});
