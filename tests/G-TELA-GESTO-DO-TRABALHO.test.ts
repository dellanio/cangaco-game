/**
 * G-TELA-OBREIRO-POR-TAREFA e G-TELA-ROCEIRO-NO-CAMPO — o gesto e o lugar de desenho de quem trabalha,
 * lidos do estado. Tabela com estado minimo (so o que a regra le) e uma fazenda de verdade pelo `step`,
 * para os rotulos da sim (`semeando`, `colhendo`, `voltando` e a tarefa `colher`) nao se perderem.
 */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { animacaoDoGesto, colheitaNasMaos, deslocamentoDoTrabalho } from '../src/render/gesto-do-trabalho';
import type { GestoDoTrabalho } from '../src/render/gesto-do-trabalho';
import dados from '../data/gesto-do-trabalho.json';
import { caixaDeTipoNoMapa } from '../src/render/predios';
import { cenarioDeCanavial, cenarioDeFazenda } from './helpers/producao-cenario';
import { rotuloDaCarga } from '../src/render/rotulo-da-carga';
import { iconesDoJogo } from '../src/render/sprites';
import { mkdirSync, writeFileSync } from 'node:fs';
import { salvar } from '../src/sim/save';

/** O roteiro G-TELA-GESTO-DO-TRABALHO carrega estes saves (o roceiro no meio de cada fase). */
function gravarSave(nome: string, s: GameState): void {
  mkdirSync('test-output', { recursive: true });
  writeFileSync(`test-output/G-TELA-ROCEIRO-${nome}.save.txt`, salvar(s));
}

const config = dados as unknown as GestoDoTrabalho;
const todas = { parado: {}, andar: {}, trabalhar: {}, martelar: {}, assentar: {}, arar: {}, semear: {}, colher: {}, carregando: {} };

function estadoCom(tarefas: Record<string, unknown>, predios: Record<string, unknown> = {}): GameState {
  return { jobs: { tarefas: { porId: tarefas, ordem: Object.keys(tarefas) } }, predios: { porId: predios, ordem: Object.keys(predios) } } as unknown as GameState;
}
const obra = { id: 'o1', tipo: 'storehouse', gx: 10, gy: 10, estado: 'obra' };

describe('o obreiro faz o gesto da tarefa', () => {
  it.each([
    ['construir', 'martelar'], ['reparar', 'martelar'], ['assentar-estrada', 'assentar'], ['arar', 'arar'],
  ])('tarefa %s -> %s', (tipo, esperado) => {
    const e = estadoCom({ t1: { id: 't1', tipo, destino: 'o1' } }, { o1: obra });
    expect(animacaoDoGesto(e, { tipo: 'laborer', fsm: 'martelando', fsmData: { tarefa: 't1' } }, 'trabalhar', todas, config)).toBe(esperado);
  });
  it.each([
    ['sem tarefa', {}, todas, 'trabalhar'],
    ['animacao ausente no manifesto', { tarefa: 't1' }, { trabalhar: {} }, 'trabalhar'],
  ])('%s -> trabalhar (o de hoje)', (_n, fsmData, animacoes, esperado) => {
    const e = estadoCom({ t1: { id: 't1', tipo: 'construir', destino: 'o1' } }, { o1: obra });
    expect(animacaoDoGesto(e, { tipo: 'laborer', fsm: 'martelando', fsmData }, 'trabalhar', animacoes, config)).toBe(esperado);
  });
  it('andando, o obreiro anda (o gesto e so do trabalho)', () => {
    const e = estadoCom({ t1: { id: 't1', tipo: 'construir', destino: 'o1' } }, { o1: obra });
    expect(animacaoDoGesto(e, { tipo: 'laborer', fsm: 'indo_a_obra', fsmData: { tarefa: 't1' } }, 'andar', todas, config)).toBe('andar');
  });
  it('martelando a obra, o desenho avanca avancoDoMartelarPx na direcao do centro dela; a posicao logica nao muda', () => {
    const e = estadoCom({ t1: { id: 't1', tipo: 'construir', destino: 'o1' } }, { o1: obra });
    const u = { id: 'l1', tipo: 'laborer', fsm: 'martelando', fsmData: { tarefa: 't1' }, gx: 9, gy: 12 };
    const d = deslocamentoDoTrabalho(e, u, 'trabalhar', 64, config, caixaDeTipoNoMapa);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(config.avancoDoMartelarPx, 6);
    expect(d.x).toBeGreaterThan(0);
    expect(u.gx).toBe(9);
    expect(deslocamentoDoTrabalho(e, { ...u, fsmData: { tarefa: 't2' } }, 'trabalhar', 64, config, caixaDeTipoNoMapa)).toEqual({ x: 0, y: 0 });
  });
});

describe('o roceiro trabalha dentro do campo com a ferramenta da fase', () => {
  it.each([['semeando', 'semear'], ['colhendo', 'colher']])('%s -> %s', (fsm, esperado) => {
    expect(animacaoDoGesto(estadoCom({}), { tipo: 'farmer', fsm, fsmData: {} }, 'trabalhar', todas, config)).toBe(esperado);
  });

  it('pela fazenda de verdade: semeia dentro do tile, colhe dentro do tile e volta levando o milho', () => {
    let s = cenarioDeFazenda();
    const vistos = new Set<string>();
    for (let t = 0; t < 6000 && vistos.size < 3; t++) {
      s = step(s, []);
      const u = s.unidades.porId['roceiro']!;
      if (u.fsm === 'semeando' || u.fsm === 'colhendo') {
        const lado = 64;
        const d = deslocamentoDoTrabalho(s, u, 'trabalhar', lado, config, caixaDeTipoNoMapa);
        const tile = u.fsm === 'colhendo'
          ? (s.jobs.tarefas.porId[u.fsmData.tarefa!] as { origemTile: { gx: number; gy: number } }).origemTile
          : (s.predios.porId['f1'] as unknown as { producao: { plantio: { tile: { gx: number; gy: number } } } }).producao.plantio.tile;
        // o centro do desenho fica a menos de 1/4 de tile do centro do tile trabalhado
        expect(Math.abs(u.gx * lado + d.x - tile.gx * lado)).toBeLessThan(lado / 4);
        expect(Math.abs(u.gy * lado + d.y - tile.gy * lado)).toBeLessThan(lado / 4);
        expect(animacaoDoGesto(s, u, 'trabalhar', todas, config)).toBe(u.fsm === 'colhendo' ? 'colher' : 'semear');
        if (!vistos.has(u.fsm)) gravarSave(u.fsm, s);
        vistos.add(u.fsm);
      }
      if (u.fsm === 'voltando' && colheitaNasMaos(s, u, config) !== null) {
        expect(colheitaNasMaos(s, u, config)).toBe('corn');
        expect(animacaoDoGesto(s, u, 'andar', todas, config)).toBe('carregando');
        if (!vistos.has('voltando-com-milho')) gravarSave('voltando', s);
        vistos.add('voltando-com-milho');
      }
    }
    expect([...vistos].sort()).toEqual(['colhendo', 'semeando', 'voltando-com-milho']);
  }, 60000);

  it('o roceiro voltando sem colheita (sem tarefa) anda de maos vazias', () => {
    const u = { id: 'r', tipo: 'farmer', fsm: 'voltando', fsmData: {} };
    expect(colheitaNasMaos(estadoCom({}), u, config)).toBeNull();
    expect(animacaoDoGesto(estadoCom({}), u, 'andar', todas, config)).toBe('andar');
  });

  it('BUG-ROCEIRO-CANA-SEM-NOME: toda colheita nas maos tem nome no tema e icone', () => {
    for (const [predio, colheita] of Object.entries(config.colheitaPorPredio)) {
      expect(() => rotuloDaCarga(colheita), `${predio}: ${colheita}`).not.toThrow();
      expect(iconesDoJogo?.[colheita], `${predio}: ${colheita}`).toBeDefined();
    }
  });

  it('BUG-ROCEIRO-CANA-SEM-NOME: o canavial de verdade volta com a cana, e o rotulo e o do tema', () => {
    let s = cenarioDeCanavial();
    let visto: string | null = null;
    for (let t = 0; t < 8000 && visto === null; t++) {
      s = step(s, []);
      visto = colheitaNasMaos(s, s.unidades.porId['canavieiro']!, config);
    }
    expect(visto).toBe('grapes');
    expect(rotuloDaCarga(visto!)).toBe('Cana');
  }, 60000);
});
