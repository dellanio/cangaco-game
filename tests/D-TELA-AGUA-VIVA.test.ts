import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { varianteDaAgua, celulasDaAguaParaTrocar } from '../src/render/agua-viva';
import { validarInterface } from '../tools/data-rules.js';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { gravarEvidencia } from './helpers/evidence';

const config = JSON.parse(readFileSync('data/agua.json', 'utf8')) as {
  periodo: number; variantes: string[];
};
const carregar = (nomes: readonly string[]) => Object.fromEntries(nomes.map((nome) =>
  [nome, JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'))]));

describe('D-TELA-AGUA-VIVA — agua pelo tick', () => {
  it('e pura, usa quatro variantes, muda so nas fronteiras e tem fases por tile', () => {
    const variantes = new Set(config.variantes);
    for (let gy = 0; gy < 10; gy += 1) for (let gx = 0; gx < 10; gx += 1) {
      const primeira = varianteDaAgua(config, 0, gx, gy);
      expect(varianteDaAgua(config, 0, gx, gy)).toBe(primeira);
      const vistas = new Set<string>();
      for (let tick = 0; tick < 4 * config.periodo; tick += 1) {
        const atual = varianteDaAgua(config, tick, gx, gy);
        expect(variantes.has(atual)).toBe(true);
        vistas.add(atual);
        if (tick > 0 && tick % config.periodo !== 0) {
          expect(atual).toBe(varianteDaAgua(config, tick - 1, gx, gy));
        }
      }
      expect(vistas.size).toBeGreaterThanOrEqual(2);
    }
    const fases = new Set(Array.from({ length: 100 }, (_, i) =>
      varianteDaAgua(config, 0, i % 10, Math.floor(i / 10))));
    expect(fases.size).toBeGreaterThan(1);
    gravarEvidencia('D-TELA-AGUA-VIVA', { periodo: config.periodo, variantes: config.variantes,
      variantesDistintasNoBloco: fases.size });
  });

  it('troca somente agua cuja variante mudou, mesmo com vizinhos diferentes', () => {
    const desejada = varianteDaAgua(config, config.periodo, 0, 0);
    expect(celulasDaAguaParaTrocar(config, config.periodo, [
      { gx: 0, gy: 0, tipo: 'agua', varianteAtual: 'invalida' },
      { gx: 1, gy: 0, tipo: 'areia', varianteAtual: 'invalida' },
      { gx: 0, gy: 1, tipo: 'grama', varianteAtual: 'invalida' },
      { gx: 1, gy: 1, tipo: 'campoArado', varianteAtual: 'invalida' },
      { gx: 2, gy: 0, tipo: 'agua', varianteAtual: varianteDaAgua(config, config.periodo, 2, 0) },
    ])).toEqual([{ gx: 0, gy: 0, variante: desejada }]);
  });

  it('o dado e de interface e a regra reprova periodo e variante invalidos', () => {
    expect(ARQUIVOS_DA_INTERFACE).toContain('agua');
    expect(ARQUIVOS).not.toContain('agua');
    const jogo = carregar(ARQUIVOS);
    const ui = carregar(ARQUIVOS_DA_INTERFACE);
    const erros = (entrada: Record<string, unknown>) => validarInterface(jogo, entrada)
      .filter((erro: string) => erro.startsWith('interface/agua'));
    expect(erros(ui)).toEqual([]);
    expect(erros({ ...ui, agua: { ...config, periodo: 0 } }).length).toBeGreaterThan(0);
    expect(erros({ ...ui, agua: { ...config, periodo: -1 } }).length).toBeGreaterThan(0);
    expect(erros({ ...ui, agua: { ...config, variantes: ['padrao', 'v1', 'v2', 'nao-existe'] } }).length)
      .toBeGreaterThan(0);
  });
});
