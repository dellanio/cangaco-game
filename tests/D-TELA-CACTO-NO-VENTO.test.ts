import { describe, expect, it } from 'vitest';
import dados from '../data/vento.json';
import manifesto from '../assets/manifest.json';
import tabelas from './helpers/especies-por-tile-cacto.json';
import { especiesDaVegetacao } from '../src/render/crescimento';
import { chaveDeTextura } from '../src/render/manifesto';
import { especieDoTile, fatoresDaArvore, transformacaoDoVento } from '../src/render/vento';
import { validarVento } from '../tools/data-rules.js';
import { gravarEvidencia } from './helpers/evidence';

const entrada = manifesto.assets.find((a) => a.tipo === 'vegetacao' && a.id === 'tree')!;
const especies = especiesDaVegetacao(Object.keys(entrada.estados));
describe('D-TELA-CACTO-NO-VENTO (cacto quase parado e variacao por arvore)', () => {
  it('a tabela fixa cobre todas as especies e os dois subconjuntos', () => {
    expect(tabelas.map(t => t.especies)).toEqual([especies, especies.slice(1, 4), ['presente']]);
  });
  it.each(tabelas)('preserva a especie na tabela fixa 16 x 16: $especies', ({ especies: carregadas, linhas }) => {
    expect(linhas).toHaveLength(16);
    for (let gy = 0; gy < 16; gy += 1) {
      expect(linhas[gy]).toHaveLength(16);
      for (let gx = 0; gx < 16; gx += 1) {
        const esperada = carregadas[Number.parseInt(linhas[gy]![gx]!, 16)]!;
        expect(especieDoTile(carregadas.map(e => chaveDeTextura('vegetacao', 'tree', e)), gx, gy), gx + ',' + gy)
          .toBe(chaveDeTextura('vegetacao', 'tree', esperada));
      }
    }
    gravarEvidencia('D-TELA-CACTO-NO-VENTO-especies', { tilesPorTabela: 16 * 16, tabelas: 3, especies });
  });
  it('sem especies carregadas conserva a textura de fallback', () => {
    expect(especieDoTile([], 3, 4)).toBe(chaveDeTextura('vegetacao', 'tree', 'presente'));
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
