/**
 * I-COMBATE-ESCARAMUCA-GANHAVEL-NA-SECA (emenda de 2026-10-10) — o clique num predio inimigo que a
 * tropa nao ve vira marcha ate a PORTA dele, e nao ate o tile clicado (que e dentro do footprint e a
 * sim recusava com `destino-inandavel`, deixando a tropa parada ate morrer de fome no C-IA-03c).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { predioNaVista } from '../src/sim/nevoa';
import { tileAndavel } from '../src/sim/pathfinding';
import { tilesDaPorta } from '../src/sim/estradas';
import { caixaDoPredio } from '../src/sim/footprint';
import { predioNoTile } from '../src/sim/selectors';
import { destinoDaMarcha, ordemDoBotaoDireito } from '../src/ui/ordem-militar';
import { ateOFimDaPaz, osTresDaIA, SEMENTE, tropaDoJogador } from './helpers/escaramuca-paz';

const { s: depoisDaPaz } = ateOFimDaPaz(criarEscaramuca(SEMENTE));

function predioNaNevoa(s: GameState): string {
  const id = osTresDaIA(s).find((p) => !predioNaVista(s, p));
  if (id === undefined) throw new Error('nenhum predio da IA fora da vista depois da paz');
  return id;
}

/** O tile de dentro do footprint, como o roteiro clica (gx + 1, gy + 1). */
function tileDeDentro(s: GameState, id: string): { gx: number; gy: number } {
  const p = s.predios.porId[id]!;
  return { gx: p.gx + 1, gy: p.gy + 1 };
}

describe('I-COMBATE-ESCARAMUCA-GANHAVEL-NA-SECA — a marcha ao predio na nevoa vai a porta', () => {
  it('(a) por tabela: predio na nevoa -> porta andavel mais perto; sem predio -> o clicado; sem porta andavel -> o clicado', () => {
    const s = depoisDaPaz;
    const id = predioNaNevoa(s);
    const dentro = tileDeDentro(s, id);
    expect(tileAndavel(s, dentro, 'livre', gameData)).toBe(false);
    const portas = tilesDaPorta(s.predios.porId[id]!, gameData).filter((t) => tileAndavel(s, t, 'livre', gameData));
    expect(portas.length).toBeGreaterThan(0);
    const ate = destinoDaMarcha(s, gameData, dentro);
    expect(portas).toContainEqual(ate);
    const dist = (t: { gx: number; gy: number }): number => Math.abs(t.gx - dentro.gx) + Math.abs(t.gy - dentro.gy);
    expect(dist(ate)).toBe(Math.min(...portas.map(dist)));

    // tile nao andavel sem predio (agua, rocha, arvore): o destino e o clicado, como antes
    const { largura, altura } = gameData.terreno.mapaPadrao;
    let semPredio: { gx: number; gy: number } | undefined;
    for (let gy = 0; gy < altura && semPredio === undefined; gy++) {
      for (let gx = 0; gx < largura; gx++) {
        if (!tileAndavel(s, { gx, gy }, 'livre', gameData) && predioNoTile(s, gx, gy, gameData) === null) { semPredio = { gx, gy }; break; }
      }
    }
    expect(semPredio).toBeDefined();
    expect(destinoDaMarcha(s, gameData, semPredio!)).toEqual(semPredio);

    // tile andavel: o clicado, sem mudanca
    expect(destinoDaMarcha(s, gameData, portas[0]!)).toEqual(portas[0]);

    // predio sem porta andavel (a borda sul fora do mapa): o clicado
    const caixa = caixaDoPredio(s.predios.porId[id]!, gameData)!;
    const movido = { ...s.predios.porId[id]!, gy: s.predios.porId[id]!.gy + (altura - caixa.y1) };
    const preso: GameState = { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [id]: movido } } };
    const dentroDoPreso = tileDeDentro(preso, id);
    expect(predioNoTile(preso, dentroDoPreso.gx, dentroDoPreso.gy, gameData)).toBe(id);
    expect(destinoDaMarcha(preso, gameData, dentroDoPreso)).toEqual(dentroDoPreso);
  });

  it('(b) pelo step: a ordem do botao direito no predio na nevoa nao e recusada e a tropa sai de ocioso', () => {
    let s = depoisDaPaz;
    const id = predioNaNevoa(s);
    const tropa = tropaDoJogador(s);
    const { comandos } = ordemDoBotaoDireito(s, gameData, LADO_DO_JOGADOR, tropa, tileDeDentro(s, id), []);
    expect(comandos).toHaveLength(1);
    expect(comandos[0]!.type).toBe('MoveUnits');
    s = step(s, comandos, gameData);
    expect(s.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    for (let i = 0; i < 20; i++) s = step(s, [], gameData);
    const ociosos = tropa.filter((u) => s.unidades.porId[u]?.fsm === 'ocioso');
    expect(ociosos.length).toBeLessThan(tropa.length);
  });
});
