import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { particulasDaPoeira } from '../src/render/poeira';
import type { ConfigDaPoeira, VistaDaPoeira } from '../src/render/poeira';
import type { DadosDoVento } from '../src/render/vento';
import { validarPoeira } from '../tools/data-rules.js';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { gravarEvidencia } from './helpers/evidence';

const config = JSON.parse(readFileSync('data/poeira.json', 'utf8')) as ConfigDaPoeira;
const vento = JSON.parse(readFileSync('data/vento.json', 'utf8')) as DadosDoVento;
const vista: VistaDaPoeira = { x: 0, y: 0, largura: 128, altura: 128, larguraMapa: 128, alturaMapa: 128 };
const agua = (gx: number, gy: number) => gx < 12 && gy < 12;

describe('D-TELA-POEIRA-AMBIENTE', () => {
  it('e pura, limitada a vista, exclui agua e obedece ao vento e ao tempo de vida', () => {
    const semVento = { ...vento, forca: 0 };
    expect(particulasDaPoeira(config, semVento, 40, 0, vista, agua)).toEqual([]);
    const tipos = new Set<string>();
    let paresEmMovimento = 0;
    let maiorNaVista = 0;
    for (let tick = 0; tick < 200; tick += 1) {
      const atual = particulasDaPoeira(config, vento, tick, 0, vista, agua);
      expect(particulasDaPoeira(config, vento, tick, 0, vista, agua)).toEqual(atual);
      maiorNaVista = Math.max(maiorNaVista, atual.length);
      expect(atual.length).toBeLessThanOrEqual(config.maximoNaVista);
      for (const p of atual) {
        expect(p.x).toBeGreaterThanOrEqual(vista.x);
        expect(p.x).toBeLessThan(vista.x + vista.largura);
        expect(p.y).toBeGreaterThanOrEqual(vista.y);
        expect(p.y).toBeLessThan(vista.y + vista.altura);
        expect(agua(p.gx, p.gy)).toBe(false);
        expect(tick - p.nascimento).toBeLessThan(config.vidaTicks);
        tipos.add(p.tipo);
      }
      const proximas = new Map(particulasDaPoeira(config, vento, tick + 1, 0, vista, agua)
        .map((p) => [p.id, p]));
      for (const p of atual) {
        const proxima = proximas.get(p.id);
        if (!proxima) continue;
        expect((proxima.x - p.x) * vento.direcao.x + (proxima.y - p.y) * vento.direcao.y)
          .toBeGreaterThan(0);
        paresEmMovimento += 1;
      }
    }
    expect([...tipos].sort()).toEqual(['palha', 'poeira']);
    expect(paresEmMovimento).toBeGreaterThan(0);
    gravarEvidencia('D-TELA-POEIRA-AMBIENTE', { ticks: 200, maiorNaVista, paresEmMovimento, tipos: [...tipos].sort() });
  });

  it('valida o dado como interface e reprova teto, vida e cores invalidos', () => {
    expect(ARQUIVOS_DA_INTERFACE).toContain('poeira');
    expect(ARQUIVOS).not.toContain('poeira');
    const erros = (entrada: unknown) => {
      const saida: string[] = [];
      validarPoeira(entrada, saida);
      return saida;
    };
    expect(erros(config)).toEqual([]);
    expect(erros({ ...config, maximoNaVista: 0 })).toContain('interface/poeira: maximoNaVista precisa ser inteiro > 0');
    expect(erros({ ...config, vidaTicks: 0 })).toContain('interface/poeira: vidaTicks precisa ser inteiro > 0');
    expect(erros({ ...config, corPoeira: 'terra' })).toContain('interface/poeira: corPoeira precisa ser #rrggbb');
    expect(erros({ ...config, corPalha: '#ff00' })).toContain('interface/poeira: corPalha precisa ser #rrggbb');
    expect(erros({ ...config, forca: 1 })).toContain('interface/poeira: o vento vem de data/vento.json');
  });
});
