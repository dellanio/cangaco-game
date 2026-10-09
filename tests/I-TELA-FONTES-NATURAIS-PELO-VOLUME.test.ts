import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { configDasFontes, estadoDaFonte, MemoriaDasFontes, texturaDaFonte } from '../src/render/fontes-naturais';
import { rendimentosDasFontes } from '../src/render/mapa';
import { extracaoDaFonte } from './helpers/fontes-volume-cenario';

const { validarFontesNaturais } = createRequire(import.meta.url)('../tools/data-rules.js') as { validarFontesNaturais: (c: unknown, erros: string[]) => void };
describe('I-TELA-FONTES-NATURAIS-PELO-VOLUME', () => {
  it('limites inclusivos, zero e rendimento parametrizado', () => {
    for (const tipo of configDasFontes.tipos) {
      const r = rendimentosDasFontes[tipo]!;
      for (const [f, esperado] of [[1, 'presente'], [2 / 3, 'presente'], [0.6, 'reduzido'], [1 / 3, 'reduzido'], [0.3, 'remanescente'], [0, null]] as const) {
        expect(estadoDaFonte(f * r, r)).toBe(esperado); expect(estadoDaFonte(f * r * 2, r * 2)).toBe(esperado);
      }
    }
    expect(() => estadoDaFonte(1, 0)).toThrow();
  });
  it('dado de interface recusa limiares/estados/tipos invalidos', () => {
    const erros: string[] = []; validarFontesNaturais(configDasFontes, erros); expect(erros).toEqual([]);
    for (const c of [undefined, { ...configDasFontes, limiares: [0.3, 0.6] }, { ...configDasFontes, tipos: ['fish'] }, { ...configDasFontes, estados: ['outono'] }, { ...configDasFontes, escala: 0 }]) {
      const erros: string[] = []; validarFontesNaturais(c, erros); expect(erros.length).toBeGreaterThan(0);
    }
  });
  it('cache por tick/partida, sem repintar dentro da faixa nem mutar o estado', () => {
    const memoria = new MemoriaDasFontes(), recurso = { '1,1': { tipo: 'coal', quantidade: 10 }, '2,1': { tipo: 'tree', quantidade: 10 } };
    const antes = JSON.stringify(recurso), rendimento = { coal: 10 };
    expect(memoria.atualizar(recurso, 0, rendimento)).toEqual(['1,1']);
    expect(memoria.atualizar(recurso, 0, rendimento)).toEqual([]); expect(memoria.recalculos).toBe(1);
    expect(memoria.atualizar({ ...recurso, '1,1': { tipo: 'coal', quantidade: 9 } }, 1, rendimento)).toEqual([]);
    expect(memoria.atualizar({ ...recurso, '1,1': { tipo: 'coal', quantidade: 5 } }, 2, rendimento)).toEqual(['1,1']);
    expect(memoria.atualizar({}, 3, rendimento)).toEqual(['1,1']); expect(memoria.fontes.size).toBe(0);
    expect(memoria.atualizar(recurso, 0, rendimento)).toEqual(['1,1']); expect(JSON.stringify(recurso)).toBe(antes);
  });
  it('PNG ausente conserva presente; sem arte conserva marcador', () => {
    const fonte = { tipo: 'coal', estado: 'reduzido', quantidade: 5 };
    expect(texturaDaFonte(fonte, () => true)).toBe('recurso:coal:reduzido');
    expect(texturaDaFonte(fonte, c => c.endsWith(':presente'))).toBe('recurso:coal:presente');
    expect(texturaDaFonte(fonte, () => false)).toBeNull(); expect(texturaDaFonte(undefined, () => true)).toBeNull();
  });
  for (const tipo of configDasFontes.tipos) it(`${tipo}: step real atravessa os tres volumes e remove so o tile esgotado`, () => {
    const { chave, fases } = extracaoDaFonte(tipo), memoria = new MemoriaDasFontes();
    expect(fases.map(f => f.estado)).toEqual(['presente', 'reduzido', 'remanescente', 'zero']);
    for (const f of fases) {
      const antes = JSON.stringify(f.jogo);
      memoria.atualizar(f.jogo.recursos, f.jogo.tick, rendimentosDasFontes);
      expect(memoria.fontes.get(chave)?.estado ?? 'zero').toBe(f.estado);
      expect(JSON.stringify(f.jogo)).toBe(antes);
      expect([...memoria.fontes].some(([k, fonte]) => k !== chave && fonte.tipo === tipo && fonte.estado === 'presente')).toBe(true);
    }
  });
});
