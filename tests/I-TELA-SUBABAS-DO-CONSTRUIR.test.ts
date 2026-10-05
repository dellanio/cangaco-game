/**
 * I-TELA-SUBABAS-DO-CONSTRUIR — o menu Construir em quatro sub-abas (pedido do operador, 2026-10-05).
 * O dado tem os quatro grupos na ordem do operador, cada predio num grupo so, e o predio sem grupo cai
 * em Vila. O gesto da sub-aba (mouse despausado) e o roteiro F06.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { grupoDaOpcao, GRUPO_PADRAO } from '../src/ui/menu-build';
import { predioDoSeletor } from '../tools/shots/_subaba.js';

const menu = JSON.parse(readFileSync('data/menu-build.json', 'utf8')) as { grupos: { id: string; predios: string[] }[] };
const tema = JSON.parse(readFileSync('data/theme-sertao.json', 'utf8')) as { menuBuild: { grupos: Record<string, string> } };

describe('I-TELA-SUBABAS-DO-CONSTRUIR', () => {
  it('quatro grupos, na ordem do operador, com os rotulos do tema', () => {
    expect(menu.grupos.map((g) => g.id)).toEqual(['vila', 'comida', 'materia', 'guerra']);
    expect(menu.grupos.map((g) => tema.menuBuild.grupos[g.id])).toEqual(['Vila', 'De Comer', 'Mato e Pedra', 'Guerra']);
  });

  it('o conteudo de cada sub-aba e o do pedido (mais a Pedreira e a Casa do Gibao, a interpretacao registrada)', () => {
    const de = (id: string): string[] => [...(menu.grupos.find((g) => g.id === id)?.predios ?? [])].sort();
    expect(de('vila')).toEqual(['inn', 'marketplace', 'schoolhouse', 'storehouse']);
    expect(de('comida')).toEqual(['bakery', 'butchers', 'farm', 'fishermans', 'mill', 'swine_farm', 'wineyard']);
    expect(de('materia')).toEqual(['coal_mine', 'gold_mine', 'iron_mine', 'iron_smithy', 'metallurgists', 'quarry', 'sawmill', 'woodcutters']);
    expect(de('guerra')).toEqual(['armor_smithy', 'armory_workshop', 'barracks', 'stables', 'tannery', 'town_hall', 'watchtower', 'weapon_smithy', 'weapons_workshop']);
  });

  it('predio sem grupo no dado cai em Vila', () => {
    const grupoDe = new Map([['farm', 'comida']]);
    expect(grupoDaOpcao('farm', grupoDe)).toBe('comida');
    expect(grupoDaOpcao('castelo-novo', grupoDe)).toBe('vila');
    expect(GRUPO_PADRAO).toBe('vila');
  });

  it('o envoltorio dos roteiros so reconhece o botao de predio do menu', () => {
    expect(predioDoSeletor('[data-predio="farm"]')).toBe('farm');
    expect(predioDoSeletor(`#menu-build [data-predio="mill"] img.retrato`)).toBe('mill');
    expect(predioDoSeletor('#painel-predio')).toBeNull();
    expect(predioDoSeletor(42)).toBeNull();
  });
});
