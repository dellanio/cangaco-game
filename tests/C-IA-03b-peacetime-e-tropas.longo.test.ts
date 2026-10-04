/**
 * C-IA-03b (cenario de escaramuca: peacetime e tropas) — a partida inteira, headless: paz,
 * marcha, cacar a tropa, derrubar os tres predios, e a partida termina. E o gemeo
 * deterministico do roteiro da C-IA-03c, e por isso anda a paz real. Suite longa
 * (`*.longo.test.ts`, `npm run test:longo`; decisao do operador, 2026-10-01). Os outros aceites
 * estao em `C-IA-03b-peacetime-e-tropas.test.ts`.
 *
 * I-COMBATE-ESCARAMUCA-GANHAVEL (decisao do operador, 2026-10-04): o teste afirma MECANICA — a
 * tropa marcha pelo escuro, ataca o que ve, a IA ataca depois da paz, a partida termina por
 * `match-ended` e e deterministica. Quem vence e quanto sobra e balanceamento do cenario, e nao
 * e assercao. A vitoria fica afirmada so como "este cenario de teste e ganhavel": e dado do
 * cenario (`escaramuca.tropaDoJogador`), e muda quando ele mudar.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { salvar } from '../src/sim/save';
import { FSM_INDO_ATACAR } from '../src/sim/systems/cerco';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';
import { predioNaVista, unidadeNaVista } from '../src/sim/nevoa';
import { ateOFimDaPaz, doLado, militaresDaIA, osTresDaIA, PAZ, SEMENTE, tropaDoJogador } from './helpers/escaramuca-paz';

interface Partida {
  s: GameState;
  tropa: string[];
  iaInicial: number;
  iaMaxima: number;
  violacoes: string[];
  eventos: GameEvent[];
  marcos: Record<string, number>;
}

/** O jogador com nevoa: ataca o inimigo a vista; sem nenhum a vista, marcha ate o tile dele. */
function jogar(): Partida {
  let { s } = ateOFimDaPaz(criarEscaramuca(SEMENTE));
  const tropa = tropaDoJogador(s);
  const iaInicial = doLado(s, LADO_DA_IA).length;
  const frente = gameData.escaramuca.posicoes[0]?.ponto as { gx: number; gy: number };
  s = step(s, [{ type: 'MoveUnits', unidades: tropa, destino: frente }], gameData);
  const violacoes: string[] = [];
  const eventos: GameEvent[] = [...s.events];
  let iaMaxima = iaInicial;
  const marcos: Record<string, number> = { fimDaPaz: PAZ };
  const predioDoJogador = (id: unknown): boolean => typeof id === 'string' && s.predios.porId[id]?.lado === LADO_DO_JOGADOR;
  for (let t = 0; t < 12000 && s.partida === undefined; t++) {
    const vivos = tropa.filter((id) => s.unidades.porId[id]);
    if (vivos.length === 0) break;
    const cmds: Command[] = [];
    // a cada 50 ticks, quem esta parado: cacar a tropa (bodoqueiro primeiro); sem tropa, um
    // dos tres predios que seguram o lado (F34). Civil da IA nao e alvo: a vitoria nao o pede.
    if (t % 50 === 0) {
      const parados = vivos.filter((id) => s.unidades.porId[id]?.fsm === 'ocioso');
      const inimigos = militaresDaIA(s);
      const aVista = inimigos.filter((id) => unidadeNaVista(s, id));
      const alvo = aVista.find((id) => s.unidades.porId[id]?.tipo === 'bowman') ?? aVista[0];
      const noEscuro = s.unidades.porId[inimigos.find((id) => s.unidades.porId[id]?.tipo === 'bowman') ?? inimigos[0] ?? ''];
      const predio = osTresDaIA(s)[0];
      const p = predio === undefined ? undefined : s.predios.porId[predio];
      if (parados.length && alvo) {
        cmds.push({ type: 'AttackUnit', unidades: parados, alvo });
        marcos['primeiroAtaqueAoQueSeVe'] ??= s.tick;
      } else if (parados.length && noEscuro) {
        cmds.push({ type: 'MoveUnits', unidades: parados, destino: { gx: noEscuro.gx, gy: noEscuro.gy } });
        marcos['primeiraMarchaNoEscuro'] ??= s.tick;
      } else if (parados.length && predio && predioNaVista(s, predio)) cmds.push({ type: 'AttackBuilding', unidades: parados, predio });
      else if (parados.length && p) cmds.push({ type: 'MoveUnits', unidades: parados, destino: { gx: p.gx, gy: p.gy + 4 } });
    }
    s = step(s, cmds, gameData);
    eventos.push(...s.events);
    iaMaxima = Math.max(iaMaxima, doLado(s, LADO_DA_IA).length);
    if (marcos['tropaDaIAMorta'] === undefined && militaresDaIA(s).length === 0) marcos['tropaDaIAMorta'] = s.tick;
    // a IA ataca: um militar dela a caminho de um predio do jogador (F28-IA ponto 6)
    if (marcos['iaAtaca'] === undefined && doLado(s, LADO_DA_IA).some((id) => {
      const u = s.unidades.porId[id];
      return u?.fsm === FSM_INDO_ATACAR && predioDoJogador(u.fsmData.alvo);
    })) marcos['iaAtaca'] = s.tick;
    // a tropa marcha pelo escuro: alguem dela andando sem nenhum militar da IA a vista
    if (marcos['marchandoNoEscuro'] === undefined && militaresDaIA(s).every((id) => !unidadeNaVista(s, id))
      && tropa.some((id) => s.unidades.porId[id]?.fsm === 'marchando')) marcos['marchandoNoEscuro'] = s.tick;
    if (t % 100 === 0) violacoes.push(...violacoesDeInvariantes(s, gameData).map((v) => `t${s.tick}: ${v}`));
  }
  return { s, tropa, iaInicial, iaMaxima, violacoes, eventos, marcos };
}

describe('C-IA-03b — peacetime e tropas, a partida inteira', () => {
  it('a mecanica da partida inteira: marcha no escuro, ataque ao que se ve, a IA ataca depois da paz, e a partida termina', () => {
    const { s, tropa, iaInicial, iaMaxima, violacoes, eventos, marcos } = jogar();
    expect(violacoes).toEqual([]);
    expect(iaMaxima, 'a IA repos tropa').toBe(iaInicial);
    // a tropa marchou pelo escuro, e atacou o que via, depois da paz
    expect(marcos['marchandoNoEscuro']).toBeGreaterThan(PAZ);
    expect(marcos['primeiroAtaqueAoQueSeVe']).toBeGreaterThan(PAZ);
    // nenhuma ordem do jogador foi recusada: so se mandou atacar o que estava a vista
    expect(eventos.filter((e) => e.type === 'command-rejected')).toEqual([]);
    // a IA atacou um predio do jogador, e so depois da paz
    expect(marcos['iaAtaca']).toBeGreaterThan(PAZ);
    // a partida terminou, uma vez, pelo evento
    const fins = eventos.filter((e) => e.type === 'match-ended');
    expect(fins).toHaveLength(1);
    expect(s.partida?.fim).toBeDefined();
    // ESTE CENARIO DE TESTE E GANHAVEL. E dado do cenario (`escaramuca.tropaDoJogador`, 24 em
    // 2026-10-04), e nao regra: muda quando o cenario mudar.
    expect(s.partida?.fim).toBe('vitoria');
    const sobram = tropa.filter((id) => s.unidades.porId[id]).length;
    gravarEvidencia('C-IA-03b-partida', { ...marcos, vitoria: s.partida?.tick, sobram, de: tropa.length, iaInicial });
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Anda a paz inteira
    // (PAZ ticks) e mais a luta, duas vezes (o determinismo abaixo). Medido: 3,3 / 4,0 s isolado
    // por partida (2026-09-29).
  }, 40_000);

  it('deterministica: a mesma partida duas vezes da o mesmo estado final, byte a byte', () => {
    const a = jogar();
    const b = jogar();
    expect(a.s.tick).toBe(b.s.tick);
    expect(salvar(a.s)).toBe(salvar(b.s));
  }, 40_000);
});
