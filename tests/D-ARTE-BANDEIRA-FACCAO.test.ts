import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { panoDaBandeira } from '../src/render/bandeira';
import vento from '../data/vento.json';
import { validarBandeira } from '../tools/data-rules.js';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';

const dados = JSON.parse(readFileSync('data/bandeira.json', 'utf8'));
const config = { ...dados, larguraPx: 22.4, alturaPx: 14.08 };

describe('D-ARTE-BANDEIRA-FACCAO (pano ondula no vento)', () => {
  it.each([0, 12, 73, 120, 999])('determinismo, fixacao e amplitude no tick %i', (tick) => {
    const pano = panoDaBandeira(vento, config, tick, 0.25, 3, 4);
    expect(pano).toEqual(panoDaBandeira(vento, config, tick, 0.25, 3, 4));
    expect(pano).toHaveLength(2 * (config.segmentos + 1));
    expect(pano[0]).toEqual({ x: 0, y: 0 });
    expect(pano.at(-1)).toEqual({ x: 0, y: config.alturaPx });
    for (let i = 0; i <= config.segmentos; i += 1) {
      expect(Math.abs(pano[i]!.y)).toBeLessThanOrEqual(config.amplitudeMaximaPx * i / config.segmentos);
      expect(pano[pano.length - 1 - i]!.y - pano[i]!.y).toBeCloseTo(config.alturaPx, 9);
    }
  });
  it('sem forca preserva o retangulo; a onda se propaga para a ponta', () => {
    const pano = panoDaBandeira({ ...vento, forca: 0 }, config, 13, 0.5, 2, 7);
    for (let i = 0; i <= config.segmentos; i += 1) {
      expect(pano[i]!.x).toBeCloseTo(config.larguraPx * i / config.segmentos, 9);
      expect(pano[i]!.y).toBeCloseTo(0, 9);
      expect(pano[pano.length - 1 - i]!.y).toBeCloseTo(config.alturaPx, 9);
    }
  });
  it('a rajada aumenta a ponta no mesmo tile e instante', () => {
    const t = vento.rajada.duracaoTicks / 2;
    const fora = { ...vento, rajada: { ...vento.rajada, duracaoTicks: 2 } };
    const ponta = (v: typeof vento) => Math.abs(panoDaBandeira(v, config, t, 0.25, 0, 0)[config.segmentos]!.y);
    expect(ponta(vento)).toBeGreaterThan(ponta(fora));
  });
  it('tiles distintos e direcao do vento alteram a fase', () => {
    const pano = panoDaBandeira(vento, config, 17, 0.5, 3, 4);
    expect(pano).not.toEqual(panoDaBandeira(vento, config, 17, 0.5, 4, 4));
    expect(pano).not.toEqual(panoDaBandeira({ ...vento, direcao: { x: 0, y: 1 } }, config, 17, 0.5, 3, 4));
  });
  it('dado real valido e exclusivo da interface', () => {
    const erros: string[] = [];
    validarBandeira(dados, erros);
    expect(erros).toEqual([]);
    expect(ARQUIVOS_DA_INTERFACE).toContain('bandeira');
    expect(ARQUIVOS).not.toContain('bandeira');
  });
  it.each([
    ['segmentos', 1], ['segmentos', 2.5], ['amplitudeMaximaPx', 0],
    ['comprimentoDeOndaPx', -1], ['velocidadePxPorTick', 0],
  ])('reprova %s invalido', (campo, valor) => {
    const erros: string[] = [];
    validarBandeira({ ...dados, [campo]: valor }, erros);
    expect(erros.some((e) => e.includes(`interface/bandeira: ${campo}`))).toBe(true);
  });
});
