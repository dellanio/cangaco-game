/**
 * C-TELA-03 — a caixa pega a tropa inteira (plano em
 * docs/planos/2026-09-29-C-TELA-03-selecao-de-grupo.md). A mao comeca a caixa EM CIMA do
 * soldado da ponta; exigir o centro deixava de fora a fileira dele (15 de 18, medido no
 * roteiro). Agora vale o quadrado desenhado, o mesmo do clique.
 */
import { describe, expect, it } from 'vitest';
import { centroDesenhado, unidadesNaCaixa, unidadesNoPonto } from '../src/render/acerto';
import type { UnidadeDesenhada } from '../src/render/acerto';
import { deslocamentoDaUnidade, ESCALA_DO_MUNDO } from '../src/render/grid';
import { GESTOS } from '../src/input/atalhos';
import { gameData } from '../src/sim/data';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import { criarEscaramuca } from '../src/sim/cenario';
import tema from '../data/theme-sertao.json';
import { gravarEvidencia } from './helpers/evidence';

const TILE = gameData.terreno.tilePx;

describe('C-TELA-03 — a caixa pega a tropa de 18', () => {
  const s0 = criarEscaramuca(gameData.economia.estadoInicial.semente);
  const tropa: UnidadeDesenhada[] = s0.unidades.ordem
    .map((id) => s0.unidades.porId[id])
    .filter((u) => u !== undefined && u.lado === LADO_DO_JOGADOR && u.tipo === gameData.escaramuca.tropaDoJogador.tipo)
    .map((u) => ({ id: u!.id, gxDesenhado: u!.gx, gyDesenhado: u!.gy, deslocamentoPx: deslocamentoDaUnidade(u!.id, TILE, ESCALA_DO_MUNDO) }));

  it('a caixa que comeca no centro do soldado de cada canto e vai ao canto oposto pega os 18', () => {
    expect(tropa).toHaveLength(18);
    const c = tropa.map((u) => centroDesenhado(u, TILE));
    const xs = c.map((p) => p.x);
    const ys = c.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pegos: Record<string, number> = {};
    // o canto de partida e o soldado MAIS perto do canto do bloco, e o arrasto vai ate o
    // centro do mais perto do canto oposto: a caixa mais justa que a mao faz
    const maisPerto = (x: number, y: number) => c.reduce((m, p) => (Math.hypot(p.x - x, p.y - y) < Math.hypot(m.x - x, m.y - y) ? p : m));
    for (const [nome, de, ate] of [
      ['cima-esquerda', maisPerto(x0, y0), maisPerto(x1, y1)],
      ['baixo-direita', maisPerto(x1, y1), maisPerto(x0, y0)],
      ['cima-direita', maisPerto(x1, y0), maisPerto(x0, y1)],
    ] as const) {
      const ids = unidadesNaCaixa(tropa, de, ate, TILE);
      pegos[nome] = ids.length;
      // o soldado sob o ponto de partida e o que o clique pegaria: a caixa tambem o pega
      const [sobOPonto] = unidadesNoPonto(tropa, de, TILE);
      expect(ids).toContain(sobOPonto);
    }
    expect(pegos).toEqual({ 'cima-esquerda': 18, 'baixo-direita': 18, 'cima-direita': 18 });
    gravarEvidencia('C-TELA-03', { tamanhoDaTropa: tropa.length, pegos });
  });

  it('a ajuda (H) conta a caixa e o botao direito, com texto do tema', () => {
    const tropaNaAjuda = GESTOS.filter((g) => g.grupo === 'tropa').map((g) => g.id);
    expect(tropaNaAjuda).toEqual(['selecionar-tropa', 'ordenar-tropa']);
    const gestos = tema.ajuda.gestos as Record<string, string>;
    expect(gestos['selecionar-tropa']).toMatch(/arrastando/);
    expect(gestos['ordenar-tropa']).toMatch(/direito/);
  });
});
