/**
 * I-TRANSPORTE-INSUMO-QUE-ESPERA — o insumo que espera demais deixa de pagar a multa do armazem (aceite no
 * BUILD_PLAN.md; correcao do BUG-CARGA-INFINITA-SEM-VEZ). A regra pura, pela ordem do quadro. A corrida B
 * da carga infinita mora em `D-TRANSPORTE-03-logistica-kam.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState, Tarefa } from '../src/sim/state';
import { criarTarefaDeInsumo, tarefasEmOrdem } from '../src/sim/jobs';
import { cenarioDaCadeiaDoFerro, comEntrada, comSaida } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const CONSUMIDORES = ['fu1', 'ws1', 'as1'] as const;
const ESPERA = gameData.entrega.lance.ticksEsperaSemMulta;

/** Tres tarefas de carvao, com carvao de sobra no armazem (nao e o escasso: a vez nao entra, o custo decide). */
function tresTarefas(): GameState {
  let s = comSaida(cenarioDaCadeiaDoFerro(), 'arm', { coal: 100 });
  for (const id of CONSUMIDORES) s = comEntrada(s, id, { coal: 0 });
  for (const destino of CONSUMIDORES) s = criarTarefaDeInsumo(s, { mercadoria: 'coal', origem: 'arm', destino, parada: true }).state;
  return s;
}
const ordem = (s: GameState): string[] =>
  tarefasEmOrdem(s, null, gameData).flatMap((t) => (t.tipo === 'insumo-producao-parada' && t.mercadoria === 'coal' ? [t.destino] : []));
/** A tarefa para `destino` aberta em `abertaEm` (undefined: sem o campo, como num save antigo). */
function abertaEm(s: GameState, destino: string, tick: number | undefined): GameState {
  const porId: Record<string, Tarefa> = { ...s.jobs.tarefas.porId };
  for (const id of s.jobs.tarefas.ordem) {
    const t = porId[id];
    if (t === undefined || t.tipo !== 'insumo-producao-parada' || t.destino !== destino) continue;
    const { abertaEm: _a, ...sem } = t;
    void _a;
    porId[id] = tick === undefined ? sem : { ...sem, abertaEm: tick };
  }
  return { ...s, jobs: { ...s.jobs, tarefas: { ...s.jobs.tarefas, porId } } };
}

describe('I-TRANSPORTE-INSUMO-QUE-ESPERA', () => {
  it('aceite 1: a tarefa de insumo nasce com o tick em que abriu', () => {
    const s = tresTarefas();
    const insumos = s.jobs.tarefas.ordem.map((id) => s.jobs.tarefas.porId[id]).filter((t) => t?.tipo === 'insumo-producao-parada');
    expect(insumos.length).toBe(3);
    for (const t of insumos) expect(t !== undefined && 'abertaEm' in t ? t.abertaEm : null).toBe(s.tick);
  });

  it('aceite 2: a mais longe com a espera vencida vem antes; sem ela, ou sem o campo, a ordem de antes', () => {
    // o relogio no tick em que as tres abriram: so a mais longe recua (abriu antes)
    const base = tresTarefas();
    const antes = ordem(base);
    const longe = antes.at(-1) as string;
    const casos = {
      vencida: ordem(abertaEm(base, longe, base.tick - ESPERA)),
      quaseVencida: ordem(abertaEm(base, longe, base.tick - ESPERA + 1)),
      semCampo: ordem(abertaEm(base, longe, undefined)),
    };
    gravarEvidencia('I-TRANSPORTE-INSUMO-QUE-ESPERA', { esperaEmTicks: ESPERA, antes, ...casos });
    expect(casos.vencida[0]).toBe(longe);
    expect(casos.quaseVencida).toEqual(antes);
    expect(casos.semCampo).toEqual(antes);
  });
});
