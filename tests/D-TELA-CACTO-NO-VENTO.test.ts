import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { transpileModule } from 'typescript';
import dados from '../data/vento.json';
import manifesto from '../assets/manifest.json';
import { especiesDaVegetacao } from '../src/render/crescimento';
import { chaveDeTextura } from '../src/render/manifesto';
import { especieDoTile, fatoresDaArvore, transformacaoDoVento } from '../src/render/vento';
import { validarVento } from '../tools/data-rules.js';
import { gravarEvidencia } from './helpers/evidence';

const entrada = manifesto.assets.find((a) => a.tipo === 'vegetacao' && a.id === 'tree')!;
const especies = especiesDaVegetacao(Object.keys(entrada.estados));
const literalAnterior = readFileSync('tests/helpers/textura-da-vegetacao-antes-cacto.txt', 'utf8');
const compilado = transpileModule(`class CenaAnterior { ${literalAnterior} }`, {}).outputText;
const CenaAnterior = new Function('especiesDaVegetacao', 'chaveDeTextura', 'tileDeChave',
  `${compilado}; return CenaAnterior;`)(especiesDaVegetacao, chaveDeTextura,
  (chave: string) => { const [gx, gy] = chave.split(',').map(Number); return { gx, gy }; }) as {
    prototype: { texturaDaVegetacao: (desenho: unknown, chave: string) => string };
  };

describe('D-TELA-CACTO-NO-VENTO (cacto quase parado e variacao por arvore)', () => {
  it.each([especies, especies.slice(1, 4), ['presente'], []])(
    'preserva o metodo anterior nos 128 x 128 tiles com as texturas carregadas %j', (...carregadas: string[]) => {
      const cena = { textures: { exists: (chave: string) => carregadas.some((e) => chave === chaveDeTextura('vegetacao', 'tree', e)) } };
      for (let gy = 0; gy < 128; gy += 1) for (let gx = 0; gx < 128; gx += 1) {
        const antes = CenaAnterior.prototype.texturaDaVegetacao.call(cena,
          { entrada, chave: chaveDeTextura('vegetacao', 'tree', 'presente') }, `${gx},${gy}`);
        expect(especieDoTile(carregadas.map((e) => chaveDeTextura('vegetacao', 'tree', e)), gx, gy)).toBe(antes);
      }
      gravarEvidencia('D-TELA-CACTO-NO-VENTO-especies', { tiles: 128 * 128, especies });
    });
  it.each(['mandacaru', 'facheiro', 'xique-xique'])('limita %s ao fator do juazeiro no mesmo tile em 2000 ticks', (especie) => {
    const fator = dados.especies[especie as keyof typeof dados.especies].amplitude;
    for (const [gx, gy] of [[0, 0], [3, 4], [127, 127]]) {
      let cacto = 0; let juazeiro = 0;
      for (let tick = 0; tick < 2000; tick += 1) {
        const arvore = transformacaoDoVento(dados, tick, 0, gx!, gy!, 13, 17, 'presente');
        const v = transformacaoDoVento(dados, tick, 0, gx!, gy!, 13, 17, especie);
        expect(Math.abs(v.deslocamentoGraus)).toBeLessThanOrEqual(fator * dados.amplitudeMaximaGraus);
        expect(v.xPe).toBe(13); expect(v.yPe).toBe(17);
        cacto = Math.max(cacto, Math.abs(v.deslocamentoGraus));
        juazeiro = Math.max(juazeiro, Math.abs(arvore.deslocamentoGraus));
      }
      expect(cacto).toBeLessThanOrEqual(fator * juazeiro + 1e-12);
    }
  });
  it('amplitude e periodo diferem por tile, dentro do desvio deterministico', () => {
    const a = fatoresDaArvore(dados, 'presente', 3, 4);
    const b = fatoresDaArvore(dados, 'presente', 4, 4);
    expect(a).toEqual(fatoresDaArvore(dados, 'presente', 3, 4));
    expect(a.amplitude).not.toBe(b.amplitude); expect(a.periodoTicks).not.toBe(b.periodoTicks);
    for (let gx = 0; gx < 128; gx += 1) {
      const f = fatoresDaArvore(dados, 'presente', gx, 7);
      expect(f.amplitude).toBeGreaterThanOrEqual(1 - dados.variacaoPorArvore);
      expect(f.amplitude).toBeLessThanOrEqual(1);
      expect(dados.periodoTicks / f.periodoTicks).toBeGreaterThanOrEqual(1 - dados.variacaoPorArvore);
      expect(dados.periodoTicks / f.periodoTicks).toBeLessThanOrEqual(1 + dados.variacaoPorArvore);
    }
  });
  it('o dado atual passa a regra interface/vento', () => {
    const erros: string[] = []; validarVento(dados, erros); expect(erros).toEqual([]);
  });
  it.each<readonly [string, (d: typeof dados) => void]>([
    ['ausente', (d: typeof dados) => { Reflect.deleteProperty(d.especies, 'presente'); }],
    ['inventada', (d: typeof dados) => { Object.assign(d.especies, { inventada: { amplitude: 1, velocidade: 1 } }); }],
    ...['amplitude', 'velocidade'].flatMap((eixo) => [0, -0.1, 1.1, NaN, Infinity].map((valor) =>
      [`${eixo}=${valor}`, (d: typeof dados) => { Object.assign(d.especies.presente, { [eixo]: valor }); }] as const)),
    ...[-0.1, 0.5, NaN, Infinity].map((valor) => [`variacao=${valor}`, (d: typeof dados) => { d.variacaoPorArvore = valor; }] as const),
  ])('reprova %s', (_nome, alterar) => {
    const copia = structuredClone(dados); alterar(copia);
    const erros: string[] = []; validarVento(copia, erros);
    expect(erros.some((e) => e.startsWith('interface/vento:'))).toBe(true);
  });
});
