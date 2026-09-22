import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState, PredioEmObra } from '../src/sim/state';
import { completarObra } from '../src/sim/state';
import {
  alvoDeNivelamento, entreguesNaObra, hpTotalDoTipo, obraNivelada, obraTrabalhavel, tetoDeHp,
} from '../src/sim/obra';
import {
  armazemDoCenario, comObra, comTarefas, inicial, tarefaDe,
} from './helpers/jobs-cenario';

/** So para este arquivo: muda o `hp` (o martelado) de uma obra, sem tocar no resto. */
function comHp(estado: GameState, id: string, hp: number): GameState {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'obra') throw new Error(`fixture: '${id}' nao e uma obra`);
  const novo: PredioEmObra = { ...p, hp };
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [id]: novo } } };
}

describe('F11c — alvoDeNivelamento', () => {
  it('quarry (3x2 tiles, 10 ticks/tile): 60', () => {
    expect(alvoDeNivelamento('quarry')).toBe(60);
  });
});

describe('F11c — entreguesNaObra e tetoDeHp', () => {
  it('nada entregue (faltam === custo): entregues 0, teto 0', () => {
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { timber: 3, stone: 2 } });
    const obra = estado.predios.porId['obra-a'] as PredioEmObra;
    expect(entreguesNaObra(obra)).toBe(0);
    expect(tetoDeHp(obra)).toBe(0);
  });

  it('tudo entregue (faltam vazio): entregues 5, teto 250 (o hp total do quarry)', () => {
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    const obra = estado.predios.porId['obra-a'] as PredioEmObra;
    expect(entreguesNaObra(obra)).toBe(5);
    expect(hpTotalDoTipo('quarry')).toBe(250);
    expect(tetoDeHp(obra)).toBe(250);
  });
});

describe('F11c — obraNivelada', () => {
  it('nivelamento 0: nao nivelada; no alvo: nivelada', () => {
    const zerada = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {}, nivelamento: 0 });
    expect(obraNivelada(zerada.predios.porId['obra-a'] as PredioEmObra)).toBe(false);
    const nivelada = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} }); // default: ja nivelada
    expect(obraNivelada(nivelada.predios.porId['obra-a'] as PredioEmObra)).toBe(true);
  });
});

describe('F11c — obraTrabalhavel: uma clausula por vez', () => {
  it('nao nivelada, sem tarefa nenhuma: true (ha o que nivelar)', () => {
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2, timber: 3 }, nivelamento: 0 });
    expect(obraTrabalhavel(estado, 'obra-a')).toBe(true);
  });

  it('nivelada, hp < teto, sem tarefa: true (ha o que martelar)', () => {
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} }); // ja nivelada, hp 0, teto 250
    expect(obraTrabalhavel(estado, 'obra-a')).toBe(true);
  });

  it("nivelada, hp === teto, com tarefa de material 'carregando': true (material a caminho)", () => {
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    estado = comHp(estado, 'obra-a', 250);
    estado = comTarefas(estado, [{
      id: 't1', numero: 1, tipo: 'material-para-obra', mercadoria: 'stone',
      origem: armazemDoCenario(inicial).id, destino: 'obra-a', estado: 'carregando', reclamadaPor: 'u1',
    }]);
    expect(obraTrabalhavel(estado, 'obra-a')).toBe(true);
  });

  it('nivelada, hp === teto, SEM tarefa de material: false (nada a fazer)', () => {
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    estado = comHp(estado, 'obra-a', 250);
    expect(obraTrabalhavel(estado, 'obra-a')).toBe(false);
  });

  it('false volta a true assim que uma tarefa de material nasce para a obra', () => {
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    estado = comHp(estado, 'obra-a', 250);
    expect(obraTrabalhavel(estado, 'obra-a')).toBe(false);
    estado = comTarefas(estado, [tarefaDe({ numero: 1, destino: 'obra-a' })]);
    expect(obraTrabalhavel(estado, 'obra-a')).toBe(true);
  });
});

describe('F11c — Obra.nivelamento sobrevive ao JSON', () => {
  it('ida e volta preserva o campo', () => {
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 1 }, nivelamento: 12 });
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
    expect((estado.predios.porId['obra-a'] as PredioEmObra).obra.nivelamento).toBe(12);
  });
});

describe('F11c — completarObra', () => {
  it('quarry nivelado e martelado ao teto vira completo, com capacidade/estoque do tipo', () => {
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    estado = comHp(estado, 'obra-a', 250);
    const obra = estado.predios.porId['obra-a'] as PredioEmObra;
    const completo = completarObra(obra);
    expect(completo).toEqual({
      id: 'obra-a', tipo: 'quarry', gx: 26, gy: 34, estado: 'completo', hp: 250,
      capacidade: gameData.producao.estoqueInternoPorPredio,
      estoque: { entrada: {}, saida: {} },
    });
  });

  it('storehouse completado recebe a capacidade do armazem, sem estoque', () => {
    const obra: PredioEmObra = {
      id: 'obra-b', tipo: 'storehouse', gx: 10, gy: 10, estado: 'obra', hp: 1,
      obra: { faltam: {}, nivelamento: alvoDeNivelamento('storehouse') },
    };
    const completo = completarObra(obra);
    expect(completo.estado).toBe('completo');
    expect(completo.capacidade).toEqual({
      entrada: gameData.economia.storehouse.capacidade, saida: gameData.economia.storehouse.capacidade,
    });
    expect(completo.estoque).toEqual({ entrada: {}, saida: {} });
  });
});
