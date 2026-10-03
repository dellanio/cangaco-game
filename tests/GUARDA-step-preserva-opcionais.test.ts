/**
 * Guarda permanente (pedido do operador, 2026-09-29, depois do defeito da D-TRANSPORTE-02a):
 * o `step` monta o estado de saida CAMPO A CAMPO (`sim/tick.ts`), e o typecheck so cobra o
 * campo obrigatorio. Campo opcional esquecido no literal some no fim do tick, calado — foi
 * assim que `distribuicao` nao valia na partida.
 *
 * A lista de opcionais NAO e escrita a olho: `satisfies Record<ChavesOpcionais<T>, ...>`
 * obriga este arquivo a nomear todo opcional de `GameState`, de `PredioCompleto`, de
 * `Producao` e de `EscolhaDeSaida` (D-PRODUCAO-03a). Campo opcional novo quebra o typecheck aqui ate alguem decidir se ele
 * persiste, e o fixture `Required<GameState>` obriga a preenche-lo.
 *
 * `Unidade` e `DadosDaFsm` ficam de fora de proposito: todo opcional deles e da FSM, que
 * os cria e apaga a cada transicao.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, LADO_DO_JOGADOR } from '../src/sim/state';
import type { EscolhaDeSaida, GameState, Predio, PredioCompleto, Producao } from '../src/sim/state';
import { comDistribuicao } from '../src/sim/distribuicao';
import { criarEscaramuca } from '../src/sim/cenario';
import { step } from '../src/sim/tick';
import { gravarEvidencia } from './helpers/evidence';

/** As chaves opcionais de `T`: as que `Partial` nao muda. */
type ChavesOpcionais<T> = { [K in keyof T]-?: Partial<Pick<T, K>> extends Pick<T, K> ? K : never }[keyof T];

/** `persiste`: so comando (ou demolicao) mexe; nenhum tick sem comando pode apaga-lo.
 *  `do-sistema`: um sistema cria e apaga no ritmo dele — a guarda nao cobra. */
type Regime = 'persiste' | 'do-sistema';

const OPCIONAIS_DO_ESTADO = {
  ia: 'persiste',
  partida: 'persiste',
  pazAteTick: 'persiste',
  // o voo acaba e o campo some: cobrado so enquanto `restantes` nao zera (o fixture voa longe)
  projeteis: 'persiste',
  distribuicao: 'persiste',
  // F-TERRENO-NEVOA-DESCOBERTO: monotonico, nenhum tick o apaga
  descoberto: 'persiste',
} as const satisfies Record<ChavesOpcionais<GameState>, Regime>;

const OPCIONAIS_DO_PREDIO = {
  recrutas: 'persiste',
  // a torre conta a recarga e apaga o campo quando fica pronta (`AUSENTE e pronta`)
  recarga: 'do-sistema',
  troca: 'persiste',
  naoAceita: 'persiste',
  // so a entrega escreve, e nenhum tick sem entrega apaga
  ultimaEntrega: 'persiste',
} as const satisfies Record<ChavesOpcionais<PredioCompleto>, Regime>;

const OPCIONAIS_DA_PRODUCAO = {
  escolha: 'persiste',
  // o roçado grava o ultimo tile do rodizio quando escolhe: nasce no sistema
  cursor: 'do-sistema',
  modo: 'persiste',
} as const satisfies Record<ChavesOpcionais<Producao>, Regime>;

const OPCIONAIS_DA_ESCOLHA = {
  // D-PRODUCAO-03a — o comeco do ciclo grava a saida em curso e o deposito a apaga
  emCurso: 'do-sistema',
} as const satisfies Record<ChavesOpcionais<EscolhaDeSaida>, Regime>;

const persistentes = (tabela: Readonly<Record<string, Regime>>): string[] =>
  Object.entries(tabela).filter(([, r]) => r === 'persiste').map(([k]) => k);

const TICKS = 5;

function comPredioNovo(state: GameState, predio: PredioCompleto): GameState {
  return {
    ...state,
    predios: { ordem: [...state.predios.ordem, predio.id], porId: { ...state.predios.porId, [predio.id]: predio } },
  };
}

function novo(id: string, tipo: string, gx: number, gy: number): PredioCompleto {
  const def = gameData.predios.find((d) => d.id === tipo);
  if (def === undefined) throw new Error(`fixture: tipo '${tipo}' nao existe`);
  return completarObra({ id, lado: LADO_DO_JOGADOR, tipo, gx, gy, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 } }, gameData);
}

/** A escaramuca (que ja traz `ia` e `pazAteTick`) com todo opcional preenchido. */
function estadoCheio(): { readonly state: Required<GameState>; readonly ids: Readonly<Record<string, string>> } {
  const base = criarEscaramuca(1);
  const armazem = Object.values(base.predios.porId)
    .find((p): p is PredioCompleto => p?.estado === 'completo' && p.lado === LADO_DO_JOGADOR && p.tipo === 'storehouse');
  if (armazem === undefined) throw new Error('fixture: a escaramuca nao tem armazem do jogador');
  if (base.ia === undefined || base.pazAteTick === undefined) throw new Error('fixture: a escaramuca deveria criar ia e pazAteTick');
  if (base.descoberto === undefined) throw new Error('fixture: a escaramuca deveria criar descoberto');

  let s: GameState = base;
  s = comPredioNovo(s, { ...novo('g-quartel', 'barracks', 2, 2), recrutas: 3 });
  s = comPredioNovo(s, { ...novo('g-feira', 'marketplace', 6, 2), troca: { da: 'stone', para: 'timber', quantidade: 999, feitas: 0 } });
  s = comPredioNovo(s, { ...novo('g-oficina', 'weapons_workshop', 10, 2), ultimaEntrega: { timber: 0 } });
  s = comPredioNovo(s, novo('g-lenhador', 'woodcutters', 14, 2));
  s = { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [armazem.id]: { ...armazem, naoAceita: ['stone'] } } } };

  // pelo helper do comando, e nao pelo `step`: o fixture nao pode depender do que a guarda cobra
  const comLimite = comDistribuicao(s, LADO_DO_JOGADOR, 'corn', 'mill', 2, gameData);
  if (comLimite.distribuicao === undefined) throw new Error('fixture: comDistribuicao deveria gravar o campo');

  const cheio: Required<GameState> = {
    ...comLimite,
    ia: base.ia,
    pazAteTick: base.pazAteTick,
    distribuicao: comLimite.distribuicao,
    descoberto: base.descoberto,
    partida: { fim: 'vitoria', tick: comLimite.tick },
    projeteis: [{
      projetil: 'arrow',
      de: { id: 'g-atirador', tipo: 'bowman', lado: LADO_DO_JOGADOR, gx: 0, gy: 0 },
      origem: { gx: 0, gy: 0 }, alvoTile: { gx: 1, gy: 1 },
      voo: TICKS * 4, restantes: TICKS * 4,
    }],
  };
  return { state: cheio, ids: { armazem: armazem.id, quartel: 'g-quartel', feira: 'g-feira', oficina: 'g-oficina', lenhador: 'g-lenhador' } };
}

/** O que existia em `antes` e sumiu em `depois`, com o caminho. */
function sumidos(antes: object, depois: object, chaves: readonly string[], onde: string): string[] {
  return chaves.filter((k) => k in antes && !(k in depois)).map((k) => `${onde}.${k}`);
}

function sumidosNoPredio(antes: Predio | undefined, depois: Predio | undefined, id: string): string[] {
  if (antes?.estado !== 'completo') return [];
  if (depois?.estado !== 'completo') return [`predios.${id}`];
  return [
    ...sumidos(antes, depois, persistentes(OPCIONAIS_DO_PREDIO), `predios.${id}`),
    ...sumidos(antes.producao ?? {}, depois.producao ?? {}, persistentes(OPCIONAIS_DA_PRODUCAO), `predios.${id}.producao`),
    ...sumidos(antes.producao?.escolha ?? {}, depois.producao?.escolha ?? {}, persistentes(OPCIONAIS_DA_ESCOLHA), `predios.${id}.producao.escolha`),
  ];
}

function sumidosNoEstado(antes: GameState, depois: GameState): string[] {
  return [
    ...sumidos(antes, depois, persistentes(OPCIONAIS_DO_ESTADO), 'state'),
    ...antes.predios.ordem.flatMap((id) => sumidosNoPredio(antes.predios.porId[id], depois.predios.porId[id], id)),
  ];
}

describe('GUARDA — o step nao perde campo opcional', () => {
  const { state: cheio, ids } = estadoCheio();

  it('o fixture tem de fato cada opcional persistente preenchido', () => {
    for (const k of persistentes(OPCIONAIS_DO_ESTADO)) expect(k in cheio, `state.${k}`).toBe(true);
    const campo = (id: string | undefined): PredioCompleto => {
      const p = id === undefined ? undefined : cheio.predios.porId[id];
      if (p?.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
      return p;
    };
    expect(campo(ids.quartel).recrutas).toBe(3);
    expect(campo(ids.feira).troca).toBeDefined();
    expect(campo(ids.armazem).naoAceita).toEqual(['stone']);
    expect(campo(ids.oficina).producao?.escolha).toBeDefined();
    expect(campo(ids.oficina).ultimaEntrega).toEqual({ timber: 0 });
    expect(campo(ids.lenhador).producao?.modo).toBeDefined();
  });

  it(`cada opcional persistente sobrevive a ${TICKS} ticks sem comando`, () => {
    let s: GameState = cheio;
    const porTick: string[][] = [];
    for (let t = 0; t < TICKS; t++) {
      const proximo = step(s, [], gameData);
      porTick.push(sumidosNoEstado(s, proximo));
      s = proximo;
    }
    gravarEvidencia('GUARDA-step-preserva-opcionais', {
      ticks: TICKS,
      estado: persistentes(OPCIONAIS_DO_ESTADO),
      predio: persistentes(OPCIONAIS_DO_PREDIO),
      producao: persistentes(OPCIONAIS_DA_PRODUCAO),
      sumidosPorTick: porTick,
    });
    expect(porTick).toEqual(Array.from({ length: TICKS }, () => []));
  });

  it('a guarda acusa: o campo tirado a mao aparece em `sumidos`', () => {
    const { distribuicao: _d, ...semDistribuicao } = cheio;
    expect(sumidosNoEstado(cheio, semDistribuicao)).toEqual(['state.distribuicao']);
    const feira = cheio.predios.porId[ids.feira ?? ''];
    if (feira?.estado !== 'completo') throw new Error('fixture: feira');
    const { troca: _t, ...semTroca } = feira;
    const semTrocaNoEstado: GameState = { ...cheio, predios: { ...cheio.predios, porId: { ...cheio.predios.porId, [feira.id]: semTroca } } };
    expect(sumidosNoEstado(cheio, semTrocaNoEstado)).toEqual([`predios.${feira.id}.troca`]);
  });
});
