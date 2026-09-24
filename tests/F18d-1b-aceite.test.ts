/**
 * F18d-1b — ACEITE, um cenario so.
 *
 * "A rua desenhada nao liga nada no tick do comando e liga depois que o laborer assenta;
 *  a pedra sai do armazem exatamente uma vez, no assentamento." (BUILD_PLAN.md)
 *
 * O cenario e a rua que ligaria a escola ao armazem do estado inicial. As duas metades
 * do aceite viram invariante de TODO tick do percurso, nao asserçao de ponta:
 *
 *  - LIGACAO: a ligacao so muda em tick de assentamento. No tick do comando, com a rua
 *    inteira desenhada e nenhum tile de pe, ela e `false`; dali em diante, todo tick em
 *    que nenhum tile foi assentado a deixa como estava. (Ela nao espera o ULTIMO tile: a
 *    rua desenhada e a uniao das duas portas, e o traçado que liga e um pedaço dela — o
 *    que o aceite pede e que quem virou a chave tenha sido um assentamento.)
 *  - PEDRA: `bens.stone + tilesDePe x custo` e constante o percurso inteiro. Isso e mais
 *    forte que medir o total no fim: prende a saida da pedra ao tick do assentamento
 *    (nao antes, no comando) e a uma vez so (duas debitariam sem tile novo).
 */
import { describe, it, expect, afterAll } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { MERCADORIA_DA_ESTRADA, predioLigadoAoArmazem, tilesDaPorta } from '../src/sim/estradas';
import { inicial, linhaH, tile } from './helpers/jobs-cenario';
import { bensPorMercadoria } from './helpers/serf-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsmDoLaborer } from './helpers/laborer-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const CUSTO = gameData.terreno.estrada.custoStonePorTile;
const FRACAO = gameData.terreno.estrada.devolucaoAoDemolir;
const TETO = 400;

const predio = (e: GameState, tipo: string) => {
  const p = e.predios.ordem.map((id) => e.predios.porId[id]).find((x) => x?.tipo === tipo);
  if (!p) throw new Error(`fixture: cenario sem ${tipo}`);
  return p;
};
const armazem = predio(inicial, 'storehouse');
const escola = predio(inicial, 'schoolhouse');

/** A rua que ligaria as duas portas, correndo na linha logo abaixo do armazem. */
const RUA = (() => {
  const xs = [...tilesDaPorta(armazem, gameData), ...tilesDaPorta(escola, gameData)].map((t) => t.gx);
  return linhaH(Math.min(...xs), Math.max(...xs), armazem.gy + 3);
})();

const dePe = (e: GameState): number => Object.keys(e.estradas).length;
const desenhados = (e: GameState): number => Object.keys(e.estradasPlanejadas).length;
const pedra = (e: GameState): number => bensPorMercadoria(e)[MERCADORIA_DA_ESTRADA] ?? 0;
/** O que a pedra vira quando o laborer assenta continua sendo pedra: contada aqui, a
 *  soma nao pode mudar em tick nenhum. */
const pedraMaisRua = (e: GameState): number => pedra(e) + dePe(e) * CUSTO;
const ligada = (e: GameState): boolean => predioLigadoAoArmazem(e, escola, gameData);

const evidencia: Record<string, unknown> = {};

describe('F18d-1b — a rua desenhada nao liga; quem liga e o assentamento', () => {
  it('no tick do comando: canteiro cheio, nada ligado, pedra intacta', () => {
    const t1 = step(inicial, [{ type: 'PlaceRoad', tiles: RUA }]);
    expect(t1.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    expect(desenhados(t1)).toBe(RUA.length);
    expect(dePe(t1)).toBe(0);
    expect(ligada(t1)).toBe(false);
    expect(pedra(t1)).toBe(pedra(inicial));      // nada saiu do armazem
    expect(pedraMaisRua(t1)).toBe(pedraMaisRua(inicial));

    evidencia['tickDoComando'] = {
      tick: t1.tick, tilesPedidos: RUA.length, desenhados: desenhados(t1), dePe: dePe(t1),
      escolaLigadaAoArmazem: ligada(t1), pedraNoMundo: pedra(t1), pedraAntes: pedra(inicial),
    };
  });

  it('o laborer assenta tile a tile; a pedra sai uma vez, no assentamento, e so entao liga', () => {
    let estado = step(inicial, [{ type: 'PlaceRoad', tiles: RUA }]);
    const constante = pedraMaisRua(inicial);
    // um tick pode ter mais de um assentamento: sao dois laborers, cada um com o seu tile
    const assentamentos: { tick: number; novos: number; dePe: number; pedraNoMundo: number }[] = [];
    let ligouNoTick: number | null = null;

    for (let n = 0; n < TETO && desenhados(estado) > 0; n += 1) {
      const antes = dePe(estado);
      const ligadaAntes = ligada(estado);
      estado = step(estado, []);
      const assentouAgora = dePe(estado) > antes;

      // a metade PEDRA: a soma nao se move em tick nenhum — nem no do comando, nem no do
      // assentamento (a pedra virou tile), nem em nenhum outro (nao ha segundo debito).
      expect(pedraMaisRua(estado), `pedra + rua no tick ${estado.tick}`).toBe(constante);
      // a metade LIGACAO: sem assentamento, a ligacao nao se move — desenhar nao liga.
      if (!assentouAgora) expect(ligada(estado), `ligada no tick ${estado.tick}`).toBe(ligadaAntes);

      if (assentouAgora) {
        assentamentos.push({
          tick: estado.tick, novos: dePe(estado) - antes, dePe: dePe(estado), pedraNoMundo: pedra(estado),
        });
      }
      if (ligouNoTick === null && ligada(estado)) ligouNoTick = estado.tick;
    }

    expect(desenhados(estado)).toBe(0);
    expect(dePe(estado)).toBe(RUA.length);
    // nenhum tile de graca: cada um dos que estao de pe passou por um assentamento
    expect(assentamentos.reduce((n, a) => n + a.novos, 0)).toBe(RUA.length);
    expect(ligada(estado)).toBe(true);
    // o tick que ligou e um tick de assentamento, e nao o do comando
    expect(assentamentos.map((a) => a.tick)).toContain(ligouNoTick);
    expect(ligouNoTick).toBeGreaterThan(inicial.tick + 1);
    expect(pedra(estado)).toBe(pedra(inicial) - RUA.length * CUSTO);
    expect(violacoesDaFsmDoLaborer(estado)).toEqual([]);
    expect(violacoesDeInvariantes(estado)).toEqual([]);

    evidencia['assentamento'] = {
      assentamentos,
      ticksComAssentamento: assentamentos.length,
      tilesAssentados: assentamentos.reduce((n, a) => n + a.novos, 0),
      tickEmQueLigou: ligouNoTick,
      ligouEmTickDeAssentamento: assentamentos.some((a) => a.tick === ligouNoTick),
      tickDoUltimoAssentamento: assentamentos[assentamentos.length - 1]?.tick,
      debitadoNoTotal: pedra(inicial) - pedra(estado),
      esperadoDoDado: RUA.length * CUSTO,
      formula: `${RUA.length} tiles x terreno.estrada.custoStonePorTile=${CUSTO}`,
      pedraMaisRuaConstante: constante,
    };

    // o saldo da borracha sobre os tres conjuntos, sobre esta mesma rua de pe
    const doisDePe = RUA.slice(0, 2);
    const comCanteiroNovo = step(estado, [{ type: 'PlaceRoad', tiles: [tile(29, 30), tile(30, 30)] }]);
    const pedraAntes = pedra(comCanteiroNovo);
    const depois = step(comCanteiroNovo, [{
      type: 'DemolishRoad', tiles: [...doisDePe, tile(29, 30), tile(30, 30), tile(2, 2)],
    }]);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    evidencia['demolirNosTresConjuntos'] = {
      dePeRemovidos: 2, desenhadosRemovidos: 2, chaoVazioIgnorado: 1,
      devolvido: pedra(depois) - pedraAntes,
      esperado: Math.floor(2 * FRACAO),
      formula: `floor(2 de pe x terreno.estrada.devolucaoAoDemolir=${FRACAO}) — o canteiro devolve 0`,
      dePeDepois: dePe(depois), desenhadosDepois: desenhados(depois),
    };
    expect(pedra(depois) - pedraAntes).toBe(Math.floor(2 * FRACAO));
  });
});

afterAll(() => {
  gravarEvidencia('F18d-1b', {
    feature: 'F18d-1b-estrada-canteiro',
    aceite: 'a rua desenhada nao liga nada no tick do comando e liga depois que o laborer assenta; a pedra sai do armazem exatamente uma vez, no assentamento',
    cenario: {
      rua: { tiles: RUA.length, de: RUA[0], ate: RUA[RUA.length - 1] },
      liga: { predio: escola.id, tipo: escola.tipo, ao: armazem.id },
      pedraInicialNoMundo: pedra(inicial),
    },
    ...evidencia,
  });
});
