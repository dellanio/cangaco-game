/**
 * F-REPL-d — o seletor de modo no painel (docs/planos/2026-09-29-F-REPL-d-seletor-de-modo.md).
 * As opcoes e o comando sao de `ui/modo-do-predio.ts`; o clique vai no roteiro.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState } from '../src/sim/state';
import { salvar } from '../src/sim/save';
import { step } from '../src/sim/tick';
import { comandoDeModo, modosDoTipo, opcoesDeModo } from '../src/ui/modo-do-predio';
import temaSertao from '../data/theme-sertao.json';
import { cenarioOraculo } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const nomesDoLenhador = temaSertao.predios.woodcutters.modos;

function modoDe(s: GameState, id: string): string | undefined {
  const p = s.predios.porId[id];
  return p?.estado === 'completo' ? p.producao?.modo : undefined;
}

describe('F-REPL-d — as opcoes do seletor', () => {
  it('o lenhador: os modos do dado, na ordem, com os nomes do tema e o padrao marcado', () => {
    const modos = modosDoTipo(gameData.producao.receitas, 'woodcutters');
    expect(modos?.ids).toEqual(Object.keys(gameData.producao.receitas.woodcutters?.modos?.porModo ?? {}));
    const opcoes = opcoesDeModo(modos, undefined, nomesDoLenhador);
    expect(opcoes.map((o) => o.nome)).toEqual(opcoes.map((o) => nomesDoLenhador[o.id as keyof typeof nomesDoLenhador].nome));
    expect(opcoes.filter((o) => o.atual).map((o) => o.id)).toEqual([modos?.padrao]);
    expect(opcoesDeModo(modos, 'cortar', nomesDoLenhador).find((o) => o.atual)?.id).toBe('cortar');
  });

  it('e por dado, nao por tipo: sem modos nao ha seletor; outra receita com modos tem', () => {
    expect(opcoesDeModo(modosDoTipo(gameData.producao.receitas, 'sawmill'), undefined, undefined)).toEqual([]);
    expect(modosDoTipo(gameData.producao.receitas, 'storehouse')).toBeNull();
    const serraria = gameData.producao.receitas.sawmill;
    if (serraria === undefined) throw new Error('fixture');
    const variante: GameData = {
      ...gameData,
      producao: {
        ...gameData.producao,
        receitas: {
          ...gameData.producao.receitas,
          sawmill: { ...serraria, modos: { porModo: { a: { planta: false }, b: { planta: false } }, padrao: 'b' } },
        },
      },
    };
    const opcoes = opcoesDeModo(modosDoTipo(variante.producao.receitas, 'sawmill'), undefined, undefined);
    // sem nome no tema, o id neutro
    expect(opcoes).toEqual([
      { id: 'a', nome: 'a', desc: '', atual: false },
      { id: 'b', nome: 'b', desc: '', atual: true },
    ]);
  });
});

describe('F-REPL-d — o comando do botao passa pelo step', () => {
  it('"Cortar" e depois "Cortar e plantar" mudam o producao.modo do lenhador', () => {
    const s0 = step(cenarioOraculo(gameData), [], gameData);
    const padrao = gameData.producao.receitas.woodcutters?.modos?.padrao;
    expect(modoDe(s0, 'w1')).toBe(padrao);
    const s1 = step(s0, [comandoDeModo('w1', 'cortar')], gameData);
    expect(modoDe(s1, 'w1')).toBe('cortar');
    const recusas = s1.events.filter((e) => e.type === 'command-rejected');
    expect(recusas).toEqual([]);
    const s2 = step(s1, [comandoDeModo('w1', 'cortar_e_plantar')], gameData);
    expect(modoDe(s2, 'w1')).toBe('cortar_e_plantar');

    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F-REPL-d.save.txt`, salvar(s0));
    gravarEvidencia('F-REPL-d', { predio: 'w1', padrao, depoisDeCortar: modoDe(s1, 'w1'), depoisDeVoltar: modoDe(s2, 'w1') });
  });
});
