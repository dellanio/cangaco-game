import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import manifesto from '../assets/manifest.json';
import meta from '../assets/base/corn/crescimento/derivacao.json';
import { lerPng, type Imagem } from './helpers/png';
import { geometriaDaCultura, texturaDoEstagioDaCultura } from '../src/render/culturas-visual';
import { ESTAGIOS_DA_CULTURA } from '../src/render/crescimento';
import { chaveDeTextura } from '../src/render/manifesto';
import { gravarEvidencia } from './helpers/evidence';

const corn = manifesto.assets.find(a => a.id === 'corn' && a.tipo === 'recurso')!;
const estados: Readonly<Record<string, string | undefined>> = corn.estados;
const sha = (p: string): string => createHash('sha256').update(readFileSync(`assets/${p}`)).digest('hex');
function limites(p: Imagem, alfa: number) {
  let y0 = p.altura, y1 = -1;
  for (let y = 0; y < p.altura; y++) for (let x = 0; x < p.largura; x++) {
    if (p.rgba[(y * p.largura + x) * 4 + 3]! >= alfa) { y0 = Math.min(y0, y); y1 = y; }
  }
  if (y1 < 0) throw new Error('PNG vazio');
  return { pe: y1, altura: y1 - y0 + 1 };
}
describe('I-ARTE-MILHO-CRESCENDO — milho nos três estágios', () => {
  it('preserva caminho, bytes e contrato da madura; só três estados novos', () => {
    expect(Object.keys(estados).sort()).toEqual(['presente', ...ESTAGIOS_DA_CULTURA.filter(e => e !== 'pronto')].sort());
    expect(corn.tamanho).toEqual([64, 64]);
    expect(corn.footprint).toEqual([1, 1]);
    expect(corn.anchor).toEqual([0.5, 1]);
    expect(corn.origem.base).toBe(meta.referencia);
    for (const [estado, original] of Object.entries(meta.preservados)) {
      expect(estados[estado]).toBe(original.arquivo);
      expect(sha(original.arquivo)).toBe(original.sha256);
    }
  });
  it('mede porte crescente, pés, transparência, masters e origem rastreável', () => {
    const adulta = lerPng(`assets/${corn.estados.presente}`);
    const pe = limites(adulta, 1).pe, altura = limites(adulta, 128).altura;
    let anterior = 0;
    const medidas = [];
    for (const m of meta.medidas) {
      const png = lerPng(`assets/${estados[m.estado]}`), tamanho = limites(png, 128).altura;
      expect([png.largura, png.altura]).toEqual(corn.tamanho);
      expect(limites(png, 1).pe).toBe(pe);
      expect(tamanho).toBeGreaterThan(anterior);
      expect(tamanho).toBeLessThan(altura);
      expect(png.rgba[3]).toBe(0);
      expect(png.rgba[(png.largura - 1) * 4 + 3]).toBe(0);
      anterior = tamanho;
      const master = lerPng(`assets/${m.arquivos[1]!.arquivo}`);
      expect([master.largura, master.altura]).toEqual([128, 128]);
      expect(limites(master, 1).pe).toBe((pe + 1) * 2 - 1);
      expect(sha(m.fonte)).toBe(m.sha256);
      expect(m.geracao).toMatch(/^exec-/);
      for (const arquivo of m.arquivos) expect(sha(arquivo.arquivo)).toBe(arquivo.sha256);
      medidas.push({ estado: m.estado, alturaOpaca: tamanho, pe });
    }
    gravarEvidencia('I-ARTE-MILHO-CRESCENDO', { medidas, maduraPreservada: true });
  });
  it('seleciona cada juvenil no seu estágio e deixa pronta/mapa na madura', () => {
    const madura = chaveDeTextura('recurso', 'corn', 'presente');
    for (const e of ESTAGIOS_DA_CULTURA.filter(e => e !== 'pronto')) {
      const esperado = chaveDeTextura('recurso', 'corn', e);
      expect(texturaDoEstagioDaCultura('corn', e, madura, k => k === esperado))
        .toEqual({ chave: esperado, juvenil: true });
    }
    for (const e of ['pronto', null] as const) {
      expect(texturaDoEstagioDaCultura('corn', e, madura, () => true)).toEqual({ chave: madura, juvenil: false });
    }
  });
  it('PNG ausente conserva fallback e não muda a cana', () => {
    for (const e of ESTAGIOS_DA_CULTURA) {
      expect(texturaDoEstagioDaCultura('corn', e, 'madura', () => false)).toEqual({ chave: 'madura', juvenil: false });
      expect(texturaDoEstagioDaCultura('grapes', e, 'cana', () => true)).toEqual({ chave: 'cana', juvenil: false });
    }
  });
  it('juvenis mantêm altura de um tile; pronta conserva o aumento de 50%', () => {
    for (const e of ESTAGIOS_DA_CULTURA.filter(e => e !== 'pronto')) {
      expect(geometriaDaCultura('corn', e, 64)).toEqual({ largura: 64, altura: 64, peX: 32, peY: 64, emPe: false });
    }
    expect(geometriaDaCultura('corn', 'pronto', 64)).toEqual({ largura: 64, altura: 96, peX: 32, peY: 64, emPe: true });
  });
});
