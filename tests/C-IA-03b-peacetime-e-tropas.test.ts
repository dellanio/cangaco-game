/**
 * C-IA-03b (cenario de escaramuca: peacetime e tropas; plano em
 * docs/planos/2026-09-29-C-IA-03-cenario-de-escaramuca.md). Aceite:
 *  - o jogador nasce com a tropa do cenario; a IA com 9 cabras + 3 bodoqueiros nos tiles das
 *    posicoes, e o quartel dela VAZIO: ela nao repoe (operador: "defende o que tem");
 *  - o peacetime (fixo, `data/escaramuca.json`) dura `ticksDePaz`; em paz, marcha, ataque a
 *    unidade, ataque a predio e treino no quartel sao recusados com `em-paz` e o estado nao
 *    muda; construir e alimentar passam; a IA nao sai para o inimigo no raio;
 *  - `peace-ended` sai uma vez, no tick exato; depois dele a marcha passa e a IA defende;
 *  - a partida inteira, headless: paz, marcha, cacar a tropa, derrubar os tres predios, e a
 *    vitoria da F34 dispara — o gemeo deterministico do roteiro da C-IA-03c;
 *  - save com o campo, e o jogo livre sem paz.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, ID_DA_ESCOLA, ID_DO_ARMAZEM, ID_DO_QUARTEL, LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Unidade } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { emPaz, ticksDePazRestantes } from '../src/sim/paz';
import { classeDaUnidade, condicaoCheiaDoTipo } from '../src/sim/condicao';
import { carregar, salvar } from '../src/sim/save';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
const PAZ = gameData.escaramuca.ticksDePaz;
/** A posicao da frente da IA, do dado: as coordenadas abaixo sao relativas a ela, para o
 *  teste valer no mundo transladado (a escaramuca translada junto desde a C-COMBATE-02). */
const FRENTE = (gameData.escaramuca.posicoes.find((p) => p.id === 'frente') as { ponto: { gx: number; gy: number } }).ponto;
const daFrente = (dx: number, dy: number): { gx: number; gy: number } => ({ gx: FRENTE.gx + dx, gy: FRENTE.gy + dy });
const doLado = (s: GameState, lado: number): string[] => s.unidades.ordem.filter((id) => s.unidades.porId[id]?.lado === lado);
const prediosDaIA = (s: GameState): string[] => s.predios.ordem.filter((id) => s.predios.porId[id]?.lado === LADO_DA_IA);
/** C-IA-02a — a vila da IA tem producao: a F34 so pede os tres que seguram o lado */
const QUE_SEGURAM = [ID_DO_ARMAZEM, ID_DA_ESCOLA, ID_DO_QUARTEL] as readonly string[];
const osTresDaIA = (s: GameState): string[] => prediosDaIA(s).filter((id) => QUE_SEGURAM.includes(s.predios.porId[id]?.tipo ?? ''));
/** C-IA-02a — a tropa da IA, sem os civis da vila dela */
const militaresDaIA = (s: GameState): string[] => doLado(s, LADO_DA_IA).filter((id) => classeDaUnidade(s.unidades.porId[id]?.tipo ?? '', gameData) === 'militar');
const tropaDoJogador = (s: GameState): string[] =>
  doLado(s, LADO_DO_JOGADOR).filter((id) => s.unidades.porId[id]?.tipo === gameData.escaramuca.tropaDoJogador.tipo);
const semEventos = (s: GameState): string => salvar({ ...s, events: [], tick: 0 });

/** Avanca ate o fim da paz, de uma vez (sem comandos). */
function ateOFimDaPaz(s0: GameState): { s: GameState; eventos: GameEvent[] } {
  let s = s0;
  const eventos: GameEvent[] = [];
  while (emPaz(s)) {
    s = step(s, [], gameData);
    eventos.push(...s.events);
  }
  return { s, eventos };
}

describe('C-IA-03b — peacetime e tropas', () => {
  const s0 = criarEscaramuca(SEMENTE);

  it('o dado: 20 min base no grupo economia, convertido uma vez; o jogo livre nao tem paz', () => {
    expect(gameData.escaramuca.peacetime_min_base).toBe(20);
    // 20 min x 60 s x 10 Hz / escala economia (time.json, 2,0 hoje: a escala DIVIDE) = 6000 ticks
    // = 10 min de jogo
    expect(PAZ).toBe(6000);
    expect(gameData.conversoes.find((c) => c.caminho === 'escaramuca.peacetime_min_base')).toMatchObject({ grupo: 'economia', unidade: 'min', ticks: PAZ });
    expect(s0.pazAteTick).toBe(PAZ);
    expect(emPaz(s0)).toBe(true);
    expect(ticksDePazRestantes(s0)).toBe(PAZ);
    const livre = createInitialState(SEMENTE);
    expect(livre.pazAteTick).toBeUndefined();
    expect(emPaz(livre)).toBe(false);
  });

  it('as tropas: 18 cabras do jogador; a IA 9 cabras + 3 bodoqueiros nas posicoes, mais os 9 atacantes, e o quartel dela vazio', () => {
    expect(tropaDoJogador(s0)).toHaveLength(18);
    const ia = doLado(s0, LADO_DA_IA).map((id) => s0.unidades.porId[id]?.tipo);
    // C-IA-04 (andaime): os 9 cabras atacantes fora das posicoes
    expect(ia.filter((t) => t === 'militia')).toHaveLength(9 + 9);
    expect(ia.filter((t) => t === 'bowman')).toHaveLength(3);
    const quartel = prediosDaIA(s0).map((id) => s0.predios.porId[id]).find((p) => p?.tipo === 'barracks');
    expect(quartel && quartel.estado === 'completo' ? [quartel.estoque.entrada, quartel.recrutas] : null).toEqual([{}, 0]);
  });

  it('em paz: as quatro ordens de combate sao recusadas e o estado nao muda; a marcha e construir passam', () => {
    const tropa = tropaDoJogador(s0);
    const quartelDaIA = prediosDaIA(s0).find((id) => s0.predios.porId[id]?.tipo === 'barracks') as string;
    const alvo = doLado(s0, LADO_DA_IA)[0] as string;
    const ordens: Command[] = [
      { type: 'AttackUnit', unidades: tropa, alvo },
      { type: 'AttackBuilding', unidades: tropa, predio: quartelDaIA },
      { type: 'TrainSoldier', predio: quartelDaIA, tipo: 'militia' },
      // BUG-S: o mercenario da prefeitura (gicHouseTownHallEquip no KaM) tambem e recusado
      { type: 'HireMercenary', predio: quartelDaIA, tipo: 'rebel' },
    ];
    const semNada = semEventos(step(s0, [], gameData));
    for (const ordem of ordens) {
      const r = step(s0, [ordem], gameData);
      expect(r.events.find((e) => e.type === 'command-rejected'), ordem.type).toMatchObject({ command: ordem.type, motivo: 'em-paz' });
      expect(semEventos(r), ordem.type).toBe(semNada);
    }
    // C-COMBATE-02b (decisao do operador, 2026-09-29): a marcha longe da vila passa em paz
    const marcha = step(s0, [{ type: 'MoveUnits', unidades: tropa, destino: daFrente(-7, -7) }], gameData);
    expect(marcha.events.some((e) => e.type === 'command-rejected')).toBe(false);
    // construir nao e ordem de exercito: passa
    const planta = step(s0, [{ type: 'PlaceBlueprint', buildingId: 'woodcutters', gx: 40, gy: 26 }], gameData);
    expect(planta.events.some((e) => e.type === 'command-rejected' && (e as { motivo?: string }).motivo === 'em-paz')).toBe(false);
  });

  it('em paz a IA nao sai para o inimigo no raio; acabada a paz, sai', () => {
    // um cabra do jogador posto DENTRO do raio da frente, sem encostar em ninguem
    const intruso: Unidade = { id: 'intruso', lado: LADO_DO_JOGADOR, tipo: 'militia', ...daFrente(-5, 0), fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia') };
    const perto: GameState = { ...s0, unidades: { porId: { ...s0.unidades.porId, intruso }, ordem: [...s0.unidades.ordem, 'intruso'] } };
    let s = perto;
    for (let t = 0; t < 30; t++) s = step(s, [], gameData);
    const lutando = (e: GameState): number => doLado(e, LADO_DA_IA).filter((id) => ['indo_lutar', 'lutando'].includes(e.unidades.porId[id]?.fsm ?? '')).length;
    expect(lutando(s)).toBe(0);
    // o mesmo intruso, com a paz no fim: a defesa sai
    let depois: GameState = { ...perto, pazAteTick: perto.tick + 1 };
    for (let t = 0; t < 30; t++) depois = step(depois, [], gameData);
    expect(lutando(depois)).toBeGreaterThan(0);
  });

  it('peace-ended sai uma vez, no tick exato; depois a marcha passa', () => {
    const { s, eventos } = ateOFimDaPaz(s0);
    expect(s.tick).toBe(PAZ);
    expect(eventos.filter((e) => e.type === 'peace-ended')).toHaveLength(1);
    expect(ticksDePazRestantes(s)).toBe(0);
    const r = step(s, [{ type: 'MoveUnits', unidades: tropaDoJogador(s), destino: daFrente(-17, -17) }], gameData);
    expect(r.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    expect(salvar(carregar(salvar(s0)))).toBe(salvar(s0));
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Caro por natureza:
    // anda a paz inteira, PAZ ticks (6000 hoje). Medido: 2,0 / 2,1 / 2,1 / 2,3 s isolado
    // (2026-09-29); o padrao de 5 s estourou num verify local. O limite e ~5x o isolado e
    // acompanha `peacetime_min_base`: paz mais longa, limite maior.
  }, 12_000);

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
      if (t % 50 === 0) {
        const parados = vivos.filter((id) => s.unidades.porId[id]?.fsm === 'ocioso');
        const inimigos = militaresDaIA(s);
        const alvo = inimigos.find((id) => s.unidades.porId[id]?.tipo === 'bowman') ?? inimigos[0];
        const predio = osTresDaIA(s)[0];
        if (parados.length && alvo) cmds.push({ type: 'AttackUnit', unidades: parados, alvo });
        else if (parados.length && predio) cmds.push({ type: 'AttackBuilding', unidades: parados, predio });
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
