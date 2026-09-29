/**
 * D-PRODUCAO-02 — o lenhador replanta o toco que acabou de cortar (plano em
 * docs/planos/2026-09-29-D-PRODUCAO-02-lenhador.md). Antes, o rodizio so voltava ao toco
 * depois de cortar toda adulta ao alcance: 0 replantios em 11 500 ticks na mata inteira.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState } from '../src/sim/state';
import { receitaDoTipo } from '../src/sim/producao';
import { step } from '../src/sim/tick';
import { cenarioOraculo } from './helpers/producao-cenario';
import { correr, pausarW2, tilesDeW1 } from './helpers/mata-curta';
import { gravarEvidencia } from './helpers/evidence';

const JANELA = 11_500;

/** O mesmo dado com o flag desligado: a regra de antes. */
function semReplantarOCortado(dados: GameData): GameData {
  const tree = dados.recursos.tipos.tree;
  if (tree?.reposicao == null) throw new Error('fixture');
  return { ...dados, recursos: { ...dados.recursos, tipos: { ...dados.recursos.tipos, tree: { ...tree, reposicao: { ...tree.reposicao, replantaOQueCortou: false } } } } };
}

const tocos = (s: GameState, tiles: readonly string[]): number => tiles.filter((k) => s.recursos[k]?.quantidade === 0).length;

function mataInteira(dados: GameData): ReturnType<typeof correr> & { tocos: number; tiles: number } {
  const s0 = cenarioOraculo(dados);
  const tiles = tilesDeW1(s0, dados);
  const r = correr(step(s0, [pausarW2], dados), tiles, dados, JANELA);
  return { ...r, tocos: tocos(r.final, tiles), tiles: tiles.length };
}

describe('D-PRODUCAO-02 — o lenhador', () => {
  it('o alcance da receita e o de production.json', () => {
    const cru = JSON.parse(readFileSync('data/production.json', 'utf-8')) as { predios: Record<string, { colheita?: { alcance_tiles?: number } }> };
    expect(receitaDoTipo('woodcutters', gameData)?.colheita?.alcance).toBe(cru.predios.woodcutters?.colheita?.alcance_tiles);
  });

  it('replanta o toco que cortou; sem o flag, os tocos ficam', () => {
    const novo = mataInteira(gameData);
    const antigo = mataInteira(semReplantarOCortado(gameData));
    const resumo = (r: typeof novo): Record<string, number | null> => ({ tiles: r.tiles, troncos: r.troncos, replantios: r.replantios, tocosNoFim: r.tocos, dentroDaArvore: r.dentroDaArvore });
    gravarEvidencia('D-PRODUCAO-02', { janela: JANELA, comReplantio: resumo(novo), regraAntiga: resumo(antigo) });
    expect(novo.replantios).toBeGreaterThan(0);
    expect(novo.tocos).toBeLessThanOrEqual(1);
    expect(novo.dentroDaArvore).toBe(0);
    expect(antigo.replantios).toBe(0);
    expect(antigo.tocos).toBeGreaterThan(1);
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar.
  }, 60_000);

  it('so a arvore declara o flag: a fazenda nao muda', () => {
    const comFlag = Object.entries(gameData.recursos.tipos).filter(([, t]) => t.reposicao?.replantaOQueCortou === true).map(([id]) => id);
    expect(comFlag).toEqual(['tree']);
  });
});
