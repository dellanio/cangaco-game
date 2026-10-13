/**
 * I-COMBATE-FASE-ONDAS-E-OBJETIVOS — a missao da fase roda dentro do `step` (aceite no BUILD_PLAN.md,
 * plano em docs/planos/2026-10-12-campanha-jogavel.md).
 */
import { describe, expect, it } from 'vitest';
import type { FaseData, GameData, ObjetivoDaFaseData } from '../src/sim/data/types';
import { criarFase, dadosDaFase } from '../src/sim/fase';
import { resultadoDaFase, sistemaDaFase } from '../src/sim/systems/fase';
import { FSM_INDO_ATACAR } from '../src/sim/systems/cerco';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Unidade } from '../src/sim/state';
import { condicaoCheiaDoTipo, classeDaUnidade } from '../src/sim/condicao';
import { step } from '../src/sim/tick';
import { gravarEvidencia } from './helpers/evidence';

const ID = 'fase-01-pianco';
const DADOS = dadosDaFase(ID);
const LADO_INIMIGO = 1;

/** Os dados com a fase 1 trocando so os objetivos (e, se pedido, as ondas). */
function comObjetivos(vitoria: ObjetivoDaFaseData[], derrota: ObjetivoDaFaseData[], ondas?: FaseData['ondas']): GameData {
  const fases = DADOS.campanha.fases.map((f) => (f.id === ID ? { ...f, objetivos: { vitoria, derrota }, ...(ondas === undefined ? {} : { ondas }) } : f));
  return { ...DADOS, campanha: { ...DADOS.campanha, fases } };
}

const semPredios = (s: GameState, quer: (lado: number, tipo: string) => boolean): GameState => {
  const ordem = s.predios.ordem.filter((id) => { const p = s.predios.porId[id]; return p !== undefined && !quer(p.lado, p.tipo); });
  return { ...s, predios: { porId: Object.fromEntries(ordem.map((id) => [id, s.predios.porId[id]])), ordem } } as GameState;
};
const semUnidades = (s: GameState, quer: (u: Unidade) => boolean): GameState => {
  const ordem = s.unidades.ordem.filter((id) => { const u = s.unidades.porId[id]; return u !== undefined && !quer(u); });
  return { ...s, unidades: { porId: Object.fromEntries(ordem.map((id) => [id, s.unidades.porId[id]])), ordem } } as GameState;
};
const comUnidade = (s: GameState, u: Unidade): GameState =>
  ({ ...s, unidades: { porId: { ...s.unidades.porId, [u.id]: u }, ordem: [...s.unidades.ordem, u.id] } });
const militar = (id: string, lado: number, tipo: string, gx: number, gy: number): Unidade =>
  ({ id, lado, tipo, gx, gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tipo, DADOS) });

describe('I-COMBATE-FASE-ONDAS-E-OBJETIVOS', () => {
  it('aceite 1: a onda nasce no tick dela, nem antes nem depois, e vai atacar um predio do jogador', () => {
    const onda = DADOS.campanha.fases[0]?.ondas[0];
    if (onda === undefined) throw new Error('a fase 1 tem ondas');
    const base = criarFase(ID, DADOS);
    const inimigos = (s: GameState): string[] => s.unidades.ordem.filter((id) => s.unidades.porId[id]?.lado === onda.lado);
    const antes = inimigos(base).length;
    // o relogio da fase anda de verdade, pelo step; o inicio deslocado poupa os ticks de espera
    const naOnda = step({ ...base, fase: { ...(base.fase as NonNullable<GameState['fase']>), inicio: 1 - onda.tick } }, [], DADOS);
    expect(naOnda.tick - (naOnda.fase?.inicio ?? 0)).toBe(onda.tick);
    // no tick da onda: decorrido = onda.tick
    expect(inimigos(naOnda).length).toBe(antes + onda.tropas.reduce((n, t) => n + t.quantidade, 0));
    const naoAinda = step({ ...base, fase: { ...(base.fase as NonNullable<GameState['fase']>), inicio: 2 - onda.tick } }, [], DADOS);
    expect(naoAinda.tick - (naoAinda.fase?.inicio ?? 0)).toBe(onda.tick - 1);
    expect(inimigos(naoAinda).length).toBe(antes);
    const novas = naOnda.fase?.tropasDasOndas ?? [];
    expect(novas).toHaveLength(onda.tropas.reduce((n, t) => n + t.quantidade, 0));
    for (const id of novas) {
      const u = naOnda.unidades.porId[id] as Unidade;
      expect(u.lado).toBe(onda.lado);
      expect(onda.tropas.some((t) => t.tipo === u.tipo)).toBe(true);
      expect([FSM_INDO_ATACAR, 'marchando', 'lutando', 'indo_lutar']).toContain(u.fsm);
    }
    // o alvo do ataque e um predio do jogador
    const primeiro = naOnda.unidades.porId[novas[0] as string] as Unidade;
    const alvo = (primeiro.fsmData as { alvo?: string }).alvo;
    expect(alvo).toBeDefined();
    expect(naOnda.predios.porId[alvo as string]?.lado).toBe(LADO_DO_JOGADOR);
    expect(naOnda.fase?.ondasDisparadas).toBe(1);
    gravarEvidencia('I-COMBATE-FASE-ONDAS-E-OBJETIVOS-onda', { tickDaOnda: onda.tick, nascidas: novas.length, alvo });
  });

  it('aceite 2 e 3: cada condicao por tabela; vitoria pede todas, derrota qualquer uma, e a derrota vence no mesmo tick', () => {
    const s0 = criarFase(ID, DADOS);
    const t = s0.tick;
    const destruirPredios: ObjetivoDaFaseData = { tipo: 'destruir', lado: LADO_INIMIGO, alvo: 'predios' };
    const destruirTropas: ObjetivoDaFaseData = { tipo: 'destruir', lado: LADO_INIMIGO, alvo: 'tropas' };
    const destruirQuartel: ObjetivoDaFaseData = { tipo: 'destruir', lado: LADO_INIMIGO, predios: ['barracks'] };
    const perderDois: ObjetivoDaFaseData = { tipo: 'perder', lado: LADO_DO_JOGADOR, predios: ['storehouse', 'schoolhouse'] };
    const protegerArmazem: ObjetivoDaFaseData = { tipo: 'proteger', lado: LADO_DO_JOGADOR, predios: ['storehouse'] };
    const perderTropas: ObjetivoDaFaseData = { tipo: 'perder', lado: LADO_DO_JOGADOR, alvo: 'tropas' };
    const prazo: ObjetivoDaFaseData = { tipo: 'prazo', ticks: 100 };
    const sem = (q: (lado: number, tipo: string) => boolean): GameState => semPredios(s0, q);
    const militarDe = (lado: number) => (u: Unidade): boolean => u.lado === lado && classeDaUnidade(u.tipo, DADOS) === 'militar';
    const casos: [string, GameData, GameState, number, string | null][] = [
      ['destruir predios: de pe', comObjetivos([destruirPredios], []), s0, t, null],
      ['destruir predios: caidos', comObjetivos([destruirPredios], []), sem((l) => l === LADO_INIMIGO), t, 'vitoria'],
      ['destruir tropas: vivas', comObjetivos([destruirTropas], []), s0, t, null],
      ['destruir tropas: mortas', comObjetivos([destruirTropas], []), semUnidades(s0, militarDe(LADO_INIMIGO)), t, 'vitoria'],
      ['destruir lista: so o armazem caiu', comObjetivos([destruirQuartel], []), sem((l, tp) => l === LADO_INIMIGO && tp === 'storehouse'), t, null],
      ['destruir lista: o quartel caiu', comObjetivos([destruirQuartel], []), sem((l, tp) => l === LADO_INIMIGO && tp === 'barracks'), t, 'vitoria'],
      ['perder: um so caiu', comObjetivos([destruirPredios], [perderDois]), sem((l, tp) => l === LADO_DO_JOGADOR && tp === 'storehouse'), t, null],
      ['perder: os dois cairam', comObjetivos([destruirPredios], [perderDois]), sem((l, tp) => l === LADO_DO_JOGADOR && ['storehouse', 'schoolhouse'].includes(tp)), t, 'derrota'],
      ['perder tropas: o jogador sem militar', comObjetivos([destruirPredios], [perderTropas]), semUnidades(s0, militarDe(LADO_DO_JOGADOR)), t, 'derrota'],
      ['proteger: qualquer um caiu', comObjetivos([destruirPredios], [protegerArmazem]), sem((l, tp) => l === LADO_DO_JOGADOR && tp === 'storehouse'), t, 'derrota'],
      ['prazo: um tick antes', comObjetivos([destruirPredios], [prazo]), s0, t + 99, null],
      ['prazo: no tick', comObjetivos([destruirPredios], [prazo]), s0, t + 100, 'derrota'],
      ['vitoria pede todas: so uma vale', comObjetivos([destruirPredios, destruirTropas], []), sem((l) => l === LADO_INIMIGO), t, null],
      ['vitoria pede todas: as duas valem', comObjetivos([destruirPredios, destruirTropas], []), semUnidades(sem((l) => l === LADO_INIMIGO), militarDe(LADO_INIMIGO)), t, 'vitoria'],
      ['derrota vence no mesmo tick', comObjetivos([destruirPredios], [perderDois]), sem((l, tp) => l === LADO_INIMIGO || (l === LADO_DO_JOGADOR && ['storehouse', 'schoolhouse'].includes(tp))), t, 'derrota'],
    ];
    const tabela: Record<string, string | null> = {};
    for (const [nome, dados, s, tick, esperado] of casos) {
      expect(resultadoDaFase(s, dados, tick), nome).toBe(esperado);
      tabela[nome] = esperado;
    }
    // sobreviver: a ultima onda nasceu e nenhuma tropa dela vive
    const sobreviver = comObjetivos([{ tipo: 'sobreviver', ondas: 1 }], []);
    const viva = militar('uo1', LADO_INIMIGO, 'militia', 60, 60);
    const comOnda = comUnidade({ ...s0, fase: { ...(s0.fase as NonNullable<GameState['fase']>), ondasDisparadas: 1, tropasDasOndas: [viva.id] } }, viva);
    expect(resultadoDaFase(comOnda, sobreviver, t)).toBe(null);
    expect(resultadoDaFase(semUnidades(comOnda, (u) => u.id === viva.id), sobreviver, t)).toBe('vitoria');
    expect(resultadoDaFase({ ...s0, fase: { ...(s0.fase as NonNullable<GameState['fase']>), ondasDisparadas: 0 } }, sobreviver, t)).toBe(null);
    gravarEvidencia('I-COMBATE-FASE-ONDAS-E-OBJETIVOS-tabela', { tabela });
  });

  it('aceite 2: manter e capturar contam ticks seguidos, e zeram quando a condicao cai', () => {
    const s0 = criarFase(ID, DADOS);
    // manter o armazem do jogador por 5 ticks
    const manter = comObjetivos([{ tipo: 'manter', lado: LADO_DO_JOGADOR, predios: ['storehouse'], ticks: 5 }], []);
    let s = s0;
    for (let i = 1; i <= 4; i++) s = sistemaDaFase(s, manter, s0.tick + i).state;
    expect(resultadoDaFase(s, manter, s0.tick + 4)).toBe(null);
    s = sistemaDaFase(s, manter, s0.tick + 5).state;
    expect(resultadoDaFase(s, manter, s0.tick + 5)).toBe('vitoria');
    const caiu = sistemaDaFase(semPredios(s, (l, tp) => l === LADO_DO_JOGADOR && tp === 'storehouse'), manter, s0.tick + 6).state;
    expect(caiu.fase?.contagem.v0).toBe(0);

    // capturar: o cavaleiro do lado 1, um cabra do jogador encostado, longe de qualquer escolta
    const capturar = comObjetivos([{ tipo: 'capturar', lado: LADO_INIMIGO, unidade: 'knight' }], []);
    const vicente = militar('uv', LADO_INIMIGO, 'knight', 40, 100);
    const cabra = militar('uc', LADO_DO_JOGADOR, 'militia', 41, 100);
    let c = comUnidade(comUnidade(semUnidades(s0, (u) => u.lado === LADO_INIMIGO), vicente), cabra);
    const ticks = DADOS.campanha.captura.ticks;
    for (let i = 1; i < ticks; i++) c = sistemaDaFase(c, capturar, s0.tick + i).state;
    expect(resultadoDaFase(c, capturar, s0.tick + ticks - 1)).toBe(null);
    const preso = sistemaDaFase(c, capturar, s0.tick + ticks).state;
    expect(resultadoDaFase(preso, capturar, s0.tick + ticks)).toBe('vitoria');
    // com um militar do lado dele no raio da escolta, a contagem zera
    const escolta = militar('ue', LADO_INIMIGO, 'militia', 40, 100 + DADOS.campanha.captura.raioDaEscolta_tiles);
    const comEscolta = sistemaDaFase(comUnidade(c, escolta), capturar, s0.tick + ticks).state;
    expect(comEscolta.fase?.contagem.v0).toBe(0);
    expect(resultadoDaFase(comEscolta, capturar, s0.tick + ticks)).toBe(null);
  });

  it('aceite 3 e 4: a fase 1 de verdade, pelo step, grava o fim uma vez com match-ended', () => {
    const s0 = criarFase(ID, DADOS);
    const fins = (eventos: readonly GameEvent[]): number => eventos.filter((e) => e.type === 'match-ended').length;
    // os predios do Cabo Branco caem: vitoria
    let v = step(semPredios(s0, (l) => l === LADO_INIMIGO), [], DADOS);
    expect(v.partida?.fim).toBe('vitoria');
    expect(fins(v.events)).toBe(1);
    v = step(v, [], DADOS);
    expect(fins(v.events)).toBe(0);
    expect(v.partida?.fim).toBe('vitoria');
    // o armazem e a escola do jogador caem: derrota
    const d = step(semPredios(s0, (l, tp) => l === LADO_DO_JOGADOR && ['storehouse', 'schoolhouse'].includes(tp)), [], DADOS);
    expect(d.partida?.fim).toBe('derrota');
    // e enquanto nada disso acontece, a fase corre
    let r = s0;
    for (let i = 0; i < 50; i++) r = step(r, [], DADOS);
    expect(r.partida).toBeUndefined();
  });
});
