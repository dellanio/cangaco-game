/**
 * F16a — Tarefa 1: a SONDA da porta, rodada ANTES de existir `DemolishBuilding`.
 *
 * A nota da F13a no BUILD_PLAN suspeita de travamento de regra: "estrada da porta
 * demolida com um item de treino ja pago" deixaria o item preso com o ouro cobrado.
 * O comando `DemolishRoad` existe desde a F08, entao o caso e alcancavel hoje — e
 * medi-lo vem antes de escrever qualquer codigo novo em cima.
 *
 * Duas medicoes, nesta ordem:
 *  (1a) a hipotese escrita: demolir a estrada da porta com item pago;
 *  (1b) a porta coberta por FOOTPRINT, que e a via que `tileDeSaida` enxerga.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { filaDaEscola } from '../src/sim/escola';
import { ehEstrada, tilesDaPorta } from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import { canPlace } from '../src/sim/placement';
import { tileDeSaida } from '../src/sim/systems/escolas';
import {
  armazemPorTipo, avancar, avancarAte, comOuroNoArmazem, escolaDoCenario,
  novasUnidades, pedir, totalDeOuro,
} from './helpers/escola-cenario';
import { comEstradas, comObra, linhaH } from './helpers/jobs-cenario';
import { gravarEvidencia } from './helpers/evidence';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;
const ARMAZEM = armazemPorTipo(inicial).id;
const TICKS = gameData.economia.schoolhouse.ticksPorTreino;
/** A mesma linha de porta do aceite da F13a: armazem em x 29..31, escola em x 34..36. */
const RUAS = linhaH(29, 36, 33);
const PORTAS = tilesDaPorta(escolaDoCenario(inicial));

const demolirEstrada = (tiles: readonly TileDeGrid[]) =>
  ({ type: 'DemolishRoad', tiles } as const);

/** Estado com UM treino ja COBRADO: o ouro saiu da caixa e o item esta `treinando`. */
function comTreinoPago(): GameState {
  const cenario = comOuroNoArmazem(comEstradas(inicial, RUAS), ARMAZEM, 1);
  const enfileirado = step(cenario, [pedir(ESCOLA, 'serf')]);
  const pago = avancarAte(
    enfileirado, (e) => filaDaEscola(e, ESCOLA)[0]?.estado === 'treinando', 600,
  );
  if (filaDaEscola(pago, ESCOLA)[0]?.estado !== 'treinando') {
    throw new Error('sonda: o treino nao chegou a comecar');
  }
  return pago;
}

describe('F16a — sonda da porta (Tarefa 1)', () => {
  it('1a: demolir a estrada da porta NAO segura o item pago — a hipotese da F13a nao se confirma', () => {
    const pago = comTreinoPago();
    // O ouro ja foi cobrado: nao ha mais nenhum no mapa. E isso que torna o caso grave.
    expect(totalDeOuro(pago)).toBe(0);

    const semEstrada = step(pago, [demolirEstrada(PORTAS)]);
    expect(PORTAS.every((t) => ehEstrada(semEstrada.estradas, t))).toBe(false);
    expect(PORTAS.some((t) => ehEstrada(semEstrada.estradas, t))).toBe(false);

    // A porta continua ANDAVEL: `tileDeSaida` pergunta por footprint (modo 'livre'),
    // nao por estrada. A unidade nasce normalmente.
    const saida = tileDeSaida(semEstrada, escolaDoCenario(semEstrada));
    expect(saida).not.toBeNull();

    const fim = avancar(semEstrada, TICKS + 10);
    const novas = novasUnidades(pago, fim);
    expect(novas.map((u) => u.tipo)).toEqual(['serf']);
    expect(filaDaEscola(fim, ESCOLA)).toEqual([]);
    expect(PORTAS.map((t) => `${t.gx},${t.gy}`)).toContain(`${novas[0]!.gx},${novas[0]!.gy}`);
  });

  it('1b: a porta coberta por FOOTPRINT trava mesmo — e por isso o canPlace recusa', () => {
    const pago = comTreinoPago();
    const semEstrada = step(pago, [demolirEstrada(PORTAS)]);
    const x0 = Math.min(...PORTAS.map((t) => t.gx));
    const y0 = PORTAS[0]!.gy;

    // 1. O CAMINHO DE JOGO ESTA FECHADO. Era este `canPlace` que, ate a Tarefa 1.5
    //    desta feature, devolvia `{ ok: true }` aqui: so checava footprint contra
    //    footprint, e a porta alheia nao era footprint de ninguem.
    expect(canPlace(semEstrada, 'quarry', x0, y0)).toEqual({ ok: false, motivo: 'porta-sem-saida' });
    const recusado = step(semEstrada, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: x0, gy: y0 }]);
    expect(recusado.predios.ordem).toEqual(semEstrada.predios.ordem);

    // 2. O TRAVAMENTO QUE JUSTIFICA A REGRA continua real: injetando a obra no estado
    //    (fixture, fora do comando), a escola perde a saida e o item PAGO fica preso.
    //    O `if (tile === null) continue` de `systems/escolas.ts` vira defesa sem
    //    caminho de jogo — nao codigo morto, mas tambem nao situacao alcancavel.
    const tampado = comObra(semEstrada, 'tampa-da-porta', { gx: x0, gy: y0, faltam: { stone: 1 } });
    expect(tileDeSaida(tampado, escolaDoCenario(tampado))).toBeNull();

    const preso = avancar(tampado, TICKS + 200);
    const item = filaDaEscola(preso, ESCOLA)[0];
    const emTreino = item?.estado === 'treinando' ? item : null;
    expect(novasUnidades(pago, preso)).toEqual([]);
    expect(emTreino).not.toBeNull();
    expect(emTreino?.restam).toBe(1);
    expect(totalDeOuro(preso)).toBe(0); // ouro cobrado, unidade que nunca nasce

    // 3. E sem a tampa, no mesmo cenario e sem estrada nenhuma na porta, nasce.
    const livre = avancar(semEstrada, TICKS + 10);
    expect(novasUnidades(pago, livre).map((u) => u.tipo)).toEqual(['serf']);

    gravarEvidencia('F16a-porta', {
      feature: 'F16a — Tarefa 1: sonda da porta, antes de DemolishBuilding existir',
      hipoteseDaF13a: {
        enunciado: 'estrada da porta demolida com item de treino ja pago prende o item',
        confirmada: false,
        porque: "tileDeSaida chama tileAndavel(..., 'livre'): estrada nao entra na conta",
        medicao: {
          portas: PORTAS.map((t) => `${t.gx},${t.gy}`),
          estradaNaPortaDepoisDoDemolishRoad: false,
          unidadeNasceu: true,
        },
      },
      viaReal: {
        enunciado: 'porta coberta por FOOTPRINT — a unica via que tileDeSaida enxerga',
        canPlaceAceitavaAntesDaTarefa15: true,
        canPlaceAgora: canPlace(semEstrada, 'quarry', x0, y0),
        travamentoPorInjecao: {
          ticksEsperados: TICKS + 200,
          unidadesNovas: novasUnidades(pago, preso).length,
          item: emTreino ? { estado: emTreino.estado, restam: emTreino.restam } : null,
          ouroNoMapa: totalDeOuro(preso),
          tileDeSaida: null,
        },
      },
    });
  });
});
