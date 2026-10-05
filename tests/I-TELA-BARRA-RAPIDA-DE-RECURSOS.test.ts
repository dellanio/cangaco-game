/**
 * I-TELA-BARRA-RAPIDA-DE-RECURSOS — a barra fina de recursos no alto do meio da tela (pedido do
 * operador, 2026-10-05): madeira, pedra, carvao, ouro, ferro, a comida somada, armas e armaduras
 * (os escudos em armaduras).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mercadoriasDaCategoria, totaisDaBarra } from '../src/ui/barra-rapida';
import type { ConfigDaBarra } from '../src/ui/barra-rapida';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { estoqueDosArmazens } from '../src/sim/selectors';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { validarInterface } from '../tools/data-rules.js';

const config = JSON.parse(readFileSync('data/barra-rapida.json', 'utf8')) as ConfigDaBarra;
const grupos = { comida: gameData.economia.grupos.comida };

/** O estado inicial com o estoque do armazem inicial trocado (e um segundo armazem, opcional). */
function comEstoque(saida: Record<string, number>, outro?: { estado: 'completo' | 'obra'; saida: Record<string, number> }): GameState {
  let s = createInitialState(gameData.economia.estadoInicial.semente);
  const id = s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === 'storehouse')!;
  const armazem = s.predios.porId[id] as PredioCompleto;
  const porId = { ...s.predios.porId, [id]: { ...armazem, estoque: { entrada: {}, saida } } };
  const ordem = [...s.predios.ordem];
  if (outro) {
    const segundo = outro.estado === 'completo'
      ? { ...armazem, id: 'armazem-2', gx: armazem.gx + 10, estoque: { entrada: {}, saida: outro.saida } }
      : { ...armazem, id: 'armazem-2', gx: armazem.gx + 10, estado: 'obra' as const, obra: { faltam: {}, nivelamento: 0 } };
    porId['armazem-2'] = segundo as never;
    ordem.push('armazem-2');
  }
  s = { ...s, predios: { porId, ordem } };
  return s;
}

describe('I-TELA-BARRA-RAPIDA-DE-RECURSOS', () => {
  it('(1) as categorias do pedido, na ordem, e a comida vem do grupo `comida` do economy.json', () => {
    expect(config.categorias.map((c) => c.id)).toEqual(['madeira', 'pedra', 'carvao', 'ouro', 'ferro', 'comida', 'armas', 'armaduras']);
    const comida = config.categorias.find((c) => c.id === 'comida')!;
    expect(comida.grupo).toBe('comida');
    expect(mercadoriasDaCategoria(comida, grupos)).toEqual(gameData.economia.grupos.comida);
    const armaduras = mercadoriasDaCategoria(config.categorias.find((c) => c.id === 'armaduras')!, grupos);
    expect(armaduras).toEqual(expect.arrayContaining(['wooden_shield', 'iron_shield', 'leather_armor', 'iron_armor']));
  });

  it('(2) por tabela: a soma das mercadorias da categoria nos armazens completos; o escudo conta em armaduras', () => {
    const s = comEstoque(
      { timber: 7, stone: 3, coal: 2, gold: 5, iron: 1, loaves: 4, fish: 2, wine: 1, sword: 2, pike: 1, iron_shield: 3, leather_armor: 1, tree_trunk: 9 },
      { estado: 'completo', saida: { timber: 1, wooden_shield: 2, sausages: 6 } },
    );
    expect(totaisDaBarra(estoqueDosArmazens(s), config, grupos)).toEqual({
      madeira: 8, pedra: 3, carvao: 2, ouro: 5, ferro: 1, comida: 4 + 2 + 1 + 6, armas: 3, armaduras: 3 + 1 + 2,
    });
    // a obra de armazem nao guarda nada, e a tora nao e madeira (a madeira e a tabua)
    const comObra = comEstoque({ timber: 1 }, { estado: 'obra', saida: {} });
    expect(totaisDaBarra(estoqueDosArmazens(comObra), config, grupos)['madeira']).toBe(1);
  });

  it('(3) a barra le o mesmo seletor do HUD: madeira, pedra e ouro iguais aos do estoque dos armazens', () => {
    const s = createInitialState(gameData.economia.estadoInicial.semente);
    const estoque = estoqueDosArmazens(s);
    const t = totaisDaBarra(estoque, config, grupos);
    expect(t['madeira']).toBe(estoque['timber'] ?? 0);
    expect(t['pedra']).toBe(estoque['stone'] ?? 0);
    expect(t['ouro']).toBe(estoque['gold'] ?? 0);
  });

  it('(3) o CSS: centrada no alto da celula do canvas, com altura de ate 28 px, e sem pegar clique', () => {
    const css = readFileSync('src/ui/estilo.css', 'utf8');
    const i = css.lastIndexOf('#barra-rapida {');
    const bloco = css.slice(i, css.indexOf('}', i));
    expect(bloco).toContain('justify-self: center');
    expect(bloco).toContain('align-self: start');
    expect(bloco).toContain('pointer-events: none');
    expect(Number(/height:\s*(\d+)px/.exec(bloco)?.[1])).toBeLessThanOrEqual(28);
    expect(readFileSync('index.html', 'utf8')).toContain('id="barra-rapida"');
  });

  it('(1) o validador reprova a mercadoria que nao existe, a categoria sem icone e a mercadoria em duas categorias', () => {
    const ler = (nomes: readonly string[]) => Object.fromEntries(nomes.map((nome) => [nome, JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'))]));
    const dados = ler(ARQUIVOS), interfaceUi = ler(ARQUIVOS_DA_INTERFACE);
    expect(validarInterface(dados, interfaceUi)).toEqual([]);
    const com = (categorias: unknown[]) => validarInterface(dados, { ...interfaceUi, 'barra-rapida': { categorias } });
    const base = config.categorias.slice(1);
    expect(com([{ id: 'madeira', mercadorias: ['madeira-de-lei'], icone: 'timber' }, ...base]))
      .toContain("interface/barra-rapida: categoria madeira: mercadoria 'madeira-de-lei' nao existe em economy.json");
    expect(com([{ id: 'madeira', mercadorias: ['timber'] }, ...base]))
      .toContain("interface/barra-rapida: categoria madeira: icone 'undefined' precisa ser mercadoria de economy.json");
    expect(com([{ id: 'madeira', mercadorias: ['timber', 'stone'], icone: 'timber' }, ...base]))
      .toContain("interface/barra-rapida: mercadoria 'stone' em duas categorias (madeira e pedra)");
  });
});
