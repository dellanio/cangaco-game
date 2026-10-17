/**
 * I-TELA-GAVETA-MOSTRA-A-FASE (aceite 1) — a gaveta de um save da campanha diz a fase (numero e local), e as outras
 * continuam com o tipo: "Jogo livre" e "Escaramuca". O save real de uma fase chega a gaveta com o id dela.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import { criarFase, dadosDaFase } from '../src/sim/fase';
import { salvar } from '../src/sim/save';
import { chaveDaGaveta, lerGavetas } from '../src/arquivo-da-partida';
import type { Gaveta } from '../src/arquivo-da-partida';
import { textoDaGaveta } from '../src/ui/arquivo';
import temaSertao from '../data/theme-sertao.json';

const rotulos = temaSertao.hud.arquivo.gavetas;

describe('I-TELA-GAVETA-MOSTRA-A-FASE', () => {
  it('por tabela: a fase no lugar do tipo; livre e escaramuca como antes', () => {
    const casos = [
      { tipo: 'livre', faseId: 'fase-02-patos', esperado: 'Gaveta 2: Fase 2 · Patos, tick 5' },
      { tipo: 'livre', faseId: 'fase-01-pianco', esperado: 'Gaveta 2: Fase 1 · Piancó, tick 5' },
      { tipo: 'livre', faseId: null, esperado: `Gaveta 2: ${rotulos.tipos.livre}, tick 5` },
      { tipo: 'escaramuca', faseId: null, esperado: `Gaveta 2: ${rotulos.tipos.escaramuca}, tick 5` },
    ] as const;
    for (const c of casos) {
      expect(textoDaGaveta({ n: 2, situacao: 'pronta', tipo: c.tipo, faseId: c.faseId, tick: 5, data: null })).toBe(c.esperado);
    }
  });
  it('o save real de uma fase chega a gaveta com o id dela; o do jogo livre, sem fase', () => {
    const itens = new Map<string, string>([
      [chaveDaGaveta(1), salvar(criarFase('fase-02-patos', dadosDaFase('fase-02-patos')), dadosDaFase('fase-02-patos'))],
      [chaveDaGaveta(2), salvar(createInitialState(gameData.economia.estadoInicial.semente))],
    ]);
    const gaveta: Gaveta = { getItem: (k) => itens.get(k) ?? null, setItem: (k, v) => { itens.set(k, v); } };
    const [g1, g2] = lerGavetas(gaveta);
    expect(g1).toMatchObject({ situacao: 'pronta', faseId: 'fase-02-patos' });
    expect(g2).toMatchObject({ situacao: 'pronta', faseId: null });
    expect(textoDaGaveta(g1!)).toContain('Fase 2 · Patos');
  });
});
