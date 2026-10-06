/**
 * I-TELA-ABAS-MENORES — os quatro botoes principais 20% menores (pedido do operador, 2026-10-05).
 * Le os numeros da regra que vale, a ULTIMA do CSS (a da arte final): altura 66 -> 53 px, a linha do
 * pictograma 46 -> 37, o pictograma 44 -> 35, o rotulo 8 -> 6,4 px (80%, arredondado ao pixel onde e
 * pixel inteiro), e as quatro colunas em 80% da regua.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/ui/estilo.css', 'utf8');
/** Todos os blocos do seletor, na ordem do arquivo: a cascata. A declaracao que vale e a ULTIMA de
 *  cada propriedade (I-TELA-MENU-DA-PROPOSTA acrescentou um bloco `#abas` so com o fundo, e o ultimo
 *  bloco deixou de ter todas as propriedades). */
const bloco = (seletor: string): string => {
  const partes: string[] = [];
  let i = css.indexOf(`${seletor} {`);
  while (i >= 0) {
    // so o seletor exato: o caractere antes nao pode continuar outro seletor (`#abas button` nao e `#abas`)
    const antes = i === 0 ? '\n' : css[i - 1]!;
    if (/[\s},]/.test(antes)) partes.push(css.slice(i, css.indexOf('}', i)));
    i = css.indexOf(`${seletor} {`, i + 1);
  }
  if (partes.length === 0) throw new Error(`sem o bloco ${seletor}`);
  return partes.join(';');
};
const num = (b: string, prop: string): number => {
  const todas = [...b.matchAll(new RegExp(String.raw`(?:^|[;{\s])${prop}:\s*([0-9.]+)px`, 'g'))];
  return Number(todas[todas.length - 1]?.[1]);
};

describe('I-TELA-ABAS-MENORES', () => {
  it('altura, pictograma e rotulo em 80%, e as colunas em 80% da regua', () => {
    const botao = bloco('#abas button');
    expect(num(botao, 'height')).toBe(Math.round(66 * 0.8));
    expect(num(botao, 'grid-template-rows')).toBe(Math.round(46 * 0.8));
    // o rotulo fica em 6 px, abaixo dos 80% (6,4): com 6,4 "Distribuicao" estoura a largura menor
    expect(num(botao, "font-size")).toBeLessThanOrEqual(8 * 0.8);
    const icone = bloco('#abas button::before');
    expect(num(icone, 'width')).toBe(Math.round(44 * 0.8));
    expect(num(icone, 'height')).toBe(Math.round(44 * 0.8));
    expect(bloco('#abas')).toContain('repeat(4, calc((80% - 12px) / 4))');
  });
});
