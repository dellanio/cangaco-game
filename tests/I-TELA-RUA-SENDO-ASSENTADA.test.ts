/**
 * I-TELA-RUA-SENDO-ASSENTADA (aceite 1) — o estagio de cada tile do canteiro da rua, puro e pelo `step`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { chaveDeTile, tilesDaPorta } from '../src/sim/estradas';
import { estagiosDaRuaEmObra } from '../src/render/rua-em-obra';
import type { EstagioDaRua } from '../src/render/rua-em-obra';
import { inicial, tile } from './helpers/jobs-cenario';
import { gravarEvidencia } from './helpers/evidence';

const N = gameData.construcao.ticksAssentarEstradaPorTile;
const TETO = 600;

const armazem = (() => {
  const p = inicial.predios.ordem.map((id) => inicial.predios.porId[id]).find((x) => x?.tipo === 'storehouse');
  if (!p) throw new Error('fixture: cenario sem armazem');
  return p;
})();
const porta = tilesDaPorta(armazem, gameData)[0];
if (porta === undefined) throw new Error('fixture: armazem sem porta');
const ALVO = tile(porta.gx, porta.gy + 1);
const CHAVE = chaveDeTile(ALVO);

describe('I-TELA-RUA-SENDO-ASSENTADA', () => {
  it('sem canteiro, nenhum estagio; o tile desenhado sem pedra e marcado', () => {
    expect(estagiosDaRuaEmObra(inicial, N)).toEqual({});
    const e = step(inicial, [{ type: 'PlaceRoad', tiles: [ALVO] }]);
    expect(estagiosDaRuaEmObra(e, N)[CHAVE]).toBe('marcado');
  });

  it('pelo step: o tile passa por marcado, pedras, obra-1 e obra-2, nessa ordem, e vira rua', () => {
    let e = step(inicial, [{ type: 'PlaceRoad', tiles: [ALVO] }]);
    const vistos: EstagioDaRua[] = [];
    for (let i = 0; i < TETO && e.estradas[CHAVE] !== true; i += 1) {
      const atual = estagiosDaRuaEmObra(e, N)[CHAVE];
      if (atual !== undefined && vistos[vistos.length - 1] !== atual) vistos.push(atual);
      e = step(e, []);
    }
    gravarEvidencia('I-TELA-RUA-SENDO-ASSENTADA', { ticksPorTile: N, sequencia: vistos, tickDaRua: e.tick });
    expect(e.estradas[CHAVE]).toBe(true);
    expect(vistos).toEqual(['marcado', 'pedras', 'obra-1', 'obra-2']);
    expect(estagiosDaRuaEmObra(e, N)[CHAVE]).toBeUndefined();
  });
});
