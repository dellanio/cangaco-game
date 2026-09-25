/**
 * SONDA da F21 (temporaria, prefixo zz-, sai no fim da feature). NAO e guarda
 * permanente: mede o que a cadeia do ouro JA faz sem uma linha de codigo novo,
 * como a F19 e a F19b fizeram antes de escrever escopo.
 *
 * Pergunta 1: `gold_mine` + `coal_mine` -> `metallurgists` -> `gold` no armazem
 * acontece hoje? Todas as tres receitas existem em `data/production.json` e a
 * producao e generica desde a F15a, entao a hipotese e que sim.
 * Pergunta 2: as minas esgotam? O item da fila diz que ouro, carvao e ferro
 * "herdam a camada da F-T2 prontos"; `data/resources.json` tem quatro tipos
 * (corn, fish, rock, tree) e o mapa emitido tem tres recursos (rock, tree,
 * fish). A sonda mede em vez de argumentar.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState } from '../src/sim/state';
import { createInitialState, ID_DO_ARMAZEM } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { chaveDeTile } from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import { receitaDoTipo } from '../src/sim/producao';
import {
  comArmazemExtra, comBodegaAbastecida, comProdutorOcupado, comSerfs,
} from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const DADOS: GameData = gameData;

const tile = (gx: number, gy: number): TileDeGrid => ({ gx, gy });

/** Todos os predios com a borda sul em y=61, porta em y=62, e a rua em y=62:
 *  uma linha so liga a cadeia inteira ao armazem. Area conferida livre de
 *  recurso e de terreno intransponivel no mapa emitido (x=50..72, y=58..63). */
function cenarioDoOuro(dados: GameData = DADOS): GameState {
  let s: GameState = { ...createInitialState(1, dados), unidades: { porId: {}, ordem: [] } };
  s = comArmazemExtra(s, 'arm', 50, 59, dados);
  s = comProdutorOcupado(s, { tipo: 'gold_mine', id: 'go1', unidade: 'mineiro-ouro', gx: 54, gy: 61 }, dados);
  s = comProdutorOcupado(s, { tipo: 'coal_mine', id: 'co1', unidade: 'mineiro-carvao', gx: 57, gy: 60 }, dados);
  s = comProdutorOcupado(s, { tipo: 'metallurgists', id: 'me1', unidade: 'metalurgico', gx: 61, gy: 59 }, dados);
  const rua: TileDeGrid[] = [];
  for (let gx = 50; gx <= 72; gx += 1) rua.push(tile(gx, 62));
  const novas = Object.fromEntries(rua.map((t) => [chaveDeTile(t), true as const]));
  s = { ...s, estradas: { ...s.estradas, ...novas } };
  s = comBodegaAbastecida(s, 'bodega', 'arm', dados);
  return comSerfs(s, 6, 50, 62);
}

const estoqueDe = (e: GameState, id: string): Record<string, number> => {
  const p = e.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') return {};
  const total: Record<string, number> = {};
  for (const gaveta of [p.estoque.entrada, p.estoque.saida]) {
    for (const [k, v] of Object.entries(gaveta)) total[k] = (total[k] ?? 0) + v;
  }
  return total;
};

describe('sonda F21 — a cadeia do ouro sem codigo novo', () => {
  it('mede 8000 ticks e grava o que chegou', () => {
    let s = cenarioDoOuro();
    const linhaDeBase = {
      armazemInicial: estoqueDe(s, ID_DO_ARMAZEM),
      armExtra: estoqueDe(s, 'arm'),
    };
    const marcos: Record<string, number> = {};
    const anota = (chave: string, tick: number): void => {
      if (marcos[chave] === undefined) marcos[chave] = tick;
    };
    for (let t = 1; t <= 8000; t += 1) {
      s = step(s, [], DADOS);
      if ((estoqueDe(s, 'go1').gold_ore ?? 0) > 0) anota('primeiroMinerioDeOuro', t);
      if ((estoqueDe(s, 'co1').coal ?? 0) > 0) anota('primeiroCarvao', t);
      if ((estoqueDe(s, 'me1').gold_ore ?? 0) > 0) anota('minerioNaMetalurgia', t);
      if ((estoqueDe(s, 'me1').coal ?? 0) > 0) anota('carvaoNaMetalurgia', t);
      if ((estoqueDe(s, 'me1').gold ?? 0) > 0) anota('primeiroOuroFundido', t);
      if ((estoqueDe(s, 'arm').gold ?? 0) > 0) anota('ouroNoArmazem', t);
    }

    const vivos = Object.values(s.unidades.porId).length;
    const porTipo: Record<string, number> = {};
    for (const t of Object.values(s.jobs.tarefas.porId)) {
      const chave = `${t.tipo}/${t.estado}`;
      porTipo[chave] = (porTipo[chave] ?? 0) + 1;
    }
    gravarEvidencia('zz-probe-F21', {
      pergunta: 'a cadeia do ouro funciona hoje, e as minas esgotam?',
      linhaDeBase,
      marcos,
      noFim: {
        tick: s.tick,
        go1: estoqueDe(s, 'go1'),
        co1: estoqueDe(s, 'co1'),
        me1: estoqueDe(s, 'me1'),
        arm: estoqueDe(s, 'arm'),
        unidadesVivas: vivos,
        tarefas: porTipo,
      },
      veio: {
        campoNoPredio: 'nao existe: `Producao` nao tem `veio` desde a F-T2a — o total foi para o tile',
        receitaGoldMine: receitaDoTipo('gold_mine', DADOS),
        receitaMetalurgia: receitaDoTipo('metallurgists', DADOS),
        receitaCoalMine: receitaDoTipo('coal_mine', DADOS),
        tiposDeRecursoNoDado: Object.keys(DADOS.recursos.tipos),
      },
    });
    expect(s.tick).toBe(8000);
  });
});
