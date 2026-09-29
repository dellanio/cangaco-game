/**
 * C-IA-02a — a vila da IA com producao (plano em
 * docs/planos/2026-09-29-C-IA-02a-vila-da-ia-com-producao.md). A escaramuca ganha, do lado da
 * IA, rocado, moinho, padaria e estalagem ligados ao armazem por estrada, campos no alcance do
 * rocado e os civis que tocam a cadeia. Nenhuma regra nova: os sistemas ja rodam por lado (C7).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DA_IA } from '../src/sim/state';
import type { GameState, Predio } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { canPlace } from '../src/sim/placement';
import { predioLigadoAoArmazem } from '../src/sim/estradas';
import { caixaDoPredio } from '../src/sim/footprint';
import { receitaDoTipo } from '../src/sim/producao';
import { ehCivil } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
const cenario = gameData.escaramuca;
const pr = cenario.producao;
/** Passa do tick em que o civil sem estalagem morreria (sonda: ~10500). */
const TICKS = 12000;
/** O determinismo nao precisa da fome: 3000 ticks ja poem a cadeia inteira a andar (o serf
 *  carrega antes disso, roteiro C-IA-02a), e cada corrida longa custa ~7 s no verify paralelo. */
const TICKS_DO_DETERMINISMO = 3000;
const PAO = 'loaves';

const prediosDaIA = (s: GameState): Predio[] =>
  s.predios.ordem.map((id) => s.predios.porId[id] as Predio).filter((p) => p.lado === LADO_DA_IA);
const civisDaIA = (s: GameState): string[] =>
  s.unidades.ordem.filter((id) => { const u = s.unidades.porId[id]; return u !== undefined && u.lado === LADO_DA_IA && ehCivil(u.tipo, gameData); });
/** O pao da IA: o que esta em qualquer gaveta de qualquer predio dela. */
const paoDaIA = (s: GameState): number => prediosDaIA(s).reduce((n, p) => {
  if (p.estado !== 'completo') return n;
  return n + (p.estoque.entrada[PAO] ?? 0) + (p.estoque.saida[PAO] ?? 0);
}, 0);
/** Os tiles da cultura no alcance da colheita do predio (Chebyshev a partir do footprint). */
const camposNoAlcance = (s: GameState, farm: Predio): string[] => {
  const alcance = receitaDoTipo(farm.tipo, gameData)?.colheita?.alcance ?? -1;
  const c = caixaDoPredio(farm, gameData);
  if (c === null) return [];
  return Object.entries(s.recursos).filter(([k, r]) => {
    if (r.tipo !== pr.campos.recurso) return false;
    const [gx, gy] = k.split(',').map(Number) as [number, number];
    return gx >= c.x0 - alcance && gx < c.x1 + alcance && gy >= c.y0 - alcance && gy < c.y1 + alcance;
  }).map(([k]) => k);
};

function correr(ticks = TICKS): { final: GameState; pao: number[] } {
  let s = criarEscaramuca(SEMENTE);
  const pao = [paoDaIA(s)];
  for (let t = 1; t <= ticks; t++) {
    s = step(s, [], gameData);
    if (t % 3000 === 0) pao.push(paoDaIA(s));
  }
  return { final: s, pao };
}

describe('C-IA-02a — a vila da IA com producao', () => {
  const s0 = criarEscaramuca(SEMENTE);
  const livre = createInitialState(SEMENTE);

  it('1. o cenario: predios da IA completos e ligados, campos no alcance, civis do dado', () => {
    const ia = prediosDaIA(s0);
    expect(ia.map((p) => [p.tipo, p.gx, p.gy, p.estado])).toEqual(cenario.predios.map((p) => [p.id, p.gx, p.gy, 'completo']));
    const desligados = ia.filter((p) => p.tipo !== 'storehouse' && !predioLigadoAoArmazem(s0, p, gameData)).map((p) => p.tipo);
    expect(desligados).toEqual([]);
    const farm = ia.find((p) => p.tipo === pr.campos.predio) as Predio;
    // os campos novos: os da cultura no alcance que o jogo livre nao tinha
    const novos = camposNoAlcance(s0, farm).filter((k) => livre.recursos[k] === undefined);
    expect(novos).toHaveLength(pr.campos.quantidade);
    const civis = civisDaIA(s0).map((id) => s0.unidades.porId[id]?.tipo);
    expect(civis).toEqual(Object.entries(pr.civis.tipos).flatMap(([tipo, n]) => Array.from({ length: n }, () => tipo)));
    // cada predio novo cabe no mapa com os anteriores de pe (o menu nao e a pergunta aqui)
    let s: GameState = { ...livre, tiposJaConstruidos: gameData.predios.map((p) => p.id) };
    for (const p of ia) {
      expect(canPlace(s, p.tipo, p.gx, p.gy, gameData), `${p.tipo} em ${p.gx},${p.gy}`).toEqual({ ok: true });
      s = { ...s, predios: { porId: { ...s.predios.porId, [p.id]: p }, ordem: [...s.predios.ordem, p.id] } };
    }
  });

  const { final, pao } = correr();

  it('2. a producao: o pao da IA passa do inicial', () => {
    const vivos = civisDaIA(final);
    gravarEvidencia('C-IA-02a-producao', {
      ticks: TICKS, paoACada3000: pao,
      civis: vivos.map((id) => { const u = final.unidades.porId[id]; return `${u?.tipo}:${u?.condicao}`; }),
      estoques: prediosDaIA(final).map((p) => (p.estado === 'completo' ? { tipo: p.tipo, estoque: p.estoque } : { tipo: p.tipo })),
    });
    expect(pao[pao.length - 1]).toBeGreaterThan(pao[0] as number);
  }, 120_000);

  it('3. os civis da IA vivem: todos no fim, com condicao', () => {
    const vivos = civisDaIA(final);
    expect(vivos).toEqual(civisDaIA(s0));
    for (const id of vivos) expect(final.unidades.porId[id]?.condicao).toBeGreaterThan(0);
  });

  it('4. deterministico: duas corridas dao o mesmo estado', () => {
    const a = correr(TICKS_DO_DETERMINISMO).final;
    expect(a.tick).toBe(TICKS_DO_DETERMINISMO);
    expect(salvar(correr(TICKS_DO_DETERMINISMO).final)).toBe(salvar(a));
  }, 120_000);
});
