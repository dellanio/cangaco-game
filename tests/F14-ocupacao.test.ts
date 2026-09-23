/**
 * F14 — a posse mora no predio, e quem ocupa o que vem do dado.
 */
import { describe, expect, it } from 'vitest';
import { completarObra, createInitialState } from '../src/sim/state';
import type { PredioEmObra } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import {
  ehPredioOcupavel, predioAceita, predioDoOcupante, tiposQueOcupam,
  trabalhadorDoTipo, vagasDoPredio,
} from '../src/sim/ocupacao';
import { armazemDoCenario, comPredioCompletoEm } from './helpers/jobs-cenario';

const inicial = createInitialState(1);

describe('F14 — a posse mora no predio', () => {
  it('todo predio completo do cenario inicial nasce sem ocupante', () => {
    const completos = inicial.predios.ordem
      .map((id) => inicial.predios.porId[id])
      .filter((p) => p?.estado === 'completo');
    expect(completos).not.toHaveLength(0);
    expect(completos.every((p) => p?.estado === 'completo' && p.ocupante === null)).toBe(true);
  });

  it('obra que completa nasce vaga: completarObra devolve ocupante null', () => {
    const def = gameData.predios.find((p) => p.id === 'quarry');
    const obra: PredioEmObra = {
      id: 'o1', tipo: 'quarry', gx: 26, gy: 36, estado: 'obra', hp: def?.hp ?? 0,
      obra: { faltam: {}, nivelamento: 0 },
    };
    expect(completarObra(obra).ocupante).toBe(null);
  });
});

describe('F14 — quem ocupa o que vem do dado', () => {
  // Estrutural, nao textual: compara com o proprio dado, nunca com um id de
  // profissao digitado aqui. Mexer em buildings.json move os dois lados juntos.
  it('trabalhadorDoTipo devolve o que buildings.json declara', () => {
    for (const def of gameData.predios) {
      expect(trabalhadorDoTipo(def.id)).toBe(def.trabalhador);
    }
    expect(trabalhadorDoTipo('tipo-que-nao-existe')).toBe(null);
  });

  it('predio sem trabalhador no dado nao e ocupavel e nao tem vaga', () => {
    expect(gameData.predios.filter((p) => p.trabalhador === null)).not.toHaveLength(0);
    const armazem = armazemDoCenario(inicial);
    expect(trabalhadorDoTipo(armazem.tipo)).toBe(null);
    expect(ehPredioOcupavel(armazem)).toBe(false);
    expect(vagasDoPredio(armazem)).toBe(0);
  });

  it('predio ocupavel: 1 vaga vago, 0 ocupado; inexistente nunca e ocupavel', () => {
    const com = comPredioCompletoEm(inicial, 'q1', { tipo: 'quarry', gx: 26, gy: 36 });
    const vago = com.predios.porId.q1;
    expect(ehPredioOcupavel(vago)).toBe(true);
    expect(vagasDoPredio(vago)).toBe(1);

    const ocupado = vago?.estado === 'completo' ? { ...vago, ocupante: 'u9' } : vago;
    expect(vagasDoPredio(ocupado)).toBe(0);
    expect(ehPredioOcupavel(undefined)).toBe(false);
  });

  it('obra nunca e ocupavel, nem do tipo que pede trabalhador', () => {
    const obra: PredioEmObra = {
      id: 'o2', tipo: 'quarry', gx: 26, gy: 36, estado: 'obra', hp: 10,
      obra: { faltam: {}, nivelamento: 0 },
    };
    expect(trabalhadorDoTipo(obra.tipo)).not.toBe(null);
    expect(ehPredioOcupavel(obra)).toBe(false);
    expect(vagasDoPredio(obra)).toBe(0);
  });

  it('predioAceita compara o tipo do civil com o do dado', () => {
    const com = comPredioCompletoEm(inicial, 'q1', { tipo: 'quarry', gx: 26, gy: 36 });
    const quarry = com.predios.porId.q1;
    expect(predioAceita(quarry, trabalhadorDoTipo('quarry') ?? '')).toBe(true);
    expect(predioAceita(quarry, 'serf')).toBe(false);
    expect(predioAceita(quarry, 'laborer')).toBe(false);
  });

  it('predioDoOcupante acha o predio pela posse, e so por ela', () => {
    const com = comPredioCompletoEm(inicial, 'q1', { tipo: 'quarry', gx: 26, gy: 36 });
    expect(predioDoOcupante(com, 'u9')).toBe(null);
    const q = com.predios.porId.q1;
    const posse = q?.estado === 'completo'
      ? { ...com, predios: { ...com.predios, porId: { ...com.predios.porId, q1: { ...q, ocupante: 'u9' } } } }
      : com;
    expect(predioDoOcupante(posse, 'u9')?.id).toBe('q1');
  });

  it('serf e laborer nao ocupam predio nenhum', () => {
    const ocupam = tiposQueOcupam();
    expect(ocupam.has('serf')).toBe(false);
    expect(ocupam.has('laborer')).toBe(false);
    expect(ocupam.has(trabalhadorDoTipo('quarry') ?? '')).toBe(true);
  });
});
