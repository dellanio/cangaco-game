/**
 * C-TELA-05 — o painel da Feira emite `SetTrade` (plano em
 * docs/planos/2026-09-29-C-TELA-05-ordem-a-feira.md). O rascunho e de
 * `ui/ordem-da-feira.ts`; a prova passa pelo `step` real numa vila com feira ligada.
 */
import { describe, expect, it } from 'vitest';
import {
  comandoDaTroca, comandoDeCancelar, girarMercadoria, mudarQuantidade, rascunhoInicial,
} from '../src/ui/ordem-da-feira';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, ID_DO_ARMAZEM, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { buscarCaminho } from '../src/sim/pathfinding';
import { chaveDeTile, predioLigadoAoArmazem, tilesDaPorta } from '../src/sim/estradas';
import { painelDoPredio } from '../src/sim/selectors';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const M = gameData.economia.mercadorias;
const feiraDe = (s: GameState): PredioCompleto => s.predios.porId['feira'] as PredioCompleto;

/** A vila da abertura mais uma feira COMPLETA ligada ao armazem, como a da F35. */
function vilaComFeira(): GameState {
  let s = createInitialState(1);
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'sawmill'])] };
  let lugar: { gx: number; gy: number } | null = null;
  for (let r = 4; r < 30 && lugar === null; r += 1) {
    for (let d = -r; d <= r && lugar === null; d += 1) {
      const p = naVila(d, r);
      if (canPlace(busca, 'marketplace', p.gx, p.gy, gameData).ok) lugar = p;
    }
  }
  if (lugar === null) throw new Error('fixture: a feira nao coube');
  const feira = completarObra({ lado: LADO_DO_JOGADOR, id: 'feira', tipo: 'marketplace', ...lugar, estado: 'obra', hp: 550, obra: { faltam: {}, nivelamento: 0 } }, gameData);
  s = { ...s, predios: { porId: { ...s.predios.porId, feira }, ordem: [...s.predios.ordem, 'feira'] } };
  const armazem = s.predios.porId[s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === ID_DO_ARMAZEM) as string] as PredioCompleto;
  const porta = tilesDaPorta(feira, gameData)[0] as { gx: number; gy: number };
  const rua = buscarCaminho(s, porta, tilesDaPorta(armazem, gameData), 'livre', gameData);
  if (rua === null) throw new Error('fixture: sem rua');
  s = { ...s, estradas: { ...s.estradas, ...Object.fromEntries([porta, ...rua.tiles].map((t) => [chaveDeTile(t), true as const])) } };
  if (!predioLigadoAoArmazem(s, feira, gameData)) throw new Error('fixture: feira nao ligada');
  return s;
}

describe('C-TELA-05 — ordem a Feira', () => {
  it('o giro anda na lista circular e pula a mercadoria do outro campo', () => {
    const r = { da: M[0] as string, para: M[1] as string, quantidade: 1 };
    expect(girarMercadoria(r, 'da', 1, M).da).toBe(M[2]);
    expect(girarMercadoria(r, 'da', -1, M).da).toBe(M[M.length - 1]);
    expect(girarMercadoria(r, 'para', -1, M).para).toBe(M[M.length - 1]);
    // uma volta inteira nunca cai em A = B
    let g = r;
    for (let i = 0; i < M.length * 2; i += 1) {
      g = girarMercadoria(g, 'para', 1, M);
      expect(g.para).not.toBe(g.da);
    }
  });

  it('a quantidade nao desce de 1, e o rascunho comeca na ordem em vigor', () => {
    const r = { da: 'stone', para: 'gold', quantidade: 1 };
    expect(mudarQuantidade(r, -1).quantidade).toBe(1);
    expect(mudarQuantidade(mudarQuantidade(r, 1), 1).quantidade).toBe(3);
    expect(rascunhoInicial({ da: 'timber', para: 'gold', quantidade: 3 }, M)).toEqual({ da: 'timber', para: 'gold', quantidade: 3 });
    expect(rascunhoInicial({ da: null, para: null, quantidade: 0 }, M)).toEqual({ da: M[0], para: M[1], quantidade: 1 });
  });

  it('o comando do rascunho passa pelo step real, a feira troca, e o cancelar tira a ordem', () => {
    const s0 = vilaComFeira();
    const vista = painelDoPredio(s0, 'feira')?.feira;
    expect(vista).not.toBeNull();
    // o jogador gira "Dar" ate pedra, "Receber" ate dinheiro, e sobe para 2
    let r = rascunhoInicial(vista!, M);
    for (let i = 0; i < M.length && r.da !== 'stone'; i += 1) r = girarMercadoria(r, 'da', 1, M);
    for (let i = 0; i < M.length && r.para !== 'gold'; i += 1) r = girarMercadoria(r, 'para', 1, M);
    r = mudarQuantidade(r, 1);
    expect(r).toEqual({ da: 'stone', para: 'gold', quantidade: 2 });

    let s = step(s0, [comandoDaTroca('feira', r)], gameData);
    expect(s.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    expect(feiraDe(s).troca).toEqual({ da: 'stone', para: 'gold', quantidade: 2, feitas: 0 });
    let tick = 0;
    while (tick < 3000 && (feiraDe(s).troca?.feitas ?? 0) < 2) {
      s = step(s, [], gameData);
      tick += 1;
    }
    expect(feiraDe(s).troca?.feitas).toBe(2);
    gravarEvidencia('C-TELA-05', { ordem: r, trocasFeitas: 2, ticksAteCumprir: tick });

    const cancelado = step(s, [comandoDeCancelar('feira', r)], gameData);
    expect(cancelado.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    expect(feiraDe(cancelado).troca).toBeUndefined();
  });
});
