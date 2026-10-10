/**
 * I-ARTE-SOM-DA-VITORIA — a vitoria toca um som (operador, 2026-10-10). O som aprovado antes nao era CC0 e
 * ficou fora; entrou o candidato 1 da lista (CC0). Aqui: o som tem arquivo no manifesto, e o fim da partida
 * pelo `step` pede o `victory` uma vez so (o `match-ended` e gravado uma vez, F34), e o quadro o toca.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { criarEscaramuca } from '../src/sim/cenario';
import { step } from '../src/sim/tick';
import { LADO_DA_IA } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { sonsDoQuadro, sonsDoTick, urlsDosSons } from '../src/render/som';
import type { TabelaDeSom } from '../src/render/som';
import tabelaJson from '../data/som.json';
import manifesto from '../assets/manifest.json';
import { gravarEvidencia } from './helpers/evidence';

const TABELA = tabelaJson as TabelaDeSom;
const SONS = (manifesto as unknown as { sons: Record<string, { arquivo: string; licenca: string; origem: string }> }).sons;

/** A escaramuca com o lado da IA sem nenhum predio nem unidade: o proximo tick e a vitoria. */
function iaDerrotada(): GameState {
  const s = criarEscaramuca(gameData.economia.estadoInicial.semente);
  const predios = s.predios.ordem.filter((id) => s.predios.porId[id]?.lado !== LADO_DA_IA);
  const unidades = s.unidades.ordem.filter((id) => s.unidades.porId[id]?.lado !== LADO_DA_IA);
  return {
    ...s,
    predios: { porId: Object.fromEntries(predios.map((id) => [id, s.predios.porId[id]!])), ordem: predios },
    unidades: { porId: Object.fromEntries(unidades.map((id) => [id, s.unidades.porId[id]!])), ordem: unidades },
  };
}

describe('I-ARTE-SOM-DA-VITORIA', () => {
  it('(1) o victory esta no manifesto: CC0, a pagina do OpenGameArt e o arquivo no disco', () => {
    const v = SONS['victory'];
    expect(v).toBeDefined();
    expect(v!.licenca).toBe('CC0 1.0');
    expect(v!.origem).toMatch(/^https:\/\/opengameart\.org\/content\//);
    expect(existsSync(`assets/${v!.arquivo}`)).toBe(true);
    expect(readFileSync(`assets/${v!.arquivo}`).length).toBeGreaterThan(10_000);
  });

  it('(2) pelo step: a vitoria pede o victory uma vez so, e o quadro o toca (tem arquivo)', () => {
    let antes: GameState = iaDerrotada();
    const pedidos: string[][] = [];
    for (let t = 0; t < 5; t++) {
      const depois = step(antes, []);
      pedidos.push(sonsDoTick(depois, antes, TABELA, 0));
      antes = depois;
    }
    expect(antes.partida?.fim).toBe('vitoria');
    const todos = pedidos.flat();
    expect(todos.filter((id) => id === 'victory')).toEqual(['victory']);
    const disponiveis = new Set(Object.keys(urlsDosSons(SONS, Object.fromEntries(Object.values(SONS).map((s) => [s.arquivo, `/url/${s.arquivo}`])))));
    const quadro = sonsDoQuadro(todos, TABELA, disponiveis);
    expect(quadro.tocar).toContain('victory');
    expect(quadro.silencio).not.toContain('victory');
    gravarEvidencia('I-ARTE-SOM-DA-VITORIA', { pedidosPorTick: pedidos, arquivo: SONS['victory']?.arquivo });
  });
});
