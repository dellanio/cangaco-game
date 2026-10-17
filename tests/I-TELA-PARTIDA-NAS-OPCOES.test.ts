/**
 * I-TELA-PARTIDA-NAS-OPCOES (aceite 1) — a pagina do Reiniciar fase pela partida em curso, e a confirmacao em dois
 * cliques.
 */
import { describe, expect, it } from 'vitest';
import { buscaDoReinicio, cliqueNoReinicio } from '../src/ui/reinicio';
import { escolhaDaUrl } from '../src/escolha-da-partida';
import type { GameState } from '../src/sim/state';

describe('I-TELA-PARTIDA-NAS-OPCOES', () => {
  it.each([
    ['fase da campanha', { fase: { id: 'fase-02-patos' } }, '?campanha=fase-02-patos', { modo: 'campanha', fase: 'fase-02-patos' }],
    ['escaramuca', { pazAteTick: 6000 }, '?escaramuca', { modo: 'escaramuca' }],
    ['jogo livre', {}, '?livre', { modo: 'livre' }],
  ])('%s: a pagina do reinicio, e a URL abre a mesma partida do zero', (_n, estado, busca, escolha) => {
    expect(buscaDoReinicio(estado as unknown as Pick<GameState, 'fase' | 'pazAteTick'>)).toBe(busca);
    expect(escolhaDaUrl(busca)).toEqual(escolha);
  });
  it('a confirmacao: o primeiro clique arma, o segundo dispara e desarma', () => {
    expect(cliqueNoReinicio(false)).toEqual({ armado: true, disparar: false });
    expect(cliqueNoReinicio(true)).toEqual({ armado: false, disparar: true });
  });
});
