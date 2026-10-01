// D-TELA-LUZ-RELEVO — a conta da luz do relevo, pura (sem Phaser).
//
// A opcao A do relevo (docs/planos/relevo-a.md) desenha a altura so pela LUZ: uma camada de
// sombra (MULTIPLY) e uma de luz ([DST_COLOR, ONE]) sobre o chao, e o tint dos sprites. A conta
// mora em `src/render/relevo.ts` e e testada aqui, headless. O que se afirma:
//
// - o chao plano e 1,0 EXATO, e as duas texturas sao neutras nele (255 e 0): e o que deixa o
//   chao plano igual pixel a pixel com a flag ligada e desligada (decisao 7 do plano);
// - a luz vem de cima, inclinada para o sul, sem leste-oeste: a encosta sul clareia, a norte
//   escurece, e leste e oeste dao o MESMO fator;
// - os numeros da avaliacao (0,83 / 1,11 a 8 px por degrau; 0,71 / 1,14 a 12,8);
// - o sprite nunca passa de `tetoDoTintDoSprite` (S1, decisao 8);
// - a altura e so de render: nenhum arquivo de src/sim/ importa o relevo, e so relevo.ts le a
//   altura emitida.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  alturasDoMapa, calcularLuz, fatorEm, parametrosDaLuz, pxPorDegrauDaBusca, relevoPedido,
  texturasDaLuz, tileDoPe, tintDoFator, tintDoSprite,
  type AlturasDoRelevo, type ParametrosDaLuz,
} from '../src/render/relevo';
import { gravarEvidencia } from './helpers/evidence';

const TILE = 64;
const p: ParametrosDaLuz = { ...parametrosDaLuz, pxDeMundoPorDegrau: 8 };

/** Grade de vertices `n x n` com a altura dada por (x, y). */
function grade(n: number, altura: (x: number, y: number) => number): AlturasDoRelevo {
  const h = new Uint8Array(n * n);
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) h[y * n + x] = altura(x, y);
  return { largura: n, altura: n, h };
}
/** O fator do vertice do meio de uma grade 5x5. */
const doMeio = (alt: AlturasDoRelevo, params: ParametrosDaLuz = p): number =>
  calcularLuz(alt, params, TILE).fator[2 * 5 + 2]!;
const perto = (a: number, b: number): boolean => Math.abs(a - b) < 0.01;

describe('D-TELA-LUZ-RELEVO — a luz do relevo', () => {
  it('chao plano da 1 EXATO, e as texturas sao neutras exatas (sombra 255, luz 0)', () => {
    const luz = calcularLuz(grade(5, () => 5), p, TILE);
    expect([...luz.fator].every((f) => f === 1)).toBe(true);
    const { sombra, luz: realce } = texturasDaLuz(luz);
    expect([...sombra].every((v) => v === 255)).toBe(true);
    expect([...realce].every((v) => v === 0)).toBe(true);
    expect(fatorEm(luz, 1.5 * TILE, 2.25 * TILE, TILE)).toBe(1);
  });

  it('encosta que desce para o sul clareia (so a camada de luz), a que sobe escurece (so a de sombra)', () => {
    const sul = calcularLuz(grade(5, (_x, y) => 20 - 2 * y), p, TILE);
    const norte = calcularLuz(grade(5, (_x, y) => 2 * y), p, TILE);
    const i = 2 * 5 + 2;
    expect(sul.fator[i]!).toBeGreaterThan(1);
    expect(texturasDaLuz(sul).luz[i]!).toBeGreaterThan(0);
    expect(texturasDaLuz(sul).sombra[i]).toBe(255);
    expect(norte.fator[i]!).toBeLessThan(1);
    expect(norte.fator[i]!).toBeGreaterThanOrEqual(p.fatorMinimo);
    expect(texturasDaLuz(norte).sombra[i]!).toBeLessThan(255);
    expect(texturasDaLuz(norte).luz[i]).toBe(0);
  });

  it('os numeros da avaliacao: 8 px por degrau da ~0,83 / ~1,11; 12,8 px da ~0,71 / ~1,14', () => {
    const sul = grade(5, (_x, y) => 20 - 2 * y);
    const norte = grade(5, (_x, y) => 2 * y);
    const p128 = { ...p, pxDeMundoPorDegrau: 12.8 };
    const medidos = {
      px8: { norte: doMeio(norte), sul: doMeio(sul) },
      px12_8: { norte: doMeio(norte, p128), sul: doMeio(sul, p128) },
    };
    expect(perto(medidos.px8.norte, 0.83)).toBe(true);
    expect(perto(medidos.px8.sul, 1.11)).toBe(true);
    expect(perto(medidos.px12_8.norte, 0.714)).toBe(true);
    expect(perto(medidos.px12_8.sul, 1.143)).toBe(true);
    gravarEvidencia('D-TELA-LUZ-RELEVO-geometrias', medidos);
  });

  it('sem leste-oeste: a encosta para leste e a para oeste dao o MESMO fator, abaixo de 1', () => {
    const leste = doMeio(grade(5, (x) => 20 - 2 * x));
    const oeste = doMeio(grade(5, (x) => 2 * x));
    expect(leste).toBe(oeste);
    expect(leste).toBeLessThan(1);
  });

  it('o teto da luz do chao, se o dado o tiver, prende a encosta de luz; sem ele, nao ha teto', () => {
    const sul = grade(5, (_x, y) => 20 - 2 * y);
    // Float32 no mapa de luz: 1,05 volta como 1,0499999…; o 1 do plano e exato em Float32
    expect(doMeio(sul, { ...p, tetoDaLuzDoChao: 1.05 })).toBeCloseTo(1.05, 6);
    expect(doMeio(sul)).toBeGreaterThan(1.05);
  });

  it('bilinear entre os 4 vertices, e presa na borda do mapa', () => {
    const luz = calcularLuz(grade(5, (x, y) => 10 + x - y), p, TILE);
    const f = (x: number, y: number): number => luz.fator[y * 5 + x]!;
    expect(fatorEm(luz, 2 * TILE, 3 * TILE, TILE)).toBe(f(2, 3));
    const centro = (f(1, 1) + f(2, 1) + f(1, 2) + f(2, 2)) / 4;
    expect(Math.abs(fatorEm(luz, 1.5 * TILE, 1.5 * TILE, TILE) - centro)).toBeLessThan(1e-6);
    expect(fatorEm(luz, -5, -5, TILE)).toBe(f(0, 0));
    expect(fatorEm(luz, 4 * TILE + 5, 4 * TILE + 5, TILE)).toBe(f(4, 4));
    expect(fatorEm(luz, 4 * TILE + 5, -5, TILE)).toBe(f(4, 0));
  });

  it('o tint: cinza do fator, e o do sprite preso em tetoDoTintDoSprite (S1)', () => {
    expect(tintDoFator(1)).toBe(0xffffff);
    expect(tintDoFator(0.83)).toBe(0xd4d4d4);
    expect(tintDoFator(0)).toBe(0x000000);
    const cinzas = [0.2, 0.5, 0.83, 0.99, 1].map((f) => tintDoFator(f) & 0xff);
    expect(cinzas).toEqual([...cinzas].sort((a, b) => a - b));
    expect(parametrosDaLuz.tetoDoTintDoSprite).toBe(1);
    expect(tintDoSprite(1.11, p)).toBe(0xffffff); // nao recebe o realce
    expect(tintDoSprite(0.83, p)).toBe(0xd4d4d4);
  });

  it('o pedido: flag do dado ou ?relevo; o ?relevoPx so vale com numero positivo', () => {
    expect(relevoPedido('?pausado', false)).toBe(false);
    expect(relevoPedido('?pausado&relevo', false)).toBe(true);
    expect(relevoPedido('?pausado', true)).toBe(true);
    expect(pxPorDegrauDaBusca('?pausado&relevo', 8)).toBe(8);
    expect(pxPorDegrauDaBusca('?relevo&relevoPx=12.8', 8)).toBe(12.8);
    expect(pxPorDegrauDaBusca('?relevo&relevoPx=abc', 8)).toBe(8);
    expect(pxPorDegrauDaBusca('?relevo&relevoPx=0', 8)).toBe(8);
    expect(pxPorDegrauDaBusca('?relevo&relevoPx=-3', 8)).toBe(8);
  });

  it('o tile do pe: floor, e a chave muda so quando o pe cruza a borda do tile', () => {
    expect(tileDoPe(10, 10, TILE)).toBe('0,0');
    expect(tileDoPe(63.9, 127.9, TILE)).toBe('0,1');
    expect(tileDoPe(64, 128, TILE)).toBe('1,2');
  });

  it('o arquivo real: todo fator no intervalo, com encosta de luz e de sombra', () => {
    const alt = alturasDoMapa();
    const luz = calcularLuz(alt, parametrosDaLuz, TILE);
    const fatores = [...luz.fator];
    const minimo = Math.min(...fatores);
    const maximo = Math.max(...fatores);
    expect(alt.largura).toBe(129);
    expect(alt.altura).toBe(129);
    expect(minimo).toBeGreaterThanOrEqual(parametrosDaLuz.fatorMinimo);
    expect(maximo).toBeLessThan(2);
    const acima = fatores.filter((f) => f > 1).length;
    const abaixo = fatores.filter((f) => f < 1).length;
    const planos = fatores.filter((f) => f === 1).length;
    expect(acima).toBeGreaterThan(0);
    expect(abaixo).toBeGreaterThan(0);
    expect(planos).toBeGreaterThan(0);
    gravarEvidencia('D-TELA-LUZ-RELEVO', {
      pxDeMundoPorDegrau: parametrosDaLuz.pxDeMundoPorDegrau,
      vertices: fatores.length,
      minimo,
      maximo,
      acimaDe1: acima,
      abaixoDe1: abaixo,
      planosExatos: planos,
    });
  });
});

// A guarda estrutural: e o IMPORT resolvido para o caminho do arquivo, e nao uma busca de texto
// pelo nome — `relevo` aparece em comentario e em nome de funcao sem ler dado nenhum.
function listarTs(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return listarTs(caminho);
    return /\.tsx?$/.test(nome) ? [caminho] : [];
  });
}
function importsResolvidos(arquivo: string): string[] {
  const fonte = readFileSync(arquivo, 'utf-8');
  const especificadores = [...fonte.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
  return especificadores.filter((e) => e.startsWith('.')).map((e) => resolve(dirname(arquivo), e));
}
const DADO_DO_RELEVO = resolve('data/relevo.json');
const ehAlturaEmitida = (caminho: string): boolean => /[\\/]data[\\/]maps[\\/][^\\/]+\.relevo\.json$/.test(caminho);

describe('D-TELA-LUZ-RELEVO — a altura e so de render', () => {
  it('nenhum arquivo de src/sim/ importa data/relevo.json nem a altura emitida', () => {
    const vazamentos = listarTs('src/sim').flatMap((f) =>
      importsResolvidos(f).filter((i) => i === DADO_DO_RELEVO || ehAlturaEmitida(i)).map((i) => `${f} -> ${i}`));
    expect(vazamentos).toEqual([]);
  });

  it('em src/, so render/relevo.ts importa a altura emitida', () => {
    const leitores = listarTs('src').filter((f) => importsResolvidos(f).some(ehAlturaEmitida));
    expect(leitores).toEqual([join('src', 'render', 'relevo.ts')]);
  });
});
