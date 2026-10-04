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
import { gameData, loadGameData, rawGameData } from '../src/sim/data';
import { createInitialState, LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { emPaz, ticksDePazRestantes } from '../src/sim/paz';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { carregar, salvar } from '../src/sim/save';
import { doLado, PAZ, prediosDaIA, SEMENTE, tropaDoJogador } from './helpers/escaramuca-paz';

/** A posicao da frente da IA, do dado: as coordenadas abaixo sao relativas a ela, para o
 *  teste valer no mundo transladado (a escaramuca translada junto desde a C-COMBATE-02). */
const FRENTE = (gameData.escaramuca.posicoes.find((p) => p.id === 'frente') as { ponto: { gx: number; gy: number } }).ponto;
const daFrente = (dx: number, dy: number): { gx: number; gy: number } => ({ gx: FRENTE.gx + dx, gy: FRENTE.gy + dy });
const semEventos = (s: GameState): string => salvar({ ...s, events: [], tick: 0 });

describe('C-IA-03b — peacetime e tropas', () => {
  const s0 = criarEscaramuca(SEMENTE);
  // a "partida inteira" (paz, marcha, cacar, derrubar, vitoria) mora em
  // `C-IA-03b-peacetime-e-tropas.longo.test.ts`, na suite longa

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

  it('as tropas: a tropa do cenario para o jogador; a IA 9 cabras + 3 bodoqueiros nas posicoes, mais os 9 atacantes, e o quartel dela vazio', () => {
    // o tamanho da tropa e dado do cenario (I-COMBATE-ESCARAMUCA-GANHAVEL: 18 -> 24), nao regra
    expect(tropaDoJogador(s0)).toHaveLength(gameData.escaramuca.tropaDoJogador.quantidade);
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
    // O que este teste prova e a REGRA do fim da paz: o evento sai uma vez, no tick
    // `pazAteTick`, e depois dele a marcha passa. Ela nao depende de quantos ticks a paz dura;
    // que o dado da 6000 ticks e o `s0` nasce com eles e o teste 1 ('o dado: 20 min base...').
    // Por isso roda numa COPIA do dado com a paz curta (derivada do dado real: 1/200 dela), e
    // nao anda os 6000 ticks: rodava 2 s isolado e estourava o limite sob carga. Tambem passa
    // a olhar os eventos de TODOS os ticks, e nao so os do ultimo, que e o que "uma vez" pede.
    const raw = JSON.parse(JSON.stringify(rawGameData)) as typeof rawGameData;
    raw.escaramuca.peacetime_min_base = rawGameData.escaramuca.peacetime_min_base / 200;
    const curto = loadGameData(raw);
    const pazCurta = curto.escaramuca.ticksDePaz;
    expect(pazCurta).toBeGreaterThan(1);
    expect(pazCurta).toBeLessThan(PAZ);
    let s = criarEscaramuca(SEMENTE, curto);
    expect(s.pazAteTick).toBe(pazCurta);
    const fins: number[] = [];
    while (s.tick < pazCurta + 5) {
      s = step(s, [], curto);
      if (s.events.some((e) => e.type === 'peace-ended')) fins.push(s.tick);
      if (s.tick === pazCurta) expect(ticksDePazRestantes(s)).toBe(0);
      if (s.tick < pazCurta) expect(emPaz(s)).toBe(true);
    }
    expect(fins).toEqual([pazCurta]);
    const r = step(s, [{ type: 'MoveUnits', unidades: tropaDoJogador(s), destino: daFrente(-17, -17) }], curto);
    expect(r.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    expect(salvar(carregar(salvar(s0)))).toBe(salvar(s0));
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Desde 2026-09-30 o teste
    // anda a paz CURTA (1/200 do dado, ~30 ticks) e leva ~80 ms isolado. O limite de 12 s ficou
    // do tempo em que ele andava os 6000 ticks da paz real (~2 s isolado). Hoje ele so pega
    // travamento de verdade; nao e medida do teste.
  }, 12_000);

});
