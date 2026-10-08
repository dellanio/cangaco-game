import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pontosDosPeixesPendurados, pilhasVisiveisDoPredio } from '../src/render/estoque-visual';
import { dadosDasPilhas } from '../src/render/predios';
import type { GameState, PredioCompleto } from '../src/sim/state';
import type { Manifesto } from '../src/render/manifesto';
import manifesto from '../assets/manifest.json';
const require = createRequire(import.meta.url);
const { decodePng } = require('../skills/pianco-sprite-tools/scripts/png-rgba.mjs') as { decodePng: (b: Uint8Array) => { width: number; height: number; data: Uint8Array } };

describe('I-ARTE-PEIXES-PENDURADOS-NA-BODEGA', () => {
  it('base original com hash, alpha limpo e peixe vertical de 32x80', () => {
    const e = manifesto.assets.find(a => a.tipo === 'pilha' && a.id === 'fish')!;
    const p = decodePng(readFileSync(`assets/${e.estados.unidade}`));
    expect([p.width, p.height]).toEqual([32, 80]);
    expect(e.tamanho).toEqual([p.width, p.height]);
    expect(e.anchor).toEqual([0.5, 1]);
    expect(p.data[3]).toBe(0);
    expect(p.data.some((v, i) => i % 4 === 3 && v >= 128)).toBe(true);
    const registro = JSON.parse(readFileSync('assets/base/fish-stock/geracao.json', 'utf8')) as { sha256: string };
    expect(createHash('sha256').update(readFileSync(`assets/${e.origem.base}`)).digest('hex')).toBe(registro.sha256);
  });
  it.each([0, 1, 2, 5, 6, 12])('estoque %i determina contagem, teto e equilibrio, sem escrever no estado', n => {
    const { estado } = JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8')) as { estado: GameState };
    const bodega = Object.values(estado.predios.porId).find(p => p.tipo === 'inn' && p.estado === 'completo') as PredioCompleto;
    const p: PredioCompleto = { ...bodega, estoque: { entrada: { fish: n, loaves: 5 }, saida: {} } };
    const antes = JSON.stringify(p);
    const pilhas = pilhasVisiveisDoPredio(p, dadosDasPilhas(manifesto as unknown as Manifesto));
    const peixe = pilhas.find(x => x.mercadoria === 'fish');
    expect(peixe?.n ?? 0).toBe(Math.min(n, 6));
    const pontos = pontosDosPeixesPendurados('inn', 'fish', peixe?.n ?? 0)!;
    expect(pontos).toHaveLength(Math.min(n, 6));
    const esquerda = pontos.filter(p => p[0] < 0.5).length;
    expect(Math.abs(esquerda - (pontos.length - esquerda))).toBeLessThanOrEqual(1);
    expect(new Set(pontos.map(p => p.join(','))).size).toBe(pontos.length);
    expect(pontos.every(p => p[0] >= 0 && p[0] <= 1 && p[1] > 0.7 && p[1] <= 1)).toBe(true);
    expect(pilhas.find(x => x.mercadoria === 'loaves')?.n).toBe(5);
    expect(JSON.stringify(p)).toBe(antes);
  });
  it('outras mercadorias e outros predios preservam o caminho da pilha', () => {
    expect(pontosDosPeixesPendurados('inn', 'loaves', 5)).toBeNull();
    expect(pontosDosPeixesPendurados('fishers', 'fish', 5)).toBeNull();
  });
});
