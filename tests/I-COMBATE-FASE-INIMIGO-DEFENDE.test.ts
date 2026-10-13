/**
 * I-COMBATE-FASE-INIMIGO-DEFENDE — o inimigo da fase defende como a IA da escaramuca (aceite no
 * BUILD_PLAN.md; decisao do operador de 2026-10-13).
 */
import { describe, expect, it } from 'vitest';
import { criarFase, dadosDaFase, tilesParaNascer } from '../src/sim/fase';
import { rawGameData } from '../src/sim/data/raw';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { classeDaUnidade, condicaoCheiaDoTipo } from '../src/sim/condicao';
import { tipoDeGrupo } from '../src/sim/ia';
import { step } from '../src/sim/tick';
import { FSM_INDO_LUTAR, FSM_LUTANDO } from '../src/sim/systems/combate';
import { jogar } from './helpers/jogador-da-campanha';
import { gravarEvidencia } from './helpers/evidence';

const evidencia: Record<string, unknown> = {};
const militaresDoLado = (s: GameState, lado: number, dados: ReturnType<typeof dadosDaFase>): Unidade[] =>
  s.unidades.ordem.map((id) => s.unidades.porId[id]).filter((u): u is Unidade => u !== undefined && u.lado === lado && classeDaUnidade(u.tipo, dados) === 'militar');

describe('I-COMBATE-FASE-INIMIGO-DEFENDE', () => {
  it.each(rawGameData.fases.map((f) => f.id))('aceite 1: %s — todo militar inicial do inimigo esta numa posicao, e so numa (fora o capturado)', (id) => {
    const dados = dadosDaFase(id);
    const s = criarFase(id, dados);
    const fase = dados.campanha.fases.find((f) => f.id === id);
    const tamanho = dados.combate.niveisDaIA['normal']?.tamanhoDoGrupo ?? 0;
    for (const lado of fase?.lados ?? []) {
      if (lado.lado === LADO_DO_JOGADOR) continue;
      const capturado = (u: Unidade): boolean => (fase?.objetivos.vitoria ?? []).some((o) => o.tipo === 'capturar' && o.lado === u.lado && o.unidade === u.tipo);
      const militares = militaresDoLado(s, lado.lado, dados).filter((u) => !capturado(u));
      const ia = s.ia?.[String(lado.lado)];
      if (militares.length === 0) { expect(ia).toBeUndefined(); continue; }
      const membros = (ia?.posicoes ?? []).flatMap((p) => p.membros);
      expect([...membros].sort()).toEqual(militares.map((u) => u.id).sort());
      for (const p of ia?.posicoes ?? []) {
        expect(p.membros.length).toBeLessThanOrEqual(tamanho);
        expect(p.raio).toBe(dados.campanha.defesa.raio_tiles);
        for (const m of p.membros) {
          const u = s.unidades.porId[m] as Unidade;
          expect(tipoDeGrupo(u.tipo, dados)).toBe(p.tipoDeGrupo);
          expect(p.linha).toBe(p.tipoDeGrupo === 'distancia' ? 'tras' : 'frente');
        }
      }
      evidencia[id] = { posicoes: ia?.posicoes.map((p) => ({ id: p.id, ponto: p.ponto, tipo: p.tipoDeGrupo, membros: p.membros.length })) };
    }
  });

  it('aceite 2: o intruso no raio e atacado pelos membros da posicao (fase 3)', () => {
    const id = 'fase-03-soledade';
    const dados = dadosDaFase(id);
    let s = criarFase(id, dados);
    const p = s.ia?.['1']?.posicoes.find((x) => x.tipoDeGrupo === 'corpoACorpo');
    if (p === undefined) throw new Error('sem posicao corpo a corpo na fase 3');
    const ocupado = new Set(s.unidades.ordem.map((i) => { const u = s.unidades.porId[i] as Unidade; return `${u.gx},${u.gy}`; }));
    const [t] = tilesParaNascer(s, p.ponto.gx + p.raio - 3, p.ponto.gy, 1, ocupado, dados);
    if (t === undefined) throw new Error('sem tile para o intruso');
    const intruso: Unidade = { id: 'intruso', lado: LADO_DO_JOGADOR, tipo: 'militia', gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia', dados) };
    s = { ...s, unidades: { porId: { ...s.unidades.porId, [intruso.id]: intruso }, ordem: [...s.unidades.ordem, intruso.id] } };
    let atacadoEm = -1;
    for (let k = 1; k <= 100 && atacadoEm < 0; k += 1) {
      s = step(s, [], dados);
      const vindo = p.membros.some((m) => {
        const u = s.unidades.porId[m];
        return u !== undefined && (u.fsm === FSM_INDO_LUTAR || u.fsm === FSM_LUTANDO) && u.fsmData.alvoUnidade === 'intruso';
      });
      if (vindo) atacadoEm = k;
    }
    evidencia['aceite2'] = { intruso: t, ponto: p.ponto, atacadoNoTick: atacadoEm };
    expect(atacadoEm).toBeGreaterThan(0);
  });

  it('aceite 3: a mesma fase com os mesmos comandos da o mesmo estado em 600 ticks', () => {
    const id = 'fase-03-soledade';
    const dados = dadosDaFase(id);
    const a = jogar(criarFase(id, dados), 'ataque', 600, dados).estado;
    const b = jogar(criarFase(id, dados), 'ataque', 600, dados).estado;
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    gravarEvidencia('I-COMBATE-FASE-INIMIGO-DEFENDE', evidencia);
  }, 60_000);
});
