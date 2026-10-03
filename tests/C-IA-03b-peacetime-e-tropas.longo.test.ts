/**
 * C-IA-03b (cenario de escaramuca: peacetime e tropas) — a partida inteira, headless: paz,
 * marcha, cacar a tropa, derrubar os tres predios, e a vitoria da F34 dispara. E o gemeo
 * deterministico do roteiro da C-IA-03c, e por isso anda a paz real. Suite longa
 * (`*.longo.test.ts`, `npm run test:longo`; decisao do operador, 2026-10-01). Os outros aceites
 * estao em `C-IA-03b-peacetime-e-tropas.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DA_IA } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';
import { predioNaVista, unidadeNaVista } from '../src/sim/nevoa';
import { ateOFimDaPaz, doLado, militaresDaIA, osTresDaIA, PAZ, SEMENTE, tropaDoJogador } from './helpers/escaramuca-paz';

describe('C-IA-03b — peacetime e tropas, a partida inteira', () => {
  const s0 = criarEscaramuca(SEMENTE);

  it('a partida inteira: paz, marcha, cacar a tropa, derrubar os tres predios — vitoria', () => {
    let { s } = ateOFimDaPaz(s0);
    const tropa = tropaDoJogador(s);
    const iaInicial = doLado(s, LADO_DA_IA).length;
    const frente = gameData.escaramuca.posicoes[0]?.ponto as { gx: number; gy: number };
    s = step(s, [{ type: 'MoveUnits', unidades: tropa, destino: frente }], gameData);
    const violacoes: string[] = [];
    let iaMaxima = iaInicial;
    const marcos: Record<string, number> = { fimDaPaz: PAZ };
    for (let t = 0; t < 12000 && s.partida === undefined; t++) {
      const vivos = tropa.filter((id) => s.unidades.porId[id]);
      if (vivos.length === 0) break;
      const cmds: Command[] = [];
      // a cada 50 ticks, quem esta parado: cacar a tropa (bodoqueiro primeiro); sem tropa, um
      // dos tres predios que seguram o lado (F34). Civil da IA nao e alvo: a vitoria nao o pede.
      // F-COMBATE-ALVO-NA-VISTA: a ordem so vale contra quem se ve. O alvo a vista leva ataque; o
      // que esta no escuro, marcha ate o tile dele (o jogador com nevoa faz assim).
      if (t % 50 === 0) {
        const parados = vivos.filter((id) => s.unidades.porId[id]?.fsm === 'ocioso');
        const inimigos = militaresDaIA(s);
        const aVista = inimigos.filter((id) => unidadeNaVista(s, id));
        const alvo = aVista.find((id) => s.unidades.porId[id]?.tipo === 'bowman') ?? aVista[0];
        const noEscuro = s.unidades.porId[inimigos.find((id) => s.unidades.porId[id]?.tipo === 'bowman') ?? inimigos[0] ?? ''];
        const predio = osTresDaIA(s)[0];
        const p = predio === undefined ? undefined : s.predios.porId[predio];
        if (parados.length && alvo) cmds.push({ type: 'AttackUnit', unidades: parados, alvo });
        else if (parados.length && noEscuro) cmds.push({ type: 'MoveUnits', unidades: parados, destino: { gx: noEscuro.gx, gy: noEscuro.gy } });
        else if (parados.length && predio && predioNaVista(s, predio)) cmds.push({ type: 'AttackBuilding', unidades: parados, predio });
        else if (parados.length && p) cmds.push({ type: 'MoveUnits', unidades: parados, destino: { gx: p.gx, gy: p.gy + 4 } });
      }
      s = step(s, cmds, gameData);
      iaMaxima = Math.max(iaMaxima, doLado(s, LADO_DA_IA).length);
      if (marcos['tropaDaIAMorta'] === undefined && militaresDaIA(s).length === 0) marcos['tropaDaIAMorta'] = s.tick;
      if (t % 100 === 0) violacoes.push(...violacoesDeInvariantes(s, gameData).map((v) => `t${s.tick}: ${v}`));
    }
    expect(violacoes).toEqual([]);
    expect(iaMaxima, 'a IA repos tropa').toBe(iaInicial);
    expect(osTresDaIA(s)).toEqual([]);
    expect(militaresDaIA(s)).toEqual([]);
    expect(s.partida?.fim).toBe('vitoria');
    const sobram = tropa.filter((id) => s.unidades.porId[id]).length;
    expect(sobram).toBeGreaterThan(0);
    gravarEvidencia('C-IA-03b-partida', { ...marcos, vitoria: s.partida?.tick, sobram, de: tropa.length, iaInicial });
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Anda a paz inteira
    // (PAZ ticks) e mais a luta ate a vitoria. Medido: 3,3 / 4,0 s isolado (2026-09-29). O
    // limite e ~5x o isolado; o de antes, 120 s, era 30x e nao pegaria travamento nenhum.
  }, 20_000);
});
