/**
 * I-TELA-AJUDA-DAS-CADEIAS — a ajuda mostra as cadeias de producao.
 *
 * (a) toda receita do dado aparece na aba, e nenhuma linha da aba fica sem receita (igualdade de
 *     conjuntos, sem varrer texto);
 * (b) mudar uma receita no dado muda a aba sem tocar no codigo (teste com dado alterado).
 * O (c) e o roteiro `tools/shots/I-TELA-AJUDA-DAS-CADEIAS.js`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData, ReceitaDePredio } from '../src/sim/data/types';
import { estadoNovo } from '../src/escolha-da-partida';
import { linhasDasCadeias, requisitosNaTela, textoDaLinha } from '../src/ui/cadeias';
import temaSertao from '../data/theme-sertao.json';
import { gravarEvidencia } from './helpers/evidence';

const conjunto = (xs: Iterable<string>): string[] => [...new Set(xs)].sort();

describe('I-TELA-AJUDA-DAS-CADEIAS — a aba Cadeias', () => {
  it('(a) toda receita do dado e uma linha da aba, e toda linha e uma receita', () => {
    const linhas = linhasDasCadeias(gameData);
    expect(conjunto(linhas.map((l) => l.predio))).toEqual(conjunto(Object.keys(gameData.producao.receitas)));
    expect(linhas.length).toBe(Object.keys(gameData.producao.receitas).length);
    for (const l of linhas) {
      const r = gameData.producao.receitas[l.predio] as ReceitaDePredio;
      expect(conjunto(l.entra.map((e) => e.mercadoria)), l.predio).toEqual(conjunto(Object.keys(r.entra)));
      expect(conjunto(l.sai.map((s) => s.mercadoria)), l.predio).toEqual(conjunto(Object.keys(r.sai)));
      expect(l.colhe, l.predio).toBe(r.colheita?.recurso ?? null);
      // de onde vem: exatamente as receitas que fazem a mercadoria
      for (const e of l.entra) {
        expect(conjunto(e.de), `${l.predio} <- ${e.mercadoria}`).toEqual(
          conjunto(Object.keys(gameData.producao.receitas).filter((id) => (gameData.producao.receitas[id]?.sai[e.mercadoria] ?? 0) > 0)),
        );
      }
      // para onde vai: toda receita que pede a mercadoria esta entre os destinos
      for (const s of l.sai) {
        const pedem = Object.keys(gameData.producao.receitas).filter((id) => (gameData.producao.receitas[id]?.entra[s.mercadoria] ?? 0) > 0);
        const destinos = s.para.flatMap((d) => (d.tipo === 'predio' ? [d.predio] : []));
        for (const id of pedem) expect(destinos, `${l.predio} -> ${s.mercadoria}`).toContain(id);
      }
      const t = textoDaLinha(l);
      expect(`${t.predio} ${t.entra} ${t.sai}`, l.predio).not.toMatch(/[{}]/);
    }
    gravarEvidencia('I-TELA-AJUDA-DAS-CADEIAS', { linhas: linhas.map((l) => ({ ...textoDaLinha(l), tipo: l.predio })) });
  });

  it('(b) a receita mudada no dado muda a aba, sem tocar no codigo', () => {
    const receitas: Record<string, ReceitaDePredio> = { ...gameData.producao.receitas };
    const serraria = receitas['sawmill'] as ReceitaDePredio;
    // a serraria passa a pedir pedra; o pescador perde a receita; a Bodega ganha uma
    receitas['sawmill'] = { ...serraria, entra: { ...serraria.entra, stone: 1 } };
    delete receitas['fishermans'];
    receitas['inn'] = { ...(receitas['wineyard'] as ReceitaDePredio), colheita: null, entra: { corn: 1 }, sai: { wine: 1 } };
    const alterado: GameData = { ...gameData, producao: { ...gameData.producao, receitas } };

    const antes = linhasDasCadeias(gameData);
    const depois = linhasDasCadeias(alterado);
    expect(conjunto(depois.map((l) => l.predio))).toEqual(conjunto(Object.keys(receitas)));
    expect(depois.some((l) => l.predio === 'fishermans')).toBe(false);
    expect(antes.some((l) => l.predio === 'fishermans')).toBe(true);
    expect(depois.find((l) => l.predio === 'inn')?.entra).toEqual([{ mercadoria: 'corn', de: ['farm'] }]);
    const serrariaDepois = depois.find((l) => l.predio === 'sawmill');
    expect(serrariaDepois?.entra.find((e) => e.mercadoria === 'stone')?.de).toEqual(['quarry']);
    // e o outro lado da cadeia: a pedra da pedreira passa a ir para a serraria
    const pedra = (ls: typeof antes): readonly string[] =>
      ls.find((l) => l.predio === 'quarry')?.sai.find((s) => s.mercadoria === 'stone')?.para.flatMap((d) => (d.tipo === 'predio' ? [d.predio] : [])) ?? [];
    expect(pedra(antes)).not.toContain('sawmill');
    expect(pedra(depois)).toContain('sawmill');
    // o texto da linha acompanha
    const nomeDaPedra = temaSertao.mercadorias.stone;
    expect(textoDaLinha(serrariaDepois as NonNullable<typeof serrariaDepois>).entra).toContain(nomeDaPedra);
  });

  it('o predio bloqueado mostra o "requer X" do menu de construir', () => {
    const s0 = estadoNovo({ modo: 'livre' });
    const travas = requisitosNaTela(s0, gameData);
    const nomes = temaSertao.predios as Readonly<Record<string, { readonly nome: string }>>;
    expect(travas.get('sawmill')).toBe(`${temaSertao.menuBuild.requer} ${nomes['woodcutters']?.nome}`);
    expect(travas.has('woodcutters')).toBe(false);
    expect(travas.has('quarry')).toBe(false);
    // so os bloqueados: o desbloqueado pela arvore nao aparece
    const liberada = { ...s0, tiposJaConstruidos: [...s0.tiposJaConstruidos, 'woodcutters'] };
    expect(requisitosNaTela(liberada, gameData).has('sawmill')).toBe(false);
  });
});
