/**
 * BUG-G — A UNIDADE DEBAIXO DE UM FOOTPRINT NOVO SAI DELE.
 *
 * O A* (`sim/pathfinding.ts`, `liberados`) deixa quem esta dentro de um footprint
 * atravessar a CAIXA inteira em que esta — civis nao colidem, e a obra plantada em
 * cima de alguem nao pode prende-lo. Os passos de movimento perguntavam so
 * `tileAndavel(proximo)`, que diz "bloqueado" para o mesmo tile que o A* liberou:
 * a unidade recalculava, recebia o mesmo caminho e andava 1 de progresso, todo
 * tick, ate morrer de fome. O conserto e um predicado so, `passoAndavel`, com a
 * mesma regra do A*, usado em todo passo.
 *
 * POR QUE O CENARIO E PROVOCADO, E NAO O DA SONDA: o bug foi achado com o campo do
 * Rocado atras da fazenda (BUGS.md), e o Moinho caia no tick exato em que o roceiro
 * estava no canto dele. Isso e ritmo: com a pedra inicial 30 (`572f6fa`) a mesma
 * geometria deixou de acertar o roceiro, e o defeito ficou no codigo sem nada que o
 * disparasse. Aqui a vila da F-CAL-a roda como e, e o teste PLANTA um predio em
 * cima de uma unidade que esta andando — uma vez para cada estado de caminhada que
 * a vila exibe. Nenhuma coordenada e digitada: a unidade, o tipo e o canto saem do
 * estado e do `canPlace` da sim.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import type { TileDeGrid } from '../src/sim/estradas';
import { caixaDeTipo } from '../src/sim/footprint';
import { canPlace } from '../src/sim/placement';
import { passoAndavel, tileAndavel, tileCobertoPorPredio } from '../src/sim/pathfinding';
import { noTile } from '../src/sim/units/movimento';
import { comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import { gravarEvidencia } from './helpers/evidence';

/** A vila da F-CAL-a ate aqui: todos os predios da cadeia sobem antes (tick ~6 000). */
const TICKS = 9_000;
/** O estado do bug, o do roceiro voltando com a colheita. */
const FSM_DO_BUG = 'voltando';

const assinatura = (u: Unidade): string => `${u.gx},${u.gy}|${u.fsm}|${JSON.stringify(u.fsmData)}`;
const dentro = (t: TileDeGrid, c: { x0: number; x1: number; y0: number; y1: number }): boolean => (
  t.gx >= c.x0 && t.gx < c.x1 && t.gy >= c.y0 && t.gy < c.y1);

/** Um PlaceBlueprint que cobre `u` e o proximo tile dele, ou `null`. Tipo e canto, na ordem do dado. */
function plantarEmCima(s: GameState, u: Unidade): Command | null {
  const proximo = (u.fsmData.caminho ?? [])[0];
  if (proximo === undefined) return null;
  for (const def of gameData.predios) {
    const [w = 1, h = 1] = def.tamanho;
    for (let gy = u.gy - h + 1; gy <= u.gy; gy += 1) {
      for (let gx = u.gx - w + 1; gx <= u.gx; gx += 1) {
        const caixa = caixaDeTipo(def.id, gx, gy, gameData);
        if (caixa === null || !dentro(proximo, caixa)) continue;
        if (canPlace(s, def.id, gx, gy, gameData).ok) return { type: 'PlaceBlueprint', buildingId: def.id, gx, gy };
      }
    }
  }
  return null;
}

interface Plantio {
  readonly fsm: string;
  readonly unidade: string;
  readonly tick: number;
  readonly predio: string;
  /** Ticks ate a unidade sair de debaixo de todo footprint. */
  readonly ticksAteSair: number | null;
  /** Ticks em que o fsmData dela NAO mudou enquanto estava debaixo, com caminho. */
  readonly ticksParada: number;
  /** Passos que o `tileAndavel` recusava e o `passoAndavel` aceita: o que o bug travava. */
  readonly passosDaCaixa: number;
}

/** Tempo de seguir a unidade depois do plantio: sobra para atravessar qualquer caixa. */
const SEGUIR = 400;

function correr(fsm: string): Plantio | null {
  let s: GameState = createInitialState(gameData.economia.estadoInicial.semente);
  const vila = vilaDaCalibracao(s);
  for (let i = 0; i < TICKS; i += 1) {
    const comandos: Command[] = [...comandosDaVilaNoTick(s, vila, i)];
    let alvo: { u: Unidade; cmd: Command } | null = null;
    for (const id of s.unidades.ordem) {
      const u = s.unidades.porId[id];
      if (u === undefined || u.fsm !== fsm || tileCobertoPorPredio(s, noTile(u), gameData)) continue;
      const cmd = plantarEmCima(s, u);
      if (cmd !== null) { alvo = { u, cmd }; break; }
    }
    if (alvo === null) {
      s = step(s, comandos);
      continue;
    }
    const tick = s.tick;
    s = step(s, [...comandos, alvo.cmd]);
    const id = alvo.u.id;
    let anterior = s.unidades.porId[id];
    let ticksAteSair: number | null = null;
    let ticksParada = 0;
    let passosDaCaixa = 0;
    for (let k = 1; k <= SEGUIR && anterior !== undefined; k += 1) {
      if (!tileCobertoPorPredio(s, noTile(anterior), gameData)) { ticksAteSair = k; break; }
      const proximo = (anterior.fsmData.caminho ?? [])[0];
      if (proximo !== undefined && !tileAndavel(s, proximo, 'livre', gameData)
        && passoAndavel(s, noTile(anterior), proximo, 'livre', gameData)) passosDaCaixa += 1;
      s = step(s, [...comandosDaVilaNoTick(s, vila, tick + k)]);
      const agora = s.unidades.porId[id];
      if (agora !== undefined && (agora.fsmData.caminho ?? []).length > 0 && assinatura(agora) === assinatura(anterior)) {
        ticksParada += 1;
      }
      anterior = agora;
    }
    const predio = alvo.cmd.type === 'PlaceBlueprint' ? alvo.cmd.buildingId : '';
    return { fsm, unidade: id, tick, predio, ticksAteSair, ticksParada, passosDaCaixa };
  }
  return null;
}

/** Os estados de caminhada a pe que a vila exibe; `indo_comer` so com fome, fora daqui. */
const FSMS = ['indo_buscar', 'indo_entregar', 'devolvendo', 'indo_a_obra', 'indo_ocupar', 'indo_colher', FSM_DO_BUG] as const;

describe('BUG-G — preso dentro de um footprint plantado em cima dele', () => {
  const plantios = FSMS.map((f) => correr(f));
  gravarEvidencia('BUG-G-preso-no-footprint', { ticks: TICKS, seguir: SEGUIR, plantios });
  const achados = plantios.filter((p): p is Plantio => p !== null);

  it('o cenario acontece: o predio cai em cima de quem volta com a colheita', () => {
    const doBug = achados.find((p) => p.fsm === FSM_DO_BUG);
    expect(doBug).toBeDefined();
    // o guarda que prova que o teste exerce o bug: o tile que o passo antigo recusava
    expect(achados.reduce((a, p) => a + p.passosDaCaixa, 0)).toBeGreaterThan(0);
  });

  it('quem fica debaixo de um footprint novo sai dele, e nunca fica parado com caminho', () => {
    for (const p of achados) {
      expect(p.ticksAteSair, `${p.fsm} (${p.unidade}, ${p.predio} no tick ${p.tick})`).not.toBeNull();
      expect(p.ticksParada, `${p.fsm} (${p.unidade})`).toBe(0);
    }
  });
});
