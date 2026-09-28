/**
 * F25a — o Quartel na sim (plano em docs/planos/2026-09-28-A8-F25a-quartel.md).
 *
 * Aceite escrito na sessao autonoma (leitura conservadora do GDD §2.3, §6.1 e Anexo A
 * 12.1; PARA REVISAO):
 *  (a) os requisitos de soldado VIAJAM do armazem ao quartel pelo JobBoard, e o que
 *      chegou nao volta (nada vira excedente);
 *  (b) o recruta ocioso se alista: anda ate a porta e entra (`recrutas` sobe, a
 *      unidade sai do estado);
 *  (c) `TrainSoldier` consome 1 de cada requisito e 1 recruta, e o soldado nasce na
 *      porta no mesmo tick, com o lado do quartel — miliciano e cavaleiro (o cavalo);
 *  (d) cada recusa tem motivo e deixa o estado igual;
 *  (e) a mesma corrida duas vezes da o mesmo estado; as invariantes valem a cada tick.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, ID_DO_ARMAZEM, ID_DO_RECRUTA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, PredioCompleto, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Command } from '../src/sim/commands';
import { canPlace } from '../src/sim/placement';
import { buscarCaminho } from '../src/sim/pathfinding';
import { chaveDeTile, predioLigadoAoArmazem, tilesDaPorta } from '../src/sim/estradas';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const QUARTEL = 'q-quartel';
const armazemDe = (s: GameState): PredioCompleto =>
  s.predios.porId[s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === ID_DO_ARMAZEM) as string] as PredioCompleto;
const quartelDe = (s: GameState): PredioCompleto => s.predios.porId[QUARTEL] as PredioCompleto;

/** A vila da abertura mais um quartel COMPLETO, ligado ao armazem por uma rua que o
 *  proprio A* traca (porta a porta), e `armas` na gaveta de saida do armazem. */
function vilaComQuartel(armas: Record<string, number>, recrutas: number): GameState {
  let s = createInitialState(1);
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'sawmill'])] };
  let lugar: { gx: number; gy: number } | null = null;
  for (let r = 4; r < 30 && lugar === null; r += 1) {
    for (let d = -r; d <= r && lugar === null; d += 1) {
      const p = naVila(d, r);
      if (canPlace(busca, 'barracks', p.gx, p.gy, gameData).ok) lugar = p;
    }
  }
  if (lugar === null) throw new Error('fixture: o quartel nao coube');
  const quartel = completarObra({
    lado: LADO_DO_JOGADOR, id: QUARTEL, tipo: 'barracks', ...lugar, estado: 'obra', hp: 600,
    obra: { faltam: {}, nivelamento: 0 },
  }, gameData);
  s = { ...s, predios: { porId: { ...s.predios.porId, [QUARTEL]: quartel }, ordem: [...s.predios.ordem, QUARTEL] } };
  const armazem = armazemDe(s);
  const rua = buscarCaminho(s, tilesDaPorta(quartel, gameData)[0] as { gx: number; gy: number }, tilesDaPorta(armazem, gameData), 'livre', gameData);
  if (rua === null) throw new Error('fixture: sem caminho do quartel ao armazem');
  const tiles = [tilesDaPorta(quartel, gameData)[0] as { gx: number; gy: number }, ...rua.tiles];
  s = { ...s, estradas: { ...s.estradas, ...Object.fromEntries(tiles.map((t) => [chaveDeTile(t), true as const])) } };
  if (!predioLigadoAoArmazem(s, quartel, gameData)) throw new Error('fixture: o quartel nao ficou ligado');
  const comArmas: PredioCompleto = { ...armazem, estoque: { ...armazem.estoque, saida: { ...armazem.estoque.saida, ...armas } } };
  s = { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [armazem.id]: comArmas } } };
  const unidades = { porId: { ...s.unidades.porId }, ordem: [...s.unidades.ordem] };
  for (let i = 0; i < recrutas; i += 1) {
    const t = naVila(-2 + i, 6);
    const u: Unidade = {
      lado: LADO_DO_JOGADOR, id: `recruta${i + 1}`, tipo: ID_DO_RECRUTA, gx: t.gx, gy: t.gy,
      fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(ID_DO_RECRUTA),
    };
    unidades.porId[u.id] = u;
    unidades.ordem.push(u.id);
  }
  return { ...s, unidades };
}

function andar(s0: GameState, ticks: number, violacoes?: string[]): GameState {
  let s = s0;
  for (let t = 0; t < ticks; t += 1) {
    s = step(s, [], gameData);
    if (violacoes) violacoes.push(...violacoesDeInvariantes(s, gameData).map((v) => `tick ${s.tick}: ${v}`));
  }
  return s;
}

const treinar = (tipo: string, predio = QUARTEL): Command => ({ type: 'TrainSoldier', predio, tipo });
const PARA_O_CAVALEIRO = { sword: 1, iron_armor: 1, iron_shield: 1, horses: 1 };

describe('F25a — o quartel', () => {
  it('(a) os requisitos viajam do armazem ao quartel pelo JobBoard, e nao voltam', () => {
    const violacoes: string[] = [];
    const s0 = vilaComQuartel({ hand_axe: 3, ...PARA_O_CAVALEIRO }, 0);
    const s = andar(s0, 1500, violacoes);
    expect(violacoes).toEqual([]);
    const q = quartelDe(s);
    expect(q.estoque.entrada).toMatchObject({ hand_axe: 3, sword: 1, iron_armor: 1, iron_shield: 1, horses: 1 });
    const a = armazemDe(s);
    for (const m of ['hand_axe', 'sword', 'iron_armor', 'iron_shield', 'horses']) expect(a.estoque.saida[m] ?? 0).toBe(0);
    // 1500 ticks depois continuam la: nada virou excedente de volta ao armazem
    const depois = andar(s, 1500);
    expect(quartelDe(depois).estoque.entrada).toMatchObject({ hand_axe: 3, horses: 1 });
    gravarEvidencia('F25a-armas', { entradaDoQuartel: q.estoque.entrada, tick: s.tick });
  });

  it('(b) o recruta ocioso se alista: anda ate a porta e entra', () => {
    const violacoes: string[] = [];
    const s0 = vilaComQuartel({}, 2);
    const s = andar(s0, 600, violacoes);
    expect(violacoes).toEqual([]);
    expect(quartelDe(s).recrutas).toBe(2);
    expect(s.unidades.porId['recruta1']).toBeUndefined();
    expect(s.unidades.porId['recruta2']).toBeUndefined();
    // e a vaga continua aberta para o proximo recruta
    expect(s.jobs.tarefas.ordem.some((i) => s.jobs.tarefas.porId[i]?.tipo === 'alistar')).toBe(true);
  });

  it('(c) TrainSoldier forma miliciano e cavaleiro na porta, no mesmo tick, consumindo requisito e recruta', () => {
    const pronto = andar(vilaComQuartel({ hand_axe: 1, ...PARA_O_CAVALEIRO }, 2), 1500);
    const q0 = quartelDe(pronto);
    expect(q0.recrutas).toBe(2);
    const s1 = step(pronto, [treinar('militia'), treinar('knight')], gameData);
    const formados = s1.events.filter((e) => e.type === 'unit-trained');
    expect(formados.map((e) => (e as { tipo: string }).tipo)).toEqual(['militia', 'knight']);
    const q1 = quartelDe(s1);
    expect(q1.recrutas).toBe(0);
    for (const m of ['hand_axe', 'sword', 'iron_armor', 'iron_shield', 'horses']) expect(q1.estoque.entrada[m] ?? 0).toBe(0);
    const porta = tilesDaPorta(q1, gameData).map((t) => `${t.gx},${t.gy}`);
    for (const e of formados) {
      const u = s1.unidades.porId[(e as { unidade: string }).unidade] as Unidade;
      expect(u.lado).toBe(LADO_DO_JOGADOR);
      expect(porta).toContain(`${u.gx},${u.gy}`);
      expect(u.hp).toBeUndefined(); // cheio (`sim/vida.ts`)
    }
    gravarEvidencia('F25a-treino', { formados: formados.map((e) => (e as { tipo: string }).tipo), recrutasAntes: q0.recrutas });
  });

  it('(d) recusas com motivo, e o estado fica igual', () => {
    const pronto = andar(vilaComQuartel({ hand_axe: 1 }, 1), 1500);
    const semRecruta = andar(vilaComQuartel({ hand_axe: 1 }, 0), 1500);
    const armazem = armazemDe(pronto).id;
    const casos: [GameState, Command, string][] = [
      [pronto, treinar('militia', armazem), 'predio-nao-e-quartel'],
      [pronto, treinar('rebel'), 'tipo-desconhecido'], // mercenario e da Prefeitura
      [pronto, treinar('sword_fighter'), 'sem-requisito'],
      [semRecruta, treinar('militia'), 'sem-recruta'],
    ];
    for (const [s, cmd, motivo] of casos) {
      const r = step(s, [cmd], gameData);
      expect(r.events.find((e) => e.type === 'command-rejected'), motivo).toMatchObject({ command: 'TrainSoldier', motivo });
      expect(salvar({ ...r, events: [] })).toBe(salvar({ ...step(s, [], gameData), events: [] }));
    }
  });

  it('(e) a mesma corrida duas vezes da o mesmo estado', () => {
    const correr = (): GameState => {
      let s = andar(vilaComQuartel({ hand_axe: 2 }, 2), 1200);
      s = step(s, [treinar('militia')], gameData);
      return andar(s, 100);
    };
    expect(salvar(correr())).toBe(salvar(correr()));
  });
});
