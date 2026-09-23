/**
 * F16b — o seletor que alimenta o painel de prédio. Plano em
 * `docs/planos/F16b-painel-predio.md`.
 *
 * Tudo puro: nenhum estado novo, nenhum campo novo, nenhum comando novo. O
 * painel em si (DOM) nao tem teste unitario porque o Vitest roda em
 * `environment: 'node'` — quem prova a interface e o roteiro
 * `tools/shots/F16b.js`, como na F13b.
 *
 * `pausado` entra pelo COMANDO REAL (`SetBuildingPaused`), nunca escrito a mao
 * no estado: mesmo criterio da F16a e da F16c.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { painelDoPredio } from '../src/sim/selectors';
import { custoDoPredio } from '../src/sim/obra';
import { gravarEvidencia } from './helpers/evidence';
import { cenarioDePedreira, semOcupante } from './helpers/producao-cenario';
import { armazemPorTipo, escolaDoCenario } from './helpers/escola-cenario';

const inicial = createInitialState(1);
const ARMAZEM = armazemPorTipo(inicial).id;
const ESCOLA = escolaDoCenario(inicial).id;

const pedreira = cenarioDePedreira();
const PEDREIRA = 'q1';
const TRABALHADOR_DA_QUARRY = gameData.predios.find((p) => p.id === 'quarry')?.trabalhador;
const HP_DA_QUARRY = gameData.predios.find((p) => p.id === 'quarry')?.hp;

/** Uma obra de verdade, posta pelo comando — nao um predio montado a mao. */
const comObra: GameState = step(inicial, [
  { type: 'PlaceBlueprint', buildingId: 'quarry', gx: 38, gy: 31 },
], gameData);
const OBRA = comObra.predios.ordem[comObra.predios.ordem.length - 1] as string;

describe('F16b — painelDoPredio', () => {
  it('devolve null para id fora do estado: e assim que o painel se fecha ao demolir', () => {
    expect(painelDoPredio(inicial, 'p999')).toBeNull();
  });

  it('pedreira completa e ocupada: ocupante com o TIPO do civil, e producao', () => {
    const p = painelDoPredio(pedreira, PEDREIRA);
    expect(p).not.toBeNull();
    expect(p?.tipo).toBe('quarry');
    expect(p?.estado).toBe('completo');
    expect(p?.pedeTrabalhador).toBe(true);
    // o tipo vem do DADO, nao de uma string digitada no teste
    expect(p?.ocupante?.tipo).toBe(TRABALHADOR_DA_QUARRY);
    expect(p?.ocupante?.unidade).toBe('u1');
    expect(p?.temProducao).toBe(true);
    expect(p?.pausado).toBe(false);
    expect(p?.hp).toBe(HP_DA_QUARRY);
    expect(p?.hpTotal).toBe(HP_DA_QUARRY);
    expect(p?.progresso).toBe(1);
    expect(p?.faltam).toBeNull();
  });

  it('armazem: nao pede trabalhador e nao produz — a tela nao desenha o botao pausar', () => {
    const p = painelDoPredio(inicial, ARMAZEM);
    expect(p?.pedeTrabalhador).toBe(false);
    expect(p?.ocupante).toBeNull();
    expect(p?.temProducao).toBe(false);
  });

  it('escola: completa, sem trabalhador e sem producao', () => {
    const p = painelDoPredio(inicial, ESCOLA);
    expect(p?.estado).toBe('completo');
    expect(p?.pedeTrabalhador).toBe(false);
    expect(p?.temProducao).toBe(false);
  });

  it('pedreira vaga: PEDE trabalhador E esta sem ocupante — dois campos, nao um', () => {
    // "vago" e "nao pede trabalhador" tem de ser distinguiveis: o painel escreve
    // textos diferentes, e um campo so nao separaria as duas causas.
    const p = painelDoPredio(semOcupante(pedreira, PEDREIRA), PEDREIRA);
    expect(p?.pedeTrabalhador).toBe(true);
    expect(p?.ocupante).toBeNull();
  });

  it('pausado sai do campo do predio, posto pelo comando real', () => {
    const depois = step(pedreira, [
      { type: 'SetBuildingPaused', predio: PEDREIRA, pausado: true },
    ], gameData);
    expect(painelDoPredio(depois, PEDREIRA)?.pausado).toBe(true);
    const devolta = step(depois, [
      { type: 'SetBuildingPaused', predio: PEDREIRA, pausado: false },
    ], gameData);
    expect(painelDoPredio(devolta, PEDREIRA)?.pausado).toBe(false);
  });

  it('obra: progresso e o que falta chegar; sem estoque, sem ocupante, sem pausar', () => {
    const p = painelDoPredio(comObra, OBRA);
    expect(p?.estado).toBe('obra');
    expect(p?.estoque).toBeNull();
    expect(p?.ocupante).toBeNull();
    expect(p?.temProducao).toBe(false);
    expect(p?.hpTotal).toBe(HP_DA_QUARRY);
    expect(p?.progresso).toBeCloseTo((p?.hp ?? 0) / (p?.hpTotal ?? 1));
    // obra recem-posta: falta o custo inteiro, e o custo vem do DADO
    const def = gameData.predios.find((b) => b.id === 'quarry');
    const custo: Readonly<Record<string, number>> = def === undefined ? {} : custoDoPredio(def);
    expect(p?.faltam).toEqual(
      gameData.economia.mercadorias
        .map((m) => ({ mercadoria: m, quantidade: custo[m] ?? 0 }))
        .filter((i) => i.quantidade > 0),
    );
  });

  it('as gavetas saem na ordem de economia.mercadorias, nao na de Object.keys', () => {
    // GUARDA ESTRUTURAL: a ordem esperada e derivada do DADO. Uma lista literal
    // digitada aqui passaria a valer mesmo se alguem trocasse a fonte da ordem.
    const saida = painelDoPredio(inicial, ARMAZEM)?.estoque?.saida ?? [];
    const ids = saida.map((i) => i.mercadoria);
    expect(ids).toEqual(gameData.economia.mercadorias.filter((m) => ids.includes(m)));
    expect(ids.length).toBeGreaterThan(1); // com um item so a ordem nao prova nada
  });

  it('mercadoria zerada nao vira linha: gaveta vazia e gaveta vazia', () => {
    const p = painelDoPredio(pedreira, PEDREIRA);
    expect(p?.estoque?.entrada).toEqual([]); // a quarry nao consome nada
    expect(p?.estoque?.saida.every((i) => i.quantidade > 0)).toBe(true);
  });

  it('o painel nao inventa nada: todo id que ele devolve e neutro, nunca do tema', () => {
    // O tema nao pode ser lido por sim/ (CLAUDE.md §9). A prova estrutural e que
    // os ids do painel batem com os do dado neutro.
    const p = painelDoPredio(pedreira, PEDREIRA);
    expect(gameData.predios.some((b) => b.id === p?.tipo)).toBe(true);
    expect(gameData.economia.mercadorias).toEqual(
      expect.arrayContaining(p?.estoque?.saida.map((i) => i.mercadoria) ?? []),
    );
  });
});

describe('F16b — evidencia', () => {
  it('grava o resultado do aceite', () => {
    const completoOcupado = painelDoPredio(pedreira, PEDREIRA);
    const pausado = painelDoPredio(
      step(pedreira, [{ type: 'SetBuildingPaused', predio: PEDREIRA, pausado: true }], gameData),
      PEDREIRA,
    );
    gravarEvidencia('F16b', {
      feature: 'F16b — painel de selecao de predio',
      _doc: 'Seletor puro; o DOM e provado por tools/shots/F16b.js. A cadeia do aceite foi medida em test-output/F16b-sonda.json.',
      completoOcupado,
      pausado: { pausado: pausado?.pausado, ocupante: pausado?.ocupante },
      obra: painelDoPredio(comObra, OBRA),
      armazem: painelDoPredio(inicial, ARMAZEM),
      predioInexistente: painelDoPredio(inicial, 'p999'),
    });
    expect(completoOcupado?.ocupante).not.toBeNull();
  });
});
