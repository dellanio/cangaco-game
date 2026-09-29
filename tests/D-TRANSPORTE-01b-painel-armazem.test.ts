/**
 * D-TRANSPORTE-01b — o seletor que alimenta a lista "Recebe" do painel do armazem (plano em
 * docs/planos/2026-09-29-D-TRANSPORTE-01-armazem-liga-desliga.md). O DOM e provado pelo
 * roteiro `tools/shots/D-TRANSPORTE-01.js`; aqui, o dado que ele desenha.
 *
 * O bloqueio entra pelo COMANDO REAL (`SetStorehouseAccept`), nunca escrito a mao no estado.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { painelDoPredio } from '../src/sim/selectors';
import { gravarEvidencia } from './helpers/evidence';
import { armazemPorTipo, escolaDoCenario } from './helpers/escola-cenario';

const inicial = createInitialState(1);
const ARMAZEM = armazemPorTipo(inicial).id;
const ESCOLA = escolaDoCenario(inicial).id;

const bloquear = (s: GameState, mercadoria: string, aceita: boolean): GameState =>
  step(s, [{ type: 'SetStorehouseAccept', predio: ARMAZEM, mercadoria, aceita }], gameData);

describe('D-TRANSPORTE-01b — painelDoPredio.armazem', () => {
  it('lista as mercadorias do dado, na ordem, todas aceitas, com a soma das duas gavetas', () => {
    const p = painelDoPredio(inicial, ARMAZEM);
    const lista = p?.armazem?.mercadorias ?? [];
    expect(lista.map((m) => m.mercadoria)).toEqual(gameData.economia.mercadorias);
    expect(lista.every((m) => m.aceita)).toBe(true);
    const armazem = inicial.predios.porId[ARMAZEM];
    if (armazem?.estado !== 'completo') throw new Error('o armazem inicial deveria estar completo');
    for (const m of lista) {
      expect(m.quantidade).toBe((armazem.estoque.entrada[m.mercadoria] ?? 0) + (armazem.estoque.saida[m.mercadoria] ?? 0));
    }
    expect(lista.some((m) => m.quantidade > 0)).toBe(true);
  });

  it('o comando bloqueia so a mercadoria pedida, e o comando oposto devolve', () => {
    const bloqueado = bloquear(inicial, 'timber', false);
    const lista = painelDoPredio(bloqueado, ARMAZEM)?.armazem?.mercadorias ?? [];
    expect(lista.filter((m) => !m.aceita).map((m) => m.mercadoria)).toEqual(['timber']);
    const devolvido = bloquear(bloqueado, 'timber', true);
    expect(painelDoPredio(devolvido, ARMAZEM)?.armazem?.mercadorias.every((m) => m.aceita)).toBe(true);
    gravarEvidencia('D-TRANSPORTE-01b-painel-armazem', {
      mercadorias: lista.length,
      bloqueadas: lista.filter((m) => !m.aceita).map((m) => m.mercadoria),
      naoAceitaNoEstado: bloqueado.predios.porId[ARMAZEM]?.estado === 'completo'
        ? (bloqueado.predios.porId[ARMAZEM] as { naoAceita?: readonly string[] }).naoAceita ?? null : null,
    });
  });

  it('predio que nao e armazem, e obra, nao tem a lista', () => {
    expect(painelDoPredio(inicial, ESCOLA)?.armazem).toBeNull();
    const comObra = step(inicial, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 38, gy: 31 }], gameData);
    const obra = comObra.predios.ordem[comObra.predios.ordem.length - 1] as string;
    expect(painelDoPredio(comObra, obra)?.estado).toBe('obra');
    expect(painelDoPredio(comObra, obra)?.armazem).toBeNull();
  });
});
